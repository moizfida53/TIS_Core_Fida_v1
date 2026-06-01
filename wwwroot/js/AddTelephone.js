/* ============================================================================
   AddTelephone.js — Manage Telephone page (ASP.NET Core port)
   ----------------------------------------------------------------------------
   UI flow:
     • Each tab has a toolbar with an Add button + a DataTable grid.
     • Adding / editing happens inside a Bootstrap modal — never inline.
     • Each grid row has an Edit pencil that opens the modal pre-populated.
     • Save / Update / Cancel all flow through SweetAlert confirmations.
   ============================================================================ */
(function () {
    'use strict';

    // ── State caches (populated by /Admin/GetTelData) ─────────────────────────
    var telephones = [];  // dtTel
    var assignments = []; // dtAsg
    var unassigned  = []; // dtUnAsg
    var providers   = []; // dtProvider
    var employees   = []; // dtEmp
    var lineTypes   = [];
    var costCenters = [];

    // ── DataTable handles ────────────────────────────────────────────────────
    var dtTelephones = null;
    var dtAssign     = null;

    // ── Snapshot of form values at modal-open time (for dirty checks) ─────────
    var telSnapshot = null;
    var asgSnapshot = null;
    var allowClose  = { telephone: false, assign: false };

    // ─────────────────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function flash(target, msg) {
        $(target).focus();
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: msg, showConfirmButton: false, timer: 2500 });
    }
    function ymd(value) {
        if (!value) return '';
        var d = new Date(value);
        if (isNaN(d.getTime())) return '';
        var m = ('0' + (d.getMonth() + 1)).slice(-2);
        var dd = ('0' + d.getDate()).slice(-2);
        return d.getFullYear() + '-' + m + '-' + dd;
    }
    function getTelSnapshot() {
        return JSON.stringify({
            id:   $('#hidID').val(),
            sub:  $('#txtSubNo').val(),
            desc: $('#txtSubDesc').val(),
            prov: $('#cmbProvider').val(),
            type: $('#cmbType').val(),
            acct: $('#txtAccountNo').val(),
            lt:   $('#cmbLineType').val()
        });
    }
    function getAsgSnapshot() {
        return JSON.stringify({
            id:    $('#hidAID').val(),
            emp:   $('#cmbEmployee').val(),
            cc:    $('#cmbCostCenter').val(),
            num:   $('#cmbNumber').val(),
            stat:  $('#cmbLineStatus').val(),
            bus:   $('#txtBusLimit').val(),
            alw:   $('#txtAlwLimit').val(),
            start: $('#cmbStartDate').val(),
            end:   $('#cmbEndDate').val()
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  INITIAL DATA LOAD
    // ─────────────────────────────────────────────────────────────────────────
    function loadAll() {
        $.ajax({
            type: 'GET', cache: false, url: '/Admin/GetTelData', dataType: 'json',
            success: function (res) {
                telephones  = res.dtTel      || [];
                assignments = res.dtAsg      || [];
                unassigned  = res.dtUnAsg    || [];
                providers   = res.dtProvider || [];
                employees   = res.dtEmp      || [];
                fillProviderDropdown();
                fillProviderColFilter();
                fillEmployeePicker();
                fillNumberPicker();
                renderTelephoneGrid();
                renderAssignGrid();
            },
            error: function () { Swal.fire({ icon: 'error', title: 'Load failed', text: 'Could not load telephone data.' }); }
        });
        loadLineTypes();
        loadCostCenters();
    }
    function loadLineTypes() {
        $.ajax({
            type: 'GET', url: '/Admin/GetLineTypes', dataType: 'json',
            success: function (data) {
                lineTypes = data || [];
                var $ddl = $('#cmbLineType');
                $ddl.empty().append('<option value="">-- Select Line Type --</option>');
                lineTypes.forEach(function (i) { $ddl.append($('<option>').val(i.id).text(i.name)); });
                fillLineTypeColFilter();
            }
        });
    }
    function loadCostCenters() {
        $.ajax({
            type: 'GET', url: '/Admin/GetCostCenter', dataType: 'json',
            success: function (data) {
                costCenters = data || [];
                // Populate the searchable picker (was a <select>).
                fillCostCenterPicker();
            }
        });
    }
    function fillProviderDropdown(selectedId) {
        var $ddl = $('#cmbProvider');
        $ddl.empty().append('<option value="">Select Provider</option>');
        (providers || []).forEach(function (p) {
            $ddl.append($('<option>').val(p.id || p.ID).text(p.name || p.NAME || p.providerName));
        });
        if (selectedId != null) $ddl.val(String(selectedId));
    }
    function fillProviderColFilter() {
        var saved = $('#filterProviderCol').val() || '';
        var $f = $('#filterProviderCol');
        $f.empty().append('<option value="">All</option>');
        (providers || []).forEach(function (p) {
            $f.append($('<option>').text(p.name || p.NAME || p.providerName));
        });
        if (saved) $f.val(saved);
    }
    function fillLineTypeColFilter() {
        var saved = $('#filterLineTypeCol').val() || '';
        var $f = $('#filterLineTypeCol');
        $f.empty().append('<option value="">All</option>');
        (lineTypes || []).forEach(function (lt) {
            $f.append($('<option>').text(lt.name));
        });
        if (saved) $f.val(saved);
    }

    // ── Searchable picker helpers ────────────────────────────────────────────
    // Each picker has the structure: .tel-picker[data-picker="name"]
    //   > <input type="hidden" id="cmb…">   ← the value
    //   > <button class="tel-picker-btn">    ← the trigger / display
    //   > <div class="dropdown-menu tel-picker-menu">
    //       <input class="tel-picker-search">  ← filter
    //       <div class="tel-picker-list">       ← items
    var PLACEHOLDERS = {
        employee:   'Select Employee',
        costCenter: 'Select Cost Center',
        number:     'Select Number'
    };

    function fillPicker(name, items) {
        var $p = $('.tel-picker[data-picker="' + name + '"]');
        if (!$p.length) return;
        var $list = $p.find('.tel-picker-list');
        $list.empty();

        if (!items || !items.length) {
            $list.append('<div class="tel-picker-empty">No matching records</div>');
            return;
        }

        items.forEach(function (it) {
            var $item = $('<div class="tel-picker-item"></div>')
                .attr('data-id',     it.id)
                .attr('data-text',   it.text)
                .attr('data-search', (it.search || it.text || '').toLowerCase())
                .text(it.text);
            $list.append($item);
        });

        // Re-highlight any current selection
        var currentId = $p.find('input[type="hidden"]').val();
        if (currentId) {
            $list.find('.tel-picker-item[data-id="' + currentId + '"]').addClass('selected');
            var label = $list.find('.tel-picker-item.selected').attr('data-text');
            if (label) {
                $p.find('.tel-picker-btn').text(label).removeClass('is-placeholder');
            }
        }
    }

    function setPickerValue(name, id) {
        var $p = $('.tel-picker[data-picker="' + name + '"]');
        if (!$p.length) return;
        var $hidden = $p.find('input[type="hidden"]');
        var $btn    = $p.find('.tel-picker-btn');
        if (!id) {
            $hidden.val('');
            $btn.text(PLACEHOLDERS[name] || 'Select').addClass('is-placeholder');
            $p.find('.tel-picker-item').removeClass('selected');
            return;
        }
        $hidden.val(id);
        $p.find('.tel-picker-item').removeClass('selected');
        var $item = $p.find('.tel-picker-item[data-id="' + id + '"]');
        if ($item.length) {
            $item.addClass('selected');
            $btn.text($item.attr('data-text')).removeClass('is-placeholder');
        } else {
            // Item not yet in the list (data loading). Keep hidden value, blank text for now.
            $btn.text(PLACEHOLDERS[name] || 'Select').addClass('is-placeholder');
        }
    }

    function fillEmployeePicker() {
        var items = (employees || []).map(function (e) {
            var id   = e.empId   || e.EmpId;
            var no   = (e.empNo   || e.EmpNo   || '').toString();
            var name = (e.empName || e.EmpName || '').toString();
            return { id: id, text: (no ? no + ' — ' : '') + name, search: no + ' ' + name };
        });
        fillPicker('employee', items);
    }
    function fillCostCenterPicker() {
        var items = (costCenters || []).map(function (c) {
            var code = (c.code || '').toString();
            var name = (c.name || '').toString();
            return { id: c.id, text: (code ? code + ' — ' : '') + name, search: code + ' ' + name };
        });
        fillPicker('costCenter', items);
    }
    function fillNumberPicker() {
        var items = (unassigned || []).map(function (n) {
            var id   = n.id || n.ID;
            var sub  = (n.subNo || n.SUBNO || '').toString();
            var desc = (n.description || n.DESCRIPTION || '').toString();
            return { id: id, text: sub + (desc ? ' — ' + desc : ''), search: sub + ' ' + desc };
        });
        fillPicker('number', items);
    }

    // Backwards-compat shims — older code paths still call these names.
    function fillEmployeeDropdown(selectedId) { fillEmployeePicker();   if (selectedId != null) setPickerValue('employee',   selectedId); }
    function fillNumberDropdown(selectedId)   { fillNumberPicker();     if (selectedId != null) setPickerValue('number',     selectedId); }

    // ─────────────────────────────────────────────────────────────────────────
    //  TELEPHONE GRID  (Add tab)
    // ─────────────────────────────────────────────────────────────────────────
    function renderTelephoneGrid() {
        // Preserve current column filter values across grid rebuilds
        var savedProviderFilter  = $('#filterProviderCol').val()  || '';
        var savedBusinessFilter  = $('#filterBusinessCol').val()  || '';
        var savedLineTypeFilter  = $('#filterLineTypeCol').val()  || '';
        if (dtTelephones) { dtTelephones.destroy(); dtTelephones = null; }
        var rows = '';
        (telephones || []).forEach(function (t) {
            var business = (String(t.type).toLowerCase() === 'true' || t.type === true);
            rows += '<tr data-id="' + (t.id) + '">' +
                '<td>' + esc(t.subNo) + '</td>' +
                '<td>' + esc(t.providerName || '') + '</td>' +
                '<td>' + esc(t.description || '') + '</td>' +
                '<td>' + esc(t.accountNo || '') + '</td>' +
                '<td class="text-center">' + (t.isAssigned ? '<i class="fa fa-check text-success"></i>' : '<i class="fa fa-times text-muted"></i>') + '</td>' +
                '<td class="text-center">' + (business ? '<i class="fa fa-briefcase text-primary"></i><span class="visually-hidden">Business</span>' : '<i class="fa fa-user text-secondary"></i><span class="visually-hidden">Personal</span>') + '</td>' +
                '<td>' + esc(t.lineTypeName || '') + '</td>' +
                '<td class="text-center">' +
                    '<button type="button" class="tel-edit-btn" title="Edit" onclick="openTelephoneModalForEdit(' + t.id + ')">' +
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                            '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>' +
                        '</svg>' +
                    '</button>' +
                '</td>' +
                '</tr>';
        });
        $('#tblTelephones tbody').html(rows);

        dtTelephones = $('#tblTelephones').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true,
            dom: 'tip', order: [[0, 'asc']],
            columnDefs: [{ orderable: false, targets: -1 }]
        });
        // Re-apply the effective search term so it survives grid rebuild.
        // Local input wins over global; falls back to global if local is empty.
        var localTel = ($('#txtSearchTel').val() || '');
        var globalT  = ($('#globalSearch').val() || '');
        var effTel   = localTel || globalT;
        if (effTel) dtTelephones.search(effTel);

        // Re-apply column filters (Provider=1, Business=5, LineType=6)
        if (savedProviderFilter)  { dtTelephones.column(1).search('^' + savedProviderFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', true, false); $('#filterProviderCol').val(savedProviderFilter); }
        if (savedBusinessFilter)  { dtTelephones.column(5).search(savedBusinessFilter, false, false); $('#filterBusinessCol').val(savedBusinessFilter); }
        if (savedLineTypeFilter)  { dtTelephones.column(6).search('^' + savedLineTypeFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', true, false); $('#filterLineTypeCol').val(savedLineTypeFilter); }
        dtTelephones.draw();

        // Also rebuild the mobile card list (shown ≤768px in lieu of the table)
        renderMobileTelephoneCards();
    }

    function renderMobileTelephoneCards() {
        var $mob = $('#mobTelCards');
        if (!$mob.length) return;
        $mob.empty();
        (telephones || []).forEach(function (t) {
            var card = '' +
                '<div class="mtel-card">' +
                    '<div class="mtel-card-head">' +
                        '<div class="num">'      + esc(t.subNo || '—')        + '</div>' +
                        '<div class="provider">' + esc(t.providerName || '')  + '</div>' +
                    '</div>' +
                    '<div class="mtel-card-body">' +
                        '<div class="desc">' + esc(t.description || '—') + '</div>' +
                        '<button type="button" class="tel-edit-btn" title="Edit" onclick="openTelephoneModalForEdit(' + t.id + ')">' +
                            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>' +
                            '</svg>' +
                        '</button>' +
                    '</div>' +
                '</div>';
            $mob.append(card);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ASSIGNMENT GRID  (Assign tab)
    // ─────────────────────────────────────────────────────────────────────────
    function renderAssignGrid() {
        if (dtAssign) { dtAssign.destroy(); dtAssign = null; }
        var rows = '';
        (assignments || []).forEach(function (a) {
            rows += '<tr data-id="' + (a.id) + '">' +
                '<td>' + esc(a.subNo || '') + '</td>' +
                '<td>' + esc(a.employeeName || '') + '</td>' +
                '<td>' + esc(a.employeeNo || '') + '</td>' +
                '<td>' + esc(a.costCenterName || '') + '</td>' +
                '<td>' + esc(a.description || '') + '</td>' +
                '<td class="text-end">' + (a.allowanceLimit != null ? parseFloat(a.allowanceLimit).toFixed(3) : '') + '</td>' +
                '<td class="text-end">' + (a.businessLimit != null ? parseFloat(a.businessLimit).toFixed(3) : '') + '</td>' +
                '<td>' + esc(a.lineStatusName || '') + '</td>' +
                '<td>' + ymd(a.startDate) + '</td>' +
                '<td>' + ymd(a.endDate) + '</td>' +
                '<td class="text-center">' +
                    '<button type="button" class="tel-edit-btn" title="Edit" onclick="openAssignModalForEdit(' + a.id + ')">' +
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                            '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>' +
                        '</svg>' +
                    '</button>' +
                '</td>' +
                '</tr>';
        });
        $('#tblAssignNo tbody').html(rows);

        dtAssign = $('#tblAssignNo').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true,
            dom: 'tip', order: [[1, 'asc']],
            columnDefs: [{ orderable: false, targets: -1 }]
        });
        // Re-apply the effective search term so it survives grid rebuild.
        // Local input wins over global; falls back to global if local is empty.
        var localAsg = ($('#txtSearchAsg').val() || '');
        var globalA  = ($('#globalSearch').val() || '');
        var effAsg   = localAsg || globalA;
        if (effAsg) dtAssign.search(effAsg).draw();

        // Also rebuild the mobile card list (shown ≤768px in lieu of the table)
        renderMobileAssignCards();
    }

    function renderMobileAssignCards() {
        var $mob = $('#mobAsgCards');
        if (!$mob.length) return;
        $mob.empty();

        // Status → badge CSS class mapping
        var statusClass = {
            'connected':    'masg-status-connected',
            'disconnected': 'masg-status-disconnected',
            'transferred':  'masg-status-transferred'
        };

        (assignments || []).forEach(function (a) {
            // Provider name: try direct field first, then look up from telephones by subNoId
            var providerName = a.providerName || '';
            if (!providerName && a.subNoId) {
                var tel = (telephones || []).find(function (t) { return t.id == a.subNoId; });
                if (tel) providerName = tel.providerName || '';
            }

            // Business / Personal flag: from telephones lookup
            var isBusiness = null;
            if (a.isBusiness !== undefined && a.isBusiness !== null) {
                isBusiness = a.isBusiness;
            } else if (a.subNoId) {
                var telB = (telephones || []).find(function (t) { return t.id == a.subNoId; });
                if (telB) isBusiness = (String(telB.type).toLowerCase() === 'true' || telB.type === true);
            }
            var lineLabel = isBusiness === true  ? 'Business Line'
                          : isBusiness === false ? 'Personal Line'
                          : '';

            // Status badge
            var statusText = esc(a.lineStatusName || 'None');
            var statusKey  = (a.lineStatusName || '').toLowerCase();
            var sCls       = statusClass[statusKey] || 'masg-status-none';

            // Number + Provider display  (e.g. "97227330 – Zain")
            var numProvider = esc(a.subNo || '—');
            if (providerName) numProvider += ' – ' + esc(providerName);

            // Limits
            var busLimit = (a.businessLimit  != null) ? parseFloat(a.businessLimit).toFixed(3)  : '—';
            var perLimit = (a.allowanceLimit != null) ? parseFloat(a.allowanceLimit).toFixed(3) : '—';

            // Dates
            var startD = ymd(a.startDate) || '—';
            var endD   = ymd(a.endDate)   || '—';

            var card =
                '<div class="masg-card">' +

                    // ── Row 1: Employee Name  |  Status badge ──────────────
                    '<div class="masg-card-r1">' +
                        '<div>' +
                            '<div class="emp-name">' + esc(a.employeeName || '—') + '</div>' +
                            '<div class="emp-no">'   + esc(a.employeeNo   || '')  + '</div>' +
                        '</div>' +
                        '<span class="masg-status ' + sCls + '">' + statusText + '</span>' +
                    '</div>' +

                    // ── Row 2: Number – Provider  |  Business/Personal ─────
                    '<div class="masg-card-r2">' +
                        '<div class="num-provider">' + numProvider + '</div>' +
                        (lineLabel ? '<span class="line-type-badge">' + esc(lineLabel) + '</span>' : '') +
                    '</div>' +

                    // ── Rows 3 & 4 ────────────────────────────────────────
                    '<div class="masg-card-body">' +

                        // Row 3: Business Limit  |  Personal Limit
                        '<div class="masg-row">' +
                            '<div class="masg-field">' +
                                '<span class="lbl">Business Limit</span>' +
                                '<span class="val">' + busLimit + '</span>' +
                            '</div>' +
                            '<div class="masg-field">' +
                                '<span class="lbl">Personal Limit</span>' +
                                '<span class="val">' + perLimit + '</span>' +
                            '</div>' +
                        '</div>' +

                        // Row 4: Start Date  |  End Date  |  Edit
                        '<div class="masg-row">' +
                            '<div class="masg-field">' +
                                '<span class="lbl">Start Date</span>' +
                                '<span class="val">' + startD + '</span>' +
                            '</div>' +
                            '<div class="masg-field">' +
                                '<span class="lbl">End Date</span>' +
                                '<span class="val">' + endD + '</span>' +
                            '</div>' +
                            '<div class="masg-edit-wrap">' +
                                '<button type="button" class="tel-edit-btn" title="Edit" onclick="openAssignModalForEdit(' + a.id + ')">' +
                                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                        '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>' +
                                    '</svg>' +
                                '</button>' +
                            '</div>' +
                        '</div>' +

                    '</div>' +
                '</div>';

            $mob.append(card);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  MODAL OPEN / CLOSE
    // ─────────────────────────────────────────────────────────────────────────
    function clearTelForm() {
        $('#hidID').val('');
        $('#txtSubNo').val(''); $('#txtSubDesc').val(''); $('#txtAccountNo').val('');
        $('#cmbType').val('True'); $('#cmbLineType').val(''); $('#cmbProvider').val('');
    }
    function clearAsgForm() {
        $('#hidAID').val('');
        setPickerValue('employee',   null);
        setPickerValue('number',     null);
        setPickerValue('costCenter', null);
        $('#txtAlwLimit').val(''); $('#txtBusLimit').val('');
        $('#cmbLineStatus').val('0'); $('#cmbStartDate').val(''); $('#cmbEndDate').val('');
    }

    window.openTelephoneModalForAdd = function () {
        clearTelForm();
        $('#telephoneModalTitle').text('Add Telephone');
        $('#btnAdd').show(); $('#btnUpdate').hide();
        telSnapshot = getTelSnapshot();
        allowClose.telephone = false;
    };
    window.openTelephoneModalForEdit = function (id) {
        var row = (telephones || []).find(function (t) { return t.id == id; });
        if (!row) return;
        clearTelForm();
        $('#hidID').val(row.id);
        $('#txtSubNo').val(row.subNo || '');
        $('#txtSubDesc').val(row.description || '');
        $('#txtAccountNo').val(row.accountNo || '');
        $('#cmbType').val(String(row.type).toLowerCase() === 'true' ? 'True' : 'False');
        $('#cmbLineType').val(row.lineType || '');
        fillProviderDropdown(row.provider);
        $('#telephoneModalTitle').text('Edit Telephone');
        $('#btnAdd').hide(); $('#btnUpdate').show();
        telSnapshot = getTelSnapshot();
        allowClose.telephone = false;
        var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('telephoneModal'));
        modal.show();
    };

    window.openAssignModalForAdd = function () {
        clearAsgForm();
        $('#assignModalTitle').text('Assign Telephone');
        $('#btnAssign').show(); $('#btnUpdateAsg').hide();
        asgSnapshot = getAsgSnapshot();
        allowClose.assign = false;
    };
    window.openAssignModalForEdit = function (id) {
        var row = (assignments || []).find(function (a) { return a.id == id; });
        if (!row) return;
        clearAsgForm();
        $('#hidAID').val(row.id);

        // Editing an existing assignment — the assigned number isn't in
        // dtUnAsg, so inject it into the picker so it can be displayed/selected.
        var subNoId = row.subNoId;
        var alreadyInList = (unassigned || []).some(function (n) { return (n.id || n.ID) == subNoId; });
        if (!alreadyInList && subNoId) {
            unassigned = (unassigned || []).concat([{
                id: subNoId, subNo: row.subNo || '', description: row.description || ''
            }]);
            fillNumberPicker();
        }

        setPickerValue('employee',   row.uid);
        setPickerValue('number',     row.subNoId);
        setPickerValue('costCenter', row.costCenterId);
        $('#txtAlwLimit').val(row.allowanceLimit || '');
        $('#txtBusLimit').val(row.businessLimit || '');
        $('#cmbLineStatus').val(row.lineStatus || '0');
        $('#cmbStartDate').val(ymd(row.startDate));
        $('#cmbEndDate').val(ymd(row.endDate));
        $('#assignModalTitle').text('Edit Assignment');
        $('#btnAssign').hide(); $('#btnUpdateAsg').show();
        asgSnapshot = getAsgSnapshot();
        allowClose.assign = false;
        var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('assignModal'));
        modal.show();
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  PAYLOADS / VALIDATION
    // ─────────────────────────────────────────────────────────────────────────
    function buildTelPayload() {
        return {
            Id:          parseInt($('#hidID').val()) || 0,
            SubNo:       $('#txtSubNo').val().trim(),
            Provider:    parseInt($('#cmbProvider').val()) || 0,
            Description: $('#txtSubDesc').val(),
            AccountNo:   $('#txtAccountNo').val(),
            Type:        $('#cmbType').val(),
            LineType:    parseInt($('#cmbLineType').val()) || 0
        };
    }
    function validateTel(forUpdate) {
        if (!$('#txtSubNo').val().trim()) { flash('#txtSubNo', 'Please fill Telephone Number'); return false; }
        if (!$('#cmbProvider').val())     { flash('#cmbProvider', 'Please select a Provider'); return false; }
        var sub = $('#txtSubNo').val().trim().toLowerCase();
        var currentId = parseInt($('#hidID').val()) || 0;
        var dup = (telephones || []).some(function (t) {
            return String(t.subNo).toLowerCase() === sub && (!forUpdate || t.id !== currentId);
        });
        if (dup) { flash('#txtSubNo', 'Number already added'); return false; }
        return true;
    }
    function buildAsgPayload() {
        return {
            Id:             parseInt($('#hidAID').val()) || 0,
            Uid:            parseInt($('#cmbEmployee').val()) || 0,
            SubNoId:        parseInt($('#cmbNumber').val()) || 0,
            CostCenterId:   parseInt($('#cmbCostCenter').val()) || 0,
            AllowanceLimit: parseFloat($('#txtAlwLimit').val()) || 0,
            BusinessLimit:  parseFloat($('#txtBusLimit').val()) || 0,
            StartDate:      $('#cmbStartDate').val(),
            EndDate:        $('#cmbEndDate').val(),
            LineStatus:     parseInt($('#cmbLineStatus').val()) || 0
        };
    }
    function validateAsg() {
        if (!$('#cmbEmployee').val())  { flash('#cmbEmployee', 'Please select Employee'); return false; }
        if (!$('#cmbNumber').val())    { flash('#cmbNumber', 'Please select Number'); return false; }
        if (!$('#cmbStartDate').val()) { flash('#cmbStartDate', 'Please select Start Date'); return false; }
        if (!$('#cmbEndDate').val())   { flash('#cmbEndDate', 'Please select End Date'); return false; }
        var s = new Date($('#cmbStartDate').val()).getTime();
        var e = new Date($('#cmbEndDate').val()).getTime();
        if (s > e) { flash('#cmbStartDate', 'Start Date cannot be after End Date'); return false; }
        return true;
    }

    function closeTelModal() {
        allowClose.telephone = true;
        bootstrap.Modal.getInstance(document.getElementById('telephoneModal')).hide();
    }
    function closeAsgModal() {
        allowClose.assign = true;
        bootstrap.Modal.getInstance(document.getElementById('assignModal')).hide();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SAVE ACTIONS
    // ─────────────────────────────────────────────────────────────────────────
    function addTelephone() {
        if (!validateTel(false)) return;
        var payload = buildTelPayload();
        Swal.fire({
            title: 'Are you sure?', text: 'Do you want to add this Telephone number?',
            icon: 'question', showCancelButton: true,
            confirmButtonText: 'Yes, add', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/AddTelephone',
                contentType: 'application/json; charset=utf-8', data: JSON.stringify(payload),
                success: function (res) {
                    if (res && res.myMessage && res.myMessage !== 'succ' && res.myMessage !== 'Success') {
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage }); return;
                    }
                    closeTelModal();
                    Swal.fire({ icon: 'success', title: 'Saved', text: 'Telephone added successfully', timer: 1400, showConfirmButton: false });
                    loadAll();
                },
                error: function () { Swal.fire({ icon: 'error', title: 'Error', text: 'Could not save. Please try again.' }); }
            });
        });
    }
    function updateTelephone() {
        if (!validateTel(true)) return;
        var payload = buildTelPayload();
        Swal.fire({
            title: 'Are you sure?', text: 'Do you want to update this Telephone number?',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Yes, update', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/UpdateTelephone',
                contentType: 'application/json; charset=utf-8', data: JSON.stringify(payload),
                success: function (res) {
                    if (res && res.myMessage && res.myMessage !== 'succ' && res.myMessage !== 'Success') {
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage }); return;
                    }
                    closeTelModal();
                    Swal.fire({ icon: 'success', title: 'Saved', text: 'Telephone updated successfully', timer: 1400, showConfirmButton: false });
                    loadAll();
                },
                error: function () { Swal.fire({ icon: 'error', title: 'Error', text: 'Could not update. Please try again.' }); }
            });
        });
    }
    function assignNumber() {
        if (!validateAsg()) return;
        var payload = buildAsgPayload();
        Swal.fire({
            title: 'Are you sure?', text: 'Do you want to assign this Telephone number?',
            icon: 'question', showCancelButton: true,
            confirmButtonText: 'Yes, assign', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/Assign',
                contentType: 'application/json; charset=utf-8', data: JSON.stringify(payload),
                success: function (res) {
                    if (res && res.myMessage && res.myMessage !== 'succ' && res.myMessage !== 'Success') {
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage }); return;
                    }
                    closeAsgModal();
                    Swal.fire({ icon: 'success', title: 'Saved', text: 'Telephone assigned successfully', timer: 1400, showConfirmButton: false });
                    loadAll();
                },
                error: function () { Swal.fire({ icon: 'error', title: 'Error', text: 'Could not assign. Please try again.' }); }
            });
        });
    }
    function updateAssign() {
        if (!validateAsg()) return;
        var payload = buildAsgPayload();
        Swal.fire({
            title: 'Are you sure?', text: 'Do you want to update this assignment?',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Yes, update', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/UpdateAssign',
                contentType: 'application/json; charset=utf-8', data: JSON.stringify(payload),
                success: function (res) {
                    if (res && res.myMessage && res.myMessage !== 'succ' && res.myMessage !== 'Success') {
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage }); return;
                    }
                    closeAsgModal();
                    Swal.fire({ icon: 'success', title: 'Saved', text: 'Assignment updated successfully', timer: 1400, showConfirmButton: false });
                    loadAll();
                },
                error: function () { Swal.fire({ icon: 'error', title: 'Error', text: 'Could not update. Please try again.' }); }
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WIRE-UP
    // ─────────────────────────────────────────────────────────────────────────
    $(document).ready(function () {
        $(document).on('click', '#btnAdd',         function () { addTelephone(); });
        $(document).on('click', '#btnUpdate',      function () { updateTelephone(); });
        $(document).on('click', '#btnAssign',      function () { assignNumber(); });
        $(document).on('click', '#btnUpdateAsg',   function () { updateAssign(); });

        // Numeric-only Telephone No
        $(document).on('keypress', '#txtSubNo', function (e) {
            var ch = String.fromCharCode(e.which);
            if (!/[\d]/.test(ch) && e.which !== 8) e.preventDefault();
        });

        // Dirty-state guard: intercept close attempts (X / Cancel / backdrop)
        // and confirm before discarding any user-entered changes.
        function guard(modalId, snapshotRef, flagKey, currentSnapshotFn) {
            var el = document.getElementById(modalId);
            if (!el) return;
            el.addEventListener('hide.bs.modal', function (e) {
                if (allowClose[flagKey]) return;          // explicit programmatic close
                var current = currentSnapshotFn();
                var stored  = (flagKey === 'telephone') ? telSnapshot : asgSnapshot;
                if (current === stored) return;            // not dirty — let it close
                e.preventDefault();
                Swal.fire({
                    title: 'Discard changes?',
                    text: 'Are you sure you want to discard the changes?',
                    icon: 'warning', showCancelButton: true,
                    confirmButtonText: 'Yes, discard',
                    cancelButtonText: 'Keep editing',
                    reverseButtons: true
                }).then(function (r) {
                    if (r.isConfirmed) {
                        allowClose[flagKey] = true;
                        bootstrap.Modal.getInstance(el).hide();
                    }
                });
            });
            // Reset the allow-close flag once the modal is fully closed
            el.addEventListener('hidden.bs.modal', function () { allowClose[flagKey] = false; });
        }
        guard('telephoneModal', null, 'telephone', getTelSnapshot);
        guard('assignModal',    null, 'assign',    getAsgSnapshot);

        // ── Topbar #globalSearch → filters BOTH Manage Telephone grids ──
        // myJS.js's own search handler is a no-op on this page (it scans for
        // .tis-view.is-active, none exists here), so we hook the input event
        // with a distinct namespace and drive the DataTable filters directly.
        $('#globalSearch').off('input.telGlobal').on('input.telGlobal', function () {
            applyTelephoneGlobalSearch(this.value || '');
        });
        // Clear any leftover term and rebuild from fresh
        $('#globalSearch').val('');

        // Column header filters for tblTelephones
        $(document).on('change', '#filterProviderCol', function () {
            if (!dtTelephones) return;
            var v = this.value;
            dtTelephones.column(1).search(v ? '^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' : '', true, false).draw();
        });
        $(document).on('change', '#filterBusinessCol', function () {
            if (!dtTelephones) return;
            dtTelephones.column(5).search(this.value, false, false).draw();
        });
        $(document).on('change', '#filterLineTypeCol', function () {
            if (!dtTelephones) return;
            var v = this.value;
            dtTelephones.column(6).search(v ? '^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' : '', true, false).draw();
        });

        // Per-tab local searches (right side of each tab's toolbar)
        wireLocalSearches();

        // ── Searchable pickers ───────────────────────────────────
        // Pre-instantiate the Bootstrap Dropdown for every picker with Popper's
        // `strategy: 'fixed'` so the menu can render outside the modal's
        // `overflow:hidden` boundary (the default 'absolute' strategy lets
        // the bottom of the menu get clipped against the modal-content edge).
        document.querySelectorAll('.tel-picker .tel-picker-btn').forEach(function (btn) {
            try {
                var existing = bootstrap.Dropdown.getInstance(btn);
                if (existing) existing.dispose();
                new bootstrap.Dropdown(btn, {
                    popperConfig: function (defaultConfig) {
                        defaultConfig.strategy = 'fixed';
                        return defaultConfig;
                    }
                });
            } catch (e) { /* swallow — fall back to auto-init */ }
        });

        // Clicking an item: set value + update button text + close menu
        $(document).on('click', '.tel-picker-item', function () {
            var $p   = $(this).closest('.tel-picker');
            var name = $p.attr('data-picker');
            setPickerValue(name, $(this).attr('data-id'));
            var btn = $p.find('.tel-picker-btn')[0];
            var dd  = btn && bootstrap.Dropdown.getInstance(btn);
            if (dd) dd.hide();
        });
        // Typing in the search input: filter visible items
        $(document).on('input', '.tel-picker-search', function () {
            var q = (this.value || '').toLowerCase().trim();
            var $list = $(this).closest('.tel-picker-menu').find('.tel-picker-list');
            var anyShown = false;
            $list.find('.tel-picker-item').each(function () {
                var s = ($(this).attr('data-search') || '').toLowerCase();
                var show = !q || s.indexOf(q) >= 0;
                $(this).toggle(show);
                if (show) anyShown = true;
            });
            $list.find('.tel-picker-empty').remove();
            if (!anyShown) $list.append('<div class="tel-picker-empty">No matching records</div>');
        });
        // Focus the search input when a picker opens, reset previous filter
        $(document).on('shown.bs.dropdown', '.tel-picker', function () {
            var $search = $(this).find('.tel-picker-search');
            $search.val('').trigger('input').focus();
        });

        // Date inputs — opening the picker on any click inside the field
        // (most browsers already do this on focus, but showPicker is explicit
        // and works in Chrome/Edge even when clicking the text area).
        $(document).on('focus click', '#cmbStartDate, #cmbEndDate', function () {
            if (typeof this.showPicker === 'function') {
                try { this.showPicker(); } catch (e) { /* user gesture restrictions */ }
            }
        });

        loadAll();
    });

    // The topbar #globalSearch broadcasts the term to BOTH grids — but only
    // for grids whose local search input is empty. A non-empty local search
    // always wins (and stays winning until the user clears it).
    function applyTelephoneGlobalSearch(term) {
        if (dtTelephones && typeof dtTelephones.search === 'function') {
            var localTel = ($('#txtSearchTel').val() || '');
            dtTelephones.search(localTel || term || '').draw();
        }
        if (dtAssign && typeof dtAssign.search === 'function') {
            var localAsg = ($('#txtSearchAsg').val() || '');
            dtAssign.search(localAsg || term || '').draw();
        }
    }

    // Per-tab search wires: each one only drives its own grid. When the local
    // input is cleared, fall back to whatever's in the topbar #globalSearch.
    function wireLocalSearches() {
        $('#txtSearchTel').off('input.telLocal').on('input.telLocal', function () {
            if (!dtTelephones) return;
            var local    = (this.value || '');
            var fallback = ($('#globalSearch').val() || '');
            dtTelephones.search(local || fallback).draw();
        });
        $('#txtSearchAsg').off('input.asgLocal').on('input.asgLocal', function () {
            if (!dtAssign) return;
            var local    = (this.value || '');
            var fallback = ($('#globalSearch').val() || '');
            dtAssign.search(local || fallback).draw();
        });
    }
})();
