// Marketing landing page + business-type picker. Motion via motion/react; honours prefers-reduced-motion.
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useInView } from "motion/react";
import { ArrowRight, CheckCircle2, XCircle, Boxes, ShieldCheck, Sparkles, Zap, Smartphone, FileText, Banknote, BarChart3, Users, Clock, Globe, MessageCircle, ChevronDown, Star, TrendingUp, Lock, Rocket } from "lucide-react";
import { VERTICAL_LIST } from "./verticals/index.js";
import { THEMES } from "./lib/theme.js";

// ── Edit these two lines to route the "Book a demo" buttons to your own contact details ──
export const CONTACT = { whatsapp: "923000000000", email: "hello@tradedesk.demo" };
const waLink = msg => `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`;

const FEATURES = {
  distribution: ["Invoices, payments & AR aging", "Rider Hub: orders, routes, live locations", "Store assignment, areas & commission", "Returns, inventory & P&L"],
  importer: ["Shipments & container tracking", "Landed cost: duty, freight, clearing", "Letters of credit & multi-currency", "Overseas suppliers & customs docs"],
  retail: ["Touch POS terminal with receipts", "Shifts, cash drawer & daily close", "Barcode products & multi-branch stock", "Loyalty members & branch reports"],
  wholesale: ["Quotations → sales orders → invoices", "Credit limits & buyer ledgers", "Price lists & bulk pricing", "Godown stock & dispatch challans"],
  services: ["Clients, projects & jobs", "Timesheets & time billing", "Retainers & recurring invoices", "Staff utilisation & profitability"],
  manufacturing: ["Bills of material (BOM)", "Production orders & work centres", "Raw material planning (MRP)", "Yield, scrap & unit cost"],
};

const PAINS = [
  { icon: FileText, t: "Invoices in Excel, payments in a diary", d: "Nobody knows today's real receivable. Month-end means three days of reconciliation." },
  { icon: Clock, t: "Riders and salesmen call for stock", d: "Orders are taken on WhatsApp, re-typed at the office and sometimes lost on the way." },
  { icon: Banknote, t: "Cash and cheques are a mystery", d: "Post-dated cheques sit in a drawer; bounced ones are discovered weeks later." },
  { icon: BarChart3, t: "Profit is a guess until the accountant visits", d: "You find out which products and customers lose money long after the fact." },
];

const COMPARE = {
  cols: ["Spreadsheets & WhatsApp", "Desktop accounting software", "Big-brand ERP", "TradeDesk ERP"],
  rows: [
    ["Built for distributors, importers, retailers & traders", "no", "partial", "partial", "yes"],
    ["Riders, routes & live locations", "no", "no", "add-on", "yes"],
    ["Landed cost, LCs & multi-currency", "no", "no", "yes", "yes"],
    ["Touch POS with shifts & cash drawer", "no", "partial", "add-on", "yes"],
    ["Cheque register, cash-flow forecast, alerts", "no", "partial", "yes", "yes"],
    ["Works on phone, tablet & desktop", "partial", "no", "partial", "yes"],
    ["Setup time", "—", "Weeks", "6–12 months", "Days"],
    ["Needs an IT team", "no", "partial", "yes", "no"],
    ["Cost", "Free, costs you errors", "PKR 30k–150k + yearly", "PKR millions", "Affordable monthly plan"],
  ],
};

const FAQ = [
  ["Is my data safe?", "In production every business gets its own secure database with daily backups, role-based access and a full audit log of who changed what. This demo runs entirely in your browser with fictional data."],
  ["Can my team use it on phones?", "Yes. The whole system is responsive, and riders or salesmen get a dedicated mobile app for orders, deliveries and collections."],
  ["Do I have to migrate from my current system?", "We import your customers, products, opening balances and open invoices from Excel or your existing software. Most businesses are live within a week."],
  ["Does it handle Pakistani tax and payments?", "Sales tax (18%), withholding, NTN/STRN on invoices, cheques and post-dated cheques, JazzCash, EasyPaisa and bank transfers are all first-class."],
  ["What if I run more than one kind of business?", "Editions share one finance core, so a distributor that also imports can run both modules on the same customers, stock and ledger."],
];

