// In-memory replacement for the APT /api/supabase serverless function.
// Same action names and response shapes, no network, no environment variables.
// State lives in memory for the session and resets on reload.
import { buildSeed } from "./seed.js";
import { PROFILES } from "./profiles.js";

let DB = null;
let CURRENT_USER = { email: "admin@tradedesk.demo", displayName: "Demo Admin" };
let auditSeq = 100;
const listeners = new Set();

export function initDb(profileKey) {
  DB = buildSeed(PROFILES[profileKey] || PROFILES.distribution);
  DB._profile = profileKey;
  return DB;
}
export function getDb() { if (!DB) initDb("distribution"); return DB; }
export function setCurrentUser(u) { CURRENT_USER = u; }
export function onDbChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

const clone = x => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const uuid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`);
const nowIso = () => new Date().toISOString();
const sinceDays = d => new Date(Date.now() - d * 86400000).toISOString();

function log(action, detail) {
  const db = getDb();
  db.audit_log.unshift({ id: auditSeq++, at: nowIso(), user: CURRENT_USER.email, action, detail });
  if (db.audit_log.length > 400) db.audit_log.length = 400;
}
const byId = (table, id) => getDb()[table].find(r => r.id === id);
function upsertRow(table, row, key = "id") {
  const db = getDb(); const i = db[table].findIndex(r => r[key] === row[key]);
  if (i >= 0) db[table][i] = { ...db[table][i], ...row }; else db[table].push(row);
  return i >= 0 ? "updated" : "inserted";
}
function removeRow(table, id, key = "id") { const db = getDb(); db[table] = db[table].filter(r => r[key] !== id); }

// Small artificial latency so loading states still render like the real system.
const wait = () => new Promise(r => setTimeout(r, 4 + Math.random() * 12));

export async function sbPost(action, params = {}) {
  await wait();
  const db = getDb();
  const storeMap = () => Object.fromEntries(db.stores.map(s => [s.id, { id: s.id, name: s.name, area: s.area, category: s.category }]));
  const profileMap = () => Object.fromEntries(db.profiles.map(p => [p.id, { id: p.id, full_name: p.full_name, mobile: p.mobile }]));
  const sortDesc = (rows, f) => [...rows].sort((a, b) => String(b[f] || "").localeCompare(String(a[f] || "")));
  let out;
  switch (action) {
    // ── Rider hub ──
    case "orders": { const sm = storeMap(), pm = profileMap(); out = sortDesc(db.orders, "created_at").slice(0, 500).map(o => ({ ...o, stores: sm[o.store_id] ?? null, profiles: pm[o.rider_id] ?? null })); break; }
    case "order_items": out = db.order_items.filter(i => i.order_id === params.order_id).map(({ product_id, product_name, quantity, total, trade_price }) => ({ product_id, product_name, quantity, total, trade_price })); break;
    case "stores": out = [...db.stores].sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
    case "riders": out = [...db.profiles].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")); break;
    case "locations": out = sortDesc(db.rider_locations, "updated_at"); break;
    case "products": out = [...db.products].sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || "")); break;
    case "areas": out = [...db.areas].sort((a, b) => (a.city || "").localeCompare(b.city || "")); break;
    case "store_assignments": out = db.store_assignments; break;
    case "rider_areas": out = db.rider_areas; break;
    case "report_orders": { const s = sinceDays(Number(params.days) || 30); out = db.orders.filter(o => o.created_at >= s).map(({ id, rider_id, total_value, incentive, status, created_at }) => ({ id, rider_id, total_value, incentive, status, created_at })); break; }
    case "report_items": { const s = sinceDays(Number(params.days) || 30); const ids = new Set(db.orders.filter(o => o.created_at >= s).map(o => o.id)); out = db.order_items.filter(i => ids.has(i.order_id)).map(({ product_id, product_name, quantity, total }) => ({ product_id, product_name, quantity, total })); break; }
    case "app_settings": out = db.app_settings; break;
    case "upsert_setting": upsertRow("app_settings", { key: params.key, value: params.value, updated_at: nowIso() }, "key"); log("Setting updated", `${params.key} = ${params.value}`); out = null; break;
    case "push_subscriptions_count": out = db.push_subscriptions.length; break;
    case "update_order_status": { const o = byId("orders", params.id); if (o) o.status = params.status; log("Order status", `#${o?.order_no} → ${params.status}`); out = null; break; }
    case "update_store": { const { id, ...f } = params; const s = byId("stores", id); if (s) Object.assign(s, f); out = null; break; }
    case "delete_store": removeRow("stores", params.id); log("Store deleted", params.id); out = null; break;
    case "add_store": db.stores.push({ id: uuid(), created_at: nowIso(), ...params.store }); log("Store added", params.store?.name); out = null; break;
    case "update_rider": { const { id, ...f } = params; const r = byId("profiles", id); if (r) Object.assign(r, f); log("Rider updated", r?.full_name); out = null; break; }
    case "update_product": { const { id, ...f } = params; const p = byId("products", id); if (p) Object.assign(p, f); log("Product updated", p?.name); out = null; break; }
    case "insert_product": { const p = { id: params.product?.id || `P-${String(db.products.length + 1).padStart(3, "0")}`, active: true, current_stock: 0, min_stock: 0, created_at: nowIso(), ...params.product }; db.products.push(p); log("Product added", p.name); out = null; break; }
    case "toggle_store_assignment": if (params.on) { if (!db.store_assignments.some(a => a.rider_id === params.rider_id && a.store_id === params.store_id)) db.store_assignments.push({ id: uuid(), rider_id: params.rider_id, store_id: params.store_id, created_at: nowIso() }); } else db.store_assignments = db.store_assignments.filter(a => !(a.rider_id === params.rider_id && a.store_id === params.store_id)); out = null; break;
    case "toggle_area_assignment": if (params.on) { if (!db.rider_areas.some(a => a.rider_id === params.rider_id && a.area_id === params.area_id)) db.rider_areas.push({ id: uuid(), rider_id: params.rider_id, area_id: params.area_id, created_at: nowIso() }); } else db.rider_areas = db.rider_areas.filter(a => !(a.rider_id === params.rider_id && a.area_id === params.area_id)); out = null; break;
    case "add_area": db.areas.push({ id: uuid(), created_at: nowIso(), ...params.area }); log("Area added", params.area?.name); out = null; break;
    case "returns": { const sm = storeMap(), pm = profileMap(); out = sortDesc(db.returns, "created_at").map(r => ({ ...r, stores: sm[r.store_id] ?? null, profiles: pm[r.rider_id] ?? null })); break; }
    case "return_items": out = db.return_items.filter(i => i.return_id === params.return_id); break;
    case "admin_create_return": {
      const { store_id, order_id, gas_invoice_id, reason, items } = params;
      if (!items?.length) throw new Error("Return has no items");
      const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.trade_price ?? 0), 0);
      const ret = { id: uuid(), return_no: Math.max(300, ...db.returns.map(r => r.return_no || 0)) + 1, store_id, order_id: order_id || null, gas_invoice_id: gas_invoice_id || null, reason, total, status: "Pending", gas_credit_id: null, rider_id: null, created_at: nowIso() };
      db.returns.unshift(ret);
      items.forEach(it => { db.return_items.push({ id: uuid(), return_id: ret.id, product_id: it.product_id, product_name: it.product_name, qty: Number(it.qty), trade_price: Number(it.trade_price ?? 0) }); const p = byId("products", it.product_id); if (p) p.current_stock = (p.current_stock ?? 0) + Number(it.qty); });
      log("Return created", `#${ret.return_no} · ${total}`); out = ret; break;
    }
    case "update_return": { const { id, ...f } = params; const r = byId("returns", id); if (r) Object.assign(r, f); out = null; break; }

    // ── Financial ──
    case "customers": out = [...db.customers].sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
    case "upsert_customer": { const r = upsertRow("customers", params.customer); log(r === "inserted" ? "Customer added" : "Customer updated", params.customer?.name); out = null; break; }
    case "delete_customer": removeRow("customers", params.id); log("Customer deleted", params.id); out = null; break;
    case "vendors": out = [...db.vendors].sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
    case "upsert_vendor": { const r = upsertRow("vendors", params.vendor); log(r === "inserted" ? "Vendor added" : "Vendor updated", params.vendor?.name); out = null; break; }
    case "delete_vendor": removeRow("vendors", params.id); out = null; break;
    case "invoices": { let rows = sortDesc(db.invoices, "date"); if (params.days) { const s = sinceDays(Number(params.days)).slice(0, 10); rows = rows.filter(i => i.date >= s); } if (params.status) rows = rows.filter(i => i.status === params.status); if (params.cust_id) rows = rows.filter(i => i.cust_id === params.cust_id); out = rows.slice(0, params.limit ? Number(params.limit) : 1000); break; }
    case "invoice_items": out = db.invoice_items.filter(i => i.invoice_id === params.invoice_id); break;
    case "upsert_invoice": {
      const { items, ...header } = params.invoice;
      const existing = byId("invoices", header.id);
      if (existing) Object.assign(existing, header); else db.invoices.unshift({ pdf_url: "", notes: "", ...header });
      if (items?.length) { db.invoice_items = db.invoice_items.filter(i => i.invoice_id !== header.id); items.forEach(it => db.invoice_items.push({ id: uuid(), ...it, invoice_id: header.id })); }
      log(existing ? "Invoice updated" : "Invoice created", `${header.id}${header.status ? " · " + header.status : ""}`); out = null; break;
    }
    case "delete_invoice": removeRow("invoices", params.id); db.invoice_items = db.invoice_items.filter(i => i.invoice_id !== params.id); log("Invoice deleted", params.id); out = null; break;
    case "save_pdf_url": { const i = byId("invoices", params.inv_id); if (i) i.pdf_url = params.pdf_url; out = null; break; }
    case "adjust_stock": { const p = byId("products", params.pid); if (!p) throw new Error("Product not found"); p.current_stock = (p.current_stock ?? 0) + Number(params.delta); log("Stock adjusted", `${p.name} ${Number(params.delta) >= 0 ? "+" : ""}${params.delta}`); return { success: true, stock: p.current_stock }; }
    case "purchases": { let rows = sortDesc(db.vendors_purchases, "date"); if (params.days) { const s = sinceDays(Number(params.days)).slice(0, 10); rows = rows.filter(i => i.date >= s); } if (params.vendor_id) rows = rows.filter(p => p.vendor_id === params.vendor_id); out = rows.slice(0, params.limit ? Number(params.limit) : 1000); break; }
    case "purchase_items": out = db.purchase_items.filter(i => i.purchase_id === params.purchase_id); break;
    case "upsert_purchase": { const { items, ...header } = params.purchase; const r = upsertRow("vendors_purchases", header); if (items?.length) { db.purchase_items = db.purchase_items.filter(i => i.purchase_id !== header.id); items.forEach(it => db.purchase_items.push({ id: uuid(), ...it, purchase_id: header.id })); } log(r === "inserted" ? "Purchase created" : "Purchase updated", header.id); out = null; break; }
    case "delete_purchase": removeRow("vendors_purchases", params.id); out = null; break;
    case "payments": { let rows = sortDesc(db.payments, "date"); if (params.days) { const s = sinceDays(Number(params.days)).slice(0, 10); rows = rows.filter(i => i.date >= s); } if (params.type) rows = rows.filter(p => p.type === params.type); if (params.party_id) rows = rows.filter(p => p.party_id === params.party_id); out = rows.slice(0, params.limit ? Number(params.limit) : 1000); break; }
    case "upsert_payment": { const pay = { ...params.payment }; if (pay.type === "Paid") pay.type = "Made"; upsertRow("payments", pay); log("Payment recorded", `${pay.id} · ${pay.type} · ${pay.amount}`); out = null; break; }
    case "delete_payment": removeRow("payments", params.id); out = null; break;
    case "expenses": { let rows = sortDesc(db.expenses, "date"); if (params.days) { const s = sinceDays(Number(params.days)).slice(0, 10); rows = rows.filter(i => i.date >= s); } if (params.category) rows = rows.filter(e => e.category === params.category); out = rows.slice(0, params.limit ? Number(params.limit) : 1000); break; }
    case "upsert_expense": upsertRow("expenses", { by: CURRENT_USER.email, ...params.expense }); log("Expense saved", `${params.expense?.category} · ${params.expense?.amount}`); out = null; break;
    case "delete_expense": removeRow("expenses", params.id); out = null; break;
    case "bulk_import_financial": { const counts = {}; ["customers", "vendors", "invoices", "payments", "expenses"].forEach(t => { (params[t] || []).forEach(r => upsertRow(t, r)); counts[t] = (params[t] || []).length; }); (params.purchases || []).forEach(r => upsertRow("vendors_purchases", r)); counts.purchases = (params.purchases || []).length; return { success: true, counts }; }
    case "merge_customers": {
      const snapshotGroups = [];
      for (const { keepId, mergeIds } of params.groups || []) {
        if (!keepId || !mergeIds?.length) continue;
        const mergedCustomers = db.customers.filter(c => mergeIds.includes(c.id));
        const invoiceChanges = db.invoices.filter(i => mergeIds.includes(i.cust_id)).map(i => ({ id: i.id, originalCustId: i.cust_id }));
        const paymentChanges = db.payments.filter(p => mergeIds.includes(p.party_id) && p.type === "Received").map(p => ({ id: p.id, originalPartyId: p.party_id }));
        db.invoices.forEach(i => { if (mergeIds.includes(i.cust_id)) i.cust_id = keepId; });
        db.payments.forEach(p => { if (mergeIds.includes(p.party_id) && p.type === "Received") p.party_id = keepId; });
        db.customers = db.customers.filter(c => !mergeIds.includes(c.id));
        snapshotGroups.push({ keepId, mergeIds, mergedCustomers: clone(mergedCustomers), invoiceChanges, paymentChanges });
      }
      log("Customers merged", `${snapshotGroups.length} group(s)`);
      out = { snapshot: { groups: snapshotGroups } }; break;
    }
    case "undo_merge_customers": {
      for (const g of params.groups || []) { (g.mergedCustomers || []).forEach(c => upsertRow("customers", c)); (g.invoiceChanges || []).forEach(ch => { const i = byId("invoices", ch.id); if (i) i.cust_id = ch.originalCustId; }); (g.paymentChanges || []).forEach(ch => { const p = byId("payments", ch.id); if (p) p.party_id = ch.originalPartyId; }); }
      log("Merge undone", ""); out = null; break;
    }
    case "rider_permissions": out = db.rider_payment_permissions; break;
    case "set_rider_permission": upsertRow("rider_payment_permissions", { rider_id: params.rider_id, payment_collection_enabled: params.payment_collection_enabled, updated_at: nowIso() }, "rider_id"); log("Rider permission", `${params.rider_id.slice(0, 8)} collection ${params.payment_collection_enabled ? "on" : "off"}`); out = null; break;
    case "rider_payment_collections": { const om = Object.fromEntries(db.orders.map(o => [o.id, { id: o.id, order_no: o.order_no, total_value: o.total_value, store_id: o.store_id }])); const pm = profileMap(); out = sortDesc(db.order_payment_collections, "collected_at").slice(0, 500).map(c => ({ ...c, orders: om[c.order_id] ?? null, profiles: pm[c.rider_id] ?? null })); break; }

    // ── Generic table access for the TradeDesk extension modules ──
    case "list": { const t = db[params.table]; if (!t) throw new Error(`Unknown table: ${params.table}`); out = params.order ? sortDesc(t, params.order) : t; break; }
    case "upsert": { if (!db[params.table]) throw new Error(`Unknown table: ${params.table}`); const row = { ...params.row }; if (!row[params.key || "id"]) row[params.key || "id"] = params.prefix ? `${params.prefix}-${String(db[params.table].length + 1).padStart(3, "0")}` : uuid(); const r = upsertRow(params.table, row, params.key || "id"); log(`${params.label || params.table} ${r}`, row.name || row.id); out = row; break; }
    case "remove": { if (!db[params.table]) throw new Error(`Unknown table: ${params.table}`); removeRow(params.table, params.id, params.key || "id"); log(`${params.label || params.table} deleted`, params.id); out = null; break; }
    case "audit_log": out = db.audit_log; break;
    case "log": log(params.action, params.detail); out = null; break;
    default: throw new Error(`Unknown action: ${action}`);
  }
  if (!["orders", "order_items", "stores", "riders", "locations", "products", "areas", "store_assignments", "rider_areas", "report_orders", "report_items", "app_settings", "push_subscriptions_count", "returns", "return_items", "customers", "vendors", "invoices", "invoice_items", "purchases", "purchase_items", "payments", "expenses", "rider_permissions", "rider_payment_collections", "list", "audit_log"].includes(action)) emit();
  return clone(out === null ? [] : out);
}
