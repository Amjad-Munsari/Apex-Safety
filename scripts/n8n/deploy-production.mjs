#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const API_BASE =
  process.env.N8N_API_BASE ?? "https://fire-safety.app.n8n.cloud/api/v1"
const PUBLIC_APP_URL =
  process.env.N8N_PUBLIC_APP_URL ?? "https://www.merlinsafetysystem.com"
const ADMIN_INBOX =
  process.env.N8N_ADMIN_INBOX ?? "info@888safetyandtraining.com"

const WORKFLOW_NAMES = {
  errors: "Merlin Automation Failure Alerts",
  general: "Email Notifications",
  assessment: "Assessment Report Notifications",
}

const CREDENTIAL_NAMES = {
  gmail: "Info@ Account",
  generalHeader: "888 Webhook Secret",
  assessmentHeader: "888 Assessment Webhook Secret",
}

const EXISTING_WORKFLOW_IDS = {
  errors: "fzflrF6ByBnfRhxN",
  general: "hif6MMPvywQF6z6u",
  assessment: "eijErYNTCnWHuITQ",
}

function credential(id, name) {
  return { id, name }
}

function gmailNode({ id, name, position, subject, message, gmailCredential }) {
  return {
    parameters: {
      sendTo: ADMIN_INBOX,
      subject,
      emailType: "text",
      message,
      options: {
        appendAttribution: false,
        senderName: "Merlin Safety System",
        replyTo: ADMIN_INBOX,
      },
    },
    id,
    name,
    type: "n8n-nodes-base.gmail",
    typeVersion: 2.2,
    position,
    credentials: {
      gmailOAuth2: gmailCredential,
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1000,
  }
}

function responseNode(id, position) {
  return {
    parameters: {
      respondWith: "json",
      responseBody: '{\n  "ok": true,\n  "delivered": true\n}',
      options: {
        responseCode: 200,
      },
    },
    id,
    name: "Confirm Delivery",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.5,
    position,
  }
}

function invalidEventNode(id, position) {
  return {
    parameters: {
      respondWith: "json",
      responseBody:
        '{\n  "ok": false,\n  "delivered": false,\n  "error": "invalid_event"\n}',
      options: {
        responseCode: 422,
      },
    },
    id,
    name: "Reject Invalid Event",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.5,
    position,
  }
}

function requiredStringCondition(field, id) {
  return {
    id,
    leftValue: `={{ $json.body.${field} }}`,
    rightValue: "",
    operator: {
      type: "string",
      operation: "notEmpty",
      singleValue: true,
    },
  }
}

function validationNode({ id, name, fields, position }) {
  return {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: "",
          typeValidation: "strict",
          version: 3,
        },
        conditions: fields.map((field, index) =>
          requiredStringCondition(field, `${id}-condition-${index + 1}`)
        ),
        combinator: "and",
      },
      options: {},
    },
    id,
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 2.3,
    position,
  }
}

function eventSwitchNode() {
  const events = [
    ["client_form_created", "Client Form Created"],
    ["client_form_submitted", "Client Form Submitted"],
    ["client_template_cloned", "Client Template Cloned"],
  ]

  return {
    parameters: {
      rules: {
        values: events.map(([type, outputName], index) => ({
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: "",
              typeValidation: "strict",
              version: 3,
            },
            conditions: [
              {
                id: `event-type-${index + 1}`,
                leftValue: "={{ $json.body.type }}",
                rightValue: type,
                operator: {
                  type: "string",
                  operation: "equals",
                },
              },
            ],
            combinator: "and",
          },
          renameOutput: true,
          outputKey: outputName,
        })),
      },
      options: {
        fallbackOutput: "extra",
      },
    },
    id: "general-event-switch",
    name: "Route Supported Event",
    type: "n8n-nodes-base.switch",
    typeVersion: 3.4,
    position: [240, 300],
  }
}

function productionSettings(
  errorWorkflowId,
  saveErrors = "none",
  callerPolicy = "none"
) {
  return {
    executionOrder: "v1",
    executionTimeout: 30,
    saveDataErrorExecution: saveErrors,
    saveDataSuccessExecution: "none",
    timezone: "Europe/London",
    callerPolicy,
    availableInMCP: false,
    ...(errorWorkflowId ? { errorWorkflow: errorWorkflowId } : {}),
  }
}

