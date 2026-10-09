import { useState, useEffect } from "react";
import CrmApp from "./apt/AptCrm.jsx";
import { getVertical, VERTICAL_LIST } from "./verticals/index.js";
import { initDb, setCurrentUser } from "./data/mockApi.js";
import { setCompany, setConfig } from "./lib/config.js";
import { ArrowRight, CheckCircle2, Boxes, ShieldCheck, Sparkles } from "lucide-react";

const DEMO_USER = { email: "admin@tradedesk.demo", displayName: "Demo Admin" };

const FEATURES = {
  distribution: ["Invoices, payments & AR aging", "Rider Hub: orders, routes, live locations", "Store assignment, areas & commission", "Returns, inventory & P&L"],
  importer: ["Shipments & container tracking", "Landed cost calculator (duty, freight, clearing)", "Letters of credit & multi-currency", "Overseas suppliers & customs documents"],
  retail: ["Touch POS terminal with receipts", "Shifts, cash drawer & daily close", "Barcode products & multi-branch stock", "Loyalty members & branch reports"],
  wholesale: ["Quotations → sales orders → invoices", "Credit limits & buyer ledgers", "Price lists & bulk pricing", "Godown stock & dispatch"],
  services: ["Clients, projects & jobs", "Timesheets & time billing", "Retainers & recurring invoices", "Staff utilisation & profitability"],
  manufacturing: ["Bills of material (BOM)", "Production orders & work centres", "Raw material vs finished goods", "Yield, scrap & unit cost"],
};

function Landing({ onPick }) {
  const [hover, setHover] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0A2630 0%,#0F3B4C 55%,#14555F 100%)", color: "#fff", fontFamily: "'DM Sans',system-ui,sans-serif", padding: "0 16px 48px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#2BB3A5,#4FD1C5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Boxes size={20} color="#fff" /></div>
            <div><div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "0.02em" }}>TradeDesk ERP</div><div style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.12em", fontWeight: 700 }}>BUSINESS MANAGEMENT SYSTEM</div></div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, opacity: 0.75, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><ShieldCheck size={13} /> No sign-up needed</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Sparkles size={13} /> Pre-loaded sample data</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={13} /> Fully interactive</span>
          </div>
        </header>
        <section style={{ textAlign: "center", padding: "26px 0 30px" }}>
          <h1 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 800, margin: "0 0 10px", lineHeight: 1.15 }}>One ERP for every trading business</h1>
          <p style={{ fontSize: 15, opacity: 0.78, maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>Invoicing, receivables, purchasing, inventory, cash, ledger and reporting in one place, tailored to how your business actually runs. Choose your business type to open the demo.</p>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          {VERTICAL_LIST.map(v => {
            const Icon = v.LogoIcon; const on = hover === v.key;
            return (
              <button key={v.key} onMouseEnter={() => setHover(v.key)} onMouseLeave={() => setHover(null)} onClick={() => onPick(v.key)}
                style={{ textAlign: "left", background: on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", border: `1.5px solid ${on ? v.accent : "rgba(255,255,255,0.12)"}`, borderRadius: 16, padding: 20, color: "#fff", cursor: "pointer", transition: "all .18s ease", transform: on ? "translateY(-3px)" : "none", boxShadow: on ? `0 16px 40px rgba(0,0,0,0.35)` : "none", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: v.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={24} color="#fff" /></div>
                  <div><div style={{ fontWeight: 800, fontSize: 16 }}>{v.title}</div><div style={{ fontSize: 11, opacity: 0.6 }}>Demo company: {v.company.name}</div></div>
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.8, lineHeight: 1.5 }}>{v.blurb}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  {FEATURES[v.key].map(f => <li key={f} style={{ fontSize: 11.5, opacity: 0.85, display: "flex", gap: 7, alignItems: "flex-start" }}><CheckCircle2 size={13} color={v.accent} style={{ flexShrink: 0, marginTop: 2 }} />{f}</li>)}
                </ul>
                <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 700, color: v.accent }}><span>Open {v.label} demo</span><ArrowRight size={16} /></div>
              </button>
            );
          })}
        </div>
        <footer style={{ marginTop: 36, textAlign: "center", fontSize: 11, opacity: 0.55, lineHeight: 1.7 }}>
          Every edition shares the same finance core: customers & vendors, invoices, payments, purchases, expenses, inventory, returns, P&amp;L, AR/AP, bank & cash, cheques, cash-flow forecast, general ledger, sales tax, alerts, users & roles and audit log.<br />All data is fictional sample data and resets when you reload the page.
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [vkey, setVkey] = useState(() => { const h = (typeof window !== "undefined" && window.location.hash.replace("#", "")) || ""; return VERTICAL_LIST.some(v => v.key === h) ? h : null; });
  const [vertical, setVertical] = useState(null);
  useEffect(() => {
    if (!vkey) { setVertical(null); if (window.location.hash) history.replaceState(null, "", window.location.pathname); return; }
    const v = getVertical(vkey);
    initDb(vkey); setCompany(v.company); setConfig({ currency: "PKR", vertical: vkey }); setCurrentUser(DEMO_USER);
    window.location.hash = vkey;
    setVertical(v);
  }, [vkey]);
  if (!vkey || !vertical) return <Landing onPick={setVkey} />;
  return <CrmApp key={vkey} user={DEMO_USER} vertical={vertical} onLogout={() => setVkey(null)} />;
}
