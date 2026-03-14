/**
 * profile-hero.js
 * Renders: XP hero rank block, animated counter, progress bar,
 *          quick-stat cards, and XP breakdown list.
 */

const ProfileHero = (() => {

  /* ── Ease function for counter animation ── */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* ── Animate a number counting up ── */
  function animateCounter(el, targetValue, durationMs) {
    const start = performance.now();
    function step(now) {
      const t   = Math.min((now - start) / durationMs, 1);
      const val = Math.round(targetValue * easeOutCubic(t));
      el.textContent = val.toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── Render the hero rank + XP section ── */
  function renderHero(student) {
    const xpToNext = student.levelXPEnd - student.totalXP;
    const pct = ((student.totalXP - student.levelXPStart) /
                 (student.levelXPEnd  - student.levelXPStart) * 100).toFixed(1);

    document.getElementById('heroRankTitle').textContent = student.levelTitle;
    document.getElementById('heroRankSub').textContent   =
      `Level ${student.level} · ${xpToNext.toLocaleString()} XP to ${student.nextTitle}`;
    document.getElementById('xpBarFrom').textContent = student.levelXPStart.toLocaleString() + ' XP';
    document.getElementById('xpBarTo').textContent   =
      `${student.levelXPEnd.toLocaleString()} XP (${student.nextTitle})`;

    // Animated XP counter
    const xpEl = document.getElementById('heroXPNumber');
    xpEl.textContent = '0';
    animateCounter(xpEl, student.totalXP, 1300);

    // Stat cards
    animateCounter(document.getElementById('statStreak'),    student.streak,          900);
    animateCounter(document.getElementById('statPapers'),    student.papersCount,     1000);
    animateCounter(document.getElementById('statImproved'),  student.topicsImproved,  1100);
    animateCounter(document.getElementById('statBadges'),
      BADGES.filter(b => b.earned).length, 800);

    // Animate XP bar after a brief delay so it's visible
    setTimeout(() => {
      document.getElementById('xpBarFill').style.width = pct + '%';
    }, 200);
  }

  /* ── Render XP breakdown list ── */
  function renderBreakdown() {
    const container = document.getElementById('xpBreakdown');
    container.innerHTML = XP_ROWS.map(row => `
      <div class="xp-row">
        <div class="xp-row-icon">${Icons[row.iconKey] || ''}</div>
        <div class="xp-row-info">
          <div class="xp-row-title">${row.title}</div>
          <div class="xp-row-desc">${row.desc}</div>
        </div>
        <div class="xp-row-pts">${row.pts}</div>
      </div>
    `).join('');
  }

  return { renderHero, renderBreakdown };
})();
