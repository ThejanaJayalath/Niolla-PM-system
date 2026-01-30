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
4. **PDF Generation** – Download sample proposal as PDF with disclaimer.

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
