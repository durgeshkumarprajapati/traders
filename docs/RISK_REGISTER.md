# Risk Register (Phase 0)

| ID  | Risk                                                                     | Likelihood | Impact   | Mitigation                                                                                                |
| --- | ------------------------------------------------------------------------ | ---------- | -------- | --------------------------------------------------------------------------------------------------------- |
| R1  | Unverified demo claims/contacts/GST published                            | High       | High     | Content gate: all business facts from BusinessSettings; remove banners; pre-release grep for demo strings |
| R2  | Admin demo credentials/UI leaked into prod                               | Med        | Critical | Remove from login design; provision admin manually; no default passwords                                  |
| R3  | Stale/false price shown as live                                          | Med        | High     | Cache policy, "Last updated", hide on outage, rename "Live" board                                         |
| R4  | Component sheets missing → fidelity drift                                | High       | Med      | Request export; derive from page markup; visual review gate                                               |
| R5  | Off-palette colours/dark surfaces spread                                 | High       | Med      | Token-only Tailwind, lint rule for arbitrary colours, status map                                          |
| R6  | Foundation tokens wrong (radius naming)                                  | Certain    | Med      | Rebuild tokens in Phase 1 first task                                                                      |
| R7  | Google Sheets quota/latency, concurrent edits, manual edits corrupt data | Med        | High     | Cache, header validation, stable IDs, reject malformed rows, backups                                      |
| R8  | Sheets lacks fields UI needs (SKU, stock qty)                            | High       | Low      | Drop from UI or add columns by decision                                                                   |
| R9  | Duplicate / spam enquiries                                               | Med        | Med      | Idempotency key, rate limit, honeypot                                                                     |
| R10 | Email failure loses lead                                                 | Med        | High     | Save first, outbox + retry, admin visibility                                                              |
| R11 | Admin routes protected only by proxy                                     | Med        | Critical | Per-action authorization + RLS                                                                            |
| R12 | `cacheComponents` pitfalls (dynamic access without Suspense)             | Med        | Med      | Follow docs in `node_modules/next/dist/docs`; build checks                                                |
| R13 | Admin not responsive in design                                           | High       | Med      | Design mobile admin pattern (drawer) for approval                                                         |
| R14 | PII (IP, phone) storage/privacy                                          | Med        | Med      | Don't store IP; privacy notice; RLS                                                                       |
| R15 | Vercel Hobby commercial-use restriction                                  | Med        | Med      | Use Pro for production                                                                                    |
| R16 | Stitch images are temporary hosted URLs                                  | Certain    | Med      | Replace with Cloudinary assets; supply real photos                                                        |
| R17 | Build env: Tailwind auto-scan of project root                            | Low        | Low      | Scoped `@source` to `src/` (done)                                                                         |
