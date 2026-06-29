// ─── STORAGE ───────────────────────────────────────────
function loadClasses() {
  return JSON.parse(localStorage.getItem('studyos_classes')) || [];
}
function saveClasses(classes) {
  localStorage.setItem('studyos_classes', JSON.stringify(classes));
}
function genId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

// ─── STATE ─────────────────────────────────────────────
let calendar;
let editingId = null;
let selectedColor = '#1e6fcf';
let currentEventType = 'recurring';

const DAY_MAP = {
  Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0
};
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ─── TOGGLE EVENT TYPE ─────────────────────────────────
function setEventType(type) {
  currentEventType = type;

  document.getElementById('btn-recurring').classList.toggle('active', type === 'recurring');
  document.getElementById('btn-onetime').classList.toggle('active', type === 'onetime');
  document.getElementById('row-day').style.display = type === 'recurring' ? 'grid' : 'none';
  document.getElementById('row-date').style.display = type === 'onetime' ? 'grid' : 'none';
}

// ─── CONVERT CLASS → FULLCALENDAR EVENT ────────────────
function classToEvent(cls) {
  const pad = n => String(n).padStart(2, '0');
  const durationMins = Math.round(parseFloat(cls.duration || 1) * 60);

  if (cls.eventType === 'onetime') {
    // one-time: specific date + time
    const [h, m] = cls.time.split(':').map(Number);
    const start = new Date(`${cls.date}T${pad(h)}:${pad(m)}:00`);
    const end = new Date(start.getTime() + durationMins * 60000);
    return {
      id: cls.id,
      title: cls.subject + ' · ' + cls.type,
      start: start.toISOString(),
      end: end.toISOString(),
      backgroundColor: cls.color || '#1e6fcf',
      textColor: '#ffffff',
      extendedProps: { ...cls }
    };
  } else {
    // recurring: every week same day
    const dayNum = DAY_MAP[cls.day];
    const [h, m] = cls.time.split(':').map(Number);
    const startTime = `${pad(h)}:${pad(m)}:00`;
    const totalMins = h * 60 + m + durationMins;
    const endTime = `${pad(Math.floor(totalMins / 60))}:${pad(totalMins % 60)}:00`;
    return {
      id: cls.id,
      title: cls.subject + ' · ' + cls.type,
      daysOfWeek: [dayNum],
      startTime,
      endTime,
      backgroundColor: cls.color || '#1e6fcf',
      textColor: '#ffffff',
      extendedProps: { ...cls }
    };
  }
}

// ─── LEGEND ────────────────────────────────────────────
function buildLegend() {
  const classes = loadClasses();
  const legend = document.getElementById('legend');
  const subjects = {};
  classes.forEach(c => { subjects[c.subject] = c.color || '#1e6fcf'; });
  legend.innerHTML = Object.entries(subjects).map(([name, color]) =>
    `<span class="legend-chip" style="background:${color}22;color:${color};border:1px solid ${color}66">${name}</span>`
  ).join('');
}

function buildSummary() {
  const classes = loadClasses();
  const count = classes.length;
  document.getElementById('week-summary').textContent =
    count + ' event' + (count !== 1 ? 's' : '') + ' scheduled';
}

function updateWeekLabel() {
  if (!calendar) return;
  const view = calendar.view;
  const start = view.currentStart;
  const end = new Date(view.currentEnd);
  end.setDate(end.getDate() - 1);
  const fmt = d => d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
  document.getElementById('week-label').textContent = fmt(start) + ' – ' + fmt(end);
}

