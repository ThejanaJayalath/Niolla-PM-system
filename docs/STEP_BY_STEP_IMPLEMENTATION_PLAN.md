# Step-by-Step Implementation Plan: Client Payment Management

**Document version:** 1.0  
**Date:** March 8, 2025  
**Companion to:** `IMPLEMENTATION_PLAN_CLIENT_PAYMENT.md`

This document gives **ordered implementation steps** that match the **current Niolla PM codebase** exactly. It references existing files, patterns, and **duplicated or overlapping** behaviour so you can implement without breaking current features.

---

## 1. Duplicated / Overlapping Functions (Handle First)

Before adding new modules, decide how to handle overlaps:

| Area | Existing in codebase | New (ER) | How to avoid duplication |
|------|----------------------|----------|---------------------------|
| **Client vs Customer** | `Customer` entity + `CustomerModel` + `CustomerService` + `CustomerController` + `customerRoutes` + frontend `Customer.tsx` + `AddCustomerModal.tsx`. Fields: `customerId`, `name`, `phoneNumber`, `email`, `projects[]`, `inquiryId`. | ER **CLIENT**: `full_name`, `email`, `phone`, `address`, `business_type`, `company_name`, `nic_number`, `status`. | **Option A (recommended):** Extend existing `Customer` with new fields (`address`, `businessType`, `companyName`, `nicNumber`, `status`). Use same `/customers` API and `Customer.tsx`; add columns and form fields. **Option B:** Add new `Client` entity and separate routes `/clients`; then either migrate Customer → Client or keep both (Customer = leads, Client = payment contracts). |
| **Billing vs Invoice** | `Billing` entity + `BillingModel` + `BillingService` + `BillingController` + `billingRoutes` + `Billing.tsx`, `CreateBilling.tsx`, `BillingDetail.tsx`. Inquiry-linked; `billingId`, `customerName`, `items[]`, `totalAmount`, `billingType`, PDF download. | ER **INVOICE**: `transaction_id`, `client_id`, `invoice_number` UK, `invoice_date`, `total_amount`, `tax_amount`, `discount_amt`, `status`, `pdf_path`, `emailed_at`. | **Keep both.** Billing = current one-off billing documents (inquiry flow). Invoice = new, **transaction-linked** receipts for installment payments. New `Invoice` entity, new routes `/invoices`, new page `Invoices.tsx`. Do **not** merge into Billing. |
| **Reminder vs Notification** | `Reminder` entity + `ReminderModel` + `ReminderService` + `ReminderController` + `reminderRoutes` + `Reminders.tsx`. Inquiry-linked; `inquiryId`, `type: reminder \| meeting`, `title`, `scheduledAt`, `status`. | ER **NOTIFICATION**: `client_id`, `installment_id`, `type: sms \| email \| system`, `trigger_type: due_reminder \| overdue \| receipt`, `scheduled_at`, `sent_at`, `status`, `message_body`. | **Keep both.** Reminder = inquiry/meeting reminders. Add new **PaymentNotification** entity (or name it `PaymentNotification` to avoid confusion with “notification” in UI). New model `PaymentNotificationModel`, new routes e.g. `/payment-notifications` or `/notifications` (if you reserve “notifications” for payment-only), new page for payment alerts. |
| **User role** | `User` has `role: 'owner' \| 'pm' \| 'employee'`. `requireRole('owner','pm','employee')` in routes. | ER **ROLE** table: Admin, Accountant, Support. | **Option A:** Keep current enum; in UI and docs map owner→Admin, pm→Project Manager, employee→Support/Accountant as needed. **Option B:** Add `Role` entity + `RoleModel`, add `roleId` to User (optional migration), add `requireRole('admin','accountant','support')` or keep existing enum and add new values. |

**Summary:** Extend **Customer** (Option A for Client). **Billing** and **Invoice** stay separate. **Reminder** and **PaymentNotification** stay separate. **Role** can stay enum (Option A) or become a table (Option B).

---

## 2. Backend Steps (Exact Paths and Patterns)

Use these paths and patterns so new code matches the codebase.

### Step 2.1 – Extend Customer (CLIENT fields)

**Files to change:**

