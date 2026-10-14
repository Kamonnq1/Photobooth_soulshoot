// สติ๊กเกอร์ที่แปะบนเฟรม: ชุดที่วาดด้วยโค้ด + อีโมจิ + ข้อความ + อัปโหลดรูปเอง + สติ๊กเกอร์เสียง
// ตำแหน่งเก็บเป็นสัดส่วนของแคนวาส (0..1) จึงไม่เพี้ยนเมื่อเปลี่ยนเฟรม/ขนาด และลากย้าย/ย่อขยาย/หมุนได้ (เมาส์ ล้อเลื่อน หรือสองนิ้ว)
(() => {
const FONT = '"Prompt","Segoe UI","Noto Sans Thai",system-ui,sans-serif', EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const VEC = { // เส้นทาง SVG ในกรอบ 100×100
  heart: ['#ff5c8a', 'M50 88C10 58 6 30 24 16C36 6 48 12 50 24C52 12 64 6 76 16C94 30 90 58 50 88Z'],
  star: ['#ffd23f', 'M50 6L62 38L96 40L69 61L79 94L50 75L21 94L31 61L4 40L38 38Z'],
  sparkle: ['#8fd3ff', 'M50 4C54 32 68 46 96 50C68 54 54 68 50 96C46 68 32 54 4 50C32 46 46 32 50 4Z'],
  crown: ['#ffc400', 'M8 80L8 30L30 52L50 16L70 52L92 30L92 80Z'],
  bolt: ['#ffe14d', 'M58 4L18 56L46 56L38 96L82 38L52 38Z'],
  cloud: ['#d6ecff', 'M26 76C8 76 6 52 24 50C24 30 52 24 60 42C76 32 96 46 88 64C94 76 82 82 72 76Z'],
  moon: ['#ffe68a', 'M64 8C36 12 18 36 24 62C30 86 58 96 80 82C58 84 42 66 46 44C48 30 54 18 64 8Z'],
  drop: ['#6ec6ff', 'M50 6C50 6 18 44 18 64C18 82 32 94 50 94C68 94 82 82 82 64C82 44 50 6 50 6Z']
};
const COLORS = ['#ff4f9a', '#7c6cf0', '#1f9d8a', '#ff8a3d', '#2b2540', '#ffffff'];
const EMOJI = ['✨', '🎀', '🌸', '💖', '⭐', '🔥', '🎉', '🥳', '📸', '🎵', '🧸', '🐰', '🐱', '🍓', '🌈', '☁️', '💫', '👑', '🎈', '💌'];
const S = { list: [], sel: null, imgs: {} }; let seq = 1;
const mc = document.createElement('canvas').getContext('2d');
const rnd = () => (Math.random() - .5) * .16;
function pill(g, w, h) { g.beginPath(); g.roundRect ? g.roundRect(-w / 2, -h / 2, w, h, h / 2) : g.rect(-w / 2, -h / 2, w, h); }
function drawVec(g, key, w) { // สไตล์สติ๊กเกอร์: ขอบขาวหนา + สี + เส้นบางเข้ม
  const sc = w / 100; g.save(); g.scale(sc, sc); g.translate(-50, -50); g.lineJoin = 'round';
  if (key === 'flower') {
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; g.beginPath(); g.arc(50 + 26 * Math.cos(a), 50 + 26 * Math.sin(a), 20, 0, 7); g.strokeStyle = '#fff'; g.lineWidth = 12; g.stroke(); g.fillStyle = '#ff8fb8'; g.fill(); }
    g.beginPath(); g.arc(50, 50, 16, 0, 7); g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#ffd23f'; g.fill();
  } else if (key === 'smile') {
    g.beginPath(); g.arc(50, 50, 42, 0, 7); g.strokeStyle = '#fff'; g.lineWidth = 12; g.stroke(); g.fillStyle = '#ffd23f'; g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(36, 42, 5, 0, 7); g.arc(64, 42, 5, 0, 7); g.fill();
    g.beginPath(); g.arc(50, 56, 22, .15 * Math.PI, .85 * Math.PI); g.strokeStyle = '#5a3a1a'; g.lineWidth = 5; g.lineCap = 'round'; g.stroke();
  } else if (key === 'bow') {
    const p = new Path2D('M50 50L12 24L12 76Z M50 50L88 24L88 76Z');
    g.strokeStyle = '#fff'; g.lineWidth = 12; g.stroke(p); g.fillStyle = '#ff7eb6'; g.fill(p);
    g.beginPath(); g.arc(50, 50, 13, 0, 7); g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#ff4f9a'; g.fill();
  } else {
    const [c, d] = VEC[key], p = new Path2D(d); g.strokeStyle = '#fff'; g.lineWidth = 12; g.stroke(p); g.fillStyle = c; g.fill(p);
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; g.stroke(p);
  }
  g.restore();
}
function drawVoice(g, w, h, st) { // ป้ายเสียง: ไอคอนลำโพง + ชื่อ + ความยาว (บนหน้าแชร์กดฟังได้)
  pill(g, w, h); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = h * .09; g.strokeStyle = '#7c6cf0'; g.stroke();
  const r = h * .36, cx = -w / 2 + h * .55; g.beginPath(); g.arc(cx, 0, r, 0, 7); g.fillStyle = '#7c6cf0'; g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - r * .45, -r * .22); g.lineTo(cx - r * .15, -r * .22); g.lineTo(cx + r * .22, -r * .5); g.lineTo(cx + r * .22, r * .5); g.lineTo(cx - r * .15, r * .22); g.lineTo(cx - r * .45, r * .22); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = r * .1; g.lineCap = 'round'; g.beginPath(); g.arc(cx + r * .2, 0, r * .45, -.9, .9); g.stroke(); g.beginPath(); g.arc(cx + r * .2, 0, r * .75, -.8, .8); g.stroke();
  g.fillStyle = '#2b2540'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `600 ${h * .36}px ${FONT}`;
  const sec = `${Math.round(st.secs || 0)}s`, nameMax = w - h * 1.35 - g.measureText(sec).width - h * .3; let nm = String(st.label || '');
  while (nm.length > 1 && g.measureText(nm).width > nameMax) nm = nm.slice(0, -1);
  g.fillText(nm, cx + r + h * .15, 0); g.fillStyle = '#8a84a3'; g.textAlign = 'right'; g.font = `500 ${h * .3}px ${FONT}`; g.fillText(sec, w / 2 - h * .4, 0);
  g.textBaseline = 'alphabetic';
}
function box(st, W) { // ขนาดกรอบของสติ๊กเกอร์ (พิกเซลของแคนวาส)
  const w = st.s * W;
  if (st.kind === 'text') { mc.font = `800 ${w * .35}px ${FONT}`; return { w: mc.measureText(st.key).width + w * .1, h: w * .5 }; }
  if (st.kind === 'img') { const im = S.imgs[st.key]; return { w, h: im ? w * im.height / im.width : w }; }
  if (st.kind === 'voice') return { w, h: w * .34 };
  return { w, h: w };
}
function content(g, st, W) {
  const b = box(st, W);
  if (st.kind === 'vec') drawVec(g, st.key, b.w);
  else if (st.kind === 'emoji') { g.font = `${b.w * .78}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = b.w * .1; g.strokeStyle = '#fff'; g.strokeText(st.key, 0, b.w * .04); g.fillText(st.key, 0, b.w * .04); g.textBaseline = 'alphabetic'; }
  else if (st.kind === 'text') { g.font = `800 ${b.w * .35 / 1.0 * 1}px ${FONT}`; g.font = `800 ${st.s * W * .35}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = st.s * W * .09; g.strokeStyle = '#fff'; g.strokeText(st.key, 0, 0); g.fillStyle = st.color || '#ff4f9a'; g.fillText(st.key, 0, 0); g.textBaseline = 'alphabetic'; }
  else if (st.kind === 'img') { const im = S.imgs[st.key]; if (im) { g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = b.w * .03; g.drawImage(im, -b.w / 2, -b.h / 2, b.w, b.h); g.shadowBlur = 0; } }
  else if (st.kind === 'voice') drawVoice(g, b.w, b.h, st);
}
S.draw = (g, W, H, o = {}) => {
  for (const st of S.list) {
    g.save(); g.translate(st.x * W, st.y * H); g.rotate(st.r || 0); if (st.f < 0 && st.kind !== 'text' && st.kind !== 'voice') g.scale(-1, 1); content(g, st, W); g.restore();
  }
  const sel = o.selection && S.get(S.sel);
  if (sel) { // กรอบเส้นประรอบสติ๊กเกอร์ที่เลือก (เฉพาะตอนแก้ไข ไม่ติดไปกับรูปที่บันทึก)
    const b = box(sel, W); g.save(); g.translate(sel.x * W, sel.y * H); g.rotate(sel.r || 0);
    g.setLineDash([10, 8]); g.lineWidth = Math.max(3, W * .004); g.strokeStyle = '#7c6cf0'; g.strokeRect(-b.w / 2 - 6, -b.h / 2 - 6, b.w + 12, b.h + 12); g.restore();
  }
};
S.get = id => S.list.find(s => s.id === id) || null;
S.hit = (px, py, W, H) => { // เลือกจากบนสุดลงล่าง (หมุนจุดย้อนกลับเข้าพิกัดของสติ๊กเกอร์)
  for (let i = S.list.length - 1; i >= 0; i--) {
    const st = S.list[i], b = box(st, W), dx = px - st.x * W, dy = py - st.y * H, c = Math.cos(-(st.r || 0)), s = Math.sin(-(st.r || 0));
    const lx = dx * c - dy * s, ly = dx * s + dy * c, pad = Math.max(8, W * .01);
    if (Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad) return st;
  }
  return null;
};
const redraw = () => { renderBar(); if (window.FrameEditor) { FrameEditor.rendered() ? FrameEditor.paint() : FrameEditor.preview(); } };
S.add = st => { st.id = seq++; st.x = .5 + rnd(); st.y = .5 + rnd(); st.r = 0; st.f = 1; S.list.push(st); S.sel = st.id; redraw(); return st; };
S.select = id => { if (S.sel === id) return; S.sel = id; redraw(); };
S.clear = () => { S.list.length = 0; S.sel = null; renderBar(); };
S.hotspots = () => S.list.filter(s => s.kind === 'voice').map(s => ({ x: +s.x.toFixed(4), y: +s.y.toFixed(4), s: +s.s.toFixed(4), r: +(s.r || 0).toFixed(4), voiceId: s.key }));
const act = {
  bigger: st => { st.s = Math.min(1.2, st.s * 1.12); }, smaller: st => { st.s = Math.max(.04, st.s / 1.12); },
  left: st => { st.r -= Math.PI / 12; }, right: st => { st.r += Math.PI / 12; }, flip: st => { st.f *= -1; },
  front: st => { S.list.splice(S.list.indexOf(st), 1); S.list.push(st); }, back: st => { S.list.splice(S.list.indexOf(st), 1); S.list.unshift(st); },
  del: st => { S.list.splice(S.list.indexOf(st), 1); S.sel = null; }, done: () => { S.sel = null; }
};
S.act = (name) => { const st = S.get(S.sel); if (st && act[name]) { act[name](st); redraw(); } };
function renderBar() { const bar = $('stkBar'); if (bar) bar.hidden = !S.get(S.sel); }
// ---------- แผงเลือกสติ๊กเกอร์ ----------
const add = (kind, key, s, extra) => S.add({ kind, key, s, ...extra });
Object.keys(VEC).concat(['flower', 'smile', 'bow']).forEach(k => {
  const b = document.createElement('button'), cv = document.createElement('canvas'); b.type = 'button'; b.className = 'sk'; b.setAttribute('aria-label', 'สติ๊กเกอร์ ' + k);
  cv.width = cv.height = 64; const g = cv.getContext('2d'); g.translate(32, 32); drawVec(g, k, 52); b.append(cv); b.onclick = () => add('vec', k, .16); $('stkPal').append(b);
});
EMOJI.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sk em'; b.textContent = e; b.setAttribute('aria-label', 'อีโมจิ ' + e); b.onclick = () => add('emoji', e, .16); $('stkPal').append(b); });
COLORS.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (i === 0 ? ' on' : ''); b.style.background = c; b.setAttribute('aria-label', 'สีข้อความ ' + c); b.onclick = () => { $('stkColor').value = c; document.querySelectorAll('#stkSw .sw').forEach(x => x.classList.toggle('on', x === b)); }; $('stkSw').append(b); });
$('stkTextAdd').onclick = () => { const t = $('stkText').value.trim(); if (!t) return $('stkText').focus(); add('text', t.slice(0, 40), .42, { color: $('stkColor').value }); $('stkText').value = ''; };
$('stkText').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('stkTextAdd').onclick(); } };
$('stkFile').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^image\//.test(f.type)) return toast('เลือกไฟล์รูปภาพ (PNG ใสพื้นหลังจะสวยที่สุด)');
  const im = new Image(), key = 'u' + (seq++); im.onload = () => { S.imgs[key] = im; add('img', key, .28); }; im.onerror = () => toast('เปิดรูปนี้ไม่ได้'); im.src = URL.createObjectURL(f);
};
S.voiceChips = list => { // ปุ่มเพิ่มสติ๊กเสียงจากเสียงที่อัดไว้ในห้อง
  const box = $('stkVoices'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<span class="hint">ยังไม่มีเสียงในห้อง — อัดเสียงในการ์ด “เสียงของเรา” ด้านบนได้</span>'; return; }
  list.forEach(v => { const b = document.createElement('button'); b.type = 'button'; b.className = 'vchip'; b.textContent = `🔊 ${v.member} · ${Math.round(v.secs)}s`;
    b.onclick = () => add('voice', v.id, .36, { label: v.member, secs: v.secs }); box.append(b); });
};
document.querySelectorAll('#stkBar [data-a]').forEach(b => b.onclick = () => S.act(b.dataset.a));
// ---------- ลาก / ซูม / หมุน บนแคนวาสเฟรม ----------
const cv = $('fc'); cv.style.touchAction = 'none';
const pts = new Map(); let drag = null, pinch = null;
const P = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
cv.addEventListener('pointerdown', e => {
  if (!FrameEditor.rendered()) return;
  cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, P(e));
  if (pts.size === 1) {
    const p = P(e), st = S.hit(p.x, p.y, cv.width, cv.height);
    if (st) { S.select(st.id); drag = { kind: 'st', st, px: p.x, py: p.y, ox: st.x, oy: st.y }; }
    else { S.select(null); const sl = FrameEditor.slotAt(p.x, p.y); drag = sl ? { kind: 'ph', slot: sl, px: p.x, py: p.y } : null; }
  } else if (pts.size === 2) {
    const [a, b] = [...pts.values()], st = S.get(S.sel), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), s: st && st.s, r: st && st.r, slot: st ? null : FrameEditor.slotAt(mid.x, mid.y), last: 1 };
    drag = null;
  }
});
cv.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, P(e));
  if (pinch && pts.size >= 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, st = S.get(S.sel);
    if (st) { st.s = Math.max(.04, Math.min(1.2, pinch.s * d / pinch.d)); st.r = pinch.r + (Math.atan2(b.y - a.y, b.x - a.x) - pinch.ang); FrameEditor.paint(); }
    else if (pinch.slot) { const f = d / pinch.d / pinch.last; pinch.last = d / pinch.d; FrameEditor.zoom(pinch.slot, f); }
  } else if (drag) {
    const p = P(e);
    if (drag.kind === 'st') { drag.st.x = drag.ox + (p.x - drag.px) / cv.width; drag.st.y = drag.oy + (p.y - drag.py) / cv.height; FrameEditor.paint(); }
    else { FrameEditor.pan(drag.slot, p.x - drag.px, p.y - drag.py); drag.px = p.x; drag.py = p.y; }
  }
});
const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { drag = null; renderBar(); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { // ล้อเมาส์: ย่อ/ขยายสติ๊กเกอร์ที่เลือก หรือซูมรูปในช่องใต้เมาส์
  if (!FrameEditor.rendered()) return; const p = P(e), f = e.deltaY < 0 ? 1.08 : 1 / 1.08, st = S.get(S.sel);
  if (st) { st.s = Math.max(.04, Math.min(1.2, st.s * f)); e.preventDefault(); FrameEditor.paint(); }
  else { const sl = FrameEditor.slotAt(p.x, p.y); if (sl) { e.preventDefault(); FrameEditor.zoom(sl, f); } }
}, { passive: false });
document.addEventListener('keydown', e => { // Delete ลบสติ๊กเกอร์ที่เลือก (ไม่รบกวนตอนพิมพ์)
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.get(S.sel) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); S.act('del'); }
});
$('fresetph').onclick = () => FrameEditor.resetPhotos();
window.Stickers = S; renderBar(); S.voiceChips([]);
})();
