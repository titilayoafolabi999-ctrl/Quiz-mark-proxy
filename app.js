// ============================================================
// Mark Bible Tutor — GiftAxis Academy
// app.js — Client-side Application Logic (v8)
// ============================================================
'use strict';

// ── State ─────────────────────────────────────────────────────
let token            = '';
let currentUser      = '';
let selectedChapter  = 1;
let completedChapters = [];
let currentQuiz      = null;
let isLoggedIn       = false;
let chatPollInterval = null;
let lastChatTimestamp = 0;
let aiConversation   = [];  // { role, text }
let isAILoading      = false;
let activeStudyTab   = 'bible';

// ── DOM ───────────────────────────────────────────────────────
const authPanel      = document.getElementById('authPanel');
const studyPanel     = document.getElementById('studyPanel');
const userBadge      = document.getElementById('userBadge');
const currentUserEl  = document.getElementById('currentUserEl');
const avatarLetterEl = document.getElementById('avatarLetter');
const scoreEl        = document.getElementById('scoreEl');
const chapterGrid    = document.getElementById('chapterGrid');
const loadingState   = document.getElementById('loadingState');
const scriptureCard  = document.getElementById('scriptureCard');
const scriptureTitle = document.getElementById('scriptureTitle');
const scriptureBody  = document.getElementById('scriptureBody');
const quizCard       = document.getElementById('quizCard');
const quizBody       = quizCard ? quizCard.querySelector('.quiz-body') : null;
const markCompBtn    = document.getElementById('markCompBtn');
const progressText   = document.getElementById('progressText');
const progressFill   = document.getElementById('progressFill');
const toastEl        = document.getElementById('toast');
const themeModal     = document.getElementById('themeModal');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const aiMessages     = document.getElementById('aiMessages');
const aiInput        = document.getElementById('aiInput');
const aiSendBtn      = document.getElementById('aiSendBtn');
const chatMessages   = document.getElementById('chatMessages');
const chatInput      = document.getElementById('chatInput');
const chatSendBtn    = document.getElementById('chatSendBtn');

// ── Theme ─────────────────────────────────────────────────────
function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('giftaxis_theme', themeName);
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.theme === themeName);
  });
}

function loadSavedTheme() {
  const saved = localStorage.getItem('giftaxis_theme') || 'gold';
  applyTheme(saved);
}

function openThemeModal() {
  themeModal.classList.add('open');
}

function closeThemeModal() {
  themeModal.classList.remove('open');
}

themeToggleBtn.addEventListener('click', openThemeModal);

// Close theme modal when clicking overlay
themeModal.addEventListener('click', e => {
  if (e.target === themeModal) closeThemeModal();
});

// ── Auth Tab ──────────────────────────────────────────────────
let authMode = 'login';

function setAuthTab(mode) {
  authMode = mode;
  document.getElementById('loginTabBtn').classList.toggle('active', mode === 'login');
  document.getElementById('registerTabBtn').classList.toggle('active', mode === 'register');
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  clearAuthMsg();
  if (mode === 'login') {
    document.getElementById('usernameInput').focus();
  }
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

// ── Handle Auth Submit ─────────────────────────────────────────
async function handleAuth() {
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();

  if (!username || !password) {
    showAuthMsg('Please enter both username and password.');
    return;
  }

  const submitBtn = document.getElementById('authSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = authMode === 'login' ? 'Signing In…' : 'Creating Account…';
  clearAuthMsg();

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: authMode, username, password })
    });

    // Handle non-JSON or server errors
    if (!res.ok && res.status !== 409 && res.status !== 401 && res.status !== 400) {
      showAuthMsg('Server error. Please try again later.');
      return;
    }

    const data = await res.json();

    if (authMode === 'register') {
      if (data.error) {
        showAuthMsg(data.error);
        return;
      }
      // ✅ FIX: After successful registration, redirect to login tab
      showAuthMsg('✅ Account created! Please sign in below.', 'success');
      document.getElementById('passwordInput').value = '';
      // Auto-switch to login after 1.2 seconds
      setTimeout(() => {
        setAuthTab('login');
      }, 1200);
    } else {
      // Login
      if (!data.token) {
        showAuthMsg(data.error || 'Invalid credentials. Please try again.');
        return;
      }
      token = data.token;
      currentUser = username;
      await enterStudyMode();
    }
  } catch (e) {
    showAuthMsg('A network error occurred. Please check your connection.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
  }
}

