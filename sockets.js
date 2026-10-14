// realtime: room ต่อ 1 moment + time sync (NTP-style)  — ทุก handler ตรวจ input กัน server crash
const db = require('./db');
const ok = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
module.exports = io => io.on('connection', s => {
  const size = id => io.sockets.adapter.rooms.get(id)?.size || 0;
  s.on('sync', (t0, cb) => typeof cb === 'function' && cb(t0, Date.now()));
  // Subscribe to a group's Moment list independently from a Moment room.
  // This lets members see new Moments as soon as another member creates one.
  s.on('group_join', p => {
    if (!p || !ok(p.groupId) || typeof p.token !== 'string') return;
    const u = db.prepare('select id from users where token=?').get(p.token);
    if (!u || !db.prepare('select 1 from members where groupId=? and userId=?').get(p.groupId, u.id)) return s.emit('group_join_denied');
    if (s.data.groupId) s.leave('group:' + s.data.groupId);
    s.join('group:' + p.groupId);
    s.data.groupId = p.groupId; s.data.userId = u.id; s.join('user:' + u.id); // user: = ห้องส่วนตัวไว้ส่งแบนเนอร์เตือน
  });
  s.on('join', p => {
    if (!p || !ok(p.momentId)) return;
    const u = typeof p.token === 'string' ? db.prepare('select id,name from users where token=?').get(p.token) : null;
    const m = db.prepare('select groupId from moments where id=?').get(p.momentId);
    if (!u || !m || !db.prepare('select 1 from members where groupId=? and userId=?').get(m.groupId, u.id)) return s.emit('join_denied'); // ไม่ใช่สมาชิกกลุ่ม
    if (s.data.momentId) s.leave(s.data.momentId);
    s.join(p.momentId); s.join('user:' + u.id);
    s.data = { ...s.data, momentId: p.momentId, name: u.name, userId: u.id, momentGroup: m.groupId };
    io.to(p.momentId).emit('member_joined', { name: s.data.name, count: size(p.momentId) });
  });
  s.on('leave', () => { // กดย้อนกลับออกจากห้อง
    const d = s.data; if (!d || !d.momentId) return;
    s.leave(d.momentId); delete s.data.momentId; delete s.data.name; delete s.data.momentGroup;
    io.to(d.momentId).emit('member_left', { name: d.name, count: size(d.momentId) });
  });
  s.on('disconnect', () => {
    const d = s.data; if (d && d.momentId) io.to(d.momentId).emit('member_left', { name: d.name, count: size(d.momentId) });
  });
});
