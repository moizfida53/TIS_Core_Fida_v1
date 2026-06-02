/* ============================================================================
   Config.js — Settings ▸ Configuration
   Loads tblConfiguration (ID=1) into the form and saves it back.
   Endpoints: GET /Setting/GetConfig -> { dtConfig }, POST /Setting/SaveConfig.
   ============================================================================ */
(function () {
    'use strict';

    function showLoader(t, s) {
        $('#loaderTitle').text(t || 'Loading…'); $('#loaderSub').text(s || 'Please wait…');
        $('#loaderDiv').addClass('show-loader'); $('body').addClass('loader-open');
    }
    function hideLoader() { $('#loaderDiv').removeClass('show-loader'); $('body').removeClass('loader-open'); }

    function loadConfig() {
        $.getJSON('/Setting/GetConfig', function (res) {
            var c = res.dtConfig || {};
            $('#txtEmpReminder').val(c.empReminder || '');
            $('#txtMgrReminder').val(c.mgrReminder || '');
            $('#txtFBReminder').val(c.fbReminder || '');
            $('#txtLMReminder').val(c.lmReminder || '');
            $('#txtSMTP').val(c.smtp || '');
            $('#txtAdminEmail').val(c.adminEmail || '');
            $('#txtHostUrl').val(c.hostUrl || '');
            $('#txtSupGrade').val(c.supGrade || '');

            $('#chkGrade').prop('checked', !!c.enableGrade);
            $('#chkEmail').prop('checked', !!c.dntSndEmail);
            $('#chkHidePerCalls').prop('checked', !!c.hidePerCalls);
            $('#chkGM').prop('checked', !!c.gmApp);
            $('#chkDiscrepancy').prop('checked', !!c.enableDiscrepancy);
            $('#chkSkipAppBusZero').prop('checked', !!c.skipAppBusZero);
            $('#chkDedBusCharges').prop('checked', !!c.dedBusCharges);
            $('#chkZeroUnlimited').prop('checked', !!c.zeroUnlimited);
            $('#chkAlwWav').prop('checked', !!c.alwWav);
            $('#chkDelete').prop('checked', !!c.enableDelete);
            $('#chkAlwTrainFB').prop('checked', !!c.alwTrainFb);
            $('#chkAllowance').prop('checked', !!c.hideAllowanceLimit);
            $('#chkPersonal').prop('checked', !!c.hidePersonalLimit);
        });
    }

    function saveConfig() {
        var payload = {
            empReminder: $('#txtEmpReminder').val().trim(),
            mgrReminder: $('#txtMgrReminder').val().trim(),
            fbReminder:  $('#txtFBReminder').val().trim(),
            lmReminder:  $('#txtLMReminder').val().trim(),
            smtp:        $('#txtSMTP').val().trim(),
            adminEmail:  $('#txtAdminEmail').val().trim(),
            hostUrl:     $('#txtHostUrl').val().trim(),
            supGrade:    $('#txtSupGrade').val().trim(),
            enableGrade:        $('#chkGrade').is(':checked'),
            dntSndEmail:        $('#chkEmail').is(':checked'),
            hidePerCalls:       $('#chkHidePerCalls').is(':checked'),
            gmApp:              $('#chkGM').is(':checked'),
            enableDiscrepancy:  $('#chkDiscrepancy').is(':checked'),
            skipAppBusZero:     $('#chkSkipAppBusZero').is(':checked'),
            dedBusCharges:      $('#chkDedBusCharges').is(':checked'),
            zeroUnlimited:      $('#chkZeroUnlimited').is(':checked'),
            alwWav:             $('#chkAlwWav').is(':checked'),
            enableDelete:       $('#chkDelete').is(':checked'),
            alwTrainFb:         $('#chkAlwTrainFB').is(':checked'),
            hideAllowanceLimit: $('#chkAllowance').is(':checked'),
            hidePersonalLimit:  $('#chkPersonal').is(':checked')
        };

        showLoader('Saving…', 'Please wait!');
        $.ajax({
            type: 'POST', url: '/Setting/SaveConfig',
            contentType: 'application/json; charset=utf-8', data: JSON.stringify(payload),
            success: function (res) {
                hideLoader();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: res.message || 'Saved', showConfirmButton: false, timer: 1800 });
            },
            error: function () { hideLoader(); Swal.fire({ icon: 'error', title: 'Error', text: 'Could not save configuration.' }); }
        });
    }

    $(document).ready(function () {
        $('#btnSave').on('click', saveConfig);
        loadConfig();
    });
})();