const Section = ({ children, style, id }) => <section id={id} style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 16px", ...style }}>{children}</section>;
const Reveal = ({ children, delay = 0, y = 24, style }) => {
  const reduce = useReducedMotion(); const ref = useRef(null); const inView = useInView(ref, { once: true, margin: "-60px" });
  return <motion.div ref={ref} initial={reduce ? false : { opacity: 0, y }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }} style={style}>{children}</motion.div>;
};
const Counter = ({ to, suffix = "", prefix = "" }) => {
  const [v, setV] = useState(0); const ref = useRef(null); const inView = useInView(ref, { once: true }); const reduce = useReducedMotion();
  useEffect(() => { if (!inView) return; if (reduce) { setV(to); return; } let s; const d = 1400; const step = t => { if (!s) s = t; const p = Math.min(1, (t - s) / d); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, [inView, to, reduce]);
  return <span ref={ref}>{prefix}{v.toLocaleString()}{suffix}</span>;
};
const Mark = ({ v }) => v === "yes" ? <span style={{ color: "#4ADE80", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700 }}><CheckCircle2 size={16} /> Yes</span> : v === "no" ? <span style={{ color: "#F87171", display: "inline-flex", alignItems: "center", gap: 5 }}><XCircle size={16} /> No</span> : v === "partial" ? <span style={{ color: "#FBBF24", fontWeight: 600 }}>Partial</span> : v === "add-on" ? <span style={{ color: "#FBBF24", fontWeight: 600 }}>Paid add-on</span> : <span style={{ opacity: 0.85 }}>{v}</span>;

const WORDS = ["distributors", "importers", "retailers", "wholesalers", "agencies", "manufacturers"];

export default function Landing({ onPick }) {
  const reduce = useReducedMotion();
  const [word, setWord] = useState(0); const [faq, setFaq] = useState(0); const [hover, setHover] = useState(null);
  useEffect(() => { const t = setInterval(() => setWord(w => (w + 1) % WORDS.length), 2200); return () => clearInterval(t); }, []);
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  const float = i => reduce ? {} : { animate: { y: [0, -18, 0], x: [0, i % 2 ? 12 : -12, 0] }, transition: { duration: 9 + i * 2, repeat: Infinity, ease: "easeInOut" } };
  return (
    <div style={{ background: "#07111F", color: "#fff", fontFamily: "'DM Sans',system-ui,sans-serif", overflowX: "hidden" }}>
      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(14px)", background: "rgba(7,17,31,0.72)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <motion.div whileHover={{ rotate: 8, scale: 1.05 }} style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#22D3EE,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(99,102,241,0.45)" }}><Boxes size={20} color="#fff" /></motion.div>
            <div><div style={{ fontWeight: 800, fontSize: 17 }}>TradeDesk ERP</div><div style={{ fontSize: 9, opacity: 0.6, letterSpacing: "0.14em", fontWeight: 700 }}>BUSINESS MANAGEMENT SYSTEM</div></div>
          </div>
          <div className="td-landing-nav" style={{ display: "flex", gap: 22, fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
            {[["Why TradeDesk", "why"], ["Compare", "compare"], ["Editions", "editions"], ["How it works", "how"], ["FAQ", "faq"]].map(([l, id]) => <button key={id} onClick={() => go(id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: 0.85, padding: 0 }}>{l}</button>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => go("editions")} style={{ background: "linear-gradient(135deg,#22D3EE,#6366F1)", border: "none", color: "#fff", fontWeight: 800, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: "pointer", boxShadow: "0 8px 24px rgba(34,211,238,0.35)" }}>Try the live demo</motion.button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div className="td-aurora" />
        {[["#22D3EE", "8%", "12%", 320], ["#6366F1", "70%", "6%", 420], ["#F472B6", "55%", "62%", 280], ["#84CC16", "12%", "70%", 220]].map(([c, l, t, s], i) => <motion.div key={i} {...float(i)} style={{ position: "absolute", left: l, top: t, width: s, height: s, borderRadius: "50%", background: c, filter: "blur(90px)", opacity: 0.28, pointerEvents: "none" }} />)}
        <Section style={{ position: "relative", padding: "76px 16px 56px", textAlign: "center" }}>
          <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 30, padding: "7px 14px", fontSize: 12, fontWeight: 700, marginBottom: 22 }}>
            <Sparkles size={14} color="#FACC15" /> Interactive demo · no sign-up · sample data loaded
          </motion.div>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} style={{ fontSize: "clamp(34px,5.6vw,64px)", fontWeight: 800, lineHeight: 1.05, margin: "0 auto 18px", maxWidth: 900, letterSpacing: "-0.02em" }}>
            Run your whole trading business from one screen, built for{" "}
            <span style={{ display: "inline-block", minWidth: "6.5ch", textAlign: "left" }}>
              <AnimatePresence mode="wait">
                <motion.span key={WORDS[word]} initial={reduce ? false : { opacity: 0, y: 14, rotateX: -40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={reduce ? {} : { opacity: 0, y: -14, rotateX: 40 }} transition={{ duration: 0.35 }} style={{ display: "inline-block", background: "linear-gradient(90deg,#22D3EE,#A78BFA,#F472B6)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{WORDS[word]}</motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>
          <motion.p initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} style={{ fontSize: 17, opacity: 0.8, maxWidth: 680, margin: "0 auto 28px", lineHeight: 1.65 }}>
            Invoices, receivables, purchasing, stock, cash, cheques, riders and reports in one place. Stop stitching Excel, WhatsApp and a diary together: see today's real numbers in seconds.
          </motion.p>
          <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => go("editions")} style={{ background: "linear-gradient(135deg,#22D3EE,#6366F1)", border: "none", color: "#fff", fontWeight: 800, fontSize: 15, padding: "14px 24px", borderRadius: 12, cursor: "pointer", boxShadow: "0 12px 36px rgba(99,102,241,0.45)", display: "inline-flex", alignItems: "center", gap: 8 }}><Rocket size={18} /> Open the demo</motion.button>
            <motion.a whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} href={waLink("Hi, I would like a TradeDesk ERP demo for my business.")} target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px 22px", borderRadius: 12, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}><MessageCircle size={18} color="#4ADE80" /> Book a free walkthrough</motion.a>
          </motion.div>
          <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, maxWidth: 820, margin: "44px auto 0" }}>
            {[[6, "", "business editions"], [40, "+", "modules & reports"], [3, " days", "typical go-live"], [100, "%", "runs on your phone"]].map(([n, s, l], i) => <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 10px" }}><div style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg,#22D3EE,#A78BFA)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}><Counter to={n} suffix={s} /></div><div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>{l}</div></div>)}
          </motion.div>
        </Section>
        {/* marquee */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", padding: "12px 0", background: "rgba(255,255,255,0.03)" }}>
          <div className="td-marquee">{[...Array(2)].map((_, k) => <div key={k} style={{ display: "flex", gap: 36, paddingRight: 36, whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, opacity: 0.7 }}>{["Invoices & PDF", "AR aging", "Rider Hub", "POS terminal", "Landed cost", "Letters of credit", "Cheque register", "Cash-flow forecast", "General ledger", "Sales tax 18%", "Quotations", "Credit control", "Timesheets", "Bills of material", "Production orders", "Alerts", "Users & roles", "Audit log"].map(t => <span key={t}>✦ {t}</span>)}</div>)}</div>
        </div>
      </div>

      {/* WHY */}
      <Section id="why">
        <Reveal><div style={{ textAlign: "center", marginBottom: 36 }}><div style={{ color: "#22D3EE", fontWeight: 800, fontSize: 12, letterSpacing: "0.16em" }}>WHY BUSINESSES SWITCH</div><h2 style={{ fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 800, margin: "8px 0 10px", letterSpacing: "-0.02em" }}>The problems you live with today</h2><p style={{ opacity: 0.7, maxWidth: 620, margin: "0 auto", fontSize: 15 }}>Every one of these costs you money every month. TradeDesk removes them on day one.</p></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
          {PAINS.map((p, i) => <Reveal key={p.t} delay={i * 0.08}><motion.div whileHover={reduce ? {} : { y: -6 }} style={{ background: "linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 22, height: "100%" }}><div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(248,113,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><p.icon size={22} color="#F87171" /></div><div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{p.t}</div><div style={{ fontSize: 13, opacity: 0.72, lineHeight: 1.6 }}>{p.d}</div></motion.div></Reveal>)}
        </div>
        <Reveal delay={0.1}><div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
          {[[TrendingUp, "See real profit daily", "P&L, AR/AP and cash position update the moment an invoice or payment is entered."], [Smartphone, "Riders & sales on mobile", "Orders, deliveries and collections flow in from the field, with live locations."], [Lock, "Control who sees what", "Roles, approvals, credit holds and a complete audit trail of every change."], [Zap, "Live in days, not months", "Pre-built for your trade. Import your Excel, train the team in an afternoon."]].map(([I, t, d], i) => <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 16, padding: 18 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(74,222,128,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I size={19} color="#4ADE80" /></div><div><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{t}</div><div style={{ fontSize: 12.5, opacity: 0.72, lineHeight: 1.55 }}>{d}</div></div></div>)}
        </div></Reveal>
      </Section>

      {/* COMPARE */}
      <Section id="compare" style={{ paddingTop: 20 }}>
        <Reveal><div style={{ textAlign: "center", marginBottom: 28 }}><div style={{ color: "#A78BFA", fontWeight: 800, fontSize: 12, letterSpacing: "0.16em" }}>HONEST COMPARISON</div><h2 style={{ fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 800, margin: "8px 0 10px", letterSpacing: "-0.02em" }}>How TradeDesk compares with what you can buy today</h2></div></Reveal>
        <Reveal delay={0.1}><div style={{ overflowX: "auto", borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 13 }}>
            <thead><tr>{["", ...COMPARE.cols].map((c, i) => <th key={i} style={{ textAlign: i ? "center" : "left", padding: "16px 14px", fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", background: i === 4 ? "linear-gradient(135deg,rgba(34,211,238,0.25),rgba(99,102,241,0.25))" : "transparent", color: i === 4 ? "#fff" : "rgba(255,255,255,0.75)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>{i === 4 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Star size={14} color="#FACC15" fill="#FACC15" />{c}</span> : c}</th>)}</tr></thead>
            <tbody>{COMPARE.rows.map((r, ri) => <tr key={ri} style={{ background: ri % 2 ? "rgba(255,255,255,0.02)" : "transparent" }}>{r.map((c, ci) => <td key={ci} style={{ padding: "13px 14px", textAlign: ci ? "center" : "left", fontWeight: ci ? 500 : 700, background: ci === 4 ? "rgba(99,102,241,0.12)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{ci ? <Mark v={c} /> : c}</td>)}</tr>)}</tbody>
          </table>
        </div></Reveal>
      </Section>

      {/* EDITIONS */}
      <Section id="editions" style={{ paddingTop: 20 }}>
        <Reveal><div style={{ textAlign: "center", marginBottom: 30 }}><div style={{ color: "#4ADE80", fontWeight: 800, fontSize: 12, letterSpacing: "0.16em" }}>TRY IT NOW</div><h2 style={{ fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 800, margin: "8px 0 10px", letterSpacing: "-0.02em" }}>Choose your business type to open the demo</h2><p style={{ opacity: 0.7, maxWidth: 620, margin: "0 auto", fontSize: 15 }}>Each edition opens with a fictional company, months of sample transactions and every module live. Nothing to install.</p></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          {VERTICAL_LIST.map((v, i) => { const Icon = v.LogoIcon; const on = hover === v.key; const th = THEMES[v.key]; return (
            <Reveal key={v.key} delay={i * 0.06}><motion.button whileHover={reduce ? {} : { y: -8, scale: 1.015 }} whileTap={{ scale: 0.985 }} onMouseEnter={() => setHover(v.key)} onMouseLeave={() => setHover(null)} onClick={() => onPick(v.key)}
              style={{ textAlign: "left", width: "100%", height: "100%", background: on ? `linear-gradient(160deg,${th.dark}55,rgba(255,255,255,0.05))` : "rgba(255,255,255,0.05)", border: `1.5px solid ${on ? th.accent : "rgba(255,255,255,0.12)"}`, borderRadius: 20, padding: 22, color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12, boxShadow: on ? `0 24px 60px ${th.dark}66` : "none", transition: "background .25s, border-color .25s, box-shadow .25s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <motion.div animate={on && !reduce ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }} transition={{ duration: 0.5 }} style={{ width: 50, height: 50, borderRadius: 14, background: `linear-gradient(135deg,${th.dark},${th.accent})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 8px 20px ${th.dark}80` }}><Icon size={26} color="#fff" /></motion.div>
                <div><div style={{ fontWeight: 800, fontSize: 17 }}>{v.title}</div><div style={{ fontSize: 11, opacity: 0.6 }}>Demo company: {v.company.name}</div></div>
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.55 }}>{v.blurb}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>{FEATURES[v.key].map(f => <li key={f} style={{ fontSize: 12, opacity: 0.88, display: "flex", gap: 7, alignItems: "flex-start" }}><CheckCircle2 size={14} color={th.accent} style={{ flexShrink: 0, marginTop: 2 }} />{f}</li>)}</ul>
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 800, color: th.accent }}><span>Open {v.label} demo</span><motion.span animate={on && !reduce ? { x: [0, 6, 0] } : { x: 0 }} transition={{ repeat: on ? Infinity : 0, duration: 1 }}><ArrowRight size={18} /></motion.span></div>
            </motion.button></Reveal>); })}
        </div>
      </Section>

      {/* HOW */}
      <Section id="how" style={{ paddingTop: 20 }}>
        <Reveal><div style={{ textAlign: "center", marginBottom: 30 }}><div style={{ color: "#FACC15", fontWeight: 800, fontSize: 12, letterSpacing: "0.16em" }}>HOW IT WORKS</div><h2 style={{ fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 800, margin: "8px 0 10px", letterSpacing: "-0.02em" }}>From first call to live in three steps</h2></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {[["1", "Walkthrough", "A 30-minute call where we map how your business runs today: products, customers, riders, cheques, taxes.", Users], ["2", "Import & configure", "We load your Excel sheets and opening balances, set roles, invoice design and tax settings.", Globe], ["3", "Go live & train", "Your team is trained in an afternoon. We stay on WhatsApp for the first month.", ShieldCheck]].map(([n, t, d, I], i) => <Reveal key={n} delay={i * 0.1}><div style={{ position: "relative", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "26px 22px 22px", height: "100%" }}><div style={{ position: "absolute", top: -16, left: 20, width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#FACC15,#F97316)", color: "#000", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(250,204,21,0.35)" }}>{n}</div><I size={22} color="#FACC15" style={{ marginBottom: 10 }} /><div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{t}</div><div style={{ fontSize: 13, opacity: 0.72, lineHeight: 1.6 }}>{d}</div></div></Reveal>)}
        </div>
        <Reveal delay={0.15}><div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>{["PKR & multi-currency", "Sales tax 18% · NTN / STRN", "Cheques & post-dated cheques", "JazzCash · EasyPaisa · bank", "WhatsApp invoices & reminders", "Urdu-ready interface", "Works offline on the rider app", "Daily backups"].map(t => <span key={t} style={{ fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "8px 14px" }}>🇵🇰 {t}</span>)}</div></Reveal>
      </Section>

      {/* FAQ */}
      <Section id="faq" style={{ paddingTop: 20, maxWidth: 860 }}>
        <Reveal><div style={{ textAlign: "center", marginBottom: 24 }}><div style={{ color: "#F472B6", fontWeight: 800, fontSize: 12, letterSpacing: "0.16em" }}>QUESTIONS</div><h2 style={{ fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 800, margin: "8px 0 10px", letterSpacing: "-0.02em" }}>Frequently asked</h2></div></Reveal>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQ.map(([q, a], i) => <Reveal key={q} delay={i * 0.04}><div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}><button onClick={() => setFaq(faq === i ? -1 : i)} style={{ width: "100%", background: "none", border: "none", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>{q}<motion.span animate={{ rotate: faq === i ? 180 : 0 }}><ChevronDown size={18} /></motion.span></button><AnimatePresence initial={false}>{faq === i && <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? {} : { height: 0, opacity: 0 }} transition={{ duration: 0.28 }} style={{ overflow: "hidden" }}><div style={{ padding: "0 18px 16px", fontSize: 13.5, opacity: 0.75, lineHeight: 1.65 }}>{a}</div></motion.div>}</AnimatePresence></div></Reveal>)}
        </div>
      </Section>

      {/* CTA */}
      <Section style={{ paddingTop: 10 }}>
        <Reveal><div style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "48px 24px", textAlign: "center", background: "linear-gradient(135deg,#0E7490 0%,#4338CA 50%,#BE185D 100%)" }}>
          <div className="td-shine" />
          <h2 style={{ fontSize: "clamp(24px,3.4vw,38px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", position: "relative" }}>Ready to see your own numbers in TradeDesk?</h2>
          <p style={{ opacity: 0.85, margin: "0 auto 22px", maxWidth: 560, fontSize: 15, position: "relative" }}>Open the demo for your business type, or book a free walkthrough and we will show it with your products and customers.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => go("editions")} style={{ background: "#fff", color: "#1E1B4B", border: "none", fontWeight: 800, fontSize: 15, padding: "14px 24px", borderRadius: 12, cursor: "pointer" }}>Open the demo</motion.button>
            <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} href={waLink("Hi, I would like a TradeDesk ERP walkthrough.")} target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", fontWeight: 800, fontSize: 15, padding: "14px 22px", borderRadius: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}><MessageCircle size={18} /> WhatsApp us</motion.a>
          </div>
        </div></Reveal>
        <div style={{ textAlign: "center", fontSize: 11, opacity: 0.5, marginTop: 28, lineHeight: 1.7 }}>TradeDesk ERP · {CONTACT.email} · All demo data is fictional and resets when you reload the page.</div>
      </Section>
    </div>
  );
}
