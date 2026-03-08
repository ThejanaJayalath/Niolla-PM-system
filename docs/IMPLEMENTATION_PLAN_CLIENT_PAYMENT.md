# Implementation Plan: Internal Client Payment Management System

**Document version:** 1.0  
**Date:** March 8, 2025  
**Status:** Planning — Do not start coding until core logic and priorities are confirmed.

This document describes how to add **Client Payment Management** features to the existing **Niolla PM System**, following the ER diagram (`er-diagram.html`) and the reference frontend flow described in `niolla-employee-system (1).html`. All changes must follow the **current Niolla theme and design** (orange/peach sidebar, light background, existing layout patterns), not the dark theme of the reference HTML.

---

## 1. Executive Summary

### 1.1 Goal

Extend Niolla PM into an **Internal Client Payment Management System** where:

- **Clients** (customers) own **Projects** (contracts/systems).
- Each **Project** has a **Payment Plan** (down payment, installments 3–6).
- **Installments** are scheduled payments; **Payment Transactions** record actual payments (full or partial).
- **Invoices** are auto-generated from transactions; **Notifications** handle due/overdue alerts.
- **Users/Roles** and **Audit Log** provide RBAC and traceability; **Payment Gateway** and **Reports** support integrations and analytics.

### 1.2 Current System Snapshot

| Layer | Stack | Relevant existing pieces |
|-------|--------|---------------------------|
| **Backend** | Node.js, Express, TypeScript, MongoDB | Clean Architecture: `domain/entities`, `application/services`, `infrastructure/database/models`, `presentation/routes` + `controllers` |
| **Frontend** | React 18, Vite, React Router, Tailwind | Layout (Sidebar + Header), Dashboard, Customer, Billing, Team, Inquiries, Proposals, Reminders |
| **Theme** | Primary `#FB8C19`, Sidebar `#FFF1E4`, Background `#FAF9F6` | CSS vars: `--primary`, `--primary-50`, `--bg-surface`, `--text-primary`, etc. |
| **Auth** | JWT | User entity: `email`, `passwordHash`, `name`, `role` (owner \| pm \| employee), `status` |

Existing **Customer** has: `customerId`, `name`, `phoneNumber`, `email`, `projects[]`, `inquiryId`.  
Existing **Billing** is inquiry-linked (billingId, customerName, items, totalAmount, billingType, etc.) — different from the new **installment + transaction + invoice** flow.

---

## 2. ER Model vs Current Codebase

### 2.1 Entity Mapping

| ER Entity | Purpose | Current codebase | Action |
|-----------|---------|------------------|--------|
| **CLIENT** | Root: full_name, email, phone, address, business_type, company_name, nic_number, status | `Customer` (simplified) | Extend **Customer** to align with CLIENT fields **or** add new **Client** entity and keep Customer for leads; recommend **extend Customer** and use as CLIENT in payment context. |
| **PROJECT** | project_name, description, system_type, total_value, start_date, end_date, status; FK client_id | None | **Add** Project entity + model + API. |
| **PAYMENT_PLAN** | plan_id, project_id FK, down_payment_pct/amt, total_installments, installment_amt, remaining_balance, plan_start_date, status | None | **Add** PaymentPlan entity + model + API. |
| **INSTALLMENT** | plan_id FK, installment_no, due_date, due_amount, paid_amount, paid_date, partial_paid, status, overdue_days | None | **Add** Installment entity + model + API. |
| **PAYMENT_TRANSACTION** | installment_id, client_id, gateway_id (nullable), amount, payment_method, reference_no, payment_date, recorded_by (user_id) | Billing (different: one-off billing docs) | **Add** PaymentTransaction entity + model + API; keep Billing for existing flow. |
| **INVOICE** | transaction_id FK, client_id, invoice_number UK, invoice_date, total_amount, tax_amount, discount_amt, status, pdf_path, emailed_at | None (Billing has no invoice number/PDF path) | **Add** Invoice entity + model + API; optional link to existing PDF generation. |
| **NOTIFICATION** | client_id, installment_id, type (sms/email/system), trigger_type (due_reminder/overdue/receipt), scheduled_at, sent_at, status, message_body | Reminder (inquiry-focused) | **Add** Notification entity for payment alerts; keep Reminder for inquiry reminders. |
| **USER** | role_id FK, username UK, full_name, email UK, password_hash, last_login, is_active | User (role as enum: owner/pm/employee) | **Extend** User: add optional `role_id` FK when Role model exists; or keep role enum and map to ROLE semantics. |
| **ROLE** | role_name UK (Admin, Accountant, Support), permissions JSON, description | None | **Add** Role entity + model; optionally migrate User.role to role_id. |
| **AUDIT_LOG** | user_id FK, action, table_name, record_id, old_value, new_value JSON, ip_address, created_at | None | **Add** AuditLog entity + model + middleware to log sensitive operations. |
| **PAYMENT_GATEWAY** | gateway_name, provider, api_endpoint, api_key_ref, is_active | None | **Add** PaymentGateway entity + model + API (admin-only config). |
| **REPORT** | generated_by FK, report_type, period_start/end, total_received/pending/overdue, export_path, created_at | None | **Add** Report entity + model; generate from aggregates (no separate store required for all report types). |