1. **`backend/src/domain/entities/Customer.ts`**  
   Add optional: `address?: string`, `businessType?: string`, `companyName?: string`, `nicNumber?: string`, `status?: 'active' | 'inactive'`. Keep `name` (or add `fullName` and keep `name` as alias for compatibility).

2. **`backend/src/infrastructure/database/models/CustomerModel.ts`**  
   Add schema fields: `address`, `businessType`, `companyName`, `nicNumber`, `status` (enum or string). Keep existing indexes.

3. **`backend/src/application/services/CustomerService.ts`**  
   In `CreateCustomerInput` and `UpdateCustomerInput` add the new fields. In `create` and `update` pass them through. In `toCustomer` map them.

4. **`backend/src/presentation/controllers/CustomerController.ts`**  
   No signature change; `req.body` will include new fields; service already handles them.

5. **`backend/src/presentation/routes/customerRoutes.ts`**  
   Add validators for new fields in POST and PATCH (e.g. `body('address').optional().trim()`, `body('status').optional().isIn(['active','inactive'])`).

**Duplication note:** Single source of truth remains Customer; no separate Client CRUD.

---

### Step 2.2 – Add Project entity and API

**New files (follow existing patterns):**

1. **`backend/src/domain/entities/Project.ts`**  
   Interface: `_id?`, `clientId: string` (FK to Customer), `projectName: string`, `description?`, `systemType?`, `totalValue: number`, `startDate?`, `endDate?`, `status: 'active'|'completed'|'cancelled'`, `createdAt`, `updatedAt`.

2. **`backend/src/infrastructure/database/models/ProjectModel.ts`**  
   Mongoose schema; `clientId: ObjectId ref: 'Customer'`; indexes on `clientId`, `status`, `createdAt`. Same pattern as `CustomerModel.ts` (timestamps, toObject).

3. **`backend/src/application/services/ProjectService.ts`**  
   Class like `CustomerService`: `create`, `findById`, `findByClientId`, `findAll(filters?)`, `update`, `delete`, private `toProject(doc)`. Optionally `getNextProjectId()` if you want string IDs like `PID_001`.

4. **`backend/src/presentation/controllers/ProjectController.ts`**  
   Same pattern as `CustomerController.ts`: `createProject`, `getProject`, `listProjects`, `updateProject`, `deleteProject`. Use `AuthenticatedRequest`, return `{ success: true, data }` or `{ success: false, error: { code, message } }`, 404 when not found.

5. **`backend/src/presentation/routes/projectRoutes.ts`**  
   Same pattern as `customerRoutes.ts`: `Router()`, `router.use(authMiddleware)`, `router.use(requireRole('owner','pm','employee'))`, `validate` using `validationResult`, then controller handlers. Routes: `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`. Validators: `param('id').isMongoId()`, `body('clientId').isMongoId()`, etc.

6. **`backend/src/presentation/app.ts`**  
   Add: `import projectRoutes from './routes/projectRoutes';` and `app.use('/api/v1/projects', projectRoutes);`

**Overlap:** Projects belong to **Customer** (clientId). Use existing Customer list for dropdowns.

---

### Step 2.3 – Add PaymentPlan entity and API

1. **`backend/src/domain/entities/PaymentPlan.ts`**  
   Fields: `_id?`, `projectId: string`, `downPaymentPct: number`, `downPaymentAmt: number`, `totalInstallments: number`, `installmentAmt: number`, `remainingBalance: number`, `planStartDate?`, `status: 'active'|'completed'|'defaulted'`, `createdAt`, `updatedAt`.

2. **`backend/src/infrastructure/database/models/PaymentPlanModel.ts`**  
   `projectId: ObjectId ref: 'Project'`; indexes on `projectId`, `status`.

3. **`backend/src/application/services/PaymentPlanService.ts`**  
   `create`, `findById`, `findByProjectId`, `findAll`, `update`, `updateRemainingBalance(planId, amount)`, `toPaymentPlan(doc)`.

4. **`backend/src/presentation/controllers/PaymentPlanController.ts`**  
   CRUD handlers; same response shape as existing controllers.

5. **`backend/src/presentation/routes/paymentPlanRoutes.ts`**  
   Same structure as `customerRoutes`/`projectRoutes`; mount at `/api/v1/payment-plans`.

