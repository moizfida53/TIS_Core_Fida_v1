// ============================================================
// TIS - Telecom Invoicing System | myJS.js (Refactored)
// Removed: jqxWidgets | Added: DataTables + Bootstrap + AJAX
// ============================================================

'use strict';

// ─── Global State ──────────────────────────────────────────
var arrovalItem;
var bc, pc, ac, uc;
var blim, alim, plim;
var isbus, isper, HidePer;
var myPart = 1;
var GBillId = 0;
var attemp = 0;
var hardSelect = 0;
var itemData = [];
var Settings = {};
var currentValue = 0;
var employees;
var uid;
var AppBills;
var ArcBills;
var ExName;
var CName;
var myBillDet = [];
var myBills = [];
var myAB = [];
var myABB = [];
var DepartmentBillDet = [];
let SelectedtbIndex = 1;

// DataTable instances
var dtMaster = null;
var dtDetails = null;
var dtApprBills = null;
var dtApprDet = null;
var dtArcBills = null;
var dtDeptBills = null;
var dtDelegate = null;
var dtDataRoaming = null;

// ─── Toast notification (top-right, auto-dismiss) ─────────────
function showToast(msg, type) {
    type = type || 'warning';
    var containerId = '_tisToastWrap';
    if (!document.getElementById(containerId)) {
        var wrap = document.createElement('div');
        wrap.id = containerId;
        wrap.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(wrap);
    }
    var palette = { warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6', success: '#22c55e' };
    var glyphs  = { warning: '⚠', danger: '✕', info: 'ℹ', success: '✓' };
    var color   = palette[type] || palette.warning;
    var glyph   = glyphs[type]  || glyphs.warning;

    var t = document.createElement('div');
    t.style.cssText = [
        'pointer-events:auto',
        'background:#fff',
        'border-left:4px solid ' + color,
        'border-radius:8px',
        'box-shadow:0 4px 20px rgba(0,0,0,.14)',
        'padding:12px 14px',
        'min-width:220px',
        'max-width:320px',
        'display:flex',
        'align-items:flex-start',
        'gap:10px',
        'font-size:13px',
        'opacity:0',
        'transform:translateY(-8px)',
        'transition:opacity .35s,transform .35s'
    ].join(';');
    t.innerHTML =
        '<span style="font-size:15px;color:' + color + ';flex-shrink:0;line-height:1.4">' + glyph + '</span>' +
        '<span style="color:#374151;line-height:1.5;flex:1">' + msg + '</span>';
    document.getElementById(containerId).appendChild(t);

    // Animate in (next frame so CSS transition fires)
    requestAnimationFrame(function () {
        t.style.opacity   = '1';
        t.style.transform = 'translateY(0)';
    });
    // Dismiss after 5 s
    setTimeout(function () {
        t.style.opacity   = '0';
        t.style.transform = 'translateY(-8px)';
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, 5000);
}

// ── Global topbar search ──────────────────────────────
// Maps the active view name → its DataTable instance, then runs a contains
// search via DataTables' built-in filter (smart matching across all columns).
function activeDataTable() {
    var active = document.querySelector('.tis-view.is-active');
    var view = active ? active.getAttribute('data-view') : 'mybills';
    if (view === 'approval')   return (typeof dtApprBills !== 'undefined') ? dtApprBills : null;
    if (view === 'history')    return (typeof dtArcBills  !== 'undefined') ? dtArcBills  : null;
    if (view === 'department') return (typeof dtDeptBills !== 'undefined') ? dtDeptBills : null;
    return (typeof dtMaster !== 'undefined') ? dtMaster : null;
}

function applyGlobalSearch(term) {
    var dt = activeDataTable();
    if (dt && typeof dt.search === 'function') {
        dt.search(term || '').draw();
    }
}

// Sidebar tab link helper — called by every nav-* link's onclick.
// On the User/Index page (where the .tis-view system exists), it switches
// tabs locally with no navigation. On any other page (Admin/Telephone etc.)
// it records the desired tab in sessionStorage and navigates to /User; the
// document.ready handler on User/Index then picks up the hint and activates
// that tab instead of the default 'mybills'.
window.tisGoTo = function (name) {
    if (document.querySelector('.tis-view[data-view="' + name + '"]')
        && typeof switchView === 'function') {
        switchView(name);
        return false;
    }
    try { sessionStorage.setItem('tis.requestedView', name); } catch (e) {}
    location.href = '/User';
    return false;
};

// ── View switching (sidebar tabs) ─────────────────────
// Sidebar links call switchView('mybills' | 'approval' | 'history' | 'department').
// View containers must carry class="tis-view" plus data-view="<name>".
// Visibility is controlled by toggling the .is-active class — the CSS
// rule (.tis-view{display:none !important}) defeats any inline style or
// upstream rule that could otherwise leave a stale pane visible.
function switchView(name) {
    var labels = {
        mybills:    'My Bills',
        approval:   'Pending Approval',
        history:    'Bills History',
        department: 'Department'
    };

    var panes = document.querySelectorAll('.tis-view');
    var target = document.querySelector('.tis-view[data-view="' + name + '"]');
    // Temporary diagnostic — delete after the tab-switching issue is confirmed fixed.
    console.log('[switchView]', name, '— panes:', panes.length, '— targetFound:', !!target);

    // Hide every view, then activate the requested one (idempotent).
    panes.forEach(function (v) { v.classList.remove('is-active'); });
    if (target) target.classList.add('is-active');

    // Sidebar active state — convention: id="nav-<name>"
    document.querySelectorAll('.sidebar .ni').forEach(function (a) {
        a.classList.remove('active');
    });
    var nav = document.getElementById('nav-' + name);
    if (nav) nav.classList.add('active');

    // Breadcrumb / page title
    var bc = document.getElementById('bcCurrent');
    if (bc && labels[name]) bc.textContent = labels[name];

    // Mobile: collapse the sidebar after tap-navigation
    if (typeof closeSB === 'function') { try { closeSB(); } catch (e) {} }

    // Refresh the data for the activated view (matches old switchView behavior).
    var loaders = {
        mybills:    'bindIdentificationBills',
        approval:   'bindApprovalBills',
        history:    'bindArchivedBills',
        department: 'bindDepartmentBills'
    };
    var loaderName = loaders[name];
    if (loaderName && typeof window[loaderName] === 'function') {
        try { window[loaderName](); } catch (e) { console.warn('[switchView] loader', loaderName, 'threw:', e); }
    }

    // Reset the topbar search box on every tab change so each tab starts unfiltered.
    var gs = document.getElementById('globalSearch');
    if (gs) gs.value = '';
    applyGlobalSearch('');
}

// ── Page Init ─────────────────────────────────────────
$(document).ready(function () {

    // Read server-injected context (set by _Layout.cshtml before this script loads).
    // Fall back to safe defaults so the page never crashes if the variables are absent.
    uid        = (typeof _tisUID         !== 'undefined') ? _tisUID         : 0;
    var roleId      = (typeof _tisRoleId      !== 'undefined') ? String(_tisRoleId)      : '0';
    var adminRoleId = (typeof _tisAdminRoleId !== 'undefined') ? String(_tisAdminRoleId) : '0';

    // Admin / Role visibility
    if (roleId == '3' || roleId == '8' || roleId == '4') {
        $("#btnAdmin").show();
        $("#DataRoaming2").show();
        $("#DataRoamingTab").show();
        $('#chkMyBillsOnly').prop('checked', false);
        $("#myBillsFilter").css('display', 'flex');
        $("#aa").show();
    } else {
        if (adminRoleId == '3' || adminRoleId == '8' || roleId == '4') {
            $("#btnAdmin").show();
            $("#DataRoaming2").show();
            $("#DataRoamingTab").show();
        } else {
            $("#btnAdmin").hide();
            $("#DataRoaming2").hide();
        }
        $('#chkMyBillsOnly').prop('checked', false);
        $("#myBillsFilter").hide();
        $("#aa").hide();
    }

    $("#btnAdmin").off('click').on('click', function () { OpenAdmin(); });

    // ── Sidebar section collapse/expand (accordion) ──
    // Each .sb-section has a clickable .sb-section-head (button + chevron).
    // Only ONE section stays expanded at a time: opening one collapses the rest.
    // The currently-open section is keyed by data-section and survives reloads.
    (function () {
        var STORE_KEY = 'tis.sidebar.openSection';
        var sections  = document.querySelectorAll('.sidebar .sb-section');
        if (!sections.length) return;

        // Collapse every section except the one whose data-section === openKey.
        // Passing null/'' collapses all of them.
        function applyOpen(openKey) {
            sections.forEach(function (sec) {
                var key = sec.getAttribute('data-section') || '';
                sec.classList.toggle('is-collapsed', key !== openKey);
            });
        }

        function persist(openKey) {
            try {
                if (openKey) localStorage.setItem(STORE_KEY, openKey);
                else         localStorage.removeItem(STORE_KEY);
            } catch (e) {}
        }

        // Restore on load: honour the saved open section if it still exists;
        // otherwise fall back to whichever section the markup left expanded
        // (Bills by default), enforcing single-open from the start.
        var saved = null;
        try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}

        var hasSaved = false;
        if (saved) {
            sections.forEach(function (sec) {
                if ((sec.getAttribute('data-section') || '') === saved) hasSaved = true;
            });
        }

        if (hasSaved) {
            applyOpen(saved);
        } else {
            // First expanded section in markup wins; collapse the others.
            var firstOpen = null;
            sections.forEach(function (sec) {
                if (firstOpen === null && !sec.classList.contains('is-collapsed'))
                    firstOpen = sec.getAttribute('data-section') || '';
            });
            applyOpen(firstOpen);
            persist(firstOpen);
        }

        // Header click — delegated so it works for any sb-section now or later.
        $(document).off('click.sbSection').on('click.sbSection', '.sidebar .sb-section-head', function (e) {
            e.preventDefault();
            var sec = this.closest('.sb-section');
            if (!sec) return;
            var key = sec.getAttribute('data-section') || '';

            // Clicking the open section closes it (all collapsed); clicking a
            // collapsed section opens it alone and collapses every other one.
            var openKey = sec.classList.contains('is-collapsed') ? key : '';
            applyOpen(openKey);
            persist(openKey);
        });
    })();

    // The User/Index page is the only page that uses the .tis-view tab system
    // and the bills/approval/history grids. Other pages (Admin/Telephone, etc.)
    // share the layout but should NOT run IndexLoad() or switchView('mybills') —
    // doing so would hide their .tis-view containers and overwrite the topbar
    // title with "My Bills".
    var _onBillsPage = !!document.getElementById('view-mybills');
    if (_onBillsPage) {
        IndexLoad();
        GetDataRoaming();

        // If the user navigated here from another page by clicking a sidebar
        // tab (e.g. Pending Approval on /Admin/Telephone), honour that hint
        // instead of defaulting to My Bills.
        var _requestedView = null;
        try {
            _requestedView = sessionStorage.getItem('tis.requestedView');
            if (_requestedView) sessionStorage.removeItem('tis.requestedView');
        } catch (e) {}
        if (['approval', 'history', 'department'].indexOf(_requestedView) === -1) {
            _requestedView = 'mybills';
        }
        switchView(_requestedView);
    } else if (typeof bindApprovalBills === 'function') {
        // Non-User pages still need the Pending Approval sidebar badge + nav
        // link visibility refreshed against the actual count. setDataSourceApproval
        // uses null-safe DOM lookups so the missing #tblApprBills / #mobApprCards
        // are a no-op here — only the sidebar widgets get updated.
        // Even if uid is 0 (session missing), the controller returns an error
        // response → JS treats it as 0 records → nav-approval gets hidden.
        bindApprovalBills();
    }

    // Delegated sidebar tab handler — belt-and-suspenders for the inline onclick
    // handlers in _Layout.cshtml. Works even if those are removed/broken/encoded.
    $(document).off('click.sidebarNav').on('click.sidebarNav', '.sidebar a[id^="nav-"]', function (e) {
        var name = (this.id || '').replace(/^nav-/, '');
        console.log('[sidebar-click]', this.id, '→', name);
        if (['mybills','approval','history','department'].indexOf(name) >= 0) {
            e.preventDefault();
            switchView(name);
            return false;
        }
    });

    // Global search box (topbar) — drives whichever DataTable is in the active view.
    // DataTables' default .search() is "contains" with smart token matching.
    $('#globalSearch').off('input.tisGlobal').on('input.tisGlobal', function () {
        applyGlobalSearch(this.value || '');
    });

    // Session tab restore
    var selTabIndex = window.sessionStorage['SelectedTabIndex'];
    if (selTabIndex > 0) {
        window.sessionStorage['SelectedTabIndex'] = 1;
        displayTabDetails(selTabIndex);
    } else if ($('#selectedTabId').val() > 0) {
        displayTabDetails($('#selectedTabId').val());
    }

    // Employee picker trigger
    $('#delegateModal').on('show.bs.modal', function () { GetDelegate(); });
    $('#employeePickerModal').on('show.bs.modal', function () { getEmpList(); });

    hideLoader();
});

// AJAX loader integration
$(document).ajaxStart(function () { showLoader(); })
    .ajaxComplete(function () { hideLoader(); })
    .ajaxStop(function () { hideLoader(); });

// ─── Loader ─────────────────────────────────────────────────
function showLoader() {
    $('#loading').show();
    $('#loaderDiv').show();
}

function hideLoader() {
    $('#loading').hide();
    $('#loaderDiv').hide();
}

// ─── Print / Archive Report ─────────────────────────────────
// Recursively adds a PascalCase alias for every camelCase key so the design
// code below can reference `result.ArchiveBill`, `r.TransType`, etc., even
// though System.Text.Json serializes properties as camelCase by default.
function _pascalizeKeys(o) {
    if (o == null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(_pascalizeKeys);
    var out = {};
    for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
        var v = _pascalizeKeys(o[k]);
        out[k] = v;
        var pk = k.charAt(0).toUpperCase() + k.slice(1);
        if (pk !== k && out[pk] === undefined) out[pk] = v;
    }
    return out;
}

function getMyArcBill(arcbid) {
    $.ajax({
        type: "GET",
        cache: false,
        async: false,
        url: "/Ajax/getReportBillArchive",
        data: { billId: arcbid },
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (result) {
            // Normalize so the design code's PascalCase access works.
            result = _pascalizeKeys(result);

            var bill = result.ArchiveBill || {};
            var tAmt = 0, GAmt = 0;

            // ── Build transaction rows grouped by Trans type ──
            var txnHtml = '';
            for (var i = 0; i < result.Trans.length; i++) {
                var grp = result.Trans[i];
                tAmt = 0;
                var rowsHtml = '';
                for (var j = 0; j < result.RptBill.length; j++) {
                    var r = result.RptBill[j];
                    if (r.TransType !== grp.StrTrans) continue;
                    tAmt += r.Amount;
                    GAmt += r.Amount;
                    var ctLower = (r.CallType || '').toLowerCase();
                    var badgeClass = ctLower === 'personal' ? 'personal'
                        : ctLower === 'business' ? 'business' : 'allowance';
                    rowsHtml +=
                        '<tr>' +
                        '<td>' + (r.TransType || '') + '</td>' +
                        '<td>' + (r.CallTime || '') + '</td>' +
                        '<td>' + (r.CallDate || '') + '</td>' +
                        '<td>' + (r.Description || '') + '</td>' +
                        '<td style="text-align:center">' + (r.Duration || '0') + '</td>' +
                        '<td><span class="call-type-badge ' + badgeClass + '">' + (r.CallType || '') + '</span></td>' +
                        '<td>' + (r.Amount ? r.Amount.toFixed(3) : '0.000') + '</td>' +
                        '</tr>';
                }
                txnHtml +=
                    '<div class="txn-section">' +
                    '<div class="txn-group-header">' + grp.StrTrans + '</div>' +
                    '<table class="txn-table">' +
                    '<thead><tr>' +
                    '<th>Transaction Type</th><th>Time</th><th>Call Date</th>' +
                    '<th>Description</th><th style="text-align:center">Duration</th>' +
                    '<th>Call Type</th><th style="text-align:right">Amount</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rowsHtml +
                    '<tr class="subtotal"><td colspan="6">Subtotal</td><td>' + tAmt.toFixed(3) + '</td></tr>' +
                    '</tbody></table></div>';
            }

            // Grand total row appended after last group
            txnHtml +=
                '<table class="txn-table" style="margin-top:-1px">' +
                '<tbody><tr class="grandtotal" style="color: #3b79b7 !important">' +
                '<td colspan="6">Grand Total</td>' +
                '<td>' + GAmt.toFixed(3) + '</td>' +
                '</tr></tbody></table>';


            // ── Helper to safely read bill field — case-insensitive, with
            //    fallback for the legacy "BUSSINESS" typo (the SP column is
            //    BUSSINESSLIMIT but the C# model property is BusinessLimit).
            function f(key) {
                if (bill[key] != null) return bill[key];
                var lk = String(key).toLowerCase();
                var hit = Object.keys(bill).find(function (kk) { return kk.toLowerCase() === lk; });
                if (hit && bill[hit] != null) return bill[hit];
                if (lk.indexOf('bussiness') >= 0) {
                    var fixed = key.replace(/bussiness/ig, 'business');
                    return f(fixed);
                }
                return '';
            }

            // ── Helper to format numeric fields to 3 decimal places ──
            function amt(key) { return parseFloat(f(key) || 0).toFixed(3); }

            // ── Format Bill Month — strip time portion ──
            var rawDate = f('BILLDATE') || '';
            var billMonthStr = rawDate;
            var dp = String(rawDate).split(' ')[0].split('/');
            if (dp.length === 3) {
                var bd = new Date(dp[2], dp[1] - 1, dp[0]);
                billMonthStr = bd.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            }

            // ── Status badge class ──
            var statusClass = (f('STATUS') || '').toLowerCase() === 'closed' ? 'closed' : 'pending';

            // ── Comments block (only if not empty) ──
            var commentsBlock = '';
            if (f('COMMENTS')) {
                commentsBlock =
                    '<div class="comments-block">' +
                    '<div class="cb-label">Comments</div>' +
                    '<div>' + f('COMMENTS') + '</div>' +
                    '</div>';
            }

            // ── Metrics bar HTML ──
            var metricsBar =
                '<div class="metrics-bar">' +

                // Total Bill Amount — left dark anchor
                '<div class="metric-total">' +
                '<div class="m-label">Total Bill Amount</div>' +
                '<div class="m-value">' + amt('TOTALAMOUNT') + '</div>' +
                '</div>' +
                '<div class="metrics-divider"></div>' +

                '<div class="metrics-items">' +

                // ALLOWANCE grouped box: title bar + two sub-cells
                '<div class="m-group">' +
                '<div class="m-group-title">Allowance</div>' +
                '<div class="m-group-cells">' +
                '<div class="m-cell">' +
                '<div class="m-label">Limit</div>' +
                '<div class="m-value">' + amt('MONTHLYLIMIT') + '</div>' +
                '</div>' +
                '<div class="m-cell">' +
                '<div class="m-label">Charges</div>' +
                '<div class="m-value">' + amt('PERSONALLIMITCHARGES') + '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +

                // BUSINESS grouped box: title bar + two sub-cells
                '<div class="m-group">' +
                '<div class="m-group-title">Business</div>' +
                '<div class="m-group-cells">' +
                '<div class="m-cell">' +
                '<div class="m-label">Limit</div>' +
                '<div class="m-value">' + amt('BUSSINESSLIMIT') + '</div>' +
                '</div>' +
                '<div class="m-cell">' +
                '<div class="m-label">Charges</div>' +
                '<div class="m-value">' + amt('BUSINESSCHARGES') + '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +

                // Waiver + Personal Charges — stacked in one column
                '<div class="m-stack">' +
                '<div class="m-stack-row">' +
                '<div class="m-label">Waiver Amount</div>' +
                '<div class="m-value">' + amt('WAIVERAMOUNT') + '</div>' +
                '</div>' +
                '<div class="m-stack-row m-stack-row-bottom">' +
                '<div class="m-label">Personal Charges</div>' +
                '<div class="m-value">' + amt('PERSONALCHARGES') + '</div>' +
                '</div>' +
                '</div>' +

                // Net Deductible — right highlighted anchor
                '<div class="m-item net-ded">' +
                '<div class="m-label">Net Deductible</div>' +
                '<div class="m-value">' + amt('DEDUCTIBLEAMOUNT') + '</div>' +
                '</div>' +

                '</div>' +
                '</div>';

            // ── Assemble full page ──
            var pageContent =
                '<!DOCTYPE html><html><head>' +
                '<meta charset="utf-8"/>' +
                '<title>Bill Statement – ' + f('EMPLOYEENAME') + '</title>' +
                '<style>' + getPreviewStyles() + '</style>' +
                '</head><body>' +

                '<div class="page">' +

                // ── Header band ──
                '<div class="page-header">' +
                '<div class="title-block"><h1>Mobile Bill Statement</h1><p>Official Telecom Expense Report</p></div>' +
                '<span class="status-badge ' + statusClass + '">' + f('STATUS') + '</span>' +
                '</div>' +

                // ── Employee strip ──
                '<div class="emp-strip">' +
                '<div class="emp-name">' + f('EMPLOYEENAME') + '</div>' +
                '<div class="emp-meta">' +
                '<div><span>Mobile Number</span><strong>' + f('MOBILENO') + '</strong></div>' +
                '<div><span>Provider</span><strong>' + f('PROVIDER') + '</strong></div>' +
                '<div><span>Bill Month</span><strong>' + billMonthStr + '</strong></div>' +
                '<div><span>Last Updated</span><strong>' + f('LASTUPDATEDON') + '</strong></div>' +
                '</div>' +
                '</div>' +

                // ── Body ──
                '<div class="page-body">' +
                metricsBar +
                commentsBlock +
                '<div class="section-heading">Transaction Details</div>' +
                txnHtml +
                '</div>' +

                // ── Footer ──
                '<div class="page-footer">' +
                '<span>Generated on <strong>' +
                new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
                '</strong></span>' +
                '</div>' +

                '</div>' + // .page
                '</body></html>';

            var newWindow = window.open('', '', 'width=960,height=980,scrollbars=1,top=20,left=20');
            var doc = newWindow.document.open();
            doc.write(pageContent);
            doc.close();
            newWindow.focus();
            newWindow.onload = function () {
                newWindow.print();
            };
            // Fallback: some browsers fire onload before doc.close(), so defer as well
            setTimeout(function () {
                if (newWindow && !newWindow.closed) {
                    newWindow.focus();
                }
            }, 500);
        }
    });
}

function getPreviewStyles() {
    return "" +
        // ── Reset ──
        "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}" +

        // ── Variables ──
        // No external fonts — all system fonts available on every Windows intranet machine
        ":root{" +
        "--font-body:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;" +
        "--font-heading:Georgia,'Times New Roman',Times,serif;" +
        "--ink:#0f1923;--ink-light:#4a5568;--rule:#d1d9e0;" +
        "--accent:#1a3a5c;--accent-mid:#2d6a9f;--accent-pale:#e8f0f8;" +
        "--green:#0e6e4f;--green-pale:#e6f4f0;" +
        "--amber:#92500a;--amber-pale:#fdf3e3;" +
        "--white:#ffffff;--paper:#f7f9fc" +
        "}" +

        // ── Base ──
        "html,body{background:#cdd5de;font-family:var(--font-body);color:var(--ink);min-height:100vh;padding:32px 16px 48px}" +

        // ── Page wrapper ──
        ".page{max-width:820px;margin:0 auto;background:var(--white);border-radius:4px;box-shadow:0 4px 32px rgba(0,0,0,.18),0 1px 4px rgba(0,0,0,.10);overflow:hidden}" +

        // ── Header band ──
        ".page-header{background:var(--accent);padding:28px 36px 22px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px}" +
        ".page-header .title-block h1{font-family:var(--font-heading);font-size:26px;color:var(--white);letter-spacing:.4px;line-height:1.1}" +
        ".page-header .title-block p{font-size:12px;color:rgba(255,255,255,.6);margin-top:4px;letter-spacing:.8px;text-transform:uppercase}" +

        // ── Status badge ──
        ".status-badge{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:5px 14px;border-radius:20px;background:rgba(255,255,255,.15);color:var(--white);border:1px solid rgba(255,255,255,.3);white-space:nowrap}" +
        ".status-badge.closed{background:var(--green-pale);color:var(--green);border-color:#a8d5c7}" +
        ".status-badge.pending{background:var(--amber-pale);color:var(--amber);border-color:#f0cc96}" +

        // ── Employee strip ──
        ".emp-strip{background:var(--accent-pale);border-bottom:1px solid var(--rule);padding:14px 36px;display:flex;align-items:center;gap:32px;flex-wrap:wrap}" +
        ".emp-strip .emp-name{font-family:var(--font-heading);font-size:20px;color:var(--accent);flex:1;min-width:200px}" +
        ".emp-strip .emp-meta{display:flex;gap:28px;flex-wrap:wrap}" +
        ".emp-strip .emp-meta span{font-size:12px;color:var(--ink-light)}" +
        ".emp-strip .emp-meta strong{display:block;font-size:14px;color:var(--ink);font-weight:600;margin-top:1px}" +

        // ── Body ──
        ".page-body{padding:28px 36px 36px}" +

        // ── Metrics bar ──
        ".metrics-bar{display:flex;align-items:stretch;margin-bottom:24px;border:1px solid var(--rule);border-radius:7px;overflow:hidden}" +
        ".metric-total{background:var(--accent);padding:14px 20px;display:flex;flex-direction:column;justify-content:center;min-width:130px;flex-shrink:0}" +
        ".metric-total .m-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.65);margin-bottom:4px;white-space:nowrap}" +
        ".metric-total .m-value{font-size:22px;font-weight:700;color:var(--white);line-height:1}" +
        ".metrics-divider{width:3px;background:var(--accent-mid);flex-shrink:0}" +
        ".metrics-items{display:flex;flex:1;background:var(--paper)}" +

        // ── Single metric item ──
        ".m-item{flex:1;display:flex;flex-direction:column;justify-content:center;padding:12px 14px;border-right:1px solid var(--rule)}" +
        ".m-item:last-child{border-right:none}" +
        ".m-item .m-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--ink-light);margin-bottom:4px;white-space:nowrap}" +
        ".m-item .m-value{font-size:15px;font-weight:600;color:var(--ink);line-height:1.1}" +

        // ── Grouped metric box (Allowance / Business) ──
        ".m-group{flex:1;display:flex;flex-direction:column;border-right:1px solid var(--rule);min-width:0}" +
        ".m-group-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--white);background:var(--accent-mid);padding:3px 8px;text-align:center}" +
        ".m-group-cells{display:flex;flex:1}" +
        ".m-cell{flex:1;padding:7px 10px;border-right:1px solid var(--rule)}" +
        ".m-cell:last-child{border-right:none}" +
        ".m-cell .m-label{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-light);margin-bottom:3px;white-space:nowrap}" +
        ".m-cell .m-value{font-size:13.5px;font-weight:600;color:var(--ink)}" +

        // ── Stacked metric (Waiver + Personal Charges in one column) ──
        ".m-stack{flex:1;display:flex;flex-direction:column;border-right:1px solid var(--rule);min-width:0}" +
        ".m-stack-row{flex:1;display:flex;flex-direction:column;justify-content:center;padding:6px 12px}" +
        ".m-stack-row-bottom{border-top:1px solid var(--rule)}" +
        ".m-stack-row .m-label{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-light);margin-bottom:2px;white-space:nowrap}" +
        ".m-stack-row .m-value{font-size:13.5px;font-weight:600;color:var(--ink)}" +

        // ── Net Deductible (highlighted anchor) ──
        ".m-item.net-ded{background:var(--accent-pale);border-left:3px solid var(--accent-mid);min-width:120px;flex-shrink:0;border-right:none}" +
        ".m-item.net-ded .m-label{color:var(--accent-mid)}" +
        ".m-item.net-ded .m-value{font-size:17px;color:var(--accent);font-weight:700}" +

        // ── Section heading ──
        ".section-heading{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--ink-light);font-weight:600;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--rule)}" +

        // ── Transaction section ──
        ".txn-section{margin-bottom:24px}" +
        ".txn-group-header{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--accent-mid);background:var(--accent-pale);padding:7px 12px;border-radius:4px 4px 0 0;border:1px solid #c5d9ee;border-bottom:none}" +

        // ── Transaction table ──
        "table.txn-table{width:100%;border-collapse:collapse;font-size:12.5px}" +
        "table.txn-table thead th{background:var(--ink);color:var(--white);padding:8px 10px;text-align:left;font-weight:600;font-size:11px;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap}" +
        "table.txn-table thead th:last-child{text-align:right}" +
        "table.txn-table tbody tr:nth-child(even) td{background:var(--paper)}" +
        "table.txn-table tbody td{padding:8px 10px;border-bottom:1px solid var(--rule);color:var(--ink);vertical-align:middle}" +
        "table.txn-table tbody td:last-child{text-align:right;font-weight:500}" +

        // ── Call type badges ──
        ".call-type-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:600;letter-spacing:.3px}" +
        ".call-type-badge.personal{background:#fff0e0;color:#a0440a}" +
        ".call-type-badge.business{background:#e0f0ff;color:#0a4a80}" +
        ".call-type-badge.allowance{background:var(--green-pale);color:var(--green)}" +

        // ── Subtotal / grand total rows ──
        "tr.subtotal td{border-top:2px solid var(--ink);padding:6px 10px;font-weight:700;font-size:12.5px}" +
        "tr.subtotal td:last-child{text-align:right}" +
        "tr.subtotal td:not(:last-child){border-top:none;border-bottom:1px solid var(--rule)}" +
        "tr.grandtotal td{background:var(--ink)!important;color:#3b79b7 !important;padding:9px 10px;font-weight:700;font-size:13.5px}" +
        "tr.grandtotal td:last-child{text-align:right}" +

        // ── Comments block ──
        ".comments-block{background:var(--amber-pale);border:1px solid #e8c882;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:var(--amber)}" +
        ".comments-block .cb-label{font-weight:700;margin-bottom:3px;font-size:11px;letter-spacing:.6px;text-transform:uppercase}" +

        // ── Footer ──
        ".page-footer{border-top:1px solid var(--rule);padding:14px 36px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ink-light)}" +
        ".print-btn{background:var(--accent);color:var(--white);border:none;border-radius:5px;padding:8px 22px;font-family:var(--font-body);font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.4px}" +
        ".print-btn:hover{background:var(--accent-mid)}" +
        ".print-btn:active{transform:scale(.97);opacity:.9}" +

        // ── Print media ──
        "@media print{" +
        "html,body{background:white;padding:0}" +
        ".page{box-shadow:none;border-radius:0;max-width:100%}" +
        ".print-btn{display:none}" +
        "table.txn-table tbody tr:nth-child(even) td{background:white}" +
        "}";
}

function getDepartmentBill(departmentBillid) {
    $.ajax({
        type: "GET",
        cache: false,
        url: "/Ajax/getReportBillDepartment",
        data: { billId: departmentBillid },
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (result) {
            var myVariable = '', myVariable1 = '', tAmt = 0, GAmt = 0;
            myVariable1 += buildArcHeader(result.archiveBill);
            for (var i = 0; i < result.trans.length; i++) {
                var currentGroup = result.trans[i];
                tAmt = 0;
                myVariable += buildReportHeader(currentGroup);
                for (var j = 0; j < result.rptBill.length; j++) {
                    var currentItem = result.rptBill[j];
                    if (currentItem.TransType == currentGroup.strTrans) {
                        tAmt += currentItem.amount;
                        GAmt += currentItem.amount;
                        myVariable += buildReportRow(currentItem);
                    }
                }
                myVariable += buildSubTotal(tAmt.toFixed(3));
            }
            myVariable += buildGrandTotal(GAmt.toFixed(3));
            $("#myBillTableArc").html(myVariable);
            var gridContent = myVariable1 + $("#finalHtmlArc").html();
            printWindow(gridContent);
        }
    });
}

function printNew() {
    $.ajax({
        type: "GET",
        cache: false,
        url: "/Ajax/getReportBill",
        data: { billId: GBillId },
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (result) {
            var myVariable = '', tAmt = 0, GAmt = 0;
            for (var i = 0; i < result.trans.length; i++) {
                var currentGroup = result.trans[i];
                tAmt = 0;
                myVariable += buildReportHeader(currentGroup);
                for (var j = 0; j < result.rptBill.length; j++) {
                    var currentItem = result.rptBill[j];
                    GAmt += currentItem.amount;
                    if (currentItem.transType == currentGroup.strTrans) {
                        tAmt += currentItem.amount;
                        myVariable += buildReportRow(currentItem);
                    }
                }
                myVariable += buildSubTotal(tAmt);
            }
            myVariable += buildGrandTotal(GAmt);
            $("#myBillTable").html(myVariable);
            printWindow($("#finalHtml").html());
        }
    });
}

// ─── Print helpers ──────────────────────────────────────────
function buildArcHeader(bill) {
    if (!bill) return '';
    return `
    <table border="5" style="width:100%;border-spacing:1;">
      <tr><td style="text-align:right;padding:5px;">Employee Name</td><td><b>${bill.EMPLOYEENAME}</b></td>
          <td style="text-align:right;padding:5px;">Mobile Number</td><td><b>${bill.MOBILENO}</b></td></tr>
      <tr><td style="text-align:right;padding:5px;">Provider</td><td><b>${bill.PROVIDER}</b></td>
          <td style="text-align:right;padding:5px;">Bill Month</td><td><b>${bill.BILLDATE}</b></td></tr>
      <tr><td style="text-align:right;padding:5px;">Last Updated</td><td><b>${bill.LASTUPDATEDON}</b></td>
          <td style="text-align:right;padding:5px;">Comments</td><td><b>${bill.COMMENTS}</b></td></tr>
      <tr><td style="text-align:right;padding:5px;">Bill Status</td><td><b>${bill.STATUS}</b></td>
          <td style="text-align:right;padding:5px;">Bill Amount</td><td><b>${bill.TOTALAMOUNT}</b></td></tr>
      <tr><td style="text-align:right;padding:5px;">Allowance Limit</td><td><b>${bill.MONTHLYLIMIT}</b></td>
          <td style="text-align:right;padding:5px;">Business Limit</td><td><b>${bill.BUSSINESSLIMIT}</b></td></tr>
      <tr><td style="text-align:right;padding:5px;">Allowance Charges</td><td><b>${bill.PERSONALLIMITCHARGES}</b></td>
          <td style="text-align:right;padding:5px;">Business Charges</td><td><b>${bill.BUSINESSCHARGES}</b></td></tr>
      <tr><td style="text-align:right;padding:5px;">Personal Charges</td><td><b>${bill.PERSONALCHARGES}</b></td>
          <td style="text-align:right;padding:5px;">Waiver Amount</td><td><b>${bill.WAIVERAMOUNT}</b></td></tr>
      <tr><td style="text-align:right;padding:5px;">Deductable Amount</td><td colspan="3"><b>${bill.DEDUCTIBLEAMOUNT}</b></td></tr>
    </table>`;
}

function buildReportHeader(group) {
    return `<tr>
      <th style="width:15%;font-weight:bold;border-bottom:1pt solid black;text-align:center;">Transaction Type</th>
      <th style="width:10%;font-weight:bold;border-bottom:1pt solid black;text-align:center;">Subscrb No.</th>
      <th style="width:10%;font-weight:bold;border-bottom:1pt solid black;text-align:center;">Call Date</th>
      <th style="width:25%;font-weight:bold;border-bottom:1pt solid black;text-align:center;">Description</th>
      <th style="width:10%;font-weight:bold;border-bottom:1pt solid black;text-align:center;">Duration</th>
      <th style="width:15%;font-weight:bold;border-bottom:1pt solid black;text-align:center;">Call Type</th>
      <th style="width:10%;font-weight:bold;border-bottom:1pt solid black;text-align:center;">Amount</th>
    </tr>`;
}

function buildReportRow(item) {
    return `<tr>
      <td style="width:15%;text-align:center;">${item.transType || ''}</td>
      <td style="width:10%;text-align:center;">${item.callTime || ''}</td>
      <td style="width:10%;text-align:center;">${item.callDate || ''}</td>
      <td style="width:25%;text-align:center;">${item.description || ''}</td>
      <td style="width:10%;text-align:center;">${item.duration || ''}</td>
      <td style="width:15%;text-align:center;">${item.callType || ''}</td>
      <td style="width:10%;text-align:center;">${item.amount || ''}</td>
    </tr>`;
}

function buildSubTotal(tot) {
    return `<tr><td></td><td></td><td></td><td></td><td></td><td></td>
    <td style="width:15%;text-align:center;font-weight:bold;border-top:1pt solid black;border-bottom:1pt solid black">${tot}</td></tr>`;
}

function buildGrandTotal(gTot) {
    return `<tr><td></td><td></td><td></td><td></td><td></td><td></td>
    <td style="width:15%;text-align:center;font-weight:bold;border-top:1pt solid black;border-bottom:1pt solid black">${gTot}</td></tr>`;
}

function printWindow(content) {
    var newWindow = window.open('', '', 'width=900, height=950, scrollbars=1, top=1, left=1');
    var doc = newWindow.document.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>My Bill</title></head><body>' + content + '</body></html>');
    doc.close();
    newWindow.print();
}

// ─── Approval Window ────────────────────────────────────────
function openWindow(billid) {
    getApprovalBill(billid);
}

function getApprovalBill(billid) {
    // Populate modal header from the cached approval row (myAB)
    var bill = (myAB || []).find(function (b) { return b.billId == billid; }) || {};
    $('#apprModalEmpName').text(bill.name || '—');
    $('#apprModalMobile').text(bill.subNo || '—');
    $('#apprModalDate').text(bill.billDate || '—');
    $('#apprModalOrg').text(bill.org || '—');
    $('#apprModalTotal').text(parseFloat(bill.total || 0).toFixed(3));
    $('#apprModalBizLim').text(bill.businessLimit ? parseFloat(bill.businessLimit).toFixed(3) : '0.000');
    $('#apprModalBizCh').text(parseFloat(bill.businessCharges || 0).toFixed(3));
    $('#apprModalDed').text(parseFloat(bill.deductableAmount || 0).toFixed(3));

    $.ajax({
        type: "GET",
        cache: false,
        url: "/Ajax/GetBillDetailsApproval",
        data: { id: billid, type: 1 },
        success: function (result) {
            setDataSourceGridApproval(result.bill_details);
            var modal = new bootstrap.Modal(document.getElementById('approvalDetailModal'));
            modal.show();
        },
        error: function () {
            showToast('Could not load call details', 'danger');
        }
    });
}

// ─── DoApprove ──────────────────────────────────────────────
// `opt` is passed straight through to sp_Approve, which uses it AS the new
// tblBills.STATUS value (literally: UPDATE tblBills SET status = @opt).
// Callable values:
//   4 = approve (status 4 → closed/approved, triggers "approved" email template 3)
//   1 = reject  (status 1 → back to employee, triggers "rejected" email template 4)
// Anything else (e.g. 0) leaves the bill in an undefined state — don't call it that way.
// The reject path additionally requires a comment per bill.
function DoApprove(opt) {
    // 1) Collect selected bill IDs from whichever surface is active.
    //    Desktop: rows with `.selected` inside dtApprBills.
    //    Mobile:  cards in #mobApprCards with `.selected` class.
    var selectedBillIds = [];
    var seen = {};
    function push(id) {
        var n = parseInt(id);
        if (n && !seen[n]) { seen[n] = true; selectedBillIds.push(n); }
    }
    if (dtApprBills) {
        dtApprBills.rows('.selected').every(function () {
            push($(this.node()).data('billid'));
        });
    }
    $('#mobApprCards .mob-appr-card.selected').each(function () {
        push($(this).data('billid'));
    });
    if (selectedBillIds.length === 0) {
        Swal.fire({ icon: 'info', title: 'No selection', text: 'Select one or more bills first.' });
        return;
    }

    // 2) Build payload. Match the C# AppBills model property names exactly:
    //    public string Id; public string? Comment;  (System.Text.Json case-insensitive)
    //    — sending "Comm" silently dropped the rejection reason on the server side.
    var payload = [];
    for (var ii = 0; ii < selectedBillIds.length; ii++) {
        var billId = selectedBillIds[ii];
        var row = (myAB || []).find(function (b) { return b.billId == billId; });
        if (!row) continue;
        var comment = (row.aComments || '').toString().trim();
        if (opt == 1 && comment === '') {
            Swal.fire({ icon: 'error', title: 'Info Needed', text: 'Please enter a Rejection Reason for every selected bill.' });
            return;
        }
        payload.push({ Id: String(billId), Comment: comment });
    }

    var obji = { CallLogs: payload, Opt: opt, Uid: uid };
    var verb = (opt === 1) ? 'Reject' : 'Approve';
    var verbed = (opt === 1) ? 'rejected' : 'approved';
    var plural = payload.length > 1;

    // 3) Confirmation prompt — user must click Yes before anything is sent.
    var confirmText = (opt === 1)
        ? ('Are you sure you want to Reject the Bill' + (plural ? 's' : '') + '?')
        : ('Are you sure you want to Approve' + (plural ? ' these ' + payload.length + ' bills' : ' this bill') + '?');

    Swal.fire({
        icon: (opt === 1) ? 'warning' : 'question',
        title: confirmText,
        text: (opt === 1)
            ? 'The bill will be sent back to the employee with your rejection reason.'
            : 'This will mark the bill as approved and notify the employee.',
        showCancelButton: true,
        confirmButtonText: (opt === 1) ? 'Yes, Reject' : 'Yes, Approve',
        cancelButtonText:  'Cancel',
        confirmButtonColor: (opt === 1) ? '#d94040' : '#10b981',
        reverseButtons: true
    }).then(function (result) {
        if (!result.isConfirmed) return;
        _doApproveCommit(opt, obji, payload, verb, verbed);
    });
}

// Actual request — split out so the confirmation prompt above can `return`
// without sending anything when the user cancels.
function _doApproveCommit(opt, obji, payload, verb, verbed) {
    Swal.fire({
        title: 'Please wait…',
        html: verb + 'ing ' + payload.length + ' bill' + (payload.length > 1 ? 's' : '') + '…',
        allowOutsideClick: false, showConfirmButton: false,
        didOpen: function () { Swal.showLoading(); }
    });

    // 4) Approve / reject the bill(s). The server-side ApproveBills also runs
    //    SendEmailApprove() internally, but we follow it with an explicit
    //    POST /Import/SendEmail (sp_GetEmailPipeLine) so the email dispatch
    //    is visible in the request log and any failure produces a toast
    //    instead of going silent — same pattern as ProcessBill.
    $.ajax({
        type: "POST", cache: false,
        url: "/Ajax/ApproveBills",
        contentType: 'application/json',
        data: JSON.stringify(obji),
        success: function (result) {
            if (result && result.myMessage) {
                Swal.close();
                Swal.fire({ icon: 'error', title: 'Error', text: result.myMessage });
                return;
            }
            AppBills = result || {};
            setDataSourceApproval(AppBills);

            // Fire the email pipeline after the bill state is committed.
            $.ajax({
                type: "POST", cache: false,
                url: "/Import/SendEmail",
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function () {
                    Swal.close();
                    Swal.fire({
                        icon: 'success', title: 'Done',
                        text: payload.length + ' bill' + (payload.length > 1 ? 's' : '') + ' ' + verbed + ' — email sent.',
                        timer: 1800, showConfirmButton: false
                    });
                },
                error: function () {
                    // Bill state is already updated server-side; email is best-effort.
                    Swal.close();
                    if (typeof showToast === 'function') {
                        showToast('Email notification could not be sent', 'warning');
                    }
                    Swal.fire({
                        icon: 'success', title: 'Done',
                        text: payload.length + ' bill' + (payload.length > 1 ? 's' : '') + ' ' + verbed + '.',
                        timer: 1800, showConfirmButton: false
                    });
                }
            });
        },
        error: function (xhr) {
            Swal.close();
            if (xhr && xhr.status === 403) {
                Swal.fire({ icon: 'error', title: 'Forbidden', text: 'You do not have permission to ' + verb.toLowerCase() + ' bills.' });
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not ' + verb.toLowerCase() + ' the selected bills.' });
            }
        }
    });
}

// ─── Approval Detail Grid ───────────────────────────────────
function setDataSourceGridApproval(bill_details) {
    myBillDet = bill_details;
    if (dtApprDet) { dtApprDet.destroy(); dtApprDet = null; }
    $('#tblApprDet tbody').empty();

    var rows = '';
    (bill_details || []).forEach(function (r) {
        var ctLabel = r.callType == 1 ? 'Business' : r.callType == 2 ? 'Personal' : r.callType == 3 ? 'Allowance' : '';
        var ctClass = r.callType == 1 ? 'ap-ct-b' : r.callType == 2 ? 'ap-ct-p' : r.callType == 3 ? 'ap-ct-a' : '';
        var pill    = ctLabel ? `<span class="ap-ct-pill ${ctClass}">${ctLabel}</span>` : '';
        rows += `<tr>
          <td>${formatDate(r.callDate)}</td>
          <td>${formatTime(r.callTime)}</td>
          <td>${r.transType || ''}</td>
          <td>${r.description || ''}</td>
          <td>${r.duration || ''}</td>
          <td class="text-end">${parseFloat(r.amount || 0).toFixed(3)}</td>
          <td>${pill}</td>
          <td>${r.comment || ''}</td>
        </tr>`;
    });
    //for (let i = 1; i <= 15; i++) {

    //    rows += `
    //<tr>
    //    <td>01/05/2026</td>
    //    <td>10:30 AM</td>
    //    <td>Outgoing</td>
    //    <td>Test Call ${i}</td>
    //    <td>00:05:20</td>
    //    <td class="text-end">1.250</td>
    //    <td><span class="ap-ct-pill ap-ct-b">Business</span></td>
    //    <td>Test comment ${i}</td>
    //</tr>`;
    //}
    $('#tblApprDet tbody').html(rows);

    // Build the mobile card view too (desktop table is hidden on mobile).
    buildApprovalDetailMobileCards(bill_details);

    dtApprDet = $('#tblApprDet').DataTable({
        responsive: false,
        layout: false,
        dom: 't',
        ordering:false,
        pageLength: 10,
        order: [[0, 'asc']],
        destroy: true,
        searching: false,   // removes search box
        paging: false,      // removes pagination
        lengthChange: false,
        scrollY: "50vh",
        scrollCollapse: false,
        language: {
            search: '<i class="fa fa-search"></i>', searchPlaceholder: 'Search...', info: "Showing _TOTAL_ entries"}
    });
}

// ─── Archived Bills Grid ────────────────────────────────────
function setDataSourceArchived(mybill) {
    myBillDet = mybill.dtBills || [];
    if (dtArcBills) { dtArcBills.destroy(); dtArcBills = null; }
    $('#tblArcBills tbody').empty();

    var rows = '';
    myBillDet.forEach(function (r) {
        rows += `<tr>
          <td data-label="Bill Date">${formatMonthYear(r.billDate)}</td>
          <td data-label="Provider">${r.provider || ''}</td>
          <td data-label="Employee Name">${r.employeeName || ''}</td>
          <td data-label="Mobile">${r.mobile || ''}</td>
          <td data-label="Amount" class="text-end">${parseFloat(r.totalAmount || 0).toFixed(3)}</td>
          <td data-label="Currency">${r.currency || ''}</td>
          <td data-label="Deduction" class="text-end">${parseFloat(r.deductable || 0).toFixed(3)}</td>
          <td data-label="Last Update">${r.lastUpdate || ''}</td>
          <td data-label="Status">${r.status || ''}</td>
          <td data-label="Action" class="text-center">
            <button class="btn btn-sm arc-view-btn" onclick="getMyArcBill(${r.billId})">
              <i class="fa fa-eye me-1"></i>View
            </button>
          </td>
        </tr>`;
    });
    $('#tblArcBills tbody').html(rows);

    dtArcBills = $('#tblArcBills').DataTable({
        responsive: false,
        searching: true,    // required for topbar #globalSearch to filter
        paging: true,
        pageLength: 10,
        info: true,
        lengthChange: false,
        destroy: true,
        dom: 'tip',         // table + info + pagination only (no built-in search box)
        order: [[0, 'desc']]
    });

    var rowscounts = myBillDet.length;
    $('#lblBillsHistoryCnt').text(rowscounts);
    $('#lblBillsHistory').html(rowscounts);

    // Build the mobile card view (.tw is display:none on mobile — without
    // this, Bills History would appear empty on phones).
    if (typeof buildMobileArchivedCards === 'function') buildMobileArchivedCards(myBillDet);

    // Sidebar badge (single source of truth for the History count)
    var sbH = document.getElementById('sbBadgeHistory');
    if (sbH) { sbH.textContent = rowscounts; sbH.style.display = rowscounts > 0 ? '' : 'none'; }

    // Re-apply the topbar search term so it survives a rebuild (destroy:true wipes it).
    if (typeof applyGlobalSearch === 'function') applyGlobalSearch($('#globalSearch').val() || '');
}

// ─── Department Bills Grid ──────────────────────────────────
function setDataSourceDepartmentBill(DepartmentBill) {
    DepartmentBillDet = DepartmentBill.dtBills || [];
    if (dtDeptBills) { dtDeptBills.destroy(); dtDeptBills = null; }
    $('#tblDeptBills tbody').empty();

    var rows = '';
    DepartmentBillDet.forEach(function (r) {
        rows += `<tr>
          <td data-label="Bill Date">${formatMonthYear(r.billDate)}</td>
          <td data-label="Provider">${r.provider || ''}</td>
          <td data-label="Employee Name">${r.employeeName || ''}</td>
          <td data-label="Mobile">${r.mobile || ''}</td>
          <td data-label="Amount" class="text-end">${parseFloat(r.totalAmount || 0).toFixed(3)}</td>
          <td data-label="Currency">${r.currency || ''}</td>
          <td data-label="Deduction" class="text-end">${parseFloat(r.deductable || 0).toFixed(3)}</td>
          <td data-label="Last Update">${r.lastUpdate || ''}</td>
          <td data-label="Status">${r.status || ''}</td>
        </tr>`;
    });
    $('#tblDeptBills tbody').html(rows);

    dtDeptBills = $('#tblDeptBills').DataTable({
        responsive: false, pageLength: 10, destroy: true,
        language: { search: '<i class="fa fa-search"></i>', searchPlaceholder: 'Search...' }
    });

    var cnt = DepartmentBillDet.length;
    $('#lblBillsDepartmentCnt').text(cnt);
    $('#lblBillsDepartment').html(cnt);
}

// ─── Approval Bills Grid ────────────────────────────────────
function setDataSourceApproval(result) {
    myBills = result.dtBills || [];
    myAB = result.dtBills || [];

    if (dtApprBills) { dtApprBills.destroy(); dtApprBills = null; }
    $('#tblApprBills tbody').empty();

    var cnt = myBills.length;
    var totalAmt = 0;
    myBills.forEach(function (r) { totalAmt += parseFloat(r.total || 0); });

    // Header stats + sidebar badge (single source of truth for the count)
    $('#apprStatCount').text(cnt);
    $('#apprStatTotal').text(totalAmt.toFixed(3));
    $('#lblPendingApprovalCnt').text(cnt);
    $('#lblPendingApproval').text(cnt);
    var sb = document.getElementById('sbBadgeApproval');
    if (sb) { sb.textContent = cnt; sb.style.display = cnt > 0 ? '' : 'none'; }

    // Hide the entire "Pending Approval" sidebar nav item when there's nothing to approve.
    // If the user is currently viewing the approval tab when it goes empty, fall back to My Bills.
    var navAppr = document.getElementById('nav-approval');
    if (navAppr) {
        navAppr.style.display = cnt > 0 ? '' : 'none';
        if (cnt === 0 && navAppr.classList.contains('active') && typeof switchView === 'function') {
            switchView('mybills');
        }
    }

    // Empty state
    if (cnt === 0) {
        $('#apprEmpty').show();
        $('#apprTableSection').hide();
        $('#apprActions').hide();
        $('#mobApprCards').empty();
        return;
    }
    $('#apprEmpty').hide();
    $('#apprTableSection').show();
    $('#apprActions').show();

    // Build the mobile card view (.tw is display:none on mobile — without
    // this, Pending Approval would appear empty on phones).
    if (typeof buildMobileApprovalCards === 'function') buildMobileApprovalCards(myBills);

    var rows = '';
    myBills.forEach(function (r) {
        var nm = (r.name || '').trim();
        var initials = nm.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').substring(0,2).toUpperCase() || '?';
        var amount   = parseFloat(r.total || 0).toFixed(3);
        var bizLim   = (r.businessLimit && parseFloat(r.businessLimit) > 0) ? parseFloat(r.businessLimit).toFixed(3) : '0.000';
        var bizChNum = parseFloat(r.businessCharges || 0);
        var bizCh    = bizChNum.toFixed(3);
        var waiverNum= parseFloat(r.waiverAmount || 0);
        var waiver   = waiverNum > 0 ? waiverNum.toFixed(3) : '—';
        var bizLimNum= parseFloat(r.businessLimit || 0);
        var over     = bizLimNum > 0 && bizChNum > bizLimNum;
        var comm     = (r.comments || '').replace(/"/g,'&quot;');

        rows += `<tr data-billid="${r.billId}">
          <td class="text-center">
            <button class="appr-view-btn" type="button"
                    onclick="event.stopPropagation();openWindow(${r.billId})"
                    title="View call details">
              <i class="fa fa-eye"></i>
            </button>
          </td>
          <td>${r.billDate || ''}</td>
          <td>
            <div class="ap-emp">
              <div>
                <div class="nm">${nm || '—'}</div>
                <div class="org">${r.org || ''}</div>
              </div>
            </div>
          </td>
          <td>${r.subNo || ''}</td>
          <td class="text-center ap-amt">${amount}</td>
          
          <td class="text-center ap-amt ${over ? 'over' : ''}">${bizCh}</td>
          <td class="text-end ap-amt ${waiver === '—' ? 'muted' : 'pos'}">${waiver}</td>
          <td><span class="d-inline-block text-truncate" style="max-width:180px"
                    title="${comm}">${comm || '<span class="ap-amt muted">—</span>'}</span></td>
          <td><input type="text" class="appr-comment-input"
                     id="txtComm${r.billId}" value="${(r.aComments || '').replace(/"/g,'&quot;')}"
                     onblur="saveComment(${r.billId})"
                     placeholder="Reason if rejecting..." /></td>
        </tr>`;

    });
    $('#tblApprBills tbody').html(rows);

    dtApprBills = $('#tblApprBills').DataTable({
        responsive: false,
        layout: false,
        dom: 't',
        ordering: false,
        pageLength: 10,
        destroy: true,
        searching: true,    // required for topbar #globalSearch to filter
        paging: false,      // removes pagination
        info:false,
        lengthChange: false,
        scrollY: "60vh",
        scrollX: false,
        scrollCollapse: false,
        order: [[1, 'desc']]
    });

    // Row selection — skip if click landed on an input or button inside the row
    $('#tblApprBills tbody').off('click', 'tr').on('click', 'tr', function (e) {
        if ($(e.target).closest('input, button, .appr-view-btn').length) return;
        $(this).toggleClass('table-primary selected');
    });

    // Re-apply the topbar search term so it survives a rebuild (destroy:true wipes it).
    if (typeof applyGlobalSearch === 'function') applyGlobalSearch($('#globalSearch').val() || '');
}

function saveComment(commentId) {
    if (commentId != 0) {
        for (var i = 0; i < myAB.length; i++) {
            if (myAB[i].billId === commentId) {
                try { myAB[i].aComments = $('#txtComm' + commentId).val(); } catch (e) { }
            }
        }
    }
    for (var ii = 0; ii < myAB.length; ii++) {
        try { $('#txtComm' + myAB[ii].billId).val(myAB[ii].aComments); } catch (e) { }
    }
}

// ─── Master Grid (with nested child) ───────────────────────
function setDataSourceGridMaster(result) {
    myBills = result.dtBills || [];

    if (dtMaster) { dtMaster.destroy(); dtMaster = null; }
    $('#tblBillMaster tbody').empty();

    // Remove all existing child rows
    $('#tblBillMaster tbody').find('.bill-child-row').remove();

    var rows = '';
    myBills.forEach(function (r) {
        var commentTxt = (r.comments || '').toString();
        var commentEsc = commentTxt.replace(/"/g, '&quot;');
        rows += `<tr class="master-row" data-billid="${r.id}" data-managername="${r.managerName || ''}">
          <td data-label="Provider">${r.providerName || ''}</td>
          <td data-label="Date" class="text-center">${formatMonthYear(r.billDate)}</td>
          <td data-label="Employee Name">${r.empName || ''}</td>
          <td data-label="Mobile" class="text-center">${r.mobile || ''}</td>
          <td data-label="Amount (KD)" class="text-center">${parseFloat(r.totalAmount || 0).toFixed(3)}</td>
          <td data-label="Last Updated" class="text-center">${r.lastUpdatedOn ? formatDateShort(r.lastUpdatedOn) : ''}</td>
          <td data-label="Comment" title="${commentEsc}">${commentTxt || ''}</td>
          <td data-label="Action" class="text-center">
            <button type="button" class="btn btn-sm btn-primary process-row-btn"
                    title="Open this bill to identify calls and process">
              <i class="fa fa-check-circle me-1"></i>Process Bill
            </button>
          </td>
        </tr>`;
    });
    $('#tblBillMaster tbody').html(rows);

    dtMaster = $('#tblBillMaster').DataTable({
        responsive: false,
        searching: true,        // required for topbar #globalSearch to filter
        info: false,
        paging:false,
        lengthChange: false,
        pageLength: 7,
        destroy: true,
        dom: 'tp',
        order: [[2, 'desc']],
        columnDefs: [{ orderable: false, targets: 0 }],
        language: { search: '<i class="fa fa-search"></i>', searchPlaceholder: 'Search...' }
    });

    // Re-apply the topbar search term so it survives a rebuild (destroy:true wipes it).
    if (typeof applyGlobalSearch === 'function') applyGlobalSearch($('#globalSearch').val() || '');

    var cnt = myBills.length;
    $('#lblPendingIdentificationCnt').text(cnt);
    $('#lblPendingIdentificationCount').html(cnt);

    // Sidebar badge (single source of truth for the My Bills count)
    var sbP = document.getElementById('sbBadgePending');
    if (sbP) { sbP.textContent = cnt; sbP.style.display = cnt > 0 ? '' : 'none'; }

    // Row click is intentionally a no-op — the bill detail modal is now opened
    // only via the .process-row-btn in the Action column (see the capture-phase
    // listener in index-page.js). Detach any previously bound handler so child-
    // row expand/collapse doesn't fire on row clicks.
    $('#tblBillMaster tbody').off('click', 'tr.master-row');
    // Also remove the pointer cursor inherited from _bill-master.scss so the
    // row doesn't visually invite a click.
    $('#tblBillMaster tbody tr.master-row').css('cursor', 'default');
}

// ─── Bill Details (child) ───────────────────────────────────
function getUBillDetails(billid, $childRow) {
    $.ajax({
        type: "GET",
        cache: false,
        url: "/Ajax/getBillDetails",
        data: { id: billid, type: 0 },
        success: function (result) {
            Settings = result.setting;
            itemData = result.bill_details;
            myABB = result.bill_details;
            if (itemData) {
                for (var k = 0; k < itemData.length; k++) {
                    itemData[k].origCallType = itemData[k].callType;
                }
            }
            console.log(Settings);
            bc = 0.0; pc = 0.0; ac = 0.0; uc = 0.0;
            for (var i = 0; i < itemData.length; i++) {
                var item = itemData[i];
                var ct = parseInt(item.callType + '');
                if (ct == 0) uc += item.amount;
                if (ct == 1) bc += item.amount;
                if (ct == 2) pc += item.amount;
                if (ct == 3) ac += item.amount;
            }

            blim = result.blim;
            plim = result.plim;
            alim = result.mlim;
            isbus = Settings.dedBussinessCharges;
            isper = Settings.dedPersonalCharges;
            HidePer = Settings.hidePersonalLimit;

            var isallow = Settings.hideAllowanceLimit;
            var ispersonal = Settings.hidePersonalLimit;

            if (itemData.length > 0) {
                var childHtml = buildChildContent(result, isallow, ispersonal);
                $childRow.find('.child-container').html(childHtml);
                renderDetailsTable(itemData, $childRow);
                recalcTotals();
            } else {
                $childRow.find('.child-container').html('<p class="text-muted p-3">No bill details found.</p>');
            }
        }
    });
}

function buildChildContent(result, isallow, ispersonal) {
    var allowBlock = isallow ? '' : `
      <div class="bill-section allowance-section">
        <div class="bill-group">
            <div class="bill-group-title">Allowance</div>
            <div class="d-flex gap-3">

                <div class="bill-item">
                    <span class="info-label">Limit</span>
                    <span id="alimit" class="info-value">0.000</span>
                </div>

                <div class="bill-item">
                    <span class="info-label">Charges</span>
                    <span id="alwCharge" class="info-value">0.000</span>
                </div>

                <div class="bill-item">
                    <span class="info-label">Deduction</span>
                    <span id="atot" class="info-value fw-bold">0.000</span>
                </div>

            </div>
        </div>
      </div>`;

    var persBlock = false ? '' : `
      <div class="bill-section personal-section">
        <div class="bill-group">
            <span class="info-label">Personal Deduction</span>
            <span id="ptot" class="info-value fw-bold">0.000</span>
        </div>
      </div>`;

    return `
    <!-- Info Cards -->
    <div class="bill-info-card mb-3" id='something'>
        <div class="bill-info-container">
        ${allowBlock}
      <div class="bill-section business-section">
        <div class="bill-group">
            <div class="bill-group-title">Business</div>
            <div class="d-flex gap-3">
                <div class="bill-item">
                    <span class="info-label">Limit</span>
                    <span id="blimit" class="info-value">0.000</span>
                </div>

                <div class="bill-item">
                    <span class="info-label">Charges</span>
                    <span id="busCharge" class="info-value">0.000</span>
                </div>

                <div class="bill-item">
                    <span class="info-label">Deduction</span>
                    <span id="btot" class="info-value fw-bold">0.000</span>
                </div>
            </div>
        </div>
      </div>
      ${persBlock}
      <div class="bill-section net-total-section">
        <div class="bill-item net-total-item">
          <span class="info-label fw-bold">Net Deductable Amount</span>
          <span id="nettotal" class="value net-total">0.000</span>
        </div>
      </div>
    </div>
        </div>
    <!-- Details DataTable -->
    <div class="table-responsive mb-3">
      <table id="tblBillDetails" class="table table-sm table-hover table-bordered dt-details w-100">
        <thead class="table-dark">
          <tr>
            <th>Call Date</th>
            <th>Call Time</th>
            <th>Trans Type</th>
            <th>Description</th>
            <th>Contact</th>
            <th>Duration</th>
            <th class="text-end">Amount</th>
            <th>Call Type</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <!-- Action Bar -->
    <div class="action-bar d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 bg-light rounded-3 border">
      <div class="d-flex align-items-center flex-wrap gap-3">
        <div class="d-flex align-items-center gap-2">
          <label class="form-label mb-0 fw-semibold small">Select All Call Type</label>
          <select class="form-select form-select-sm" style="min-width:160px;" id="cmbChangeOpt">
            <option value="0">Unidentified</option>
            <option value="1">All</option>
          </select>
        </div>
        <div class="d-flex align-items-center gap-2">
          <label class="form-label mb-0 fw-semibold small">As</label>
          <select class="form-select form-select-sm" style="min-width:160px;" id="myCallType" onchange="ChangeCallType()">
            <option value="">Select</option>
            <option value="1">Business</option>
            <option value="2">Personal</option>
          </select>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <input type="hidden" id="hdnBillID" value="0" />
        <span id="txtManagerName" style="display:none;"></span>
        <button class="btn btn-primary btn-sm" id="btnSave" onclick="SaveChanges()">
          <i class="fa fa-floppy-disk me-1"></i> Save
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Print()">
          <i class="fa fa-print me-1"></i> Print Bill
        </button>
        <button class="btn btn-success btn-sm" id="btnProcess" onclick="ProcessBill()">
          <i class="fa fa-check-circle me-1"></i> Process Bill
        </button>
      </div>
    </div>`;
}

function renderDetailsTable(bill_details, $childRow) {
    myABB = bill_details;
    if (dtDetails) { try { dtDetails.destroy(); } catch (e) { } dtDetails = null; }

    var rows = '';
    (bill_details || []).forEach(function (r) {
        var ct = parseInt(r.callType + '');
        var s1 = ct == 1 ? 'checked' : '';
        var s2 = ct == 2 ? 'checked' : '';
        var s3 = ct == 3 ? 'checked' : '';
        var s5 = ct == 5 ? 'checked' : '';
        var s4 = ct == 4 ? 'checked' : '';

        var radioHtml = '';
        if (r.locked) {
            if (ct == 1) radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="1" onclick="handleClick(this,${r.id})" disabled ${s1}> Business</label>`;
            if (ct == 2) radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="2" onclick="handleClick(this,${r.id})" disabled ${s2}> Personal</label>`;
            if (ct == 3) radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="3" onclick="handleClick(this,${r.id})" disabled ${s3}> Allowance</label>`;
            if (ct == 5) radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="5" onclick="handleClick(this,${r.id})" disabled ${s5}> Ext.Allow</label>`;
        } else {
            radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="1" onclick="handleClick(this,${r.id})" ${s1}> Business</label>`;
            radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="2" onclick="handleClick(this,${r.id})" ${s2}> Personal</label>`;
            if (ct == 3) radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="3" onclick="handleClick(this,${r.id})" ${s3}> Allowance</label>`;
            if (ct == 5) radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="5" onclick="handleClick(this,${r.id})"> Ext.Allow</label>`;
            if (Settings && Settings.enableDiscrepancy) {
                radioHtml += `<label class="radio-lbl"><input type="radio" name="rd${r.id}" value="4" onclick="handleClick(this,${r.id})" ${s4}> Faulty</label>`;
            }
        }

        var rowClass = (ct == 0) ? 'class="unidentified-row"' : '';
        rows += `<tr ${rowClass}>
          <td data-label="Call Date">${formatDate(r.callDate)}</td>
          <td data-label="Call Time">${formatTime(r.callTime)}</td>
          <td data-label="Trans Type">${r.transType || ''}</td>
          <td data-label="Description">${r.description || ''}</td>
          <td data-label="Contact">${r.name || ''}</td>
          <td data-label="Duration">${r.duration || ''}</td>
          <td data-label="Amount" class="text-end">${parseFloat(r.amount || 0).toFixed(3)}</td>
          <td data-label="Call Type"><div class="radio-group">${radioHtml}</div></td>
          <td data-label="Comment"><input type="text" id="txtComment${r.Id}" class="form-control form-control-sm comment-input"
               value="${(r.comment || '').replace(/"/g, '&quot;')}" onblur="saveComments(${r.id})" /></td>
        </tr>`;
    });

    var $tbl = $childRow.find('#tblBillDetails');
    $tbl.find('tbody').html(rows);

    // Set limit values
    $('#blimit').html(parseFloat(blim || 0).toFixed(3));
    $('#plimit').html(parseFloat(plim || 0).toFixed(3));
    $('#alimit').html(parseFloat(alim || 0).toFixed(3));
    $('#alwCharge').html(ac.toFixed(3));
    $('#busCharge').html(bc.toFixed(3));
    $('#perCharge').html(pc.toFixed(3));

    dtDetails = $tbl.DataTable({
        responsive: false,
        paging: false,
        searching: false,
        info: false,
        destroy: true,
        order: [[0, 'asc']],
        columnDefs: [{ orderable: false, targets: [7, 8] }]
    });
}

function closeChildRow() {
    $('.bill-child-row').remove();
    $('.master-row').removeClass('table-active');
    $('.expand-toggle i').removeClass('fa-minus-circle text-danger').addClass('fa-plus-circle text-primary');
}

// ─── saveComments ───────────────────────────────────────────
function saveComments(commentId) {
    if (commentId != 0) {
        for (var i = 0; i < myABB.length; i++) {
            if (myABB[i].Id === commentId) {
                try { myABB[i].Comment = $('#txtComment' + commentId).val(); } catch (e) { }
            }
        }
    }
    for (var ii = 0; ii < myABB.length; ii++) {
        try { $('#txtComment' + myABB[ii].Id).val(myABB[ii].Comment); } catch (e) { }
    }
}

// ─── Recalculate Totals ──────────────────────────────────────
function recalcTotals() {
    var BL = parseFloat(blim || 0);
    var BC = parseFloat(bc || 0);
    var PL = parseFloat(plim || 0);
    var PC = parseFloat(pc || 0);
    var AL = parseFloat(alim || 0);
    var AC = parseFloat(ac || 0);

    if (BC > BL && isbus) {
        $('#btot').html((Settings.isZeroUnlimited && BL == 0) ? '0.000' : (BC - BL).toFixed(3));
    } else { $('#btot').html('0.000'); }

    if (PC > PL && isper) {
        $('#ptot').html((Settings.isZeroUnlimited2 && PL == 0) ? '0.000' : (PC - PL).toFixed(3));
    } else { $('#ptot').html('0.000'); }

    if (HidePer) { $('#plimit').html('0.000'); $('#ptot').html(PC.toFixed(3)); }

    if (AC > AL) { $('#atot').html((AC - AL).toFixed(3)); } else { $('#atot').html('0.000'); }

    var net = parseFloat($('#ptot').html() || 0) + parseFloat($('#btot').html() || 0) + parseFloat($('#atot').html() || 0);
    $('#nettotal').html(net.toFixed(3));
}

// ─── handleClick (radio buttons in details table) ──────────
function handleClick(myRadio, id) {
    if ($("#chkLiveTag").is(':checked')) {
        LiveTag(myRadio, id);
        return;
    }
    var oldVal;
    for (var i = 0; i < itemData.length; i++) {
        if (itemData[i].id === id) {
            oldVal = itemData[i].callType;
            itemData[i].callType = myRadio.value;
            break;
        }
    }
    var ct = parseInt(myRadio.value);
    var ct1 = parseInt(oldVal);
    var item = itemData.filter(function (el) { return el.id == id; })[0];

    if (ct == 0) uc += item.amount; if (ct == 1) bc += item.amount;
    if (ct == 2) pc += item.amount; if (ct == 3) ac += item.amount;
    if (ct1 == 0) uc -= item.amount; if (ct1 == 1) bc -= item.amount;
    if (ct1 == 2) pc -= item.amount; if (ct1 == 3) ac -= item.amount;

    $('#alwCharge').html(ac.toFixed(3));
    $('#busCharge').html(bc.toFixed(3));
    $('#perCharge').html(pc.toFixed(3));

    // Update row class
    var $row = $("input[name='rd" + id + "']").closest('tr');
    if (ct == 0) { $row.addClass('unidentified-row'); } else { $row.removeClass('unidentified-row'); }

    recalcTotals();
}

// ─── LiveTag ────────────────────────────────────────────────
function LiveTag(myRadio, id) {
    var LTItem = itemData.filter(function (el) { return el.id == id; });
    if (!LTItem.length) return;
    bc = 0; pc = 0; ac = 0; uc = 0;
    for (var i = 0; i < itemData.length; i++) {
        var curItem = itemData[i];
        if (curItem.transType == LTItem[0].transType && curItem.description == LTItem[0].description && !curItem.locked) {
            curItem.callType = myRadio.value;
            $("input[name='rd" + curItem.id + "'][value=" + curItem.callType + "]").prop('checked', true);
        }
        var ct = parseInt(curItem.callType + '');
        if (ct == 0) uc += curItem.amount;
        if (ct == 1) bc += curItem.amount;
        if (ct == 2) pc += curItem.amount;
        if (ct == 3) ac += curItem.amount;
    }
    $('#alwCharge').html(ac.toFixed(3));
    $('#busCharge').html(bc.toFixed(3));
    $('#perCharge').html(pc.toFixed(3));
    recalcTotals();
}

// ─── ChangeCallType ─────────────────────────────────────────
function ChangeCallType() {
    if (!$('#myCallType').val()) return;
    bc = 0; pc = 0; ac = 0; uc = 0;
    for (var i = 0; i < itemData.length; i++) {
        var curItem = itemData[i];
        var isUnident = (curItem.origCallType == 0 && $('#cmbChangeOpt').val() == 0 && !curItem.locked);
        var isAll = ($('#cmbChangeOpt').val() == 1 && !curItem.locked);
        if (isUnident || isAll) {
            curItem.callType = $('#myCallType').val();
            $("input[name='rd" + curItem.id + "'][value=" + curItem.callType + "]").prop('checked', true);
        }
        var ct = parseInt(curItem.callType + '');
        if (ct == 0) uc += curItem.amount;
        if (ct == 1) bc += curItem.amount;
        if (ct == 2) pc += curItem.amount;
        if (ct == 3) ac += curItem.amount;
    }
    $('#alwCharge').html(ac.toFixed(3));
    $('#busCharge').html(bc.toFixed(3));
    $('#perCharge').html(pc.toFixed(3));
    recalcTotals();
    // Refresh unidentified row highlighting
    (itemData || []).forEach(function (r) {
        var $row = $("input[name='rd" + r.id + "']").closest('tr');
        if (parseInt(r.callType) == 0) { $row.addClass('unidentified-row'); } else { $row.removeClass('unidentified-row'); }
    });
}

// ─── SaveChanges ─────────────────────────────────────────────
function SaveChanges() {
    // The controller signature is `UpdateRecord([FromBody] List<BillDetails> billDetails)`,
    // so the request body must be the JSON ARRAY itself — not an object wrapping it.
    // Wrapping it as { BillDetails: [...] } made System.Text.Json bind to an empty list,
    // BuildCallLogXml produced empty XML, and sp_SaveCloseBill ran a no-op.
    var rows = (typeof itemData !== 'undefined' && itemData) ? itemData : [];
    if (!rows.length) {
        Swal.fire({ icon: 'info', title: 'Nothing to save', text: 'No call records loaded for this bill.' });
        return;
    }

    $.ajax({
        type: "POST",
        cache: false,
        url: "/Ajax/UpdateRecord",
        data: JSON.stringify(rows),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (res) {
            if (res && res.myMessage) {
                Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage });
                return;
            }
            Swal.fire({
                icon: 'success', title: 'Saved',
                text: (res && res.Message) || 'Changes saved successfully',
                timer: 1500, showConfirmButton: false
            });
        },
        error: function (xhr) {
            if (xhr && xhr.status === 403) {
                Swal.fire({ icon: 'error', title: 'Forbidden', text: 'You do not have permission to save changes.' });
            } else {
                Swal.fire({ icon: 'error', title: 'Save failed', text: 'Could not save your changes. Please try again.' });
            }
        }
    });
}

// ─── Print ──────────────────────────────────────────────────
function Print() {
    if ($('#hdnBillID').val() > 0) {
        getMyArcBill($('#hdnBillID').val());
    }
}

// ─── ProcessBill ─────────────────────────────────────────────
function ProcessBill() {
    var curData = (itemData || []).filter(function (el) { return el.callType == 0; });
    if (curData.length > 0) {
        Swal.fire({ icon: 'error', title: 'Info Needed', text: 'Please Identify All Records' });
        return;
    }

    var managerName = $("#txtManagerName").text() || "Not Assigned";

    Swal.fire({
        html: `
        <div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:10px;font-size:15px;line-height:1.5;">
          <div><strong>Line Manager:</strong> <span>${managerName}</span></div>
          <div>Are you sure you want to send the bill for approval?</div>
          <hr style="width:100%;margin:10px 0;border-color:#eee;">
          <div id="divWB" class="form-check mb-2">
            <input type="checkbox" id="chkW1Swal" class="form-check-input"/>
            <label for="chkW1Swal" class="form-check-label">Request Waive for Business Charges</label>
          </div>
          <div id="divWA" class="form-check mb-3">
            <input type="checkbox" id="chkW2Swal" class="form-check-input"/>
            <label for="chkW2Swal" class="form-check-label">Request Waive for Allowance Charges</label>
          </div>
          <textarea id="txtProcessCommentSwal" rows="3" class="form-control mb-3" style="display:none;width:100%;"
                    placeholder="Add comments (if any)..."></textarea>
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'Yes, Send it',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        width: 480,
        didOpen: function () { showWaiveSwal(); }
    }).then(function (result) {
        if (result.isConfirmed) {
            var isW1 = $("#chkW1Swal").is(':checked');
            var isW2 = $("#chkW2Swal").is(':checked');
            var comment = $("#txtProcessCommentSwal").val() || '';
            var wamt = 0.0;
            if (isW1) wamt += parseFloat($('#btot').html() || 0);
            if (isW2) wamt += parseFloat($('#atot').html() || 0);

            var objNew = {
                BusinessCharges: $('#busCharge').html(),
                PersonalCharges: $('#perCharge').html(),
                PersonalLimitCharges: $('#atot').html(),
                DeductibleAmount: $('#nettotal').html(),
                TOTALAMOUNT: 0,
                comments: comment,
                BID: GBillId,
                UID: uid,
                WaiverAmount: wamt
            };
            var obji = { callLogs: itemData, close: objNew };

            Swal.fire({ title: 'Please Wait', html: 'Processing...', allowOutsideClick: false, showConfirmButton: false, didOpen: function () { Swal.showLoading(); } });

            $.ajax({
                type: "POST", cache: false, url: "/Ajax/SaveCallLogs",
                data: JSON.stringify(obji), contentType: "application/json; charset=utf-8", dataType: "json",
                success: function (res) {
                    // Server wraps errors in { myMessage } with HTTP 200
                    if (res && res.myMessage) {
                        Swal.close();
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage });
                        return;
                    }
                    setDataSourceGridMaster(res);
                    // Bill is saved. Fire email pipeline; if it fails, show toast — not an error popup.
                    $.ajax({
                        type: "POST", cache: false, url: "/Ajax/SendEmail",
                        data: JSON.stringify(obji), contentType: "application/json; charset=utf-8", dataType: "json",
                        success: function () {
                            Swal.close();
                            Swal.fire({ icon: 'success', title: 'Done!', text: 'Bill processed successfully!', timer: 1500, showConfirmButton: false })
                                .then(function () { IndexLoad(); });
                        },
                        error: function () {
                            // Bill is already processed — email notification failed silently
                            Swal.close();
                            showToast('Email notification could not be sent', 'warning');
                            Swal.fire({ icon: 'success', title: 'Done!', text: 'Bill processed successfully!', timer: 1500, showConfirmButton: false })
                                .then(function () { IndexLoad(); });
                        }
                    });
                },
                error: function (xhr, s, e) { Swal.close(); Swal.fire({ icon: 'error', title: 'Error!', text: 'An error occurred: ' + e }); }
            });
        }
    });
}

function showWaiveSwal() {
    $('#divWA').show(); $('#divWB').show(); $('#txtProcessCommentSwal').val('');
    if (Settings && Settings.isAllowWaiver) {
        if (parseFloat($('#atot').html() || 0) <= 0) { $('#divWA').hide(); } else { $('#txtProcessCommentSwal').show(); }
        if (parseFloat($('#btot').html() || 0) <= 0) { $('#divWB').hide(); } else { $('#txtProcessCommentSwal').show(); }
    } else { $('#divWA').hide(); $('#divWB').hide(); }
}

// ─── Delegate ────────────────────────────────────────────────
function getEmpList() {
    $.ajax({
        type: "GET", cache: false, url: "/Ajax/getEmployees",
        success: function (result) {
            employees = result.empList || [];
            if (dtDelegate) { dtDelegate.destroy(); dtDelegate = null; }
            $('#tblManager tbody').empty();
            var rows = '';
            employees.forEach(function (e) {
                rows += `<tr data-empid="${e.empId}" data-empno="${e.empNo}" style="cursor:pointer;">
                  <td data-label="Emp ID">${e.empId}</td><td data-label="Name">${e.empName || ''}</td><td data-label="Emp No">${e.empNo || ''}</td>
                </tr>`;
            });
            $('#tblManager tbody').html(rows);
            dtDelegate = $('#tblManager').DataTable({ responsive: false, pageLength: 5, destroy: true });
            $('#tblManager tbody').off('click', 'tr').on('click', 'tr', function () {
                var empId = $(this).data('empid');
                var empNo = $(this).data('empno');
                var empName = $(this).find('td:nth-child(2)').text();
                $('#hidManager').val(empId);
                $('#btnManagerLabel').text(empName + ' - ' + empNo);
                $('#employeePickerModal').modal('hide');
            });
        }
    });
}

function delegateBill() {
    var date1 = $('#StartInput').val();
    var date2 = $('#EndInput').val();
    if (!date1 || !date2) { Swal.fire({ icon: 'warning', title: 'Validation', text: 'Please select Start and End dates.' }); return; }
    if (new Date(date1) > new Date(date2)) { Swal.fire({ icon: 'warning', title: 'Validation', text: 'Start Date cannot be after End Date.' }); return; }
    var DelG = { "secid": $('#hidManager').val(), "managerid": uid, "app": $("#chkApp").is(':checked'), "idt": $("#chkIdt").is(':checked'), "sdate": date1, "edate": date2 };
    $.ajax({
        type: "GET", cache: false, url: "../../Ajax/SaveDelegate", contentType: 'application/json', data: DelG,
        success: function () { Swal.fire({ icon: 'success', title: 'Success', text: 'Delegation Saved Successfully', timer: 1500 }); GetDelegate(); }
    });
}

function GetDelegate() {
    $.ajax({
        type: "POST", url: "/Ajax/GetDelegate", data: { 'UID': uid },
        success: function (result) {
            var SecData = result.dtSec || [];
            if (dtDelegate) { try { dtDelegate.destroy(); } catch (e) { } dtDelegate = null; }
            $('#tblDelegate tbody').empty();
            var rows = '';
            SecData.forEach(function (r) {
                rows += `<tr data-id="${r.ID}">
                  <td data-label="Delegate To">${r.SecName || ''}</td>
                  <td data-label="Identify" class="text-center"><input type="checkbox" ${r.idt ? 'checked' : ''} disabled></td>
                  <td data-label="Approve" class="text-center"><input type="checkbox" ${r.app ? 'checked' : ''} disabled></td>
                  <td data-label="Start Date">${formatDateShort(r.sdate)}</td>
                  <td data-label="End Date">${formatDateShort(r.edate)}</td>
                  <td data-label="Action" class="text-center">
                    <button class="btn btn-sm btn-danger" onclick="DeleteDelegate(${r.ID})">
                      <i class="fa fa-trash"></i>
                    </button>
                  </td>
                </tr>`;
            });
            $('#tblDelegate tbody').html(rows);
            dtDelegate = $('#tblDelegate').DataTable({ responsive: false, pageLength: 5, destroy: true });

            $('#tblDelegate tbody').off('click', 'tr').on('click', 'tr', function () {
                var id = $(this).data('id');
                var row = SecData.find(function (r) { return r.id == id; });
                if (!row) return;
                $('#hidDID').val(row.ID);
                $('#hidManager').val(row.secid);
                $('#btnManagerLabel').text(row.SecName);
                $('#chkIdt').prop('checked', row.idt);
                $('#chkApp').prop('checked', row.app);
                $('#StartInput').val(row.sdate ? row.sdate.substring(0, 10) : '');
                $('#EndInput').val(row.edate ? row.edate.substring(0, 10) : '');
                $('#btnAdd').hide(); $('#btnUpdate').show();
            });
        }
    });
}

function UpdateDelegate() {
    var date1 = $('#StartInput').val();
    var date2 = $('#EndInput').val();
    if (new Date(date1) > new Date(date2)) { Swal.fire({ icon: 'warning', text: 'Start Date cannot be after End Date' }); return; }
    var DelG = { "ID": $('#hidDID').val(), "secid": $('#hidManager').val(), "managerid": uid, "app": $("#chkApp").is(':checked'), "idt": $("#chkIdt").is(':checked'), "sdate": date1, "edate": date2 };
    $.ajax({
        type: "GET", cache: false, url: "/Ajax/UpdateDelegate", contentType: 'application/json', data: DelG,
        success: function (result) {
            if (result.Message == 'Sucessfully Updated') { Swal.fire({ icon: 'success', title: 'Success', text: 'Delegation Updated Successfully', timer: 1500 }); }
            else { Swal.fire({ icon: 'error', title: 'Error', text: 'Sorry cannot complete transaction' }); }
            ClearDelegate(); GetDelegate();
        }
    });
}

function DeleteDelegate(id) {
    Swal.fire({ icon: 'warning', title: 'Confirm Delete', text: 'Delete this delegation?', showCancelButton: true, confirmButtonText: 'Yes, Delete' }).then(function (r) {
        if (r.isConfirmed) {
            $.ajax({
                type: "GET", cache: false, url: "/Ajax/DeleteDelegate", contentType: 'application/json', data: { ID: id },
                success: function (result) {
                    ClearDelegate();
                    if (result.myMessage == 'succ') { Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200 }); }
                    else { Swal.fire({ icon: 'error', title: 'Error', text: 'Cannot complete transaction' }); }
                    GetDelegate();
                }
            });
        }
    });
}

function ClearDelegate() {
    $('#hidDID').val(''); $('#hidManager').val('');
    $('#btnManagerLabel').text('Select Employee');
    $('#chkIdt').prop('checked', false); $('#chkApp').prop('checked', false);
    $('#StartInput').val(''); $('#EndInput').val('');
    $('#btnAdd').show(); $('#btnUpdate').hide();
}

// ─── Data Roaming ────────────────────────────────────────────
function GetDataRoaming() {
    //$.ajax({
    //    type: "GET", cache: false, url: "/Admin/GetDataRoaming",
    //    success: function (result) { FillDataRoaming(result.dtCountry || []); }
    //});
}

function FillDataRoaming(Country) {
    if (dtDataRoaming) { dtDataRoaming.destroy(); dtDataRoaming = null; }
    $('#tblDataRoaming tbody').empty();
    var rows = '';
    Country.forEach(function (r) {
        rows += `<tr data-id="${r.ID}" style="cursor:pointer;">
          <td data-label="Country">${r.Country || ''}</td><td data-label="Operator">${r.Operator || ''}</td>
          <td data-label="Action" class="text-center">
            <button class="btn btn-sm btn-outline-warning me-1" onclick="editRoamingRow(${r.ID},'${(r.Country || '').replace(/'/g, "\\'")}','${(r.Operator || '').replace(/'/g, "\\'")}')">
              <i class="fa fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="DeleteDataRoaming(${r.ID})">
              <i class="fa fa-trash"></i>
            </button>
          </td>
        </tr>`;
    });
    $('#tblDataRoaming tbody').html(rows);
    dtDataRoaming = $('#tblDataRoaming').DataTable({ responsive: false, pageLength: 10, destroy: true });
}

function editRoamingRow(id, country, operator) {
    $('#hidID').val(id); $('#txtCountryName').val(country); $('#txtOperator').val(operator);
    $('#btnAddDataRoaming').hide(); $('#btnUpdateDataRoaming').show(); $('#btnDeleteDataRoaming').show();
}

function AddDataRoaming() {
    if (!$('#txtCountryName').val()) { Swal.fire({ icon: 'warning', text: 'Please fill Country' }); return; }
    if (!$('#txtOperator').val()) { Swal.fire({ icon: 'warning', text: 'Please fill Operator' }); return; }
    $.ajax({
        type: "POST", url: "/Admin/AddDataRoaming",
        data: JSON.stringify({ value: { Country: $('#txtCountryName').val(), Operator: $('#txtOperator').val() } }),
        contentType: "application/json; charset=utf-8", dataType: "json",
        success: function (result) {
            ClearDataRoaming(); GetDataRoaming();
            Swal.fire({ icon: result.myMessage == 'Success' ? 'success' : 'error', title: result.myMessage == 'Success' ? 'Added' : 'Error', timer: 1200 });
        }
    });
}

function UpdateDataRoaming() {
    if (!$('#txtCountryName').val() || !$('#txtOperator').val()) { Swal.fire({ icon: 'warning', text: 'Please fill all fields' }); return; }
    $.ajax({
        type: "POST", url: "/Admin/UpdateDataRoaming",
        data: JSON.stringify({ value: { ID: $('#hidID').val(), Country: $('#txtCountryName').val(), Operator: $('#txtOperator').val() } }),
        contentType: "application/json; charset=utf-8", dataType: "json",
        success: function (result) {
            ClearDataRoaming(); GetDataRoaming();
            Swal.fire({ icon: result.myMessage == 'Success' ? 'success' : 'error', title: result.myMessage == 'Success' ? 'Updated' : 'Error', timer: 1200 });
        }
    });
}

function DeleteDataRoaming(id) {
    var targetId = id || $('#hidID').val();
    Swal.fire({ icon: 'warning', title: 'Confirm', text: 'Delete this entry?', showCancelButton: true, confirmButtonText: 'Yes, Delete' }).then(function (r) {
        if (r.isConfirmed) {
            $.ajax({
                type: "GET", cache: false, url: "/Admin/DeleteDataRoaming", data: { ID: targetId },
                success: function (result) {
                    ClearDataRoaming(); GetDataRoaming();
                    Swal.fire({ icon: result.myMessage == 'Success' ? 'success' : 'error', timer: 1200 });
                }
            });
        }
    });
}

function ClearDataRoaming() {
    $('#hidID').val(''); $('#txtCountryName').val(''); $('#txtOperator').val('');
    $('#btnAddDataRoaming').show(); $('#btnUpdateDataRoaming').hide(); $('#btnDeleteDataRoaming').hide();
}

// ─── Contact ─────────────────────────────────────────────────
function SaveContact() {
    var selectedRow = null;
    if (dtDetails) {
        var idx = dtDetails.rows('.selected').indexes();
        if (idx.length > 0) { selectedRow = dtDetails.row(idx[0]).data(); }
    }
    if (!selectedRow) { Swal.fire({ icon: 'warning', text: 'Please select a row first.' }); return; }
    var ContactName = $("#txtContactName").val();
    var value = ExName ? { ExName: ExName, Name: ContactName, DialledNo: selectedRow.DialledNo, Uid: selectedRow.Auid }
        : { Name: ContactName, DialledNo: selectedRow.DialledNo, Uid: selectedRow.Auid };
    $.ajax({
        type: "POST", url: "/Admin/SaveContact",
        data: JSON.stringify({ value: value }), contentType: "application/json; charset=utf-8", dataType: "json",
        success: function (result) {
            if (result.Message) { Swal.fire({ icon: 'success', text: result.Message, timer: 1200 }); getUBillDetails(GBillId); $('#contactModal').modal('hide'); $('#txtContactName').val(''); }
            if (result.MessageError) { Swal.fire({ icon: 'error', text: result.MessageError }); }
        }
    });
}

// ─── Show My Bills Filter ────────────────────────────────────
function showMyBills() {
    if (!dtMaster) return;
    if ($("#chkMyBillsOnly").is(':checked')) {
        dtMaster.column(3).search(String(uid), false, false).draw();
    } else {
        dtMaster.column(3).search('').draw();
    }
}

// ─── Tabs ────────────────────────────────────────────────────
function displayTabDetails(CardNo) {
    IndexLoad();
    var tabEl = null;
    if (CardNo == 1) tabEl = document.querySelector('#tab-identification');
    else if (CardNo == 2) tabEl = document.querySelector('#tab-approval');
    else if (CardNo == 3) tabEl = document.querySelector('#tab-history');
    else if (CardNo == 4) tabEl = document.querySelector('#tab-department');
    if (tabEl) { new bootstrap.Tab(tabEl).show(); }
}

// ─── IndexLoad ──────────────────────────────────────────────
function IndexLoad() {
    $.ajax({
        type: "GET", cache: false, url: "/Ajax/getBills", data: { uid: uid },
        success: function (result) {
            setDataSourceGridMaster(result);
            employees = result.EmpList;
        }
    });
    bindApprovalBills();
    bindArchivedBills();
    if ($('#tab-pane-department').length > 0) { bindDepartmentBills(); }
}

function bindIdentificationBills() {
    $.ajax({
        type: "GET", cache: false, url: "/Ajax/getBills", data: { uid: uid },
        success: function (result) { hideLoader(); setDataSourceGridMaster(result); employees = result.EmpList; }
    });
}

function bindApprovalBills() {
    $.ajax({
        type: "GET",
        url: "/Ajax/getApprovalBills",
        data: { uid: uid },
        dataType: "json",
        success: function (result) {
            hideLoader();
            AppBills = result || {};
            var cnt = (AppBills.dtBills || []).length;
            // Sidebar badge
            var sb = document.getElementById('sbBadgeApproval');
            if (sb) { sb.textContent = cnt; sb.style.display = cnt > 0 ? '' : 'none'; }
            // Populate the table (and empty state). Pane visibility is handled by switchView.
            setDataSourceApproval(AppBills);
        },
        error: function (xhr) {
            hideLoader();
            var sb = document.getElementById('sbBadgeApproval');
            if (sb) sb.style.display = 'none';
            setDataSourceApproval({ dtBills: [] });
            if (xhr && xhr.status === 403) {
                showToast('You do not have permission to view approvals', 'danger');
            }
        }
    });
}

function bindArchivedBills() {
    $.ajax({
        type: "GET", cache: false, url: "/Ajax/getArchivedBills", data: { uid: uid },
        contentType: "application/json; charset=utf-8", dataType: "json",
        success: function (result) { hideLoader(); ArcBills = result; setDataSourceArchived(ArcBills); }
    });
}

function bindDepartmentBills() {
    if ($('#tab-pane-department').length > 0) {
        $.ajax({
            type: "GET", cache: false, url: "/Ajax/getDepartmentBills", data: { uid: uid },
            contentType: "application/json; charset=utf-8", dataType: "json",
            success: function (result) { hideLoader(); setDataSourceDepartmentBill(result); }
        });
    }
}

// ─── Date Formatters ─────────────────────────────────────────
function formatDate(val) {
    if (!val) return '';
    var d = new Date(val);
    if (isNaN(d)) return val;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function formatDateShort(val) {
    if (!val) return '';
    var d = new Date(val);
    if (isNaN(d)) return val;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + String(d.getFullYear()).slice(-2);
}

function formatMonthYear(val) {
    if (!val) return '';
    var d = new Date(val);
    if (isNaN(d)) return val;
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
}

function formatTime(val) {
    if (!val) return '';
    var d = new Date(val);
    if (isNaN(d)) return val;
    var h = d.getHours(), m = d.getMinutes(), ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function OpenAdmin() {
    window.location.href = '/Admin/Index';
}

// ═══════════════════════════════════════════════════════════════
//  MOBILE DETAIL OVERLAY MODULE
//  Replaces the inline child-row expansion on screens ≤768px.
//  Renders a full-screen overlay with:
//    • Fixed summary strip  (atot / btot / ptot / nettotal)
//    • Swipeable carousel   (one card per bill detail row)
//    • Fixed action bar     (bulk-type selects + Save / Print / Process)
// ═══════════════════════════════════════════════════════════════

/* ── Ensure the overlay DOM exists once ─────────────────────── */
(function injectOverlayDOM() {
    if (document.getElementById('mobileDetailOverlay')) return;
    var html = `
    <div id="mobileDetailOverlay">

      <!-- Header -->
      <div class="mdo__header">
        <button class="mdo__back-btn" onclick="closeMobileDetailOverlay()" aria-label="Back">
          <i class="fa fa-arrow-left"></i>
        </button>
        <span class="mdo__title">Bill Details</span>
        <div class="mdo__live-tag">
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" id="chkLiveTagMobile" role="switch">
            <label class="form-check-label mdo__live-tag" for="chkLiveTagMobile">Live</label>
          </div>
        </div>
      </div>

      <!-- Summary strip -->
      <div class="mdo__summary">
        <div class="mdo__pill">
          <span class="mdo__pill-label">Allowance</span>
          <span class="mdo__pill-value" id="mdoAtot">0.000</span>
        </div>
        <div class="mdo__pill">
          <span class="mdo__pill-label">Business</span>
          <span class="mdo__pill-value" id="mdoBtot">0.000</span>
        </div>
        <div class="mdo__pill">
          <span class="mdo__pill-label">Personal</span>
          <span class="mdo__pill-value" id="mdoPtot">0.000</span>
        </div>
        <div class="mdo__pill mdo__pill--net">
          <span class="mdo__pill-label">Net Deductable</span>
          <span class="mdo__pill-value" id="mdoNet">0.000</span>
        </div>
      </div>

      <!-- Carousel area -->
      <div class="mdo__carousel-wrap" id="mdoCarouselWrap">
        <!-- loader shown while fetching -->
        <div id="mdoLoader" class="d-flex align-items-center justify-content-center gap-2 py-5 text-muted">
          <div class="spinner-border spinner-border-sm" role="status"></div>
          <span>Loading details...</span>
        </div>

        <!-- swipe hint (auto-fades) -->
        <div class="mdo__swipe-hint d-none" id="mdoSwipeHint">
          <i class="fa fa-hand-pointer"></i>
          Swipe cards left &amp; right
        </div>

        <!-- counter -->
        <div class="mdo__counter d-none" id="mdoCounter">1 / 0</div>

        <!-- track -->
        <div class="mdo__carousel-track d-none" id="mdoTrack"></div>

        <!-- dots -->
        <div class="mdo__dots d-none" id="mdoDots"></div>
      </div>

      <!-- Action bar -->
      <div class="mdo__actions">
        <div class="mdo__actions-selects">
          <select id="mdoCmbChangeOpt" class="form-select form-select-sm">
            <option value="0">Unidentified</option>
            <option value="1">All</option>
          </select>
          <select id="mdoMyCallType" class="form-select form-select-sm" onchange="mdoBulkChangeCallType()">
            <option value="">Set type</option>
            <option value="1">Business</option>
            <option value="2">Personal</option>
          </select>
        </div>
        <div class="mdo__actions-btns">
          <button class="btn btn-primary btn-sm" onclick="SaveChanges()">
            <i class="fa fa-floppy-disk me-1"></i>Save
          </button>
          <button class="btn btn-secondary btn-sm" onclick="Print()">
            <i class="fa fa-print"></i>
          </button>
          <button class="btn btn-success btn-sm" onclick="ProcessBill()">
            <i class="fa fa-check-circle me-1"></i>Process
          </button>
        </div>
      </div>

    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    _mdoBindSwipeHardware();
})();

