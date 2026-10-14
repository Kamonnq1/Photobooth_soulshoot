// Mode 2: จับกลุ่มรูปที่น่าจะเป็น event เดียวกัน จากเวลา + พิกัด + tag (ไม่ใช้ ML)
const rad = d => d * Math.PI / 180;
function dist(a, b) { // Haversine (เมตร)
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}
function fits(c, p, { gapMs, meters, maxSpanMs }) {
  const last = c[c.length - 1];
  if (p.takenAt - last.takenAt > gapMs || p.takenAt - c[0].takenAt > maxSpanMs) return false; // กันเชนยาวเป็นวัน
  if (p.tag && last.tag) return p.tag === last.tag; // tag ตรงกัน = รวม, ต่างกัน = แยก
  const g = [...c].reverse().find(x => x.lat != null);
  return !(g && p.lat != null) || dist(g, p) <= meters;
}
function suggest(rows, opts = { gapMs: 30 * 60000, meters: 200, maxSpanMs: 6 * 3600000 }) {
  const clusters = [];
  for (const p of [...rows].sort((a, b) => a.takenAt - b.takenAt)) {
    const c = clusters.find(c => fits(c, p, opts));
    c ? c.push(p) : clusters.push([p]);
  }
  return clusters.map(c => ({ c, members: [...new Set(c.map(p => p.member))] }))
    .filter(x => x.members.length >= 2) // ต้องมีอย่างน้อย 2 คน
    .map(({ c, members }) => ({
      ids: c.map(p => p.id), members, count: c.length, startAt: c[0].takenAt,
      title: c.find(p => p.tag)?.tag || new Date(c[0].takenAt).toLocaleDateString('th-TH')
    }));
}
module.exports = { suggest };
