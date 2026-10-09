// ============================================================
//  TradeDesk ERP — core module (ported from APT CRM v3.1)
//  Backend calls go to the in-memory mock API; no network, no env vars.
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import {
  LayoutDashboard, Users, FileText, CreditCard, ShoppingCart, Truck, Receipt,
  TrendingUp, Scale, Package, BarChart3, ClipboardList, Store, Bike, MapPin,
  Boxes, Link2, Map as MapIcon, FileBarChart, Settings, Menu, RefreshCw,
  Banknote, Undo2, ArrowLeftRight, Landmark, BookOpen, Percent, ShieldCheck, History, Bell,
  Ship, Globe, Container, FileSignature, Coins, Monitor, Clock, Building2, Gift, Tags, PackageCheck,
  FolderKanban, Timer, Repeat, Layers, Hammer, Cog, Sliders, Quote, Receipt as ReceiptIcon,
} from "lucide-react";
import { sbPost, initDb } from "../data/mockApi.js";
import { invoicePost } from "../lib/invoiceDoc.js";
import { CONFIG, fmt } from "../lib/config.js";
import { motion } from "motion/react";
import { CountUp, PageTransition, NavGroup, CommandPalette, TopSearch, QuickNew, BellButton, QUICK_ICONS, WelcomeBanner, TrendChart, celebrate } from "../ui/motion.jsx";

const KNOWN_DUPLICATE_GROUPS = [];

const RIDER_HUB_TABS = new Set(["rider-orders","rider-stores","riders","locations","rider-products","store-assign","areas","rider-reports","rider-config","rider-commission"]);

// ── Brand Colors ──────────────────────────────────────────────
export const G = {
  dark:"#0F3B4C", mid:"#0E7C7B", light:"#2BB3A5", pale:"#E6F4F3",
  accent:"#4FD1C5", gold:"#F59E0B", amber:"#E07B00", red:"#C62828",
  pink:"#FDECEA", blue:"#1565C0", sky:"#E3F2FD", purple:"#6A1B9A",
  ink:"#0F2430", muted:"#5B7A80", white:"#FFFFFF", bg:"#F3F8F8",
  card:"#FFFFFF", border:"#CFE5E3", sidebar:"#0A2630",
};

// Colorful icon + accent per nav item (keyed by tab id).
export const NAV_ICONS = {
  settings:      { Icon: Settings,        color: "#607D8B" },
  users:         { Icon: ShieldCheck,     color: "#1565C0" },
  audit:         { Icon: History,         color: "#6A1B9A" },
  alerts:        { Icon: Bell,            color: "#E07B00" },
  bank:          { Icon: Landmark,        color: "#0E7C7B" },
  ledger:        { Icon: BookOpen,        color: "#3949AB" },
  cheques:       { Icon: FileSignature,   color: "#00897B" },
  tax:           { Icon: Percent,         color: "#C62828" },
  cashflow:      { Icon: ArrowLeftRight,  color: "#2BB3A5" },
  shipments:     { Icon: Ship,            color: "#1565C0" },
  suppliers:     { Icon: Globe,           color: "#00897B" },
  landedcost:    { Icon: Container,       color: "#E07B00" },
  lcs:           { Icon: FileSignature,   color: "#6A1B9A" },
  currencies:    { Icon: Coins,           color: "#F59E0B" },
  pos:           { Icon: Monitor,         color: "#E65100" },
  "pos-sales":   { Icon: ReceiptIcon,     color: "#0E7C7B" },
  shifts:        { Icon: Clock,           color: "#1565C0" },
  branches:      { Icon: Building2,       color: "#6A1B9A" },
  loyalty:       { Icon: Gift,            color: "#D81B60" },
  barcodes:      { Icon: Tags,            color: "#607D8B" },
  quotes:        { Icon: Quote,           color: "#1565C0" },
  "sales-orders":{ Icon: PackageCheck,    color: "#0E7C7B" },
  "price-lists": { Icon: Tags,            color: "#E07B00" },
  credit:        { Icon: ShieldCheck,     color: "#C62828" },
  projects:      { Icon: FolderKanban,    color: "#1565C0" },
  timesheets:    { Icon: Timer,           color: "#0E7C7B" },
  retainers:     { Icon: Repeat,          color: "#6A1B9A" },
  staff:         { Icon: Users,           color: "#E07B00" },
  boms:          { Icon: Layers,          color: "#1565C0" },
  production:    { Icon: Hammer,          color: "#C62828" },
  "raw-materials":{ Icon: Boxes,          color: "#E07B00" },
  "work-centers":{ Icon: Cog,             color: "#607D8B" },
  dashboard:     { Icon: LayoutDashboard, color: "#4CAF50" },
  customers:     { Icon: Users,           color: "#1565C0" },
  invoices:      { Icon: FileText,        color: "#00897B" },
  payments:      { Icon: CreditCard,      color: "#43A047" },
  purchases:     { Icon: ShoppingCart,    color: "#6A1B9A" },
  vendors:       { Icon: Truck,           color: "#5E35B1" },
  expenses:      { Icon: Receipt,         color: "#C62828" },
  pnl:           { Icon: TrendingUp,      color: "#2E7D32" },
  arap:          { Icon: Scale,           color: "#F9A825" },
  inventory:     { Icon: Package,         color: "#FB8C00" },
  reports:       { Icon: BarChart3,       color: "#3949AB" },
  "rider-orders":   { Icon: ClipboardList, color: "#E53935" },
  "rider-stores":   { Icon: Store,         color: "#00897B" },
  riders:           { Icon: Bike,          color: "#1E88E5" },
  locations:        { Icon: MapPin,        color: "#D81B60" },
  "rider-products": { Icon: Boxes,         color: "#FB8C00" },
  "store-assign":   { Icon: Link2,         color: "#8E24AA" },
  areas:            { Icon: MapIcon,       color: "#00ACC1" },
  "rider-reports":  { Icon: FileBarChart,  color: "#3949AB" },
  "rider-config":   { Icon: Settings,      color: "#607D8B" },
  "rider-commission":{ Icon: Banknote,     color: "#2E7D32" },
  "returns":         { Icon: Undo2,        color: "#C62828" },
};

// Responsive helper — true on phone-width viewports.
export function useIsMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", on);
    on();
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

export const pct  = (a, b) => b ? ((a / b) * 100).toFixed(1) + "%" : "—";
export const todayStr = () => new Date().toISOString().split("T")[0];
// Invoice aging: days outstanding since invoice date. Prefers the GAS-computed
// ageDays field but falls back to computing locally from the date string.
export const ageDaysOf = inv => {
  if (inv && inv.ageDays != null) return inv.ageDays;
  if (!inv || !inv.date) return null;
  const d = new Date(String(inv.date).substring(0, 10));
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
};
export const ageColor = a => a == null ? G.muted : a > 45 ? G.red : a > 30 ? G.amber : a > 15 ? G.blue : G.light;
// Normalizers for fuzzy matching store/customer/product names across systems.
export const normTxt = s => (s || "").toString().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const digitsOnly = s => (s || "").toString().replace(/\D+/g, "");
// A finite, non-negative number (for amount/qty/price fields submitted as strings).
export const validNum = v => Number.isFinite(+v) && +v >= 0;

