# SellerBooks source refactor map

Status: staged refactor. The deployed runtime remains the classic-script app in root `index.html`; moved modules are loaded directly by that page, and legacy source copies remain as rollback files. Do not remove or reorder script tags as part of a blind cleanup.

## Current inventory (main)

- `index.html`: 5,137 lines; contains the page markup and loads styles/scripts in a deliberate order.
- `css/legacy-01.css` ... `css/legacy-06.css`: six ordered CSS layers; legacy-01 is the main stylesheet (~50 KB), while later files appear to be supplemental/override layers. Preserve cascade order during migration.
- `js/legacy-01.js` ... `js/legacy-09.js`: retained rollback copies; `index.html` now loads the corresponding organized paths under `js/modules/` and `js/services/`.
- `js/main.js`: ~379 KB / 13,385 lines after extracting Cost management, Notifications, language text/UI helpers, settings/logo/backup functions, settings core, Product Analysis, Dashboard analytics, marketplace management, and store management; it remains the largest application engine with global functions/state.
- External browser libraries currently loaded by the page include SheetJS/XLSX, ExcelJS, and Supabase JS. Preserve availability and load order until imports are converted and verified.
- Existing `package.json` uses Vite, but the currently deployed HTML references root-relative `/css/... ` and `/js/...` assets. Any bundling change must account for GitHub Pages root deployment and APK/WebView usage.

## Current script/style load order

Styles: `legacy-01.css`, `legacy-02.css`, `legacy-03.css`, `legacy-04.css`, `legacy-05.css`, `legacy-06.css`.

Scripts: `legacy-01.js`, `legacy-02.js`, `legacy-03.js`, external XLSX, external ExcelJS, `legacy-04.js`, external Supabase JS, `main.js`, `legacy-05.js`, `legacy-06.js`, `legacy-07.js`, `legacy-08.js`, `legacy-09.js`.

Important: scripts are currently classic scripts, not ES modules. Inline HTML event handlers call globally available functions. A direct conversion to `type="module"` would change global scope and may break UI events. Keep classic-script compatibility during staged extraction or explicitly expose required functions on `window`.

## Mapping from current large application engine

The following is the first-pass domain map from named section markers/functions in `js/main.js`. Line numbers are approximate and will move as code changes.

| Current region / symbols | Destination module (target) | Dependency / safety notes |
|---|---|---|
| Supabase auth, cloud state, conflict-safe save/load, identity | `js/modules/core/auth.js`, `js/services/supabase-client.js`, `js/services/cloud-state.js` | Highest risk. Preserve per-user isolation, dirty-key merge, conflict detection, and login/redirect behavior. |
| Navigation, pageData, showView, sidebar, browser/mobile back | `js/modules/core/navigation.js` | Keep global entry points used by inline handlers and browser history. |
| Marketplace list/render/save/edit/delete | `js/modules/marketplaces/marketplace-ui.js`, `js/services/marketplace-store.js` | Do not conflate marketplace configuration with connected store accounts. |
| Store accounts, OAuth callbacks, connection status, Shopee/Lazada/Blibli/TikTok sync | `js/modules/stores/store-management.js`, `js/modules/integrations/{shopee,lazada,blibli,tiktok}.js` | Keep OAuth state, per-user account mapping, and API sync isolated. Do not change API/import responsibilities during refactor. |
| Master products, product pagination, product import/export, exchange rates, currency formatting | `js/modules/products/master-products.js`, `js/modules/products/product-import-export.js` | Preserve SKU matching and price source rules. Check shared formatting helpers before moving. |
| Sales import engine, marketplace fingerprints/packing, SKU/QTY preview, column confirmation, duplicate merge, stock decrement | `js/modules/sales/sales-import.js`, `js/modules/sales/marketplace-rules.js`, `js/modules/sales/import-preview.js` | Critical business logic. Manual import remains the dedupe/calculation engine. Do not alter identity keys or marketplace-specific parsing while relocating. |
| Sales import caches, report transaction flattening, report helpers, daily snapshots and timezone logic (also in `legacy-02.js`) | `js/modules/reports/report-data.js`, `js/modules/snapshots/daily-snapshots.js` | Keep Asia/Jakarta day boundaries and immutable past snapshots. Check duplicate definitions across files. |
| Dashboard period/filter, dashboard master-data cache, charts and marketplace performance | `js/modules/dashboard/dashboard.js` | Preserve period semantics and cache invalidation. |
| Product analysis / profit per SKU and report filters | `js/modules/reports/product-analysis.js`, `js/modules/reports/report-filters.js` | Must not change existing formulas or report dropdown behavior. |
| Notifications and low-stock checks | `js/modules/notifications/notifications.js` | Depends on products, identity, imports and translations. |
| Other costs CRUD, formatting, marketplace/store selectors | `js/modules/costs/other-costs.js` | Keep links to store/marketplace IDs and localization. |
| Language, owner identity, settings and display preferences | `js/modules/settings/language.js`, `js/modules/settings/preferences.js` | ID/EN only; account language remains persisted in Supabase, not localStorage as source of truth. |
| CSS | `css/base.css`, `css/layout.css`, `css/components/*.css`, `css/pages/*.css` | First map selectors and duplicate/override rules; preserve current six-file cascade before consolidating. |
| HTML | `index.html` plus optional reusable templates only where safe | Keep IDs/data attributes used by JS. Avoid a redesign or changing login markup while refactoring. |