6. **`backend/src/presentation/app.ts`**  
   Register `app.use('/api/v1/payment-plans', paymentPlanRoutes);`

---

### Step 2.4 – Add Installment entity and API

1. **`backend/src/domain/entities/Installment.ts`**  
   Fields: `_id?`, `planId: string`, `installmentNo: number`, `dueDate: Date`, `dueAmount: number`, `paidAmount?`, `paidDate?`, `partialPaid?`, `status: 'pending'|'paid'|'partial'|'overdue'`, `overdueDays?`, `createdAt`, `updatedAt`.

2. **`backend/src/infrastructure/database/models/InstallmentModel.ts`**  
   `planId: ObjectId ref: 'PaymentPlan'`; indexes on `planId`, `status`, `dueDate`.

3. **`backend/src/application/services/InstallmentService.ts`**  
   `create`, `createManyForPlan(planId, installments[])`, `findById`, `findByPlanId`, `findAll(filters)`, `update`, `updatePaidAmount(installmentId, amount)`, `toInstallment(doc)`. Optional: method to compute overdue days and set status (used by cron later).

4. **`backend/src/presentation/controllers/InstallmentController.ts`**  
   CRUD + list by plan/project; same response pattern.

5. **`backend/src/presentation/routes/installmentRoutes.ts`**  
   Mount at `/api/v1/installments`; e.g. `GET /?planId=...&status=...`.

6. **`backend/src/presentation/app.ts`**  
   Register installments route.

---

### Step 2.5 – Add PaymentTransaction entity and API

1. **`backend/src/domain/entities/PaymentTransaction.ts`**  
   Fields: `_id?`, `installmentId: string`, `clientId: string`, `gatewayId?`, `amount: number`, `paymentMethod: 'cash'|'bank'|'card'|'online'`, `referenceNo?`, `paymentDate: Date`, `recordedBy: string` (userId), `createdAt`, `updatedAt`.

2. **`backend/src/infrastructure/database/models/PaymentTransactionModel.ts`**  
   Refs: `installmentId`, `clientId`, `recordedBy` (User), `gatewayId` optional. Unique index on `referenceNo` if present.

3. **`backend/src/application/services/PaymentTransactionService.ts`**  
   `create` (and inside: update Installment paid_amount and status, update PaymentPlan remaining_balance, then create Invoice — see next step). `findById`, `findByInstallmentId`, `findByClientId`, `findAll`.

4. **`backend/src/presentation/controllers/PaymentTransactionController.ts`**  
   Create payment (calls service.create); list/get.

5. **`backend/src/presentation/routes/paymentTransactionRoutes.ts`**  
   Mount at `/api/v1/payments` (or `/api/v1/transactions`). Same auth/validate pattern.

6. **`backend/src/presentation/app.ts`**  
   Register route.

**Overlap:** This creates **Invoice** and updates **Installment**/ **PaymentPlan**. Implement Invoice (next) then wire this service to call InvoiceService.

---

### Step 2.6 – Add Invoice entity and API

**Do not merge with Billing.** Billing stays for current inquiry-based billing.

1. **`backend/src/domain/entities/Invoice.ts`**  
   Fields: `_id?`, `transactionId: string`, `clientId: string`, `invoiceNumber: string` (UK), `invoiceDate: Date`, `totalAmount: number`, `taxAmount?`, `discountAmt?`, `status: 'draft'|'sent'|'paid'`, `pdfPath?`, `emailedAt?`, `createdAt`, `updatedAt`.

2. **`backend/src/infrastructure/database/models/InvoiceModel.ts`**  
   Unique on `invoiceNumber`; indexes on `transactionId`, `clientId`, `invoiceDate`.

3. **`backend/src/application/services/InvoiceService.ts`**  
   `create` (called from PaymentTransactionService), `getNextInvoiceNumber()`, `findById`, `findByTransactionId`, `findByClientId`, `findAll`, optional `generatePdf(invoiceId)` reusing existing PDF infra (e.g. under `backend/src/infrastructure/pdf/`).

4. **`backend/src/presentation/controllers/InvoiceController.ts`**  
   List, get, download PDF (reuse pattern from `BillingController` downloadBillingPdf if applicable).