function failureWorkflow(gmailCredential) {
  const errorTrigger = {
    parameters: {},
    id: "automation-error-trigger",
    name: "Automation Failed",
    type: "n8n-nodes-base.errorTrigger",
    typeVersion: 1,
    position: [0, 0],
  }

  const sendAlert = gmailNode({
    id: "send-automation-failure-alert",
    name: "Alert Matt",
    position: [260, 0],
    subject: "[Merlin] Automation failed",
    message:
      '={{ "A Merlin Safety System automation failed.\\n\\nWorkflow: " + ($json.workflow && $json.workflow.name ? $json.workflow.name : "Unknown workflow") + "\\nLast step: " + ($json.execution && $json.execution.lastNodeExecuted ? $json.execution.lastNodeExecuted : "Unknown") + "\\nError: " + ($json.execution && $json.execution.error && $json.execution.error.message ? $json.execution.error.message : "No error message was supplied") + "\\nExecution: " + ($json.execution && $json.execution.url ? $json.execution.url : "Open n8n and check Executions") }}',
    gmailCredential,
  })

  return {
    name: WORKFLOW_NAMES.errors,
    nodes: [errorTrigger, sendAlert],
    connections: {
      "Automation Failed": {
        main: [[{ node: "Alert Matt", type: "main", index: 0 }]],
      },
    },
    settings: productionSettings(
      undefined,
      "all",
      "workflowsFromSameOwner"
    ),
  }
}

function generalWorkflow({
  gmailCredential,
  headerCredential,
  errorWorkflowId,
}) {
  const webhook = {
    parameters: {
      httpMethod: "POST",
      path: "888-notifications",
      authentication: "headerAuth",
      responseMode: "responseNode",
      options: {},
    },
    id: "7daa3c49-ee09-4870-9c87-8d064063bd24",
    name: "Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2.1,
    position: [0, 300],
    webhookId: "9a64e7f9-64ae-4979-85a7-12dca5a81a6b",
    credentials: {
      httpHeaderAuth: headerCredential,
    },
  }

  const routeEvent = eventSwitchNode()
  const validateCreated = validationNode({
    id: "validate-client-form-created",
    name: "Validate Form Created",
    fields: [
      "client_id",
      "client_name",
      "template_id",
      "template_name",
      "template_type",
      "created_at",
    ],
    position: [500, 80],
  })
  const validateSubmitted = validationNode({
    id: "validate-client-form-submitted",
    name: "Validate Form Submitted",
    fields: ["client_id", "client_name", "submission_id", "submitted_at"],
    position: [500, 300],
  })
  const validateCloned = validationNode({
    id: "validate-client-template-cloned",
    name: "Validate Template Cloned",
    fields: [
      "client_id",
      "client_name",
      "template_id",
      "template_name",
      "parent_template_id",
      "cloned_at",
    ],
    position: [500, 520],
  })

  const sendCreated = gmailNode({
    id: "send-client-form-created",
    name: "Email Form Created",
    position: [780, 80],
    subject: "[Merlin] Client created a form template",
    message:
      '={{ "A client created a new form template.\\n\\nClient: " + ($json.body.client_name || $json.body.client_id) + "\\nClient ID: " + $json.body.client_id + "\\nTemplate: " + $json.body.template_name + "\\nType: " + $json.body.template_type + "\\nCreated: " + $json.body.created_at + "\\n\\nOpen client record: ' +
      PUBLIC_APP_URL +
      '/admin/clients/" + $json.body.client_id }}',
    gmailCredential,
  })
  const sendSubmitted = gmailNode({
    id: "send-client-form-submitted",
    name: "Email Form Submitted",
    position: [780, 300],
    subject: "[Merlin] Client submitted a form",
    message:
      '={{ "A client submitted a completed form.\\n\\nClient: " + ($json.body.client_name || $json.body.client_id) + "\\nClient ID: " + $json.body.client_id + "\\nSubmission ID: " + $json.body.submission_id + "\\nAssignment: " + ($json.body.assignment_id || "Self-fill (no assignment)") + "\\nSubmitted: " + $json.body.submitted_at + "\\n\\nReview submission: ' +
      PUBLIC_APP_URL +
      '/admin/assessments/" + $json.body.submission_id + "/review" }}',
    gmailCredential,
  })
  const sendCloned = gmailNode({
    id: "send-client-template-cloned",
    name: "Email Template Cloned",
    position: [780, 520],
    subject: "[Merlin] Client customised a form template",
    message:
      '={{ "A client copied one of the master templates into its own editable version. The master was not changed.\\n\\nClient: " + ($json.body.client_name || $json.body.client_id) + "\\nClient ID: " + $json.body.client_id + "\\nNew template: " + $json.body.template_name + "\\nNew template ID: " + $json.body.template_id + "\\nCopied from: " + $json.body.parent_template_id + "\\nCopied: " + $json.body.cloned_at + "\\n\\nOpen client record: ' +
      PUBLIC_APP_URL +
      '/admin/clients/" + $json.body.client_id }}',
    gmailCredential,
  })

  const confirmDelivery = responseNode("confirm-general-delivery", [1060, 300])
  const rejectInvalid = invalidEventNode("reject-invalid-general-event", [780, 740])

  return {
    name: WORKFLOW_NAMES.general,
    nodes: [
      webhook,
      routeEvent,
      validateCreated,
      validateSubmitted,
      validateCloned,
      sendCreated,
      sendSubmitted,
      sendCloned,
      confirmDelivery,
      rejectInvalid,
    ],
    connections: {
      Webhook: {
        main: [[{ node: "Route Supported Event", type: "main", index: 0 }]],
      },
      "Route Supported Event": {
        main: [
          [{ node: "Validate Form Created", type: "main", index: 0 }],
          [{ node: "Validate Form Submitted", type: "main", index: 0 }],
          [{ node: "Validate Template Cloned", type: "main", index: 0 }],
          [{ node: "Reject Invalid Event", type: "main", index: 0 }],
        ],
      },
      "Validate Form Created": {
        main: [
          [{ node: "Email Form Created", type: "main", index: 0 }],
          [{ node: "Reject Invalid Event", type: "main", index: 0 }],
        ],
      },
      "Validate Form Submitted": {
        main: [
          [{ node: "Email Form Submitted", type: "main", index: 0 }],
          [{ node: "Reject Invalid Event", type: "main", index: 0 }],
        ],
      },
      "Validate Template Cloned": {
        main: [
          [{ node: "Email Template Cloned", type: "main", index: 0 }],
          [{ node: "Reject Invalid Event", type: "main", index: 0 }],
        ],
      },
      "Email Form Created": {
        main: [[{ node: "Confirm Delivery", type: "main", index: 0 }]],
      },
      "Email Form Submitted": {
        main: [[{ node: "Confirm Delivery", type: "main", index: 0 }]],
      },
      "Email Template Cloned": {
        main: [[{ node: "Confirm Delivery", type: "main", index: 0 }]],
      },
    },
    settings: productionSettings(errorWorkflowId),
  }
}

