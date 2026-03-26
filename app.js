// ============================================================
// Mark Bible Tutor — GiftAxis Academy — app.js v9
// ============================================================
'use strict';

// ── State ──────────────────────────────────────────────────────
let token            = '';
let currentUser      = '';
let isAdmin          = false;
let isLoggedIn       = false;
let selectedChapter  = 1;
let completedChapters = [];
let currentQuiz      = null;        // { questions[], currentIdx, answers{}, quizId, saved }
let sharedQuizId     = null;        // If opened via ?quiz= URL param
let activeTab        = 'bible';
let chatPollTimer    = null;
let typingPollTimer  = null;
let typingTimer      = null;
let pingTimer        = null;
let inactivityTimer  = null;
let sessionTimer     = null;
let sessionSeconds   = 0;
let lastChatTs       = 0;
let unreadCount      = 0;
let chatTabActive    = false;
let onlineUsers      = [];
let replyingTo       = null;        // { id, username, message }
let reactingMsgId    = null;
let mentionSearch    = '';
let bookmarks        = [];
let currentVerses    = [];
let aiLoading        = false;
const INACTIVITY_MS  = 20 * 60 * 1000;  // 20 minutes

const DAILY_VERSES = [
  { ref: 'Mark 1:17', text: '"Come, follow me," Jesus said, "and I will send you out to fish for people."' },
  { ref: 'Mark 2:17', text: 'It is not the healthy who need a doctor, but the sick. I have not come to call the righteous, but sinners.' },
  { ref: 'Mark 4:39', text: 'He got up, rebuked the wind and said to the waves, "Quiet! Be still!" Then the wind died down and it was completely calm.' },
  { ref: 'Mark 8:36', text: 'What good is it for someone to gain the whole world, yet forfeit their soul?' },
  { ref: 'Mark 10:45', text: 'For even the Son of Man did not come to be served, but to serve, and to give his life as a ransom for many.' },
  { ref: 'Mark 11:24', text: 'Therefore I tell you, whatever you ask for in prayer, believe that you have received it, and it will be yours.' },
  { ref: 'Mark 12:30', text: 'Love the Lord your God with all your heart and with all your soul and with all your mind and with all your strength.' },
];

const ACHIEVEMENTS = [
  { id: 'first',    icon: '🌱', name: 'First Step',     desc: 'Complete 1 chapter',  check: s => s.completed >= 1 },
  { id: 'five',     icon: '⭐', name: 'Rising Star',    desc: 'Complete 5 chapters', check: s => s.completed >= 5 },
  { id: 'ten',      icon: '🔥', name: 'On Fire',        desc: 'Complete 10 chapters',check: s => s.completed >= 10 },
  { id: 'all',      icon: '👑', name: 'King\'s Scholar', desc: 'All 16 chapters',    check: s => s.completed >= 16 },
  { id: 'quiz1',    icon: '🎯', name: 'Quiz Taker',     desc: 'Complete your first quiz', check: s => s.quizzes >= 1 },
  { id: 'quiz5',    icon: '🏆', name: 'Quiz Champion',  desc: '5 quizzes completed', check: s => s.quizzes >= 5 },
  { id: 'chat1',    icon: '💬', name: 'Sociable',       desc: 'Send your first chat message', check: s => s.chatSent >= 1 },
  { id: 'streak3',  icon: '📅', name: 'Consistent',     desc: '3-day study streak',  check: s => s.streak >= 3 },
  { id: 'bookmark1',icon: '🔖', name: 'Bookworm',       desc: 'Bookmark your first verse', check: s => s.bookmarks >= 1 },
];

// ── DOM ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const authPanel    = $('authPanel');
const studyPanel   = $('studyPanel');
const userBadge    = $('userBadge');
const currentUserEl= $('currentUserEl');
const avatarLetter = $('avatarLetter');
const scoreEl      = $('scoreEl');
const chapterGrid  = $('chapterGrid');
const loadingState = $('loadingState');
const scriptureCard= $('scriptureCard');
const scriptureTitle=$('scriptureTitle');
const scriptureBody= $('scriptureBody');
const markCompBtn  = $('markCompBtn');
const progressText = $('progressText');
const progressFill = $('progressFill');
const progressBarEl= $('progressBarEl');
const toastEl      = $('toast');
const themeModal   = $('themeModal');
const aiMessages   = $('aiMessages');
const aiInput      = $('aiInput');
const aiSendBtn    = $('aiSendBtn');
const chatMessages = $('chatMessages');
const chatInput    = $('chatInput');
const unreadBadge  = $('unreadBadge');
const typingBar    = $('typingBar');
const replyPreview = $('replyPreview');
const mentionPopup = $('mentionPopup');
const reactPicker  = $('reactPicker');
const streakChip   = $('streakChip');
const streakCount  = $('streakCount');
const onlineCountEl= $('onlineCountEl');
const timerChip    = $('timerChip');

// ── Theme ────────────────────────────────────────────────────────
function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('ga_theme', name);
  document.querySelectorAll('.th-opt').forEach(el => {
    const on = el.dataset.theme === name;
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', on);
  });
}
function loadTheme() { applyTheme(localStorage.getItem('ga_theme') || 'gold'); }
$('themeBtn').addEventListener('click', () => themeModal.classList.add('open'));
themeModal.addEventListener('click', e => { if (e.target === themeModal) closeThemeModal(); });
function closeThemeModal() { themeModal.classList.remove('open'); }

