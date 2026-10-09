// Point of Sale / Retail edition: POS terminal, sales register, shifts, branches, loyalty, barcodes.
import { useState, useMemo, useEffect } from "react";
import { G, Inp, Sel, Btn, Kpi, Modal, TblWrap, todayStr, validNum } from "../apt/AptCrm.jsx";
import { Card, Stat, Grid, Toolbar, Search, Pill, SPill, useTable, Bars, lastMonths, monthKey } from "./shared.jsx";
import { sbPost } from "../data/mockApi.js";
import { CONFIG, fmt } from "../lib/config.js";
import { openPrintable } from "../lib/invoiceDoc.js";
import { celebrate } from "../ui/motion.jsx";
import { Monitor, ShoppingBag, Clock, Building2 } from "lucide-react";

const receiptHtml = (sale, items, branch) => `<div style="max-width:320px;margin:0 auto;font-family:monospace;font-size:12px"><div style="text-align:center"><b>${CONFIG.company.name}</b><br/>${branch?.name || ""}<br/>${CONFIG.company.phone}<br/>STRN ${CONFIG.company.strn}</div><hr/>Receipt: ${sale.id}<br/>Date: ${new Date(sale.date).toLocaleString()}<br/>Cashier: ${sale.cashier}<hr/>${items.map(i => `<div style="display:flex;justify-content:space-between"><span>${i.product_name.slice(0, 22)} x${i.qty}</span><span>${i.total.toLocaleString()}</span></div>`).join("")}<hr/><div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${sale.subtotal.toLocaleString()}</span></div>${sale.discount ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${sale.discount.toLocaleString()}</span></div>` : ""}<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px"><span>TOTAL ${CONFIG.currency}</span><span>${sale.total.toLocaleString()}</span></div><div style="display:flex;justify-content:space-between"><span>Paid by</span><span>${sale.method}</span></div><hr/><div style="text-align:center">Thank you for shopping with us!<br/>Prices include ${CONFIG.taxRate}% sales tax</div></div>`;