## Legacy file mapping (function inventory pass)

| Current file | Confirmed role | Suggested target |
|---|---|---|
| `js/legacy-01.js` | Custom dialog queue + report marketplace/store filters and report initialization (12 named functions) | `js/modules/ui/dialogs.js`, `js/modules/reports/report-filters.js` (split only after checking shared dialog dependencies) |
| `js/legacy-02.js` | Report transaction data, caches, date helpers, report rendering/deletion, fees/costs, daily snapshots (65 named functions) | `js/modules/reports/*`, `js/modules/snapshots/daily-snapshots.js`, `js/services/report-data.js` |
| `js/legacy-03.js` | Packing material modal/settings: `openPackingModal`, `closePackingModal`, `updatePackingPreview`, `savePackingSettings` | `js/modules/sales/packing-settings.js` |
| `js/legacy-04.js` | Dynamic library loader/fallback (`loadScript`) for Excel libraries | `js/services/library-loader.js` |
| `js/legacy-05.js` | Client/device/browser/referrer/session analytics and tracking | `js/modules/analytics/client-analytics.js` |
| `js/legacy-06.js` | Large ID/EN translation map and language-driven UI text updates (no named function declarations found; likely executes as a script) | `js/modules/settings/translations.js` with a small compatibility entry point |
| `js/legacy-07.js` | Piutang/receivables local storage, totals, rendering, payment form helpers, dashboard refresh | `js/modules/receivables/receivables-ui.js` |
| `js/legacy-08.js` | Piutang cloud data, local migration, Supabase/realtime polling and refresh | `js/modules/receivables/receivables-cloud.js`, `js/services/realtime.js` |
| `js/legacy-09.js` | Contact/help modal language updates (`updateLanguage`) | `js/modules/ui/contact-modal.js` or merge into translations after checking selector ownership |
| `js/main.js` | Main engine (~21,685 lines; 318 named function declarations; broad global state) | Extract by domain table above, not as one file |

This pass confirms the roles from function names and section markers, not full runtime behavior. Some files contain many top-level variables created inside callbacks, so simple variable counts are not counts of true global declarations. A scope-aware parser pass is still required before code movement.

## CSS inventory (first pass)

- `css/legacy-01.css` (~50 KB / 4,524 lines): primary stylesheet with login, marketplace, and broad app styling.
- `css/legacy-02.css` (~7 KB / 270 lines), `legacy-03.css` (~2.8 KB / 162 lines), `legacy-04.css` (~8.4 KB / 373 lines), `legacy-05.css` (~4.9 KB / 94 lines), and `legacy-06.css` (~2.7 KB / 18 lines): supplemental layers and/or late overrides. Exact selector ownership and duplicate rules still need a selector inventory. Keep the current order until that inventory is complete.

## Findings that affect the refactor

1. The HTML uses classic `<script>` tags and inline event attributes (for example, `onclick="loginGoogle()"` and `onchange="sellerBooksSetLoginLanguage(this.value)"`). Module conversion must preserve public global function names or add explicit `window` compatibility wrappers.
2. The script order is not arbitrary: report scripts run before the main engine; Supabase JS is loaded before `main.js`; additional feature scripts run afterward. Avoid `async` or parallel script loading until dependency edges are mapped.
3. `main.js` and `legacy-02.js` both contain report/snapshot-related logic. Audit duplicate declarations and call sites before extracting shared code to prevent double initialization or shadowing.
4. The receivables feature spans two files: UI/local logic in `legacy-07.js` and cloud/realtime logic in `legacy-08.js`. Keep migration and ownership behavior explicit when separating them.
5. The existing repository contains Vite scripts, but the current production page still loads static root-relative assets. Avoid mixing a build-system migration with the first domain extraction; keep each change reviewable.

## Recommended extraction order

1. Freeze a known-good commit and preserve the original legacy files.
2. Finish dependency inventory: globals, duplicate function names, event-handler references, script ordering, external library usage, CSS selector ownership.
3. Extract low-risk isolated helpers first (library loader, report filters only after dependencies are known).
4. Extract domain modules behind compatibility wrappers so existing inline handlers keep working.
5. Extract high-risk sales import, cloud synchronization, marketplace OAuth and snapshots last, one domain at a time.
6. After each extraction: syntax/build checks, compare function/global inventories, search for missing IDs/functions, then run focused automated checks. Do not declare release-ready until the full app is tested.

## Guardrails

- No redesign and no change to business calculations during structural refactoring.
- Keep SellerBooks project/config separate from Core Adiimasa and from other client projects.
- Do not copy secrets into source files. Public/publishable Supabase values may be client-visible, but privileged keys must never be in the frontend.
- Keep manual Excel import as the dedupe engine; marketplace API sync should not silently become a second import engine.
- Maintain ID/EN language consistency and account-scoped cloud data.
- The user plans to do full manual acceptance testing only after the refactor is declared ready. Until then, keep the work in audit/refactor stages and clearly distinguish verified checks from user acceptance testing.

