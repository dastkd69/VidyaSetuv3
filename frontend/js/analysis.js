/* analysis.js — Per-card AI Tutor, TTS, and post-session thumbs feedback */

// ── S3 PDF mapping ───────────────────────────────────────────────────
const S3_BUCKET = 'https://mentora-textbooks.s3.amazonaws.com';
const CHAPTER_PDFS = {
    'Quadratic Equations':     `${S3_BUCKET}/ncert/class10/mathematics/chapter04-quadratic-equations.pdf`,
    'Arithmetic Progressions': `${S3_BUCKET}/ncert/class10/mathematics/chapter05-arithmetic-progressions.pdf`,
    'Triangle Similarity':     `${S3_BUCKET}/ncert/class10/mathematics/chapter06-triangles.pdf`,
};

// ── Per-card state ───────────────────────────────────────────────────
// cardStates[topic] = { history[], feedbackGiven, hadConversation }
const cardStates = {};

let activeCardTopic = null;
let ttsPlaying = false;

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const ctx = loadStudentContext() || { studentName: 'Priya Kumar', studentClass: '10', subject: 'mathematics' };

    document.getElementById('currentUser').textContent = ctx.studentName;
    document.getElementById('userAvatar').textContent  = ctx.studentName.charAt(0);

    renderAnalysis(ctx);

    initTutorial([
        {
            title:       'Analysis Results 📊',
            description: 'Vidyasetu has identified mistakes and mapped each one to specific NCERT chapters and page numbers.',
            target:      '.result-summary',
            position:    'bottom'
        },
        {
            title:       'Clickable Page Numbers',
            description: 'Click any highlighted page number to open the exact textbook PDF straight to the right page.',
            target:      '.page-link',
            position:    'top'
        },
        {
            title:       'Per-topic AI Tutor',
            description: 'Each topic card has its own "Consult AI Tutor" button — pre-loaded with that specific question and the correct answer.',
            target:      '.card-tutor-btn',
            position:    'top'
        }
    ]);

    document.getElementById('modalInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutorMessage(); }
    });

    document.getElementById('tutorModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeTutorModal();
    });
});