### 2.2 Relationships (from ER)

- CLIENT 1 ──< PROJECT  
- PROJECT 1 ──< PAYMENT_PLAN  
- PAYMENT_PLAN 1 ──< INSTALLMENT (e.g. 3–6)  
- INSTALLMENT 1 ──< PAYMENT_TRANSACTION (partial or full)  
- PAYMENT_TRANSACTION 1 ──1 INVOICE (auto-generated)  
- CLIENT 1 ──< NOTIFICATION; INSTALLMENT 1 ──< NOTIFICATION  
- ROLE 1 ──< USER  
- USER 1 ──< AUDIT_LOG; USER 1 ──< PAYMENT_TRANSACTION (recorded_by)  
- PAYMENT_GATEWAY 1 ──< PAYMENT_TRANSACTION (optional)  
- USER 1 ──< REPORT  

---

## 3. Frontend Modules (Tabs/Pages) vs Current Theme

Reference HTML describes an internal admin dashboard with tab-based modules. Below they are mapped to **routes and pages** in the **current Niolla design** (same Sidebar/Header, same primary/surface/background, card/table patterns).

| Reference tab / Module | Purpose | Niolla route (suggested) | Page component | Notes |
|------------------------|---------|---------------------------|----------------|-------|
| **Dashboard** | Stats: total clients, project value, collected, pending, overdue, due today; charts | `/dashboard` (extend existing) | `Dashboard.tsx` | Add payment KPIs and widgets; keep existing inquiry/reminder stats or merge. |
| **Notifications** | List due reminders, overdue alerts, receipt notifications; mark read / clear | `/notifications` or extend `/reminders` | New `Notifications.tsx` or extend Reminders | Use existing card/list and primary/surface styles. |
| **Clients** | CRUD client profiles, search, associated projects, payment summary | `/customer` (extend) or `/clients` | Extend `Customer.tsx` or new `Clients.tsx` | If Customer = CLIENT, extend Customer UI with business_type, company_name, nic_number, status, and link to Projects. |
| **Projects** | List client projects, financial value, progress, deadlines, link to payment plan | `/projects` | New `Projects.tsx` | Table + filters; reuse existing table-header and card styles. |
| **Payment Plans** | Define payment structure (down %, installments), view per project | `/payment-plans` | New `PaymentPlans.tsx` | Forms for down payment, installment count; show calculated installment_amt and remaining_balance. |
| **Installments** | List scheduled payments: due date, amount, paid, overdue days, status | `/installments` | New `Installments.tsx` | Table with status badges (pending/partial/paid/overdue); filters by plan/project/client. |
| **Payments** | Record payments, link to installment, partial/full, method (cash/bank/card/online) | `/payments` | New `Payments.tsx` | Form to add transaction; list transactions; update installment paid_amount and status. |
| **Invoices** | View, download, print, email receipts (invoice number, amounts, PDF path) | `/invoices` | New `Invoices.tsx` | List invoices; actions: download PDF, send email; reuse or extend existing PDF generation if needed. |
| **Reports** | Monthly revenue, outstanding, overdue clients, project-wise collections; CSV/PDF export | `/reports` (extend or new) | New `Reports.tsx` or extend existing reports | Use existing export patterns; period filters. |
| **Users / Staff** | Manage internal users and permissions | `/team` (extend) | `TeamManagement.tsx` | Add Role dropdown (Admin, Accountant, Support) and permission matrix if Role entity added. |
| **Audit & Security** | Chronological audit trail (who did what, when, IP) | `/audit` or `/settings/audit` | New `Audit.tsx` or under Settings | Table with filters; read-only. |

