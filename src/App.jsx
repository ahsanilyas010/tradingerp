import { useState, useEffect } from "react";
import CrmApp from "./apt/AptCrm.jsx";
import { getVertical, VERTICAL_LIST } from "./verticals/index.js";
import { initDb, setCurrentUser } from "./data/mockApi.js";
import { setCompany, setConfig } from "./lib/config.js";
import Landing from "./Landing.jsx";
import { applyTheme } from "./lib/theme.js";

const DEMO_USER = { email: "admin@tradedesk.demo", displayName: "Demo Admin" };

export default function App() {
  const [vkey, setVkey] = useState(() => { const h = (typeof window !== "undefined" && window.location.hash.replace("#", "")) || ""; return VERTICAL_LIST.some(v => v.key === h) ? h : null; });
  const [vertical, setVertical] = useState(null);
  useEffect(() => {
    if (!vkey) { setVertical(null); if (window.location.hash) history.replaceState(null, "", window.location.pathname); window.scrollTo(0, 0); return; }
    const v = getVertical(vkey);
    applyTheme(vkey); initDb(vkey); setCompany(v.company); setConfig({ currency: "PKR", vertical: vkey }); setCurrentUser(DEMO_USER);
    window.location.hash = vkey;
    setVertical(v);
  }, [vkey]);
  if (!vkey || !vertical) return <Landing onPick={setVkey} />;
  return <CrmApp key={vkey} user={DEMO_USER} vertical={vertical} onLogout={() => setVkey(null)} />;
}