function assessmentWorkflow({
  gmailCredential,
  headerCredential,
  errorWorkflowId,
}) {
  const webhook = {
    parameters: {
      httpMethod: "POST",
      path: "assessment-report",
      authentication: "headerAuth",
      responseMode: "responseNode",
      options: {},
    },
    id: "wh-assessment-report",
    name: "Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2.1,
    position: [0, 0],
    webhookId: "assessment-report",
    credentials: {
      httpHeaderAuth: headerCredential,
    },
  }

  const validate = validationNode({
    id: "validate-assessment-submission",
    name: "Validate Submission",
    fields: ["submissionId"],
    position: [260, 0],
  })

  const sendNotification = gmailNode({
    id: "send-assessment-notification",
    name: "Email Assessment Submitted",
    position: [540, -80],
    subject: "[Merlin] New assessment submitted",
    message:
      '={{ "A new assessment has been submitted and is ready for review.\\n\\nSubmission ID: " + $json.body.submissionId + "\\n\\nReview assessment: ' +
      PUBLIC_APP_URL +
      '/admin/assessments/" + $json.body.submissionId + "/review" }}',
    gmailCredential,
  })

  const confirmDelivery = responseNode("confirm-assessment-delivery", [820, -80])
  const rejectInvalid = invalidEventNode("reject-invalid-assessment", [540, 120])

  return {
    name: WORKFLOW_NAMES.assessment,
    nodes: [
      webhook,
      validate,
      sendNotification,
      confirmDelivery,
      rejectInvalid,
    ],
    connections: {
      Webhook: {
        main: [[{ node: "Validate Submission", type: "main", index: 0 }]],
      },
      "Validate Submission": {
        main: [
          [{ node: "Email Assessment Submitted", type: "main", index: 0 }],
          [{ node: "Reject Invalid Event", type: "main", index: 0 }],
        ],
      },
      "Email Assessment Submitted": {
        main: [[{ node: "Confirm Delivery", type: "main", index: 0 }]],
      },
    },
    settings: productionSettings(errorWorkflowId),
  }
}

