/* ============================================================================
   ManageCallType.js — Settings ▸ Manage Policy
   ----------------------------------------------------------------------------
   Ported from the legacy jqWidgets/select2 page to:
     • Bootstrap 5 + native <select> controls
     • DataTables.net for the policy grid and the employee picker
     • Bootstrap modal for employee multi-select (replaces jqxWindow/jqxGrid)
     • SweetAlert2 for confirmations / toasts
     • #loaderDiv for loading states

   Endpoints (all /Setting/...):
     GET  GetProvider                         -> { providerList:[{id,name}] }
     GET  FillTransType?providerId=           -> { dtTransType:[{transType}] }
     GET  FillDesc?providerId=&transType=     -> { dtdesc:[{description}] }
     GET  GetCallType                         -> { callTypeList:[{id,name}] }
     GET  GetLineTypes                        -> [ {id,name} ]
     GET  GetEmployee                         -> { dtEmp:[{uid,employeeName,subNoId,subNo,org}] }
     GET  GetPolicy                           -> { dtPolicy:[...] }
     GET  GetPolicyDetail?id=                 -> { dtID:[{id}] }   (id = sub_no_id)
     POST AddPolicy    (JSON Policy)          -> { message }
     POST UpdatePolicy (JSON Policy)          -> { message }
     POST ApplyPolicy                         -> { message }
     POST DeletePolicy (JSON Policy)          -> { message }
   ============================================================================ */
