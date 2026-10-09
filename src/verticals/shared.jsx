// Shared TradeDesk modules available in every business edition:
// Bank & Cash, Cheques, Cash Flow, General Ledger, Sales Tax, Alerts, Users & Roles, Audit Log, Settings.
import { useState, useEffect, useMemo } from "react";
import { G, Badge, Inp, Sel, Btn, Kpi, Modal, TblWrap, todayStr, ageDaysOf, validNum, useIsMobile } from "../apt/AptCrm.jsx";
import { sbPost } from "../data/mockApi.js";
import { CONFIG, fmt, setCompany, setConfig } from "../lib/config.js";
import { openPrintable } from "../lib/invoiceDoc.js";
import { CountUp } from "../ui/motion.jsx";
import { Landmark, AlertTriangle, Bell, Wallet } from "lucide-react";

export const Card = ({ title, color = G.dark, right, children, style }) => (
  <div className="td-card" style={{ background: G.card, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(15,23,42,0.07)", ...style }}>
    {title && <div style={{ background: color, padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: G.white, fontWeight: 700, fontSize: 13 }}>{title}</span>{right}</div>}
    {children}
  </div>
);
export const Stat = ({ l, v, c = G.dark, sub }) => (
  <div className="td-card" style={{ background: G.card, borderRadius: 9, padding: "11px 14px", boxShadow: "0 1px 8px rgba(15,23,42,0.07)", borderBottom: `3px solid ${c}` }}>
    <div style={{ fontSize: 9, color: G.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
    <div style={{ fontSize: 16, fontWeight: 800, color: G.ink }}><CountUp value={v} /></div>
    {sub && <div style={{ fontSize: 9, color: G.muted, marginTop: 2 }}>{sub}</div>}
  </div>
);
export const Grid = ({ cols = 4, children, gap = 10, mb = 12 }) => { const m = useIsMobile(); return <div style={{ display: "grid", gridTemplateColumns: m ? "1fr 1fr" : `repeat(${cols},1fr)`, gap, marginBottom: mb }}>{children}</div>; };
export const Toolbar = ({ children }) => <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>{children}</div>;
export const Search = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search…"} style={{ border: `1.5px solid ${G.border}`, borderRadius: 8, padding: "7px 11px 7px 33px", fontSize: 13, width: "100%", boxSizing: "border-box", background: G.bg, outline: "none", color: G.ink }} />
    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: G.muted }}>🔍</span>
  </div>
);
export const Pill = ({ text, color, bg }) => <span style={{ background: bg || G.pale, color: color || G.dark, padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;
export const STATUS_COLORS = { Open: [G.blue, G.sky], Pending: [G.amber, "#FFF4E5"], Cleared: [G.mid, G.pale], Deposited: [G.blue, G.sky], Bounced: [G.red, G.pink], Active: [G.mid, G.pale], Paused: [G.amber, "#FFF4E5"], Completed: [G.mid, G.pale], "In Progress": [G.blue, G.sky], Planned: [G.muted, "#EEF2F3"], "On Hold": [G.amber, "#FFF4E5"], QC: [G.purple, "#F3E5F5"], Planning: [G.muted, "#EEF2F3"], Draft: [G.muted, "#EEF2F3"], Sent: [G.blue, G.sky], Accepted: [G.mid, G.pale], Rejected: [G.red, G.pink], Expired: [G.muted, "#EEF2F3"], Confirmed: [G.blue, G.sky], Picking: [G.purple, "#F3E5F5"], Dispatched: [G.amber, "#FFF4E5"], Delivered: [G.mid, G.pale], Invoiced: [G.mid, G.pale], Settled: [G.mid, G.pale], "Documents Received": [G.purple, "#F3E5F5"], Running: [G.mid, G.pale], Maintenance: [G.amber, "#FFF4E5"], Closed: [G.muted, "#EEF2F3"], Refunded: [G.red, G.pink] };
export const SPill = ({ s }) => { const [c, b] = STATUS_COLORS[s] || [G.dark, G.pale]; return <Pill text={s} color={c} bg={b} />; };
export const useTable = (table, deps = []) => {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [tick, setTick] = useState(0);
  useEffect(() => { let on = true; setLoading(true); sbPost("list", { table }).then(d => { if (on) setRows(d || []); }).finally(() => on && setLoading(false)); return () => { on = false; }; }, [table, tick, ...deps]); // eslint-disable-line
  return [rows, () => setTick(t => t + 1), loading];
};
export const monthKey = d => String(d || "").slice(0, 7);
export const monthLabel = k => { const [y, m] = k.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en", { month: "short", year: "2-digit" }); };
export const lastMonths = n => { const out = []; const d = new Date(); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); } return out; };
export const Bars = ({ series, height = 120 }) => {
  // series: [{label, values:[{k,v}], color}] — simple grouped bar chart, no library.
  const keys = series[0]?.values.map(v => v.k) || [];
  const max = Math.max(1, ...series.flatMap(s => s.values.map(v => Math.abs(v.v))));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, padding: "0 4px" }}>
        {keys.map((k, i) => (
          <div key={k} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: "100%" }}>
            {series.map(s => { const v = s.values[i]?.v || 0; return <div key={s.label} title={`${s.label} ${monthLabel(k)}: ${fmt(v)}`} style={{ flex: 1, height: `${Math.max(2, Math.abs(v) / max * 100)}%`, background: v < 0 ? G.red : s.color, borderRadius: "4px 4px 0 0", opacity: 0.9 }} />; })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "4px 4px 0" }}>{keys.map(k => <div key={k} style={{ flex: 1, textAlign: "center", fontSize: 9, color: G.muted, fontWeight: 600 }}>{monthLabel(k)}</div>)}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>{series.map(s => <span key={s.label} style={{ fontSize: 10, color: G.muted, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: s.color, borderRadius: 2, display: "inline-block" }} />{s.label}</span>)}</div>
    </div>
  );
};

