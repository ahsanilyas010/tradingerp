// Motion & ease-of-use building blocks for the ERP shell: animated numbers, command palette (Ctrl+K),
// quick-create menu, collapsible nav groups, welcome banner, trend chart, confetti.
// Honours prefers-reduced-motion.
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import { Search, Plus, Bell, ChevronDown, Command, X, Sparkles, FileText, CreditCard, Receipt, UserPlus, ShoppingCart } from "lucide-react";

export const celebrate = () => {
  if (typeof window === "undefined" || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin: { y: 0.7 }, colors: ["#22D3EE", "#6366F1", "#F472B6", "#FACC15", "#4ADE80"], disableForReducedMotion: true });
};

// Animates the numeric part of a formatted string ("PKR 9,256,580" → counts up) keeping prefix/suffix.
export const CountUp = ({ value, duration = 900 }) => {
  const reduce = useReducedMotion();
  const str = String(value ?? "");
  const m = str.match(/-?[\d,]+(\.\d+)?/);
  const target = m ? Number(m[0].replace(/,/g, "")) : NaN;
  const [n, setN] = useState(isNaN(target) ? null : 0);
  const prev = useRef(0);
  useEffect(() => {
    if (isNaN(target)) return;
    if (reduce) { setN(target); prev.current = target; return; }
    const from = prev.current, start = performance.now(); let raf;
    const step = t => { const p = Math.min(1, (t - start) / duration); const e = 1 - Math.pow(1 - p, 3); setN(from + (target - from) * e); if (p < 1) raf = requestAnimationFrame(step); else prev.current = target; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, reduce, duration]);
  if (isNaN(target) || n === null) return <>{str}</>;
  const decimals = m[1] ? m[1].length - 1 : 0;
  const out = Number(n).toLocaleString("en-PK", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <>{str.slice(0, m.index)}{out}{str.slice(m.index + m[0].length)}</>;
};

export const PageTransition = ({ id, children }) => {
  const reduce = useReducedMotion();
  return <motion.div key={id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
};

export const NavGroup = ({ section, tab, G, NAV_ICONS, onPick }) => {
  const [open, setOpen] = useState(true);
  const hasActive = section.items.some(n => n.id === tab);
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 8px 4px", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
        <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>{section.group}</span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }} style={{ display: "inline-flex" }}><ChevronDown size={11} /></motion.span>
      </button>
      <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
        {section.items.map(n => { const active = tab === n.id; const ic = NAV_ICONS[n.id]; return (
          <motion.button key={n.id} whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }} onClick={() => onPick(n.id)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 9px", borderRadius: 8, border: "none", cursor: "pointer", background: active ? "rgba(255,255,255,0.14)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.62)", fontWeight: active ? 700 : 500, fontSize: 12, width: "100%", textAlign: "left", transition: "background .15s" }}>
            {active && <motion.span layoutId="td-nav-active" style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 3, background: G.accent, boxShadow: `0 0 10px ${G.accent}` }} />}
            <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>{ic && <ic.Icon size={15} color={active ? G.accent : ic.color} style={{ flexShrink: 0 }} />}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span></span>
            {n.badge && <span style={{ background: typeof n.badge === "number" && n.badge > 10 ? G.blue : G.red, color: "#fff", borderRadius: 9, padding: "1px 6px", fontSize: 8, fontWeight: 800, flexShrink: 0 }}>{n.badge}</span>}
          </motion.button>); })}
      </motion.div>}</AnimatePresence>
    </div>
  );
};

