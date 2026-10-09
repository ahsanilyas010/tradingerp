// Client-side invoice "PDF": renders a print-ready HTML document and returns a Blob URL.
// Opens in a new tab where the browser's Print → Save as PDF produces the PDF. No server needed.
import { getDb } from "../data/mockApi.js";
import { CONFIG, fmt } from "./config.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function buildInvoiceHtml(invId) {
  const db = getDb();
  const inv = db.invoices.find(i => i.id === invId);
  if (!inv) throw new Error(`Invoice ${invId} not found`);
  const items = db.invoice_items.filter(i => i.invoice_id === invId);
  const cust = db.customers.find(c => c.id === inv.cust_id) || {};
  const paid = db.payments.filter(p => p.type === "Received" && p.ref_id === invId).reduce((s, p) => s + Number(p.amount), 0);
  const sub = items.reduce((s, i) => s + Number(i.total), 0);
  const taxRate = Number(inv.tax_rate || 0);
  const tax = Math.round(sub * taxRate / 100);
  const total = sub + tax;
  const c = CONFIG.company;
  const accent = "#0F3B4C";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.id)} — ${esc(c.name)}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#1b2b30;margin:0;padding:32px;background:#fff}
.wrap{max-width:820px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:16px}
h1{margin:0;font-size:26px;color:${accent};letter-spacing:.04em}
.muted{color:#5b7a80;font-size:12px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:22px 0}
.box{background:#f3f8f8;border-radius:8px;padding:12px 14px;font-size:13px}
.box b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#5b7a80;margin-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:${accent};color:#fff;text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
td{padding:9px 10px;border-bottom:1px solid #e3eeee}
td.r,th.r{text-align:right}
.totals{margin-top:14px;margin-left:auto;width:320px;font-size:13px}
.totals div{display:flex;justify-content:space-between;padding:6px 10px}
.totals .grand{background:${accent};color:#fff;font-weight:700;font-size:15px;border-radius:6px}
.status{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${inv.status === "Paid" ? "#e6f4f3" : inv.status === "VOIDED" ? "#eee" : "#fdecea"};color:${inv.status === "Paid" ? "#0e7c7b" : inv.status === "VOIDED" ? "#777" : "#c62828"}}
.foot{margin-top:36px;font-size:11px;color:#5b7a80;border-top:1px solid #e3eeee;padding-top:12px;display:flex;justify-content:space-between}
.btn{position:fixed;top:14px;right:14px;background:${accent};color:#fff;border:none;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer}
@media print{.btn{display:none}body{padding:0}}
</style></head><body>
<button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button>
<div class="wrap">
<div class="top"><div><h1>${esc(c.name)}</h1><div class="muted">${esc(c.tagline || "")}</div><div class="muted">${esc(c.address)} · ${esc(c.phone)}</div><div class="muted">NTN ${esc(c.ntn)} · STRN ${esc(c.strn)}</div></div>
<div style="text-align:right"><div style="font-size:22px;font-weight:800;color:${accent}">INVOICE</div><div style="font-size:14px;font-weight:700">${esc(inv.id)}</div><div class="muted">Date: ${esc(inv.date)}</div><div class="muted">Terms: ${esc(inv.pay_terms || "COD")}</div><div style="margin-top:6px"><span class="status">${esc(inv.status)}</span></div></div></div>
<div class="meta"><div class="box"><b>Bill To</b><div style="font-weight:700">${esc(inv.cust_name)}</div><div>${esc(cust.area || "")}${cust.city ? ", " + esc(cust.city) : ""}</div><div>${esc(cust.owner_name || "")} ${cust.mobile ? "· " + esc(cust.mobile) : ""}</div></div>
<div class="box"><b>Notes</b><div>${esc(inv.notes || "—")}</div><div class="muted" style="margin-top:6px">Prepared by ${esc((inv.created_by || "").split("@")[0])}</div></div></div>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
${items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.product_name)}</td><td class="r">${it.qty}</td><td class="r">${fmt(it.rate)}</td><td class="r">${fmt(it.total)}</td></tr>`).join("")}
${items.length ? "" : `<tr><td colspan="5" class="muted">No line items</td></tr>`}
</tbody></table>
<div class="totals"><div><span>Subtotal</span><span>${fmt(sub)}</span></div>${taxRate ? `<div><span>Sales Tax ${taxRate}%</span><span>${fmt(tax)}</span></div>` : ""}<div class="grand"><span>Total</span><span>${fmt(total)}</span></div><div><span>Paid</span><span>${fmt(paid)}</span></div><div style="font-weight:700"><span>Balance Due</span><span>${fmt(Math.max(0, total - paid))}</span></div></div>
<div class="foot"><span>Thank you for your business.</span><span>${esc(c.email)} · Generated by TradeDesk ERP</span></div>
</div></body></html>`;
}

const cache = {};
export async function invoicePost(invId) {
  await new Promise(r => setTimeout(r, 120));
  const html = buildInvoiceHtml(invId);
  if (cache[invId]) URL.revokeObjectURL(cache[invId]);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  cache[invId] = url;
  return { success: true, url, pdfUrl: url };
}

// Generic printable document for other modules (quotes, POs, receipts, reports).
export function openPrintable(title, bodyHtml) {
  const c = CONFIG.company;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1b2b30;padding:28px;max-width:860px;margin:0 auto}h1{color:#0F3B4C;font-size:20px;margin:0}h2{font-size:15px;margin:18px 0 8px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}th{background:#0F3B4C;color:#fff;text-align:left;padding:7px 9px;font-size:10px;text-transform:uppercase}td{padding:7px 9px;border-bottom:1px solid #e3eeee}.r{text-align:right}.muted{color:#5b7a80;font-size:11px}.btn{position:fixed;top:12px;right:12px;background:#0F3B4C;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}@media print{.btn{display:none}}</style></head><body><button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button><h1>${esc(c.name)}</h1><div class="muted">${esc(c.address)} · ${esc(c.phone)}</div><h2>${esc(title)}</h2>${bodyHtml}<p class="muted" style="margin-top:28px">Generated by TradeDesk ERP · ${new Date().toLocaleString()}</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener,noreferrer");
}
