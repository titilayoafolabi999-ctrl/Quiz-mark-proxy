// ============================================================
// Mark Bible Tutor — GiftAxis Academy
// app.js — Client-side Application Logic (v7)
// ============================================================

'use strict';

// --- State ---
let token = '';
let currentUser = '';
let selectedChapter = 1;
let completedChapters = [];
let currentQuiz = null;
let aiDragging = false;

// --- DOM References ---
const authPanel = document.getElementById('authPanel');
const studyPanel = document.getElementById('studyPanel');
const userBadge = document.getElementById('userBadge');
const currentUserEl = document.getElementById('currentUser');
const avatarLetterEl = document.getElementById('avatarLetter');
const scoreEl = document.getElementById('score');
const chapterGrid = document.getElementById('chapterGrid');
const loadingState = document.getElementById('loadingState');
const scriptureCard = document.getElementById('scriptureCard');
const scriptureTitle = document.getElementById('scriptureTitle');
const scriptureBody = document.getElementById('scriptureBody');
const quizCard = document.getElementById('quizCard');
const quizBody = document.getElementById('quizBody');
const markCompBtn = document.getElementById('markCompBtn');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const toastEl = document.getElementById('toast');
const aiBtn = document.getElementById('aiBtn');
const aiModal = document.getElementById('aiModal');
const aiInput = document.getElementById('aiInput');
const aiResponse = document.getElementById('aiResponse');
const aiLoading = document.getElementById('aiLoading');

// --- Auth Tab State ---
let authMode = 'login';

function setAuthTab(mode) {
  authMode = mode;
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0 && mode === 'login') || (i === 1 && mode === 'register'));
  });
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  clearAuthMsg();
}

function clearAuthMsg() {
  const msg = document.getElementById('authMsg');
  msg.className = 'auth-msg';
  msg.textContent = '';
}

function showAuthMsg(text, type = 'error') {
  const msg = document.getElementById('authMsg');
  msg.className = `auth-msg ${type}`;
  msg.textContent = text;
}

async function handleAuth() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) {
    showAuthMsg('Please enter both username and password.');
    return;
  }
  clearAuthMsg();
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: authMode, username, password })
    });
    const data = await res.json();

    if (authMode === 'register') {
      if (data.error) { showAuthMsg(data.error); return; }
      showAuthMsg('Account created successfully. You may now sign in.', 'success');
      setAuthTab('login');
    } else {
      if (!data.token) { showAuthMsg('Invalid credentials. Please try again.'); return; }
      token = data.token;
      currentUser = username;
      await enterStudyMode();
    }
  } catch (e) {
    showAuthMsg('A network error occurred. Please try again.');
  }
}

async function enterStudyMode() {
  authPanel.style.display = 'none';
  studyPanel.style.display = 'block';
  userBadge.style.display = 'flex';
  currentUserEl.textContent = currentUser;
  avatarLetterEl.textContent = currentUser.charAt(0).toUpperCase();
  buildChapterGrid();
  await fetchScore();
}

function logout() {
  token = '';
  currentUser = '';
  selectedChapter = 1;
  completedChapters = [];
  currentQuiz = null;
  authPanel.style.display = 'block';
  studyPanel.style.display = 'none';
  userBadge.style.display = 'none';
  scriptureCard.style.display = 'none';
  quizCard.style.display = 'none';
  markCompBtn.style.display = 'none';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  clearAuthMsg();
}

document.getElementById('logoutBtn').addEventListener('click', logout);

// --- Chapter Grid ---
function buildChapterGrid() {
  chapterGrid.innerHTML = '';
  for (let i = 1; i <= 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'ch-btn' + (i === selectedChapter ? ' selected' : '');
    btn.textContent = i;
    btn.dataset.ch = i;
    btn.addEventListener('click', () => selectChapter(i));
    chapterGrid.appendChild(btn);
  }
}

function selectChapter(n) {
  selectedChapter = n;
  document.querySelectorAll('.ch-btn').forEach(btn => {
    const ch = parseInt(btn.dataset.ch);
    btn.classList.toggle('selected', ch === n);
  });
}

