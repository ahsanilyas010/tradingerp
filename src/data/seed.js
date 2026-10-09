// Deterministic dummy-data generator. Produces a complete in-memory database for a
// business profile. Everything is fictional. Seeded PRNG keeps data stable per profile.
import { OWNER_NAMES, RIDER_NAMES, STAFF } from "./profiles.js";

function mulberry32(a) { return function () { let t = (a += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DAY = 86400000;
const iso = d => new Date(d).toISOString();
const ymd = d => iso(d).slice(0, 10);
const pad = (n, w = 4) => String(n).padStart(w, "0");

export function buildSeed(profile) {
  const rnd = mulberry32(profile.key.length * 7919 + 42);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const chance = p => rnd() < p;
  const uuid = () => { const h = "0123456789abcdef"; let s = ""; for (let i = 0; i < 32; i++) s += h[Math.floor(rnd() * 16)]; return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20)}`; };
  const phone = () => `03${int(0, 4)}${int(0, 9)}-${pad(int(0, 9999999), 7)}`;
  const now = Date.now();
  const daysAgo = n => now - n * DAY;
  const staffEmail = () => pick(STAFF).email;

  const db = {};

  // ── Customers ──
  const customers = [];
  for (let i = 0; i < profile.custCount; i++) {
    const area = profile.areas[i % profile.areas.length];
    const prefix = profile.custPrefixes[i % profile.custPrefixes.length];
    const suffix = profile.key === "retail" ? ` #${pad(i + 1, 3)}` : (i >= profile.custPrefixes.length ? ` ${area.split(" ")[0]}` : "");
    customers.push({
      id: `C-${pad(i + 1, 3)}`, name: `${prefix}${suffix}`, city: profile.cityOf(area), area,
      owner_name: pick(OWNER_NAMES), mobile: phone(), open_bal: chance(0.2) ? int(5, 60) * 1000 : 0,
      notes: "", email: "", credit_limit: int(2, 12) * (profile.key === "wholesale" ? 400000 : profile.key === "importer" ? 1500000 : profile.key === "manufacturing" ? 300000 : 50000), category: pick(["A", "A", "B", "B", "C"]),
      created_at: iso(daysAgo(int(120, 540))),
    });
  }
  // A couple of intentional duplicates so the "merge duplicates" feature has something to do (distribution only)
  if (profile.riderHub) {
    const d1 = customers[3], d2 = customers[8];
    customers.push({ ...d1, id: `C-${pad(customers.length + 1, 3)}`, notes: "Added by rider sync" });
    customers.push({ ...d2, id: `C-${pad(customers.length + 1, 3)}`, notes: "Added by rider sync" });
  }
  db.customers = customers;

  // ── Vendors ──
  db.vendors = profile.vendors.map(([name, category], i) => ({
    id: `VEN-${pad(i + 1, 3)}`, name, category, contact: pick(OWNER_NAMES), mobile: phone(),
    open_bal: chance(0.3) ? int(10, 200) * 1000 : 0, notes: "",
    country: category.includes("·") ? category.split("·")[0].trim() : "Pakistan",
    currency: category.includes("China") ? "USD" : category.includes("Turkey") ? "EUR" : category.includes("UAE") ? "AED" : category.includes("Malaysia") ? "USD" : "PKR",
  }));

  // ── Products ──
  db.products = profile.products.map(([name, category, price, minStock], i) => {
    const trade = Number(price);
    const isRaw = category === "Raw Material";
    const isService = profile.key === "services";
    return {
      id: `P-${pad(i + 1, 3)}`, name, category, trade_price: trade,
      retail_price: Math.round(trade * (profile.key === "retail" ? 1.18 : 1.25)),
      cost_price: Math.round(trade * 0.78), current_stock: isService ? 0 : int(minStock, minStock * 4 + 10),
      min_stock: minStock, active: true, barcode: `880${pad(int(1000000, 9999999), 7)}${pad(i, 2)}`,
      unit: isRaw ? "kg" : isService ? "unit" : "pc", type: isRaw ? "raw" : isService ? "service" : "finished",
      created_at: iso(daysAgo(300)),
    };
  });
  // make a few low / out of stock
  if (profile.key !== "services") { db.products[2].current_stock = 0; db.products[5].current_stock = Math.max(0, db.products[5].min_stock - 1); db.products[9].current_stock = 1; }
  const prodByCat = {};
  db.products.forEach(p => (prodByCat[p.category] = prodByCat[p.category] || []).push(p));
  const sellable = db.products.filter(p => p.type !== "raw");

  // ── Invoices + items + receipts ──
  const invoices = [], invoice_items = [], payments = [];
  let invNo = 1000, payNo = 1, itemId = 1;
  const invCount = profile.key === "retail" ? 130 : 170;
  for (let i = 0; i < invCount; i++) {
    const age = Math.floor(Math.pow(rnd(), 1.4) * 180); // skew towards recent
    const cust = pick(customers.slice(0, profile.custCount));
    const id = `INV-${pad(invNo++)}`;
    const nItems = int(1, 5);
    let total = 0;
    const used = new Set();
    for (let k = 0; k < nItems; k++) {
      const p = pick(sellable); if (used.has(p.id)) continue; used.add(p.id);
      const qty = profile.key === "wholesale" ? int(5, 60) : profile.key === "services" ? int(1, 3) : profile.key === "importer" ? (p.trade_price > 50000 ? int(1, 4) : int(2, 15)) : int(1, 24);
      const rate = p.trade_price; const line = qty * rate; total += line;
      invoice_items.push({ id: itemId++, invoice_id: id, product_id: p.id, product_name: p.name, qty, rate, total: line, notes: "" });
    }
    let status = age > 45 ? (chance(0.88) ? "Paid" : chance(0.5) ? "Partial" : "Unpaid") : age > 20 ? (chance(0.6) ? "Paid" : chance(0.5) ? "Partial" : "Unpaid") : (chance(0.3) ? "Paid" : chance(0.25) ? "Partial" : "Unpaid");
    if (chance(0.03)) status = "VOIDED";
    const date = ymd(daysAgo(age));
    const terms = pick(profile.payTerms);
    invoices.push({ id, date, cust_id: cust.id, cust_name: cust.name, total: status === "VOIDED" ? 0 : total, status, pay_terms: terms, created_by: staffEmail(), notes: chance(0.3) ? pick(["Urgent delivery", "Repeat order", "Promo pricing applied", "Delivered by rider", "Customer pickup"]) : "", pdf_url: "", tax_rate: 0 });
    if (status === "Paid") payments.push({ id: `PAY-${pad(payNo++)}`, date: ymd(daysAgo(Math.max(0, age - int(1, 20)))), type: "Received", party_id: cust.id, ref_id: id, amount: total, notes: pick(["Cash", "Bank transfer", "JazzCash", "EasyPaisa", "Cheque"]), method: "Cash" });
    else if (status === "Partial") payments.push({ id: `PAY-${pad(payNo++)}`, date: ymd(daysAgo(Math.max(0, age - int(1, 10)))), type: "Received", party_id: cust.id, ref_id: id, amount: Math.round(total * (int(30, 70) / 100)), notes: "Part payment", method: "Cash" });
  }
  invoices.sort((a, b) => b.date.localeCompare(a.date));
  db.invoices = invoices; db.invoice_items = invoice_items;

  // ── Purchases + items + payments made ──
  const purchases = [], purchase_items = [];
  const purCount = 38;
  const buyable = profile.key === "services" ? db.products : db.products.filter(p => p.type !== "service");
  for (let i = 0; i < purCount; i++) {
    const age = int(2, 175);
    const v = pick(db.vendors.slice(0, 6));
    const id = `PO-${pad(i + 1, 3)}`;
    let total = 0;
    const n = int(1, 4); const used = new Set();
    for (let k = 0; k < n; k++) {
      const p = pick(buyable); if (used.has(p.id)) continue; used.add(p.id);
      const qty = profile.key === "manufacturing" && p.type === "raw" ? int(120, 700) : profile.key === "wholesale" ? int(20, 80) : profile.key === "importer" ? (p.trade_price > 50000 ? int(2, 8) : int(10, 60)) : int(6, 48);
      const rate = p.cost_price; const line = qty * rate; total += line;
      purchase_items.push({ id: itemId++, purchase_id: id, product_id: p.id, product_name: p.name, qty, rate, total: line, notes: "" });
    }
    purchases.push({ id, date: ymd(daysAgo(age)), vendor_id: v.id, total, notes: `Vendor Inv #${int(1000, 9999)}`, status: age > 10 ? "Received" : "Ordered" });
    const paidFrac = age > 40 ? (chance(0.8) ? 1 : 0.5) : age > 15 ? (chance(0.5) ? 1 : chance(0.5) ? 0.5 : 0) : (chance(0.2) ? 1 : 0);
    if (paidFrac > 0) payments.push({ id: `PAY-${pad(payNo++)}`, date: ymd(daysAgo(Math.max(0, age - int(0, 12)))), type: "Made", party_id: v.id, ref_id: id, amount: Math.round(total * paidFrac), notes: paidFrac === 1 ? "Full settlement" : "Part payment", method: "Bank Transfer" });
  }
  purchases.sort((a, b) => b.date.localeCompare(a.date));
  payments.sort((a, b) => b.date.localeCompare(a.date));
  db.vendors_purchases = purchases; db.purchase_items = purchase_items; db.payments = payments;

  // ── Expenses ──
  const expenses = [];
  for (let i = 0; i < 72; i++) {
    const cat = pick(profile.expenseCats);
    const base = /Salar|Labour/.test(cat) ? int(60, 180) * 1000 : /Rent|Duty|Electric|Power/.test(cat) ? int(30, 120) * 1000 : int(2, 25) * 1000;
    expenses.push({ id: `EXP-${pad(i + 1, 3)}`, date: ymd(daysAgo(int(0, 175))), category: cat, amount: Math.round(base * (profile.key === "retail" ? 0.3 : 1)), notes: pick(["Monthly", "Paid via bank", "Petty cash", "Approved by admin", "Receipt attached"]), by: staffEmail() });
  }
  expenses.sort((a, b) => b.date.localeCompare(a.date));
  db.expenses = expenses;

  // ── Settings, users, bank, cheques (all verticals) ──
  db.app_settings = [
    { key: "incentive_per_order", value: "150" }, { key: "monthly_target_orders", value: "120" }, { key: "bonus_amount", value: "5000" }, { key: "bonus_threshold_orders", value: "150" },
    { key: "push_title_default", value: "New order update" }, { key: "push_body_default", value: "Open the app to see details." },
    { key: "email_notification_recipients", value: JSON.stringify([STAFF[0].email, STAFF[1].email]) },
    { key: "sales_tax_rate", value: "18" }, { key: "fiscal_year_start", value: "07-01" },
  ];
  db.push_subscriptions = Array.from({ length: profile.riderHub ? 6 : 0 }, () => ({ id: uuid() }));
  db.users = STAFF.map((s, i) => ({ id: `U-${i + 1}`, ...s, status: "Active", last_login: iso(daysAgo(int(0, 5))), modules: i === 0 ? "All" : i === 4 ? "Reports (read-only)" : "Operations, Finance" }));
  db.bank_accounts = [
    { id: "BA-1", name: "Main Current Account", bank: "Meezan Bank", account_no: "PK36MEZN0001230456789012", type: "Bank", opening_balance: 2450000, currency: "PKR" },
    { id: "BA-2", name: "Collections Account", bank: "HBL", account_no: "PK12HABB0000112233445566", type: "Bank", opening_balance: 880000, currency: "PKR" },
    { id: "BA-3", name: "Petty Cash", bank: "—", account_no: "Cash in hand", type: "Cash", opening_balance: 125000, currency: "PKR" },
    { id: "BA-4", name: "JazzCash Merchant", bank: "JazzCash", account_no: "0300-0000000", type: "Wallet", opening_balance: 64000, currency: "PKR" },
  ];
  if (profile.key === "importer") db.bank_accounts.push({ id: "BA-5", name: "USD Import Account", bank: "Standard Chartered", account_no: "PK55SCBL0000998877665544", type: "Bank", opening_balance: 42000, currency: "USD" });
  const bankTx = [];
  for (let i = 0; i < 60; i++) {
    const acc = pick(db.bank_accounts.filter(a => a.currency === "PKR"));
    const isIn = chance(0.55);
    bankTx.push({ id: `BT-${pad(i + 1, 3)}`, account_id: acc.id, date: ymd(daysAgo(int(0, 120))), type: isIn ? "Deposit" : "Withdrawal", amount: int(5, 400) * 1000, ref: isIn ? pick(["Customer transfer", "Cash deposit", "Cheque clearing", "Online payment"]) : pick(["Vendor payment", "Salaries", "Utility bill", "Bank charges", "Cash withdrawal"]), notes: "" });
  }
  bankTx.sort((a, b) => b.date.localeCompare(a.date));
  db.bank_transactions = bankTx;
  const cheques = [];
  for (let i = 0; i < 18; i++) {
    const received = chance(0.6);
    const party = received ? pick(customers) : pick(db.vendors);
    const due = int(-20, 45);
    cheques.push({ id: `CHQ-${pad(i + 1, 3)}`, number: String(int(100000, 999999)), bank: pick(["HBL", "UBL", "MCB", "Meezan", "Allied", "Bank Alfalah", "Askari"]), party_id: party.id, party_name: party.name, type: received ? "Received" : "Issued", amount: int(20, 600) * 1000, date: ymd(daysAgo(int(5, 60))), due_date: ymd(now - due * DAY), status: due > 5 ? (chance(0.85) ? "Cleared" : "Bounced") : due > -5 ? "Deposited" : "Pending" });
  }
  db.cheques = cheques;
  db.audit_log = [
    { id: 1, at: iso(daysAgo(0.1)), user: STAFF[1].email, action: "Payment recorded", detail: `${payments[0]?.id} · PKR ${payments[0]?.amount?.toLocaleString()}` },
    { id: 2, at: iso(daysAgo(0.3)), user: STAFF[2].email, action: "Invoice created", detail: invoices[0]?.id },
    { id: 3, at: iso(daysAgo(0.9)), user: STAFF[3].email, action: "Stock adjusted", detail: `${db.products[0].name} +40` },
    { id: 4, at: iso(daysAgo(1.2)), user: STAFF[0].email, action: "Vendor added", detail: db.vendors[db.vendors.length - 1].name },
    { id: 5, at: iso(daysAgo(2.1)), user: STAFF[1].email, action: "Expense saved", detail: `${expenses[0].category} · PKR ${expenses[0].amount.toLocaleString()}` },
  ];

  // ── Rider hub (distribution) ──
  db.areas = []; db.stores = []; db.profiles = []; db.rider_locations = []; db.store_assignments = []; db.rider_areas = [];
  db.orders = []; db.order_items = []; db.returns = []; db.return_items = []; db.rider_payment_permissions = []; db.order_payment_collections = [];
  // Stores mirror customers (every vertical can use Returns)
  customers.slice(0, profile.custCount).forEach((c, i) => {
    db.stores.push({ id: uuid(), name: c.name, owner_name: c.owner_name, mobile: c.mobile, address: `Shop ${int(1, 60)}, ${c.area}, ${c.city}`, area: c.area, city: c.city, category: pick(["Grocery", "Pharmacy", "Mini Mart", "Supermarket", "Bakery", "General Store"]), gas_customer_id: c.id, latitude: 33.68 + rnd() * 0.06, longitude: 73.0 + rnd() * 0.1, payment_terms: pick(["cod", "net7", "net15", "net30"]), created_by: null, created_at: c.created_at });
  });
  if (profile.riderHub) {
    const areaRows = profile.areas.map(a => ({ id: uuid(), city: profile.cityOf(a), name: a, created_at: iso(daysAgo(200)) }));
    db.areas = areaRows;
    // unlinked rider-added stores
    ["New Shop near Masjid", "Corner Store (rider added)", "Bismillah Tuck Shop"].forEach((n, i) => db.stores.push({ id: uuid(), name: n, owner_name: pick(OWNER_NAMES), mobile: phone(), address: `${profile.areas[i]} back street`, area: profile.areas[i], city: profile.cityOf(profile.areas[i]), category: "Mini Mart", gas_customer_id: null, latitude: 33.69 + rnd() * 0.05, longitude: 73.02 + rnd() * 0.08, payment_terms: "cod", created_by: null, created_at: iso(daysAgo(int(1, 15))) }));
    db.profiles = RIDER_NAMES.map((n, i) => ({ id: uuid(), full_name: n, mobile: phone(), cnic: `61101-${pad(int(1000000, 9999999), 7)}-${int(1, 9)}`, city: i < 4 ? "Islamabad" : "Rawalpindi", area: profile.areas[i * 2], bike_available: i !== 4, active: i !== 5, role: "rider", created_at: iso(daysAgo(int(60, 300))) }));
    db.rider_locations = db.profiles.map((r, i) => ({ rider_id: r.id, latitude: 33.68 + rnd() * 0.06, longitude: 73.0 + rnd() * 0.1, accuracy: int(5, 40), updated_at: iso(now - int(1, i === 5 ? 3000 : 25) * 60000) }));
    db.rider_payment_permissions = db.profiles.map((r, i) => ({ rider_id: r.id, payment_collection_enabled: i < 3, updated_at: iso(daysAgo(10)) }));
    db.profiles.forEach((r, i) => {
      db.stores.filter((s, j) => j % db.profiles.length === i).slice(0, 10).forEach(s => db.store_assignments.push({ id: uuid(), rider_id: r.id, store_id: s.id, created_at: iso(daysAgo(30)) }));
      areaRows.filter((a, j) => j % db.profiles.length === i).forEach(a => db.rider_areas.push({ id: uuid(), rider_id: r.id, area_id: a.id, created_at: iso(daysAgo(30)) }));
    });
    const statuses = ["Pending", "Approved", "Packed", "Dispatched", "Delivered", "Delivered", "Delivered", "Delivered", "Cancelled"];
    let orderNo = 5001;
    for (let i = 0; i < 140; i++) {
      const age = Math.floor(Math.pow(rnd(), 1.5) * 90);
      const rider = pick(db.profiles.slice(0, 5));
      const store = pick(db.stores);
      const status = age < 2 ? pick(["Pending", "Pending", "Approved"]) : age < 5 ? pick(["Approved", "Packed", "Dispatched", "Delivered"]) : pick(statuses);
      const id = uuid();
      let total = 0; const used = new Set();
      for (let k = 0; k < int(1, 4); k++) { const p = pick(sellable); if (used.has(p.id)) continue; used.add(p.id); const q = int(1, 12); const t = q * p.trade_price; total += t; db.order_items.push({ id: itemId++, order_id: id, product_id: p.id, product_name: p.name, quantity: q, trade_price: p.trade_price, total: t }); }
      const linkedInv = status === "Delivered" && chance(0.7) ? pick(invoices.filter(x => x.status !== "VOIDED")).id : null;
      db.orders.push({ id, order_no: orderNo++, store_id: store.id, rider_id: rider.id, total_value: total, incentive: status === "Delivered" ? 150 : 0, status, created_at: iso(daysAgo(age) - int(0, 36000000)), payment_status: status === "Delivered" && chance(0.65) ? "paid" : "unpaid", amount_paid: 0, gas_invoice_id: linkedInv, notes: "" });
    }
    db.orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
    db.orders.filter(o => o.payment_status === "paid").slice(0, 26).forEach((o, i) => db.order_payment_collections.push({ id: uuid(), order_id: o.id, rider_id: o.rider_id, amount: o.total_value, payment_method: pick(["cash", "jazzcash", "easypaisa", "bank"]), notes: chance(0.3) ? "Collected at shop" : "", collected_at: iso(new Date(o.created_at).getTime() + int(1, 48) * 3600000) }));
  }
  // Returns (all verticals)
  const retReasons = ["Damaged in transit", "Near expiry", "Wrong item delivered", "Customer over-ordered", "Quality complaint", "Short shelf life"];
  for (let i = 0; i < 9; i++) {
    const store = pick(db.stores); const id = uuid();
    let total = 0; const used = new Set();
    for (let k = 0; k < int(1, 3); k++) { const p = pick(sellable); if (used.has(p.id)) continue; used.add(p.id); const q = int(1, 6); total += q * p.trade_price; db.return_items.push({ id: itemId++, return_id: id, product_id: p.id, product_name: p.name, qty: q, trade_price: p.trade_price }); }
    const linkedOrder = profile.riderHub ? pick(db.orders.filter(o => o.store_id === store.id)) : null;
    db.returns.push({ id, return_no: 301 + i, store_id: store.id, order_id: linkedOrder?.id || null, rider_id: linkedOrder?.rider_id || null, gas_invoice_id: pick(invoices.filter(x => x.cust_id === store.gas_customer_id))?.id || null, reason: pick(retReasons), total, status: i < 3 ? "Pending" : "Processed", gas_credit_id: i > 5 ? `CN-${pad(i, 3)}` : null, created_at: iso(daysAgo(int(0, 40))) });
  }
  db.returns.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // ── Vertical-specific tables ──
  db.shipments = []; db.lcs = []; db.fx_rates = []; db.branches = []; db.pos_sales = []; db.pos_sale_items = []; db.shifts = []; db.loyalty = [];
  db.quotes = []; db.sales_orders = []; db.price_lists = []; db.projects = []; db.timesheets = []; db.retainers = []; db.boms = []; db.production_orders = []; db.work_centers = [];

  if (profile.key === "importer") {
    db.fx_rates = [{ code: "USD", name: "US Dollar", rate: 278.5, prev: 277.9 }, { code: "EUR", name: "Euro", rate: 302.1, prev: 303.4 }, { code: "AED", name: "UAE Dirham", rate: 75.8, prev: 75.7 }, { code: "CNY", name: "Chinese Yuan", rate: 38.4, prev: 38.2 }, { code: "GBP", name: "British Pound", rate: 352.6, prev: 350.9 }, { code: "SAR", name: "Saudi Riyal", rate: 74.2, prev: 74.1 }];
    const ports = ["Shanghai", "Shenzhen (Yantian)", "Istanbul (Ambarli)", "Jebel Ali", "Port Klang", "Ningbo"];
    const stages = ["Quotation", "PI Confirmed", "Production", "Shipped", "At Port", "Customs", "Cleared", "In Warehouse"];
    for (let i = 0; i < 14; i++) {
      const v = db.vendors[i % 6]; const stage = i < 3 ? stages[int(0, 2)] : i < 7 ? stages[int(3, 5)] : stages[int(6, 7)];
      const fob = int(8, 60) * 1000; const cur = v.currency === "PKR" ? "USD" : v.currency; const rate = db.fx_rates.find(f => f.code === cur)?.rate || 278.5;
      const freight = int(1800, 4200), insurance = Math.round(fob * 0.01), fobPkr = fob * rate;
      const duty = Math.round(fobPkr * 0.2), st = Math.round((fobPkr + duty) * 0.18), it = Math.round(fobPkr * 0.055), clearing = int(60, 180) * 1000, port = int(40, 120) * 1000, transport = int(35, 90) * 1000;
      const items = []; const used = new Set(); let qty = 0;
      for (let k = 0; k < int(2, 4); k++) { const p = pick(db.products); if (used.has(p.id)) continue; used.add(p.id); const q = int(50, 600); qty += q; items.push({ product_id: p.id, product_name: p.name, qty: q, unit_price_fc: Math.round(p.cost_price / rate * 100) / 100 }); }
      const eta = daysAgo(int(-40, 30));
      db.shipments.push({ id: `SHP-${pad(i + 1, 3)}`, ref: `CGI/${new Date().getFullYear()}/${pad(i + 21, 3)}`, vendor_id: v.id, vendor_name: v.name, origin_port: pick(ports), dest_port: "Karachi (KICT)", container: `${pick(["MSCU", "TGHU", "CMAU", "OOLU"])}${int(1000000, 9999999)}`, size: pick(["20ft", "40ft", "40ft HC"]), incoterm: pick(["FOB", "CIF", "CFR"]), currency: cur, fx_rate: rate, fob_value: fob, freight_fc: freight, insurance_fc: insurance, duty_pkr: duty, sales_tax_pkr: st, income_tax_pkr: it, clearing_pkr: clearing, port_charges_pkr: port, transport_pkr: transport, stage, etd: ymd(eta - 25 * DAY), eta: ymd(eta), bl_no: `BL${int(100000000, 999999999)}`, gd_no: stage === "Cleared" || stage === "In Warehouse" ? `KPPI-HC-${int(10000, 99999)}` : "", items, total_qty: qty, lc_id: i % 3 === 0 ? `LC-${pad(Math.floor(i / 3) + 1, 3)}` : null, created_at: iso(eta - 60 * DAY) });
    }
    for (let i = 0; i < 5; i++) { const s = db.shipments[i * 3]; db.lcs.push({ id: `LC-${pad(i + 1, 3)}`, number: `ILC/${int(1000, 9999)}/${new Date().getFullYear()}`, bank: pick(["Meezan Bank", "HBL", "Standard Chartered", "Bank Alfalah"]), beneficiary: s.vendor_name, currency: s.currency, amount: s.fob_value, margin_pct: 20, status: i < 2 ? "Open" : i < 4 ? "Documents Received" : "Settled", issue_date: ymd(daysAgo(int(30, 90))), expiry: ymd(daysAgo(int(-90, -10))), shipment_id: s.id }); }
  }

  if (profile.key === "retail") {
    db.branches = [{ id: "BR-1", name: "Gulberg Flagship", city: "Lahore", manager: STAFF[2].name, tills: 4 }, { id: "BR-2", name: "DHA Phase 3", city: "Lahore", manager: OWNER_NAMES[4], tills: 3 }, { id: "BR-3", name: "Johar Town", city: "Lahore", manager: OWNER_NAMES[7], tills: 2 }];
    const cashiers = ["Ali Raza", "Sumbal Khan", "Hassan Butt", "Mariam Shah", "Bilal Tariq"];
    let rec = 10001;
    for (let i = 0; i < 260; i++) {
      const age = Math.pow(rnd(), 1.6) * 30; const br = pick(db.branches); let total = 0; const id = `R-${rec++}`; const used = new Set();
      for (let k = 0; k < int(1, 7); k++) { const p = pick(db.products); if (used.has(p.id)) continue; used.add(p.id); const q = int(1, 4); const t = q * p.retail_price; total += t; db.pos_sale_items.push({ sale_id: id, product_id: p.id, product_name: p.name, qty: q, price: p.retail_price, total: t }); }
      const disc = chance(0.15) ? Math.round(total * 0.05) : 0;
      db.pos_sales.push({ id, branch_id: br.id, date: iso(now - age * DAY), cashier: pick(cashiers), customer_id: chance(0.3) ? pick(customers).id : null, subtotal: total, discount: disc, tax: Math.round((total - disc) * 0.0), total: total - disc, method: pick(["Cash", "Cash", "Card", "JazzCash", "EasyPaisa"]), status: chance(0.02) ? "Refunded" : "Completed", items_count: used.size });
    }
    db.pos_sales.sort((a, b) => b.date.localeCompare(a.date));
    for (let i = 0; i < 24; i++) { const br = db.branches[i % 3]; const d = daysAgo(Math.floor(i / 3)); const sales = db.pos_sales.filter(s => s.branch_id === br.id && s.date.slice(0, 10) === ymd(d)); const cash = sales.filter(s => s.method === "Cash").reduce((a, s) => a + s.total, 0); db.shifts.push({ id: `SH-${pad(i + 1, 3)}`, branch_id: br.id, date: ymd(d), cashier: pick(cashiers), opened_at: "09:00", closed_at: i < 3 ? "" : "22:00", opening_float: 20000, cash_sales: cash, expected_cash: 20000 + cash, counted_cash: i < 3 ? 0 : 20000 + cash - (chance(0.2) ? int(50, 900) : 0), status: i < 3 ? "Open" : "Closed", sales_count: sales.length }); }
    db.loyalty = customers.slice(0, 20).map((c, i) => ({ customer_id: c.id, card_no: `MM-${pad(1000 + i, 5)}`, points: int(100, 5000), tier: i < 4 ? "Gold" : i < 10 ? "Silver" : "Bronze", visits: int(3, 60), last_visit: ymd(daysAgo(int(0, 20))) }));
  }

  if (profile.key === "wholesale") {
    db.price_lists = [{ id: "PL-1", name: "Retail", markup: 12 }, { id: "PL-2", name: "Wholesale", markup: 6 }, { id: "PL-3", name: "Distributor (Bulk)", markup: 3 }];
    for (let i = 0; i < 16; i++) { const c = pick(customers); let total = 0; const items = []; const used = new Set(); for (let k = 0; k < int(1, 4); k++) { const p = pick(db.products); if (used.has(p.id)) continue; used.add(p.id); const q = int(10, 200); total += q * p.trade_price; items.push({ product_id: p.id, product_name: p.name, qty: q, rate: p.trade_price }); } const age = int(0, 40); db.quotes.push({ id: `QT-${pad(i + 1, 3)}`, date: ymd(daysAgo(age)), valid_until: ymd(daysAgo(age - 14)), cust_id: c.id, cust_name: c.name, total, status: age > 14 ? pick(["Accepted", "Rejected", "Expired", "Accepted"]) : pick(["Sent", "Draft", "Sent"]), items, notes: "" }); }
    for (let i = 0; i < 22; i++) { const c = pick(customers); let total = 0; const items = []; const used = new Set(); for (let k = 0; k < int(1, 4); k++) { const p = pick(db.products); if (used.has(p.id)) continue; used.add(p.id); const q = int(10, 300); total += q * p.trade_price; items.push({ product_id: p.id, product_name: p.name, qty: q, rate: p.trade_price }); } const age = int(0, 45); db.sales_orders.push({ id: `SO-${pad(i + 1, 3)}`, date: ymd(daysAgo(age)), cust_id: c.id, cust_name: c.name, total, status: age < 3 ? "Confirmed" : age < 8 ? pick(["Picking", "Dispatched"]) : pick(["Delivered", "Delivered", "Invoiced"]), items, delivery_date: ymd(daysAgo(age - 3)), godown: pick(["Godown A (Jodia)", "Godown B (SITE)"]) }); }
  }

  if (profile.key === "services") {
    const staff = ["Sara Khan", "Omer Siddiqui", "Hira Malik", "Zain Abbas", "Mahnoor Ali", "Daniyal Rauf"];
    for (let i = 0; i < 18; i++) { const c = customers[i % customers.length]; const budget = int(80, 900) * 1000; const age = int(5, 120); const pct = Math.min(100, Math.round(age * int(1, 3))); db.projects.push({ id: `PRJ-${pad(i + 1, 3)}`, name: pick(["Website Redesign", "Call Center Setup", "Brand Refresh", "Monthly Bookkeeping", "Lead Gen Campaign", "Mobile App MVP", "SEO Programme", "Payroll Outsourcing", "CRM Implementation"]) + ` — ${c.name.split(" ")[0]}`, cust_id: c.id, cust_name: c.name, manager: pick(staff), budget, billed: Math.round(budget * pct / 100 * 0.8), hours_est: int(40, 600), hours_logged: int(10, 500), start: ymd(daysAgo(age)), due: ymd(daysAgo(age - int(30, 120))), status: pct >= 100 ? "Completed" : age < 10 ? "Planning" : pick(["In Progress", "In Progress", "On Hold"]), progress: Math.min(100, pct) }); }
    for (let i = 0; i < 80; i++) { const p = pick(db.projects); db.timesheets.push({ id: `TS-${pad(i + 1, 3)}`, date: ymd(daysAgo(int(0, 30))), staff: pick(staff), project_id: p.id, project_name: p.name, hours: pick([2, 3, 4, 6, 8]), task: pick(["Development", "Design", "Client call", "QA", "Reporting", "Research", "Support tickets"]), billable: chance(0.8), rate: 3500 }); }
    db.retainers = customers.slice(0, 9).map((c, i) => ({ id: `RET-${pad(i + 1, 3)}`, cust_id: c.id, cust_name: c.name, service: pick(["SEO Retainer", "Bookkeeping", "Social Media Mgmt", "Call Center 3 Seats", "Paid Ads Mgmt"]), monthly_fee: int(35, 250) * 1000, start: ymd(daysAgo(int(60, 400))), next_invoice: ymd(daysAgo(-int(1, 28))), status: i === 7 ? "Paused" : "Active", hours_included: pick([20, 40, 60, 0]) }));
  }

  if (profile.key === "manufacturing") {
    const fin = db.products.filter(p => p.type === "finished"); const raw = db.products.filter(p => p.type === "raw");
    db.work_centers = [{ id: "WC-1", name: "Injection Line A", capacity_hrs: 20, status: "Running" }, { id: "WC-2", name: "Injection Line B", capacity_hrs: 20, status: "Running" }, { id: "WC-3", name: "Blow Moulding", capacity_hrs: 16, status: "Maintenance" }, { id: "WC-4", name: "Extrusion (Bags)", capacity_hrs: 20, status: "Running" }];
    fin.forEach((f, i) => { const r1 = raw[i % 4], r2 = raw[4 + (i % 2)], r3 = raw[6]; const mat = f.trade_price * (0.5 + rnd() * 0.12); db.boms.push({ id: `BOM-${pad(i + 1, 3)}`, product_id: f.id, product_name: f.name, output_qty: 1, components: [{ product_id: r1.id, product_name: r1.name, qty: Math.max(0.1, Math.round(mat * 0.8 / r1.trade_price * 10) / 10) }, { product_id: r2.id, product_name: r2.name, qty: Math.max(0.01, Math.round(mat * 0.12 / r2.trade_price * 100) / 100) }, { product_id: r3.id, product_name: r3.name, qty: Math.max(1, Math.round(mat * 0.08 / r3.trade_price)) }], labour_cost: Math.round(f.trade_price * (0.08 + rnd() * 0.06)), overhead_cost: Math.round(f.trade_price * (0.05 + rnd() * 0.05)), scrap_pct: int(1, 4) }); });
    for (let i = 0; i < 20; i++) { const b = pick(db.boms); const qty = int(20, 300); const age = int(-10, 45); const status = age < 0 ? "Planned" : age < 4 ? "In Progress" : age < 6 ? "QC" : "Completed"; const produced = status === "Completed" ? qty : status === "QC" ? qty : status === "In Progress" ? int(1, qty - 1) : 0; db.production_orders.push({ id: `MO-${pad(i + 1, 3)}`, bom_id: b.id, product_id: b.product_id, product_name: b.product_name, qty, produced, scrap: status === "Completed" ? int(0, Math.round(qty * 0.04)) : 0, work_center: pick(db.work_centers).name, start: ymd(daysAgo(age)), due: ymd(daysAgo(age - 5)), status, priority: pick(["Normal", "Normal", "High", "Low"]) }); }
    db.production_orders.sort((a, b) => b.start.localeCompare(a.start));
  }

  return db;
}
