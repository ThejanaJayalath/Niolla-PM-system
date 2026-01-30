🎨 UI/UX DESIGN PROMPT (PHASE 1 ONLY)

You can copy-paste this as-is into any UI/UX design AI or give it to a designer.

🔹 UI/UX DESIGN PROMPT

Design a modern, professional, and scalable web-based internal dashboard for a small software company called Niolla Customer Solution.

The system is a Phase 1 Lead & Sample Proposal Management System.

The UI must be:

Clean, minimal, and professional

Business-focused (not flashy)

Easy to extend for future phases (projects, payments, users)

Responsive (desktop-first, tablet-friendly)

Use a left sidebar navigation layout with a top header bar.

Color style:

Neutral background (light gray / off-white)

Primary color: deep blue or indigo

Accent color: soft green or orange for status indicators

Typography:

Clean sans-serif (Inter / Roboto / SF Pro style)

Clear hierarchy for headings, labels, and body text

🧭 NAVIGATION STRUCTURE (VERY IMPORTANT)
🔹 Sidebar (Left Navigation – Collapsible)

Tabs (in this exact order):

Dashboard

Inquiries

Reminders

Proposals

Settings (future-ready)

👉 Icons only when collapsed, icon + label when expanded.

🔹 Top Header Bar

Right side:

🔔 Notifications icon (Phase 1: upcoming reminders count)

👤 User avatar + name

Dropdown:

Profile (disabled / future)

Sign Out

📌 Sign Out button must always be here, not in sidebar.

🖥️ SCREEN-BY-SCREEN UI/UX DESIGN (PHASE 1)
1️⃣ Dashboard Screen
Purpose

Quick overview for admins when they log in.

Layout

Top: Page title → Dashboard

Grid layout with cards

Cards

🧾 Total Inquiries

📞 New Inquiries

⏰ Upcoming Reminders

📄 Proposals Created

Below Cards

Upcoming Reminders Table

Inquiry name

Reminder title

Date & time

Action: “View”

📌 No heavy charts in Phase 1 (keep it clean).

2️⃣ Inquiries Screen (MOST IMPORTANT)
Header Area

Title: Inquiries

Right side buttons:

➕ New Inquiry

Filter dropdown (Status)

Inquiry List (Table)

Columns:

Customer Name

Phone Number

Short Description

Status (colored badge)

Created Date

Actions

Row Actions (icon buttons):

👁 View

✏️ Edit

🗑 Delete

🔴 Duplicate Phone UX (CRITICAL)

When creating/editing:

If duplicate detected:

Show yellow warning banner

Text:

“This phone number already exists. Please verify before proceeding.”

(No blocking, just warning – professional behavior)

➕ New Inquiry Modal / Page

Form Fields (exact order):

Customer Name (required)

Phone Number (required)

Project Description (textarea)

Required Features (tag input – add/remove)

Internal Notes (optional textarea)

Buttons (bottom right):

Save Inquiry (primary)

Cancel (text button)

3️⃣ Inquiry Detail Page

This is a multi-tab page (important for scalability).

Top Section

Customer Name

Phone Number

Status dropdown (New, Contacted, Proposal Sent, etc.)

Tabs inside Inquiry Detail
🔹 Tab 1: Overview

Project description

Feature list (chips)

Internal notes

Created date

🔹 Tab 2: Reminders

List of reminders (timeline style)

Button:

➕ Add Reminder

Reminder form:

Type (Reminder / Meeting)

Title

Date & Time

Notes

Buttons:

Save

Cancel

🔹 Tab 3: Proposal

Button:

➕ Create Sample Proposal

or View Proposal (if exists)

📌 Proposal is always linked to inquiry.

4️⃣ Proposals Screen
Proposal List Table

Columns:

Customer Name

Total Amount

Created Date

Valid Until

Actions

Actions:

👁 View

📄 Download PDF

5️⃣ Proposal Detail Page
Sections (Vertical Layout)
🔹 Auto-filled Section (Read-only)

Customer Name

Project Description

Required Features

🔹 Pricing Section

Total Amount

Valid Until

🔹 Milestones Section

Table:

Title

Amount

Description

Due Date

➕ Add Milestone

Bottom Action Bar (Sticky)

Buttons (right aligned):

Save Proposal

Download PDF

Cancel

6️⃣ Reminders Screen
List View

Date & time

Inquiry name

Reminder title

Type badge (Meeting / Reminder)

Status (Pending / Completed)

Actions:

Mark as completed

View inquiry

🎯 UX PRINCIPLES (DO NOT SKIP)

All primary actions on the right

Destructive actions (Delete) need confirmation

Status always shown with color badges

Forms should show inline validation

Empty states must explain what to do next

Example empty state:

“No inquiries yet. Click ‘New Inquiry’ to add your first customer.”

🧱 FUTURE-READY DESIGN DECISIONS (VERY IMPORTANT)

Sidebar has space for:

Projects

Payments

Users

Inquiry detail page already uses tabs → easy extension

Proposal system expandable to “Final Proposal”

Dashboard cards can grow

You are not redesigning later, only extending.