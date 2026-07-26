import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { PUBLIC_CONTACT_LINE } from "@/lib/public-identity"

// Service Agreement PDF — issued once a proposal is signed. Mirrors the
// proposal-document visual language (Helvetica/Times-Roman, A4) so the two
// documents read as one family. This is the counter-signed deliverable the
// client downloads from /client/contracts.

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  logoBlock: { flexDirection: "column" },
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
  metaBlock: { textAlign: "right" },
  metaLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaValue: { fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  metaDate: { fontSize: 10, color: "#666666" },
  grid: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 30,
    borderBottom: "1px solid #eeeeee",
    paddingBottom: 20,
  },
  gridCol: { flex: 1 },
  gridLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  gridName: { fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  gridDetail: { fontSize: 9, color: "#666666", lineHeight: 1.4 },
  docTitle: {
    fontSize: 20,
    fontFamily: "Times-Roman",
    fontWeight: "bold",
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#333333",
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 9,
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 10,
  },
  table: { width: "100%", marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #1a1a1a",
    paddingBottom: 5,
    marginBottom: 10,
  },
  tableRow: { flexDirection: "row", marginBottom: 10 },
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
  termsSection: { marginTop: 20 },
  termItem: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 4,
    lineHeight: 1.4,
  },
  signatures: { flexDirection: "row", gap: 40, marginTop: 30 },
  sigBlock: { flex: 1 },
  sigSpace: {
    height: 40,
    borderBottom: "1px solid #eeeeee",
    marginBottom: 10,
    justifyContent: "center",
    paddingLeft: 10,
  },
  sigImg: {
    fontFamily: "Times-Roman",
    fontSize: 16,
    fontStyle: "italic",
    color: "#333",
  },
  sigMeta: { fontSize: 8, color: "#999999" },
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

export interface ContractDocumentProps {
  clientName: string
  clientAddress: string
  contactName: string
  reference: string
  services: { name: string; description: string; quantity: number; unit_price: number }[]
  subtotalAmount: number
  vatAmount: number
  totalAmount: number
  /** Date the client signed the originating proposal (en-GB). */
  signedDate: string | null
  /** Name of the person who signed for the client, if recorded. */
  signedBy: string | null
  /** Date this agreement was issued (en-GB). */
  issuedDate: string
}

export const ContractDocument = ({
  clientName,
  clientAddress,
  contactName,
  reference,
  services,
  subtotalAmount,
  vatAmount,
  totalAmount,
  signedDate,
  signedBy,
  issuedDate,
}: ContractDocumentProps) => (
  <Document title={`Service Agreement - ${clientName}`}>
    <Page size="A4" style={styles.page}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoBlock}>
          <Text style={styles.logo}>888 <Text style={styles.logoSpan}>Safety Solutions</Text></Text>
          <Text style={styles.tagline}>Fire Safety · Health & Safety · Training</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>SERVICE AGREEMENT</Text>
          <Text style={styles.metaValue}>{reference}</Text>
          <Text style={styles.metaDate}>Issued {issuedDate}</Text>
        </View>
      </View>

      {/* PARTIES */}
      <View style={styles.grid}>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>THE CLIENT</Text>
          <Text style={styles.gridName}>{clientName}</Text>
          <Text style={styles.gridDetail}>{clientAddress}</Text>
          <Text style={styles.gridDetail}>Attn: {contactName}</Text>
        </View>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>THE PROVIDER</Text>
          <Text style={styles.gridName}>888 Safety Solutions Ltd</Text>
          <Text style={styles.gridDetail}>Lead Consultant: Matt Robinson</Text>
          <Text style={styles.gridDetail}>{PUBLIC_CONTACT_LINE}</Text>
        </View>
      </View>

      <Text style={styles.docTitle}>Service Agreement.</Text>
      <Text style={styles.paragraph}>
        This Agreement is made between 888 Safety Solutions Ltd (&quot;the Provider&quot;) and {clientName}
        {" "}(&quot;the Client&quot;). It confirms the services agreed in the signed proposal
        {signedDate ? ` accepted on ${signedDate}` : ""} and sets out the terms under which the
        Provider will deliver them. The schedule of services and fees below forms part of this Agreement.
      </Text>

      <Text style={styles.sectionLabel}>SCHEDULE OF SERVICES</Text>
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
        <Text style={styles.sectionLabel}>TERMS & CONDITIONS</Text>
        <Text style={styles.termItem}>1. The Provider will deliver the services in the schedule above to the standards required by current UK fire safety legislation.</Text>
        <Text style={styles.termItem}>2. Fees are exclusive of VAT, which is charged at the prevailing rate. Travel within 20 miles of Sheffield is included; mileage beyond is charged at 45p/mile.</Text>
        <Text style={styles.termItem}>3. Written reports are issued within 10 working days of each site visit.</Text>
        <Text style={styles.termItem}>4. Either party may terminate this Agreement with 30 days&apos; written notice. Work completed up to the termination date remains chargeable.</Text>
        <Text style={styles.termItem}>5. Cancellations within 48 hours of a booked visit are charged at 50% of the service fee.</Text>
        <Text style={styles.termItem}>6. This Agreement is governed by the laws of England and Wales.</Text>
      </View>

      <View style={styles.signatures}>
        <View style={styles.sigBlock}>
          <Text style={styles.sectionLabel}>SIGNED FOR CLIENT</Text>
          <View style={styles.sigSpace}>
            {signedBy ? <Text style={styles.sigImg}>{signedBy}</Text> : null}
          </View>
          <Text style={styles.sigMeta}>
            {signedBy ? `${signedBy} / ` : "Name & role / "}
            {signedDate ?? "Date"}
          </Text>
        </View>
        <View style={styles.sigBlock}>
          <Text style={styles.sectionLabel}>SIGNED FOR 888</Text>
          <View style={styles.sigSpace}>
            <Text style={styles.sigImg}>Matt Robinson</Text>
          </View>
          <Text style={styles.sigMeta}>Matt Robinson, Lead Consultant / {issuedDate}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>888 SAFETY SOLUTIONS LTD - COMPANY NO. 18552988</Text>
        <Text style={styles.footerText}>Page 1 of 1</Text>
      </View>
    </Page>
  </Document>
)