// ── Primitive components ──────────────────────────────────────
export const Badge = ({ text }) => {
  const m = {
    Paid:{bg:"#E8F5E9",c:G.mid}, Partial:{bg:"#FFF8E1",c:G.amber},
    Unpaid:{bg:G.pink,c:G.red}, VOIDED:{bg:"#F5F5F5",c:"#9E9E9E"},
    Active:{bg:"#E8F5E9",c:G.mid}, Received:{bg:"#E8F5E9",c:G.mid},
    Made:{bg:G.pink,c:G.red}, Overdue:{bg:G.pink,c:G.red},
  };
  const s = m[text]||{bg:G.pale,c:G.dark};
  return <span style={{background:s.bg,color:s.c,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{text}</span>;
};

export const Inp = ({label,style:st,...p}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...st}}>
    {label&&<label style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</label>}
    <input style={{border:`1.5px solid ${G.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:G.ink,background:G.bg,outline:"none",width:"100%",boxSizing:"border-box"}} {...p}/>
  </div>
);
export const Sel = ({label,children,style:st,...p}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...st}}>
    {label&&<label style={{fontSize:10,fontWeight:700,color:G.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</label>}
    <select style={{border:`1.5px solid ${G.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:G.ink,background:G.bg,outline:"none",width:"100%",boxSizing:"border-box"}} {...p}>{children}</select>
  </div>
);
export const Btn = ({children,v="primary",onClick,sm,disabled,full}) => {
  const vs={primary:{bg:G.dark,c:G.white,br:"none"},secondary:{bg:G.pale,c:G.dark,br:`1.5px solid ${G.mid}`},danger:{bg:G.pink,c:G.red,br:`1.5px solid ${G.red}`},success:{bg:G.mid,c:G.white,br:"none"},ghost:{bg:"transparent",c:G.muted,br:`1.5px solid ${G.border}`},amber:{bg:"#FFF8E1",c:G.amber,br:`1.5px solid ${G.amber}`}};
  const s=vs[v]||vs.primary;
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,color:s.c,border:s.br,borderRadius:8,padding:sm?"5px 11px":"9px 18px",fontSize:sm?11:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap",opacity:disabled?0.6:1,width:full?"100%":"auto",justifyContent:full?"center":"flex-start"}}>{children}</button>;
};
export const Kpi = ({label,value,sub,color,trend,icon:Ico}) => (
  <div className="td-card" style={{background:G.card,borderRadius:12,padding:"14px 16px",boxShadow:"0 2px 12px rgba(15,23,42,0.07)",borderLeft:`3px solid ${color||G.mid}`,display:"flex",flexDirection:"column",gap:5}}>
    <span style={{display:"flex",alignItems:"center",gap:6,fontSize:9,fontWeight:700,color:G.muted,letterSpacing:"0.09em",textTransform:"uppercase"}}>
      {Ico&&<span style={{display:"inline-flex",width:22,height:22,borderRadius:6,background:`${color||G.mid}1A`,alignItems:"center",justifyContent:"center"}}><Ico size={13} color={color||G.mid}/></span>}
      {label}
    </span>
    <div style={{fontSize:20,fontWeight:800,color:G.ink,letterSpacing:"-0.03em"}}><CountUp value={value}/></div>
    {sub&&<div style={{fontSize:10,color:trend==="up"?G.mid:trend==="dn"?G.red:G.muted}}>{trend==="up"?"↑ ":trend==="dn"?"↓ ":""}{sub}</div>}
  </div>
);
export const Modal = ({title,onClose,children,wide}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
    <div style={{background:G.white,borderRadius:14,width:"100%",maxWidth:wide?720:480,maxHeight:"92vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.35)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",background:G.dark,borderRadius:"14px 14px 0 0"}}>
        <h3 style={{margin:0,color:G.white,fontSize:15,fontWeight:700}}>{title}</h3>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:7,cursor:"pointer",padding:"4px 9px",color:G.white,fontSize:15}}>✕</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>
);
export const TblWrap = ({heads,rows,compact}) => (
  <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:compact?11:12}}>
      <thead><tr style={{background:G.dark}}>{heads.map(h=><th key={h} style={{padding:compact?"7px 11px":"9px 13px",textAlign:"left",fontWeight:700,color:G.white,fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r,i)=><tr key={i} style={{background:i%2===0?G.bg:G.card,borderBottom:`1px solid ${G.pale}`}}>{r.map((c,j)=><td key={j} style={{padding:compact?"6px 11px":"8px 13px",verticalAlign:"middle"}}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

// ── PDF Download Button ───────────────────────────────────────
export const PdfBtn = ({ invId, pdfUrl, onGenerate, sm }) => {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(pdfUrl || "");

  const handle = async () => {
    if (url) { window.open(url, "_blank"); return; }
    setLoading(true);
    try {
      const result = await invoicePost(invId);
      setUrl(result.url);
      window.open(result.url, "_blank");
      if (onGenerate) onGenerate(result.url);
    } catch(e) {
      alert("PDF error: " + e.message);
    } finally { setLoading(false); }
  };

  return (
    <button onClick={handle} disabled={loading} style={{
      background: url ? "#E3F2FD" : G.pale,
      color: url ? G.blue : G.dark,
      border: `1.5px solid ${url ? G.blue : G.mid}`,
      borderRadius: 8,
      padding: sm ? "4px 10px" : "8px 14px",
      fontSize: sm ? 11 : 12,
      fontWeight: 700,
      cursor: loading ? "wait" : "pointer",
      display: "inline-flex", alignItems: "center", gap: 5,
      whiteSpace: "nowrap",
    }}>
      {loading ? "⏳" : url ? "📄" : "🖨"} {loading ? "Generating..." : url ? "Download PDF" : "Generate PDF"}
    </button>
  );
};

// ── Invoice Line Items (fetched on demand) ───────────────────
export const InvoiceItems = ({ invId }) => {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    setItems(null); setErr("");
    sbPost("invoice_items", { invoice_id: invId })
      .then(d => { if (on) setItems(Array.isArray(d) ? d.map(it => ({ pid: it.product_id, pname: it.product_name, qty: it.qty, rate: it.rate, total: it.total })) : []); })
      .catch(e => { if (on) setErr(e.message); });
    return () => { on = false; };
  }, [invId]);

  if (err) return <div style={{fontSize:11,color:G.red,padding:"8px 2px"}}>❌ Could not load items: {err}</div>;
  if (items === null) return <div style={{fontSize:11,color:G.muted,padding:"8px 2px"}}>⏳ Loading line items…</div>;
  if (!items.length) return <div style={{fontSize:11,color:G.muted,padding:"8px 2px"}}>No line items found for this invoice.</div>;

  const total = items.reduce((s,it)=>s+(it.total || it.qty*it.rate || 0),0);
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontWeight:700,color:G.dark,fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Line Items</div>
      <TblWrap compact heads={["Product","Qty","Rate","Amount"]}
        rows={items.map(it=>[
          <span style={{fontWeight:600,fontSize:11}}>{it.pname || it.pid}</span>,
          <span style={{fontSize:11}}>{it.qty}</span>,
          <span style={{fontSize:11}}>{fmt(it.rate)}</span>,
          <span style={{fontWeight:700,fontSize:11}}>{fmt(it.total || it.qty*it.rate)}</span>,
        ])}
      />
      <div style={{textAlign:"right",fontWeight:800,fontSize:12,color:G.ink,padding:"8px 4px 0"}}>Items Total: {fmt(total)}</div>
    </div>
  );
};

// ── Auth screens ──────────────────────────────────────────────
// Toast + undo snackbars keep their own state so their timers never re-render CrmApp
// (a shell re-render would remount the inline modal forms and wipe what the user typed).
export const ToastHost = forwardRef(function ToastHost(_, ref) {
  const [toast, setToast] = useState(null);
  const t = useRef(null);
  useImperativeHandle(ref, () => ({ show: (msg, type="ok") => { setToast({msg,type}); clearTimeout(t.current); t.current = setTimeout(()=>setToast(null), 3500); } }), []);
  if (!toast) return null;
  return <div style={{position:"fixed",top:62,right:18,background:toast.type==="err"?G.red:G.mid,color:G.white,padding:"10px 16px",borderRadius:9,fontWeight:700,fontSize:12,zIndex:9999,boxShadow:"0 8px 28px rgba(0,0,0,0.22)"}}>{toast.msg}</div>;
});
export const UndoHost = forwardRef(function UndoHost({ notify }, ref) {
  const [stack, setStack] = useState([]);
  useImperativeHandle(ref, () => ({ push: (label, run, ttl=8000) => { const id = Math.random().toString(36).slice(2); setStack(s => [...s, {id, label, run}]); setTimeout(() => setStack(s => s.filter(e => e.id !== id)), ttl); } }), []);
  const perform = async (id) => { const entry = stack.find(e => e.id === id); if (!entry) return; setStack(s => s.filter(e => e.id !== id)); try { await entry.run(); notify(`↩️ Undone: ${entry.label}`); } catch(e) { notify("❌ Undo failed: "+e.message, "err"); } };
  if (!stack.length) return null;
  return (
    <div style={{position:"fixed",bottom:18,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:8,zIndex:9999}}>
      {stack.map(entry=>(
        <div key={entry.id} style={{background:G.dark,color:G.white,padding:"9px 10px 9px 16px",borderRadius:9,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:14,boxShadow:"0 8px 28px rgba(0,0,0,0.28)",minWidth:260}}>
          <span style={{flex:1}}>{entry.label}</span>
          <button onClick={()=>perform(entry.id)} style={{background:"rgba(255,255,255,0.16)",border:"none",borderRadius:7,padding:"6px 14px",fontSize:11,fontWeight:800,color:G.white,cursor:"pointer"}}>↩ Undo</button>
        </div>
      ))}
    </div>
  );
});

export const LoadingScreen = ({msg}) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16,background:G.bg,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
    <div style={{width:48,height:48,background:G.mid,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>🌿</div>
    <div style={{fontSize:14,color:G.muted,fontWeight:600}}>{msg||"Loading..."}</div>
    <div style={{width:180,height:3,background:G.pale,borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:"60%",background:G.mid,borderRadius:2,animation:"slide 1.4s ease-in-out infinite"}}/>
    </div>
    <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
  </div>
);

// ═══════════════════════════════════════════════════════════════
//  MAIN CRM
// ═══════════════════════════════════════════════════════════════
function CrmApp({ user, onLogout, vertical }) {
  const CW = vertical.customerWord || "Customer";
  const CWP = vertical.customerWordPlural || "Customers";
  const [tab, setTab]         = useState("dashboard");
  const [dataVersion, setDataVersion] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  useEffect(() => { const h = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(o => !o); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const isMobile              = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal]     = useState(null);
  const [search, setSearch]   = useState("");
  const [invSf, setInvSf]     = useState("All"); // Invoices status filter — lives here so it survives re-renders
  const [storeAssignRider, setStoreAssignRider] = useState(""); // Store Assign tab's selected rider — lives here so it survives the re-render triggered by loadSupabase() after each assignment
  const [areaAssignRider, setAreaAssignRider] = useState(""); // Areas tab's selected rider — same reason
  // Customers() is called as a plain function (see note above it), so it must have zero hooks of
  // its own — otherwise it registers new hooks on CrmApp the first render after the loading
  // screen's early return, which React rejects. Its local state lives here instead.
  const [custHideDupes, setCustHideDupes] = useState(true);
  const [custMerging, setCustMerging] = useState(false);
  const [custImportingSb, setCustImportingSb] = useState(false);
  const toastRef = useRef(null); const undoRef = useRef(null);
  const [lastSync, setLastSync] = useState(null);
  // PDF url cache: invId → url
  const [pdfCache, setPdfCache] = useState({});
  // ── Rider Hub (Supabase data) ──────────────────────────────
  const [sbData, setSbData] = useState({orders:[],stores:[],riders:[],locations:[],products:[],areas:[],assignments:[],riderAreas:[],riderPermissions:[],riderCollections:[]});
  const [sbLoading, setSbLoading] = useState(false);
  const [sbSyncing, setSbSyncing] = useState(false);

  const loadSupabase = useCallback(async (silent = false) => {
    if (!silent) setSbLoading(true);
    setSbSyncing(true);
    try {
      const [orders, stores, riders, locs, products, areas, assignments, riderAreas, riderPerms, riderCols] = await Promise.all([
        sbPost("orders"), sbPost("stores"), sbPost("riders"), sbPost("locations"),
        sbPost("products"), sbPost("areas"), sbPost("store_assignments"), sbPost("rider_areas"),
        sbPost("rider_permissions"), sbPost("rider_payment_collections"),
      ]);
      setSbData({ orders:orders||[], stores:stores||[], riders:riders||[], locations:locs||[], products:products||[], areas:areas||[], assignments:assignments||[], riderAreas:riderAreas||[], riderPermissions:riderPerms||[], riderCollections:riderCols||[] });
    } catch(e) { /* notify set in effect below — capture lazily */ console.error("Supabase load:", e); }
    finally { setSbLoading(false); setSbSyncing(false); }
  }, []);

  const notify = useCallback((msg, type="ok") => { toastRef.current?.show(msg, type); }, []);

  // ── Global undo stack ──────────────────────────────────────
  // pushUndo(label, run) registers a reversible action; `run` is called when
  // the user clicks "Undo" on the resulting snackbar before it expires.
  const pushUndo = useCallback((label, run, ttl=8000) => { undoRef.current?.push(label, run, ttl); }, []);

  const closeModal = () => setModal(null);
  // Modal forms are defined inline inside renderModal(), so they get a new component identity
  // on every shell render (which remounts them and wipes typed input). Cache each form
  // component for the lifetime of the open modal object instead.
  const formCache = useRef({}); const formModal = useRef(null);
  if (formModal.current !== modal) { formModal.current = modal; formCache.current = {}; }
  const stable = (key, factory) => (formCache.current[key] ||= factory());

  const loadData = useCallback(async (showSync=false) => {
    if (showSync) setSyncing(true); else setLoading(true);
    try {
      // All financial data loads from Supabase — fast, no GAS dependency
      const [sbCustomers, sbVendors, sbInvoices, sbPurchases, sbPayments, sbExpenses, sbProducts] = await Promise.all([
        sbPost("customers"),
        sbPost("vendors"),
        sbPost("invoices"),
        sbPost("purchases"),
        sbPost("payments"),
        sbPost("expenses"),
        sbPost("products"),
      ]);
      const vMap = Object.fromEntries((sbVendors || []).map(v => [v.id, v]));
      const normalizedPayments = (sbPayments || []).map(p => ({ ...p, partyId: p.party_id || p.partyId, refId: p.ref_id || p.refId }));
      const paysByRef = {};
      normalizedPayments.forEach(p => { if (p.refId && p.type === "Made") paysByRef[p.refId] = (paysByRef[p.refId] || 0) + Number(p.amount); });
      // Map Supabase products to CRM inventory format
      const sbProductList = sbProducts || [];
      const products = sbProductList.map(p => ({ id: p.id, name: p.name, category: p.category, tradePrice: Number(p.trade_price) || 0, currentStock: p.current_stock ?? 0 }));
      const inventory = sbProductList.map(p => ({ pid: p.id, pname: p.name, category: p.category, cost: Number(p.trade_price) || 0, stock: p.current_stock ?? 0, minStock: p.min_stock ?? 0, purchased: 0, sold: 0 }));
      setData(prev => ({
        ...prev,
        products,
        inventory,
        customers: (sbCustomers || []).map(c => ({ ...c, phone: c.mobile || c.phone, contact: c.owner_name || c.contact, openBal: c.open_bal ?? c.openBal ?? 0 })),
        vendors: (sbVendors || []).map(v => ({ ...v, openBal: v.open_bal ?? v.openBal ?? 0 })),
        invoices: (sbInvoices || []).map(i => ({ ...i, custId: i.cust_id || i.custId, custName: i.cust_name || i.custName, payTerms: i.pay_terms || i.payTerms, createdBy: i.created_by || i.createdBy, pdfUrl: i.pdf_url || i.pdfUrl || "" })),
        purchases: (sbPurchases || []).map(p => ({ ...p, vendorId: p.vendor_id || p.vendorId, vendor: vMap[p.vendor_id]?.name || p.vendor || p.vendor_id || '', paid: paysByRef[p.id] || 0 })),
        payments: normalizedPayments,
        expenses: sbExpenses || [],
      }));
      setLastSync(new Date());
      if (showSync) notify("✅ Synced");
    } catch(err) { notify("❌ "+err.message, "err"); }
    finally { setLoading(false); setSyncing(false); }
  }, [notify]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === "customers" || tab === "payments" || RIDER_HUB_TABS.has(tab)) loadSupabase(true); }, [tab, loadSupabase]);

  // ── Maps ──────────────────────────────────────────────────
  const customers  = data?.customers  || [];
  const vendors    = data?.vendors    || [];
  const products   = data?.products   || [];
  const invoices   = data?.invoices   || [];
  const purchases  = data?.purchases  || [];
  const payments   = data?.payments   || [];
  const expenses   = data?.expenses   || [];
  const inventory  = data?.inventory  || [];

  const custMap = useMemo(()=>Object.fromEntries(customers.map(c=>[c.id,c])),[customers]);
  const vendMap = useMemo(()=>Object.fromEntries(vendors.map(v=>[v.id,v])),[vendors]);
  const prodMap = useMemo(()=>Object.fromEntries(products.map(p=>[p.id,p])),[products]);

  // Dashboard stats computed from Supabase data
  const totalRevenue    = useMemo(()=>invoices.filter(i=>i.status!=="VOIDED").reduce((s,i)=>s+Number(i.total)||0,0),[invoices]);
  const totalReceived   = useMemo(()=>payments.filter(p=>p.type==="Received").reduce((s,p)=>s+Number(p.amount)||0,0),[payments]);
  const totalPurchases  = useMemo(()=>purchases.reduce((s,p)=>s+Number(p.total)||0,0),[purchases]);
  const totalExpenses   = useMemo(()=>expenses.reduce((s,e)=>s+Number(e.amount)||0,0),[expenses]);
  const netProfit       = totalRevenue - totalPurchases - totalExpenses;
  const totalAR         = useMemo(()=>invoices.filter(i=>i.status==="Unpaid"||i.status==="Partial").reduce((s,i)=>s+Number(i.total)||0,0),[invoices]);
  const grossProfit     = totalRevenue - totalPurchases;
  const gpMargin        = totalRevenue ? ((grossProfit/totalRevenue)*100).toFixed(1) : 0;
  const npMargin        = totalRevenue ? ((netProfit/totalRevenue)*100).toFixed(1)   : 0;
  const unpaidInv       = useMemo(()=>invoices.filter(i=>i.status==="Unpaid"||i.status==="Partial"),[invoices]);
  const lowStock        = useMemo(()=>inventory.filter(p=>p.stock<=p.minStock&&p.stock>=0),[inventory]);

  // AR/AP ledgers computed client-side from Supabase data
  const ar = useMemo(()=>{
    const byC={};
    customers.forEach(c=>{byC[c.id]={custId:c.id,custName:c.name,totalBilled:0,totalPaid:0,balance:0};});
    invoices.forEach(i=>{if(i.status==="VOIDED")return;const r=byC[i.custId];if(r)r.totalBilled+=Number(i.total)||0;});
    payments.filter(p=>p.type==="Received").forEach(p=>{const r=byC[p.partyId];if(r)r.totalPaid+=Number(p.amount)||0;});
    Object.values(byC).forEach(r=>{r.balance=r.totalBilled-r.totalPaid;});
    return Object.values(byC).filter(r=>r.totalBilled>0||r.balance!==0);
  },[customers,invoices,payments]);

  const ap = useMemo(()=>{
    const byV={};
    vendors.forEach(v=>{byV[v.id]={vendorId:v.id,vendorName:v.name,totalOrdered:0,totalPaid:0,balance:0};});
    purchases.forEach(p=>{if(!p.vendorId)return;const r=byV[p.vendorId];if(r)r.totalOrdered+=Number(p.total)||0;});
    payments.filter(p=>p.type==="Made").forEach(p=>{const r=byV[p.partyId];if(r)r.totalPaid+=Number(p.amount)||0;});
    Object.values(byV).forEach(r=>{r.balance=r.totalOrdered-r.totalPaid;});
    return Object.values(byV).filter(r=>r.totalOrdered>0||r.balance!==0);
  },[vendors,purchases,payments]);

  // ── PDF cache handler ─────────────────────────────────────
  // Pre-populate from Supabase pdf_url on invoice load
  useEffect(() => {
    const entries = {};
    invoices.forEach(i => { if (i.pdfUrl) entries[i.id] = i.pdfUrl; });
    if (Object.keys(entries).length) setPdfCache(c => ({ ...c, ...entries }));
  }, [invoices]); // eslint-disable-line react-hooks/exhaustive-deps

  const cachePdf = (invId, url) => {
    setPdfCache(p => ({ ...p, [invId]: url }));
    // Persist to Supabase so the URL survives page refresh
    sbPost("save_pdf_url", { inv_id: invId, pdf_url: url }).catch(() => {});
  };

  const triggerPdfDownload = (url) => {
    if (!url) return;
    // window.open works cross-origin on both desktop and mobile;
    // the anchor download attribute is silently ignored for cross-origin URLs on iOS/Android.
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Generic CSV export: rows is an array of plain objects; column order follows
  // the keys of the first row (or an explicit `cols` array of [key,label] pairs).
  const exportCsv = (filename, rows, cols) => {
    if (!rows || !rows.length) { notify("Nothing to export", "err"); return; }
    const columns = cols || Object.keys(rows[0]).map(k=>[k,k]);
    const esc = (v) => {
      const s = v===null||v===undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const lines = [columns.map(([,label])=>esc(label)).join(",")];
    rows.forEach(r => lines.push(columns.map(([key])=>esc(r[key])).join(",")));
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── API actions ───────────────────────────────────────────
  const markPaid = async (invId) => {
    const prevStatus = invoices.find(i=>i.id===invId)?.status;
    try {
      await sbPost("upsert_invoice", { invoice: { id: invId, status: "Paid" } });
      notify(`✅ ${invId} marked as Paid`);
      await loadData(true);
      if(prevStatus&&prevStatus!=="Paid"){
        pushUndo(`${invId} marked as Paid`, async () => {
          await sbPost("upsert_invoice", { invoice: { id: invId, status: prevStatus } });
          await loadData(true);
        });
      }
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const voidInvoice = async (invId) => {
    if(!confirm(`Void ${invId}? This will zero the total and reverse AR.`)) return;
    const prev = invoices.find(i=>i.id===invId);
    try {
      await sbPost("upsert_invoice", { invoice: { id: invId, status: "VOIDED", total: 0 } });
      notify(`✅ ${invId} voided`);
      closeModal();
      await loadData(true);
      if(prev){
        pushUndo(`${invId} voided`, async () => {
          await sbPost("upsert_invoice", { invoice: { id: invId, status: prev.status, total: prev.total } });
          await loadData(true);
        });
      }
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const deleteInvoice = async (invId) => {
    if(!confirm(`⚠️ WARNING: Are you sure you want to permanently DELETE ${invId}? This action cannot be undone.`)) return;
    try {
      await sbPost("delete_invoice", { id: invId });
      notify(`✅ ${invId} permanently deleted`);
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const saveInvoice = async (formData) => {
  try {
    const cust = customers.find(c => c.id === formData.custId);
    const custName = cust ? cust.name : "";
    const enrichedItems = formData.items.map(item => {
      const pr = prodMap[item.pid];
      return {
        product_id: pr ? item.pid : "",
        product_name: pr ? pr.name : (item.pname || item.product_name || ""),
        qty: Number(item.qty) || 0,
        rate: Number(item.rate) || 0,
        total: (Number(item.qty) || 0) * (Number(item.rate) || 0),
        notes: item.notes || "",
      };
    });
    const invId = formData.invId || formData.id || (() => { const ids = invoices.map(i=>i.id).filter(id=>/^INV-\d+$/.test(id)); const max = ids.length ? Math.max(...ids.map(id=>parseInt(id.split('-')[1],10))) : 999; return `INV-${String(max+1).padStart(4,'0')}`; })();
    const invTotal = enrichedItems.reduce((s,i)=>s+i.total,0);
    await sbPost("upsert_invoice", {
      invoice: {
        id: invId,
        date: formData.date,
        cust_id: formData.custId,
        cust_name: custName,
        total: invTotal,
        status: formData.status || "Unpaid",
        pay_terms: formData.payTerms,
        created_by: user.email,
        notes: formData.notes,
        items: enrichedItems,
      }
    });
    let pdfUrl = null;
    try {
      const pdfRes = await invoicePost(invId);
      pdfUrl = pdfRes?.pdfUrl || pdfRes?.url;
    } catch { /* non-fatal */ }
    if (pdfUrl) { cachePdf(invId, pdfUrl); triggerPdfDownload(pdfUrl); }
    notify(`✅ ${invId} saved — ${fmt(invTotal)}`); celebrate();
    closeModal();
    await loadData(true);
  } catch(e) { notify("❌ "+e.message,"err"); throw e; }
};
  const editInvoice = async (formData) => {
    try {
      const cust = customers.find(c => c.id === formData.custId);
      const custName = cust ? cust.name : "";
      const enrichedItems = formData.items.map(item => {
        const pr = prodMap[item.pid];
        return {
          product_id: pr ? item.pid : "",
          product_name: pr ? pr.name : (item.pname || item.product_name || ""),
          qty: Number(item.qty) || 0,
          rate: Number(item.rate) || 0,
          total: (Number(item.qty) || 0) * (Number(item.rate) || 0),
          notes: item.notes || "",
        };
      });
      const invTotal = enrichedItems.reduce((s,i)=>s+i.total,0);
      const invId = formData.invId || formData.id;
      await sbPost("upsert_invoice", {
        invoice: {
          id: invId,
          date: formData.date,
          cust_id: formData.custId,
          cust_name: custName,
          total: invTotal,
          status: formData.status,
          pay_terms: formData.payTerms,
          notes: formData.notes,
          items: enrichedItems,
        }
      });
      let editPdfUrl = null;
      try {
        const pdfRes = await invoicePost(invId);
        editPdfUrl = pdfRes?.pdfUrl || pdfRes?.url;
      } catch { /* non-fatal */ }
      if (editPdfUrl) { cachePdf(invId, editPdfUrl); triggerPdfDownload(editPdfUrl); }
      notify(`✅ ${invId} updated — ${fmt(invTotal)}`);
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); throw e; }
  };

  const updateCustomer = async (d) => {
    try {
      await sbPost("upsert_customer", { customer: { id: d.id, name: d.name, city: d.city, area: d.area, owner_name: d.contact || d.owner_name, mobile: d.phone || d.mobile, open_bal: d.openBal ?? d.open_bal ?? 0, notes: d.notes } });
      notify(`✅ ${d.id} updated`);
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const updateVendor = async (d) => {
    try {
      await sbPost("upsert_vendor", { vendor: { id: d.id, name: d.name, category: d.category, contact: d.contact, mobile: d.mobile || d.phone, open_bal: d.openBal ?? d.open_bal ?? 0, notes: d.notes } });
      notify(`✅ ${d.id} updated`);
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const saveExpense = async (d) => {
    try {
      await sbPost("upsert_expense", { expense: { id: d.id || `EXP-${Date.now()}`, date: d.date, category: d.category, amount: Number(d.amount) || 0, notes: d.notes } });
      notify("✅ Expense saved");
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const adjustStock = async (d) => {
    try {
      const r = await sbPost("adjust_stock", { pid: d.pid, delta: d.delta });
      notify(`✅ ${d.pid} stock → ${r.stock}`);
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const savePayment = async (d) => {
    try {
      await sbPost("upsert_payment", { payment: { id: d.id || `PAY-${Date.now()}`, date: d.date, type: d.type || "Received", party_id: d.partyId || d.custId || d.vendorId, ref_id: d.refId || d.invId, amount: Number(d.amount) || 0, notes: d.notes } });
      notify("✅ Payment recorded");
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const savePurchase = async (d) => {
    try {
      const poId = d.id || `PO-${Date.now()}`;
      const items = (d.items || []).map(it => ({ product_id: it.pid || it.product_id || "", product_name: it.pname || it.product_name || "", qty: Number(it.qty) || 0, rate: Number(it.rate) || 0, total: (Number(it.qty) || 0) * (Number(it.rate) || 0), notes: it.notes || "" }));
      await sbPost("upsert_purchase", { purchase: { id: poId, date: d.date, vendor_id: d.vendorId || d.vendor, total: Number(d.total) || items.reduce((s,i)=>s+i.total,0), notes: d.notes, items } });
      notify("✅ Purchase saved");
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const addCustomer = async (d) => {
    try {
      const id = d.id || `CUST-${Date.now()}`;
      await sbPost("upsert_customer", { customer: { id, name: d.name, city: d.city, area: d.area, owner_name: d.contact || d.owner_name, mobile: d.phone || d.mobile, open_bal: d.openBal ?? 0, notes: d.notes } });
      notify(`✅ ${id} added`);
      closeModal();
      await loadData(true);
    } catch(e) { notify("❌ "+e.message,"err"); }
  };

  const resetDemo = async () => {
    if(!confirm("Reset all demo data to the original sample dataset?")) return;
    initDb(vertical.key); setPdfCache({});
    await loadData(true); await loadSupabase(true); setDataVersion(v=>v+1);
    notify("✅ Demo data reset");
  };

  if (loading) return <LoadingScreen msg="Loading TradeDesk ERP…"/>;

  // ── NAV ───────────────────────────────────────────────────
  const pendingRiderOrders = sbData.orders.filter(o => o.status === "Pending").length;
  const NAV_GROUPS = [
    {group:"Operations",items:[
      {id:"dashboard", label:"Dashboard"},
      {id:"customers", label:CWP, badge:customers.length},
      {id:"invoices",  label:"Invoices",  badge:unpaidInv.length||null},
      {id:"payments",  label:"Payments"},
    ]},
    {group:"Procurement",items:[
      {id:"purchases", label:"Purchases"},
      {id:"vendors",   label:"Vendors"},
      {id:"expenses",  label:"Expenses"},
    ]},
    {group:"Finance",items:[
      {id:"pnl",       label:"P&L"},
      {id:"arap",      label:"AR / AP"},
      {id:"inventory", label:"Inventory"},
      {id:"reports",   label:"Reports"},
      {id:"returns",   label:"Returns"},
    ]},
    ...(vertical.navGroups||[]),
    {group:"Treasury",items:[
      {id:"bank",      label:"Bank & Cash"},
      {id:"cheques",   label:"Cheques"},
      {id:"cashflow",  label:"Cash Flow"},
      {id:"ledger",    label:"General Ledger"},
      {id:"tax",       label:"Sales Tax"},
    ]},
    ...(vertical.riderHub?[{group:"Rider Hub",items:[
      {id:"rider-orders",   label:"Rider Orders",  badge:pendingRiderOrders||null},
      {id:"rider-stores",   label:"Rider Stores"},
      {id:"riders",         label:"Riders"},
      {id:"locations",      label:"Live Locations"},
      {id:"rider-products", label:"Products"},
      {id:"store-assign",   label:"Store Assign"},
      {id:"areas",          label:"Areas"},
      {id:"rider-reports",  label:"Rider Reports"},
      {id:"rider-config",   label:"Rider Config"},
      {id:"rider-commission",label:"Commission"},
    ]}]:[]),
    {group:"Administration",items:[
      {id:"alerts",    label:"Alerts", badge:(lowStock.length+unpaidInv.filter(i=>(ageDaysOf(i)||0)>30).length)||null},
      {id:"users",     label:"Users & Roles"},
      {id:"audit",     label:"Audit Log"},
      {id:"settings",  label:"Settings"},
    ]},
  ];
  const QUICK_ACTIONS = [
    { label: "New invoice", icon: QUICK_ICONS.invoice, color: G.dark, run: () => setModal({ t: "newInvoice" }) },
    { label: "Collect payment", icon: QUICK_ICONS.payment, color: G.mid, run: () => setModal({ t: "recordPayment" }) },
    { label: "Add expense", icon: QUICK_ICONS.expense, color: G.red, run: () => setModal({ t: "addExpense" }) },
    { label: `Add ${CW.toLowerCase()}`, icon: QUICK_ICONS.customer, color: G.blue, run: () => setModal({ t: "addCustomer" }) },
    { label: "New purchase", icon: QUICK_ICONS.purchase, color: G.purple, run: () => setModal({ t: "newPurchase" }) },
  ];
  const NAV_FLAT = NAV_GROUPS.flatMap(g => g.items.map(n => ({ ...n, group: g.group })));
  const alertCount = lowStock.length + unpaidInv.filter(i => (ageDaysOf(i) || 0) > 30).length;
  const trendMonths = (() => { const o = []; const d = new Date(); for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); o.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); } return o; })();
  const trendSeries = [
    { label: "Invoiced", color: G.dark, values: trendMonths.map(k => invoices.filter(i => i.status !== "VOIDED" && String(i.date).slice(0, 7) === k).reduce((s, i) => s + Number(i.total || 0), 0)) },
    { label: "Collected", color: G.mid, values: trendMonths.map(k => payments.filter(p => p.type === "Received" && String(p.date).slice(0, 7) === k).reduce((s, p) => s + Number(p.amount || 0), 0)) },
    { label: "Expenses", color: G.amber, values: trendMonths.map(k => expenses.filter(e => String(e.date).slice(0, 7) === k).reduce((s, e) => s + Number(e.amount || 0), 0)) },
  ];
  // Shared context handed to TradeDesk extension pages
  const ctx = { vertical, user, customers, vendors, products, invoices, purchases, payments, expenses, inventory, sbData, ar, ap, custMap, vendMap, prodMap,
    totalRevenue, totalReceived, totalPurchases, totalExpenses, netProfit, totalAR, grossProfit, unpaidInv, lowStock,
    notify, setTab, setModal, closeModal, exportCsv, loadData, loadSupabase, pushUndo, dataVersion, bump:()=>setDataVersion(v=>v+1), resetDemo, isMobile, search, setSearch, markPaid, savePayment, saveExpense, savePurchase, addCustomer, pdfCache, cachePdf };

  // ── DASHBOARD ─────────────────────────────────────────────
  const Dashboard = () => (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{background:G.pale,borderRadius:8,padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${G.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:G.light,boxShadow:`0 0 6px ${G.light}`}}/>
          <span style={{fontSize:11,color:G.muted,fontWeight:600}}>{CONFIG.company.name} · Demo dataset (in-memory){lastSync?` · ${lastSync.toLocaleTimeString()}`:""}</span>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn sm v="ghost" onClick={resetDemo}>↺ Reset demo data</Btn>
          <Btn sm v="secondary" onClick={()=>loadData(true)}>{syncing?"⏳ Syncing…":"↻ Sync"}</Btn>
        </div>
      </div>
      {showWelcome&&<WelcomeBanner G={G} vertical={vertical} onDismiss={()=>setShowWelcome(false)} onTry={()=>setModal({t:"newInvoice"})}/>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {QUICK_ACTIONS.map(a=><motion.button key={a.label} whileHover={{y:-2,scale:1.02}} whileTap={{scale:0.97}} onClick={a.run} style={{display:"inline-flex",alignItems:"center",gap:8,background:G.card,border:`1.5px solid ${G.border}`,borderRadius:12,padding:"9px 14px",fontSize:12,fontWeight:700,color:G.ink,cursor:"pointer",boxShadow:"0 2px 10px rgba(15,23,42,0.06)"}}><span style={{width:26,height:26,borderRadius:8,background:`${a.color}1A`,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><a.icon size={14} color={a.color}/></span>{a.label}</motion.button>)}
      </div>
      {vertical.DashboardExtra&&<vertical.DashboardExtra ctx={ctx}/>}
      {lowStock.length>0&&<div onClick={()=>setTab("inventory")} style={{background:"#FFF8E1",borderRadius:9,padding:"10px 14px",border:`1.5px solid ${G.amber}`,fontSize:12,fontWeight:700,color:G.amber,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>⚠️ {lowStock.length} product{lowStock.length>1?"s":""} at/below minimum stock — {lowStock.filter(p=>p.stock===0).length} out of stock</span>
        <span style={{fontSize:11,textDecoration:"underline"}}>View inventory →</span>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        <Kpi label="Total Invoiced"  value={fmt(totalRevenue)}  sub={`${invoices.length} invoices`}    color={G.mid}    trend="up" icon={FileText}/>
        <Kpi label="Total Received"  value={fmt(totalReceived)} sub="Cash collected"                   color={G.light}  trend="up" icon={CreditCard}/>
        <Kpi label="AR Outstanding"  value={fmt(totalAR)}       sub={`${unpaidInv.length} unpaid`}      color={G.amber}  icon={Scale}/>
        <Kpi label="Total Purchases" value={fmt(totalPurchases)}sub={`${purchases.length} POs`}         color={G.purple} icon={ShoppingCart}/>
        <Kpi label="Total Expenses"  value={fmt(totalExpenses)} sub="Operating costs"                  color={G.red}    icon={Receipt}/>
        <Kpi label="Net Profit"      value={fmt(netProfit)}     sub={`NP: ${npMargin}%`}               color={netProfit>0?G.mid:G.red} trend={netProfit>0?"up":"dn"} icon={TrendingUp}/>
      </div>
      <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
        <div style={{background:G.dark,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:G.white,fontWeight:700,fontSize:13}}>📈 Six-month trend — invoiced vs collected vs expenses</span><Btn sm v="secondary" onClick={()=>setTab("cashflow")}>Cash flow →</Btn></div>
        <div style={{padding:"14px 16px"}}><TrendChart G={G} months={trendMonths} series={trendSeries} fmt={fmt}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:16}}>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.dark,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:G.white,fontWeight:700,fontSize:13}}>Latest Invoices</span>
            <Btn sm v="secondary" onClick={()=>setTab("invoices")}>View All</Btn>
          </div>
          {invoices.slice(0,8).map(inv=>(
            <div key={inv.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:`1px solid ${G.pale}`}}>
              <div>
                <div style={{fontWeight:700,fontSize:11,color:G.dark}}>{inv.id}</div>
                <div style={{fontSize:10,color:G.muted}}>{inv.custName} · {inv.date}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontWeight:800,fontSize:11}}>{fmt(inv.total)}</span>
                <Badge text={inv.status}/>
                <PdfBtn invId={inv.id} pdfUrl={pdfCache[inv.id]} onGenerate={u=>cachePdf(inv.id,u)} sm/>
                {(inv.status==="Unpaid"||inv.status==="Partial")&&
                  <button onClick={()=>markPaid(inv.id)} style={{background:G.pale,border:`1px solid ${G.mid}`,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700,color:G.dark,cursor:"pointer"}}>Pay</button>}
              </div>
            </div>
          ))}
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.dark,padding:"11px 16px"}}><span style={{color:G.white,fontWeight:700,fontSize:13}}>P&L Snapshot</span></div>
          <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:9}}>
            {[{l:"Gross Revenue",v:totalRevenue,c:G.mid,bold:true},{l:"Cost of Goods",v:-totalPurchases,c:G.red},{l:"GROSS PROFIT",v:grossProfit,c:grossProfit>0?G.mid:G.red,bold:true,border:true},{l:"Operating Exp.",v:-totalExpenses,c:G.red},{l:"NET PROFIT",v:netProfit,c:netProfit>0?G.mid:G.red,bold:true,border:true,big:true}].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",paddingTop:r.border?"7px":0,borderTop:r.border?`2px solid ${G.pale}`:"none"}}>
                <span style={{fontSize:r.big?13:11,fontWeight:r.bold?700:400,color:G.ink}}>{r.l}</span>
                <span style={{fontSize:r.big?14:11,fontWeight:r.bold?800:500,color:r.c}}>{r.v<0?`(${fmt(-r.v)})`:fmt(r.v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {unpaidInv.length>0&&(
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:"#B71C1C",padding:"11px 16px"}}><span style={{color:G.white,fontWeight:700,fontSize:13}}>⚠ Outstanding AR — {fmt(totalAR)}</span></div>
          <TblWrap compact heads={["Invoice","Customer","Total","Status","PDF","Action"]}
            rows={unpaidInv.slice(0,8).map(inv=>[
              <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{inv.id}</span>,
              <span style={{fontSize:11,fontWeight:600}}>{inv.custName}</span>,
              <span style={{fontWeight:700,fontSize:11}}>{fmt(inv.total)}</span>,
              <Badge text={inv.status}/>,
              <PdfBtn invId={inv.id} pdfUrl={pdfCache[inv.id]} onGenerate={u=>cachePdf(inv.id,u)} sm/>,
              <Btn sm v="success" onClick={()=>markPaid(inv.id)}>✓ Paid</Btn>,
            ])}
          />
        </div>
      )}
    </div>
  );

  // ── INVOICES PAGE ─────────────────────────────────────────
  // Called as Invoices(), not <Invoices/>: a component defined inside App gets a
  // new identity every render, so React would remount it and the search input
  // would lose focus after each keystroke.
  const Invoices = () => {
    const sf = invSf, setSf = setInvSf;
    const fil = invoices.filter(i=>(sf==="All"||i.status===sf)&&(!search||i.id?.includes(search.toUpperCase())||i.custName?.toLowerCase().includes(search.toLowerCase())));
    return (
      <div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{position:"relative",flex:1,minWidth:180}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoices…" style={{border:`1.5px solid ${G.border}`,borderRadius:8,padding:"7px 11px 7px 33px",fontSize:13,width:"100%",boxSizing:"border-box",background:G.bg,outline:"none",color:G.ink}}/>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:G.muted}}>🔍</span>
          </div>
          {["All","Paid","Partial","Unpaid","VOIDED"].map(s=>(
            <button key={s} onClick={()=>setSf(s)} style={{padding:"5px 11px",borderRadius:20,border:`1.5px solid ${sf===s?G.dark:G.border}`,background:sf===s?G.dark:G.bg,color:sf===s?G.white:G.ink,fontSize:10,fontWeight:700,cursor:"pointer"}}>
              {s}{s!=="All"?` (${invoices.filter(i=>i.status===s).length})`:""}</button>
          ))}
          <Btn sm onClick={()=>setModal({t:"newInvoice"})}>+ New Invoice</Btn>
          <Btn sm v="secondary" onClick={()=>setModal({t:"recordPayment"})}>💳 Payment</Btn>
          <Btn sm v="secondary" onClick={()=>setModal({t:"agingReport"})}>📊 Aging Report</Btn>
          <Btn sm v="secondary" onClick={()=>exportCsv("invoices.csv",fil.map(i=>({...i,ageDays:ageDaysOf(i)??''})),[["id","Invoice"],["date","Date"],["custName","Customer"],["total","Total"],["status","Status"],["payTerms","Terms"],["ageDays","Age (days)"]])}>⬇ Export</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
          {[{l:"Total Invoiced",v:fmt(totalRevenue),c:G.mid},{l:"Collected",v:fmt(totalReceived),c:G.light},{l:"Outstanding",v:fmt(totalAR),c:G.amber},{l:"Invoices",v:invoices.length,c:G.dark}].map(s=>(
            <div key={s.l} style={{background:G.card,borderRadius:9,padding:"11px 14px",boxShadow:"0 1px 8px rgba(15,23,42,0.07)",borderBottom:`3px solid ${s.c}`}}>
              <div style={{fontSize:9,color:G.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
              <div style={{fontSize:16,fontWeight:800,color:G.ink}}>{s.v}</div>
            </div>
          ))}
        </div>
        {(()=>{
          const open=invoices.filter(i=>i.status==="Unpaid"||i.status==="Partial");
          if(!open.length) return null;
          const buckets=[{l:"Current (0–15d)",c:G.light,v:0},{l:"Caution (16–30d)",c:G.blue,v:0},{l:"Overdue (31–45d)",c:G.amber,v:0},{l:"Critical (45+d)",c:G.red,v:0}];
          open.forEach(i=>{const a=ageDaysOf(i)||0; if(a<=15)buckets[0].v+=i.total; else if(a<=30)buckets[1].v+=i.total; else if(a<=45)buckets[2].v+=i.total; else buckets[3].v+=i.total;});
          return(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:9,color:G.muted,fontWeight:800,textTransform:"uppercase",marginBottom:6,letterSpacing:0.5}}>Outstanding by Age</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                {buckets.map(b=>(
                  <div key={b.l} style={{background:G.card,borderRadius:9,padding:"10px 14px",boxShadow:"0 1px 8px rgba(15,23,42,0.07)",borderLeft:`4px solid ${b.c}`}}>
                    <div style={{fontSize:9,color:G.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{b.l}</div>
                    <div style={{fontSize:15,fontWeight:800,color:b.c}}>{fmt(b.v)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <TblWrap compact heads={["Invoice","Date","Customer","Total","Status","Terms","Age","PDF","Actions"]}
            rows={fil.map(inv=>[
              <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{inv.id}</span>,
              <span style={{fontSize:10,color:G.muted}}>{inv.date}</span>,
              <span style={{fontWeight:600,fontSize:11}}>{inv.custName}</span>,
              <span style={{fontWeight:700,fontSize:11}}>{fmt(inv.total)}</span>,
              <Badge text={inv.status}/>,
              <span style={{fontSize:10,color:G.muted}}>{inv.payTerms}</span>,
              (inv.status==="Paid"||inv.status==="VOIDED"||ageDaysOf(inv)==null)
                ?<span style={{fontSize:10,color:G.muted}}>—</span>
                :<span style={{fontSize:10,fontWeight:800,color:ageColor(ageDaysOf(inv))}}>{ageDaysOf(inv)}d</span>,
              <PdfBtn invId={inv.id} pdfUrl={pdfCache[inv.id]} onGenerate={u=>cachePdf(inv.id,u)} sm/>,
              <div style={{display:"flex",gap:4}}>
                <Btn sm v="ghost" onClick={()=>setModal({t:"viewInvoice",d:inv})}>View</Btn>
                {(inv.status==="Unpaid"||inv.status==="Partial")&&<Btn sm v="success" onClick={()=>markPaid(inv.id)}>✓ Paid</Btn>}
              </div>,
            ])}
          />
        </div>
      </div>
    );
  };

  // ── CUSTOMERS ─────────────────────────────────────────────
  // Called as Customers(), not <Customers/>: see the note above Invoices() — otherwise
  // the search input loses focus after each keystroke.
  const Customers = () => {
    const hideDupes = custHideDupes, setHideDupes = setCustHideDupes;
    // Two riders syncing the same shop (or repeated manual adds) can leave duplicate Sheets rows.
    // We only collapse them in this view — nothing is deleted from the sheet, so existing invoices
    // / AR balances tied to either row stay intact. Group key = name + phone (fallback name + area).
    const custKey = (c)=>{ const n=normTxt(c.name), p=digitsOnly(c.phone); return p ? n+"|"+p : n+"|"+normTxt(c.area); };
    const dupInfo = (()=>{
      const byKey={};
      customers.forEach(c=>{ const k=custKey(c); if(!normTxt(c.name)) return; (byKey[k]=byKey[k]||[]).push(c); });
      const dupIds=new Set(), groupSize={}, groups=[];
      Object.values(byKey).forEach(arr=>{
        if(arr.length<2) return;
        // Representative: prefer whichever row already has invoices/AR history, else the lowest id.
        const sorted=[...arr].sort((a,b)=>{
          const ai=invoices.filter(i=>i.custId===a.id).length, bi=invoices.filter(i=>i.custId===b.id).length;
          if(ai!==bi) return bi-ai;
          return String(a.id).localeCompare(String(b.id));
        });
        const rep=sorted[0];
        groupSize[rep.id]=arr.length;
        const mergeIds=arr.filter(c=>c.id!==rep.id).map(c=>c.id);
        mergeIds.forEach(id=>dupIds.add(id));
        groups.push({ keepId: rep.id, mergeIds });
      });
      return { dupIds, groupSize, groups };
    })();
    const merging = custMerging, setMerging = setCustMerging;
    const importingSb = custImportingSb, setImportingSb = setCustImportingSb;
    const importRiderStores = async (stores) => {
      if(!stores.length){ notify("No unsynced rider stores to import","err"); return; }
      if(!confirm(`Import ${stores.length} rider store(s) into the Customers list?\n(already-synced stores are skipped; stores matching an existing customer by name+phone are linked, not duplicated)`)) return;
      setImportingSb(true);
      const custByKey={}, custByName={};
      customers.forEach(c=>{ const n=normTxt(c.name); if(!n) return; custByName[n]=c; custByKey[n+"|"+digitsOnly(c.phone)]=c; });
      let created=0, linked=0, fail=0;
      for(const s of stores){
        try{
          const storeRec = sbData.stores.find(r=>r.id===s._storeId)||{};
          const n=normTxt(s.name), mobile=digitsOnly(s.phone);
          const existing = custByKey[n+"|"+mobile] || (!mobile ? custByName[n] : null);
          if(existing){
            try{ await sbPost("update_store",{id:s._storeId,gas_customer_id:existing.id}); }catch{/*non-fatal*/}
            linked++; continue;
          }
          const newId = `CUST-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
          await sbPost("upsert_customer", { customer: { id: newId, name: s.name, area: s.area||"", city: s.city||"", owner_name: s.contact||"", mobile: s.phone||"", open_bal: 0, notes: `supabase_id:${s._storeId}` } });
          try{ await sbPost("update_store",{id:s._storeId,gas_customer_id:newId}); }catch{/*non-fatal*/}
          created++;
        }catch(e){ fail++; }
      }
      setImportingSb(false);
      notify(`✅ ${created} imported, ${linked} linked to existing${fail?`, ${fail} failed`:""}`);
      await loadData(true); await loadSupabase(true);
    };
    const mergeDuplicates = async () => {
      if(!dupInfo.groups.length) return;
      if(!confirm(`Merge ${dupInfo.dupIds.size} duplicate customer row(s) into ${dupInfo.groups.length} record(s)?\n\nInvoices and payments on the duplicates will be moved to the kept record, and the duplicate Sheet rows will be removed.`)) return;
      setMerging(true);
      try {
        const result = await sbPost("merge_customers",{groups:dupInfo.groups});
        // Stores synced to a merged-away customer id need to point at the surviving one.
        const target={};
        dupInfo.groups.forEach(g=>g.mergeIds.forEach(id=>{target[id]=g.keepId;}));
        const storeRepoints=[];
        for(const s of sbData.stores){
          if(s.gas_customer_id && target[s.gas_customer_id]){
            storeRepoints.push({id:s.id,from:s.gas_customer_id,to:target[s.gas_customer_id]});
            try{ await sbPost("update_store",{id:s.id,gas_customer_id:target[s.gas_customer_id]}); }catch{/* non-fatal */}
          }
        }
        notify(`✅ Merged ${dupInfo.dupIds.size} duplicate customer(s)`);
        await loadData(true); await loadSupabase(true);
        if(result?.snapshot?.groups?.length){
          pushUndo(`Merged ${dupInfo.dupIds.size} duplicate customer(s)`, async () => {
            await sbPost("undo_merge_customers", result.snapshot);
            for(const r of storeRepoints){
              try{ await sbPost("update_store",{id:r.id,gas_customer_id:r.from}); }catch{/* non-fatal */}
            }
            await loadData(true); await loadSupabase(true);
          });
        }
      } catch(e) { notify("❌ "+e.message,"err"); } finally { setMerging(false); }
    };
    const fil=customers.filter(c=>{
      if(hideDupes && dupInfo.dupIds.has(c.id)) return false;
      return !search||c.name?.toLowerCase().includes(search.toLowerCase())||c.area?.toLowerCase().includes(search.toLowerCase());
    });

    // Rider stores not yet linked to any Sheets customer row — shown as read-only cards
    const linkedStoreIds = (() => {
      const ids = new Set();
      customers.forEach(c => { const m = c.notes?.match(/supabase_id:([^\s,]+)/); if (m) ids.add(m[1]); });
      sbData.stores.forEach(s => { if (s.gas_customer_id) ids.add(s.id); });
      return ids;
    })();
    const virtualStores = sbData.stores
      .filter(s => s.name && !linkedStoreIds.has(s.id))
      .map(s => ({ _storeId: s.id, _isRiderStore: true, name: s.name, area: s.area||"", city: s.city||"", phone: s.mobile||"", contact: s.owner_name||"" }))
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.area.toLowerCase().includes(search.toLowerCase()));

    return (
      <div>
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:200}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${CWP.toLowerCase()}…`} style={{border:`1.5px solid ${G.border}`,borderRadius:8,padding:"8px 11px 8px 33px",fontSize:13,width:"100%",boxSizing:"border-box",background:G.bg,outline:"none",color:G.ink}}/>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:G.muted}}>🔍</span>
          </div>
          <Btn sm onClick={()=>setModal({t:"addCustomer"})}>+ Add {CW}</Btn>
          {dupInfo.dupIds.size>0&&<Btn sm v={hideDupes?"secondary":"amber"} onClick={()=>setHideDupes(h=>!h)}>{hideDupes?`🔁 ${dupInfo.dupIds.size} dup hidden`:"Hide duplicates"}</Btn>}
          {dupInfo.dupIds.size>0&&<Btn sm v="danger" disabled={merging} onClick={mergeDuplicates}>{merging?"⏳ Merging…":`🔀 Merge ${dupInfo.dupIds.size} duplicate(s)`}</Btn>}
          <Btn sm v="secondary" onClick={()=>exportCsv("customers.csv",fil,[["id","ID"],["name","Name"],["area","Area"],["city","City"],["phone","Phone"]])}>⬇ Export</Btn>
          {virtualStores.length>0&&<Btn sm v="secondary" disabled={importingSb} onClick={()=>importRiderStores(virtualStores)}>{importingSb?"⏳ Importing…":`⬆ Import ${virtualStores.length} Rider Store${virtualStores.length===1?"":"s"} to Customers`}</Btn>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {fil.map(c=>{
            const cinv=invoices.filter(i=>i.custId===c.id);
            const out=cinv.reduce((s,i)=>i.status!=="Paid"?s+i.total:s,0);
            return (
              <div key={c.id} onClick={()=>setModal({t:"viewCustomer",d:c})} style={{background:G.card,borderRadius:11,padding:16,boxShadow:"0 2px 10px rgba(15,23,42,0.07)",borderTop:`3px solid ${G.mid}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div><div style={{fontWeight:800,fontSize:13,color:G.ink,marginBottom:2}}>{c.name}{dupInfo.groupSize[c.id]>1&&<span title="duplicate customer rows merged into this one" style={{marginLeft:6,fontSize:9,color:G.amber,fontWeight:800}}>×{dupInfo.groupSize[c.id]}</span>}</div><div style={{fontSize:10,color:G.muted}}>{c.area} · {c.city}</div></div>
                  <span style={{fontSize:10,fontWeight:700,color:G.muted,background:G.pale,padding:"2px 6px",borderRadius:6,alignSelf:"flex-start"}}>{c.id}</span>
                </div>
                <div style={{fontSize:10,color:G.muted,marginBottom:10}}>📞 {c.phone||"—"}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                  {[{l:"Orders",v:cinv.length},{l:"Revenue",v:fmt(cinv.reduce((s,i)=>s+i.total,0))},{l:"Due",v:fmt(out),red:out>0}].map(x=>(
                    <div key={x.l} style={{background:G.pale,borderRadius:6,padding:"6px 5px",textAlign:"center"}}>
                      <div style={{fontSize:10,fontWeight:700,color:x.red&&out>0?G.red:G.dark,lineHeight:1.2}}>{x.v}</div>
                      <div style={{fontSize:8,color:G.muted,marginTop:1}}>{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {virtualStores.map(s=>(
            <div key={"rs-"+s._storeId} onClick={()=>setModal({t:"viewRiderStore",d:s})} style={{background:G.card,borderRadius:11,padding:16,boxShadow:"0 2px 10px rgba(0,137,123,0.07)",borderTop:"3px solid #00897B",cursor:"pointer",opacity:0.92}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div><div style={{fontWeight:800,fontSize:13,color:G.ink,marginBottom:2}}>{s.name}</div><div style={{fontSize:10,color:G.muted}}>{s.area}</div></div>
                <span style={{fontSize:9,fontWeight:700,color:"#00695C",background:"#E0F2F1",padding:"2px 7px",borderRadius:6,alignSelf:"flex-start",whiteSpace:"nowrap"}}>Rider Store</span>
              </div>
              <div style={{fontSize:10,color:G.muted,marginBottom:10}}>📞 {s.phone||"—"}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {[{l:"Orders",v:"—"},{l:"Revenue",v:"—"},{l:"Due",v:"—"}].map(x=>(
                  <div key={x.l} style={{background:"#E0F2F1",borderRadius:6,padding:"6px 5px",textAlign:"center"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#00695C",lineHeight:1.2}}>{x.v}</div>
                    <div style={{fontSize:8,color:G.muted,marginTop:1}}>{x.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {fil.length===0&&virtualStores.length===0&&<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12,gridColumn:"1/-1"}}>No customers found</div>}
        </div>
      </div>
    );
  };

  // ── OTHER PAGES (Purchases, Vendors, Expenses, Payments, PnL, AR/AP, Inventory, Reports) ──
  // Identical to v3.0 — keeping compact here for brevity
  const SimplePage = ({title,content}) => <div>{content}</div>;

  const Purchases = () => (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12,gap:8}}>
        <Btn sm onClick={()=>setModal({t:"newPurchase"})}>+ New Purchase</Btn>
        <Btn sm v="secondary" onClick={()=>setModal({t:"vendorPayment"})}>💳 AP Payment</Btn>
        <Btn sm v="secondary" onClick={()=>exportCsv("purchases.csv",purchases,[["id","PO ID"],["date","Date"],["vendor","Vendor"],["total","Total"],["paid","Paid"],["notes","Notes"]])}>⬇ Export</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
        {[{l:"Total Purchases",v:fmt(totalPurchases),c:G.dark},{l:"AP Outstanding",v:fmt(ap.reduce((s,r)=>s+r.balance,0)),c:G.red},{l:"POs Raised",v:purchases.length,c:G.mid}].map(s=>(
          <div key={s.l} style={{background:G.card,borderRadius:9,padding:"11px 14px",boxShadow:"0 1px 8px rgba(15,23,42,0.07)",borderBottom:`3px solid ${s.c}`}}>
            <div style={{fontSize:9,color:G.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:16,fontWeight:800,color:G.ink}}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
        <TblWrap compact heads={["PO ID","Date","Vendor","Total","Paid","Balance","Notes"]}
          rows={purchases.map(p=>[
            <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{p.id}</span>,
            <span style={{fontSize:10,color:G.muted}}>{p.date}</span>,
            <span style={{fontWeight:600,fontSize:11}}>{p.vendor}</span>,
            <span style={{fontWeight:700,fontSize:11}}>{fmt(p.total)}</span>,
            <span style={{color:G.mid,fontWeight:600,fontSize:11}}>{fmt(p.paid)}</span>,
            <span style={{fontWeight:700,color:p.total-p.paid>0?G.red:G.mid,fontSize:11}}>{fmt(p.total-p.paid)}</span>,
            <span style={{fontSize:10,color:G.muted}}>{p.notes}</span>,
          ])}
        />
      </div>
    </div>
  );

  const Expenses = () => {
    const cats=[...new Set(expenses.map(e=>e.category))];
    const total=expenses.reduce((s,e)=>s+e.amount,0);
    return (
      <div>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12,gap:8}}>
          <Btn sm onClick={()=>setModal({t:"addExpense"})}>+ Add Expense</Btn>
          <Btn sm v="secondary" onClick={()=>exportCsv("expenses.csv",expenses,[["id","Exp ID"],["date","Date"],["category","Category"],["amount","Amount"],["notes","Notes"],["by","By"]])}>⬇ Export</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:9,marginBottom:12}}>
          {cats.map(c=>{const ct=expenses.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0);return(
            <div key={c} style={{background:G.card,borderRadius:9,padding:"11px 13px",boxShadow:"0 1px 8px rgba(15,23,42,0.07)"}}>
              <div style={{fontSize:10,fontWeight:700,color:G.dark,marginBottom:2}}>{c}</div>
              <div style={{fontSize:14,fontWeight:800,color:G.ink,marginBottom:5}}>{fmt(ct)}</div>
              <div style={{height:3,background:G.pale,borderRadius:2}}><div style={{height:"100%",width:pct(ct,total),background:G.mid,borderRadius:2}}/></div>
            </div>
          );})}
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <TblWrap compact heads={["Exp ID","Date","Category","Amount","Notes","By"]}
            rows={expenses.map(e=>[
              <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{e.id}</span>,
              <span style={{fontSize:10,color:G.muted}}>{e.date}</span>,
              <Badge text={e.category}/>,
              <span style={{fontWeight:700,color:G.red,fontSize:11}}>{fmt(e.amount)}</span>,
              <span style={{fontSize:10,color:G.muted}}>{e.notes}</span>,
              <span style={{fontSize:9,color:G.muted}}>{e.by?.split("@")[0]}</span>,
            ])}
          />
        </div>
      </div>
    );
  };

  const PnL = () => (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {[{l:"Revenue",v:fmt(totalRevenue),c:G.mid},{l:"COGS",v:fmt(totalPurchases),c:G.purple},{l:"Gross Profit",v:fmt(grossProfit),c:G.light},{l:"Net Profit",v:fmt(netProfit),c:netProfit>=0?G.mid:G.red}].map(s=>(
          <div key={s.l} style={{background:G.card,borderRadius:10,padding:"12px 15px",boxShadow:"0 1px 8px rgba(15,23,42,0.07)",borderBottom:`3px solid ${s.c}`}}>
            <div style={{fontSize:9,color:G.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:18,fontWeight:800,color:G.ink}}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:14}}>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.dark,padding:"12px 20px"}}><span style={{color:G.white,fontWeight:800,fontSize:14}}>{CONFIG.company.name} — Profit & Loss Statement</span></div>
          <div style={{padding:"12px 20px 20px"}}>
            {[{h:"REVENUE"},{l:"Gross Sales",v:totalRevenue,indent:true},{l:"Total Revenue",v:totalRevenue,bold:true,border:true},{h:"COST OF GOODS"},{l:"Total Purchases",v:-totalPurchases,indent:true,neg:true},{l:"GROSS PROFIT",v:grossProfit,bold:true,border:true,bg:grossProfit>0?G.pale:G.pink},{note:`GP Margin: ${gpMargin}%`},{h:"EXPENSES"},{l:"Total Expenses",v:-totalExpenses,indent:true,neg:true},{l:"NET PROFIT / (LOSS)",v:netProfit,bold:true,border:true,big:true,bg:netProfit>0?G.pale:G.pink},{note:`NP Margin: ${npMargin}%`}
            ].map((r,i)=>{
              if(r.h) return <div key={i} style={{fontSize:9,fontWeight:800,color:G.dark,textTransform:"uppercase",letterSpacing:"0.12em",marginTop:12,marginBottom:6,paddingBottom:4,borderBottom:`1px solid ${G.pale}`}}>{r.h}</div>;
              if(r.note) return <div key={i} style={{fontSize:10,color:G.muted,fontStyle:"italic",marginBottom:3}}>{r.note}</div>;
              return(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:`${r.big?"10px":"6px"} ${r.indent?"20px":"0"}`,paddingTop:r.border?"7px":undefined,borderTop:r.border?`2px solid ${G.pale}`:"none",background:r.bg||"transparent",borderRadius:r.bg?7:0,marginTop:r.bg?3:0}}>
                <span style={{fontSize:r.big?13:11,fontWeight:r.bold?700:400,color:G.ink}}>{r.l}</span>
                <span style={{fontSize:r.big?14:11,fontWeight:r.bold?800:500,color:r.v<0?G.red:G.mid}}>{r.v<0?`(${fmt(-r.v)})`:fmt(r.v)}</span>
              </div>);
            })}
          </div>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.mid,padding:"10px 16px"}}><span style={{color:G.white,fontWeight:700,fontSize:12}}>Revenue vs Cost</span></div>
          <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
            {[{l:"Revenue",v:totalRevenue,max:totalRevenue,c:G.mid},{l:"COGS",v:totalPurchases,max:totalRevenue,c:G.purple},{l:"Gross Profit",v:grossProfit,max:totalRevenue,c:G.light},{l:"Expenses",v:totalExpenses,max:totalRevenue,c:G.amber},{l:"Net Profit",v:Math.abs(netProfit),max:totalRevenue,c:netProfit>=0?G.mid:G.red}].map(row=>(
              <div key={row.l}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,fontWeight:600,color:G.ink}}>{row.l}</span><span style={{fontSize:10,fontWeight:700,color:row.c}}>{fmt(row.v)}</span></div>
                <div style={{height:7,background:G.pale,borderRadius:4}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,(row.v/row.max)*100)).toFixed(1)}%`,background:row.c,borderRadius:4}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const ARAp = () => (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {[{l:"AR Billed",v:fmt(totalRevenue),c:G.mid},{l:"AR Outstanding",v:fmt(totalAR),c:G.amber},{l:"AP Ordered",v:fmt(totalPurchases),c:G.purple},{l:"AP Outstanding",v:fmt(ap.reduce((s,r)=>s+r.balance,0)),c:G.red}].map(s=>(
          <div key={s.l} style={{background:G.card,borderRadius:9,padding:"11px 14px",boxShadow:"0 1px 8px rgba(15,23,42,0.07)",borderBottom:`3px solid ${s.c}`}}>
            <div style={{fontSize:9,color:G.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:16,fontWeight:800,color:G.ink}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Outstanding invoices — the primary thing the user needs to see in AR */}
      {unpaidInv.length>0&&(
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.amber,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:G.white,fontWeight:700,fontSize:12}}>📋 Outstanding Invoices ({unpaidInv.length})</span>
            <Btn sm onClick={()=>setModal({t:"recordPayment"})} style={{background:"rgba(255,255,255,0.2)",color:G.white,border:"none"}}>💳 Collect Payment</Btn>
          </div>
          <TblWrap compact heads={["Invoice","Date","Customer","Total","Status","Action"]}
            rows={unpaidInv.map(inv=>[
              <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{inv.id}</span>,
              <span style={{fontSize:10,color:G.muted}}>{inv.date}</span>,
              <span style={{fontWeight:600,fontSize:11}}>{inv.custName}</span>,
              <span style={{fontWeight:800,color:G.red,fontSize:11}}>{fmt(inv.total)}</span>,
              <Badge text={inv.status}/>,
              <Btn sm v="success" onClick={()=>setModal({t:"recordPayment",d:{custId:inv.custId,invId:inv.id}})}>Collect</Btn>,
            ])}
          />
        </div>
      )}
      {unpaidInv.length===0&&totalAR===0&&<div style={{background:G.pale,borderRadius:9,padding:"12px 16px",fontSize:12,color:G.mid,fontWeight:600}}>✅ All invoices collected — AR is clear</div>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.mid,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:G.white,fontWeight:700,fontSize:12}}>AR Ledger (by Customer)</span>
            <Btn sm onClick={()=>setModal({t:"recordPayment"})} style={{background:"rgba(255,255,255,0.15)",color:G.white,border:"none",fontSize:10}}>💳 Collect</Btn>
          </div>
          <TblWrap compact heads={["Customer","Billed","Paid","Balance","Status"]}
            rows={ar.filter(r=>r.totalBilled>0).map(r=>[
              <div><div style={{fontWeight:700,fontSize:11}}>{r.custName}</div><div style={{fontSize:9,color:G.muted}}>{r.custId}</div></div>,
              <span style={{fontSize:11,fontWeight:600}}>{fmt(r.totalBilled)}</span>,
              <span style={{color:G.mid,fontWeight:600,fontSize:11}}>{fmt(r.totalPaid)}</span>,
              <span style={{fontWeight:800,color:r.balance>0?G.red:G.mid,fontSize:11}}>{fmt(r.balance)}</span>,
              r.balance>0
                ?<Btn sm v="success" onClick={()=>setModal({t:"recordPayment",d:{custId:r.custId}})}>Collect</Btn>
                :<Badge text="Settled"/>,
            ])}
          />
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.purple,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:G.white,fontWeight:700,fontSize:12}}>AP Ledger (by Vendor)</span>
            <Btn sm onClick={()=>setModal({t:"vendorPayment"})} style={{background:"rgba(255,255,255,0.15)",color:G.white,border:"none",fontSize:10}}>💳 Pay</Btn>
          </div>
          <TblWrap compact heads={["Vendor","Ordered","Paid","Outstanding","Action"]}
            rows={ap.filter(r=>r.totalOrdered>0).map(r=>[
              <div><div style={{fontWeight:700,fontSize:11}}>{r.vendorName}</div><div style={{fontSize:9,color:G.muted}}>{r.vendorId}</div></div>,
              <span style={{fontWeight:600,fontSize:11}}>{fmt(r.totalOrdered)}</span>,
              <span style={{color:G.mid,fontWeight:600,fontSize:11}}>{fmt(r.totalPaid)}</span>,
              <span style={{fontWeight:800,color:r.balance>0?G.red:G.mid,fontSize:11}}>{fmt(r.balance)}</span>,
              r.balance>0
                ?<Btn sm v="danger" onClick={()=>setModal({t:"vendorPayment",d:{vendorId:r.vendorId}})}>Pay</Btn>
                :<Badge text="Settled"/>,
            ])}
          />
        </div>
      </div>
    </div>
  );

  const Inventory = () => {
    const low=inventory.filter(p=>p.stock<=p.minStock);
    return(
      <div>
        {low.length>0&&<div style={{background:"#FFF8E1",borderRadius:9,padding:"10px 14px",marginBottom:12,border:`1.5px solid ${G.amber}`,fontSize:12,fontWeight:700,color:G.amber}}>⚠️ {low.length} SKUs at/below minimum stock</div>}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
          <Btn sm v="secondary" onClick={()=>exportCsv("inventory.csv",inventory,[["pid","PID"],["pname","Product"],["category","Category"],["cost","Cost"],["purchased","In"],["sold","Sold"],["stock","Stock"],["minStock","Min"]])}>⬇ Export</Btn>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <TblWrap compact heads={["PID","Product","Cat","Cost","In","Sold","Stock","Min","Status","Adjust"]}
            rows={inventory.map(p=>{const s=p.stock===0?"Out of Stock":p.stock<=p.minStock?"Low Stock":"Active";return[<span style={{fontWeight:700,fontSize:10,color:G.dark}}>{p.pid}</span>,<span style={{fontWeight:600,fontSize:11}}>{p.pname}</span>,<Badge text={p.category}/>,<span style={{fontSize:10,color:G.muted}}>{fmt(p.cost)}</span>,<span style={{fontWeight:600}}>{p.purchased}</span>,<span style={{fontWeight:600,color:G.mid}}>{p.sold}</span>,<span style={{fontWeight:800,color:p.stock===0?G.red:p.stock<=p.minStock?G.amber:G.ink}}>{p.stock}</span>,<span style={{fontSize:10,color:G.muted}}>{p.minStock}</span>,<Badge text={s}/>,<Btn sm v="ghost" onClick={()=>setModal({t:"adjustStock",d:p})}>± Adjust</Btn>];})}
          />
        </div>
      </div>
    );
  };

  const Reports = () => {
    const topCust=[...customers].map(c=>({...c,rev:invoices.filter(i=>i.custId===c.id).reduce((s,i)=>s+i.total,0)})).sort((a,b)=>b.rev-a.rev).slice(0,8);
    return(
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.mid,padding:"11px 16px"}}><span style={{color:G.white,fontWeight:700,fontSize:12}}>🏆 Top Customers by Revenue</span></div>
          <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
            {topCust.map((c,i)=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{width:20,height:20,background:i<3?G.gold:G.pale,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:i<3?G.white:G.muted,fontSize:9,fontWeight:800,flexShrink:0}}>{i+1}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:11,fontWeight:600,color:G.ink}}>{c.name}</span><span style={{fontSize:11,fontWeight:700,color:G.dark}}>{fmt(c.rev)}</span></div>
                  <div style={{height:4,background:G.pale,borderRadius:2}}><div style={{height:"100%",width:pct(c.rev,topCust[0]?.rev||1),background:G.mid,borderRadius:2}}/></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.red,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:G.white,fontWeight:700,fontSize:12}}>⚠ AR Aging</span>
            <Btn sm v="secondary" onClick={()=>exportCsv("ar_aging.csv",ar.filter(r=>r.balance>0),[["custName","Customer"],["city","City"],["billed","Billed"],["paid","Paid"],["balance","Balance"]])}>⬇ Export</Btn>
          </div>
          <TblWrap compact heads={["Customer","Outstanding","Invoices","Action"]}
            rows={ar.filter(r=>r.balance>0).sort((a,b)=>b.balance-a.balance).map(r=>[<span style={{fontWeight:700,fontSize:11}}>{r.custName}</span>,<span style={{fontWeight:800,color:G.red,fontSize:11}}>{fmt(r.balance)}</span>,<span style={{fontSize:10,color:G.muted}}>{invoices.filter(i=>i.custId===r.custId&&i.status!=="Paid"&&i.status!=="VOIDED").length}</span>,<Btn sm v="danger" onClick={()=>{
              const c=custMap[r.custId];
              const ph=(c?.phone||"").replace(/[^\d]/g,"");
              if(!ph){notify("No phone number saved for "+r.custName,"err");return;}
              const msg=encodeURIComponent(`Dear ${r.custName}, your outstanding balance with ${CONFIG.company.name} is ${fmt(r.balance)}. Kindly arrange payment at your earliest convenience. Thank you.`);
              window.open(`https://wa.me/${ph.startsWith("92")?ph:ph.replace(/^0/,"92")}?text=${msg}`,"_blank");
            }}>Follow Up</Btn>])}
          />
        </div>
      </div>
    );
  };

  const Vendors = () => (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <Btn sm onClick={()=>setModal({t:"addVendor"})}>+ Add Vendor</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
        {vendors.map(v=>{const apRow=ap.find(a=>a.vendorId===v.id)||{};return(
          <div key={v.id} style={{background:G.card,borderRadius:11,padding:16,boxShadow:"0 2px 10px rgba(15,23,42,0.07)",borderLeft:`4px solid ${G.mid}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{fontWeight:800,fontSize:14,color:G.ink,marginBottom:2}}>{v.name}</div>
              <Btn sm v="ghost" onClick={()=>setModal({t:"editVendor",d:v})}>✏️</Btn>
            </div>
            <div style={{fontSize:10,color:G.muted,marginBottom:2}}>{v.id} · {v.category}</div>
            <div style={{fontSize:10,color:G.muted,marginBottom:10}}>{v.contact} · {v.phone}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
              {[{l:"Ordered",v:fmt(apRow.totalOrdered||0)},{l:"Paid",v:fmt(apRow.totalPaid||0)},{l:"AP Due",v:fmt(apRow.balance||0),red:(apRow.balance||0)>0}].map(s=>(
                <div key={s.l} style={{background:G.pale,borderRadius:6,padding:"7px 5px",textAlign:"center"}}>
                  <div style={{fontSize:10,fontWeight:700,color:s.red?(apRow.balance||0)>0?G.red:G.dark:G.dark,lineHeight:1.2}}>{s.v}</div>
                  <div style={{fontSize:8,color:G.muted,marginTop:1}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        );})}
      </div>
    </div>
  );

  // ── MODALS ────────────────────────────────────────────────
  const renderModal = () => {
    if(!modal) return null;

    // ── New / Edit Invoice ────────────────────────────────────
    if(modal.t==="newInvoice"||modal.t==="editInvoice"){
      const editing = modal.t==="editInvoice" ? modal.d : null;
      const prefill = modal.t==="newInvoice" ? modal.prefill : null;
      const InvForm=stable("InvForm",()=>()=>{
        const [f,setF]=useState({custId:editing?.custId||prefill?.custId||"",date:editing?.date||todayStr(),payTerms:editing?.payTerms||prefill?.payTerms||"COD",notes:prefill?.notes||"",items:(prefill?.items&&prefill.items.length)?prefill.items:[{pid:"",qty:1,rate:0}]});
        const [loading, setLoading] = useState(false);
        const [itemsLoading, setItemsLoading] = useState(!!editing);
        const total=f.items.reduce((s,i)=>s+(+i.qty||0)*(+i.rate||0),0);

        useEffect(()=>{
          if(!editing) return;
          let on=true;
          sbPost("invoice_items",{invoice_id:editing.id})
            .then(d=>{
              if(!on) return;
              const items=(Array.isArray(d)&&d.length)?d.map(it=>({pid:it.product_id||it.pid,pname:it.product_name||it.pname,qty:it.qty,rate:it.rate})):[{pid:"",qty:1,rate:0}];
              setF(p=>({...p,items}));
              setItemsLoading(false);
            })
            .catch(e=>{ if(on){ notify("❌ Could not load items: "+e.message,"err"); setItemsLoading(false);} });
          return ()=>{on=false;};
        },[]);

        const handleSave = async () => {
          if (!f.custId) { notify(`Please select a ${CW.toLowerCase()}`, "err"); return; }
          if (f.items.some(item => !item.pid)) { notify("Please select a product for all lines", "err"); return; }
          setLoading(true);
          try {
            if (editing) await editInvoice({...f, invId: editing.id});
            else await saveInvoice(f);
          } catch(e) {
            // Error is handled inside saveInvoice/editInvoice
          } finally {
            setLoading(false);
          }
        };
        const setLine=(i,k,v)=>setF(p=>{
          const it=[...p.items];
          it[i]={...it[i],[k]:v};
          if(k==="pid"){
            const pr=prodMap[v];
            if(pr){
              it[i].rate=pr.tradePrice;
              it[i].pname=pr.name;
            }
          }
          return{...p,items:it};
        });
        const nextInvId = (() => {
          const ids = invoices.map(i=>i.id).filter(id=>/^INV-\d+$/.test(id));
          const max = ids.length ? Math.max(...ids.map(id=>parseInt(id.split('-')[1],10))) : 9;
          return `INV-${String(Math.max(max+1,10)).padStart(4,'0')}`;
        })();
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:G.pale,borderRadius:8,padding:"7px 12px",fontSize:11,color:G.dark,fontWeight:600,marginBottom:2}}>
              Invoice # <span style={{color:G.mid,fontWeight:800}}>{editing?editing.id:nextInvId}</span> {!editing&&<span style={{color:G.muted,fontWeight:400}}>(auto-assigned on save)</span>}
            </div>
            {itemsLoading&&<div style={{fontSize:11,color:G.muted}}>⏳ Loading invoice items…</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Sel label="Customer" value={f.custId} onChange={e=>setF(p=>({...p,custId:e.target.value}))}>
                <option value="">— Select {CW} —</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name} ({c.area})</option>)}
              </Sel>
              <Inp label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))}/>
              <Sel label="Payment Terms" value={f.payTerms} onChange={e=>setF(p=>({...p,payTerms:e.target.value}))}>
                {(vertical.payTerms||["COD","NET 7","NET 15","NET 30"]).map(t=><option key={t}>{t}</option>)}
              </Sel>
              <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Ref / notes"/>
            </div>
            <div style={{fontWeight:700,color:G.dark,fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>Line Items</div>
            {f.items.map((item,idx)=>(
              <div key={idx} style={{display:"grid",gridTemplateColumns:"2fr 0.6fr 1fr 1fr auto",gap:8,alignItems:"flex-end"}}>
                <Sel value={item.pid} onChange={e=>setLine(idx,"pid",e.target.value)}>
                  <option value="">— Product —</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  {item.pid&&!prodMap[item.pid]&&<option value={item.pid}>{item.pname||"Rider product"} (not in catalog)</option>}
                </Sel>
                <Inp type="number" min="1" value={item.qty} onChange={e=>setLine(idx,"qty",e.target.value)} placeholder="Qty"/>
                <Inp type="number" value={item.rate} onChange={e=>setLine(idx,"rate",e.target.value)} placeholder="Rate"/>
                <div style={{background:G.pale,borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:700,color:G.dark,display:"flex",alignItems:"center"}}>{fmt((+item.qty||0)*(+item.rate||0))}</div>
                <button onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==idx)}))} style={{background:G.pink,border:"none",borderRadius:7,padding:"8px 9px",cursor:"pointer",color:G.red,fontWeight:800}}>✕</button>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <Btn v="ghost" sm onClick={()=>setF(p=>({...p,items:[...p.items,{pid:"",qty:1,rate:0}]}))}>+ Line</Btn>
              <span style={{fontWeight:800,fontSize:15,color:G.ink}}>Total: {fmt(total)}</span>
            </div>
            <div style={{background:"#E8F0FE",borderRadius:8,padding:"9px 12px",fontSize:11,color:G.blue,fontWeight:600}}>
              🖨 Invoice document is generated in your browser and opens in a new tab (Print → Save as PDF)
            </div>
             <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6,paddingTop:10,borderTop:`1px solid ${G.pale}`}}>
              <Btn v="secondary" onClick={closeModal} disabled={loading}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={loading||itemsLoading}>
                {loading ? "⏳ Saving…" : editing ? "💾 Update + Open PDF" : "💾 Save + Open PDF"}
              </Btn>
            </div>
          </div>
        );
      });
      return <Modal title={editing?`✏️ Edit Invoice — ${editing.id}`:"🧾 New Invoice"} onClose={closeModal} wide><InvForm/></Modal>;
    }

    // ── View Invoice (with PDF download + Void) ──────────────
    if(modal.t==="viewInvoice"){
      const inv=modal.d;
      return(
        <Modal title={`Invoice — ${inv.id}`} onClose={closeModal} wide>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
            {[{l:"Invoice #",v:inv.id},{l:"Customer",v:inv.custName},{l:"Date",v:inv.date},{l:"Status",v:inv.status},{l:"Total",v:fmt(inv.total)},{l:"Terms",v:inv.payTerms||"COD"},{l:"Age",v:(inv.status==="Paid"||inv.status==="VOIDED"||ageDaysOf(inv)==null)?"—":`${ageDaysOf(inv)} days`},{l:"Created By",v:(inv.createdBy||"").split("@")[0]}].map(r=>(
              <div key={r.l} style={{background:G.pale,borderRadius:7,padding:"8px 11px"}}>
                <div style={{fontSize:8,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>{r.l}</div>
                <div style={{fontSize:12,fontWeight:600,color:G.ink}}>{r.v}</div>
              </div>
            ))}
          </div>
          {/* Line items detail */}
          <InvoiceItems invId={inv.id}/>
          {/* PDF Button — prominently placed */}
          <div style={{background:"#E3F2FD",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:G.blue,marginBottom:2}}>📄 Invoice PDF</div>
              <div style={{fontSize:10,color:G.muted}}>Generated in-browser · Print or save as PDF from the new tab</div>
            </div>
            <PdfBtn invId={inv.id} pdfUrl={pdfCache[inv.id]} onGenerate={u=>cachePdf(inv.id,u)}/>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",width:"100%"}}>
            <div style={{display:"flex",gap:8}}>
              {inv.status!=="VOIDED"&&<Btn v="secondary" onClick={()=>setModal({t:"editInvoice",d:inv})}>✏️ Edit</Btn>}
              <Btn v="danger" onClick={()=>deleteInvoice(inv.id)}>🗑️ Delete Permanently</Btn>
            </div>
            <div style={{display:"flex",gap:8}}>
              {(inv.status==="Unpaid"||inv.status==="Partial")&&<Btn v="success" onClick={()=>{markPaid(inv.id);closeModal();}}>✓ Mark Paid</Btn>}
              {(inv.status==="Unpaid"||inv.status==="Partial")&&<Btn v="secondary" onClick={()=>{closeModal();setModal({t:"recordPayment",d:{custId:inv.custId,invId:inv.id}});}}>💳 Partial</Btn>}
              {inv.status!=="VOIDED"&&<Btn v="danger" onClick={()=>voidInvoice(inv.id)}>🗑 Void</Btn>}
            </div>
          </div>
        </Modal>
      );
    }

    // ── AR Aging Report ───────────────────────────────────────
    if(modal.t==="agingReport"){
      const open=invoices.filter(i=>i.status==="Unpaid"||i.status==="Partial");
      const sorted=[...open].sort((a,b)=>(ageDaysOf(b)||0)-(ageDaysOf(a)||0));
      const ageBuckets=[
        {label:"Critical — 45+ days",  c:G.red,   items:sorted.filter(i=>(ageDaysOf(i)||0)>45)},
        {label:"Overdue — 31–45 days", c:G.amber, items:sorted.filter(i=>{const a=ageDaysOf(i)||0;return a>30&&a<=45;})},
        {label:"Caution — 16–30 days", c:G.blue,  items:sorted.filter(i=>{const a=ageDaysOf(i)||0;return a>15&&a<=30;})},
        {label:"Current — 0–15 days",  c:G.light, items:sorted.filter(i=>(ageDaysOf(i)||0)<=15)},
      ];
      const totalOpen=open.reduce((s,i)=>s+i.total,0);
      return(
        <Modal title="📊 AR Aging Report" onClose={closeModal} wide>
          <div style={{marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
              {ageBuckets.map(b=>(
                <div key={b.label} style={{background:G.card,borderRadius:9,padding:"10px 14px",boxShadow:"0 1px 8px rgba(15,23,42,0.07)",borderLeft:`4px solid ${b.c}`}}>
                  <div style={{fontSize:9,color:G.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{b.label}</div>
                  <div style={{fontSize:15,fontWeight:800,color:b.c}}>{fmt(b.items.reduce((s,i)=>s+i.total,0))}</div>
                  <div style={{fontSize:9,color:G.muted,marginTop:2}}>{b.items.length} invoice{b.items.length!==1?"s":""}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:G.muted,fontWeight:600,marginBottom:10}}>Total Outstanding: <span style={{color:G.ink,fontWeight:800}}>{fmt(totalOpen)}</span> across <b>{open.length}</b> open invoices</div>
            {ageBuckets.map(b=>b.items.length>0&&(
              <div key={b.label} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:10,fontWeight:800,color:b.c,textTransform:"uppercase",letterSpacing:0.5}}>{b.label}</div>
                  <div style={{fontSize:10,fontWeight:700,color:b.c}}>{fmt(b.items.reduce((s,i)=>s+i.total,0))}</div>
                </div>
                <TblWrap compact heads={["Invoice","Customer","Date","Total","Status","Days"]}
                  rows={b.items.map(inv=>[
                    <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{inv.id}</span>,
                    <span style={{fontSize:11}}>{inv.custName}</span>,
                    <span style={{fontSize:10,color:G.muted}}>{inv.date}</span>,
                    <span style={{fontWeight:700,fontSize:11}}>{fmt(inv.total)}</span>,
                    <Badge text={inv.status}/>,
                    <span style={{fontSize:11,fontWeight:800,color:b.c}}>{ageDaysOf(inv)}d</span>,
                  ])}
                />
              </div>
            ))}
            {open.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:G.mid,fontWeight:700}}>🎉 No outstanding invoices</div>}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn v="secondary" onClick={closeModal}>Close</Btn>
            <Btn v="secondary" onClick={()=>exportCsv("aging_report.csv",sorted.map(i=>({...i,ageDays:ageDaysOf(i)??''})),[["id","Invoice"],["date","Date"],["custName","Customer"],["total","Total"],["status","Status"],["ageDays","Age (days)"]])}>⬇ Export</Btn>
          </div>
        </Modal>
      );
    }

    // ── Record Payment (AR — customer receipts only) ──────────
    if(modal.t==="recordPayment"){
      const PayForm=stable("PayForm",()=>()=>{
        const init=modal.d||{};
        const [f,setF]=useState({date:todayStr(),type:"Received",custId:init.custId||"",invId:init.invId||"",amount:"",method:"Cash",notes:""});
        const outstanding = ar.find(r=>r.custId===f.custId)?.balance || 0;
        const remaining   = Math.max(0, outstanding - parseFloat(f.amount||0));
        const overpaid    = parseFloat(f.amount||0) > outstanding && outstanding > 0;
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))}/>
              <Sel label="Customer" value={f.custId} onChange={e=>{
                const cid=e.target.value;
                const bal=ar.find(r=>r.custId===cid)?.balance||0;
                setF(p=>({...p,custId:cid,invId:"",amount:bal>0?String(Math.round(bal)):""}));
              }}>
                <option value="">— Select Customer —</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}{ar.find(r=>r.custId===c.id)?.balance>0?" ⚠":"" }</option>)}
              </Sel>
              {f.custId&&<div style={{gridColumn:"1/-1",background:outstanding>0?G.pink:G.pale,borderRadius:8,padding:"8px 12px",fontSize:11}}>
                <span style={{fontWeight:700,color:outstanding>0?G.red:G.mid}}>Outstanding: {fmt(outstanding)}</span>
                {f.amount&&outstanding>0&&<span style={{marginLeft:14,color:remaining>0?G.amber:G.mid,fontWeight:600}}> → After payment: {fmt(remaining)}</span>}
                {overpaid&&<span style={{marginLeft:10,color:G.red,fontWeight:700}}>⚠ Overpayment of {fmt(parseFloat(f.amount||0)-outstanding)}</span>}
              </div>}
              <Sel label="Against Invoice (optional)" value={f.invId} onChange={e=>setF(p=>({...p,invId:e.target.value}))}>
                <option value="">— No specific invoice —</option>
                {invoices.filter(i=>i.custId===f.custId&&i.status!=="Paid").map(i=><option key={i.id} value={i.id}>{i.id} — {fmt(i.total)} ({i.status})</option>)}
              </Sel>
              <Inp label={`Amount (${CONFIG.currency})`} type="number" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} placeholder="0"/>
              <Sel label="Method" value={f.method} onChange={e=>setF(p=>({...p,method:e.target.value}))}>
                {["Cash","Bank Transfer","EasyPaisa","JazzCash","Cheque"].map(m=><option key={m}>{m}</option>)}
              </Sel>
            </div>
            <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Reference or memo"/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn v="success" onClick={()=>{if(!f.custId){notify("Select a customer","err");return;}if(!validNum(f.amount)||+f.amount<=0){notify("Enter a valid amount","err");return;}savePayment({...f,type:"Received"});}}>💾 Save Payment</Btn>
            </div>
          </div>
        );
      });
      return <Modal title="💳 Collect Payment (AR)" onClose={closeModal}><PayForm/></Modal>;
    }

    // ── Vendor Payment (AP — vendor payments only) ────────────
    if(modal.t==="vendorPayment"){
      const VenPayForm=stable("VenPayForm",()=>()=>{
        const init=modal.d||{};
        const [f,setF]=useState({date:todayStr(),vendorId:init.vendorId||"",amount:"",method:"Cash",notes:""});
        const outstanding = ap.find(r=>r.vendorId===f.vendorId)?.balance || 0;
        const remaining   = Math.max(0, outstanding - parseFloat(f.amount||0));
        const overpaid    = parseFloat(f.amount||0) > outstanding && outstanding > 0;
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))}/>
              <Sel label="Vendor" value={f.vendorId} onChange={e=>{
                const vid=e.target.value;
                const bal=ap.find(r=>r.vendorId===vid)?.balance||0;
                setF(p=>({...p,vendorId:vid,amount:bal>0?String(Math.round(bal)):""}));
              }}>
                <option value="">— Select Vendor —</option>
                {vendors.map(v=><option key={v.id} value={v.id}>{v.name}{ap.find(r=>r.vendorId===v.id)?.balance>0?" ⚠":""}</option>)}
              </Sel>
              {f.vendorId&&<div style={{gridColumn:"1/-1",background:outstanding>0?G.pink:G.pale,borderRadius:8,padding:"8px 12px",fontSize:11}}>
                <span style={{fontWeight:700,color:outstanding>0?G.red:G.mid}}>AP Outstanding: {fmt(outstanding)}</span>
                {f.amount&&outstanding>0&&<span style={{marginLeft:14,color:remaining>0?G.amber:G.mid,fontWeight:600}}> → After payment: {fmt(remaining)}</span>}
                {overpaid&&<span style={{marginLeft:10,color:G.red,fontWeight:700}}>⚠ Overpayment of {fmt(parseFloat(f.amount||0)-outstanding)}</span>}
              </div>}
              <Inp label={`Amount (${CONFIG.currency})`} type="number" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} placeholder="0"/>
              <Sel label="Method" value={f.method} onChange={e=>setF(p=>({...p,method:e.target.value}))}>
                {["Cash","Bank Transfer","EasyPaisa","JazzCash","Cheque"].map(m=><option key={m}>{m}</option>)}
              </Sel>
            </div>
            <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Reference or memo"/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn v="success" onClick={()=>{if(!f.vendorId){notify("Select a vendor","err");return;}if(!validNum(f.amount)||+f.amount<=0){notify("Enter a valid amount","err");return;}savePayment({...f,type:"Made",vendorId:f.vendorId});}}>💾 Save Payment</Btn>
            </div>
          </div>
        );
      });
      return <Modal title="💳 Vendor Payment (AP)" onClose={closeModal}><VenPayForm/></Modal>;
    }

    // ── Add Expense ───────────────────────────────────────────
    if(modal.t==="addExpense"){
      const ExpForm=stable("ExpForm",()=>()=>{
        const [f,setF]=useState({date:todayStr(),category:(vertical.expenseCats||["Salaries"])[0],amount:"",notes:""});
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Date" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))}/>
              <Sel label="Category" value={f.category} onChange={e=>setF(p=>({...p,category:e.target.value}))}>
                {(vertical.expenseCats||["Salaries","Utilities","Marketing","Misc"]).map(c=><option key={c}>{c}</option>)}
              </Sel>
            </div>
            <Inp label={`Amount (${CONFIG.currency})`} type="number" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} placeholder="0"/>
            <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="What is this for?"/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={()=>{if(!validNum(f.amount)||+f.amount<=0){notify("Enter a valid amount","err");return;}saveExpense(f);}}>💾 Save Expense</Btn>
            </div>
          </div>
        );
      });
      return <Modal title="💸 Add Expense" onClose={closeModal}><ExpForm/></Modal>;
    }

    // ── Adjust Stock (goods receipt / correction) ─────────────
    if(modal.t==="adjustStock"){
      const p=modal.d;
      const AdjForm=stable("AdjForm",()=>()=>{
        const [mode,setMode]=useState("add");
        const [qty,setQty]=useState("");
        const [reason,setReason]=useState("");
        const delta=mode==="add"?Math.abs(+qty||0):-Math.abs(+qty||0);
        const newStock=(p.stock||0)+delta;
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:G.pale,borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:600,color:G.dark}}>
              {p.pname} <span style={{color:G.muted}}>({p.pid})</span> · Current stock: <b>{p.stock}</b>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Sel label="Action" value={mode} onChange={e=>setMode(e.target.value)}>
                <option value="add">Receive / Add (+)</option>
                <option value="remove">Remove / Correct (−)</option>
              </Sel>
              <Inp label="Quantity" type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/>
            </div>
            <Inp label="Reason (optional)" value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Goods received, stock count fix"/>
            <div style={{fontSize:12,color:newStock<0?G.red:G.mid,fontWeight:700}}>New stock: {newStock}{newStock<0?" — cannot go below 0":""}</div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={()=>{if(!validNum(qty)||+qty<=0){notify("Enter a valid quantity","err");return;}if(newStock<0){notify("Stock cannot go below 0","err");return;}adjustStock({pid:p.pid,delta,reason});}}>💾 Apply</Btn>
            </div>
          </div>
        );
      });
      return <Modal title={`📦 Adjust Stock — ${p.pid}`} onClose={closeModal}><AdjForm/></Modal>;
    }

    // ── New Purchase ──────────────────────────────────────────
    if(modal.t==="newPurchase"){
      const PurForm=stable("PurForm",()=>()=>{
        const [f,setF]=useState({vendorId:"",date:todayStr(),total:"",paid:"0",notes:""});
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Sel label="Vendor" value={f.vendorId} onChange={e=>setF(p=>({...p,vendorId:e.target.value}))}>
              <option value="">— Select Vendor —</option>
              {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </Sel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="PO Date" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))}/>
              <Inp label={`Total Amount (${CONFIG.currency})`} type="number" value={f.total} onChange={e=>setF(p=>({...p,total:e.target.value}))} placeholder="0"/>
              <Inp label="Amount Paid" type="number" value={f.paid} onChange={e=>setF(p=>({...p,paid:e.target.value}))} placeholder="0"/>
              <Inp label="Notes / Vendor Invoice Ref" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Invoice #"/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={()=>{if(!f.vendorId){notify("Select a vendor","err");return;}if(!validNum(f.total)||+f.total<=0){notify("Enter a valid total","err");return;}if(!validNum(f.paid)){notify("Paid amount is invalid","err");return;}if(+f.paid>+f.total){notify("Paid cannot exceed total","err");return;}savePurchase(f);}}>💾 Save Purchase</Btn>
            </div>
          </div>
        );
      });
      return <Modal title="🛒 New Purchase" onClose={closeModal}><PurForm/></Modal>;
    }

    // ── Add Customer ──────────────────────────────────────────
    if(modal.t==="addCustomer"){
      const CustForm=stable("CustForm",()=>()=>{
        const [f,setF]=useState({name:"",city:vertical.defaultCity||"",area:"",contact:"",phone:"",notes:""});
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label={`${CW} Name`} value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="Business name"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Area / Zone" value={f.area} onChange={e=>setF(p=>({...p,area:e.target.value}))} placeholder="F-7 Markaz"/>
              <Inp label="City" value={f.city} onChange={e=>setF(p=>({...p,city:e.target.value}))} placeholder="City"/>
              <Inp label="Purchaser Name" value={f.contact} onChange={e=>setF(p=>({...p,contact:e.target.value}))}/>
              <Inp label="Purchaser Phone" value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value}))} placeholder="+92..."/>
            </div>
            <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={()=>{if(!f.name.trim()){notify("Enter a name","err");return;}addCustomer(f);}}>💾 Add {CW}</Btn>
            </div>
          </div>
        );
      });
      return <Modal title={`➕ Add ${CW}`} onClose={closeModal}><CustForm/></Modal>;
    }

    // ── Add Vendor ────────────────────────────────────────────
    if(modal.t==="addVendor"){
      const VenForm=stable("VenForm",()=>()=>{
        const [f,setF]=useState({name:"",category:"",contact:"",phone:"",openBal:"0",notes:""});
        const save=async()=>{
          if(!f.name){notify("Enter vendor name","err");return;}
          try{await sbPost("upsert_vendor",{vendor:{id:`VEN-${Date.now()}`,name:f.name,category:f.category,contact:f.contact,mobile:f.phone,open_bal:Number(f.openBal)||0,notes:f.notes}});notify("✅ Vendor added");closeModal();await loadData(true);}
          catch(e){notify("❌ "+e.message,"err");}
        };
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Vendor Name" value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="Company name"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Category" value={f.category} onChange={e=>setF(p=>({...p,category:e.target.value}))} placeholder="e.g. Skincare, Food"/>
              <Inp label="Contact Person" value={f.contact} onChange={e=>setF(p=>({...p,contact:e.target.value}))}/>
              <Inp label="Phone" value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value}))} placeholder="+92..."/>
              <Inp label={`Opening Balance (${CONFIG.currency})`} type="number" value={f.openBal} onChange={e=>setF(p=>({...p,openBal:e.target.value}))}/>
            </div>
            <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={save}>💾 Add Vendor</Btn>
            </div>
          </div>
        );
      });
      return <Modal title="🏭 Add Vendor" onClose={closeModal}><VenForm/></Modal>;
    }

    // ── Edit Customer ─────────────────────────────────────────
    if(modal.t==="editCustomer"){
      const c=modal.d;
      const EditCustForm=stable("EditCustForm",()=>()=>{
        const [f,setF]=useState({name:c.name||"",city:c.city||"",area:c.area||"",contact:c.contact||"",phone:c.phone||"",notes:c.notes||""});
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label={`${CW} Name`} value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Area / Zone" value={f.area} onChange={e=>setF(p=>({...p,area:e.target.value}))} placeholder="F-7 Markaz"/>
              <Inp label="City" value={f.city} onChange={e=>setF(p=>({...p,city:e.target.value}))} placeholder="City"/>
              <Inp label="Purchaser Name" value={f.contact} onChange={e=>setF(p=>({...p,contact:e.target.value}))}/>
              <Inp label="Purchaser Phone" value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value}))} placeholder="+92..."/>
            </div>
            <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={()=>{if(!f.name){notify("Enter a name","err");return;}updateCustomer({...f,id:c.id});}}>💾 Update</Btn>
            </div>
          </div>
        );
      });
      return <Modal title={`✏️ Edit ${CW} — ${c.id}`} onClose={closeModal}><EditCustForm/></Modal>;
    }

    // ── Edit Vendor ───────────────────────────────────────────
    if(modal.t==="editVendor"){
      const v=modal.d;
      const EditVenForm=stable("EditVenForm",()=>()=>{
        const [f,setF]=useState({name:v.name||"",category:v.category||"",contact:v.contact||"",phone:v.phone||"",notes:v.notes||""});
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Vendor Name" value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Category" value={f.category} onChange={e=>setF(p=>({...p,category:e.target.value}))}/>
              <Inp label="Contact Person" value={f.contact} onChange={e=>setF(p=>({...p,contact:e.target.value}))}/>
              <Inp label="Phone" value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value}))} placeholder="+92..."/>
            </div>
            <Inp label="Notes" value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={()=>{if(!f.name){notify("Enter vendor name","err");return;}updateVendor({...f,id:v.id});}}>💾 Update</Btn>
            </div>
          </div>
        );
      });
      return <Modal title={`✏️ Edit Vendor — ${v.id}`} onClose={closeModal}><EditVenForm/></Modal>;
    }

    // ── View Customer ─────────────────────────────────────────
    if(modal.t==="viewCustomer"){
      const c=modal.d;
      const cinv=invoices.filter(i=>i.custId===c.id);
      const outstanding=ar.find(r=>r.custId===c.id)?.balance||0;
      return(
        <Modal title={c.name} onClose={closeModal} wide>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
            {[{l:"ID",v:c.id},{l:"Area",v:c.area},{l:"City",v:c.city},{l:"Phone",v:c.phone||"—"},{l:"Contact",v:c.contact||"—"},{l:"Open Bal",v:fmt(c.openBal)}].map(r=>(
              <div key={r.l} style={{background:G.pale,borderRadius:7,padding:"8px 11px"}}>
                <div style={{fontSize:8,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>{r.l}</div>
                <div style={{fontSize:12,fontWeight:600,color:G.ink}}>{r.v}</div>
              </div>
            ))}
          </div>
          {outstanding>0&&<div style={{background:G.pink,borderRadius:8,padding:"9px 12px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,color:G.red,fontSize:12}}>⚠ Outstanding: {fmt(outstanding)}</span>
            <Btn sm v="success" onClick={()=>{closeModal();setModal({t:"recordPayment",d:{custId:c.id}});}}>Collect</Btn>
          </div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
            <Btn sm v="secondary" onClick={()=>setModal({t:"editCustomer",d:c})}>✏️ Edit {CW}</Btn>
          </div>
          <TblWrap compact heads={["Invoice","Date","Total","Status","PDF"]}
            rows={cinv.map(inv=>[
              <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{inv.id}</span>,
              <span style={{fontSize:10,color:G.muted}}>{inv.date}</span>,
              <span style={{fontWeight:700,fontSize:11}}>{fmt(inv.total)}</span>,
              <Badge text={inv.status}/>,
              <PdfBtn invId={inv.id} pdfUrl={pdfCache[inv.id]} onGenerate={u=>cachePdf(inv.id,u)} sm/>,
            ])}
          />
        </Modal>
      );
    }

    if(modal.t==="viewRiderStore"){
      const s=modal.d;
      const store=sbData.stores.find(st=>st.id===s._storeId)||{};
      return(
        <Modal title={s.name} onClose={closeModal}>
          <div style={{background:"#E0F2F1",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:11,color:"#00695C",fontWeight:600}}>
            Rider Store — not yet added to the Customers list. Use the <b>Rider Stores</b> tab to sync it.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
            {[{l:"Area",v:s.area||"—"},{l:"Phone",v:s.phone||"—"},{l:"Contact",v:s.contact||"—"},{l:"Category",v:store.category||"—"}].map(r=>(
              <div key={r.l} style={{background:G.pale,borderRadius:7,padding:"8px 11px"}}>
                <div style={{fontSize:8,fontWeight:700,color:G.muted,textTransform:"uppercase",marginBottom:2}}>{r.l}</div>
                <div style={{fontSize:12,fontWeight:600,color:G.ink}}>{r.v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn sm v="secondary" onClick={()=>{closeModal();setTab("rider-stores");}}>Go to Rider Stores →</Btn>
            <Btn sm v="success" onClick={()=>{closeModal();importRiderStores([s]);}}>⬆ Import to Customers</Btn>
          </div>
        </Modal>
      );
    }

    return null;
  };

  // ── RIDER HUB TABS ────────────────────────────────────────
  const STATUS_NEXT = {Pending:"Approved",Approved:"Packed",Packed:"Dispatched",Dispatched:"Delivered"};
  const STATUS_CLR  = {Pending:G.amber,Approved:G.blue,Packed:G.purple,Dispatched:"#00897B",Delivered:G.mid,Cancelled:G.red,Rejected:G.red};

  const RiderOrdersTab = () => {
    const [statusFilter, setStatusFilter] = useState("all");
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(null);
    const filtered = sbData.orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) { const s = q.toLowerCase(); return (o.id||"").toLowerCase().includes(s)||(o.stores?.name||"").toLowerCase().includes(s)||(o.profiles?.full_name||"").toLowerCase().includes(s); }
      return true;
    });
    const advance = async (o) => {
      const next = STATUS_NEXT[o.status]; if (!next) return;
      const prevStatus = o.status;
      setBusy(o.id);
      try {
        await sbPost("update_order_status",{id:o.id,status:next}); notify(`✅ Order → ${next}`); await loadSupabase(true);
        pushUndo(`Order #${(o.id||"").slice(0,8)} → ${next}`, async () => {
          await sbPost("update_order_status",{id:o.id,status:prevStatus}); await loadSupabase(true);
        });
        if (next==="Approved") await startInvoice({...o, status:next});
      }
      catch(e) { notify("❌ "+e.message,"err"); } finally { setBusy(null); }
    };
    // Open the New Invoice journey prefilled from a rider order: maps the rider's store to its
    // Sheets customer (via gas_customer_id) and its order items to Sheets products by name.
    const startInvoice = async (o) => {
      // Prefer the full store record — sbData.stores carries mobile/address/payment_terms,
      // whereas the order-embedded o.stores only has id/name/area/category.
      const store = sbData.stores.find(s=>s.id===o.store_id) || o.stores || {};
      const custId = (store?.gas_customer_id && customers.some(c=>c.id===store.gas_customer_id)) ? store.gas_customer_id : "";
      if(!custId) notify("⚠ This store isn't in Customers yet — use “Sync to Customers”, or pick the store in the invoice","err");
      // Robust matcher: rider product names rarely match Sheets product names exactly, so
      // normalize and fall back to a contains-match. Without this the line shows qty/rate but
      // the product dropdown stays blank.
      const prodList = products.map(p=>({p,n:normTxt(p.name)}));
      const byNorm={}; prodList.forEach(x=>{ if(x.n) byNorm[x.n]=x.p; });
      const matchProduct = (name)=>{
        const n=normTxt(name); if(!n) return null;
        if(byNorm[n]) return byNorm[n];
        const hit = prodList.find(x=>x.n&&(x.n.includes(n)||n.includes(x.n)));
        return hit?hit.p:null;
      };
      let items=[];
      try {
        const rows = await sbPost("order_items",{order_id:o.id});
        items = (rows||[]).map(it=>{
          const match = matchProduct(it.product_name);
          const rate = Number(it.trade_price) || (it.quantity?Number(it.total)/Number(it.quantity):0);
          const name = it.product_name||(match?match.name:"");
          // If a rider product isn't in the Sheets catalog, keep it visible + selected via a
          // synthetic "x:" id (blanked on save, pname preserved) instead of a blank dropdown.
          const pid = match ? match.id : (name ? "x:"+(it.product_id||normTxt(name)) : "");
          return { pid, pname: name, qty: it.quantity||1, rate: Math.round(rate||0) };
        });
      } catch(e) { notify("Could not load order items: "+e.message,"err"); }
      if(!items.length) items=[{pid:"",qty:1,rate:0}];
      // Carry the store's contact + payment terms into the invoice notes.
      const ptMap={cash:"Cash / COD",bill_to_bill:"Bill to Bill",credit_25_days:"25 Days Credit"};
      const ptLabel = ptMap[store?.payment_terms]||store?.payment_terms||"";
      const payTermsMap={cash:"COD",bill_to_bill:"NET 7",credit_25_days:"NET 30"};
      const noteParts=[];
      if(store?.name) noteParts.push(`Store: ${store.name}`);
      if(store?.mobile) noteParts.push(`📞 ${store.mobile}`);
      const loc = store?.address||store?.area; if(loc) noteParts.push(loc);
      if(ptLabel) noteParts.push(`Terms: ${ptLabel}`);
      if(o.profiles?.full_name) noteParts.push(`Rider: ${o.profiles.full_name}`);
      noteParts.push(`Order #${(o.id||"").slice(0,8)}`);
      setModal({t:"newInvoice", prefill:{ custId, payTerms:payTermsMap[store?.payment_terms]||"COD", notes:noteParts.join(" · "), items }});
    };
    const cancel = async (o) => {
      if (!confirm(`Cancel order?`)) return;
      const prevStatus = o.status;
      setBusy(o.id+"_c");
      try {
        await sbPost("update_order_status",{id:o.id,status:"Cancelled"}); notify("Order cancelled"); await loadSupabase(true);
        pushUndo(`Order #${(o.id||"").slice(0,8)} cancelled`, async () => {
          await sbPost("update_order_status",{id:o.id,status:prevStatus}); await loadSupabase(true);
        });
      }
      catch(e) { notify("❌ "+e.message,"err"); } finally { setBusy(null); }
    };
    if (sbLoading) return <div style={{padding:40,textAlign:"center",color:G.muted}}>⏳ Loading rider orders…</div>;
    const exportOrdersCsv = ()=>exportCsv("rider-orders.csv",filtered.map(o=>({id:o.id,date:(o.created_at||"").slice(0,10),store:o.stores?.name,rider:o.profiles?.full_name,total:o.total_value||o.total||0,status:o.status,gas_invoice_id:o.gas_invoice_id})),[["id","Order"],["date","Date"],["store","Store"],["rider","Rider"],["total","Total"],["status","Status"],["gas_invoice_id","GAS Invoice"]]);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Status chips */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all","Pending","Approved","Packed","Dispatched","Delivered","Cancelled"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} style={{padding:"5px 13px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",background:statusFilter===s?G.dark:G.pale,color:statusFilter===s?G.white:G.dark,border:`1.5px solid ${statusFilter===s?G.dark:G.border}`,minHeight:32}}>{s==="all"?"All":s}</button>
          ))}
        </div>
        {/* Search + actions */}
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search order / store / rider…" style={{flex:"1 1 160px",border:`1.5px solid ${G.border}`,borderRadius:8,padding:"7px 11px",fontSize:12,color:G.ink,background:G.bg,outline:"none"}}/>
          <Btn sm v="secondary" onClick={exportOrdersCsv}>⬇ Export</Btn>
          <Btn sm v="secondary" onClick={()=>loadSupabase()}>↻</Btn>
        </div>
        {/* Orders list */}
        {isMobile ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtered.map(o=>(
              <div key={o.id} style={{background:G.card,borderRadius:12,padding:14,boxShadow:"0 2px 8px rgba(15,23,42,0.07)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:G.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.stores?.name||"—"}</div>
                    <div style={{fontSize:10,color:G.muted,marginTop:2}}>{o.profiles?.full_name||"—"} · {(o.created_at||"").slice(0,10)}</div>
                    {o.gas_invoice_id&&<div style={{fontSize:9,color:G.mid,marginTop:2,fontWeight:700}}>✓ {o.gas_invoice_id}</div>}
                  </div>
                  <span style={{background:(STATUS_CLR[o.status]||G.muted)+"22",color:STATUS_CLR[o.status]||G.muted,padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,flexShrink:0}}>{o.status}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div>
                    <span style={{fontWeight:800,fontSize:16,color:G.dark}}>{fmt(o.total_value||o.total||0)}</span>
                    <span style={{marginLeft:6,fontSize:9,padding:"2px 7px",borderRadius:20,fontWeight:700,background:o.payment_status==="paid"?"#E8F5E9":"#FFF8E1",color:o.payment_status==="paid"?G.mid:"#E65100"}}>{o.payment_status==="paid"?"💵 Paid":"Unpaid"}</span>
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    {STATUS_NEXT[o.status]&&<Btn sm v="primary" disabled={busy===o.id} onClick={()=>advance(o)}>{busy===o.id?"…":"→ "+STATUS_NEXT[o.status]}</Btn>}
                    {o.status!=="Pending"&&o.status!=="Cancelled"&&o.status!=="Rejected"&&!o.gas_invoice_id&&<Btn sm v="secondary" disabled={!!busy} onClick={()=>startInvoice(o)}>🧾 Invoice</Btn>}
                    {(o.status==="Pending"||o.status==="Approved")&&<Btn sm v="danger" disabled={!!busy} onClick={()=>cancel(o)}>✕</Btn>}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length===0&&<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12}}>No orders match filter</div>}
          </div>
        ) : (
          <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
            <TblWrap compact heads={["Order","Date","Store","Rider","Total","Status","Payment","Invoice","Actions"]}
              rows={filtered.map(o=>[
                <span style={{fontWeight:700,color:G.dark,fontSize:10,fontFamily:"monospace"}}>{(o.id||"").slice(0,8)}</span>,
                <span style={{fontSize:10,color:G.muted,whiteSpace:"nowrap"}}>{(o.created_at||"").slice(0,10)||"—"}</span>,
                <div><div style={{fontWeight:600,fontSize:11}}>{o.stores?.name||"—"}</div><div style={{fontSize:9,color:G.muted}}>{o.stores?.area||""}</div></div>,
                <span style={{fontSize:11}}>{o.profiles?.full_name||"—"}</span>,
                <div>
                  <div style={{fontWeight:700,fontSize:11}}>{fmt(o.total_value||o.total||0)}</div>
                  {o.payment_status==="paid"&&o.amount_paid>0&&<div style={{fontSize:9,color:G.mid,fontWeight:600}}>Coll: {fmt(o.amount_paid)}</div>}
                </div>,
                <span style={{background:(STATUS_CLR[o.status]||G.muted)+"22",color:STATUS_CLR[o.status]||G.muted,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700}}>{o.status}</span>,
                <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,fontWeight:700,background:o.payment_status==="paid"?"#E8F5E9":"#FFF8E1",color:o.payment_status==="paid"?G.mid:"#E65100"}}>{o.payment_status==="paid"?"💵 Paid":"Unpaid"}</span>,
                o.gas_invoice_id?<span style={{fontSize:9,color:G.mid,fontWeight:700}}>✓ {o.gas_invoice_id}</span>:<span style={{fontSize:9,color:G.muted}}>—</span>,
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {STATUS_NEXT[o.status]&&<Btn sm v="primary" disabled={busy===o.id} onClick={()=>advance(o)}>{busy===o.id?"…":"→ "+STATUS_NEXT[o.status]}</Btn>}
                  {o.status!=="Pending"&&o.status!=="Cancelled"&&o.status!=="Rejected"&&!o.gas_invoice_id&&<Btn sm v="secondary" disabled={!!busy} onClick={()=>startInvoice(o)}>🧾</Btn>}
                  {(o.status==="Pending"||o.status==="Approved")&&<Btn sm v="danger" disabled={!!busy} onClick={()=>cancel(o)}>✕</Btn>}
                </div>
              ])}
            />
            {filtered.length===0&&<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12}}>No orders match filter</div>}
          </div>
        )}
      </div>
    );
  };

  const RiderStoresTab = () => {
    const [storeModal, setStoreModal] = useState(null);
    const [form, setForm] = useState({});
    const [busy, setBusy] = useState(false);
    const [q, setQ] = useState("");
    const [hideDupes, setHideDupes] = useState(true);
    // Two riders adding the same physical shop creates duplicate rows here. We collapse them in
    // the CRM view + Customers sync WITHOUT deleting anything in Supabase (the rider app and its
    // orders still depend on every row). Group key = name + mobile (fallback name + area).
    const storeKey = (s)=>{ const n=normTxt(s.name), m=digitsOnly(s.mobile); return m ? n+"|"+m : n+"|"+normTxt(s.area); };
    const dupInfo = useMemo(()=>{
      const groups={};
      sbData.stores.forEach(s=>{ const k=storeKey(s); (groups[k]=groups[k]||[]).push(s); });
      const dupIds=new Set(), groupSize={};
      Object.values(groups).forEach(arr=>{
        if(arr.length<2) return;
        // Representative: prefer one already synced to Sheets, then the earliest created.
        const sorted=[...arr].sort((a,b)=>{
          const ag=a.gas_customer_id?0:1, bg=b.gas_customer_id?0:1;
          if(ag!==bg) return ag-bg;
          return new Date(a.created_at||0)-new Date(b.created_at||0);
        });
        const rep=sorted[0];
        groupSize[rep.id]=arr.length;
        arr.forEach(s=>{ if(s.id!==rep.id) dupIds.add(s.id); });
      });
      return { dupIds, groupSize };
    },[sbData.stores]);
    const filtered = sbData.stores.filter(s=>{
      if(hideDupes && dupInfo.dupIds.has(s.id)) return false;
      if(!q) return true;
      const v=q.toLowerCase();
      return(s.name||"").toLowerCase().includes(v)||(s.area||"").toLowerCase().includes(v)||(s.owner_name||"").toLowerCase().includes(v);
    });
    // Drop empty strings so nullable/enum columns (e.g. category) aren't sent as "" which fails constraints.
    const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==""&&v!==undefined&&v!==null));
    const save = async () => {
      if (!form.name) return;
      setBusy(true);
      try {
        if (storeModal==="add") { const {id,...rest}=form; await sbPost("add_store",{store:clean(rest)}); notify("✅ Store added"); }
        else { const {id}=form; await sbPost("update_store",clean({id,name:form.name,owner_name:form.owner_name,mobile:form.mobile,address:form.address,area:form.area,category:form.category})); notify("✅ Store updated"); }
        setStoreModal(null); await loadSupabase(true);
      } catch(e) { notify("❌ "+e.message,"err"); } finally { setBusy(false); }
    };
    const del = async (s) => {
      if (!confirm(`Delete ${s.name}?`)) return;
      try {
        await sbPost("delete_store",{id:s.id});
        notify("✅ Deleted");
        await loadSupabase(true);
        // Best-effort undo: re-creates the store (gets a new id — Supabase doesn't let us
        // reuse the deleted one — but restores every field so nothing is actually lost).
        pushUndo(`Deleted store "${s.name}"`, async () => {
          await sbPost("add_store",{store:clean({
            name:s.name, owner_name:s.owner_name, mobile:s.mobile, address:s.address,
            area:s.area, category:s.category, latitude:s.latitude, longitude:s.longitude,
            payment_terms:s.payment_terms, created_by:s.created_by, gas_customer_id:s.gas_customer_id
          })});
          await loadSupabase(true);
        });
      }
      catch(e) {
        const msg = /foreign key|orders_store_id_fkey/i.test(e.message)
          ? "Cannot delete — this store has orders linked to it. Remove or reassign its orders first."
          : e.message;
        notify("❌ "+msg,"err");
      }
    };
    // Bulk-push rider stores into the Google Sheets Customers list (skips test/sample and
    // already-synced stores; writes the returned customer id back onto the store for idempotency).
    const [syncing, setSyncing] = useState(false);
    const syncToCustomers = async () => {
      // Only sync de-duplicated representatives, and skip test/sample + already-synced stores.
      const candidates = sbData.stores.filter(s=>{
        const n=(s.name||"").toLowerCase();
        if(!s.name) return false;
        if(/test|sample/.test(n)) return false;
        if(s.gas_customer_id) return false;
        if(dupInfo.dupIds.has(s.id)) return false;
        return true;
      });
      if(!candidates.length){ notify("Nothing to sync — all stores are already synced, duplicates, or excluded","err"); return; }
      if(!confirm(`Add ${candidates.length} store(s) to the Customers list?\n(test/sample, duplicate and already-synced stores are skipped; stores that already exist as a customer are linked, not duplicated)`)) return;
      setSyncing(true);
      // Cross-check: index existing Sheets customers by name+phone (and name alone).
      const custByKey={}, custByName={};
      customers.forEach(c=>{ const n=normTxt(c.name); if(!n) return; custByName[n]=c; custByKey[n+"|"+digitsOnly(c.phone)]=c; });
      let created=0, linked=0, fail=0;
      for(const s of candidates){
        try{
          const n=normTxt(s.name), mobile=digitsOnly(s.mobile);
          // Match an existing customer by name+phone, or by name when the store has no phone.
          const existing = custByKey[n+"|"+mobile] || (!mobile ? custByName[n] : null);
          if(existing){
            try{ await sbPost("update_store",{id:s.id,gas_customer_id:existing.id}); }catch{/* non-fatal */}
            linked++;
            continue;
          }
          const newId = `CUST-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
          await sbPost("upsert_customer", { customer: { id: newId, name: s.name, area: s.area||"", city: "", owner_name: s.owner_name||"", mobile: s.mobile||"", open_bal: 0, notes: `supabase_id:${s.id}` } });
          try{ await sbPost("update_store",{id:s.id,gas_customer_id:newId}); }catch{/* non-fatal */}
          created++;
        }catch(e){ fail++; }
      }
      setSyncing(false);
      notify(`✅ Customers sync — ${created} added, ${linked} linked to existing${fail?`, ${fail} failed`:""}`);
      await loadData(true); await loadSupabase(true);
    };
    if (sbLoading) return <div style={{padding:40,textAlign:"center",color:G.muted}}>⏳ Loading stores…</div>;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search stores…" style={{border:`1.5px solid ${G.border}`,borderRadius:8,padding:"5px 11px",fontSize:12,color:G.ink,background:G.bg,outline:"none",flex:1}}/>
          <Btn sm onClick={()=>{setForm({name:"",owner_name:"",mobile:"",address:"",area:"",category:""});setStoreModal("add");}}>+ Add Store</Btn>
          {dupInfo.dupIds.size>0&&<Btn sm v={hideDupes?"secondary":"amber"} onClick={()=>setHideDupes(h=>!h)}>{hideDupes?`🔁 ${dupInfo.dupIds.size} dup hidden`:"Hide duplicates"}</Btn>}
          <Btn sm v="secondary" disabled={syncing} onClick={syncToCustomers}>{syncing?"⏳ Syncing…":"⬆ Sync to Customers"}</Btn>
          <Btn sm v="secondary" onClick={()=>loadSupabase()}>↻ Refresh</Btn>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <TblWrap compact heads={["Name","Owner","Mobile","Area","Category","Customer ID","Actions"]}
            rows={filtered.map(s=>[
              <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{s.name}{dupInfo.groupSize[s.id]>1&&<span title="duplicate stores merged into this one" style={{marginLeft:6,fontSize:9,color:G.amber,fontWeight:800}}>×{dupInfo.groupSize[s.id]}</span>}{dupInfo.dupIds.has(s.id)&&<span style={{marginLeft:6,fontSize:9,color:G.red,fontWeight:800}}>dup</span>}</span>,
              <span style={{fontSize:11}}>{s.owner_name||"—"}</span>,
              <span style={{fontSize:11}}>{s.mobile||"—"}</span>,
              <span style={{fontSize:11}}>{s.area||"—"}</span>,
              <span style={{fontSize:10,color:G.muted}}>{s.category||"—"}</span>,
              s.gas_customer_id?<span style={{fontSize:9,color:G.mid,fontWeight:700}}>✓ {s.gas_customer_id}</span>:<span style={{fontSize:9,color:G.muted}}>—</span>,
              <div style={{display:"flex",gap:4}}>
                <Btn sm v="secondary" onClick={()=>{setForm({...s});setStoreModal("edit");}}>✏</Btn>
                <Btn sm v="danger" onClick={()=>del(s)}>✕</Btn>
              </div>
            ])}
          />
          {filtered.length===0&&<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12}}>No stores found</div>}
        </div>
        {storeModal&&(
          <Modal title={storeModal==="add"?"Add Rider Store":"Edit Rider Store"} onClose={()=>setStoreModal(null)}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Inp label="Store Name *" value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
                <Inp label="Owner Name" value={form.owner_name||""} onChange={e=>setForm(f=>({...f,owner_name:e.target.value}))}/>
                <Inp label="Mobile" value={form.mobile||""} onChange={e=>setForm(f=>({...f,mobile:e.target.value}))}/>
                <Inp label="Area" value={form.area||""} onChange={e=>setForm(f=>({...f,area:e.target.value}))}/>
                <Inp label="Category" value={form.category||""} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/>
              </div>
              <Inp label="Address" value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn v="secondary" onClick={()=>setStoreModal(null)}>Cancel</Btn>
                <Btn disabled={busy} onClick={save}>{busy?"Saving…":"Save"}</Btn>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  const RidersTab = () => {
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({});
    const [busy, setBusy] = useState(false);
    const [permRiderId, setPermRiderId] = useState(null);
    const [permEnabled, setPermEnabled] = useState(false);
    const [permBusy, setPermBusy] = useState(false);

    const permMap = Object.fromEntries(sbData.riderPermissions.map(p=>[p.rider_id,p]));

    const save = async () => {
      setBusy(true);
      try { await sbPost("update_rider",{id:editingId,full_name:form.full_name,mobile:form.mobile,cnic:form.cnic,city:form.city,area:form.area,bike_available:form.bike_available}); notify("✅ Rider updated"); setEditingId(null); await loadSupabase(true); }
      catch(e) { notify("❌ "+e.message,"err"); } finally { setBusy(false); }
    };
    const openPerms = (r) => {
      setPermEnabled(permMap[r.id]?.payment_collection_enabled ?? false);
      setPermRiderId(r.id);
    };
    const savePerms = async () => {
      setPermBusy(true);
      try { await sbPost("set_rider_permission",{rider_id:permRiderId,payment_collection_enabled:permEnabled}); notify("✅ Permission updated"); setPermRiderId(null); await loadSupabase(true); }
      catch(e) { notify("❌ "+e.message,"err"); } finally { setPermBusy(false); }
    };

    if (sbLoading) return <div style={{padding:40,textAlign:"center",color:G.muted}}>⏳ Loading riders…</div>;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <Btn sm v="secondary" onClick={()=>exportCsv("riders.csv",sbData.riders,[["full_name","Name"],["mobile","Mobile"],["cnic","CNIC"],["city","City"],["area","Area"],["bike_available","Bike Available"]])}>⬇ Export</Btn>
          <Btn sm v="secondary" onClick={()=>loadSupabase()}>↻ Refresh</Btn>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <TblWrap compact heads={["Name","Mobile","CNIC","City","Area","Bike","Pay Perm","Actions"]}
            rows={sbData.riders.map(r=>{
              const perm = permMap[r.id];
              return [
                <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{r.full_name||"—"}</span>,
                <span style={{fontSize:11}}>{r.mobile||"—"}</span>,
                <span style={{fontSize:10,color:G.muted,fontFamily:"monospace"}}>{r.cnic||"—"}</span>,
                <span style={{fontSize:11}}>{r.city||"—"}</span>,
                <span style={{fontSize:11}}>{r.area||"—"}</span>,
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:r.bike_available?"#E8F5E9":G.pink,color:r.bike_available?G.mid:G.red,fontWeight:700}}>{r.bike_available?"Yes":"No"}</span>,
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:perm?.payment_collection_enabled?"#E8F5E9":"#FFF3E0",color:perm?.payment_collection_enabled?G.mid:"#E65100",fontWeight:700}}>{perm?.payment_collection_enabled?"✓ On":"✗ Off"}</span>,
                <div style={{display:"flex",gap:4}}>
                  <Btn sm v="secondary" onClick={()=>{setEditingId(r.id);setForm({...r});}}>✏ Edit</Btn>
                  <Btn sm v="secondary" onClick={()=>openPerms(r)}>🔐 Perms</Btn>
                </div>
              ];
            })}
          />
          {sbData.riders.length===0&&<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12}}>No riders found</div>}
        </div>
        {editingId&&(
          <Modal title="Edit Rider" onClose={()=>setEditingId(null)}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Inp label="Full Name" value={form.full_name||""} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}/>
                <Inp label="Mobile" value={form.mobile||""} onChange={e=>setForm(f=>({...f,mobile:e.target.value}))}/>
                <Inp label="CNIC" value={form.cnic||""} onChange={e=>setForm(f=>({...f,cnic:e.target.value}))}/>
                <Inp label="City" value={form.city||""} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
                <Inp label="Area" value={form.area||""} onChange={e=>setForm(f=>({...f,area:e.target.value}))}/>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,color:G.ink,cursor:"pointer"}}>
                <input type="checkbox" checked={!!form.bike_available} onChange={e=>setForm(f=>({...f,bike_available:e.target.checked}))}/> Bike Available
              </label>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn v="secondary" onClick={()=>setEditingId(null)}>Cancel</Btn>
                <Btn disabled={busy} onClick={save}>{busy?"Saving…":"Save"}</Btn>
              </div>
            </div>
          </Modal>
        )}
        {permRiderId&&(()=>{
          const rider = sbData.riders.find(r=>r.id===permRiderId);
          return (
            <Modal title={`Permissions — ${rider?.full_name||"Rider"}`} onClose={()=>setPermRiderId(null)}>
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{background:G.pale,borderRadius:10,padding:"14px 16px",border:`1.5px solid ${G.border}`}}>
                  <div style={{fontWeight:700,fontSize:13,color:G.ink,marginBottom:6}}>💳 Payment Collection</div>
                  <div style={{fontSize:12,color:G.muted,marginBottom:10}}>When enabled, this rider can collect cash/card payments on delivered orders from the Kamai app. The backend enforces this — disabling it blocks collection even if the app is bypassed.</div>
                  <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                    <div
                      onClick={()=>setPermEnabled(v=>!v)}
                      style={{width:44,height:24,borderRadius:12,background:permEnabled?G.mid:"#ccc",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}
                    >
                      <div style={{position:"absolute",top:3,left:permEnabled?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:permEnabled?G.mid:G.muted}}>{permEnabled?"Enabled":"Disabled"}</span>
                  </label>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <Btn v="secondary" onClick={()=>setPermRiderId(null)}>Cancel</Btn>
                  <Btn disabled={permBusy} onClick={savePerms}>{permBusy?"Saving…":"Save Permissions"}</Btn>
                </div>
              </div>
            </Modal>
          );
        })()}
      </div>
    );
  };

  const LocationsTab = () => {
    const [tick, setTick] = useState(0);
    useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),30000);return()=>clearInterval(id);},[]);
    useEffect(()=>{if(tick>0)loadSupabase(true);},[tick]);
    const riderMap = Object.fromEntries(sbData.riders.map(r=>[r.id,r]));
    const timeAgo = (ts) => { const s=Math.floor((Date.now()-new Date(ts).getTime())/1000); if(s<60)return s+"s ago"; const m=Math.floor(s/60); if(m<60)return m+"m ago"; return Math.floor(m/60)+"h ago"; };
    if (sbLoading) return <div style={{padding:40,textAlign:"center",color:G.muted}}>⏳ Loading locations…</div>;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:G.muted,fontWeight:600}}>Auto-refreshes every 30 seconds</span>
          <Btn sm v="secondary" onClick={()=>loadSupabase()}>↻ Refresh Now</Btn>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <TblWrap compact heads={["Rider","Last Seen","Accuracy","Location"]}
            rows={sbData.locations.map(loc=>{
              const r=riderMap[loc.rider_id];
              return [
                <div><div style={{fontWeight:700,color:G.dark,fontSize:11}}>{r?.full_name||loc.rider_id?.slice(0,8)||"—"}</div><div style={{fontSize:9,color:G.muted}}>{r?.mobile||""}</div></div>,
                <span style={{fontSize:11,color:G.muted}}>{loc.updated_at?timeAgo(loc.updated_at):"—"}</span>,
                <span style={{fontSize:11,color:G.muted}}>{loc.accuracy?`±${Math.round(loc.accuracy)}m`:"—"}</span>,
                <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:G.blue,fontWeight:600,textDecoration:"none"}}>📍 {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}</a>
              ];
            })}
          />
          {sbData.locations.length===0&&<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12}}>No location data available</div>}
        </div>
      </div>
    );
  };

  const RiderProductsTab = () => {
    const [pModal, setPModal] = useState(null);
    const [form, setForm] = useState({});
    const [busy, setBusy] = useState(false);
    const [q, setQ] = useState("");
    const filtered = sbData.products.filter(p=>{if(!q)return true;const v=q.toLowerCase();return(p.name||"").toLowerCase().includes(v)||(p.category||"").toLowerCase().includes(v);});
    const save = async () => {
      setBusy(true);
      try {
        // Whitelist real product columns (the products table has no sale_price or unit column).
        const prod={name:form.name,category:form.category,trade_price:Number(form.trade_price||0),current_stock:Number(form.current_stock||0),min_stock:Number(form.min_stock||0),active:!!form.active};
        if(pModal==="add"){await sbPost("insert_product",{product:prod});notify("✅ Product added");}
        else{await sbPost("update_product",{id:form.id,...prod});notify("✅ Product updated");}
        setPModal(null); await loadSupabase(true);
      } catch(e){notify("❌ "+e.message,"err");} finally{setBusy(false);}
    };
    const toggleActive = async (p) => {
      try{await sbPost("update_product",{id:p.id,active:!p.active});notify(`✅ ${p.name} ${!p.active?"activated":"deactivated"}`);await loadSupabase(true);}
      catch(e){notify("❌ "+e.message,"err");}
    };
    if(sbLoading)return <div style={{padding:40,textAlign:"center",color:G.muted}}>⏳ Loading products…</div>;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products…" style={{border:`1.5px solid ${G.border}`,borderRadius:8,padding:"5px 11px",fontSize:12,color:G.ink,background:G.bg,outline:"none",flex:1}}/>
          <Btn sm onClick={()=>{setForm({name:"",category:"",trade_price:0,current_stock:0,min_stock:0,active:true});setPModal("add");}}>+ Add Product</Btn>
          <Btn sm v="secondary" onClick={()=>exportCsv("products.csv",filtered,[["name","Name"],["category","Category"],["trade_price","Trade Price"],["current_stock","Stock"],["min_stock","Min"],["active","Active"]])}>⬇ Export</Btn>
          <Btn sm v="secondary" onClick={()=>loadSupabase()}>↻ Refresh</Btn>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <TblWrap compact heads={["Name","Category","Trade","Stock","Min","Active","Action"]}
            rows={filtered.map(p=>[
              <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{p.name}</span>,
              <span style={{fontSize:10,color:G.muted}}>{p.category||"—"}</span>,
              <span style={{fontSize:11}}>{fmt(p.trade_price||0)}</span>,
              <span style={{fontSize:11,color:(p.current_stock||0)<=(p.min_stock||0)?G.red:G.ink,fontWeight:(p.current_stock||0)<=(p.min_stock||0)?700:400}}>{p.current_stock||0}</span>,
              <span style={{fontSize:11,color:G.muted}}>{p.min_stock||0}</span>,
              <button onClick={()=>toggleActive(p)} style={{background:p.active?"#E8F5E9":G.pink,color:p.active?G.mid:G.red,border:"none",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{p.active?"Active":"Inactive"}</button>,
              <Btn sm v="secondary" onClick={()=>{setForm({...p});setPModal("edit");}}>✏</Btn>
            ])}
          />
          {filtered.length===0&&<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12}}>No products found</div>}
        </div>
        {pModal&&(
          <Modal title={pModal==="add"?"Add Product":"Edit Product"} onClose={()=>setPModal(null)}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Inp label="Name *" value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
                <Inp label="Category" value={form.category||""} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/>
                <Inp label="Trade Price" type="number" value={form.trade_price||0} onChange={e=>setForm(f=>({...f,trade_price:e.target.value}))}/>
                <Inp label="Current Stock" type="number" value={form.current_stock||0} onChange={e=>setForm(f=>({...f,current_stock:e.target.value}))}/>
                <Inp label="Min Stock" type="number" value={form.min_stock||0} onChange={e=>setForm(f=>({...f,min_stock:e.target.value}))}/>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,color:G.ink,cursor:"pointer"}}>
                <input type="checkbox" checked={!!form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/> Active (visible to riders)
              </label>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn v="secondary" onClick={()=>setPModal(null)}>Cancel</Btn>
                <Btn disabled={busy} onClick={save}>{busy?"Saving…":"Save"}</Btn>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  const StoreAssignTab = () => {
    const selRider = storeAssignRider, setSelRider = setStoreAssignRider;
    const [busy, setBusy] = useState(null);
    const assigned = new Set(sbData.assignments.filter(a=>a.rider_id===selRider).map(a=>a.store_id));
    const toggle = async (storeId, on) => {
      setBusy(storeId);
      try{await sbPost("toggle_store_assignment",{rider_id:selRider,store_id:storeId,on});await loadSupabase(true);}
      catch(e){notify("❌ "+e.message,"err");} finally{setBusy(null);}
    };
    if(sbLoading)return <div style={{padding:40,textAlign:"center",color:G.muted}}>⏳ Loading…</div>;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={selRider} onChange={e=>setSelRider(e.target.value)} style={{flex:1,maxWidth:300,border:`1.5px solid ${G.border}`,borderRadius:8,padding:"7px 11px",fontSize:13,color:G.ink,background:G.bg,outline:"none"}}>
            <option value="">— Select a Rider —</option>
            {sbData.riders.map(r=><option key={r.id} value={r.id}>{r.full_name} ({r.mobile||"no mobile"})</option>)}
          </select>
          <Btn sm v="secondary" onClick={()=>loadSupabase()}>↻ Refresh</Btn>
        </div>
        {selRider?(
          <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
            <TblWrap compact heads={["Store","Area","Assigned"]}
              rows={sbData.stores.map(s=>[
                <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{s.name}</span>,
                <span style={{fontSize:11,color:G.muted}}>{s.area||"—"}</span>,
                <button disabled={busy===s.id} onClick={()=>toggle(s.id,!assigned.has(s.id))} style={{background:assigned.has(s.id)?"#E8F5E9":G.pale,color:assigned.has(s.id)?G.mid:G.muted,border:`1.5px solid ${assigned.has(s.id)?G.mid:G.border}`,borderRadius:8,padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{busy===s.id?"…":assigned.has(s.id)?"✓ Assigned":"Assign"}</button>
              ])}
            />
          </div>
        ):<div style={{padding:32,textAlign:"center",color:G.muted,fontSize:12,background:G.card,borderRadius:12}}>Select a rider to manage their store assignments</div>}
      </div>
    );
  };

  const AreasTab = () => {
    const [addForm, setAddForm] = useState({city:"",name:""});
    const [busy, setBusy] = useState(false);
    const selRider = areaAssignRider, setSelRider = setAreaAssignRider;
    const [areaBusy, setAreaBusy] = useState(null);
    const assignedAreas = new Set(sbData.riderAreas.filter(a=>a.rider_id===selRider).map(a=>a.area_id));
    const addArea = async () => {
      if(!addForm.city||!addForm.name)return;
      setBusy(true);
      try{await sbPost("add_area",{area:{city:addForm.city,name:addForm.name}});notify("✅ Area added");setAddForm({city:"",name:""});await loadSupabase(true);}
      catch(e){notify("❌ "+e.message,"err");} finally{setBusy(false);}
    };
    const toggleArea = async (areaId, on) => {
      setAreaBusy(areaId);
      try{await sbPost("toggle_area_assignment",{rider_id:selRider,area_id:areaId,on});await loadSupabase(true);}
      catch(e){notify("❌ "+e.message,"err");} finally{setAreaBusy(null);}
    };
    if(sbLoading)return <div style={{padding:40,textAlign:"center",color:G.muted}}>⏳ Loading areas…</div>;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{background:G.card,borderRadius:12,padding:16,boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{fontWeight:700,fontSize:12,color:G.dark,marginBottom:10}}>Add Area</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,alignItems:"end"}}>
            <Inp label="City *" value={addForm.city} onChange={e=>setAddForm(f=>({...f,city:e.target.value}))}/>
            <Inp label="Area Name *" value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))}/>
            <Btn disabled={busy||!addForm.city||!addForm.name} onClick={addArea}>{busy?"Adding…":"+ Add"}</Btn>
          </div>
        </div>
        <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{background:G.dark,padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:G.white,fontWeight:700,fontSize:12}}>Areas ({sbData.areas.length})</span>
            <Btn sm v="secondary" onClick={()=>loadSupabase()}>↻ Refresh</Btn>
          </div>
          <TblWrap compact heads={["City","Name","Riders Assigned"]}
            rows={sbData.areas.map(a=>[
              <span style={{fontWeight:600,color:G.dark,fontSize:11}}>{a.city}</span>,
              <span style={{fontSize:11}}>{a.name}</span>,
              <span style={{fontSize:10,color:G.muted}}>{sbData.riderAreas.filter(ra=>ra.area_id===a.id).length}</span>
            ])}
          />
          {sbData.areas.length===0&&<div style={{padding:24,textAlign:"center",color:G.muted,fontSize:12}}>No areas yet</div>}
        </div>
        <div style={{background:G.card,borderRadius:12,padding:16,boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{fontWeight:700,fontSize:12,color:G.dark,marginBottom:10}}>Rider Area Assignments</div>
          <select value={selRider} onChange={e=>setSelRider(e.target.value)} style={{maxWidth:280,border:`1.5px solid ${G.border}`,borderRadius:8,padding:"7px 11px",fontSize:12,color:G.ink,background:G.bg,outline:"none",marginBottom:12,display:"block"}}>
            <option value="">— Select a Rider —</option>
            {sbData.riders.map(r=><option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
          {selRider&&(
            <TblWrap compact heads={["City","Area","Assigned"]}
              rows={sbData.areas.map(a=>[
                <span style={{fontSize:11,color:G.muted}}>{a.city}</span>,
                <span style={{fontWeight:600,fontSize:11}}>{a.name}</span>,
                <button disabled={areaBusy===a.id} onClick={()=>toggleArea(a.id,!assignedAreas.has(a.id))} style={{background:assignedAreas.has(a.id)?"#E8F5E9":G.pale,color:assignedAreas.has(a.id)?G.mid:G.muted,border:`1.5px solid ${assignedAreas.has(a.id)?G.mid:G.border}`,borderRadius:8,padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{areaBusy===a.id?"…":assignedAreas.has(a.id)?"✓ Assigned":"Assign"}</button>
              ])}
            />
          )}
        </div>
      </div>
    );
  };

  const RiderReportsTab = () => {
    const [days, setDays] = useState(30);
    const [repData, setRepData] = useState(null);
    const [repLoading, setRepLoading] = useState(false);
    useEffect(()=>{
      let on=true;
      setRepLoading(true);
      Promise.all([sbPost("report_orders",{days}),sbPost("report_items",{days})])
        .then(([orders,items])=>{if(on)setRepData({orders:orders||[],items:items||[]});})
        .catch(e=>notify("❌ "+e.message,"err"))
        .finally(()=>{if(on)setRepLoading(false);});
      return()=>{on=false;};
    },[days]);
    const riderMap = Object.fromEntries(sbData.riders.map(r=>[r.id,r.full_name||r.id?.slice(0,8)||"?"]));
    const riderStats = repData ? (() => {
      const m={};
      repData.orders.forEach(o=>{const n=riderMap[o.rider_id]||"Unknown";if(!m[n])m[n]={name:n,count:0,revenue:0,incentive:0};m[n].count++;m[n].revenue+=Number(o.total_value||0);m[n].incentive+=Number(o.incentive||0);});
      return Object.values(m).sort((a,b)=>b.count-a.count);
    })() : [];
    const productStats = repData ? (() => {
      const m={};
      repData.items.forEach(i=>{const n=i.product_name||i.product_id||"?";if(!m[n])m[n]={name:n,qty:0,revenue:0};m[n].qty+=Number(i.quantity||0);m[n].revenue+=Number(i.total||0);});
      return Object.values(m).sort((a,b)=>b.qty-a.qty).slice(0,20);
    })() : [];
    const total = repData ? {
      orders:repData.orders.length,
      revenue:repData.orders.reduce((s,o)=>s+Number(o.total_value||0),0),
      incentive:repData.orders.reduce((s,o)=>s+Number(o.incentive||0),0),
      delivered:repData.orders.filter(o=>o.status==="Delivered").length,
    } : null;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {[7,30,90].map(d=>(
            <button key={d} onClick={()=>setDays(d)} style={{padding:"5px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",background:days===d?G.dark:G.pale,color:days===d?G.white:G.dark,border:`1.5px solid ${days===d?G.dark:G.border}`}}>Last {d} days</button>
          ))}
          {repLoading&&<span style={{fontSize:11,color:G.muted}}>⏳ Loading…</span>}
          <div style={{flex:1}}/>
          <Btn sm v="secondary" onClick={()=>exportCsv(`rider_performance_${days}d.csv`,riderStats,[["name","Rider"],["count","Orders"],["revenue","Revenue"],["incentive","Incentive"]])}>⬇ Export Riders</Btn>
          <Btn sm v="secondary" onClick={()=>exportCsv(`top_products_${days}d.csv`,productStats,[["name","Product"],["qty","Qty"],["revenue","Revenue"]])}>⬇ Export Products</Btn>
        </div>
        {total&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
            <Kpi label="Total Orders" value={total.orders} sub={`${total.delivered} delivered`} color={G.blue}/>
            <Kpi label="Total Revenue" value={fmt(total.revenue)} color={G.mid} trend="up"/>
            <Kpi label="Total Incentive" value={fmt(total.incentive)} color={G.amber}/>
            <Kpi label="Delivery Rate" value={total.orders?pct(total.delivered,total.orders):"—"} color={G.purple}/>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
            <div style={{background:G.dark,padding:"9px 14px"}}><span style={{color:G.white,fontWeight:700,fontSize:12}}>By Rider</span></div>
            <TblWrap compact heads={["Rider","Orders","Revenue","Incentive"]}
              rows={riderStats.map(r=>[
                <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{r.name}</span>,
                <span style={{fontSize:11}}>{r.count}</span>,
                <span style={{fontSize:11,fontWeight:600}}>{fmt(r.revenue)}</span>,
                <span style={{fontSize:11,color:G.amber}}>{fmt(r.incentive)}</span>
              ])}
            />
            {riderStats.length===0&&<div style={{padding:24,textAlign:"center",color:G.muted,fontSize:12}}>No data</div>}
          </div>
          <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
            <div style={{background:G.dark,padding:"9px 14px"}}><span style={{color:G.white,fontWeight:700,fontSize:12}}>Top Products</span></div>
            <TblWrap compact heads={["Product","Qty","Revenue"]}
              rows={productStats.map(p=>[
                <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{p.name}</span>,
                <span style={{fontSize:11}}>{p.qty}</span>,
                <span style={{fontSize:11,fontWeight:600}}>{fmt(p.revenue)}</span>
              ])}
            />
            {productStats.length===0&&<div style={{padding:24,textAlign:"center",color:G.muted,fontSize:12}}>No data</div>}
          </div>
        </div>
      </div>
    );
  };

  const RiderConfigTab = () => {
    const [settings, setSettings] = useState([]);
    const [busy, setBusy] = useState(null);
    const [pushCount, setPushCount] = useState(null);
    useEffect(()=>{
      sbPost("app_settings").then(d=>setSettings(d||[])).catch(()=>{});
      sbPost("push_subscriptions_count").then(n=>setPushCount(n)).catch(()=>{});
    },[]);
    const getVal = (key) => settings.find(s=>s.key===key)?.value??"";
    const saveSetting = async (key, value) => {
      setBusy(key);
      try{await sbPost("upsert_setting",{key,value});setSettings(prev=>{const i=prev.findIndex(s=>s.key===key);return i>=0?prev.map((s,j)=>j===i?{...s,value}:s):[...prev,{key,value}];});notify("✅ Setting saved");}
      catch(e){notify("❌ "+e.message,"err");} finally{setBusy(null);}
    };
    const SettingRow = ({k,label,type="text"}) => {
      const [val,setVal] = useState(getVal(k));
      useEffect(()=>setVal(getVal(k)),[k,settings.length]);
      return <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:10}}>
        <Inp label={label} value={val} type={type} onChange={e=>setVal(e.target.value)} style={{flex:1}}/>
        <Btn sm disabled={busy===k} onClick={()=>saveSetting(k,val)}>{busy===k?"Saving…":"Save"}</Btn>
      </div>;
    };
    const EmailRecipientsSection = () => {
      const raw = getVal("email_notification_recipients");
      let initial = [];
      try { const p = raw ? JSON.parse(raw) : []; initial = Array.isArray(p) ? p : []; } catch {}
      const [emails, setEmails] = useState(initial);
      const [newEmail, setNewEmail] = useState("");
      const [emailBusy, setEmailBusy] = useState(false);
      useEffect(()=>{
        try { const p = raw ? JSON.parse(raw) : []; setEmails(Array.isArray(p) ? p : []); } catch {}
      },[raw]);
      const saveEmails = async (list) => {
        setEmailBusy(true);
        try { await saveSetting("email_notification_recipients", JSON.stringify(list)); setEmails(list); }
        finally { setEmailBusy(false); }
      };
      const add = () => {
        const e = newEmail.trim().toLowerCase();
        if (!e || !e.includes("@")) return notify("Enter a valid email","err");
        if (emails.includes(e)) return notify("Already in list","err");
        saveEmails([...emails, e]);
        setNewEmail("");
      };
      const remove = (e) => saveEmails(emails.filter(x=>x!==e));
      return (
        <div style={{background:G.card,borderRadius:12,padding:18,boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{fontWeight:700,fontSize:13,color:G.dark,marginBottom:14}}>Order Email Notifications</div>
          <div style={{marginBottom:12,display:"flex",flexDirection:"column",gap:6}}>
            {emails.length===0&&<div style={{fontSize:12,color:G.muted,fontStyle:"italic"}}>No recipients — using system defaults</div>}
            {emails.map(e=>(
              <div key={e} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"#f0faf4",borderRadius:8,fontSize:13}}>
                <span style={{flex:1,color:G.dark}}>{e}</span>
                <button onClick={()=>remove(e)} disabled={emailBusy} style={{background:"none",border:"none",cursor:"pointer",color:"#e53e3e",fontWeight:700,fontSize:18,lineHeight:1,padding:"0 4px"}}>×</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Inp value={newEmail} onChange={ev=>setNewEmail(ev.target.value)} placeholder="name@example.com" style={{flex:1}} onKeyDown={ev=>ev.key==="Enter"&&add()}/>
            <Btn sm disabled={emailBusy} onClick={add}>{emailBusy?"Saving…":"Add"}</Btn>
          </div>
          <div style={{fontSize:11,color:G.muted,marginTop:8}}>Notified when a rider submits an order.</div>
        </div>
      );
    };
    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{background:G.card,borderRadius:12,padding:18,boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{fontWeight:700,fontSize:13,color:G.dark,marginBottom:14}}>Incentive Settings</div>
          <SettingRow k="incentive_per_order" label={`Incentive per Order (${CONFIG.currency})`} type="number"/>
          <SettingRow k="monthly_target_orders" label="Monthly Target (Orders)" type="number"/>
          <SettingRow k="bonus_amount" label={`Bonus Amount (${CONFIG.currency})`} type="number"/>
          <SettingRow k="bonus_threshold_orders" label="Bonus Threshold (Orders)" type="number"/>
        </div>
        <div style={{background:G.card,borderRadius:12,padding:18,boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:13,color:G.dark}}>Push Notifications</div>
            {pushCount!==null&&<span style={{fontSize:11,color:G.muted,fontWeight:600}}>{pushCount} subscribers</span>}
          </div>
          <SettingRow k="push_title_default" label="Default Push Title"/>
          <SettingRow k="push_body_default" label="Default Push Body"/>
        </div>
        <EmailRecipientsSection/>
      </div>
    );
  };

  // ── RETURNS ───────────────────────────────────────────────
  const ReturnsTab = () => {
    const [returns, setReturns] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const [expandedItems, setExpandedItems] = useState({});
    const [showNew, setShowNew] = useState(false);
    const [q, setQ] = useState("");

    // New return form state
    const [form, setForm] = useState({ store_id: "", gas_invoice_id: "", reason: "" });
    const [formItems, setFormItems] = useState([{ product_id: "", product_name: "", qty: 1, trade_price: 0 }]);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
      setLoading(true);
      try { setReturns(await sbPost("returns")); }
      catch(e) { notify("❌ "+e.message,"err"); }
      finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function loadItems(returnId) {
      if (expandedItems[returnId]) return;
      try {
        const items = await sbPost("return_items", { return_id: returnId });
        setExpandedItems(prev => ({ ...prev, [returnId]: items }));
      } catch(e) { notify("❌ "+e.message,"err"); }
    }

    function toggleExpand(id) {
      const next = expanded === id ? null : id;
      setExpanded(next);
      if (next) loadItems(next);
    }

    async function submitReturn(e) {
      e.preventDefault();
      if (!form.store_id) return notify("Select a store","err");
      const validItems = formItems.filter(it => it.product_id && it.qty > 0);
      if (!validItems.length) return notify("Add at least one return item","err");
      setSubmitting(true);
      try {
        await sbPost("admin_create_return", { ...form, items: validItems });
        notify("✅ Return logged");
        setShowNew(false);
        setForm({ store_id: "", gas_invoice_id: "", reason: "" });
        setFormItems([{ product_id: "", product_name: "", qty: 1, trade_price: 0 }]);
        await load();
      } catch(e) { notify("❌ "+e.message,"err"); }
      finally { setSubmitting(false); }
    }

    function updateItem(idx, key, val) {
      setFormItems(prev => prev.map((it,i) => i===idx ? { ...it, [key]: val } : it));
    }

    function pickProduct(idx, pid) {
      const p = sbData.products.find(x => x.id === pid);
      if (!p) return;
      setFormItems(prev => prev.map((it,i) => i===idx ? { ...it, product_id: p.id, product_name: p.name, trade_price: Number(p.trade_price||0) } : it));
    }

    const filtered = (returns||[]).filter(r => {
      if (!q) return true;
      const s = q.toLowerCase();
      return (r.stores?.name||"").toLowerCase().includes(s)||(r.profiles?.full_name||"").toLowerCase().includes(s)||(r.reason||"").toLowerCase().includes(s)||(String(r.return_no||"")).includes(s);
    });

    // GAS invoices for the selected customer/store (match by store name or show all)
    const storeInvoices = useMemo(() => {
      if (!form.store_id) return invoices;
      const storeName = normTxt(sbData.stores.find(s => s.id === form.store_id)?.name || "");
      if (!storeName) return invoices;
      return invoices.filter(inv => normTxt(inv.custName || "").includes(storeName) || storeName.includes(normTxt(inv.custName || "")));
    }, [form.store_id, invoices, sbData.stores]);

    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",gap:8,flex:1,minWidth:0}}>
            <Inp style={{flex:1,minWidth:120}} label="" placeholder="Search store, rider, reason…" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn sm v="secondary" onClick={load}>{loading?"⏳ Loading…":"↻ Refresh"}</Btn>
            <Btn sm onClick={()=>setShowNew(true)}>+ New Return</Btn>
          </div>
        </div>

        {/* Summary KPIs */}
        {returns&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
            <Kpi label="Total Returns" value={returns.length} color={G.red} icon={Undo2}/>
            <Kpi label="Total Value Returned" value={fmt(returns.reduce((s,r)=>s+Number(r.total||0),0))} color={G.amber}/>
            <Kpi label="Stores with Returns" value={new Set(returns.map(r=>r.store_id)).size} color={G.blue}/>
          </div>
        )}

        {/* Returns list */}
        {loading&&!returns&&<div style={{textAlign:"center",padding:32,color:G.muted,fontSize:13}}>⏳ Loading returns…</div>}
        {returns&&filtered.length===0&&<div style={{textAlign:"center",padding:32,color:G.muted,fontSize:13}}>No returns found.</div>}
        {filtered.map(r => (
          <div key={r.id} style={{background:G.card,borderRadius:12,boxShadow:"0 2px 12px rgba(15,23,42,0.07)",overflow:"hidden"}}>
            {/* Row */}
            <div onClick={()=>toggleExpand(r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",background:expanded===r.id?G.pale:"transparent"}}>
              <div style={{width:36,height:36,borderRadius:9,background:G.pink,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Undo2 size={16} color={G.red}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,fontSize:12,color:G.ink}}>#{r.return_no||"—"}</span>
                  <span style={{fontWeight:600,fontSize:12,color:G.dark}}>{r.stores?.name||"Unknown store"}</span>
                  {r.profiles?.full_name&&<span style={{fontSize:11,color:G.muted}}>· {r.profiles.full_name}</span>}
                </div>
                <div style={{fontSize:10,color:G.muted,marginTop:2}}>{(r.created_at||"").slice(0,10)} {r.reason?`· ${r.reason}`:""}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{fontWeight:800,fontSize:14,color:G.red}}>{fmt(r.total)}</span>
                {r.gas_invoice_id&&<span style={{fontSize:9,background:"#E8F5E9",color:G.dark,borderRadius:5,padding:"2px 7px",fontWeight:700}}>INV: {r.gas_invoice_id}</span>}
                {r.gas_credit_id&&<span style={{fontSize:9,background:G.sky,color:G.blue,borderRadius:5,padding:"2px 7px",fontWeight:700}}>CR: {r.gas_credit_id}</span>}
                <span style={{fontSize:14,color:G.muted}}>{expanded===r.id?"▲":"▼"}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded===r.id&&(
              <div style={{borderTop:`1px solid ${G.border}`,padding:14}}>
                {/* Reference fields row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  {/* Linked Invoice (set at creation) */}
                  <div style={{background:G.sky,borderRadius:8,padding:"8px 12px"}}>
                    <div style={{fontSize:9,fontWeight:800,color:G.blue,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>Linked Invoice</div>
                    <div style={{fontSize:13,fontWeight:700,color:r.gas_invoice_id?G.blue:G.muted}}>{r.gas_invoice_id||"—"}</div>
                  </div>
                  {/* Credit Note — editable */}
                  <Inp
                    label="Credit Note ID"
                    defaultValue={r.gas_credit_id||""}
                    placeholder="e.g. CN-042"
                    onBlur={async e=>{
                      const v=e.target.value.trim();
                      if(v===r.gas_credit_id) return;
                      try { await sbPost("update_return",{id:r.id,gas_credit_id:v||null}); notify("✅ Credit note linked"); await load(); }
                      catch(er){ notify("❌ "+er.message,"err"); }
                    }}
                  />
                </div>

                {/* Items */}
                {!expandedItems[r.id]&&<div style={{fontSize:11,color:G.muted,padding:"4px 0"}}>⏳ Loading items…</div>}
                {expandedItems[r.id]&&(
                  expandedItems[r.id].length===0
                    ? <div style={{fontSize:11,color:G.muted}}>No items recorded.</div>
                    : <TblWrap compact heads={["Product","Qty","Trade Price","Line Total"]}
                        rows={expandedItems[r.id].map(it=>[
                          <span style={{fontWeight:600,fontSize:11}}>{it.product_name}</span>,
                          <span style={{fontSize:11}}>{it.qty}</span>,
                          <span style={{fontSize:11}}>{fmt(it.trade_price)}</span>,
                          <span style={{fontWeight:700,fontSize:11,color:G.red}}>{fmt(it.qty*it.trade_price)}</span>,
                        ])}
                      />
                )}
              </div>
            )}
          </div>
        ))}

        {/* New Return Modal */}
        {showNew&&(
          <Modal title="Log New Return" onClose={()=>setShowNew(false)} wide>
            <form onSubmit={submitReturn} style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Sel label="Store *" value={form.store_id} onChange={e=>setForm(f=>({...f,store_id:e.target.value,gas_invoice_id:""}))}>
                  <option value="">Select store…</option>
                  {sbData.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </Sel>
                <Sel label="Linked Invoice (optional)" value={form.gas_invoice_id} onChange={e=>setForm(f=>({...f,gas_invoice_id:e.target.value}))}>
                  <option value="">No specific invoice</option>
                  {storeInvoices.map(inv=><option key={inv.id} value={inv.id}>{inv.id} — {inv.custName} — {fmt(inv.total)} ({inv.date})</option>)}
                </Sel>
              </div>
              <Inp label="Reason" value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Damaged goods, expired stock…"/>

              {/* Items */}
              <div>
                <div style={{fontWeight:700,fontSize:11,color:G.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Return Items</div>
                {formItems.map((it,idx)=>(
                  <div key={idx} style={{display:"grid",gridTemplateColumns:"2fr 80px 100px 32px",gap:8,marginBottom:8,alignItems:"end"}}>
                    <Sel label={idx===0?"Product":""} value={it.product_id} onChange={e=>pickProduct(idx,e.target.value)}>
                      <option value="">Select product…</option>
                      {sbData.products.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </Sel>
                    <Inp label={idx===0?"Qty":""} type="number" min={1} value={it.qty} onChange={e=>updateItem(idx,"qty",Math.max(1,+e.target.value))}/>
                    <Inp label={idx===0?"Trade Price":""} type="number" min={0} value={it.trade_price} onChange={e=>updateItem(idx,"trade_price",+e.target.value)}/>
                    <button type="button" onClick={()=>setFormItems(prev=>prev.filter((_,i)=>i!==idx))} style={{background:G.pink,border:"none",borderRadius:7,padding:"6px 10px",color:G.red,cursor:"pointer",fontWeight:700,alignSelf:"flex-end"}}>✕</button>
                  </div>
                ))}
                <Btn type="button" sm v="secondary" onClick={()=>setFormItems(prev=>[...prev,{product_id:"",product_name:"",qty:1,trade_price:0}])}>+ Add Item</Btn>
              </div>

              <div style={{display:"flex",justifyContent:"flex-end",gap:8,paddingTop:4}}>
                <Btn type="button" v="ghost" onClick={()=>setShowNew(false)}>Cancel</Btn>
                <Btn type="submit" v="danger" disabled={submitting}>{submitting?"Saving…":"Log Return"}</Btn>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  };

  // ── COMMISSION CALCULATOR ─────────────────────────────────
  const COMMISSION_TIERS = [
    { label: "First store order",      amount: 1000, color: "#2E7D32", bg: "#E8F5E9" },
    { label: "Repeat order ≥ Rs.10k",  amount: 500,  color: "#1565C0", bg: "#E3F2FD" },
    { label: "Repeat order < Rs.10k",  amount: 250,  color: "#FF8F00", bg: "#FFF8E1" },
  ];

  function calcOrderCommission(order, firstOrderIdByStore) {
    if (firstOrderIdByStore[order.store_id] === order.id) return 1000;
    return Number(order.total_value || 0) >= 10000 ? 500 : 250;
  }

  const RiderCommissionTab = () => {
    const now = new Date();
    const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10));
    const [to, setTo] = useState(now.toISOString().slice(0,10));
    const [statusFilter, setStatusFilter] = useState("Delivered");
    const [expandedRider, setExpandedRider] = useState(null);

    // First-ever order id per store across all loaded orders
    const firstOrderIdByStore = useMemo(() => {
      const m = {};
      const sorted = [...sbData.orders].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      sorted.forEach(o => { if (o.store_id && !m[o.store_id]) m[o.store_id] = o.id; });
      return m;
    }, [sbData.orders]);

    const filtered = useMemo(() => sbData.orders.filter(o => {
      const d = (o.created_at || "").slice(0,10);
      if (d < from || d > to) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    }), [sbData.orders, from, to, statusFilter]);

    const byRider = useMemo(() => {
      const m = {};
      filtered.forEach(o => {
        const name = o.profiles?.full_name || "Unassigned";
        if (!m[name]) m[name] = { name, orders: [], total: 0, t1: 0, t2: 0, t3: 0 };
        const comm = calcOrderCommission(o, firstOrderIdByStore);
        m[name].orders.push({ ...o, _comm: comm });
        m[name].total += comm;
        if (comm === 1000) m[name].t1++;
        else if (comm === 500) m[name].t2++;
        else m[name].t3++;
      });
      return Object.values(m).sort((a,b) => b.total - a.total);
    }, [filtered, firstOrderIdByStore]);

    const grandTotal = byRider.reduce((s,r) => s + r.total, 0);
    const tierCounts = { t1: byRider.reduce((s,r)=>s+r.t1,0), t2: byRider.reduce((s,r)=>s+r.t2,0), t3: byRider.reduce((s,r)=>s+r.t3,0) };

    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Tier reference */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
          {COMMISSION_TIERS.map(t=>(
            <div key={t.label} style={{background:t.bg,borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${t.color}`}}>
              <div style={{fontSize:9,fontWeight:800,color:t.color,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{t.label}</div>
              <div style={{fontSize:20,fontWeight:800,color:G.ink}}>{fmt(t.amount)}</div>
            </div>
          ))}
          <div style={{background:G.pale,borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${G.dark}`}}>
            <div style={{fontSize:9,fontWeight:800,color:G.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>No earnings cap</div>
            <div style={{fontSize:13,fontWeight:700,color:G.muted}}>Unlimited commissions</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{background:G.card,borderRadius:12,padding:16,boxShadow:"0 2px 12px rgba(15,23,42,0.07)",display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
          <Inp label="From" type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{flex:"1 1 130px"}}/>
          <Inp label="To" type="date" value={to} onChange={e=>setTo(e.target.value)} style={{flex:"1 1 130px"}}/>
          <Sel label="Status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{flex:"1 1 140px"}}>
            <option value="all">All statuses</option>
            <option value="Delivered">Delivered</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
          </Sel>
        </div>

        {/* Summary KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
          <Kpi label="Total Commission" value={fmt(grandTotal)} color={G.dark} icon={Banknote}/>
          <Kpi label="Orders" value={filtered.length} color={G.mid} icon={ClipboardList}/>
          <Kpi label="First-Store Bonuses" value={`${tierCounts.t1} × ${fmt(1000)}`} color="#2E7D32" sub={fmt(tierCounts.t1*1000)} icon={Store}/>
          <Kpi label="Repeat ≥10k" value={`${tierCounts.t2} × ${fmt(500)}`} color={G.blue} sub={fmt(tierCounts.t2*500)}/>
          <Kpi label="Repeat <10k" value={`${tierCounts.t3} × ${fmt(250)}`} color={G.amber} sub={fmt(tierCounts.t3*250)}/>
        </div>

        {/* Per-rider breakdown */}
        {byRider.length === 0 ? (
          <div style={{background:G.card,borderRadius:12,padding:24,textAlign:"center",color:G.muted,fontSize:13}}>No orders found for the selected range and status.</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {byRider.map(r => (
              <div key={r.name} style={{background:G.card,borderRadius:12,boxShadow:"0 2px 12px rgba(15,23,42,0.07)",overflow:"hidden"}}>
                {/* Rider header row */}
                <div
                  onClick={()=>setExpandedRider(expandedRider===r.name?null:r.name)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer",background:expandedRider===r.name?G.pale:"transparent",borderBottom:expandedRider===r.name?`1px solid ${G.border}`:"none"}}
                >
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:34,height:34,borderRadius:"50%",background:G.mid,display:"flex",alignItems:"center",justifyContent:"center",color:G.white,fontWeight:800,fontSize:13}}>{r.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:G.ink}}>{r.name}</div>
                      <div style={{fontSize:10,color:G.muted}}>{r.orders.length} order{r.orders.length!==1?"s":""} · {r.t1>0&&<span style={{color:"#2E7D32",fontWeight:700}}>{r.t1} first-store</span>}{r.t1>0&&(r.t2+r.t3)>0?" · ":""}{r.t2>0&&<span style={{color:G.blue}}>{r.t2} ≥10k</span>}{r.t2>0&&r.t3>0?" · ":""}{r.t3>0&&<span style={{color:G.amber}}>{r.t3} &lt;10k</span>}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontWeight:800,fontSize:16,color:G.dark}}>{fmt(r.total)}</div>
                    <span style={{fontSize:14,color:G.muted}}>{expandedRider===r.name?"▲":"▼"}</span>
                  </div>
                </div>
                {/* Order detail rows */}
                {expandedRider===r.name&&(
                  <TblWrap compact heads={["Date","Store","Order Total","Tier","Commission"]}
                    rows={r.orders.map(o=>[
                      <span style={{fontSize:10,color:G.muted}}>{(o.created_at||"").slice(0,10)}</span>,
                      <span style={{fontWeight:600,fontSize:11}}>{o.stores?.name||"—"}</span>,
                      <span style={{fontSize:11}}>{fmt(o.total_value||0)}</span>,
                      <span style={{fontSize:10,fontWeight:700,color:o._comm===1000?"#2E7D32":o._comm===500?G.blue:G.amber}}>
                        {o._comm===1000?"First store":o._comm===500?"Repeat ≥10k":"Repeat <10k"}
                      </span>,
                      <span style={{fontWeight:800,fontSize:12,color:G.dark}}>{fmt(o._comm)}</span>,
                    ])}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── PAGES ─────────────────────────────────────────────────
  const PAGES={
    dashboard:<Dashboard/>,customers:Customers(),invoices:Invoices(),
    payments:(()=>{
      const riderCols = (sbData.riderCollections||[]).map(c=>({
        _isRider:true,
        id:"RC-"+c.id.slice(0,8),
        date:(c.collected_at||"").slice(0,10),
        type:"Rider Collection",
        partyName:c.profiles?.full_name||c.rider_id,
        refId:c.orders?.order_no?"#"+c.orders.order_no:null,
        amount:c.amount,
        notes:[c.payment_method,c.notes].filter(Boolean).join(" · ")||null,
        _sortKey:c.collected_at||"",
      }));
      const allPays = [...payments.map(p=>({...p,_sortKey:p.date||"",_isRider:false})),...riderCols]
        .sort((a,b)=>b._sortKey.localeCompare(a._sortKey));
      return (
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12,gap:8}}>
            <Btn sm onClick={()=>setModal({t:"recordPayment"})}>+ Record Payment</Btn>
            <Btn sm v="secondary" onClick={()=>exportCsv("payments.csv",allPays,[["id","Pay ID"],["date","Date"],["type","Type"],["partyName","Party"],["refId","Invoice"],["amount","Amount"],["notes","Notes"]])}>⬇ Export</Btn>
          </div>
          <div className="td-card" style={{background:G.card,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,23,42,0.07)"}}>
            <TblWrap compact heads={["Pay ID","Date","Type","Party","Invoice","Amount","Notes"]}
              rows={allPays.map(p=>[
                <span style={{fontWeight:700,color:G.dark,fontSize:11}}>{p.id}</span>,
                <span style={{fontSize:10,color:G.muted}}>{p.date}</span>,
                p._isRider
                  ? <span style={{background:"#E3F2FD",color:"#1565C0",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>Rider Collection</span>
                  : <Badge text={p.type}/>,
                <span style={{fontWeight:600,fontSize:11}}>{p.partyName||p.partyId}</span>,
                <span style={{fontSize:10,color:G.muted}}>{p.refId||"—"}</span>,
                <span style={{fontWeight:800,color:p._isRider?"#1565C0":p.type==="Received"?G.mid:G.red,fontSize:11}}>{fmt(p.amount)}</span>,
                <span style={{fontSize:10,color:G.muted}}>{p.notes||"—"}</span>,
              ])}
            />
          </div>
        </div>
      );
    })(),
    purchases:<Purchases/>,vendors:<Vendors/>,expenses:<Expenses/>,
    pnl:<PnL/>,arap:<ARAp/>,inventory:<Inventory/>,reports:<Reports/>,
    "rider-orders":<RiderOrdersTab/>,"rider-stores":<RiderStoresTab/>,
    riders:<RidersTab/>,locations:<LocationsTab/>,"rider-products":<RiderProductsTab/>,
    "store-assign":<StoreAssignTab/>,areas:<AreasTab/>,"rider-reports":<RiderReportsTab/>,"rider-config":<RiderConfigTab/>,"rider-commission":<RiderCommissionTab/>,"returns":<ReturnsTab/>,
    ...Object.fromEntries(Object.entries(vertical.pages||{}).map(([id,Comp])=>[id,<Comp key={id} ctx={ctx}/>])),
  };

  return (
    <div className="crm-root" style={{display:"flex",height:"100vh",overflow:"hidden",fontFamily:"'DM Sans',system-ui,sans-serif",background:G.bg}}>
      {/* MOBILE BACKDROP */}
      {isMobile&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1090}}/>}
      {/* SIDEBAR */}
      <div style={isMobile
        ? {width:240,background:`linear-gradient(180deg,${G.sidebar} 0%,${G.sidebar2||G.sidebar} 100%)`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,height:"100vh",zIndex:1100,transform:sidebarOpen?"translateX(0)":"translateX(-100%)",transition:"transform .25s ease",boxShadow:sidebarOpen?"0 0 40px rgba(0,0,0,0.5)":"none"}
        : {width:210,background:`linear-gradient(180deg,${G.sidebar} 0%,${G.sidebar2||G.sidebar} 100%)`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
        <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:32,height:32,background:`linear-gradient(135deg,${vertical.accent||G.mid},${G.accent})`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{vertical.LogoIcon?<vertical.LogoIcon size={17} color={G.white}/>:<Boxes size={17} color={G.white}/>}</div>
            <div style={{minWidth:0}}>
              <div style={{color:G.white,fontWeight:800,fontSize:12}}>TradeDesk ERP</div>
              <div style={{display:"flex",alignItems:"center",gap:4,marginTop:1}}>
                <div className="td-live" style={{width:6,height:6,borderRadius:"50%",background:G.light}}/>
                <span style={{color:"rgba(255,255,255,0.45)",fontSize:8,letterSpacing:"0.08em",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{(vertical.label||"").toUpperCase()} EDITION</span>
              </div>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:"8px 6px",overflowY:"auto",display:"flex",flexDirection:"column",gap:0}}>
          {NAV_GROUPS.map(section=><NavGroup key={section.group} section={section} tab={tab} G={G} NAV_ICONS={NAV_ICONS} onPick={id=>{setTab(id);setSearch("");if(isMobile)setSidebarOpen(false);}}/>)}
        </nav>
        <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:G.mid,display:"flex",alignItems:"center",justifyContent:"center",color:G.white,fontWeight:800,fontSize:10,flexShrink:0}}>{(user.displayName||"A").charAt(0)}</div>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",fontWeight:700}}>{user.displayName?.split(" ")[0]||"User"}</div>
              <div style={{fontSize:8,color:"rgba(255,255,255,0.28)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</div>
            </div>
          </div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>🏢 {CONFIG.company.name}</div>
          <button onClick={onLogout} style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:6,padding:"7px 8px",color:"rgba(255,255,255,0.6)",fontSize:10,fontWeight:700,cursor:"pointer",textAlign:"center"}}>⇄ Switch Business Type</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:G.white,borderBottom:`1px solid ${G.border}`,borderTop:`3px solid ${G.dark}`,padding:isMobile?"0 14px":"0 22px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,boxShadow:"0 1px 4px rgba(15,23,42,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            {isMobile&&<button onClick={()=>setSidebarOpen(true)} aria-label="Open menu" style={{display:"flex",alignItems:"center",justifyContent:"center",background:G.pale,border:`1px solid ${G.border}`,borderRadius:8,width:34,height:34,cursor:"pointer",color:G.dark,flexShrink:0}}><Menu size={18}/></button>}
            <h1 style={{margin:0,fontSize:isMobile?15:17,fontWeight:800,color:G.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{NAV_GROUPS.flatMap(g=>g.items).find(n=>n.id===tab)?.label}</h1>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <TopSearch G={G} isMobile={isMobile} onOpen={()=>setPaletteOpen(true)}/>
            <QuickNew G={G} isMobile={isMobile} actions={QUICK_ACTIONS}/>
            <BellButton G={G} isMobile={isMobile} count={alertCount} onClick={()=>setTab("alerts")}/>
            {(syncing||sbSyncing)&&<span style={{fontSize:10,color:G.muted,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4}}><RefreshCw size={11} style={{animation:"spin 1s linear infinite"}}/>{!isMobile&&"Syncing…"}</span>}
            {RIDER_HUB_TABS.has(tab)
              ?<button onClick={()=>loadSupabase()} style={{background:"#E3F2FD",border:`1px solid ${G.blue}`,borderRadius:7,padding:"5px 11px",fontSize:10,fontWeight:700,color:G.blue,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><RefreshCw size={12}/>{!isMobile&&"Rider Sync"}</button>
              :<button onClick={()=>loadData(true)} style={{background:G.pale,border:`1px solid ${G.mid}`,borderRadius:7,padding:"5px 11px",fontSize:10,fontWeight:700,color:G.dark,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><RefreshCw size={12}/>{!isMobile&&"Sync"}</button>}
          </div>
        </div>

        <ToastHost ref={toastRef}/>
        <UndoHost ref={undoRef} notify={notify}/>


        <div style={{flex:1,overflow:"auto",padding:isMobile?12:18}}><PageTransition id={tab}>{PAGES[tab]}</PageTransition></div>
        <CommandPalette open={paletteOpen} onClose={()=>setPaletteOpen(false)} G={G} navItems={NAV_FLAT} customers={customers} invoices={invoices} products={products} actions={QUICK_ACTIONS} onNav={id=>{setTab(id);setSearch("");}} onCustomer={c=>setModal({t:"viewCustomer",d:c})} onInvoice={i=>setModal({t:"viewInvoice",d:i})}/>
      </div>

      {renderModal()}
    </div>
  );
}

export default CrmApp;