All new pages must use:

- **Theme:** Primary `#FB8C19`, sidebar `#FFF1E4`, background `#FAF9F6`, existing CSS variables.
- **Layout:** Same `Layout` (Sidebar + Header), `main` padding, max-width where applicable.
- **Components:** Same card, table, button, form, and modal patterns (e.g. `ConfirmDialog`, existing modals).
- **Sidebar:** Add new nav items under a section e.g. **“Payment Management”** (Clients, Projects, Payment Plans, Installments, Payments, Invoices) and **“Reports”** / **“Audit”** as needed.

---

## 4. Backend Implementation Plan

### 4.1 Domain Layer

- **New entities (in `domain/entities/`):**  
  `Project.ts`, `PaymentPlan.ts`, `Installment.ts`, `PaymentTransaction.ts`, `Invoice.ts`, `Notification.ts` (payment), `Role.ts`, `AuditLog.ts`, `PaymentGateway.ts`, `Report.ts`.
- **Extend:** `Customer.ts` (add fields to align with CLIENT: e.g. fullName, businessType, companyName, nicNumber, status active/inactive) **or** add `Client.ts` and keep Customer for leads only.
- **Extend:** `User.ts` (optional role_id, or keep role enum and map Admin/Accountant/Support to existing owner/pm/employee or new roles).

### 4.2 Infrastructure Layer

- **MongoDB models (in `infrastructure/database/models/`):**  
  `ProjectModel`, `PaymentPlanModel`, `InstallmentModel`, `PaymentTransactionModel`, `InvoiceModel`, `NotificationModel` (or rename to avoid clash with existing Reminder), `RoleModel`, `AuditLogModel`, `PaymentGatewayModel`, `ReportModel`.
- **Indexes:** Per ER (client_id, project_id, plan_id, installment_id, transaction_id, user_id, etc.) and for list/filter (status, dates).
- **Triggers / jobs:**  
  - Update `remaining_balance` on PaymentPlan when a PaymentTransaction is created (application service or DB trigger if supported).  
  - Compute `overdue_days` and update Installment status (pending → overdue) via a **scheduled job** (e.g. daily cron or serverless schedule).

### 4.3 Application Layer (Services)

- **New services:**  
  `ProjectService`, `PaymentPlanService`, `InstallmentService`, `PaymentTransactionService`, `InvoiceService`, `NotificationService` (payment), `RoleService`, `AuditLogService`, `PaymentGatewayService`, `ReportService`.
- **Core logic (you will add):**  
  - Create installments from a payment plan (3–6, due dates, amounts).  
  - On payment: create transaction, update installment (paid_amount, status), update plan (remaining_balance), create invoice.  
  - Notification scheduling (due_reminder, overdue, receipt) and sending (SMS/email/system) — integrate with your preferred providers.  
  - Role-based permission checks before sensitive operations.  
  - Audit logging middleware: on create/update/delete of selected entities, write to AuditLog (user_id, action, table_name, record_id, old/new value, IP).

### 4.4 Presentation Layer (API)

