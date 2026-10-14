const fs = require('fs'), path = require('path'), crypto = require('crypto'), express = require('express'), multer = require('multer');
const { suggest } = require('./matcher'), db = require('./db');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif' };
const OKEXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const extOf = f => { const e = path.extname(f.originalname || '').toLowerCase(); return EXT[f.mimetype] || (OKEXT.has(e) ? e : null); };

module.exports = (io, schedule) => {
  const r = express.Router(), rnd = n => crypto.randomBytes(n).toString('hex');
  const up = multer({ // รับเฉพาะรูป จำกัด 20 MB เก็บพร้อมนามสกุลที่ถูกต้อง
    storage: multer.diskStorage({ destination: path.join(__dirname, 'uploads'), filename: (q, f, cb) => cb(null, rnd(16) + extOf(f)) }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (q, f, cb) => cb(null, !!extOf(f))
  });
  const AEXT = { 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav', 'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3' };
  const upAudio = multer({ // เสียงสั้นๆ (ฝั่งหน้าเว็บอัดเป็น WAV เล่นได้ทุกเบราว์เซอร์) จำกัด 3 MB
    storage: multer.diskStorage({ destination: path.join(__dirname, 'uploads'), filename: (q, f, cb) => cb(null, rnd(16) + AEXT[f.mimetype]) }),
    limits: { fileSize: 3 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, !!AEXT[f.mimetype])
  });
  const str = (v, max = 60) => String(v ?? '').trim().slice(0, max);
  const num = v => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  const isMember = (g, u) => !!(g && u && db.prepare('select 1 from members where groupId=? and userId=?').get(g, u.id));
  const groupOf = id => db.prepare('select * from groups where id=?').get(id);
  const notifyMembers = gid => io.to('group:' + gid).emit('group_members_update', { groupId: gid, count: db.prepare('select count(*) n from members where groupId=?').get(gid).n });
  const dropFromGroup = (gid, uid, kicked) => { // ดึงผู้ใช้ออกจาก room ของกลุ่ม/Moment ในกลุ่มนั้นทันที (ถูกเตะหรือออกเอง)
    for (const sk of io.sockets.sockets.values()) {
      const d = sk.data || {};
      if (d.userId !== uid) continue;
      if (d.groupId === gid) { sk.leave('group:' + gid); delete d.groupId; }
      if (d.momentGroup === gid) { sk.leave(d.momentId); delete d.momentId; delete d.momentGroup; delete d.name; }
      if (kicked) sk.emit('kicked', { groupId: gid });
    }
  };
  const removeGroup = gid => { // ไม่เหลือสมาชิกแล้ว → ลบกลุ่มและข้อมูลของ Moment ในกลุ่ม
    const ids = db.prepare('select id from moments where groupId=?').all(gid).map(m => m.id);
    db.transaction(() => {
      for (const id of ids) { db.prepare('delete from photos where momentId=?').run(id); db.prepare('delete from albums where momentId=?').run(id); db.prepare('delete from voices where momentId=?').run(id); }
      db.prepare('delete from suggestions where groupId=?').run(gid); db.prepare('delete from memories where groupId=?').run(gid);
      db.prepare('delete from moments where groupId=?').run(gid); db.prepare('delete from groups where id=?').run(gid);
    })();
    ids.forEach(id => schedule.cancel(id));
  };
  const fail = (q, s, code) => { if (q.file) fs.unlink(q.file.path, () => {}); return s.sendStatus(code); };

  r.use((q, s, n) => { // ระบุตัวตนจาก token
    const t = q.headers['x-token'];
    q.user = t ? db.prepare('select * from users where token=?').get(t) : null; n();
  });
  r.get('/me', (q, s) => q.user ? s.json({ id: q.user.id, name: q.user.name }) : s.sendStatus(401));
  r.post('/users', (q, s) => {
    const u = { id: rnd(4), name: str(q.body.name, 40) || 'guest', token: rnd(16) };
    db.prepare('insert into users values(?,?,?)').run(u.id, u.name, u.token); s.json(u);
  });
  r.post('/groups', (q, s) => {
    if (!q.user) return s.sendStatus(401);
    const g = { id: rnd(3), name: str(q.body.name, 40) || 'Group', code: rnd(3) };
    db.prepare('insert into groups(id,name,code,ownerId) values(?,?,?,?)').run(g.id, g.name, g.code, q.user.id);
    db.prepare('insert into members values(?,?)').run(g.id, q.user.id); s.json(g);
  });
  r.post('/groups/join', (q, s) => {
    if (!q.user) return s.sendStatus(401);
    const g = db.prepare('select * from groups where code=?').get(str(q.body.code, 20));
    if (!g) return s.sendStatus(404);
    const result = db.prepare('insert or ignore into members values(?,?)').run(g.id, q.user.id);
    if (result.changes) {
      const n = db.prepare('select count(*) n from members where groupId=?').get(g.id).n;
      io.to('group:' + g.id).emit('group_members_update', { groupId: g.id, count: n });
    }
    s.json(g);
  });
  r.get('/groups', (q, s) => s.json(!q.user ? [] : db.prepare(
    'select g.*, (select count(*) from members where groupId=g.id) n from groups g join members m on m.groupId=g.id where m.userId=? order by m.rowid').all(q.user.id)
    .map(g => ({ ...g, isOwner: g.ownerId === q.user.id }))));
  r.get('/groups/:id/members', (q, s) => { // ดูสมาชิก: สมาชิกทุกคนดูได้ เรียงตามลำดับที่เข้ากลุ่ม
    const g = groupOf(q.params.id);
    if (!g || !isMember(g.id, q.user)) return s.sendStatus(g ? 403 : 404);
    s.json(db.prepare('select u.id, u.name from members m join users u on u.id=m.userId where m.groupId=? order by m.rowid').all(g.id)
      .map(u => ({ id: u.id, name: u.name, owner: u.id === g.ownerId, me: u.id === q.user.id })));
  });
  r.delete('/groups/:id/members/:uid', (q, s) => { // เตะสมาชิก: เฉพาะหัวหน้ากลุ่ม (เตะแล้วกลับเข้ามาใหม่ด้วยลิงก์/รหัสเดิมได้)
    const g = groupOf(q.params.id);
    if (!g) return s.sendStatus(404);
    if (!q.user || g.ownerId !== q.user.id) return s.sendStatus(403);
    if (q.params.uid === q.user.id) return s.sendStatus(400); // จะออกเองให้ใช้ "ออกจากกลุ่ม"
    if (!db.prepare('delete from members where groupId=? and userId=?').run(g.id, q.params.uid).changes) return s.sendStatus(404);
    dropFromGroup(g.id, q.params.uid, true); notifyMembers(g.id); s.sendStatus(204);
  });
  r.post('/groups/:id/leave', (q, s) => { // ออกจากกลุ่ม: ถ้าเป็นหัวหน้า โอนให้คนที่เข้ากลุ่มถัดไป / ถ้าเป็นคนสุดท้าย ลบกลุ่ม
    const g = groupOf(q.params.id);
    if (!g) return s.sendStatus(404);
    if (!isMember(g.id, q.user)) return s.sendStatus(403);
    db.prepare('delete from members where groupId=? and userId=?').run(g.id, q.user.id);
    const next = db.prepare('select m.userId id, u.name from members m join users u on u.id=m.userId where m.groupId=? order by m.rowid limit 1').get(g.id);
    if (!next) removeGroup(g.id);
    else if (g.ownerId === q.user.id) db.prepare('update groups set ownerId=? where id=?').run(next.id, g.id);
    dropFromGroup(g.id, q.user.id, false);
    if (next) notifyMembers(g.id);
    s.json({ deleted: !next, newOwner: next && g.ownerId === q.user.id ? next.name : null });
  });
  r.get('/invite', (q, s) => { // พรีวิวคำเชิญ (สาธารณะ แต่ต้องรู้รหัสกลุ่ม)
    const g = db.prepare('select id,name from groups where code=?').get(str(q.query.g, 20));
    if (!g) return s.sendStatus(404);
    const m = q.query.m ? db.prepare('select id,title,startAt from moments where id=? and groupId=?').get(str(q.query.m, 20), g.id) : null;
    s.json({ group: { name: g.name, n: db.prepare('select count(*) c from members where groupId=?').get(g.id).c }, moment: m || null, member: isMember(g.id, q.user) });
  });
  r.get('/groups/:id/moments', (q, s) => { // รายการ Moment ของกลุ่ม (เฉพาะสมาชิก)
    if (!isMember(q.params.id, q.user)) return s.sendStatus(403);
    const g = groupOf(q.params.id);
    s.json(db.prepare('select m.id, m.title, m.startAt, m.createdBy, (select count(*) from photos p where p.momentId=m.id) n from moments m where m.groupId=? order by m.startAt desc').all(q.params.id)
      .map(({ createdBy, ...m }) => ({ ...m, del: createdBy === q.user.id || g.ownerId === q.user.id }))); // ลบได้: คนสร้าง หรือหัวหน้ากลุ่ม
  });
  r.post('/push-test', (q, s) => { // ปุ่ม "ทดสอบแจ้งเตือน"
    if (!q.user) return s.sendStatus(401);
    s.json({ sent: schedule.pushUser(q.user.id, { title: 'SOULSHOOT', body: 'ทดสอบแจ้งเตือน: ทำงานปกติ ✓', tag: 'soulshoot-test', url: '/' }) });
  });
  r.get('/push-key', (q, s) => s.json({ key: schedule.publicKey }));
  r.post('/push-sub', (q, s) => {
    if (!q.user || !q.body.endpoint) return s.sendStatus(q.user ? 400 : 401);
    db.prepare('insert or replace into push_subs values(?,?,?)').run(q.user.id, q.body.endpoint, JSON.stringify(q.body)); s.sendStatus(201);
  });

  r.post('/moments', (q, s) => {
    const groupId = str(q.body.groupId, 20), startAt = num(q.body.startAt), id = rnd(3);
    if (!isMember(groupId, q.user)) return s.sendStatus(403);
    if (startAt == null) return s.sendStatus(400);
    const lim = new Date(); lim.setMonth(lim.getMonth() + 3); // ตั้งเวลาได้ตั้งแต่ตอนนี้ถึงไม่เกิน 3 เดือน (เผื่อ 1 วัน)
    if (startAt < Date.now() - 60000 || startAt > lim.getTime() + 86400000) return s.status(400).json({ error: 'เวลาต้องอยู่ภายใน 3 เดือนข้างหน้า' });
    db.prepare('insert into moments(id,title,startAt,groupId,createdBy) values(?,?,?,?,?)').run(id, str(q.body.title, 60) || 'Moment', startAt, groupId, q.user.id);
    schedule(id, startAt);
    const created = { id, title: str(q.body.title, 60) || 'Moment', startAt, n: 0 };
    io.to('group:' + groupId).emit('moment_created', created);
    s.json({ id });
  });
  r.get('/moments/:id', (q, s) => {
    const m = db.prepare('select * from moments where id=?').get(q.params.id);
    if (!m) return s.sendStatus(404);
    if (!isMember(m.groupId, q.user)) return s.sendStatus(403);
    s.json({ ...m, voices: db.prepare('select id, userId, member, file, secs from voices where momentId=? order by id').all(m.id), photos: db.prepare('select * from photos where momentId=? order by takenAt').all(m.id) });
  });
  r.delete('/moments/:id', (q, s) => { // ลบ Moment: คนสร้าง หรือหัวหน้ากลุ่ม
    const m = db.prepare('select * from moments where id=?').get(q.params.id);
    if (!m) return s.sendStatus(404);
    const g = groupOf(m.groupId);
    if (!isMember(m.groupId, q.user) || !(m.createdBy === q.user.id || (g && g.ownerId === q.user.id))) return s.sendStatus(403);
    db.transaction(() => {
      db.prepare('delete from photos where momentId=?').run(m.id);
      db.prepare('delete from albums where momentId=?').run(m.id);
      db.prepare('delete from voices where momentId=?').run(m.id);
      db.prepare('update memories set momentId=null where momentId=?').run(m.id); // รูปย้อนหลังกลับไปรอจับกลุ่มใหม่ได้
      db.prepare("update suggestions set status='pending', momentId=null where momentId=?").run(m.id);
      db.prepare('delete from moments where id=?').run(m.id);
    })();
    schedule.cancel(m.id); io.to(m.id).emit('moment_deleted'); io.to('group:' + m.groupId).emit('moments_changed'); s.sendStatus(204);
  });
  r.post('/moments/:id/voices', upAudio.single('audio'), (q, s) => { // อัปโหลดเสียงของสมาชิก (สั้นๆ ไม่เกิน 15 วินาที)
    const mo = db.prepare('select groupId from moments where id=?').get(q.params.id);
    if (!q.file) return s.sendStatus(400);
    if (!mo) return fail(q, s, 404);
    if (!isMember(mo.groupId, q.user)) return fail(q, s, 403);
    const secs = Math.max(0, Math.min(20, num(q.body.secs) || 0));
    const v = { momentId: q.params.id, userId: q.user.id, member: q.user.name, file: q.file.filename, secs };
    v.id = Number(db.prepare('insert into voices(momentId,userId,member,file,secs,createdAt) values(?,?,?,?,?,?)').run(v.momentId, v.userId, v.member, v.file, v.secs, Date.now()).lastInsertRowid);
    const out = { id: v.id, userId: v.userId, member: v.member, file: v.file, secs: v.secs };
    io.to(v.momentId).emit('voice_uploaded', out); s.json(out);
  });
  r.delete('/voices/:id', (q, s) => { // ลบเสียง: คนอัด หรือหัวหน้ากลุ่ม
    const v = db.prepare('select * from voices where id=?').get(Number(q.params.id));
    if (!v) return s.sendStatus(404);
    const mo = db.prepare('select groupId from moments where id=?').get(v.momentId), g = mo && groupOf(mo.groupId);
    if (!q.user || !(v.userId === q.user.id || (g && g.ownerId === q.user.id))) return s.sendStatus(403);
    db.prepare('delete from voices where id=?').run(v.id);
    fs.unlink(path.join(__dirname, 'uploads', v.file), () => {});
    io.to(v.momentId).emit('voice_deleted', { id: v.id }); s.sendStatus(204);
  });
  r.post('/moments/:id/photos', up.single('photo'), (q, s) => {
    const id = q.params.id;
    if (!q.file) return s.sendStatus(400);
    const mo = db.prepare('select groupId from moments where id=?').get(id);
    if (!mo) return fail(q, s, 404);
    if (!isMember(mo.groupId, q.user)) return fail(q, s, 403);
    const p = { momentId: id, member: str(q.body.member, 40) || 'guest', file: q.file.filename, takenAt: num(q.body.takenAt) ?? Date.now() };
    p.id = Number(db.prepare('insert into photos(momentId,member,file,takenAt) values(?,?,?,?)').run(id, p.member, p.file, p.takenAt).lastInsertRowid);
    io.to(id).emit('photo_uploaded', p); s.json(p);
  });
  r.post('/moments/:id/album', up.single('image'), (q, s) => {
    const m = db.prepare('select * from moments where id=?').get(q.params.id), id = rnd(4);
    if (!q.file) return s.sendStatus(400);
    if (!m) return fail(q, s, 404);
    if (!isMember(m.groupId, q.user)) return fail(q, s, 403);
    let hs = [];
    try { hs = JSON.parse(q.body.hotspots || '[]'); } catch {}
    hs = (Array.isArray(hs) ? hs : []).slice(0, 20).map(h => ({ x: num(h.x), y: num(h.y), s: num(h.s), r: num(h.r) || 0, voiceId: Number(h.voiceId) }))
      .filter(h => [h.x, h.y, h.s].every(v => v != null && v >= -0.2 && v <= 1.2) && db.prepare('select 1 from voices where id=? and momentId=?').get(h.voiceId, m.id));
    db.prepare('insert into albums(id,momentId,title,file,createdAt,hotspots) values(?,?,?,?,?,?)').run(id, m.id, str(q.body.title, 80) || m.title, q.file.filename, Date.now(), JSON.stringify(hs));
    io.to(m.id).emit('album_saved', { shareId: id }); s.json({ shareId: id });
  });
  r.get('/albums', (q, s) => { // ถ้าระบุ groupId จะกรองเฉพาะกลุ่มนั้น
    const gid = str(q.query.groupId, 20);
    s.json(!q.user ? [] : db.prepare(`select a.* from albums a join moments m on m.id=a.momentId join members g on g.groupId=m.groupId where g.userId=?${gid ? ' and m.groupId=?' : ''} order by a.createdAt desc`).all(...(gid ? [q.user.id, gid] : [q.user.id])));
  });
  r.get('/share/:id', (q, s) => {
    const a = db.prepare('select * from albums where id=?').get(q.params.id);
    if (!a) return s.sendStatus(404);
    let hs = []; try { hs = JSON.parse(a.hotspots || '[]'); } catch {}
    const voices = db.prepare('select id, member, file, secs from voices where momentId=? order by id').all(a.momentId); // เสียงทั้งหมดของ Moment ฟังได้ในหน้าแชร์
    s.json({ id: a.id, title: a.title, file: a.file, createdAt: a.createdAt, hotspots: hs, voices });
  });

  r.post('/memories', up.single('photo'), (q, s) => {
    const b = q.body, groupId = str(b.groupId, 20), takenAt = num(b.takenAt), lat = num(b.lat), lng = num(b.lng);
    if (!q.file) return s.sendStatus(400);
    if (!isMember(groupId, q.user)) return fail(q, s, 403);
    if (takenAt == null) return fail(q, s, 400);
    const gps = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    db.prepare('insert into memories(member,file,takenAt,lat,lng,tag,groupId) values(?,?,?,?,?,?,?)')
      .run(q.user.name, q.file.filename, takenAt, gps ? lat : null, gps ? lng : null, str(b.tag, 40).toLowerCase(), groupId);
    s.sendStatus(201);
  });
  r.get('/suggestions', (q, s) => {
    const g = str(q.query.groupId, 20);
    if (!isMember(g, q.user)) return s.json([]);
    const found = suggest(db.prepare('select * from memories where momentId is null and groupId=?').all(g));
    const save = db.prepare(`insert or ignore into suggestions(signature,groupId,ids,title,members,count,startAt,status,createdAt)
      values(?,?,?,?,?,?,?,'pending',?)`);
    for (const x of found) {
      const ids = [...x.ids].sort((a, b) => a - b), signature = g + ':' + ids.join(',');
      save.run(signature, g, JSON.stringify(ids), x.title, JSON.stringify(x.members), x.count, x.startAt, Date.now());
    }
    // Recover already-confirmed Smart Memory Moments created before suggestions were persisted.
    const prior = db.prepare(`select mo.id momentId, mo.title, mo.startAt, mem.id memoryId, mem.member, mem.takenAt
      from moments mo join memories mem on mem.momentId=mo.id where mo.groupId=? order by mo.id, mem.takenAt`).all(g);
    const byMoment = new Map();
    for (const row of prior) {
      if (!byMoment.has(row.momentId)) byMoment.set(row.momentId, { row, ids: [], members: [] });
      const item = byMoment.get(row.momentId); item.ids.push(row.memoryId);
      if (!item.members.includes(row.member)) item.members.push(row.member);
    }
    const restore = db.prepare(`insert or ignore into suggestions(signature,groupId,ids,title,members,count,startAt,status,momentId,createdAt)
      values(?,?,?,?,?,?,?,'confirmed',?,?)`);
    for (const item of byMoment.values()) {
      if (item.members.length < 2) continue;
      const ids = item.ids.sort((a, b) => a - b), signature = g + ':' + ids.join(',');
      restore.run(signature, g, JSON.stringify(ids), item.row.title, JSON.stringify(item.members), ids.length,
        item.row.startAt, item.row.momentId, item.row.startAt);
    }
    s.json(db.prepare('select * from suggestions where groupId=? order by createdAt desc').all(g).map(x => ({
      ids: JSON.parse(x.ids), title: x.title, members: JSON.parse(x.members), count: x.count,
      startAt: x.startAt, status: x.status, momentId: x.momentId
    })));
  });
  r.post('/suggestions/confirm', (q, s) => {
    const groupId = str(q.body.groupId, 20), ids = Array.isArray(q.body.ids) ? q.body.ids.slice(0, 500).map(Number).filter(Number.isSafeInteger) : [];
    if (!isMember(groupId, q.user)) return s.sendStatus(403);
    if (!ids.length) return s.sendStatus(400);
    const sortedIds = [...new Set(ids)].sort((a, b) => a - b), signature = groupId + ':' + sortedIds.join(',');
    const suggestion = db.prepare('select * from suggestions where signature=? and groupId=?').get(signature, groupId);
    if (!suggestion) return s.sendStatus(404);
    if (suggestion.status === 'confirmed' && suggestion.momentId) return s.json({ id: suggestion.momentId, alreadyConfirmed: true });
    const id = rnd(3);
    let n = 0;
    db.transaction(() => {
      const rows = sortedIds.map(i => db.prepare('select * from memories where id=? and groupId=? and momentId is null').get(i, groupId)).filter(Boolean);
      if (rows.length !== sortedIds.length) return;
      n = rows.length;
      db.prepare('insert into moments(id,title,startAt,groupId,createdBy) values(?,?,?,?,?)').run(id, suggestion.title || str(q.body.title, 60) || 'Moment', Math.min(...rows.map(r => r.takenAt)), groupId, q.user.id);
      for (const m of rows) {
        db.prepare('insert into photos(momentId,member,file,takenAt) values(?,?,?,?)').run(id, m.member, m.file, m.takenAt);
        db.prepare('update memories set momentId=? where id=?').run(id, m.id);
      }
      db.prepare("update suggestions set status='confirmed',momentId=? where signature=?").run(id, signature);
    })();
    n ? s.json({ id }) : s.sendStatus(400);
  });
  return r;
};
