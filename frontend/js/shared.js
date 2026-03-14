/* shared.js — Tutorial engine, sidebar, common helpers */

let tutorialActive = false;
let currentTutorialStep = 0;
let tutorialSteps = [];

function initTutorial(steps) {
    tutorialSteps = steps;
}

function startTutorial() {
    tutorialActive = true;
    currentTutorialStep = 0;
    showTutorialStep(0);
}

function showTutorialStep(stepIndex) {
    const step = tutorialSteps[stepIndex];
    const overlay = document.getElementById('tutorialOverlay');
    const tooltip = document.getElementById('tutorialTooltip');
    const arrow = tooltip.querySelector('.tutorial-arrow');

    if (step.action) step.action();

    document.getElementById('tutorialStepNumber').textContent =
        `Step ${stepIndex + 1} of ${tutorialSteps.length}`;
    document.getElementById('tutorialTitle').textContent = step.title;
    document.getElementById('tutorialDescription').textContent = step.description;

    const prevBtn = document.getElementById('tutorialPrevBtn');
    const nextBtn = document.getElementById('tutorialNextBtn');
    prevBtn.disabled = stepIndex === 0;
    nextBtn.textContent = stepIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next';

    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight', 'tutorial-pulse');
    });

    overlay.classList.add('active');

    if (step.target) {
        const target = document.querySelector(step.target);
        if (target) {
            target.classList.add('tutorial-highlight', 'tutorial-pulse');
            positionTooltip(tooltip, target, step.position, arrow);
        }
    } else {
        positionTooltipCenter(tooltip);
        arrow.style.display = 'none';
    }

    tooltip.classList.add('active');
}

function positionTooltip(tooltip, target, position, arrow) {
    const rect = target.getBoundingClientRect();
    const pad = 20;

    arrow.style.display = 'block';
    arrow.className = 'tutorial-arrow';

    let top, left;

    switch (position) {
        case 'right':
            top = rect.top + (rect.height / 2) - 100;
            left = rect.right + pad;
            arrow.classList.add('left');
            break;
        case 'left':
            top = rect.top + (rect.height / 2) - 100;
            left = rect.left - 420;
            arrow.classList.add('right');
            break;
        case 'top':
            top = rect.top - 220;
            left = rect.left + (rect.width / 2) - 200;
            arrow.classList.add('bottom');
            break;
        case 'bottom':
            top = rect.bottom + pad;
            left = rect.left + (rect.width / 2) - 200;
            arrow.classList.add('top');
            break;
    }

    tooltip.style.top = `${Math.max(20, top)}px`;
    tooltip.style.left = `${Math.max(20, Math.min(left, window.innerWidth - 420))}px`;
    tooltip.style.transform = 'none';
}

function positionTooltipCenter(tooltip) {
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
}

function nextTutorialStep() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        showTutorialStep(currentTutorialStep);
    } else {
        endTutorial();
    }
}

function prevTutorialStep() {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        showTutorialStep(currentTutorialStep);
    }
}

function endTutorial() {
    tutorialActive = false;
    document.getElementById('tutorialOverlay').classList.remove('active');
    document.getElementById('tutorialTooltip').classList.remove('active');
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight', 'tutorial-pulse');
    });
}

function restartTutorial() {
    endTutorial();
    setTimeout(() => startTutorial(), 300);
}

// Sidebar active chat switching
function switchChatItem(element, userName, targetPage) {
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    if (targetPage) window.location.href = targetPage + '?student=' + encodeURIComponent(userName);
}

// Store/restore student context via sessionStorage (safe to use outside artifacts)
function saveStudentContext(data) {
    sessionStorage.setItem('vidyasetu_student', JSON.stringify(data));
}

function loadStudentContext() {
    const raw = sessionStorage.getItem('vidyasetu_student');
    return raw ? JSON.parse(raw) : null;
}
