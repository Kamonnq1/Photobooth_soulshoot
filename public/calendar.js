// ปฏิทินเลือกวัน-เวลาของ Moment (เลือกได้ตั้งแต่ตอนนี้ถึงไม่เกิน 3 เดือน) + ปุ่มเพิ่มลงปฏิทิน (Google / Outlook / ไฟล์ .ics)
(() => {
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'], DOWF = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const STEP = 60000, p2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const fmt = d => d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()), same = (a, b) => day0(a).getTime() === day0(b).getTime();
const ym = d => d.getFullYear() * 12 + d.getMonth(), add = (d, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const btn = (cls, txt, label) => { const b = el('button', cls, txt); b.type = 'button'; if (label) b.setAttribute('aria-label', label); return b; };
function limits() { // ช่วงที่เลือกได้: ตั้งแต่ตอนนี้ (ปัดขึ้นเป็นนาทีเต็ม อย่างน้อย 1 นาทีจากนี้) ถึง +3 เดือน
  const now = Date.now(), mx = new Date(now); mx.setMonth(mx.getMonth() + 3);
  return { min: new Date(Math.ceil((now + 60000) / STEP) * STEP), max: new Date(Math.floor(mx.getTime() / STEP) * STEP) };
}
function sheet(label) { // โครง dialog/bottom-sheet ใช้ร่วม: Esc ปิด, คลิกฉากหลังปิด, Tab วนอยู่ในกล่อง, คืนโฟกัสเดิมตอนปิด
  const back = el('div', 'calback'), box = el('div', 'calsheet'), prev = document.activeElement;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', label);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus(); };
  const onKey = e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'Tab') {
      const f = [...box.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')]; if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  back.append(box); document.body.append(back);
  return { box, close };
}

// ---------------- ตัวเลือกวัน-เวลา ----------------
function openPicker() {
  const { min, max } = limits();
  let sel = new Date($('start').value);
  if (isNaN(sel) || sel < min || sel > max) sel = new Date(min);
  sel = new Date(Math.round(sel.getTime() / STEP) * STEP);
  let view = new Date(sel.getFullYear(), sel.getMonth(), 1), firstScroll = true;
  const { box, close } = sheet('เลือกวันและเวลา');
  const prev = btn('calnav', '‹', 'เดือนก่อนหน้า'), next = btn('calnav', '›', 'เดือนถัดไป'), title = el('b', 'caltitle'), grid = el('div', 'calgrid');
  title.setAttribute('aria-live', 'polite');
  const head = el('div', 'calhead'); head.append(prev, title, next);
  grid.setAttribute('role', 'grid'); grid.setAttribute('aria-label', 'เลือกวัน');
  const quick = el('div', 'calquick');
  const hcol = el('div', 'calcol'), mcol = el('div', 'calcol'), tw = el('div', 'caltime');
  hcol.setAttribute('role', 'listbox'); hcol.setAttribute('aria-label', 'ชั่วโมง'); mcol.setAttribute('role', 'listbox'); mcol.setAttribute('aria-label', 'นาที');
  const hw = el('div'), mw = el('div'); hw.append(el('small', null, 'ชั่วโมง'), hcol); mw.append(el('small', null, 'นาที'), mcol); tw.append(hw, el('b', 'colon', ':'), mw);
  const sum = el('p', 'calsum'), note = el('p', 'calnote', `เลือกได้ตั้งแต่ ${fmt(min)} ถึง ${fmt(max)} (ไม่เกิน 3 เดือน)`);
  sum.setAttribute('aria-live', 'polite');
  const cancel = btn('', 'ยกเลิก'), ok = btn('primary', 'ตกลง'), act = el('div', 'calact'); act.append(cancel, ok);
  box.append(head, grid, quick, tw, sum, note, act);

  const range = d => ({ lo: same(d, min) ? min : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0), hi: same(d, max) ? max : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59) });
  const at = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  const clampSel = () => { const { lo, hi } = range(sel); if (sel < lo) sel = new Date(lo); if (sel > hi) sel = new Date(hi); };
  const dayOk = d => day0(d) >= day0(min) && day0(d) <= day0(max);
  clampSel();
  function setSel(d) { sel = d; clampSel(); view = new Date(sel.getFullYear(), sel.getMonth(), 1); render(); }
  function focusDay(d) { // ย้ายโฟกัสไปวันที่ต้องการ (ไม่ออกนอกช่วงที่เลือกได้)
    d = day0(d); if (d < day0(min)) d = day0(min); if (d > day0(max)) d = day0(max);
    view = new Date(d.getFullYear(), d.getMonth(), 1); render();
    const b = grid.querySelector(`[data-t="${d.getTime()}"]`);
    if (b) { grid.querySelectorAll('.calday').forEach(x => x.tabIndex = -1); b.tabIndex = 0; b.focus(); }
  }
  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    title.textContent = `${MONTHS[m]} ${y + 543}`;
    prev.disabled = ym(view) <= ym(min); next.disabled = ym(view) >= ym(max); // ปุ่มเลื่อนเดือนหยุดที่ขอบช่วง
    grid.innerHTML = '';
    const hr = el('div', 'calrow'); hr.setAttribute('role', 'row');
    DOW.forEach((d, i) => { const h = el('div', 'caldow', d); h.setAttribute('role', 'columnheader'); h.setAttribute('aria-label', DOWF[i]); hr.append(h); });
    grid.append(hr);
    const lead = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(); let row;
    for (let i = 0; i < lead + n; i++) {
      if (i % 7 === 0) { row = el('div', 'calrow'); row.setAttribute('role', 'row'); grid.append(row); }
      if (i < lead) { row.append(el('div', 'calcell')); continue; }
      const d = new Date(y, m, i - lead + 1), isSel = same(d, sel), today = same(d, new Date());
      const b = btn('calday' + (today ? ' today' : '') + (isSel ? ' sel' : ''), String(d.getDate()));
      b.setAttribute('role', 'gridcell'); b.setAttribute('aria-selected', String(isSel)); b.dataset.t = d.getTime();
      b.setAttribute('aria-label', d.toLocaleDateString('th-TH', { dateStyle: 'full' }) + (today ? ' (วันนี้)' : ''));
      b.disabled = !dayOk(d); b.tabIndex = isSel && !b.disabled ? 0 : -1;
      b.onclick = () => { sel = at(d, sel.getHours(), sel.getMinutes()); clampSel(); render(); const nb = grid.querySelector('.sel'); nb && nb.focus(); };
      row.append(b);
    }
    if (!grid.querySelector('.calday[tabindex="0"]')) { const f = grid.querySelector('.calday:not(:disabled)'); if (f) f.tabIndex = 0; }
    quick.innerHTML = '';
    [['อีก 1 ชั่วโมง', () => new Date(Math.ceil((Date.now() + 3600000) / STEP) * STEP)],
     ['วันนี้ 18:00', () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; }],
     ['พรุ่งนี้ 18:00', () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d; }]].forEach(([t, f]) => {
      const d = f(); if (d < min || d > max) return;
      const c = btn('calchip', t); c.onclick = () => setSel(d); quick.append(c);
    });
    const { lo, hi } = range(sel); hcol.innerHTML = ''; mcol.innerHTML = '';
    for (let h = 0; h < 24; h++) {
      const b = btn('calopt2' + (h === sel.getHours() ? ' on' : ''), p2(h)); b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(h === sel.getHours()));
      b.disabled = !(at(sel, h, 59) >= lo && at(sel, h, 0) <= hi);
      b.onclick = () => { // เปลี่ยนชั่วโมง: ถ้านาทีเดิมใช้ไม่ได้ ขยับไปนาทีที่ใกล้ที่สุดที่ใช้ได้
        for (let mm = sel.getMinutes(), k = 0; k < 60; k++, mm = (mm + 1) % 60) { const t = at(sel, h, mm); if (t >= lo && t <= hi) { sel = t; break; } }
        render();
      };
      hcol.append(b);
    }
    for (let mm = 0; mm < 60; mm++) {
      const b = btn('calopt2' + (mm === sel.getMinutes() ? ' on' : ''), p2(mm)); b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(mm === sel.getMinutes()));
      const t = at(sel, sel.getHours(), mm); b.disabled = t < lo || t > hi;
      b.onclick = () => { sel = t; render(); };
      mcol.append(b);
    }
    sum.textContent = `เลือกแล้ว: ${fmt(sel)}`;
    if (firstScroll) { firstScroll = false; [hcol, mcol].forEach(c => { const on = c.querySelector('.on'); if (on) c.scrollTop = on.offsetTop - c.clientHeight / 2 + on.offsetHeight / 2; }); }
  }
  prev.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
  next.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };
  grid.addEventListener('keydown', e => { // คีย์ลัดตามแนวทางปฏิทินมาตรฐาน: ลูกศร ±1 วัน/±1 สัปดาห์, Home/End ต้น/ท้ายสัปดาห์, PageUp/PageDown ±1 เดือน
    const t = e.target.closest && e.target.closest('.calday'); if (!t) return;
    const d = new Date(+t.dataset.t), mo = k => { const x = new Date(d.getFullYear(), d.getMonth() + k, 1); x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; };
    const nx = { ArrowLeft: () => add(d, -1), ArrowRight: () => add(d, 1), ArrowUp: () => add(d, -7), ArrowDown: () => add(d, 7), Home: () => add(d, -d.getDay()), End: () => add(d, 6 - d.getDay()), PageUp: () => mo(-1), PageDown: () => mo(1) }[e.key];
    if (nx) { e.preventDefault(); focusDay(nx()); }
  });
  cancel.onclick = close;
  ok.onclick = () => { $('start').value = iso(sel); $('startBtn').textContent = '📅 ' + fmt(sel); $('start').dispatchEvent(new Event('change')); close(); };
  render();
  const f = grid.querySelector('.calday[tabindex="0"]'); if (f) f.focus();
}
function initStart() { // ค่าเริ่มต้น = เวลาแรกที่เลือกได้ (ปัดเป็นนาทีเต็ม)
  const { min, max } = limits(); let d = new Date($('start').value);
  if (isNaN(d) || d < min || d > max) d = min;
  $('start').value = iso(d); $('startBtn').textContent = '📅 ' + fmt(d);
}
$('startBtn').onclick = openPicker; initStart();