function updateChapterStates() {
  document.querySelectorAll('.ch-btn').forEach(btn => {
    const ch = parseInt(btn.dataset.ch).toString();
    btn.classList.toggle('completed', completedChapters.includes(ch));
  });
}

// --- Score & Progress ---
async function fetchScore() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/score?username=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    const pts = data.score || 0;
    scoreEl.textContent = pts;
    completedChapters = data.completed || [];
    updateProgress();
    updateChapterStates();
  } catch (e) {
    console.warn('Failed to retrieve score:', e);
  }
}

function updateProgress() {
  const count = completedChapters.length;
  const pct = Math.round((count / 16) * 100);
  progressText.textContent = `${count} of 16 chapters completed`;
  progressFill.style.width = `${pct}%`;
}

async function markCompleted() {
  if (!currentUser) { showToast('Please sign in first.', 'error'); return; }
  const ch = selectedChapter.toString();
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, chapter: ch })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast(`Chapter ${ch} marked as completed! ✓`, 'success');
      await fetchScore();
    }
  } catch (e) {
    showToast('Failed to update progress. Please try again.', 'error');
  }
}

// --- Load Chapter ---
async function loadChapter() {
  const ch = selectedChapter;
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.disabled = true;
  loadingState.style.display = 'block';
  scriptureCard.style.display = 'none';
  quizCard.style.display = 'none';
  markCompBtn.style.display = 'none';

  try {
    // Fetch Bible text
    const bibleRes = await fetch(`https://bible-api.com/mark+${ch}?translation=kjv`);
    if (!bibleRes.ok) throw new Error('Unable to retrieve scripture. Please check your connection.');
    const bibleData = await bibleRes.json();
    const verses = bibleData.verses || [];
    const verseText = verses.map(v => `[${v.verse}] ${v.text.trim()}`).join(' ');

    // Display scripture
    scriptureTitle.textContent = `Mark — Chapter ${ch}`;
    scriptureBody.textContent = verseText;
    scriptureCard.style.display = 'block';

    // Generate quiz via AI
    const quizRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are a Bible study assistant. Based on the text of Mark Chapter ${ch}, generate exactly ONE multiple-choice comprehension question. Respond using this exact format with no extra text:\nquestion: [your question]\noptions: A) [option] B) [option] C) [option] D) [option]\nanswer: [single letter A, B, C, or D]`,
        context: verseText
      })
    });
    const quizData = await quizRes.json();
    if (quizData.reply) {
      displayQuiz(quizData.reply);
      markCompBtn.style.display = 'block';
    } else {
      quizCard.style.display = 'none';
    }
  } catch (e) {
    showToast(e.message || 'An error occurred while loading the chapter.', 'error');
  } finally {
    loadingState.style.display = 'none';
    loadBtn.disabled = false;
  }
}

// --- Quiz Display & Submission ---
function displayQuiz(rawText) {
  const questionMatch = rawText.match(/question:\s*(.*?)(?=\n|options:|$)/i);
  const optionsMatch = rawText.match(/options:\s*(.*?)(?=\n|answer:|$)/i);
  const answerMatch = rawText.match(/answer:\s*([A-Da-d])/i);

  if (!questionMatch || !optionsMatch || !answerMatch) {
    // Graceful fallback — hide quiz silently
    quizCard.style.display = 'none';
    return;
  }

  const question = questionMatch[1].trim();
  const optionsRaw = optionsMatch[1].trim();
  const correct = answerMatch[1].toUpperCase();

  // Parse options with improved regex
  const optionParts = optionsRaw.split(/(?=[A-D]\))/i).filter(s => s.trim());
  const options = {};
  optionParts.forEach(part => {
    const letter = part.charAt(0).toUpperCase();
    const text = part.slice(2).trim();
    if (['A', 'B', 'C', 'D'].includes(letter)) options[letter] = text;
  });

  if (Object.keys(options).length < 4) {
    quizCard.style.display = 'none';
    return;
  }

  currentQuiz = { question, options, correct };

  let html = `<p class="quiz-question-text">${question}</p><ul class="options-list">`;
  for (const [letter, text] of Object.entries(options)) {
    html += `
      <li class="option-item">
        <input type="radio" name="quiz" id="opt${letter}" value="${letter}" />
        <label class="option-label" for="opt${letter}">
          <span class="option-badge">${letter}</span>
          <span class="option-text">${text}</span>
        </label>
      </li>`;
  }
  html += `</ul>
    <button class="btn-primary" onclick="submitAnswer()">Submit Answer</button>
    <div id="quizFeedback" class="quiz-feedback"></div>`;

  quizBody.innerHTML = html;
  quizCard.style.display = 'block';
}

function submitAnswer() {
  const selected = document.querySelector('input[name="quiz"]:checked');
  if (!selected) { showToast('Please select an answer before submitting.', 'error'); return; }
  const userAnswer = selected.value;
  const { correct, options } = currentQuiz;
  const feedbackDiv = document.getElementById('quizFeedback');

  if (userAnswer === correct) {
    feedbackDiv.className = 'quiz-feedback correct';
    feedbackDiv.innerHTML = `✅ Correct! Well done.`;
  } else {
    feedbackDiv.className = 'quiz-feedback incorrect';
    feedbackDiv.innerHTML = `❌ Incorrect. The correct answer was <strong>${correct}) ${options[correct]}</strong>.`;
  }
  feedbackDiv.style.display = 'block';

  // Disable all options after submission
  document.querySelectorAll('input[name="quiz"]').forEach(r => r.disabled = true);
}

// --- AI Assistant ---
aiBtn.addEventListener('click', () => {
  if (aiDragging) return;
  openAIModal();
});

function openAIModal() {
  aiModal.classList.add('open');
  aiInput.focus();
  aiResponse.style.display = 'none';
  aiLoading.style.display = 'none';
}

function closeAIModal() {
  aiModal.classList.remove('open');
}

aiModal.addEventListener('click', e => { if (e.target === aiModal) closeAIModal(); });

aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') askAI(); });

async function askAI() {
  const question = aiInput.value.trim();
  if (!question) return;
  aiLoading.style.display = 'block';
  aiResponse.style.display = 'none';

  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are a knowledgeable Bible study tutor specialising in the Gospel of Mark. Answer the following question clearly and concisely: ${question}`
      })
    });
    const data = await res.json();
    aiResponse.textContent = data.reply || 'No response received. Please try again.';
  } catch (e) {
    aiResponse.textContent = 'An error occurred while contacting the AI tutor. Please try again.';
  } finally {
    aiLoading.style.display = 'none';
    aiResponse.style.display = 'block';
  }
}

