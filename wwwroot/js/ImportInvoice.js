/* ============================================================================
   ImportInvoice.js — Import Mobile Bills page  (ASP.NET Core port)
   ----------------------------------------------------------------------------
   Replaces all jqxGrid / jqxDropDownButton / $.blockUI with:
     • DataTables.net for history and error-record grids
     • Bootstrap 5 modals for editing records and showing bill details
     • Standard <select> dropdowns everywhere
     • #loaderDiv (from _Layout.cshtml) for loading states
     • SweetAlert2 for confirmations

   Endpoints (all /Import/... and /Admin/GetProvider):
     GET  /Import/GetUploadHistory          → { UploadList, IsDeleteButShow }
     POST /Import/Upload  (multipart)       → { success, fileName }
     POST /Import/FillSheet  (JSON body)    → { dtSheet: [{sheetName}] }
     POST /Import/UploadFile (JSON body)    → { MyMessage, BillAmount, gridData }
     POST /Import/ProcessBill (JSON body)   → { Message, BillDetails }
     POST /Import/UpdateImport (JSON body)  → { Message, dtImp }
     POST /Import/DeleteBill (JSON body)    → { myMessage }
     POST /Import/SendEmail                 → { Message }
     GET  /Import/GetSetting?provider=n    → { dtCol | dtDBCol }
     POST /Import/UpdateSetting (JSON body) → { Message }
     POST /Import/UpdateDBSetting (JSON body)→{ Message }
     POST /Import/UploadSetting (JSON body) → { Message, dtCol }
     POST /Import/CheckProvider?provider=n → { DbBased }
     POST /Import/TestConn (JSON body)      → { Message, dtViews | Error }
     GET  /Admin/GetProvider                → { ProviderList }
   ============================================================================ */
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────
    var uploadHistory   = [];   // from GetUploadHistory
    var importData      = [];   // error records from UploadFile
    var dbBased         = 'False';
    var uploadedFile    = null; // Import tab: File object from #jqxFileUpload
    var uploadedFile2   = null; // Mapping tab: File object from #jqxFileUpload2
    var uploadedFileName  = ''; // Import tab: server-side filename after upload
    var uploadedFileName2 = ''; // Mapping tab: server-side filename after upload
    var showDeleteBtn   = false;// driven by IsDeleteButShow from server

    var dtHistory = null;
    var dtImport  = null;

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

    function showLoader(title, sub) {
        $('#loaderTitle').text(title || 'Loading…');
        $('#loaderSub').text(sub || 'Please wait…');
        $('#loaderDiv').addClass('show-loader');
        $('body').addClass('loader-open');
    }
    function hideLoader() {
        $('#loaderDiv').removeClass('show-loader');
        $('body').removeClass('loader-open');
    }

    // Format a date value to dd/MM/yyyy for display
    function fmtDate(val) {
        if (!val) return '';
        var d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        var dd = ('0' + d.getDate()).slice(-2);
        var mm = ('0' + (d.getMonth() + 1)).slice(-2);
        return dd + '/' + mm + '/' + d.getFullYear();
    }

    // Format date to yyyy-MM-dd for <input type="date">
    function fmtDateISO(val) {
        if (!val) return '';
        var d = new Date(val);
        if (isNaN(d.getTime())) return '';
        var mm = ('0' + (d.getMonth() + 1)).slice(-2);
        var dd = ('0' + d.getDate()).slice(-2);
        return d.getFullYear() + '-' + mm + '-' + dd;
    }

    var EDIT_SVG =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>' +
        '</svg>';

    // ─────────────────────────────────────────────────────────────────────────
    //  INITIALISATION
    // ─────────────────────────────────────────────────────────────────────────
    function fillYear() {
        var $sel = $('#cmbYear');
        $sel.find('option:not(:first)').remove();
        for (var y = 2026; y <= 2035; y++)
            $sel.append($('<option>').val(y).text(y));
    }

    function fillProviders() {
        $.ajax({
            type: 'GET', url: '/Admin/GetProvider', dataType: 'json',
            success: function (res) {
                var providers = res.ProviderList || res.providerList || [];
                var opts = '<option value="">Select Provider</option>';
                providers.forEach(function (p) {
                    var id   = p.ID   || p.id;
                    var name = p.NAME || p.name || p.Name;
                    opts += '<option value="' + esc(id) + '">' + esc(name) + '</option>';
                });
                $('#cmbProvider').html(opts);
                $('#cmbProvider2').html(opts);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  UPLOAD HISTORY GRID  (#tblHistory)
    // ─────────────────────────────────────────────────────────────────────────
    function loadUploadHistory() {
        $.ajax({
            type: 'GET', cache: false, url: '/Import/GetUploadHistory', dataType: 'json',
            success: function (res) {
                uploadHistory  = res.UploadList    || res.uploadList    || [];
                showDeleteBtn  = (res.IsDeleteButShow || res.isDeleteButShow) === 1;
                if (!showDeleteBtn) $('#thDelete').hide();
                renderHistoryGrid();
            },
            error: function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load upload history.' });
            }
        });
    }

    function renderHistoryGrid() {
        if (dtHistory) { dtHistory.destroy(); dtHistory = null; }

        var rows = '';
        uploadHistory.forEach(function (u) {
            var delBtn = showDeleteBtn
                ? '<button type="button" class="btn btn-danger btn-sm" ' +
                  'onclick="window._impDeleteBill(' + u.id + ',' + u.providerId + ',\'' + fmtDateISO(u.billDate) + '\')">' +
                  '<i class="fa fa-trash"></i></button>'
                : '';

            rows += '<tr>' +
                '<td>' + esc(u.fileName    || '') + '</td>' +
                '<td>' + fmtDate(u.billDate)       + '</td>' +
                '<td>' + fmtDate(u.uploadDate)     + '</td>' +
                '<td>' + esc(u.providerName || '') + '</td>' +
                '<td class="text-end">' + esc(u.billAmount || '0') + '</td>' +
                '<td class="text-center">' + delBtn + '</td>' +
            '</tr>';
        });

        $('#tblHistory tbody').html(rows);
        dtHistory = $('#tblHistory').DataTable({
            responsive: false, searching: true, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true,
            dom: 'tip', order: [[1, 'desc']],
            columnDefs: [{ orderable: false, targets: 5 }]
        });

        var local = ($('#txtSearchHistory').val() || '');
        var glob  = ($('#globalSearch').val() || '');
        if (local || glob) dtHistory.search(local || glob).draw();
    }

    // exposed so inline onclick can reach it
    window._impDeleteBill = function (id, providerId, billDateISO) {
        Swal.fire({
            title: 'Delete this bill?', text: 'This cannot be undone.',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Yes, delete', confirmButtonColor: '#dc3545',
            cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Import/DeleteBill',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({ id: id, providerId: providerId, billDate: billDateISO }),
                success: function (res) {
                    if ((res.myMessage || res.MyMessage) === 'succ') {
                        Swal.fire({ icon: 'success', title: 'Deleted', text: 'Bill deleted.', timer: 1400, showConfirmButton: false });
                        loadUploadHistory();
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not delete.' });
                    }
                }
            });
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  IMPORT ERROR GRID  (#tblImport)
    // ─────────────────────────────────────────────────────────────────────────
    function renderImportGrid() {
        if (dtImport) { dtImport.destroy(); dtImport = null; }

        var rows = '';
        importData.forEach(function (r) {
            var subCls  = !r.subNo    ? 'imp-cell-empty' : '';
            var datCls  = !r.callDate ? 'imp-cell-empty' : '';
            var amtCls  = !r.amount   ? 'imp-cell-empty' : '';
            var rowCls  = (subCls || datCls || amtCls) ? 'imp-error' : '';
            rows += '<tr class="' + rowCls + '" data-id="' + r.id + '">' +
                '<td class="' + subCls  + '">' + esc(r.subNo    || '') + '</td>' +
                '<td>' + fmtDate(r.billDate)                            + '</td>' +
                '<td class="' + datCls  + '">' + esc(r.callDate || '') + '</td>' +
                '<td>' + esc(r.transType   || '') + '</td>' +
                '<td>' + esc(r.description || '') + '</td>' +
                '<td class="text-end ' + amtCls + '">' + esc(r.amount   || '') + '</td>' +
                '<td>' + esc(r.duration    || '') + '</td>' +
                '<td>' + esc(r.callTime    || '') + '</td>' +
                '<td class="text-center">' +
                    '<button type="button" class="tel-edit-btn" title="Edit" ' +
                    'onclick="window._impEditRow(' + r.id + ')">' + EDIT_SVG + '</button>' +
                '</td>' +
            '</tr>';
        });

        $('#tblImport tbody').html(rows);
        dtImport = $('#tblImport').DataTable({
            responsive: false, searching: false, paging: true, pageLength: 10,
            info: true, lengthChange: false, destroy: true,
            dom: 'tip', order: [[0, 'asc']],
            columnDefs: [{ orderable: false, targets: 8 }]
        });

        $('#impImportSection').show();
    }

    window._impEditRow = function (id) {
        var row = importData.find(function (r) { return r.id === id; });
        if (!row) return;
        $('#editImportId').val(id);
        $('#editSubNo').val(row.subNo || '');
        $('#editCallDate').val(fmtDateISO(row.callDate));
        $('#editAmount').val(row.amount || '');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('editImportModal')).show();
    };

    function saveImportRow() {
        var id       = parseInt($('#editImportId').val()) || 0;
        var subNo    = $('#editSubNo').val().trim();
        var callDate = $('#editCallDate').val();
        var amount   = $('#editAmount').val().trim();

        if (!subNo)    { flash('#editSubNo',    'Please enter Subscription No'); return; }
        if (!callDate) { flash('#editCallDate', 'Please enter Call Date');       return; }
        if (!amount)   { flash('#editAmount',   'Please enter Amount');          return; }

        showLoader();
        $.ajax({
            type: 'POST', url: '/Import/UpdateImport',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ id: id, subNo: subNo, callDate: callDate, amount: amount }),
            success: function (res) {
                hideLoader();
                bootstrap.Modal.getInstance(document.getElementById('editImportModal')).hide();
                importData = res.dtImp || res.DtImp || [];
                if (importData.length > 0) {
                    renderImportGrid();
                    Swal.fire({ icon: 'success', title: 'Saved', text: 'Row updated. Fix remaining errors.', timer: 1500, showConfirmButton: false });
                } else {
                    // All errors fixed — show Process Bill
                    if (dtImport) { dtImport.destroy(); dtImport = null; }
                    $('#impImportSection').hide();
                    $('#btnSave').hide();
                    $('#btnProcess').show();
                    Swal.fire({ icon: 'success', title: 'All Fixed', text: 'You can now process the bill.', timer: 1500, showConfirmButton: false });
                }
            },
            error: function () {
                hideLoader();
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not update record.' });
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  FILE UPLOAD + FILL SHEET
    // ─────────────────────────────────────────────────────────────────────────
    function uploadAndFillSheet(fileInput, labelId, sheetSelectId, fileNameVar, callback) {
        var files = fileInput.files;
        if (!files || !files.length) return;
        var file = files[0];

        // Store reference for later
        if (fileNameVar === 'import') { uploadedFile = file; }
        else                          { uploadedFile2 = file; }

        var formData = new FormData();
        formData.append('fileToUpload', file);

        showLoader('Bill Loading…', 'Reading file & sheets, please wait!');
        $.ajax({
            url: '/Import/Upload', type: 'POST',
            data: formData, processData: false, contentType: false,
            success: function (res) {
                if (!res.success) {
                    hideLoader();
                    Swal.fire({ icon: 'error', title: 'Upload Failed', text: res.message || 'Unknown error' });
                    return;
                }

                var savedName = res.fileName || file.name;
                if (fileNameVar === 'import') { uploadedFileName  = savedName; }
                else                          { uploadedFileName2 = savedName; }

                $('#' + labelId).text(savedName);

                // Get sheet names from server
                $.ajax({
                    type: 'POST', url: '/Import/FillSheet',
                    contentType: 'application/json; charset=utf-8',
                    data: JSON.stringify({ fileName: savedName }),
                    success: function (r) {
                        hideLoader();
                        var sheets = r.dtSheet || r.DtSheet || [];
                        var $sel   = $('#' + sheetSelectId);
                        $sel.empty().append('<option value="">Select Sheet</option>');
                        sheets.forEach(function (s) {
                            var name = s.sheetName || s.SheetName || '';
                            $sel.append('<option value="' + esc(name) + '">' + esc(name) + '</option>');
                        });
                        if (typeof callback === 'function') callback(savedName, sheets);
                    },
                    error: function () {
                        hideLoader();
                        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load sheet names.' });
                    }
                });
            },
            error: function () {
                hideLoader();
                Swal.fire({ icon: 'error', title: 'Upload Failed', text: 'File upload error.' });
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SUBMIT DATA  (Import tab → UploadFile)
    // ─────────────────────────────────────────────────────────────────────────
    function submitData() {
        var month    = parseInt($('#cmbMonth').val()) || 0;
        var year     = parseInt($('#cmbYear').val())  || 0;
        var provider = parseInt($('#cmbProvider').val()) || 0;
        var sheet    = $('#cmbSheet').val() || '';

        if (!month || month === 0) { flash('#cmbMonth',    'Please select Month');    return; }
        if (!year)                 { flash('#cmbYear',     'Please select Year');     return; }
        if (!provider)             { flash('#cmbProvider', 'Please select Provider'); return; }

        if (dbBased === 'False' && !sheet) { flash('#cmbSheet', 'Please select Sheet'); return; }

        // Duplicate check against in-memory upload history
        var lastDay = new Date(year, month, 0); // last day of selected month
        var isDup   = uploadHistory.some(function (u) {
            if ((u.providerId || u.ProviderId) !== provider) return false;
            var bd = new Date(u.billDate || u.BillDate);
            return bd.getFullYear() === lastDay.getFullYear() &&
                   bd.getMonth()    === lastDay.getMonth();
        });

        if (isDup) {
            Swal.fire({ icon: 'info', title: 'Already Imported', text: 'A bill for this month and provider already exists.' });
            return;
        }

        if (!uploadedFileName && dbBased === 'False') {
            flash('#jqxFileUpload', 'Please upload a file first');
            return;
        }

        var payload = {
            fileName:   uploadedFileName,
            sheetName:  sheet,
            month:      month,
            year:       year,
            providerId: provider,
            dbBased:    dbBased
        };

        showLoader('Bill Loading…. please wait!', 'Importing bill data into the system');
        $.ajax({
            type: 'POST', url: '/Import/UploadFile',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify(payload),
            success: function (res) {
                hideLoader();
                // Reveal Step 4 with the total amount.
                $('#stepResult').show();
                $('#lblBillAmount').text(res.BillAmount || res.billAmount || '0');
                importData = res.gridData || res.GridData || [];

                if (importData.length > 0) {
                    renderImportGrid();
                    $('#btnSave').show();
                    $('#btnProcess').hide();
                } else {
                    $('#impImportSection').hide();
                    $('#btnProcess').show();
                    $('#btnSave').hide();
                }
            },
            error: function () {
                hideLoader();
                Swal.fire({ icon: 'error', title: 'Import Failed', text: 'Could not import bill data. Contact Admin.' });
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PROCESS BILL
    // ─────────────────────────────────────────────────────────────────────────
    function processBill() {
        Swal.fire({
            title: 'Process Bill?', text: 'This will finalise the import.',
            icon: 'question', showCancelButton: true,
            confirmButtonText: 'Yes, process', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            showLoader('Processing Bill…', 'Finalising the import, please wait!');
            $.ajax({
                type: 'POST', url: '/Import/ProcessBill',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({ dbBased: dbBased }),
                success: function (res) {
                    hideLoader();
                    var msg = res.Message || res.message || '';
                    if (msg.toLowerCase() === 'succ' || msg.toLowerCase() === 'success') {
                        var d = res.BillDetails || res.billDetails || {};
                        var b1 = d.BilledButNotInSystem       || d.billedButNotInSystem       || {};
                        var b2 = d.InSystemButNotAssigned      || d.inSystemButNotAssigned      || {};
                        var b3 = d.AssignedButOutsideValidDates|| d.assignedButOutsideValidDates|| {};

                        $('#bdCount1').text(b1.CountOfBills || b1.countOfBills || 0);
                        $('#bdAmt1').text(parseFloat(b1.TotalAmount || b1.totalAmount || 0).toFixed(3));
                        $('#bdCount2').text(b2.CountOfBills || b2.countOfBills || 0);
                        $('#bdAmt2').text(parseFloat(b2.TotalAmount || b2.totalAmount || 0).toFixed(3));
                        $('#bdCount3').text(b3.CountOfBills || b3.countOfBills || 0);
                        $('#bdAmt3').text(parseFloat(b3.TotalAmount || b3.totalAmount || 0).toFixed(3));

                        bootstrap.Modal.getOrCreateInstance(document.getElementById('billDetailsModal')).show();
                        clearImportState();
                        loadUploadHistory();
                    } else {
                        Swal.fire({ icon: 'error', title: 'Failed', text: 'Cannot complete transaction. Contact Admin.' });
                    }
                },
                error: function () {
                    hideLoader();
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Process bill failed.' });
                }
            });
        });
    }

    function clearImportState() {
        importData      = [];
        uploadedFile    = null;
        uploadedFileName = '';
        $('#cmbMonth').val('0');
        $('#cmbYear').val('');
        $('#cmbProvider').val('');
        $('#cmbSheet').empty().append('<option value="">Select Sheet</option>');
        $('#lblFileName').text('');
        $('#lblBillAmount').text('');
        $('#jqxFileUpload').val('');
        $('#btnUpload').hide();
        $('#btnSubmit').hide();
        $('#btnProcess, #btnSave').hide();
        $('#stepSheet').hide();
        $('#stepResult').hide();
        $('#impImportSection').hide();
        if (dtImport) { dtImport.destroy(); dtImport = null; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SEND EMAIL  (from Bill Details modal)
    // ─────────────────────────────────────────────────────────────────────────
    function sendEmail() {
        showLoader();
        $.ajax({
            type: 'POST', url: '/Import/SendEmail',
            contentType: 'application/json; charset=utf-8',
            data: '{}',
            success: function (res) {
                hideLoader();
                var msg = res.Message || res.message || '';
                if (msg.toLowerCase().includes('sent') && !msg.toLowerCase().includes('fail')) {
                    Swal.fire({ icon: 'success', title: 'Email Sent', timer: 1500, showConfirmButton: false });
                } else {
                    Swal.fire({ icon: 'warning', title: 'Email', text: msg });
                }
            },
            error: function () {
                hideLoader();
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to send email.' });
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CHECK PROVIDER  (file vs DB-based)
    // ─────────────────────────────────────────────────────────────────────────
    function checkProvider(provider) {
        $.ajax({
            type: 'POST', url: '/Import/CheckProvider?provider=' + parseInt(provider),
            contentType: 'application/json; charset=utf-8',
            data: '{}',
            success: function (res) {
                dbBased = (res.DbBased || res.dbBased) === 'True' ? 'True' : 'False';
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EXCEL MAPPING TAB
    // ─────────────────────────────────────────────────────────────────────────
    function bindMappingDropdowns(source) {
        // source is array of column name strings
        ['dd1','dd2','dd3','dd4','dd5','dd6','dd7','dd8'].forEach(function (id, i) {
            var $sel = $('#' + id);
            $sel.empty().append('<option value="">Select Column</option>');
            source.forEach(function (col) {
                $sel.append($('<option>').val(col).text(col));
            });
            if (source[i] !== undefined) $sel.val(source[i]);
        });
    }

    function getSetting() {
        var provider = parseInt($('#cmbProvider2').val()) || 0;
        if (!provider) { flash('#cmbProvider2', 'Please select Provider'); return; }

        $.ajax({
            type: 'GET', url: '/Import/GetSetting?provider=' + provider, dataType: 'json',
            success: function (res) {
                var col = res.dtCol || res.dtDBCol;
                if (!col) return;
                var source = [col.col1||col.Col1, col.col2||col.Col2, col.col3||col.Col3,
                              col.col4||col.Col4, col.col5||col.Col5, col.col6||col.Col6,
                              col.col7||col.Col7, col.col8||col.Col8];
                bindMappingDropdowns(source);

                if (res.dtDBCol) {
                    // DB-based provider
                    $('#SelectType').val('2');
                    $('#SelectFile').hide(); $('#DataBase').show();
                    $('#txtDataBase').val(col.dbConstr || col.DbConstr || '');
                    $('#cmbViews').empty()
                        .append('<option value="">' + esc(col.dbTableName || col.DbTableName || '') + '</option>');
                    $('#btnUpdate').hide(); $('#Button1').show();
                } else {
                    // Excel-based provider
                    $('#SelectType').val('1');
                    $('#SelectFile').show(); $('#DataBase').hide();
                    $('#btnUpdate').show(); $('#Button1').hide();
                }
            }
        });
    }

    function updateSetting() {
        var provider = parseInt($('#cmbProvider2').val()) || 0;
        if (!provider) { flash('#cmbProvider2', 'Please select Provider'); return; }

        var vals = ['dd1','dd2','dd3','dd4','dd5','dd6','dd7','dd8'].map(function (id) { return $('#' + id).val() || ''; });

        Swal.fire({
            title: 'Update Settings?', icon: 'question', showCancelButton: true,
            confirmButtonText: 'Yes, update', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Import/UpdateSetting',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({
                    provider: provider,
                    col1: vals[0], col2: vals[1], col3: vals[2], col4: vals[3],
                    col5: vals[4], col6: vals[5], col7: vals[6], col8: vals[7]
                }),
                success: function (res) {
                    Swal.fire({ icon: 'success', title: 'Updated', text: res.Message || res.message || 'Settings saved.', timer: 1600, showConfirmButton: false });
                }
            });
        });
    }

    function updateDBSetting() {
        var provider  = parseInt($('#cmbProvider2').val()) || 0;
        var dbConstr  = $('#txtDataBase').val().trim();
        var tableName = $('#cmbViews').val() || '';
        if (!provider) { flash('#cmbProvider2', 'Please select Provider');        return; }
        if (!dbConstr)  { flash('#txtDataBase',  'Please enter connection string'); return; }
        if (!tableName) { flash('#cmbViews',     'Please select a view/table');    return; }

        var vals = ['dd1','dd2','dd3','dd4','dd5','dd6','dd7','dd8'].map(function (id) { return $('#' + id).val() || ''; });

        Swal.fire({
            title: 'Update DB Settings?', icon: 'question', showCancelButton: true,
            confirmButtonText: 'Yes, update', cancelButtonText: 'Cancel', reverseButtons: true
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.ajax({
                type: 'POST', url: '/Import/UpdateDBSetting',
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({
                    provider: provider, dbConstr: dbConstr, dbTableName: tableName,
                    col1: vals[0], col2: vals[1], col3: vals[2], col4: vals[3],
                    col5: vals[4], col6: vals[5], col7: vals[6], col8: vals[7]
                }),
                success: function (res) {
                    Swal.fire({ icon: 'success', title: 'Updated', text: res.Message || res.message, timer: 1600, showConfirmButton: false });
                }
            });
        });
    }

    function testConn() {
        var dbConstr = $('#txtDataBase').val().trim();
        if (!dbConstr) { flash('#txtDataBase', 'Please enter connection string'); return; }

        $('#connStatus').html('');
        showLoader();
        $.ajax({
            type: 'POST', url: '/Import/TestConn',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ dbConstr: dbConstr }),
            success: function (res) {
                hideLoader();
                if (res.Error || res.error) {
                    $('#connStatus').html('<span class="imp-conn-status imp-conn-status--err"><i class="fa fa-times-circle me-1"></i>' + esc(res.Error || res.error) + '</span>');
                } else {
                    $('#connStatus').html('<span class="imp-conn-status imp-conn-status--ok"><i class="fa fa-check-circle me-1"></i>Connection successful</span>');
                    var views = res.dtViews || res.DtViews || [];
                    var $sel  = $('#cmbViews');
                    $sel.empty().append('<option value="">Select View</option>');
                    views.forEach(function (v) {
                        $sel.append($('<option>').val(v).text(v));
                    });
                }
            },
            error: function () {
                hideLoader();
                $('#connStatus').html('<span class="imp-conn-status imp-conn-status--err"><i class="fa fa-times-circle me-1"></i>Connection failed</span>');
            }
        });
    }

    function uploadMappingSetting() {
        // Upload the selected mapping file then get column names for dd1-dd8
        var provider = parseInt($('#cmbProvider2').val()) || 0;
        var sheet    = $('#cmbSheet2').val() || '';
        if (!provider)          { flash('#cmbProvider2', 'Please select Provider'); return; }
        if (!uploadedFileName2) { flash('#jqxFileUpload2', 'Please select and upload a file first'); return; }
        if (!sheet)             { flash('#cmbSheet2',     'Please select a sheet'); return; }

        showLoader();
        $.ajax({
            type: 'POST', url: '/Import/UploadSetting',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ fileName: uploadedFileName2, sheetName: sheet, providerId: provider }),
            success: function (res) {
                hideLoader();
                var cols = res.dtCol || res.DtCol || [];
                var source = cols.map(function (c) { return c.cols || c.Cols || ''; });
                bindMappingDropdowns(source);
            },
            error: function () {
                hideLoader();
                Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load column settings.' });
            }
        });
    }

    function resetMappingForm() {
        ['dd1','dd2','dd3','dd4','dd5','dd6','dd7','dd8'].forEach(function (id) {
            $('#' + id).empty().append('<option value="">Select Column</option>');
        });
        $('#cmbSheet2').empty().append('<option value="">Select Sheet</option>');
        $('#cmbProvider2').val('');
        $('#SelectType').val('0');
        $('#SelectFile').show(); $('#DataBase').hide();
        $('#lblFileName2').text('');
        $('#txtDataBase').val('');
        $('#cmbViews').empty().append('<option value="">Select View</option>');
        $('#connStatus').html('');
        $('#btnUpdate').show(); $('#Button1').hide();
        uploadedFile2    = null;
        uploadedFileName2 = '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  EXPORT TO CSV
    // ─────────────────────────────────────────────────────────────────────────
    function exportToCSV() {
        if (!uploadHistory.length) { Swal.fire({ toast: true, icon: 'info', title: 'No data to export', position: 'top-end', timer: 2000, showConfirmButton: false }); return; }

        var hdr   = ['File Name', 'Bill Date', 'Upload Date', 'Provider', 'Bill Amount'];
        var lines = [hdr.map(function (h) { return '"' + h + '"'; }).join(',')];
        uploadHistory.forEach(function (u) {
            lines.push([u.fileName, fmtDate(u.billDate), fmtDate(u.uploadDate), u.providerName, u.billAmount]
                .map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; })
                .join(','));
        });
        var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a'); a.href = url; a.download = 'upload_history.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WIRE-UP
    // ─────────────────────────────────────────────────────────────────────────
    $(document).ready(function () {

        // Import tab — file selected
        $(document).on('change', '#jqxFileUpload', function () {
            // A new file invalidates any previously loaded sheet / result.
            $('#stepSheet').hide();
            $('#stepResult').hide();
            $('#btnSubmit').hide();
            $('#cmbSheet').empty().append('<option value="">Select Sheet</option>');
            if (this.files && this.files.length) {
                $('#btnUpload').show();
            } else {
                $('#btnUpload').hide();
            }
        });

        // Import tab — Upload button (upload file + fill sheets)
        $(document).on('click', '#btnUpload', function () {
            uploadAndFillSheet(document.getElementById('jqxFileUpload'), 'lblFileName', 'cmbSheet', 'import',
                function () {
                    // Reveal Step 3 (Select Sheet) once sheets are loaded.
                    $('#stepSheet').show();
                    // Submit stays hidden until a sheet is actually chosen.
                    $('#btnSubmit').hide();
                    // Hide any downstream result from a previous run.
                    $('#stepResult').hide();
                });
        });

        // Import tab — Sheet chosen → reveal Submit
        $(document).on('change', '#cmbSheet', function () {
            if (this.value) { $('#btnSubmit').show(); }
            else            { $('#btnSubmit').hide(); }
        });

        // Import tab — Submit
        $(document).on('click', '#btnSubmit', function () { submitData(); });

        // Import tab — Process Bill
        $(document).on('click', '#btnProcess', function () { processBill(); });

        // Import tab — Save Changes (handled per-row via editImportModal)
        $(document).on('click', '#btnSave', function () {
            Swal.fire({ icon: 'info', title: 'Use the edit pencil', text: 'Click the edit icon on each error row to correct it.', timer: 2500, showConfirmButton: false });
        });

        // Edit Import Record modal — Save
        $(document).on('click', '#btnSaveImportRow', function () { saveImportRow(); });

        // Provider change — check if DB-based
        $(document).on('change', '#cmbProvider', function () {
            var v = this.value;
            if (v) checkProvider(v);
        });

        // Import tab — Export
        $(document).on('click', '#btnExportExcel', function () { exportToCSV(); });

        // Bill Details modal — Send Email
        $(document).on('click', '#btnBdSendEmail', function () { sendEmail(); });

        // Bill Details modal — Goto Unassigned
        $(document).on('click', '#btnBdGotoUnassigned', function () {
            window.location.href = '/Import/UnAssigned';
        });

        // ── EXCEL MAPPING TAB ──────────────────────────────────────────────

        // File selected → upload + fill sheets
        $(document).on('change', '#jqxFileUpload2', function () {
            if (this.files && this.files.length) {
                uploadAndFillSheet(document.getElementById('jqxFileUpload2'), 'lblFileName2', 'cmbSheet2', 'mapping', null);
            }
        });

        // Upload New Setting (get column names for dd1-dd8)
        $(document).on('click', '#btnUpload2', function () { uploadMappingSetting(); });

        // Show Prev Setting
        $(document).on('click', '#btnPrevSetting', function () { getSetting(); });

        // Reset
        $(document).on('click', '#btnReset', function () { resetMappingForm(); });

        // Excel Update
        $(document).on('click', '#btnUpdate', function () { updateSetting(); });

        // DB Update
        $(document).on('click', '#Button1', function () { updateDBSetting(); });

        // Test Connection
        $(document).on('click', '#btnTestConn', function () { testConn(); });

        // Type change (Excel vs DB)
        $(document).on('change', '#SelectType', function () {
            var idx = parseInt(this.value) || 0;
            if (idx === 2) {
                // DataBase
                $('#SelectFile').hide(); $('#DataBase').show();
                $('#btnUpdate').hide();  $('#Button1').show();
            } else {
                // Excel (or default)
                $('#SelectFile').show(); $('#DataBase').hide();
                $('#btnUpdate').show();  $('#Button1').hide();
            }
        });

        // Search — upload history grid
        $('#txtSearchHistory').on('input', function () {
            if (!dtHistory) return;
            dtHistory.search(this.value || '').draw();
        });

        // Sync global topbar search with history grid
        $('#globalSearch').on('input.impGlobal', function () {
            if (!dtHistory) return;
            var local = ($('#txtSearchHistory').val() || '');
            dtHistory.search(local || this.value || '').draw();
        });

        // ── Init ────────────────────────────────────────────────────────────
        fillYear();
        fillProviders();
        loadUploadHistory();

        // Start with SelectFile visible, DataBase hidden
        $('#SelectFile').show(); $('#DataBase').hide();
    });

})();