// ── Auth Tabs ────────────────────────────────────────────────────
let authMode = 'login';
function setAuthTab(mode) {
  authMode = mode;
  $('loginTabBtn').classList.toggle('on', mode === 'login');
  $('loginTabBtn').setAttribute('aria-selected', mode === 'login');
  $('registerTabBtn').classList.toggle('on', mode === 'register');
  $('registerTabBtn').setAttribute('aria-selected', mode === 'register');
  $('authSubmitBtn').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  clearAuthMsg();
}
function clearAuthMsg() { const m = $('authMsg'); m.className = 'amsg'; m.textContent = ''; }
function showAuthMsg(txt, type = 'err') { const m = $('authMsg'); m.className = `amsg ${type}`; m.textContent = txt; }

// ── Handle Auth ──────────────────────────────────────────────────
async function handleAuth() {
  const username = $('usernameInput').value.trim();
  const password = $('passwordInput').value.trim();
  if (!username || !password) { showAuthMsg('Enter both username and password.'); return; }
  const btn = $('authSubmitBtn');
  btn.disabled = true; btn.textContent = authMode === 'login' ? 'Signing in…' : 'Creating…';
  clearAuthMsg();
  try {
    const res  = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:authMode, username, password }) });
    const data = await res.json();
    if (authMode === 'register') {
      if (data.error) { showAuthMsg(data.error); return; }
      showAuthMsg('✅ Account created! Signing you in…', 'ok');
      setTimeout(() => {
        $('passwordInput').value = '';
        setAuthTab('login');
        clearAuthMsg();
      }, 1500);
    } else {
      if (!data.token) { showAuthMsg(data.error || 'Invalid credentials.'); return; }
      token = data.token; currentUser = data.username; isAdmin = !!data.isAdmin;
      await enterStudyMode();
    }
  } catch { showAuthMsg('Network error. Check your connection.'); }
  finally { btn.disabled = false; btn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account'; }
}
$('usernameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('passwordInput').focus(); });
$('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') handleAuth(); });

// ── Enter Study Mode ─────────────────────────────────────────────
async function enterStudyMode() {
  isLoggedIn = true;
  authPanel.style.display = 'none';
  studyPanel.style.display = 'block';
  userBadge.style.display  = 'flex';
  currentUserEl.textContent = currentUser;
  avatarLetter.textContent  = currentUser.charAt(0).toUpperCase();
  buildChapterGrid();
  showDailyVerse();
  await fetchScore();
  await fetchBookmarks();
  loadQuizHistory();
  startSessionTimer();
  startChatPolling();
  startPing();
  resetInactivityTimer();
  requestNotificationPermission();
  // Check URL param for shared quiz
  const params = new URLSearchParams(location.search);
  if (params.has('quiz')) { sharedQuizId = params.get('quiz'); switchTab('quiz'); await loadSharedQuiz(sharedQuizId); }
  else { switchTab('bible'); }
  setTimeout(() => themeModal.classList.add('open'), 500);
}

// ── Logout ───────────────────────────────────────────────────────
function logout() {
  if (!isLoggedIn) return;
  isLoggedIn = false; token = ''; currentUser = ''; isAdmin = false;
  selectedChapter = 1; completedChapters = []; currentQuiz = null;
  bookmarks = []; replyingTo = null; lastChatTs = 0; unreadCount = 0;
  sessionSeconds = 0; chatTabActive = false;
  [chatPollTimer, typingPollTimer, pingTimer, sessionTimer].forEach(t => clearInterval(t));
  clearTimeout(typingTimer); clearTimeout(inactivityTimer);
  authPanel.style.display = 'block';
  studyPanel.style.display = 'none';
  userBadge.style.display  = 'none';
  streakChip.style.display = 'none';
  $('usernameInput').value = ''; $('passwordInput').value = '';
  clearAuthMsg(); setAuthTab('login'); closeThemeModal();
  chatMessages.innerHTML = `<div class="chat-empty"><span style="font-size:36px">💬</span><p>No messages yet. Say hello!</p></div>`;
  aiMessages.innerHTML   = `<div class="ai-empty"><span style="font-size:36px">💬</span><p>Ask anything about the Gospel of Mark.</p></div>`;
  $('quizContainer').innerHTML = '';
  scriptureCard.style.display = 'none'; markCompBtn.style.display = 'none';
  unreadBadge.style.display = 'none'; unreadCount = 0;
  reactPicker.classList.remove('show');
  // Clear URL param
  const url = new URL(location.href); url.searchParams.delete('quiz'); history.replaceState({}, '', url);
}
$('logoutBtn').addEventListener('click', logout);

// ── Auto-logout: 20 minutes inactivity (blur/hidden) ─────────────
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  if (isLoggedIn) inactivityTimer = setTimeout(() => { if (isLoggedIn) { showToast('Session timed out after 20 minutes.', 'err'); logout(); } }, INACTIVITY_MS);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && isLoggedIn) resetInactivityTimer(); else resetInactivityTimer(); });
window.addEventListener('blur', () => { if (isLoggedIn) resetInactivityTimer(); });
window.addEventListener('focus', () => { if (isLoggedIn) resetInactivityTimer(); });
['click','keydown','touchstart'].forEach(ev => document.addEventListener(ev, () => { if (isLoggedIn) resetInactivityTimer(); }, { passive:true }));

// ── Study Tabs ───────────────────────────────────────────────────
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.snbtn').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on);
  });
  document.querySelectorAll('.tcont').forEach(el => el.classList.toggle('on', el.id === `tab-${name}`));
  if (name === 'chat') { chatTabActive = true; markChatRead(); }
  else chatTabActive = false;
  if (name === 'more') { loadLeaderboard(); renderAchievements(); renderAllBookmarks(); }
}
document.querySelectorAll('.snbtn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// ── Session Timer ────────────────────────────────────────────────
function startSessionTimer() {
  sessionSeconds = 0;
  clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    sessionSeconds++;
    const m = Math.floor(sessionSeconds / 60), s = sessionSeconds % 60;
    timerChip.textContent = `Session: ${m}:${String(s).padStart(2,'0')}`;
  }, 1000);
}

