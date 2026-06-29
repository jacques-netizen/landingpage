"use client";

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import { Download } from "lucide-react";

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: string;
  dueDate?: string | null;
  status: string;
  customer: {
    name?: string | null;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  items: {
    description: string;
    qty: number;
    unit_price: number;
    discount_pct: number;
    line_total: number;
  }[];
  subtotal: number;
  discount_total: number;
  tax_rate: number;
  tax_total: number;
  total: number;
  amount_paid: number;
}

const COMPANY = {
  name: "17 Prime Home",
  location: "Accra, Ghana",
};

// Use the ISO currency code (GHS) in the PDF — the ₵ glyph is not in the
// built-in PDF font, and we don't want to depend on a remote font fetch.
function money(n: number) {
  return (
    "GHS " +
    new Intl.NumberFormat("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  );
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium" }).format(new Date(d));
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1B1714", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  company: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1B1714" },
  companySub: { fontSize: 9, color: "#8A8076", marginTop: 2 },
  invoiceTag: { fontSize: 9, color: "#8A8076", textTransform: "uppercase", letterSpacing: 1 },
  invoiceNo: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  meta: { fontSize: 9, color: "#8A8076", marginTop: 2 },
  statusBadge: { marginTop: 6, fontSize: 9, fontFamily: "Helvetica-Bold", color: "#9C0A13" },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: "#8A8076", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  billName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  billLine: { fontSize: 9, color: "#5b524b", marginTop: 1 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#EDE6DA" },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EDE6DA", paddingVertical: 6, backgroundColor: "#FAF7F2" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0EAE0", paddingVertical: 6 },
  cDesc: { width: "46%", paddingHorizontal: 4 },
  cQty: { width: "12%", textAlign: "right", paddingHorizontal: 4 },
  cUnit: { width: "18%", textAlign: "right", paddingHorizontal: 4 },
  cDisc: { width: "10%", textAlign: "right", paddingHorizontal: 4 },
  cTotal: { width: "14%", textAlign: "right", paddingHorizontal: 4 },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#8A8076", textTransform: "uppercase" },
  totals: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalRowStrong: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#EDE6DA", marginTop: 2 },
  muted: { color: "#8A8076" },
  strong: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#b3a89d", borderTopWidth: 1, borderTopColor: "#EDE6DA", paddingTop: 8 },
});

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const outstanding = data.total - data.amount_paid;
  return (
    <Document title={data.invoiceNumber} author={COMPANY.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.company}>{COMPANY.name}</Text>
            <Text style={styles.companySub}>{COMPANY.location}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.invoiceTag}>Invoice</Text>
            <Text style={styles.invoiceNo}>{data.invoiceNumber}</Text>
            <Text style={styles.meta}>Date: {fmtDate(data.createdAt)}</Text>
            {data.dueDate ? <Text style={styles.meta}>Due: {fmtDate(data.dueDate)}</Text> : null}
            <Text style={styles.statusBadge}>{data.status.replace("_", " ").toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bill To</Text>
          <Text style={styles.billName}>{data.customer?.name ?? "—"}</Text>
          {data.customer?.company_name ? <Text style={styles.billLine}>{data.customer.company_name}</Text> : null}
          {data.customer?.phone ? <Text style={styles.billLine}>{data.customer.phone}</Text> : null}
          {data.customer?.email ? <Text style={styles.billLine}>{data.customer.email}</Text> : null}
          {data.customer?.address ? <Text style={styles.billLine}>{data.customer.address}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.cDesc, styles.thText]}>Description</Text>
            <Text style={[styles.cQty, styles.thText]}>Qty</Text>
            <Text style={[styles.cUnit, styles.thText]}>Unit</Text>
            <Text style={[styles.cDisc, styles.thText]}>Disc%</Text>
            <Text style={[styles.cTotal, styles.thText]}>Total</Text>
          </View>
          {data.items.map((item, i) => (
            <View style={styles.tr} key={i}>
              <Text style={styles.cDesc}>{item.description}</Text>
              <Text style={styles.cQty}>{item.qty}</Text>
              <Text style={styles.cUnit}>{money(item.unit_price)}</Text>
              <Text style={styles.cDisc}>{item.discount_pct > 0 ? `${item.discount_pct}%` : "—"}</Text>
              <Text style={styles.cTotal}>{money(item.line_total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Subtotal</Text>
              <Text>{money(data.subtotal)}</Text>
            </View>
            {data.discount_total > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Discount</Text>
                <Text>-{money(data.discount_total)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.muted}>VAT {data.tax_rate}%</Text>
              <Text>{money(data.tax_total)}</Text>
            </View>
            <View style={styles.totalRowStrong}>
              <Text style={styles.strong}>Total</Text>
              <Text style={styles.strong}>{money(data.total)}</Text>
            </View>
            {data.amount_paid > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Paid</Text>
                <Text>-{money(data.amount_paid)}</Text>
              </View>
            ) : null}
            {outstanding > 0 ? (
              <View style={styles.totalRow}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: "#9C0A13" }}>Outstanding</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", color: "#9C0A13" }}>{money(outstanding)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.footer}>
          {COMPANY.name} · {COMPANY.location} · Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}

export default function InvoicePdfInner({ data }: { data: InvoicePdfData }) {
  return (
    <PDFDownloadLink
      document={<InvoiceDocument data={data} />}
      fileName={`${data.invoiceNumber}.pdf`}
    >
      {({ loading }) => (
        <span className="inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          {loading ? "Preparing…" : "Download PDF"}
        </span>
      )}
    </PDFDownloadLink>
  );
}
