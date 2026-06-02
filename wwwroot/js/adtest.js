/* ============================================================================
   adtest.js — Active Directory Test page (/ADTest)
   Vanilla JS (the page uses Layout = null, so no jQuery is available).
   Posts form-encoded data to the ADTest endpoints and renders the results.
   ============================================================================ */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    function postForm(url, data) {
        var body = Object.keys(data || {})
            .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]); })
            .join('&');
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        }).then(function (r) { return r.json(); });
    }

    function setStatus(barId, msgId, ok, message) {
        var bar = $(barId);
        $(msgId).textContent = message || '';
        bar.classList.remove('success', 'fail');
        bar.classList.add(ok ? 'success' : 'fail', 'visible');
    }

    function spin(spinnerId, btnId, on) {
        $(spinnerId).classList.toggle('active', on);
        $(btnId).disabled = on;
    }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── 1. Test Connection ──────────────────────────────────────────────────
    function testConnection() {
        var btn = $('btn-test');
        spin('conn-spinner', 'btn-test', true);
        postForm(btn.getAttribute('data-url'), {})
            .then(function (res) {
                setStatus('conn-status', 'conn-msg', !!res.success, res.message);
            })
            .catch(function (err) {
                setStatus('conn-status', 'conn-msg', false, 'Request failed: ' + err);
            })
            .finally(function () { spin('conn-spinner', 'btn-test', false); });
    }

    // ── 2. Search User ──────────────────────────────────────────────────────
    function searchUser() {
        var btn = $('btn-search');
        var username = ($('username-input').value || '').trim();
        var box = $('result-box');
        if (!username) {
            box.innerHTML = '<div class="error-msg">Please enter a username.</div>';
            return;
        }
        spin('search-spinner', 'btn-search', true);
        box.innerHTML = '';
        postForm(btn.getAttribute('data-url'), { username: username })
            .then(function (res) {
                if (!res.success) {
                    box.innerHTML = '<div class="error-msg">' + esc(res.message || 'User not found.') + '</div>';
                    return;
                }
                var d = res.data || {};
                function row(label, val) {
                    return '<tr><td>' + label + '</td><td>' +
                        (val ? esc(val) : '<span class="no-data">— not set —</span>') + '</td></tr>';
                }
                box.innerHTML =
                    '<table class="result-table">' +
                        row('SAM Account',     d.samAccount) +
                        row('Employee Name',   d.displayName) +
                        row('Department',      d.department) +
                        row('Title',           d.title) +
                        row('Employee Number', d.employeeNumber) +
                        row('Email',           d.email) +
                        row('Mobile Number',   d.mobile) +
                    '</table>';
            })
            .catch(function (err) {
                box.innerHTML = '<div class="error-msg">Request failed: ' + esc(err) + '</div>';
            })
            .finally(function () { spin('search-spinner', 'btn-search', false); });
    }

    // ── 3. Update Mobile ────────────────────────────────────────────────────
    function updateMobile() {
        var btn = $('btn-update-mobile');
        var username = ($('mobile-username-input').value || '').trim();
        var mobile   = ($('mobile-number-input').value || '').trim();
        if (!username) { setStatus('mobile-status', 'mobile-msg', false, 'Please enter a username.'); return; }
        if (!mobile)   { setStatus('mobile-status', 'mobile-msg', false, 'Please enter a mobile number.'); return; }

        spin('update-spinner', 'btn-update-mobile', true);
        postForm(btn.getAttribute('data-url'), { username: username, mobileNumber: mobile })
            .then(function (res) {
                setStatus('mobile-status', 'mobile-msg', !!res.success, res.message);
            })
            .catch(function (err) {
                setStatus('mobile-status', 'mobile-msg', false, 'Request failed: ' + err);
            })
            .finally(function () { spin('update-spinner', 'btn-update-mobile', false); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        $('btn-test').addEventListener('click', testConnection);
        $('btn-search').addEventListener('click', searchUser);
        $('btn-update-mobile').addEventListener('click', updateMobile);

        // Enter-to-submit on the search box
        $('username-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') searchUser();
        });
    });
})();
