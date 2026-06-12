# Proposal assets

## Default Word template

Proposals use **`Project proposal sample template.docx`** in this folder by default (prepared from the repo-root sample with `{{PLACEHOLDER}}` tags).

To refresh after editing the source file at the repo root:

```bash
cd backend
npm run seed:proposal-template
```

Uploading a custom `.docx` in **Create Proposal → Upload Template** overrides this default.

## Company logo (cover page)

To show your company logo on the proposal PDF cover page:

1. **File name:** `proposal-logo.png` (or `proposal-logo.jpg`)
2. **Location:** Place the file in this folder:  
   `backend/assets/proposal-logo.png`

Supported formats: PNG or JPG.  
Recommended size: about 200–400 px wide so it scales clearly on the cover.

If the file is missing, the cover page will show "NIOLLA" text instead of the logo.

## Greeting card design templates

Sample SVG templates for **birthday**, **project anniversary**, and **festival** cards live in `assets/greeting-cards/`:

| File | Placeholders |
|------|----------------|
| `birthday-card-template.svg` | `{{name}}` |
| `anniversary-card-template.svg` | `{{name}}`, `{{project}}` |
| `festival-card-template.svg` | `{{name}}`, `{{festival}}` |

Download them from **Dashboard → Card design templates → Download sample**, edit in Figma/Illustrator/Canva, then **Upload yours**.

Uploading a custom template in the dashboard overrides the auto-generated NIOLLA card for that campaign type.