// Allow Enter key to submit
document.getElementById('usernameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('passwordInput').focus();
});
document.getElementById('passwordInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleAuth();
});

// ── Enter / Leave Study Mode ───────────────────────────────────
async function enterStudyMode() {
  isLoggedIn = true;
  authPanel.style.display = 'none';
  studyPanel.style.display = 'block';
  userBadge.style.display = 'flex';
  themeToggleBtn.style.display = 'flex';
  currentUserEl.textContent = currentUser;
  avatarLetterEl.textContent = currentUser.charAt(0).toUpperCase();

  buildChapterGrid();
  await fetchScore();
  resetStudyTabs();
  startChatPolling();

  // Show theme modal on every login
  setTimeout(() => openThemeModal(), 400);
}

function logout() {
  if (!isLoggedIn) return;
  isLoggedIn = false;
  token = '';
  currentUser = '';
  selectedChapter = 1;
  completedChapters = [];
  currentQuiz = null;
  aiConversation = [];
  lastChatTimestamp = 0;

  stopChatPolling();

  authPanel.style.display = 'block';
  studyPanel.style.display = 'none';
  userBadge.style.display = 'none';
  themeToggleBtn.style.display = 'none';

  // Reset all UI
  scriptureCard.style.display = 'none';
  quizCard.innerHTML = `
    <div class="quiz-empty">
      <div class="quiz-empty-icon">🎯</div>
      <p>Load a Bible chapter from the <strong>Bible tab</strong> to generate a comprehension quiz.</p>
    </div>`;
  quizCard.style.display = 'block';
  markCompBtn.style.display = 'none';
  aiMessages.innerHTML = `<div class="ai-empty"><span class="ai-empty-icon">💬</span><p>Ask the AI tutor any question about the Gospel of Mark and get an informed response.</p></div>`;
  chatMessages.innerHTML = `<div class="chat-empty"><span class="chat-empty-icon">💬</span><p>No messages yet. Be the first to say something!</p></div>`;

  document.getElementById('usernameInput').value = '';
  document.getElementById('passwordInput').value = '';
  clearAuthMsg();
  setAuthTab('login');
  closeThemeModal();
}

document.getElementById('logoutBtn').addEventListener('click', logout);

// ── Auto-Logout on Tab/Window Leave ───────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isLoggedIn) {
    logout();
  }
});

let blurLogoutTimer = null;
window.addEventListener('blur', () => {
  if (!isLoggedIn) return;
  // Small grace period so accidental focus loss doesn't log out instantly
  blurLogoutTimer = setTimeout(() => {
    if (isLoggedIn) logout();
  }, 800);
});
window.addEventListener('focus', () => {
  clearTimeout(blurLogoutTimer);
});

// ── Study Tabs ────────────────────────────────────────────────
function resetStudyTabs() {
  switchStudyTab('bible');
}

function switchStudyTab(tabName) {
  activeStudyTab = tabName;
  document.querySelectorAll('.study-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabName}`);
  });
}

document.querySelectorAll('.study-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchStudyTab(btn.dataset.tab));
});

// ── Chapter Grid ──────────────────────────────────────────────
function buildChapterGrid() {
  chapterGrid.innerHTML = '';
  for (let i = 1; i <= 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'ch-btn' + (i === selectedChapter ? ' selected' : '');
    btn.textContent = i;
    btn.dataset.ch = String(i);
    btn.addEventListener('click', () => selectChapter(i));
    chapterGrid.appendChild(btn);
  }
}