## Static reference scan (2026-10-21)

- HTML contains 276 literal `id=` attributes. JavaScript contains 259 unique literal `getElementById("...")` references.
- A simple static comparison flagged 14 IDs absent from literal HTML: `sellerbooksApprovalPage`, `sellerbooksApprovalEmail`, `sellerbooksApprovalText`, `sellerbooks-blibli-modal`, `sellerbooks-blibli-modal-style`, `sellerbooks-blibli-help`, and eight `sellerBooksImportProgress...` elements. This is **not yet a confirmed defect**: some may be created/injected by JavaScript or an integration module. Verify creation paths before treating any as missing.
- Duplicate named function declarations were found for `sellerBooksReadDailySnapshots` (twice within `legacy-02.js`) and `loadScript` (in both `legacy-02.js` and `legacy-04.js`). The `loadScript` implementations have different signatures: legacy-02 accepts a callback, while legacy-04 returns a Promise. Because classic scripts share global scope and load order, this is a priority dependency to map before moving either implementation.
- The HTML has 75 unique function-like names extracted from inline event attributes. Some apparent misses from a naive regex may be object methods, inline expressions, or runtime-generated functions; verify before changing global exposure.
- No application JavaScript was moved or edited during this audit pass. Changes so far are documentation/mapping commits only.

## Current status / next audit tasks

Completed: inventory of HTML/CSS/JS files; script/style load order; first-pass domain mapping for the large engine; role mapping for all nine legacy scripts; initial static ID/function reference scan; documented refactor guardrails.

Completed after initial mapping: inspected both `loadScript` implementations and confirmed the legacy-02 callback loader is nested inside the PDF loader, so it does not collide with the legacy-04 Promise loader; removed the shadowed uncached snapshot-reader declaration after confirming the cache-aware implementation was already effective; confirmed the 14 flagged IDs are dynamically created/referenced; and extracted packing settings plus the library loader while preserving their script positions. Remaining audit work: expand scope-aware function/global dependency mapping for `main.js`, inspect CSS selector ownership/overrides, and continue only with low-risk classic-script extractions before any high-risk domain migration.

## Follow-up checks on initial scan

- All 14 IDs flagged by the HTML-vs-JavaScript scan are present as string literals in JavaScript. The approval UI, Blibli help/modal, and import-progress overlay appear to be created dynamically. They are not confirmed missing DOM elements; keep them in the dynamic-DOM map.
- `sellerBooksReadDailySnapshots` is declared twice at top level in `legacy-02.js`. The second declaration is the cache-enhanced version and overwrites the first in classic-script scope. The first implementation appears redundant, but removal is deferred until the function and cache write/invalidation call sites are verified.
- A lightweight CSS selector scan covered approximately 499 selector strings and flagged cross-file duplicates for `#reports .content-section` (legacy-01/02) and `.product-analysis-filter-grid` (legacy-01/03). This scanner is approximate because nested at-rules, grouped selectors, and comments can distort parsing; these are review targets, not instructions to delete rules.


## First code extraction (2026-10-22)

- Extracted the packing-cost modal script into `js/modules/sales/packing-settings.js` and updated the single HTML script reference to load the new file at the same position in the original script sequence.
- The extracted file remains a **classic script**, so `openPackingModal`, `closePackingModal`, `updatePackingPreview`, and `savePackingSettings` continue to be global functions for inline handlers. No module/bundler conversion was introduced.
- The old `js/legacy-03.js` file is intentionally retained as an unreferenced rollback copy for this stage; it is not loaded by `index.html`.
- Logic and calculations were copied verbatim; this is a path/ownership extraction only. Static verification checks are required before considering it ready for user acceptance testing.


## Snapshot duplicate cleanup (2026-10-22)

- Removed the first, uncached top-level declaration of `sellerBooksReadDailySnapshots` from `js/legacy-02.js`. The later cache-aware declaration has the same name and, as a top-level classic-script function declaration in the same scope, was the effective implementation already.
- The retained implementation still reads the same storage key and synchronizes its read cache in `sellerBooksWriteDailySnapshots`. This cleanup does not change snapshot schema, formulas, day boundaries, or write behavior.
- Static call-site inventory found seven calls to `sellerBooksReadDailySnapshots` and four call sites to `sellerBooksWriteDailySnapshots` (including the declaration). No separate consumer relies on the overwritten implementation.


## Library loader extraction (2026-10-22)

- Moved the existing classic-script loader entry from `js/legacy-04.js` to `js/services/library-loader.js` and updated its HTML reference in place, preserving the original execution order.
- The script still defines the same `window.sellerBooksOpenFilePicker`, `window.sellerBooksEnsureXLSX`, and `window.sellerBooksEnsureExcelJS` functions. Its internal Promise-based fallback loader remains inside the same IIFE.
- The legacy file is retained as an unreferenced rollback copy. This is a file-ownership/path extraction only; library URLs, fallbacks, and alert messages were not changed.


## Analytics script extraction (2026-10-22)

- Moved the client analytics/tracking script entry to `js/modules/analytics/client-analytics.js` and changed its HTML reference in place, preserving the script's original execution order.
- The file remains a classic script and its contents are copied verbatim. The original `js/legacy-05.js` remains as an unreferenced rollback copy for this stage.
- No analytics payload, event naming, storage behavior, or tracking conditions were intentionally changed.


