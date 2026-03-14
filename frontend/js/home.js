/* home.js — Welcome / form page logic */

const API_BASE = '/api';

// ── Chat list ─────────────────────────────────────────────────────────
async function loadChatList() {
    try {
        const res = await fetch(`${API_BASE}/chat/list`);
        if (!res.ok) return;
        const list = await res.json();
        renderChatHistory(list || []);
    } catch (err) {
        console.error('Failed to load chat list:', err);
    }
}

function renderChatHistory(chats) {
    const container = document.getElementById('chatHistory');
    if (!container) return;

    if (!chats.length) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;padding:8px 12px;">No previous analyses</div>';
        return;
    }

    container.innerHTML = chats.map(chat => `
        <div class="chat-item" data-chat-id="${chat.id}" style="display:flex;align-items:center;justify-content:space-between;">
            <div style="flex:1;min-width:0;" onclick="switchChatItem(this.parentElement, '${escapeAttr(chat.student_name)}', 'analysis.html')">
                <div class="chat-item-title">${escapeHTML(chat.student_name)}</div>
                <div class="chat-item-time">${chat.class_level ? 'Class ' + chat.class_level : ''}</div>
            </div>
            <button onclick="deleteChat('${chat.id}', event)" title="Delete"
                style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px 6px;font-size:14px;flex-shrink:0;">✕</button>
        </div>
    `).join('');
}

async function deleteChat(id, event) {
    event.stopPropagation();
    const res = await fetch(`${API_BASE}/chat/${id}`, { method: 'DELETE' });
    if (!res.ok) { console.error('Delete failed:', await res.text()); return; }
    const el = document.querySelector(`[data-chat-id="${id}"]`);
    if (el) el.remove();
}

function escapeHTML(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(str) {
    return String(str).replace(/'/g, "\\'");
}

document.addEventListener('DOMContentLoaded', () => {
    loadChatList();

    // ── Tutorial steps for home page ──────────────────────────────────
    initTutorial([
        {
            title: 'Welcome to Vidyasetu! 👋',
            description: 'This tutorial will guide you through the key features of Vidyasetu. Let\'s explore how it can help you improve student performance.',
            target: null,
            position: 'center'
        },
        {
            // FIXED: changed position from 'bottom' to 'top' so the bubble
            // appears ABOVE the analysis form instead of below the viewport.
            title: 'Start a New Analysis',
            description: 'Fill in the student details and upload their test paper here. Vidyasetu will analyse mistakes and provide personalised recommendations.',
            target: '.analysis-form',
            position: 'top'
        },
        {
            title: 'Chat History',
            description: 'Access all previous analyses here. Each item represents one student\'s test with their personalised learning path.',
            target: '.chat-history',
            position: 'right'
        },
        {
            title: 'Ready to Start!',
            description: 'Click "Start Analysis" to begin, or use "Skip to Demo" to jump straight to a sample result.',
            target: null,
            position: 'center'
        }
    ]);

    // ── File upload ───────────────────────────────────────────────────
    const uploadArea = document.getElementById('uploadArea');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
        uploadArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
    );

    ['dragenter', 'dragover'].forEach(evt =>
        uploadArea.addEventListener(evt, () => {
            uploadArea.style.borderColor = 'var(--accent-primary)';
            uploadArea.style.background = 'var(--accent-light)';
        })
    );

    ['dragleave', 'drop'].forEach(evt =>
        uploadArea.addEventListener(evt, () => {
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';
        })
    );

    uploadArea.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files.length) {
            document.getElementById('fileInput').files = files;
            handleFileSelect({ target: { files } });
        }
    });
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('uploadArea').classList.add('has-file');
    const fi = document.getElementById('fileInfo');
    fi.classList.add('active');
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
}

function removeFile(event) {
    event.stopPropagation();
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('fileInfo').classList.remove('active');
    document.getElementById('fileInput').value = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ── Start analysis → create chat, upload paper, then go to analysis page
async function startAnalysis() {
    const studentName = document.getElementById('studentName').value.trim() || 'Student';
    const studentClass = document.getElementById('studentClass').value || '10';
    const subject = document.getElementById('subject').value || 'mathematics';
    const testType = document.getElementById('testType').value || 'class-test';
    const file = document.getElementById('fileInput').files[0];

    const ctx = { studentName, studentClass, subject, testType, fileName: file ? file.name : null };
    saveStudentContext(ctx);

    const btn = document.querySelector('.start-analysis-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analysing…'; }

    try {
        // 1. Create (or reuse) a chat for this student
        const chatForm = new FormData();
        chatForm.append('student_name', studentName);
        const chatRes = await fetch(`${API_BASE}/chat/create`, { method: 'POST', body: chatForm });
        if (!chatRes.ok) throw new Error(await chatRes.text());
        const chat = await chatRes.json();

        // 2. Analyse the uploaded paper
        if (file) {
            const analyzeForm = new FormData();
            analyzeForm.append('chat_id', chat.id);
            analyzeForm.append('file', file);
            const analyzeRes = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: analyzeForm });
            if (!analyzeRes.ok) throw new Error(await analyzeRes.text());
            const results = await analyzeRes.json();

            if (results && results.error) throw new Error(results.error);

            // Store results for analysis.html to consume
            sessionStorage.setItem('vidyasetu_results', JSON.stringify({
                chatId: chat.id,
                file_name: file.name,
                results,
            }));
        }

        window.location.href = 'analysis.html';
    } catch (err) {
        console.error('Analysis failed:', err);
        alert('Analysis failed: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Start Analysis'; }
    }
}

function goToDemo() {
    saveStudentContext({ studentName: 'Priya Kumar', studentClass: '10', subject: 'mathematics', testType: 'class-test', fileName: 'Class_10_Mathematics_Test.pdf' });
    window.location.href = 'analysis.html';
}
