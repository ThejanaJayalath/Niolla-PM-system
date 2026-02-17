# How to Build the Proposal Word Template (Placeholders)

Follow this **exactly** so the system can replace placeholders without errors.

---

## 1. Placeholder syntax (copy these exactly)

Use **double curly braces** and **UPPERCASE with underscore**. No spaces inside the braces.

| Placeholder | Replaced with |
|-------------|----------------|
| `{{PROJECT_NAME}}` | Project name or customer name |
| `{{DATE}}` | Proposal date (e.g. 15 February 2026) |
| `{{INTRODUCTION}}` | Project description |
| `{{KEY_FEATURES}}` | Required features (bullet list) |
| `{{ADVANCE_PAYMENT}}` | Advance payment (e.g. LKR 5,000.00) |
| `{{PROJECT_COST}}` | Project cost (e.g. LKR 15,000.00) |
| `{{TOTAL_COST}}` | Total amount (e.g. LKR 20,000.00) |
| `{{DELIVERABLE_SECTION}}` | Milestones / deliverables list |

---

## 2. How to type each placeholder in Word (critical)

Word often splits text into multiple “runs”. If a placeholder is split, it **will not be replaced**. Do this for **every** placeholder:

### Method A – Type in one go (recommended)

1. Click where you want the placeholder (e.g. after “Project: ”).
2. **Type the whole placeholder in one go**, without clicking elsewhere or changing font:
   - Type: `{{PROJECT_NAME}}`
   - Do **not** type `{{` then click, then `PROJECT_NAME`, then `}}`.
3. Do not bold/italic only part of it. If you want it styled, select the **entire** placeholder and then apply style.

### Method B – Paste from Notepad (safest)

1. Open **Notepad**.
2. Type or paste the placeholder, e.g. `{{PROJECT_NAME}}`.
3. Copy it (Ctrl+A, Ctrl+C).
4. In Word, paste (Ctrl+V) where you want it.
5. Pasted text is usually one run, so it works.

### Do NOT

- Copy from a browser or PDF (can add hidden characters).
- Change font or size in the **middle** of a placeholder.
- Add a space inside the braces, e.g. `{{ PROJECT_NAME }}`.
- Use single braces, e.g. `{PROJECT_NAME}` — we use `{{` and `}}`.

---

## 3. Multiple pages, headers, and footers

**Multiple pages are fine.** The system processes the whole document (all pages). You can use as many pages as you want.

- **Body text** on any page: placeholders work. Use the same rules (type in one go or paste from Notepad).
- **Headers and footers** (e.g. "Project: {{PROJECT_NAME}}" on every page): placeholders work there too. Word often splits text in headers/footers, so **use the Notepad method** for any placeholder in a header or footer:
  1. Type the placeholder in Notepad (e.g. `{{PROJECT_NAME}}`).
  2. Copy, then paste into the header or footer in Word.

So a multi-page template is supported; just make sure every placeholder is a single run (Notepad paste is safest, especially in headers/footers).

---

## 4. Example layout in your template

You can structure your document like this (use your own design; only the placeholder **text** must match):

```
PROJECT PROPOSAL

Project: {{PROJECT_NAME}}
Date: {{DATE}}

INTRODUCTION
{{INTRODUCTION}}

KEY FEATURES
{{KEY_FEATURES}}

FINANCIALS
Advance Payment: {{ADVANCE_PAYMENT}}
Project Cost: {{PROJECT_COST}}
Total Cost: {{TOTAL_COST}}

DELIVERABLES
{{DELIVERABLE_SECTION}}
```

---

## 5. After building the template

1. Save as **.docx** (Word document).
2. In the app, go to **Create Proposal** → **Upload Template** and upload this file.
3. Create a proposal and download it. The placeholders should be replaced with real data.

If a placeholder is not replaced, it was likely split by Word. Re-type that placeholder in Notepad, copy, and paste into Word again in place of the old one.
