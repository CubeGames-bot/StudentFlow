function loadTodaySchedule() {
  const classes = JSON.parse(localStorage.getItem('studyos_classes')) || [];
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = days[new Date().getDay()];
  const now = new Date();

  // Filter — recurring hari ni OR one-time tarikh hari ni
  const todayClasses = classes.filter(c => {
    if (c.eventType === 'onetime') {
      const d = new Date(c.date + 'T00:00:00');
      return d.toDateString() === now.toDateString();
    } else {
      return c.day === today;
    }
  });

  // Sort by time
  todayClasses.sort((a, b) => a.time.localeCompare(b.time));

  const container = document.getElementById('today-schedule');
  if (!container) return;

  if (todayClasses.length === 0) {
    container.innerHTML = '<div style="color:#7d8ca3;font-size:12px;padding:12px 0;">No classes today 🎉</div>';
    return;
  }

  container.innerHTML = todayClasses.map(c => {
    const [h, m] = c.time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    const timeStr = `${hour}:${String(m).padStart(2,'0')} ${ampm}`;

    return `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #16253f;">
        <div style="width:3px;height:32px;border-radius:2px;background:${c.color || '#2563eb'};flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="font-size:12px;color:#fff;font-weight:500;">${c.subject}</div>
          <div style="font-size:10px;color:#7d8ca3;">${c.type}${c.location ? ' · ' + c.location : ''}</div>
        </div>
        <div style="font-size:11px;color:#7d8ca3;">${timeStr}</div>
      </div>
    `;
  }).join('');
}

loadTodaySchedule();

function loadDueTasks() {
  const tasks = JSON.parse(localStorage.getItem('studyos_tasks')) || [];
  const container = document.getElementById('due-today');
  if (!container) return;

  const today = new Date();
  today.setHours(0,0,0,0);

  const dueTasks = tasks.filter(t => {
    if (t.status === 'done' || !t.dueDate) return false;
    const d = new Date(t.dueDate + 'T00:00:00');
    return d <= today;
  });

  if (dueTasks.length === 0) {
    container.innerHTML = '<div style="color:#7d8ca3;font-size:12px;padding:8px 0;">No tasks due today 🎉</div>';
    return;
  }

  const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

  container.innerHTML = dueTasks.map(t => {
    const color = priorityColors[t.priority] || '#7d8ca3';
    const isOverdue = new Date(t.dueDate + 'T00:00:00') < today;
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #16253f;">
        <div style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <span style="font-size:12px;color:#fff;flex:1;">${t.name}</span>
        <span style="font-size:10px;color:${isOverdue ? '#f09a6a' : '#7d8ca3'}">
          ${isOverdue ? 'Overdue' : 'Today'}
          ${t.dueTime ? ' · ' + formatTime(t.dueTime) : ''}
        </span>
      </div>
    `;
  }).join('');
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

loadDueTasks();function updateStats() {
  const tasks = JSON.parse(localStorage.getItem('studyos_tasks')) || [];
  const classes = JSON.parse(localStorage.getItem('studyos_classes')) || [];

  const today = new Date();
  today.setHours(0,0,0,0);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = days[new Date().getDay()];

  // Tasks due today + overdue (not done)
  const tasksDue = tasks.filter(t => {
    if (t.status === 'done' || !t.dueDate) return false;
    const d = new Date(t.dueDate + 'T00:00:00');
    return d <= today;
  }).length;

  // Classes today
  const classesToday = classes.filter(c => {
    if (c.eventType === 'onetime') {
      const d = new Date(c.date + 'T00:00:00');
      return d.toDateString() === new Date().toDateString();
    }
    return c.day === todayName;
  }).length;

  // Update DOM
  const tasksDueEl = document.querySelector('.stat-num:first-child') || document.getElementById('stat-tasks');
  const classesEl = document.getElementById('stat-classes');

  // Better — tambah id kat stat cards dalam index.html
  const el1 = document.getElementById('stat-tasks');
  const el2 = document.getElementById('stat-classes');
  if (el1) el1.textContent = tasksDue;
  if (el2) el2.textContent = classesToday;
}

updateStats();
