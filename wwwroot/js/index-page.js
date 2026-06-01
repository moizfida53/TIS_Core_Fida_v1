/* ============================================================================
   index-page.js — Bill Management page bridge
   Loaded via @section Scripts after jQuery, Bootstrap, DataTables,
   SweetAlert2 and myJS.js are already on the page.

   Responsibilities:
     • Sidebar open/close helpers (openSB / closeSB)
     • View switcher (switchView) — links sidebar nav to myJS.js tab loaders
     • Capture-phase click interceptor on #tblBillMaster rows
     • Bill detail modal (open / populate / close)
     • Mobile slider cards builder
     • DataTables draw handlers → sync stat cards + badge counts
     • Status tab filter
     • Inject "View Bill" button into each master-row Action cell
     • Mobile bill cards builder for the master list
   ============================================================================ */

/* ── Sidebar helpers ──────────────────────────────────────────────────────── */
function openSB() {
    $('#sidebar').addClass('open');
    $('#sbOv').addClass('open');
    $('body').css('overflow', 'hidden');
}

function closeSB() {
    $('#sidebar').removeClass('open');
    $('#sbOv').removeClass('open');
    $('body').css('overflow', '');
}

/* ── View switcher (sidebar nav) ─────────────────────────────────────────────
   REMOVED — superseded by the .is-active / .tis-view based switchView() in
   myJS.js. Defining a second `function switchView` here was overriding the
   correct implementation (last definition wins for function declarations
   loaded in script order), which is why the panes weren't toggling.
   --------------------------------------------------------------------------- */

/* ── Open the bill detail modal ONLY from the Process Bill button ─────────
   Capture phase so we can fire before myJS.js's row-level listeners and
   stop the bill row from also reacting (which used to expand the child row). */
document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var btn = e.target.closest('#tblBillMaster tbody .process-row-btn');
    if (!btn) return;
    e.stopImmediatePropagation();
    e.preventDefault();

    var row    = btn.closest('tr.master-row');
    if (!row) return;
    var $row   = $(row);
    var billId = $row.data('billid') || 0;
    var mgr    = $row.data('managername') || '';

    // Set globals that myJS.js Save/Process functions read
    if (typeof GBillId !== 'undefined') GBillId = billId;
    $('#hdnBillID').val(billId);
    $('#txtManagerName').text(mgr);

    // tblBillMaster columns (the expand-toggle <th> is commented out, so 0-indexed):
    //   0 Provider | 1 Date | 2 Employee | 3 Mobile | 4 Amount | 5 Currency | 6 Last Updated | 7 Action
    var employee = $row.find('td').eq(2).text().trim();
    var mobile   = $row.find('td').eq(3).text().trim();
    var billDate = $row.find('td').eq(1).text().trim();

    openBillDetailModal(billId, employee, mobile, mgr, billDate);
}, true /* capture phase */);