// ── Daily Verse ──────────────────────────────────────────────────
function showDailyVerse() {
  const dv = DAILY_VERSES[new Date().getDay() % DAILY_VERSES.length];
  $('dvText').textContent = dv.text;
  $('dvRef').textContent  = `— ${dv.ref}`;
}

// ── Ping (online presence) ───────────────────────────────────────
function startPing() {
  clearInterval(pingTimer);
  const doPing = async () => {
    try {
      const r = await fetch('/api/ping', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:currentUser }) });
      const d = await r.json();
      onlineUsers = d.online || [];
      onlineCountEl.textContent = `${onlineUsers.length} online`;
    } catch {}
  };
  doPing();
  pingTimer = setInterval(doPing, 20000);
}

// ── Chapter Grid ─────────────────────────────────────────────────
function buildChapterGrid() {
  chapterGrid.innerHTML = '';
  for (let i = 1; i <= 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'chbtn' + (i === selectedChapter ? ' sel' : '');
    btn.textContent = i; btn.dataset.ch = i;
    btn.setAttribute('aria-label', `Chapter ${i}${completedChapters.includes(String(i)) ? ' (completed)':''}`);
    btn.addEventListener('click', () => selectChapter(i));
    chapterGrid.appendChild(btn);
  }
}
function selectChapter(n) {
  selectedChapter = n;
  document.querySelectorAll('.chbtn').forEach(b => b.classList.toggle('sel', parseInt(b.dataset.ch) === n));
}
function updateChapterStates() {
  document.querySelectorAll('.chbtn').forEach(b => {
    const done = completedChapters.includes(b.dataset.ch);
    b.classList.toggle('done', done);
    b.setAttribute('aria-label', `Chapter ${b.dataset.ch}${done ? ' (completed)':''}`);
  });
}

// ── Score ────────────────────────────────────────────────────────
async function fetchScore() {
  try {
    const r = await fetch(`/api/score?username=${encodeURIComponent(currentUser)}`);
    const d = await r.json();
    scoreEl.textContent = d.score || 0;
    completedChapters   = (d.completed || []).map(String);
    updateProgress(); updateChapterStates();
  } catch {}
}
function updateProgress() {
  const c = completedChapters.length, pct = Math.round((c/16)*100);
  progressText.textContent = `${c} of 16 chapters completed`;
  progressFill.style.width = `${pct}%`;
  progressBarEl.setAttribute('aria-valuenow', pct);
}
async function markCompleted() {
  if (!currentUser) { showToast('Sign in first.','err'); return; }
  try {
    const r = await fetch('/api/score', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:currentUser, chapter:String(selectedChapter) }) });
    const d = await r.json();
    if (d.status === 'ok') { showToast(`Chapter ${selectedChapter} completed! ✓`,'ok'); await fetchScore(); loadStreakInfo(); renderAchievements(); }
    else throw new Error(d.error);
  } catch (e) { showToast(e.message||'Failed to update.','err'); }
}

// ── Streak ───────────────────────────────────────────────────────
async function loadStreakInfo() {
  try {
    const r = await fetch(`/api/streak/${encodeURIComponent(currentUser)}`);
    const d = await r.json();
    if (d.current > 0) {
      streakChip.style.display = 'flex';
      streakCount.textContent  = `${d.current}d`;
    }
  } catch {}
}

// ── Load Chapter (Bible + 30-question quiz) ───────────────────────
async function loadChapter() {
  const ch = selectedChapter;
  $('loadBtn').disabled = true;
  loadingState.style.display = 'block';
  scriptureCard.style.display = 'none';
  markCompBtn.style.display = 'none';
  $('bibleSearchBar').style.display = 'none';
  $('notesSection').style.display = 'none';
  $('quizContainer').innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:13px">⏳ Generating 30-question quiz for Chapter ${ch}…</div>`;

  try {
    // 1. Fetch Bible text
    const br = await fetch(`https://bible-api.com/mark+${ch}?translation=kjv`);
    if (!br.ok) throw new Error('Could not retrieve scripture. Check your connection.');
    const bd = await br.json();
    const verses = bd.verses || [];
    if (!verses.length) throw new Error('No verses found.');
    currentVerses = verses;

    // 2. Render scripture (each verse on its own line, accessible)
    scriptureTitle.textContent = `Mark — Chapter ${ch}`;
    renderVerses(verses);
    scriptureCard.style.display = 'block';
    $('bibleSearchBar').style.display = 'flex';
    $('notesSection').style.display = 'block';
    await loadNote(ch);
    switchTab('bible');

    // 3. Generate 30 questions via Gemini
    const seed = Date.now();
    const verseCtx = verses.map(v => `[${v.verse}] ${v.text.trim()}`).join(' ').substring(0, 4000);
    const prompt = `You are a Bible quiz generator Created by Gift Axis Labs. Using the text of Mark Chapter ${ch} below, generate exactly 30 unique multiple-choice questions. Vary difficulty: easy, medium, and hard. Use seed ${seed} to ensure variety each time this is called.

Return ONLY valid JSON — no markdown, no backticks, no extra text:
{"questions":[{"q":"Question text","opts":{"A":"Option","B":"Option","C":"Option","D":"Option"},"ans":"A"},... x30]}`;

    const qr = await fetch('/api/gemini', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ prompt, context: verseCtx, mode:'quiz' }) });
    const qd = await qr.json();
    if (qd.error) throw new Error(qd.error);

    const questions = parseQuizJSON(qd.reply);
    if (questions.length < 5) throw new Error('AI returned too few questions. Try reloading.');

    // 4. Save quiz to server
    const sr = await fetch('/api/quiz/save', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:currentUser, chapter:ch, questions }) });
    const sd = await sr.json();
    const quizId = sd.quizId || null;

    // 5. Init quiz state
    currentQuiz = { questions, currentIdx:0, answers:{}, quizId, ch, saved:!!quizId, completed:false };
    renderQuizQuestion();
    markCompBtn.style.display = 'block';
    showToast(`Chapter ${ch} loaded! 30-question quiz ready 🎯`,'ok');
    loadQuizHistory();
  } catch (e) {
    showToast(e.message || 'Error loading chapter.','err');
    $('quizContainer').innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--err);font-size:13px">❌ ${escH(e.message||'Failed. Please try again.')}</div>`;
  } finally {
    loadingState.style.display = 'none';
    $('loadBtn').disabled = false;
  }
}