// Ctrl+K command palette: navigate anywhere, open any customer / invoice / product, run quick actions.
export const CommandPalette = ({ open, onClose, G, navItems, customers, invoices, products, actions, onNav, onCustomer, onInvoice }) => {
  const [q, setQ] = useState(""); const [idx, setIdx] = useState(0); const inp = useRef(null);
  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inp.current?.focus(), 30); } }, [open]);
  const items = useMemo(() => {
    const s = q.trim().toLowerCase(); const out = [];
    const push = (type, label, sub, run, color) => out.push({ type, label, sub, run, color });
    (actions || []).filter(a => !s || a.label.toLowerCase().includes(s)).forEach(a => push("Action", a.label, "Quick action", a.run, "#F59E0B"));
    navItems.filter(n => !s || n.label.toLowerCase().includes(s)).slice(0, s ? 8 : 6).forEach(n => push("Go to", n.label, n.group, () => onNav(n.id), G.blue));
    if (s) {
      customers.filter(c => `${c.name} ${c.area || ""} ${c.id}`.toLowerCase().includes(s)).slice(0, 6).forEach(c => push("Customer", c.name, `${c.id} · ${c.area || ""}`, () => onCustomer(c), G.mid));
      invoices.filter(i => `${i.id} ${i.custName || ""}`.toLowerCase().includes(s)).slice(0, 6).forEach(i => push("Invoice", i.id, `${i.custName} · ${i.status}`, () => onInvoice(i), G.purple));
      products.filter(p => p.name.toLowerCase().includes(s)).slice(0, 5).forEach(p => push("Product", p.name, `${p.category} · stock ${p.currentStock}`, () => onNav("inventory"), G.amber));
    }
    return out.slice(0, 24);
  }, [q, navItems, customers, invoices, products, actions]); // eslint-disable-line
  useEffect(() => { setIdx(0); }, [q]);
  if (!open) return null;
  const key = e => { if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); } else if (e.key === "Enter") { const it = items[idx]; if (it) { it.run(); onClose(); } } else if (e.key === "Escape") onClose(); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.55)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 12px 0" }}>
      <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }} onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: "#fff", borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${G.border}` }}><Search size={18} color={G.muted} /><input ref={inp} value={q} onChange={e => setQ(e.target.value)} onKeyDown={key} placeholder="Search customers, invoices, products or type a page name…" style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: G.ink, background: "transparent" }} /><kbd style={{ fontSize: 10, color: G.muted, background: G.pale, borderRadius: 6, padding: "3px 7px", fontWeight: 700 }}>ESC</kbd></div>
        <div style={{ maxHeight: 400, overflowY: "auto", padding: 6 }}>
          {items.length === 0 && <div style={{ padding: 24, textAlign: "center", color: G.muted, fontSize: 13 }}>No matches</div>}
          {items.map((it, i) => <div key={i} onMouseEnter={() => setIdx(i)} onClick={() => { it.run(); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10, cursor: "pointer", background: i === idx ? G.pale : "transparent" }}><span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", background: it.color, borderRadius: 6, padding: "3px 7px", minWidth: 62, textAlign: "center" }}>{it.type}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: G.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div><div style={{ fontSize: 10, color: G.muted }}>{it.sub}</div></div>{i === idx && <span style={{ fontSize: 10, color: G.muted }}>↵</span>}</div>)}
        </div>
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${G.border}`, fontSize: 10, color: G.muted, display: "flex", gap: 14 }}><span>↑↓ navigate</span><span>↵ open</span><span>Ctrl/⌘ + K anywhere</span></div>
      </motion.div>
    </div>
  );
};

export const TopSearch = ({ G, onOpen, isMobile }) => (
  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 8, background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 10, padding: isMobile ? "7px 9px" : "7px 12px", cursor: "pointer", color: G.muted, fontSize: 12, minWidth: isMobile ? 0 : 230 }}>
    <Search size={14} /> {!isMobile && <span style={{ flex: 1, textAlign: "left" }}>Search anything…</span>}{!isMobile && <kbd style={{ fontSize: 9, fontWeight: 800, background: "#fff", border: `1px solid ${G.border}`, borderRadius: 5, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 2 }}><Command size={9} />K</kbd>}
  </motion.button>
);

