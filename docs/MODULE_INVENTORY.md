# SellerBooks Module Inventory (Phase 1)

## Architecture rule: one feature per folder

New feature extractions must live in their own directory under `js/modules/<feature-name>/`, with `index.js` as the browser entry point and feature-owned assets/tests nearby when practical. A fix inside one feature should not require editing another feature's implementation.

Example:
- `js/modules/packing/index.js`
- `js/modules/customer-service/index.js`
- `js/modules/receivables-language/index.js`

The current app still uses ordered classic scripts and shared globals. Keep each extracted entry as a classic script for now; do not switch individual entries to ES modules until the shared-global dependency contract is mapped. Folder separation improves ownership, but true runtime isolation requires later removing shared mutable globals and adding explicit interfaces.

## Current script-loading contract

The following are loaded in `index.html`; order is significant:
1. `js/legacy-01.js`
2. `js/legacy-02.js`
3. `js/legacy-03.js` (deprecated inert compatibility file)
4. Spreadsheet vendor scripts (XLSX / ExcelJS)
5. `js/legacy-04.js`
6. Supabase browser CDN
7. `js/main.js`
8. `js/legacy-05.js)
9. `js/modules/receivables-language/index.js)
10. `js/legacy-07.js) and `js/legacy-08.js`
11. `js/modules/customer-service/index.js` near the customer-service widget markup
12. `js/modules/packing/index.js` at the former packing script position

**Risk:** `package.json` declares `"type": "module"`, but this page relies on classic-script globals. Vite build success alone does not prove browser behavior is unchanged.

## Feature folder inventory

| `js/modules/dialogs/index.js` | Custom alert/confirm queue and bilingual dialog controls | Exposes `window.sellerBooksAlert` and `window.sellerBooksConfirm`; DOM markup and language helper remain shared | Medium |
| `js/modules/report-filters/index.js` | Report marketplace/store filters, filter summary, report initialization | Uses `sellerBooksStorage`, deferred-render helper, report functions and globals defined by report/core scripts; script order preserved | High |

| Module folder / entry | Responsibility | Dependencies / boundaries | Risk |
| --- | --- | --- | --- |
| `js/modules/packing/index.js` | Packing settings modal, preview, save action | Existing globals: `packingCosts`, `savePackingCosts()`, `formatRupiah()`, `sellerBooksAlert()`; no persistence logic moved | Low/medium |
| `js/modules/customer-service/index.js` | Customer-service floating button and modal interactions | Owns widget listeners; reads `sellerBooksCurrentLanguage()` or sessionStorage fallback; widget markup remains in `index.html` | Low |
| `js/modules/receivables-language/index.js` | Indonesian/English text map and receivables DOM localization | Exposes `window.sbPiutangText` and `window.sbPiutangApplyLanguage`; expects `sellerBooksCurrentLanguage()` and receivables DOM | Medium |
| `js/legacy-01.js` | Dialog/alert helpers and report initialization | Shared globals; legacy | High |
| `js/legacy-02.js` | Report filters, transaction cache, financial calculations, snapshots, report rendering | Shared sales data and accounting semantics; legacy | Very high |
| `js/main.js` | Supabase client, cloud state, storage compatibility, persistence, save queue, migration, import identity/merge | Cross-cutting shared state; legacy | Very high |
| `js/legacy-04.js` | Spreadsheet/file-picker loader helper | Vendor script loading and file picker integration | Low/medium |
| `js/legacy-05.js` | Device/browser analytics | External calls and initialization ordering | Medium |
| `js/legacy-07.js` | Receivables UI and local behavior | Shared storage and DOM | Medium |
| `js/legacy-08.js` | Receivables cloud sync, realtime and polling | Race conditions and cross-client state | High |
| `js/legacy-09.js` | Deprecated inert compatibility file; implementation moved to customer-service folder | Keep inert to avoid duplicate listeners on stale references | None |
| `js/legacy-06.js` | Deprecated only after script switch; implementation moved to receivables-language folder | Keep inert to avoid duplicate global API declarations | None |

## Data integrity guardrails

- Do not change transaction identity, deduplication, merge behavior, financial formulas, snapshots, or date/WIB rules during structural extraction.
- Do not move Supabase/storage code until every wrapper caller, initialization boundary, realtime callback, and save-queue dependency is mapped.
- Do not change the existing ID/EN language contract or its Supabase persistence as part of module organization.
- Keep old compatibility paths inert once the new folder entry is loaded, to prevent duplicate listeners or global declarations.

## Validation gate before merging

- GitHub Actions `npm run build` succeeds.
- Verify all JS/CSS/vendor assets resolve in the built page.
- Smoke test login, language switching, packing settings, customer-service popup, receivables, import, reports, snapshots, marketplace pulling, and multi-client behavior.
- Review the diff for business-logic changes; a pure extraction should not change formulas or persistence.
- Do not merge until browser smoke tests and business-behavior checks are complete.
