// Importer edition: shipments, landed cost, letters of credit, currencies, overseas suppliers.
import { useState, useMemo } from "react";
import { G, Badge, Inp, Sel, Btn, Kpi, Modal, TblWrap, todayStr, validNum } from "../apt/AptCrm.jsx";
import { Card, Stat, Grid, Toolbar, Search, Pill, SPill, useTable } from "./shared.jsx";
import { sbPost } from "../data/mockApi.js";
import { CONFIG, fmt, fmtCur } from "../lib/config.js";
import { openPrintable } from "../lib/invoiceDoc.js";
import { Ship, Container, Coins, Globe } from "lucide-react";

const STAGES = ["Quotation", "PI Confirmed", "Production", "Shipped", "At Port", "Customs", "Cleared", "In Warehouse"];
const STAGE_C = { Quotation: [G.muted, "#EEF2F3"], "PI Confirmed": [G.blue, G.sky], Production: [G.purple, "#F3E5F5"], Shipped: [G.blue, G.sky], "At Port": [G.amber, "#FFF4E5"], Customs: [G.amber, "#FFF4E5"], Cleared: [G.mid, G.pale], "In Warehouse": [G.mid, G.pale] };
const StagePill = ({ s }) => { const [c, b] = STAGE_C[s] || [G.dark, G.pale]; return <Pill text={s} color={c} bg={b} />; };

export const landed = s => {
  const fx = Number(s.fx_rate || 1);
  const cif = (Number(s.fob_value) + Number(s.freight_fc || 0) + Number(s.insurance_fc || 0)) * fx;
  const duty = Number(s.duty_pkr || 0), st = Number(s.sales_tax_pkr || 0), it = Number(s.income_tax_pkr || 0), local = Number(s.clearing_pkr || 0) + Number(s.port_charges_pkr || 0) + Number(s.transport_pkr || 0);
  const total = cif + duty + st + it + local;
  return { cif, duty, st, it, local, total, perUnit: s.total_qty ? total / s.total_qty : 0, fcTotal: Number(s.fob_value) + Number(s.freight_fc || 0) + Number(s.insurance_fc || 0) };
};

