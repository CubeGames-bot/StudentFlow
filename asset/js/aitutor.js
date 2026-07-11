const FREE_LIMIT = 5;

// ─── SUPABASE ──────────────────────────────────────────
const SUPABASE_URL = 'https://qvzfumruwhbpzetslsjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CnEPDGz4KDvSnpFAFnxZqQ_581Xj6DB';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── STORAGE ───────────────────────────────────────────
function loadChats() { return JSON.parse(localStorage.getItem('studyos_chats')) || []; }
function saveChats(c) { localStorage.setItem('studyos_chats', JSON.stringify(c)); }
function loadUsage() {
  const u = JSON.parse(localStorage.getItem('studyos_ai_usage')) || { date: '', count: 0 };
  if (u.date !== new Date().toDateString()) { u.date = new Date().toDateString(); u.count = 0; }
  return u;
}
function saveUsage(u) { localStorage.setItem('studyos_ai_usage', JSON.stringify(u)); }
function genId() { return 'chat_' + Date.now(); }

// ─── STATE ─────────────────────────────────────────────
let chats = loadChats();
let activeChatId = chats.length ? chats[0].id : null;
let usage = loadUsage();
let isLoading = false;

// ─── SUBJECTS ──────────────────────────────────────────
function getSubjects() {
  const classes = JSON.parse(localStorage.getItem('studyos_classes')) || [];
  return [...new Set(classes.map(c => c.subject).filter(Boolean))];
}

function populateSubjects() {
  const subjects = getSubjects();
  ['chat-subject', 'history-filter'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.options[0].outerHTML;
    sel.innerHTML = first + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
  });
}

// ─── HAMBURGER ─────────────────────────────────────────
function openHistory() {
  document.getElementById('ai-history').classList.add('open');
  document.getElementById('history-overlay').classList.add('open');
}
function closeHistory() {
  document.getElementById('ai-history').classList.remove('open');
  document.getElementById('history-overlay').classList.remove('open');
}

