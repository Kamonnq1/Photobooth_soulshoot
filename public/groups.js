const u8 = b => Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
let groupsCache = [], momentsCache = [], membersOpen = false;
const enc = encodeURIComponent, curGroup = () => groupsCache.find(g => g.id === $('groupSel').value);
const toast = t => { const e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2800); };
const mk = (t, c, f, label) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.className = c; b.onclick = f; if (label) { b.title = label; b.setAttribute('aria-label', label); } return b; };

async function ensureMe() { // สมัครแบบง่าย: ชื่อ + token เก็บในเครื่อง
  if (me) return true;
  if (!$('name').value.trim()) { alert('ใส่ชื่อของคุณก่อน'); $('name').focus(); return false; }
  const r = await fetch('/api/users', J({ name: $('name').value || 'guest' }));
  if (!r.ok) return false;
  me = await r.json(); localStorage.me = JSON.stringify(me); return true;
}
function qrCanvas(text, px) { // สร้าง QR ด้วยไลบรารี qrcode-generator: พื้นขาวตัวดำเสมอ (สแกนง่ายแม้เปิดโหมดมืด) เว้นขอบ 4 โมดูลตามมาตรฐาน
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), cell = Math.max(2, Math.floor(px / (n + 8))), size = cell * (n + 8), c = document.createElement('canvas');
  c.width = c.height = size; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + 4) * cell, (r + 4) * cell, cell, cell);
  return c;
}
function shareInvite(code, mid, title) { // กดแล้วขึ้น popup: QR ตรงกลาง ลิงก์ด้านล่าง แชร์/คัดลอก/บันทึก QR ได้ ปิดด้วย ✕ / Esc / แตะฉากหลัง
  const url = `${location.origin}/?g=${code}` + (mid ? `&m=${mid}` : ''), g = groupsCache.find(x => x.code === code);
  const { box, close } = SoulSheet('ชวนเพื่อน');
  const x = mk('✕', 'calnav popx', close, 'ปิด'), h = document.createElement('h3'), sub = document.createElement('p'), wrap = document.createElement('div'), qc = qrCanvas(url, 520);
  h.className = 'calh'; h.textContent = mid ? `ชวนถ่ายรูป “${title || ''}”` : `ชวนเข้ากลุ่ม “${g ? g.name : ''}”`;
  sub.className = 'calnote'; sub.textContent = 'ให้เพื่อนสแกน QR ด้วยกล้องมือถือ หรือส่งลิงก์ให้ — ใส่แค่ชื่อก็เข้าได้';
  wrap.className = 'qrwrap'; qc.className = 'qrimg'; qc.setAttribute('role', 'img'); qc.setAttribute('aria-label', 'QR code สำหรับเข้าร่วม'); wrap.append(qc);
  const row = document.createElement('div'), inp = document.createElement('input'); row.className = 'qrlink'; inp.readOnly = true; inp.value = url; inp.setAttribute('aria-label', 'ลิงก์เชิญ'); inp.onfocus = () => inp.select();
  const copy = mk('คัดลอก', '', async () => { try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch { inp.select(); document.execCommand && document.execCommand('copy'); toast('คัดลอกลิงก์แล้ว'); } });
  row.append(inp, copy);
  const acts = document.createElement('div'); acts.className = 'acts two';
  if (navigator.share) acts.append(mk('แชร์…', 'primary', () => navigator.share({ title: 'SOULSHOOT', text: mid ? `มาถ่ายรูป “${title}” ด้วยกัน` : 'มาร่วมกลุ่มถ่ายรูปด้วยกัน', url }).catch(() => {})));
  acts.append(mk('บันทึก QR เป็นรูป', navigator.share ? '' : 'primary', () => { const hi = qrCanvas(url, 900), a = document.createElement('a'); a.download = 'soulshoot-qr.png'; hi.toBlob(b => { a.href = URL.createObjectURL(b); document.body.append(a); a.click(); a.remove(); }); }));
  box.append(x, h, sub, wrap, row, acts, mk('ปิด', 'calclose', close));
  const f = box.querySelector('.popx'); f && f.focus();
}
async function loadGroups(selectId) {
  if (!me) return;
  const r = await fetch('/api/groups'); groupsCache = r.ok ? await r.json() : [];
  $('groupSel').innerHTML = groupsCache.length ? groupsCache.map(g => `<option value="${esc(g.id)}">${esc(g.name)} · ${g.n} คน · รหัส ${esc(g.code)}${g.isOwner ? ' · หัวหน้า' : ''}</option>`).join('') : '<option value="">ยังไม่มีกลุ่ม</option>';
  // เลือกกลุ่มที่ระบุ → กลุ่มที่เลือกไว้ครั้งก่อน (จำไว้ในเครื่อง รีเฟรชแล้วไม่หาย) → กลุ่มแรก
  const want = [selectId, localStorage.groupId].find(id => id && groupsCache.some(g => g.id === id));
  if (want) $('groupSel').value = want;
  localStorage.groupId = $('groupSel').value;
  joinSelectedGroup(); loadMoments(); updateSteps(); renderMembers();
}
function joinSelectedGroup() {
  const groupId = $('groupSel').value;
  if (me && groupId) socket.emit('group_join', { groupId, token: me.token });
}
async function loadMoments() { // รายการ Moment ของกลุ่มที่เลือก: เข้าร่วม / ชวนเพื่อน / ลบ
  const g = $('groupSel').value, box = $('moments'), cur = curGroup();
  if (!me || !g) { box.innerHTML = ''; momentsCache = []; return; }
  const r = await fetch(`/api/groups/${enc(g)}/moments`);
  momentsCache = r.ok ? await r.json() : [];
  box.innerHTML = `<p class="hint">${momentsCache.length ? 'Moment ในกลุ่มนี้ · กดเข้าร่วมได้เลย' : 'ยังไม่มี Moment — สร้างอันแรกได้เลย'}</p>`;
  momentsCache.forEach(m => {
    const d = document.createElement('div'), acts = document.createElement('div');
    d.className = 'card'; acts.className = 'acts';
    const when = new Date(m.startAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    d.innerHTML = `<b>${esc(m.title)}</b><div><small>${when} · ${m.n} รูป</small></div>`;
    acts.append(mk(m.startAt > Date.now() ? 'เข้าร่วม' : 'เปิดดู / ถ่าย', 'go', () => enter(m.id)));
    acts.append(mk('🔗', 'ic', () => cur && shareInvite(cur.code, m.id, m.title), 'ชวนเพื่อนเข้า Moment นี้'));
    if (m.startAt > Date.now()) acts.append(mk('📅', 'ic', () => cur && openAddCal({ id: m.id, title: m.title, start: m.startAt, code: cur.code }), 'เพิ่มลงปฏิทิน')); // เฉพาะที่ยังไม่ถึงเวลา
    if (m.del) acts.append(mk('🗑', 'ic', async () => {
      if (!confirm(`ลบ Moment “${m.title}”?\nรูปและ Frame ของ Moment นี้จะหายจากรายการ`)) return;
      const x = await fetch('/api/moments/' + m.id, { method: 'DELETE' });
      toast(x.ok ? 'ลบแล้ว' : 'ลบไม่สำเร็จ'); loadMoments();
    }, 'ลบ Moment'));
    d.append(acts); box.append(d);
  });
}
async function renderMembers() { // รายชื่อสมาชิก: ทุกคนดูได้ / หัวหน้ากลุ่มเตะออกได้ / ทุกคนออกจากกลุ่มได้
  const box = $('membersBox'), g = curGroup();
  box.hidden = !(membersOpen && g);
  $('gMembers').textContent = membersOpen ? '👥 ซ่อนสมาชิก' : '👥 สมาชิก';
  if (box.hidden) return;
  const r = await fetch(`/api/groups/${enc(g.id)}/members`);
  const list = r.ok ? await r.json() : [];
  box.innerHTML = `<p class="hint">สมาชิก ${list.length} คน${g.isOwner ? ' · คุณเป็นหัวหน้ากลุ่ม จัดการสมาชิกได้' : ''}</p>`;
  list.forEach(u => {
    const row = document.createElement('div'); row.className = 'mrow';
    row.innerHTML = `<span class="av">${esc([...u.name][0] || '?')}</span><span class="nm">${esc(u.name)}${u.me ? ' (คุณ)' : ''}</span>${u.owner ? '<span class="bd">หัวหน้า</span>' : ''}`;
    if (g.isOwner && !u.me) row.append(mk('เตะออก', 'kick', async () => {
      if (!confirm(`เตะ “${u.name}” ออกจากกลุ่ม?\n(เขากลับเข้ามาได้ถ้ามีลิงก์หรือรหัสกลุ่ม)`)) return;
      const x = await fetch(`/api/groups/${enc(g.id)}/members/${enc(u.id)}`, { method: 'DELETE' });
      toast(x.ok ? `เตะ ${u.name} ออกแล้ว` : 'ทำไม่สำเร็จ'); loadGroups();
    }));
    box.append(row);
  });
  const next = list.find(u => !u.me);
  const warn = g.isOwner ? (next ? `\nหัวหน้ากลุ่มจะโอนให้ “${next.name}” (คนที่เข้ากลุ่มถัดไป)` : '\nคุณเป็นคนสุดท้าย กลุ่มและ Moment ในกลุ่มจะถูกลบ') : '';
  box.append(mk('ออกจากกลุ่ม', 'leave', async () => {
    if (!confirm(`ออกจากกลุ่ม “${g.name}”?${warn}`)) return;
    const x = await fetch(`/api/groups/${enc(g.id)}/leave`, J({}));
    if (!x.ok) return toast('ออกไม่สำเร็จ');
    const out = await x.json();
    localStorage.groupId = ''; membersOpen = false;
    toast(out.deleted ? 'ออกแล้ว กลุ่มถูกลบเพราะไม่เหลือสมาชิก' : out.newOwner ? `ออกแล้ว โอนหัวหน้ากลุ่มให้ ${out.newOwner}` : 'ออกจากกลุ่มแล้ว');
    loadGroups();
  }));
}
function updateSteps() { // ขั้นตอน: กลุ่ม → Moment (ล็อกจนกว่าจะมีกลุ่ม)
  const ok = !!(me && $('groupSel').value);
  $('s1').textContent = ok ? '✓' : '1'; $('s1').classList.toggle('ok', ok);
  $('stepMoment').classList.toggle('locked', !ok); $('lockMsg').hidden = ok;
  document.querySelectorAll('#t2 .card').forEach(c => c.classList.toggle('locked', !ok)); $('needGroup').hidden = ok;
}
$('groupSel').onchange = () => { localStorage.groupId = $('groupSel').value; joinSelectedGroup(); loadMoments(); updateSteps(); renderMembers(); };
$('gMembers').onclick = () => { membersOpen = !membersOpen; renderMembers(); };
$('gInvite').onclick = () => { const g = curGroup(); g ? shareInvite(g.code) : toast('เลือกหรือสร้างกลุ่มก่อน'); };
socket.on('moment_created', loadMoments);
socket.on('moments_changed', loadMoments);
socket.on('group_members_update', () => { loadGroups(); }); // เลือกกลุ่มเดิมไว้ให้ตามที่จำไว้
socket.on('kicked', ({ groupId }) => {
  toast('คุณถูกนำออกจากกลุ่มแล้ว');
  if (moment && moment.groupId === groupId) leaveLive();
  if (localStorage.groupId === groupId) localStorage.groupId = '';
  loadGroups();
});
socket.on('connect', joinSelectedGroup);
updateSteps();
// ---------- แจ้งเตือน (Web Push) : ต้องกดปุ่มเองเพื่อขอสิทธิ์ แล้วระบบสมัครรับให้ทุกครั้งที่เปิดหน้า ----------
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
const sameKey = (a, b) => a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i]);
async function subscribeNew(reg, key, old) {
  if (old) await old.unsubscribe();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}
