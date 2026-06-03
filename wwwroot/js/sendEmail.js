/* ============================================================================
   sendEmail.js — SendEmail ▸ Send Email
   Replaces the legacy jqxGrid page with DataTables + Bootstrap modal editing.

   Endpoints (all /SendEmail/...):
     GET  GetEmail              -> { dtSendEmail:[{id,templateId,billId,billDate,
                                       subject,emailText,emailFrom,emailTo,cc,sent,sentOn}] }
     POST Send        (JSON { bid:[billId,…] })       -> { Message }
     POST Save        (JSON { billId,emailText,emailTo,cc }) -> { Message }
     POST DeleteEmail (JSON { emailId:[id,…] })       -> { Message }

   Dependencies (loaded globally by _Layout.cshtml):
     jQuery, Bootstrap 5, DataTables + BS5 integration, SweetAlert2, Font Awesome
   ============================================================================ */
(function () {
    'use strict';

    var emails      = [];     // raw rows from the server
    var byId        = {};     // id -> row, for fast modal lookup
    var dt          = null;
    var selectedIds = {};     // id -> true, persists across pages/search

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function bool(v) {
        return v ? '<span class="se-bool yes">Yes</span>' : '<span class="se-bool no">No</span>';
    }
    function toastOk(msg) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: msg, showConfirmButton: false, timer: 1800 });
    }
    // ASP.NET Core serializes JSON as camelCase by default, so the server's
    // { Message = "…" } arrives as result.message. Read it case-tolerantly.
    function msgOf(r)  { return (r && (r.message || r.Message)) || ''; }
    function failOf(r) { return !!(r && (r.fail || r.Fail)); }

    // ── Load + render grid ────────────────────────────────────────────────────

    function fillGrid() {
        $.getJSON('/SendEmail/GetEmail')
            .done(function (res) {
                if (failOf(res)) {
                    emails = [];
                    render();
                    Swal.fire({ icon: 'warning', title: 'Could not load emails',
                                text: msgOf(res) || 'No data returned from server.' });
                    return;
                }
                emails = (res && (res.dtSendEmail || res.DtSendEmail)) || [];
                byId = {};
                emails.forEach(function (e) { byId[e.id] = e; });
                render();
            })
            .fail(function () {
                emails = [];
                render();
                Swal.fire({ icon: 'error', title: 'Error',
                            text: 'Failed to load emails. Please refresh and try again.' });
            });
    }

    function render() {
        if (dt) { dt.destroy(); dt = null; }

        var rows = '';
        emails.forEach(function (e) {
            var chk = selectedIds[e.id] ? ' checked' : '';
            rows +=
                '<tr data-id="' + esc(e.id) + '" data-bill="' + esc(e.billId) + '">' +
                    '<td class="text-center"><input type="checkbox" class="form-check-input row-chk"' + chk + ' /></td>' +
                    '<td data-label="Bill Date">'  + esc(e.billDate)  + '</td>' +
                    '<td data-label="Subject" class="se-clip" title="' + esc(e.subject) + '">'   + esc(e.subject)   + '</td>' +
                    '<td data-label="Email Text" class="se-clip" title="' + esc(e.emailText) + '">' + esc(e.emailText) + '</td>' +
                    '<td data-label="Email From">' + esc(e.emailFrom) + '</td>' +
                    '<td data-label="Email To">'   + esc(e.emailTo)   + '</td>' +
                    '<td data-label="CC" class="se-clip" title="' + esc(e.cc) + '">' + esc(e.cc) + '</td>' +
                    '<td data-label="Sent" class="text-center">' + bool(e.sent) + '</td>' +
                    '<td data-label="Edit" class="text-center">' +
                        '<button type="button" class="se-edit-btn" title="Edit"><i class="fa fa-pen"></i></button>' +
                    '</td>' +
                '</tr>';
        });
        $('#tblSendEmail tbody').html(rows);

        dt = $('#tblSendEmail').DataTable({
            responsive:   false,
            searching:    true,
            paging:       true,
            pageLength:   10,
            info:         true,
            lengthChange: false,
            destroy:      true,
            dom:          'tip',
            order:        [],   // preserve server (SP) order
            columnDefs: [
                { targets: [0, 8], orderable: false, searchable: false }
            ],
            language: { emptyTable: 'No emails to send.' }
        });

        // Re-apply checkbox state + header sync after every redraw (paging/search)
        dt.on('draw.se', function () {
            applySelectionToVisible();
            syncSelectAll();
        });

        var s = $('#txtSearchEmail').val() || '';
        if (s) dt.search(s).draw();

        applySelectionToVisible();
        syncSelectAll();
    }

    // ── Selection (cross-page) ────────────────────────────────────────────────

    function getSelectedRows() {
        return Object.keys(selectedIds)
            .filter(function (k) { return selectedIds[k]; })
            .map(function (k) { return byId[k]; })
            .filter(Boolean);
    }

    function applySelectionToVisible() {
        $('#tblSendEmail tbody tr').each(function () {
            var id = $(this).attr('data-id');
            $(this).find('.row-chk').prop('checked', !!selectedIds[id]);
        });
    }

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

    function clearSelection() {
        selectedIds = {};
        $('#tblSendEmail tbody .row-chk').prop('checked', false);
        $('#chkSelectAll').prop('checked', false).prop('indeterminate', false);
    }

    // ── Send ──────────────────────────────────────────────────────────────────

    function sendEmails() {
        var rows = getSelectedRows();
        if (rows.length === 0) {
            Swal.fire({ icon: 'warning', title: 'No Selection', text: 'Please select at least one record.' });
            return;
        }
        var bid = rows.map(function (r) { return r.billId; });

        $.ajax({
            type:        'POST',
            url:         '/SendEmail/Send',
            data:        JSON.stringify({ bid: bid }),
            contentType: 'application/json; charset=utf-8',
            dataType:    'json',
            success: function (result) {
                if (msgOf(result) === 'Email Sent') {
                    clearSelection();
                    toastOk('Email Sent Successfully');
                    fillGrid();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Email sending failed.' });
                }
            },
            error: function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Email sending failed. Please try again.' });
            }
        });
    }

    // ── Mark as Sent ───────────────────────────────────────────────────────────

    function markAsSent() {
        var rows = getSelectedRows();
        if (rows.length === 0) {
            Swal.fire({ icon: 'warning', title: 'No Selection', text: 'Please select at least one record.' });
            return;
        }
        Swal.fire({
            title: 'Mark selected as sent?',
            text: 'The selected email(s) will be flagged as Sent.',
            icon: 'question', showCancelButton: true, confirmButtonColor: '#0d6efd',
            confirmButtonText: 'Yes, mark as sent', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            var emailId = rows.map(function (x) { return x.id; });

            $.ajax({
                type:        'POST',
                url:         '/SendEmail/MarkAsSent',
                data:        JSON.stringify({ emailId: emailId }),
                contentType: 'application/json; charset=utf-8',
                dataType:    'json',
                success: function (result) {
                    if (msgOf(result) === 'Marked') {
                        var count = (result && (result.count || result.Count)) || emailId.length;
                        clearSelection();
                        Swal.fire({
                            icon:  'success',
                            title: 'Marked as Sent',
                            text:  count + ' email' + (count > 1 ? 's were' : ' was') + ' successfully marked as sent.'
                        }).then(function () { fillGrid(); });
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not mark as sent, please try again.' });
                    }
                },
                error: function () {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Could not mark as sent, please try again.' });
                }
            });
        });
    }

    // ── Edit (modal) + Save ───────────────────────────────────────────────────

    function openEdit(id) {
        var e = byId[id];
        if (!e) return;
        $('#hidEmailId').val(e.id);
        $('#hidBillId').val(e.billId);
        $('#lblBillDate').text(e.billDate || '—');
        $('#lblSubject').text(e.subject || '—');
        $('#lblFrom').text(e.emailFrom || '—');
        $('#txtEmailTo').val(e.emailTo || '');
        $('#txtCC').val(e.cc || '');
        $('#txtEmailText').val(e.emailText || '');
        new bootstrap.Modal('#modalEditEmail').show();
    }

    function saveEmail() {
        var payload = {
            billId:    parseInt($('#hidBillId').val(), 10) || 0,
            emailText: $('#txtEmailText').val(),
            emailTo:   $('#txtEmailTo').val().trim(),
            cc:        $('#txtCC').val().trim()
        };

        $.ajax({
            type:        'POST',
            url:         '/SendEmail/Save',
            data:        JSON.stringify(payload),
            contentType: 'application/json; charset=utf-8',
            dataType:    'json',
            success: function (result) {
                if (msgOf(result) === 'Success') {
                    bootstrap.Modal.getInstance('#modalEditEmail')?.hide();
                    toastOk('Saved');
                    fillGrid();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Could not save changes.' });
                }
            },
            error: function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not save changes.' });
            }
        });
    }

    // ── Wiring ────────────────────────────────────────────────────────────────

    $(function () {
        $('#txtSearchEmail').on('input', function () {
            if (dt) dt.search(this.value || '').draw();
        });

        // Cross-page select-all (all rows matching the current filter)
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

        $('#tblSendEmail tbody').on('change', '.row-chk', function () {
            var id = $(this).closest('tr').attr('data-id');
            if (id != null) selectedIds[id] = this.checked;
            syncSelectAll();
        });

        // Edit button (delegated)
        $('#tblSendEmail tbody').on('click', '.se-edit-btn', function () {
            var id = $(this).closest('tr').attr('data-id');
            openEdit(id);
        });

        $('#btnSend').on('click', sendEmails);
        $('#btnMarkSent').on('click', markAsSent);
        $('#btnSaveEmail').on('click', saveEmail);

        fillGrid();
    });
})();