// ── Parse Quiz JSON ───────────────────────────────────────────────
function parseQuizJSON(raw) {
  let clean = raw.replace(/```json\n?/gi,'').replace(/```\n?/gi,'').trim();
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('Could not parse quiz JSON.');
  clean = clean.slice(s, e+1);
  const parsed = JSON.parse(clean);
  const qs = parsed.questions || parsed.quiz || parsed;
  if (!Array.isArray(qs)) throw new Error('Invalid quiz format.');
  return qs.map(q => ({
    q: String(q.q || q.question || '').trim(),
    opts: q.opts || q.options || {},
    ans: String(q.ans || q.answer || q.correct || '').toUpperCase().charAt(0)
  })).filter(q => q.q && Object.keys(q.opts).length >= 2 && q.ans);
}

// ── Render Verses (accessible) ────────────────────────────────────
function renderVerses(verses) {
  scriptureBody.innerHTML = '';
  const savedBkms = bookmarks.filter(b => b.chapter === selectedChapter);
  verses.forEach(v => {
    const row = document.createElement('div');
    row.className = 'verse-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Verse ${v.verse}`);
    row.dataset.verse = v.verse;

    const numEl = document.createElement('span');
    numEl.className = 'verse-num'; numEl.textContent = v.verse;
    numEl.setAttribute('aria-hidden', 'true');

    const txtEl = document.createElement('span');
    txtEl.className = 'verse-text'; txtEl.textContent = v.text.trim();
    txtEl.setAttribute('role', 'text');

    const bkmBtn = document.createElement('button');
    bkmBtn.className = 'bkm-btn' + (savedBkms.some(b => b.verse === v.verse) ? ' saved' : '');
    bkmBtn.textContent = '🔖';
    bkmBtn.setAttribute('aria-label', `Bookmark verse ${v.verse}`);
    bkmBtn.addEventListener('click', () => toggleBookmark(v.verse, v.text.trim()));

    row.append(numEl, txtEl, bkmBtn);
    scriptureBody.appendChild(row);
  });
}

// ── Bible Search ──────────────────────────────────────────────────
$('bibleSearch').addEventListener('input', () => {
  const q = $('bibleSearch').value.toLowerCase().trim();
  document.querySelectorAll('.verse-row').forEach(row => {
    const txt = row.querySelector('.verse-text').textContent.toLowerCase();
    const show = !q || txt.includes(q);
    row.style.display = show ? '' : 'none';
    row.classList.toggle('hl', !!q && show);
  });
});

// ── Notes ─────────────────────────────────────────────────────────
async function loadNote(ch) {
  try {
    const r = await fetch(`/api/notes/${encodeURIComponent(currentUser)}/${ch}`);
    const d = await r.json();
    $('notesArea').value = d.note || '';
  } catch {}
}
async function saveNote() {
  const text = $('notesArea').value.trim();
  try {
    await fetch('/api/notes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:currentUser, chapter:selectedChapter, text }) });
    showToast('Note saved! ✓','ok');
  } catch { showToast('Failed to save note.','err'); }
}
function toggleNotes() {
  const body = $('notesBody'), tog = $('notesToggle'), arrow = $('notesArrow');
  const open = body.style.display !== 'none' && body.style.display !== '';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent  = open ? '▸' : '▾';
  tog.setAttribute('aria-expanded', !open);
}
$('notesToggle').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleNotes(); });

// ── Bookmarks ─────────────────────────────────────────────────────
async function fetchBookmarks() {
  try {
    const r = await fetch(`/api/bookmarks/${encodeURIComponent(currentUser)}`);
    const d = await r.json();
    bookmarks = d.bookmarks || [];
  } catch {}
}
async function toggleBookmark(verse, text) {
  try {
    const r = await fetch('/api/bookmarks', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:currentUser, chapter:selectedChapter, verse, text }) });
    const d = await r.json();
    await fetchBookmarks();
    renderVerses(currentVerses);
    renderAllBookmarks();
    showToast(d.status === 'added' ? '🔖 Verse bookmarked!':'Bookmark removed','ok');
  } catch { showToast('Failed to bookmark.','err'); }
}
function renderAllBookmarks() {
  const list = $('allBookmarksList');
  if (!bookmarks.length) { list.innerHTML = '<p style="color:var(--muted);font-size:13px">No bookmarks yet. Tap 🔖 on any verse.</p>'; return; }
  list.innerHTML = bookmarks.map(b => `
    <div class="bkm-card" role="article" aria-label="Bookmark: Mark ${b.chapter}:${b.verse}">
      <div class="bkm-ref">Mark ${b.chapter}:${b.verse}</div>
      <div class="bkm-txt">${escH(b.text)}</div>
    </div>`).join('');
}