5. **`backend/src/presentation/routes/invoiceRoutes.ts`**  
   Mount at `/api/v1/invoices`; e.g. `GET /:id/pdf` for download.

6. **`backend/src/presentation/app.ts`**  
   Register invoices route.

---

### Step 2.7 – Add PaymentNotification entity and API

**Do not replace Reminder.** Reminder stays for inquiry/meeting reminders.

1. **`backend/src/domain/entities/PaymentNotification.ts`**  
   Name avoids confusion with Reminder. Fields: `_id?`, `clientId: string`, `installmentId?`, `type: 'sms'|'email'|'system'`, `triggerType: 'due_reminder'|'overdue'|'receipt'`, `scheduledAt: Date`, `sentAt?`, `status: 'pending'|'sent'|'failed'`, `messageBody?`, `createdAt`, `updatedAt`.

2. **`backend/src/infrastructure/database/models/PaymentNotificationModel.ts`**  
   Indexes on `clientId`, `installmentId`, `status`, `scheduledAt`.

3. **`backend/src/application/services/PaymentNotificationService.ts`**  
   `create`, `findById`, `findByClientId`, `findPending`, `markSent(id)`, `findAll(filters)`.

4. **`backend/src/presentation/controllers/PaymentNotificationController.ts`**  
   List (for “Notifications” page), mark read/sent, optional create (or create via cron/job).

5. **`backend/src/presentation/routes/paymentNotificationRoutes.ts`**  
   Mount at `/api/v1/payment-notifications` or `/api/v1/notifications` (if you reserve “notifications” for payment only).

6. **`backend/src/presentation/app.ts`**  
   Register route.

---

### Step 2.8 – Optional: Role and AuditLog

- **Role:** Only if you chose “Option B” in §1. Add `Role.ts`, `RoleModel.ts`, `RoleService.ts`, `RoleController.ts`, `roleRoutes.ts`; add `roleId` to User and migration if needed.
- **AuditLog:** Add `AuditLog.ts`, `AuditLogModel.ts`, `AuditLogService.ts` (e.g. `log(userId, action, tableName, recordId, oldValue, newValue, ip)`). Add middleware that calls this on create/update/delete of selected entities. Add `AuditLogController` + route `GET /api/v1/audit` (and register in `app.ts`).

---

### Step 2.9 – Optional: PaymentGateway and Report

- **PaymentGateway:** New entity, model, service, controller, routes (admin-only); mount at `/api/v1/payment-gateways`.
- **Report:** New entity/model for stored report metadata; service to generate aggregates (e.g. monthly collection, overdue list); controller to return data and optional file export; mount at `/api/v1/reports`.

---

## 3. Frontend Steps (Exact Paths and Patterns)

Match existing pages: `Customer.tsx`, `Billing.tsx` (list + filters + table + pagination + modals + ConfirmDialog).

### Step 3.1 – Extend Customer page (CLIENT fields)

**Files to change:**

1. **`frontend/src/pages/Customer.tsx`**  
   Add to table: columns for Company Name, Status (optional). Add to filters if needed.

2. **`frontend/src/components/AddCustomerModal.tsx`**  
   Add form fields: Address, Business Type, Company Name, NIC Number, Status (active/inactive). Add to `CustomerFormData` and payload (POST/PATCH). Use same modal and `NewInquiryModal.module.css` (or same pattern) for styling.

3. **`frontend/src/pages/Customer.tsx`**  
   Extend `Customer` interface to include `address?`, `businessType?`, `companyName?`, `nicNumber?`, `status?`.

**Duplication:** One page “Customer” serves as both lead customer and payment client; no separate “Clients” page unless you chose Option B (separate Client entity).

---

### Step 3.2 – Add Projects page and route

1. **`frontend/src/pages/Projects.tsx`**  
   Copy structure from `Billing.tsx` or `Customer.tsx`: `headerRow` (title + “Add Project”), `filtersRow` (search, optional client filter), `tableWrap` + table (columns: Project Name, Client, System Type, Total Value, Start/End Date, Status, Actions). Pagination and row-per-page like existing. Use `styles` from `Inquiries.module.css` (same `page`, `headerRow`, `filtersRow`, `table`, `tableWrap`). Load from `api.get('/projects')`; create/edit via modal or navigate to `/projects/new`, `/projects/:id`.