function selectChapter(n) {
  selectedChapter = n;
  document.querySelectorAll('.ch-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.ch) === n);
  });
}

function updateChapterStates() {
  document.querySelectorAll('.ch-btn').forEach(btn => {
    btn.classList.toggle('completed', completedChapters.includes(btn.dataset.ch));
  });
}

// ── Score & Progress ──────────────────────────────────────────
async function fetchScore() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/score?username=${encodeURIComponent(currentUser)}`);
    if (!res.ok) throw new Error('Score fetch failed');
    const data = await res.json();
    scoreEl.textContent = data.score || 0;
    completedChapters = (data.completed || []).map(String);
    updateProgress();
    updateChapterStates();
  } catch (e) {
    console.warn('[fetchScore] Failed:', e.message);
  }
}

function updateProgress() {
  const count = completedChapters.length;
  const pct   = Math.round((count / 16) * 100);
  progressText.textContent = `${count} of 16 chapters completed`;
  progressFill.style.width = `${pct}%`;
}

async function markCompleted() {
  if (!currentUser) { showToast('Please sign in first.', 'error'); return; }
  const ch = String(selectedChapter);
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
    } else {
      throw new Error(data.error || 'Failed to mark chapter');
    }
  } catch (e) {
    showToast(e.message || 'Failed to update progress. Please try again.', 'error');
  }
}

// ── Load Chapter ───────────────────────────────────────────────
async function loadChapter() {
  const ch = selectedChapter;
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.disabled = true;
  loadingState.style.display = 'block';
  scriptureCard.style.display = 'none';
  markCompBtn.style.display = 'none';

  // Reset quiz tab to empty state while loading
  quizCard.innerHTML = `
    <div class="quiz-empty">
      <div class="quiz-empty-icon">⏳</div>
      <p>Generating quiz for Chapter ${ch}…</p>
    </div>`;

  try {
    // Fetch Bible text
    const bibleRes = await fetch(`https://bible-api.com/mark+${ch}?translation=kjv`);
    if (!bibleRes.ok) throw new Error('Unable to retrieve scripture. Please check your connection.');
    const bibleData = await bibleRes.json();

    const verses = bibleData.verses || [];
    if (verses.length === 0) throw new Error('No verses found for this chapter.');

    const verseText = verses
      .map(v => `[${v.verse}] ${v.text.trim()}`)
      .join(' ');

    // Display scripture on Bible tab
    scriptureTitle.textContent = `Mark — Chapter ${ch}`;
    scriptureBody.textContent = verseText;
    scriptureCard.style.display = 'block';

    // Switch to Bible tab to show the loaded scripture
    switchStudyTab('bible');

    // Generate quiz via AI
    const quizRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are a Bible study assistant. Based on the text of Mark Chapter ${ch}, generate exactly ONE multiple-choice comprehension question with 4 options.\n\nRespond using EXACTLY this format — no extra text before or after:\nquestion: [your question here]\noptions: A) [option] B) [option] C) [option] D) [option]\nanswer: [single letter A, B, C, or D]`,
        context: verseText.substring(0, 3000) // Limit context size
      })
    });

    if (!quizRes.ok) {
      const errData = await quizRes.json().catch(() => ({}));
      throw new Error(errData.error || `Quiz generation failed (${quizRes.status})`);
    }

    const quizData = await quizRes.json();
    if (quizData.reply) {
      displayQuiz(quizData.reply);
      markCompBtn.style.display = 'block';
      showToast('Chapter loaded! Check the Quiz tab 🎯', 'success');
    } else if (quizData.error) {
      throw new Error(quizData.error);
    } else {
      quizCard.innerHTML = `
        <div class="quiz-empty">
          <div class="quiz-empty-icon">⚠️</div>
          <p>Quiz could not be generated. The AI tutor may need an API key configured.</p>
        </div>`;
    }
  } catch (e) {
    showToast(e.message || 'An error occurred while loading the chapter.', 'error');
    quizCard.innerHTML = `
      <div class="quiz-empty">
        <div class="quiz-empty-icon">❌</div>
        <p>${e.message || 'Failed to load chapter. Please try again.'}</p>
      </div>`;
  } finally {
    loadingState.style.display = 'none';
    loadBtn.disabled = false;
  }
}

// ── Quiz Display ───────────────────────────────────────────────
function displayQuiz(rawText) {
  // Robust multi-line parsing
  const questionMatch = rawText.match(/question:\s*(.+?)(?:\n|options:|$)/i);
  const optionsMatch  = rawText.match(/options:\s*(.+?)(?:\n|answer:|$)/i);
  const answerMatch   = rawText.match(/answer:\s*([A-Da-d])/i);

  if (!questionMatch || !optionsMatch || !answerMatch) {
    quizCard.innerHTML = `
      <div class="quiz-empty">
        <div class="quiz-empty-icon">⚠️</div>
        <p>The AI returned an unexpected format. Please reload the chapter.</p>
      </div>`;
    return;
  }

  const question  = questionMatch[1].trim();
  const optionStr = optionsMatch[1].trim();
  const correct   = answerMatch[1].toUpperCase();

  // Parse options — handles "A) text B) text" and "A) text\nB) text"
  const optionParts = optionStr.split(/(?=[A-D]\))/i).filter(s => s.trim().length > 1);
  const options = {};
  optionParts.forEach(part => {
    const letter = part.charAt(0).toUpperCase();
    const text   = part.slice(2).trim();
    if (['A', 'B', 'C', 'D'].includes(letter) && text) {
      options[letter] = text;
    }
  });

  if (Object.keys(options).length < 2) {
    quizCard.innerHTML = `
      <div class="quiz-empty">
        <div class="quiz-empty-icon">⚠️</div>
        <p>Quiz options could not be parsed. Please reload the chapter.</p>
      </div>`;
    return;
  }

  currentQuiz = { question, options, correct };

  let html = `
    <div class="quiz-header">
      <div class="quiz-icon">🎯</div>
      <h3>Comprehension Quiz — Mark ${selectedChapter}</h3>
    </div>
    <div class="quiz-body">
      <p class="quiz-question-text">${escapeHTML(question)}</p>
      <ul class="options-list">`;

  for (const [letter, text] of Object.entries(options)) {
    html += `
      <li class="option-item">
        <input type="radio" name="quiz" id="opt${letter}" value="${letter}" />
        <label class="option-label" for="opt${letter}">
          <span class="option-badge">${letter}</span>
          <span class="option-text">${escapeHTML(text)}</span>
        </label>
      </li>`;
  }

  html += `</ul>
      <button class="btn-primary" onclick="submitAnswer()">Submit Answer</button>
      <div id="quizFeedback" class="quiz-feedback"></div>
    </div>`;

  quizCard.innerHTML = html;

  // Auto-switch to quiz tab so user knows quiz is ready
  setTimeout(() => switchStudyTab('quiz'), 600);
}

function submitAnswer() {
  const selected = document.querySelector('input[name="quiz"]:checked');
  if (!selected) { showToast('Please select an answer before submitting.', 'error'); return; }

  const userAnswer  = selected.value;
  const { correct, options } = currentQuiz;
  const feedbackDiv = document.getElementById('quizFeedback');
  if (!feedbackDiv) return;

  if (userAnswer === correct) {
    feedbackDiv.className = 'quiz-feedback correct';
    feedbackDiv.innerHTML = `✅ Correct! Well done.`;
  } else {
    feedbackDiv.className = 'quiz-feedback incorrect';
    feedbackDiv.innerHTML = `❌ Incorrect. The correct answer was <strong>${correct}) ${escapeHTML(options[correct])}</strong>.`;
  }
  feedbackDiv.style.display = 'block';

  // Disable all options after submission
  document.querySelectorAll('input[name="quiz"]').forEach(r => r.disabled = true);
}

// ── AI Tab ─────────────────────────────────────────────────────
aiInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(); }
});

async function askAI() {
  const question = aiInput.value.trim();
  if (!question || isAILoading) return;

  isAILoading = true;
  aiSendBtn.disabled = true;
  aiInput.value = '';

  // Remove empty state
  const emptyEl = aiMessages.querySelector('.ai-empty');
  if (emptyEl) emptyEl.remove();

  // Add user bubble
  appendAIBubble('user', question);

  // Add loading bubble
  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'ai-bubble loading';
  loadingBubble.innerHTML = `<div class="ai-dots"><span></span><span></span><span></span></div>`;
  aiMessages.appendChild(loadingBubble);
  scrollToBottom(aiMessages);

  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are a knowledgeable and friendly Bible study tutor specialising in the Gospel of Mark. Answer the following question clearly and helpfully:\n\n${question}`
      })
    });

    const data = await res.json();
    loadingBubble.remove();

    const reply = data.reply || data.error || 'No response received. Please try again.';
    appendAIBubble('bot', reply);
  } catch (e) {
    loadingBubble.remove();
    appendAIBubble('bot', 'A network error occurred. Please check your connection and try again.');
  } finally {
    isAILoading = false;
    aiSendBtn.disabled = false;
    aiInput.focus();
    scrollToBottom(aiMessages);
  }
}