// ── Bank & Cash ──
export const BankPage = ({ ctx }) => {
  const [accounts, reloadA] = useTable("bank_accounts", [ctx.dataVersion]);
  const [txs, reloadT] = useTable("bank_transactions", [ctx.dataVersion]);
  const [modal, setModal] = useState(null);
  const [f, setF] = useState({ account_id: "", date: todayStr(), type: "Deposit", amount: "", ref: "", notes: "" });
  const [tf, setTf] = useState({ from: "", to: "", amount: "", date: todayStr(), notes: "" });
  const balance = a => a.opening_balance + txs.filter(t => t.account_id === a.id).reduce((s, t) => s + (t.type === "Deposit" ? t.amount : -t.amount), 0);
  const total = accounts.filter(a => a.currency === CONFIG.currency).reduce((s, a) => s + balance(a), 0);
  const save = async () => {
    if (!f.account_id) return ctx.notify("Select an account", "err"); if (!validNum(f.amount) || +f.amount <= 0) return ctx.notify("Enter a valid amount", "err");
    await sbPost("upsert", { table: "bank_transactions", prefix: "BT", label: "Bank transaction", row: { ...f, amount: +f.amount } }); ctx.notify("✅ Transaction recorded"); setModal(null); reloadT();
  };
  const transfer = async () => {
    if (!tf.from || !tf.to || tf.from === tf.to) return ctx.notify("Pick two different accounts", "err"); if (!validNum(tf.amount) || +tf.amount <= 0) return ctx.notify("Enter a valid amount", "err");
    await sbPost("upsert", { table: "bank_transactions", prefix: "BT", label: "Transfer out", row: { account_id: tf.from, date: tf.date, type: "Withdrawal", amount: +tf.amount, ref: `Transfer to ${accounts.find(a => a.id === tf.to)?.name}`, notes: tf.notes } });
    await sbPost("upsert", { table: "bank_transactions", prefix: "BT", label: "Transfer in", row: { account_id: tf.to, date: tf.date, type: "Deposit", amount: +tf.amount, ref: `Transfer from ${accounts.find(a => a.id === tf.from)?.name}`, notes: tf.notes } });
    ctx.notify("✅ Transfer posted"); setModal(null); reloadT();
  };
  return (
    <div>
      <Toolbar><div style={{ flex: 1 }} /><Btn sm onClick={() => setModal("tx")}>+ Deposit / Withdrawal</Btn><Btn sm v="secondary" onClick={() => setModal("transfer")}>⇄ Transfer</Btn><Btn sm v="secondary" onClick={() => ctx.exportCsv("bank_transactions.csv", txs, [["id", "ID"], ["date", "Date"], ["account_id", "Account"], ["type", "Type"], ["amount", "Amount"], ["ref", "Reference"]])}>⬇ Export</Btn></Toolbar>
      <Grid cols={4}><Stat l="Total Cash & Bank" v={fmt(total)} c={G.mid} /><Stat l="Accounts" v={accounts.length} /><Stat l="Deposits (all)" v={fmt(txs.filter(t => t.type === "Deposit").reduce((s, t) => s + t.amount, 0))} c={G.light} /><Stat l="Withdrawals (all)" v={fmt(txs.filter(t => t.type !== "Deposit").reduce((s, t) => s + t.amount, 0))} c={G.red} /></Grid>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12, marginBottom: 14 }}>
        {accounts.map(a => <div key={a.id} style={{ background: G.card, borderRadius: 11, padding: 14, boxShadow: "0 2px 10px rgba(15,59,76,0.07)", borderTop: `3px solid ${a.type === "Cash" ? G.amber : a.type === "Wallet" ? G.purple : G.mid}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: 800, fontSize: 13 }}>{a.name}</div><Pill text={a.type} /></div>
          <div style={{ fontSize: 10, color: G.muted, margin: "3px 0 8px" }}>{a.bank} · {a.account_no}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: G.dark }}>{a.currency} {Math.round(balance(a)).toLocaleString()}</div>
        </div>)}
      </div>
      <Card title="Recent Transactions">
        <TblWrap compact heads={["ID", "Date", "Account", "Type", "Amount", "Reference"]} rows={txs.slice(0, 60).map(t => [<b style={{ fontSize: 11, color: G.dark }}>{t.id}</b>, <span style={{ fontSize: 10, color: G.muted }}>{t.date}</span>, <span style={{ fontSize: 11 }}>{accounts.find(a => a.id === t.account_id)?.name || t.account_id}</span>, <Pill text={t.type} color={t.type === "Deposit" ? G.mid : G.red} bg={t.type === "Deposit" ? G.pale : G.pink} />, <b style={{ fontSize: 11, color: t.type === "Deposit" ? G.mid : G.red }}>{fmt(t.amount)}</b>, <span style={{ fontSize: 10, color: G.muted }}>{t.ref}</span>])} />
      </Card>
      {modal === "tx" && <Modal title="🏦 Record Bank / Cash Transaction" onClose={() => setModal(null)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Sel label="Account" value={f.account_id} onChange={e => setF(p => ({ ...p, account_id: e.target.value }))}><option value="">— Select —</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Sel>
          <Sel label="Type" value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))}><option>Deposit</option><option>Withdrawal</option></Sel>
          <Inp label="Date" type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} /><Inp label={`Amount (${CONFIG.currency})`} type="number" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} />
        </div>
        <Inp label="Reference" value={f.ref} onChange={e => setF(p => ({ ...p, ref: e.target.value }))} placeholder="e.g. Cash deposit, Vendor payment" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={save}>💾 Save</Btn></div></div></Modal>}
      {modal === "transfer" && <Modal title="⇄ Transfer Between Accounts" onClose={() => setModal(null)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Sel label="From" value={tf.from} onChange={e => setTf(p => ({ ...p, from: e.target.value }))}><option value="">— Select —</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Sel>
          <Sel label="To" value={tf.to} onChange={e => setTf(p => ({ ...p, to: e.target.value }))}><option value="">— Select —</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Sel>
          <Inp label="Date" type="date" value={tf.date} onChange={e => setTf(p => ({ ...p, date: e.target.value }))} /><Inp label="Amount" type="number" value={tf.amount} onChange={e => setTf(p => ({ ...p, amount: e.target.value }))} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={transfer}>💾 Post Transfer</Btn></div></div></Modal>}
    </div>
  );
};

// ── Cheques (post-dated cheque tracker) ──
export const ChequesPage = ({ ctx }) => {
  const [rows, reload] = useTable("cheques", [ctx.dataVersion]);
  const [filter, setFilter] = useState("All"); const [modal, setModal] = useState(false);
  const [f, setF] = useState({ type: "Received", party_id: "", number: "", bank: "HBL", amount: "", date: todayStr(), due_date: todayStr() });
  const today = todayStr();
  const fil = rows.filter(r => filter === "All" || r.status === filter || (filter === "Due Soon" && r.status !== "Cleared" && r.status !== "Bounced" && r.due_date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)));
  const setStatus = async (r, status) => { await sbPost("upsert", { table: "cheques", label: "Cheque", row: { ...r, status } }); ctx.notify(`✅ ${r.id} marked ${status}`); reload(); };
  const save = async () => {
    if (!f.party_id || !f.number || !validNum(f.amount) || +f.amount <= 0) return ctx.notify("Fill party, cheque number and amount", "err");
    const party = (f.type === "Received" ? ctx.customers : ctx.vendors).find(p => p.id === f.party_id);
    await sbPost("upsert", { table: "cheques", prefix: "CHQ", label: "Cheque", row: { ...f, amount: +f.amount, party_name: party?.name, status: "Pending" } }); ctx.notify("✅ Cheque added"); setModal(false); reload();
  };
  const sum = s => rows.filter(r => r.status === s).reduce((a, r) => a + r.amount, 0);
  return (
    <div>
      <Toolbar>{["All", "Pending", "Deposited", "Cleared", "Bounced", "Due Soon"].map(s => <button key={s} onClick={() => setFilter(s)} style={{ padding: "5px 11px", borderRadius: 20, border: `1.5px solid ${filter === s ? G.dark : G.border}`, background: filter === s ? G.dark : G.bg, color: filter === s ? G.white : G.ink, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{s}</button>)}<div style={{ flex: 1 }} /><Btn sm onClick={() => setModal(true)}>+ Add Cheque</Btn></Toolbar>
      <Grid cols={4}><Stat l="Pending (PDC)" v={fmt(sum("Pending"))} c={G.amber} /><Stat l="Deposited" v={fmt(sum("Deposited"))} c={G.blue} /><Stat l="Cleared" v={fmt(sum("Cleared"))} c={G.mid} /><Stat l="Bounced" v={fmt(sum("Bounced"))} c={G.red} sub={`${rows.filter(r => r.status === "Bounced").length} cheques`} /></Grid>
      <Card title="Cheque Register">
        <TblWrap compact heads={["ID", "Type", "Party", "Cheque #", "Bank", "Amount", "Due", "Status", "Actions"]} rows={fil.map(r => [<b style={{ fontSize: 11, color: G.dark }}>{r.id}</b>, <Pill text={r.type} color={r.type === "Received" ? G.mid : G.purple} bg={r.type === "Received" ? G.pale : "#F3E5F5"} />, <span style={{ fontSize: 11, fontWeight: 600 }}>{r.party_name}</span>, <span style={{ fontSize: 10 }}>{r.number}</span>, <span style={{ fontSize: 10, color: G.muted }}>{r.bank}</span>, <b style={{ fontSize: 11 }}>{fmt(r.amount)}</b>, <span style={{ fontSize: 10, fontWeight: 700, color: r.due_date < today && r.status === "Pending" ? G.red : G.muted }}>{r.due_date}</span>, <SPill s={r.status} />, <div style={{ display: "flex", gap: 4 }}>{r.status === "Pending" && <Btn sm v="secondary" onClick={() => setStatus(r, "Deposited")}>Deposit</Btn>}{r.status === "Deposited" && <><Btn sm v="success" onClick={() => setStatus(r, "Cleared")}>Cleared</Btn><Btn sm v="danger" onClick={() => setStatus(r, "Bounced")}>Bounced</Btn></>}{r.status === "Bounced" && <Btn sm v="ghost" onClick={() => setStatus(r, "Pending")}>Re-present</Btn>}</div>])} />
      </Card>
      {modal && <Modal title="🧾 Add Cheque" onClose={() => setModal(false)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Sel label="Type" value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value, party_id: "" }))}><option>Received</option><option>Issued</option></Sel>
          <Sel label={f.type === "Received" ? "Customer" : "Vendor"} value={f.party_id} onChange={e => setF(p => ({ ...p, party_id: e.target.value }))}><option value="">— Select —</option>{(f.type === "Received" ? ctx.customers : ctx.vendors).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
          <Inp label="Cheque Number" value={f.number} onChange={e => setF(p => ({ ...p, number: e.target.value }))} /><Sel label="Bank" value={f.bank} onChange={e => setF(p => ({ ...p, bank: e.target.value }))}>{["HBL", "UBL", "MCB", "Meezan", "Allied", "Bank Alfalah", "Askari", "Standard Chartered"].map(b => <option key={b}>{b}</option>)}</Sel>
          <Inp label="Amount" type="number" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} /><Inp label="Due Date" type="date" value={f.due_date} onChange={e => setF(p => ({ ...p, due_date: e.target.value }))} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setModal(false)}>Cancel</Btn><Btn onClick={save}>💾 Save</Btn></div></div></Modal>}
    </div>
  );
};

// ── Cash flow (monthly in/out + 8-week forecast from receivables/payables) ──
export const CashFlowPage = ({ ctx }) => {
  const months = lastMonths(6);
  const inflow = months.map(k => ({ k, v: ctx.payments.filter(p => p.type === "Received" && monthKey(p.date) === k).reduce((s, p) => s + Number(p.amount), 0) }));
  const outflow = months.map(k => ({ k, v: ctx.payments.filter(p => p.type === "Made" && monthKey(p.date) === k).reduce((s, p) => s + Number(p.amount), 0) + ctx.expenses.filter(e => monthKey(e.date) === k).reduce((s, e) => s + Number(e.amount), 0) }));
  const net = months.map((k, i) => ({ k, v: inflow[i].v - outflow[i].v }));
  const arDue = ctx.ar.reduce((s, r) => s + Math.max(0, r.balance), 0), apDue = ctx.ap.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const avgExp = ctx.expenses.length ? ctx.expenses.reduce((s, e) => s + Number(e.amount), 0) / 6 : 0;
  const weeks = [1, 2, 3, 4, 5, 6, 7, 8].map(w => ({ w, in: Math.round(arDue * [0.3, 0.25, 0.15, 0.1, 0.08, 0.05, 0.04, 0.03][w - 1]), out: Math.round(apDue * [0.25, 0.2, 0.15, 0.12, 0.1, 0.08, 0.05, 0.05][w - 1] + avgExp / 4.3) }));
  let run = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Grid cols={4} mb={0}><Stat l="Collections (6 mo)" v={fmt(inflow.reduce((s, x) => s + x.v, 0))} c={G.mid} /><Stat l="Payments + Expenses (6 mo)" v={fmt(outflow.reduce((s, x) => s + x.v, 0))} c={G.red} /><Stat l="Expected Inflow (AR)" v={fmt(arDue)} c={G.blue} /><Stat l="Committed Outflow (AP)" v={fmt(apDue)} c={G.amber} /></Grid>
      <Card title="Monthly Cash Flow"><div style={{ padding: 16 }}><Bars series={[{ label: "Inflow", values: inflow, color: G.mid }, { label: "Outflow", values: outflow, color: G.red }, { label: "Net", values: net, color: G.blue }]} /></div></Card>
      <Card title="8-Week Cash Forecast (from open receivables, payables and average expenses)" color={G.blue}>
        <TblWrap compact heads={["Week", "Expected In", "Expected Out", "Net", "Cumulative"]} rows={weeks.map(w => { run += w.in - w.out; return [<b style={{ fontSize: 11 }}>Week {w.w}</b>, <span style={{ color: G.mid, fontWeight: 600, fontSize: 11 }}>{fmt(w.in)}</span>, <span style={{ color: G.red, fontWeight: 600, fontSize: 11 }}>{fmt(w.out)}</span>, <b style={{ fontSize: 11, color: w.in - w.out >= 0 ? G.mid : G.red }}>{fmt(w.in - w.out)}</b>, <b style={{ fontSize: 11, color: run >= 0 ? G.dark : G.red }}>{fmt(run)}</b>]; })} />
      </Card>
    </div>
  );
};

// ── General ledger: journal derived from documents + trial balance + balance sheet ──
export const LedgerPage = ({ ctx }) => {
  const [view, setView] = useState("journal");
  const journal = useMemo(() => {
    const j = [];
    ctx.invoices.filter(i => i.status !== "VOIDED").forEach(i => j.push({ date: i.date, ref: i.id, desc: `Sale to ${i.custName}`, dr: "Accounts Receivable", cr: "Sales Revenue", amount: Number(i.total) }));
    ctx.payments.forEach(p => p.type === "Received" ? j.push({ date: p.date, ref: p.id, desc: `Receipt from ${ctx.custMap[p.partyId]?.name || p.partyId}`, dr: "Cash & Bank", cr: "Accounts Receivable", amount: Number(p.amount) }) : j.push({ date: p.date, ref: p.id, desc: `Payment to ${ctx.vendMap[p.partyId]?.name || p.partyId}`, dr: "Accounts Payable", cr: "Cash & Bank", amount: Number(p.amount) }));
    ctx.purchases.forEach(p => j.push({ date: p.date, ref: p.id, desc: `Purchase from ${p.vendor}`, dr: "Inventory / COGS", cr: "Accounts Payable", amount: Number(p.total) }));
    ctx.expenses.forEach(e => j.push({ date: e.date, ref: e.id, desc: `${e.category} expense`, dr: `Expense — ${e.category}`, cr: "Cash & Bank", amount: Number(e.amount) }));
    return j.sort((a, b) => b.date.localeCompare(a.date));
  }, [ctx.invoices, ctx.payments, ctx.purchases, ctx.expenses]); // eslint-disable-line
  const tb = useMemo(() => { const m = {}; journal.forEach(e => { m[e.dr] = m[e.dr] || { dr: 0, cr: 0 }; m[e.cr] = m[e.cr] || { dr: 0, cr: 0 }; m[e.dr].dr += e.amount; m[e.cr].cr += e.amount; }); return Object.entries(m).map(([acc, v]) => ({ acc, ...v, bal: v.dr - v.cr })).sort((a, b) => a.acc.localeCompare(b.acc)); }, [journal]);
  const get = a => tb.find(r => r.acc === a)?.bal || 0;
  const opening = 2450000 + 880000 + 125000 + 64000;
  const cash = opening + get("Cash & Bank"), ar = get("Accounts Receivable"), inv = get("Inventory / COGS"), ap = -get("Accounts Payable"), rev = -get("Sales Revenue"), exp = tb.filter(r => r.acc.startsWith("Expense")).reduce((s, r) => s + r.bal, 0);
  const profit = rev - inv - exp; const equity = opening + profit;
  const printTb = () => openPrintable("Trial Balance", `<table><tr><th>Account</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr>${tb.map(r => `<tr><td>${r.acc}</td><td class="r">${fmt(r.dr)}</td><td class="r">${fmt(r.cr)}</td><td class="r">${fmt(r.bal)}</td></tr>`).join("")}</table>`);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Toolbar>{[["journal", "Journal"], ["tb", "Trial Balance"], ["bs", "Balance Sheet"], ["coa", "Chart of Accounts"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${view === k ? G.dark : G.border}`, background: view === k ? G.dark : G.bg, color: view === k ? G.white : G.ink, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}<div style={{ flex: 1 }} /><Btn sm v="secondary" onClick={printTb}>🖨 Print TB</Btn><Btn sm v="secondary" onClick={() => ctx.exportCsv("journal.csv", journal, [["date", "Date"], ["ref", "Ref"], ["desc", "Description"], ["dr", "Debit Account"], ["cr", "Credit Account"], ["amount", "Amount"]])}>⬇ Export Journal</Btn></Toolbar>
      {view === "journal" && <Card title={`Journal (auto-posted from ${journal.length} documents)`}><TblWrap compact heads={["Date", "Ref", "Description", "Debit", "Credit", "Amount"]} rows={journal.slice(0, 150).map(e => [<span style={{ fontSize: 10, color: G.muted }}>{e.date}</span>, <b style={{ fontSize: 11, color: G.dark }}>{e.ref}</b>, <span style={{ fontSize: 11 }}>{e.desc}</span>, <span style={{ fontSize: 10, fontWeight: 600, color: G.mid }}>{e.dr}</span>, <span style={{ fontSize: 10, fontWeight: 600, color: G.purple }}>{e.cr}</span>, <b style={{ fontSize: 11 }}>{fmt(e.amount)}</b>])} /></Card>}
      {view === "tb" && <Card title="Trial Balance"><TblWrap compact heads={["Account", "Debit", "Credit", "Balance"]} rows={[...tb.map(r => [<b style={{ fontSize: 11 }}>{r.acc}</b>, <span style={{ fontSize: 11 }}>{fmt(r.dr)}</span>, <span style={{ fontSize: 11 }}>{fmt(r.cr)}</span>, <b style={{ fontSize: 11, color: r.bal >= 0 ? G.dark : G.red }}>{r.bal < 0 ? `(${fmt(-r.bal)})` : fmt(r.bal)}</b>]), [<b>TOTAL</b>, <b>{fmt(tb.reduce((s, r) => s + r.dr, 0))}</b>, <b>{fmt(tb.reduce((s, r) => s + r.cr, 0))}</b>, <b style={{ color: G.mid }}>Balanced ✓</b>]]} /></Card>}
      {view === "bs" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Assets" color={G.mid}><div style={{ padding: 14, fontSize: 12 }}>{[["Cash & Bank", cash], ["Accounts Receivable", ar], ["Inventory (at cost of purchases)", inv]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${G.pale}` }}><span>{l}</span><b>{fmt(v)}</b></div>)}<div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 800 }}><span>Total Assets</span><span>{fmt(cash + ar + inv)}</span></div></div></Card>
        <Card title="Liabilities & Equity" color={G.purple}><div style={{ padding: 14, fontSize: 12 }}>{[["Accounts Payable", ap], ["Opening Capital", opening], ["Retained Earnings (period profit)", profit]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${G.pale}` }}><span>{l}</span><b style={{ color: v < 0 ? G.red : G.ink }}>{v < 0 ? `(${fmt(-v)})` : fmt(v)}</b></div>)}<div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 800 }}><span>Total L + E</span><span>{fmt(ap + equity)}</span></div><div style={{ fontSize: 10, color: G.muted, marginTop: 6 }}>Simplified statement for demo purposes: inventory is carried at purchase cost, no depreciation or tax provisions.</div></div></Card>
      </div>}
      {view === "coa" && <Card title="Chart of Accounts"><TblWrap compact heads={["Code", "Account", "Type", "Normal Balance"]} rows={[["1000", "Cash & Bank", "Asset", "Debit"], ["1100", "Accounts Receivable", "Asset", "Debit"], ["1200", "Inventory", "Asset", "Debit"], ["1300", "Advances & Prepayments", "Asset", "Debit"], ["1500", "Fixed Assets", "Asset", "Debit"], ["2000", "Accounts Payable", "Liability", "Credit"], ["2100", "Sales Tax Payable", "Liability", "Credit"], ["2200", "Accrued Salaries", "Liability", "Credit"], ["2500", "Bank Loan", "Liability", "Credit"], ["3000", "Owner's Capital", "Equity", "Credit"], ["3100", "Retained Earnings", "Equity", "Credit"], ["4000", "Sales Revenue", "Income", "Credit"], ["4100", "Other Income", "Income", "Credit"], ["5000", "Cost of Goods Sold", "Expense", "Debit"], ...(ctx.vertical.expenseCats || []).map((c, i) => [`6${String(i).padStart(3, "0")}`, `Expense — ${c}`, "Expense", "Debit"])].map(r => [<b style={{ fontSize: 11, color: G.dark }}>{r[0]}</b>, <span style={{ fontSize: 11 }}>{r[1]}</span>, <Pill text={r[2]} />, <span style={{ fontSize: 10, color: G.muted }}>{r[3]}</span>])} /></Card>}
    </div>
  );
};

// ── Sales tax (output vs input) ──
export const TaxPage = ({ ctx }) => {
  const rate = CONFIG.taxRate; const months = lastMonths(6);
  const rows = months.map(k => { const sales = ctx.invoices.filter(i => i.status !== "VOIDED" && monthKey(i.date) === k).reduce((s, i) => s + Number(i.total), 0); const pur = ctx.purchases.filter(p => monthKey(p.date) === k).reduce((s, p) => s + Number(p.total), 0); const out = Math.round(sales * rate / (100 + rate)), inp = Math.round(pur * rate / (100 + rate)); return { k, sales, pur, out, inp, net: out - inp }; });
  const t = rows.reduce((a, r) => ({ sales: a.sales + r.sales, out: a.out + r.out, inp: a.inp + r.inp, net: a.net + r.net }), { sales: 0, out: 0, inp: 0, net: 0 });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: G.sky, borderRadius: 9, padding: "10px 14px", fontSize: 12, color: G.blue, fontWeight: 600 }}>Sales tax rate {rate}% (change it under Settings). Figures assume prices are tax-inclusive. STRN: {CONFIG.company.strn}</div>
      <Grid cols={4} mb={0}><Stat l="Taxable Sales (6 mo)" v={fmt(t.sales)} /><Stat l="Output Tax" v={fmt(t.out)} c={G.red} /><Stat l="Input Tax (on purchases)" v={fmt(t.inp)} c={G.mid} /><Stat l="Net Payable" v={fmt(t.net)} c={G.amber} /></Grid>
      <Card title="Monthly Sales Tax Summary" right={<Btn sm v="secondary" onClick={() => ctx.exportCsv("sales_tax.csv", rows, [["k", "Month"], ["sales", "Sales"], ["out", "Output Tax"], ["pur", "Purchases"], ["inp", "Input Tax"], ["net", "Net Payable"]])}>⬇ Export</Btn>}>
        <TblWrap compact heads={["Month", "Sales", "Output Tax", "Purchases", "Input Tax", "Net Payable", "Filing"]} rows={rows.map((r, i) => [<b style={{ fontSize: 11 }}>{monthLabel(r.k)}</b>, <span style={{ fontSize: 11 }}>{fmt(r.sales)}</span>, <span style={{ fontSize: 11, color: G.red }}>{fmt(r.out)}</span>, <span style={{ fontSize: 11 }}>{fmt(r.pur)}</span>, <span style={{ fontSize: 11, color: G.mid }}>{fmt(r.inp)}</span>, <b style={{ fontSize: 11 }}>{fmt(r.net)}</b>, i < months.length - 1 ? <Pill text="Filed" color={G.mid} bg={G.pale} /> : <Pill text="Due 18th" color={G.amber} bg="#FFF4E5" />])} />
      </Card>
      <Card title="Withholding & Other Taxes (reference)" color={G.muted}><div style={{ padding: 14, fontSize: 11, color: G.muted, lineHeight: 1.7 }}>Income tax withheld on supplier payments, advance tax at import stage and provincial services tax are tracked as expenses in this demo. A production deployment maps these to dedicated liability accounts in the Chart of Accounts.</div></Card>
    </div>
  );
};

// ── Alerts / notification centre ──
export const AlertsPage = ({ ctx }) => {
  const [cheques] = useTable("cheques", [ctx.dataVersion]);
  const today = todayStr();
  const alerts = [];
  ctx.unpaidInv.filter(i => (ageDaysOf(i) || 0) > 45).forEach(i => alerts.push({ sev: "high", t: `Invoice ${i.id} is ${ageDaysOf(i)} days overdue`, d: `${i.custName} · ${fmt(i.total)}`, tab: "invoices" }));
  ctx.unpaidInv.filter(i => { const a = ageDaysOf(i) || 0; return a > 30 && a <= 45; }).forEach(i => alerts.push({ sev: "med", t: `Invoice ${i.id} overdue (${ageDaysOf(i)}d)`, d: `${i.custName} · ${fmt(i.total)}`, tab: "invoices" }));
  ctx.lowStock.forEach(p => alerts.push({ sev: p.stock === 0 ? "high" : "med", t: p.stock === 0 ? `Out of stock: ${p.pname}` : `Low stock: ${p.pname} (${p.stock} left, min ${p.minStock})`, d: "Reorder from vendor", tab: "inventory" }));
  cheques.filter(c => c.status === "Bounced").forEach(c => alerts.push({ sev: "high", t: `Cheque ${c.number} bounced`, d: `${c.party_name} · ${fmt(c.amount)}`, tab: "cheques" }));
  cheques.filter(c => c.status === "Pending" && c.due_date <= today).forEach(c => alerts.push({ sev: "med", t: `Cheque ${c.number} due for deposit`, d: `${c.party_name} · ${fmt(c.amount)} · due ${c.due_date}`, tab: "cheques" }));
  ctx.ap.filter(r => r.balance > 200000).forEach(r => alerts.push({ sev: "low", t: `Large payable to ${r.vendorName}`, d: fmt(r.balance), tab: "arap" }));
  ctx.customers.filter(c => c.credit_limit && (ctx.ar.find(r => r.custId === c.id)?.balance || 0) > c.credit_limit).forEach(c => alerts.push({ sev: "med", t: `${c.name} over credit limit`, d: `Limit ${fmt(c.credit_limit)} · owes ${fmt(ctx.ar.find(r => r.custId === c.id)?.balance)}`, tab: "customers" }));
  const sevC = { high: [G.red, G.pink], med: [G.amber, "#FFF4E5"], low: [G.blue, G.sky] };
  const order = { high: 0, med: 1, low: 2 };
  alerts.sort((a, b) => order[a.sev] - order[b.sev]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Grid cols={3} mb={0}><Stat l="Critical" v={alerts.filter(a => a.sev === "high").length} c={G.red} /><Stat l="Warnings" v={alerts.filter(a => a.sev === "med").length} c={G.amber} /><Stat l="Info" v={alerts.filter(a => a.sev === "low").length} c={G.blue} /></Grid>
      <Card title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Bell size={14} /> Notification Centre</span>}>
        {alerts.length === 0 && <div style={{ padding: 24, color: G.mid, fontWeight: 700, textAlign: "center" }}>🎉 No alerts — everything looks healthy</div>}
        {alerts.map((a, i) => <div key={i} onClick={() => ctx.setTab(a.tab)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${G.pale}`, cursor: "pointer" }}><div style={{ width: 30, height: 30, borderRadius: 8, background: sevC[a.sev][1], color: sevC[a.sev][0], display: "flex", alignItems: "center", justifyContent: "center" }}><AlertTriangle size={15} /></div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, color: G.ink }}>{a.t}</div><div style={{ fontSize: 10, color: G.muted }}>{a.d}</div></div><span style={{ fontSize: 10, color: G.muted }}>Open →</span></div>)}
      </Card>
    </div>
  );
};