## Receivables language helper extraction (2026-10-22)

- Moved the `sbPiutangText` language helper script to `js/modules/receivables/piutang-language.js`, preserving its exact contents and the script's original position in `index.html`.
- Kept it as a classic script so its `window.sbPiutangText` API remains available to later receivables scripts. The legacy source is retained as an unreferenced rollback copy.


## Receivables local module extraction (2026-10-22)

- Moved the local receivables storage/rendering script to `js/modules/receivables/piutang-local.js` and changed the HTML reference in place, preserving order before the cloud/realtime receivables script.
- Source is copied verbatim and remains a classic script. Local storage keys, migration behavior, calculations, rendering, and global API were not intentionally changed; the old file remains as a rollback copy.


## Receivables cloud module extraction (2026-10-22)

- Moved the receivables Supabase/cloud synchronization and realtime script to `js/modules/receivables/piutang-cloud.js`, preserving its original script position after the local receivables module.
- The script contents are copied verbatim and remain classic JavaScript. Supabase calls, realtime subscriptions, polling, migration, and data shape are not intentionally changed. The legacy file remains as a rollback copy.


## Contact modal script extraction (2026-10-22)

- Moved the contact/help modal behavior to `js/modules/support/contact-modal.js`. Updated only the `src` attribute while preserving the script element ID and its location at the end of `index.html`.
- The file is copied verbatim as a classic script. Modal open/close behavior and language text are not intentionally changed; `js/legacy-09.js` remains as a rollback copy.


## Report filters and dialog helpers extraction (2026-10-22)

- Moved the existing report filters/dialog helper script to `js/modules/reports/report-filters-and-dialogs.js`; its HTML reference stays at the same point before the second report script and CSS layer order is untouched.
- The classic script contents are copied verbatim, including the DOMContentLoaded initialization for reports. This is a path/ownership change only; the legacy file is retained as a rollback copy.


## Report engine file organization (2026-10-22)

- Moved the large report/snapshot script to `js/modules/reports/report-engine-legacy.js`, keeping its exact location in the classic script execution sequence after the report filter/dialog helper.
- Contents are copied verbatim from the current `js/legacy-02.js`, including profiler and report update handlers. This step does not redesign the report engine or change formulas; the old file is retained as a rollback copy. Further internal decomposition remains a separate, higher-risk task.


## CSS cascade audit (2026-10-22)

- CSS files are loaded in a fixed order from `legacy-01.css` through `legacy-06.css`. Keep that order until the cascade is deliberately consolidated and visually tested.
- Confirmed override: `css/legacy-01.css` has a mobile `#reports .content-section { overflow:hidden; }` rule around line 4485. `css/legacy-02.css` later applies `overflow: visible !important` to the same selector around line 21. This is an actual cascade override, not enough evidence to delete either rule; the later rule may intentionally keep report contents/filters visible.
- `.product-analysis-filter-grid` has base layout rules in `css/legacy-03.css`, responsive rules near the end of `css/legacy-01.css`, and another responsive override in `css/legacy-03.css`. The overlap is breakpoint-specific and must be compared at each viewport before consolidation.
- No CSS rules were changed in this pass because deleting/merging the overlapping selectors without runtime screenshots could change mobile report layout.

## Main engine domain map (first pass)

The current `js/main.js` is about 654 KB / 21,639 lines after the first internal extraction. A fresh scan counted 314 top-level `function`/`async function` declarations and found no duplicate names among those declarations. Extraction needs dependency boundaries rather than moving arbitrary line ranges.

| Approx. lines | Domain block | Refactor caution |
|---|---|---|
| 1–1,450 | Supabase auth/cloud state, cache, realtime and account guards | High risk: shared session/config globals |
| 1,450–3,290 | Navigation, product analysis and page/sidebar state | High risk: inline handlers and shared DOM |
| 3,290–5,620 | Marketplace registry, marketplace UI and store account state | High risk: OAuth and integration state |
| 5,620–8,740 | Store integration, OAuth callbacks, status and rendering | High risk: callbacks from external marketplace flows |
| 8,740–10,320 | Packing, master product data, product CRUD | Medium/high risk: shared product state |
| 10,320–11,710 | Product import/export and import progress UI | High risk: file inputs and generated DOM IDs |
| 11,710–16,210 | Sales import engine, marketplace parsing/rules, deduplication, stock and preview | Very high risk: core business rules; do not move or rewrite until isolated tests exist |
| 16,210–17,570 | App initialization, logout, identity reset and dashboard preferences | High risk: session and lifecycle order |
| 17,570–18,000 | Notifications and low-stock checks | Medium risk: shared dashboard/product state |
| 18,000–end | Other costs, daily snapshots and additional report helpers | High risk: snapshot immutability and financial totals |

These ranges are approximate section boundaries from comments, not safe cut-and-paste boundaries. The next substantive refactor should first identify exact top-level declarations, references, and state dependencies for one low-risk domain. No business engine was extracted or rewritten in this pass.


## Report CSS organization (2026-10-22)

