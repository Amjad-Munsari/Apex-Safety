import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { BRAND } from "@/lib/branding"

// PDFs render server-side via @react-pdf, which can't resolve CSS custom
// properties — so brand accents come from the shared BRAND hexes, not --teal/--gold.
const SEVERITY_COLORS: Record<string, string> = {
  Low: BRAND.teal,
  Medium: BRAND.gold,
  High: "#dc2626",
  Critical: "#7c3aed",
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    // extra bottom padding reserves room for the fixed per-page footer
    // so flowing content never overlaps it
    paddingBottom: 56,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: "1px solid #eeeeee",
  },
  logoBlock: { flexDirection: "column" },
  logo: { fontSize: 20, fontFamily: "Times-Roman", fontWeight: "bold", color: "#000000" },
  logoSpan: { fontSize: 15, color: "#666666", fontFamily: "Helvetica", fontWeight: "normal" },
  tagline: { fontSize: 7, color: "#999999", marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },
  metaBlock: { textAlign: "right" },
  metaLabel: { fontSize: 7, color: "#999999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  metaValue: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  metaDate: { fontSize: 9, color: "#666666" },

  infoGrid: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: "1px solid #eeeeee",
  },
  gridCol: { flex: 1 },
  gridLabel: { fontSize: 7, color: "#999999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  gridName: { fontSize: 11, fontWeight: "bold", marginBottom: 3 },
  gridDetail: { fontSize: 8, color: "#666666", lineHeight: 1.4 },

  docTitle: { fontSize: 22, fontFamily: "Times-Roman", fontWeight: "bold", marginBottom: 6 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusLabel: { fontSize: 7, color: "#999999", textTransform: "uppercase", letterSpacing: 1, marginRight: 8 },
  statusText: { fontSize: 9, fontWeight: "bold" },

  sectionLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },
  paragraph: { fontSize: 9, lineHeight: 1.7, color: "#333333", marginBottom: 16 },

  hazardCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#fafafa",
    borderLeft: "3px solid #eeeeee",
  },
  hazardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  hazardLocation: { fontSize: 9, fontWeight: "bold", color: "#1a1a1a" },
  severityBadge: { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },
  hazardDesc: { fontSize: 8, color: "#444444", lineHeight: 1.5, marginBottom: 4 },
  hazardActionLabel: { fontSize: 7, color: "#999999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  hazardAction: { fontSize: 8, color: "#333333", lineHeight: 1.4 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTop: "1px solid #eeeeee",
    paddingTop: 8,
  },
  footerText: { fontSize: 6, color: "#999999", textTransform: "uppercase", letterSpacing: 0.5 },
  footerPage: { fontSize: 6, color: "#999999", textTransform: "uppercase", letterSpacing: 0.5 },
})

export interface ReportDocumentProps {
  clientName: string
  siteAddress: string
  assessmentDate: string
  executiveSummary: string
  hazards: {
    location: string
    description: string
    severity: "Low" | "Medium" | "High" | "Critical"
    recommendedAction: string
  }[]
  complianceStatus: "Pass" | "Action Required" | "Fail"
}

const STATUS_COLOR: Record<string, string> = {
  Pass: BRAND.teal,
  "Action Required": BRAND.gold,
  Fail: "#dc2626",
}

export const ReportDocument = ({
  clientName,
  siteAddress,
  assessmentDate,
  executiveSummary,
  hazards,
  complianceStatus,
}: ReportDocumentProps) => (
  <Document title={`FRA Report — ${clientName}`}>
    <Page size="A4" style={styles.page} wrap>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoBlock}>
          <Text style={styles.logo}>888 <Text style={styles.logoSpan}>Safety Solutions</Text></Text>
          <Text style={styles.tagline}>Fire Safety · Health &amp; Safety · Training</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>FIRE RISK ASSESSMENT</Text>
          <Text style={styles.metaValue}>FRA Report</Text>
          <Text style={styles.metaDate}>{assessmentDate}</Text>
        </View>
      </View>

      {/* INFO GRID */}
      <View style={styles.infoGrid}>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>PREPARED FOR</Text>
          <Text style={styles.gridName}>{clientName}</Text>
          <Text style={styles.gridDetail}>{siteAddress}</Text>
        </View>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>PREPARED BY</Text>
          <Text style={styles.gridName}>Matt Robinson</Text>
          <Text style={styles.gridDetail}>Lead Consultant · 888 Safety & Training</Text>
          <Text style={styles.gridDetail}>888FST@proton.me · 0114 555 0188</Text>
        </View>
      </View>

      {/* TITLE & COMPLIANCE STATUS */}
      <Text style={styles.docTitle}>Fire Risk Assessment.</Text>
      <View style={styles.statusPill}>
        <Text style={styles.statusLabel}>Overall Status:</Text>
        <Text style={[styles.statusText, { color: STATUS_COLOR[complianceStatus] || "#000" }]}>
          {complianceStatus}
        </Text>
      </View>

      {/* EXECUTIVE SUMMARY */}
      <Text style={styles.sectionLabel}>EXECUTIVE SUMMARY</Text>
      <Text style={styles.paragraph}>{executiveSummary}</Text>

      {/* HAZARDS */}
      <Text style={styles.sectionLabel}>HAZARDS &amp; RECOMMENDED ACTIONS ({hazards.length})</Text>
      {hazards.map((hazard, i) => {
        // Keep small/medium hazard blocks intact across the page boundary, but
        // allow genuinely large blocks to wrap so they can never overflow a page.
        const blockLength = (hazard.description?.length ?? 0) + (hazard.recommendedAction?.length ?? 0)
        const isLargeBlock = blockLength > 600
        return (
          <View
            key={i}
            wrap={isLargeBlock}
            // nudge a block to the next page rather than orphaning it at the bottom
            minPresenceAhead={isLargeBlock ? undefined : 60}
            style={[styles.hazardCard, { borderLeftColor: SEVERITY_COLORS[hazard.severity] || "#ccc" }]}
          >
            <View style={styles.hazardHeader}>
              <Text style={styles.hazardLocation}>{hazard.location}</Text>
              <Text style={[styles.severityBadge, { color: SEVERITY_COLORS[hazard.severity] || "#000" }]}>
                {hazard.severity}
              </Text>
            </View>
            <Text style={styles.hazardDesc}>{hazard.description}</Text>
            <Text style={styles.hazardActionLabel}>Recommended Action</Text>
            <Text style={styles.hazardAction}>{hazard.recommendedAction}</Text>
          </View>
        )
      })}

      {/* FOOTER — fixed so it repeats at the bottom of every page */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>888 SAFETY SOLUTIONS LTD — COMPANY NO. 18552988</Text>
        <Text style={styles.footerText}>CONFIDENTIAL — PREPARED FOR {clientName.toUpperCase()}</Text>
        <Text
          style={styles.footerPage}
          render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
        />
      </View>
    </Page>
  </Document>
)
