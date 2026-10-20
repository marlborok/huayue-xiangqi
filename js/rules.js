/* 花月象棋 — rules (pure logic, no rendering)
 * Board: board[rank][file], file 0..8 (left→right from red's side), rank 0..9 (red back rank = 0).
 * Piece: { id, side: 'r'|'b', t: 'K'|'A'|'B'|'R'|'N'|'C'|'P' }
 */
(function () {
  const CH = {
    K: { r: '帥', b: '將' }, A: { r: '仕', b: '士' }, B: { r: '相', b: '象' },
    R: { r: '俥', b: '車' }, N: { r: '傌', b: '馬' }, C: { r: '炮', b: '包' }, P: { r: '兵', b: '卒' }
  };
  /* [red name, black name] */
  const NAME = {
    K: ['櫻花公主', '月光公主'], A: ['花瓣侍女', '星星侍女'], B: ['書本小學者', '觀星小魔女'],
    R: ['花車騎士', '流星騎士'], N: ['獨角獸少女', '飛馬少女'], C: ['甜點發明家', '泡泡魔法師'], P: ['小花仙', '小星精']
  };
  const HINT = {
    K: '我只能在九宮裡走一格，大家要保護我喔！',
    A: '我們斜斜地走一格，不能離開九宮。',
    B: '我走田字。田字中間被擋住就不能走，而且我怕水，不過河！',
    R: '直直走、橫橫走，想走多遠都可以，但路上不能有人擋住。',
    N: '我走日字！馬腳旁邊如果有人擋住，我就跳不過去。',
    C: '走路跟車一樣；吃棋子時要隔一個棋子跳過去！',
    P: '我只能往前走一格，過了河以後也可以往左右走！'
  };
  const KINGDOM = { r: '花之國', b: '月之國' };

  function newGame() {
    const board = Array.from({ length: 10 }, () => Array(9).fill(null));
    let id = 0;
    const put = (f, r, side, t) => { board[r][f] = { id: id++, side, t }; };
    ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'].forEach((t, f) => { put(f, 0, 'r', t); put(f, 9, 'b', t); });
    [1, 7].forEach(f => { put(f, 2, 'r', 'C'); put(f, 7, 'b', 'C'); });
    [0, 2, 4, 6, 8].forEach(f => { put(f, 3, 'r', 'P'); put(f, 6, 'b', 'P'); });
    return { board, turn: 'r' };
  }

  const inB = (f, r) => f >= 0 && f <= 8 && r >= 0 && r <= 9;
  const inPalace = (s, f, r) => f >= 3 && f <= 5 && (s === 'r' ? r <= 2 : r >= 7);
  const crossed = (p, r) => (p.side === 'r' ? r >= 5 : r <= 4);

  function pseudo(B, f, r) {
    const p = B[r][f], out = [];
    const add = (ff, rr) => { if (!inB(ff, rr)) return; const q = B[rr][ff]; if (!q || q.side !== p.side) out.push([ff, rr]); };
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], DX = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    switch (p.t) {
      case 'K': D4.forEach(([x, y]) => { if (inPalace(p.side, f + x, r + y)) add(f + x, r + y); }); break;
      case 'A': DX.forEach(([x, y]) => { if (inPalace(p.side, f + x, r + y)) add(f + x, r + y); }); break;
      case 'B': DX.forEach(([x, y]) => {
        const ff = f + 2 * x, rr = r + 2 * y;
        if (!inB(ff, rr) || (p.side === 'r' ? rr > 4 : rr < 5) || B[r + y][f + x]) return;
        add(ff, rr);
      }); break;
      case 'N': [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]]
        .forEach(([x, y, lx, ly]) => { if (inB(f + x, r + y) && !B[r + ly][f + lx]) add(f + x, r + y); }); break;
      case 'R': D4.forEach(([x, y]) => {
        let ff = f + x, rr = r + y;
        while (inB(ff, rr)) { const q = B[rr][ff]; if (!q) out.push([ff, rr]); else { if (q.side !== p.side) out.push([ff, rr]); break; } ff += x; rr += y; }
      }); break;
      case 'C': D4.forEach(([x, y]) => {
        let ff = f + x, rr = r + y, screen = false;
        while (inB(ff, rr)) {
          const q = B[rr][ff];
          if (!screen) { if (!q) out.push([ff, rr]); else screen = true; }
          else if (q) { if (q.side !== p.side) out.push([ff, rr]); break; }
          ff += x; rr += y;
        }
      }); break;
      case 'P': {
        add(f, r + (p.side === 'r' ? 1 : -1));
        if (crossed(p, r)) { add(f + 1, r); add(f - 1, r); }
        break;
      }
    }
    return out;
  }

  function findK(B, s) {
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) { const p = B[r][f]; if (p && p.t === 'K' && p.side === s) return [f, r]; }
    return null;
  }
  /* the two kings may never face each other on an open file */
  function kingsFacing(B) {
    const a = findK(B, 'r'), b = findK(B, 'b');
    if (!a || !b || a[0] !== b[0]) return false;
    for (let r = a[1] + 1; r < b[1]; r++) if (B[r][a[0]]) return false;
    return true;
  }
  function inCheck(B, s) {
    const k = findK(B, s);
    if (!k) return true;
    if (kingsFacing(B)) return true;
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = B[r][f];
      if (p && p.side !== s && pseudo(B, f, r).some(([x, y]) => x === k[0] && y === k[1])) return true;
    }
    return false;
  }
  function legal(B, f, r) {
    const p = B[r][f];
    return pseudo(B, f, r).filter(([x, y]) => {
      const C = B.map(row => row.slice()); C[y][x] = p; C[r][f] = null;
      return !inCheck(C, p.side);
    });
  }
  /* no legal move = loss (covers both checkmate and stalemate in xiangqi) */
  function anyLegal(B, s) {
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) { const p = B[r][f]; if (p && p.side === s && legal(B, f, r).length) return true; }
    return false;
  }

  window.XQRules = { CH, NAME, HINT, KINGDOM, newGame, inB, crossed, pseudo, legal, inCheck, anyLegal, findK };
})();
