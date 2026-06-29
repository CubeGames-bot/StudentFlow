// ─── STORAGE ───────────────────────────────────────────
function loadState() {
  return JSON.parse(localStorage.getItem('studyos_timer')) || {
    settings: { focus: 25, short: 5, long: 15, sessions: 4, dailyGoal: 3 },
    today: { date: '', sessions: 0, mins: 0, history: [] },
    streak: 0, lastStudyDate: ''
  };
}
function saveState() { localStorage.setItem('studyos_timer', JSON.stringify(state)); }

let state = loadState();

// reset today if new day
const todayStr = new Date().toDateString();
if (state.today.date !== todayStr) {
  // update streak
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (state.lastStudyDate === yesterday.toDateString() && state.today.sessions > 0) {
    state.streak = (state.streak || 0) + 1;
  } else if (state.today.sessions === 0) {
    // no change
  } else {
    state.streak = 1;
  }
  if (state.today.sessions > 0) state.lastStudyDate = state.today.date;
  state.today = { date: todayStr, sessions: 0, mins: 0, history: [] };
  saveState();
}

// ─── TIMER STATE ───────────────────────────────────────
const MODES = { focus: 'focus', short: 'short', long: 'long', custom: 'custom' };
let currentMode = 'focus';
let currentSession = 1;
let isRunning = false;
let intervalId = null;
let timeLeft = state.settings.focus * 60;
let totalTime = state.settings.focus * 60;
let selectedSubject = '';

const CIRCUMFERENCE = 2 * Math.PI * 90; // 565.48

// ─── DOM REFS ──────────────────────────────────────────
const display = document.getElementById('timer-display');
const modeLabel = document.getElementById('timer-mode-label');
const ring = document.getElementById('ring');
const playBtn = document.getElementById('play-btn');
const subjectTag = document.getElementById('subject-tag');
const subjectSelect = document.getElementById('subject-select');

// ─── HELPERS ───────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function fmt(secs) { return `${pad(Math.floor(secs/60))}:${pad(secs%60)}`; }

function fmtTime(date) {
  const d = new Date(date);
  const h = d.getHours(), m = d.getMinutes();
  return `${h%12||12}:${pad(m)} ${h>=12?'PM':'AM'}`;
}

function setRing(pct) {
  const offset = CIRCUMFERENCE * (1 - pct);
  ring.style.strokeDasharray = CIRCUMFERENCE;
  ring.style.strokeDashoffset = offset;
}

function getModeLabel() {
  if (currentMode === 'focus') return 'Focus session';
  if (currentMode === 'short') return 'Short break ☕';
  if (currentMode === 'long') return 'Long break 🛌';
  return 'Custom timer';
}

function isBreak() { return currentMode === 'short' || currentMode === 'long'; }

// ─── RENDER ────────────────────────────────────────────
function renderDots() {
  const total = state.settings.sessions;
  const dots = document.getElementById('session-dots');
  dots.innerHTML = Array.from({length: total}, (_, i) => {
    const cls = i + 1 < currentSession ? 'done' : i + 1 === currentSession ? 'current' : '';
    return `<div class="s-dot ${cls}"></div>`;
  }).join('');

  const info = document.getElementById('session-info');
  const remaining = state.settings.sessions - currentSession + 1;
  if (currentMode === 'focus') {
    info.textContent = `Session ${currentSession} of ${total} · ${remaining === 1 ? 'Long break after this' : `${remaining - 1} more before long break`}`;
  } else {
    info.textContent = currentMode === 'long' ? 'Long break — well deserved!' : 'Short break — stretch a bit!';
  }
}

function renderStats() {
  const s = state.today;
  const goal = state.settings.dailyGoal || 3;
  const pct = Math.min(100, Math.round((s.sessions / goal) * 100));

  document.getElementById('stat-sessions').textContent = s.sessions;
  document.getElementById('stat-mins').textContent = s.mins;
  document.getElementById('stat-goal').textContent = goal;
  document.getElementById('stat-pct').textContent = pct + '%';
  document.getElementById('goal-bar').style.width = pct + '%';
  document.getElementById('streak-display').textContent = '🔥 ' + (state.streak || 0);
}

function renderHistory() {
  const container = document.getElementById('session-history');
  const h = state.today.history;
  if (h.length === 0) {
    container.innerHTML = '<div class="no-history">No sessions yet today</div>';
    return;
  }
  container.innerHTML = [...h].reverse().slice(0, 6).map(item => `
    <div class="history-item">
      <div class="h-dot ${item.isBreak ? 'break' : ''}"></div>
      <div class="h-name">${item.label}</div>
      <div class="h-dur">${item.mins} min · ${fmtTime(item.time)}</div>
    </div>
  `).join('');
}

function loadSubjects() {
  const classes = JSON.parse(localStorage.getItem('studyos_classes')) || [];
  const subjects = [...new Set(classes.map(c => c.subject).filter(Boolean))];
  subjectSelect.innerHTML = '<option value="">— No subject —</option>' +
    subjects.map(s => `<option value="${s}">${s}</option>`).join('');
}

