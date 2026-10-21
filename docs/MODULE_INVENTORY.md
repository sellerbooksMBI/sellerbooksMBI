# SellerBooks Module Inventory (Phase 1)

## Architecture rule: one feature per folder

New feature extractions must live in their own directory under `js/modules/<feature-name>/`, with `index.js` as the browser entry point and feature-owned assets/tests nearby when practical. A fix inside one feature should not require editing another feature's implementation.

Example:
- `js/modules/packing/index.js`
- `js/modules/customer-service/index.js`
- `js/modules/analytics/index.js`
- `js/modules/receivables-language/index.js`
- `js/modules/file-import/index.js`
- `js/modules/report-profiler/index.js`

The current app still uses ordered classic scripts and shared globals. Keep each extracted entry as a classic script for now; do not switch individual entries to ES modules until the shared-global dependency contract is mapped. Folder separation improves ownership, but true runtime isolation requires later removing shared mutable globals and adding explicit interfaces.

## Current script-loading contract

The following scripts are loaded by `index.html`; their order is significant:
1. `js/modules/dialogs/index.js`
2. `js/modules/report-filters/index.js`
3. `js/modules/report-profiler/index.js` (diagnostic only)
4. `js/legacy-02.js` (report calculations, rendering, and snapshot logic)
5. `js/legacy-03.js` (deprecated inert compatibility file)
6. Spreadsheet vendor scripts (XLSX / ExcelJS)
7. `js/modules/file-import/index.js` (file picker / spreadsheet loaders)
8. Supabase browser CDN
9. `js/main.js` (cross-cutting persistence/core)
10. `js/modules/analytics/index.js`
11. `js/modules/receivables-language/index.js`
12. `js/legacy-07.js` and `js/legacy-08.js` (receivables UI and cloud sync)
13. `js/modules/customer-service/index.js` near its widget markup
14. `js/modules/packing/index.js` at the former packing script position

## Feature folder inventory

| `js/modules/dialogs/index.js` | Custom alert/confirm queue and bilingual dialog controls | Exposes `window.sellerBooksAlert` and `window.sellerBooksConfirm`; DOM markup and language helper remain shared | Medium |
| `js/modules/report-filters/index.js` | Report marketplace/store filters, filter summary, report initialization | Uses `sellerBooksStorage`, deferred-render helper, report functions and globals defined by report/core scripts; script order preserved | High |

| Module folder / entry | Responsibility | Dependencies / boundaries | Risk |
| --- | --- | --- | --- |
| `js/modules/report-profiler/index.js` | Optional report performance instrumentation; logs timing/counts only when explicitly activated | Exposes `window.sellerBooksReportProfiler`; does not change financial/report data | Low |
| `js/modules/file-import/index.js` | File picker helper and lazy XLSX / ExcelJS loaders | Preserves `window.sellerBooksOpenFilePicker`, `window.sellerBooksEnsureXLSX`, and `window.sellerBooksEnsureExcelJS`; loaded at the same position as the former helper script | Low/medium |
| `js/modules/packing/index.js` | Packing settings modal, preview, save action | Existing globals: `packingCosts`, `savePackingCosts()`, `formatRupiah()`, `sellerBooksAlert()`; no persistence logic moved | Low/medium |
| `js/modules/customer-service/index.js` | Customer-service floating button and modal interactions | Owns widget listeners; reads `sellerBooksCurrentLanguage()` or sessionStorage fallback; widget markup remains in `index.html` | Low |
| `js/modules/analytics/index.js` | Platform analytics visitor/session/device detection and RPC tracking | Uses Supabase client global; analytics errors are caught so they do not block app behavior | Medium |
| `js/modules/receivables-language/index.js` | Indonesian/English text map and receivables DOM localization | Exposes `window.sbPiutangText` and `window.sbPiutangApplyLanguage`; expects `sellerBooksCurrentLanguage()` and receivables DOM | Medium |
| `js/legacy-01.js` | Dialog/alert helpers and report initialization | Shared globals; legacy | High |
| `js/legacy-02.js` | Report filters, transaction cache, financial calculations, snapshots, report rendering | Shared sales data and accounting semantics; legacy | Very high |
| `js/main.js` | Supabase client, cloud state, storage compatibility, persistence, save queue, migration, import identity/merge | Cross-cutting shared state; legacy | Very high |
| `js/legacy-04.js` | Deprecated inert compatibility file; implementation moved to file-import folder | Keep inert to prevent duplicate globals | None |
| `js/legacy-05.js` | Deprecated inert compatibility file; implementation moved to analytics folder | Keep inert to prevent duplicate tracking | None |
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