// ─── RENDER HISTORY ────────────────────────────────────
function renderHistory(filter) {
  const container = document.getElementById('history-list');
  let list = [...chats];
  if (filter) list = list.filter(c => c.subject === filter);

  if (list.length === 0) {
    container.innerHTML = '<div class="no-chats">No chats yet.<br>Tap "+ New chat" to start!</div>';
    return;
  }

  container.innerHTML = list.map(chat => {
    const title = chat.title || 'New chat';
    const date = new Date(chat.createdAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
    return `
      <div class="history-item ${chat.id === activeChatId ? 'active' : ''}" data-id="${chat.id}">
        <button class="h-del" data-id="${chat.id}">✕</button>
        <div class="h-title">${escHtml(title)}</div>
        <div class="h-meta">${date}${chat.subject ? ' · ' + chat.subject : ''}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('h-del')) return;
      activeChatId = el.dataset.id;
      closeHistory();
      renderHistory(document.getElementById('history-filter').value);
      renderChat();
    });
  });

  container.querySelectorAll('.h-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      chats = chats.filter(c => c.id !== btn.dataset.id);
      saveChats(chats);
      if (activeChatId === btn.dataset.id) activeChatId = chats.length ? chats[0].id : null;
      renderHistory(document.getElementById('history-filter').value);
      renderChat();
    });
  });
}

// ─── RENDER CHAT ───────────────────────────────────────
function renderChat() {
  const container = document.getElementById('chat-messages');
  const sugRow = document.getElementById('suggestions-row');
  const chat = chats.find(c => c.id === activeChatId);

  if (!chat || chat.messages.length === 0) {
    container.innerHTML = `
      <div class="empty-chat">
        <div class="empty-icon">🤖</div>
        <div class="empty-title">Ask me anything</div>
        <div class="empty-sub">Select a subject above and start asking questions about your studies.</div>
        <div class="quick-actions">
          <button class="qa-btn" onclick="insertPrompt('Explain this concept to me simply:')">💡 Explain a concept</button>
          <button class="qa-btn" onclick="insertPrompt('Give me 5 practice questions on:')">📝 Practice questions</button>
          <button class="qa-btn" onclick="insertPrompt('Summarise this topic for me:')">📋 Summarise topic</button>
          <button class="qa-btn" onclick="insertPrompt('Solve this step by step:')">🧮 Solve step by step</button>
        </div>
      </div>`;
    sugRow.style.display = 'none';
    return;
  }

  container.innerHTML = chat.messages.map(msg => {
    const time = new Date(msg.time).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' });
    if (msg.role === 'user') {
      return `
        <div class="msg user">
          <div class="msg-av user">IR</div>
          <div>
            <div class="bubble user">${escHtml(msg.content)}</div>
            <div class="msg-time">${time}</div>
          </div>
        </div>`;
    } else {
      return `
        <div class="msg">
          <div class="msg-av ai">🤖</div>
          <div>
            <div class="bubble ai">${formatAI(msg.content)}</div>
            <div class="msg-time">${time}</div>
          </div>
        </div>`;
    }
  }).join('');

  sugRow.style.display = 'flex';
  if (chat.subject) document.getElementById('chat-subject').value = chat.subject;
  container.scrollTop = container.scrollHeight;
}

// ─── HELPERS ───────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function formatAI(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff">$1</strong>');
  text = text.replace(/`([^`]+)`/g, '<code style="background:#16253f;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:11px;color:#7eb3f7;">$1</code>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function insertPrompt(text) {
  const input = document.getElementById('chat-input');
  input.value = text + ' ';
  input.focus();
}

// ─── USAGE UI ──────────────────────────────────────────
function updateUsageUI() {
  usage = loadUsage();
  const pct = Math.min(100, (usage.count / FREE_LIMIT) * 100);
  document.getElementById('usage-num').textContent = `${usage.count}/${FREE_LIMIT}`;
  document.getElementById('usage-bar').style.width = pct + '%';

  const counter = document.getElementById('query-counter');
  counter.textContent = `${usage.count} / ${FREE_LIMIT} queries today`;
  counter.className = 'query-counter' + (usage.count >= FREE_LIMIT ? ' maxed' : usage.count >= 3 ? ' warning' : '');

  const existing = document.querySelector('.maxed-banner');
  if (existing) existing.remove();

  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');

  if (usage.count >= FREE_LIMIT) {
    const banner = document.createElement('div');
    banner.className = 'maxed-banner';
    banner.textContent = `Daily limit reached (${FREE_LIMIT}/day). Upgrade for unlimited queries.`;
    document.getElementById('chat-messages').before(banner);
    sendBtn.disabled = true;
    chatInput.disabled = true;
  } else {
    sendBtn.disabled = false;
    chatInput.disabled = false;
  }
}

// ─── SEND WITH GEMINI ──────────────────────────────────
async function sendMessage() {
  if (isLoading) return;
  usage = loadUsage();
  if (usage.count >= FREE_LIMIT) { updateUsageUI(); return; }

  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;

  const subject = document.getElementById('chat-subject').value;

  if (!activeChatId || !chats.find(c => c.id === activeChatId)) {
    const chat = { id: genId(), subject, title: '', messages: [], createdAt: Date.now() };
    chats.unshift(chat);
    activeChatId = chat.id;
    saveChats(chats);
  }

  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;
  if (subject) chat.subject = subject;

  if (!chat.title) {
    chat.title = content.length > 45 ? content.slice(0, 45) + '...' : content;
  }

  chat.messages.push({ role: 'user', content, time: Date.now() });
  saveChats(chats);
  input.value = '';
  input.style.height = 'auto';

  renderChat();
  renderHistory(document.getElementById('history-filter').value);

  // typing indicator
  const msgContainer = document.getElementById('chat-messages');
  const typingEl = document.createElement('div');
  typingEl.className = 'msg';
  typingEl.id = 'typing-indicator';
  typingEl.innerHTML = `
    <div class="msg-av ai">🤖</div>
    <div class="bubble ai">
      <div class="typing-wrap">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  msgContainer.appendChild(typingEl);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  isLoading = true;
  document.getElementById('send-btn').disabled = true;

  try {
    const classes = JSON.parse(localStorage.getItem('studyos_classes')) || [];
    const subjects = [...new Set(classes.map(c => c.subject).filter(Boolean))];

    // Gather all student data
  const classes = JSON.parse(localStorage.getItem('studyos_classes')) || [];
  const tasks = JSON.parse(localStorage.getItem('studyos_tasks')) || [];
  const cgpa = localStorage.getItem('studyos_cgpa') || 'unknown';
  const subjects = [...new Set(classes.map(c => c.subject).filter(Boolean))];

  // Today's classes
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = days[new Date().getDay()];
  const todayClasses = classes.filter(c => c.eventType === 'recurring' ? c.day === todayName : c.date === new Date().toISOString().split('T')[0]);

  // Pending tasks
  const pendingTasks = tasks.filter(t => t.status !== 'done');

  const systemPrompt = `You are a smart AI study assistant for a Malaysian university student using StudentFlow app.

  STUDENT DATA:
  - Subjects: ${subjects.length ? subjects.join(', ') : 'not set'}
  - Current CGPA: ${cgpa}
  - Today's classes: ${todayClasses.length ? todayClasses.map(c => `${c.subject} (${c.type}) at ${c.time}`).join(', ') : 'none'}
  - Pending tasks: ${pendingTasks.length ? pendingTasks.map(t => `${t.name} (due: ${t.dueDate || 'no date'})`).join(', ') : 'none'}

  You can help with:
  - Explaining concepts and theories
  - Solving problems step by step
  - Creating study plans based on their schedule
  - Giving practice questions
  - Summarising topics
  - Advising based on their tasks and deadlines

  Be helpful, concise, and encouraging. Reply in the same language the student uses (English or Malay).`;

    // Build Gemini conversation history
    const history = chat.messages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const res = await fetch('/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: history,
        generationConfig: { maxOutputTokens: 1000 }
      })
   });

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response. Please try again.';

    document.getElementById('typing-indicator')?.remove();
    chat.messages.push({ role: 'assistant', content: reply, time: Date.now() });
    saveChats(chats);

    usage.count++;
    saveUsage(usage);

    renderChat();
    renderHistory(document.getElementById('history-filter').value);
    updateUsageUI();

  } catch (err) {
    document.getElementById('typing-indicator')?.remove();
    const errEl = document.createElement('div');
    errEl.className = 'msg';
    errEl.innerHTML = `<div class="msg-av ai">🤖</div><div class="bubble ai" style="color:#f09a6a;">Connection error. Please check your internet and try again.</div>`;
    document.getElementById('chat-messages').appendChild(errEl);
  }

  isLoading = false;
  if (usage.count < FREE_LIMIT) document.getElementById('send-btn').disabled = false;
}

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populateSubjects();
  renderHistory('');
  renderChat();
  updateUsageUI();

  document.getElementById('history-toggle').addEventListener('click', openHistory);
  document.getElementById('history-close').addEventListener('click', closeHistory);
  document.getElementById('history-overlay').addEventListener('click', closeHistory);

  document.getElementById('new-chat-btn').addEventListener('click', () => {
    const chat = { id: genId(), subject: '', title: '', messages: [], createdAt: Date.now() };
    chats.unshift(chat);
    activeChatId = chat.id;
    saveChats(chats);
    closeHistory();
    renderHistory('');
    renderChat();
    document.getElementById('chat-subject').value = '';
    document.getElementById('chat-input').focus();
  });

  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.getElementById('chat-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  document.getElementById('chat-subject').addEventListener('change', function () {
    const chat = chats.find(c => c.id === activeChatId);
    if (chat) { chat.subject = this.value; saveChats(chats); renderHistory(document.getElementById('history-filter').value); }
  });

  document.getElementById('history-filter').addEventListener('change', function () {
    renderHistory(this.value);
  });
});