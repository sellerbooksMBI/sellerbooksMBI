# SellerBooks source refactor map

Status: audit/mapping only. The legacy files remain the current runtime source until each extraction is verified. Do not remove or reorder script tags as part of a blind cleanup.

## Current inventory (main)

- `index.html`: 5,125 lines; contains the page markup and loads styles/scripts in a deliberate order.
- `css/legacy-01.css` ... `css/legacy-06.css`: six ordered CSS layers; legacy-01 is the main stylesheet (~50 KB), while later files appear to be supplemental/override layers. Preserve cascade order during migration.
- `js/legacy-01.js` ... `js/legacy-09.js`: nine ordered legacy scripts. These are not yet a clean domain-module layout.
- `js/main.js`: ~656 KB, the largest application engine; contains several unrelated feature areas and global functions/state.
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