/* ── Open overlay ────────────────────────────────────────────── */
function openMobileDetailOverlay(billId) {
    var $ov = $('#mobileDetailOverlay');

    // Reset UI
    $('#mdoLoader').removeClass('d-none');
    $('#mdoTrack').addClass('d-none').empty();
    $('#mdoDots').addClass('d-none').empty();
    $('#mdoCounter').addClass('d-none');
    $('#mdoSwipeHint').addClass('d-none');
    $('#mdoAtot,#mdoBtot,#mdoPtot,#mdoNet').text('0.000');

    // Show overlay (display:flex triggers, then transition slides in)
    $ov.css('display', 'flex');
    // allow one frame for display:flex to apply before adding transform class
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            $ov.addClass('mdo--open');
        });
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Fetch data
    $.ajax({
        type: 'GET',
        cache: false,
        url: '/Ajax/getBillDetails',
        data: { id: billId, type: 0 },
        success: function (result) {
            Settings = result.setting;
            itemData = result.bill_details;
            myABB = result.bill_details;
            if (itemData) {
                for (var k = 0; k < itemData.length; k++) {
                    itemData[k].origCallType = itemData[k].callType;
                }
            }

            bc = 0; pc = 0; ac = 0; uc = 0;
            (itemData || []).forEach(function (item) {
                var ct = parseInt(item.callType + '');
                if (ct === 0) uc += item.amount;
                if (ct === 1) bc += item.amount;
                if (ct === 2) pc += item.amount;
                if (ct === 3) ac += item.amount;
            });

            blim = result.blim;
            plim = result.plim;
            alim = result.mlim;
            isbus = Settings.dedBussinessCharges;
            isper = Settings.dedPersonalCharges;
            HidePer = Settings.hidePersonalLimit;

            _mdoRecalcSummary();
            _mdoBuildCarousel(itemData);
        },
        error: function () {
            $('#mdoLoader').html('<p class="text-danger p-3">Failed to load bill details.</p>');
        }
    });
}