// ── Quiz Rendering ────────────────────────────────────────────────
function renderQuizQuestion() {
  if (!currentQuiz) { $('quizContainer').innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:13px">📖 Load a chapter from the Bible tab to start a quiz.</div>`; return; }
  if (currentQuiz.completed) { renderQuizResult(); return; }

  const { questions, currentIdx, answers } = currentQuiz;
  const q = questions[currentIdx];
  const pct = Math.round(((currentIdx) / questions.length) * 100);
  const selected = answers[currentIdx];
  const revealed = selected !== undefined;

  let optsHtml = '';
  ['A','B','C','D'].forEach(letter => {
    const optText = q.opts[letter]; if (!optText) return;
    const isSelected = selected === letter;
    const isCorrect  = q.ans === letter;
    let extraClass = '';
    if (revealed) { if (isCorrect) extraClass = ' correct-ans'; else if (isSelected && !isCorrect) extraClass = ' wrong-ans'; }
    optsHtml += `
      <li class="opt-item">
        <input type="radio" name="q${currentIdx}" id="o${letter}" value="${letter}" ${isSelected?'checked':''} ${revealed?'disabled':''}>
        <label class="opt-lbl${extraClass}" for="o${letter}">
          <span class="obadge">${letter}</span>${escH(optText)}
        </label>
      </li>`;
  });

  const feedbackHtml = revealed
    ? `<div class="qfeedback ${selected === q.ans ? 'ok':'err'}" style="display:block">
        ${selected === q.ans ? '✅ Correct!' : `❌ Incorrect — correct answer: <strong>${q.ans}) ${escH(q.opts[q.ans])}</strong>`}
       </div>` : '';

  $('quizContainer').innerHTML = `
    <div class="quiz-panel">
      <div class="quiz-phdr">
        <div class="qi" aria-hidden="true">🎯</div>
        <h3>Mark ${currentQuiz.ch} Quiz</h3>
        <span class="qmeta">${currentIdx+1} / ${questions.length}</span>
      </div>
      <div class="quiz-body">
        <div class="quiz-pbar-w" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="quiz-pbar-f" style="width:${pct}%"></div>
        </div>
        <p class="quiz-qtext">${escH(q.q)}</p>
        <ul class="opts" role="radiogroup" aria-label="Answer options">${optsHtml}</ul>
        ${feedbackHtml}
        <div class="quiz-nav">
          ${currentIdx > 0 ? `<button class="quiz-nav btn-prev" onclick="quizNav(-1)" aria-label="Previous question">← Prev</button>`:''}
          ${!revealed ? `<button class="quiz-nav btn-next" onclick="submitQuizAnswer()" aria-label="Submit answer">Submit</button>`
            : currentIdx < questions.length-1
              ? `<button class="quiz-nav btn-next" onclick="quizNav(1)" aria-label="Next question">Next →</button>`
              : `<button class="quiz-nav btn-next" onclick="finishQuiz()" aria-label="See results">See Results 🏆</button>`}
        </div>
      </div>
    </div>`;
}

function submitQuizAnswer() {
  const sel = document.querySelector(`input[name="q${currentQuiz.currentIdx}"]:checked`);
  if (!sel) { showToast('Select an answer first.','err'); return; }
  currentQuiz.answers[currentQuiz.currentIdx] = sel.value;
  renderQuizQuestion();
}

function quizNav(dir) {
  currentQuiz.currentIdx = Math.max(0, Math.min(currentQuiz.questions.length-1, currentQuiz.currentIdx + dir));
  renderQuizQuestion();
}

async function finishQuiz() {
  currentQuiz.completed = true;
  // Save score to server
  const correct = currentQuiz.questions.filter((q,i) => currentQuiz.answers[i] === q.ans).length;
  const total   = currentQuiz.questions.length;
  if (currentQuiz.quizId) {
    try {
      await fetch(`/api/quiz/${currentQuiz.quizId}/score`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username:currentUser, score:correct, answers:Object.values(currentQuiz.answers) })
      });
    } catch {}
  }
  renderQuizResult();
  loadQuizHistory();
}

function renderQuizResult() {
  const { questions, answers, quizId, ch } = currentQuiz;
  const correct = questions.filter((q,i) => answers[i] === q.ans).length;
  const total   = questions.length;
  const pct     = Math.round((correct/total)*100);

  $('quizContainer').innerHTML = `
    <div class="quiz-panel">
      <div class="quiz-body">
        <div class="quiz-result">
          <div class="score-ring" style="--pct:${pct}" role="img" aria-label="${pct}% score">
            <span>${pct}%</span>
          </div>
          <h3>${correct} / ${total} Correct!</h3>
          <p>${pct >= 80 ? '🎉 Excellent work!' : pct >= 60 ? '👍 Good effort!' : '📚 Keep studying!'}</p>
          ${quizId ? `<button class="share-btn" onclick="shareQuiz('${quizId}')" aria-label="Share quiz link">🔗 Share Quiz</button>` : ''}
          <button class="review-btn" onclick="reviewQuiz()" aria-label="Review answers">📋 Review Answers</button>
          <button class="share-btn" style="background:var(--ok)" onclick="loadChapter()" aria-label="Try different questions">🔄 New Questions</button>
        </div>
      </div>
    </div>`;

  // Check for other scores if this is a shared quiz
  if (quizId) renderScoresComparison(quizId, correct, total);
}

async function renderScoresComparison(quizId, myScore, total) {
  try {
    const r = await fetch(`/api/quiz/${quizId}`);
    const d = await r.json();
    const scores = d.scores || {};
    const entries = Object.entries(scores).filter(([u]) => u !== currentUser);
    if (!entries.length) return;
    const container = $('quizContainer');
    const comp = document.createElement('div');
    comp.className = 'scores-compare';
    comp.innerHTML = `<h4>Score Comparison</h4>
      <div class="score-row"><span class="sname">You (${currentUser})</span><span class="sval">${myScore}/${total}</span></div>
      ${entries.map(([u,s]) => `<div class="score-row"><span class="sname">${escH(u)}</span><span class="sval">${s.score}/${total}</span></div>`).join('')}`;
    container.appendChild(comp);
  } catch {}
}