const PosPage = ({ ctx }) => {
  const [branches] = useTable("branches", [ctx.dataVersion]);
  const [branch, setBranch] = useState("BR-1"); const [cat, setCat] = useState("All"); const [q, setQ] = useState(""); const [cart, setCart] = useState([]); const [disc, setDisc] = useState(0); const [method, setMethod] = useState("Cash"); const [cust, setCust] = useState(""); const [receipt, setReceipt] = useState(null); const [busy, setBusy] = useState(false); const [tendered, setTendered] = useState("");
  const products = ctx.products.filter(p => p.currentStock > 0 || true);
  const cats = ["All", ...new Set(ctx.products.map(p => p.category))];
  const list = products.filter(p => (cat === "All" || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const price = p => Math.round(p.tradePrice * 1.18);
  const add = p => setCart(c => { const i = c.findIndex(x => x.id === p.id); if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; } return [...c, { id: p.id, name: p.name, price: price(p), qty: 1 }]; });
  const setQty = (id, d) => setCart(c => c.map(x => x.id === id ? { ...x, qty: Math.max(0, x.qty + d) } : x).filter(x => x.qty > 0));
  const sub = cart.reduce((s, x) => s + x.price * x.qty, 0); const total = Math.max(0, sub - (+disc || 0)); const change = method === "Cash" && tendered ? +tendered - total : 0;
  useEffect(() => { const h = e => { if (e.key === "F9" && cart.length) charge(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }); // eslint-disable-line
  const charge = async () => {
    if (!cart.length) return; setBusy(true);
    try {
      const id = `R-${Math.floor(20000 + Math.random() * 79999)}`; const date = new Date().toISOString();
      const items = cart.map(x => ({ sale_id: id, product_id: x.id, product_name: x.name, qty: x.qty, price: x.price, total: x.price * x.qty }));
      const sale = { id, branch_id: branch, date, cashier: ctx.user.displayName, customer_id: cust || null, subtotal: sub, discount: +disc || 0, tax: 0, total, method, status: "Completed", items_count: cart.length };
      await sbPost("upsert", { table: "pos_sales", label: "POS sale", row: sale });
      for (const it of items) { await sbPost("upsert", { table: "pos_sale_items", label: "POS item", row: { ...it, id: `${id}-${it.product_id}` } }); await sbPost("adjust_stock", { pid: it.product_id, delta: -it.qty }); }
      // Post to the finance core as a paid invoice so P&L, ledger and tax see it.
      const c = ctx.customers.find(x => x.id === cust);
      await sbPost("upsert_invoice", { invoice: { id, date: date.slice(0, 10), cust_id: cust || "WALKIN", cust_name: c ? c.name : "Walk-in Customer", total, status: "Paid", pay_terms: method, created_by: ctx.user.email, notes: `POS ${branches.find(b => b.id === branch)?.name || ""}`, items: items.map(i => ({ product_id: i.product_id, product_name: i.product_name, qty: i.qty, rate: i.price, total: i.total, notes: "" })) } });
      await sbPost("upsert_payment", { payment: { id: `PAY-${id}`, date: date.slice(0, 10), type: "Received", party_id: cust || "WALKIN", ref_id: id, amount: total, notes: `POS ${method}`, method } });
      if (cust) { const l = (await sbPost("list", { table: "loyalty" })).find(x => x.customer_id === cust); if (l) await sbPost("upsert", { table: "loyalty", key: "customer_id", label: "Loyalty", row: { ...l, points: l.points + Math.floor(total / 100), visits: l.visits + 1, last_visit: date.slice(0, 10) } }); }
      setReceipt({ sale, items }); celebrate(); setCart([]); setDisc(0); setTendered(""); ctx.notify(`✅ Sale ${id} · ${fmt(total)}`); await ctx.loadData(true); ctx.bump();
    } catch (e) { ctx.notify("❌ " + e.message, "err"); } finally { setBusy(false); }
  };
  const br = branches.find(b => b.id === branch);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, minHeight: "calc(100vh - 110px)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Toolbar><Search value={q} onChange={setQ} placeholder="Scan barcode or search product…" /><Sel value={branch} onChange={e => setBranch(e.target.value)} style={{ width: 170 }}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel></Toolbar>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{cats.map(c => <button key={c} onClick={() => setCat(c)} style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${cat === c ? G.dark : G.border}`, background: cat === c ? G.dark : G.card, color: cat === c ? G.white : G.ink, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{c}</button>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8, overflowY: "auto", flex: 1, alignContent: "start" }}>
          {list.map(p => <button key={p.id} onClick={() => add(p)} disabled={p.currentStock <= 0} style={{ background: G.card, border: `1.5px solid ${G.border}`, borderRadius: 10, padding: "10px 10px", textAlign: "left", cursor: p.currentStock > 0 ? "pointer" : "not-allowed", opacity: p.currentStock > 0 ? 1 : 0.5, boxShadow: "0 1px 6px rgba(15,59,76,0.06)" }}><div style={{ fontSize: 9, color: G.muted, fontWeight: 700, textTransform: "uppercase" }}>{p.category}</div><div style={{ fontSize: 12, fontWeight: 700, color: G.ink, lineHeight: 1.25, minHeight: 30 }}>{p.name}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}><b style={{ color: G.dark, fontSize: 13 }}>{fmt(price(p))}</b><span style={{ fontSize: 9, color: p.currentStock <= 5 ? G.red : G.muted }}>{p.currentStock} left</span></div></button>)}
        </div>
      </div>
      <div style={{ background: G.card, borderRadius: 12, boxShadow: "0 2px 12px rgba(15,59,76,0.08)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: G.dark, color: G.white, padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 700, fontSize: 13 }}>🛒 Cart · {br?.name}</span><span style={{ fontSize: 10, opacity: 0.7 }}>Till 1 · {ctx.user.displayName}</span></div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {cart.length === 0 && <div style={{ padding: 30, textAlign: "center", color: G.muted, fontSize: 12 }}>Tap products to add them to the cart</div>}
          {cart.map(x => <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${G.pale}` }}><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{x.name}</div><div style={{ fontSize: 10, color: G.muted }}>{fmt(x.price)} each</div></div><button onClick={() => setQty(x.id, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${G.border}`, background: G.bg, cursor: "pointer", fontWeight: 800 }}>−</button><b style={{ width: 22, textAlign: "center", fontSize: 13 }}>{x.qty}</b><button onClick={() => setQty(x.id, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${G.border}`, background: G.bg, cursor: "pointer", fontWeight: 800 }}>+</button><b style={{ width: 80, textAlign: "right", fontSize: 12 }}>{fmt(x.price * x.qty)}</b></div>)}
        </div>
        <div style={{ padding: 14, borderTop: `2px solid ${G.pale}`, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Sel label="Customer (optional)" value={cust} onChange={e => setCust(e.target.value)}><option value="">Walk-in</option>{ctx.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Sel><Inp label="Discount" type="number" value={disc} onChange={e => setDisc(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 6 }}>{["Cash", "Card", "JazzCash", "EasyPaisa"].map(m => <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1.5px solid ${method === m ? G.dark : G.border}`, background: method === m ? G.dark : G.bg, color: method === m ? G.white : G.ink, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{m}</button>)}</div>
          {method === "Cash" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}><Inp label="Cash Tendered" type="number" value={tendered} onChange={e => setTendered(e.target.value)} placeholder={String(total)} /><div style={{ fontSize: 12, fontWeight: 700, color: change < 0 ? G.red : G.mid, paddingBottom: 9 }}>Change: {fmt(Math.max(0, change))}</div></div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: G.muted }}><span>Subtotal</span><span>{fmt(sub)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: G.dark }}><span>TOTAL</span><span>{fmt(total)}</span></div>
          <div style={{ display: "flex", gap: 8 }}><Btn v="ghost" onClick={() => setCart([])} disabled={!cart.length}>Clear</Btn><Btn v="success" full disabled={!cart.length || busy} onClick={charge}>{busy ? "⏳ Processing…" : `💳 Charge ${fmt(total)} (F9)`}</Btn></div>
        </div>
      </div>
      {receipt && <Modal title={`🧾 Receipt ${receipt.sale.id}`} onClose={() => setReceipt(null)}><div dangerouslySetInnerHTML={{ __html: receiptHtml(receipt.sale, receipt.items, br) }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><Btn v="secondary" onClick={() => openPrintable(`Receipt ${receipt.sale.id}`, receiptHtml(receipt.sale, receipt.items, br))}>🖨 Print</Btn><Btn onClick={() => setReceipt(null)}>New Sale</Btn></div></Modal>}
    </div>
  );
};

const SalesRegisterPage = ({ ctx }) => {
  const [sales, reload] = useTable("pos_sales", [ctx.dataVersion]); const [items] = useTable("pos_sale_items", [ctx.dataVersion]); const [branches] = useTable("branches", [ctx.dataVersion]);
  const [br, setBr] = useState("All"); const [day, setDay] = useState(""); const [view, setView] = useState(null);
  const fil = [...sales].sort((a, b) => b.date.localeCompare(a.date)).filter(s => (br === "All" || s.branch_id === br) && (!day || s.date.slice(0, 10) === day));
  const today = todayStr(); const todaySales = sales.filter(s => s.date.slice(0, 10) === today && s.status === "Completed");
  const refund = async s => { if (!confirm(`Refund ${s.id} (${fmt(s.total)})?`)) return; await sbPost("upsert", { table: "pos_sales", label: "POS sale", row: { ...s, status: "Refunded" } }); for (const it of items.filter(i => i.sale_id === s.id)) await sbPost("adjust_stock", { pid: it.product_id, delta: it.qty }); ctx.notify(`↩ ${s.id} refunded, stock restored`); reload(); ctx.loadData(true); };
  const byMethod = {}; fil.forEach(s => { byMethod[s.method] = (byMethod[s.method] || 0) + s.total; });
  return (
    <div>
      <Toolbar><Sel value={br} onChange={e => setBr(e.target.value)} style={{ width: 170 }}><option>All</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel><Inp type="date" value={day} onChange={e => setDay(e.target.value)} style={{ width: 160 }} /><Btn sm v="ghost" onClick={() => setDay(today)}>Today</Btn><Btn sm v="ghost" onClick={() => setDay("")}>All days</Btn><div style={{ flex: 1 }} /><Btn sm v="secondary" onClick={() => ctx.exportCsv("pos_sales.csv", fil, [["id", "Receipt"], ["date", "Date"], ["branch_id", "Branch"], ["cashier", "Cashier"], ["items_count", "Items"], ["total", "Total"], ["method", "Method"], ["status", "Status"]])}>⬇ Export</Btn></Toolbar>
      <Grid cols={4}><Stat l="Today's Sales" v={fmt(todaySales.reduce((s, x) => s + x.total, 0))} c={G.mid} sub={`${todaySales.length} receipts`} /><Stat l="Avg Basket (filtered)" v={fmt(fil.length ? fil.reduce((s, x) => s + x.total, 0) / fil.length : 0)} c={G.blue} /><Stat l="Cash vs Digital" v={`${Math.round((byMethod.Cash || 0) / Math.max(1, fil.reduce((s, x) => s + x.total, 0)) * 100)}% cash`} c={G.amber} /><Stat l="Refunds" v={fil.filter(s => s.status === "Refunded").length} c={G.red} /></Grid>
      <Card title={`Sales Register (${fil.length})`}><TblWrap compact heads={["Receipt", "Date / Time", "Branch", "Cashier", "Items", "Total", "Method", "Status", "Actions"]} rows={fil.slice(0, 200).map(s => [<b style={{ fontSize: 11, color: G.dark }}>{s.id}</b>, <span style={{ fontSize: 10, color: G.muted }}>{new Date(s.date).toLocaleString()}</span>, <span style={{ fontSize: 10 }}>{branches.find(b => b.id === s.branch_id)?.name}</span>, <span style={{ fontSize: 10 }}>{s.cashier}</span>, <span style={{ fontSize: 11 }}>{s.items_count}</span>, <b style={{ fontSize: 11 }}>{fmt(s.total)}</b>, <Pill text={s.method} />, <SPill s={s.status} />, <div style={{ display: "flex", gap: 4 }}><Btn sm v="ghost" onClick={() => setView(s)}>View</Btn>{s.status === "Completed" && <Btn sm v="danger" onClick={() => refund(s)}>Refund</Btn>}</div>])} /></Card>
      {view && <Modal title={`🧾 ${view.id}`} onClose={() => setView(null)}><div dangerouslySetInnerHTML={{ __html: receiptHtml(view, items.filter(i => i.sale_id === view.id), branches.find(b => b.id === view.branch_id)) }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><Btn v="secondary" onClick={() => openPrintable(`Receipt ${view.id}`, receiptHtml(view, items.filter(i => i.sale_id === view.id), branches.find(b => b.id === view.branch_id)))}>🖨 Reprint</Btn><Btn onClick={() => setView(null)}>Close</Btn></div></Modal>}
    </div>
  );
};

const ShiftsPage = ({ ctx }) => {
  const [shifts, reload] = useTable("shifts", [ctx.dataVersion]); const [branches] = useTable("branches", [ctx.dataVersion]); const [sales] = useTable("pos_sales", [ctx.dataVersion]);
  const [closing, setClosing] = useState(null); const [counted, setCounted] = useState(""); const [opening, setOpening] = useState(false); const [of, setOf] = useState({ branch_id: "BR-1", cashier: "", opening_float: 20000 });
  const openShift = async () => { if (!of.cashier) return ctx.notify("Enter cashier name", "err"); await sbPost("upsert", { table: "shifts", prefix: "SH", label: "Shift", row: { ...of, date: todayStr(), opened_at: new Date().toTimeString().slice(0, 5), closed_at: "", cash_sales: 0, expected_cash: +of.opening_float, counted_cash: 0, status: "Open", sales_count: 0 } }); ctx.notify("✅ Shift opened"); setOpening(false); reload(); };
  const closeShift = async () => { const s = closing; const cash = sales.filter(x => x.branch_id === s.branch_id && x.date.slice(0, 10) === s.date && x.method === "Cash" && x.status === "Completed").reduce((a, x) => a + x.total, 0); const exp = s.opening_float + cash; await sbPost("upsert", { table: "shifts", label: "Shift", row: { ...s, status: "Closed", closed_at: new Date().toTimeString().slice(0, 5), cash_sales: cash, expected_cash: exp, counted_cash: +counted || 0, sales_count: sales.filter(x => x.branch_id === s.branch_id && x.date.slice(0, 10) === s.date).length } }); ctx.notify(`✅ Shift closed · variance ${fmt((+counted || 0) - exp)}`); setClosing(null); setCounted(""); reload(); };
  const open = shifts.filter(s => s.status === "Open");
  return (
    <div>
      <Toolbar><div style={{ flex: 1 }} /><Btn sm onClick={() => setOpening(true)}>+ Open Shift</Btn></Toolbar>
      <Grid cols={4}><Stat l="Open Shifts" v={open.length} c={G.blue} /><Stat l="Cash Variance (closed, 7d)" v={fmt(shifts.filter(s => s.status === "Closed").reduce((a, s) => a + (s.counted_cash - s.expected_cash), 0))} c={G.red} /><Stat l="Cash Sales (closed)" v={fmt(shifts.reduce((a, s) => a + s.cash_sales, 0))} c={G.mid} /><Stat l="Shifts Logged" v={shifts.length} /></Grid>
      <Card title="Shift Log"><TblWrap compact heads={["Shift", "Date", "Branch", "Cashier", "Opened", "Closed", "Float", "Cash Sales", "Expected", "Counted", "Variance", "Status", "Action"]} rows={shifts.map(s => { const v = s.status === "Closed" ? s.counted_cash - s.expected_cash : null; return [<b style={{ fontSize: 11 }}>{s.id}</b>, <span style={{ fontSize: 10, color: G.muted }}>{s.date}</span>, <span style={{ fontSize: 10 }}>{branches.find(b => b.id === s.branch_id)?.name}</span>, <span style={{ fontSize: 11 }}>{s.cashier}</span>, <span style={{ fontSize: 10 }}>{s.opened_at}</span>, <span style={{ fontSize: 10 }}>{s.closed_at || "—"}</span>, <span style={{ fontSize: 10 }}>{fmt(s.opening_float)}</span>, <span style={{ fontSize: 11 }}>{fmt(s.cash_sales)}</span>, <span style={{ fontSize: 11 }}>{fmt(s.expected_cash)}</span>, <span style={{ fontSize: 11 }}>{s.status === "Closed" ? fmt(s.counted_cash) : "—"}</span>, v === null ? <span>—</span> : <b style={{ fontSize: 11, color: v === 0 ? G.mid : G.red }}>{v > 0 ? "+" : ""}{fmt(v)}</b>, <SPill s={s.status} />, s.status === "Open" ? <Btn sm v="danger" onClick={() => setClosing(s)}>Close Shift</Btn> : <span />]; })} /></Card>
      {closing && <Modal title={`🔒 Close Shift ${closing.id}`} onClose={() => setClosing(null)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}><div style={{ background: G.pale, borderRadius: 8, padding: 12, fontSize: 12 }}>Opening float {fmt(closing.opening_float)} + cash sales today {fmt(sales.filter(x => x.branch_id === closing.branch_id && x.date.slice(0, 10) === closing.date && x.method === "Cash").reduce((a, x) => a + x.total, 0))} = expected <b>{fmt(closing.opening_float + sales.filter(x => x.branch_id === closing.branch_id && x.date.slice(0, 10) === closing.date && x.method === "Cash").reduce((a, x) => a + x.total, 0))}</b></div><Inp label="Counted cash in drawer" type="number" value={counted} onChange={e => setCounted(e.target.value)} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setClosing(null)}>Cancel</Btn><Btn onClick={closeShift}>Close & Post</Btn></div></div></Modal>}
      {opening && <Modal title="🔓 Open Shift" onClose={() => setOpening(false)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Sel label="Branch" value={of.branch_id} onChange={e => setOf(p => ({ ...p, branch_id: e.target.value }))}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel><Inp label="Cashier" value={of.cashier} onChange={e => setOf(p => ({ ...p, cashier: e.target.value }))} /><Inp label="Opening Float" type="number" value={of.opening_float} onChange={e => setOf(p => ({ ...p, opening_float: e.target.value }))} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setOpening(false)}>Cancel</Btn><Btn onClick={openShift}>Open</Btn></div></div></Modal>}
    </div>
  );
};

const BranchesPage = ({ ctx }) => {
  const [branches] = useTable("branches", [ctx.dataVersion]); const [sales] = useTable("pos_sales", [ctx.dataVersion]); const [items] = useTable("pos_sale_items", [ctx.dataVersion]);
  const today = todayStr(); const months = lastMonths(6);
  const series = branches.map((b, i) => ({ label: b.name, color: [G.mid, G.blue, G.amber][i % 3], values: months.map(k => ({ k, v: sales.filter(s => s.branch_id === b.id && monthKey(s.date) === k && s.status === "Completed").reduce((a, s) => a + s.total, 0) })) }));
  const top = b => { const m = {}; items.filter(i => sales.find(s => s.id === i.sale_id && s.branch_id === b.id)).forEach(i => { m[i.product_name] = (m[i.product_name] || 0) + i.qty; }); return Object.entries(m).sort((a, c) => c[1] - a[1]).slice(0, 3); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>{branches.map((b, i) => { const bs = sales.filter(s => s.branch_id === b.id && s.status === "Completed"); const t = bs.filter(s => s.date.slice(0, 10) === today); return <div key={b.id} style={{ background: G.card, borderRadius: 12, padding: 16, boxShadow: "0 2px 10px rgba(15,59,76,0.07)", borderTop: `4px solid ${[G.mid, G.blue, G.amber][i % 3]}` }}><div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: 800, fontSize: 14 }}>{b.name}</div><Pill text={`${b.tills} tills`} /></div><div style={{ fontSize: 10, color: G.muted, margin: "2px 0 10px" }}>{b.city} · Manager {b.manager}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{[["Today", fmt(t.reduce((a, s) => a + s.total, 0))], ["Receipts", t.length], ["30-day", fmt(bs.reduce((a, s) => a + s.total, 0))]].map(([l, v]) => <div key={l} style={{ background: G.pale, borderRadius: 6, padding: "6px 5px", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 8, color: G.muted }}>{l}</div></div>)}</div><div style={{ marginTop: 10, fontSize: 10, color: G.muted }}>Top sellers: {top(b).map(([n, q]) => `${n} (${q})`).join(" · ") || "—"}</div></div>; })}</div>
      <Card title="Monthly Sales by Branch"><div style={{ padding: 16 }}><Bars series={series} /></div></Card>
      <Card title="Stock Allocation by Branch (demo split 50 / 30 / 20)" color={G.blue}><TblWrap compact heads={["Product", "Total Stock", ...branches.map(b => b.name), "Min"]} rows={ctx.inventory.slice(0, 40).map(p => [<span style={{ fontSize: 11, fontWeight: 600 }}>{p.pname}</span>, <b style={{ fontSize: 11 }}>{p.stock}</b>, ...[0.5, 0.3, 0.2].slice(0, branches.length).map((f, i) => <span key={i} style={{ fontSize: 11, color: Math.round(p.stock * f) <= Math.ceil(p.minStock * f) ? G.red : G.ink }}>{Math.round(p.stock * f)}</span>), <span style={{ fontSize: 10, color: G.muted }}>{p.minStock}</span>])} /></Card>
    </div>
  );
};

