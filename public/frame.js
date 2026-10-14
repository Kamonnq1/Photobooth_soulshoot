const LAYOUTS = { '2x2': [2, 2], '1x3': [1, 3], '1x4': [1, 4], '3x2': [3, 2] };
const _imgs = new Map(), DIMS = {}; // แคชรูป + ขนาดต้นฉบับ (ใช้คำนวณตอนลากรูปในช่อง)
const loadSrc = (src, key) => { if (!_imgs.has(src)) _imgs.set(src, new Promise(res => { const i = new Image(); i.onload = () => { if (key) DIMS[key] = { w: i.naturalWidth || i.width, h: i.naturalHeight || i.height }; res(i); }; i.onerror = () => { _imgs.delete(src); res(null); }; i.src = src; })); return _imgs.get(src); };
const loadImg = f => loadSrc('/uploads/' + f, f);

// ---------- helper วาดภาพ ----------
const rr = (g, x, y, w, h, r) => { g.beginPath(); r && g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
const edge = (g, W, H, w, c) => { g.fillStyle = c; g.fillRect(0, 0, W, w); g.fillRect(0, H - w, W, w); g.fillRect(0, 0, w, H); g.fillRect(W - w, 0, w, H); };
const notch = (g, W, H, w, c) => { g.fillStyle = c; [[0, 0], [W - w, 0], [0, H - w], [W - w, H - w]].forEach(([x, y]) => g.fillRect(x, y, w, w)); };
const plus = (g, x, y, s, c) => { g.fillStyle = c; g.fillRect(x + s, y, s, 3 * s); g.fillRect(x, y + s, 3 * s, s); };
const sil = (g, x, y, s, c) => { g.fillStyle = c; g.beginPath(); g.arc(x + s / 2, y + s * 0.38, s * 0.17, 0, 7); g.fill();
  g.beginPath(); g.moveTo(x + s * 0.2, y + s); g.quadraticCurveTo(x + s * 0.2, y + s * 0.62, x + s / 2, y + s * 0.62); g.quadraticCurveTo(x + s * 0.8, y + s * 0.62, x + s * 0.8, y + s); g.fill(); };
const MONO = '"Courier New",monospace', SERIF = 'Georgia,serif';

// ---------- Template (สกิน) : bg สี/ring กรอบรูป/rx มุมมน/ph สีช่องว่าง/pre-post ของตกแต่ง ----------
const TPL = {
  classic: { name: 'Classic', tag: 'เลือกสีเอง' },
  candy: { name: 'Pixel candy', tag: 'Pixel', bg: '#ffd6e8', pad: 40, ring: '#7a3b69', rw: 8, ph: ['#b8e6ff', '#fff3a8', '#c9ffd6', '#e5c8ff'], pf: '#ff6fa8', tc: '#7a3b69', fam: MONO, foot: 'PRESS START',
    pre: (g, W, H, T) => { edge(g, W, H, 18, '#ff6fa8'); notch(g, W, H, 18, T.bg); }, post: (g, W) => { plus(g, 50, 30, 8, '#ff6fa8'); plus(g, W - 74, 30, 8, '#ff6fa8'); } },
  arcade: { name: 'Pixel arcade', tag: 'Pixel', bg: '#2b2d8e', pad: 40, ring: '#ffffff', rw: 8, ph: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'], pf: '#2b2d8e', tc: '#ffd93d', fam: MONO, foot: 'INSERT COIN',
    pre: (g, W, H, T) => { edge(g, W, H, 14, '#ffd93d'); notch(g, W, H, 14, T.bg); } },
  polaroid: { name: 'Retro polaroid', tag: 'Retro', bg: '#efe4d0', pad: 44, ring: '#fffdf7', rw: 14, ph: ['#d9a679', '#b5c4a1', '#e2b8a6', '#9db4c0'], pf: '#8a6a4f', tc: '#6b4f3a', fam: SERIF, fw: 'italic', foot: '{year}',
    post: (g, W) => [[44, 46, -0.5], [W - 44, 46, 0.5]].forEach(([x, y, a]) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(232,210,122,.85)'; g.fillRect(-60, -16, 120, 32); g.restore(); }) },
  film: { name: 'Retro film', tag: 'Retro', bg: '#1f1a14', pad: 28, topMin: 70, footH: 112, tyo: 10, ring: '#e8d9bd', rw: 4, ph: ['#e0a458', '#c97b63', '#7fa38c', '#d9c27a'], pf: '#1f1a14', tc: '#f0b44c', fc: '#e8d9bd', fam: MONO, foot: 'KODAK 400',
    pre: (g, W, H) => { g.fillStyle = '#e8d9bd'; for (let x = 20; x < W - 30; x += 46) { rr(g, x, 18, 24, 16, 4); g.fill(); rr(g, x, H - 32, 24, 16, 4); g.fill(); } } },
  minimal: { name: 'Modern minimal', tag: 'Modern', bg: '#ffffff', pad: 28, rx: 18, ph: ['#dfe7ee', '#ebe3da', '#dde9e1', '#eadfea'], pf: '#aab4bd', tc: '#1c1c1c', fc: '#888888', fam: 'system-ui,sans-serif', fw: '500', ts: 40, align: 'left', foot: '{date}',
    post: (g, W, H, T, o) => { if (!o.title) return; g.fillStyle = '#d9d9d9'; g.fillRect(28, o.head - 12, W - 56, 2); g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(W - 40, 50, 8, 0, 7); g.fill(); } },
  pop: { name: 'Modern pop', tag: 'Modern', bg: '#c8b8ff', pad: 32, rx: 30, ring: '#ffffff', rw: 8, ph: ['#ffe3ee', '#fff3d6', '#dff6ec', '#e4efff'], pf: '#7c6cf0', tc: '#2b2540', fam: 'system-ui,sans-serif', ts: 52, align: 'left', foot: 'with love',
    pre: (g, W) => { g.fillStyle = '#ffbcd8'; g.beginPath(); g.arc(W - 40, 20, 120, 0, 7); g.fill(); } },
  neon: { name: 'Dark neon', tag: 'Dark', bg: '#0f0f1a', pad: 32, ring: '#00e5ff', rw: 4, ringMode: 'stroke', rx: 10, ph: ['#1b1b33', '#241b33', '#1b2933', '#2a1b2a'], pf: '#ff4fa3', tc: '#ff4fa3', fc: '#00e5ff', fam: MONO, foot: '23:59',
    pre: (g, W, H) => { g.strokeStyle = '#1a1a30'; g.lineWidth = 2; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } } },
  gold: { name: 'Dark gold', tag: 'Dark', bg: '#1c1c1c', pad: 44, ring: '#c9a96e', rw: 2, ringMode: 'stroke', ph: ['#2a2a2a', '#303030', '#262626', '#2d2d2d'], pf: '#5a5346', tc: '#c9a96e', fam: SERIF, fw: 'normal', foot: 'est. {year}',
    pre: (g, W, H) => { g.strokeStyle = '#c9a96e'; g.lineWidth = 2; g.strokeRect(14, 14, W - 28, H - 28); } }
};

// ---------- ฟิลเตอร์: ประมวลผลพิกเซลเอง (ctx.filter ใช้ไม่ได้บน Safari) แล้วฝังลงในรูปที่บันทึก ----------
const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v, lum = (r, g, b) => .299 * r + .587 * g + .114 * b;
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const FILTERS = {
  none: { name: 'ต้นฉบับ' },
  bw: { name: 'ขาวดำ', px: (r, g, b) => { const y = lum(r, g, b) * 1.05; return [y, y, y]; } },
  vintage: { name: 'วินเทจ', px: (r, g, b) => [r * .4 + (.393 * r + .769 * g + .189 * b) * .6 + 12, g * .4 + (.349 * r + .686 * g + .168 * b) * .6 + 8, b * .4 + (.272 * r + .534 * g + .131 * b) * .6 + 22] },
  warm: { name: 'อุ่น', px: (r, g, b) => [r * 1.08 + 8, g * 1.02 + 2, b * .88] },
  cool: { name: 'เย็น', px: (r, g, b) => [r * .9, g + 2, b * 1.1 + 8] },
  vivid: { name: 'สดใส', px: (r, g, b) => { const y = lum(r, g, b), f = v => (y + (v - y) * 1.4 - 128) * 1.08 + 128; return [f(r), f(g), f(b)]; } },
  fade: { name: 'ซีด', px: (r, g, b) => { const y = lum(r, g, b), f = (v, k) => ((v * .8 + y * .2) - 128) * .82 + 128 + 22 + k; return [f(r, 0), f(g, 0), f(b, 4)]; } }
};
function applyFilter(cv, key) {
  const F = FILTERS[key]; if (!F || !F.px) return;
  const g = cv.getContext('2d'), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const o = F.px(d[i], d[i + 1], d[i + 2]); d[i] = clamp8(o[0]); d[i + 1] = clamp8(o[1]); d[i + 2] = clamp8(o[2]); }
  g.putImageData(im, 0, 0);
}

// ---------- วางรูปลงช่อง: ครอบเต็มช่องอัตโนมัติ (cover) และปรับตำแหน่ง/ซูมได้ ----------
const ADJ = {}; // ปรับรูปในช่อง จำตามไฟล์รูป: { z: ซูม>=1, dx/dy: -1..1 }
const cl1 = v => Math.max(-1, Math.min(1, v || 0));
function fitRect(im, w, h, adj) {
  const z = Math.max(1, (adj && adj.z) || 1), k = Math.max(w / im.width, h / im.height) * z, sw = w / k, sh = h / k;
  return { k, sw, sh, sx: (im.width - sw) / 2 * (1 + cl1(adj && adj.dx)), sy: (im.height - sh) / 2 * (1 + cl1(adj && adj.dy)) };
}
function drawPhoto(g, im, x, y, w, h, filter, adj) {
  const f = fitRect(im, w, h, adj);
  if (filter === 'none') g.drawImage(im, f.sx, f.sy, f.sw, f.sh, x, y, w, h);
  else { const tc = mkCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); tc.getContext('2d').drawImage(im, f.sx, f.sy, f.sw, f.sh, 0, 0, tc.width, tc.height); applyFilter(tc, filter); g.drawImage(tc, x, y, w, h); }
}
let IMGFRAMES = []; // เฟรมลายพิเศษ 12 แบบ (public/frames/frames.json): ภาพที่เจาะช่องโปร่งใส + ตำแหน่งช่อง
async function renderImageFrame(canvas, files, { frame, filter = 'none', title, thumb }) {
  const im = await loadSrc(frame.file), W = frame.w, H = frame.h, slots = [];
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < frame.holes.length; i++) {
    const b = frame.holes[i], f = files[i], ph = f ? await loadImg(f) : null, bleed = 3; // ให้รูปล้นขอบช่องนิดหน่อย กันเส้นขาวระหว่างรูปกับกรอบ
    if (ph) drawPhoto(g, ph, b.x - bleed, b.y - bleed, b.w + 2 * bleed, b.h + 2 * bleed, filter, ADJ[f]);
    else { g.fillStyle = thumb ? '#cfd8ee' : '#ece8f4'; g.fillRect(b.x, b.y, b.w, b.h); if (thumb) sil(g, b.x + b.w * .2, b.y + b.h * .12, Math.min(b.w, b.h) * .6, '#fff'); }
    slots.push({ x: b.x, y: b.y, w: b.w, h: b.h, file: f || null });
  }
  if (im) g.drawImage(im, 0, 0, W, H);
  if (frame.title && title) { // ข้อความของผู้ใช้ลงในพื้นที่ว่างของเฟรม
    const t = frame.title; let fs = Math.min(t.h * .55, 90);
    g.fillStyle = t.color; g.textAlign = 'center'; g.textBaseline = 'middle';
    do { g.font = `600 ${fs}px Prompt, system-ui, sans-serif`; fs -= 2; } while (g.measureText(title).width > t.w && fs > 14);
    g.fillText(title, t.x + t.w / 2, t.y + t.h / 2); g.textBaseline = 'alphabetic';
  }
  canvas.__slots = slots;
}
async function renderFrame(canvas, files, o) {
  const fr = typeof o.tpl === 'string' && o.tpl.startsWith('img:') ? IMGFRAMES.find(f => 'img:' + f.id === o.tpl) : null;
  return fr ? renderImageFrame(canvas, files, { ...o, frame: fr }) : renderTemplateFrame(canvas, files, o);
}
async function renderTemplateFrame(canvas, files, { layout, color, title, tpl = 'classic', thumb, filter = 'none' }) {
  const T = TPL[tpl] || TPL.classic, [c, r] = LAYOUTS[layout], cell = 400, pad = T.pad || 24, bg = T.bg || color, d = new Date(), slots = [];
  const foot = T.foot ? T.foot.replace('{date}', d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })).replace('{year}', d.getFullYear()) : '';
  const head = Math.max(title ? 100 : pad, T.topMin || 0), footH = foot ? (T.footH || 64) : 0;
  const W = c * cell + pad * (c + 1), H = head + r * (cell + pad) + footH;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), o = { head, footH, title }, TT = { ...T, bg };
  const dark = parseInt(bg.slice(1, 3), 16) * 0.3 + parseInt(bg.slice(3, 5), 16) * 0.6 + parseInt(bg.slice(5, 7), 16) * 0.1 < 128;
  const tc = T.tc || (dark ? '#fff' : '#222');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  T.pre && T.pre(g, W, H, TT, o);
  for (let i = 0; i < c * r; i++) {
    const x = pad + (i % c) * (cell + pad), y = head + Math.floor(i / c) * (cell + pad);
    const im = files[i] ? await loadImg(files[i]) : null; // โหลดไม่ได้ (เช่น HEIC บนบางเบราว์เซอร์) → ถือว่าช่องว่าง
    slots.push({ x, y, w: cell, h: cell, file: im ? files[i] : null });
    if (T.ring && T.ringMode !== 'stroke') { g.fillStyle = T.ring; rr(g, x - T.rw, y - T.rw, cell + 2 * T.rw, cell + 2 * T.rw, (T.rx || 0) + T.rw); g.fill(); }
    g.save(); rr(g, x, y, cell, cell, T.rx || 0); g.clip();
    if (im) drawPhoto(g, im, x, y, cell, cell, filter, ADJ[files[i]]);
    else if (T.ph || thumb) { g.fillStyle = T.ph ? T.ph[i % T.ph.length] : 'rgba(255,255,255,.5)'; g.fillRect(x, y, cell, cell); if (thumb) sil(g, x + 60, y + 50, 280, T.pf || 'rgba(255,255,255,.7)'); }
    g.restore();
    if (T.ring && T.ringMode === 'stroke') { g.strokeStyle = T.ring; g.lineWidth = T.rw; rr(g, x, y, cell, cell, T.rx || 0); g.stroke(); }
    if (!im && !T.ph && !thumb) { g.strokeStyle = dark ? '#fff8' : '#0004'; g.strokeRect(x, y, cell, cell); }
  }
  const fam = T.fam || 'system-ui,sans-serif';
  if (title) { g.fillStyle = tc; g.font = `${T.fw || 'bold'} ${T.ts || 44}px ${fam}`; g.textAlign = T.align === 'left' ? 'left' : 'center'; g.fillText(title, T.align === 'left' ? pad : W / 2, head / 2 + 16 + (T.tyo || 0), W - 2 * pad); }
  if (foot) { g.fillStyle = T.fc || tc; g.font = `26px ${fam}`; g.textAlign = 'center'; g.fillText(foot, W / 2, H - footH / 2 + 9); }
  T.post && T.post(g, W, H, TT, o);
  canvas.__slots = slots;
}
// ---------- UI ----------
let tpl = 'classic', filt = 'none', thumbFile;
const frameOpts = () => ({ layout: $('layout').value, color: $('fcolor').value, title: $('ftitle').value, tpl, filter: filt });
const curFrame = () => IMGFRAMES.find(f => 'img:' + f.id === tpl);
const rendered = () => $('fc').hasAttribute('width');
let picked = []; // id ของรูปที่เลือก เรียงตามลำดับที่แตะ → ลำดับช่องใน Frame
const slots = () => { const f = curFrame(); if (f) return f.holes.length; const [c, r] = LAYOUTS[$('layout').value]; return c * r; };
function updatePickInfo() {
  $('pickInfo').textContent = picked.length
    ? `เลือก ${picked.length} รูป · แบบนี้มี ${slots()} ช่อง${picked.length > slots() ? ' (รูปที่เกินจะไม่ถูกใส่)' : ' (ช่องที่เหลือเติมอัตโนมัติ)'}`
    : `เฟรมนี้มี ${slots()} ช่อง · แตะรูปด้านบนเพื่อเลือกลำดับ ถ้าไม่เลือกจะใช้รูปแรกๆ ตามลำดับที่เข้ามา`;
}
function togglePick(id) {
  picked = picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id];
  document.querySelectorAll('#grid .pi').forEach(d => {
    const k = picked.indexOf(Number(d.dataset.id));
    d.classList.toggle('sel', k >= 0); d.lastChild.hidden = k < 0; d.lastChild.textContent = k + 1;
  });
  updatePickInfo(); renderFilterThumbs(); if (rendered()) buildBase();
}
function framePhotos() { // รูปที่เลือกก่อน แล้ววนใช้รูปเดิมซ้ำให้ครบทุกช่อง
  const chosen = picked.map(id => photos.find(p => p.id === id)).filter(Boolean);
  const available = [...chosen, ...photos.filter(p => !picked.includes(p.id))].map(p => p.file);
  if (!available.length) return [];
  return Array.from({ length: slots() }, (_, i) => available[i % available.length]);
}
// วาดครั้งเดียวลงแคนวาสเบื้องหลัง (ฟิลเตอร์/ครอบรูปใช้เวลา) แล้ววางสติ๊กเกอร์ทับตอนแสดง จะลากสติ๊กเกอร์ได้ลื่น
const baseCv = document.createElement('canvas');
let buildP = Promise.resolve(), pending = false, lastSlots = [];
function buildBase() { // รวมคำขอที่ถี่ๆ (ลากรูป/ซูม) ให้เรนเดอร์ทีละรอบ
  if (pending) return buildP;
  pending = true;
  buildP = buildP.then(async () => { pending = false; await renderFrame(baseCv, framePhotos(), frameOpts()); lastSlots = baseCv.__slots || []; paint(); }).catch(e => { pending = false; console.warn('frame', e); });
  return buildP;
}
function paint(sel = true) {
  const c = $('fc'); if (!baseCv.width) return;
  if (c.width !== baseCv.width || c.height !== baseCv.height) { c.width = baseCv.width; c.height = baseCv.height; }
  const g = c.getContext('2d'); g.drawImage(baseCv, 0, 0);
  if (window.Stickers) Stickers.draw(g, c.width, c.height, { selection: sel });
}
async function exportBlob() { // รูปสุดท้าย: เฟรม + สติ๊กเกอร์ (ไม่มีกรอบเลือก)
  await buildBase();
  const out = mkCanvas(baseCv.width, baseCv.height), g = out.getContext('2d');
  g.drawImage(baseCv, 0, 0); if (window.Stickers) Stickers.draw(g, out.width, out.height, {});
  return new Promise(r => out.toBlob(r, 'image/png'));
}
const preview = () => { renderFilterThumbs(); return buildBase(); };
window.FrameEditor = { // ให้ stickers.js ใช้ลากรูป/ซูมรูปในช่อง
  paint, rebuild: buildBase, rendered, preview,
  slotAt: (x, y) => lastSlots.find(s => s.file && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) || null,
  pan(slot, dx, dy) { // dx,dy = เลื่อนเป็นพิกเซลของแคนวาส: รูปเลื่อนตามนิ้ว
    const d = DIMS[slot.file]; if (!d) return;
    const a = ADJ[slot.file] = ADJ[slot.file] || { z: 1, dx: 0, dy: 0 };
    const k = Math.max(slot.w / d.w, slot.h / d.h) * Math.max(1, a.z), slx = (d.w - slot.w / k) / 2, sly = (d.h - slot.h / k) / 2;
    if (slx > 0) a.dx = cl1(a.dx - dx / k / slx); if (sly > 0) a.dy = cl1(a.dy - dy / k / sly);
    buildBase();
  },
  zoom(slot, f) { const a = ADJ[slot.file] = ADJ[slot.file] || { z: 1, dx: 0, dy: 0 }; a.z = Math.max(1, Math.min(4, a.z * f)); buildBase(); },
  resetPhotos() { Object.keys(ADJ).forEach(k => delete ADJ[k]); buildBase(); }
};
window.resetEditor = () => { Object.keys(ADJ).forEach(k => delete ADJ[k]); picked = []; baseCv.width = 0; lastSlots = []; if (window.Stickers) Stickers.clear(); };

