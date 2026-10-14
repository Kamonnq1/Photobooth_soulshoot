$('albumBtn').onclick = async () => {
  const list = await (await fetch('/api/albums?groupId=' + encodeURIComponent($('groupSel').value))).json();
  $('albums').innerHTML = list.length ? list.map(a =>
    `<div class="card"><a href="/share.html?s=${esc(a.id)}"><img src="/uploads/${esc(a.file)}"></a><b>${esc(a.title)}</b>
     <div><small>${new Date(a.createdAt).toLocaleString('th-TH')}</small></div></div>`).join('') : '<p class="hint">ยังไม่มี Moment</p>';
};