function reviewQuiz() {
  const { questions, answers, ch } = currentQuiz;
  currentQuiz.completed = false;
  currentQuiz.currentIdx = 0;
  renderQuizQuestion();
}

async function shareQuiz(quizId) {
  const url = `${location.origin}${location.pathname}?quiz=${quizId}`;
  try {
    if (navigator.share) { await navigator.share({ title:'Mark Bible Quiz', text:'Take my Bible quiz!', url }); }
    else { await navigator.clipboard.writeText(url); showToast('Quiz link copied! 🔗','ok'); }
  } catch { showToast('Could not copy link.','err'); }
}

// ── Load Shared Quiz ───────────────────────────────────────────────
async function loadSharedQuiz(quizId) {
  $('sharedQuizBanner').style.display = 'block';
  $('sharedQuizBanner').textContent = '⏳ Loading shared quiz…';
  try {
    const r = await fetch(`/api/quiz/${quizId}`);
    if (!r.ok) throw new Error('Quiz not found.');
    const d = await r.json();
    $('sharedQuizBanner').textContent = `📝 Quiz by ${d.username} — Mark Chapter ${d.chapter} (${d.questions.length} questions)`;
    currentQuiz = { questions:d.questions, currentIdx:0, answers:{}, quizId, ch:d.chapter, saved:true, completed:false };
    renderQuizQuestion();
  } catch (e) {
    $('sharedQuizBanner').textContent = `❌ ${e.message}`;
    $('sharedQuizBanner').style.background = 'rgba(224,92,92,.1)';
    $('sharedQuizBanner').style.borderColor = 'rgba(224,92,92,.25)';
    $('sharedQuizBanner').style.color = 'var(--err)';
  }
}

// ── Quiz History ───────────────────────────────────────────────────
async function loadQuizHistory() {
  try {
    const r = await fetch(`/api/quiz/user/${encodeURIComponent(currentUser)}`);
    const d = await r.json();
    const list = d.quizzes || [];
    const sect = $('quizHistorySection');
    const el   = $('quizHistoryList');
    if (!list.length) { sect.style.display = 'none'; return; }
    sect.style.display = 'block';
    el.innerHTML = list.map(q => {
      const myScore = q.scores && q.scores[currentUser] ? `${q.scores[currentUser].score}/${q.total}` : '—';
      return `<div class="qhist-item" onclick="reloadHistoryQuiz('${q.id}')" role="button" tabindex="0" aria-label="Mark Chapter ${q.chapter} quiz">
        <div class="qhist-info">
          <div class="qt">Mark Chapter ${q.chapter}</div>
          <div class="qm">${new Date(q.createdAt).toLocaleDateString()} · ${q.total} questions</div>
        </div>
        <div class="qhist-score">${myScore}</div>
      </div>`;
    }).join('');
  } catch {}
}

async function reloadHistoryQuiz(quizId) {
  try {
    const r = await fetch(`/api/quiz/${quizId}`);
    const d = await r.json();
    currentQuiz = { questions:d.questions, currentIdx:0, answers:{}, quizId, ch:d.chapter, saved:true, completed:false };
    const prevScore = d.scores && d.scores[currentUser];
    if (prevScore) {
      prevScore.answers.forEach((a,i) => { currentQuiz.answers[i] = a; });
      currentQuiz.completed = true;
    }
    switchTab('quiz');
    renderQuizQuestion();
  } catch { showToast('Failed to load quiz.','err'); }
}

// ── AI Tab ─────────────────────────────────────────────────────────
function useAISug(btn) { aiInput.value = btn.textContent; askAI(); }
aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') askAI(); });

async function askAI() {
  const q = aiInput.value.trim();
  if (!q || aiLoading) return;
  aiLoading = true; aiSendBtn.disabled = true; aiInput.value = '';
  const empty = aiMessages.querySelector('.ai-empty');
  if (empty) empty.remove();
  appendAIBubble('u', q);
  const loader = document.createElement('div');
  loader.className = 'ai-bub loading';
  loader.innerHTML = `<div class="ai-dots"><span></span><span></span><span></span></div>`;
  aiMessages.appendChild(loader);
  scrollEl(aiMessages);
  try {
    const chCtx = currentVerses.length ? `Current chapter context: Mark ${selectedChapter}. ` : '';
    const r = await fetch('/api/gemini', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ prompt:`${chCtx}You are a knowledgeable Bible study tutor specialising in the Gospel of Mark. Answer clearly and helpfully: ${q}` }) });
    const d = await r.json();
    loader.remove();
    appendAIBubble('b', d.reply || d.error || 'No response. Please try again.');
  } catch { loader.remove(); appendAIBubble('b','Network error. Please try again.'); }
  finally { aiLoading = false; aiSendBtn.disabled = false; aiInput.focus(); scrollEl(aiMessages); }
}

function appendAIBubble(role, text) {
  const d = document.createElement('div');
  d.className = `ai-bub ${role}`;
  d.textContent = text;
  aiMessages.appendChild(d);
  scrollEl(aiMessages);
}

// ── Chat Tab ───────────────────────────────────────────────────────
// Typing
let isTyping = false;
chatInput.addEventListener('input', () => {
  handleMentionInput();
  if (!isTyping) { isTyping = true; sendTypingSignal(); }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { isTyping = false; }, 3000);
});

async function sendTypingSignal() {
  try { await fetch('/api/chat/typing', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:currentUser }) }); } catch {}
}