/* ── Open the bill detail modal and load data ─────────────────────────────── */
function openBillDetailModal(billId, employee, mobile, mgr, billDate) {
    // Header: employee name on top, mobile number underneath.
    $('#modalBillId').text(employee || 'Bill #' + billId);
    $('#modalBillSub').text(mobile || '');
    $('#detailTbl').empty();
    $('#sliderTrack').empty();
    $('#lineCount').text('Loading…');
    $('#slideCounter').text('Loading…');

    // Reset footer controls so nothing carries over from the previous bill.
    $('#chkLiveTag').prop('checked', false);
    $('#cmbChangeOpt').val('0');

    // Reset charge summary fields
    ['cs_tot', 'cs_al', 'cs_ac', 'cs_bl', 'cs_bc', 'cs_w', 'cs_pd', 'cs_net',
     'csm_al', 'csm_bc', 'csm_pd', 'csm_net'].forEach(function (id) {
        $('#' + id).text('0.000');
    });

    // Show modal immediately; data populates asynchronously
    document.getElementById('billDetailOv').classList.add('open');
    document.body.style.overflow = 'hidden';

    $.ajax({
        url:  '/Ajax/getBillDetails',
        type: 'GET',
        data: { id: billId, type: 0 },
        success: function (result) {
            if (!result) return;

            // Expose to global scope so myJS.js Save/Process functions can read them
            if (typeof Settings !== 'undefined') Settings = result.setting;
            if (typeof itemData !== 'undefined') {
                itemData = result.bill_details || [];
                // stamp origCallType — used by LiveTag and change-all skipping logic
                itemData.forEach(function (d) { d.origCallType = d.callType; });
            }
            if (typeof myABB   !== 'undefined') myABB   = result.bill_details || [];
            var items = result.bill_details || [];
            var bLim  = parseFloat(result.blim || 0);
            var aLim  = parseFloat(result.mlim || 0);
            var s     = result.setting || {};

            // blim/plim/alim are var-declared but never assigned — skip typeof guard
            blim = parseFloat(result.blim  || 0);
            plim = parseFloat(result.plim  || 0);
            alim = parseFloat(result.mlim  || 0);
            // sync Settings flags used by recalcTotals / handleClick
            isbus   = s.dedBussinessCharges || false;
            isper   = s.dedPersonalCharges  || false;
            HidePer = s.hidePersonalLimit   || false;

            // Recalculate charge totals
            var bc2 = 0, pc2 = 0, ac2 = 0, uc2 = 0;
            for (var i = 0; i < items.length; i++) {
                var ct = parseInt(items[i].callType);
                if (ct === 0) uc2 += items[i].amount;
                if (ct === 1) bc2 += items[i].amount;
                if (ct === 2) pc2 += items[i].amount;
                if (ct === 3) ac2 += items[i].amount;
            }
            // bc/pc/ac/uc are var-declared (undefined) — assign directly
            bc = bc2; pc = pc2; ac = ac2; uc = uc2;

            var waiver = Math.max(0, ac2 - aLim);
            var bizDed = s.dedBussinessCharges ? Math.max(0, bc2 - bLim) : 0;
            var net    = waiver + (s.dedPersonalCharges ? pc2 : 0) + bizDed;
            var total  = bc2 + pc2 + ac2 + uc2;

            // Populate charge summary — desktop
            $('#cs_tot').text(total.toFixed(3));
            $('#cs_al').text(aLim.toFixed(3));
            $('#cs_ac').text(ac2.toFixed(3));
            $('#cs_bl').text(bLim.toFixed(3));
            $('#cs_bc').text(bc2.toFixed(3));
            $('#cs_w').text(waiver.toFixed(3));
            $('#cs_pd').text(pc2.toFixed(3));
            $('#cs_net').text(net.toFixed(3));

            // Populate charge summary — mobile pills
            $('#csm_al').text(ac2.toFixed(3));
            $('#csm_bc').text(bc2.toFixed(3));
            $('#csm_pd').text(pc2.toFixed(3));
            $('#csm_net').text(net.toFixed(3));

            // Record counts
            var n = items.length;
            var rec = n + ' record' + (n === 1 ? '' : 's');
            $('#lineCount').text(rec);
            $('#slideCounter').text(rec);

            // Build desktop detail table rows
            var rows = '';
            for (var j = 0; j < items.length; j++) {
                var r   = items[j];
                var ct2 = parseInt(r.callType);
                var unid = ct2 === 0 ? 'style="background:rgba(232,160,32,.07)"' : '';

                var fmtDate = (typeof formatDate === 'function') ? formatDate(r.callDate) : (r.callDate || '');
                var fmtTime = (typeof formatTime === 'function') ? formatTime(r.callTime) : (r.callTime || '');

                // Build Identify Call toggle buttons (Allowance rows show ONLY Allowance)
                var bpBtns = buildBpButtons(r, s, ct2);

                rows +=
                    '<tr ' + unid + '>' +
                    '<td style="white-space:nowrap;font-size:12px">' + fmtDate + '</td>' +
                    '<td style="white-space:nowrap;font-size:12px;color:var(--tx2)">' + fmtTime + '</td>' +
                    '<td style="white-space:nowrap">' + (r.transType || '') + '</td>' +
                    '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (r.description || '') + '">' + (r.description || '') + '</td>' +
                    '<td style="color:var(--tx2);white-space:nowrap">' + (r.name || '—') + '</td>' +
                    '<td class="r" style="font-variant-numeric:tabular-nums;font-weight:600">' + (r.duration || '') + '</td>' +
                    '<td class="r" style="font-weight:700;font-variant-numeric:tabular-nums">' + parseFloat(r.amount || 0).toFixed(3) + '</td>' +
                    '<td class="c">' + bpBtns + '</td>' +
                    '<td><input class="cmt-inp" type="text" placeholder="Comment…" id="txtComment' + r.id + '" ' +
                    'value="' + (r.comment || '').replace(/"/g, '&quot;') + '" onblur="saveComments(' + r.id + ')" /></td>' +
                    '</tr>';
            }
            $('#detailTbl').html(rows);

            // Build mobile slider cards
            buildMobileCards(items);

            // Sync hidden recalc spans so ProcessBill/showWaiveSwal read correct values
            refreshModalSummary();
        },
        error: function () {
            $('#lineCount').text('Error loading data');
        }
    });
}

/* ── Mobile slider cards (inside bill detail modal) ──────────────────────── */
// New layout (mobile only — desktop hides .mds via media query):
//   Header: 3 columns — Trans Type | Date+Time stacked | Amount
//   Body:   Description (duration in parens) on its own line, then
//           3 columns — Contact | Comment input | Business/Personal stacked
function buildMobileCards(items) {
    var track = document.getElementById('sliderTrack');
    if (!track) return;
    track.innerHTML = '';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    for (var j = 0; j < items.length; j++) {
        var r   = items[j];
        var ct  = parseInt(r.callType);
        var biz = ct === 1 ? 'sel-biz' : '';
        var per = ct === 2 ? 'sel-per' : '';
        var lockedAttr = r.locked ? ' disabled' : '';
        var clickAttr  = r.locked ? '' : ' onclick="clickAndRefresh(this,' + r.id + ')"';

        var fmtDate = (typeof formatDate === 'function') ? formatDate(r.callDate) : (r.callDate || '');
        var fmtTime = (typeof formatTime === 'function') ? formatTime(r.callTime) : (r.callTime || '');

        // Header right column — date + time stacked; show only what's present.
        var whenInner = '';
        if (fmtDate) whenInner += '<div class="d">' + esc(fmtDate) + '</div>';
        if (fmtTime) whenInner += '<div>'           + esc(fmtTime) + '</div>';
        if (!whenInner) whenInner = '<div class="d">&mdash;</div>';

        // Description line — show "(duration)" only when duration is non-empty.
        var desc = r.description ? esc(r.description) : '&mdash;';
        if (r.duration) desc += ' <span class="dur">(' + esc(r.duration) + ')</span>';

        // Call-type buttons — Allowance variant vs. Business/Personal pair.
        var bpHtml;
        if (ct === 3) {
            bpHtml = '<div class="mdc-bp">' +
                       '<button class="mdc-bp-btn sel-biz" value="3" data-line="' + r.id + '" data-type="3"' + clickAttr + lockedAttr + '>Allowance</button>' +
                     '</div>';
        } else {
            bpHtml = '<div class="mdc-bp">' +
                       '<button class="mdc-bp-btn ' + biz + '" value="1" data-line="' + r.id + '" data-type="1"' + clickAttr + lockedAttr + '>Business</button>' +
                       '<button class="mdc-bp-btn ' + per + '" value="2" data-line="' + r.id + '" data-type="2"' + clickAttr + lockedAttr + '>Personal</button>' +
                     '</div>';
        }

        var card = document.createElement('div');
        card.className = 'mdc';
        card.innerHTML =
            '<div class="mdc-hdr">' +
                '<div class="trans">' + esc(r.transType || '—') + '</div>' +
                '<div class="when">'  + whenInner + '</div>' +
                '<div class="amt">'   + parseFloat(r.amount || 0).toFixed(3) + '</div>' +
            '</div>' +
            '<div class="mdc-desc">' + desc + '</div>' +
            '<div class="mdc-body">' +
                '<div>' +
                    '<div class="mdc-lbl">Contact</div>' +
                    '<div class="mdc-val">' + esc(r.name || '—') + '</div>' +
                '</div>' +
                '<div class="mdc-cmt">' +
                    '<input type="text" placeholder="Comment…" id="txtCommentM' + r.id + '"' +
                        ' value="' + esc(r.comment || '') + '"' +
                        ' onblur="saveComments(' + r.id + ')"' +
                        (r.locked ? ' disabled' : '') + ' />' +
                '</div>' +
                bpHtml +
            '</div>';
        track.appendChild(card);
    }
}

/* ── Close bill detail modal ─────────────────────────────────────────────── */
function closeBillDetailModal() {
    document.getElementById('billDetailOv').classList.remove('open');
    document.body.style.overflow = '';
}

// Wire up modal-close triggers. Each element is optional — `cancelBillModal`
// was removed when we moved Save/Print to the header, so guard with null checks.
(function () {
    var closeBtn  = document.getElementById('closeBillModal');
    var cancelBtn = document.getElementById('cancelBillModal');
    var overlay   = document.getElementById('billDetailOv');
    if (closeBtn)  closeBtn.addEventListener('click',  closeBillDetailModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeBillDetailModal);
    if (overlay)   overlay.addEventListener('click', function (e) {
        if (e.target === this) closeBillDetailModal();
    });
})();

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeBillDetailModal();
});

