/**
 * profile-init.js
 * Entry point. Runs after the DOM is ready.
 * Calls each module's render/init in the right order.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Auth: merge real user data if logged in, but don't redirect in demo ── */
  if (typeof AuthClient !== 'undefined' && AuthClient.isAuthenticated()) {
    const auth = AuthClient.getAuth();
    if (auth?.user) {
      STUDENT.name  = auth.user.name  || STUDENT.name;
      STUDENT.email = auth.user.email || STUDENT.email;
    }
  }

  /* ── Render modules ── */
  ProfileHero.renderHero(STUDENT);
  ProfileHero.renderBreakdown();
  ProfileBadges.render();
  ProfileTopics.render();
  ProfileDetails.populate(STUDENT);
  ProfileSecurity.init();
});
