/* ============================================================================
   unAssignedInvoice.js — Import ▸ Un-Assigned Invoices
   Replaces the legacy jqxGrid page with DataTables + Bootstrap, no jqWidgets.

   Endpoints:
     GET  /Import/GetUnAssignedBill -> { Bills:[{billDate,mobile,providerName,totalAmount}] }
     POST /Import/AssignInvoice     -> { Message }

   Dependencies (loaded globally by _Layout.cshtml):
     jQuery, Bootstrap 5, DataTables + BS5 integration, SweetAlert2, Font Awesome
   ============================================================================ */
(function () {
    'use strict';

    var dt = null;
    var bills = [];

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Legacy grid showed BillDate as "MMMM-yyyy"
    function monthYear(d) {
        if (!d) return '';
        var dtv = new Date(d);
        if (isNaN(dtv)) return '';
        var months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
        return months[dtv.getMonth()] + '-' + dtv.getFullYear();
    }

    function money(v) { return (v != null ? parseFloat(v) : 0).toFixed(2); }

    // ── Load + render grid ────────────────────────────────────────────────────
    function fillGrid() {
        $.ajax({ type: 'GET', cache: false, url: '/Import/GetUnAssignedBill' })
            .done(function (res) {
                if (res && res.Fail) {
                    bills = [];
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load un-assigned bills.' });
                } else {
                    bills = (res && res.Bills) || [];
                }
                render();
            })
            .fail(function () {
                bills = [];
                render();
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load un-assigned bills.' });
            });
    }

    function render() {
        if (dt) { dt.destroy(); dt = null; }

        var rows = '';
        bills.forEach(function (b) {
            rows +=
                '<tr>' +
                    '<td data-label="Bill Date" class="text-center">' + esc(monthYear(b.billDate)) + '</td>' +
                    '<td data-label="Mobile">'   + esc(b.mobile)       + '</td>' +
                    '<td data-label="Provider">' + esc(b.providerName) + '</td>' +
                    '<td data-label="Amount" class="text-end">' + esc(money(b.totalAmount)) + '</td>' +
                '</tr>';
        });
        $('#tblUnAssigned tbody').html(rows);

        dt = $('#tblUnAssigned').DataTable({
            responsive:   false,
            searching:    true,
            paging:       true,
            pageLength:   10,
            info:         true,
            lengthChange: false,
            destroy:      true,
            dom:          'tip',
            order:        [[0, 'asc']],
            language:     { emptyTable: 'No un-assigned bills found.' }
        });

        var s = $('#txtSearchInvoice').val() || '';
        if (s) dt.search(s).draw();
    }

    // ── Excel (CSV) export — same approach as Force Bill ──────────────────────
    function exportCsv() {
        if (bills.length === 0) {
            Swal.fire({ icon: 'info', title: 'Nothing to export', text: 'There are no bills to export.' });
            return;
        }

        var lines = ['Bill Date,Mobile,Provider,Amount'];
        bills.forEach(function (b) {
            lines.push([
                '"' + monthYear(b.billDate) + '"',
                '"' + (b.mobile || '') + '"',
                '"' + (b.providerName || '') + '"',
                money(b.totalAmount)
            ].join(','));
        });

        var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'UnAssignedBills.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Assign all un-assigned bills ──────────────────────────────────────────
    var assignModal = null;

    function doAssign() {
        if (assignModal) assignModal.hide();

        Swal.fire({
            title: 'Please wait…', text: 'Assigning bills…',
            allowOutsideClick: false, allowEscapeKey: false,
            didOpen: function () { Swal.showLoading(); }
        });

        $.ajax({ type: 'POST', url: '/Import/AssignInvoice' })
            .done(function (res) {
                Swal.close();
                Swal.fire('Done', (res && res.Message) || 'Bills assigned.', 'success')
                    .then(fillGrid);
            })
            .fail(function (xhr, status, error) {
                Swal.close();
                Swal.fire('Error', error || 'Assign failed.', 'error');
            });
    }

    // ── Wiring ─────────────────────────────────────────────────────────────────
    $(function () {
        assignModal = new bootstrap.Modal(document.getElementById('modalAssign'));

        $('#btnAssign').on('click', function () { assignModal.show(); });
        $('#btnConfirmAssign').on('click', doAssign);
        $('#btnExcelExport').on('click', exportCsv);

        $('#txtSearchInvoice').on('input', function () {
            if (dt) dt.search(this.value || '').draw();
        });

        fillGrid();
    });
})();
