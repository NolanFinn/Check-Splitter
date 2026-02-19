# Check Splitter (MVP)

A lightweight single-page app for splitting a restaurant check.

## Features
- Add check items with quantity, description, and total price.
- Friendly item validation:
  - name required
  - quantity required (defaults to 1)
  - price required and non-negative
- Mobile-friendly numeric entry (`inputmode` on numeric/currency fields).
- Auto-calculated subtotal, tax %, and grand total.
- Add people (defaults to `Me`) and choose payer.
- Assign people to each item with equal split.
- Proportional tax/tip/fees allocation among participants who have at least one item.
- Simple settlement output: each person owes the payer directly.
- Per-person detailed breakdown.
- Collapsible sections (accordion style) with next-section navigation.
- State persisted in browser localStorage.

## Run
Open `index.html` directly, or serve with:

```bash
python3 -m http.server 4173
```
