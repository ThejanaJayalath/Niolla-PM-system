# Niolla Project & Lead Management System

Phase 1 implementation: **Lead & Sample Proposal Management**.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, MongoDB, JWT auth, PDFKit
- **Frontend:** React 18, TypeScript, Vite, React Router
- **Architecture:** Clean Architecture (Presentation, Application, Domain, Infrastructure)

## Staff hierarchy & account management

Accounts use three internal roles (shown in the UI with organizational labels):

| Role (stored) | UI label | Capabilities |
| --- | --- | --- |
| `owner` | **Super Admin** | Full system access; company **net profit** and P&amp;L; master ledger &amp; expenses; audit log; **delete accounts** and **financial logs** |
| `pm` | **Management (COO/VP)** | Manage projects, assign developers, operational reports, leads &amp; billing, per-project margins — **cannot** see company-wide net profit, open the master ledger, log expenses, or delete accounts / financial logs |
| `employee` | **Developer** | Assigned projects, tasks, personal wallet — **no** company revenue, profit, ledger, or leads pipeline |

**RBAC rules (enforced in API + UI):**

- **Developers** never see Live Business Balance, P&amp;L, Transactions, Expenses, or project deal economics tied to company margin.
- **Management** can approve payouts and export per-project financial sheets, but not company totals or core ledger rows.
- Only **Super Admin** creates expense entries, views the audit trail, and deletes staff accounts.

**Account creation:** Super Admin → **Team Management** → *Add account* (can create Management or Developer). Management can create **Developer** accounts only (optional track: Frontend / Backend / Full-stack).

**Developers** see a reduced sidebar: Dashboard, My Projects, Tasks, Notifications, Profile.

### Advanced customer profile (360° view)

Each customer has a dedicated profile at **Customer → open client**. The **360° Client Profile** panel aggregates:

- **Project history** — NIOLLA products (ERP, POS, CRM, etc.) and implementation status per project
- **Financial summary** — total revenue (CLV), paid amount, outstanding balance (from projects + payment plans + invoices)
- **Engagement** — proposals sent, meetings held, birthday cards sent
- **Staff activity log** — interactions, tasks, and requirements recorded by team members

API: `GET /api/v1/customers/:id/profile` (Super Admin & Management only).

## Phase 1 Features

1. **Inquiry Management** – Create/edit inquiries (customer name, phone, project description, features, notes). Duplicate phone number alert.
2. **Reminders & Meetings** – Schedule follow-up reminders and meetings per inquiry.
3. **Sample Proposal** – Create proposal from inquiry (auto-filled customer/project/features), add milestones and pricing manually.
4. **PDF Generation** – Download sample proposal as PDF (cover, table of contents, project overview, project management, deliverables & financials, conclusion).

### Proposal PDF – company logo

To show your logo on the proposal cover page, place your image here:

- **Path:** `backend/assets/proposal-logo.png` (or `proposal-logo.jpg`)
- Create the `backend/assets` folder if it doesn’t exist.
- Use a PNG or JPG; recommended width about 200–400 px.

If the file is missing, the cover shows “NIOLLA” text instead. See `backend/assets/README.md` for details.

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas) — your `.env` already has the Atlas URI

### Before you run (one-time setup)

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Create the admin user** (required to log in)
   ```bash
   cd backend
   npm run seed
   ```
   This creates **admin@niolla.com** / **admin123**. Safe to run again — it skips if the user already exists.

### Run the application

1. **Start the backend** (Terminal 1)
   ```bash
   cd backend
   npm run dev
   ```
   Backend runs at **http://localhost:5000**. Wait until you see "MongoDB connected".

2. **Start the frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs at **http://localhost:3000**.

3. **Open** http://localhost:3000 in your browser and log in with **admin@niolla.com** / **admin123**.

### Install as PWA (mobile / desktop)

The frontend is a **Progressive Web App** — you can install it like a native app.

