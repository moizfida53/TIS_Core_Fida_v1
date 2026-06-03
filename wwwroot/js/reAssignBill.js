/* ============================================================================
   reAssignBill.js — Bill ▸ Re-Assign Bill
   Replaces the legacy jqxGrid / jqxDropDownButton page with DataTables +
   Bootstrap + SweetAlert2 — no jqWidgets.

   Endpoints:
     GET  /Bill/GetSearchData?isStatus=false
            -> { empList:[{empId,empName,empNo}], providerList:[{id,name}] }
     GET  /Bill/SearchOpenBill?Month=&Year=&Provider=&Uid=&Status=
            -> { dtData:[bill…] }  or  { success:false, message }
     GET  /Ajax/GetEmployees           -> { empList:[{empId,empName,empNo}] }
     POST /Bill/ReAssignBill_Save (billId, uid) -> { success, message }

   Dependencies (loaded globally by _Layout.cshtml):
     jQuery, Bootstrap 5, DataTables + BS5 integration, SweetAlert2, Font Awesome
   ============================================================================ */
(function () {
    'use strict';

    var dt = null;                 // results DataTable instance
    var allEmployees = [];         // modal employee list (cached)
    var currentBillId = null;      // bill being re-assigned

    // ── Helpers ────────────────────────────────────────────────────────────
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtDate(d) {
        if (!d) return '';
        var dtv = new Date(d);
        if (isNaN(dtv)) return '';
        var dd = String(dtv.getDate()).padStart(2, '0');
        var mm = String(dtv.getMonth() + 1).padStart(2, '0');
        return dd + '-' + mm + '-' + dtv.getFullYear();
    }

    function money(v) { return (v != null ? parseFloat(v) : 0).toFixed(2); }

    // ── Populate filter dropdowns ────────────────────────────────────────────
    function fillMonths() {
        var names = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
        var $m = $('#cmbMonth');
        names.forEach(function (n, i) { $m.append($('<option></option>').val(i + 1).text(n)); });
    }

    function fillYears() {
        var now = new Date().getFullYear();
        var $y = $('#cmbYear');
        for (var y = now + 1; y >= 2020; y--) {
            $y.append($('<option></option>').val(y).text(y));
        }
    }

    function loadSearchData() {
        $.getJSON('/Bill/GetSearchData', { isStatus: false })
            .done(function (res) {
                if (!res || res.Fail) return;
                (res.providerList || res.ProviderList || []).forEach(function (p) {
                    $('#cmbProvider').append($('<option></option>').val(p.id).text(p.name));
                });
                (res.empList || res.EmpList || []).forEach(function (e) {
                    var label = (e.empName || '') + (e.empNo ? ' - ' + e.empNo : '');
                    $('#cmbEmployee').append($('<option></option>').val(e.empId).text(label));
                });
            })
            .fail(function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load filter lists.' });
            });
    }

    // ── Search open bills ────────────────────────────────────────────────────
    function search() {
        var query = {
            Month:    parseInt($('#cmbMonth').val(), 10)    || 0,
            Year:     parseInt($('#cmbYear').val(), 10)     || 0,
            Provider: parseInt($('#cmbProvider').val(), 10) || 0,
            Uid:      parseInt($('#cmbEmployee').val(), 10) || 0,
            Status:   0
        };

        $.getJSON('/Bill/SearchOpenBill', query)
            .done(function (res) {
                if (res && (res.success === false || res.Fail)) {
                    renderRows([]);
                    $('#gridWrap').show();
                    Swal.fire({ icon: 'info', title: 'No Results', text: res.message || 'No data found.' });
                    return;
                }
                renderRows((res && res.dtData) || []);
                $('#gridWrap').show();
            })
            .fail(function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Search failed. Please try again.' });
            });
    }

    function renderRows(bills) {
        if (dt) { dt.destroy(); dt = null; }

        var rows = '';
        bills.forEach(function (b) {
            rows +=
                '<tr data-id="' + esc(b.id) + '">' +
                    '<td data-label="Bill Date">'     + esc(fmtDate(b.billDate)) + '</td>' +
                    '<td data-label="Mobile">'        + esc(b.mobile)      + '</td>' +
                    '<td data-label="Employee Name">' + esc(b.empName)     + '</td>' +
                    '<td data-label="Manager Name">'  + esc(b.managerName) + '</td>' +
                    '<td data-label="Amount" class="text-end">' + esc(money(b.totalAmount)) + '</td>' +
                    '<td data-label="Assign To" class="text-center">' +
                        '<button type="button" class="btn-assign" data-id="' + esc(b.id) + '">Assign</button>' +
                    '</td>' +
                '</tr>';
        });
        $('#grdData tbody').html(rows);

        dt = $('#grdData').DataTable({
            responsive:   false,
            searching:    true,
            paging:       true,
            pageLength:   10,
            info:         true,
            lengthChange: false,
            destroy:      true,
            dom:          'tip',
            order:        [],
            columnDefs:   [{ targets: 5, orderable: false, searchable: false }],
            language:     { emptyTable: 'No open bills found for the selected filters.' }
        });

        var s = $('#txtSearchGrid').val() || '';
        if (s) dt.search(s).draw();
    }

    // ── Assign modal ──────────────────────────────────────────────────────────
    function openAssignModal(billId) {
        currentBillId = billId;
        $('#searchInput-Assign').val('');
        $('#modalOverlay-Assign, #modalContainer-Assign').addClass('active');
        document.body.style.overflow = 'hidden';
        loadEmployees();
    }

    function closeAssignModal() {
        $('#modalOverlay-Assign, #modalContainer-Assign').removeClass('active');
        document.body.style.overflow = '';
        $('#searchInput-Assign').val('');
        currentBillId = null;
    }

    function loadEmployees() {
        $('#gridBody-Assign').html('<div class="ra-loading">Loading employees…</div>');
        $.getJSON('/Ajax/GetEmployees')
            .done(function (res) {
                allEmployees = (res && (res.empList || res.EmpList)) || [];
                renderModalGrid(allEmployees);
            })
            .fail(function () {
                $('#gridBody-Assign').html(
                    '<div class="ra-empty-state"><span class="ra-empty-icon">⚠️</span>' +
                    'Failed to load employees. Please try again.</div>');
            });
    }

    function renderModalGrid(data) {
        var $body = $('#gridBody-Assign').empty();
        if (!data.length) {
            $body.html('<div class="ra-empty-state"><span class="ra-empty-icon">🔍</span>No employees found</div>');
            return;
        }
        data.forEach(function (emp) {
            var $row = $('<div class="ra-grid-row"></div>')
                .append($('<div class="ra-grid-cell" data-label="Employee No"></div>').text(emp.empNo || ''))
                .append($('<div class="ra-grid-cell" data-label="Employee Name"></div>').text(emp.empName || ''));
            $row.on('click', function () {
                $('#gridBody-Assign .ra-grid-row').removeClass('selected-row');
                $row.addClass('selected-row');
                confirmReAssign(emp.empId, emp.empName);
            });
            $body.append($row);
        });
    }

    function filterEmployees(term) {
        term = (term || '').toLowerCase();
        if (!term) { renderModalGrid(allEmployees); return; }
        renderModalGrid(allEmployees.filter(function (e) {
            return (e.empName && e.empName.toLowerCase().indexOf(term) > -1) ||
                   (e.empNo && String(e.empNo).toLowerCase().indexOf(term) > -1);
        }));
    }

    // ── Confirm + save re-assignment ──────────────────────────────────────────
    function confirmReAssign(newUid, newName) {
        var billId = currentBillId;
        closeAssignModal();

        Swal.fire({
            title: 'Re-Assign Bill',
            html: 'Re-assign this bill to <strong>' + esc(newName) + '</strong>?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Re-Assign',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            reverseButtons: true
        }).then(function (result) {
            if (!result.isConfirmed) return;

            Swal.fire({
                title: 'Please wait…', text: 'Re-assigning bill…',
                allowOutsideClick: false, allowEscapeKey: false,
                didOpen: function () { Swal.showLoading(); }
            });

            $.ajax({
                type: 'POST',
                url:  '/Bill/ReAssignBill_Save',
                data: { billId: billId, uid: newUid },
                success: function (response) {
                    Swal.close();
                    if (response && response.success) {
                        Swal.fire('Re-Assigned!', response.message, 'success').then(search);
                    } else {
                        Swal.fire('Error', (response && response.message) || 'Could not re-assign.', 'error');
                    }
                },
                error: function (xhr, status, error) {
                    Swal.close();
                    Swal.fire('Error', error || 'Request failed.', 'error');
                }
            });
        });
    }

    function clearFilters() {
        $('#cmbProvider, #cmbEmployee').val('');
        $('#cmbMonth').val('0');
        $('#cmbYear').val('0');
        $('#txtSearchGrid').val('');
        if (dt) { dt.destroy(); dt = null; }
        $('#grdData tbody').empty();
        $('#gridWrap').hide();
    }

    // ── Wiring ─────────────────────────────────────────────────────────────────
    $(function () {
        fillMonths();
        fillYears();
        loadSearchData();

        $('#btnSearch').on('click', search);
        $('#btnCancel').on('click', clearFilters);

        $('#txtSearchGrid').on('input', function () {
            if (dt) dt.search(this.value || '').draw();
        });

        // Per-row Assign button (delegated — survives DataTables redraws)
        $('#grdData tbody').on('click', '.btn-assign', function () {
            openAssignModal($(this).data('id'));
        });

        // Modal controls
        $('#modalClose-Assign, #modalOverlay-Assign').on('click', closeAssignModal);

        var debounce;
        $('#searchInput-Assign').on('input', function () {
            var v = this.value;
            clearTimeout(debounce);
            debounce = setTimeout(function () { filterEmployees(v); }, 200);
        });
    });
})();