2. **`frontend/src/components/AddProjectModal.tsx`** (or inline form)  
   Form: clientId (dropdown from `/customers`), projectName, description, systemType, totalValue, startDate, endDate, status. Submit POST/PATCH to `/projects`. Reuse modal pattern from `AddCustomerModal.tsx` and same CSS module.

3. **`frontend/src/App.tsx`**  
   Add route: `<Route path="projects" element={<Projects />} />` (and optional `path="projects/new"`, `path="projects/:id"` if you use separate detail page).

4. **`frontend/src/components/Sidebar.tsx`**  
   Add nav item: “Projects” with path `/projects` (e.g. under a new “Payment Management” section or next to Billing). Use same `NavLink` and icon pattern as existing items.

---

### Step 3.3 – Add Payment Plans page

1. **`frontend/src/pages/PaymentPlans.tsx`**  
   List payment plans (e.g. by project); table: Project, Down Payment %, Down Amount, Installments, Installment Amount, Remaining Balance, Status. Load from `api.get('/payment-plans')`; optional filter by project. Same table/pagination pattern.

2. **`frontend/src/components/AddPaymentPlanModal.tsx`** (or create from Project detail)  
   Form: projectId (dropdown from `/projects`), downPaymentPct, totalInstallments (3–6); backend or frontend can compute downPaymentAmt, installmentAmt, remainingBalance. POST to `/payment-plans`. After create, backend (or frontend) can create installments (Step 2.4 service: `createManyForPlan`).

3. **`frontend/src/App.tsx`**  
   Add route: `<Route path="payment-plans" element={<PaymentPlans />} />`.

4. **`frontend/src/components/Sidebar.tsx`**  
   Add “Payment Plans” link.

---

### Step 3.4 – Add Installments page

1. **`frontend/src/pages/Installments.tsx`**  
   Table: Plan/Project, Installment No, Due Date, Due Amount, Paid Amount, Status, Overdue Days, Actions. Load from `api.get('/installments')` with optional query `?planId=...&status=...`. Use same styles; status badges (pending/partial/paid/overdue) with orange/green/red classes.

2. **`frontend/src/App.tsx`**  
   Route: `path="installments" element={<Installments />}`.

3. **`frontend/src/components/Sidebar.tsx`**  
   Add “Installments” link.

---

### Step 3.5 – Add Payments page (record transaction)

1. **`frontend/src/pages/Payments.tsx`**  
   List transactions: columns e.g. Date, Client, Installment, Amount, Method, Reference, Recorded By. Button “Record Payment” opens modal: select installment (or client → project → plan → installment), amount, payment method, reference no, date. Submit POST to `/payments` (or `/api/v1/payments`). After success, refresh list and optionally refresh installments.

2. **`frontend/src/components/RecordPaymentModal.tsx`**  
   Form: installmentId (or cascading dropdowns: customer → project → plan → installment), amount, paymentMethod, referenceNo, paymentDate. Use same modal/CSS pattern as AddCustomerModal.

3. **`frontend/src/App.tsx`**  
   Route: `path="payments" element={<Payments />}`.

4. **`frontend/src/components/Sidebar.tsx`**  
   Add “Payments” link.

---

### Step 3.6 – Add Invoices page

**Separate from Billing.** Billing remains at `/billing` for current flow.

1. **`frontend/src/pages/Invoices.tsx`**  
   Table: Invoice Number, Client, Date, Total Amount, Status, Actions (View, Download PDF, Send Email if you implement). Load from `api.get('/invoices')`. Download via `api.download(\`/invoices/${id}/pdf\`, \`invoice-${number}.pdf\`)` (add endpoint in InvoiceController if not already).

2. **`frontend/src/App.tsx`**  
   Route: `path="invoices" element={<Invoices />}`.

3. **`frontend/src/components/Sidebar.tsx`**  
   Add “Invoices” link (e.g. under Payment Management).

---

### Step 3.7 – Add Payment Notifications page

**Do not replace Reminders.** Reminders stay at `/reminders` for inquiry reminders.

