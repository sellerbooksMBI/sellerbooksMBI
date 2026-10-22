/* =====================================================
   SELLERBOOKS LANGUAGE UI APPLICATION
   DOM-only language application functions, kept as global
   classic-script functions for existing callers and inline UI.
===================================================== */

function sellerBooksApplyLoginLanguage(){
    const root = document.getElementById("loginPage");
    if(!root) return;

    const setText = function(id,key){
        const el=document.getElementById(id);
        if(el) el.textContent=sellerBooksLoginText(key);
    };

    const language = sellerBooksCurrentLanguage();
    const select=document.getElementById("loginLanguage");
    if(select) select.value=language;

    setText("loginLanguageLabel","language");
    setText("loginHeroTitle","heroTitle");
    setText("loginHeroDescription","heroDescription");
    setText("loginFeatureMarketplace","marketplace");
    setText("loginFeatureStores","stores");
    setText("loginFeatureProfit","profit");
    setText("loginBrandFooter","footer");
    setText("loginTitle","title");
    setText("loginDescription","description");
    setText("loginGoogleText","google");
    setText("loginSecurityTitle","securityTitle");
    setText("loginSecurityDescription","securityDescription");

    document.documentElement.lang = language === "en" ? "en" : "id-ID";
}


function sellerBooksApplyStoreLanguage(){
    const view = document.getElementById("stores");
    if(!view) return;

    const headerTitle = view.querySelector(".page-header h2");
    const headerSubtitle = view.querySelector(".page-header p");
    if(headerTitle) headerTitle.textContent = sellerBooksStoreText("pageTitle");
    if(headerSubtitle) headerSubtitle.textContent = sellerBooksStoreText("pageSubtitle");

    const addButton = view.querySelector('button[onclick="openStoreModal()"]');
    if(addButton) addButton.textContent = "+ " + sellerBooksStoreText("add");

    const count = document.getElementById("storeCount");
    if(count && typeof stores !== "undefined"){
        count.textContent = sellerBooksStoreCountText(
            document.querySelectorAll("#storesGrid .store-card").length || stores.length
        );
    }

    const modal = document.getElementById("storeModal");
    if(modal){
        const title = document.getElementById("storeModalTitle");
        if(title){
            title.textContent = editingStoreId
                ? sellerBooksStoreText("editTitle")
                : sellerBooksStoreText("addTitle");
        }

        const labels = modal.querySelectorAll(".form-group label");
        const labelKeys = [
            "marketplaceLabel","nameLabel","codeLabel","feeLabel","descriptionLabel","statusLabel"
        ];
        labelKeys.forEach(function(key,index){
            if(labels[index]){
                const optional = index === 2 || index === 4
                    ? ' <span style="color:#94a3b8;">(' + sellerBooksStoreText("optional") + ')</span>'
                    : "";
                labels[index].innerHTML = sellerBooksStoreText(key) + optional;
            }
        });

        const marketplaceSelect = document.getElementById("storeMarketplace");
        if(marketplaceSelect){
            const first = marketplaceSelect.querySelector('option[value=""]');
            if(first) first.textContent = sellerBooksStoreText("chooseMarketplace");
        }

        const nameInput = document.getElementById("storeName");
        if(nameInput) nameInput.placeholder = sellerBooksStoreText("namePlaceholder");

        const codeInput = document.getElementById("storeCode");
        if(codeInput) codeInput.placeholder = sellerBooksStoreText("codePlaceholder");

        const feeInput = document.getElementById("storeFeePercent");
        if(feeInput) feeInput.placeholder = sellerBooksStoreText("feePlaceholder");

        const feeHelp = modal.querySelector(".form-group small");
        if(feeHelp) feeHelp.textContent = sellerBooksStoreText("feeHelp");
        const descriptionInput = document.getElementById("storeDescription");
        if(descriptionInput) descriptionInput.placeholder = sellerBooksStoreText("descriptionPlaceholder");

        const statusSelect = document.getElementById("storeStatus");
        if(statusSelect){
            const active = statusSelect.querySelector('option[value="active"]');
            const inactive = statusSelect.querySelector('option[value="inactive"]');
            if(active) active.textContent = sellerBooksStoreText("active");
            if(inactive) inactive.textContent = sellerBooksStoreText("inactive");
        }

        const footerButtons = modal.querySelectorAll(".modal-footer button");
        if(footerButtons[0]) footerButtons[0].textContent = sellerBooksStoreText("cancel");
        if(footerButtons[1]) footerButtons[1].textContent = sellerBooksStoreText("save");

        const closeButton = modal.querySelector(".modal-close");
        if(closeButton) closeButton.setAttribute("aria-label", sellerBooksStoreText("cancel"));
    }

    /* Translate the persistent SellerBooks sidebar together with the active Store Accounts page. */
    const sidebarLanguage = sellerBooksCurrentLanguage();
    const sidebarTitles = sidebarLanguage === "en"
        ? ["Main Menu","Business Data","Analysis","System"]
        : ["Menu Utama","Data Bisnis","Analisis","Sistem"];
    document.querySelectorAll(".sidebar-menu .menu-title").forEach(function(el,index){
        if(sidebarTitles[index]) el.textContent = sidebarTitles[index];
    });

    const sidebarMenuTexts = sidebarLanguage === "en"
        ? ["Dashboard","Marketplace","Store Accounts","Master Products","Sales Import","Other Costs","Receivables","Details","Reports","Settings"]
        : ["Dashboard","Marketplace","Akun Toko","Master Produk","Import Penjualan","Biaya Lain","Piutang","Rincian","Laporan","Pengaturan"];
    document.querySelectorAll(".sidebar-menu .menu-item").forEach(function(button,index){
        const icon = button.querySelector(".menu-icon");
        if(!icon || !sidebarMenuTexts[index]) return;
        Array.from(button.childNodes).filter(function(node){
            return node.nodeType === 3 && String(node.textContent || "").trim();
        }).forEach(function(node){
            node.textContent = " " + sidebarMenuTexts[index] + " ";
        });
    });

    const resetIdentity = document.querySelector(".reset-identity-button span");
    if(resetIdentity) resetIdentity.textContent = sidebarLanguage === "en" ? "Reset Identity" : "Reset Identitas";
    const logout = document.querySelector(".logout-button span");
    if(logout) logout.textContent = sidebarLanguage === "en" ? "Logout" : "Keluar";

    sellerBooksApplyDateInputLanguage();

    const topTitle = document.getElementById("topTitle");
    const topSubtitle = document.getElementById("topSubtitle");
    if(topTitle && view.classList.contains("active")){
        topTitle.textContent = sellerBooksStoreText("pageTitle");
        topSubtitle.textContent = sellerBooksStoreText("pageSubtitle");
    }
}