export const QuickNew = ({ G, actions, isMobile }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setOpen(o => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${G.dark},${G.accent})`, border: "none", color: "#fff", borderRadius: 10, padding: isMobile ? "8px 10px" : "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `0 6px 18px ${G.dark}55` }}><Plus size={15} />{!isMobile && "New"}<ChevronDown size={12} /></motion.button>
      <AnimatePresence>{open && <>
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1500 }} />
        <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }} style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", borderRadius: 12, boxShadow: "0 16px 48px rgba(15,23,42,0.22)", border: `1px solid ${G.border}`, padding: 6, zIndex: 1600, minWidth: 210 }}>
          {actions.map(a => <button key={a.label} onClick={() => { setOpen(false); a.run(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", padding: "9px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: G.ink, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = G.pale} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><span style={{ width: 28, height: 28, borderRadius: 8, background: `${a.color || G.dark}1A`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><a.icon size={15} color={a.color || G.dark} /></span>{a.label}</button>)}
        </motion.div>
      </>}</AnimatePresence>
    </div>
  );
};

export const BellButton = ({ G, count, onClick, isMobile }) => (
  <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }} onClick={onClick} title="Alerts" style={{ position: "relative", background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 10, width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.ink }}>
    <Bell size={16} />{count > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ position: "absolute", top: -5, right: -5, background: G.red, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 10, padding: "1px 5px", minWidth: 16, textAlign: "center", boxShadow: "0 0 0 2px #fff" }}>{count > 99 ? "99+" : count}</motion.span>}
  </motion.button>
);

export const QUICK_ICONS = { invoice: FileText, payment: CreditCard, expense: Receipt, customer: UserPlus, purchase: ShoppingCart };

export const WelcomeBanner = ({ G, vertical, onDismiss, onTry }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ position: "relative", overflow: "hidden", borderRadius: 14, padding: "16px 18px", background: `linear-gradient(120deg,${G.dark},${G.sidebar2 || G.dark} 60%,${G.accent})`, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", boxShadow: `0 12px 30px ${G.dark}40` }}>
      <div className="td-shine" />
      <div style={{ position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", opacity: 0.85 }}><Sparkles size={12} /> {vertical.label.toUpperCase()} EDITION · DEMO</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>Welcome to {vertical.company.name}</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>Everything is interactive. Try creating an invoice, collecting a payment or opening <b>Alerts</b>. Press <b>Ctrl + K</b> to search anything.</div>
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={onTry} style={{ background: "#fff", color: G.dark, border: "none", borderRadius: 9, padding: "9px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>✨ Create a sample invoice</motion.button>
        <button onClick={onDismiss} aria-label="Dismiss" style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", borderRadius: 9, width: 34, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
      </div>
    </motion.div>
  );
};

// Animated grouped bar chart (invoiced vs collected by month)
export const TrendChart = ({ G, months, series, fmt }) => {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const label = k => { const [y, m] = k.split("-"); return new Date(+y, +m - 1, 1).toLocaleString("en", { month: "short" }); };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, padding: "0 4px" }}>
        {months.map((k, i) => <div key={k} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 4, height: "100%" }}>
          {series.map((s, j) => <motion.div key={s.label} title={`${s.label} ${label(k)}: ${fmt(s.values[i])}`} initial={reduce ? false : { height: 0 }} animate={{ height: `${Math.max(2, s.values[i] / max * 100)}%` }} transition={{ duration: 0.7, delay: i * 0.06 + j * 0.05, ease: [0.22, 1, 0.36, 1] }} style={{ flex: 1, background: s.color, borderRadius: "6px 6px 2px 2px", opacity: 0.92 }} />)}
        </div>)}
      </div>
      <div style={{ display: "flex", gap: 12, padding: "6px 4px 0" }}>{months.map(k => <div key={k} style={{ flex: 1, textAlign: "center", fontSize: 10, color: G.muted, fontWeight: 700 }}>{label(k)}</div>)}</div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>{series.map(s => <span key={s.label} style={{ fontSize: 11, color: G.muted, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: s.color, borderRadius: 3, display: "inline-block" }} />{s.label}</span>)}</div>
    </div>
  );
};