/* ── Toggle button click wrapper ─────────────────────────────────────────── */
// Wraps myJS.js handleClick so we can:
//   1. set the correct visual state on the bp-tog group
//   2. refresh the NEW modal charge summary (#cs_* / #csm_*)
// handleClick expects element.value to determine the call type.
function clickAndRefresh(el, id) {
    // 1. Update visual state: clear all in group, apply class to clicked button
    var $group = $(el).closest('.bp-tog, .mdc-bp');
    $group.find('button').removeClass('sel-biz sel-per');
    var type = parseInt(el.getAttribute('data-type') || '0');
    if (type === 1 || type === 3) $(el).addClass('sel-biz');
    else if (type === 2 || type === 4) $(el).addClass('sel-per');

    // 2. Delegate to myJS.js (updates itemData array + bc/pc/ac/uc globals)
    if (typeof handleClick === 'function') handleClick(el, id);

    // 3. Sync the new modal's charge summary cards
    refreshModalSummary();
}

function refreshModalSummary() {
    var s    = (typeof Settings !== 'undefined' && Settings) ? Settings : {};
    var bLim = parseFloat(blim || 0);
    var aLim = parseFloat(alim || 0);
    var BC   = parseFloat(bc || 0);
    var PC   = parseFloat(pc || 0);
    var AC   = parseFloat(ac || 0);

    var aOver  = Math.max(0, AC - aLim);                                  // allowance over limit
    var bOver  = s.dedBussinessCharges ? Math.max(0, BC - bLim) : 0;      // business over limit
    var pDeduct= s.dedPersonalCharges  ? PC : 0;                          // personal deductible
    var net    = aOver + bOver + pDeduct;

    // Desktop summary chips
    $('#cs_ac').text(AC.toFixed(3));
    $('#cs_bc').text(BC.toFixed(3));
    $('#cs_pd').text(PC.toFixed(3));
    $('#cs_w').text(aOver.toFixed(3));
    $('#cs_net').text(net.toFixed(3));

    // Mobile summary pills
    $('#csm_al').text(AC.toFixed(3));
    $('#csm_bc').text(BC.toFixed(3));
    $('#csm_pd').text(PC.toFixed(3));
    $('#csm_net').text(net.toFixed(3));

    // Hidden spans — read by ProcessBill(), showWaiveSwal(), recalcTotals() siblings
    $('#alwCharge').text(AC.toFixed(3));
    $('#busCharge').text(BC.toFixed(3));
    $('#perCharge').text(PC.toFixed(3));
    $('#atot').text(aOver.toFixed(3));
    $('#btot').text(bOver.toFixed(3));
    $('#ptot').text(pDeduct.toFixed(3));
    $('#nettotal').text(net.toFixed(3));
}