// ── Render full analysis ─────────────────────────────────────────────
function renderAnalysis(ctx) {
    const messages = document.getElementById('messages');
    const fileName  = ctx.fileName || `${ctx.subject || 'mathematics'}_test.pdf`;
    const initials  = (ctx.studentName || 'S').charAt(0);

    // Try to load real API results from sessionStorage
    let cards = [];
    let statsIssues = 0, statsTopics = 0, statsTime = '—';
    let isDemo = false;

    const raw = sessionStorage.getItem('vidyasetu_results');
    if (raw) {
        try {
            const stored = JSON.parse(raw);
            // Expose and log the raw stored results for debugging
            window.__VIDYASETU_RESULTS__ = stored;
            console.debug('VIDYASETU: stored results parsed', stored);
            const r = stored.results?.analyses?.[0]?.results;
            if (r && r.recommendations) {
                isDemo = false;
                statsIssues = r.total_wrong_answers ?? statsIssues;
                statsTopics  = r.total_recommendations ?? statsTopics;
                statsTime    = r.processing_time != null ? r.processing_time + 's' : statsTime;

                // Map API recommendations to card structure (if provided)
                if (Array.isArray(r.recommendations) && r.recommendations.length) {
                    cards = r.recommendations.map(rec => {

                        const meta =
                            rec.recommendations && rec.recommendations.length
                                ? rec.recommendations[0]
                                : {};

                        const pageRange = meta.page_range || "1";
                        const startPage = parseInt(String(pageRange).split("-")[0]);

                        return {
                            topic: rec.detected_topic || meta.topic || "Unknown Topic",

                            confidence: rec.topic_confidence
                                ? (rec.topic_confidence * 100).toFixed(1) + "%"
                                : "",

                            wrongAnswer: rec.wrong_answer_text || "",

                            correction: "",

                            book: meta.book_name || "NCERT",

                            classNum: meta.class_level || ctx.studentClass || "",

                            chapter: meta.chapters || "",

                            pages: meta.page_range || "",

                            startPage: startPage || 1,
                        };
                    });
                    // Keep cardStates in sync with real cards
                    cards.forEach(c => {
                        if (!cardStates[c.topic]) {
                            cardStates[c.topic] = { history: [], feedbackGiven: null, hadConversation: false };
                        }
                    });
                    statsIssues = r.total_wrong_answers ?? cards.length;
                    statsTopics = r.total_recommendations ?? cards.length;
                    statsTime = r.processing_time != null ? r.processing_time + 's' : statsTime;
                }
            }
        } catch (e) {
            console.warn('Could not parse stored results:', e);
        }
    }

    // Expose the active card set for openTutorModal
    ACTIVE_CARDS = cards;

    messages.innerHTML = `
        <div class="message user">
            <div class="message-header">
                <div class="message-avatar">${initials}</div>
                <div class="message-author">${ctx.studentName || 'Student'}</div>
            </div>
            <div class="message-content">
                <div class="file-attachment">
                    <span class="file-icon">📄</span>
                    <span>${fileName}${isDemo ? ' (demo)' : ''}</span>
                </div>
            </div>
        </div>
        
        <div class="analysis-debug-toggle" style="margin-top:10px;">
            <button id="toggleRawResultsBtn" style="font-size:13px;padding:6px 10px;border-radius:6px;border:1px solid var(--bg-elevated);background:var(--bg);cursor:pointer;">Show raw analysis JSON</button>
            <div id="analysisDebugPreWrap" style="display:none;margin-top:8px;max-height:220px;overflow:auto;border-radius:6px;border:1px solid var(--bg-elevated);background:var(--bg-elevated);padding:8px;">
                <pre id="analysisDebugPre" style="white-space:pre-wrap;font-size:12px;color:var(--text-muted);">(no data)</pre>
            </div>
        </div>

        <div class="message assistant">
            <div class="message-header">
                <div class="message-avatar">V</div>
                <div class="message-author">Vidyasetu</div>
            </div>
            <div class="message-content">
                <div class="result-summary">
                    <h3>✨ Analysis Complete</h3>
                    <div class="result-stats">
                        <div class="stat"><div class="stat-value">${statsIssues}</div><div class="stat-label">Issues Found</div></div>
                        <div class="stat"><div class="stat-value">${statsTopics}</div><div class="stat-label">Recommendations</div></div>
                        <div class="stat"><div class="stat-value">${statsTime}</div><div class="stat-label">Processing Time</div></div>
                    </div>
                </div>
                ${cards.length ? cards.map(c => buildCardHTML(c)).join('') : '<p style="color:var(--text-tertiary);font-size:14px;margin-top:12px">No specific recommendations were generated for this paper.</p>'}
            </div>
        </div>`;

    // Attach toggle behaviour to debug panel and populate with stored JSON
    try {
        const toggleBtn = document.getElementById('toggleRawResultsBtn');
        const preWrap = document.getElementById('analysisDebugPreWrap');
        const pre = document.getElementById('analysisDebugPre');
        if (toggleBtn && pre) {
            toggleBtn.addEventListener('click', () => {
                if (preWrap.style.display === 'none') {
                    preWrap.style.display = 'block';
                    toggleBtn.textContent = 'Hide raw analysis JSON';
                    try { pre.textContent = JSON.stringify(window.__VIDYASETU_RESULTS__ || {message:'no stored results'}, null, 2); } catch (e) { pre.textContent = String(window.__VIDYASETU_RESULTS__); }
                } else {
                    preWrap.style.display = 'none';
                    toggleBtn.textContent = 'Show raw analysis JSON';
                }
            });
        }
    } catch (e) {
        console.warn('Failed to initialize analysis debug UI:', e);
    }
}

// ── Build recommendation card ─────────────────────────────────────────
function buildCardHTML(card) {
    const pdfUrl      = CHAPTER_PDFS[card.topic] || '#';
    const pdfWithPage = `${pdfUrl}#page=${card.startPage}`;
    const slug        = slugify(card.topic);

    return `
        <div class="recommendation-card" id="card-${slug}">
            <div class="recommendation-header">
                <div class="recommendation-topic">${card.topic}</div>
                <div class="confidence-badge">${card.confidence}</div>
            </div>

            <div class="wrong-answer">❌ ${card.wrongAnswer}</div>

            <div class="recommendation-details">
                <div class="detail-row">
                    <span class="detail-label">Book:</span>
                    <span class="detail-value">${card.book}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Class:</span>
                    <span class="detail-value">${card.classNum}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Chapter:</span>
                    <span class="detail-value">${card.chapter}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Pages:</span>
                    <span class="detail-value page-link"
                          onclick="openTextbookPDF('${pdfWithPage}')"
                          title="Open textbook PDF in new tab">
                        ${card.pages}
                    </span>
                </div>
            </div>

            <div class="card-footer">
                <button class="card-tutor-btn" onclick="openTutorModal('${card.topic}')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Consult AI Tutor
                </button>
            </div>

            <div class="card-feedback" id="feedback-${slug}">
                <span class="feedback-question">Was this session helpful?</span>
                <div class="feedback-buttons">
                    <button class="feedback-btn thumbs-up"   onclick="submitFeedback('${card.topic}', 'up')">👍 Yes</button>
                    <button class="feedback-btn thumbs-down" onclick="submitFeedback('${card.topic}', 'down')">👎 No</button>
                </div>
            </div>
        </div>`;
}

