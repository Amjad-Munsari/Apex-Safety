// Domain error for the send-for-signature flow. Lives outside the
// "use server" actions module because Next.js only permits async-function
// exports from "use server" files — a class export there breaks the build.

export type SendProposalErrorCode =
  | "not_found"
  | "already_finalised"
  | "no_pdf"
  | "no_client_email"

export class SendProposalError extends Error {
  readonly code: SendProposalErrorCode
  constructor(code: SendProposalErrorCode, message: string) {
    super(message)
    this.name = "SendProposalError"
    this.code = code
  }
}
