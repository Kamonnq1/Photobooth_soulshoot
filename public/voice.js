// เสียงของแต่ละคนในห้อง: กดปุ่มอัดเอง (สูงสุด 15 วินาที) ฟังซ้ำ/อัดใหม่/ข้ามได้ แล้วอัปโหลด — ทุกคนในห้องฟังได้ และเอาไปแปะบนเฟรมเป็นสติ๊กเกอร์เสียงได้
// อัดเป็น WAV 16-bit โมโน (ผ่าน Web Audio) เพื่อให้เล่นได้ทุกเบราว์เซอร์/ทุกเครื่อง ไม่ต้องพึ่งตัวแปลงไฟล์
(() => {
const MAXS = 15, RATE = 22050;
let voices = [], st = 'idle', stream, ctx, proc, src, chunks, t0, timer, blob, secs = 0, url = null;
function encodeWav(f32, rate) {
  const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return buf;
}
function resample(f32, from, to) { // ลดอัตราสุ่มด้วยการเฉลี่ย (พอสำหรับเสียงพูด)
  if (from <= to) return f32; const k = from / to, n = Math.floor(f32.length / k), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let a = Math.floor(i * k), b = Math.min(f32.length, Math.floor((i + 1) * k)), s = 0; for (let j = a; j < b; j++) s += f32[j]; out[i] = s / Math.max(1, b - a); }
  return out;
}
const say = t => { $('recMsg').textContent = t || ''; };
function ui() { // ปรับหน้าตาตามสถานะ: idle → recording → review
  $('recBtn').hidden = st !== 'idle'; $('recStop').hidden = st !== 'rec'; $('recReview').hidden = st !== 'review';
  $('recMeter').hidden = st !== 'rec'; $('recTime').hidden = st === 'idle';
  if (st === 'idle') say('');
}
function cleanup() {
  clearInterval(timer); try { proc && proc.disconnect(); src && src.disconnect(); } catch {}
  if (stream) stream.getTracks().forEach(t => t.stop()); if (ctx && ctx.close) ctx.close().catch(() => {}); stream = ctx = proc = src = null;
}
async function start() {
  if (!moment) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch { ctx = null; } // สร้าง/ปลุก AudioContext ทันทีที่กดปุ่ม (Safari ต้องทำในจังหวะที่ผู้ใช้แตะ)
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { cleanup(); return say('เปิดไมโครโฟนไม่ได้ (ต้องเปิดผ่าน HTTPS และอนุญาตสิทธิ์ไมโครโฟน)'); }
  try {
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการอัดเสียง'); await ctx.resume();
    src = ctx.createMediaStreamSource(stream); proc = ctx.createScriptProcessor(4096, 1, 1); chunks = [];
    proc.onaudioprocess = e => { const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d)); let s = 0; for (let i = 0; i < d.length; i += 8) s += d[i] * d[i]; $('recLevel').style.width = Math.min(100, Math.sqrt(s / (d.length / 8)) * 320) + '%'; };
    src.connect(proc); proc.connect(ctx.destination); // ต้องต่อปลายทางไว้ Safari ถึงจะส่งข้อมูลให้ (ไม่มีเสียงออกลำโพง)
  } catch (e) { cleanup(); return say('เริ่มอัดเสียงไม่ได้: ' + (e.message || e)); }
  st = 'rec'; t0 = Date.now(); ui(); say('กำลังอัด… กด “หยุด” เมื่อพูดจบ (สูงสุด ' + MAXS + ' วินาที)');
  timer = setInterval(() => { const s = (Date.now() - t0) / 1000; $('recTime').textContent = `${s.toFixed(1)} / ${MAXS} วิ`; if (s >= MAXS) stop(); }, 100);
}
function stop() {
  if (st !== 'rec') return;
  const rate = ctx ? ctx.sampleRate : 44100, n = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
  cleanup(); secs = n / rate;
  if (secs < .4) { st = 'idle'; ui(); return say('สั้นเกินไป ลองอัดใหม่อีกครั้ง'); }
  blob = new Blob([encodeWav(resample(all, rate, RATE), Math.min(rate, RATE))], { type: 'audio/wav' });
  if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob); $('recAudio').src = url; $('recTime').textContent = `${secs.toFixed(1)} วิ`;
  st = 'review'; ui(); say('ฟังดูก่อน แล้วกด “ใช้เสียงนี้” หรืออัดใหม่');
}
function discard() { st = 'idle'; blob = null; ui(); }
async function upload() {
  if (!blob || !moment) return; $('recUse').disabled = true; say('กำลังอัปโหลด…');
  const f = new FormData(); f.append('audio', blob, 'voice.wav'); f.append('secs', secs.toFixed(2));
  try {
    const r = await fetch(`/api/moments/${moment.id}/voices`, { method: 'POST', body: f });
    if (!r.ok) throw new Error(r.status); const v = await r.json(); if (!voices.some(x => x.id === v.id)) voices.push(v); render();
    st = 'idle'; blob = null; ui(); toast('เพิ่มเสียงแล้ว ทุกคนในห้องฟังได้');
  } catch { say('อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  $('recUse').disabled = false;
}
function render() { // รายการเสียงของทุกคนในห้อง
  const box = $('voiceList'); box.innerHTML = voices.length ? '' : '<p class="hint">ยังไม่มีเสียง — กดอัดเสียงด้านบนได้เลย</p>';
  voices.forEach(v => {
    const d = document.createElement('div'); d.className = 'vi';
    d.innerHTML = `<div class="vh"><b>🔊 ${esc(v.member)}</b><span>${Math.round(v.secs)} วิ</span></div><audio controls preload="none" src="/uploads/${esc(v.file)}"></audio>`;
    if (me && v.userId === me.id) d.querySelector('.vh').append(mk('🗑', 'ic', async () => { if (!confirm('ลบเสียงนี้?')) return; const x = await fetch('/api/voices/' + v.id, { method: 'DELETE' }); if (x.ok) { voices = voices.filter(a => a.id !== v.id); render(); } }, 'ลบเสียง'));
    box.append(d);
  });
  if (window.Stickers) Stickers.voiceChips(voices);
}
$('recBtn').onclick = start; $('recStop').onclick = stop; $('recAgain').onclick = () => { discard(); start(); }; $('recDrop').onclick = discard; $('recUse').onclick = upload;
socket.on('voice_uploaded', v => { if (moment && !voices.some(x => x.id === v.id)) { voices.push(v); render(); } });
socket.on('voice_deleted', ({ id }) => { voices = voices.filter(v => v.id !== id); render(); });
window.Voice = {
  items: () => voices, set: list => { voices = list || []; render(); },
  reset() { cleanup(); st = 'idle'; blob = null; voices = []; ui(); render(); }, encodeWav, resample
};
ui(); render();
})();