- Moved `css/legacy-02.css` to `css/modules/reports/report-overrides.css` and `css/legacy-03.css` to `css/modules/reports/product-analysis.css` with their contents copied verbatim.
- Updated only the two stylesheet paths in `index.html`. Their relative cascade order remains unchanged: the general legacy layer loads first, then report overrides, then product analysis styles. Old CSS files remain unreferenced rollback copies.
- Other CSS files remain in their existing order pending a fuller selector ownership audit; no rules were merged or deleted.


## Automated structure guard (2026-10-22)

- Added `scripts/audit-structure.mjs` and the `npm run audit:structure` command.
- The audit checks that local JS/CSS references in `index.html` are unique and resolve to files, that the nine relocated JS files and two relocated CSS files remain byte-for-byte identical to their rollback copies, and that `index.html` no longer points at `js/legacy-01.js` through `js/legacy-09.js`.
- The report engine currently has one declaration of `sellerBooksReadDailySnapshots` (around line 286); the other occurrences in that file are call sites, not duplicate declarations. Do not rewrite its cache behavior without tracing invalidation paths.
- The `loadScript(src, done)` occurrence around line 3543 is nested inside the PDF-library loader's Promise callback; it is not the global Promise-based library loader in `js/services/library-loader.js`. Keep them separate unless a later scope audit proves a safe unification.
- The structure audit is a static guard only. It does not replace a production Vite build, browser/WebView checks, marketplace OAuth tests, or financial/import regression tests.


## Cost formatting helper extraction (2026-10-22)

- Extracted only `formatCostCurrency(value)` and `formatCostDate(dateString)` from `js/main.js` into `js/modules/costs/cost-formatters.js`.
- Loaded the new classic script immediately before `main.js`. This keeps the helpers available as global functions when the main engine and inline UI handlers execute; the functions themselves have no top-level side effects.
- The currency helper still delegates to the existing `formatRupiah(value)` implementation. Currency conversion, rounding, date formatting, cost calculations, and snapshot rules were not rewritten.
- The structure audit now asserts that these two functions exist in the new file and are no longer declared in `main.js`.
- This is the first internal extraction from the main engine. Continue with similarly small, dependency-light helpers before attempting any data, snapshot, import, or marketplace logic.


## Cost module extraction (2026-10-22, continued)

- Moved the full Cost management function group (18 functions and its DOMContentLoaded initializer; about 25.5 KB) to `js/modules/costs/cost-management.js`.
- Kept the shared state declarations `costs` and `editingCostId` in `main.js` because Dashboard/cache refresh code and Cost handlers share them.
- Loaded `cost-formatters.js` and `cost-management.js` before `main.js`. This preserves classic-script global functions, inline `onclick` handlers, Dashboard references to `renderCosts`, and language-switch calls to `sellerBooksApplyCostLanguage`.
- No Cost formulas, IDR conversion, date lock, snapshot logic, data keys, or storage writes were rewritten; function bodies were relocated as-is.
- The static structure audit now checks that the Cost management functions exist in their module, are absent from `main.js`, and that both Cost modules load before `main.js`.
- CI now runs the Vite build as well as the static structure audit. A successful build is not a substitute for browser/WebView and financial/import regression tests.


## Notifications module extraction (2026-10-22, continued)

- Moved the seven notification functions and their two DOM event listeners from `js/main.js` into `js/modules/notifications/notifications.js`.
- No notification state was moved: the functions continue to read the existing SellerBooks storage, products, language, and sales-import state at call time.
- The module is loaded before `main.js`, preserving availability for navigation, language switching, notification button handlers, and the DOMContentLoaded renderer.
- The extraction preserves the original function bodies and existing behavior; no stock threshold, notification text, or import status rule was changed.
- The automated structure audit checks all seven functions, verifies they no longer remain in `main.js`, and enforces module load order.


## Language text dictionary extraction (2026-10-22, continued)

- Moved 11 dictionary/label lookup functions (Login, Stores, Marketplaces, Dashboard, Reports, Settings, and owner setup) into `js/modules/i18n/text-dictionaries.js`.
- These functions retain the existing `sellerBooksCurrentLanguage()` lookup and return the same Indonesian/English dictionary values. No account-language persistence, Supabase sync, language-selection logic, or DOM application code was changed.
- The new module loads before `main.js` so the classic-script global functions remain available when the existing UI and language application code invokes them.
- The automated audit now verifies that all 11 text functions exist in the module, are absent from `main.js`, and that the module is loaded before `main.js`.


## Language UI extraction (2026-10-22, continued)

- Moved eight DOM-only language application functions into `js/modules/i18n/language-ui.js`: Login, Stores, Marketplaces, Dashboard, Reports, Settings, owner setup, and date-input labels.
- The central language orchestrator, language selection/save flow, account persistence, Supabase synchronization, and global language state remain in `main.js`.
- The UI module loads after the translation dictionaries and before `main.js`, preserving classic-script global function compatibility.
- No labels, translations, DOM selectors, or language persistence logic were intentionally changed; this was a relocation of existing function bodies.
- The CI audit now verifies these eight functions are in the UI module and absent from `main.js`.


## Business logo settings extraction (2026-10-22, continued)