// ── Users & roles ──
export const UsersPage = ({ ctx }) => {
  const [users, reload] = useTable("users", [ctx.dataVersion]);
  const [modal, setModal] = useState(false); const [f, setF] = useState({ name: "", email: "", role: "Sales Executive" });
  const ROLES = [["Owner / Admin", "Full access · settings · users · all modules"], ["Accounts Manager", "Invoices, payments, bank, ledger, reports"], ["Sales Executive", "Customers, invoices, quotes · no purchase prices"], ["Store Keeper", "Inventory, purchases, returns"], ["Viewer (Auditor)", "Read-only across reports"]];
  const PERMS = ["Dashboard", "Customers", "Invoices", "Payments", "Purchases", "Inventory", "Bank", "Ledger", "Reports", "Settings"];
  const allowed = (role, p) => role.startsWith("Owner") ? true : role.startsWith("Accounts") ? !["Settings"].includes(p) : role.startsWith("Sales") ? ["Dashboard", "Customers", "Invoices", "Payments", "Reports"].includes(p) : role.startsWith("Store") ? ["Dashboard", "Inventory", "Purchases"].includes(p) : ["Dashboard", "Reports"].includes(p);
  const save = async () => { if (!f.name || !f.email.includes("@")) return ctx.notify("Enter name and a valid email", "err"); await sbPost("upsert", { table: "users", prefix: "U", label: "User", row: { ...f, status: "Invited", last_login: "", modules: "per role" } }); ctx.notify("✅ Invitation sent (demo)"); setModal(false); reload(); };
  const toggle = async u => { await sbPost("upsert", { table: "users", label: "User", row: { ...u, status: u.status === "Active" ? "Disabled" : "Active" } }); reload(); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Toolbar><div style={{ flex: 1 }} /><Btn sm onClick={() => setModal(true)}>+ Invite User</Btn></Toolbar>
      <Card title="Team Members"><TblWrap compact heads={["Name", "Email", "Role", "Status", "Last Login", "Action"]} rows={users.map(u => [<b style={{ fontSize: 11 }}>{u.name}</b>, <span style={{ fontSize: 10, color: G.muted }}>{u.email}</span>, <Pill text={u.role} />, <Pill text={u.status} color={u.status === "Active" ? G.mid : G.amber} bg={u.status === "Active" ? G.pale : "#FFF4E5"} />, <span style={{ fontSize: 10, color: G.muted }}>{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</span>, <Btn sm v={u.status === "Active" ? "danger" : "success"} onClick={() => toggle(u)}>{u.status === "Active" ? "Disable" : "Enable"}</Btn>])} /></Card>
      <Card title="Role Permission Matrix" color={G.blue}><TblWrap compact heads={["Role", ...PERMS]} rows={ROLES.map(([r, d]) => [<div><b style={{ fontSize: 11 }}>{r}</b><div style={{ fontSize: 9, color: G.muted }}>{d}</div></div>, ...PERMS.map(p => <span style={{ fontSize: 13, color: allowed(r, p) ? G.mid : "#ccc" }}>{allowed(r, p) ? "✓" : "—"}</span>)])} /></Card>
      {modal && <Modal title="👤 Invite User" onClose={() => setModal(false)}><div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Inp label="Full Name" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} /><Inp label="Email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} /><Sel label="Role" value={f.role} onChange={e => setF(p => ({ ...p, role: e.target.value }))}>{ROLES.map(([r]) => <option key={r}>{r}</option>)}</Sel><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn v="secondary" onClick={() => setModal(false)}>Cancel</Btn><Btn onClick={save}>Send Invite</Btn></div></div></Modal>}
    </div>
  );
};

// ── Audit log ──
export const AuditPage = ({ ctx }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => { sbPost("audit_log").then(setRows); }, [ctx.dataVersion]);
  const [q, setQ] = useState("");
  const fil = rows.filter(r => !q || `${r.user} ${r.action} ${r.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <Toolbar><Search value={q} onChange={setQ} placeholder="Search activity…" /><Btn sm v="secondary" onClick={() => sbPost("audit_log").then(setRows)}>↻ Refresh</Btn><Btn sm v="secondary" onClick={() => ctx.exportCsv("audit_log.csv", fil, [["at", "Time"], ["user", "User"], ["action", "Action"], ["detail", "Detail"]])}>⬇ Export</Btn></Toolbar>
      <Card title={`Activity Log (${rows.length} events this session)`}>
        <TblWrap compact heads={["Time", "User", "Action", "Detail"]} rows={fil.map(r => [<span style={{ fontSize: 10, color: G.muted }}>{new Date(r.at).toLocaleString()}</span>, <span style={{ fontSize: 10, fontWeight: 600 }}>{r.user}</span>, <Pill text={r.action} />, <span style={{ fontSize: 11 }}>{r.detail}</span>])} />
      </Card>
    </div>
  );
};

// ── Settings ──
export const SettingsPage = ({ ctx }) => {
  const [c, setC] = useState({ ...CONFIG.company });
  const [cur, setCur] = useState(CONFIG.currency); const [tax, setTax] = useState(CONFIG.taxRate);
  const save = () => { setCompany(c); setConfig({ currency: cur, taxRate: Number(tax) || 0 }); ctx.bump(); ctx.notify("✅ Settings saved for this session"); };
  const F = (k, label, ph) => <Inp label={label} value={c[k] || ""} placeholder={ph} onChange={e => setC(p => ({ ...p, [k]: e.target.value }))} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>
      <Card title="Company Profile (shown on invoices, PDFs and reports)"><div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{F("name", "Company Name")}{F("tagline", "Tagline")}{F("address", "Address")}{F("phone", "Phone")}{F("email", "Email")}{F("ntn", "NTN")}{F("strn", "Sales Tax Reg. No.")}</div></Card>
      <Card title="Finance Preferences" color={G.blue}><div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Sel label="Currency" value={cur} onChange={e => setCur(e.target.value)}>{["PKR", "USD", "AED", "SAR", "GBP", "EUR"].map(x => <option key={x}>{x}</option>)}</Sel>
        <Inp label="Sales Tax Rate (%)" type="number" value={tax} onChange={e => setTax(e.target.value)} />
        <Inp label="Invoice Prefix" value={CONFIG.invoicePrefix} readOnly /><Inp label="Fiscal Year Start" value="1 July" readOnly />
      </div></Card>
      <Card title="Demo Data" color={G.amber}><div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div style={{ fontSize: 12, color: G.muted }}>All data in this demo is fictional and lives in your browser session. Nothing is sent to a server.</div><div style={{ display: "flex", gap: 8 }}><Btn v="secondary" onClick={ctx.resetDemo}>↺ Reset demo data</Btn><Btn onClick={save}>💾 Save Settings</Btn></div></div></Card>
      <Card title="Integrations (available in production)" color={G.muted}><div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>{["WhatsApp invoice & reminders", "Google Sheets export", "FBR e-invoicing", "Bank statement import (CSV)", "Barcode scanner / label printer", "Rider mobile app", "Shopify / Daraz orders", "Email notifications"].map(x => <div key={x} style={{ background: G.pale, borderRadius: 8, padding: "9px 11px", fontSize: 11, fontWeight: 600, color: G.dark }}>🔌 {x}</div>)}</div></Card>
    </div>
  );
};

export const SHARED_PAGES = { bank: BankPage, cheques: ChequesPage, cashflow: CashFlowPage, ledger: LedgerPage, tax: TaxPage, alerts: AlertsPage, users: UsersPage, audit: AuditPage, settings: SettingsPage };
