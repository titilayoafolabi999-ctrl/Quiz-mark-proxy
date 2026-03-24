let token = '';
let currentUser = '';
let currentQuiz = null; // store { question, options, correct }

for(let i=1;i<=16;i++) {
  document.getElementById('chapter').innerHTML += `<option>${i}</option>`;
}

async function register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    await fetch('/api/auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'register', username, password})
    });
    alert('Registered successfully');
  } catch(e) {
    alert('Registration failed: ' + e.message);
  }
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('/api/auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'login', username, password})
    });
    const d = await res.json();
    if(d.token) {
      token = d.token;
      currentUser = username;
      document.getElementById('auth').style.display = 'none';
      document.getElementById('userInfo').style.display = 'flex';
      document.getElementById('currentUser').innerText = currentUser;
      await fetchScore();
    } else {
      alert('Invalid credentials');
    }
  } catch(e) {
    alert('Login failed: ' + e.message);
  }
}

async function logout() {
  token = '';
  currentUser = '';
  document.getElementById('auth').style.display = 'flex';
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('text').innerHTML = '';
  document.getElementById('quiz').innerHTML = '';
  document.getElementById('chapter').value = '1';
}

async function fetchScore() {
  try {
    const res = await fetch(`/api/score?username=${currentUser}`);
    const data = await res.json();
    document.getElementById('score').innerText = data.score || 0;
  } catch(e) {
    console.error('Failed to fetch score', e);
  }
}

async function markCompleted() {
  const ch = document.getElementById('chapter').value;
  try {
    const res = await fetch('/api/score', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username: currentUser, chapter: ch})
    });
    const data = await res.json();
    if(data.status === 'ok') {
      alert(`Chapter ${ch} marked completed!`);
      await fetchScore();
    }
  } catch(e) {
    alert('Error marking chapter: ' + e.message);
  }
}

async function loadChapter() {
  const ch = document.getElementById('chapter').value;
  const loading = document.getElementById('loading');
  loading.style.display = 'block';
  document.getElementById('text').innerHTML = '';
  document.getElementById('quiz').innerHTML = '';

  // fetch Bible text
  try {
    const r = await fetch(`https://bible-api.com/mark+${ch}`);
    const d = await r.json();
    const text = d.verses.map(v=>v.text).join(' ');
    document.getElementById('text').innerText = text;

    // generate quiz with Gemini
    const ai = await fetch('/api/gemini', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:`Generate a multiple-choice quiz question about Mark ${ch}. The question should be about the content. Format: question: ... options: A) ... B) ... C) ... D) ... answer: (letter)`, context: text})
    });
    const q = await ai.json();
    displayQuiz(q.reply);
  } catch(e) {
    document.getElementById('text').innerHTML = 'Error loading chapter: ' + e.message;
  } finally {
    loading.style.display = 'none';
  }
}

function displayQuiz(quizText) {
  // Parse Gemini's response - expecting format like:
  // question: ... options: A) ... B) ... C) ... D) ... answer: A
  const questionMatch = quizText.match(/question:\s*(.*?)(?=options:|$)/i);
  const optionsMatch = quizText.match(/options:\s*(.*?)(?=answer:|$)/i);
  const answerMatch = quizText.match(/answer:\s*(\w)/i);
  if(!questionMatch || !optionsMatch || !answerMatch) {
    document.getElementById('quiz').innerHTML = '<p>Quiz format error. Please try again.</p>';
    return;
  }
  const question = questionMatch[1].trim();
  const optionsRaw = optionsMatch[1].trim();
  const correct = answerMatch[1].toUpperCase();

  // Parse options (A) ... B) ...)
  const optionList = optionsRaw.split(/[A-D]\)/).slice(1).map(opt => opt.trim());
  if(optionList.length !== 4) {
    document.getElementById('quiz').innerHTML = '<p>Could not parse options.</p>';
    return;
  }
  const options = { A: optionList[0], B: optionList[1], C: optionList[2], D: optionList[3] };

  currentQuiz = { question, options, correct };

  let html = `<div class="quiz-question"><strong>${question}</strong></div><ul class="quiz-options">`;
  for(let [letter, text] of Object.entries(options)) {
    html += `<li><label><input type="radio" name="quiz" value="${letter}"> ${letter}) ${text}</label></li>`;
  }
  html += `</ul><button onclick="submitAnswer()">Submit Answer</button><div id="quizFeedback" class="quiz-feedback"></div>`;
  document.getElementById('quiz').innerHTML = html;
}

async function submitAnswer() {
  const selected = document.querySelector('input[name="quiz"]:checked');
  if(!selected) {
    alert('Please select an answer');
    return;
  }
  const userAnswer = selected.value;
  const correct = currentQuiz.correct;
  const feedbackDiv = document.getElementById('quizFeedback');
  if(userAnswer === correct) {
    feedbackDiv.innerHTML = '✅ Correct!';
    // optionally increase score for correct answer
    // For now, just give feedback
  } else {
    feedbackDiv.innerHTML = `❌ Incorrect. The correct answer was ${correct}.`;
  }
}

// Draggable AI button
const btn = document.getElementById('aiBtn');
let isDragging = false;
let startX, startY, initialLeft, initialTop;

btn.onmousedown = btn.ontouchstart = (e) => {
  e.preventDefault();
  isDragging = true;
  const rect = btn.getBoundingClientRect();
  startX = e.clientX || e.touches[0].clientX;
  startY = e.clientY || e.touches[0].clientY;
  initialLeft = rect.left;
  initialTop = rect.top;
  document.onmousemove = onDrag;
  document.onmouseup = stopDrag;
  document.ontouchmove = onDrag;
  document.ontouchend = stopDrag;
};

function onDrag(e) {
  if(!isDragging) return;
  e.preventDefault();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  let newLeft = initialLeft + (clientX - startX);
  let newTop = initialTop + (clientY - startY);
  // constrain to viewport
  newLeft = Math.max(0, Math.min(window.innerWidth - btn.offsetWidth, newLeft));
  newTop = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, newTop));
  btn.style.left = newLeft + 'px';
  btn.style.top = newTop + 'px';
  btn.style.right = 'auto';
  btn.style.bottom = 'auto';
}

function stopDrag() {
  isDragging = false;
  document.onmousemove = null;
  document.onmouseup = null;
  document.ontouchmove = null;
  document.ontouchend = null;
}

btn.onclick = async () => {
  if(isDragging) return;
  const q = prompt('Ask about Mark:');
  if(!q) return;
  const r = await fetch('/api/gemini', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({prompt: q})
  });
  const d = await r.json();
  alert(d.reply);
};
