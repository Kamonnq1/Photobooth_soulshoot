const { DatabaseSync } = require('node:sqlite'); // มีมากับ Node ไม่ต้อง build
const db = new DatabaseSync(require('path').join(__dirname, 'soulshoot.db'));
db.transaction = fn => () => { // shim ให้ใช้ db.transaction(fn)() ได้
  db.exec('BEGIN');
  try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
};
db.exec(`
create table if not exists moments(id text primary key, title text, startAt integer);
create table if not exists photos(id integer primary key autoincrement, momentId text, member text, file text, takenAt integer);
create table if not exists albums(id text primary key, momentId text, title text, file text, createdAt integer);
create table if not exists memories(id integer primary key autoincrement, member text, file text, takenAt integer, lat real, lng real, tag text, momentId text);
create table if not exists suggestions(signature text primary key, groupId text, ids text, title text, members text, count integer, startAt integer, status text default 'pending', momentId text, createdAt integer);
`);
db.exec(`
create table if not exists users(id text primary key, name text, token text);
create table if not exists groups(id text primary key, name text, code text);
create table if not exists members(groupId text, userId text, primary key(groupId, userId));
create table if not exists push_subs(userId text, endpoint text primary key, sub text);
`);
db.exec(`create table if not exists voices(id integer primary key autoincrement, momentId text, userId text, member text, file text, secs real, createdAt integer);`);
for (const a of ['alter table albums add column hotspots text', 'alter table moments add column groupId text', 'alter table memories add column groupId text',
  'alter table groups add column ownerId text', 'alter table moments add column createdBy text']) try { db.exec(a); } catch {}
// กลุ่มเก่าที่ยังไม่มีหัวหน้า → ให้คนที่เข้ากลุ่มก่อนสุดเป็นหัวหน้า
db.exec('update groups set ownerId=(select userId from members where groupId=groups.id order by rowid limit 1) where ownerId is null');
db.exec('create index if not exists ix_photos on photos(momentId); create index if not exists ix_mem on memories(groupId, momentId);');
module.exports = db;
