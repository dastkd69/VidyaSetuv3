/**
 * profile-badges.js
 * Renders the achievement badges grid from BADGES data.
 */

const ProfileBadges = (() => {

  function render() {
    const earnedCount = BADGES.filter(b => b.earned).length;
    document.getElementById('badgeCount').textContent = `${earnedCount} / ${BADGES.length} earned`;

    document.getElementById('badgesGrid').innerHTML = BADGES.map(badge => {
      const classes = ['badge', badge.earned ? 'earned' : 'locked'].join(' ');
      const iconHtml = Icons[badge.iconKey] || Icons.star;

      const newPip   = badge.earned && badge.isNew
        ? `<div class="badge-new-pip">New</div>` : '';
      const lockIcon = !badge.earned
        ? `<div class="badge-lock">${Icons.lockSm}</div>` : '';
      const ptsHtml  = badge.earned
        ? `<div class="badge-pts">${Icons.sparkle}${badge.pts}</div>`
        : `<div class="badge-pts">${Icons.lockSm} Locked</div>`;

      return `
        <div class="${classes}" title="${badge.desc}" aria-label="${badge.name}: ${badge.desc}">
          ${newPip}
          <div class="badge-icon">${iconHtml}</div>
          <div class="badge-name">${badge.name}</div>
          ${ptsHtml}
          ${lockIcon}
        </div>
      `;
    }).join('');
  }

  return { render };
})();