function sellerBooksApplyMarketplaceLanguage(){
    const marketplaceView = document.getElementById("marketplace");
    if(!marketplaceView) return;

    const title = marketplaceView.querySelector(".page-header h2");
    const subtitle = marketplaceView.querySelector(".page-header p");
    if(title) title.textContent = sellerBooksMarketplaceText("pageTitle");
    if(subtitle) subtitle.textContent = sellerBooksMarketplaceText("pageSubtitle");

    const count = document.getElementById("marketplaceCount");
    if(count) count.textContent = sellerBooksMarketplaceCountText(marketplaces?.length || 0);

    const addButton = marketplaceView.querySelector('button[onclick="openMarketplaceModal()"]');
    if(addButton) addButton.textContent = "+ " + sellerBooksMarketplaceText("add");

    const modal = document.getElementById("marketplaceModal");
    if(modal){
        const modalTitle = document.getElementById("marketplaceModalTitle");
        if(modalTitle){
            modalTitle.textContent = editingMarketplaceId
                ? sellerBooksMarketplaceText("editTitle")
                : sellerBooksMarketplaceText("addTitle");
        }

        const labels = modal.querySelectorAll(".form-group label");
        if(labels[0]) labels[0].textContent = sellerBooksMarketplaceText("nameLabel");
        if(labels[1]) labels[1].textContent = sellerBooksMarketplaceText("statusLabel");

        const nameInput = document.getElementById("marketplaceName");
        if(nameInput) nameInput.placeholder = sellerBooksMarketplaceText("namePlaceholder");

        const statusSelect = document.getElementById("marketplaceStatus");
        if(statusSelect){
            const activeOption = statusSelect.querySelector('option[value="active"]');
            const inactiveOption = statusSelect.querySelector('option[value="inactive"]');
            if(activeOption) activeOption.textContent = sellerBooksMarketplaceText("active");
            if(inactiveOption) inactiveOption.textContent = sellerBooksMarketplaceText("inactive");
        }

        const cancelButton = modal.querySelector('.modal-footer .cancel-button');
        if(cancelButton) cancelButton.textContent = sellerBooksMarketplaceText("cancel");

        const saveButton = modal.querySelector('.modal-footer .primary-button');
        if(saveButton) saveButton.textContent = sellerBooksMarketplaceText("save");

        const closeButton = modal.querySelector(".modal-close");
        if(closeButton) closeButton.setAttribute("aria-label", sellerBooksMarketplaceText("cancel"));
    }

    const topTitle = document.getElementById("topTitle");
    const topSubtitle = document.getElementById("topSubtitle");
    if(topTitle && marketplaceView.classList.contains("active")){
        topTitle.textContent = sellerBooksMarketplaceText("pageTitle");
        topSubtitle.textContent = sellerBooksMarketplaceText("pageSubtitle");
    }
}