function appendAIBubble(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `ai-bubble ${role}`;
  bubble.textContent = text;
  aiMessages.appendChild(bubble);
  scrollToBottom(aiMessages);
}

// ── Group Chat ─────────────────────────────────────────────────
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChatMessage();
});

async function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || !currentUser) return;
  if (message.length > 500) {
    showToast('Message too long (max 500 characters).', 'error');
    return;
  }

  chatInput.value = '';
  chatSendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, message })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to send message');
    }
    // Message will appear via polling
  } catch (e) {
    showToast(e.message || 'Failed to send message.', 'error');
    chatInput.value = message; // Restore on failure
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

async function pollChat() {
  if (!isLoggedIn || !currentUser) return;
  try {
    const res = await fetch(`/api/chat?since=${lastChatTimestamp}`);
    if (!res.ok) return;
    const data = await res.json();
    const messages = data.messages || [];
    if (messages.length > 0) {
      // Remove empty state if present
      const emptyEl = chatMessages.querySelector('.chat-empty');
      if (emptyEl) emptyEl.remove();

      messages.forEach(msg => renderChatMessage(msg));
      lastChatTimestamp = messages[messages.length - 1].timestamp;
      scrollToBottom(chatMessages);
    }
  } catch (e) {
    // Silent fail for polling
  }
}

function renderChatMessage(msg) {
  const isMine   = msg.username === currentUser;
  const isAdmin  = msg.username.toLowerCase() === 'admin';
  const initials = msg.username.charAt(0).toUpperCase();
  const timeStr  = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg${isMine ? ' mine' : ''}`;
  msgEl.innerHTML = `
    <div class="chat-avatar${isAdmin ? ' admin-avatar' : ''}">${initials}</div>
    <div class="chat-bubble-wrap">
      <span class="chat-username${isAdmin ? ' admin-name' : ''}">${escapeHTML(msg.username)}${isAdmin ? ' 👑' : ''}</span>
      <div class="chat-bubble">${escapeHTML(msg.message)}</div>
      <span class="chat-time">${timeStr}</span>
    </div>`;
  chatMessages.appendChild(msgEl);
}

function startChatPolling() {
  stopChatPolling();
  pollChat(); // Immediate first poll
  chatPollInterval = setInterval(pollChat, 3000);
}

function stopChatPolling() {
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

// ── Helpers ────────────────────────────────────────────────────
function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

let toastTimeout;
function showToast(message, type = 'success') {
  clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className = `toast ${type} show`;
  toastTimeout = setTimeout(() => { toastEl.className = 'toast'; }, 3200);
}

// ── Init ───────────────────────────────────────────────────────
(function init() {
  loadSavedTheme();
  buildChapterGrid();
})();