- Moved `renderSettingsLogo`, `applyBusinessLogoToInterface`, `handleSettingsLogoUpload`, and `removeSettingsLogo` into `js/modules/settings/business-logo.js`.
- The module is loaded after the language modules and before `main.js`. The four functions remain classic-script globals for existing settings initialization and inline file-input handlers.
- Logo persistence, upload conversion, removal behavior, UI selectors, and error messages were not rewritten.
- CI checks the four functions' module ownership, validates active JavaScript syntax, and runs the Vite build.


## Settings backup/restore extraction (2026-10-22, continued)

- Moved `backupSellerBooksData()` and `restoreSellerBooksData(input)` to `js/modules/settings/data-backup.js`.
- The module is loaded before `main.js` so the existing inline Settings buttons continue to find these global functions.
- The backup JSON shape, storage iteration, restore confirmation, file reading, and alerts were moved unchanged. No backup keys or restore semantics were modified.
- The automated audit checks both function declarations and their removal from `main.js`.


## Settings core extraction (2026-10-22, continued)

- Moved seven settings functions into `js/modules/settings/settings-core.js`: read/save/load settings, rounding, currency configuration, currency formatting, and applying settings to the interface.
- The functions retain their existing global names and are loaded before `main.js`, so existing dashboard formatters, settings navigation, and startup callbacks can still call them.
- Shared state, storage adapter, language persistence, currency formula, exchange-rate values, and UI labels were not rewritten.
- The automated structure audit verifies the seven function declarations are in the new module and absent from `main.js`.


## Product Analysis extraction (2026-10-22, continued)

- Moved 18 Product Analysis functions to `js/modules/reports/product-analysis.js`, covering period filtering, marketplace/store filters, transaction selection, row calculations, rendering, pagination, PDF download, and product-analysis filter UI.
- The functions were relocated without rewriting their bodies. Existing report-date helpers, daily snapshot reads, products/transactions state, and shared UI functions remain in their original owners.
- `productAnalysisPage`, `productAnalysisPageSize`, and `productAnalysisPaginationFilterKey` remain in `main.js` as shared state.
- The module is loaded before `main.js`; the audit verifies all 18 function declarations are in the new module and absent from the main engine.
- Because this feature includes financial analysis, the move must still be followed by targeted browser regression checks of date periods, marketplace/store filters, row totals, and PDF output before declaring the refactor fully finished.


## Rincian language helper cleanup (2026-10-22, continued)

- Moved `sellerBooksDetailsText()` into `js/modules/i18n/text-dictionaries.js` and `sellerBooksApplyDetailsLanguage()` into `js/modules/i18n/language-ui.js`.
- Product Analysis continues to call the same global `sellerBooksDetailsText("downloadPdf")` function. The dictionary content and DOM language application logic were relocated unchanged.
- CI now checks these functions under their corresponding language modules.


## Product and sales-import language extraction (2026-10-22, continued)

- Moved the product text dictionary, product count label, sales-import dictionary, Pull Order language text/check, and reset-identity dictionary into `js/modules/i18n/text-dictionaries.js`.
- Moved the product and sales-import DOM language appliers into `js/modules/i18n/language-ui.js`.
- This only relocates language lookup and DOM text functions. Product CRUD, stock calculations, Excel parsing, import deduplication, and marketplace API request logic remain in `main.js` and were not changed by this extraction.
- CI checks the additional language functions in their new module owners.


## Dashboard analytics extraction (2026-10-22, continued)

- Moved 11 Dashboard analytics functions into `js/modules/dashboard/dashboard-analytics.js`, including period transaction selection, lookup/cache helpers, chart rendering, marketplace-cost aggregation, and marketplace performance rendering.
- The existing Dashboard cache variables remain in `main.js`; the moved functions continue to access the same shared state and helper functions.
- Function bodies were relocated unchanged. No net-profit formula, cost aggregation, transaction date rule, currency formatter, or snapshot calculation was rewritten.
- The module is loaded before `main.js` and the CI audit verifies all 11 functions are in the new module and absent from the main engine.
- Because this area displays financial results, targeted browser regression tests are still required before calling the entire refactor finished.


## Marketplace management extraction (2026-10-22, continued)

- Moved nine marketplace management functions to `js/modules/marketplaces/marketplace-management.js`: data save, logo rendering, marketplace list rendering, modal open/close, create/edit/delete, and enable/disable.
- Shared `marketplaces` and `editingMarketplaceId` state remain in `main.js`; integration/OAuth request workers and store connection state were not moved or rewritten.
- Function bodies were relocated unchanged. No marketplace API request, OAuth callback, connection status, or deduplication logic was modified.
- The structure audit checks all nine function declarations and ensures the module loads before `main.js`.


## Store management extraction (2026-10-22, continued)

- Moved 16 store-management functions to `js/modules/stores/store-management.js`: store navigation, data persistence, marketplace selectors/filters, store rendering and CRUD, and marketplace/store counts.
- Shared store arrays, selected marketplace state, editing state, and integration connection/realtime state remain in `main.js`.
- Store OAuth/integration workers and API request logic remain in `main.js` and were not rewritten. Packing-cost calculation helpers also remain in the main engine.
- Function bodies were relocated unchanged; the structure audit checks module ownership and load order.