const ShipmentsPage = ({ ctx }) => {
  const [rows, reload] = useTable("shipments", [ctx.dataVersion]);
  const [q, setQ] = useState(""); const [stage, setStage] = useState("All"); const [view, setView] = useState(null); const [add, setAdd] = useState(false);
  const [f, setF] = useState({ vendor_id: "", origin_port: "Shanghai", size: "40ft", incoterm: "FOB", currency: "USD", fx_rate: 278.5, fob_value: "", freight_fc: "", eta: todayStr(), notes: "" });
  const fil = rows.filter(r => (stage === "All" || r.stage === stage) && (!q || `${r.id} ${r.ref} ${r.vendor_name} ${r.container} ${r.bl_no}`.toLowerCase().includes(q.toLowerCase())));
  const inTransit = rows.filter(r => ["Shipped", "At Port", "Customs"].includes(r.stage));
  const advance = async r => { const i = STAGES.indexOf(r.stage); if (i < 0 || i >= STAGES.length - 1) return; const next = STAGES[i + 1]; const upd = { ...r, stage: next }; if (next === "Cleared" && !r.gd_no) upd.gd_no = `KPPI-HC-${Math.floor(10000 + Math.random() * 89999)}`; await sbPost("upsert", { table: "shipments", label: "Shipment", row: upd }); ctx.notify(`✅ ${r.id} → ${next}`); if (next === "In Warehouse") { for (const it of r.items || []) await sbPost("adjust_stock", { pid: it.product_id, delta: it.qty }); ctx.notify(`📦 ${r.items?.length || 0} SKUs received into stock`); await ctx.loadData(true); } reload(); if (view?.id === r.id) setView(upd); };
  const save = async () => {
    if (!f.vendor_id || !validNum(f.fob_value) || +f.fob_value <= 0) return ctx.notify("Select supplier and enter FOB value", "err");
    const v = ctx.vendors.find(x => x.id === f.vendor_id); const fob = +f.fob_value, fx = +f.fx_rate; const fobPkr = fob * fx;
    await sbPost("upsert", { table: "shipments", prefix: "SHP", label: "Shipment", row: { ...f, ref: `CGI/${new Date().getFullYear()}/${String(rows.length + 21).padStart(3, "0")}`, vendor_name: v?.name, dest_port: "Karachi (KICT)", container: "TBA", fob_value: fob, freight_fc: +f.freight_fc || 0, insurance_fc: Math.round(fob * 0.01), duty_pkr: Math.round(fobPkr * 0.2), sales_tax_pkr: Math.round(fobPkr * 1.2 * 0.18), income_tax_pkr: Math.round(fobPkr * 0.055), clearing_pkr: 90000, port_charges_pkr: 60000, transport_pkr: 45000, stage: "Quotation", etd: "", bl_no: "", gd_no: "", items: [], total_qty: 0, lc_id: null, created_at: new Date().toISOString() } });
    ctx.notify("✅ Shipment created"); setAdd(false); reload();
  };
  const print = r => { const l = landed(r); openPrintable(`Shipment ${r.id} — ${r.ref}`, `<p><b>Supplier:</b> ${r.vendor_name} · <b>Route:</b> ${r.origin_port} → ${r.dest_port} · <b>Container:</b> ${r.container} (${r.size}) · <b>B/L:</b> ${r.bl_no} · <b>Stage:</b> ${r.stage}</p><table><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit (${r.currency})</th></tr>${(r.items || []).map(i => `<tr><td>${i.product_name}</td><td class="r">${i.qty}</td><td class="r">${i.unit_price_fc}</td></tr>`).join("")}</table><h2>Landed Cost</h2><table>${[["CIF value (PKR)", l.cif], ["Customs duty", l.duty], ["Sales tax", l.st], ["Income tax (advance)", l.it], ["Clearing, port & transport", l.local], ["TOTAL LANDED", l.total], ["Per unit", l.perUnit]].map(([k, v]) => `<tr><td>${k}</td><td class="r">${fmt(v)}</td></tr>`).join("")}</table>`); };
  return (
    <div>
      <Toolbar><Search value={q} onChange={setQ} placeholder="Search ref, supplier, container, B/L…" /><Sel value={stage} onChange={e => setStage(e.target.value)} style={{ width: 170 }}><option>All</option>{STAGES.map(s => <option key={s}>{s}</option>)}</Sel><Btn sm onClick={() => setAdd(true)}>+ New Shipment</Btn><Btn sm v="secondary" onClick={() => ctx.exportCsv("shipments.csv", rows.map(r => ({ ...r, landed: Math.round(landed(r).total) })), [["id", "ID"], ["ref", "Ref"], ["vendor_name", "Supplier"], ["container", "Container"], ["stage", "Stage"], ["currency", "Cur"], ["fob_value", "FOB"], ["eta", "ETA"], ["landed", "Landed PKR"]])}>⬇ Export</Btn></Toolbar>
      <Grid cols={4}><Stat l="Active Shipments" v={rows.filter(r => r.stage !== "In Warehouse").length} c={G.blue} /><Stat l="In Transit / At Port" v={inTransit.length} c={G.amber} sub={fmt(inTransit.reduce((s, r) => s + landed(r).total, 0)) + " landed value"} /><Stat l="FC Exposure (unpaid)" v={rows.filter(r => r.stage !== "In Warehouse").reduce((s, r) => s + landed(r).fcTotal * Number(r.fx_rate), 0) > 0 ? fmt(rows.filter(r => r.stage !== "In Warehouse").reduce((s, r) => s + landed(r).fcTotal * Number(r.fx_rate), 0)) : "—"} c={G.purple} /><Stat l="Landed This Quarter" v={fmt(rows.filter(r => r.stage === "In Warehouse").reduce((s, r) => s + landed(r).total, 0))} c={G.mid} /></Grid>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>{STAGES.map((s, i) => { const n = rows.filter(r => r.stage === s).length; return <div key={s} onClick={() => setStage(stage === s ? "All" : s)} style={{ flex: "1 0 110px", background: stage === s ? G.dark : G.card, color: stage === s ? G.white : G.ink, borderRadius: 9, padding: "8px 10px", cursor: "pointer", boxShadow: "0 1px 6px rgba(15,59,76,0.08)", borderLeft: `3px solid ${STAGE_C[s][0]}` }}><div style={{ fontSize: 9, fontWeight: 700, opacity: 0.75 }}>{i + 1}. {s}</div><div style={{ fontSize: 16, fontWeight: 800 }}>{n}</div></div>; })}</div>
      <Card title="Shipment Pipeline">
        <TblWrap compact heads={["Ref", "Supplier", "Route", "Container", "Stage", "FOB (FC)", "Landed (PKR)", "ETA", "Actions"]} rows={fil.map(r => [<div><b style={{ fontSize: 11, color: G.dark }}>{r.id}</b><div style={{ fontSize: 9, color: G.muted }}>{r.ref}</div></div>, <span style={{ fontSize: 11, fontWeight: 600 }}>{r.vendor_name}</span>, <span style={{ fontSize: 10, color: G.muted }}>{r.origin_port} → KHI</span>, <div><span style={{ fontSize: 10, fontWeight: 700 }}>{r.container}</span><div style={{ fontSize: 9, color: G.muted }}>{r.size} · {r.incoterm}</div></div>, <StagePill s={r.stage} />, <b style={{ fontSize: 11 }}>{fmtCur(r.fob_value, r.currency)}</b>, <b style={{ fontSize: 11, color: G.dark }}>{fmt(landed(r).total)}</b>, <span style={{ fontSize: 10, fontWeight: 700, color: r.eta < todayStr() && r.stage !== "In Warehouse" && r.stage !== "Cleared" ? G.red : G.muted }}>{r.eta}</span>, <div style={{ display: "flex", gap: 4 }}><Btn sm v="ghost" onClick={() => setView(r)}>View</Btn>{r.stage !== "In Warehouse" && <Btn sm v="success" onClick={() => advance(r)}>→ {STAGES[STAGES.indexOf(r.stage) + 1]}</Btn>}</div>])} />
      </Card>
      {view && (() => { const l = landed(view); const lcs = []; return <Modal title={`🚢 ${view.id} — ${view.ref}`} onClose={() => setView(null)} wide>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>{[["Supplier", view.vendor_name], ["Stage", view.stage], ["Container", `${view.container} (${view.size})`], ["Incoterm", view.incoterm], ["B/L No", view.bl_no || "—"], ["GD No", view.gd_no || "—"], ["ETD / ETA", `${view.etd || "—"} → ${view.eta}`], ["LC", view.lc_id || "Open account / TT"]].map(([k, v]) => <div key={k} style={{ background: G.pale, borderRadius: 7, padding: "8px 11px" }}><div style={{ fontSize: 8, fontWeight: 700, color: G.muted, textTransform: "uppercase" }}>{k}</div><div style={{ fontSize: 12, fontWeight: 600 }}>{v}</div></div>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
          <Card title="Items" color={G.mid}><TblWrap compact heads={["Product", "Qty", `Unit (${view.currency})`, "Landed/unit"]} rows={(view.items || []).map(i => [<span style={{ fontSize: 11 }}>{i.product_name}</span>, <b style={{ fontSize: 11 }}>{i.qty}</b>, <span style={{ fontSize: 11 }}>{i.unit_price_fc}</span>, <b style={{ fontSize: 11, color: G.dark }}>{fmt(i.unit_price_fc * Number(view.fx_rate) * (l.total / Math.max(1, l.fcTotal * Number(view.fx_rate))))}</b>])} />{!(view.items || []).length && <div style={{ padding: 14, fontSize: 11, color: G.muted }}>No items added yet.</div>}</Card>
          <Card title="Landed Cost Breakdown" color={G.amber}><div style={{ padding: 12, fontSize: 12 }}>{[["FOB + freight + insurance", `${fmtCur(l.fcTotal, view.currency)} @ ${view.fx_rate}`], ["CIF value (PKR)", fmt(l.cif)], ["Customs duty", fmt(l.duty)], ["Sales tax @ import", fmt(l.st)], ["Advance income tax", fmt(l.it)], ["Clearing + port + transport", fmt(l.local)]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${G.pale}` }}><span style={{ color: G.muted }}>{k}</span><b>{v}</b></div>)}<div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 800, fontSize: 14 }}><span>Total landed</span><span style={{ color: G.dark }}>{fmt(l.total)}</span></div><div style={{ fontSize: 11, color: G.muted }}>Per unit: <b>{fmt(l.perUnit)}</b> · Duty+tax share: <b>{((l.duty + l.st + l.it) / Math.max(1, l.total) * 100).toFixed(1)}%</b></div></div></Card>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}><Btn v="secondary" onClick={() => print(view)}>🖨 Print Shipment Sheet</Btn><div style={{ display: "flex", gap: 8 }}>{view.stage !== "In Warehouse" && <Btn v="success" onClick={() => advance(view)}>→ {STAGES[STAGES.indexOf(view.stage) + 1]}</Btn>}<Btn v="secondary" onClick={() => setView(null)}>Close</Btn></div></div>
      </Modal>; })()}
      {add && <Modal title="🚢 New Shipment" onClose={() => setAdd(false)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Sel label="Overseas Supplier" value={f.vendor_id} onChange={e => { const v = ctx.vendors.find(x => x.id === e.target.value); setF(p => ({ ...p, vendor_id: e.target.value, currency: v?.currency && v.currency !== "PKR" ? v.currency : p.currency })); }}><option value="">— Select —</option>{ctx.vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.country})</option>)}</Sel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="Origin Port" value={f.origin_port} onChange={e => setF(p => ({ ...p, origin_port: e.target.value }))} /><Sel label="Container" value={f.size} onChange={e => setF(p => ({ ...p, size: e.target.value }))}>{["20ft", "40ft", "40ft HC", "LCL"].map(x => <option key={x}>{x}</option>)}</Sel>
          <Sel label="Incoterm" value={f.incoterm} onChange={e => setF(p => ({ ...p, incoterm: e.target.value }))}>{["FOB", "CIF", "CFR", "EXW", "DAP"].map(x => <option key={x}>{x}</option>)}</Sel><Sel label="Currency" value={f.currency} onChange={e => setF(p => ({ ...p, currency: e.target.value }))}>{["USD", "EUR", "AED", "CNY", "GBP"].map(x => <option key={x}>{x}</option>)}</Sel>
          <Inp label={`FOB Value (${f.currency})`} type="number" value={f.fob_value} onChange={e => setF(p => ({ ...p, fob_value: e.target.value }))} /><Inp label={`Freight (${f.currency})`} type="number" value={f.freight_fc} onChange={e => setF(p => ({ ...p, freight_fc: e.target.value }))} />
          <Inp label="FX Rate (PKR)" type="number" value={f.fx_rate} onChange={e => setF(p => ({ ...p, fx_rate: e.target.value }))} /><Inp label="ETA" type="date" value={f.eta} onChange={e => setF(p => ({ ...p, eta: e.target.value }))} />
        </div>
        <div style={{ fontSize: 11, color: G.muted }}>Duty 20%, sales tax 18% and advance income tax 5.5% are estimated automatically and can be refined in Landed Cost.</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setAdd(false)}>Cancel</Btn><Btn onClick={save}>💾 Create</Btn></div></div></Modal>}
    </div>
  );
};

const LandedCostPage = ({ ctx }) => {
  const [rows] = useTable("shipments", [ctx.dataVersion]);
  const [sel, setSel] = useState("");
  const [f, setF] = useState({ fob: 20000, freight: 2800, insurance: 200, fx: 278.5, qty: 500, duty: 20, st: 18, it: 5.5, clearing: 90000, port: 60000, transport: 45000, margin: 25 });
  const load = id => { setSel(id); const s = rows.find(r => r.id === id); if (s) setF({ fob: s.fob_value, freight: s.freight_fc, insurance: s.insurance_fc, fx: s.fx_rate, qty: s.total_qty || 1, duty: Math.round(s.duty_pkr / (s.fob_value * s.fx_rate) * 1000) / 10, st: 18, it: 5.5, clearing: s.clearing_pkr, port: s.port_charges_pkr, transport: s.transport_pkr, margin: 25 }); };
  const n = k => Number(f[k]) || 0;
  const cif = (n("fob") + n("freight") + n("insurance")) * n("fx"); const duty = cif * n("duty") / 100; const st = (cif + duty) * n("st") / 100; const it = (cif + duty + st) * n("it") / 100; const local = n("clearing") + n("port") + n("transport"); const total = cif + duty + st + it + local; const unit = total / Math.max(1, n("qty")); const sell = unit * (1 + n("margin") / 100);
  const F = (k, label, step) => <Inp label={label} type="number" step={step} value={f[k]} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))} />;
  const rowsOut = [["CIF value", cif, cif / total], ["Customs duty", duty, duty / total], ["Sales tax", st, st / total], ["Advance income tax", it, it / total], ["Clearing / port / transport", local, local / total]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card title="Inputs" color={G.blue}><div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <Sel label="Load from shipment (optional)" value={sel} onChange={e => load(e.target.value)}><option value="">— Manual entry —</option>{rows.map(r => <option key={r.id} value={r.id}>{r.id} · {r.vendor_name}</option>)}</Sel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{F("fob", "FOB value (FC)")}{F("freight", "Freight (FC)")}{F("insurance", "Insurance (FC)")}{F("fx", "FX rate → PKR", "0.01")}{F("qty", "Total units")}{F("margin", "Target margin %")}</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: G.muted, textTransform: "uppercase", marginTop: 4 }}>Government levies (% cascading)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{F("duty", "Customs duty %", "0.5")}{F("st", "Sales tax %", "0.5")}{F("it", "Adv. income tax %", "0.5")}</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: G.muted, textTransform: "uppercase", marginTop: 4 }}>Local charges (PKR)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{F("clearing", "Clearing agent")}{F("port", "Port / terminal")}{F("transport", "Transport")}</div>
      </div></Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Grid cols={2} mb={0}><Stat l="Total Landed Cost" v={fmt(total)} c={G.dark} /><Stat l="Landed Cost / Unit" v={fmt(unit)} c={G.amber} /><Stat l={`Selling Price @ ${n("margin")}%`} v={fmt(sell)} c={G.mid} /><Stat l="Levies share of cost" v={`${((duty + st + it) / Math.max(1, total) * 100).toFixed(1)}%`} c={G.red} /></Grid>
        <Card title="Cost Build-up"><div style={{ padding: 14 }}>{rowsOut.map(([k, v, p]) => <div key={k} style={{ marginBottom: 9 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{k}</span><b>{fmt(v)} <span style={{ color: G.muted, fontWeight: 500 }}>({(p * 100).toFixed(1)}%)</span></b></div><div style={{ height: 7, background: G.pale, borderRadius: 4 }}><div style={{ height: "100%", width: `${p * 100}%`, background: G.dark, borderRadius: 4 }} /></div></div>)}<div style={{ fontSize: 10, color: G.muted, marginTop: 8 }}>Formula: CIF = (FOB + freight + insurance) × FX; duty on CIF; sales tax on CIF + duty; income tax on CIF + duty + ST; plus local charges.</div></div></Card>
        <Btn v="secondary" onClick={() => openPrintable("Landed Cost Estimate", `<table>${rowsOut.map(([k, v]) => `<tr><td>${k}</td><td class="r">${fmt(v)}</td></tr>`).join("")}<tr><td><b>Total landed</b></td><td class="r"><b>${fmt(total)}</b></td></tr><tr><td>Per unit (${n("qty")} units)</td><td class="r">${fmt(unit)}</td></tr><tr><td>Selling price @ ${n("margin")}% margin</td><td class="r">${fmt(sell)}</td></tr></table>`)}>🖨 Print Estimate</Btn>
      </div>
    </div>
  );
};

const LcPage = ({ ctx }) => {
  const [rows, reload] = useTable("lcs", [ctx.dataVersion]); const [fx] = useTable("fx_rates", [ctx.dataVersion]);
  const [add, setAdd] = useState(false); const [f, setF] = useState({ bank: "Meezan Bank", beneficiary: "", currency: "USD", amount: "", margin_pct: 20, expiry: todayStr() });
  const rate = c => fx.find(x => x.code === c)?.rate || 1;
  const setStatus = async (r, status) => { await sbPost("upsert", { table: "lcs", label: "LC", row: { ...r, status } }); ctx.notify(`✅ ${r.id} ${status}`); reload(); };
  const save = async () => { if (!f.beneficiary || !validNum(f.amount) || +f.amount <= 0) return ctx.notify("Enter beneficiary and amount", "err"); await sbPost("upsert", { table: "lcs", prefix: "LC", label: "LC", row: { ...f, amount: +f.amount, number: `ILC/${Math.floor(1000 + Math.random() * 8999)}/${new Date().getFullYear()}`, status: "Open", issue_date: todayStr(), shipment_id: null } }); ctx.notify("✅ LC opened"); setAdd(false); reload(); };
  const open = rows.filter(r => r.status !== "Settled");
  return (
    <div>
      <Toolbar><div style={{ flex: 1 }} /><Btn sm onClick={() => setAdd(true)}>+ Open LC</Btn></Toolbar>
      <Grid cols={4}><Stat l="Open LCs" v={open.length} c={G.blue} /><Stat l="Open LC Value (PKR)" v={fmt(open.reduce((s, r) => s + r.amount * rate(r.currency), 0))} c={G.purple} /><Stat l="Cash Margin Held" v={fmt(open.reduce((s, r) => s + r.amount * rate(r.currency) * r.margin_pct / 100, 0))} c={G.amber} /><Stat l="Expiring in 30 days" v={open.filter(r => r.expiry <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)).length} c={G.red} /></Grid>
      <Card title="Letters of Credit"><TblWrap compact heads={["LC", "Number", "Bank", "Beneficiary", "Amount", "PKR Equivalent", "Margin", "Issued", "Expiry", "Status", "Actions"]} rows={rows.map(r => [<b style={{ fontSize: 11, color: G.dark }}>{r.id}</b>, <span style={{ fontSize: 10 }}>{r.number}</span>, <span style={{ fontSize: 10, color: G.muted }}>{r.bank}</span>, <span style={{ fontSize: 11, fontWeight: 600 }}>{r.beneficiary}</span>, <b style={{ fontSize: 11 }}>{fmtCur(r.amount, r.currency)}</b>, <span style={{ fontSize: 11 }}>{fmt(r.amount * rate(r.currency))}</span>, <span style={{ fontSize: 10 }}>{r.margin_pct}%</span>, <span style={{ fontSize: 10, color: G.muted }}>{r.issue_date}</span>, <span style={{ fontSize: 10, fontWeight: 700, color: r.expiry < todayStr() && r.status !== "Settled" ? G.red : G.muted }}>{r.expiry}</span>, <SPill s={r.status} />, <div style={{ display: "flex", gap: 4 }}>{r.status === "Open" && <Btn sm v="secondary" onClick={() => setStatus(r, "Documents Received")}>Docs Received</Btn>}{r.status === "Documents Received" && <Btn sm v="success" onClick={() => setStatus(r, "Settled")}>Settle</Btn>}</div>])} /></Card>
      {add && <Modal title="📜 Open Letter of Credit" onClose={() => setAdd(false)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><Sel label="Issuing Bank" value={f.bank} onChange={e => setF(p => ({ ...p, bank: e.target.value }))}>{["Meezan Bank", "HBL", "Standard Chartered", "Bank Alfalah", "UBL", "MCB"].map(b => <option key={b}>{b}</option>)}</Sel><Sel label="Beneficiary" value={f.beneficiary} onChange={e => setF(p => ({ ...p, beneficiary: e.target.value }))}><option value="">— Supplier —</option>{ctx.vendors.filter(v => v.country !== "Pakistan").map(v => <option key={v.id}>{v.name}</option>)}</Sel><Sel label="Currency" value={f.currency} onChange={e => setF(p => ({ ...p, currency: e.target.value }))}>{["USD", "EUR", "AED", "CNY", "GBP"].map(x => <option key={x}>{x}</option>)}</Sel><Inp label="Amount" type="number" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} /><Inp label="Cash Margin %" type="number" value={f.margin_pct} onChange={e => setF(p => ({ ...p, margin_pct: +e.target.value }))} /><Inp label="Expiry" type="date" value={f.expiry} onChange={e => setF(p => ({ ...p, expiry: e.target.value }))} /></div><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setAdd(false)}>Cancel</Btn><Btn onClick={save}>💾 Open LC</Btn></div></div></Modal>}
    </div>
  );
};

const CurrenciesPage = ({ ctx }) => {
  const [fx, reload] = useTable("fx_rates", [ctx.dataVersion]); const [ships] = useTable("shipments", [ctx.dataVersion]);
  const [amt, setAmt] = useState(1000); const [from, setFrom] = useState("USD"); const [to, setTo] = useState("PKR"); const [edit, setEdit] = useState({});
  const rate = c => c === "PKR" ? 1 : (fx.find(x => x.code === c)?.rate || 1);
  const conv = amt * rate(from) / rate(to);
  const save = async c => { const v = Number(edit[c.code]); if (!v) return; await sbPost("upsert", { table: "fx_rates", key: "code", label: "FX rate", row: { ...c, prev: c.rate, rate: v } }); ctx.notify(`✅ ${c.code} rate updated`); setEdit(p => ({ ...p, [c.code]: "" })); reload(); };
  const exposure = {}; ships.filter(s => s.stage !== "In Warehouse").forEach(s => { exposure[s.currency] = (exposure[s.currency] || 0) + landed(s).fcTotal; });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
      <Card title="Exchange Rates (PKR per unit)"><TblWrap compact heads={["Code", "Currency", "Rate", "Change", "Open Exposure", "Update"]} rows={fx.map(c => [<b style={{ fontSize: 12 }}>{c.code}</b>, <span style={{ fontSize: 11 }}>{c.name}</span>, <b style={{ fontSize: 12, color: G.dark }}>{c.rate.toFixed(2)}</b>, <span style={{ fontSize: 10, fontWeight: 700, color: c.rate >= c.prev ? G.red : G.mid }}>{c.rate >= c.prev ? "▲" : "▼"} {Math.abs(c.rate - c.prev).toFixed(2)}</span>, <span style={{ fontSize: 11 }}>{exposure[c.code] ? `${fmtCur(exposure[c.code], c.code)} ≈ ${fmt(exposure[c.code] * c.rate)}` : "—"}</span>, <div style={{ display: "flex", gap: 4 }}><input value={edit[c.code] || ""} onChange={e => setEdit(p => ({ ...p, [c.code]: e.target.value }))} placeholder="new" style={{ width: 70, border: `1px solid ${G.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 11 }} /><Btn sm onClick={() => save(c)}>Set</Btn></div>])} /></Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card title="Converter" color={G.blue}><div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Inp label="Amount" type="number" value={amt} onChange={e => setAmt(+e.target.value)} /><Sel label="From" value={from} onChange={e => setFrom(e.target.value)}>{["PKR", ...fx.map(c => c.code)].map(x => <option key={x}>{x}</option>)}</Sel><Sel label="To" value={to} onChange={e => setTo(e.target.value)}>{["PKR", ...fx.map(c => c.code)].map(x => <option key={x}>{x}</option>)}</Sel></div><div style={{ background: G.pale, borderRadius: 9, padding: 14, textAlign: "center" }}><div style={{ fontSize: 10, color: G.muted, fontWeight: 700 }}>{fmtCur(amt, from)} =</div><div style={{ fontSize: 22, fontWeight: 800, color: G.dark }}>{fmtCur(conv, to)}</div></div></div></Card>
        <Card title="FX Sensitivity on Open Shipments" color={G.amber}><div style={{ padding: 14, fontSize: 12 }}>{[-5, -2, 2, 5].map(p => { const base = Object.entries(exposure).reduce((s, [c, v]) => s + v * rate(c), 0); return <div key={p} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${G.pale}` }}><span>PKR {p > 0 ? "weakens" : "strengthens"} {Math.abs(p)}%</span><b style={{ color: p > 0 ? G.red : G.mid }}>{p > 0 ? "+" : "−"}{fmt(Math.abs(base * p / 100))}</b></div>; })}<div style={{ fontSize: 10, color: G.muted, marginTop: 8 }}>Impact on the PKR cost of goods not yet landed.</div></div></Card>
      </div>
    </div>
  );
};

const SuppliersPage = ({ ctx }) => {
  const [ships] = useTable("shipments", [ctx.dataVersion]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
      {ctx.vendors.map(v => { const ap = ctx.ap.find(a => a.vendorId === v.id) || {}; const vs = ships.filter(s => s.vendor_id === v.id); return <div key={v.id} style={{ background: G.card, borderRadius: 11, padding: 16, boxShadow: "0 2px 10px rgba(15,59,76,0.07)", borderLeft: `4px solid ${v.country === "Pakistan" ? G.muted : G.blue}` }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: 800, fontSize: 13 }}>{v.name}</div><Pill text={v.country} color={v.country === "Pakistan" ? G.muted : G.blue} bg={v.country === "Pakistan" ? "#EEF2F3" : G.sky} /></div>
        <div style={{ fontSize: 10, color: G.muted, margin: "3px 0 10px" }}>{v.category} · {v.contact} · trades in {v.currency}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{[["Shipments", vs.length], ["Active", vs.filter(s => s.stage !== "In Warehouse").length], ["AP Due", fmt(ap.balance || 0)]].map(([l, x]) => <div key={l} style={{ background: G.pale, borderRadius: 6, padding: "6px 5px", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700 }}>{x}</div><div style={{ fontSize: 8, color: G.muted }}>{l}</div></div>)}</div>
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}><Btn sm v="ghost" onClick={() => ctx.setModal({ t: "editVendor", d: v })}>✏️ Edit</Btn>{(ap.balance || 0) > 0 && <Btn sm v="danger" onClick={() => ctx.setModal({ t: "vendorPayment", d: { vendorId: v.id } })}>Pay</Btn>}</div>
      </div>; })}
    </div>
  );
};

const DashboardExtra = ({ ctx }) => {
  const [ships] = useTable("shipments", [ctx.dataVersion]); const [lcs] = useTable("lcs", [ctx.dataVersion]);
  const transit = ships.filter(s => ["Shipped", "At Port", "Customs"].includes(s.stage)); const next = [...ships].filter(s => s.stage !== "In Warehouse" && s.stage !== "Cleared").sort((a, b) => a.eta.localeCompare(b.eta))[0];
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}><Kpi label="Containers in Transit" value={transit.length} sub={`${ships.filter(s => s.stage === "Customs").length} at customs`} color={G.blue} icon={Ship} /><Kpi label="Landed Value in Transit" value={fmt(transit.reduce((s, r) => s + landed(r).total, 0))} color={G.amber} icon={Container} /><Kpi label="Open LCs" value={lcs.filter(l => l.status !== "Settled").length} sub={lcs.filter(l => l.status === "Open").length + " awaiting docs"} color={G.purple} icon={Globe} /><Kpi label="Next Arrival" value={next ? next.eta : "—"} sub={next ? `${next.id} · ${next.vendor_name}` : ""} color={G.mid} icon={Coins} /></div>;
};

export const IMPORTER = {
  navGroups: [{ group: "Import Operations", items: [{ id: "shipments", label: "Shipments" }, { id: "landedcost", label: "Landed Cost" }, { id: "lcs", label: "Letters of Credit" }, { id: "currencies", label: "Currencies & FX" }, { id: "suppliers", label: "Overseas Suppliers" }] }],
  pages: { shipments: ShipmentsPage, landedcost: LandedCostPage, lcs: LcPage, currencies: CurrenciesPage, suppliers: SuppliersPage },
  DashboardExtra,
};