// ─── MODAL ─────────────────────────────────────────────
function openModal(mode, cls) {
  editingId = null;
  document.getElementById('modal-delete').style.display = 'none';

  if (mode === 'add') {
    document.getElementById('modal-title').textContent = '+ Add event';
    document.getElementById('f-subject').value = '';
    document.getElementById('f-type').value = 'Lecture';
    document.getElementById('f-day').value = 'Monday';
    document.getElementById('f-time-recurring').value = '08:00';
    document.getElementById('f-date').value = '';
    document.getElementById('f-time-onetime').value = '08:00';
    document.getElementById('f-duration').value = '2';
    document.getElementById('f-location').value = '';
    setColor('#1e6fcf');
    setEventType('recurring');
  } else {
    editingId = cls.id;
    document.getElementById('modal-title').textContent = 'Edit event';
    document.getElementById('f-subject').value = cls.subject;
    document.getElementById('f-type').value = cls.type;
    document.getElementById('f-duration').value = cls.duration || '2';
    document.getElementById('f-location').value = cls.location || '';
    setColor(cls.color || '#1e6fcf');

    if (cls.eventType === 'onetime') {
      setEventType('onetime');
      document.getElementById('f-date').value = cls.date || '';
      document.getElementById('f-time-onetime').value = cls.time || '08:00';
    } else {
      setEventType('recurring');
      document.getElementById('f-day').value = cls.day || 'Monday';
      document.getElementById('f-time-recurring').value = cls.time || '08:00';
    }

    document.getElementById('modal-delete').style.display = 'block';
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-subject').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

function setColor(color) {
  selectedColor = color;
  document.querySelectorAll('.color-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === color);
  });
}

// ─── SAVE ──────────────────────────────────────────────
function saveForm() {
  const subject = document.getElementById('f-subject').value.trim();
  if (!subject) { alert('Please enter a subject name.'); return; }

  const isOnetime = currentEventType === 'onetime';

  if (isOnetime && !document.getElementById('f-date').value) {
    alert('Please pick a date.'); return;
  }

  const cls = {
    id: editingId || genId(),
    eventType: currentEventType,
    subject,
    type: document.getElementById('f-type').value,
    duration: document.getElementById('f-duration').value,
    location: document.getElementById('f-location').value.trim(),
    color: selectedColor,
    // recurring fields
    day: document.getElementById('f-day').value,
    time: isOnetime
      ? document.getElementById('f-time-onetime').value
      : document.getElementById('f-time-recurring').value,
    // one-time fields
    date: isOnetime ? document.getElementById('f-date').value : null,
  };

  let classes = loadClasses();
  if (editingId) {
    classes = classes.map(c => c.id === editingId ? cls : c);
  } else {
    classes.push(cls);
  }

  saveClasses(classes);
  closeModal();
  refreshCalendar();
}

function deleteClass() {
  if (!editingId) return;
  if (!confirm('Remove this event?')) return;
  saveClasses(loadClasses().filter(c => c.id !== editingId));
  closeModal();
  refreshCalendar();
}

function refreshCalendar() {
  calendar.removeAllEvents();
  loadClasses().forEach(cls => calendar.addEvent(classToEvent(cls)));
  buildLegend();
  buildSummary();
}

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const calEl = document.getElementById('calendar');

  calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'timeGridWeek',
    headerToolbar: false,
    allDaySlot: false,
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    height: 500,
    editable: true,
    eventDurationEditable: true,
    nowIndicator: true,
    firstDay: 1,
    dayHeaderFormat: { weekday: 'short', day: 'numeric' },
    slotLabelFormat: { hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short'},

    eventClick: function (info) {
      openModal('edit', info.event.extendedProps);
    },

    eventDrop: function (info) {
      const cls = info.event.extendedProps;
      const newStart = info.event.start;
      let classes = loadClasses();

      if (cls.eventType === 'onetime') {
        const pad = n => String(n).padStart(2, '0');
        const newDate = `${newStart.getFullYear()}-${pad(newStart.getMonth()+1)}-${pad(newStart.getDate())}`;
        const newTime = `${pad(newStart.getHours())}:${pad(newStart.getMinutes())}`;
        classes = classes.map(c => c.id === cls.id ? { ...c, date: newDate, time: newTime } : c);
      } else {
        // recurring — update day + time
        const pad = n => String(n).padStart(2, '0');
        const newDay = DAY_NAMES[newStart.getDay()];
        const newTime = `${pad(newStart.getHours())}:${pad(newStart.getMinutes())}`;
        classes = classes.map(c => c.id === cls.id ? { ...c, day: newDay, time: newTime } : c);
      }

      saveClasses(classes);
      refreshCalendar();
    },

    eventResize: function (info) {
      const cls = info.event.extendedProps;
      const durationMs = info.event.end - info.event.start;
      const durationHours = (durationMs / 3600000).toFixed(1);
      const classes = loadClasses().map(c =>
        c.id === cls.id ? { ...c, duration: durationHours } : c
      );
      saveClasses(classes);
    },

    eventDidMount: function (info) {
      const cls = info.event.extendedProps;
      const tag = cls.eventType === 'onetime' ? '📅 One-time' : '🔁 Recurring';
      info.el.title = `${cls.subject} · ${cls.type}\n${tag}${cls.location ? '\n📍 ' + cls.location : ''}`;
    }
    
  });

  calendar.render();
  loadClasses().forEach(cls => calendar.addEvent(classToEvent(cls)));
  buildLegend();
  buildSummary();
  updateWeekLabel();

  document.getElementById('open-add-form').addEventListener('click', () => openModal('add'));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveForm);
  document.getElementById('modal-delete').addEventListener('click', deleteClass);
  document.getElementById('prev-week').addEventListener('click', () => { calendar.prev(); updateWeekLabel(); });
  document.getElementById('next-week').addEventListener('click', () => { calendar.next(); updateWeekLabel(); });
  document.getElementById('modal-overlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.querySelectorAll('.color-opt').forEach(el => el.addEventListener('click', () => setColor(el.dataset.color)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
});