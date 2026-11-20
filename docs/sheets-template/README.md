# Spreadsheet template

Import each CSV into a tab of ONE Google Spreadsheet, **tab name = file name without `.csv`**
(`Products`, `Categories`, `Brands`, `BusinessSettings`, and optionally `PriceHistory`).
File → Import → _Replace current sheet_ (or _Insert new sheet_). The files contain headers only —
no sample business data. See `../GOOGLE_SHEETS_SETUP.md` for column rules.

`src/features/catalogue/template.test.ts` fails if these headers drift from the code.
