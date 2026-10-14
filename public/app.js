const $ = id => document.getElementById(id), socket = io();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const J = b => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
let me; try { me = JSON.parse(localStorage.me || 'null'); } catch { me = null; }
const _fetch = window.fetch; // แนบ token ทุก request
window.fetch = (u, o = {}) => _fetch(u, { ...o, headers: { ...(o.headers || {}), 'x-token': me ? me.token : '' } });
let tickTimer = null, shotTimers = [], photos = [], offset = 0, moment = null, name = '', online = 0;
const now = () => Date.now() + offset;
const MAXT = 2 ** 31 - 1;

async function sync() { // เลือก sample ที่ RTT ต่ำสุด แล้วคำนวณ clock offset
  let best = 1e9;
  for (let i = 0; i < 5; i++) await new Promise(res => {
    const t0 = Date.now(), to = setTimeout(res, 3000); // กันค้างถ้า server ไม่ตอบ
    socket.emit('sync', t0, (_, ts) => {
      clearTimeout(to);
      const t1 = Date.now(), rtt = t1 - t0;
      if (rtt < best) { best = rtt; offset = ts - (t0 + t1) / 2; }
      res();
    });
  });
}
const setInfo = n => {
  if (n != null) online = n;
  if (moment) $('info').textContent = `${moment.title} · รหัส ${moment.id}` + (online ? ` · ออนไลน์ ${online}` : '');
};
const addPhoto = p => {
  if (photos.some(x => x.id === p.id)) return; // กันซ้ำ (เช่น ตอน reconnect ดึงรูปที่พลาดมา)
  photos.push(p);
  const d = document.createElement('div'), i = new Image(), k = document.createElement('span');
  d.className = 'pi'; d.dataset.id = p.id; i.src = '/uploads/' + p.file; k.className = 'pk'; k.hidden = true;
  d.append(i, k); d.onclick = () => togglePick(p.id); // แตะรูปเพื่อเลือก/ยกเลิกเลือก
  $('grid').append(d);
  if (window.onPhotoAdded) window.onPhotoAdded(); // ให้ตัวอย่างฟิลเตอร์ใช้รูปจริง
};