- **New route modules:**  
  `projectRoutes`, `paymentPlanRoutes`, `installmentRoutes`, `paymentTransactionRoutes`, `invoiceRoutes`, `notificationRoutes` (payment), `roleRoutes`, `auditLogRoutes`, `paymentGatewayRoutes`, `reportRoutes`.
- **Mount under:** e.g. `/api/v1/projects`, `/api/v1/payment-plans`, `/api/v1/installments`, `/api/v1/payments` (transactions), `/api/v1/invoices`, `/api/v1/notifications` (payment), `/api/v1/roles`, `/api/v1/audit`, `/api/v1/payment-gateways`, `/api/v1/reports`.
- **Auth:** All protected with existing JWT middleware; optional role middleware for Admin-only (e.g. audit, payment gateways, roles) and Accountant-only (e.g. payments, invoices) where applicable.

### 4.5 Cross-Cutting

- **Partial payment:** One installment can have multiple transactions until `paid_amount >= due_amount`; then status → paid and optional `paid_date`.  
- **Invoice generation:** On successful transaction (or on “final” payment for that installment), create Invoice record and optionally generate PDF (reuse or extend existing PDF infra).  
- **Idempotency:** For payments, consider `reference_no` (UK) to avoid duplicate transactions.

---

## 5. Frontend Implementation Plan

### 5.1 Navigation (Sidebar)

- Keep existing sections (e.g. main nav, Leads, Administration).  
- Add section **“Payment Management”** (or “Client Payments”):  
  - Clients (or extend Customer)  
  - Projects  
  - Payment Plans  
  - Installments  
  - Payments  
  - Invoices  
- Add **Notifications** (payment alerts) if not merged into Reminders.  
- Add **Reports** (financial) and **Audit & Security** under Administration or a new section.

### 5.2 New Pages (summary)

- **Dashboard:** Add widgets/cards for: total clients, total project value, total collected, pending balance, overdue installments count, due today. Use existing `Dashboard.module.css` and card grid; optional charts (e.g. collection trend).  
- **Clients/Customer:** Form fields for CLIENT; list with search; link to Projects and payment summary.  
- **Projects:** List projects with client name, value, dates, status; create/edit modal or page; link to Payment Plan.  
- **Payment Plans:** Create from project (down payment %, number of installments); show calculated amounts and list of installments.  
- **Installments:** Table: installment_no, due_date, due_amount, paid_amount, status, overdue_days; filters; link to Payments.  
- **Payments:** Form: select installment (or client/project first), amount, method, reference, date; list transactions; show balance updates.  
- **Invoices:** List invoices; columns: invoice_number, client, date, amount, status; actions: view, download PDF, email.  
- **Notifications:** List payment notifications (due reminder, overdue, receipt); mark read, clear.  
- **Reports:** Period selector; cards for totals; table or export for monthly collection, client summary, overdue list, project-wise.  
- **Audit:** Table: timestamp, user, action, entity, detail; filter by user/date.

### 5.3 Theme and Design Rules

- Use **existing** Tailwind + CSS variables (no dark theme from reference HTML).  
- Reuse: `Layout`, `Header`, `Sidebar`, card styles, table styles, `ConfirmDialog`, existing form and button patterns.  
- Primary actions: orange (`primary`); success/warning/danger: align with existing Dashboard card variants.  
- Badges for status: pending, partial, paid, overdue (installments); draft, sent, paid (invoices); active, completed, cancelled (projects); etc.

---

## 6. Phased Rollout (Recommended)

| Phase | Scope | Outcomes |
|-------|--------|----------|
| **1 – Foundation** | Customer/Client model alignment, Project + PaymentPlan + Installment entities, models, APIs; basic CRUD UI for Clients, Projects, Payment Plans, Installments | Can create clients, projects, plans, and see installments. |
| **2 – Payments & Invoices** | PaymentTransaction + Invoice entities; service logic (apply payment, update installment/plan, create invoice); Payments and Invoices pages; optional PDF for invoice | End-to-end: record payment → update balance → generate invoice. |
| **3 – Notifications & Automation** | Notification entity and service; scheduled job for overdue_days and status; due/overdue/receipt triggers; Notifications page | Alerts and reminders for payment due/overdue and receipts. |
| **4 – RBAC & Audit** | Role entity and Role–User link; permission checks; AuditLog entity and middleware; Audit page; optional Reports (aggregates + export) | Role-based access and full audit trail. |
| **5 – Gateways & Reports** | PaymentGateway entity and admin UI; Report entity/service; Reports page with period filters and CSV/PDF export | Online payment config and financial reports. |