// ---------------- เพิ่มลงปฏิทิน (Moment ที่ยังไม่ถึงเวลา) ----------------
const utc = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ics = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function eventOf(e) { // ความยาวเริ่มต้น 1 ชั่วโมง ใส่ลิงก์เข้าห้อง (ลิงก์เชิญ) ไว้ในรายละเอียด
  const url = `${location.origin}/?g=${e.code}&m=${e.id}`;
  return { ...e, end: e.start + 3600000, url, desc: `ถึงเวลาแล้วกดลิงก์เพื่อเข้าห้องถ่ายรูปพร้อมเพื่อนๆ\n${url}` };
}
const buildICS = e => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SOULSHOOT//TH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
  `UID:${e.id}@soulshoot`, `DTSTAMP:${utc(Date.now())}`, `DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end)}`, `SUMMARY:${ics('📸 ' + e.title)}`,
  `DESCRIPTION:${ics(e.desc)}`, `URL:${e.url}`, 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${ics(e.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const googleURL = e => 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('📸 ' + e.title) + '&dates=' + utc(e.start) + '/' + utc(e.end) + '&details=' + encodeURIComponent(e.desc);
const outlookURL = e => 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' + encodeURIComponent('📸 ' + e.title) +
  '&startdt=' + encodeURIComponent(new Date(e.start).toISOString()) + '&enddt=' + encodeURIComponent(new Date(e.end).toISOString()) + '&body=' + encodeURIComponent(e.desc);
window.openAddCal = raw => {
  const e = eventOf(raw), { box, close } = sheet('เพิ่มลงปฏิทิน');
  const list = el('div', 'calopts');
  const link = (t, href) => { const a = el('a', 'calopt', t); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.onclick = () => setTimeout(close, 200); return a; };
  const dl = btn('calopt', '🍎 Apple / ปฏิทินอื่นๆ (ไฟล์ .ics)');
  dl.onclick = () => {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([buildICS(e)], { type: 'text/calendar;charset=utf-8' })); a.download = `soulshoot-${e.id}.ics`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (typeof toast === 'function') toast('ดาวน์โหลดไฟล์ปฏิทินแล้ว เปิดไฟล์เพื่อเพิ่ม'); close();
  };
  list.append(link('🗓 Google Calendar', googleURL(e)), link('📧 Outlook', outlookURL(e)), dl);
  const cl = btn('', 'ปิด'); cl.onclick = close;
  box.append(el('h3', 'calh', 'เพิ่มลงปฏิทิน'), el('p', 'calsum', `${e.title} · ${fmt(new Date(e.start))}`), list,
    el('p', 'calnote', 'ระยะเวลา 1 ชั่วโมง มีลิงก์เข้าห้องในรายละเอียด · ไฟล์ .ics ตั้งเตือนก่อน 10 นาทีให้ ปรับได้ในปฏิทินของคุณ'), cl);
  const f = box.querySelector('.calopt'); f && f.focus();
};
$('liveCal').onclick = () => {
  const g = groupsCache.find(x => x.id === moment.groupId);
  g ? openAddCal({ id: moment.id, title: moment.title, start: moment.startAt, code: g.code }) : toast('ยังไม่พบข้อมูลกลุ่ม');
};
window.SoulSheet = sheet;
window.SoulCal = { buildICS: r => buildICS(eventOf(r)), googleURL: r => googleURL(eventOf(r)), outlookURL: r => outlookURL(eventOf(r)), limits };
})();