function sellerBooksApplyDashboardLanguage(){
    const dashboard = document.getElementById("dashboard");
    if(!dashboard) return;

    const setText = function(selector,key){
        const el = dashboard.querySelector(selector);
        if(el) el.textContent = sellerBooksDashboardText(key);
    };

    setText(".welcome-card h2","welcomeTitle");
    setText(".welcome-card p","welcomeText");

    const labels = dashboard.querySelectorAll(".stats-grid .stat-label");
    ["totalSales","totalProducts","netProfit","netMargin"].forEach(function(key,index){
        if(labels[index]) labels[index].textContent = sellerBooksDashboardText(key);
    });

    setText(".sb-piutang-dashboard-label","resellerReceivable");
    setText(".sb-piutang-dashboard-info","receivableInfo");
    const receivableButton = dashboard.querySelector(".sb-piutang-dashboard-button");
    if(receivableButton) receivableButton.textContent = sellerBooksDashboardText("viewReceivable");

    setText(".dashboard-chart-card:nth-child(1) h3","salesChart");
    setText(".dashboard-chart-card:nth-child(1) p","salesMovement");
    const chartInfo = document.getElementById("dashboardSalesChartInfo");
    if(chartInfo) chartInfo.textContent =
        sellerBooksDashboardText("periodMovement") +
        sellerBooksDashboardPeriodText(currentDashboardPeriod);

    dashboard.querySelectorAll(".dashboard-chart-empty").forEach(function(el){
        const hasPeriodSuffix = /period|periode/i.test(el.textContent || "");
        el.textContent = hasPeriodSuffix
            ? sellerBooksDashboardText("noSalesPeriod")
            : sellerBooksDashboardText("noSales");
    });
    setText(".dashboard-chart-card:nth-child(2) h3","marketplaceSales");
    setText(".dashboard-chart-card:nth-child(2) p","marketplaceComparison");
    setText(".content-section .section-header h3","marketplacePerformance");
    setText(".content-section .section-header p","marketplaceSummary");

    const refreshButton = dashboard.querySelector('button[onclick="sellerBooksManualRefreshDashboard()"]');
    if(refreshButton){
        refreshButton.title = sellerBooksDashboardText("refreshDashboard");
        refreshButton.setAttribute("aria-label",sellerBooksDashboardText("refreshDashboard"));
    }

    const marketplaceButton = dashboard.querySelector('button[onclick="showView(\'marketplace\')"]');
    if(marketplaceButton) marketplaceButton.textContent = sellerBooksDashboardText("viewMarketplace");

    const headers = dashboard.querySelectorAll(".content-section table thead th");
    ["marketplace","storeAccount","sales","netProfitHeader"].forEach(function(key,index){
        if(headers[index]) headers[index].textContent = sellerBooksDashboardText(key);
    });

    const infos = dashboard.querySelectorAll(".stats-grid .stat-card .stat-info");
    const periodLabel = sellerBooksDashboardPeriodText(currentDashboardPeriod);
    const hasSales = getAllReportTransactions().some(function(item){
        const reportDate = item.reportDate || item.importedAt;
        return isDateInPeriod(reportDate,currentDashboardPeriod);
    });
    if(infos[0]) infos[0].textContent = hasSales
        ? sellerBooksDashboardText("allMarketplaceTotal") + periodLabel
        : sellerBooksDashboardText("noSalesPeriodShort") + periodLabel;
    if(infos[1]) infos[1].textContent = sellerBooksDashboardText("allProductsTotal") + periodLabel;
    if(infos[2]) infos[2].textContent = sellerBooksDashboardText("allProfitTotal") + periodLabel;
    if(infos[3]) infos[3].textContent = sellerBooksDashboardText("allMarginTotal") + periodLabel;

    const performanceRows = dashboard.querySelectorAll("#performanceMarketplaceBody tr");
    performanceRows.forEach(function(row){
        const accountCell = row.querySelector("td:nth-child(2)");
        if(accountCell){
            const strong = accountCell.querySelector("strong");
            if(strong){
                accountCell.innerHTML =
                    "<strong>" + strong.textContent + "</strong> " +
                    sellerBooksDashboardText("account");
            }
        }
    });

    const periodSelect = document.getElementById("dashboardPeriod");
    if(periodSelect){
        Array.from(periodSelect.options).forEach(function(option){
            option.textContent = sellerBooksDashboardPeriodText(option.value);
        });
    }

    const customRange = document.getElementById("dashboardCustomDateRange");
    if(customRange){
        const labels = customRange.querySelectorAll("label");
        if(labels[0]) labels[0].textContent = sellerBooksDashboardText("fromDate");
        if(labels[1]) labels[1].textContent = sellerBooksDashboardText("toDate");
        const info = document.getElementById("dashboardDateRangeInfo");
        if(info) info.textContent = sellerBooksDashboardText("dateRangeInfo");
    }

    const topTitle = document.getElementById("topTitle");
    const topSubtitle = document.getElementById("topSubtitle");
    if(topTitle && dashboard.classList.contains("active")){
        topTitle.textContent = "Dashboard";
        topSubtitle.textContent = sellerBooksCurrentLanguage()==="en"
            ? "Marketplace business summary"
            : "Ringkasan bisnis marketplace Anda";
    }
}


