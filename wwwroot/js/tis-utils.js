/**
 * tis-utils.js
 * Shared utility helpers – replaces jqxWidget helpers with
 * Bootstrap 5 + DataTables + SweetAlert2 equivalents.
 *
 * Target: ASP.NET Core 10, Bootstrap 5, DataTables 2, Font Awesome 6
 */

// ── Global loader ────────────────────────────────────────────
const TIS = window.TIS || {};
window.TIS = TIS;

/**
 * Show / hide a full-page loading overlay.
 * Uses a <div id="tis-loader"> that should exist in the master layout.
 */
TIS.showLoader = function () {
  let el = document.getElementById('tis-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tis-loader';
    el.innerHTML = '<div class="spinner-border" role="status"><span class="visually-hidden">Loading…</span></div>';
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
};

TIS.hideLoader = function () {
  const el = document.getElementById('tis-loader');
  if (el) el.style.display = 'none';
};

// Hook Ajax global events so loader shows automatically
$(document).ajaxStart(TIS.showLoader).ajaxStop(TIS.hideLoader);

// ── Ajax wrapper ─────────────────────────────────────────────
/**
 * Thin wrapper around $.ajax that adds default error handling.
 * Usage: TIS.ajax({ url, type, data, success, error })
 */
TIS.ajax = function (options) {
  const defaults = {
    type: 'GET',
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    error: function (xhr, status, err) {
      console.error('AJAX Error:', status, err, xhr.responseText);
      Swal.fire('Error', 'Request failed. Please try again or contact Admin.', 'error');
    }
  };
  return $.ajax($.extend(true, {}, defaults, options));
};

// ── DataTables factory ───────────────────────────────────────
/**
 * Create or refresh a DataTable on a table element.
 * @param {string|HTMLElement} selector – CSS selector or DOM element
 * @param {object} columns  – DataTables columns array
 * @param {Array}  data     – row data
 * @param {object} extra    – additional DataTables options (optional)
 * @returns DataTables API instance
 */
TIS.makeTable = function (selector, columns, data, extra) {
  const $el = $(selector);
  if ($.fn.DataTable.isDataTable(selector)) {
    $el.DataTable().destroy();
    $el.empty();
  }

  // Rebuild thead from column defs
  if (!$el.find('thead tr th').length) {
    const $thead = $('<thead><tr></tr></thead>');
    columns.forEach(function (col) {
      if (!col.visible && col.visible !== undefined) return; // skip hidden
      $thead.find('tr').append('<th>' + (col.title || col.data || '') + '</th>');
    });
    $el.prepend($thead);
    $el.append('<tbody></tbody>');
  }

  const opts = $.extend({
    data: data || [],
    columns: columns,
    responsive: true,
    pageLength: 10,
    lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
    language: {
      search: '<i class="fa fa-search me-1"></i>',
      searchPlaceholder: 'Search…',
      paginate: {
        first: '<i class="fa fa-angle-double-left"></i>',
        last:  '<i class="fa fa-angle-double-right"></i>',
        previous: '<i class="fa fa-angle-left"></i>',
        next: '<i class="fa fa-angle-right"></i>'
      }
    },
    dom: '<"d-flex flex-wrap align-items-center justify-content-between mb-2"lf>rt<"d-flex flex-wrap align-items-center justify-content-between"ip>'
  }, extra || {});

  return $el.addClass('tis-table table table-hover w-100').DataTable(opts);
};

// ── Notify helper (replaces jQuery.notify) ───────────────────
/**
 * Show an inline validation message near an element.
 * Creates a small Bootstrap tooltip-style message.
 */
TIS.notify = function ($el, message, position) {
  $el.addClass('is-invalid');
  let $fb = $el.next('.tis-notify');
  if (!$fb.length) {
    $fb = $('<div class="tis-notify invalid-feedback d-block"></div>');
    $el.after($fb);
  }
  $fb.text(message);
  setTimeout(function () {
    $el.removeClass('is-invalid');
    $fb.remove();
  }, 3500);
};

// Convenience: patch $.fn so old code calling .notify() still works
$.fn.notify = function (msg) {
  TIS.notify($(this), msg);
  return this;
};

// ── Alert shim (replaces $.alert.open) ──────────────────────
$.alert = {
  open: function (type, title, message, callback) {
    const iconMap = { info: 'info', error: 'error', confirm: 'question', warning: 'warning' };
    if (type === 'confirm') {
      Swal.fire({
        title: title,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
      }).then(function (r) {
        if (typeof callback === 'function') callback(r.isConfirmed ? 'yes' : 'no');
      });
    } else {
      Swal.fire({ title: title, text: message, icon: iconMap[type] || 'info' });
    }
  }
};

// ── Date helpers ─────────────────────────────────────────────
TIS.formatDateForInput = function (dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (isNaN(d)) return '';
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const dd = ('0' + d.getDate()).slice(-2);
  return d.getFullYear() + '-' + m + '-' + dd;
};

// ── Excel export (replaces saveMyFile) ───────────────────────
TIS.exportToExcel = function (dt, filename) {
  // dt = DataTables API instance
  // Uses DataTables Buttons extension
  if (dt && dt.button) {
    dt.button('.buttons-excel').trigger();
  }
};

/**
 * Fallback file-saver (FileSaver.js must be present)
 */
window.saveMyFile = function (ref, fname, text, mime) {
  const blob = new Blob([text], { type: mime || 'application/octet-stream' });
  saveAs(blob, fname);
  return false;
};

// ── Checkbox renderer helper for DataTables ──────────────────
TIS.boolRenderer = function (data) {
  return data
    ? '<i class="fa fa-check-circle text-success"></i>'
    : '<i class="fa fa-times-circle text-secondary"></i>';
};

// ── Row selection helper ─────────────────────────────────────
/**
 * Attach single-row click selection to a DataTable instance.
 * @param {DataTables.Api} dt
 * @param {Function} onSelect  – called with row data object
 */
TIS.onRowSelect = function (dt, onSelect) {
  $(dt.table().body()).on('click', 'tr', function () {
    if ($(this).hasClass('selected')) {
      $(this).removeClass('selected');
    } else {
      dt.$('tr.selected').removeClass('selected');
      $(this).addClass('selected');
      onSelect(dt.row(this).data());
    }
  });
};
