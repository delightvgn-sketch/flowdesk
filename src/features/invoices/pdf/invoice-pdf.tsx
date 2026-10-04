import { Document, Page, StyleSheet, Svg, Path, Rect, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import type { InvoiceDocumentData } from "../components/invoice-document";

const ink = "#2a2622";
const muted = "#76706a";
const line = "#e7e3dd";
const brand = "#1f6f68";

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 9.5, color: ink, fontFamily: "Helvetica", lineHeight: 1.45 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  brandName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginLeft: 8 },
  muted: { color: muted },
  label: { fontSize: 7.5, letterSpacing: 1.2, color: muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  number: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  section: { marginTop: 26, paddingTop: 16, borderTopWidth: 1, borderTopColor: line },
  th: { fontSize: 8, color: muted, fontFamily: "Helvetica-Bold", paddingBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 8 },
  colDesc: { flex: 1, paddingRight: 12 },
  colQty: { width: 44, textAlign: "right" },
  colPrice: { width: 92, textAlign: "right" },
  colAmount: { width: 92, textAlign: "right" },
  totals: { marginTop: 16, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: ink, marginTop: 6, paddingTop: 8 },
  grandText: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  badge: { marginTop: 8, alignSelf: "flex-end", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 7.5, color: muted, textAlign: "center" },
});

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "#e3f2ea", fg: "#1d7a4a" },
  OVERDUE: { bg: "#fbe6e4", fg: "#b2382c" },
  SENT: { bg: "#e5eefb", fg: "#2c5ea8" },
  DRAFT: { bg: "#efede9", fg: muted },
  CANCELLED: { bg: "#efede9", fg: muted },
};

/** Reusable invoice PDF document. Rendered on the server by the PDF routes. */
export function InvoicePdf({ data }: { data: InvoiceDocumentData }) {
  const money = (n: number) => formatMoney(n, { currency: data.currency, decimals: true });
  const status = STATUS_COLORS[data.status] ?? STATUS_COLORS.DRAFT;
  const balance = Math.max(0, data.total - data.amountPaid);

  return (
    <Document title={`Invoice ${data.number}`} author={data.from.name} creator="FlowDesk" producer="FlowDesk">
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View>
            <View style={[s.row, { alignItems: "center" }]}>
              <Svg width={24} height={24} viewBox="0 0 32 32">
                <Rect width={32} height={32} rx={8} fill={brand} />
                <Path d="M9 11.5h9.5a4.5 4.5 0 0 1 0 9H15" stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" fill="none" />
                <Path d="M9 16h5.5" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2.6} strokeLinecap="round" fill="none" />
              </Svg>
              <Text style={s.brandName}>{data.from.name}</Text>
            </View>
            <Text style={[s.muted, { marginTop: 10 }]}>{[data.from.address, data.from.email, data.from.phone].filter(Boolean).join("\n")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.label}>Invoice</Text>
            <Text style={s.number}>{data.number}</Text>
            <View style={[s.row, { marginTop: 8 }]}>
              <Text style={[s.muted, { width: 46 }]}>Issued</Text>
              <Text>{formatDate(data.issueDate)}</Text>
            </View>
            <View style={s.row}>
              <Text style={[s.muted, { width: 46 }]}>Due</Text>
              <Text>{formatDate(data.dueDate)}</Text>
            </View>
            <Text style={[s.badge, { backgroundColor: status.bg, color: status.fg }]}>{data.status}</Text>
          </View>
        </View>

        <View style={[s.section, s.between]}>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.label}>Bill to</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 6 }}>{data.to.company ?? data.to.name}</Text>
            <Text style={[s.muted, { marginTop: 2 }]}>
              {[data.to.company ? `Attn: ${data.to.name}` : null, data.to.address, data.to.email, data.to.phone].filter(Boolean).join("\n")}
            </Text>
          </View>
          {data.projectName && (
            <View style={{ alignItems: "flex-end", maxWidth: 200 }}>
              <Text style={s.label}>Project</Text>
              <Text style={{ marginTop: 6 }}>{data.projectName}</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 28 }}>
          <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: ink }]}>
            <Text style={[s.th, s.colDesc]}>Description</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colPrice]}>Unit price</Text>
            <Text style={[s.th, s.colAmount]}>Amount</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <Text style={s.colDesc}>{item.description}</Text>
              <Text style={s.colQty}>{item.quantity}</Text>
              <Text style={s.colPrice}>{money(item.unitPrice)}</Text>
              <Text style={[s.colAmount, { fontFamily: "Helvetica-Bold" }]}>{money(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{money(data.subtotal)}</Text>
          </View>
          {data.discountTotal > 0 && (
            <View style={s.totalRow}>
              <Text style={s.muted}>Discount{data.discountType === "PERCENT" ? ` (${data.discountValue}%)` : ""}</Text>
              <Text>-{money(data.discountTotal)}</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.muted}>Tax ({data.taxRate}% VAT)</Text>
            <Text>{money(data.taxTotal)}</Text>
          </View>
          <View style={s.grand}>
            <Text style={s.grandText}>Total</Text>
            <Text style={s.grandText}>{money(data.total)}</Text>
          </View>
          {data.amountPaid > 0 && (
            <>
              <View style={[s.totalRow, { marginTop: 4 }]}>
                <Text style={{ color: "#1d7a4a" }}>Paid</Text>
                <Text style={{ color: "#1d7a4a" }}>-{money(data.amountPaid)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Balance due</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{money(balance)}</Text>
              </View>
            </>
          )}
        </View>

        {data.notes && (
          <View style={s.section} wrap={false}>
            <Text style={s.label}>Notes</Text>
            <Text style={[s.muted, { marginTop: 6 }]}>{data.notes}</Text>
          </View>
        )}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${data.from.name} · Invoice ${data.number} · Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}