function sellerBooksApplyReportsLanguage(){
    sellerBooksApplyDateInputLanguage();

    const view = document.getElementById("reports");
    if(!view) return;

    const language = sellerBooksCurrentLanguage();

    const title = view.querySelector(".page-header h2");
    const subtitle = view.querySelector(".page-header p");
    if(title) title.textContent = language === "en" ? "Business Reports" : "Laporan Bisnis";
    if(subtitle) subtitle.textContent = language === "en"
        ? "Analyze sales, costs, and profit across all marketplaces and store accounts."
        : "Analisis penjualan, biaya, dan laba seluruh marketplace serta akun toko.";

    const topTitle = document.getElementById("topTitle");
    const topSubtitle = document.getElementById("topSubtitle");
    if(topTitle && view.classList.contains("active")){
        topTitle.textContent = language === "en" ? "Business Reports" : "Laporan Bisnis";
        topSubtitle.textContent = language === "en"
            ? "Analyze sales, costs, and profit across all marketplaces and store accounts."
            : "Analisis penjualan, biaya, dan laba seluruh marketplace serta akun toko.";
    }

    const pdfButton = document.getElementById("downloadReportPDFButton");
    if(pdfButton){
        pdfButton.textContent = sellerBooksReportsText("downloadPdf");
    }

    /* FILTER */
    const filterSection = document.getElementById("reportPeriod")?.closest(".content-section");
    if(filterSection){
        const h3 = filterSection.querySelector("h3");
        const p = filterSection.querySelector("h3 + p");
        if(h3) h3.textContent = sellerBooksReportsText("filterTitle");
        if(p) p.textContent = sellerBooksReportsText("filterSubtitle");

        const labels = filterSection.querySelectorAll(".report-filter-grid > div > label");
        if(labels[0]) labels[0].textContent = sellerBooksReportsText("period");
        if(labels[1]) labels[1].textContent = sellerBooksReportsText("marketplace");
        if(labels[2]) labels[2].textContent = sellerBooksReportsText("storeAccount");

        const period = document.getElementById("reportPeriod");
        if(period){
            Array.from(period.options).forEach(function(option){
                option.textContent = sellerBooksReportPeriodText(option.value);
            });
        }

        const dateLabels = document.getElementById("reportCustomDateRange")?.querySelectorAll("label");
        if(dateLabels){
            if(dateLabels[0]) dateLabels[0].textContent = sellerBooksReportsText("fromDate");
            if(dateLabels[1]) dateLabels[1].textContent = sellerBooksReportsText("toDate");
        }

        const rangeInfo = document.getElementById("reportDateRangeInfo");
        if(rangeInfo){
            rangeInfo.textContent = sellerBooksReportsText("maxRange");
        }

        const marketplace = document.getElementById("reportMarketplace");
        if(marketplace){
            const first = marketplace.querySelector('option[value="all"]');
            if(first) first.textContent = sellerBooksReportsText("allMarketplaces");
        }

        const store = document.getElementById("reportStore");
        if(store){
            const first = store.querySelector('option[value="all"]');
            if(first) first.textContent = sellerBooksReportsText("allStoreAccounts");
        }

        const filterInfo = document.getElementById("reportFilterInfo");
        if(filterInfo){
            const summary = window.currentReportSummary;
            if(summary){
                let textValue = sellerBooksReportsText("transactionRows")
                    .replace("{rows}",Number(summary.transactions?.length || 0).toLocaleString("id-ID"))
                    .replace("{transactions}",Number(summary.transactionCount || 0).toLocaleString("id-ID"))
                    .replace("{products}",Number(summary.totalQty || 0).toLocaleString("id-ID"));
                if(Number(summary.unmatchedSkuCount || 0) > 0){
                    textValue += sellerBooksReportsText("unmatchedInfo")
                        .replace("{count}",Number(summary.unmatchedSkuCount).toLocaleString("id-ID"));
                }
                filterInfo.textContent = textValue + ".";
            }else{
                filterInfo.textContent = sellerBooksReportsText("showingAllSales");
            }
        }
    }

    /* DELETE REPORTS */
    const deleteGrid = document.getElementById("deleteReportFiltersGrid");
    const deleteSection = deleteGrid?.closest(".content-section");
    if(deleteSection){
        const h3 = deleteSection.querySelector("h3");
        const p = deleteSection.querySelector("h3 + p");
        const labels = deleteGrid.querySelectorAll("label");
        if(h3) h3.textContent = sellerBooksReportsText("deleteTitle");
        if(p) p.textContent = sellerBooksReportsText("deleteSubtitle");
        if(labels[0]) labels[0].textContent = sellerBooksReportsText("fromDate");
        if(labels[1]) labels[1].textContent = sellerBooksReportsText("toDate");
        if(labels[2]) labels[2].textContent = "Marketplace";
        if(labels[3]) labels[3].textContent = sellerBooksReportsText("storeAccount");

        const marketplace = document.getElementById("deleteReportMarketplace");
        if(marketplace){
            const first = marketplace.querySelector('option[value="all"]');
            if(first) first.textContent = sellerBooksReportsText("allMarketplaces");
        }

        const store = document.getElementById("deleteReportStore");
        if(store){
            const first = store.querySelector('option[value="all"]');
            if(first) first.textContent = sellerBooksReportsText("allStoreAccounts");
        }

        const button = deleteGrid.querySelector('button[onclick="deleteReportsByDateRange()"]');
        if(button) button.innerHTML = sellerBooksReportsText("deleteButton");

        const small = deleteSection.querySelector("small");
        if(small){
            small.innerHTML =
                sellerBooksReportsText("deleteScope") + "<br>" +
                sellerBooksReportsText("deleteScope2") + "<br>" +
                sellerBooksReportsText("deleteScope3");
        }
    }

    /* FINANCIAL CARDS */
    const cards = view.querySelectorAll("#reportStatsGrid .stat-card");
    const cardKeys = [
        ["totalSales","noData"],
        ["netSales","afterMarketplace"],
        ["productsSold","totalProductsSold"],
        ["totalPacking","orderPacking"],
        ["totalHpp","soldProductCost"],
        ["otherCosts","additionalBusinessCosts"],
        ["grossProfit","afterHppPacking"],
        ["netProfit","afterAllCosts"]
    ];
    cards.forEach(function(card,index){
        const pair = cardKeys[index];
        if(!pair) return;
        const label = card.querySelector(".stat-label");
        const info = card.querySelector(".stat-info");
        if(label) label.textContent = sellerBooksReportsText(pair[0]);
        if(info) info.textContent = sellerBooksReportsText(pair[1]);
    });

    /* PROFIT MARGIN */
    const marginSection = document.getElementById("reportProfitMargin")?.closest(".content-section");
    if(marginSection){
        const h3 = marginSection.querySelector("h3");
        const p = marginSection.querySelector("h3 + p");
        if(h3) h3.textContent = sellerBooksReportsText("profitMargin");
        if(p) p.textContent = sellerBooksReportsText("profitMarginSubtitle");
    }

    /* UNMATCHED SKU */
    const unmatchedSection = document.getElementById("reportUnmatchedSkuSection");
    if(unmatchedSection){
        const h3 = unmatchedSection.querySelector("h3");
        const p = unmatchedSection.querySelector(".section-header p");
        if(h3) h3.textContent = sellerBooksReportsText("unmatchedTitle");
        if(p) p.textContent = sellerBooksReportsText("unmatchedSubtitle");
        const th = unmatchedSection.querySelectorAll("thead th");
        if(th[0]) th[0].textContent = "SKU";
        if(th[1]) th[1].textContent = sellerBooksReportsText("rows");
        if(th[2]) th[2].textContent = sellerBooksReportsText("qty");
        const empty = unmatchedSection.querySelector("tbody td");
        if(empty) empty.textContent = sellerBooksReportsText("noUnmatched");
    }

    /* MARKETPLACE + STORE SUMMARY TABLES */
    const summarySections = [
        {
            bodyId:"reportMarketplaceBody",
            title:"marketplacePerformance",
            subtitle:"marketplaceSummary"
        },
        {
            bodyId:"reportStoreBody",
            title:"storePerformance",
            subtitle:"storeSummary"
        }
    ];

    summarySections.forEach(function(config){
        const body = document.getElementById(config.bodyId);
        const section = body?.closest(".content-section");
        if(!section) return;

        const h3 = section.querySelector("h3");
        const p = section.querySelector(".section-header p");
        if(h3) h3.textContent = sellerBooksReportsText(config.title);
        if(p) p.textContent = sellerBooksReportsText(config.subtitle);

        const th = section.querySelectorAll("thead th");
        const headers = [
            "marketplace","storeAccount","sales","netSalesHeader",
            "productsSold","packing","netProfitHeader","margin"
        ];
        th.forEach(function(cell,index){
            if(headers[index]) cell.textContent = sellerBooksReportsText(headers[index]);
        });

        const empty = body.querySelector("td");
        if(empty && /Belum ada data laporan|No report data yet|gagal ditampilkan|failed to display/i.test(empty.textContent || "")){
            empty.textContent = sellerBooksReportsText("noReportData");
        }

        body.querySelectorAll("tr").forEach(function(row){
            const cells = row.querySelectorAll("td");
            if(cells[1] && (cells[1].textContent || "").trim() === "Semua Toko"){
                cells[1].textContent = sellerBooksReportsText("allStores");
            }
        });
    });

    /* SALES DETAILS + PAGINATION */
    const detailBody = document.getElementById("reportTransactionBody");
    const detailSection = detailBody?.closest(".content-section");
    if(detailSection){
        const h3 = detailSection.querySelector("h3");
        const p = detailSection.querySelector(".section-header p");
        if(h3) h3.textContent = sellerBooksReportsText("detailsTitle");
        if(p) p.textContent = sellerBooksReportsText("detailsSubtitle");

        const th = detailSection.querySelectorAll("thead th");
        const headers = ["","date","marketplace","storeAccount","order","orderId","skuSellerBooks","qty","sales","status"];
        th.forEach(function(cell,index){
            if(headers[index]) cell.textContent = sellerBooksReportsText(headers[index]);
        });

        const empty = detailBody.querySelector("td");
        if(empty && /Belum ada data penjualan|No sales data yet|gagal ditampilkan|failed to display/i.test(empty.textContent || "")){
            empty.textContent = empty.textContent.toLowerCase().includes("gagal") || empty.textContent.toLowerCase().includes("failed")
                ? sellerBooksReportsText("errorDetails")
                : sellerBooksReportsText("noSalesData");
        }

        detailBody.querySelectorAll("tr").forEach(function(row){
            const cells = row.querySelectorAll("td");
            if(cells[8]){
                const value = (cells[8].textContent || "").trim();
                if(value === "✓ Valid" || value === "✓ Valid"){
                    cells[8].textContent = sellerBooksReportsText("valid");
                }else if(value === "⚠ SKU belum ada" || value === "⚠ SKU not in Master"){
                    cells[8].textContent = sellerBooksReportsText("skuMissing");
                }
            }
        });

        const pagination = document.getElementById("reportTransactionPagination");
        if(pagination){
            const pageSize = pagination.querySelector(".report-transaction-page-size");
            if(pageSize){
                const spans = pageSize.querySelectorAll("span");
                if(spans[0]) spans[0].textContent = sellerBooksReportsText("show");
                if(spans[1]) spans[1].textContent = sellerBooksReportsText("rowsLower");
            }

            const controls = document.getElementById("reportTransactionPaginationControls");
            if(controls){
                const info = controls.querySelector(".report-transaction-page-info");
                if(info){
                    const raw = info.textContent.trim().match(/^(\d+)\s*-\s*(\d+)\s+(?:dari|of)\s+(\d+)$/i);
                    if(raw){
                        info.textContent = raw[1] + "-" + raw[2] + " " + sellerBooksReportsText("pageOf") + " " + raw[3];
                    }
                }

                const buttons = controls.querySelectorAll("button");
                buttons.forEach(function(button){
                    const text = (button.textContent || "").trim();
                    if(text === "Next ›" || text === "Berikutnya ›"){
                        button.innerHTML = sellerBooksReportsText("next") + " ›";
                        button.setAttribute("aria-label",sellerBooksReportsText("next"));
                    }else if(text === "‹"){
                        button.setAttribute("aria-label",sellerBooksReportsText("previous"));
                    }
                });
            }
        }
    }

    /* SALES INFO */
    const salesInfo = document.getElementById("reportSalesInfo");
    const financial = window.currentReportFinancial;
    if(salesInfo && financial){
        salesInfo.textContent = sellerBooksReportsText("adminMarketplace") + " " + formatRupiah(financial.totalAdmin);
    }

    /* Refresh custom date UI after translating the labels. */
    if(typeof updateReportCustomDateUI === "function"){
        updateReportCustomDateUI();
        const rangeInfo = document.getElementById("reportDateRangeInfo");
        if(rangeInfo){
            const today = getIndonesiaTodayDate();
            const minDate = getLocalDateString(new Date(today.getFullYear(),today.getMonth()-2,1));
            const maxDate = getLocalDateString(today);
            rangeInfo.textContent = sellerBooksReportsText("maxRange") + " (" +
                minDate.split("-").reverse().join("/") + " " +
                (language === "en" ? "to" : "s/d") + " " +
                maxDate.split("-").reverse().join("/") + ").";
        }
    }
}