## Dashboard view preference extraction (2026-10-22, continued)

- Moved eight Dashboard and independent-view preference helpers into `js/modules/dashboard/view-preferences.js`.
- The local cache state remains module-owned; the active dashboard filter state, daily rollover orchestration, date-period controls, and dashboard rendering remain in `main.js`.
- The helpers keep their existing keys, per-user localStorage behavior, legacy cloud-state fallback, and cache semantics. Their bodies were relocated unchanged.
- The new classic script is loaded immediately before `main.js`; no function is invoked during module loading. The main engine still performs the existing initialization at its original point.
- CI checks all eight functions' ownership and verifies they are absent from `main.js`.


## Dashboard period controls extraction (2026-10-22, continued)

- Moved eight Dashboard date-range and period-control functions into `js/modules/dashboard/period-controls.js`.
- Kept the shared `dashboardCustomDateConfirmed` state, period selection state, dashboard refresh lifecycle, day-rollover handling, and initialization callback in `main.js`.
- The moved function bodies are unchanged. Date validation, WIB date helpers, period matching, alerts, local preference writes, and dashboard refresh calls retain the same dependencies and behavior.
- The new classic script is loaded before `main.js`; the functions are declarations only and are not executed at module load.
- CI verifies the eight function declarations are in the new module and absent from `main.js`.


## Deferred rendering helper extraction (2026-10-22, continued)

- Moved the render coalescing token and `sellerBooksScheduleDeferredRender(callback)` into `js/services/deferred-render.js`.
- The cancellation token, zero-delay scheduling, exception handling, and console message are unchanged.
- The classic script loads before `main.js`, so Dashboard and other handlers can continue to call the same global function.
- CI verifies that the helper lives in the service file and is absent from `main.js`.


## Sales import progress UI extraction (2026-10-22, continued)

- Moved five progress-overlay UI functions into `js/modules/sales/import-progress.js`: copy/text selection, show, update, hide, and failure display.
- The existing global progress flags, delete start/finish flow, cloud persistence/verification steps, Excel import engine, before-unload protection, and progress calls remain semantically unchanged; only the UI helper definitions and before-unload listener were relocated.
- The module loads before `main.js` so both the existing product-deletion workflow and Excel import workflow continue to resolve the same global function names.
- CI checks module ownership and load order. No import parsing, deduplication, stock, HPP, or profit calculations were changed.


## Navigation and mobile sidebar extraction (2026-10-22, continued)

- Moved `showView()`, `toggleSidebar()`, and the existing mobile outside-click sidebar listener into `js/modules/navigation/view-router.js`.
- Navigation history, page title/subtitle behavior, responsive sidebar closing, deferred render dispatch, language application, and existing view refresh calls were moved unchanged.
- Shared page metadata and application state remain in `main.js`. The module is loaded before `main.js`; its listener only registers at load and runs on later user interaction.
- CI checks both function declarations and the module's load order. No data calculations or marketplace API flows were changed.


## Product management extraction (2026-10-22, continued)

- Moved 13 product-management functions into `js/modules/products/product-management.js`: table rendering, pagination, product modal, save/edit/enable-disable, multi-select, and deletion workflows.
- The 13 function bodies were relocated unchanged. Product state, product persistence helpers, packing-cost helpers, shared formatters, import-progress flags, and notification functions remain in their current owners.
- The module is loaded before `main.js`; it contains declarations only, so existing global handlers and product actions resolve dependencies after the main engine has initialized.
- Product save/delete/stock behavior was not rewritten. CI checks all function names and load order; browser regression testing is still needed for product CRUD and deletion confirmation/progress.


## Dashboard lifecycle extraction (2026-10-22, continued)

- Moved seven Dashboard lifecycle helpers into the existing `js/modules/dashboard/period-controls.js`: Indonesia day key, shared filter-state sync/set, daily view reset, WIB day-rollover handler, manual cloud refresh, and Dashboard refresh.
- The actual state declarations, initial synchronization call, rollover interval registration, and custom-date confirmation state remain in `main.js` at their original execution points.
- The moved functions are unchanged. Cloud refresh reads, cache refresh, period selection, daily reset, and cross-view reset behavior were not redesigned.
- CI now checks the additional function declarations in the Dashboard module and confirms they no longer remain in `main.js`.


## Authentication approval UI extraction (2026-10-22, continued)

- Moved five access/approval presentation helpers into `js/modules/auth/approval-ui.js`: view visibility, localized approval text, approval-language application, approval page selection, and approval display.
- The authentication session, profile reads, approval decision logic, and login/logout flows remain in `main.js`; only the existing UI helper declarations were relocated unchanged.
- The module loads before `main.js` and is declaration-only at load time, so the existing auth callbacks can call it after shared state is initialized.
- CI verifies function ownership and load order. No account approval policy or auth data access was modified.


## Language state and persistence extraction (2026-10-22, continued)

- Moved the central language state, five language storage/session constants, and 11 language state/persistence functions into `js/modules/i18n/language-state.js`.
- Login-language override locking, local/session handoff keys, Supabase language reads/writes, fallback behavior, and the global language application orchestrator were relocated unchanged.
- The final startup listener and SellerBooks settings constants remain in `main.js`; the new module loads before `main.js` so early auth/cloud callbacks still resolve language-state symbols.
- This is a relocation only; it does not change the ID/EN language policy or the existing Supabase persistence behavior. CI checks function ownership, constant ownership, and script order.