/* ── Close overlay ───────────────────────────────────────────── */
function closeMobileDetailOverlay() {
    var $ov = $('#mobileDetailOverlay');
    $ov.removeClass('mdo--open');
    // wait for transition then hide
    setTimeout(function () {
        $ov.css('display', 'none');
    }, 340);
    document.body.style.overflow = '';
}

/* ── Recalc summary pills (mirrors recalcTotals) ─────────────── */
function _mdoRecalcSummary() {
    var BL = parseFloat(blim || 0);
    var BC = parseFloat(bc || 0);
    var PL = parseFloat(plim || 0);
    var PC = parseFloat(pc || 0);
    var AL = parseFloat(alim || 0);
    var AC = parseFloat(ac || 0);

    var btotVal = 0, ptotVal = 0, atotVal = 0;

    if (BC > BL && isbus) {
        btotVal = (Settings && Settings.isZeroUnlimited && BL === 0) ? 0 : BC - BL;
    }
    if (PC > PL && isper) {
        ptotVal = (Settings && Settings.isZeroUnlimited2 && PL === 0) ? 0 : PC - PL;
    }
    if (HidePer) { ptotVal = PC; }
    if (AC > AL) { atotVal = AC - AL; }

    var net = atotVal + btotVal + ptotVal;

    $('#mdoAtot').text(atotVal.toFixed(3));
    $('#mdoBtot').text(btotVal.toFixed(3));
    $('#mdoPtot').text(ptotVal.toFixed(3));
    $('#mdoNet').text(net.toFixed(3));

    // also keep original DOM ids in sync (used by SaveChanges etc.)
    $('#atot').text(atotVal.toFixed(3));
    $('#btot').text(btotVal.toFixed(3));
    $('#ptot').text(ptotVal.toFixed(3));
    $('#nettotal').text(net.toFixed(3));
}

