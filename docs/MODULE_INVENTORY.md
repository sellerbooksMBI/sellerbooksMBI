# SellerBooks Module Inventory (Phase 1)

This inventory records observed boundaries and risks before any code extraction. It is not a claim that these modules have already been separated.

## Script loading contract
The current page uses ordered classic scripts and shared globals. Keep this order unchanged until dependencies are mapped:
1. `js/legacy-01.js`
2. `js/legacy-02.js`
3. `js/legacy-03.js`
4. spreadsheet vendor scripts (XLSX / ExcelJS)
5. `js/legacy-04.js`
6. Supabase browser CDN
7. `js/main.js`
8. `js/legacy-05.js` through `js/legacy-09.js`

**Risk:** `package.json` declares `"type": "module"`, but the HTML script chain appears to rely on classic-script globals. A future refactor must not blindly convert tags to `type="module"` or add imports without confirming how Vite currently builds/serves the page.

## Observed ownership candidates

| Candidate module | Current location | Observed responsibility | Extraction risk |
| --- | --- | --- | --- |
| Report profiling + import read cache | `js/legacy-02.js` (top section) | temporary profiler, `getSalesImportsData()`, flatten/cache via `getAllReportTransactions()` | Medium: shared data and invalidation behavior |
| Report date/time filters | `js/legacy-02.js` | WIB timezone helpers and report period filtering | Medium: affects all financial totals |
| Report UI/filter helpers | `js/legacy-01.js`, `js/legacy-02.js` | dialogs, marketplace/store filters, report initialization and rendering | High: cross-file DOM/global references |
| Financial calculations + daily snapshots | `js/legacy-02.js` and possibly `js/main.js` | profit/fee logic and snapshot-related logic | High: must preserve accounting behavior |
| Cloud state + conflict resolution | `js/main.js` (top section) | Supabase config/client, cloud state, dirty keys, conflict merge, save queue | Very high: data-loss and multi-client risks |
| Storage compatibility layer | `js/main.js` (top section) | localStorage-compatible wrapper, local migration, IndexedDB fast cache | High: many callers expect synchronous localStorage semantics |
| Packing UI/settings | `js/legacy-03.js` | packing modal and settings | Low/medium: check global callers first |
| Script loading helper | `js/legacy-04.js` | dynamic script loader | Low, after callers are checked |
| Device/analytics | `js/legacy-05.js` | browser/device detection and activity analytics | Medium: external calls/privacy/initialization order |
| Feature logic for other areas | `js/legacy-06.js` | not yet fully inventoried | Unknown: inspect before moving |
| Receivables UI/local state | `js/legacy-07.js` | piutang rendering and local behavior | Medium: shared storage and DOM |
| Receivables cloud sync | `js/legacy-08.js` | piutang cloud sync/realtime/polling | High: race conditions and cross-client state |
| Localization helpers | `js/legacy-09.js` | `updateLanguage()`, `hide()` | Medium: may be called by inline HTML and many features |

## Cloud/storage behavior observed in `js/main.js`
- Supabase client is created from `window.supabase.createClient(...)`.
- The cloud state is exposed through shared global variables.
- The storage wrapper intentionally keeps a localStorage-like synchronous API while writing changes to cloud state and queuing saves.
- Sales-import identity/merge code protects against duplicate rows and detects some delete/edit conflicts.
- IndexedDB is used as a fast-start cache, while Supabase is described in comments as the authoritative source.

**Do not move these functions as a first extraction.** First identify every storage wrapper caller, initialization boundary, realtime callback, and save-queue dependency.

## Report behavior observed in `js/legacy-02.js`
- A temporary profiler tracks storage read, JSON parsing, transaction flattening, filtering, financial calculations, rendering, and counts.
- `getSalesImportsData()` caches parsed import data based on the cloud-state source value.
- `getAllReportTransactions()` caches flattened transactions based on the import-array object identity.
- Date helpers explicitly enforce `Asia/Jakarta`/WIB semantics.

**Do not alter cache invalidation, date rules, transaction identity, or calculation formulas during structural extraction.**

## Recommended first code extraction
Start with a small, self-contained helper only after confirming all callers and whether any inline HTML invokes it. Keep the old global function as a compatibility wrapper if needed. Avoid starting with Supabase/storage, report financial calculations, or marketplace integrations.

## Validation gate before merging
- `npm run build` succeeds in the repository environment.
- Verify the built page actually resolves every CSS, JS, Supabase, and spreadsheet asset.
- Smoke test login, language, import, report, snapshots, marketplace pulling, and multi-client behavior.
- Review the diff for business-logic changes; pure extraction should not change formulas or persistence behavior.
- Merge only after review; keep `main` unchanged until then.


## Implemented extraction in phase 1
- New file: `js/modules/packing.js`.
- `index.html` now loads `js/modules/packing.js` directly at the same position where the old packing script was loaded. `js/legacy-03.js` is an inert deprecated file, preventing duplicate global declarations if a stale page still references it.
- The packing implementation remains a classic script and continues to use the existing global dependencies (`packingCosts`, `savePackingCosts()`, `formatRupiah()`, `sellerBooksAlert()`). This deliberately avoids converting the entire application to ES modules in one step.
- Build workflow added at `.github/workflows/build-check.yml` to run `npm install` and `npm run build` for this branch and pull requests to `main`.

## Verification status
- Source-level extraction and repository commits: complete.
- Automated Vite build: workflow started; do not consider passed until GitHub Actions reports success.
- Browser smoke tests: not yet run.
- Business behavior validation: not yet run. This extraction is intentionally limited to the packing feature.