1. **Production build** (service worker is generated on build):
   ```bash
   cd frontend
   npm run build
   npm run preview
   ```
   Open the preview URL (default **http://localhost:4173**).

2. **Install**
   - **Chrome / Edge (desktop):** address bar → **Install Niolla PM** (or ⋮ menu → *Install app*).
   - **Android Chrome:** menu → *Add to Home screen* / *Install app*.
   - **iPhone Safari:** Share → *Add to Home Screen*.

3. **Updates:** the app auto-updates the service worker when you deploy a new build (`registerType: autoUpdate`).

**Note:** API calls still need the backend running and reachable (same host in production, or configure your API base URL). GIF assets stay in the app; large GIFs are excluded from the install precache but cached at runtime when loaded.

### First Login

- **Email:** admin@niolla.com  
- **Password:** admin123  

Change the default password after first login (register a new user or update via DB if needed).

## Birthday card automation

Admins see **Birthdays today** on the Dashboard (owner / PM). The system matches clients, prospects, and employees whose **date of birth** (YYYY-MM-DD) falls on the current calendar day.

### Daily scan (8:00 AM)

Schedule the backend job (same pattern as overdue installments):

```bash
cd backend
npm run job:birthdays
```

Or call `GET /api/v1/jobs/scan-birthdays` as owner (e.g. from cron). This creates in-app notifications listing who has a birthday today.

**Windows Task Scheduler / cron example:** `0 8 * * *` → run `npm run job:birthdays` in the `backend` folder.

### Generate & send cards

1. Open the Dashboard → **Birthdays today**.
2. Click **Generate card** (uses OpenAI DALL·E when `OPENAI_API_KEY` is set; otherwise a branded SVG template with NIOLLA styling).
3. Click **Send email** or **Send WhatsApp**.

Optional logo on cards: place `proposal-logo.png` in `backend/assets/`.

### Environment variables (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | AI-generated birthday images (optional) |
| `OPENAI_IMAGE_MODEL` | Default `dall-e-3` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Send cards by email |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Auto WhatsApp via Twilio |
| `PUBLIC_API_BASE_URL` | Public URL for card images (required for Twilio media), e.g. `https://your-api.example.com` |

Without Twilio, **Send WhatsApp** opens a `wa.me` link with the greeting pre-filled (one-click manual send).

### CRM engagement (Dashboard)

| Feature | How it works |
| --- | --- |
| **Anniversary greetings** | Projects whose **start date** (or created date) hits its **first anniversary** today appear under *Project anniversaries today*. Generate/send thank-you cards. |
| **Festival blasts** | *Festival blast* sends NIOLLA-branded wishes to all active **prospects** (inquiries not LOST/CONFIRMED) via WhatsApp or email. |
| **Engagement tracking** | After sending, use **Mark replied** on a row (or view the stats table) to track who responds best. Stats aggregate sends and marked replies. |

Daily cron (optional, with birthdays at 8 AM):

```bash
npm run job:anniversaries
# or GET /api/v1/jobs/scan-anniversaries (owner)
```

## Festival discount & campaign management

Owners and PMs manage promotions under **Festival Campaigns** (`/campaigns`).

### Campaign setup

Create a campaign (e.g. **New Year Bonanza**) with:

- **Start date** and **end date** — the promotion is only active inside this window.
- **Discount value** — how much to take off eligible prices.
- **Product scope** — all products or specific lines (e.g. POS only).

### Discount application

Two discount types:

| Type | Example | Calculation |
| --- | --- | --- |
| **Percentage (%)** | 10% off | `discount = original × (value / 100)` |
| **Flat amount (LKR)** | LKR 10,000 off | `discount = min(original, value)` |

**Final price** = original price − discount (never below zero).

### Dynamic proposal & invoice

When a campaign is **active** and applies to the inquiry/product:

1. **Create proposal** — the system picks the best matching live campaign and stores `originalAmount`, `campaignDiscountAmount`, and `totalAmount` (final payable). The UI and PDFs show **Original price − Discount = Final payable**.
2. **Invoices** — on generation, if `current_date` is inside an active campaign window, discount logic applies to the grand total. Payment invoices keep the collected amount and store **Original price**, **Discount (campaign name)**, and **Final payable** as separate fields (`originalAmount`, `discountAmt`, `totalAmount`) for PDFs and the master ledger. Advance invoices without a proposal snapshot can pick up the live campaign automatically.
3. **Product Directory** — list prices show the live discounted price while the campaign runs.

### Reporting & ROI

Open **Festival Campaigns** → chart icon on a campaign (`GET /api/v1/campaigns/:id/report`):

| Field | Meaning |
| --- | --- |
| **Campaign sales** | Paid invoices tagged with this campaign discount during the festival dates (plus distinct products sold). |
| **Discount impact** | Revenue earned (net collected) vs total discount given (gross before discount for comparison). |
| **Customer growth** | New inquiries (prospects) created during the campaign period vs the prior calendar month. |

The report also includes product-level revenue vs baseline month and export to Excel.

### Other features

- **Marketing blast** — optional SMS/WhatsApp or email to open prospects.
- **Campaign report** — ROI summary above plus product comparison (e.g. POS vs prior month).
- **Auto-expiry** — `GET /api/v1/jobs/expire-campaigns` (or on connect) deactivates ended campaigns.
- **Ledger** — net income uses `total_amount`; `grossAmount` and `discountAmount` when a campaign discount was applied.

API: `GET/POST/PATCH/DELETE /api/v1/campaigns`, preview `GET /api/v1/campaigns/preview?inquiryId=&originalAmount=`, report `GET /api/v1/campaigns/:id/report` (owner / PM).

## Product-wise reporting

The catalog **Product** model links to **customers**, **invoices**, and **projects** via `productId`. Default products (POS, ERP, CRM) are created on first use.

| Report | Where | What it shows |
| --- | --- | --- |
| **Product profitability** | Reports → **Product Reports** | Net profit per product (paid invoice revenue minus project costs). |
| **Customer density** | Same tab | Active customers per product; highlights the product with the most active users. |
| **Sales trends (POS vs ERP)** | Same tab | Monthly paid-invoice revenue and month-over-month growth for POS and ERP. |
| **Top products** | Dashboard (owner / PM) | Live leaderboard: rank, active users, revenue, net profit. |

**Group by product** — On Reports, use the product dropdown to filter income, P&L, and product reports to one catalog item.

**Data setup**

1. Assign a product when adding/editing a customer (required in the customer form).
2. When a deal is confirmed, customers created from an inquiry with business model **POS**, **ERP**, or **CRM** are auto-linked to the matching catalog product.
3. Opening product reports or the dashboard leaderboard runs a sync that backfills `productId` on invoices and projects from the customer.

**API** (owner / PM unless noted):

- `GET /api/v1/reports/products/profitability?year=&month=` or `?from=&to=&productId=`
- `GET /api/v1/reports/products/customer-density?productId=`
- `GET /api/v1/reports/products/sales-trends?months=12`
- `GET /api/v1/reports/products/top-leaderboard`
- `GET /api/v1/products` — product directory with customer counts

## API

- **Base URL:** `http://localhost:5000/api/v1`
- **Full API docs:** See **[API.md](./API.md)** for all endpoints, request/response formats, and examples.

All protected routes require header: `Authorization: Bearer <token>`.

## Project Structure

```
backend/
  src/
    domain/entities/     # Inquiry, Reminder, Proposal, User
    application/services/ # InquiryService, ReminderService, ProposalService, AuthService
    infrastructure/      # MongoDB models, PDF generator
    presentation/        # Express app, routes, controllers, middleware
frontend/
  src/
    api/                 # API client
    components/          # Layout
    context/             # AuthContext
    pages/               # Login, Inquiries, InquiryForm, InquiryDetail, Reminders
```
