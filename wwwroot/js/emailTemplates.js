/* ============================================================================
   emailTemplates.js — Email ▸ Email Templates
   Replaces the legacy jqxGrid + jqxDropDownList page with DataTables +
   Bootstrap selects + a tel-modal CRUD form — no jqWidgets.

   Endpoints:
     GET  /Ajax/LoadTemplates -> { tmvm: { templateTypes:[{id,templateName}],
                                           countries:[{countryId,countryName}],
                                           templates:[{id,templateId,templateName,templateText,
                                                       countryId,countryName,emailFrom,emailBcc}] } }
     POST /Ajax/UpdateTemplates ([FromBody] {id,templateId,countryId,templateText,emailFrom,emailBcc})
                                 -> { Templates:[…] }  or  { myMessage }

   Dependencies (loaded globally by _Layout.cshtml):
     jQuery, Bootstrap 5, DataTables + BS5 integration, SweetAlert2, Font Awesome
   ============================================================================ */
(function () {
    'use strict';

    var dt = null;
    var templates = [];
    var modal = null;

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

    // ── Load data ─────────────────────────────────────────────────────────────
    function loadTemplates() {
        $.getJSON('/Ajax/LoadTemplates')
            .done(function (res) {
                var vm = (res && res.tmvm) || {};
                fillTypeDropdown(vm.templateTypes || []);
                fillCountryDropdown(vm.countries || []);
                templates = vm.templates || [];
                renderGrid();
            })
            .fail(function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load templates.' });
            });
    }

    function fillTypeDropdown(types) {
        var $c = $('#cmbTemplate').empty().append('<option value="">Select Template Type</option>');
        types.forEach(function (t) { $c.append($('<option></option>').val(t.id).text(t.templateName)); });
    }

    function fillCountryDropdown(countries) {
        var $c = $('#cmbCountry').empty().append('<option value="">Select Country</option>');
        countries.forEach(function (c) { $c.append($('<option></option>').val(c.countryId).text(c.countryName)); });
    }

    // ── Grid ────────────────────────────────────────────────────────────────────
    function renderGrid() {
        if (dt) { dt.destroy(); dt = null; }

        var rows = '';
        (templates || []).forEach(function (t) {
            rows +=
                '<tr data-id="' + esc(t.id) + '">' +
                    '<td data-label="Template Type">' + esc(t.templateName) + '</td>' +
                    '<td data-label="Template Text" title="' + esc(t.templateText) + '">' + esc(t.templateText) + '</td>' +
                    '<td data-label="Country">' + esc(t.countryName) + '</td>' +
                    '<td data-label="From">'    + esc(t.emailFrom)   + '</td>' +
                    '<td data-label="BCC">'     + esc(t.emailBcc)    + '</td>' +
                    '<td data-label="Edit" class="text-center">' +
                        '<button type="button" class="tel-edit-btn" title="Edit" data-id="' + esc(t.id) + '">' + EDIT_SVG + '</button>' +
                    '</td>' +
                '</tr>';
        });
        $('#tblTemplates tbody').html(rows);

        dt = $('#tblTemplates').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true, autoWidth: false,
            dom: 'tip', order: [[0, 'asc']],
            columnDefs: [{ targets: 5, orderable: false, searchable: false }],
            language: { emptyTable: 'No templates found.' }
        });

        var s = $('#txtSearchTpl').val() || '';
        if (s) dt.search(s).draw();
    }

    // ── Modal open ──────────────────────────────────────────────────────────────
    function openForAdd() {
        $('#hidTplId').val('');
        $('#cmbTemplate, #cmbCountry').val('').prop('disabled', false);
        $('#txtTemplate, #txtEmailFrom, #txtEmailBCC').val('');
        $('#tplModalTitle').text('Add Template');
        modal.show();
    }

    function openForEdit(id) {
        var t = (templates || []).find(function (x) { return x.id == id; });
        if (!t) return;
        $('#hidTplId').val(t.id);
        // Template Type and Country are fixed once a template exists — disable them on edit.
        $('#cmbTemplate').val(t.templateId != null ? String(t.templateId) : '').prop('disabled', true);
        $('#cmbCountry').val(t.countryId != null ? String(t.countryId) : '').prop('disabled', true);
        $('#txtTemplate').val(t.templateText || '');
        $('#txtEmailFrom').val(t.emailFrom || '');
        $('#txtEmailBCC').val(t.emailBcc || '');
        $('#tplModalTitle').text('Edit Template');
        modal.show();
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    function save() {
        var tId = parseInt($('#cmbTemplate').val(), 10) || 0;
        var cId = parseInt($('#cmbCountry').val(), 10) || 0;
        var text = $('#txtTemplate').val().trim();

        if (tId <= 0) { Swal.fire({ icon: 'warning', title: 'Required', text: 'Please select a Template Type.' }); return; }
        if (cId <= 0) { Swal.fire({ icon: 'warning', title: 'Required', text: 'Please select a Country.' }); return; }
        if (!text)    { Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter the Email Text.' }); return; }

        var payload = {
            id:           parseInt($('#hidTplId').val(), 10) || 0,
            templateId:   tId,
            countryId:    cId,
            templateText: text,
            emailFrom:    $('#txtEmailFrom').val().trim(),
            emailBcc:     $('#txtEmailBCC').val().trim()
        };

        Swal.fire({ title: 'Please wait…', allowOutsideClick: false, allowEscapeKey: false, didOpen: function () { Swal.showLoading(); } });

        $.ajax({
            type: 'POST', url: '/Ajax/UpdateTemplates',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify(payload)
        })
            .done(function (res) {
                Swal.close();
                if (res && res.myMessage) { Swal.fire('Error', res.myMessage, 'error'); return; }
                templates = (res && res.Templates) || (res && res.templates) || [];
                renderGrid();
                modal.hide();
                Swal.fire({ icon: 'success', title: 'Saved', text: 'Template saved successfully.' });
            })
            .fail(function (xhr, status, error) {
                Swal.close();
                Swal.fire('Error', error || 'Save failed.', 'error');
            });
    }

    // ── Wiring ──────────────────────────────────────────────────────────────────
    $(function () {
        modal = new bootstrap.Modal(document.getElementById('templateModal'));

        $('#btnAddTemplate').on('click', openForAdd);
        $('#btnSaveTemplate').on('click', save);

        $('#tblTemplates tbody').on('click', '.tel-edit-btn', function () {
            openForEdit($(this).data('id'));
        });

        $('#txtSearchTpl').on('input', function () {
            if (dt) dt.search(this.value || '').draw();
        });

        loadTemplates();
    });
})();
