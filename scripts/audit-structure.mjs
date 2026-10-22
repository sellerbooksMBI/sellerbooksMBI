import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => failures.push(message);

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const index = read("index.html");

// Check local JS/CSS resources referenced by the production HTML. External URLs are ignored.
const localReferences = [];
for (const match of index.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
  const url = match[1];
  if (/^(?:https?:)?\/\//i.test(url) || /^(?:data:|javascript:|mailto:)/i.test(url)) continue;
  const clean = url.split(/[?#]/, 1)[0];
  if (!/\.(?:js|css)$/i.test(clean)) continue;
  localReferences.push(clean);
}
const duplicates = localReferences.filter((value, i) => localReferences.indexOf(value) !== i);
if (duplicates.length) fail(`Duplicate local asset references: ${[...new Set(duplicates)].join(", ")}`);
else pass(`No duplicate local JS/CSS references (${localReferences.length} found)`);

for (const url of localReferences) {
  const relative = url.replace(/^\/+/, "");
  if (!fs.existsSync(path.join(root, relative))) fail(`Missing local asset: ${url}`);
}
if (!failures.some((message) => message.startsWith("Missing local asset:"))) {
  pass("Every local JS/CSS reference in index.html resolves to a file");
}

// Ensure the path-only moves remain byte-for-byte identical to their rollback copies.
const movedPairs = [
  ["js/legacy-01.js", "js/modules/reports/report-filters-and-dialogs.js"],
  ["js/legacy-02.js", "js/modules/reports/report-engine-legacy.js"],
  ["js/legacy-03.js", "js/modules/sales/packing-settings.js"],
  ["js/legacy-04.js", "js/services/library-loader.js"],
  ["js/legacy-05.js", "js/modules/analytics/client-analytics.js"],
  ["js/legacy-06.js", "js/modules/receivables/piutang-language.js"],
  ["js/legacy-07.js", "js/modules/receivables/piutang-local.js"],
  ["js/legacy-08.js", "js/modules/receivables/piutang-cloud.js"],
  ["js/legacy-09.js", "js/modules/support/contact-modal.js"],
  ["css/legacy-02.css", "css/modules/reports/report-overrides.css"],
  ["css/legacy-03.css", "css/modules/reports/product-analysis.css"],
];
for (const [rollbackPath, movedPath] of movedPairs) {
  if (!fs.existsSync(path.join(root, rollbackPath)) || !fs.existsSync(path.join(root, movedPath))) {
    fail(`Missing moved/rollback pair: ${rollbackPath} -> ${movedPath}`);
    continue;
  }
  if (read(rollbackPath) !== read(movedPath)) fail(`Moved file differs from rollback copy: ${movedPath}`);
}
if (!failures.some((message) => message.startsWith("Moved file differs") || message.startsWith("Missing moved/rollback pair"))) {
  pass(`All ${movedPairs.length} moved assets match their rollback copies byte-for-byte`);
}

// The HTML should load the organized paths, not the legacy script paths.
const staleScriptRefs = [...index.matchAll(/(?:src)\s*=\s*["']\/?js\/legacy-0[1-9]\.js["']/gi)].map((m) => m[0]);
if (staleScriptRefs.length) fail(`index.html still references legacy script paths: ${staleScriptRefs.join(", ")}`);
else pass("index.html uses organized paths for legacy JS modules");

// A small, dependency-light helper extraction from the main engine.
const mainSource = read("js/main.js");
const costFormatters = read("js/modules/costs/cost-formatters.js");
for (const name of ["formatCostCurrency", "formatCostDate", "escapeCostHtml"]) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(costFormatters)) fail(`Missing cost formatter in its module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Cost formatter still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("cost formatter"))) pass("Cost formatting helpers are isolated from main.js");
const formatterScriptPosition = index.indexOf('src="/js/modules/costs/cost-formatters.js"');
const costManagementScriptPosition = index.indexOf('src="/js/modules/costs/cost-management.js"');
const notificationsScriptPosition = index.indexOf('src="/js/modules/notifications/notifications.js"');
const textDictionaryPosition = index.indexOf('src="/js/modules/i18n/text-dictionaries.js"');
const languageUiPosition = index.indexOf('src="/js/modules/i18n/language-ui.js"');
const businessLogoPosition = index.indexOf('src="/js/modules/settings/business-logo.js"');
const dataBackupPosition = index.indexOf('src="/js/modules/settings/data-backup.js"');
const settingsCorePosition = index.indexOf('src="/js/modules/settings/settings-core.js"');
const productAnalysisPosition = index.indexOf('src="/js/modules/reports/product-analysis.js"');
const dashboardAnalyticsPosition = index.indexOf('src="/js/modules/dashboard/dashboard-analytics.js"');
const marketplaceManagementPosition = index.indexOf('src="/js/modules/marketplaces/marketplace-management.js"');
const storeManagementPosition = index.indexOf('src="/js/modules/stores/store-management.js"');
const mainScriptPosition = index.indexOf('src="/js/main.js"');
if (formatterScriptPosition < 0 || costManagementScriptPosition < 0 || notificationsScriptPosition < 0 ||
    textDictionaryPosition < 0 || languageUiPosition < 0 || businessLogoPosition < 0 ||
    dataBackupPosition < 0 || settingsCorePosition < 0 || productAnalysisPosition < 0 ||
    dashboardAnalyticsPosition < 0 || marketplaceManagementPosition < 0 || storeManagementPosition < 0 || mainScriptPosition < 0 ||
    formatterScriptPosition > costManagementScriptPosition || costManagementScriptPosition > notificationsScriptPosition ||
    notificationsScriptPosition > textDictionaryPosition || textDictionaryPosition > languageUiPosition ||
    languageUiPosition > businessLogoPosition || businessLogoPosition > dataBackupPosition ||
    dataBackupPosition > settingsCorePosition || settingsCorePosition > productAnalysisPosition ||
    productAnalysisPosition > dashboardAnalyticsPosition || dashboardAnalyticsPosition > marketplaceManagementPosition ||
    marketplaceManagementPosition > storeManagementPosition || storeManagementPosition > mainScriptPosition) {
  fail("Organized feature modules must load in order before main.js");
} else pass("Organized feature modules load in order before main.js");

const costManagement = read("js/modules/costs/cost-management.js");
const costFunctions = [
  "saveCostData", "getCostMarketplaceName", "getCostStoreName",
  "isCostEditableToday", "isCostSnapshotLocked", "sellerBooksCostText",
  "sellerBooksCostCategoryLabel", "sellerBooksApplyCostLanguage", "renderCosts",
  "getCostMarketplacesData", "getCostStoresData", "loadCostMarketplaceOptions",
  "loadCostStoreOptions", "openCostModal", "closeCostModal", "saveCost", "editCost", "deleteCost"
];
for (const name of costFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(costManagement)) fail(`Missing Cost management function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Cost management function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Cost management function"))) pass("Cost management functions are isolated from main.js");
for (const stateName of ["costs", "editingCostId"]) {
  if (!new RegExp(`^(?:let|const|var)\\s+${stateName}\\b`, "m").test(mainSource)) fail(`Shared Cost state must remain in main.js: ${stateName}`);
}
if (!failures.some((message) => message.includes("Shared Cost state"))) pass("Shared Cost state remains in main.js for existing Dashboard dependencies");

const notificationModule = read("js/modules/notifications/notifications.js");
const notificationFunctions = [
  "toggleNotifications", "closeNotifications", "getLowStockProducts",
  "sellerBooksNotificationText", "sellerBooksApplyNotificationLanguage",
  "getSellerBooksNotifications", "renderNotifications"
];
for (const name of notificationFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(notificationModule)) fail(`Missing notification function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Notification function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Notification function"))) pass("Notification functions are isolated from main.js");

const textDictionaryModule = read("js/modules/i18n/text-dictionaries.js");
const textDictionaryFunctions = ["sellerBooksLoginText","sellerBooksStoreText","sellerBooksStoreCountText","sellerBooksMarketplaceText","sellerBooksMarketplaceCountText","sellerBooksDashboardText","sellerBooksDashboardPeriodText","sellerBooksReportsText","sellerBooksReportPeriodText","sellerBooksSettingsText","sellerBooksOwnerSetupText","sellerBooksDetailsText","sellerBooksProductText","sellerBooksProductCountText","sellerBooksSalesImportText","sellerBooksPullOrderIsEN","sellerBooksPullOrderText","sellerBooksResetIdentityText"];
for (const name of textDictionaryFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(textDictionaryModule)) fail(`Missing language text function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Language text function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Language text function"))) pass("Language text dictionaries are isolated from main.js");

const languageUiModule = read("js/modules/i18n/language-ui.js");
const languageUiFunctions = ["sellerBooksApplyLoginLanguage","sellerBooksApplyStoreLanguage","sellerBooksApplyMarketplaceLanguage","sellerBooksApplyDashboardLanguage","sellerBooksApplyReportsLanguage","sellerBooksApplySettingsLanguage","sellerBooksApplyOwnerSetupLanguage","sellerBooksApplyDateInputLanguage","sellerBooksApplyDetailsLanguage","sellerBooksApplyProductLanguage","sellerBooksApplySalesImportLanguage"];
for (const name of languageUiFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(languageUiModule)) fail(`Missing language UI function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Language UI function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Language UI function"))) pass("Language UI application functions are isolated from main.js");

const businessLogoModule = read("js/modules/settings/business-logo.js");
const businessLogoFunctions = ["renderSettingsLogo","applyBusinessLogoToInterface","handleSettingsLogoUpload","removeSettingsLogo"];
for (const name of businessLogoFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(businessLogoModule)) fail(`Missing business-logo function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Business-logo function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Business-logo function"))) pass("Business-logo functions are isolated from main.js");

const dataBackupModule = read("js/modules/settings/data-backup.js");
const dataBackupFunctions = ["backupSellerBooksData","restoreSellerBooksData"];
for (const name of dataBackupFunctions) {
  if (!new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(dataBackupModule)) fail(`Missing data backup function in module: ${name}`);
  if (new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Data backup function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Data backup function"))) pass("Backup/restore functions are isolated from main.js");

const settingsCoreModule = read("js/modules/settings/settings-core.js");
const settingsCoreFunctions = ["getSellerBooksSettings","saveSellerBooksSettings","loadSellerBooksSettings","roundSellerBooksValue","getSellerBooksCurrencyConfig","formatSellerBooksCurrency","applySellerBooksSettings"];
for (const name of settingsCoreFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(settingsCoreModule)) fail(`Missing settings-core function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Settings-core function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Settings-core function"))) pass("Settings core functions are isolated from main.js");

const productAnalysisModule = read("js/modules/reports/product-analysis.js");
const productAnalysisFunctions = ["getProductAnalysisDateRange","isTransactionInProductAnalysisPeriod","updateProductAnalysisDateUI","loadProductAnalysisMarketplaceFilter","loadProductAnalysisStoreFilter","onProductAnalysisMarketplaceChange","getProductAnalysisTransactions","calculateProductAnalysisRows","formatProductAnalysisCurrency","downloadProductAnalysisPDF","renderProductAnalysis","goToProductAnalysisPage","changeProductAnalysisPageSize","escapeHtmlProductAnalysis","updateProductAnalysisFilterInfo","applyProductAnalysisFilters","initializeProductAnalysis","fixProductFromAnalysis"];
for (const name of productAnalysisFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(productAnalysisModule)) fail(`Missing product analysis function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Product analysis function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Product analysis function"))) pass("Product analysis functions are isolated from main.js");

const dashboardAnalyticsModule = read("js/modules/dashboard/dashboard-analytics.js");
const dashboardAnalyticsFunctions = ["sellerBooksDashboardFormatShortRupiah","sellerBooksDashboardDateKey","sellerBooksRenderDashboardCharts","getDashboardTransactionsForPeriod","sellerBooksGetDashboardMasterArray","sellerBooksGetDashboardProductMap","sellerBooksGetDashboardStoresIndex","sellerBooksGetDashboardTransactionMarketplaceIndex","sellerBooksGetDashboardMarketplaceTransactions","sellerBooksGetDashboardMarketplaceCosts","renderMarketplacePerformance"];
for (const name of dashboardAnalyticsFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(dashboardAnalyticsModule)) fail(`Missing dashboard analytics function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Dashboard analytics function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Dashboard analytics function"))) pass("Dashboard analytics functions are isolated from main.js");

const marketplaceManagementModule = read("js/modules/marketplaces/marketplace-management.js");
const marketplaceManagementFunctions = ["saveMarketplaceData","getMarketplaceLogoHTML","renderMarketplaces","openMarketplaceModal","closeMarketplaceModal","saveMarketplace","editMarketplace","deleteMarketplace","toggleMarketplace"];
for (const name of marketplaceManagementFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(marketplaceManagementModule)) fail(`Missing marketplace management function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Marketplace management function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Marketplace management function"))) pass("Marketplace management functions are isolated from main.js");

const storeManagementModule = read("js/modules/stores/store-management.js");
const storeManagementFunctions = ["goToStores","saveStoreData","getActiveMarketplaces","renderStoreMarketplaceOptions","renderStoreMarketplaceFilter","toggleStoreMarketplaceFilter","selectStoreMarketplaceFilter","renderStores","openStoreModal","closeStoreModal","saveStore","editStore","toggleStore","deleteStore","renderMarketplaceStoreCounts","updateMarketplaceStoreCounts"];
for (const name of storeManagementFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(storeManagementModule)) fail(`Missing store management function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Store management function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Store management function"))) pass("Store management functions are isolated from main.js");


const dashboardViewPreferencesModule = read("js/modules/dashboard/view-preferences.js");
const dashboardViewPreferenceFunctions = ["sellerBooksDashboardPreferenceKey","sellerBooksReadDashboardPreferences","sellerBooksWriteDashboardPreferences","sellerBooksGetDashboardPreference","sellerBooksIndependentViewPreferenceKey","sellerBooksReadIndependentViewPreferences","sellerBooksWriteIndependentViewPreferences","sellerBooksGetIndependentViewPreference"];
for (const name of dashboardViewPreferenceFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(dashboardViewPreferencesModule)) fail(`Missing dashboard view preference function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Dashboard view preference function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Dashboard view preference function"))) pass("Dashboard view preference functions are isolated from main.js");


const dashboardPeriodControlsModule = read("js/modules/dashboard/period-controls.js");
const dashboardPeriodControlFunctions = ["getDashboardDateRange","updateDashboardCustomDateUI","changeDashboardCustomDateRange","confirmDashboardCustomDateRange","loadDashboardCustomDates","changeDashboardPeriod","isDateInPeriod","updateDashboardByPeriod","getSellerBooksDayKey","sellerBooksSyncDashboardFilterState","sellerBooksSetDashboardFilterState","prepareDailyViewState","sellerBooksCheckWibDayRollover","sellerBooksManualRefreshDashboard","refreshDashboard"];
for (const name of dashboardPeriodControlFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(dashboardPeriodControlsModule)) fail(`Missing dashboard period control function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Dashboard period control function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Dashboard period control function"))) pass("Dashboard period controls are isolated from main.js");


const deferredRenderModule = read("js/services/deferred-render.js");
if (!/function\s+sellerBooksScheduleDeferredRender\s*\(/.test(deferredRenderModule)) fail("Missing deferred-render helper: sellerBooksScheduleDeferredRender");
if (/function\s+sellerBooksScheduleDeferredRender\s*\(/.test(mainSource)) fail("Deferred-render helper still declared in main.js");
if (!failures.some((message) => message.includes("Deferred-render helper"))) pass("Deferred rendering helper is isolated from main.js");


const salesImportProgressModule = read("js/modules/sales/import-progress.js");
const salesImportProgressFunctions = ["sellerBooksImportProgressCopy","sellerBooksImportProgressShow","sellerBooksImportProgressUpdate","sellerBooksImportProgressHide","sellerBooksImportProgressFailure"];
for (const name of salesImportProgressFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(salesImportProgressModule)) fail(`Missing sales import progress function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Sales import progress function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Sales import progress function"))) pass("Sales import progress UI helpers are isolated from main.js");
const salesImportProgressPosition = index.indexOf('src="/js/modules/sales/import-progress.js"');
const salesImportProgressMainScriptPosition = index.indexOf('src="/js/main.js"');
if (salesImportProgressPosition < 0 || salesImportProgressMainScriptPosition < 0 || salesImportProgressPosition > salesImportProgressMainScriptPosition) fail("Sales import progress module must load before main.js");


const navigationViewModule = read("js/modules/navigation/view-router.js");
for (const name of ["showView","toggleSidebar"]) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(navigationViewModule)) fail(`Missing navigation function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Navigation function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Navigation function"))) pass("Navigation functions are isolated from main.js");
const navigationModulePosition = index.indexOf('src="/js/modules/navigation/view-router.js"');
const navigationMainScriptPosition = index.indexOf('src="/js/main.js"');
if (navigationModulePosition < 0 || navigationMainScriptPosition < 0 || navigationModulePosition > navigationMainScriptPosition) fail("Navigation module must load before main.js");


const productManagementModule = read("js/modules/products/product-management.js");
const productManagementFunctions = ["renderProducts","goToProductPage","changeProductPageSize","openProductModal","closeProductModal","saveProduct","editProduct","toggleProduct","getSelectedProductIds","updateSelectedProductUI","toggleSelectAllProducts","deleteSelectedProducts","deleteProduct"];
for (const name of productManagementFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(productManagementModule)) fail(`Missing product management function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Product management function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Product management function"))) pass("Product management functions are isolated from main.js");
const productManagementModulePosition = index.indexOf('src="/js/modules/products/product-management.js"');
const productManagementMainScriptPosition = index.indexOf('src="/js/main.js"');
if (productManagementModulePosition < 0 || productManagementMainScriptPosition < 0 || productManagementModulePosition > productManagementMainScriptPosition) fail("Product management module must load before main.js");


const approvalUiModule = read("js/modules/auth/approval-ui.js");
const approvalUiFunctions = ["sellerBooksShowOnly","sellerBooksAccessText","sellerBooksApplyApprovalLanguage","sellerBooksGetApprovalPage","sellerBooksShowApproval"];
for (const name of approvalUiFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(approvalUiModule)) fail(`Missing approval UI function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Approval UI function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Approval UI function"))) pass("Approval UI helpers are isolated from main.js");
const approvalUiModulePosition = index.indexOf('src="/js/modules/auth/approval-ui.js"');
const approvalUiMainScriptPosition = index.indexOf('src="/js/main.js"');
if (approvalUiModulePosition < 0 || approvalUiMainScriptPosition < 0 || approvalUiModulePosition > approvalUiMainScriptPosition) fail("Approval UI module must load before main.js");


const languageStateModule = read("js/modules/i18n/language-state.js");
const languageStateFunctions = ["sellerBooksLoadGlobalLanguage","sellerBooksSaveGlobalLanguage","sellerBooksNormalizeLanguage","sellerBooksGetLoginLanguagePreference","sellerBooksSetLoginLanguage","sellerBooksCurrentLanguage","sellerBooksLanguageName","sellerBooksApplyAllLanguage","sellerBooksSyncLanguageControl","sellerBooksSaveLanguage","sellerBooksEnsureDefaultLanguage"];
for (const name of languageStateFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(languageStateModule)) fail(`Missing language-state function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Language-state function still declared in main.js: ${name}`);
}
for (const name of ["SELLERBOOKS_LANGUAGE_KEY","SELLERBOOKS_DEFAULT_LANGUAGE","SELLERBOOKS_SESSION_LANGUAGE_KEY","SELLERBOOKS_LOGIN_LANGUAGE_KEY","SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY"]) {
  if (!new RegExp(`(?:const|let|var)\\s+${name}\\b`).test(languageStateModule)) fail(`Missing language-state constant: ${name}`);
  if (new RegExp(`(?:const|let|var)\\s+${name}\\b`).test(mainSource)) fail(`Language-state constant still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Language-state"))) pass("Language persistence state and functions are isolated from main.js");
const languageStateModulePosition = index.indexOf('src="/js/modules/i18n/language-state.js"');
const languageStateMainScriptPosition = index.indexOf('src="/js/main.js"');
if (languageStateModulePosition < 0 || languageStateMainScriptPosition < 0 || languageStateModulePosition > languageStateMainScriptPosition) fail("Language-state module must load before main.js");


const productExcelModule = read("js/modules/products/product-excel.js");
const productExcelFunctions = ["importProducts","parseExcelPrice","exportProducts","rowsForExportCount","sellerBooksDownloadExcelBlob"];
for (const name of productExcelFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(productExcelModule)) fail(`Missing product Excel function in module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Product Excel function still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("Product Excel function"))) pass("Product Excel import/export helpers are isolated from main.js");
const productExcelModulePosition = index.indexOf('src="/js/modules/products/product-excel.js"');
const productExcelMainScriptPosition = index.indexOf('src="/js/main.js"');
if (productExcelModulePosition < 0 || productExcelMainScriptPosition < 0 || productExcelModulePosition > productExcelMainScriptPosition) fail("Product Excel module must load before main.js");

if (failures.length) {
  console.error("\nSTRUCTURE AUDIT FAILED");
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log("\nSTRUCTURE AUDIT PASSED");
}