function sellerBooksApplySettingsLanguage(){
    const view = document.getElementById("settings");
    if(!view) return;

    const t = sellerBooksSettingsText;
    const set = (selector,key) => {
        const el=view.querySelector(selector);
        if(el) el.textContent=t(key);
    };
    const setAttr = (selector,attr,key) => {
        const el=view.querySelector(selector);
        if(el) el.setAttribute(attr,t(key));
    };

    set(".page-header h2","pageTitle");
    set(".page-header p","pageSubtitle");

    const cards=view.querySelectorAll(".settings-card");
    if(cards[0]){
        const h=cards[0].querySelector(".settings-card-header h3"), p=cards[0].querySelector(".settings-card-header p");
        if(h)h.textContent=t("languageTitle"); if(p)p.textContent=t("languageDesc");
        const label=cards[0].querySelector("label"); if(label)label.textContent=t("languageLabel");
        const info=document.getElementById("settingsLanguageInfo");
        if(info && !/^(Saving|Menyimpan)/i.test(info.textContent||"")) info.textContent=t("languageSaved");
        const btn=cards[0].querySelector("button"); if(btn)btn.textContent=t("saveLanguage");
        const lang=document.getElementById("settingsLanguage");
        if(lang){ const id=lang.querySelector('option[value="id"]'),en=lang.querySelector('option[value="en"]'); if(id)id.textContent="Bahasa Indonesia"; if(en)en.textContent="English"; }
    }

    if(cards[1]){
        const h=cards[1].querySelector(".settings-card-header h3"),p=cards[1].querySelector(".settings-card-header p");
        if(h)h.textContent=t("businessTitle"); if(p)p.textContent=t("businessDesc");
        const label=cards[1].querySelector("label"); if(label)label.textContent=t("businessLabel");
        const input=document.getElementById("settingsBusinessName"); if(input)input.placeholder=t("businessPlaceholder");
        const info=document.getElementById("settingsBusinessNameInfo");
        if(info){
            const raw=String(info.textContent||"").trim();
            if(raw==="Belum ada perubahan." || raw==="No changes yet." || raw==="Pengaturan berhasil disimpan." || raw==="Settings saved successfully."){
                info.textContent = raw==="Pengaturan berhasil disimpan." || raw==="Settings saved successfully." ? t("saved") : t("noChanges");
            }
        }
        const btn=cards[1].querySelector("button"); if(btn)btn.textContent=t("save");
    }

    if(cards[2]){
        const h=cards[2].querySelector(".settings-card-header h3"),p=cards[2].querySelector(".settings-card-header p");
        if(h)h.textContent=t("logoTitle"); if(p)p.textContent=t("logoDesc");
        const buttons=cards[2].querySelectorAll("button"); if(buttons[0])buttons[0].textContent=t("chooseLogo"); if(buttons[1])buttons[1].textContent=t("removeLogo");
        const small=cards[2].querySelector("small"); if(small)small.textContent=t("logoFormats");
    }

    if(cards[3]){
        const h=cards[3].querySelector(".settings-card-header h3"),p=cards[3].querySelector(".settings-card-header p");
        if(h)h.textContent=t("currencyTitle"); if(p)p.textContent=t("currencyDesc");
        const label=cards[3].querySelector("label"); if(label)label.textContent=t("currencyLabel");
        const cur=document.getElementById("settingsCurrency");
        if(cur){
            const map={IDR:"idr",USD:"usd",SGD:"sgd",MYR:"myr"};
            Array.from(cur.options).forEach(o=>{if(map[o.value])o.textContent=t(map[o.value]);});
        }
        const title=cards[3].querySelector(".settings-exchange-rate-title strong"),desc=cards[3].querySelector(".settings-exchange-rate-title span");
        if(title)title.textContent=t("manualRate"); if(desc)desc.textContent=t("rateDesc");
        const rateLabels=cards[3].querySelectorAll(".settings-exchange-rate-grid label");
        [t("usdRate"),t("sgdRate"),t("myrRate")].forEach((v,i)=>{if(rateLabels[i])rateLabels[i].textContent=v;});
        const rateInputs=[["settingsRateUSD","ratePlaceholderUSD"],["settingsRateSGD","ratePlaceholderSGD"],["settingsRateMYR","ratePlaceholderMYR"]];
        rateInputs.forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.placeholder=t(key);});
        const notes=cards[3].querySelectorAll(".settings-note");
        if(notes[0])notes[0].innerHTML=t("rateNote");
        if(notes[1])notes[1].textContent=t("currencyNote");
        const info=document.getElementById("settingsCurrencyInfo");
        if(info){
            const settings=getSellerBooksSettings();
            const rates=settings.exchangeRates||{};
            info.textContent=t("rateInfo")+" " +
                "1 USD = Rp"+Number(rates.USD||16500).toLocaleString("id-ID") +
                " • 1 SGD = Rp"+Number(rates.SGD||12900).toLocaleString("id-ID") +
                " • 1 MYR = Rp"+Number(rates.MYR||3900).toLocaleString("id-ID");
        }
        const btn=cards[3].querySelector(".settings-card-footer button"); if(btn)btn.textContent=t("saveRate");
    }

    if(cards[4]){
        const h=cards[4].querySelector(".settings-card-header h3"),p=cards[4].querySelector(".settings-card-header p");
        if(h)h.textContent=t("packingTitle"); if(p)p.textContent=t("packingDesc");
        const label=cards[4].querySelector("label"); if(label)label.textContent=t("packingLabel");
        const input=document.getElementById("settingsPackingCost"); if(input)input.placeholder=t("packingPlaceholder");
        const info=document.getElementById("settingsPackingInfo");
        if(info){
            const settings=getSellerBooksSettings();
            const amount=formatRupiah(Number(settings.packingCost)||0);
            info.textContent=t("packingInfo")+" "+amount+" / order.";
        }
        const btn=cards[4].querySelector("button"); if(btn)btn.textContent=t("save");
    }

    if(cards[5]){
        const h=cards[5].querySelector(".settings-card-header h3"),p=cards[5].querySelector(".settings-card-header p");
        if(h)h.textContent=t("roundingTitle"); if(p)p.textContent=t("roundingDesc");
        const label=cards[5].querySelector("label"); if(label)label.textContent=t("roundingLabel");
        const sel=document.getElementById("settingsRounding");
        if(sel){
            const map={none:"roundingNone",10:"rounding10",100:"rounding100",1000:"rounding1000"};
            Array.from(sel.options).forEach(o=>{if(map[o.value])o.textContent=t(map[o.value]);});
        }
        const note=cards[5].querySelector(".settings-note"); if(note)note.textContent=t("roundingNote");
    }

    if(cards[6]){
        const h=cards[6].querySelector(".settings-card-header h3"),p=cards[6].querySelector(".settings-card-header p");
        if(h)h.textContent=t("backupTitle"); if(p)p.textContent=t("backupDesc");
        const buttons=cards[6].querySelectorAll("button"); if(buttons[0])buttons[0].textContent=t("backup"); if(buttons[1])buttons[1].textContent=t("restore");
        const note=cards[6].querySelector(".settings-note"); if(note)note.textContent=t("restoreWarning");
    }

    const topTitle=document.getElementById("topTitle"),topSubtitle=document.getElementById("topSubtitle");
    if(topTitle && view.classList.contains("active")){topTitle.textContent=t("pageTitle");topSubtitle.textContent=t("pageSubtitle");}
}


