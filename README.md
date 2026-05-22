# Niolla Project & Lead Management System

Phase 1 implementation: **Lead & Sample Proposal Management**.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, MongoDB, JWT auth, PDFKit
- **Frontend:** React 18, TypeScript, Vite, React Router
- **Architecture:** Clean Architecture (Presentation, Application, Domain, Infrastructure)

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
