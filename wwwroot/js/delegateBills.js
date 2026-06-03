/* ============================================================================
   delegateBills.js — Admin ▸ Manage Delegation of Bills
   Replaces the legacy jqxGrid / jqxDropDownButton page with DataTables +
   Bootstrap tel-picker dropdowns + tel-modal CRUD — no jqWidgets.

   Endpoints (all /Admin/...):
     GET  GetDelegate    -> { dtSec:[{id,managerId,manName,secId,secName,canApprove,canIdentify}],
                              EmpList:[{empId,empNo,empName}] }
     POST SaveDelegate   ([FromBody] {secId,managerId,canApprove,canIdentify}) -> { myMessage }
     POST UpdateDelegate ([FromBody] {id,secId,managerId,canApprove,canIdentify}) -> { myMessage }
     POST DeleteDelegate ([FromBody] {id}) -> { myMessage }

   Dependencies (loaded globally by _Layout.cshtml):
     jQuery, Bootstrap 5, DataTables + BS5 integration, SweetAlert2, Font Awesome
   ============================================================================ */
(function () {
    'use strict';

    var dt = null;
    var employees = [];     // [{empId, empNo, empName}]
    var delegations = [];   // [{id, managerId, manName, secId, secName, canApprove, canIdentify}]
    var modal = null;

    var PLACEHOLDERS = { owner: 'Select Bill Owner', delegate: 'Delegate To' };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var EDIT_SVG =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>' +
        '</svg>';

    // ── Searchable pickers (shared tel-picker pattern) ────────────────────────
    function fillPicker(name, items) {
        var $p = $('.tel-picker[data-picker="' + name + '"]');
        var $list = $p.find('.tel-picker-list').empty();
        if (!items.length) { $list.append('<div class="tel-picker-empty">No matching records</div>'); return; }
        items.forEach(function (it) {
            $('<div class="tel-picker-item"></div>')
                .attr('data-id', it.id)
                .attr('data-text', it.text)
                .attr('data-search', (it.search || it.text || '').toLowerCase())
                .text(it.text)
                .appendTo($list);
        });
    }

    function fillEmployeePickers() {
        var items = (employees || []).map(function (e) {
            var no = (e.empNo || '').toString();
            return { id: e.empId, text: (no ? no + ' — ' : '') + (e.empName || ''), search: no + ' ' + (e.empName || '') };
        });
        fillPicker('owner', items);
        fillPicker('delegate', items);
    }

    function setPickerValue(name, id) {
        var $p = $('.tel-picker[data-picker="' + name + '"]');
        var $hidden = $p.find('input[type="hidden"]');
        var $btn = $p.find('.tel-picker-btn');
        $p.find('.tel-picker-item').removeClass('selected');
        if (id == null || id === '' || id === 0) {
            $hidden.val('');
            $btn.text(PLACEHOLDERS[name]).addClass('is-placeholder');
            return;
        }
        $hidden.val(id);
        var $item = $p.find('.tel-picker-item[data-id="' + id + '"]');
        if ($item.length) {
            $item.addClass('selected');
            $btn.text($item.attr('data-text')).removeClass('is-placeholder');
        } else {
            $btn.text(PLACEHOLDERS[name]).addClass('is-placeholder');
        }
    }

    function getPickerValue(name) {
        return $('.tel-picker[data-picker="' + name + '"]').find('input[type="hidden"]').val() || '';
    }

    // ── Data load + grid ──────────────────────────────────────────────────────
    function getData() {
        $.getJSON('/Admin/GetDelegate')
            .done(function (res) {
                employees   = res.EmpList || res.empList || [];
                delegations = res.dtSec   || [];
                fillEmployeePickers();
                renderGrid();
            })
            .fail(function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load delegation data.' });
            });
    }

    function rightPill(on) {
        return on ? '<span class="dlg-rights yes">Yes</span>' : '<span class="dlg-rights no">No</span>';
    }

    function renderGrid() {
        if (dt) { dt.destroy(); dt = null; }

        var rows = '';
        (delegations || []).forEach(function (d) {
            rows +=
                '<tr data-id="' + esc(d.id) + '">' +
                    '<td data-label="Bill Owner">'   + esc(d.manName) + '</td>' +
                    '<td data-label="Delegated To">' + esc(d.secName) + '</td>' +
                    '<td data-label="Approval Rights" class="text-center">'       + rightPill(d.canApprove)  + '</td>' +
                    '<td data-label="Identification Rights" class="text-center">' + rightPill(d.canIdentify) + '</td>' +
                    '<td data-label="Edit" class="text-center">' +
                        '<button type="button" class="tel-edit-btn" title="Edit" data-id="' + esc(d.id) + '">' + EDIT_SVG + '</button>' +
                    '</td>' +
                '</tr>';
        });
        $('#tblDelegations tbody').html(rows);

        dt = $('#tblDelegations').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true,
            dom: 'tip', order: [[0, 'asc']],
            columnDefs: [{ targets: 4, orderable: false, searchable: false }],
            language: { emptyTable: 'No delegations found.' }
        });

        var s = $('#txtSearchDlg').val() || '';
        if (s) dt.search(s).draw();
    }

    // ── Modal open (add / edit) ───────────────────────────────────────────────
    function openForAdd() {
        $('#hidID').val('');
        setPickerValue('owner', null);
        setPickerValue('delegate', null);
        $('#chkIdt, #chkApp').prop('checked', false);
        $('#dlgModalTitle').text('Add Delegation');
        $('#btnAdd').show();
        $('#btnUpdate, #btnDel').hide();
        modal.show();
    }

    function openForEdit(id) {
        var d = (delegations || []).find(function (x) { return x.id == id; });
        if (!d) return;
        $('#hidID').val(d.id);
        setPickerValue('owner', d.managerId);
        setPickerValue('delegate', d.secId);
        $('#chkIdt').prop('checked', !!d.canIdentify);
        $('#chkApp').prop('checked', !!d.canApprove);
        $('#dlgModalTitle').text('Edit Delegation');
        $('#btnAdd').hide();
        $('#btnUpdate, #btnDel').show();
        modal.show();
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────
    function collect() {
        return {
            id:          parseInt($('#hidID').val(), 10) || 0,
            managerId:   parseInt(getPickerValue('owner'), 10) || 0,
            secId:       parseInt(getPickerValue('delegate'), 10) || 0,
            canApprove:  $('#chkApp').is(':checked'),
            canIdentify: $('#chkIdt').is(':checked')
        };
    }

    function validate(d) {
        if (!d.managerId) { Swal.fire({ icon: 'warning', title: 'Required', text: 'Please select a Bill Owner.' }); return false; }
        if (!d.secId)     { Swal.fire({ icon: 'warning', title: 'Required', text: 'Please select an employee to delegate to.' }); return false; }
        if (d.managerId === d.secId) { Swal.fire({ icon: 'warning', title: 'Invalid', text: 'Bill Owner and Delegate To cannot be the same person.' }); return false; }
        if (!d.canApprove && !d.canIdentify) { Swal.fire({ icon: 'warning', title: 'Required', text: 'Please select at least one right: Identification of Bills or Approve Bills.' }); return false; }
        return true;
    }

    function postJson(url, payload, okTitle) {
        Swal.fire({ title: 'Please wait…', allowOutsideClick: false, allowEscapeKey: false, didOpen: function () { Swal.showLoading(); } });
        $.ajax({
            type: 'POST', url: url,
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify(payload)
        })
            .done(function (res) {
                Swal.close();
                var msg = (res && res.myMessage) || '';
                if (/error/i.test(msg)) { Swal.fire('Error', msg, 'error'); return; }
                modal.hide();
                Swal.fire(okTitle, msg, 'success').then(getData);
            })
            .fail(function (xhr, status, error) {
                Swal.close();
                Swal.fire('Error', error || 'Request failed.', 'error');
            });
    }

    function add() {
        var d = collect();
        if (!validate(d)) return;
        postJson('/Admin/SaveDelegate', { secId: d.secId, managerId: d.managerId, canApprove: d.canApprove, canIdentify: d.canIdentify }, 'Added');
    }

    function update() {
        var d = collect();
        if (!d.id) return;
        if (!validate(d)) return;
        postJson('/Admin/UpdateDelegate', d, 'Updated');
    }

    function del() {
        var id = parseInt($('#hidID').val(), 10) || 0;
        if (!id) return;
        Swal.fire({
            title: 'Delete delegation?',
            text: 'This delegation will be permanently removed.',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Yes, Delete', cancelButtonText: 'Cancel',
            confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', reverseButtons: true
        }).then(function (result) {
            if (!result.isConfirmed) return;
            postJson('/Admin/DeleteDelegate', { id: id }, 'Deleted');
        });
    }

    // ── Excel (CSV) export ────────────────────────────────────────────────────
    function exportCsv() {
        if (!delegations.length) {
            Swal.fire({ icon: 'info', title: 'Nothing to export', text: 'There are no delegations to export.' });
            return;
        }
        var lines = ['Bill Owner,Delegated To,Approval Rights,Identification Rights'];
        delegations.forEach(function (d) {
            lines.push([
                '"' + (d.manName || '') + '"',
                '"' + (d.secName || '') + '"',
                d.canApprove ? 'Yes' : 'No',
                d.canIdentify ? 'Yes' : 'No'
            ].join(','));
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'Delegations.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Wiring ──────────────────────────────────────────────────────────────────
    $(function () {
        modal = new bootstrap.Modal(document.getElementById('delegationModal'));

        $('#btnAddDelegation').on('click', openForAdd);
        $('#btnExcelExport').on('click', exportCsv);
        $('#btnAdd').on('click', add);
        $('#btnUpdate').on('click', update);
        $('#btnDel').on('click', del);

        $('#tblDelegations tbody').on('click', '.tel-edit-btn', function () {
            openForEdit($(this).data('id'));
        });

        $('#txtSearchDlg').on('input', function () {
            if (dt) dt.search(this.value || '').draw();
        });

        // Picker item select
        $(document).on('click', '#delegationModal .tel-picker-item', function () {
            var $p = $(this).closest('.tel-picker');
            setPickerValue($p.attr('data-picker'), $(this).attr('data-id'));
            var dd = bootstrap.Dropdown.getInstance($p.find('.tel-picker-btn')[0]);
            if (dd) dd.hide();
        });

        // Picker search filter
        $(document).on('input', '#delegationModal .tel-picker-search', function () {
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
        $(document).on('shown.bs.dropdown', '#delegationModal .tel-picker', function () {
            $(this).find('.tel-picker-search').val('').trigger('input').focus();
        });

        getData();
    });
})();
