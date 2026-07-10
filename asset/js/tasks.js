// ─── SUPABASE CONFIG ───────────────────────────────────
const SUPABASE_URL = 'https://qvzfumruwhbpzetslsjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CnEPDGz4KDvSnpFAFnxZqQ_581Xj6DB';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let editingId = null;
let dragId = null;
let activeFilter = 'all';
let searchQuery = '';

const SUBJECT_COLORS = ['#1e6fcf','#16a34a','#c2410c','#b45309','#7c3aed','#be185d','#0f766e'];
const subjectColorMap = {};
let colorIndex = 0;

function getSubjectColor(subject) {
  if (!subject) return '#16253f';
  if (!subjectColorMap[subject]) {
    subjectColorMap[subject] = SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length];
    colorIndex++;
  }
  return subjectColorMap[subject];
}

// ─── DB FUNCTIONS ──────────────────────────────────────
async function loadTasks() {
  if (!currentUser) return [];
  const { data, error } = await sb.from('tasks').select('*').eq('user_id', currentUser.id);
  if (error) { console.error(error); return []; }
  return data || [];
}

async function upsertTask(task) {
  const row = {
    id: task.id,
    user_id: currentUser.id,
    name: task.name,
    subject: task.subject,
    type: task.type,
    priority: task.priority,
    status: task.status,
    due_date: task.dueDate,
    due_time: task.dueTime
  };
  const { error } = await sb.from('tasks').upsert(row, { onConflict: 'id' });
  if (error) console.error('upsertTask:', error);
}

async function deleteTaskDb(id) {
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) console.error('deleteTask:', error);
}

// ─── HELPERS ───────────────────────────────────────────
function genId() {
  return crypto.randomUUID();
}

function isToday(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00').toDateString() === new Date().toDateString();
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(dateStr + 'T00:00:00') < today;
}