function updateDisplay() {
  display.textContent = fmt(timeLeft);
  modeLabel.textContent = getModeLabel();
  setRing(timeLeft / totalTime);

  // ring color
  ring.classList.toggle('ring-break', isBreak());
  playBtn.classList.toggle('break-mode', isBreak());

  document.title = `${fmt(timeLeft)} — StudyOS`;
}

// ─── TIMER LOGIC ───────────────────────────────────────
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  playBtn.textContent = '⏸';

  intervalId = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(intervalId);
      isRunning = false;
      onTimerComplete();
      return;
    }
    timeLeft--;
    updateDisplay();
  }, 1000);
}

function pauseTimer() {
  clearInterval(intervalId);
  isRunning = false;
  playBtn.textContent = '▶';
}

function resetTimer() {
  pauseTimer();
  setModeTime();
  updateDisplay();
}

function skipTimer() {
  pauseTimer();
  onTimerComplete();
}

function setModeTime() {
  const s = state.settings;
  if (currentMode === 'focus') totalTime = timeLeft = s.focus * 60;
  else if (currentMode === 'short') totalTime = timeLeft = s.short * 60;
  else if (currentMode === 'long') totalTime = timeLeft = s.long * 60;
  else totalTime = timeLeft = s.focus * 60;
}

function onTimerComplete() {
  playBtn.textContent = '▶';

  // notify
  if (Notification.permission === 'granted') {
    new Notification('StudyOS', {
      body: isBreak() ? 'Break over — time to focus!' : 'Session complete — take a break!',
      icon: '📚'
    });
  }

  if (currentMode === 'focus') {
    // log session
    const mins = state.settings.focus;
    state.today.sessions++;
    state.today.mins += mins;
    state.today.history.push({
      label: selectedSubject || 'Focus session',
      mins,
      isBreak: false,
      time: Date.now()
    });

    // auto break
    if (currentSession >= state.settings.sessions) {
      currentSession = 1;
      switchMode('long');
    } else {
      currentSession++;
      switchMode('short');
    }
  } else {
    // log break
    const mins = currentMode === 'short' ? state.settings.short : state.settings.long;
    state.today.history.push({
      label: currentMode === 'long' ? 'Long break' : 'Short break',
      mins,
      isBreak: true,
      time: Date.now()
    });
    switchMode('focus');
  }

  saveState();
  renderStats();
  renderHistory();
  renderDots();
  updateDisplay();
}

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  setModeTime();
}

// ─── SETTINGS ──────────────────────────────────────────
function updateSetting(target, dir) {
  const min = { focus: 1, short: 1, long: 1, sessions: 1 };
  const max = { focus: 90, short: 30, long: 60, sessions: 10 };
  state.settings[target] = Math.min(max[target], Math.max(min[target], state.settings[target] + dir));
  document.getElementById('s-' + target).textContent = state.settings[target];
  saveState();
  if (!isRunning) setModeTime();
  updateDisplay();
}

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  setModeTime();
  updateDisplay();
  renderDots();
  renderStats();
  renderHistory();

  // update setting display
  document.getElementById('s-focus').textContent = state.settings.focus;
  document.getElementById('s-short').textContent = state.settings.short;
  document.getElementById('s-long').textContent = state.settings.long;
  document.getElementById('s-sessions').textContent = state.settings.sessions;

  // play/pause
  playBtn.addEventListener('click', () => {
    isRunning ? pauseTimer() : startTimer();
  });

  // reset
  document.getElementById('reset-btn').addEventListener('click', resetTimer);

  // skip
  document.getElementById('skip-btn').addEventListener('click', skipTimer);

  // mode tabs
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isRunning) pauseTimer();
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      setModeTime();
      updateDisplay();
      renderDots();
    });
  });

  // subject
  subjectTag.addEventListener('click', () => {
    subjectTag.classList.add('hidden');
    subjectSelect.classList.remove('hidden');
    subjectSelect.focus();
  });
  subjectSelect.addEventListener('change', () => {
    selectedSubject = subjectSelect.value;
    subjectTag.textContent = selectedSubject ? `📚 ${selectedSubject}` : '📚 Select subject';
    subjectTag.classList.remove('hidden');
    subjectSelect.classList.add('hidden');
  });
  subjectSelect.addEventListener('blur', () => {
    subjectTag.classList.remove('hidden');
    subjectSelect.classList.add('hidden');
  });

  // setting controls
  document.querySelectorAll('.s-ctrl').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting(btn.dataset.target, parseInt(btn.dataset.dir));
    });
  });

  // notifications
  document.getElementById('notif-btn').addEventListener('click', () => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        document.getElementById('notif-btn').textContent =
          p === 'granted' ? '🔔 Notifications on' : '🔕 Notifications off';
      });
    }
  });
});