/**
 * profile-icons.js
 * Central SVG icon registry. All UI symbols are inline SVGs — no emojis.
 * Use: Icons.flame  → SVG string ready to drop into innerHTML.
 */

const Icons = (() => {
  const icon = (body, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  return {
    // ── Stat cards ─────────────────────────────────────────────────
    flame:      icon('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    fileText:   icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    trendingUp: icon('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),
    medal:      icon('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>'),

    // ── Badge icons (22px) ─────────────────────────────────────────
    rocket:      icon('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>', 22),
    bookOpen:    icon('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', 22),
    zap:         icon('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', 22),
    target:      icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', 22),
    clock:       icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 22),
    trophy:      icon('<path d="M6 9H4a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h.5"/><path d="M18 9h2a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4h-.5"/><path d="M6 3h12v8a6 6 0 0 1-12 0z"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>', 22),
    star:        icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 22),
    lightbulb:   icon('<line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>', 22),

    // ── XP breakdown ──────────────────────────────────────────────
    checkCircle: icon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    leaf:        icon('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),

    // ── Section headers (16px) ─────────────────────────────────────
    user:     icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 16),
    shield:   icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', 16),
    award:    icon('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>', 16),
    barChart: icon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>', 16),
    starSm:   icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 16),

    // ── Navigation ─────────────────────────────────────────────────
    chevronLeft: icon('<polyline points="15 18 9 12 15 6"/>', 14),

    // ── Password / lock ────────────────────────────────────────────
    lock:    icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 16),
    lockSm:  icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 11),
    eye:     icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', 16),
    eyeOff:  icon('<line x1="1" y1="1" x2="23" y2="23"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a18.88 18.88 0 0 1-3.19 4.3"/><path d="M6.53 6.53A10 10 0 0 0 1 12s4 8 11 8a9.93 9.93 0 0 0 5.47-1.63"/><path d="M10.73 10.75A2 2 0 0 0 14 12.27"/>', 16),

    // ── Toast feedback ─────────────────────────────────────────────
    checkSm:      icon('<polyline points="20 6 9 17 4 12"/>', 16),
    alertCircle:  icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 16),

    // ── Trend arrows ───────────────────────────────────────────────
    arrowUp:   icon('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>', 10),
    arrowDown: icon('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>', 10),
    minus:     icon('<line x1="5" y1="12" x2="19" y2="12"/>', 10),

    // ── Rank chip sparkle ──────────────────────────────────────────
    sparkle: icon('<path d="M12 3l1.88 5.76a1 1 0 0 0 .95.68h6.06l-4.9 3.56a1 1 0 0 0-.36 1.12L17.5 20l-4.9-3.56a1 1 0 0 0-1.18 0L6.5 20l1.87-5.88a1 1 0 0 0-.36-1.12L3.11 9.44H9.17a1 1 0 0 0 .95-.68L12 3z"/>', 11),
  };
})();
