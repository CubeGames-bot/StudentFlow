// ─── GRADE POINTS (Malaysia 4.0) ───────────────────────
const GRADE_POINTS = {
  'A': 4.00, 'A-': 3.67,
  'B+': 3.33, 'B': 3.00, 'B-': 2.67,
  'C+': 2.33, 'C': 2.00, 'C-': 1.67,
  'D+': 1.33, 'D': 1.00,
  'F': 0.00
};
const GRADES = Object.keys(GRADE_POINTS);

// ─── STORAGE ───────────────────────────────────────────
function loadData() {
  return JSON.parse(localStorage.getItem('studyos_gpa')) || {
    semesters: [{ id: 'sem_1', name: 'Semester 1', subjects: [] }],
    activeSem: 'sem_1',
    settings: { deansThreshold: 3.50, uni: '' }
  };
}
function saveData(data) {
  localStorage.setItem('studyos_gpa', JSON.stringify(data));
}
function genSemId() {
  return 'sem_' + Date.now();
}

// ─── STATE ─────────────────────────────────────────────
let data = loadData();

function getActiveSem() {
  return data.semesters.find(s => s.id === data.activeSem) || data.semesters[0];
}

// ─── RENDER TABS ───────────────────────────────────────
function renderTabs() {
  const container = document.getElementById('sem-tabs');
  container.innerHTML = data.semesters.map(sem => `
    <button class="sem-tab ${sem.id === data.activeSem ? 'active' : ''}" data-id="${sem.id}">
      ${sem.name}
      ${data.semesters.length > 1 ? `<span class="sem-tab-del" data-del="${sem.id}">✕</span>` : ''}
    </button>
  `).join('');

  container.querySelectorAll('.sem-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.classList.contains('sem-tab-del')) return;
      data.activeSem = btn.dataset.id;
      saveData(data);
      renderTabs();
      renderRows();
      calculate();
    });
  });

  container.querySelectorAll('.sem-tab-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('Remove this semester?')) return;
      data.semesters = data.semesters.filter(s => s.id !== btn.dataset.del);
      if (!data.semesters.find(s => s.id === data.activeSem)) {
        data.activeSem = data.semesters[0].id;
      }
      saveData(data);
      renderTabs();
      renderRows();
      calculate();
    });
  });
}