async function apiRequest(path, options = {}) {
  const apiKey = process.env.N8N_API_KEY
  if (!apiKey) {
    throw new Error("N8N_API_KEY is required")
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...options.headers,
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(
      `n8n API ${options.method ?? "GET"} ${path} returned ${response.status}: ${text}`
    )
  }
  return body
}

async function listAll(path) {
  const result = await apiRequest(`${path}?limit=100`)
  return result.data ?? []
}

function findExactlyOne(rows, name, kind) {
  const matches = rows.filter((row) => row.name === name)
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one ${kind} named "${name}", found ${matches.length}`
    )
  }
  return matches[0]
}

async function upsertWorkflow(existing, definition) {
  if (existing) {
    return apiRequest(`/workflows/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(definition),
    })
  }
  return apiRequest("/workflows", {
    method: "POST",
    body: JSON.stringify(definition),
  })
}

async function activateWorkflow(id) {
  return apiRequest(`/workflows/${id}/activate`, {
    method: "POST",
    body: "{}",
  })
}

async function exportDefinitions(definitions) {
  const outputDirectory = resolve("docs/n8n/workflows")
  await mkdir(outputDirectory, { recursive: true })
  for (const [fileName, definition] of Object.entries(definitions)) {
    await writeFile(
      resolve(outputDirectory, fileName),
      `${JSON.stringify(definition, null, 2)}\n`,
      "utf8"
    )
  }
}

async function deploy() {
  const [credentials, workflows] = await Promise.all([
    listAll("/credentials"),
    listAll("/workflows"),
  ])

  const gmail = findExactlyOne(
    credentials,
    CREDENTIAL_NAMES.gmail,
    "credential"
  )
  const generalHeader = findExactlyOne(
    credentials,
    CREDENTIAL_NAMES.generalHeader,
    "credential"
  )
  const assessmentHeader = findExactlyOne(
    credentials,
    CREDENTIAL_NAMES.assessmentHeader,
    "credential"
  )

  const gmailCredential = credential(gmail.id, gmail.name)
  const failureDefinition = failureWorkflow(gmailCredential)
  const existingFailure =
    workflows.find((workflow) => workflow.id === EXISTING_WORKFLOW_IDS.errors) ??
    workflows.find((workflow) => workflow.name === WORKFLOW_NAMES.errors)
  const deployedFailure = await upsertWorkflow(
    existingFailure,
    failureDefinition
  )
  await activateWorkflow(deployedFailure.id)

  const generalDefinition = generalWorkflow({
    gmailCredential,
    headerCredential: credential(generalHeader.id, generalHeader.name),
    errorWorkflowId: deployedFailure.id,
  })
  const assessmentDefinition = assessmentWorkflow({
    gmailCredential,
    headerCredential: credential(assessmentHeader.id, assessmentHeader.name),
    errorWorkflowId: deployedFailure.id,
  })

  const existingGeneral =
    workflows.find((workflow) => workflow.id === EXISTING_WORKFLOW_IDS.general) ??
    workflows.find((workflow) => workflow.name === WORKFLOW_NAMES.general)
  const existingAssessment =
    workflows.find(
      (workflow) => workflow.id === EXISTING_WORKFLOW_IDS.assessment
    ) ??
    workflows.find((workflow) => workflow.name === WORKFLOW_NAMES.assessment)

  const deployedGeneral = await upsertWorkflow(
    existingGeneral,
    generalDefinition
  )
  const deployedAssessment = await upsertWorkflow(
    existingAssessment,
    assessmentDefinition
  )
  await activateWorkflow(deployedGeneral.id)
  await activateWorkflow(deployedAssessment.id)

  await exportDefinitions({
    "automation-failure-alerts.json": failureDefinition,
    "email-notifications.json": generalDefinition,
    "assessment-report-notifications.json": assessmentDefinition,
  })

  return {
    workflows: [
      {
        id: deployedFailure.id,
        name: deployedFailure.name,
        active: true,
        versionId: deployedFailure.versionId,
      },
      {
        id: deployedGeneral.id,
        name: deployedGeneral.name,
        active: true,
        versionId: deployedGeneral.versionId,
      },
      {
        id: deployedAssessment.id,
        name: deployedAssessment.name,
        active: true,
        versionId: deployedAssessment.versionId,
      },
    ],
  }
}

if (process.argv.includes("--deploy")) {
  const result = await deploy()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  process.stderr.write(
    "No live changes made. Run with --deploy after provisioning the named n8n credentials.\n"
  )
}