function formatDue(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  let label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : diff < 0 ? `${Math.abs(diff)}d overdue` : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
  if (timeStr) { const [h,m] = timeStr.split(':').map(Number); label += ` ${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; }
  return label;
}

// ─── RENDER ────────────────────────────────────────────
async function render() {
  let tasks = await loadTasks();

  // Map DB format to app format
  tasks = tasks.map(t => ({
    id: t.id, name: t.name, subject: t.subject, type: t.type,
    priority: t.priority, status: t.status, dueDate: t.due_date, dueTime: t.due_time
  }));

  // Sync to localStorage for dashboard
  localStorage.setItem('studyos_tasks', JSON.stringify(tasks));

  if (searchQuery) tasks = tasks.filter(t => t.name?.toLowerCase().includes(searchQuery) || t.subject?.toLowerCase().includes(searchQuery));
  let filtered = tasks;
  if (activeFilter === 'today') filtered = tasks.filter(t => isToday(t.dueDate) && t.status !== 'done');
  else if (activeFilter === 'upcoming') filtered = tasks.filter(t => t.status !== 'done' && t.dueDate && !isToday(t.dueDate) && !isOverdue(t.dueDate));
  else if (activeFilter === 'done') filtered = tasks.filter(t => t.status === 'done');

  document.getElementById('count-all').textContent = tasks.filter(t => t.status !== 'done').length;
  document.getElementById('count-today').textContent = tasks.filter(t => isToday(t.dueDate) && t.status !== 'done').length;

  ['todo','inprogress','done'].forEach(status => {
    const colTasks = filtered.filter(t => t.status === status);
    document.getElementById('count-' + status).textContent = colTasks.length;
    const container = document.getElementById('cards-' + status);
    container.innerHTML = colTasks.map(t => renderCard(t)).join('');
  });

  document.querySelectorAll('.task-card').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('dragstart', () => { dragId = id; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); });
    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('task-checkbox') || e.target.closest('.task-checkbox')) return;
      const allTasks = await loadTasks();
      const task = allTasks.find(t => t.id === id);
      if (task) openModal('edit', { id: task.id, name: task.name, subject: task.subject, type: task.type, priority: task.priority, status: task.status, dueDate: task.due_date, dueTime: task.due_time });
    });
    const cb = el.querySelector('.task-checkbox');
    if (cb) cb.addEventListener('click', e => { e.stopPropagation(); toggleDone(id); });
  });
}

function renderCard(task) {
  const color = getSubjectColor(task.subject);
  const isDone = task.status === 'done';
  const dueLabel = formatDue(task.dueDate, task.dueTime);
  const overdue = isOverdue(task.dueDate) && !isDone;
  return `
    <div class="task-card" draggable="true" data-id="${task.id}">
      <div class="task-top">
        <div class="priority-dot p-${task.priority || 'medium'}"></div>
        <div class="task-checkbox ${isDone ? 'checked' : ''}">${isDone ? '✓' : ''}</div>
        <div class="task-name ${isDone ? 'done-text' : ''}">${task.name}</div>
      </div>
      <div class="task-meta">
        ${task.subject ? `<span class="task-tag" style="background:${color}22;color:${color}">${task.subject}</span>` : ''}
        ${task.type ? `<span class="task-tag" style="background:#16253f;color:#7d8ca3">${task.type}</span>` : ''}
        ${dueLabel ? `<span class="task-due ${overdue ? 'overdue' : ''}">⏰ ${dueLabel}</span>` : ''}
      </div>
    </div>`;
}

// ─── DRAG & DROP ───────────────────────────────────────
async function onDrop(e, status) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragId) return;
  await sb.from('tasks').update({ status }).eq('id', dragId);
  await render();
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

// ─── TOGGLE DONE ───────────────────────────────────────
async function toggleDone(id) {
  const { data } = await sb.from('tasks').select('status').eq('id', id).single();
  if (!data) return;
  const newStatus = data.status === 'done' ? 'todo' : 'done';
  await sb.from('tasks').update({ status: newStatus }).eq('id', id);
  await render();
}

// ─── MODAL ─────────────────────────────────────────────
function openModal(mode, task, defaultStatus) {
  editingId = null;
  document.getElementById('modal-delete').style.display = 'none';
  if (mode === 'add') {
    document.getElementById('modal-title').textContent = '+ Add task';
    document.getElementById('f-name').value = '';
    document.getElementById('f-subject').value = '';
    document.getElementById('f-type').value = 'Assignment';
    document.getElementById('f-priority').value = 'medium';
    document.getElementById('f-status').value = defaultStatus || 'todo';
    document.getElementById('f-date').value = '';
    document.getElementById('f-time').value = '';
  } else {
    editingId = task.id;
    document.getElementById('modal-title').textContent = 'Edit task';
    document.getElementById('f-name').value = task.name;
    document.getElementById('f-subject').value = task.subject || '';
    document.getElementById('f-type').value = task.type || 'Assignment';
    document.getElementById('f-priority').value = task.priority || 'medium';
    document.getElementById('f-status').value = task.status || 'todo';
    document.getElementById('f-date').value = task.dueDate || '';
    document.getElementById('f-time').value = task.dueTime || '';
    document.getElementById('modal-delete').style.display = 'block';
  }
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-name').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

async function saveTask() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { alert('Please enter a task name.'); return; }
  const task = {
    id: editingId || genId(),
    name,
    subject: document.getElementById('f-subject').value.trim(),
    type: document.getElementById('f-type').value,
    priority: document.getElementById('f-priority').value,
    status: document.getElementById('f-status').value,
    dueDate: document.getElementById('f-date').value,
    dueTime: document.getElementById('f-time').value,
  };
  await upsertTask(task);
  closeModal();
  await render();
}

async function deleteTask() {
  if (!editingId) return;
  if (!confirm('Delete this task?')) return;
  await deleteTaskDb(editingId);
  closeModal();
  await render();
}

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { window.location.href = '../login.html'; return; }
  currentUser = user;

  await render();

  document.getElementById('open-add-task').addEventListener('click', () => openModal('add'));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveTask);
  document.getElementById('modal-delete').addEventListener('click', deleteTask);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase();
    render();
  });

  document.querySelectorAll('.k-add-inline, .k-add-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal('add', null, btn.dataset.status));
  });

  document.getElementById('clear-done').addEventListener('click', async () => {
    if (!confirm('Clear all completed tasks?')) return;
    const { data } = await sb.from('tasks').select('id').eq('user_id', currentUser.id).eq('status', 'done');
    if (data) await Promise.all(data.map(t => sb.from('tasks').delete().eq('id', t.id)));
    await render();
  });

  // drag over/drop on columns
  document.querySelectorAll('.k-cards').forEach(el => {
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', e => onDrop(e, el.closest('.k-col').dataset.status));
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  });
});