/**
 * profile-topics.js
 * Renders the topic performance list with animated progress bars.
 * Topics are displayed weakest-first (sorted ascending by score).
 */

const ProfileTopics = (() => {

  /* Map score to a CSS class and bar colour class */
  function scoreClass(score) {
    if (score < 50) return 'danger';
    if (score < 65) return 'warn';
    if (score < 80) return 'caution';
    return 'good';
  }

  /* Build the delta chip HTML */
  function deltaHtml(delta) {
    if (delta > 0) return `<span class="topic-delta up">${Icons.arrowUp}+${delta}%</span>`;
    if (delta < 0) return `<span class="topic-delta down">${Icons.arrowDown}${delta}%</span>`;
    return `<span class="topic-delta flat">${Icons.minus}No change</span>`;
  }

  function render() {
    const sorted = [...TOPICS].sort((a, b) => a.score - b.score);

    document.getElementById('topicsList').innerHTML = sorted.map(t => {
      const cls   = scoreClass(t.score);
      const delta = t.score - t.prev;

      return `
        <div class="topic-row">
          <div class="topic-row-top">
            <div class="topic-name-block">
              <div class="topic-name">${t.name}</div>
              <div class="topic-subject">${t.subject}</div>
            </div>
            <div class="topic-right">
              ${deltaHtml(delta)}
              <div class="topic-score ${cls}">${t.score}%</div>
            </div>
          </div>
          <div class="topic-bar-track">
            <div class="topic-bar-fill ${cls}" data-width="${t.score}" style="width:0%"></div>
          </div>
        </div>
      `;
    }).join('');

    /* Animate bars in on next paint cycle */
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.querySelectorAll('.topic-bar-fill').forEach(el => {
          el.style.width = el.dataset.width + '%';
        });
      }, 150);
    });
  }

  return { render };
})();