/* ── buildBpButtons — single source of truth for identify-call toggle HTML ── */
// Rules:
//   ct2 === 3 (Allowance)  → only Allowance button (Business/Personal hidden)
//   locked                 → disabled buttons, no onclick
//   otherwise              → interactive Business / Personal (+ Faulty if enabled)
function buildBpButtons(r, s, ct2) {
    var biz = ct2 === 1 ? 'sel-biz' : '';
    var per = ct2 === 2 ? 'sel-per' : '';

    if (ct2 === 3) {
        return r.locked
            ? '<div class="bp-tog"><button class="bp-btn sel-biz">Allowance</button></div>'
            : '<div class="bp-tog"><button class="bp-btn sel-biz" value="3" data-line="' + r.id + '" data-type="3" onclick="clickAndRefresh(this,' + r.id + ')">Allowance</button></div>';
    }

    if (r.locked) {
        return '<div class="bp-tog">' +
               '<button class="bp-btn ' + biz + '" disabled>Business</button>' +
               '<button class="bp-btn ' + per + '" disabled>Personal</button>' +
               '</div>';
    }

    var html = '<div class="bp-tog">' +
        '<button class="bp-btn ' + biz + '" value="1" data-line="' + r.id + '" data-type="1" onclick="clickAndRefresh(this,' + r.id + ')">Business</button>' +
        '<button class="bp-btn ' + per + '" value="2" data-line="' + r.id + '" data-type="2" onclick="clickAndRefresh(this,' + r.id + ')">Personal</button>';
    if (s && s.enableDiscrepancy) {
        html += '<button class="bp-btn ' + (ct2 === 4 ? 'sel-per' : '') + '" value="4" data-line="' + r.id + '" data-type="4" onclick="clickAndRefresh(this,' + r.id + ')">Faulty</button>';
    }
    return html + '</div>';
}