/* ── Build carousel cards ────────────────────────────────────── */
function _mdoBuildCarousel(details) {
    $('#mdoLoader').addClass('d-none');

    if (!details || details.length === 0) {
        $('#mdoLoader').removeClass('d-none').html('<p class="text-muted p-4 text-center">No bill details found.</p>');
        return;
    }

    var $track = $('#mdoTrack').empty();
    var $dots = $('#mdoDots').empty();
    var total = details.length;

    // Build dot indicators (max 12 shown, rest implied by counter)
    var maxDots = 12;
    if (total <= maxDots) {
        for (var d = 0; d < total; d++) {
            $dots.append('<div class="mdo__dot' + (d === 0 ? ' is-active' : '') + '" data-idx="' + d + '"></div>');
        }
    }

    // Build one card per detail row
    details.forEach(function (r, idx) {
        var ct = parseInt(r.callType + '');
        var typeClass = _mdoCallTypeClass(ct);
        var typeName = _mdoCallTypeName(ct);

        // Radio buttons
        var radios = '';
        if (r.locked) {
            // locked – show only the selected type as a static pill
            radios = '<span class="mdo__radio-btn is-active type-' + _mdoCallTypeCss(ct) + '">' + typeName + '</span>';
        } else {
            [[1, 'Business', 'type-business'], [2, 'Personal', 'type-personal']].forEach(function (opt) {
                var activeClass = ct === opt[0] ? ' is-active ' + opt[2] : '';
                radios += `<label class="mdo__radio-btn${activeClass}" data-rowid="${r.id}" data-val="${opt[0]}">
                             <input type="radio" name="rdm${r.id}" value="${opt[0]}" ${ct === opt[0] ? 'checked' : ''}>
                             ${opt[1]}
                           </label>`;
            });
            if (ct === 3) {
                radios += `<label class="mdo__radio-btn is-active type-allowance" data-rowid="${r.id}" data-val="3">
                             <input type="radio" name="rdm${r.id}" value="3" checked> Allowance
                           </label>`;
            }
            if (ct === 5) {
                radios += `<label class="mdo__radio-btn is-active type-ext" data-rowid="${r.id}" data-val="5">
                             <input type="radio" name="rdm${r.id}" value="5" checked> Ext.Allow
                           </label>`;
            }
            if (Settings && Settings.enableDiscrepancy) {
                var f = ct === 4 ? ' is-active type-faulty' : '';
                radios += `<label class="mdo__radio-btn${f}" data-rowid="${r.id}" data-val="4">
                             <input type="radio" name="rdm${r.id}" value="4" ${ct === 4 ? 'checked' : ''}> Faulty
                           </label>`;
            }
        }

        var card = `
        <div class="mdo__card mdo__card--${typeClass}" data-idx="${idx}">
          <div class="mdo__card-accent"></div>
          <div class="mdo__card-body">
            <span class="mdo__card-badge">${typeName}</span>

            <div class="mdo__card-row">
              <span class="mdo__card-row-label">Date</span>
              <span class="mdo__card-row-value">${formatDate(r.callDate)}</span>
            </div>
            <div class="mdo__card-row">
              <span class="mdo__card-row-label">Time</span>
              <span class="mdo__card-row-value">${formatTime(r.callTime)}</span>
            </div>
            <div class="mdo__card-row">
              <span class="mdo__card-row-label">Trans Type</span>
              <span class="mdo__card-row-value">${r.transType || '—'}</span>
            </div>
            <div class="mdo__card-row">
              <span class="mdo__card-row-label">Description</span>
              <span class="mdo__card-row-value">${r.description || '—'}</span>
            </div>
            <div class="mdo__card-row">
              <span class="mdo__card-row-label">Contact</span>
              <span class="mdo__card-row-value">${r.name || '—'}</span>
            </div>
            <div class="mdo__card-row">
              <span class="mdo__card-row-label">Duration</span>
              <span class="mdo__card-row-value">${r.duration || '—'}</span>
            </div>
            <div class="mdo__card-row">
              <span class="mdo__card-row-label">Amount</span>
              <span class="mdo__card-row-value mdo__card-amount">${parseFloat(r.amount || 0).toFixed(3)}</span>
            </div>

            ${r.locked ? '' : `
            <div class="mdo__card-radio-wrap">
              <span class="mdo__card-radio-label">Call Type</span>
              <div class="mdo__radio-group" id="mdoRadioGroup${r.id}">
                ${radios}
              </div>
            </div>
            <div class="mdo__card-comment">
              <input type="text"
                     id="mdoComment${r.id}"
                     class="form-control"
                     placeholder="Add comment…"
                     value="${(r.comment || '').replace(/"/g, '&quot;')}"
                     onblur="mdoSaveComment(${r.id})" />
            </div>`}
          </div>
        </div>`;

        $track.append(card);
    });

    // Show elements
    $track.removeClass('d-none');
    $dots.removeClass('d-none');
    $('#mdoCounter').removeClass('d-none').text('1 / ' + total);
    $('#mdoSwipeHint').removeClass('d-none');

    // Delegate radio click on track
    $track.off('click', '.mdo__radio-btn').on('click', '.mdo__radio-btn', function () {
        var $lbl = $(this);
        var rowId = parseInt($lbl.data('rowid'));
        var val = parseInt($lbl.data('val'));
        // Sync the hidden radio
        $lbl.closest('.mdo__radio-group').find('.mdo__radio-btn').removeClass('is-active type-business type-personal type-allowance type-ext type-faulty');
        $lbl.addClass('is-active ' + _mdoRadioActiveClass(val));
        $lbl.find('input[type="radio"]').prop('checked', true);
        // Re-use existing handleClick logic by building a fake radio input
        var fakeRadio = { value: val };
        handleClick(fakeRadio, rowId);
        _mdoRecalcSummary();
        // Update card accent colour
        var $card = $lbl.closest('.mdo__card');
        $card.attr('class', 'mdo__card mdo__card--' + _mdoCallTypeClass(val));
        $card.find('.mdo__card-badge').text(_mdoCallTypeName(val));
    });

    // Scroll → update dots + counter
    var scrollTimer;
    $track[0].addEventListener('scroll', function () {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
            var trackEl = document.getElementById('mdoTrack');
            var cardW = trackEl.firstElementChild ? trackEl.firstElementChild.offsetWidth + 12 : 1;
            var newIdx = Math.round(trackEl.scrollLeft / cardW);
            newIdx = Math.max(0, Math.min(newIdx, total - 1));
            $('#mdoCounter').text((newIdx + 1) + ' / ' + total);
            $('#mdoDots .mdo__dot').removeClass('is-active');
            $('#mdoDots .mdo__dot[data-idx="' + newIdx + '"]').addClass('is-active');
        }, 50);
    }, { passive: true });
}

