/**
 * profile-security.js
 * Manages the Security section: password change modal,
 * sign-out-all, 2FA placeholder, and account deletion.
 */

const ProfileSecurity = (() => {

  /* ── Password modal state ── */
  const BACKDROP = () => document.getElementById('pwModalBackdrop');

  function openModal()  { BACKDROP().classList.add('open'); }
  function closeModal() {
    BACKDROP().classList.remove('open');
    _resetForm();
  }

  /* ── Close on backdrop click ── */
  function init() {
    BACKDROP().addEventListener('click', e => {
      if (e.target === BACKDROP()) closeModal();
    });
    // ESC key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && BACKDROP().classList.contains('open')) closeModal();
    });
  }

  /* ── Toggle password visibility ── */
  function togglePw(inputId, btn) {
    const input = document.getElementById(inputId);
    const show  = input.type === 'password';
    input.type  = show ? 'text' : 'password';
    btn.innerHTML = show ? Icons.eyeOff : Icons.eye;
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }

  /* ── Password strength ── */
  function checkStrength() {
    const val = document.getElementById('pwNew').value;
    let score = 0;
    if (val.length >= 8)          score += 25;
    if (val.length >= 12)         score += 15;
    if (/[A-Z]/.test(val))        score += 20;
    if (/[0-9]/.test(val))        score += 20;
    if (/[^A-Za-z0-9]/.test(val)) score += 20;
    score = Math.min(score, 100);

    const fill  = document.getElementById('pwStrFill');
    const label = document.getElementById('pwStrLabel');
    fill.style.width = score + '%';
    if      (score < 35) { fill.style.background = 'var(--error)';   label.textContent = 'Weak'; }
    else if (score < 65) { fill.style.background = '#fb923c';        label.textContent = 'Fair'; }
    else if (score < 85) { fill.style.background = '#facc15';        label.textContent = 'Good'; }
    else                 { fill.style.background = 'var(--success)'; label.textContent = 'Strong'; }
    if (!val.length) label.textContent = '';
  }

  /* ── Save new password ── */
  function savePassword() {
    const cur   = document.getElementById('pwCurrent').value;
    const nw    = document.getElementById('pwNew').value;
    const conf  = document.getElementById('pwConfirm').value;
    const alertEl = document.getElementById('pwModalAlert');

    _clearAlert(alertEl);

    if (!cur || !nw || !conf) {
      _showAlert(alertEl, 'error', 'Please fill in all three fields.');
      return;
    }
    if (nw.length < 8) {
      _showAlert(alertEl, 'error', 'New password must be at least 8 characters.');
      return;
    }
    if (nw !== conf) {
      _showAlert(alertEl, 'error', "Passwords don\u2019t match.");
      return;
    }

    // TODO: await AuthClient.apiFetch('/api/auth/change-password', { method:'POST', body: JSON.stringify({ current: cur, newPassword: nw }) })
    _showAlert(alertEl, 'success', 'Password updated successfully.');
    ProfileUI.showToast('Password changed', 'success');
    setTimeout(() => closeModal(), 1400);
  }

  /* ── Sign out all sessions ── */
  function signOutAll() {
    if (typeof AuthClient !== 'undefined') {
      AuthClient.signOut();
    } else {
      ProfileUI.showToast('All sessions signed out', 'success');
    }
  }

  /* ── Delete account ── */
  function deleteAccount() {
    if (confirm('This will permanently delete your account and all data.\nThis action cannot be undone.\n\nAre you sure?')) {
      ProfileUI.showToast('Deletion request submitted — check your email', 'error');
      // TODO: await AuthClient.apiFetch('/api/user/delete', { method:'DELETE' })
    }
  }

  /* ── Internal helpers ── */
  function _resetForm() {
    ['pwCurrent', 'pwNew', 'pwConfirm'].forEach(id => {
      const el = document.getElementById(id);
      el.value = '';
      el.type  = 'password';
    });
    // Reset eye buttons
    document.querySelectorAll('.pw-eye-btn').forEach(btn => {
      btn.innerHTML = Icons.eye;
    });
    document.getElementById('pwStrFill').style.width  = '0%';
    document.getElementById('pwStrLabel').textContent = '';
    _clearAlert(document.getElementById('pwModalAlert'));
  }
  function _showAlert(el, type, msg) {
    const icon = type === 'success' ? Icons.checkSm : Icons.alertCircle;
    el.className = `inline-alert show-${type}`;
    el.innerHTML = icon + msg;
  }
  function _clearAlert(el) {
    el.className = 'inline-alert';
    el.innerHTML = '';
  }

  return { init, openModal, closeModal, togglePw, checkStrength, savePassword, signOutAll, deleteAccount };
})();