/* ── rebuildDetailTable — re-renders #detailTbl from current itemData ─────── */
// Called after Change All so allowance-only rows reflect the new state.
function rebuildDetailTable() {
    var s     = (typeof Settings !== 'undefined' && Settings) ? Settings : {};
    var items = (typeof itemData !== 'undefined') ? itemData : [];
    var rows  = '';

    for (var j = 0; j < items.length; j++) {
        var r   = items[j];
        var ct2 = parseInt(r.callType);
        var unid = ct2 === 0 ? 'style="background:rgba(232,160,32,.07)"' : '';
        var fmtDate = (typeof formatDate === 'function') ? formatDate(r.callDate) : (r.callDate || '');
        var fmtTime = (typeof formatTime === 'function') ? formatTime(r.callTime) : (r.callTime || '');

        rows +=
            '<tr ' + unid + '>' +
            '<td style="white-space:nowrap;font-size:12px">' + fmtDate + '</td>' +
            '<td style="white-space:nowrap;font-size:12px;color:var(--tx2)">' + fmtTime + '</td>' +
            '<td style="white-space:nowrap">' + (r.transType || '') + '</td>' +
            '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (r.description || '') + '">' + (r.description || '') + '</td>' +
            '<td style="color:var(--tx2);white-space:nowrap">' + (r.name || '—') + '</td>' +
            '<td class="r" style="font-variant-numeric:tabular-nums;font-weight:600">' + (r.duration || '') + '</td>' +
            '<td class="r" style="font-weight:700;font-variant-numeric:tabular-nums">' + parseFloat(r.amount || 0).toFixed(3) + '</td>' +
            '<td class="c">' + buildBpButtons(r, s, ct2) + '</td>' +
            '<td><input class="cmt-inp" type="text" placeholder="Comment…" id="txtComment' + r.id + '" ' +
                'value="' + (r.comment || '').replace(/"/g, '&quot;') + '" onblur="saveComments(' + r.id + ')" /></td>' +
            '</tr>';
    }
    $('#detailTbl').html(rows);
}

/* ── Change All (cmbChangeOpt) ───────────────────────────────────────────── */
// Called directly from the footer dropdown's inline `onchange` (see the
// _BillDetailModal partial). Bypasses jQuery delegation entirely so the
// handler fires the instant the value changes — no event-bubbling, no
// timing issues with destroy/rebind cycles.
window.applyChangeAllCallType = function (selectEl) {
    var newType = parseInt(selectEl && selectEl.value);
    if (!newType) return;                   // "-- Change All --" placeholder

    var rows = (typeof itemData !== 'undefined' && itemData) ? itemData : [];
    var changed = 0, lockedCount = 0;
    bc = 0; pc = 0; ac = 0; uc = 0;

    for (var i = 0; i < rows.length; i++) {
        var item = rows[i];
        if (item.locked) {
            lockedCount++;
        } else {
            item.callType = String(newType);
            changed++;
        }
        var ct = parseInt(item.callType);
        if (ct === 0) uc += parseFloat(item.amount || 0);
        if (ct === 1) bc += parseFloat(item.amount || 0);
        if (ct === 2) pc += parseFloat(item.amount || 0);
        if (ct === 3) ac += parseFloat(item.amount || 0);
    }

    // Diagnostic — remove once verified working.
    console.log('[applyChangeAllCallType]', { newType: newType, rows: rows.length, changed: changed, locked: lockedCount, bc: bc, pc: pc, ac: ac });

    rebuildDetailTable();                                              // desktop #detailTbl
    if (typeof buildMobileCards === 'function') buildMobileCards(rows); // mobile #sliderTrack
    refreshModalSummary();
    selectEl.value = '0';   // reset to placeholder
};

/* ── DataTables draw → sync stat cards & badge counts ───────────────────── */
$(document).on('draw.dt', '#tblBillMaster', function () {
    var n = $(this).DataTable().rows().count();
    $('#stat-total').text(n);
    $('#sbBadgePending').text(n);
    $('#billCount').text(n + ' record' + (n === 1 ? '' : 's'));
    $('#pgSub').text('Pending identification · ' + n + ' bill' + (n === 1 ? '' : 's'));
});

$(document).on('draw.dt', '#tblApprBills', function () {
    var n = $(this).DataTable().rows().count();
    $('#stat-pending').text(n);
    $('#sbBadgeApproval').text(n).show();
});

$(document).on('draw.dt', '#tblArcBills', function () {
    var n = $(this).DataTable().rows().count();
    $('#stat-history').text(n);
});

$(document).on('draw.dt', '#tblDeptBills', function () {
    var n = $(this).DataTable().rows().count();
    $('#stat-dept').text(n);
});

/* ── Status tab filter (All / Unidentified / Identified) ─────────────────── */
$(document).on('click', '.tis-tab', function () {
    $('.tis-tab').removeClass('active');
    $(this).addClass('active');
    var status = $(this).data('status');
    if (typeof dtMaster !== 'undefined' && dtMaster) {
        if (status === 'all') {
            dtMaster.column(0).search('').draw();
        } else {
            dtMaster.draw();
        }
    }
});

/* ── On every master-table redraw: just rebuild the mobile cards.
   The Action-column Process Bill button is already rendered by
   setDataSourceGridMaster in myJS.js (class .process-row-btn) — the
   capture-phase listener at the top of this file opens the modal on
   that exact class. Don't rewrite the cell here. */
$(document).on('draw.dt', '#tblBillMaster', function () {
    buildMobileBillCards();
});

/* ── Mobile bill cards for the master list ─────────────────────────────────
   Mirrors the desktop My Bills grid:
     • Currency column removed
     • Amount label is "Amount (KD)"
     • Comment is shown
     • CTA reads "Process Bill" (matches desktop) */
function buildMobileBillCards() {
    var $mob = $('#mobCards');
    $mob.empty();
    if (typeof myBills === 'undefined' || !myBills.length) return;

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    myBills.forEach(function (r) {
        var billId      = r.id;
        var commentTxt  = (r.comments || '').toString();
        var dateLabel   = (typeof formatMonthYear === 'function' ? formatMonthYear(r.billDate) : r.billDate) || '';
        var $card       = $('<div class="mbc"></div>');

        $card.html(
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
                '<div style="min-width:0">' +
                    '<div style="font-size:13px;font-weight:600">' + esc(r.empName || '') + '</div>' +
                    '<div style="font-size:11px;color:var(--tx3)">' + esc(r.providerName || '') + '</div>' +
                '</div>' +
                '<div style="text-align:right;flex-shrink:0">' +
                    '<div style="font-size:11px;color:var(--tx3)">' + esc(dateLabel) + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="mbc-amts">' +
                '<div><div class="mbc-al">Amount (KD)</div><div class="mbc-av">'  + parseFloat(r.totalAmount || 0).toFixed(3) + '</div></div>' +
                '<div><div class="mbc-al">Mobile</div><div class="mbc-av" style="font-size:12px">' + esc(r.mobile || '—') + '</div></div>' +
                '<div><div class="mbc-al">Last Updated</div><div class="mbc-av" style="font-size:11px">' +
                    esc(r.lastUpdatedOn ? ((typeof formatDateShort === 'function') ? formatDateShort(r.lastUpdatedOn) : r.lastUpdatedOn) : '—') +
                '</div></div>' +
            '</div>' +
            (commentTxt
                ? '<div class="mbc-comment" style="margin-top:8px;padding:8px 10px;background:var(--s2,#f8fafc);border-radius:6px;font-size:12px;color:var(--tx2,#475569);line-height:1.4;word-break:break-word">' +
                    '<div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--tx3,#64748b);margin-bottom:3px">Comment</div>' +
                    esc(commentTxt) +
                  '</div>'
                : '') +
            '<button class="mob-proc" onclick="void(0)">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px">' +
                '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
                ' Process Bill</button>'
        );

        $card.find('.mob-proc').on('click', function (e) {
            e.stopPropagation();
            if (typeof GBillId !== 'undefined') GBillId = billId;
            $('#hdnBillID').val(billId);
            openBillDetailModal(billId, r.empName || '', r.mobile || '', r.managerName || '', dateLabel);
        });

        $mob.append($card);
    });
}

/* ── Mobile cards for the APPROVAL DETAIL modal (#approvalDetailModal) ───
   Mirrors the My Bills "Process Bill" mobile card style (3-col header,
   description with duration, comment row) — minus the Contact field and
   Business/Personal buttons, since approvers don't classify calls. */
function buildApprovalDetailMobileCards(items) {
    var track = document.getElementById('apprDetMobCards');
    if (!track) return;
    track.innerHTML = '';
    if (!items || !items.length) return;

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    items.forEach(function (r) {
        var ct       = parseInt(r.callType);
        var ctLabel  = ct === 1 ? 'Business' : ct === 2 ? 'Personal' : ct === 3 ? 'Allowance' : '';
        var ctClass  = ct === 1 ? 'ap-ct-b' : ct === 2 ? 'ap-ct-p' : ct === 3 ? 'ap-ct-a' : '';
        var fmtDate  = (typeof formatDate === 'function') ? formatDate(r.callDate) : (r.callDate || '');
        var fmtTime  = (typeof formatTime === 'function') ? formatTime(r.callTime) : (r.callTime || '');

        // Header right column — date / time (show whichever is present)
        var whenInner = '';
        if (fmtDate) whenInner += '<div class="d">' + esc(fmtDate) + '</div>';
        if (fmtTime) whenInner += '<div>'           + esc(fmtTime) + '</div>';
        if (!whenInner) whenInner = '<div class="d">&mdash;</div>';

        // Description + duration in parentheses
        var descLine = r.description ? esc(r.description) : '&mdash;';
        if (r.duration) descLine += ' <span class="dur">(' + esc(r.duration) + ')</span>';

        var card = document.createElement('div');
        card.className = 'mdc appr-det-card';
        card.innerHTML =
            '<div class="mdc-hdr">' +
                '<div class="trans">' + esc(r.transType || '—') + '</div>' +
                '<div class="when">'  + whenInner + '</div>' +
                '<div class="amt">'   + parseFloat(r.amount || 0).toFixed(3) + '</div>' +
            '</div>' +
            '<div class="mdc-desc">' + descLine + '</div>' +
            '<div class="mdc-body" style="grid-template-columns:auto 1fr">' +
                '<div>' +
                    '<div class="mdc-lbl">Call Type</div>' +
                    (ctLabel
                        ? '<span class="ap-ct-pill ' + ctClass + '">' + ctLabel + '</span>'
                        : '<span class="ap-ct-pill ap-ct-p" style="background:#e5e7eb;color:#475569">—</span>') +
                '</div>' +
                '<div>' +
                    '<div class="mdc-lbl">Comment</div>' +
                    '<div class="mdc-val">' + (r.comment ? esc(r.comment) : '<span style="color:var(--tx3,#64748b)">—</span>') + '</div>' +
                '</div>' +
            '</div>';
        track.appendChild(card);
    });
}


/* ── Mobile cards for the Pending Approval list ──────────────────────────
   Mirrors the desktop #tblApprBills rows. Tapping a card toggles the
   .selected class — DoApprove() in myJS.js picks selections up from
   either the desktop table or these cards. */
function buildMobileApprovalCards(items) {
    var $mob = $('#mobApprCards');
    if (!$mob.length) return;
    $mob.empty();
    if (!items || !items.length) return;

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    items.forEach(function (r) {
        var billId   = r.billId;
        var nm       = (r.name || '').trim();
        var initials = nm.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase() || '?';
        var amount   = parseFloat(r.total || 0).toFixed(3);
        var bizCh    = parseFloat(r.businessCharges || 0).toFixed(3);
        var waiverN  = parseFloat(r.waiverAmount || 0);
        var waiver   = waiverN > 0 ? waiverN.toFixed(3) : '—';
        var empComm  = (r.comments || '').toString();
        var rejComm  = (r.aComments || '').toString();

        var $card = $('<div class="mbc mob-appr-card"></div>').attr('data-billid', billId);

        $card.html(
            // Top row: employee identity + selection checkbox
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">' +
                '<div style="display:flex;align-items:center;gap:10px;min-width:0">' +
                    '<div class="ap-emp" style="display:flex;align-items:center;gap:10px">' +
                        '<div class="ava" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;font-weight:700;font-size:11px;flex-shrink:0">' + esc(initials) + '</div>' +
                        '<div style="min-width:0">' +
                            '<div style="font-size:13px;font-weight:600;color:var(--tx1,#0f172a)">' + esc(nm || '—') + '</div>' +
                            '<div style="font-size:11px;color:var(--tx3,#64748b)">' + esc(r.org || '') + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<label class="appr-sel-lbl" style="flex-shrink:0;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--tx3,#64748b);cursor:pointer;user-select:none">' +
                    '<input type="checkbox" class="appr-sel" />' +
                    '<span>Select</span>' +
                '</label>' +
            '</div>' +
            // Amounts strip
            '<div class="mbc-amts" style="margin-top:10px">' +
                '<div><div class="mbc-al">Bill Date</div><div class="mbc-av" style="font-size:11px">' + esc(r.billDate || '—') + '</div></div>' +
                '<div><div class="mbc-al">Amount (KD)</div><div class="mbc-av">' + amount + '</div></div>' +
                '<div><div class="mbc-al">Number</div><div class="mbc-av" style="font-size:12px">' + esc(r.subNo || '—') + '</div></div>' +
            '</div>' +
            '<div class="mbc-amts" style="margin-top:6px">' +
                '<div><div class="mbc-al">Biz Charges</div><div class="mbc-av">' + bizCh + '</div></div>' +
                '<div><div class="mbc-al">Waiver</div><div class="mbc-av">' + esc(waiver) + '</div></div>' +
            '</div>' +
            // Employee's existing comment (if any)
            (empComm
                ? '<div class="mbc-comment" style="margin-top:8px;padding:8px 10px;background:var(--s2,#f8fafc);border-radius:6px;font-size:12px;color:var(--tx2,#475569);line-height:1.4;word-break:break-word">' +
                    '<div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--tx3,#64748b);margin-bottom:3px">Employee Comments</div>' +
                    esc(empComm) +
                  '</div>'
                : '') +
            // Rejection reason input
            '<div style="margin-top:10px">' +
                '<div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--tx3,#64748b);margin-bottom:4px">Rejection Reason</div>' +
                '<input type="text" class="appr-comment-input" id="txtCommM' + billId + '"' +
                    ' value="' + esc(rejComm) + '"' +
                    ' onblur="saveCommentM(' + billId + ')"' +
                    ' placeholder="Reason if rejecting…" />' +
            '</div>' +
            // View calls button
            '<button type="button" class="arc-view-btn mob-appr-view" style="margin-top:10px;width:100%;justify-content:center">' +
                '<i class="fa fa-eye me-1"></i>View Calls' +
            '</button>'
        );

        // Selection: tapping the checkbox (or its label) toggles .selected on the card.
        $card.find('.appr-sel').on('change', function () {
            $card.toggleClass('selected', this.checked);
        });
        // Make the rejection input and View button NOT propagate as card selection.
        $card.on('click', 'input.appr-comment-input, .mob-appr-view', function (e) { e.stopPropagation(); });

        // View calls — opens the existing approval-detail modal.
        $card.find('.mob-appr-view').on('click', function (e) {
            e.stopPropagation();
            if (typeof openWindow === 'function') openWindow(billId);
        });

        $mob.append($card);
    });
}

/* Mobile-only comment saver — keeps myAB[i].aComments + the (hidden)
   desktop input in sync so DoApprove reads the same value either way. */
function saveCommentM(id) {
    var v = ($('#txtCommM' + id).val() || '').toString();
    if (typeof myAB !== 'undefined' && myAB) {
        for (var i = 0; i < myAB.length; i++) {
            if (myAB[i].billId == id) { myAB[i].aComments = v; break; }
        }
    }
    $('#txtComm' + id).val(v);   // keep desktop hidden input in sync
}

/* ── Mobile cards for the Bills History list ─────────────────────────────
   Mirrors buildMobileBillCards but for archived bills. Called from
   setDataSourceArchived in myJS.js. View button opens the print-style
   statement via getMyArcBill. */
function buildMobileArchivedCards(items) {
    var $mob = $('#mobArcCards');
    if (!$mob.length) return;
    $mob.empty();
    if (!items || !items.length) return;

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    items.forEach(function (r) {
        var billId    = r.billId;
        var status    = (r.status || '').toString();
        var statusLc  = status.toLowerCase();
        var statusCls = statusLc === 'closed'   ? 'arc-stat-closed'
                      : statusLc === 'pending'  ? 'arc-stat-pending'
                      : statusLc === 'approved' ? 'arc-stat-approved'
                      : statusLc === 'rejected' ? 'arc-stat-rejected'
                      : 'arc-stat-default';
        var dateLabel = (typeof formatMonthYear === 'function' ? formatMonthYear(r.billDate) : r.billDate) || '';
        var $card = $('<div class="mbc"></div>');

        $card.html(
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
                '<div style="min-width:0">' +
                    '<div style="font-size:13px;font-weight:600">' + esc(r.employeeName || '') + '</div>' +
                    '<div style="font-size:11px;color:var(--tx3)">' + esc(r.provider || '') + '</div>' +
                '</div>' +
                '<div style="text-align:right;flex-shrink:0">' +
                    '<span class="arc-stat-pill ' + statusCls + '">' + esc(status || '—') + '</span>' +
                    '<div style="font-size:11px;color:var(--tx3);margin-top:4px">' + esc(dateLabel) + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="mbc-amts">' +
                '<div><div class="mbc-al">Amount (KD)</div><div class="mbc-av">' + parseFloat(r.totalAmount || 0).toFixed(3) + '</div></div>' +
                '<div><div class="mbc-al">Mobile</div><div class="mbc-av" style="font-size:12px">' + esc(r.mobile || '—') + '</div></div>' +
                '<div><div class="mbc-al">Deduction</div><div class="mbc-av">' + parseFloat(r.deductable || 0).toFixed(3) + '</div></div>' +
            '</div>' +
            '<button type="button" class="arc-view-btn mob-arc-view" style="margin-top:10px;width:100%;justify-content:center">' +
                '<i class="fa fa-eye me-1"></i>View Bill' +
            '</button>'
        );

        $card.find('.mob-arc-view').on('click', function (e) {
            e.stopPropagation();
            if (typeof getMyArcBill === 'function') getMyArcBill(billId);
        });

        $mob.append($card);
    });
}
