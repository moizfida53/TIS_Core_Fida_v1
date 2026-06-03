/* ============================================================================
   changeStatus.js — Bill ▸ Change Bill Status
   Replaces the legacy jqxGrid page with DataTables + Bootstrap, no jqWidgets.

   Endpoints (all /Bill/...):
     GET  GetSearchData?isStatus=true -> { EmpList:[{empId,empName,empNo}],
                                           ProviderList:[{id,name}], dtStatus:[…] }
     GET  Search?Month=&Year=&Provider=&Uid=&Status=  -> { dtData:[bill…] }
                                                       or { success:false, message }
     POST ChangeStatusSave  (billId)  -> { success, message }

   Dependencies (loaded globally by _Layout.cshtml):
     jQuery, Bootstrap 5, DataTables + BS5 integration, SweetAlert2, Font Awesome
   ============================================================================ */
(function () {
    'use strict';

    var dt = null;

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

    // ── Populate filter dropdowns ─────────────────────────────────────────────

    function fillMonths() {
        var names = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
        var $m = $('#cmbMonth');
        names.forEach(function (n, i) {
            $m.append($('<option></option>').val(i + 1).text(n));
        });
    }

    function fillYears() {
        var now = new Date().getFullYear();
        var $y = $('#cmbYear');
        for (var y = now + 1; y >= 2020; y--) {
            $y.append($('<option></option>').val(y).text(y));
        }
    }

    function loadSearchData() {
        $.getJSON('/Bill/GetSearchData', { isStatus: true })
            .done(function (res) {
                if (!res || res.Fail) return;

                (res.ProviderList || res.providerList || []).forEach(function (p) {
                    $('#cmbProvider').append($('<option></option>').val(p.id).text(p.name));
                });

                (res.EmpList || res.empList || []).forEach(function (e) {
                    var label = (e.empName || '') + (e.empNo ? ' - ' + e.empNo : '');
                    $('#cmbEmployee').append($('<option></option>').val(e.empId).text(label));
                });
            })
            .fail(function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load filter lists.' });
            });
    }

    // ── Search ────────────────────────────────────────────────────────────────

    function search() {
        var query = {
            Month:    parseInt($('#cmbMonth').val(), 10)    || 0,
            Year:     parseInt($('#cmbYear').val(), 10)     || 0,
            Provider: parseInt($('#cmbProvider').val(), 10) || 0,
            Uid:      parseInt($('#cmbEmployee').val(), 10) || 0,
            Status:   0
        };

        $.getJSON('/Bill/Search', query)
            .done(function (res) {
                if (res && res.success === false) {
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
                    '<td data-label="Status"><span class="cs-status">' + esc(b.statusName) + '</span></td>' +
                    '<td data-label="Change To" class="text-center">' +
                        '<button type="button" class="btn-status-change" data-id="' + esc(b.id) + '">Open</button>' +
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
            columnDefs: [
                { targets: 6, orderable: false, searchable: false }
            ],
            language: { emptyTable: 'No bills found for the selected filters.' }
        });

        var s = $('#txtSearchGrid').val() || '';
        if (s) dt.search(s).draw();
    }

    // ── Change a single bill's status to Open ──────────────────────────────────

    function changeStatus(billId) {
        Swal.fire({
            title: 'Change Status?',
            text: "Do you want to change this bill's status to Open?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Change',
            cancelButtonText: 'No, Cancel',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            reverseButtons: true
        }).then(function (result) {
            if (!result.isConfirmed) return;

            Swal.fire({
                title: 'Please wait…', text: 'Updating bill status…',
                allowOutsideClick: false, allowEscapeKey: false,
                didOpen: function () { Swal.showLoading(); }
            });

            $.ajax({
                type: 'POST',
                url:  '/Bill/ChangeStatusSave',
                data: { billId: billId },
                success: function (response) {
                    Swal.close();
                    if (response && response.success) {
                        Swal.fire('Updated!', response.message, 'success').then(function () { search(); });
                    } else {
                        Swal.fire('Error', (response && response.message) || 'Could not change status.', 'error');
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
        $('#cmbEmployee, #cmbProvider').val('');
        $('#cmbMonth').val('0');
        $('#cmbYear').val('0');
        $('#txtSearchGrid').val('');
        if (dt) { dt.destroy(); dt = null; }
        $('#grdData tbody').empty();
        $('#gridWrap').hide();
    }

    // ── Wiring ────────────────────────────────────────────────────────────────

    $(function () {
        fillMonths();
        fillYears();
        loadSearchData();

        $('#btnSearch').on('click', search);
        $('#btnCancel').on('click', clearFilters);

        $('#txtSearchGrid').on('input', function () {
            if (dt) dt.search(this.value || '').draw();
        });

        // Per-row Open button (delegated — survives DataTables redraws)
        $('#grdData tbody').on('click', '.btn-status-change', function () {
            changeStatus($(this).data('id'));
        });
    });
})();