function slugify(str) {
    if (!str) return 'unknown';
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// ── S3 PDF ───────────────────────────────────────────────────────────
function openTextbookPDF(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Active cards (set during renderAnalysis) ────────────
let ACTIVE_CARDS = [];

// ── Open modal for a specific topic ──────────────────────────────────
function openTutorModal(topic) {
    activeCardTopic = topic;

    let card = ACTIVE_CARDS.find(c => c.topic === topic);
    if (!card) card = { topic: topic || 'Unknown Topic', wrongAnswer: '', correction: '', book: 'NCERT', startPage: 1 };
    const state = cardStates[topic] || (cardStates[topic] = { history: [], feedbackGiven: null, hadConversation: false });
    const ctx   = loadStudentContext() || {};

    document.getElementById('modalTopicLabel').textContent = topic;

    // Rebuild chat body from state
    const body = document.getElementById('tutorBody');
    body.innerHTML = '';

    if (state.history.length === 0) {
        const opener = buildOpenerMessage(card, ctx);
        appendTutorBubble('assistant', opener);
        state.history.push({ role: 'assistant', content: stripHTML(opener) });
        state.hadConversation = true;
    } else {
        // Re-render existing conversation
        state.history.forEach(msg => appendTutorBubble(msg.role, escapeHTML(msg.content), false));
        body.scrollTop = body.scrollHeight;
    }

    stopTTS();
    document.getElementById('tutorModal').classList.add('active');
    document.getElementById('modalInput').focus();
}

function buildOpenerMessage(card, ctx) {
    const name = ctx.studentName || 'the student';
    return `Hi! Let's work through <strong>${card.topic}</strong> together.\n\n` +
           `<span class="opener-label">❌ What ${name} wrote:</span>\n<em>${escapeHTML(card.wrongAnswer)}</em>\n\n` +
           `<span class="opener-label">✅ Correct approach:</span>\n${escapeHTML(card.correction)}\n\n` +
           `Would you like me to walk through the full step-by-step solution, or do you have a specific question?`;
}

// ── Close modal → show feedback row ──────────────────────────────────
function closeTutorModal() {
    stopTTS();
    document.getElementById('tutorModal').classList.remove('active');

    if (activeCardTopic) {
        const state = cardStates[activeCardTopic];
        // Only show feedback if user actually conversed (more than opener)
        if (state.history.length > 1 && state.feedbackGiven === null) {
            const feedbackEl = document.getElementById(`feedback-${slugify(activeCardTopic)}`);
            if (feedbackEl) feedbackEl.classList.add('visible');
        }
        activeCardTopic = null;
    }
}

// ── Feedback ──────────────────────────────────────────────────────────
function submitFeedback(topic, vote) {
    cardStates[topic].feedbackGiven = vote;

    const slug       = slugify(topic);
    const feedbackEl = document.getElementById(`feedback-${slug}`);
    if (!feedbackEl) return;

    feedbackEl.innerHTML = vote === 'up'
        ? `<span class="feedback-confirmed positive">👍 Thanks! Glad that helped.</span>`
        : `<span class="feedback-confirmed negative">👎 Got it — we'll improve this explanation.</span>`;

    // Non-critical API log
    fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, vote, studentContext: loadStudentContext(), timestamp: new Date().toISOString() }),
    }).catch(() => {});
}

