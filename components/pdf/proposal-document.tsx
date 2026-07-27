import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import {
  PAGE_MARGIN_X,
  PAGE_BOTTOM_RESERVED,
  SIG_GAP,
  SIG_BLOCK_BOTTOM,
  SIG_SPACE_HEIGHT,
  SIG_SPACE_PADDING_LEFT,
  SIG_META_MARGIN_TOP,
} from "@/lib/pdf/signature-layout"
import { Branding, DEFAULT_BRANDING } from "@/lib/branding"
import { PUBLIC_CONTACT_LINE } from "@/lib/public-identity"

// Since we are generating PDFs on the server, we rely on standard fonts built into react-pdf (Helvetica, Times-Roman) 
// for simplicity, or we can register network fonts. We'll use Helvetica for a clean modern look.

const styles = StyleSheet.create({
  page: {
    padding: PAGE_MARGIN_X,
    // Reserve the bottom strip for the pinned signature block + footer so
    // flowing content can never overlap them.
    paddingBottom: PAGE_BOTTOM_RESERVED,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  logoBlock: {
    flexDirection: "column",
  },
  logo: {
    fontSize: 22,
    fontFamily: "Times-Roman",
    fontWeight: "bold",
    color: "#000000",
  },
  logoSpan: {
    fontSize: 16,
    color: "#666666",
    fontFamily: "Helvetica",
    fontWeight: "normal",
  },
  tagline: {
    fontSize: 8,
    color: "#888888",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaBlock: {
    textAlign: "right",
  },
  metaLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
  },
  metaDate: {
    fontSize: 10,
    color: "#666666",
  },
  grid: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 40,
    borderBottom: "1px solid #eeeeee",
    paddingBottom: 20,
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  gridName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  gridDetail: {
    fontSize: 9,
    color: "#666666",
    lineHeight: 1.4,
  },
  docTitle: {
    fontSize: 20,
    fontFamily: "Times-Roman",
    fontWeight: "bold",
    marginBottom: 15,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#333333",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 9,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 10,
  },
  table: {
    width: "100%",
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #1a1a1a",
    paddingBottom: 5,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  colService: { flex: 4 },
  colQty: { flex: 0.5, textAlign: "center" },
  colUnit: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  th: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase" },
  tdName: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  tdDesc: { fontSize: 8, color: "#666666" },
  tdValue: { fontSize: 10 },
  totals: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginTop: 10,
    borderTop: "1px solid #eeeeee",
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 150,
    marginBottom: 5,
  },
  totalLabel: { fontSize: 10, color: "#666666" },
  totalVal: { fontSize: 10 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 150,
    marginTop: 5,
    paddingTop: 5,
    borderTop: "1px solid #1a1a1a",
  },
  grandLabel: { fontSize: 12, fontWeight: "bold" },
  grandVal: { fontSize: 12, fontWeight: "bold" },
  termsSection: {
    marginTop: 30,
  },
  termItem: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 4,
    lineHeight: 1.4,
  },
  signatures: {
    // Pinned to a fixed spot on the last page so the e-sign stamper
    // (lib/pdf/embed-signature.ts) can place the captured signature exactly
    // on the client rule. Geometry lives in lib/pdf/signature-layout.ts.
    position: "absolute",
    left: PAGE_MARGIN_X,
    right: PAGE_MARGIN_X,
    bottom: SIG_BLOCK_BOTTOM,
    flexDirection: "row",
    gap: SIG_GAP,
  },
  sigBlock: {
    flex: 1,
  },
  sigSpace: {
    height: SIG_SPACE_HEIGHT,
    borderBottom: "1px solid #eeeeee",
    marginBottom: SIG_META_MARGIN_TOP,
    justifyContent: "center",
    paddingLeft: SIG_SPACE_PADDING_LEFT,
  },
  sigImg: {
    fontFamily: "Times-Roman",
    fontSize: 16,
    fontStyle: "italic",
    color: "#333",
  },
  sigMeta: {
    fontSize: 8,
    color: "#999999",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid #eeeeee",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
})

export interface ProposalDocumentProps {
  clientName: string
  clientAddress: string
  contactName: string
  scopeText: string
  services: { name: string; description: string; quantity: number; unit_price: number }[]
  subtotalAmount: number
  vatAmount: number
  totalAmount: number
  date: string
  branding?: Branding
}

export const ProposalDocument = ({
  clientName,
  clientAddress,
  contactName,
  scopeText,
  services,
  subtotalAmount,
  vatAmount,
  totalAmount,
  date,
  branding = DEFAULT_BRANDING,
}: ProposalDocumentProps) => (
  <Document title={`Proposal - ${clientName}`}>
    <Page size="A4" style={styles.page}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoBlock}>
          <Text style={styles.logo}>888 <Text style={styles.logoSpan}>Safety Solutions</Text></Text>
          <Text style={styles.tagline}>Fire Safety · Health & Safety · Training</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={[styles.metaLabel, { color: branding.primary }]}>PROPOSAL</Text>
          <Text style={styles.metaValue}>P-2026-NEW</Text>
          <Text style={styles.metaDate}>{date}</Text>
        </View>
      </View>

      {/* INFO GRID */}
      <View style={styles.grid}>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>PREPARED FOR</Text>
          <Text style={styles.gridName}>{clientName}</Text>
          <Text style={styles.gridDetail}>{clientAddress}</Text>
          <Text style={styles.gridDetail}>Attn: {contactName}</Text>
        </View>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>PREPARED BY</Text>
          <Text style={styles.gridName}>Matt Robinson</Text>
          <Text style={styles.gridDetail}>Lead Consultant · 888 Safety Solutions</Text>
          <Text style={styles.gridDetail}>{PUBLIC_CONTACT_LINE}</Text>
        </View>
      </View>

      <Text style={styles.docTitle}>Scope & proposal.</Text>
      <Text style={styles.paragraph}>{scopeText}</Text>

      <Text style={styles.sectionLabel}>SERVICES</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.colService}><Text style={styles.th}>Service</Text></View>
          <View style={styles.colQty}><Text style={styles.th}>Qty</Text></View>
          <View style={styles.colUnit}><Text style={styles.th}>Unit</Text></View>
          <View style={styles.colTotal}><Text style={styles.th}>Total</Text></View>
        </View>

        {services.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <View style={styles.colService}>
              <Text style={styles.tdName}>{item.name}</Text>
              <Text style={styles.tdDesc}>{item.description}</Text>
            </View>
            <View style={styles.colQty}><Text style={styles.tdValue}>{item.quantity}</Text></View>
            <View style={styles.colUnit}><Text style={styles.tdValue}>£{item.unit_price.toFixed(2)}</Text></View>
            <View style={styles.colTotal}><Text style={styles.tdValue}>£{(item.unit_price * item.quantity).toFixed(2)}</Text></View>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalVal}>£{subtotalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>VAT @ 20%</Text>
          <Text style={styles.totalVal}>£{vatAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandVal}>£{totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.termsSection}>
        <Text style={styles.sectionLabel}>TERMS SUMMARY</Text>
        <Text style={styles.termItem}>1. Fees quoted are valid for 30 days from the date of this proposal.</Text>
        <Text style={styles.termItem}>2. Fees exclude VAT. Travel within 20 miles of Sheffield is included; mileage beyond charged at 45p/mile.</Text>
        <Text style={styles.termItem}>3. Cancellations within 48 hours of a booked visit are charged at 50% of the service fee.</Text>
        <Text style={styles.termItem}>4. Written reports are issued within 10 working days of the site visit.</Text>
        <Text style={styles.termItem}>5. A Service Agreement will be generated and issued automatically once this proposal is signed.</Text>
      </View>

      <View style={styles.signatures}>
        <View style={styles.sigBlock}>
          <Text style={styles.sectionLabel}>SIGNED FOR CLIENT</Text>
          <View style={styles.sigSpace} />
          <Text style={styles.sigMeta}>Name & role / Date</Text>
        </View>
        <View style={styles.sigBlock}>
          <Text style={styles.sectionLabel}>SIGNED FOR 888</Text>
          <View style={styles.sigSpace}>
            <Text style={styles.sigImg}>Matt Robinson</Text>
          </View>
          <Text style={styles.sigMeta}>Matt Robinson, Lead Consultant / {date}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>888 SAFETY SOLUTIONS LTD - COMPANY NO. 18552988</Text>
        <Text style={styles.footerText}>Page 1 of 1</Text>
      </View>
    </Page>
  </Document>
)