// --- Draggable AI Button ---
let dragStartX, dragStartY, btnInitLeft, btnInitTop;

function getDragPos(e) {
  return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                   : { x: e.clientX, y: e.clientY };
}

aiBtn.addEventListener('mousedown', startDrag);
aiBtn.addEventListener('touchstart', startDrag, { passive: false });

function startDrag(e) {
  e.preventDefault();
  aiDragging = false;
  const rect = aiBtn.getBoundingClientRect();
  const { x, y } = getDragPos(e);
  dragStartX = x;
  dragStartY = y;
  btnInitLeft = rect.left;
  btnInitTop = rect.top;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchend', stopDrag);
}

function onDrag(e) {
  e.preventDefault();
  const { x, y } = getDragPos(e);
  const dx = x - dragStartX;
  const dy = y - dragStartY;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) aiDragging = true;
  let newLeft = btnInitLeft + dx;
  let newTop = btnInitTop + dy;
  newLeft = Math.max(0, Math.min(window.innerWidth - aiBtn.offsetWidth, newLeft));
  newTop = Math.max(0, Math.min(window.innerHeight - aiBtn.offsetHeight - 60, newTop));
  aiBtn.style.left = newLeft + 'px';
  aiBtn.style.top = newTop + 'px';
  aiBtn.style.right = 'auto';
  aiBtn.style.bottom = 'auto';
}

function stopDrag() {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchend', stopDrag);
  // Reset flag after brief delay so click doesn't fire
  setTimeout(() => { aiDragging = false; }, 50);
}

// --- Toast Notification ---
let toastTimeout;
function showToast(message, type = 'success') {
  clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className = `toast ${type} show`;
  toastTimeout = setTimeout(() => { toastEl.className = 'toast'; }, 3200);
}

// --- Init ---
buildChapterGrid();
