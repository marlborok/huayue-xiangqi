/* 花月象棋 — 角色圖鑑: the fourteen characters, each with her picture, a few words about herself, how she moves
 * (in her own voice, the same lines the game uses) and a little drawing of where she can go.
 * Opened from the cover and from the settings card; it is a page of its own over the game, so the game keeps its state.
 */
(function () {
  const { CH, NAME, HINT, KINGDOM } = XQRules;
  const TYPES = ['K', 'A', 'B', 'R', 'N', 'C', 'P'];
  const ROLE = { K: '帥／將', A: '仕／士', B: '相／象', R: '俥／車', N: '傌／馬', C: '炮／包', P: '兵／卒' };
  /* who she is, in her own voice: [flower, moon] */
  const INTRO = {
    K: ['我是花之國的公主，最喜歡櫻花盛開的春天。只要我被抓到，這局就輸了，所以大家都會保護我！', '我是月之國的公主，夜晚的月光是我的魔法。我被困住的話月之國就輸了，要好好守護我喔。'],
    A: ['我提著花燈守在公主身邊，哪裡都不去，一直陪著她。', '我捧著月亮球，在九宮裡守護公主，是她最信任的侍女。'],
    B: ['我最愛看書，懂得好多事情！我留在花之國這邊守護大家。', '我拿著望遠鏡觀察星星，在月之國這一邊幫大家看守。'],
    R: ['我拿著花朵盾牌、推著花車，跑得又快又遠，是最強的騎士之一！', '我戴著銀色頭盔、駕著星星戰車，一口氣就能衝到很遠的地方！'],
    N: ['我騎著獨角獸，可以跳過別人身邊，走出很特別的路線！', '我騎著小飛馬，一跳就是一個日字，大家都追不上我！'],
    C: ['我揹著花火筒，平常跟騎士一樣走，要放花火的時候得隔一個人才射得到！', '我會吹魔法泡泡，平常直直走，要吃人的時候要隔一個人才吹得到！'],
    P: ['我是年紀最小的花仙，雖然只能一步一步往前，但過了河就變得很厲害！', '我是小小的星精，一步一步往前走，過了河以後還能往兩邊走喔！']
  };

  /* a small board showing where she can go: the piece in the middle, gold dots where she can step, notes in words below */
  function diagram(t, side) {
    const N = 7, S = 34, cv = document.createElement('canvas'); cv.width = cv.height = N * S; const g = cv.getContext('2d');
    const ink = side === 'r' ? '#B02A45' : '#34457E', c = 3, X = i => (i + 0.5) * S;
    g.fillStyle = '#FFFAF0'; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = '#B9AA94'; g.lineWidth = 1.5;
    for (let i = 0; i < N; i++) { g.beginPath(); g.moveTo(X(0), X(i)); g.lineTo(X(N - 1), X(i)); g.stroke(); g.beginPath(); g.moveTo(X(i), X(0)); g.lineTo(X(i), X(N - 1)); g.stroke(); }
    const dot = (dx, dy, faint) => { g.fillStyle = '#6E4210'; g.beginPath(); g.arc(X(c + dx), X(c - dy), 9, 0, 7); g.fill(); g.fillStyle = faint ? '#FFE7A0' : '#FFC93C'; g.beginPath(); g.arc(X(c + dx), X(c - dy), 7, 0, 7); g.fill(); };
    const block = (dx, dy) => { g.strokeStyle = '#E8264F'; g.lineWidth = 3; const x = X(c + dx), y = X(c - dy); g.beginPath(); g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7); g.moveTo(x + 7, y - 7); g.lineTo(x - 7, y + 7); g.stroke(); };
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], DX = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    switch (t) {
      case 'K': D4.forEach(([x, y]) => dot(x, y)); break;
      case 'A': DX.forEach(([x, y]) => dot(x, y)); break;
      case 'B': DX.forEach(([x, y]) => dot(2 * x, 2 * y)); block(1, 1); break;
      case 'N': [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(([x, y]) => dot(x, y)); block(0, 1); break;
      case 'R': for (let i = 1; i <= 3; i++) D4.forEach(([x, y]) => dot(x * i, y * i)); break;
      case 'C': for (let i = 1; i <= 3; i++) D4.forEach(([x, y]) => dot(x * i, y * i, true)); break;
      case 'P': dot(0, 1); dot(1, 0, true); dot(-1, 0, true); break;
    }
    /* the piece herself, as a stamp */
    g.fillStyle = ink; g.beginPath(); g.arc(X(c), X(c), 15, 0, 7); g.fill();
    g.fillStyle = '#FFF8EC'; g.beginPath(); g.arc(X(c), X(c), 12, 0, 7); g.fill();
    g.fillStyle = ink; g.font = '700 18px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(CH[t][side], X(c), X(c) + 1);
    return cv;
  }
  const NOTE = {
    B: '紅色 ✕ 的地方有人擋住（塞象眼），就不能走。',
    N: '紅色 ✕ 的地方有人擋住（蹩馬腿），就不能往那邊跳。',
    C: '淺色的點：沒有吃子時可以走的地方。要吃棋子時，中間要隔一個棋子。',
    P: '淺色的點：過了河以後才能往左右走。'
  };

  const el = document.createElement('div'); el.className = 'book'; el.id = 'book'; el.hidden = true;
  el.innerHTML = `<div class="book-card">
    <div class="book-head"><h2>角色圖鑑</h2><button class="book-close" aria-label="關閉圖鑑">✕</button></div>
    <div class="book-tabs" role="tablist"><button role="tab" data-side="r">${KINGDOM.r}</button><button role="tab" data-side="b">${KINGDOM.b}</button></div>
    <div class="book-grid"></div>
    <div class="book-detail" hidden></div>
  </div>`;
  document.body.appendChild(el);
  const grid = el.querySelector('.book-grid'), detail = el.querySelector('.book-detail');
  let side = 'r';
  const img = (sd, t) => `assets/paper/${sd === 'r' ? 'flower' : 'moon'}-${t}.webp`;

  function showGrid() {
    detail.hidden = true; grid.hidden = false;
    el.querySelectorAll('.book-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.side === side));
    el.className = 'book ' + side;
    grid.innerHTML = '';
    TYPES.forEach(t => {
      const b = document.createElement('button'); b.className = 'book-item';
      b.innerHTML = `<img src="${img(side, t)}" alt=""><span class="stamp">${CH[t][side]}</span><b>${NAME[t][side === 'r' ? 0 : 1]}</b>`;
      b.onclick = () => showOne(t); grid.appendChild(b);
    });
  }
  /* all fourteen in one ring: the flower kingdom's seven, then the moon kingdom's, then round again */
  const RING = ['r', 'b'].flatMap(sd => TYPES.map(t => [sd, t]));
  let at = 0;
  const nameOf = ([sd, t]) => NAME[t][sd === 'r' ? 0 : 1];
  function step(d) { at = (at + d + RING.length) % RING.length; side = RING[at][0]; showOne(RING[at][1], d); }
  function showOne(t, dir) {
    at = RING.findIndex(([sd, tt]) => sd === side && tt === t);
    el.className = 'book ' + side;
    el.querySelectorAll('.book-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.side === side));
    const i = side === 'r' ? 0 : 1, prev = RING[(at + RING.length - 1) % RING.length], next = RING[(at + 1) % RING.length];
    const dots = RING.map(([sd], k) => `<i class="${sd}${k === at ? ' on' : ''}"></i>`).join('');
    detail.innerHTML = `<div class="book-nav">
        <button class="book-prev" aria-label="上一位：${nameOf(prev)}">‹ <span>${nameOf(prev)}</span></button>
        <button class="book-back">全部角色</button>
        <button class="book-next" aria-label="下一位：${nameOf(next)}"><span>${nameOf(next)}</span> ›</button>
      </div>
      <div class="book-dots" aria-hidden="true">${dots}</div>
      <div class="book-one"><img src="${img(side, t)}" alt="${NAME[t][i]}">
        <div><h3><span class="stamp">${CH[t][side]}</span>${NAME[t][i]}</h3><p class="role">象棋裡的「${ROLE[t]}」</p>
        <p class="intro">${INTRO[t][i]}</p><p class="how">「${HINT[t]}」</p></div></div>
      <div class="book-move"><h4>我可以走到哪裡</h4><div class="diag"></div>${NOTE[t] ? `<p class="note">${NOTE[t]}</p>` : ''}</div>`;
    detail.querySelector('.diag').appendChild(diagram(t, side));
    detail.querySelector('.book-back').onclick = showGrid;
    detail.querySelector('.book-prev').onclick = () => step(-1);
    detail.querySelector('.book-next').onclick = () => step(1);
    const one = detail.querySelector('.book-one');
    if (dir) one.classList.add(dir > 0 ? 'from-right' : 'from-left');   /* slide in from the side we came from */
    grid.hidden = true; detail.hidden = false;
  }
  /* swipe sideways on a character to flip to the next one, like turning a page */
  let sx = null, sy = null;
  detail.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  detail.addEventListener('pointerup', e => {
    if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });
  el.querySelectorAll('.book-tabs button').forEach(b => { b.onclick = () => { side = b.dataset.side; showGrid(); }; });
  el.querySelector('.book-close').onclick = () => { el.hidden = true; };
  el.addEventListener('click', e => { if (e.target === el) el.hidden = true; });
  addEventListener('keydown', e => {
    if (el.hidden) return;
    if (e.key === 'Escape') el.hidden = true;
    if (!detail.hidden && e.key === 'ArrowRight') step(1);
    if (!detail.hidden && e.key === 'ArrowLeft') step(-1);
  });

  function open() { side = 'r'; showGrid(); el.hidden = false; el.querySelector('.book-close').focus(); }
  ['openBook', 'coverBook'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', open); });
  window.XQBook = { open };
})();
