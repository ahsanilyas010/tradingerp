# TradeDesk ERP — interactive demo

A complete business-management system demo for six kinds of trading businesses, built with Vite + React 18.
Everything runs in the browser with fictional sample data: **no backend, no environment variables, no sign-in**.

## Editions

| Edition | Demo company | Edition-specific modules |
|---|---|---|
| Distribution | Al-Noor Distributors | Rider Hub: rider orders, stores, riders, live locations, products, store/area assignment, rider reports, config, commission |
| Importer | Crescent Global Imports | Shipments pipeline, landed-cost calculator, letters of credit, currencies & FX, overseas suppliers |
| Point of Sale | Metro Mart Supermarkets | POS terminal with receipts, sales register & refunds, shifts & cash drawer, branches, loyalty, barcodes & labels |
| Wholesale | Karachi Wholesale Traders | Quotations → sales orders → invoices, price lists, credit control |
| Services | Zenith Business Services | Projects & jobs, timesheets with time billing, retainers, staff utilisation |
| Manufacturing | Pak Precision Plastics | Bills of material, production orders, raw materials (MRP), work centres |

Every edition shares the same finance core (ported from the APT CRM): customers & vendors, invoices with printable PDF,
payments, purchases, expenses, inventory, returns, P&L, AR/AP, reports, plus Treasury (bank & cash, cheques, cash-flow
forecast, general ledger with trial balance and balance sheet, sales tax) and Administration (alerts, users & roles,
audit log, settings).

## Run locally

```bash
npm install
npm run dev
```

Build with `npm run build`; output goes to `dist/`. Deploys to Vercel as a static Vite site (`vercel.json` rewrites all routes to `index.html`).

## Structure

```
src/
  App.jsx                 landing page (business-type picker) + shell
  apt/AptCrm.jsx          finance core + Rider Hub (ported from APT CRM v3.1)
  data/profiles.js        per-edition vocabulary, company profile, catalogues
  data/seed.js            deterministic dummy-data generator
  data/mockApi.js         in-memory replacement for the Supabase API (same action names)
  lib/config.js           runtime settings (company, currency, tax)
  lib/invoiceDoc.js       in-browser invoice / printable documents
  verticals/shared.jsx    Treasury + Administration modules
  verticals/*.jsx         edition-specific modules
```

All data is fictional and resets on reload.