async function enter(id, noCam) {
  name = $('name').value || (me && me.name) || 'guest';
  socket.emit('join', { momentId: id, name, token: me && me.token }); // join ก่อนดึงข้อมูล เพื่อไม่ให้พลาดรูปที่เข้ามาระหว่างนั้น
  await sync();
  const r = await fetch('/api/moments/' + encodeURIComponent(id));
  if (r.status === 403) return alert('ต้องเข้ากลุ่มของ Moment นี้ก่อน — ใส่รหัสกลุ่มที่เพื่อนส่งให้ในหน้าแรก');
  if (!r.ok) return alert('ไม่พบ Moment นี้');
  moment = await r.json();
  $('home').hidden = true; $('live').hidden = false; window.scrollTo(0, 0);
  history.pushState({ live: 1 }, ''); // ให้ปุ่มย้อนกลับของเบราว์เซอร์/มือถือใช้ได้ด้วย
  setInfo();
  moment.photos.forEach(addPhoto);
  if (window.Voice) Voice.set(moment.voices || []);
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  if (!noCam) startCamera();
}
let facing = 'user', stream = null;
async function openCam() { // เปิดกล้องตามด้านที่เลือก (หน้า/หลัง) และปิดสตรีมเดิมก่อน
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } } });
  $('cam').srcObject = stream;
  $('cam').classList.toggle('mirror', facing === 'user'); // พรีวิวกล้องหน้าแบบกระจก (รูปที่ถ่ายไม่กลับด้าน)
}
async function startCamera() {
  clearInterval(tickTimer); tickTimer = setInterval(tick, 100);
  try {
    await openCam();
    autoShoot();
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    $('flip').hidden = cams.length < 2; // มีกล้องเดียว (เช่น เว็บแคมคอม) ไม่ต้องมีปุ่มสลับ
  } catch {
    ['cam', 'shot', 'flip'].forEach(x => $(x).hidden = true); $('auto').parentElement.hidden = true;
    $('camMsg').textContent = 'เปิดกล้องไม่ได้ (ต้องเปิดผ่าน HTTPS หรือ localhost และอนุญาตสิทธิ์กล้อง) — ยังเห็นรูปของเพื่อนแบบ realtime ได้';
  }
}
$('flip').onclick = async () => {
  const old = facing; facing = facing === 'user' ? 'environment' : 'user';
  try { await openCam(); } catch { facing = old; await openCam().catch(() => {}); }
};
function tick() {
  const left = moment.startAt - now();
  $('liveCal').hidden = !(left > 0); // ปุ่มลงปฏิทิน: เฉพาะ Moment ที่ยังไม่ถึงเวลา
  if (left > 0) { const s = Math.ceil(left / 1000); $('cnt').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; $('shot').disabled = true; }
  else { $('cnt').textContent = 'ถ่ายเลย!'; $('shot').disabled = false; }
}
async function createMoment() {
  const chosen = new Date($('start').value).getTime(); // เวลาที่เลือกเป็นเวลาของเครื่อง → แปลงเป็นเวลา server
  if (!Number.isFinite(chosen)) return alert('เลือกวันและเวลาก่อน');
  await sync();
  const startAt = chosen + offset;
  if (startAt < now()) return alert('เวลาต้องไม่เป็นอดีต');
  const r = await fetch('/api/moments', J({ title: $('title').value, startAt, groupId: $('groupSel').value }));
  if (!r.ok) return alert(r.status === 400 ? 'เลือกเวลาได้ตั้งแต่ตอนนี้ถึงไม่เกิน 3 เดือนข้างหน้า' : 'สร้าง Moment ไม่สำเร็จ (ลองเข้าสู่กลุ่มใหม่)');
  $('dupBox').innerHTML = ''; $('dupBox').className = '';
  enter((await r.json()).id);
}
$('create').onclick = () => { // กันสร้างซ้ำ: ถ้ามีชื่อเดียวกันในกลุ่ม ให้เลือกว่าจะเข้าอันเดิมหรือสร้างใหม่
  if (!$('groupSel').value) return alert('เลือกหรือสร้างกลุ่มก่อน');
  const t = $('title').value.trim().toLowerCase(), box = $('dupBox');
  const dup = t && momentsCache.find(m => m.title.trim().toLowerCase() === t);
  box.innerHTML = ''; box.className = '';
  if (!dup) return createMoment();
  box.className = 'card dup';
  box.innerHTML = `<b>มี “${esc(dup.title)}” อยู่แล้วในกลุ่มนี้</b><p class="hint">เพื่อนอาจสร้างไว้แล้ว — เข้าอันเดิมจะได้เห็นรูปเดียวกัน</p>`;
  const a = document.createElement('button'), b = document.createElement('button');
  a.className = 'primary'; a.textContent = 'เข้าร่วมอันเดิม'; a.onclick = () => { box.innerHTML = ''; box.className = ''; enter(dup.id); };
  b.textContent = 'สร้างอันใหม่แยกต่างหาก'; b.onclick = createMoment;
  box.append(a, b);
};
function takePhoto() {
  const v = $('cam'), c = document.createElement('canvas');
  if (!moment || !v.videoWidth) return;
  c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  const takenAt = now();
  c.toBlob(b => {
    const f = new FormData();
    f.append('photo', b, 'p.jpg'); f.append('member', name); f.append('takenAt', takenAt);
    fetch(`/api/moments/${moment.id}/photos`, { method: 'POST', body: f }).catch(() => {});
  }, 'image/jpeg', 0.85);
}
$('shot').onclick = takePhoto;