1. **`frontend/src/pages/PaymentNotifications.tsx`** (or name it `Notifications.tsx` and route `/notifications`)  
   List payment notifications: Due reminder, Overdue, Receipt; mark read / clear. Load from `api.get('/payment-notifications')` or `api.get('/notifications')`. Use same card/list pattern as Reminders if desired.

2. **`frontend/src/App.tsx`**  
   Route: `path="notifications" element={<PaymentNotifications />}` (or same component name).

3. **`frontend/src/components/Sidebar.tsx`**  
   Add “Notifications” (payment) link; keep “Reminders” for existing inquiry reminders.

---

### Step 3.8 – Extend Dashboard

**File:** `frontend/src/pages/Dashboard.tsx`

- Add payment KPI cards: Total Clients (from customers count or new endpoint), Total Project Value, Total Collected, Pending Balance, Overdue Installments, Due Today. Reuse existing card grid and `Dashboard.module.css` (e.g. same `card`, `cardGrid`, `cardIcon`, `cardLabel`, `cardValue`). Fetch from new endpoints (e.g. `/api/v1/reports/summary` or aggregate from projects/installments).

---

### Step 3.9 – Optional: Reports and Audit pages

- **Reports:** New page `Reports.tsx`; period filter; cards/tables for monthly collection, overdue list, client summary; export CSV/PDF using same pattern as existing export (e.g. `api.get` with blob or dedicated export endpoint).
- **Audit:** New page `Audit.tsx`; table of audit log; filter by user/date; read-only. Add route and sidebar link.

---

## 4. API Client and Shared Types

**File:** `frontend/src/api/client.ts`

- No change required for auth or base URL. New endpoints use same `api.get`, `api.post`, `api.patch`, `api.delete`. Optional: add `api.download(\`/invoices/${id}/pdf\`, filename)` if you centralise download helpers (or reuse existing `api.download` used for billing PDF).

**Shared types:** Optionally add `frontend/src/types/payment.ts` (or similar) with interfaces for Project, PaymentPlan, Installment, PaymentTransaction, Invoice, PaymentNotification so components and API responses are typed.

---

## 5. Order of Implementation (Suggested)

1. **Backend:** Customer extension (§2.1) → Project (§2.2) → PaymentPlan (§2.3) → Installment (§2.4) → Invoice (§2.6) → PaymentTransaction (§2.5, wiring to Installment, Plan, Invoice) → PaymentNotification (§2.7). Then optional Role, AuditLog, PaymentGateway, Report (§2.8–2.9).
2. **Frontend:** Customer extension (§3.1) → Projects (§3.2) → Payment Plans (§3.3) → Installments (§3.4) → Payments (§3.5) → Invoices (§3.6) → Payment Notifications (§3.7) → Dashboard (§3.8). Then optional Reports, Audit (§3.9).
3. **Cron/Jobs:** After Installment and PaymentNotification exist, add a scheduled job (e.g. daily) that updates `overdue_days` and status for installments and creates due_reminder/overdue payment notifications.

---

## 6. Checklist: Match Current Codebase

- [ ] Routes use `authMiddleware` and `requireRole('owner','pm','employee')` (or new roles if Role table added).
- [ ] Validation uses `express-validator` + `validationResult`; on error return `{ success: false, error: { code: 'VALIDATION_ERROR', message, details } }`.
- [ ] Controllers return `{ success: true, data }` or `{ success: false, error: { code, message } }`; 404 when resource not found.
- [ ] Services are classes; use existing Model names and `toEntity(doc)` pattern; string IDs (e.g. customerId) follow existing `getNextId` pattern where applicable.
- [ ] Frontend pages use same layout (no extra wrapper); reuse `Inquiries.module.css` for page, headerRow, filtersRow, table, tableWrap; primary buttons use `bg-primary hover:bg-primary-hover`; table headers use `text-orange-500` or `text-orange-600`; modals follow AddCustomerModal/NewInquiryModal pattern.
- [ ] Sidebar: add items under a clear section (e.g. “Payment Management”) so they are not duplicated with existing “Billing” or “Customer”.
- [ ] Customer = single source for “client” in payment context (if Option A); Billing and Invoice remain separate; Reminder and PaymentNotification remain separate.

---

*End of step-by-step plan. Use this together with `IMPLEMENTATION_PLAN_CLIENT_PAYMENT.md` for full context and ER details.*
