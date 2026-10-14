// เตือนก่อนถึงเวลา 10 นาที, 1 นาที และตอนถึงเวลา — ส่งทั้งแบนเนอร์ในหน้า (socket) และ Web Push
const path = require('path'), fs = require('fs'), db = require('./db'), webpush = require('web-push');
const VAPID = path.join(__dirname, 'vapid.json'), MAX = 2 ** 31 - 1;
let keys; // VAPID keys สร้างครั้งแรกแล้วเก็บไว้
try { keys = JSON.parse(fs.readFileSync(VAPID)); }
catch { keys = webpush.generateVAPIDKeys(); fs.writeFileSync(VAPID, JSON.stringify(keys)); }
webpush.setVapidDetails('mailto:soulshoot@example.com', keys.publicKey, keys.privateKey);

const STEPS = [[10 * 60000, '10m', 'อีก 10 นาทีถึงเวลาถ่าย'], [60000, '1m', 'อีก 1 นาที เตรียมกล้องให้พร้อม'], [0, 'now', 'ถึงเวลาแล้ว! เข้าห้องแล้วถ่ายเลย']];
function at(ts, fn) { // setTimeout ที่ไม่ล้นเมื่อเวลาไกลเกิน ~24 วัน (ไม่งั้นจะลั่นทันที)
  const h = {}, arm = () => { const w = ts - Date.now(); h.t = setTimeout(w > MAX ? arm : fn, Math.min(Math.max(w, 0), MAX)); };
  arm(); return h;
}
function send(rows, payload) { // ส่ง Web Push ไปทุก subscription และลบอันที่หมดอายุ
  rows.forEach(({ endpoint, sub }) => webpush.sendNotification(JSON.parse(sub), JSON.stringify(payload)).catch(e => {
    if (e.statusCode === 404 || e.statusCode === 410) db.prepare('delete from push_subs where endpoint=?').run(endpoint);
  }));
  return rows.length;
}
const pushMoment = (id, payload) => send(db.prepare('select p.endpoint, p.sub from push_subs p join members g on g.userId=p.userId join moments m on m.groupId=g.groupId where m.id=?').all(id), payload);
const pushUser = (uid, payload) => send(db.prepare('select endpoint, sub from push_subs where userId=?').all(uid), payload);

module.exports = io => {
  const timers = {};
  function schedule(id, startAt) {
    (timers[id] || []).forEach(h => clearTimeout(h.t));
    timers[id] = [];
    for (const [lead, kind, text] of STEPS) {
      if (startAt - lead <= Date.now()) continue; // จังหวะที่ผ่านไปแล้วข้าม
      timers[id].push(at(startAt - lead, () => {
        const m = db.prepare('select title, groupId from moments where id=?').get(id);
        if (!m) return;
        db.prepare('select userId from members where groupId=?').all(m.groupId).forEach(({ userId }) =>
          io.to('user:' + userId).emit('reminder', { momentId: id, title: m.title, kind, text, startAt }));
        pushMoment(id, { title: m.title, body: text, tag: `soulshoot-${id}-${kind}`, url: '/?m=' + id, vibrate: true });
      }));
    }
  }
  db.prepare('select id,startAt from moments where startAt>?').all(Date.now()).forEach(m => schedule(m.id, m.startAt));
  schedule.cancel = id => { (timers[id] || []).forEach(h => clearTimeout(h.t)); delete timers[id]; };
  schedule.pushUser = pushUser;
  schedule.publicKey = keys.publicKey;
  return schedule;
};