// Mention autocomplete
function handleMentionInput() {
  const val = chatInput.value;
  const atPos = val.lastIndexOf('@');
  if (atPos === -1) { hideMentionPopup(); return; }
  const after = val.slice(atPos+1);
  if (after.includes(' ')) { hideMentionPopup(); return; }
  mentionSearch = after.toLowerCase();
  const suggestions = ['GiftAI', ...onlineUsers.filter(u => u !== currentUser)]
    .filter(u => u.toLowerCase().includes(mentionSearch));
  if (!suggestions.length) { hideMentionPopup(); return; }
  mentionPopup.innerHTML = suggestions.map(u =>
    `<div class="mp-item" onclick="insertMention('${u}')" role="option" tabindex="0" aria-label="Mention ${u}">
      <div class="mp-av" aria-hidden="true">${u === 'GiftAI' ? '🤖' : u.charAt(0).toUpperCase()}</div>@${escH(u)}
    </div>`).join('');
  mentionPopup.classList.add('show');
}
function hideMentionPopup() { mentionPopup.classList.remove('show'); }
function insertMention(user) {
  const val = chatInput.value, atPos = val.lastIndexOf('@');
  chatInput.value = val.slice(0, atPos) + `@${user} `;
  hideMentionPopup(); chatInput.focus();
}

// Reply
function setReply(msg) {
  replyingTo = { id:msg.id, username:msg.username, message:msg.message };
  $('rpName').textContent = `Replying to @${msg.username}`;
  $('rpText').textContent = msg.message.substring(0, 60) + (msg.message.length>60?'…':'');
  replyPreview.classList.add('show'); chatInput.focus();
}
function cancelReply() { replyingTo = null; replyPreview.classList.remove('show'); }

// Send message
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); } });

async function sendChatMessage() {
  const msg = chatInput.value.trim();
  if (!msg || !currentUser) return;
  chatInput.value = ''; isTyping = false;
  hideMentionPopup();
  const reply = replyingTo ? { ...replyingTo } : null;
  cancelReply();

  try {
    await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:currentUser, message:msg, replyTo:reply }) });
    // If @GiftAI mentioned, trigger AI response in chat
    if (msg.toLowerCase().includes('@giftai')) {
      triggerGiftAIResponse(msg);
    }
  } catch { showToast('Failed to send message.','err'); chatInput.value = msg; }
}

async function triggerGiftAIResponse(userMsg) {
  const question = userMsg.replace(/@GiftAI/gi,'').trim() || 'Hello! Please share a verse from Mark.';
  try {
    const r = await fetch('/api/gemini', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ prompt:`You are GiftAI, a friendly Bible study assistant in a group chat. Keep your response brief (2-3 sentences). Answer this question about the Gospel of Mark: ${question}` }) });
    const d = await r.json();
    if (d.reply) {
      await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:'GiftAI', message:d.reply, replyTo:{ id:'', username:currentUser, message:question.substring(0,60) } }) });
    }
  } catch {}
}

// Polling
function startChatPolling() {
  clearInterval(chatPollTimer); clearInterval(typingPollTimer);
  pollChat(); pollTyping();
  chatPollTimer    = setInterval(pollChat,    2500);
  typingPollTimer  = setInterval(pollTyping,  2000);
}

async function pollChat() {
  if (!isLoggedIn) return;
  try {
    const r = await fetch(`/api/chat?since=${lastChatTs}`);
    if (!r.ok) return;
    const d = await r.json();
    const msgs = d.messages || [];
    if (msgs.length) {
      const empty = chatMessages.querySelector('.chat-empty');
      if (empty) empty.remove();

      // Insert unread divider if chat tab not active
      if (!chatTabActive && unreadCount === 0 && chatMessages.children.length > 0) {
        const div = document.createElement('div');
        div.className = 'unread-divider';
        div.innerHTML = `<span>New messages</span>`;
        div.id = 'unreadDivider';
        chatMessages.appendChild(div);
      }

      msgs.forEach(m => renderChatMessage(m));
      lastChatTs = msgs[msgs.length-1].timestamp;

      if (!chatTabActive) {
        unreadCount += msgs.filter(m => m.username !== currentUser).length;
        if (unreadCount > 0) {
          unreadBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
          unreadBadge.style.display = 'flex';
        }
        // Push notifications
        msgs.filter(m => m.username !== currentUser).forEach(m => {
          pushNotify(`${m.username} in Group Chat`, m.message.substring(0,60));
        });
      }

      if (chatTabActive) scrollEl(chatMessages);
    }
  } catch {}
}

