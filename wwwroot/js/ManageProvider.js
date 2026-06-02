/* ============================================================================
   ManageProvider.js — Settings ▸ Manage Provider
   Replaces the legacy jqxGrid/jqxCheckBox page with DataTables + Bootstrap.
   Endpoints (all /Setting/...):
     GET  GetProvider          -> { providerList:[{id,name,isVoip,countryId}] }
     POST AddProvider    (JSON Provider) -> { message }
     POST UpdateProvider (JSON Provider) -> { message }
     POST DeleteProvider (JSON Provider) -> { message }
   ============================================================================ */
(function () {
    'use strict';

    var providers = [];
    var dt = null;

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
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: msg, showConfirmButton: false, timer: 2400 });
    }
    function toastOk(msg) { Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: msg, showConfirmButton: false, timer: 1600 }); }
    function bool(v) { return v ? '<span class="prv-bool yes">Yes</span>' : '<span class="prv-bool no">No</span>'; }

    function fillGrid() {
        $.getJSON('/Setting/GetProvider', function (res) {
            providers = res.providerList || [];
            render();
        });
    }
    function render() {
        if (dt) { dt.destroy(); dt = null; }
        var rows = '';
        providers.forEach(function (p) {
            rows += '<tr data-id="' + p.id + '">' +
                '<td>' + esc(p.id) + '</td>' +
                '<td>' + esc(p.name) + '</td>' +
                '<td class="text-center">' + esc(p.countryId) + '</td>' +
                '<td class="text-center">' + bool(p.isVoip) + '</td>' +
            '</tr>';
        });
        $('#tblProvider tbody').html(rows);
        dt = $('#tblProvider').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true, dom: 'tip', order: [[0, 'asc']]
        });
        var s = $('#txtSearchProvider').val() || '';
        if (s) dt.search(s).draw();
    }

    function clearForm() {
        $('#hidID').val('');
        $('#txtProvider').val('');
        $('#chkVoip').prop('checked', false);
        $('#btnAdd').show(); $('#btnUpdate').hide(); $('#btnDelete').hide();
        $('#tblProvider tbody tr').removeClass('prv-selected');
    }

    function addProvider() {
        var name = $('#txtProvider').val().trim();
        if (!name) { flash('#txtProvider', 'Please enter Provider Name'); return; }
        showLoader('Saving…', 'Please wait!');
        $.ajax({
            type: 'POST', url: '/Setting/AddProvider',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ name: name, isVoip: $('#chkVoip').is(':checked') }),
            success: function (res) { hideLoader(); toastOk(res.message || 'Success'); clearForm(); fillGrid(); },
            error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not add provider.' }); }
        });
    }

    function updateProvider() {
        var name = $('#txtProvider').val().trim();
        var id = parseInt($('#hidID').val()) || 0;
        if (!id) { flash(null, 'Select a provider from the grid first'); return; }
        if (!name) { flash('#txtProvider', 'Please enter Provider Name'); return; }
        showLoader('Updating…', 'Please wait!');
        $.ajax({
            type: 'POST', url: '/Setting/UpdateProvider',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ id: id, name: name, isVoip: $('#chkVoip').is(':checked') }),
            success: function (res) { hideLoader(); toastOk(res.message || 'Success'); clearForm(); fillGrid(); },
            error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not update provider.' }); }
        });
    }

    function deleteProvider() {
        var id = parseInt($('#hidID').val()) || 0;
        if (!id) { flash(null, 'Select a provider from the grid first'); return; }
        Swal.fire({
            title: 'Delete this provider?', text: 'This cannot be undone.',
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545',
            confirmButtonText: 'Yes, delete', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            showLoader('Deleting…', 'Please wait!');
            $.ajax({
                type: 'POST', url: '/Setting/DeleteProvider',
                contentType: 'application/json; charset=utf-8', data: JSON.stringify({ id: id }),
                success: function (res) { hideLoader(); toastOk(res.message || 'Success'); clearForm(); fillGrid(); },
                error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not delete provider.' }); }
            });
        });
    }

    $(document).ready(function () {
        $('#btnAdd').on('click', addProvider);
        $('#btnUpdate').on('click', updateProvider);
        $('#btnDelete').on('click', deleteProvider);
        $('#btnCancel').on('click', clearForm);

        // Row select → load into form
        $(document).on('click', '#tblProvider tbody tr', function () {
            var id = parseInt($(this).data('id'));
            var p = providers.find(function (x) { return x.id === id; });
            if (!p) return;
            $('#tblProvider tbody tr').removeClass('prv-selected');
            $(this).addClass('prv-selected');
            $('#hidID').val(p.id);
            $('#txtProvider').val(p.name);
            $('#chkVoip').prop('checked', !!p.isVoip);
            $('#btnAdd').hide(); $('#btnUpdate').show(); $('#btnDelete').show();
        });

        $('#txtSearchProvider').on('input', function () { if (dt) dt.search(this.value || '').draw(); });

        fillGrid();
    });
})();
