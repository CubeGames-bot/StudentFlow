// ─── STORAGE ───────────────────────────────────────────
function loadTasks() {
  return JSON.parse(localStorage.getItem('studyos_tasks')) || [];
}
function saveTasks(tasks) {
  localStorage.setItem('studyos_tasks', JSON.stringify(tasks));
}
function genId() {
  const count = parseInt(localStorage.getItem('task_counter') || '0') + 1;
  localStorage.setItem('task_counter', count);
  return 'task_' + count;
}

// ─── STATE ─────────────────────────────────────────────
let editingId = null;
let dragId = null;
let activeFilter = 'all';
let searchQuery = '';

const SUBJECT_COLORS = [
  '#1e6fcf','#16a34a','#c2410c','#b45309','#7c3aed','#be185d','#0f766e'
];
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

// ─── DATE HELPERS ──────────────────────────────────────
function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return d.toDateString() === today.toDateString();
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  return d < today;
}

function formatDue(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  let label = '';
  if (diff === 0) label = 'Today';
  else if (diff === 1) label = 'Tomorrow';
  else if (diff === -1) label = 'Yesterday';
  else if (diff < 0) label = `${Math.abs(diff)}d overdue`;
  else label = d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
  if (timeStr) label += ' ' + formatTime(timeStr);
  return label;
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ─── RENDER ────────────────────────────────────────────
function render() {
  let tasks = loadTasks();

  // apply search
  if (searchQuery) {
    tasks = tasks.filter(t =>
      t.name.toLowerCase().includes(searchQuery) ||
      (t.subject && t.subject.toLowerCase().includes(searchQuery))
    );
  }

  // apply filter
  let filtered = tasks;
  if (activeFilter === 'today') filtered = tasks.filter(t => isToday(t.dueDate) && t.status !== 'done');
  else if (activeFilter === 'upcoming') filtered = tasks.filter(t => t.status !== 'done' && t.dueDate && !isToday(t.dueDate) && !isOverdue(t.dueDate));
  else if (activeFilter === 'done') filtered = tasks.filter(t => t.status === 'done');

  // update counts
  document.getElementById('count-all').textContent = tasks.filter(t => t.status !== 'done').length;
  document.getElementById('count-today').textContent = tasks.filter(t => isToday(t.dueDate) && t.status !== 'done').length;

  const statuses = ['todo', 'inprogress', 'done'];
  statuses.forEach(status => {
    const colTasks = filtered.filter(t => t.status === status);
    document.getElementById('count-' + status).textContent = colTasks.length;
    const container = document.getElementById('cards-' + status);
    container.innerHTML = colTasks.map(t => renderCard(t)).join('');
  });

  // attach card events
  document.querySelectorAll('.task-card').forEach(el => {
    const id = el.dataset.id;
    // drag
    el.addEventListener('dragstart', () => { dragId = id; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); });
    // edit on card click
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-checkbox') || e.target.closest('.task-checkbox')) return;
      openModal('edit', loadTasks().find(t => t.id === id));
    });
    // checkbox
    const cb = el.querySelector('.task-checkbox');
    if (cb) {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDone(id);
      });
    }
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
    </div>
  `;
}

// ─── DRAG & DROP ───────────────────────────────────────
function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDrop(e, status) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragId) return;
  const tasks = loadTasks().map(t =>
    t.id === dragId ? { ...t, status } : t
  );
  saveTasks(tasks);
  render();
}

document.addEventListener('dragover', () => {
  document.querySelectorAll('.k-cards').forEach(el => el.classList.remove('drag-over'));
});

// ─── TOGGLE DONE ───────────────────────────────────────
function toggleDone(id) {
  const tasks = loadTasks().map(t => {
    if (t.id !== id) return t;
    return { ...t, status: t.status === 'done' ? 'todo' : 'done' };
  });
  saveTasks(tasks);
  render();
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

function saveTask() {
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

  let tasks = loadTasks();
  if (editingId) {
    tasks = tasks.map(t => t.id === editingId ? task : t);
  } else {
    tasks.push(task);
  }

  saveTasks(tasks);
  closeModal();
  render();
}

function deleteTask() {
  if (!editingId) return;
  if (!confirm('Delete this task?')) return;
  saveTasks(loadTasks().filter(t => t.id !== editingId));
  closeModal();
  render();
}

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  render();

  document.getElementById('open-add-task').addEventListener('click', () => openModal('add'));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveTask);
  document.getElementById('modal-delete').addEventListener('click', deleteTask);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // filter tabs
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  // search
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase();
    render();
  });

  // add task buttons in columns
  document.querySelectorAll('.k-add-inline, .k-add-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal('add', null, btn.dataset.status));
  });

  // clear done
  document.getElementById('clear-done').addEventListener('click', () => {
    if (!confirm('Clear all completed tasks?')) return;
    saveTasks(loadTasks().filter(t => t.status !== 'done'));
    render();
  });
});