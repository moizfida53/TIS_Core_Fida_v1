/* ============================================================================
   forceBill.js — Bill ▸ Force Bill
   DataTables grid (same theme as ManageProvider / AddTelephone) + Bootstrap
   modal, no jqWidgets.

   Endpoint:
     GET  /Bill/GetForceBill  -> { bills:[{id,billDate,empName,managerName,
                                           department,mobile,providerName,totalAmount}] }
                              or { fail:true, message:'…' }
     POST /Bill/ForceBill (JSON) -> { success, message }

   Dependencies (loaded globally by _Layout.cshtml):
     jQuery, Bootstrap 5, DataTables + BS5 integration, SweetAlert2, Font Awesome
   ============================================================================ */
(function () {
    'use strict';

    var bills       = [];
    var dt          = null;
    var selectedIds = {};   // id -> true, persists across pages/search

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function monthYear(d) {
        if (!d) return '';
        var dtv = new Date(d);
        if (isNaN(dtv)) return '';
        return dtv.toLocaleString('default', { month: 'long' }) + '-' + dtv.getFullYear();
    }

    function money(v) {
        return (v != null ? parseFloat(v) : 0).toFixed(2);
    }

    function showSpinner(show) {
        $('#spinnerOverlay').toggleClass('d-none', !show);
    }

    // ── Load + render grid ────────────────────────────────────────────────────

    function fillGrid() {
        $.getJSON('/Bill/GetForceBill')
            .done(function (res) {
                if (res && res.fail) {
                    bills = [];
                    render();
                    Swal.fire({ icon: 'warning', title: 'Could not load bills',
                                text: res.message || 'No data returned from server.' });
                    return;
                }
                bills = (res && (res.bills || res.Bills)) || [];
                render();
            })
            .fail(function () {
                bills = [];
                render();
                Swal.fire({ icon: 'error', title: 'Error',
                            text: 'Failed to load Force Bills. Please refresh and try again.' });
            });
    }

    function render() {
        if (dt) { dt.destroy(); dt = null; }

        var rows = '';
        bills.forEach(function (b) {
            var chk = selectedIds[b.id] ? ' checked' : '';
            rows +=
                '<tr data-id="' + esc(b.id) + '">' +
                    '<td class="text-center"><input type="checkbox" class="form-check-input row-chk"' + chk + ' /></td>' +
                    '<td data-label="Bill Date">'  + esc(monthYear(b.billDate)) + '</td>' +
                    '<td data-label="Employee">'   + esc(b.empName)            + '</td>' +
                    '<td data-label="Manager">'    + esc(b.managerName)        + '</td>' +
                    '<td data-label="Department">' + esc(b.department)         + '</td>' +
                    '<td data-label="Mobile">'     + esc(b.mobile)             + '</td>' +
                    '<td data-label="Provider">'   + esc(b.providerName)       + '</td>' +
                    '<td data-label="Amount" class="text-end">' + esc(money(b.totalAmount)) + '</td>' +
                '</tr>';
        });
        $('#tblForceBill tbody').html(rows);

        dt = $('#tblForceBill').DataTable({
            responsive:   false,
            searching:    true,
            paging:       true,
            pageLength:   10,
            info:         true,
            lengthChange: false,
            destroy:      true,
            dom:          'tip',
            order:        [[1, 'asc']],
            columnDefs: [
                { targets: 0, orderable: false, searchable: false }
            ],
            language: { emptyTable: 'No bills available for forcing.' }
        });

        // Re-apply checkbox state + header sync after every redraw (paging/search),
        // since DataTables only keeps the current page's rows in the DOM.
        dt.on('draw.fb', function () {
            applySelectionToVisible();
            syncSelectAll();
        });

        // Re-apply the custom search box value after a redraw
        var s = $('#txtSearchForceBill').val() || '';
        if (s) dt.search(s).draw();

        applySelectionToVisible();
        syncSelectAll();
    }

    // ── Selection helpers ─────────────────────────────────────────────────────

    // All selected ids across every page (not just the visible DOM rows).
    function getSelectedBillIds() {
        return Object.keys(selectedIds)
            .filter(function (k) { return selectedIds[k]; })
            .map(function (k) { return parseInt(k, 10); });
    }

    // Push the persisted selection state onto the rows currently in the DOM.
    function applySelectionToVisible() {
        $('#tblForceBill tbody tr').each(function () {
            var id = $(this).attr('data-id');
            $(this).find('.row-chk').prop('checked', !!selectedIds[id]);
        });
    }

    // Header checkbox reflects the selection across all rows matching the
    // current filter — not just the visible page.
    function syncSelectAll() {
        if (!dt) return;
        var total = 0, sel = 0;
        dt.rows({ search: 'applied' }).every(function () {
            var id = $(this.node()).attr('data-id');
            total++;
            if (selectedIds[id]) sel++;
        });
        $('#chkSelectAll')
            .prop('indeterminate', sel > 0 && sel < total)
            .prop('checked', total > 0 && sel === total);
    }

    function clearForm() {
        selectedIds = {};
        $('#tblForceBill tbody .row-chk').prop('checked', false);
        $('#chkSelectAll').prop('checked', false).prop('indeterminate', false);
        $('#cmbStatus').val('4');
        $('#cmbCallType').val('2');
        $('#chkWavRtl, #chkWavBus, #chkAlwTrain').prop('checked', false);
    }

    // ── Force Bill action ─────────────────────────────────────────────────────

    function doForceBill() {
        var billIds = getSelectedBillIds();
        if (billIds.length === 0) return;

        var uid = $('#hidUID').val();
        if (!uid || uid === '' || uid === '0') {
            Swal.fire({ icon: 'warning', title: 'Session Expired',
                        text: 'Unable to retrieve user session. Please refresh and try again.' });
            return;
        }

        bootstrap.Modal.getInstance('#modalForceBill')?.hide();
        showSpinner(true);

        var payload = {
            BillIds:     billIds,
            Status:      parseInt($('#cmbStatus').val(), 10),
            CallType:    parseInt($('#cmbCallType').val(), 10),
            WavRental:   $('#chkWavRtl').is(':checked'),
            WavBusiness: $('#chkWavBus').is(':checked'),
            Train:       $('#chkAlwTrain').is(':checked'),
            Uid:         parseInt(uid, 10)
        };

        $.ajax({
            type:        'POST',
            url:         '/Bill/ForceBill',
            data:        JSON.stringify(payload),
            contentType: 'application/json; charset=utf-8',
            dataType:    'json',
            success: function (result) {
                showSpinner(false);
                Swal.fire({
                    icon:  result.success ? 'success' : 'error',
                    title: result.success ? 'Done' : 'Error',
                    text:  result.message
                });
                if (result.success) { clearForm(); fillGrid(); }
            },
            error: function () {
                showSpinner(false);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to force bill. Please try again.' });
            }
        });
    }

    // ── Excel (CSV) export ────────────────────────────────────────────────────

    function exportCsv() {
        if (bills.length === 0) {
            Swal.fire({ icon: 'info', title: 'No Data', text: 'No data to export.' });
            return;
        }
        var headers = ['Bill Date', 'Employee', 'Manager', 'Department', 'Mobile', 'Provider', 'Amount'];
        var lines   = [headers.join(',')];

        bills.forEach(function (b) {
            lines.push([
                '"' + monthYear(b.billDate)   + '"',
                '"' + (b.empName     || '')   + '"',
                '"' + (b.managerName || '')   + '"',
                '"' + (b.department  || '')   + '"',
                '"' + (b.mobile      || '')   + '"',
                '"' + (b.providerName|| '')   + '"',
                money(b.totalAmount)
            ].join(','));
        });

        var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'ForceBills.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Wiring ────────────────────────────────────────────────────────────────

    $(function () {
        // Custom search box (DataTables default search is hidden via dom:'tip')
        $('#txtSearchForceBill').on('input', function () {
            if (dt) dt.search(this.value || '').draw();
        });

        // Select-all → applies to EVERY row matching the current filter,
        // across all pages (not just the visible DOM rows).
        $('#chkSelectAll').on('change', function () {
            var checked = this.checked;
            if (dt) {
                dt.rows({ search: 'applied' }).every(function () {
                    var id = $(this.node()).attr('data-id');
                    if (id != null) selectedIds[id] = checked;
                });
            }
            applySelectionToVisible();
            syncSelectAll();
        });

        // Per-row checkbox updates the persisted state (delegated for redraws)
        $('#tblForceBill tbody').on('change', '.row-chk', function () {
            var id = $(this).closest('tr').attr('data-id');
            if (id != null) selectedIds[id] = this.checked;
            syncSelectAll();
        });

        $('#btnForceBillOpen').on('click', function () {
            if (getSelectedBillIds().length === 0) {
                Swal.fire({ icon: 'warning', title: 'No Selection',
                            text: 'Please select at least one bill to force.' });
                return;
            }
            new bootstrap.Modal('#modalForceBill').show();
        });

        $('#btnForceBill').on('click', doForceBill);
        $('#btnExcelExport').on('click', exportCsv);

        fillGrid();
    });
})();