(function () {
    'use strict';

    var employees = [];   // all EmpSub rows from GetEmployee
    var selectedEmp = []; // [{uid, subNoId, name, subNo, org}] committed on Done
    var workingSel = {};  // subNoId -> emp object, live selection while the modal is open
    var policies = [];
    var dtPolicy = null;
    var dtEmp = null;

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function showLoader(t, s) {
        $('#loaderTitle').text(t || 'Loading…'); $('#loaderSub').text(s || 'Please wait…');
        $('#loaderDiv').addClass('show-loader'); $('body').addClass('loader-open');
    }
    function hideLoader() { $('#loaderDiv').removeClass('show-loader'); $('body').removeClass('loader-open'); }
    function flash(target, msg) {
        if (target) $(target).focus();
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: msg, showConfirmButton: false, timer: 2600 });
    }
    function toastOk(msg) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: msg, showConfirmButton: false, timer: 1800 });
    }

    // case-insensitive property reader (handles camelCase or PascalCase JSON)
    function pick(obj, name) {
        if (!obj) return undefined;
        if (obj[name] !== undefined) return obj[name];
        var cap = name.charAt(0).toUpperCase() + name.slice(1);
        if (obj[cap] !== undefined) return obj[cap];
        var low = name.charAt(0).toLowerCase() + name.slice(1);
        return obj[low];
    }

    // ── Lookups ────────────────────────────────────────────────────────────────
    function fillProviders() {
        $.getJSON('/Setting/GetProvider', function (res) {
            var list = pick(res, 'providerList') || [];
            var opts = '<option value="">Select Provider</option>';
            list.forEach(function (p) {
                opts += '<option value="' + esc(pick(p, 'id')) + '">' + esc(pick(p, 'name')) + '</option>';
            });
            $('#cmbProvider').html(opts);
        }).fail(function () {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load providers.' });
        });
    }
    function fillCallTypes() {
        $.getJSON('/Setting/GetCallType', function (res) {
            var list = pick(res, 'callTypeList') || [];
            var opts = '<option value="">Select Call Type</option>';
            list.forEach(function (c) {
                opts += '<option value="' + esc(pick(c, 'id')) + '">' + esc(pick(c, 'name')) + '</option>';
            });
            $('#cmbCallType').html(opts);
        });
    }
    function fillLineTypes() {
        $.getJSON('/Setting/GetLineTypes', function (res) {
            var opts = '<option value="">Select Line Type</option>';
            (res || []).forEach(function (l) {
                opts += '<option value="' + esc(pick(l, 'id')) + '">' + esc(pick(l, 'name')) + '</option>';
            });
            $('#cmbLineType').html(opts);
        });
    }
    function loadEmployees() {
        $.getJSON('/Setting/GetEmployee', function (res) {
            employees = (pick(res, 'dtEmp') || []).map(function (e) {
                return {
                    uid: pick(e, 'uid'), employeeName: pick(e, 'employeeName'),
                    subNoId: pick(e, 'subNoId'), subNo: pick(e, 'subNo'), org: pick(e, 'org')
                };
            });
        });
    }
    function fillTransType(providerId, cb) {
        $.getJSON('/Setting/FillTransType?providerId=' + encodeURIComponent(providerId), function (res) {
            var list = pick(res, 'dtTransType') || [];
            var opts = '<option value="">Select Trans Type</option>';
            list.forEach(function (t) {
                var v = pick(t, 'transType');
                opts += '<option value="' + esc(v) + '">' + esc(v) + '</option>';
            });
            $('#cmbTransType').html(opts);
            if (typeof cb === 'function') cb();
        });
    }
    function fillDesc(providerId, transType, cb) {
        $.getJSON('/Setting/FillDesc?providerId=' + encodeURIComponent(providerId) + '&transType=' + encodeURIComponent(transType), function (res) {
            var list = pick(res, 'dtdesc') || [];
            var opts = '';
            list.forEach(function (d) {
                var v = pick(d, 'description');
                opts += '<option value="' + esc(v) + '">' + esc(v) + '</option>';
            });
            $('#cmbDesc').html(opts);
            if (typeof cb === 'function') cb();
        });
    }

    // ── Policy grid ─────────────────────────────────────────────────────────────
    function boolBadge(v) {
        return v ? '<span class="mct-bool yes">Yes</span>' : '<span class="mct-bool no">No</span>';
    }
    function loadPolicies() {
        $.getJSON('/Setting/GetPolicy', function (res) {
            policies = (pick(res, 'dtPolicy') || []).map(function (p) {
                return {
                    id: pick(p, 'id'), providerId: pick(p, 'providerId'), providerName: pick(p, 'providerName'),
                    transType: pick(p, 'transType'), description: pick(p, 'description'),
                    callTypeId: pick(p, 'callTypeId'), callType: pick(p, 'callType'),
                    lineTypeId: pick(p, 'lineTypeId'), lineType: pick(p, 'lineType'),
                    isAll: pick(p, 'isAll'), isSupImp: pick(p, 'isSupImp')
                };
            });
            renderPolicies();
        });
    }
    function policyModal() {
        return bootstrap.Modal.getOrCreateInstance(document.getElementById('policyModal'));
    }
    function renderPolicies() {
        if (dtPolicy) { dtPolicy.destroy(); dtPolicy = null; }
        var rows = '';
        policies.forEach(function (p) {
            rows += '<tr data-id="' + p.id + '">' +
                '<td>' + esc(p.providerName) + '</td>' +
                '<td>' + esc(p.transType) + '</td>' +
                '<td>' + esc(p.description) + '</td>' +
                '<td>' + esc(p.callType) + '</td>' +
                '<td>' + esc(p.lineType) + '</td>' +
                '<td class="text-center">' + (p.isAll
                    ? '<span class="mct-bool yes">All Employees</span>'
                    : '<button type="button" class="btn btn-sm mct-viewlist" onclick="window._mctViewList(' + p.id + ')"><i class="fa fa-list me-1"></i>View List</button>') + '</td>' +
                '<td class="text-center">' + boolBadge(p.isSupImp) + '</td>' +
                '<td class="text-center"><button type="button" class="mct-row-btn edit" title="Edit" onclick="window._mctEdit(' + p.id + ')"><i class="fa fa-pen"></i></button></td>' +
                '<td class="text-center"><button type="button" class="mct-row-btn delete" title="Delete" onclick="window._mctDelete(' + p.id + ')"><i class="fa fa-trash"></i></button></td>' +
            '</tr>';
        });
        $('#tblPolicy tbody').html(rows);
        dtPolicy = $('#tblPolicy').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true, dom: 'tip',
            order: [[0, 'asc']], columnDefs: [{ orderable: false, targets: [7, 8] }]
        });
        var s = $('#txtSearchPolicy').val() || '';
        if (s) dtPolicy.search(s).draw();
    }

    // ── Employee modal ──────────────────────────────────────────────────────────
    function renderEmpTable() {
        if (dtEmp) { dtEmp.destroy(); dtEmp = null; }

        // Seed the live working selection from the committed selection.
        workingSel = {};
        selectedEmp.forEach(function (e) { workingSel[e.subNoId] = e; });

        var rows = '';
        employees.forEach(function (e) {
            var checked = workingSel[e.subNoId] ? 'checked' : '';
            rows += '<tr data-subno="' + e.subNoId + '" data-uid="' + e.uid + '">' +
                '<td class="text-center"><input type="checkbox" class="emp-active-check mct-emp-check" ' + checked + ' /></td>' +
                '<td>' + esc(e.employeeName) + '</td>' +
                '<td>' + esc(e.subNo) + '</td>' +
                '<td>' + esc(e.org) + '</td>' +
            '</tr>';
        });
        $('#tblEmp tbody').html(rows);
        // No pagination — every employee renders, so cross-page selections are
        // never lost. The scrollable modal body provides the scrollbar; the
        // header is kept sticky via CSS.
        dtEmp = $('#tblEmp').DataTable({
            responsive: false, searching: true, paging: false, info: false,
            lengthChange: false, destroy: true, dom: 't',
            order: [[1, 'asc']], columnDefs: [{ orderable: false, targets: 0 }]
        });
        updateEmpCount();
    }
    function updateEmpCount() {
        var n = Object.keys(workingSel).length;
        $('#empSelCount').text(n + ' selected');
    }
    function applyEmpSelectionToButton() {
        var n = selectedEmp.length;
        if (n > 0) {
            $('#empBtnLabel').text(n + ' employee' + (n > 1 ? 's' : '') + ' selected');
            $('#btnEmployee').addClass('has-selection');
        } else {
            $('#empBtnLabel').text('Select Employees');
            $('#btnEmployee').removeClass('has-selection');
        }
    }

    // ── Form helpers ────────────────────────────────────────────────────────────
    function selectedDescriptions() {
        return $('#cmbDesc').val() || [];
    }
    function resetForm() {
        $('#hidID').val('');
        $('#cmbProvider').val('');
        $('#cmbTransType').html('<option value="">Select Trans Type</option>');
        $('#cmbDesc').html('');
        $('#cmbCallType').val('');
        $('#cmbLineType').val('');
        $('#chkAllDesc, #chkAllEmp, #chkSupImp').prop('checked', false);
        $('#cmbDesc').prop('disabled', false);
        $('#btnEmployee').prop('disabled', false);
        selectedEmp = [];
        applyEmpSelectionToButton();
        $('#btnAdd').show(); $('#btnUpdate').hide();
    }

    // Opens a fresh "Add Policy" modal (toolbar button). The modal itself is
    // shown by Bootstrap's data-bs-toggle; this just resets the form.
    window._mctNew = function () {
        resetForm();
        $('#policyModalTitle').text('Add Policy');
    };

    function buildPayload() {
        return {
            id:        parseInt($('#hidID').val()) || 0,
            providerId: parseInt($('#cmbProvider').val()) || 0,
            transType: $('#cmbTransType').val() || '',
            callTypeId: parseInt($('#cmbCallType').val()) || 0,
            lineTypeId: parseInt($('#cmbLineType').val()) || 0,
            isAll:     $('#chkAllEmp').is(':checked'),
            isAllDesc: $('#chkAllDesc').is(':checked'),
            isSupImp:  $('#chkSupImp').is(':checked'),
            des:       $('#chkAllDesc').is(':checked') ? [] : selectedDescriptions(),
            emp:       selectedEmp.map(function (e) { return e.uid; }),
            num:       selectedEmp.map(function (e) { return e.subNoId; })
        };
    }

    function addPolicy() {
        var p = buildPayload();
        if (!p.providerId) { flash('#cmbProvider', 'Please select a Provider'); return; }
        if (!p.transType)  { flash('#cmbTransType', 'Please select a Trans Type'); return; }
        if (!p.callTypeId) { flash('#cmbCallType', 'Please select a Call Type'); return; }
        if (!p.lineTypeId) { flash('#cmbLineType', 'Please select a Line Type'); return; }
        if (!p.isAllDesc && p.des.length === 0) { flash('#cmbDesc', 'Select description(s) or tick All Description'); return; }
        if (!p.isAll && p.emp.length === 0) { flash('#btnEmployee', 'Select employee(s) or tick All Employee'); return; }

        showLoader('Saving Policy…', 'Please wait!');
        $.ajax({
            type: 'POST', url: '/Setting/AddPolicy',
            contentType: 'application/json; charset=utf-8', data: JSON.stringify(p),
            success: function (res) {
                hideLoader();
                toastOk(pick(res, 'message') || 'Policy Added Successfully');
                policyModal().hide();
                resetForm(); loadPolicies();
            },
            error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not add policy.' }); }
        });
    }

    function updatePolicy() {
        var p = buildPayload();
        if (!p.id) { flash(null, 'Nothing to update — pick a policy from the grid first'); return; }
        if (!p.isAll && p.emp.length === 0) { flash('#btnEmployee', 'Select employee(s) or tick All Employee'); return; }

        showLoader('Updating Policy…', 'Please wait!');
        $.ajax({
            type: 'POST', url: '/Setting/UpdatePolicy',
            contentType: 'application/json; charset=utf-8', data: JSON.stringify(p),
            success: function (res) {
                hideLoader();
                toastOk(pick(res, 'message') || 'Policy Updated Successfully');
                policyModal().hide();
                resetForm(); loadPolicies();
            },
            error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not update policy.' }); }
        });
    }

    function applyPolicy() {
        Swal.fire({
            title: 'Apply policies?', text: 'This re-classifies call records based on the current policies.',
            icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, apply', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            showLoader('Applying Policies…', 'Please wait!');
            $.ajax({
                type: 'POST', url: '/Setting/ApplyPolicy', contentType: 'application/json; charset=utf-8', data: '{}',
                success: function (res) { hideLoader(); toastOk(res.message || 'Policy Applied Successfully'); },
                error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not apply policies.' }); }
            });
        });
    }

    // edit/delete exposed for inline onclick
    window._mctEdit = function (id) {
        var p = policies.find(function (x) { return x.id === id; });
        if (!p) return;
        $('#policyModalTitle').text('Edit Policy');
        policyModal().show();
        $('#hidID').val(p.id);
        $('#cmbProvider').val(p.providerId);
        $('#cmbCallType').val(p.callTypeId);
        $('#cmbLineType').val(p.lineTypeId);
        $('#chkAllEmp').prop('checked', p.isAll);
        $('#chkSupImp').prop('checked', p.isSupImp);
        $('#btnAdd').hide(); $('#btnUpdate').show();

        // Trans type + description for context
        fillTransType(p.providerId, function () {
            $('#cmbTransType').val(p.transType);
            fillDesc(p.providerId, p.transType || '', function () {
                if (p.description) $('#cmbDesc option').each(function () {
                    if ($(this).val() === p.description) $(this).prop('selected', true);
                });
            });
        });

        // Preselect the policy's employees (by sub_no_id)
        selectedEmp = [];
        if (!p.isAll) {
            $.getJSON('/Setting/GetPolicyDetail?id=' + id, function (res) {
                (res.dtID || []).forEach(function (d) {
                    var e = employees.find(function (x) { return x.subNoId === d.id; });
                    if (e) selectedEmp.push({ uid: e.uid, subNoId: e.subNoId, name: e.employeeName, subNo: e.subNo, org: e.org });
                });
                applyEmpSelectionToButton();
            });
        } else {
            applyEmpSelectionToButton();
        }
        $('html,body').animate({ scrollTop: 0 }, 200);
    };

    // Shows the employees associated with a (non-"all") policy.
    var dtEmpList = null;
    window._mctViewList = function (id) {
        showLoader('Loading…', 'Fetching employees…');
        $.getJSON('/Setting/GetEmpList?id=' + id, function (res) {
            hideLoader();
            var list = pick(res, 'dtEmp') || [];
            if (dtEmpList) { dtEmpList.destroy(); dtEmpList = null; }
            var rows = '';
            list.forEach(function (e) {
                rows += '<tr><td>' + esc(pick(e, 'empName')) + '</td><td>' + esc(pick(e, 'empNo')) + '</td></tr>';
            });
            $('#tblEmpList tbody').html(rows);
            $('#empListEmpty').toggle(list.length === 0);
            $('#tblEmpList').toggle(list.length > 0);
            if (list.length > 0) {
                dtEmpList = $('#tblEmpList').DataTable({
                    responsive: false, searching: true, paging: list.length > 10, pageLength: 10,
                    info: false, lengthChange: false, destroy: true, dom: list.length > 10 ? 'fti' : 't',
                    order: [[0, 'asc']]
                });
            }
            bootstrap.Modal.getOrCreateInstance(document.getElementById('empListModal')).show();
        }).fail(function () {
            hideLoader();
            Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load the employee list.' });
        });
    };

    window._mctDelete = function (id) {
        Swal.fire({
            title: 'Delete this policy?', text: 'This cannot be undone.',
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545',
            confirmButtonText: 'Yes, delete', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            showLoader('Deleting…', 'Please wait!');
            $.ajax({
                type: 'POST', url: '/Setting/DeletePolicy',
                contentType: 'application/json; charset=utf-8', data: JSON.stringify({ id: id }),
                success: function (res) { hideLoader(); toastOk(res.message || 'Deleted Successfully'); loadPolicies(); },
                error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not delete policy.' }); }
            });
        });
    };

    // ── Wire-up ─────────────────────────────────────────────────────────────────
    $(document).ready(function () {

        $('#cmbProvider').on('change', function () {
            var v = this.value;
            $('#cmbTransType').html('<option value="">Select Trans Type</option>');
            $('#cmbDesc').html('');
            if (v) fillTransType(v);
        });

        $('#cmbTransType').on('change', function () {
            var prov = $('#cmbProvider').val();
            var tt = this.value;
            $('#cmbDesc').html('');
            if (prov && tt) fillDesc(prov, tt);
        });

        $('#chkAllDesc').on('change', function () {
            $('#cmbDesc').prop('disabled', this.checked);
        });

        $('#chkAllEmp').on('change', function () {
            // When "All Employee" is on, individual selection is not needed.
            $('#btnEmployee').prop('disabled', this.checked);
        });

        $('#btnAdd').on('click', addPolicy);
        $('#btnUpdate').on('click', updatePolicy);
        $('#btnApply').on('click', applyPolicy);
        $('#btnCancel').on('click', resetForm);

        // Employee modal — opened from the policy modal. To avoid Bootstrap's
        // stacked-modal backdrop issues, we SWAP: hide the policy modal, show the
        // employee modal; when the employee modal closes, re-show the policy modal.
        var policyEl = document.getElementById('policyModal');
        var empEl    = document.getElementById('empModal');

        $('#btnEmployee').on('click', function () {
            if (this.disabled) return;
            policyEl.addEventListener('hidden.bs.modal', function reopen() {
                policyEl.removeEventListener('hidden.bs.modal', reopen);
                bootstrap.Modal.getOrCreateInstance(empEl).show();
            });
            bootstrap.Modal.getOrCreateInstance(policyEl).hide();
        });

        // When the employee picker closes (Done or Cancel), return to the policy modal.
        empEl.addEventListener('hidden.bs.modal', function () {
            bootstrap.Modal.getOrCreateInstance(policyEl).show();
        });

        $('#empModal').on('shown.bs.modal', function () { renderEmpTable(); });

        // update the live map whenever a row checkbox changes
        function setRowSelected(tr, on) {
            var subNoId = parseInt($(tr).data('subno'));
            var e = employees.find(function (x) { return x.subNoId === subNoId; });
            if (!e) return;
            if (on) workingSel[subNoId] = { uid: e.uid, subNoId: e.subNoId, name: e.employeeName, subNo: e.subNo, org: e.org };
            else delete workingSel[subNoId];
        }
        $(document).on('change', '.mct-emp-check', function () {
            setRowSelected($(this).closest('tr'), this.checked);
            updateEmpCount();
        });
        // "select all" applies to the currently displayed (filtered) rows
        $(document).on('change', '#chkEmpAllRows', function () {
            var on = this.checked;
            $('#tblEmp tbody tr').each(function () {
                $(this).find('.mct-emp-check').prop('checked', on);
                setRowSelected(this, on);
            });
            updateEmpCount();
        });
        // clicking a row toggles its checkbox
        $(document).on('click', '#tblEmp tbody tr', function (e) {
            if ($(e.target).is('input')) return;
            var cb = $(this).find('.mct-emp-check');
            cb.prop('checked', !cb.is(':checked'));
            setRowSelected(this, cb.is(':checked'));
            updateEmpCount();
        });
        $('#btnEmpDone').on('click', function () {
            selectedEmp = Object.keys(workingSel).map(function (k) { return workingSel[k]; });
            applyEmpSelectionToButton();
        });

        // Searches
        $('#txtSearchPolicy').on('input', function () { if (dtPolicy) dtPolicy.search(this.value || '').draw(); });
        $('#txtSearchEmp').on('input', function () { if (dtEmp) dtEmp.search(this.value || '').draw(); });

        // Init
        fillProviders();
        fillCallTypes();
        fillLineTypes();
        loadEmployees();
        loadPolicies();
    });
})();
