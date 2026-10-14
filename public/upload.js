$('mUpload').onclick = async () => {
  const files = [...$('mFiles').files];
  if (!$('groupSel').value) return alert('เลือกหรือสร้างกลุ่มก่อน');
  if (!files.length) return alert('เลือกรูปก่อน');
  let done = 0;
  for (const f of files) {
    let t = null, lat = null, lng = null;
    try { const ex = await exifr.parse(f, ['DateTimeOriginal', 'CreateDate']); const d = ex && (ex.DateTimeOriginal || ex.CreateDate); if (d) t = +new Date(d); } catch {}
    try { const g = await exifr.gps(f); if (g) { lat = g.latitude; lng = g.longitude; } } catch {}
    if (t == null) t = $('mTime').value ? +new Date($('mTime').value) : f.lastModified; // ไม่มี EXIF → ใช้ค่าที่ผู้ใช้ใส่
    const fd = new FormData();
    fd.append('photo', f); fd.append('takenAt', t);
    fd.append('lat', lat ?? ''); fd.append('lng', lng ?? ''); fd.append('tag', $('mTag').value); fd.append('groupId', $('groupSel').value);
    try { if ((await fetch('/api/memories', { method: 'POST', body: fd })).ok) done++; } catch {}
    $('mStatus').textContent = `อัปโหลดแล้ว ${done}/${files.length} รูป`;
  }
  if (done < files.length) $('mStatus').textContent += ` (ไม่สำเร็จ ${files.length - done} รูป — อาจไม่ใช่ไฟล์รูปหรือเกิน 20 MB)`;
};
async function loadSuggestions() {
  const r0 = await fetch('/api/suggestions?groupId=' + encodeURIComponent($('groupSel').value));
  const list = r0.ok ? await r0.json() : [];
  $('mSug').innerHTML = list.length ? '' : '<p class="hint">ยังไม่พบรูปที่น่าจะเป็น event เดียวกัน</p>';
  list.forEach(s => {
    const d = document.createElement('div'); d.className = 'card';
    d.innerHTML = `<b>${esc(s.title)}</b><div>${s.count} รูป · ${s.members.map(esc).join(', ')}</div><small class="hint">${s.status === 'confirmed' ? 'สร้างเป็น Moment แล้ว · เก็บไว้ในรายการนี้' : 'รอยืนยัน'}</small>`;
    const b = document.createElement('button'); b.textContent = s.status === 'confirmed' ? 'เปิด Moment' : 'ยืนยัน แล้วสร้าง Frame';
    b.onclick = async () => {
      if (s.status === 'confirmed' && s.momentId) {
        await enter(s.momentId, true);
        ['cam', 'shot', 'cnt'].forEach(x => $(x).hidden = true); $('auto').parentElement.hidden = true;
        return;
      }
      const r = await fetch('/api/suggestions/confirm', J({ ids: s.ids, title: s.title, groupId: $('groupSel').value }));
      if (!r.ok) return alert('ยืนยันไม่สำเร็จ');
      const result = await r.json(); s.status = 'confirmed'; s.momentId = result.id;
      b.textContent = 'เปิด Moment'; d.querySelector('small').textContent = 'สร้างเป็น Moment แล้ว · เก็บไว้ในรายการนี้';
      await enter(result.id, true);
      ['cam', 'shot', 'cnt'].forEach(x => $(x).hidden = true); $('auto').parentElement.hidden = true;
    };
    d.append(b); $('mSug').append(d);
  });
}
$('mFind').onclick = loadSuggestions;
