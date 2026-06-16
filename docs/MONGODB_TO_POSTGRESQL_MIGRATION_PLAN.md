# MongoDB → PostgreSQL Migration Plan

**Project:** Niolla Project & Lead Management System  
**Target hosting:** VPS via Coolify  
**Document version:** 1.0  
**Date:** 2026-06-16  

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Why PostgreSQL fits Coolify + VPS](#2-why-postgresql-fits-coolify--vps)
3. [Current database inventory](#3-current-database-inventory)
4. [Mongo-specific patterns to replace](#4-mongo-specific-patterns-to-replace)
5. [Target PostgreSQL schema](#5-target-postgresql-schema)
6. [Reporting views](#6-reporting-views)
7. [Platform function migration checklist](#7-platform-function-migration-checklist)
8. [Data migration strategy](#8-data-migration-strategy)
9. [Coolify deployment architecture](#9-coolify-deployment-architecture)
10. [ORM recommendation](#10-orm-recommendation)
11. [API contract impact](#11-api-contract-impact)
12. [Testing plan](#12-testing-plan)
13. [Risk register](#13-risk-register)
14. [Execution timeline](#14-execution-timeline)
15. [Immediate next steps](#15-immediate-next-steps)
16. [Appendix A — Full model reference](#appendix-a--full-model-reference)
17. [Appendix B — Service & file index](#appendix-b--service--file-index)

---

## 1. Executive summary

| Item | Current | Target |
|------|---------|--------|
| Database | MongoDB (Mongoose 8) | PostgreSQL 16+ |
| Hosting | Vercel serverless + MongoDB Atlas | Coolify on VPS |
| ORM | Mongoose models called directly from services | Prisma or Drizzle + repository layer |
| Primary keys | `ObjectId` (24-char hex) | `UUID` (v7 recommended for sortable PKs) |
| File storage | Local disk / Vercel ephemeral | VPS persistent volume or S3-compatible storage |

### Scope of research

This plan is based on deep analysis of:

- **30 Mongoose models** in `backend/src/infrastructure/database/models/`
- **34 application services** in `backend/src/application/services/`
- **7 controllers** with direct DB access
- **5 cron/seed scripts** in `backend/scripts/`
- **~200+ API routes** across 30 route modules
- **40 frontend pages** (API contract should remain stable)

### Effort estimate

**8–12 weeks** (1–2 engineers), depending on production data volume, migration tooling, and test coverage added during the project.

### Recommended approach

**Strangler pattern:**

1. Introduce PostgreSQL repositories behind interfaces.
2. Migrate domain-by-domain (auth → CRM → finance → reports).
3. Run dual-write briefly for financial domains.
4. Cut over reads per domain, then decommission MongoDB.

---

## 2. Why PostgreSQL fits Coolify + VPS

| Benefit | Relevance to Niolla PM |
|---------|------------------------|
| Coolify native PostgreSQL service | One-click provisioning, backups, env injection |
| Relational model matches domain | Projects → payment plans → installments → transactions |
| Native reporting | 15+ Mongo aggregation pipelines become SQL `JOIN` + `GROUP BY` |
| ACID transactions | Payroll, master ledger, payment flows need stronger guarantees |
| Long-lived Node process | No serverless cold-start or connection-pool limits |
| Partial unique indexes | Wallet ledger and greeting template constraints map directly |
| JSONB where needed | Audit log old/new values, optional `call_meta` on interactions |

---

## 3. Current database inventory

### 3.1 Connection layer

**File:** `backend/src/infrastructure/database/mongo.ts`

| Aspect | Current behavior |
|--------|------------------|
| Entry point | `connectDatabase()` from `index.ts` and `app.ts` |
| URI | `process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/niolla_pm'` |
| DNS workaround | Forces Google/Cloudflare DNS for `mongodb+srv` on Windows |
| Post-connect migrations | `ProjectModel.updateMany` status renames; `CampaignService.expireEndedCampaigns()` |

**Replace with:** `postgres.ts` (or Prisma client singleton), connection pool, health check endpoint, schema migrations via Prisma/Drizzle — no startup data patches in connection code (use dedicated migration scripts).

### 3.2 All collections (30 models)

| Domain | Collection / Model | Key relationships |
|--------|-------------------|-------------------|
| **Auth** | `users` | Root entity for RBAC |
| **CRM** | `inquiries`, `customers`, `interactions`, `reminders` | Inquiry → Customer conversion |
| **Proposals** | `proposals`, `proposaltemplates` | Inquiry, FestivalCampaign |
| **Billing** | `billings`, `billingtemplates` | Inquiry; embedded line items |
| **Products** | `products` | Customers, projects, invoices, campaigns |
| **Campaigns** | `festivalcampaigns` | Products[], invoices, proposals |
| **Projects** | `projects`, `projecttasks`, `customerrequirements`, `updatetickets` | Customer, User[], Product |
| **Assignments** | `Staff_Assignments`, `developerwalletledgers` | User, Project, Customer |
| **Payments** | `paymentplans`, `paymentplantemplates`, `installments`, `paymenttransactions`, `paymentnotifications` | Project → Plan → Installment chain |
| **Finance** | `invoices`, `masterledgers`, `companyexpenses` | Cross-links to most domains |
| **Engagement** | `birthdaycards`, `greetingcardtemplates` | Polymorphic subject refs |
| **Ops** | `auditlogs`, `integrations`, `sequences` | Cross-cutting |

### 3.3 Custom collection names

| Model | Mongo collection name |
|-------|----------------------|
| ProposalTemplateModel | `proposaltemplates` |
| BillingTemplateModel | `billingtemplates` |
| StaffAssignmentModel | `Staff_Assignments` |
| DeveloperWalletLedgerModel | `developerwalletledgers` |
| GreetingCardTemplateModel | `greetingcardtemplates` |

### 3.4 Embedded documents (must normalize)

| Parent | Embedded field | SQL replacement |
|--------|----------------|-----------------|
| Inquiry | `proposals[]` | `inquiry_proposal_stubs` table |
| Proposal | `milestones[]` | `proposal_milestones` table |
| Billing | `items[]` | `billing_items` table |
| Interaction | `callMeta` | JSONB column or `interaction_call_meta` child table |
| FestivalCampaign | `promotionalBlastStats` | Columns or JSONB on `festival_campaigns` |

### 3.5 Special non-ref types

| Model | Field | SQL replacement |
|-------|-------|-----------------|
| Project | `assignedEmployeePayouts` | `project_developer_payouts` table |
| Project | `assignedEmployeePayoutRelease` | `release_status` column on payout rows |
| Customer | `projects[]` (legacy strings) | Drop; use `projects.client_id` FK only |
| BirthdayCard | `subjectId` (polymorphic) | `subject_type` + `subject_id` UUID |
| AuditLog | `oldValue`, `newValue` (Mixed) | `JSONB` |
| Proposal/Billing templates | `templateDocx` (Buffer) | `BYTEA` or file path on VPS volume |

---

## 4. Mongo-specific patterns to replace

| Pattern | Where used | SQL replacement |
|---------|-----------|-----------------|
| `populate()` chains | InvoiceService, ProjectService, UpdateTicketService, etc. | SQL `JOIN` / ORM `include` |
| `aggregate()` / `$lookup` / `$unwind` | ProductSalesService, OperationsReportService, reports | SQL views + `GROUP BY` |
| `$inc` atomic updates | BillingService, PaymentPlanService, PayrollService | `UPDATE ... SET col = col + $1` |
| `$push` / `$pull` / `arrayFilters` | ProposalService (inquiry proposals) | INSERT/DELETE on stub table |
| `findOneAndUpdate` upsert | MasterLedgerService, IntegrationService | `INSERT ... ON CONFLICT DO UPDATE` |
| `SequenceModel` + Inquiry pre-save | InquiryModel | `sequences` table + `SELECT ... FOR UPDATE` |
| `mongoose.startSession()` | PayrollService (only transaction today) | `BEGIN` / `COMMIT` / `ROLLBACK` |
| `lean()` | Report/read paths | Plain `SELECT` rows |
| Regex queries | Email, phone, DOB, inquiry search | `ILIKE`, `DATE` parts, full-text search |
| Partial unique indexes | Wallet ledger, greeting templates | PostgreSQL `CREATE UNIQUE INDEX ... WHERE` |
| Direct `collection.updateMany` | DeveloperWalletLedger migration | One-time SQL migration script |
| `$exists` / `$nin` / `$or` | Reports, campaigns, engagement | Standard SQL `IS NULL`, `NOT IN`, `OR` |

### Migration effort ranking (highest first)

1. Aggregation pipelines (`$lookup`, `$group`, `$cond`, `$ifNull`)
2. Embedded documents (inquiry proposals, billing items)
3. Mongo `Map` types on projects (payout maps)
4. Deep `populate` chains (8+ refs on update tickets)
5. Upsert by natural key (master ledger `uniqueKey`)
6. Atomic sequences (INQ-xxxxx generation)
7. ObjectId FKs everywhere → UUID
8. Partial unique indexes
9. Regex-based birthday matching → `DATE` column

---

## 5. Target PostgreSQL schema

### 5.1 Entity relationship overview

```
users
  ├── inquiries (created_by)
  ├── audit_logs
  ├── payment_transactions (recorded_by)
  └── developer_wallet_ledger

inquiries
  ├── inquiry_proposal_stubs
  ├── proposals
  ├── billings → billing_items
  ├── reminders
  └── customers (on confirm)

customers
  ├── projects
  ├── interactions
  ├── invoices
  └── payment_notifications

products
  ├── customers.product_id
  ├── projects.product_id
  └── festival_campaign_products

projects
  ├── project_assignees
  ├── project_developer_payouts
  ├── payment_plans → installments → payment_transactions
  ├── project_tasks
  ├── customer_requirements
  ├── update_tickets
  └── staff_assignments

invoices → master_ledger
company_expenses → master_ledger
```

### 5.2 Table definitions by domain

#### Auth & users

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'pm', 'employee')),
  developer_track TEXT CHECK (developer_track IN ('frontend', 'backend', 'fullstack')),
  status          TEXT NOT NULL DEFAULT 'active',
  phone           TEXT,
  address         TEXT,
  profile_photo   TEXT,
  wallet_balance  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  base_salary     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  date_of_birth   DATE,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_status ON users (status);
```

#### Sequences (human-readable IDs)

```sql
CREATE TABLE sequences (
  name TEXT PRIMARY KEY,  -- e.g. 'inquiry', 'customer', 'proposal'
  seq  INTEGER NOT NULL DEFAULT 0 CHECK (seq >= 0)
);

-- Usage: SELECT seq FROM sequences WHERE name = 'inquiry' FOR UPDATE;
--        UPDATE sequences SET seq = seq + 1 WHERE name = 'inquiry' RETURNING seq;
```

#### CRM

```sql
CREATE TABLE inquiries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         TEXT NOT NULL UNIQUE,  -- INQ-00001
  customer_name       TEXT NOT NULL,
  company_name        TEXT,
  phone_number        TEXT NOT NULL,
  business_model      TEXT,
  project_description TEXT NOT NULL,
  required_features   TEXT[] DEFAULT '{}',
  internal_notes      TEXT,
  status              TEXT NOT NULL DEFAULT 'NEW',
  total_advance_paid  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_advance_used  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  date_of_birth       DATE,
  created_by_id       UUID REFERENCES users (id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_phone ON inquiries (phone_number);
CREATE INDEX idx_inquiries_status ON inquiries (status);
CREATE INDEX idx_inquiries_company ON inquiries (company_name);

CREATE TABLE inquiry_proposal_stubs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID NOT NULL REFERENCES inquiries (id) ON DELETE CASCADE,
  proposal_id  UUID,  -- FK added after proposals table exists
  status       TEXT NOT NULL,
  project_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         TEXT NOT NULL UNIQUE,  -- CUS-xxxxx
  inquiry_id          UUID REFERENCES inquiries (id),
  product_id          UUID REFERENCES products (id),
  name                TEXT NOT NULL,
  phone_number        TEXT NOT NULL,
  email               TEXT,
  address             TEXT,
  business_type       TEXT,
  company_name        TEXT,
  nic_number          TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  service_categories  TEXT[] DEFAULT '{}',
  date_of_birth       DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_phone ON customers (phone_number);
CREATE INDEX idx_customers_product ON customers (product_id);

CREATE TABLE interactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers (id),
  inquiry_id          UUID REFERENCES inquiries (id),
  created_by_id       UUID NOT NULL REFERENCES users (id),
  type                TEXT NOT NULL,
  summary             TEXT NOT NULL,
  details             TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL,
  call_meta           JSONB,  -- { direction, durationSec, outcome, nextFollowUpAt }
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_customer_occurred ON interactions (customer_id, occurred_at DESC);

CREATE TABLE reminders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id                UUID NOT NULL REFERENCES inquiries (id),
  customer_name             TEXT,
  type                      TEXT NOT NULL,
  title                     TEXT NOT NULL,
  description               TEXT,
  meeting_link              TEXT,
  google_event_id           TEXT,
  meeting_duration_minutes  INTEGER,
  niobot_meeting_id         TEXT,
  recording_status          TEXT,
  recording_watch_url       TEXT,
  recording_download_url    TEXT,
  recording_error_message   TEXT,
  scheduled_at              TIMESTAMPTZ NOT NULL,
  notes                     TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending',
  completed                 BOOLEAN DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_inquiry ON reminders (inquiry_id);
CREATE INDEX idx_reminders_scheduled ON reminders (scheduled_at);
```

#### Proposals & billing

```sql
CREATE TABLE proposals (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id              TEXT NOT NULL UNIQUE,
  inquiry_id               UUID NOT NULL REFERENCES inquiries (id),
  campaign_id              UUID REFERENCES festival_campaigns (id),
  project_name             TEXT,
  customer_name            TEXT NOT NULL,
  project_description      TEXT NOT NULL,
  required_features        TEXT[] DEFAULT '{}',
  advance_payment          NUMERIC(14, 2),
  project_cost             NUMERIC(14, 2),
  original_amount          NUMERIC(14, 2),
  campaign_discount_amount NUMERIC(14, 2),
  campaign_name            TEXT,
  discount_type            TEXT,
  discount_value           NUMERIC(14, 2),
  total_amount             NUMERIC(14, 2) NOT NULL,
  payment_plan             TEXT,
  installment_months       INTEGER,
  monthly_installment      NUMERIC(14, 2),
  maintenance_cost_per_month NUMERIC(14, 2),
  maintenance_note         TEXT,
  valid_until              DATE,
  notes                    TEXT,
  document_path            TEXT,
  document_file_name       TEXT,
  document_generated_at    TIMESTAMPTZ,
  status                   TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proposal_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  amount       NUMERIC(14, 2),
  time_period  TEXT,
  due_date     DATE,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE proposaltemplates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     TEXT NOT NULL,
  template_docx BYTEA NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE billings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id       TEXT NOT NULL UNIQUE,
  inquiry_id       UUID NOT NULL REFERENCES inquiries (id),
  customer_name    TEXT NOT NULL,
  project_name     TEXT,
  phone_number     TEXT,
  sub_total        NUMERIC(14, 2) NOT NULL,
  advance_applied  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(14, 2) NOT NULL,
  billing_type     TEXT NOT NULL,
  company_name     TEXT,
  address          TEXT,
  email            TEXT,
  billing_date     DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE billing_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id  UUID NOT NULL REFERENCES billings (id) ON DELETE CASCADE,
  number      TEXT,
  description TEXT,
  amount      NUMERIC(14, 2) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE billingtemplates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     TEXT NOT NULL,
  template_docx BYTEA NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Products & campaigns

```sql
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  description   TEXT,
  base_pricing  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  features      TEXT[] DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE festival_campaigns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             TEXT NOT NULL UNIQUE,
  name                    TEXT NOT NULL,
  description             TEXT,
  start_date              DATE NOT NULL,
  end_date                DATE NOT NULL,
  discount_type           TEXT NOT NULL,
  discount_value          NUMERIC(14, 2),
  discount_percent        NUMERIC(5, 2),
  product_scope           TEXT NOT NULL,
  status                  TEXT NOT NULL,
  promotional_message     TEXT,
  promotional_blast_at    TIMESTAMPTZ,
  promotional_blast_channel TEXT,
  blast_sent              INTEGER DEFAULT 0,
  blast_manual            INTEGER DEFAULT 0,
  blast_failed            INTEGER DEFAULT 0,
  blast_skipped           INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE festival_campaign_products (
  campaign_id UUID NOT NULL REFERENCES festival_campaigns (id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, product_id)
);

CREATE INDEX idx_campaigns_status_dates ON festival_campaigns (status, start_date, end_date);
```

#### Projects & workflow

```sql
CREATE TABLE projects (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name               TEXT NOT NULL,
  description                TEXT,
  system_type                TEXT,
  client_id                  UUID NOT NULL REFERENCES customers (id),
  product_id                 UUID REFERENCES products (id),
  total_value                NUMERIC(14, 2) NOT NULL DEFAULT 0,
  expenses                   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  start_date                 DATE,
  end_date                   DATE,
  status                     TEXT NOT NULL,
  requirement_workflow_label TEXT NOT NULL DEFAULT 'not_started',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_assignees (
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_developer_payouts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users (id),
  amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  release_status TEXT,
  UNIQUE (project_id, user_id)
);

CREATE TABLE project_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects (id),
  requirement_id    UUID REFERENCES customer_requirements (id),
  update_ticket_id  UUID REFERENCES update_tickets (id),
  title             TEXT NOT NULL,
  description       TEXT,
  completed         BOOLEAN NOT NULL DEFAULT false,
  completed_at      TIMESTAMPTZ,
  completed_by_id   UUID REFERENCES users (id),
  created_by_id     UUID NOT NULL REFERENCES users (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_task_assignees (
  task_id  UUID NOT NULL REFERENCES project_tasks (id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users (id),
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE customer_requirements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             UUID NOT NULL REFERENCES customers (id),
  inquiry_id              UUID REFERENCES inquiries (id),
  project_id              UUID REFERENCES projects (id),
  requirement_payout_value NUMERIC(14, 2),
  title                   TEXT NOT NULL,
  description             TEXT,
  priority                TEXT NOT NULL,
  status                  TEXT NOT NULL,
  source                  TEXT NOT NULL,
  captured_by_id          UUID NOT NULL REFERENCES users (id),
  captured_at             TIMESTAMPTZ NOT NULL,
  last_updated_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_requirement_assignees (
  requirement_id UUID NOT NULL REFERENCES customer_requirements (id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users (id),
  PRIMARY KEY (requirement_id, user_id)
);

CREATE TABLE update_tickets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id               TEXT NOT NULL UNIQUE,
  customer_id             UUID NOT NULL REFERENCES customers (id),
  project_id              UUID REFERENCES projects (id),
  title                   TEXT NOT NULL,
  description             TEXT,
  status                  TEXT NOT NULL,
  quoted_price            NUMERIC(14, 2),
  priced_at               TIMESTAMPTZ,
  approved_at             TIMESTAMPTZ,
  developer_payout_value  NUMERIC(14, 2),
  assigned_at             TIMESTAMPTZ,
  requested_at            TIMESTAMPTZ NOT NULL,
  worker_submitted_at     TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  admin_approved_at       TIMESTAMPTZ,
  internal_notes          TEXT,
  priced_by_id            UUID REFERENCES users (id),
  approved_by_id          UUID REFERENCES users (id),
  assigned_by_id          UUID REFERENCES users (id),
  completed_by_worker_id  UUID REFERENCES users (id),
  admin_approved_by_id    UUID REFERENCES users (id),
  created_by_id           UUID NOT NULL REFERENCES users (id),
  linked_requirement_id   UUID REFERENCES customer_requirements (id),
  linked_payment_plan_id  UUID REFERENCES payment_plans (id),
  linked_project_task_id  UUID REFERENCES project_tasks (id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE update_ticket_assignees (
  ticket_id UUID NOT NULL REFERENCES update_tickets (id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users (id),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE TABLE staff_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users (id),
  project_id       UUID NOT NULL REFERENCES projects (id),
  client_id        UUID NOT NULL REFERENCES customers (id),
  project_name     TEXT NOT NULL,
  agreed_payout    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  workflow_status  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);
```

#### Payments & finance

```sql
CREATE TABLE payment_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects (id),
  linked_requirement_id UUID REFERENCES customer_requirements (id),
  plan_kind             TEXT NOT NULL,
  down_payment_pct      NUMERIC(5, 2),
  down_payment_amt      NUMERIC(14, 2),
  total_installments    INTEGER NOT NULL,
  installment_amt       NUMERIC(14, 2) NOT NULL,
  remaining_balance     NUMERIC(14, 2) NOT NULL,
  service_fee_pct       NUMERIC(5, 2),
  service_fee_amt       NUMERIC(14, 2),
  plan_start_date       DATE,
  status                TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_plan_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  down_payment_pct    NUMERIC(5, 2) NOT NULL,
  installments_count  INTEGER NOT NULL,
  service_fee_pct     NUMERIC(5, 2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE installments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        UUID NOT NULL REFERENCES payment_plans (id),
  installment_no INTEGER NOT NULL,
  due_date       DATE NOT NULL,
  due_amount     NUMERIC(14, 2) NOT NULL,
  paid_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  paid_date      DATE,
  partial_paid   BOOLEAN DEFAULT false,
  status         TEXT NOT NULL,
  overdue_days   INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_installments_plan ON installments (plan_id);
CREATE INDEX idx_installments_status ON installments (status);
CREATE INDEX idx_installments_due_date ON installments (due_date);

CREATE TABLE payment_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID REFERENCES installments (id),
  client_id      UUID NOT NULL REFERENCES customers (id),
  recorded_by_id UUID NOT NULL REFERENCES users (id),
  gateway_id     TEXT,
  amount         NUMERIC(14, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  reference_no   TEXT UNIQUE,
  payment_date   TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES customers (id),
  user_id        UUID REFERENCES users (id),
  installment_id UUID REFERENCES installments (id),
  type           TEXT NOT NULL,
  trigger_type   TEXT NOT NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  sent_at        TIMESTAMPTZ,
  status         TEXT NOT NULL,
  message_body   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT NOT NULL UNIQUE,
  transaction_id    UUID REFERENCES payment_transactions (id),
  inquiry_id        UUID REFERENCES inquiries (id),
  proposal_id       UUID REFERENCES proposals (id),
  client_id         UUID REFERENCES customers (id),
  product_id        UUID REFERENCES products (id),
  campaign_id       UUID REFERENCES festival_campaigns (id),
  invoice_date      DATE NOT NULL,
  total_amount      NUMERIC(14, 2) NOT NULL,
  original_amount   NUMERIC(14, 2),
  tax_amount        NUMERIC(14, 2),
  discount_amt      NUMERIC(14, 2),
  campaign_name     TEXT,
  discount_type     TEXT,
  discount_value    NUMERIC(14, 2),
  status            TEXT NOT NULL,
  source_type       TEXT NOT NULL,
  invoice_type      TEXT NOT NULL,
  description       TEXT,
  project_name      TEXT,
  company_name      TEXT,
  pdf_path          TEXT,
  emailed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE master_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL,
  source          TEXT NOT NULL,
  category        TEXT NOT NULL,
  amount          NUMERIC(14, 2) NOT NULL,
  gross_amount    NUMERIC(14, 2),
  discount_amount NUMERIC(14, 2),
  description     TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  unique_key      TEXT NOT NULL UNIQUE,
  invoice_id      UUID REFERENCES invoices (id),
  project_id      UUID REFERENCES projects (id),
  developer_id    UUID REFERENCES users (id),
  expense_id      UUID REFERENCES company_expenses (id),
  client_name     TEXT,
  invoice_number  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_expenses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount           NUMERIC(14, 2) NOT NULL,
  category         TEXT NOT NULL,
  description      TEXT NOT NULL,
  expense_date     DATE NOT NULL,
  source           TEXT NOT NULL,
  automation_kind  TEXT,
  payroll_period   TEXT,
  developer_id     UUID REFERENCES users (id),
  project_id       UUID REFERENCES projects (id),
  update_ticket_id UUID REFERENCES update_tickets (id),
  recorded_by_id   UUID NOT NULL REFERENCES users (id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_expenses_ticket_automation
  ON company_expenses (update_ticket_id, automation_kind)
  WHERE update_ticket_id IS NOT NULL;

CREATE TABLE developer_wallet_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id     UUID NOT NULL REFERENCES users (id),
  project_id       UUID NOT NULL REFERENCES projects (id),
  update_ticket_id UUID REFERENCES update_tickets (id),
  project_name     TEXT NOT NULL,
  amount           NUMERIC(14, 2) NOT NULL,
  wallet_status    TEXT NOT NULL,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wallet_dev_project
  ON developer_wallet_ledger (developer_id, project_id)
  WHERE update_ticket_id IS NULL;

CREATE UNIQUE INDEX idx_wallet_dev_ticket
  ON developer_wallet_ledger (developer_id, update_ticket_id)
  WHERE update_ticket_id IS NOT NULL;
```

#### Engagement & ops

```sql
CREATE TABLE birthday_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_type    TEXT NOT NULL,
  subject_type     TEXT NOT NULL,
  subject_id       UUID NOT NULL,
  project_id       UUID REFERENCES projects (id),
  festival_key     TEXT,
  person_name      TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  greeting_message TEXT NOT NULL,
  ai_generated     BOOLEAN NOT NULL DEFAULT false,
  sent_at          TIMESTAMPTZ,
  sent_channel     TEXT,
  responded_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE greeting_card_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type    TEXT NOT NULL,
  festival_key     TEXT,
  file_name        TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  uploaded_by_id   UUID REFERENCES users (id),
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_greeting_festival
  ON greeting_card_templates (template_type, festival_key)
  WHERE festival_key IS NOT NULL;

CREATE UNIQUE INDEX idx_greeting_birthday_anniversary
  ON greeting_card_templates (template_type)
  WHERE template_type IN ('birthday', 'anniversary');

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users (id),
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.3 ID mapping table (migration only)

```sql
CREATE TABLE id_map (
  collection  TEXT NOT NULL,
  mongo_oid   TEXT NOT NULL,
  postgres_id UUID NOT NULL,
  PRIMARY KEY (collection, mongo_oid)
);
```

Drop after migration verification is complete.

---

## 6. Reporting views

Replace Mongo aggregation pipelines with SQL views (optionally materialized for dashboard).

| View | Replaces | Key logic |
|------|----------|-----------|
| `v_client_revenue` | `CustomerProfileService` | SUM payments + invoices by `client_id` |
| `v_client_outstanding` | Customer 360° financial summary | Outstanding from plans + invoices |
| `v_product_sales` | `ProductSalesService` `$lookup` | JOIN projects/transactions → customers by product |
| `v_business_snapshot` | `MasterLedgerService.getBusinessSnapshot` | Income/expense totals, AR, receivables |
| `v_developer_earnings` | `ProjectService`, `OperationsReportService` | Wallet ledger SUM by developer, date filters |
| `v_overdue_installments` | `ReportController`, `InstallmentService` | `status = 'overdue'` counts and amounts |
| `v_engagement_stats` | `EngagementService` | Birthday card sends, replies by subject |
| `v_campaign_attribution` | `CampaignReportService` | Gross/net/discount via `CASE` on invoices |
| `v_operations_tasks` | `OperationsReportService` | Task completion ratios per developer |
| `v_expense_by_category` | `ExpenseService.summary` | GROUP BY category |

---

## 7. Platform function migration checklist

### Phase A — Foundation (Week 1–2)

| # | Feature / area | Files | Tasks |
|---|----------------|-------|-------|
| A1 | DB connection | `mongo.ts`, `index.ts`, `app.ts` | Add `postgres.ts`, Prisma client, health check |
| A2 | ID utilities | `mongoId.ts` | Replace with `uuid.ts` |
| A3 | Migrations | New `prisma/` or `drizzle/` | Initial schema, seed scripts |
| A4 | Repository interfaces | New `domain/repositories/` | Abstract all 30 models |
| A5 | Coolify setup | `Dockerfile`, `docker-compose.yml` | API + Postgres + Nginx frontend |
| A6 | Env template | `.env.example` | `DATABASE_URL` replaces `MONGODB_URI` |

### Phase B — Auth & team (Week 2)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| B1 | Login / JWT | `authRoutes` | `AuthService` | Login |
| B2 | Register / profile | `authRoutes`, `userRoutes` | `UserService` | Profile |
| B3 | Team management | `userRoutes` | `UserService` | TeamManagement, EmployeeDetail |
| B4 | Developer wallet | `payrollRoutes` | `PayrollService` | — |
| B5 | Seed admin | `scripts/seedAdmin.ts` | Rewrite for SQL | — |

**Notes:** Case-insensitive email lookup → `LOWER(email) = LOWER($1)`. Payroll is the first full SQL transaction.

### Phase C — CRM & leads (Week 3)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| C1 | Inquiry CRUD + search | `inquiryRoutes` | `InquiryService` | Inquiries, InquiryForm |
| C2 | Duplicate phone alert | `inquiryRoutes` | `InquiryService` | InquiryForm |
| C3 | INQ-xxxxx ID generation | inquiry create | Sequence + transaction | — |
| C4 | Customer CRUD | `customerRoutes` | `CustomerService` | Customer |
| C5 | Customer 360° profile | `customerRoutes` | `CustomerProfileService` | CustomerDetail |
| C6 | Interactions log | `interactionRoutes` | `InteractionService` | CustomerDetail |
| C7 | Reminders & meetings | `reminderRoutes` | `ReminderService` | Reminders, Meetings, MeetingDetail |
| C8 | NioBot Meet recordings | `reminderRoutes` | Reminder fields only | MeetingDetail |

**Notes:** Regex search → `ILIKE`. Birthday DOB on inquiries/customers → `DATE` column.

### Phase D — Proposals & billing (Week 3–4)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| D1 | Proposal CRUD | `proposalRoutes` | `ProposalService` | Proposals, CreateProposal, ProposalDetail |
| D2 | Proposal PDF/DOCX | `proposalRoutes` | `ProposalDocumentService` | ProposalDetail |
| D3 | Proposal templates | `proposalRoutes` | `ProposalController` | Settings |
| D4 | Billing CRUD | `billingRoutes` | `BillingService` | Billing, CreateBilling, BillingDetail |
| D5 | Billing templates | `billingRoutes` | `BillingController` | Settings |
| D6 | Advance payment tracking | billing flows | `$inc` → SQL UPDATE | — |

**Notes:** Normalize `inquiry_proposal_stubs` and `billing_items`. Store generated PDFs on VPS volume.

### Phase E — Products & campaigns (Week 4)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| E1 | Product directory | `productRoutes` | `ProductService` | ProductDirectory |
| E2 | Festival campaigns | `campaignRoutes`, `discountRoutes` | `CampaignService` | Campaigns |
| E3 | Campaign reports | `campaignRoutes` | `CampaignReportService` | Campaigns, Reports |
| E4 | Festival marketing blast | `engagementRoutes` | `CampaignMarketingService` | Campaigns |
| E5 | Discount on proposals/invoices | cross-cutting | Campaign FK preserved | — |

**Notes:** Campaign expiry on connect → Coolify cron or app startup job (not in DB connect).

### Phase F — Projects & delivery (Week 5–6)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| F1 | Project CRUD | `projectRoutes` | `ProjectService` | Projects, ProjectDetail |
| F2 | Employee assignment | `projectRoutes` | `ProjectService` | AssignEmployees |
| F3 | Staff assignments sync | internal | `syncStaffAssignmentsForProject` | — |
| F4 | Developer wallet ledger | internal | Wallet model/service | ProjectDetail |
| F5 | Project tasks | `projectTaskRoutes` | `ProjectTaskService` | Tasks |
| F6 | Requirements workflow | `projectRoutes` | `CustomerRequirementService` | ProjectRequirementWorkflow |
| F7 | Update tickets (full workflow) | `updateTicketRoutes` | `UpdateTicketService` | UpdateTickets |
| F8 | Payout release / approval | update ticket flow | Wallet + ledger | — |

**Notes:** `UpdateTicketService` has the highest Mongo usage (~126 references). Migrate last within Phase F.

### Phase G — Payments & invoicing (Week 6–7)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| G1 | Payment plans | `paymentPlanRoutes` | `PaymentPlanService` | PaymentPlans |
| G2 | Plan templates | `paymentPlanTemplateRoutes` | Controller CRUD | Settings |
| G3 | Installments | `installmentRoutes` | `InstallmentService` | Installments, InstallmentDetail |
| G4 | Payment transactions | `paymentTransactionRoutes` | `PaymentTransactionService` | Payments, Transactions |
| G5 | Payment notifications | `paymentNotificationRoutes` | `PaymentNotificationService` | PaymentNotifications |
| G6 | Invoices (internal) | `invoiceRoutes` | `InvoiceService` | Invoices, BillingDetail |
| G7 | Public invoice view | `publicInvoiceRoutes` | Read-only | — |
| G8 | Overdue job | `jobRoutes`, `scripts/updateOverdue.ts` | Coolify cron | — |

**Notes:** `remainingBalance` decrement must be atomic. Deep populate chains → multi-table JOINs.

### Phase H — Finance & reporting (Week 7–8)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| H1 | Master ledger | internal | `MasterLedgerService` | — |
| H2 | Company expenses | `expenseRoutes` | `ExpenseService` | Expenses |
| H3 | Payroll processing | `payrollRoutes` | `PayrollService` | — |
| H4 | Financial reports | `reportRoutes` | `FinancialReportService` | Reports |
| H5 | Operations reports | `reportRoutes` | `OperationsReportService` | Reports, Dashboard |
| H6 | Product sales/reports | `reportRoutes`, `productRoutes` | `ProductSalesService`, `ProductReportService` | Reports |
| H7 | Dashboard summaries | `reportRoutes` | `ReportController` | Dashboard |
| H8 | Audit log | `auditLogRoutes` | `AuditLogService` | Audit |

**Notes:** RBAC at API layer unchanged. Super Admin vs Management vs Developer visibility rules stay in services/controllers.

### Phase I — Engagement automation (Week 8)

| # | Feature | Routes | Services | Frontend pages |
|---|---------|--------|----------|----------------|
| I1 | Birthday scan & cards | `birthdayRoutes`, `jobRoutes` | `BirthdayService` | Dashboard |
| I2 | Anniversary scan | `jobRoutes`, `scripts/scanAnniversaries.ts` | `EngagementService` | Dashboard |
| I3 | Festival blast | `engagementRoutes` | `EngagementService` | Dashboard |
| I4 | Greeting card templates | `birthdayRoutes` | `GreetingCardTemplateService` | Settings |
| I5 | WhatsApp / email send | external APIs | Twilio/SMTP unchanged | — |
| I6 | Engagement stats | `engagementRoutes` | SQL aggregates | Dashboard |

**Notes:** Replace regex DOB matching (`/-MM-DD$/`) with `EXTRACT(MONTH FROM date_of_birth)` queries.

### Phase J — Integrations & cutover (Week 9–10)

| # | Feature | Work |
|---|---------|------|
| J1 | Google OAuth / Calendar | `googleOAuthRoutes`, `integrationRoutes` |
| J2 | File storage migration | `backend/assets/`, PDFs, cards → `/data` volume |
| J3 | Environment cutover | `DATABASE_URL` in Coolify |
| J4 | Coolify services | Postgres + API + Frontend + cron |
| J5 | Remove Mongoose | Delete models, `mongo.ts`, `mongoose` dependency |
| J6 | Production data ETL | See §8 |
| J7 | Monitoring | DB connection alerts, disk space for `/data` |

---

## 8. Data migration strategy

### 8.1 Option A — Big bang (simpler, higher risk)

1. Export MongoDB (`mongoexport` or custom Node ETL).
2. Transform ObjectIds → UUIDs; populate `id_map`.
3. Load PostgreSQL in FK dependency order.
4. Deploy new backend.
5. **Downtime:** 2–4 hours.

**Best for:** Staging, empty production, or acceptable maintenance window.

### 8.2 Option B — Dual-write (recommended for live production)

1. Deploy PostgreSQL alongside MongoDB.
2. Feature-flag dual-write per domain (start with auth, end with finance).
3. Backfill historical data domain by domain.
4. Reconcile totals after each domain.
5. Switch reads to PostgreSQL per domain.
6. Retire MongoDB when all domains verified.

**Best for:** Production with existing financial data.

### 8.3 ETL script load order

Respect foreign key dependencies:

```
1.  users
2.  products
3.  festival_campaigns → festival_campaign_products
4.  sequences (seed current max values from Mongo)
5.  inquiries → inquiry_proposal_stubs
6.  customers
7.  interactions, reminders
8.  proposals → proposal_milestones (update stub proposal_id FKs)
9.  billings → billing_items
10. projects → project_assignees → project_developer_payouts
11. customer_requirements → customer_requirement_assignees
12. update_tickets → update_ticket_assignees
13. staff_assignments
14. payment_plans → installments → payment_transactions
15. invoices
16. master_ledger
17. company_expenses
18. developer_wallet_ledger
19. payment_notifications
20. birthday_cards, greeting_card_templates
21. audit_logs, integrations
22. proposaltemplates, billingtemplates (BYTEA)
```

### 8.4 Validation checks (must pass before cutover)

| Check | Method |
|-------|--------|
| Row counts per collection/table | Automated diff script |
| `SUM(payment_transactions.amount)` | Mongo vs Postgres |
| `SUM(master_ledger.amount)` by kind | Mongo vs Postgres |
| User count by role | Mongo vs Postgres |
| Orphan FK scan | `LEFT JOIN ... WHERE right.id IS NULL` |
| Human IDs preserved | Spot-check INQ-, CUS-, proposal, billing, ticket IDs |
| Wallet partial unique constraints | Insert conflict tests |
| Inquiry proposal stub linkage | Every stub has valid inquiry_id |

### 8.5 Rollback plan

- Keep MongoDB read-only for 2 weeks post-cutover.
- Feature flags to route reads back to Mongo if critical bug found.
- Nightly Postgres backups via Coolify.

---

## 9. Coolify deployment architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Coolify VPS                          │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   Frontend   │───▶│   Node API   │───▶│ PostgreSQL│ │
│  │ Nginx :80/443│    │   :5000      │    │   :5432   │ │
│  └──────────────┘    └──────┬───────┘    └───────────┘ │
│                             │                            │
│                      ┌──────▼───────┐                    │
│                      │ /data volume │                    │
│                      │ PDFs, cards  │                    │
│                      │ templates    │                    │
│                      └──────────────┘                    │
│                                                          │
│  Cron (Coolify scheduled tasks):                         │
│    - job:birthdays (daily 08:00)                         │
│    - job:anniversaries (daily 08:00)                     │
│    - updateOverdue (daily)                               │
└─────────────────────────────────────────────────────────┘
```

### 9.1 Coolify services

| Service | Image / build | Notes |
|---------|--------------|-------|
| **postgres** | `postgres:16-alpine` | Persistent volume; enable daily backups |
| **niolla-api** | `backend/Dockerfile` | `DATABASE_URL`, `JWT_SECRET`, integrations |
| **niolla-web** | `frontend/Dockerfile` | Nginx serves `dist/`; reverse-proxy `/api` → API |

### 9.2 New repository files

```
backend/
  Dockerfile
  prisma/
    schema.prisma
    migrations/
  src/infrastructure/database/
    postgres.ts
    repositories/          # one per domain
docker-compose.yml         # local dev: api + postgres + web
.env.example
docs/
  COOLIFY_DEPLOY.md        # optional runbook
```

### 9.3 Environment variables (updated)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/niolla_pm` |
| `JWT_SECRET` | Unchanged |
| `JWT_EXPIRES_IN` | Unchanged |
| `FILE_STORAGE_PATH` | `/data/uploads` on VPS |
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `FRONTEND_URL` | Public frontend URL for OAuth redirect |
| `GOOGLE_*`, `SMTP_*`, `TWILIO_*`, `OPENAI_*` | Unchanged |
| ~~`MONGODB_URI`~~ | Remove after cutover |

### 9.4 Sample `docker-compose.yml` (local dev)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: niolla
      POSTGRES_PASSWORD: niolla
      POSTGRES_DB: niolla_pm
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://niolla:niolla@postgres:5432/niolla_pm
      JWT_SECRET: dev-secret
    depends_on:
      - postgres
    volumes:
      - ./data:/data

  web:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - api

volumes:
  pgdata:
```

### 9.5 Cron jobs (Coolify)

| Schedule | Command | Purpose |
|----------|---------|---------|
| `0 8 * * *` | `npm run job:birthdays` | Birthday notifications |
| `0 8 * * *` | `npm run job:anniversaries` | Anniversary notifications |
| `0 1 * * *` | `npx ts-node scripts/updateOverdue.ts` | Mark overdue installments |

---

## 10. ORM recommendation

| Option | Pros | Cons |
|--------|------|------|
| **Prisma** | Strong migrations, type-safe client, team-friendly | Heavier; complex reports may need `$queryRaw` |
| **Drizzle** | Lightweight, SQL-like, fits clean architecture | Smaller ecosystem |
| **Knex + raw SQL** | Full control | More boilerplate |

**Recommendation:** **Prisma** for CRUD + migrations; **SQL views** for reporting layer.

### Repository layer structure

```
domain/repositories/
  IUserRepository.ts
  IInquiryRepository.ts
  ... (one per aggregate)

infrastructure/database/repositories/
  PrismaUserRepository.ts
  PrismaInquiryRepository.ts
  ...
```

Services depend on interfaces only — enables testing with in-memory or test DB.

---

## 11. API contract impact

**Goal:** Zero or minimal frontend changes.

| Area | Impact |
|------|--------|
| JSON `id` fields | UUID strings (same string shape in API responses) |
| Human IDs | `INQ-00001`, `CUS-00001`, `billingId`, etc. unchanged |
| RBAC | Unchanged at API + `RoleGate` component |
| Pagination / filters | Unchanged query params |
| Breaking risk | Frontend assuming exactly 24-char ObjectId length (audit with grep) |

---

## 12. Testing plan

### 12.1 Coverage targets (per ECC standards)

| Layer | Target |
|-------|--------|
| Repository unit tests | Each repository — CRUD, constraints, edge cases |
| Service integration tests | Cross-table workflows with test DB |
| Migration tests | Row count + financial parity on sample dataset |
| E2E | Critical user journeys |

### 12.2 Priority test scenarios

1. **Billing advance** — create billing increments `total_advance_paid`; delete decrements correctly.
2. **Payment plan** — transaction decrements `remaining_balance` atomically.
3. **Master ledger** — `uniqueKey` upsert is idempotent.
4. **Payroll** — wallet zeroing is transactional (rollback on failure).
5. **Inquiry ID** — concurrent creates produce unique `INQ-xxxxx` without collision.
6. **Wallet ledger** — partial unique indexes enforced.
7. **Update ticket workflow** — full state machine from request → complete → payout.
8. **Customer 360°** — revenue totals match sum of underlying transactions.

### 12.3 E2E critical path

```
Login (admin) → Create inquiry → Create proposal → Download PDF
→ Confirm customer → Create project → Payment plan → Record payment
→ Generate invoice → Verify dashboard totals
```

---

## 13. Risk register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Financial totals drift during migration | Critical | Medium | Dual-write + reconciliation scripts |
| Embedded inquiry proposals lost | High | Medium | Explicit `inquiry_proposal_stubs` ETL |
| Report performance regression | Medium | Medium | Indexes + materialized views |
| File uploads lost (Vercel → VPS) | Medium | High | Migrate `/data` before cutover |
| Update ticket workflow bugs | High | Medium | Migrate last; extensive integration tests |
| No existing automated tests | High | Certain | Add tests starting Phase A |
| Concurrent inquiry ID collision | Medium | Low | `SELECT FOR UPDATE` on sequences |
| Template BYTEA size limits | Low | Low | Prefer file storage for large DOCX |
| Coolify cron failure | Medium | Medium | Alerting + manual job endpoint fallback |

---

## 14. Execution timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1–2 | A — Foundation | Prisma schema, Docker, repositories skeleton, auth migrated |
| 2 | B — Auth | Users, login, payroll spike, seed script |
| 3 | C — CRM | Inquiries, customers, interactions, reminders |
| 4 | D + E | Proposals, billing, products, campaigns |
| 5–6 | F — Projects | Projects, tasks, requirements, update tickets, wallet |
| 7 | G — Payments | Plans, installments, transactions, invoices |
| 8 | H — Finance | Ledger, expenses, all reports |
| 9 | I — Engagement | Birthdays, anniversaries, greeting templates |
| 10 | J — Cutover | ETL, Coolify deploy, MongoDB decommission |
| 11–12 | Buffer | E2E hardening, monitoring, documentation |

**Total:** 8–12 weeks depending on team size and production data complexity.

---

## 15. Immediate next steps

1. **Approve ORM choice** — Prisma recommended.
2. **Create `backend/prisma/schema.prisma`** from §5 table definitions.
3. **Spike:** Migrate `AuthService` + `UserService` only to validate repository pattern.
4. **Provision PostgreSQL** on Coolify (or local Docker) and test `DATABASE_URL`.
5. **Add `.env.example`** with `DATABASE_URL` and document removed `MONGODB_URI`.
6. **Grep frontend** for ObjectId length assumptions.
7. **Export sample MongoDB dataset** for migration script development.

---

## Appendix A — Full model reference

| Model file | Collection | Timestamps | Notable |
|------------|-----------|------------|---------|
| `UserModel.ts` | `users` | yes | `email` unique |
| `CustomerModel.ts` | `customers` | yes | `customerId` unique, legacy `projects[]` |
| `InquiryModel.ts` | `inquiries` | yes | pre-save hook, embedded `proposals[]` |
| `ProposalModel.ts` | `proposals` | yes | embedded `milestones[]` |
| `ProposalTemplateModel.ts` | `proposaltemplates` | partial | BYTEA template |
| `BillingModel.ts` | `billings` | yes | embedded `items[]` |
| `BillingTemplateModel.ts` | `billingtemplates` | partial | BYTEA template |
| `ProductModel.ts` | `products` | yes | `code` unique uppercase |
| `FestivalCampaignModel.ts` | `festivalcampaigns` | yes | blast stats embedded |
| `ProjectModel.ts` | `projects` | yes | Map payout fields |
| `ProjectTaskModel.ts` | `projecttasks` | yes | multi-assignee |
| `CustomerRequirementModel.ts` | `customerrequirements` | yes | workflow refs |
| `UpdateTicketModel.ts` | `updatetickets` | yes | 8+ user FKs |
| `StaffAssignmentModel.ts` | `Staff_Assignments` | yes | unique (user, project) |
| `PaymentPlanModel.ts` | `paymentplans` | yes | `remainingBalance` |
| `PaymentPlanTemplateModel.ts` | `paymentplantemplates` | yes | — |
| `InstallmentModel.ts` | `installments` | yes | overdue tracking |
| `PaymentTransactionModel.ts` | `paymenttransactions` | yes | sparse `referenceNo` |
| `PaymentNotificationModel.ts` | `paymentnotifications` | yes | scheduled sends |
| `InvoiceModel.ts` | `invoices` | yes | many optional FKs |
| `MasterLedgerModel.ts` | `masterledgers` | yes | `uniqueKey` |
| `DeveloperWalletLedgerModel.ts` | `developerwalletledgers` | yes | partial unique indexes |
| `CompanyExpenseModel.ts` | `companyexpenses` | yes | payroll automation |
| `InteractionModel.ts` | `interactions` | yes | `callMeta` embedded |
| `ReminderModel.ts` | `reminders` | yes | NioBot fields |
| `AuditLogModel.ts` | `auditlogs` | created only | Mixed JSON |
| `BirthdayCardModel.ts` | `birthdaycards` | yes | polymorphic subject |
| `GreetingCardTemplateModel.ts` | `greetingcardtemplates` | partial | partial unique |
| `IntegrationModel.ts` | `integrations` | yes | key-value tokens |
| `SequenceModel.ts` | `sequences` | no | string `_id`, counter |

---

## Appendix B — Service & file index

### Application services (34)

`AuthService`, `UserService`, `AuditLogService`, `InquiryService`, `CustomerService`, `CustomerProfileService`, `CustomerRequirementService`, `InteractionService`, `ReminderService`, `ProposalService`, `BillingService`, `InvoiceService`, `PaymentTransactionService`, `PaymentPlanService`, `InstallmentService`, `PaymentNotificationService`, `ProjectService`, `ProjectTaskService`, `UpdateTicketService`, `PayrollService`, `ExpenseService`, `MasterLedgerService`, `FinancialReportService`, `OperationsReportService`, `ProductService`, `ProductSalesService`, `ProductReportService`, `CampaignService`, `CampaignReportService`, `CampaignMarketingService`, `BirthdayService`, `EngagementService`, `GreetingCardTemplateService`, `IntegrationService`

### Controllers with direct DB access (7)

`ReportController`, `BillingController`, `ProposalController`, `PaymentPlanTemplateController`, `InvoiceController`, `ProjectController`, `UpdateTicketController`

### Scripts (5 DB-related)

`seedAdmin.ts`, `seedProposalTemplate.ts`, `updateOverdue.ts`, `scanBirthdays.ts`, `scanAnniversaries.ts`

### Route modules (30)

`authRoutes`, `userRoutes`, `inquiryRoutes`, `customerRoutes`, `interactionRoutes`, `reminderRoutes`, `proposalRoutes`, `billingRoutes`, `productRoutes`, `campaignRoutes`, `discountRoutes`, `projectRoutes`, `projectTaskRoutes`, `updateTicketRoutes`, `paymentPlanRoutes`, `paymentPlanTemplateRoutes`, `installmentRoutes`, `paymentTransactionRoutes`, `paymentNotificationRoutes`, `invoiceRoutes`, `publicInvoiceRoutes`, `expenseRoutes`, `payrollRoutes`, `reportRoutes`, `birthdayRoutes`, `engagementRoutes`, `auditLogRoutes`, `integrationRoutes`, `googleOAuthRoutes`, `jobRoutes`

### Highest-complexity migration targets

1. `UpdateTicketService.ts` (~126 Mongo references)
2. `OperationsReportService.ts` (multi-stage aggregates)
3. `CustomerProfileService.ts` (360° aggregates)
4. `MasterLedgerService.ts` (upsert + snapshot aggregates)
5. `InvoiceService.ts` (deep populate chains)
6. `ProductSalesService.ts` (only `$lookup` usage in services)

---

*End of migration plan.*