async function syncSubscription() { // เงียบ ไม่ขอสิทธิ์ใหม่: ใช้เมื่อเคยอนุญาตแล้ว (ลิงก์ tunnel ใหม่/ฐานข้อมูลใหม่ ก็สมัครให้ใหม่)
  if (!me || !pushSupported() || !window.isSecureContext || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
    const key = u8((await (await fetch('/api/push-key')).json()).key);
    let sub = await reg.pushManager.getSubscription();
    if (!sub || !sameKey(sub.options.applicationServerKey, key)) sub = await subscribeNew(reg, key, sub); // กุญแจ server เปลี่ยน → สมัครใหม่
    await fetch('/api/push-sub', J(sub));
  } catch (e) { console.warn('push sync', e); }
}
async function pushState() {
  if (!pushSupported()) return { text: isiOS && !standalone() ? 'iPhone: กดปุ่มแชร์ → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอน จึงจะรับแจ้งเตือนได้' : 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน' };
  if (!window.isSecureContext) return { text: 'ต้องเปิดผ่าน HTTPS ถึงจะรับแจ้งเตือนได้' };
  if (Notification.permission === 'denied') return { text: 'แจ้งเตือนถูกบล็อกไว้ — เปิดสิทธิ์ได้ที่การตั้งค่าเว็บไซต์ในเบราว์เซอร์' };
  const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription();
  if (Notification.permission === 'granted' && sub) return { on: true, text: '🔔 เปิดแจ้งเตือนแล้ว — เตือนก่อนถึงเวลา 10 นาที, 1 นาที และตอนถึงเวลา' };
  return { canEnable: true, text: 'ยังไม่ได้เปิดแจ้งเตือน — เปิดเพื่อไม่พลาดเวลาถ่าย' };
}
async function refreshNotif() {
  const s = await pushState();
  $('notifState').textContent = s.text; $('notifBtn').hidden = !s.canEnable; $('notifTest').hidden = !s.on;
}
$('notifBtn').onclick = async () => { // ต้องมาจากการแตะของผู้ใช้ เบราว์เซอร์ถึงยอมให้ขอสิทธิ์
  if (!await ensureMe()) return;
  try { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; if (await Notification.requestPermission() === 'granted') await syncSubscription(); }
  catch (e) { toast('เปิดแจ้งเตือนไม่สำเร็จ: ' + (e.message || e)); }
  refreshNotif();
};
$('notifTest').onclick = async () => {
  const r = await fetch('/api/push-test', J({})), n = r.ok ? (await r.json()).sent : 0;
  toast(n ? 'ส่งแจ้งเตือนทดสอบแล้ว — ควรเห็นภายในไม่กี่วินาที' : 'ยังไม่มีเครื่องที่สมัครไว้ ลองปิดแล้วกดเปิดแจ้งเตือนใหม่');
};
function showBanner(r) { // แบนเนอร์เตือนในหน้า (ใช้ได้แม้ไม่ได้เปิดแจ้งเตือนของเบราว์เซอร์)
  const b = $('banner'), here = moment && moment.id === r.momentId;
  b.innerHTML = `<div class="bt"><b>⏰ ${esc(r.title)}</b><span>${esc(r.text)}</span></div>`;
  if (!here) b.append(mk('เข้าห้อง', 'go', () => { b.hidden = true; enter(r.momentId); }));
  b.append(mk('✕', 'x', () => { b.hidden = true; }, 'ปิด')); b.hidden = false;
  clearTimeout(showBanner.t); showBanner.t = setTimeout(() => { b.hidden = true; }, 25000);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
socket.on('reminder', showBanner);
$('gCreate').onclick = async () => {
  if (!await ensureMe()) return alert('เชื่อมต่อ server ไม่ได้');
  const r = await fetch('/api/groups', J({ name: $('gName').value }));
  if (!r.ok) return alert('สร้างกลุ่มไม่สำเร็จ');
  await loadGroups((await r.json()).id); syncSubscription(); refreshNotif();
  toast('สร้างกลุ่มแล้ว — กด “ลิงก์ชวนเพื่อน” เพื่อเชิญได้เลย');
};
$('gJoin').onclick = async () => {
  if (!await ensureMe()) return alert('เชื่อมต่อ server ไม่ได้');
  const r = await fetch('/api/groups/join', J({ code: $('gCode').value.trim() }));
  if (!r.ok) return alert('ไม่พบรหัสกลุ่ม');
  await loadGroups((await r.json()).id); syncSubscription(); refreshNotif();
};

// ---- ลิงก์เชิญ /?g=รหัสกลุ่ม[&m=รหัส Moment]: คนใหม่ใส่แค่ชื่อ → เข้ากลุ่ม (และห้อง) ให้เลย / คนที่มีชื่อในเครื่องแล้วเข้าอัตโนมัติ
function closeInvite() { document.body.classList.remove('inviting'); $('invite').hidden = true; history.replaceState(null, '', '/'); }
async function showInvite() {
  const q = new URLSearchParams(location.search), code = q.get('g'), mid = q.get('m');
  if (!code) return;
  const r = await fetch('/api/invite?g=' + enc(code) + (mid ? '&m=' + enc(mid) : ''));
  if (!r.ok) { toast('ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ'); history.replaceState(null, '', '/'); return; }
  const inv = await r.json();
  const go = async () => {
    if (!me) $('name').value = $('invName').value;
    if (!await ensureMe()) return;
    const jr = await fetch('/api/groups/join', J({ code }));
    if (!jr.ok) return toast('เข้ากลุ่มไม่สำเร็จ');
    const g = await jr.json();
    await loadGroups(g.id); closeInvite();
    if (inv.moment) enter(inv.moment.id); else toast(`เข้ากลุ่ม “${g.name}” แล้ว`);
    syncSubscription(); refreshNotif();
  };
  if (me) return go(); // มีชื่อในเครื่องแล้ว → เข้าอัตโนมัติ ไม่ต้องกดอะไร
  document.body.classList.add('inviting'); $('invite').hidden = false;
  $('invTitle').textContent = inv.moment ? `ชวนถ่ายรูป “${inv.moment.title}”` : `ชวนเข้ากลุ่ม “${inv.group.name}”`;
  $('invSub').textContent = `กลุ่ม ${inv.group.name} · ${inv.group.n} คน` + (inv.moment ? ' · ' + new Date(inv.moment.startAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  $('invName').focus();
  $('invSkip').onclick = closeInvite;
  $('invGo').onclick = () => $('invName').value.trim() ? go() : (toast('ใส่ชื่อของคุณก่อน'), $('invName').focus());
  $('invName').onkeydown = e => { if (e.key === 'Enter') $('invGo').onclick(); };
}
(async () => { // ตรวจว่า token ที่เก็บไว้ยังใช้ได้ (เช่น หลังล้างฐานข้อมูล) แล้วค่อยแสดงคำเชิญ
  if (me) {
    const r = await fetch('/api/me');
    if (!r.ok) { me = null; localStorage.removeItem('me'); }
    else { $('name').value = me.name; await loadGroups(); }
  }
  showInvite();
  syncSubscription(); refreshNotif();
})();