## Product Excel import/export extraction (2026-10-22, continued)

- Moved the existing product Excel import/export operations into `js/modules/products/product-excel.js`, including the nested price parser, product export, export row counting, and Excel blob download.
- The original `parseExcelPrice()` declaration remains nested inside `importProducts()`, preserving its original scope; the Sales Import engine state begins immediately after the extracted block and remains in `main.js`.
- The code was relocated unchanged. No order deduplication, stock reduction/restoration, HPP, profit, transaction snapshots, or marketplace API logic was modified.
- CI verifies module ownership and load order. Browser regression testing is still needed for product Excel import/export.


## Sales import config and parser extraction (2026-10-22, continued)

- Moved the Sales Import working-state variable, SKU/QTY keyword lists, marketplace column rules, and seven parser helpers into `js/modules/sales/import-parsers.js`.
- The parser bodies and marketplace alias rules are unchanged. Master Product lookup caches, stock reduction/restoration, import fingerprinting, deduplication, preview confirmation, transaction persistence, and marketplace API request workers remain in their existing modules/locations.
- The module loads before `main.js`, so the same classic-script global names are initialized before the Sales Import engine uses them.
- CI verifies all seven parser functions, four config/state declarations, and script order. Browser regression checks are still needed with representative Excel files from each marketplace.


## Master Product lookup cache extraction (2026-10-22, continued)

- Moved the four existing Master Product lookup-cache state variables and three lookup/cache functions into `js/services/master-product-cache.js`.
- The same raw/runtime cache sources, map-building behavior, and SKU lookup logic are preserved unchanged. Stock reduction/restoration and Sales Import transaction processing remain in `main.js`.
- The module initializes only cache variables and declarations before `main.js`; the same global function names remain available to the import and report code.
- CI checks function/state ownership and load order.


## Sales transaction processing extraction (2026-10-22, continued)

- Moved 11 existing Sales Import processing functions into `js/modules/sales/transaction-processing.js`: stock deduction/restoration, sales amount/date helpers, clean sales rows, packing calculations, import fingerprinting, and transaction persistence.
- The function bodies are unchanged. No SKU matching rules, deduplication criteria, stock formulas, transaction totals, packing costs, HPP, profit, or snapshot semantics were edited.
- The module is declaration-only at load time and is loaded before `main.js`, preserving the existing global names used by the import preview and report code.
- CI verifies function ownership and load order. This area remains a high-priority target for manual regression checks with imported marketplace files and deleted/re-imported transactions.


## Sales Import workflow extraction (2026-10-22, continued)

- Moved 12 existing Sales Import workflow functions into `js/modules/sales/import-workflow.js`: header/column analysis, file analysis, preview rendering, import continuation, column confirmation, duplicate checking, and preview closing.
- Function bodies and current UI/event callback logic were relocated unchanged. Existing import state, marketplace column configuration, stock adjustment, transaction persistence, and marketplace API workers remain in their current owners.
- No deduplication criteria, transaction totals, stock/HPP/profit formulas, or API request behavior was intentionally changed.
- CI checks function ownership and script order. Because this module contains the import preview and duplicate-check flow, browser regression tests with representative marketplace Excel files are still required before final sign-off.


## Store integration state extraction (2026-10-22)

- Moved the store-integration connection cache/state and its existing lifecycle helpers into `js/modules/marketplaces/store-integration-state.js`.
- The moved block is copied verbatim; it includes the connection-state maps, refresh/status polling, marketplace ID normalization, OAuth connection-state updates, realtime handlers, and retry helper.
- API order-pull functions, OAuth callback parsing, and marketplace request payloads remain in `main.js`; no API semantics or multi-client behavior was intentionally changed.
- The module is loaded immediately before `main.js`, after the other domain modules. The functions continue to use the existing global classic-script environment.
- CI checks all moved function/state declarations and verifies script order. Live OAuth/realtime behavior still needs runtime regression testing.


## Sidebar owner UI extraction (2026-10-22)

- Moved the presentation-only `updateSidebarOwner()` helper into `js/modules/navigation/sidebar-owner.js`.
- The function body is unchanged. It still displays the owner name from the active SellerBooks profile and the signed-in user's email/avatar; authentication state and profile-loading logic remain in `main.js`.
- The classic script is loaded before `main.js`; CI verifies function ownership and load order.


## Currency formatting extraction (2026-10-22)

- Moved the existing `getSellerBooksExchangeRates()` and `formatRupiah(value)` functions into `js/modules/settings/currency-formatting.js`.
- Function bodies are unchanged. The existing exchange-rate defaults, rounding order, IDR base-currency assumption, currency locales, and display formatting are preserved exactly.
- The module is loaded before `main.js`; it continues to read the existing settings through `getSellerBooksSettings()`. No sales, HPP, profit, import, or snapshot formulas were changed.
- CI checks function ownership and script order. Financial display still warrants manual verification for IDR/USD/SGD/MYR and each rounding setting.