// ── Append bubble ─────────────────────────────────────────────────────
function appendTutorBubble(role, html, scroll = true) {
    const body     = document.getElementById('tutorBody');
    const ctx      = loadStudentContext() || {};
    const initials = role === 'assistant' ? 'M' : (ctx.studentName?.charAt(0) || 'U');

    const ttsBtn = role === 'assistant'
        ? `<button class="bubble-tts-btn" onclick="speakBubble(this)" title="Read aloud">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                   <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                   <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                   <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
               </svg>
           </button>`
        : '';

    const div = document.createElement('div');
    div.className = `tutor-message ${role}`;
    div.innerHTML = `
        <div class="tutor-avatar">${initials}</div>
        <div class="tutor-bubble-wrap">
            <div class="tutor-bubble">${html}</div>
            ${ttsBtn}
        </div>`;

    body.appendChild(div);
    if (scroll) body.scrollTop = body.scrollHeight;
}

// ── Typing indicator ─────────────────────────────────────────────────
function appendTypingIndicator() {
    const body = document.getElementById('tutorBody');
    const div  = document.createElement('div');
    div.id        = 'typingIndicator';
    div.className = 'tutor-message assistant';
    div.innerHTML = `
        <div class="tutor-avatar">V</div>
        <div class="tutor-bubble-wrap">
            <div class="tutor-bubble">
                <div class="typing-indicator"><span></span><span></span><span></span></div>
            </div>
        </div>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function removeTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
}

// ── Send message ──────────────────────────────────────────────────────
async function sendTutorMessage() {
    const input   = document.getElementById('modalInput');
    const sendBtn = document.getElementById('modalSendBtn');
    const text    = input.value.trim();
    if (!text || !activeCardTopic) return;

    const state = cardStates[activeCardTopic] || (cardStates[activeCardTopic] = { history: [], feedbackGiven: null, hadConversation: false });
    const card  = ACTIVE_CARDS.find(c => c.topic === activeCardTopic) || { topic: activeCardTopic || 'Unknown Topic', wrongAnswer: '', correction: '', book: 'NCERT', startPage: 1 };
    const ctx   = loadStudentContext() || {};

    input.value      = '';
    input.disabled   = true;
    sendBtn.disabled = true;

    appendTutorBubble('user', escapeHTML(text));
    state.history.push({ role: 'user', content: text });

    appendTypingIndicator();

    try {
        const systemPrompt =
            `You are Vidyasetu's AI Tutor helping ${ctx.studentName || 'a student'} ` +
            `in Class ${ctx.studentClass || '10'} with NCERT ${ctx.subject || 'Mathematics'}.\n\n` +
            `Current topic: "${activeCardTopic}".\n` +
            `Student's mistake: ${card?.wrongAnswer || ''}\n` +
            `Correct answer: ${card?.correction || ''}\n\n` +
            `Be warm, encouraging, and use numbered steps when solving. ` +
            `Keep each reply under 120 words. Plain text only — no markdown headers.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model:      'claude-sonnet-4-20250514',
                max_tokens: 350,
                system:     systemPrompt,
                messages:   state.history,
            }),
        });

        const data  = await response.json();
        const reply = data.content?.[0]?.text || "I'm having trouble responding right now. Please try again.";

        removeTypingIndicator();
        appendTutorBubble('assistant', escapeHTML(reply));
        state.history.push({ role: 'assistant', content: reply });

    } catch (err) {
        removeTypingIndicator();
        appendTutorBubble('assistant', "Sorry — I couldn't reach the AI service. Please check your connection.");
        console.error('AI Tutor API error:', err);
    } finally {
        input.disabled   = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// ── Text-to-Speech ────────────────────────────────────────────────────
function speakBubble(btn) {
    const bubble = btn.closest('.tutor-bubble-wrap')?.querySelector('.tutor-bubble');
    const text   = bubble?.innerText?.trim();
    if (!text) return;

    const isThisActive = btn.classList.contains('tts-active');

    // Stop any current speech
    stopTTS();
    if (isThisActive) return; // toggle off

    btn.classList.add('tts-active');

    const utt   = new SpeechSynthesisUtterance(text);
    utt.rate    = 0.93;
    utt.pitch   = 1;
    utt.lang    = 'en-IN';

    utt.onend = utt.onerror = () => {
        btn.classList.remove('tts-active');
        ttsPlaying = false;
    };

    ttsPlaying = true;
    window.speechSynthesis.speak(utt);
}

function stopTTS() {
    window.speechSynthesis?.cancel();
    ttsPlaying = false;
    document.querySelectorAll('.bubble-tts-btn.tts-active').forEach(b => b.classList.remove('tts-active'));
}

// ── Helpers ───────────────────────────────────────────────────────────
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

function stripHTML(str) {
    const tmp = document.createElement('div');
    tmp.innerHTML = str;
    return tmp.innerText;
}
