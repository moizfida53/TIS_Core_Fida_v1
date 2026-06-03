/* ============================================================================
   ManageEmployee.js  —  Manage Employee admin page (ASP.NET Core port)
   ----------------------------------------------------------------------------
   UI pattern:
     • Grid shows all employees with a pencil Edit button per row.
     • "Add Employee" toolbar button   → opens blank modal.
     • Pencil Edit button in each row  → opens modal pre-populated.
     • All jqWidgets replaced by .tel-picker searchable dropdowns.
     • Dirty-state guard prevents accidental closes on unsaved changes.
     • SweetAlert2 for confirmations and toast notifications.
   Endpoints:
     GET  /Admin/GetUser           → { dtEmp, RoleList, CountryList, dtCC, CompanyList }
     POST /Admin/AddEmployee       → { emp:{…}, cnt:{ selectedValues:["1"] } }
     POST /Admin/UpdateEmployee    → { emp:{…}, cnt:{ selectedValues:["1"] } }
     POST /Admin/DeleteEmployee    → { uid }
     GET  /Admin/GetCC             → { dtCC }
     POST /Admin/AddCC             → { ccName, ccNum }
     POST /Admin/UpdateCC          → { uid, ccName, ccNum }
     POST /Admin/DeleteCC          → { uid }
     GET  /SyncBapi/SyncBapiProd   → AD sync
   ============================================================================ */
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────
    var employees   = [];
    var roles       = [];
    var costCenters = [];
    var companies   = [];

    var dtEmployees  = null;
    var dtCostCenter = null;

    // Dirty-state guards
    var empSnapshot  = null;
    var allowEmpClose = false;

    // ─────────────────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function flash(target, msg) {
        if (target) $(target).focus();
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: msg, showConfirmButton: false, timer: 2800 });
    }
    function getEmpSnapshot() {
        return JSON.stringify({
            uid:  $('#hidUID').val(),
            no:   $('#txtEmployeeNo').val(),
            name: $('#txtName').val(),
            dept: $('#txtDept').val(),
            desc: $('#txtDesc').val(),
            user: $('#txtUsername').val(),
            pay:  $('#txtPayroll').val(),
            mail: $('#txtEmail').val(),
            ext:  $('#txtExtension').val(),
            grd:  $('#txtGrade').val(),
            act:  $('#IsActive').prop('checked'),
            mgr:  getPickerValue('manager'),
            cc:   getPickerValue('costCenter'),
            rol:  getPickerValue('role'),
            cmp:  getPickerValue('company')
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SEARCHABLE PICKERS
    // ─────────────────────────────────────────────────────────────────────────
    var PLACEHOLDERS = {
        company:    'Select Company',
        costCenter: 'Select Cost Center',
        manager:    'Select Manager',
        role:       'Select Role'
    };

    function fillPicker(name, items) {
        var $p    = $('.tel-picker[data-picker="' + name + '"]');
        var $list = $p.find('.tel-picker-list');
        $list.empty();
        if (!items || !items.length) {
            $list.append('<div class="tel-picker-empty">No matching records</div>');
            return;
        }
        items.forEach(function (it) {
            $('<div class="tel-picker-item"></div>')
                .attr('data-id',     it.id)
                .attr('data-text',   it.text)
                .attr('data-search', (it.search || it.text || '').toLowerCase())
                .text(it.text)
                .appendTo($list);
        });
        var cur = $p.find('input[type="hidden"]').val();
        if (cur) {
            var $sel = $list.find('.tel-picker-item[data-id="' + cur + '"]');
            if ($sel.length) {
                $sel.addClass('selected');
                $p.find('.tel-picker-btn').text($sel.attr('data-text')).removeClass('is-placeholder');
            }
        }
    }

    function setPickerValue(name, id) {
        var $p      = $('.tel-picker[data-picker="' + name + '"]');
        var $hidden = $p.find('input[type="hidden"]');
        var $btn    = $p.find('.tel-picker-btn');
        $p.find('.tel-picker-item').removeClass('selected');
        if (id == null || id === '' || id === 0) {
            $hidden.val('');
            $btn.text(PLACEHOLDERS[name] || 'Select').addClass('is-placeholder');
            return;
        }
        $hidden.val(id);
        var $item = $p.find('.tel-picker-item[data-id="' + id + '"]');
        if ($item.length) {
            $item.addClass('selected');
            $btn.text($item.attr('data-text')).removeClass('is-placeholder');
        } else {
            $btn.text(PLACEHOLDERS[name] || 'Select').addClass('is-placeholder');
        }
    }

    function getPickerValue(name) {
        return $('.tel-picker[data-picker="' + name + '"]').find('input[type="hidden"]').val() || '';
    }

    // ── Fill pickers from loaded data ─────────────────────────────────────────
    function fillManagerPicker() {
        fillPicker('manager', (employees || []).map(function (e) {
            var no = (e.employeeNo || '').toString();
            return { id: e.uid, text: (no ? no + ' — ' : '') + (e.name || ''), search: no + ' ' + (e.name || '') };
        }));
    }
    function fillCostCenterPicker() {
        fillPicker('costCenter', (costCenters || []).map(function (cc) {
            var num = (cc.ccNum || '').toString();
            return { id: num, text: (num ? num + ' — ' : '') + (cc.ccName || ''), search: num + ' ' + (cc.ccName || '') };
        }));
    }
    function fillRolePicker() {
        fillPicker('role', (roles || []).map(function (r) {
            return { id: r.id, text: r.roleName, search: r.roleName };
        }));
    }
    function fillCompanyPicker() {
        fillPicker('company', (companies || []).map(function (c) {
            return { id: c.id, text: c.companyName, search: c.companyName };
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DATA LOAD
    // ─────────────────────────────────────────────────────────────────────────
    function loadAll() {
        $.ajax({
            type: 'GET', cache: false, url: '/Admin/GetUser', dataType: 'json',
            success: function (res) {
                employees   = res.dtEmp                          || [];
                // Controller key is "RoleList" / "CompanyList" — camelCase serializer
                // downcases the first segment, giving "roleList" / "companyList".
                // Fall back to the PascalCase form so the code works regardless of
                // the JsonNamingPolicy setting.
                roles       = res.roleList    || res.RoleList    || [];
                costCenters = res.dtCC                           || [];
                companies   = res.companyList || res.CompanyList || [];
                fillManagerPicker();
                fillCostCenterPicker();
                fillRolePicker();
                fillCompanyPicker();
                renderEmployeeGrid();
            },
            error: function () {
                Swal.fire({ icon: 'error', title: 'Load failed', text: 'Could not load employee data.' });
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EMPLOYEE GRID
    // ─────────────────────────────────────────────────────────────────────────
    var EDIT_SVG =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>' +
        '</svg>';

    function renderEmployeeGrid() {
        if (dtEmployees) { dtEmployees.destroy(); dtEmployees = null; }
        var rows = '';
        (employees || []).forEach(function (e) {
            var isActive    = (e.isActive === true);
            var inactiveCls = isActive ? '' : 'emp-inactive';
            rows +=
                '<tr class="' + inactiveCls + '" data-uid="' + e.uid + '">' +
                    '<td>' + esc(e.employeeNo  || '') + '</td>' +
                    '<td>' + esc(e.name        || '') + '</td>' +
                    '<td>' + esc(e.email       || '') + '</td>' +
                    '<td>' + esc(e.org         || '') + '</td>' +
                    '<td>' + esc(e.description || '') + '</td>' +
                    '<td>' + esc(e.payroll     || '') + '</td>' +
                    '<td class="text-center">' +
                        (isActive
                            ? '<i class="fa fa-check-circle text-success"></i>'
                            : '<i class="fa fa-times-circle text-danger"></i>') +
                    '</td>' +
                    '<td>' + esc(e.company || '') + '</td>' +
                    '<td class="text-center">' +
                        '<button type="button" class="tel-edit-btn" title="Edit"' +
                            ' onclick="openEmpModalForEdit(' + e.uid + ')">' +
                            EDIT_SVG +
                        '</button>' +
                    '</td>' +
                '</tr>';
        });
        $('#tblEmployees tbody').html(rows);

        dtEmployees = $('#tblEmployees').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 15,
            info: true, lengthChange: false, destroy: true,
            dom: 'tip', order: [[1, 'asc']],
            columnDefs: [{ orderable: false, targets: [6, 8] }]
        });

        var local  = $('#txtSearchEmp').val()  || '';
        var global = $('#globalSearch').val()   || '';
        if (local || global) dtEmployees.search(local || global).draw();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  MODAL OPEN / CLOSE
    // ─────────────────────────────────────────────────────────────────────────
    function clearEmpForm() {
        $('#hidUID').val('');
        $('#txtEmployeeNo, #txtName, #txtDept, #txtDesc').val('');
        $('#txtUsername, #txtPayroll, #txtEmail, #txtExtension, #txtGrade').val('');
        $('#IsActive').prop('checked', false);
        setPickerValue('manager',    null);
        setPickerValue('costCenter', null);
        setPickerValue('role',       null);
        setPickerValue('company',    null);
    }

    window.openEmpModalForAdd = function () {
        clearEmpForm();
        $('#empModalTitle').text('Add Employee');
        $('#btnAdd').show(); $('#btnUpdate').hide();
        $('#btnAdSearch').show();   // AD search available when adding
        empSnapshot    = getEmpSnapshot();
        allowEmpClose  = false;
    };

    window.openEmpModalForEdit = function (uid) {
        var emp = (employees || []).find(function (e) { return e.uid == uid; });
        if (!emp) return;
        clearEmpForm();
        $('#hidUID').val(emp.uid);
        $('#txtEmployeeNo').val(emp.employeeNo || '');
        $('#txtName').val(emp.name        || '');
        $('#txtDept').val(emp.org         || '');
        $('#txtDesc').val(emp.description || '');
        $('#txtUsername').val(emp.userName   || '');
        $('#txtPayroll').val(emp.payroll     || '');
        $('#txtEmail').val(emp.email       || '');
        $('#txtExtension').val(emp.extension  || '');
        $('#txtGrade').val(emp.grade       || '');
        $('#IsActive').prop('checked', emp.isActive === true);
        setPickerValue('manager',    emp.managerId || '');
        setPickerValue('costCenter', emp.ccNo      || '');
        setPickerValue('role',       emp.roleId    || '');
        setPickerValue('company',    emp.companyId || '');
        $('#empModalTitle').text('Edit Employee');
        $('#btnAdd').hide(); $('#btnUpdate').show();
        $('#btnAdSearch').hide();   // AD search hidden when editing
        empSnapshot   = getEmpSnapshot();
        allowEmpClose = false;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('employeeModal')).show();
    };

    function closeEmpModal() {
        allowEmpClose = true;
        bootstrap.Modal.getInstance(document.getElementById('employeeModal'))?.hide();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  VALIDATION
    // ─────────────────────────────────────────────────────────────────────────
    function validateForm(isUpdate) {
        var empNo = $('#txtEmployeeNo').val().trim();
        var name  = $('#txtName').val().trim();
        var desc  = $('#txtDesc').val().trim();

        if (!empNo) { flash('#txtEmployeeNo', 'Please fill Employee No'); return false; }
        if (!name)  { flash('#txtName',       'Please fill Employee Name'); return false; }
        if (!/^[a-zA-Z0-9]+([- ][a-zA-Z0-9]+)*$/.test(name)) {
            flash('#txtName', 'Invalid name. Only letters, numbers, spaces, and a single hyphen between words.');
            return false;
        }
        if (!desc)  { flash('#txtDesc',    'Please fill Designation'); return false; }
        if (!$('#txtUsername').val().trim()) { flash('#txtUsername', 'Please fill Username'); return false; }
        if (!$('#txtEmail').val().trim())    { flash('#txtEmail',    'Please fill Email'); return false; }
        if (!getPickerValue('manager'))  { flash(null, 'Please select a Manager');  return false; }
        if (!getPickerValue('role'))     { flash(null, 'Please select a Role');      return false; }
        if (!getPickerValue('company'))  { flash(null, 'Please select a Company');   return false; }

        // Duplicate employee number (client-side)
        var currentUid = parseInt($('#hidUID').val()) || 0;
        var dup = (employees || []).some(function (e) {
            return (e.employeeNo || '').toLowerCase() === empNo.toLowerCase() &&
                   (!isUpdate || e.uid !== currentUid);
        });
        if (dup) { flash('#txtEmployeeNo', 'Employee Number already exists'); return false; }
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  BUILD PAYLOAD
    // ─────────────────────────────────────────────────────────────────────────
    function buildPayload() {
        return {
            emp: {
                uid:         parseInt($('#hidUID').val()) || 0,
                name:        $('#txtName').val().trim(),
                employeeNo:  $('#txtEmployeeNo').val().trim(),
                email:       $('#txtEmail').val().trim(),
                userName:    $('#txtUsername').val().trim(),
                org:         $('#txtDept').val().trim(),
                description: $('#txtDesc').val().trim(),
                grade:       $('#txtGrade').val().trim(),
                extension:   $('#txtExtension').val().trim(),
                payroll:     $('#txtPayroll').val().trim(),
                managerId:   parseInt(getPickerValue('manager'))  || 0,
                roleId:      parseInt(getPickerValue('role'))     || 0,
                ccNo:        getPickerValue('costCenter'),
                isActive:    $('#IsActive').prop('checked'),
                companyId:   getPickerValue('company')
            },
            cnt: { selectedValues: ['1'] }
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CRUD — EMPLOYEE
    // ─────────────────────────────────────────────────────────────────────────
    function addEmployee() {
        if (!validateForm(false)) return;
        Swal.fire({
            title: 'Are you sure?', text: 'Do you want to add this employee?',
            icon: 'question', showCancelButton: true,
            confirmButtonText: 'Yes, add', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/AddEmployee',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify(buildPayload()),
                success: function (res) {
                    if (res && res.myMessage && res.myMessage !== 'succ') {
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage }); return;
                    }
                    closeEmpModal();
                    loadAll();
                    Swal.fire({ icon: 'success', title: 'Added', text: 'Employee added successfully', timer: 1500, showConfirmButton: false });
                },
                error: function () { Swal.fire({ icon: 'error', title: 'Error', text: 'Could not save. Please try again.' }); }
            });
        });
    }

    function updateEmployee() {
        if (!validateForm(true)) return;
        Swal.fire({
            title: 'Are you sure?', text: 'Do you want to update this employee?',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Yes, update', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/UpdateEmployee',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify(buildPayload()),
                success: function (res) {
                    if (res && res.myMessage && res.myMessage !== 'succ') {
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage }); return;
                    }
                    closeEmpModal();
                    loadAll();
                    Swal.fire({ icon: 'success', title: 'Updated', text: 'Employee updated successfully', timer: 1500, showConfirmButton: false });
                },
                error: function () { Swal.fire({ icon: 'error', title: 'Error', text: 'Could not update. Please try again.' }); }
            });
        });
    }

    // Delete is triggered from the Edit modal via a separate button wired below
    function deleteEmployee() {
        var uid = parseInt($('#hidUID').val()) || 0;
        if (!uid) { flash(null, 'Please select an employee first'); return; }
        Swal.fire({
            title: 'Delete employee?', text: 'This action cannot be undone.',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Yes, delete', confirmButtonColor: '#dc3545',
            cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/DeleteEmployee',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({ uid: uid }),
                success: function (res) {
                    if (res && res.myMessage && res.myMessage !== 'succ') {
                        Swal.fire({ icon: 'error', title: 'Error', text: res.myMessage }); return;
                    }
                    closeEmpModal();
                    loadAll();
                    Swal.fire({ icon: 'success', title: 'Deleted', text: 'Employee deleted successfully', timer: 1500, showConfirmButton: false });
                },
                error: function () { Swal.fire({ icon: 'error', title: 'Error', text: 'Could not delete. Please try again.' }); }
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DIRTY-STATE GUARD  (same pattern as AddTelephone)
    // ─────────────────────────────────────────────────────────────────────────
    function wireEmpModalGuard() {
        var el = document.getElementById('employeeModal');
        if (!el) return;
        el.addEventListener('hide.bs.modal', function (e) {
            if (allowEmpClose) return;
            if (getEmpSnapshot() === empSnapshot) return; // not dirty
            e.preventDefault();
            Swal.fire({
                title: 'Discard changes?', text: 'Are you sure you want to discard the changes?',
                icon: 'warning', showCancelButton: true,
                confirmButtonText: 'Yes, discard', cancelButtonText: 'Keep editing', reverseButtons: true
            }).then(function (r) {
                if (r.isConfirmed) { allowEmpClose = true; bootstrap.Modal.getInstance(el).hide(); }
            });
        });
        el.addEventListener('hidden.bs.modal', function () { allowEmpClose = false; });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  COST CENTER MODAL  — grid + CRUD
    // ─────────────────────────────────────────────────────────────────────────
    function renderCCGrid() {
        if (dtCostCenter) { dtCostCenter.destroy(); dtCostCenter = null; }
        var rows = '';
        (costCenters || []).forEach(function (cc) {
            rows += '<tr data-uid="' + cc.uid + '">' +
                '<td>' + esc(cc.ccName || '') + '</td>' +
                '<td>' + esc(cc.ccNum  || '') + '</td>' +
                '</tr>';
        });
        $('#tblCostCenters tbody').html(rows);
        dtCostCenter = $('#tblCostCenters').DataTable({
            responsive: false, searching: false, paging: false,
            info: false, lengthChange: false, destroy: true,
            dom: 't', order: [[0, 'asc']],
            columnDefs: [{ orderable: false, targets: '_all' }]
        });
        $('#tblCostCenters tbody').off('click.ccRow').on('click.ccRow', 'tr', function () {
            var uid = $(this).data('uid');
            var cc  = (costCenters || []).find(function (c) { return c.uid == uid; });
            if (!cc) return;
            $('#hidCID').val(cc.uid);
            $('#txtCCName').val(cc.ccName || '');
            $('#txtCCNum').val(cc.ccNum   || '');
            $('#btnAddCC').hide(); $('#btnUpdateCC').show(); $('#btnDelCC').show();
        });
    }

    function clearCCForm() {
        $('#hidCID, #txtCCName, #txtCCNum').val('');
        $('#btnUpdateCC, #btnDelCC').hide(); $('#btnAddCC').show();
    }

    function refreshCC() {
        $.ajax({
            type: 'GET', cache: false, url: '/Admin/GetCC', dataType: 'json',
            success: function (res) {
                costCenters = res.dtCC || [];
                fillCostCenterPicker();
                renderCCGrid();
            }
        });
    }

    function addCC() {
        var name = $('#txtCCName').val().trim(), num = $('#txtCCNum').val().trim();
        if (!name) { flash('#txtCCName', 'Please enter Cost Center Name'); return; }
        if (!num)  { flash('#txtCCNum',  'Please enter Cost Center No.');   return; }
        if ((costCenters || []).some(function (cc) { return (cc.ccNum || '').toLowerCase() === num.toLowerCase(); })) {
            flash('#txtCCNum', 'Cost Center Number already exists'); return;
        }
        $.ajax({
            type: 'POST', url: '/Admin/AddCC',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ ccName: name, ccNum: num }),
            success: function (res) {
                clearCCForm(); refreshCC();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: res.myMessage || 'Added', showConfirmButton: false, timer: 1500 });
            }
        });
    }

    function updateCC() {
        var uid = $('#hidCID').val(), name = $('#txtCCName').val().trim(), num = $('#txtCCNum').val().trim();
        if (!uid)  { flash(null, 'Please select a Cost Center'); return; }
        if (!name) { flash('#txtCCName', 'Please enter Cost Center Name'); return; }
        if (!num)  { flash('#txtCCNum',  'Please enter Cost Center No.'); return; }
        var cuid = parseInt(uid);
        if ((costCenters || []).some(function (cc) { return (cc.ccNum || '').toLowerCase() === num.toLowerCase() && cc.uid !== cuid; })) {
            flash('#txtCCNum', 'Cost Center Number already exists'); return;
        }
        $.ajax({
            type: 'POST', url: '/Admin/UpdateCC',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ uid: uid, ccName: name, ccNum: num }),
            success: function (res) {
                clearCCForm(); refreshCC();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: res.myMessage || 'Updated', showConfirmButton: false, timer: 1500 });
            }
        });
    }

    function deleteCC() {
        if (!$('#hidCID').val()) { flash(null, 'Please select a Cost Center'); return; }
        Swal.fire({
            title: 'Delete cost center?', icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Yes, delete', confirmButtonColor: '#dc3545',
            cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Admin/DeleteCC',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({ uid: $('#hidCID').val() }),
                success: function (res) {
                    clearCCForm(); refreshCC();
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: res.myMessage || 'Deleted', showConfirmButton: false, timer: 1500 });
                }
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SYNC AD
    // ─────────────────────────────────────────────────────────────────────────
    function syncAD() {
        var $btn = $('#btnSyncAD');
        $btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin me-1"></i>Syncing…');
        $('#adSyncLoader').css('display', 'flex');
        $.ajax({
            type: 'GET', url: '/ActiveDirectorySync/SyncActiveStatus',
            success: function (res) {
                if (res && res.success === false) {
                    Swal.fire({ icon: 'error', title: 'Sync Failed', text: res.message || 'AD sync failed.' });
                    return;
                }
                Swal.fire({ icon: 'success', title: 'Sync Complete', text: (res && res.message) ? res.message : 'AD Sync completed.' });
                loadAll();
            },
            error: function (xhr) {
                Swal.fire({ icon: 'error', title: 'Sync Failed', text: xhr.responseText || 'Unknown error' });
            },
            complete: function () {
                $('#adSyncLoader').hide();
                $btn.prop('disabled', false).html('<i class="fa fa-sync-alt me-1"></i>Sync AD');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  AD SEARCH  (look up a single user in Active Directory by username)
    //  Triggered by the "AD" button next to the Username field.
    //  NOTE: wire the URL below to your AD lookup endpoint when available; it is
    //  expected to return the employee fields to pre-fill the modal.
    // ─────────────────────────────────────────────────────────────────────────
    function adSearch(username) {
        var $btn = $('#btnAdSearch');
        $btn.prop('disabled', true);
        $.ajax({
            type: 'GET',
            url: '/Admin/AdLookup?username=' + encodeURIComponent(username),
            dataType: 'json',
            success: function (res) {
                if (!res || !res.success) {
                    Swal.fire({ icon: 'error', title: 'AD Search Failed', text: (res && res.message) ? res.message : 'User not found in Active Directory.' });
                    return;
                }
                var d = res.data || {};
                // Populate the modal fields from AD (only overwrite when AD has a value)
                if (d.displayName)    $('#txtName').val(d.displayName);
                if (d.department)     $('#txtDept').val(d.department);
                if (d.title)          $('#txtDesc').val(d.title);             // Title → Designation
                if (d.employeeNumber) $('#txtEmployeeNo').val(d.employeeNumber); // → Emp No.
                if (d.email)          $('#txtEmail').val(d.email);
                // Mobile is returned in d.mobile — there is no Mobile field on the
                // modal yet, so it is left unmapped. (Ask to add one if needed.)

                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'AD details loaded for "' + username + '"',
                    showConfirmButton: false, timer: 1800
                });
            },
            error: function (xhr) {
                Swal.fire({ icon: 'error', title: 'AD Search Failed', text: xhr.responseText || 'Could not reach Active Directory.' });
            },
            complete: function () { $btn.prop('disabled', false); }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EXPORT  (CSV — no extra libraries)
    // ─────────────────────────────────────────────────────────────────────────
    function exportToExcel() {
        var hdr   = ['Emp No', 'Name', 'Email', 'Department', 'Designation', 'Payroll', 'Is Active', 'Company'];
        var lines = [hdr.map(function (h) { return '"' + h + '"'; }).join(',')];
        (employees || []).forEach(function (e) {
            lines.push([e.employeeNo, e.name, e.email, e.org, e.description, e.payroll, e.isActive ? 'Yes' : 'No', e.company]
                .map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; })
                .join(','));
        });
        var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'employee_list.csv';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WIRE-UP
    // ─────────────────────────────────────────────────────────────────────────
    $(document).ready(function () {

        // Employee modal buttons
        $(document).on('click', '#btnAdd',    function () { addEmployee(); });
        $(document).on('click', '#btnUpdate', function () { updateEmployee(); });

        // Delete button is injected dynamically in the footer when editing
        $(document).on('click', '#btnDelete', function () { deleteEmployee(); });

        // Sync AD + Export
        $(document).on('click', '#btnSyncAD',      function () { syncAD(); });
        $(document).on('click', '#btnExportExcel', function () { exportToExcel(); });

        // AD search (next to Username) — require a username first
        $(document).on('click', '#btnAdSearch', function () {
            var username = ($('#txtUsername').val() || '').trim();
            if (!username) {
                flash('#txtUsername', 'Please enter a Username before searching AD');
                return;
            }
            adSearch(username);
        });

        // CC modal buttons
        $(document).on('click', '#btnAddCC',    function () { addCC(); });
        $(document).on('click', '#btnUpdateCC', function () { updateCC(); });
        $(document).on('click', '#btnDelCC',    function () { deleteCC(); });
        $(document).on('click', '#btnCanCC',    function () { clearCCForm(); });

        // Show CC grid when CC modal opens
        document.getElementById('ccModal')
            ?.addEventListener('show.bs.modal', function () { renderCCGrid(); });

        // When employee modal switches to Edit mode, inject a Delete button in footer
        document.getElementById('employeeModal')
            ?.addEventListener('show.bs.modal', function () {
                $('#btnDelete').remove();
                if ($('#btnUpdate').is(':visible')) {
                    $('<button id="btnDelete" type="button" class="btn btn-danger me-auto">' +
                      '<i class="fa fa-trash-alt me-1"></i>Delete</button>')
                        .insertBefore($('#employeeModal .modal-footer .btn-secondary'));
                }
            });

        // Dirty-state guard
        wireEmpModalGuard();

        // Grid search
        $('#txtSearchEmp').off('input.empLocal').on('input.empLocal', function () {
            if (!dtEmployees) return;
            dtEmployees.search(this.value || ($('#globalSearch').val() || '')).draw();
        });
        $('#globalSearch').off('input.empGlobal').on('input.empGlobal', function () {
            if (!dtEmployees) return;
            var local = ($('#txtSearchEmp').val() || '');
            dtEmployees.search(local || this.value || '').draw();
        });

        // Bootstrap Dropdown — fixed strategy so pickers render outside modal overflow
        document.querySelectorAll('#employeeModal .tel-picker .tel-picker-btn').forEach(function (btn) {
            try {
                var ex = bootstrap.Dropdown.getInstance(btn);
                if (ex) ex.dispose();
                new bootstrap.Dropdown(btn, {
                    popperConfig: function (cfg) { cfg.strategy = 'fixed'; return cfg; }
                });
            } catch (e) { /* auto-init fallback */ }
        });

        // Picker item click
        $(document).on('click', '#employeeModal .tel-picker-item, #ccModal .tel-picker-item', function () {
            var $p   = $(this).closest('.tel-picker');
            var name = $p.attr('data-picker');
            setPickerValue(name, $(this).attr('data-id'));
            var dd = bootstrap.Dropdown.getInstance($p.find('.tel-picker-btn')[0]);
            if (dd) dd.hide();
        });

        // Picker search filter
        $(document).on('input', '#employeeModal .tel-picker-search, #ccModal .tel-picker-search', function () {
            var q = (this.value || '').toLowerCase().trim();
            var $list = $(this).closest('.tel-picker-menu').find('.tel-picker-list');
            var any = false;
            $list.find('.tel-picker-item').each(function () {
                var show = !q || ($(this).attr('data-search') || '').indexOf(q) >= 0;
                $(this).toggle(show); if (show) any = true;
            });
            $list.find('.tel-picker-empty').remove();
            if (!any) $list.append('<div class="tel-picker-empty">No matching records</div>');
        });

        // Focus search on open + reset filter
        $(document).on('shown.bs.dropdown', '#employeeModal .tel-picker, #ccModal .tel-picker', function () {
            $(this).find('.tel-picker-search').val('').trigger('input').focus();
        });

        loadAll();
    });

})();
