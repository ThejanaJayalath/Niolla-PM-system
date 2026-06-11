# Niolla Project Management System: Accounting Module Logic & Implementation Plan

This document explains the comprehensive logic behind the new **Accounting Module**, how its entities interact, the new UI tabs it introduces, and how it integrates with the existing system to form a complete Business ERP.

---

## Part 1: Core Accounting Entities & Logic

The accounting system introduces three core entities designed to separate the *planning* of expenses from the *execution* of expenses, allowing for variance analysis.

### 1. Expense Categories
**What it is:** A hierarchical list of classifications for where money goes. Derived directly from the `NIOLLA NEXA.xlsx` template.
**Logic:** Categories can be "Parent" (e.g., Office costs) or "Child" (e.g., Electricity, Water, Rent). This hierarchical structure allows the system to aggregate data at different levels.
**Interactions:**
- **Parent to:** Both *Planned Expenses* and *Actual Expenses*. Every budget or logged expense must be tied to a specific Child category.
- **Initial Data Structure:**
  - **Employee costs:** Salary, Benefits
  - **Office costs:** Office lease, Gas, Electric, Water, Telephone, Internet access, Office supplies, Security
  - **Marketing costs:** Web site hosting, Web site updates, Collateral preparation, Collateral printing, Marketing events, Miscellaneous
  - **Training/travel:** Training classes, Travel costs

### 2. Planned Expenses (The Budget)
**What it is:** The financial roadmap. It defines how much money Niolla Nexa expects to spend on a specific category in a specific month of a specific year.
**Logic:** A record contains `year`, `month`, `categoryId`, and `amount`. Instead of one massive grid stored in the DB, it stores independent monthly records. This prevents data locking and makes API querying much faster.
**Interactions:**
- **Parent:** Linked to an **Expense Category**.
- **Calculations:** The system groups all planned expenses for a month to calculate the "Total Monthly Budget."
- **Variance:** It is constantly compared against the *Actual Expenses* to generate the Variance Report.

### 3. Actual Expenses (The Ledger)
**What it is:** The real-world execution. The day-to-day logging of money leaving the company.
**Logic:** When an employee buys something or pays a bill, they create a record. It requires a `date`, `amount`, `categoryId`, `paymentMethod` (Cash, Bank, Card), a `description`, and optionally, an uploaded `receiptUrl` (for auditing).
**Interactions:**
- **Parent:** Linked to an **Expense Category** and the **User** who recorded it.
- **Variance:** Decreases the available budget of its corresponding *Planned Expense* for that month.
- **Profit/Loss:** It interacts with the existing **Payment Transactions (Income)** from the Billing Flow to calculate the company's real-time Net Profit.

---

## Part 2: Frontend Architecture (New UI Tabs)

To support this logic, a new primary navigation item called **"Accounting"** will be added. This page will use a nested-tab layout containing four core views:

### Tab 1: Financial Dashboard (Analysis)
**Purpose:** A high-level visual overview for management.
**Logic & Visuals:**
- **Net Profit Chart:** A line graph combining data from `PaymentTransactions` (Incomes) and `ActualExpenses` (Costs) over the last 12 months.
- **Budget vs. Actual Chart:** A grouped bar chart comparing the total planned vs actual spending month-by-month.
- **Category Breakdown:** A pie chart showing which *Expense Categories* consume the most capital.

### Tab 2: Planned Expenses (Budget Matrix)
**Purpose:** To input the budget for the upcoming year, directly mimicking the "PLANNED EXPENSES" sheet in the Excel file.
**Logic & Visuals:**
- **UI Structure:** A spreadsheet-like DataGrid.
  - *Rows:* Expense Categories grouped by their Parent categories.
  - *Columns:* Jan, Feb, Mar ... Dec, and a "Year Total" column.