const LoyaltyPage = ({ ctx }) => {
  const [rows, reload] = useTable("loyalty", [ctx.dataVersion]); const [adding, setAdding] = useState(false); const [cust, setCust] = useState("");
  const tierC = { Gold: [G.gold, "#FFF8E1"], Silver: [G.muted, "#EEF2F3"], Bronze: [G.amber, "#FFF4E5"] };
  const enrol = async () => { if (!cust) return; await sbPost("upsert", { table: "loyalty", key: "customer_id", label: "Loyalty member", row: { customer_id: cust, card_no: `MM-${String(1000 + rows.length).padStart(5, "0")}`, points: 100, tier: "Bronze", visits: 0, last_visit: todayStr() } }); ctx.notify("✅ Member enrolled with 100 welcome points"); setAdding(false); reload(); };
  const redeem = async r => { if (r.points < 500) return ctx.notify("Minimum 500 points to redeem", "err"); await sbPost("upsert", { table: "loyalty", key: "customer_id", label: "Loyalty", row: { ...r, points: r.points - 500 } }); ctx.notify(`🎁 500 points redeemed → ${fmt(500)} voucher`); reload(); };
  return (
    <div>
      <Toolbar><div style={{ flex: 1 }} /><Btn sm onClick={() => setAdding(true)}>+ Enrol Member</Btn></Toolbar>
      <Grid cols={4}><Stat l="Members" v={rows.length} c={G.mid} /><Stat l="Gold Members" v={rows.filter(r => r.tier === "Gold").length} c={G.gold} /><Stat l="Points Outstanding" v={rows.reduce((s, r) => s + r.points, 0).toLocaleString()} c={G.blue} sub={`≈ ${fmt(rows.reduce((s, r) => s + r.points, 0))} liability`} /><Stat l="Avg Visits" v={(rows.reduce((s, r) => s + r.visits, 0) / Math.max(1, rows.length)).toFixed(1)} /></Grid>
      <Card title="Loyalty Members (1 point per PKR 100 spent)"><TblWrap compact heads={["Card", "Customer", "Tier", "Points", "Visits", "Last Visit", "Action"]} rows={rows.map(r => [<b style={{ fontSize: 11 }}>{r.card_no}</b>, <span style={{ fontSize: 11, fontWeight: 600 }}>{ctx.custMap[r.customer_id]?.name || r.customer_id}</span>, <Pill text={r.tier} color={tierC[r.tier]?.[0]} bg={tierC[r.tier]?.[1]} />, <b style={{ fontSize: 12, color: G.dark }}>{r.points.toLocaleString()}</b>, <span style={{ fontSize: 11 }}>{r.visits}</span>, <span style={{ fontSize: 10, color: G.muted }}>{r.last_visit}</span>, <Btn sm v="secondary" onClick={() => redeem(r)}>Redeem 500</Btn>])} /></Card>
      {adding && <Modal title="🎁 Enrol Loyalty Member" onClose={() => setAdding(false)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Sel label="Customer" value={cust} onChange={e => setCust(e.target.value)}><option value="">— Select —</option>{ctx.customers.filter(c => !rows.some(r => r.customer_id === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Sel><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setAdding(false)}>Cancel</Btn><Btn onClick={enrol}>Enrol</Btn></div></div></Modal>}
    </div>
  );
};

const BarcodesPage = ({ ctx }) => {
  const [rows] = useTable("products", [ctx.dataVersion]); const [q, setQ] = useState("");
  const fil = rows.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.barcode.includes(q));
  const labels = () => openPrintable("Shelf Labels", `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${fil.map(p => `<div style="border:1px dashed #999;padding:8px;text-align:center;font-size:11px"><b>${p.name}</b><div style="font-family:monospace;letter-spacing:3px;font-size:20px;margin:4px 0">▌║▍║▌║▍</div><div style="font-family:monospace">${p.barcode}</div><div style="font-size:16px;font-weight:bold">PKR ${p.retail_price.toLocaleString()}</div></div>`).join("")}</div>`);
  return (
    <div>
      <Toolbar><Search value={q} onChange={setQ} placeholder="Search product or scan barcode…" /><Btn sm onClick={labels}>🖨 Print Shelf Labels</Btn><Btn sm v="secondary" onClick={() => ctx.exportCsv("barcodes.csv", fil, [["barcode", "Barcode"], ["name", "Product"], ["category", "Category"], ["retail_price", "Retail"], ["current_stock", "Stock"]])}>⬇ Export</Btn></Toolbar>
      <Card title="Product Barcodes & Shelf Prices"><TblWrap compact heads={["Barcode", "Product", "Category", "Cost", "Retail", "Margin", "Stock"]} rows={fil.map(p => [<span style={{ fontFamily: "monospace", fontSize: 11 }}>{p.barcode}</span>, <span style={{ fontSize: 11, fontWeight: 600 }}>{p.name}</span>, <Pill text={p.category} />, <span style={{ fontSize: 11 }}>{fmt(p.cost_price)}</span>, <b style={{ fontSize: 11 }}>{fmt(p.retail_price)}</b>, <span style={{ fontSize: 10, color: G.mid, fontWeight: 700 }}>{((p.retail_price - p.cost_price) / p.retail_price * 100).toFixed(0)}%</span>, <b style={{ fontSize: 11, color: p.current_stock <= p.min_stock ? G.red : G.ink }}>{p.current_stock}</b>])} /></Card>
    </div>
  );
};

const DashboardExtra = ({ ctx }) => {
  const [sales] = useTable("pos_sales", [ctx.dataVersion]); const [shifts] = useTable("shifts", [ctx.dataVersion]); const [items] = useTable("pos_sale_items", [ctx.dataVersion]);
  const today = todayStr(); const t = sales.filter(s => s.date.slice(0, 10) === today && s.status === "Completed");
  const m = {}; items.filter(i => t.some(s => s.id === i.sale_id)).forEach(i => { m[i.product_name] = (m[i.product_name] || 0) + i.qty; }); const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}><Kpi label="POS Sales Today" value={fmt(t.reduce((s, x) => s + x.total, 0))} sub={`${t.length} receipts`} color={G.mid} icon={Monitor} /><Kpi label="Avg Basket Today" value={fmt(t.length ? t.reduce((s, x) => s + x.total, 0) / t.length : 0)} color={G.blue} icon={ShoppingBag} /><Kpi label="Open Shifts" value={shifts.filter(s => s.status === "Open").length} sub="across 3 branches" color={G.amber} icon={Clock} /><Kpi label="Top Seller Today" value={top ? top[0].slice(0, 18) : "—"} sub={top ? `${top[1]} sold` : ""} color={G.purple} icon={Building2} /></div>;
};

export const RETAIL = {
  navGroups: [{ group: "Point of Sale", items: [{ id: "pos", label: "POS Terminal" }, { id: "pos-sales", label: "Sales Register" }, { id: "shifts", label: "Shifts & Cash Drawer" }, { id: "branches", label: "Branches" }, { id: "loyalty", label: "Loyalty" }, { id: "barcodes", label: "Barcodes & Labels" }] }],
  pages: { pos: PosPage, "pos-sales": SalesRegisterPage, shifts: ShiftsPage, branches: BranchesPage, loyalty: LoyaltyPage, barcodes: BarcodesPage },
  DashboardExtra,
};