/* ── Mouse drag-to-scroll on carousel track ─────────────────── */
function _mdoBindSwipeHardware() {
    $(document).on('mousedown', '#mdoTrack', function (e) {
        var el = this;
        var startX = e.pageX - el.offsetLeft;
        var scrollL = el.scrollLeft;
        $(el).addClass('is-dragging');
        $(document).on('mousemove.mdodrag', function (ev) {
            var x = ev.pageX - el.offsetLeft;
            el.scrollLeft = scrollL - (x - startX);
        });
        $(document).on('mouseup.mdodrag mouseleave.mdodrag', function () {
            $(el).removeClass('is-dragging');
            $(document).off('.mdodrag');
        });
    });
}

/* ── Bulk call-type change from action bar ───────────────────── */
function mdoBulkChangeCallType() {
    var newType = parseInt($('#mdoMyCallType').val() || '0');
    if (!newType) return;
    var scope = $('#mdoCmbChangeOpt').val(); // '0'=unidentified, '1'=all
    (itemData || []).forEach(function (item) {
        if (item.locked) return;
        if (scope === '0' && parseInt(item.callType + '') !== 0) return;
        var fakeRadio = { value: newType };
        handleClick(fakeRadio, item.id);
        // Update card visuals
        var $group = $('#mdoRadioGroup' + item.id);
        $group.find('.mdo__radio-btn').removeClass('is-active type-business type-personal type-allowance type-ext type-faulty');
        $group.find('.mdo__radio-btn[data-val="' + newType + '"]').addClass('is-active ' + _mdoRadioActiveClass(newType));
        var $card = $group.closest('.mdo__card');
        $card.attr('class', 'mdo__card mdo__card--' + _mdoCallTypeClass(newType));
        $card.find('.mdo__card-badge').text(_mdoCallTypeName(newType));
    });
    _mdoRecalcSummary();
    $('#mdoMyCallType').val('');
}