// ถ่ายอัตโนมัติ: ทุกเครื่องลั่นชัตเตอร์ที่ startAt (เวลา server) แล้วถ่ายต่อตามจำนวนที่เลือก
function autoShoot() {
  const wait = moment.startAt - now();
  if (wait <= 0 || wait > MAXT) return; // เข้ามาหลังถึงเวลาแล้ว/ไกลเกิน → ถ่ายเองด้วยปุ่ม
  shotTimers.push(setTimeout(() => {
    if (!moment) return; // ออกจากห้องไปแล้ว
    while (now() < moment.startAt); // รอส่วนที่เหลือ (<50 ms) ให้ตรงเวลา
    const n = Number($('shots').value) || 1; // จำนวนรูปที่เลือก ห่างกันรูปละ 2 วินาที
    for (let i = 0; i < n; i++) shotTimers.push(setTimeout(() => $('auto').checked && takePhoto(), i * 2000));
  }, Math.max(wait - 50, 0)));
}
socket.on('photo_uploaded', addPhoto);
socket.on('member_joined', m => setInfo(m.count));
socket.on('member_left', m => setInfo(m.count));
socket.on('connect', async () => { // เน็ตหลุดแล้วต่อใหม่ → เข้า room อีกครั้ง, sync เวลา, ดึงรูปที่พลาด
  if (!moment) return;
  socket.emit('join', { momentId: moment.id, name, token: me && me.token });
  sync();
  const r = await fetch('/api/moments/' + moment.id);
  if (r.ok) (await r.json()).photos.forEach(addPhoto);
});

// ค่าเริ่มต้นของช่องวัน-เวลา = อีก 2 นาที (เวลาท้องถิ่น)
const localISO = ms => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
$('start').value = localISO(Date.now() + 2 * 60000);
// เปิดจากลิงก์แจ้งเตือน /?m=<รหัส Moment> → เข้า Moment นั้นเลย (ถ้ามี g= เป็นลิงก์เชิญ ให้ groups.js จัดการแทน)
window.addEventListener('load', () => { const q = new URLSearchParams(location.search); if (q.get('m') && !q.get('g')) enter(q.get('m')); });

// แท็บในหน้าแรก (Live / Memory / Album)
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.panel').forEach(p => p.hidden = p.id !== b.dataset.tab);
}));

// ปุ่มย้อนกลับ: ออกจากห้อง Live กลับหน้าแรก (ปิดกล้อง/ตัวตั้งเวลา และออกจาก room)
let popIgnore = false;
function leaveLive(fromPop) {
  clearInterval(tickTimer); shotTimers.forEach(clearTimeout); shotTimers = [];
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('cam').srcObject = null;
  if (moment) socket.emit('leave');
  moment = null; photos = []; online = 0; picked = [];
  $('grid').innerHTML = ''; $('flink').textContent = ''; $('camMsg').textContent = ''; $('cnt').textContent = '';
  $('fc').removeAttribute('width'); $('fc').removeAttribute('height');
  if (window.resetEditor) resetEditor(); if (window.Voice) Voice.reset(); // ล้างสติ๊กเกอร์/การปรับรูป/เสียงของห้องเดิม
  ['cam', 'shot', 'cnt'].forEach(x => $(x).hidden = false); $('auto').parentElement.hidden = false; $('flip').hidden = true; $('liveCal').hidden = true; $('shot').disabled = true;
  $('live').hidden = true; $('home').hidden = false; window.scrollTo(0, 0);
  // กลับหน้าแรกทันทีเสมอ (ไม่รอประวัติเบราว์เซอร์) แล้วค่อยเก็บกวาดประวัติที่ pushState ไว้ตอนเข้าห้อง
  if (!fromPop && history.state && history.state.live) { popIgnore = true; setTimeout(() => { popIgnore = false; }, 600); history.back(); }
  else history.replaceState(null, '', '/');
  updatePickInfo(); loadMoments();
}
$('back').onclick = () => leaveLive(false);
window.addEventListener('popstate', () => { if (popIgnore) { popIgnore = false; return; } if (!$('live').hidden) leaveLive(true); });
socket.on('moment_deleted', () => { if (!moment) return; alert('Moment นี้ถูกลบแล้ว'); leaveLive(); });
$('liveInvite').onclick = () => { const g = groupsCache.find(x => x.id === moment.groupId); g ? shareInvite(g.code, moment.id, moment.title) : toast('ยังไม่พบข้อมูลกลุ่ม'); };
