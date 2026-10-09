// Runtime (in-session) configuration shared across the app.
// No environment variables: everything lives in memory and resets on reload.
export const CONFIG = {
  currency: "PKR",
  locale: "en-PK",
  company: {
    name: "TradeDesk Demo Co.",
    tagline: "Business Management System",
    address: "Office 12, Blue Area, Islamabad, Pakistan",
    phone: "+92 300 0000000",
    email: "hello@tradedesk.demo",
    ntn: "1234567-8",
    strn: "32-77-8899-123-45",
  },
  taxRate: 18,
  invoicePrefix: "INV",
  vertical: null,
};

export const setConfig = (patch) => { Object.assign(CONFIG, patch); };
export const setCompany = (patch) => { Object.assign(CONFIG.company, patch); };

export const fmt = (n) => `${CONFIG.currency} ${Math.round(n || 0).toLocaleString(CONFIG.locale)}`;
export const fmtNum = (n, d = 0) => Number(n || 0).toLocaleString(CONFIG.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtCur = (n, cur) => `${cur || CONFIG.currency} ${Number(n || 0).toLocaleString(CONFIG.locale, { maximumFractionDigits: 2 })}`;
export const todayStr = () => new Date().toISOString().split("T")[0];
