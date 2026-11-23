# Smart product finder

Status: implemented, unit tested (`smart-search.test.ts`, 60+ cases); **not browser-tested**.

## Search (`src/features/products/smart-search.ts`)

Runs server-side over the already-cached, validated catalogue (no extra Google Sheets request, no external service). A product is searchable by: name, SKU, brand, category, description, unit, and **specifications** (label and value).

Rules (each is tested):

1. The query is lower-cased and stripped of punctuation; extra spaces are ignored.
2. **Every** word must match (AND). Known multi-word phrases (e.g. "binding wire") stay together but do not make the other words optional.
3. A word matches at a **word boundary**: some word of the product must **start** with it ("cem" → cement, "12" → 12mm). Letters typed from the middle of a word never match, so **"cement" does not match "reinforcement"**.
4. A term containing a digit (≥3 chars) may match inside a word, so "550d" finds "Fe550D".
5. Short trade words that are in the dictionary ("int", "ent", "eet", "tin", "tmt", "ppc"…) match **whole words only** — "int" does not match "interior"/"paint".
6. Dictionary expansions match whole words only and are deliberately narrow.
7. The dictionary is a `Map`, so inputs such as `constructor` or `__proto__` cannot crash the page.
8. Ordering: exact SKU, exact name, name prefix, then field weights; a direct match outranks a synonym-only match.

## Synonyms (`src/features/products/synonyms.ts`)

A validated server-side dictionary (colloquial/Hinglish trade word → canonical terms), **not** a Google Sheets column, so existing CSV imports and the sheet template are untouched. Synonyms never change a product's name or specifications; they only widen what a typed word can find.

**To add one:** add a key → array entry (lower-case). Keep expansions _specific_: a synonym must be something a customer would accept as the same item. Avoid terms that belong to a neighbouring product (we removed `cement → bind`, which returned binding wire, and `putty → white cement`). Add a case to `smart-search.test.ts` showing the new word finds the right product and not its neighbour.

## Filters (URL-based, bookmarkable)

Category · Brand · **Unit** (options are the units actually present in the catalogue, canonical order; `TON` and `METRIC_TON` stay separate; all `CUSTOM` units share one "Other units" option while each product shows its own custom label) · Availability (existing four statuses only) · **Price** (all / rate listed / rate on request — a missing or zero price is never treated as a price) · price range (URL only) · sort. State lives in the URL; pagination is preserved. On phones the form opens in a drawer.

## Related products

Catalogue data only: same category, never the product itself, active products only (the public catalogue contains no inactive ones). Ranked by same brand first, then by shared specification values, then catalogue order (deterministic). Nothing is invented.

## Add to bulk enquiry

`Add to enquiry list` is available on listing/search results, product detail and related products (they share one card). The list stores product ids and quantities only; at submission the **server** re-reads name, brand, unit and price from the catalogue and rejects unknown/inactive ids. The browser never supplies authoritative product facts.

## Performance

Search runs in memory over the cached catalogue per request; there is no per-keystroke request (the form submits on demand), so no debounce is needed.
