// ─── SUPABASE CONFIG ───────────────────────────────────
const SUPABASE_URL = 'https://qvzfumruwhbpzetslsjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CnEPDGz4KDvSnpFAFnxZqQ_581Xj6DB';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// ─── LOAD CLASSES FROM SUPABASE ────────────────────────
async function loadClasses() {
  if (!currentUser) return [];
  const { data, error } = await sb
    .from('classes')
    .select('*')
    .eq('user_id', currentUser.id);
  if (error) { console.error(error); return []; }
  return data || [];
}

// ─── SAVE CLASS TO SUPABASE ────────────────────────────
async function saveClassToDb(cls) {
  const row = {
    id: cls.id,
    user_id: currentUser.id,
    subject: cls.subject,
    type: cls.type,
    event_type: cls.eventType,
    day: cls.day,
    time: cls.time,
    date: cls.date,
    duration: cls.duration,
    location: cls.location,
    color: cls.color
  };
  const { error } = await sb.from('classes').upsert(row, { onConflict: 'id' });
  if (error) console.error('saveClass:', error);
}

// ─── DELETE CLASS FROM SUPABASE ────────────────────────
async function deleteClassFromDb(id) {
  const { error } = await sb.from('classes').delete().eq('id', id);
  if (error) console.error('deleteClass:', error);
}

// ─── KEEP LOCALSTORAGE IN SYNC (for dashboard) ─────────
function syncToLocalStorage(classes) {
  const formatted = classes.map(c => ({
    id: c.id,
    subject: c.subject,
    type: c.type,
    eventType: c.event_type,
    day: c.day,
    time: c.time,
    date: c.date,
    duration: c.duration,
    location: c.location,
    color: c.color
  }));
  localStorage.setItem('studyos_classes', JSON.stringify(formatted));
}

// ─── DAY HELPERS ───────────────────────────────────────
const DAY_MAP = {
  Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0
};
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function classToEvent(cls) {
  const pad = n => String(n).padStart(2, '0');
  const durationMins = Math.round(parseFloat(cls.duration || 1) * 60);
  const eventType = cls.event_type || cls.eventType;

  if (eventType === 'onetime') {
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
    const dayNum = DAY_MAP[cls.day];
    const [h, m] = cls.time.split(':').map(Number);
    const startTime = `${pad(h)}:${pad(m)}:00`;
    const totalMins = h * 60 + m + durationMins;
    const endTime = `${pad(Math.floor(totalMins/60))}:${pad(totalMins%60)}:00`;
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

// ─── STATE ─────────────────────────────────────────────
let calendar;
let editingId = null;
let selectedColor = '#1e6fcf';
let currentEventType = 'recurring';

function setEventType(type) {
  currentEventType = type;
  document.getElementById('btn-recurring').classList.toggle('active', type === 'recurring');
  document.getElementById('btn-onetime').classList.toggle('active', type === 'onetime');
  document.getElementById('row-day').style.display = type === 'recurring' ? 'grid' : 'none';
  document.getElementById('row-date').style.display = type === 'onetime' ? 'grid' : 'none';
}

function buildLegend(classes) {
  const legend = document.getElementById('legend');
  const subjects = {};
  classes.forEach(c => { subjects[c.subject] = c.color || '#1e6fcf'; });
  legend.innerHTML = Object.entries(subjects).map(([name, color]) =>
    `<span class="legend-chip" style="background:${color}22;color:${color};border:1px solid ${color}66">${name}</span>`
  ).join('');
}

function buildSummary(classes) {
  document.getElementById('week-summary').textContent =
    classes.length + ' event' + (classes.length !== 1 ? 's' : '') + ' scheduled';
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
    const et = cls.event_type || cls.eventType;
    if (et === 'onetime') {
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

// ─── SAVE / DELETE ─────────────────────────────────────
async function saveForm() {
  const subject = document.getElementById('f-subject').value.trim();
  if (!subject) { alert('Please enter a subject name.'); return; }
  const isOnetime = currentEventType === 'onetime';
  if (isOnetime && !document.getElementById('f-date').value) { alert('Please pick a date.'); return; }

  const cls = {
    id: editingId || crypto.randomUUID(),
    eventType: currentEventType,
    subject,
    type: document.getElementById('f-type').value,
    duration: document.getElementById('f-duration').value,
    location: document.getElementById('f-location').value.trim(),
    color: selectedColor,
    day: document.getElementById('f-day').value,
    time: isOnetime ? document.getElementById('f-time-onetime').value : document.getElementById('f-time-recurring').value,
    date: isOnetime ? document.getElementById('f-date').value : null,
  };

  await saveClassToDb(cls);
  closeModal();
  await refreshCalendar();
}

async function deleteClass() {
  if (!editingId) return;
  if (!confirm('Remove this event?')) return;
  await deleteClassFromDb(editingId);
  closeModal();
  await refreshCalendar();
}

async function refreshCalendar() {
  const classes = await loadClasses();
  syncToLocalStorage(classes);
  calendar.removeAllEvents();
  classes.forEach(cls => calendar.addEvent(classToEvent(cls)));
  buildLegend(classes);
  buildSummary(classes);
}

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  // Check auth
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { window.location.href = '../login.html'; return; }
  currentUser = user;

  const calEl = document.getElementById('calendar');
  if (typeof FullCalendar === 'undefined') {
    calEl.innerHTML = '<div style="padding:40px;text-align:center;color:#f09a6a;">⚠️ Calendar failed to load. Please check your internet connection and refresh.</div>';
    return;
  }

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
    slotLabelFormat: { hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short', hour12: true },

    eventClick: function (info) { openModal('edit', info.event.extendedProps); },

    eventDrop: async function (info) {
      const cls = info.event.extendedProps;
      const newStart = info.event.start;
      const pad = n => String(n).padStart(2, '0');
      const et = cls.event_type || cls.eventType;

      if (et === 'onetime') {
        const newDate = `${newStart.getFullYear()}-${pad(newStart.getMonth()+1)}-${pad(newStart.getDate())}`;
        const newTime = `${pad(newStart.getHours())}:${pad(newStart.getMinutes())}`;
        await sb.from('classes').update({ date: newDate, time: newTime }).eq('id', cls.id);
      } else {
        const newDay = DAY_NAMES[newStart.getDay()];
        const newTime = `${pad(newStart.getHours())}:${pad(newStart.getMinutes())}`;
        await sb.from('classes').update({ day: newDay, time: newTime }).eq('id', cls.id);
      }
      await refreshCalendar();
    },

    eventResize: async function (info) {
      const cls = info.event.extendedProps;
      const durationMs = info.event.end - info.event.start;
      const durationHours = (durationMs / 3600000).toFixed(1);
      await sb.from('classes').update({ duration: durationHours }).eq('id', cls.id);
    },

    eventDidMount: function (info) {
      const cls = info.event.extendedProps;
      const et = cls.event_type || cls.eventType;
      const tag = et === 'onetime' ? '📅 One-time' : '🔁 Recurring';
      info.el.title = `${cls.subject} · ${cls.type}\n${tag}${cls.location ? '\n📍 ' + cls.location : ''}`;
    }
  });

  calendar.render();
  await refreshCalendar();
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