// ─── RENDER SUBJECT ROWS ───────────────────────────────
function renderRows() {
  const sem = getActiveSem();
  const container = document.getElementById('subject-rows');

  if (sem.subjects.length === 0) {
    container.innerHTML = `<div style="padding:16px 12px;font-size:11px;color:#7d8ca3;text-align:center;">No subjects yet — click "+ Add subject"</div>`;
    return;
  }

  container.innerHTML = sem.subjects.map((s, i) => `
    <div class="table-row" data-index="${i}">
      <div class="td">
        <input class="subj-name" data-i="${i}" value="${s.name}" placeholder="Subject name">
      </div>
      <div class="td">
        <input class="subj-credit" data-i="${i}" type="number" min="1" max="6" value="${s.credit}" style="width:60px">
      </div>
      <div class="td">
        <select class="subj-grade" data-i="${i}">
          ${GRADES.map(g => `<option ${g === s.grade ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="td">
        <button class="del-btn" data-i="${i}">✕</button>
      </div>
    </div>
  `).join('');

  // events
  container.querySelectorAll('.subj-name').forEach(el => {
    el.addEventListener('input', () => {
      getActiveSem().subjects[el.dataset.i].name = el.value;
      saveData(data);
    });
  });
  container.querySelectorAll('.subj-credit').forEach(el => {
    el.addEventListener('input', () => {
      getActiveSem().subjects[el.dataset.i].credit = parseFloat(el.value) || 0;
      saveData(data);
    });
  });
  container.querySelectorAll('.subj-grade').forEach(el => {
    el.addEventListener('change', () => {
      getActiveSem().subjects[el.dataset.i].grade = el.value;
      saveData(data);
      calculate();
    });
  });
  container.querySelectorAll('.del-btn').forEach(el => {
    el.addEventListener('click', () => {
      getActiveSem().subjects.splice(parseInt(el.dataset.i), 1);
      saveData(data);
      renderRows();
      calculate();
    });
  });
}

// ─── CALCULATE ─────────────────────────────────────────
function calculate() {
  const sem = getActiveSem();
  const subjects = sem.subjects.filter(s => s.name && s.credit > 0);
  const threshold = parseFloat(data.settings.deansThreshold) || 3.50;

  if (subjects.length === 0) {
    document.getElementById('sem-gpa').textContent = '—';
    document.getElementById('sem-label').textContent = 'Add subjects to calculate';
    document.getElementById('sem-bar').style.width = '0%';
    document.getElementById('r-credits').textContent = '—';
    document.getElementById('r-points').textContent = '—';
    document.getElementById('r-subjects').textContent = '—';
    document.getElementById('r-status').textContent = '—';
    document.getElementById('r-status').style.color = '#7d8ca3';
    renderCGPA();
    renderDist(subjects);
    return;
  }

  let totalCredits = 0;
  let totalPoints = 0;

  subjects.forEach(s => {
    const pts = GRADE_POINTS[s.grade] ?? 0;
    totalCredits += s.credit;
    totalPoints += pts * s.credit;
  });

  const gpa = totalPoints / totalCredits;
  const gpaStr = gpa.toFixed(2);
  const pct = (gpa / 4.0) * 100;

  // gpa color
  let gpaColor = '#ef4444';
  if (gpa >= 3.67) gpaColor = '#22c55e';
  else if (gpa >= 3.00) gpaColor = '#7eb3f7';
  else if (gpa >= 2.00) gpaColor = '#f0c46a';

  document.getElementById('sem-gpa').textContent = gpaStr;
  document.getElementById('sem-gpa').style.color = gpaColor;
  document.getElementById('sem-label').textContent = `${sem.name} · ${totalCredits} credit hours`;
  document.getElementById('sem-bar').style.width = pct + '%';
  document.getElementById('sem-bar').style.background = gpaColor;
  document.getElementById('r-credits').textContent = totalCredits;
  document.getElementById('r-points').textContent = totalPoints.toFixed(2);
  document.getElementById('r-subjects').textContent = subjects.length;

  // dean's list status
  const statusEl = document.getElementById('r-status');
  if (gpa >= threshold) {
    statusEl.textContent = `Dean's List ✓ (≥${threshold})`;
    statusEl.style.color = '#22c55e';
  } else {
    const diff = (threshold - gpa).toFixed(2);
    statusEl.textContent = `${diff} away from Dean's List`;
    statusEl.style.color = '#f0c46a';
  }

  // save sem gpa
  sem.gpa = parseFloat(gpaStr);
  sem.totalCredits = totalCredits;
  sem.totalPoints = totalPoints;
  saveData(data);

  // save CGPA to localStorage for dashboard
  renderCGPA();
  renderDist(subjects);
}

// ─── CGPA ──────────────────────────────────────────────
function renderCGPA() {
  const calculated = data.semesters.filter(s => s.gpa !== undefined);

  if (calculated.length === 0) {
    document.getElementById('cgpa-val').textContent = '—';
    document.getElementById('cgpa-label').textContent = 'No semesters calculated yet';
    document.getElementById('r-total-credits').textContent = '—';
    document.getElementById('r-semesters').textContent = '—';
    localStorage.removeItem('studyos_cgpa');
    return;
  }

  let totalPts = 0, totalCreds = 0;
  calculated.forEach(s => {
    totalPts += s.totalPoints || 0;
    totalCreds += s.totalCredits || 0;
  });

  const cgpa = (totalPts / totalCreds).toFixed(2);
  document.getElementById('cgpa-val').textContent = cgpa;
  document.getElementById('cgpa-label').textContent = `Across ${calculated.length} semester${calculated.length > 1 ? 's' : ''}`;
  document.getElementById('r-total-credits').textContent = totalCreds;
  document.getElementById('r-semesters').textContent = calculated.length;

  // save for dashboard
  localStorage.setItem('studyos_cgpa', cgpa);
}

// ─── GRADE DISTRIBUTION ────────────────────────────────
function renderDist(subjects) {
  const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const colors = { A: '#22c55e', B: '#7eb3f7', C: '#f0c46a', D: '#f09a6a', F: '#ef4444' };

  subjects.forEach(s => {
    const g = s.grade;
    if (g.startsWith('A')) dist.A++;
    else if (g.startsWith('B')) dist.B++;
    else if (g.startsWith('C')) dist.C++;
    else if (g.startsWith('D')) dist.D++;
    else if (g === 'F') dist.F++;
  });

  const max = Math.max(...Object.values(dist), 1);
  const container = document.getElementById('grade-dist');

  container.innerHTML = Object.entries(dist).map(([grade, count]) => `
    <div class="dist-row">
      <div class="dist-lbl">${grade}</div>
      <div class="dist-bar-wrap">
        <div class="dist-bar" style="width:${(count/max)*100}%;background:${colors[grade]}"></div>
      </div>
      <div class="dist-count">${count}</div>
    </div>
  `).join('');
}

// ─── SETTINGS ──────────────────────────────────────────
function openSettings() {
  document.getElementById('s-deans').value = data.settings.deansThreshold || 3.50;
  document.getElementById('s-uni').value = data.settings.uni || '';
  document.getElementById('settings-overlay').classList.remove('hidden');
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
}
function saveSettings() {
  data.settings.deansThreshold = parseFloat(document.getElementById('s-deans').value) || 3.50;
  data.settings.uni = document.getElementById('s-uni').value.trim();
  saveData(data);
  closeSettings();
  calculate();
}

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  renderRows();
  calculate();

  document.getElementById('add-semester').addEventListener('click', () => {
    const name = prompt('Semester name:', `Semester ${data.semesters.length + 1}`);
    if (!name) return;
    const sem = { id: genSemId(), name, subjects: [] };
    data.semesters.push(sem);
    data.activeSem = sem.id;
    saveData(data);
    renderTabs();
    renderRows();
    calculate();
  });

  document.getElementById('add-subject').addEventListener('click', () => {
    getActiveSem().subjects.push({ name: '', credit: 3, grade: 'A' });
    saveData(data);
    renderRows();
  });

  document.getElementById('calculate-btn').addEventListener('click', () => {
    // sync values from inputs
    const sem = getActiveSem();
    document.querySelectorAll('.subj-name').forEach(el => {
      sem.subjects[el.dataset.i].name = el.value;
    });
    document.querySelectorAll('.subj-credit').forEach(el => {
      sem.subjects[el.dataset.i].credit = parseFloat(el.value) || 0;
    });
    document.querySelectorAll('.subj-grade').forEach(el => {
      sem.subjects[el.dataset.i].grade = el.value;
    });
    saveData(data);
    calculate();
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    if (!confirm('Clear all subjects in this semester?')) return;
    getActiveSem().subjects = [];
    getActiveSem().gpa = undefined;
    getActiveSem().totalCredits = undefined;
    getActiveSem().totalPoints = undefined;
    saveData(data);
    renderRows();
    calculate();
  });

  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-cancel').addEventListener('click', closeSettings);
  document.getElementById('settings-save').addEventListener('click', saveSettings);
  document.getElementById('settings-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });
});