function setTemplate(k) {
  tpl = k;
  document.querySelectorAll('#tpls .tp, #tplImg .tp').forEach(x => x.classList.toggle('on', x.dataset.k === k));
  $('fcolor').hidden = k !== 'classic'; $('layout').hidden = k.startsWith('img:');
  updatePickInfo(); if (rendered() || photos.length) preview();
}
$('layout').onchange = () => { updatePickInfo(); if (rendered()) preview(); };
$('fcolor').oninput = () => { if (tpl === 'classic' && rendered()) preview(); };
updatePickInfo();
Object.entries(TPL).forEach(([k, T]) => { // แถวเลือก Template (วาดด้วยโค้ด) พร้อมภาพตัวอย่าง
  const b = document.createElement('button'), cv = document.createElement('canvas');
  b.type = 'button'; b.dataset.k = k; b.className = 'tp' + (k === tpl ? ' on' : '');
  renderFrame(cv, [], { layout: '2x2', color: '#ffd1dc', title: 'Moment', tpl: k, thumb: true });
  b.append(cv); b.insertAdjacentHTML('beforeend', `<span>${T.name}</span><small>${T.tag}</small>`);
  b.onclick = () => setTemplate(k);
  $('tpls').append(b);
});
fetch('/frames/frames.json').then(r => r.json()).then(({ frames }) => { // เฟรมลายพิเศษ 12 แบบ
  IMGFRAMES = frames;
  frames.forEach(f => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.k = 'img:' + f.id; b.className = 'tp';
    b.innerHTML = `<img src="${f.thumb}" alt="" loading="lazy"><span>${f.name}</span><small>${f.tag}</small>`;
    b.onclick = () => setTemplate('img:' + f.id); $('tplImg').append(b);
  });
}).catch(() => { $('tplImg').textContent = 'โหลดเฟรมลายพิเศษไม่ได้'; });
function drawScene(g, s) { // ภาพตัวอย่างสำหรับดูฟิลเตอร์ ตอนยังไม่มีรูปในห้อง
  const sky = g.createLinearGradient(0, 0, 0, s); sky.addColorStop(0, '#8ab4f8'); sky.addColorStop(1, '#ffd7a8'); g.fillStyle = sky; g.fillRect(0, 0, s, s);
  g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(s * .74, s * .26, s * .12, 0, 7); g.fill();
  g.fillStyle = '#5aa469'; g.beginPath(); g.moveTo(0, s * .78); g.quadraticCurveTo(s * .4, s * .55, s, s * .8); g.lineTo(s, s); g.lineTo(0, s); g.fill();
  g.fillStyle = '#c2415a'; g.beginPath(); g.arc(s * .36, s * .52, s * .09, 0, 7); g.fill(); g.fillRect(s * .28, s * .6, s * .16, s * .3);
}
async function renderFilterThumbs(force) { // ตัวอย่างฟิลเตอร์ใช้รูปแรกของเฟรม (ไม่มีก็ใช้ภาพตัวอย่าง)
  const file = framePhotos()[0] || null;
  if (!force && file === thumbFile) return;
  thumbFile = file;
  const im = file ? await loadImg(file) : null;
  document.querySelectorAll('#fltrs .fl canvas').forEach(cv => {
    const g = cv.getContext('2d'), s = cv.width;
    if (im) { const k = Math.max(s / im.width, s / im.height), sw = s / k; g.drawImage(im, (im.width - sw) / 2, (im.height - sw) / 2, sw, sw, 0, 0, s, s); } else drawScene(g, s);
    applyFilter(cv, cv.dataset.k);
  });
}
Object.entries(FILTERS).forEach(([k, F]) => {
  const b = document.createElement('button'), cv = mkCanvas(72, 72);
  b.type = 'button'; b.className = 'fl' + (k === filt ? ' on' : ''); cv.dataset.k = k; b.append(cv);
  b.insertAdjacentHTML('beforeend', `<span>${F.name}</span>`);
  b.onclick = () => { filt = k; document.querySelectorAll('#fltrs .fl').forEach(x => x.classList.toggle('on', x === b)); preview(); };
  $('fltrs').append(b);
});
renderFilterThumbs(true);
window.onPhotoAdded = () => renderFilterThumbs();
const showLink = id => {
  const u = `${location.origin}/share.html?s=${id}`;
  $('flink').innerHTML = `บันทึกแล้ว: <a href="${u}" target="_blank">${u}</a>`;
};
$('fprev').onclick = preview;
$('fsave').onclick = async () => {
  const b = await exportBlob(); if (!b) return alert('สร้างรูป Frame ไม่สำเร็จ');
  const f = new FormData(); f.append('image', b, 'frame.png'); f.append('title', $('ftitle').value || moment.title);
  const hs = window.Stickers ? Stickers.hotspots() : []; if (hs.length) f.append('hotspots', JSON.stringify(hs)); // จุดกดฟังเสียงบนเฟรม
  const r = await fetch(`/api/moments/${moment.id}/album`, { method: 'POST', body: f });
  if (!r.ok) return alert('บันทึกไม่สำเร็จ');
  showLink((await r.json()).shareId);
};
socket.on('album_saved', ({ shareId }) => showLink(shareId));