function sellerBooksApplyOwnerSetupLanguage(){
    const view=document.getElementById("ownerSetupPage");
    if(!view) return;
    const setText=(selector,key)=>{
        const el=view.querySelector(selector);
        if(el) el.textContent=sellerBooksOwnerSetupText(key);
    };
    setText("h2","title");
    setText("p","description");
    setText(".owner-setup-label","label");
    setText(".owner-save-button","save");
    setText(".owner-setup-note","note");
    const input=document.getElementById("ownerNameInput");
    if(input) input.placeholder=sellerBooksOwnerSetupText("placeholder");
}


function sellerBooksApplyDateInputLanguage(){
    const language = sellerBooksCurrentLanguage();
    const locale = language === "en" ? "en-GB" : "id-ID";

    /*
       Native <input type="date"> mengikuti locale halaman/input.
       Ikat locale date picker ke bahasa akun agar kalender native
       tidak tetap memakai Bahasa Indonesia saat akun memilih English.
       en-GB dipakai supaya nama bulan/hari English tetapi format tanggal
       tetap konsisten dd/mm/yyyy.
    */
    document.documentElement.lang = locale;

    document.querySelectorAll('input[type="date"]').forEach(function(input){
        input.setAttribute("lang",locale);
        input.setAttribute("dir","ltr");
    });
}
