/**
 * profile-details.js
 * Manages the Basic Details section: avatar display and
 * editable name / email / class / school form with validation.
 */

const ProfileDetails = (() => {

  /* ── Populate avatar and form fields from student data ── */
  function populate(student) {
    const initials = student.name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('');

    // Avatar
    document.getElementById('avatarCircle').textContent       = initials;
    document.getElementById('avatarDisplayName').textContent  = student.name;
    document.getElementById('avatarRankChip').innerHTML       =
      Icons.sparkle + ` ${student.levelTitle} L${student.level}`;
    document.getElementById('avatarEmail').textContent        = student.email;
    document.getElementById('avatarJoined').textContent       = 'Member since ' + student.memberSince;

    // Form
    document.getElementById('editName').value   = student.name;
    document.getElementById('editEmail').value  = student.email;
    document.getElementById('editClass').value  = student.classGrade;
    document.getElementById('editSchool').value = student.school;

    // Sidebar user info (shared.css elements)
    const sbName   = document.getElementById('currentUser');
    const sbAvatar = document.getElementById('userAvatar');
    if (sbName)   sbName.textContent   = student.name;
    if (sbAvatar) sbAvatar.textContent = initials;
  }

  /* ── Save handler ── */
  function save() {
    const name   = document.getElementById('editName').value.trim();
    const email  = document.getElementById('editEmail').value.trim();
    const cls    = document.getElementById('editClass').value.trim();
    const school = document.getElementById('editSchool').value.trim();
    const alertEl = document.getElementById('basicAlert');

    clearAlert(alertEl);

    if (!name || !email) {
      showAlert(alertEl, 'error', 'Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert(alertEl, 'error', 'Please enter a valid email address.');
      return;
    }

    // Commit to in-memory data
    STUDENT.name       = name;
    STUDENT.email      = email;
    STUDENT.classGrade = cls;
    STUDENT.school     = school;

    populate(STUDENT);
    showAlert(alertEl, 'success', 'Profile updated successfully.');
    ProfileUI.showToast('Profile saved', 'success');

    // TODO: await AuthClient.apiFetch('/api/user/profile', { method:'PATCH', body: JSON.stringify({ name, email, classGrade: cls, school }) })
  }

  /* ── Reset form to current saved values ── */
  function reset() {
    document.getElementById('editName').value   = STUDENT.name;
    document.getElementById('editEmail').value  = STUDENT.email;
    document.getElementById('editClass').value  = STUDENT.classGrade;
    document.getElementById('editSchool').value = STUDENT.school;
    clearAlert(document.getElementById('basicAlert'));
  }

  /* ── Alert helpers ── */
  function showAlert(el, type, msg) {
    const icon = type === 'success' ? Icons.checkSm : Icons.alertCircle;
    el.className  = `inline-alert show-${type}`;
    el.innerHTML  = icon + msg;
  }
  function clearAlert(el) {
    el.className = 'inline-alert';
    el.innerHTML = '';
  }

  return { populate, save, reset };
})();