- **Interaction Flow:**
  1. The user selects a Year (e.g., 2026) from a dropdown.
  2. The table populates. The user can click on any cell (e.g., Office lease -> Jan) and type a number.
  3. Clicking "Save Budget" sends an array of updates to the `POST /api/accounting/planned` endpoint, bulk-updating the database.
  4. The "Year Total" column auto-calculates in real-time as the user types.

### Tab 3: Actual Expenses (The Ledger)
**Purpose:** The daily operational tool for recording spending.
**Logic & Visuals:**
- **UI Structure:** A standard Data Table listing recent expenses, sortable by Date, Category, and Amount.
- **Interaction Flow:**
  1. User clicks the **"Add New Expense"** button.
  2. A Modal opens with fields: Date picker, Amount input, Category dropdown (grouped by parent), Payment Method, Description text area, and a File Uploader for the receipt.
  3. Clicking "Submit" saves the record via `POST /api/accounting/actual` and immediately updates the table.
- **Filters:** Users can filter the ledger by Date Range or Category to easily audit past spending.

### Tab 4: Variance Report
**Purpose:** To analyze if the company is over or under budget, mirroring the "EXPENSE VARIANCES" Excel sheet.
**Logic & Visuals:**
- **UI Structure:** A read-only analytical matrix, identical in layout to the Planned Expenses grid.
- **Calculation Logic:** For every cell (Category + Month), the system calculates:
  `Variance = (Planned Amount) - (Actual Amount)`
- **Visual Cues:** 
  - If Variance is positive (Under budget): Text is green.
  - If Variance is negative (Over budget): Text is red, and a warning icon is displayed.
  - This allows management to instantly spot financial leaks.

---

## Part 3: Backend API Integration

The backend will be expanded using the existing Clean Architecture pattern (`src/domain`, `src/application`, `src/presentation`).

### Controllers & Services needed:

1. **`ExpenseCategoryController` & `Service`**
   - `GET /categories`: Returns a nested JSON object of all categories and subcategories. Ensures the frontend dropdowns are always synced with the database.

2. **`PlannedExpenseController` & `Service`**
   - `GET /planned/:year`: Fetches the budget for the requested year. Returns data transformed into a matrix format so the frontend can easily map it to the spreadsheet UI.
   - `POST /planned/bulk`: Accepts an array of `{ year, month, categoryId, amount }` objects. Uses a MongoDB `bulkWrite` operation (upsert logic) to efficiently save the entire budget grid at once.

3. **`ActualExpenseController` & `Service`**
   - `POST /actual`: Saves a single expense record. Handles the file upload logic if a receipt is provided.
   - `GET /actual`: Retrieves the paginated list of expenses. Supports query parameters like `?startDate=X&endDate=Y&category=Z`.

4. **`AccountingReportController` & `Service`**
   - `GET /reports/variance/:year`: The powerhouse endpoint. It executes a MongoDB aggregation pipeline that joins the `PlannedExpenses` collection with the `ActualExpenses` collection, groups them by Category and Month, and outputs the calculated Variance matrix.
   - `GET /reports/profit-loss/:year`: Executes a cross-domain aggregation. It sums up the system's `PaymentTransactions` (from the Billing module) and subtracts the sum of `ActualExpenses` to provide the ultimate bottom-line Net Profit data for the Dashboard.

---

## Summary of the Full System Data Flow

1. **Beginning of Year:** Management opens the **Accounting > Planned Expenses** tab and inputs the budget (e.g., allocating $100 for Jan Office Supplies).
2. **Operations (Income):** The sales team uses the *Projects* and *Payments* tabs. Money comes in via `PaymentTransactions`.
3. **Operations (Expenses):** An employee buys pens. They open the **Accounting > Actual Expenses** tab, click "Add New", and log $120 for Office Supplies.
4. **Real-Time Analysis:** 
   - The **Variance Report** instantly shows a -$20 (red) variance for Jan Office Supplies.
   - The **Dashboard** adjusts the Net Profit chart, showing the income minus the new $120 expense.
5. **Result:** Niolla Nexa has a complete, real-time, closed-loop financial system without needing external software.