async function pollTyping() {
  if (!isLoggedIn) return;
  try {
    const r = await fetch(`/api/chat/typing?exclude=${encodeURIComponent(currentUser)}`);
    const d = await r.json();
    const t = d.typing || [];
    if (t.length) {
      typingBar.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>${escH(t.slice(0,3).join(', '))} ${t.length===1?'is':'are'} typing…`;
    } else {
      typingBar.innerHTML = '';
    }
  } catch {}
}

function markChatRead() {
  unreadCount = 0;
  unreadBadge.style.display = 'none';
  const div = document.getElementById('unreadDivider');
  if (div) div.remove();
  scrollEl(chatMessages);
}

// Render chat message
function renderChatMessage(msg) {
  const isMine  = msg.username === currentUser;
  const isAI    = msg.username === 'GiftAI';
  const isAdm   = msg.isAdmin && msg.username !== currentUser;
  const initials = msg.username.charAt(0).toUpperCase();
  const timeStr  = new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  const el = document.createElement('div');
  el.className = `cmsg${isMine?' mine':''}`;
  el.dataset.id = msg.id;
  el.setAttribute('role', 'article');
  el.setAttribute('aria-label', `${msg.username}: ${msg.message}`);

  const avClass = isAI ? 'cav' : isAdm ? 'cav admin-av' : 'cav';
  const avContent = isAI ? '🤖' : initials;
  const unClass = isAI ? 'cun gift-ai-name' : isAdm ? 'cun admin-name' : 'cun';
  const unLabel = msg.username + (isAdm?' 👑':'') + (isAI?' 🤖':'');

  const replyHtml = msg.replyTo
    ? `<div class="creply" onclick="scrollToMsg('${escH(msg.replyTo.id||'')}')">
        <div class="rn">${escH(msg.replyTo.username)}</div>
        <div class="rt">${escH(msg.replyTo.message||'')}</div>
       </div>` : '';

  const formattedMsg = formatMentions(escH(msg.message));
  const bubClass = isAI ? 'cbub giftai-bub' : 'cbub';

  const reactions = msg.reactions || {};
  const reactHtml = Object.entries(reactions).map(([emoji,users]) =>
    `<div class="creact-chip" onclick="addReaction('${msg.id}','${emoji}')" role="button" aria-label="React ${emoji} (${users.length})" tabindex="0">
      ${emoji}<span class="rcount">${users.length}</span>
    </div>`).join('');

  el.innerHTML = `
    <div class="${avClass}" aria-hidden="true">${avContent}</div>
    <div class="cbwrap">
      <span class="${unClass}">${escH(unLabel)}</span>
      ${replyHtml}
      <div class="${bubClass}" onclick="showReactPicker(event,'${msg.id}')" oncontextmenu="handleMsgContextMenu(event,'${msg.id}')" aria-label="${escH(msg.message)}">${formattedMsg}</div>
      ${reactHtml ? `<div class="creactions" aria-label="Reactions">${reactHtml}</div>` : ''}
      <span class="ctime">${timeStr}</span>
    </div>`;

  // Double-tap to reply
  let tapped = false;
  el.addEventListener('click', () => {
    if (tapped) { setReply({ id:msg.id, username:msg.username, message:msg.message }); tapped = false; return; }
    tapped = true; setTimeout(() => { tapped = false; }, 350);
  });

  chatMessages.appendChild(el);
}

function formatMentions(html) {
  return html.replace(/@(\w+)/g, `<span class="mention" aria-label="mention">@$1</span>`);
}

function scrollToMsg(id) {
  const el = chatMessages.querySelector(`[data-id="${id}"]`);
  if (el) { el.scrollIntoView({ behavior:'smooth', block:'center' }); el.style.background = 'rgba(201,168,76,.1)'; setTimeout(() => el.style.background = '', 1200); }
}

// Reaction picker
let reactPickerMsgId = null;
function showReactPicker(e, msgId) {
  e.stopPropagation();
  reactPickerMsgId = msgId;
  reactPicker.style.left = Math.min(e.clientX, window.innerWidth-200) + 'px';
  reactPicker.style.top  = (e.clientY - 60) + 'px';
  reactPicker.style.position = 'fixed';
  reactPicker.classList.toggle('show');
}
function handleMsgContextMenu(e, msgId) { e.preventDefault(); showReactPicker(e, msgId); }
async function pickReaction(emoji) {
  reactPicker.classList.remove('show');
  if (!reactPickerMsgId) return;
  await addReaction(reactPickerMsgId, emoji);
}
async function addReaction(msgId, emoji) {
  try { await fetch('/api/chat/react', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ messageId:msgId, username:currentUser, emoji }) }); } catch {}
}
document.addEventListener('click', () => reactPicker.classList.remove('show'));

// ── Leaderboard ────────────────────────────────────────────────────
async function loadLeaderboard() {
  const el = $('leaderboardList');
  try {
    const r = await fetch('/api/leaderboard');
    const d = await r.json();
    const board = d.leaderboard || [];
    if (!board.length) { el.innerHTML = '<p style="color:var(--muted);font-size:13px">No data yet.</p>'; return; }
    const rankColors = ['gold','silver','bronze'];
    el.innerHTML = board.map(row => `
      <div class="lb-item" role="listitem">
        <div class="lb-rank ${rankColors[row.rank-1]||''}" aria-label="Rank ${row.rank}">${row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank-1] : row.rank}</div>
        <div class="lb-av" aria-hidden="true">${row.username.charAt(0).toUpperCase()}</div>
        <div class="lb-name">${escH(row.username)}</div>
        <div><div class="lb-pts">${row.score} pts</div><div class="lb-done">${row.completed}/16 chs</div></div>
      </div>`).join('');
  } catch { el.innerHTML = '<p style="color:var(--muted);font-size:13px">Failed to load.</p>'; }
}

// ── Achievements ───────────────────────────────────────────────────
async function renderAchievements() {
  const el = $('achievementGrid');
  const stats = {
    completed: completedChapters.length,
    score: parseInt(scoreEl.textContent)||0,
    quizzes: 0, chatSent: 0, streak: 0, bookmarks: bookmarks.length
  };
  try { const r = await fetch(`/api/streak/${encodeURIComponent(currentUser)}`); const d = await r.json(); stats.streak = d.current||0; } catch {}

  el.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(stats);
    return `<div class="ach-item ${unlocked?'unlocked':''}" role="listitem" aria-label="${a.name}: ${unlocked?'Unlocked':'Locked'}">
      <div class="ach-icon">${unlocked ? a.icon : '🔒'}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-lock">${unlocked ? '✓ Unlocked' : a.desc}</div>
    </div>`;
  }).join('');
}

// ── Notifications ──────────────────────────────────────────────────
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
function pushNotify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(title, { body, icon: '📖' }); } catch {}
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function scrollEl(el) { el.scrollTop = el.scrollHeight; }

function escH(str) {
  const d = document.createElement('div');
  d.textContent = String(str||'');
  return d.innerHTML;
}

let toastTimer;
function showToast(msg, type='ok') {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3200);
}

// ── Init ───────────────────────────────────────────────────────────
(function init() {
  loadTheme();
  buildChapterGrid();
})();
