// ─── SUPABASE CONFIG ───────────────────────────────────
const SUPABASE_URL = 'https://qvzfumruwhbpzetslsjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CnEPDGz4KDvSnpFAFnxZqQ_581Xj6DB';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── AUTH HELPERS ──────────────────────────────────────
async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = '/login.html';
}

// Redirect to login if not authenticated
async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

// ─── CLASSES (TIMETABLE) ───────────────────────────────
async function dbLoadClasses() {
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('classes')
    .select('*')
    .eq('user_id', user.id);
  if (error) { console.error('loadClasses:', error); return []; }
  return data || [];
}

async function dbSaveClass(cls) {
  const user = await getUser();
  if (!user) return null;
  const row = { ...cls, user_id: user.id };
  const { data, error } = await sb
    .from('classes')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) console.error('saveClass:', error);
  return data;
}

async function dbDeleteClass(id) {
  const { error } = await sb.from('classes').delete().eq('id', id);
  if (error) console.error('deleteClass:', error);
}

async function dbUpdateClass(id, updates) {
  const { error } = await sb.from('classes').update(updates).eq('id', id);
  if (error) console.error('updateClass:', error);
}

// ─── TASKS ─────────────────────────────────────────────
async function dbLoadTasks() {
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .eq('user_id', user.id);
  if (error) { console.error('loadTasks:', error); return []; }
  return data || [];
}

async function dbSaveTask(task) {
  const user = await getUser();
  if (!user) return null;
  const row = { ...task, user_id: user.id };
  const { data, error } = await sb
    .from('tasks')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) console.error('saveTask:', error);
  return data;
}

async function dbDeleteTask(id) {
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) console.error('deleteTask:', error);
}

async function dbUpdateTask(id, updates) {
  const { error } = await sb.from('tasks').update(updates).eq('id', id);
  if (error) console.error('updateTask:', error);
}