/* ── Persist comment from mobile card ───────────────────────── */
function mdoSaveComment(commentId) {
    var val = $('#mdoComment' + commentId).val();
    for (var i = 0; i < myABB.length; i++) {
        if (myABB[i].id === commentId || myABB[i].Id === commentId) {
            myABB[i].Comment = val;
            myABB[i].comment = val;
        }
    }
}

/* ── Helper: call type → CSS modifier ───────────────────────── */
function _mdoCallTypeClass(ct) {
    ct = parseInt(ct + '');
    if (ct === 1) return 'business';
    if (ct === 2) return 'personal';
    if (ct === 3) return 'allowance';
    if (ct === 4) return 'faulty';
    if (ct === 5) return 'ext';
    return 'unidentified';
}

function _mdoCallTypeName(ct) {
    ct = parseInt(ct + '');
    if (ct === 1) return 'Business';
    if (ct === 2) return 'Personal';
    if (ct === 3) return 'Allowance';
    if (ct === 4) return 'Faulty';
    if (ct === 5) return 'Ext.Allow';
    return 'Unidentified';
}

function _mdoCallTypeCss(ct) {
    ct = parseInt(ct + '');
    if (ct === 1) return 'business';
    if (ct === 2) return 'personal';
    if (ct === 3) return 'allowance';
    if (ct === 4) return 'faulty';
    if (ct === 5) return 'ext';
    return 'unidentified';
}

function _mdoRadioActiveClass(val) {
    val = parseInt(val + '');
    if (val === 1) return 'type-business';
    if (val === 2) return 'type-personal';
    if (val === 3) return 'type-allowance';
    if (val === 4) return 'type-faulty';
    if (val === 5) return 'type-ext';
    return '';
}

/* ── Android hardware back button support ────────────────────── */
window.addEventListener('popstate', function () {
    if ($('#mobileDetailOverlay').hasClass('mdo--open')) {
        closeMobileDetailOverlay();
    }
});