/**
 * login.js  – Refactored (Bootstrap 5, no jqxWidgets)
 * Logic preserved from original.
 */
$(document).ready(function () {

  // Submit on Enter key anywhere on the login page
  $('#loginpage').on('keypress', function (e) {
    if (e.which === 13) $('#btnLogin').trigger('click');
  });

  $('#btnLogin').on('click', function () {
    Login();
  });

  // Show / hide password toggle
  $('#chkShowPassword').on('click', function () {
    const $pwd = $('#txtPassword');
    if ($(this).is(':checked')) {
      const $txt = $('<input>', {
        id: 'txt_' + $pwd.attr('id'),
        type: 'text',
        class: $pwd.attr('class'),
        value: $pwd.val()
      });
      $pwd.after($txt).hide();
    } else {
      $pwd.val($pwd.next().val()).next().remove().end().show();
    }
  });
});

function Login() {
  const username = $('#txtUsername').val().trim();
  const password = $('#txtPassword').val().trim();

  if (!username) {
    TIS.notify($('#txtUsername'), 'Please Enter Username');
    return;
  }
  if (!password) {
    TIS.notify($('#txtPassword'), 'Please Enter Password');
    return;
  }

  const $btn = $('#btnLogin');
  $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>Logging in…');

  TIS.ajax({
    type: 'POST',
    url: '../../User/Login',
    data: JSON.stringify({ Login: { Username: username, Password: password } }),
    success: function () {
      window.location.href = '/User/Index';
    },
    error: function () {
      $btn.prop('disabled', false).html('<i class="fa fa-sign-in-alt me-1"></i>Login');
      Swal.fire('Login Failed', 'Invalid username or password.', 'error');
    }
  });
}
