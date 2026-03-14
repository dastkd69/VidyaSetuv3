/**
 * profile-ui.js
 * Shared UI utilities used across all profile modules:
 * toast notifications, and any cross-cutting DOM helpers.
 */

const ProfileUI = (() => {

  let _toastTimer = null;

  /**
   * Show a toast notification.
   * @param {string} message  - The message to display.
   * @param {'success'|'error'} type
   */
  function showToast(message, type = 'success') {
    clearTimeout(_toastTimer);
    const toast = document.getElementById('toast');
    const icon  = type === 'success' ? Icons.checkSm : Icons.alertCircle;
    toast.className = `toast toast-${type} show`;
    toast.innerHTML = icon + message;
    _toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, 3200);
  }

  return { showToast };
})();