You can reorder or merge phases (e.g. do Audit earlier, or Reports in Phase 2) depending on priorities.

---

## 7. Design and UX Checklist (Current Theme)

- [ ] All new pages use existing Layout (Sidebar + Header).  
- [ ] Sidebar uses same background (`#FFF1E4`) and active state (`#FED8B1`).  
- [ ] Primary buttons and links use `#FB8C19` (Tailwind `primary` / CSS var `--primary`).  
- [ ] Cards and tables use `--bg-surface`, `--border-subtle`, `--text-primary` / `--text-secondary`.  
- [ ] No adoption of the reference HTML dark palette (e.g. `--bg:#080b12`, `--vi:#6366f1`) for this feature set.  
- [ ] Modals and forms follow existing patterns (e.g. CreateBilling, AddCustomerModal).  
- [ ] Empty states and loading states consistent with existing pages.  
- [ ] Responsive: sidebar collapse / mobile menu as in current Layout.

---

## 8. Open Points and Decisions

1. **Customer vs Client:** Use one entity (extend Customer) or two (Customer for leads, Client for payment contracts)? Recommendation: extend Customer and use it as CLIENT to avoid duplicate contact records.  
2. **User roles:** Keep current enum (owner, pm, employee) and map to Admin/Accountant/Support in UI only, or introduce Role table and role_id on User?  
3. **Invoice PDF:** Reuse existing Billing/Proposal PDF pipeline or new template for payment receipts?  
4. **Notification delivery:** Which SMS/email providers (e.g. Twilio, SendGrid) and where to configure (env vs PaymentGateway-like config)?  
5. **Report storage:** Store only report metadata and file path (REPORT entity) or also generate on-demand without persisting every run?

---

## 9. File and Folder Summary (for implementation)

### Backend (additions)

- `src/domain/entities/`: Project, PaymentPlan, Installment, PaymentTransaction, Invoice, Notification (payment), Role, AuditLog, PaymentGateway, Report; extend Customer and/or User as agreed.  
- `src/infrastructure/database/models/`: Same names + Model suffix.  
- `src/application/services/`: Corresponding services.  
- `src/presentation/controllers/`: Corresponding controllers.  
- `src/presentation/routes/`: Corresponding route files.  
- `src/presentation/middleware/`: Optional `auditLog.ts`, `requireRole.ts`.  
- Jobs/cron: e.g. `src/jobs/updateOverdueInstallments.ts` or similar.

### Frontend (additions)

- `src/pages/`: Projects.tsx, PaymentPlans.tsx, Installments.tsx, Payments.tsx, Invoices.tsx, Notifications.tsx (if separate), Reports.tsx, Audit.tsx; extend Dashboard, Customer, TeamManagement as needed.  
- `src/pages/*.module.css`: Per-page styles using existing variables.  
- Routes in `App.tsx` and nav items in `Sidebar.tsx`.  
- Optional: `src/api/` endpoints for new APIs; reuse existing `api` client.

---

## 10. References

- **ER diagram:** `er-diagram.html` (entities, fields, relationships).  
- **Reference UI flow:** `niolla-employee-system (1).html` (tab structure and module list; design not to be copied — use current Niolla theme).  
- **Current theme:** `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/src/components/Layout.module.css`, `frontend/src/pages/Dashboard.module.css`.  
- **Current API pattern:** `backend/src/presentation/app.ts`, existing routes and controllers.

---

*End of implementation plan. Proceed to coding only after confirming scope, Customer/Client strategy, role model, and phase order.*
