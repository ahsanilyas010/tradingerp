// Assembles a business-edition config: profile vocabulary + nav groups + extension pages.
import { PROFILES } from "../data/profiles.js";
import { SHARED_PAGES } from "./shared.jsx";
import { Truck, Ship, Store, Warehouse, Briefcase, Factory } from "lucide-react";
import { IMPORTER } from "./importer.jsx";
import { RETAIL } from "./retail.jsx";
import { WHOLESALE } from "./wholesale.jsx";
import { SERVICES } from "./services.jsx";
import { MANUFACTURING } from "./manufacturing.jsx";

const ICONS = { truck: Truck, ship: Ship, store: Store, warehouse: Warehouse, briefcase: Briefcase, factory: Factory };
const EXT = { importer: IMPORTER, retail: RETAIL, wholesale: WHOLESALE, services: SERVICES, manufacturing: MANUFACTURING };

export function getVertical(key) {
  const p = PROFILES[key] || PROFILES.distribution;
  const ext = EXT[key] || {};
  return {
    key: p.key, label: p.label, title: p.title, blurb: p.blurb, accent: p.accent, riderHub: p.riderHub,
    company: p.company, customerWord: p.customerWord, customerWordPlural: p.customerWordPlural,
    expenseCats: p.expenseCats, payTerms: p.payTerms, defaultCity: p.cityOf(p.areas[0]),
    LogoIcon: ICONS[p.icon],
    navGroups: ext.navGroups || [],
    pages: { ...SHARED_PAGES, ...(ext.pages || {}) },
    DashboardExtra: ext.DashboardExtra || null,
  };
}
export const VERTICAL_LIST = Object.values(PROFILES).map(p => ({ ...p, LogoIcon: ICONS[p.icon] }));
