/* home.js — Welcome / form page logic */

document.addEventListener('DOMContentLoaded', () => {

    // ── Tutorial steps for home page ──────────────────────────────────
    initTutorial([
        {
            title: 'Welcome to Mentora! 👋',
            description: 'This tutorial will guide you through the key features of Mentora. Let\'s explore how it can help you improve student performance.',
            target: null,
            position: 'center'
        },
        {
            // FIXED: changed position from 'bottom' to 'top' so the bubble
            // appears ABOVE the analysis form instead of below the viewport.
            title: 'Start a New Analysis',
            description: 'Fill in the student details and upload their test paper here. Mentora will analyse mistakes and provide personalised recommendations.',
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

// ── Start analysis → send to analysis page ───────────────────────────
function startAnalysis() {
    const studentName = document.getElementById('studentName').value.trim() || 'Student';
    const studentClass = document.getElementById('studentClass').value || '10';
    const subject = document.getElementById('subject').value || 'mathematics';
    const testType = document.getElementById('testType').value || 'class-test';
    const file = document.getElementById('fileInput').files[0];

    const ctx = { studentName, studentClass, subject, testType, fileName: file ? file.name : null };
    saveStudentContext(ctx);

    window.location.href = 'analysis.html';
}

function goToDemo() {
    saveStudentContext({ studentName: 'Priya Kumar', studentClass: '10', subject: 'mathematics', testType: 'class-test', fileName: 'Class_10_Mathematics_Test.pdf' });
    window.location.href = 'analysis.html';
}
