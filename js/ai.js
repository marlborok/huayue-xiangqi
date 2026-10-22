/* 花月象棋 — the computer player: a small alpha-beta search over XQRules, sized for a child opponent.
 * level 1 (簡單): looks two moves ahead and adds a lot of randomness, so it makes human-like slips.
 * level 2 (普通): looks three moves ahead, little randomness.
 * Inside the search a move that leaves one's own king takeable is simply lost at the next ply (the king gets captured),
 * which is much cheaper than a full check test at every node; the root moves are filtered with the real XQRules.legal.
 * XQAI.choose(board, side, level) -> { from: [f, r], to: [f, r] } or null.
 */
(function () {
  const { pseudo, legal, crossed } = XQRules;
  const VAL = { K: 10000, R: 90, C: 45, N: 40, B: 20, A: 20, P: 10 };
  const WIN = 100000;

  function score(B, side) {
    let s = 0;
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = B[r][f]; if (!p) continue;
      let v = VAL[p.t];
      if (p.t === 'P' && crossed(p, r)) v += 10 + (f >= 2 && f <= 6 ? 4 : 0);            /* a pawn over the river is worth twice as much */
      if ((p.t === 'N' || p.t === 'C') && f >= 2 && f <= 6) v += 3;                       /* horses and cannons like the middle */
      s += p.side === side ? v : -v;
    }
    return s;
  }
  /* the two kings may never look at each other down an open file */
  function kingsFace(B) {
    let rk = null, bk = null;
    for (let r = 0; r < 10; r++) for (let f = 3; f <= 5; f++) { const p = B[r][f]; if (p && p.t === 'K') { if (p.side === 'r') rk = [f, r]; else bk = [f, r]; } }
    if (!rk || !bk || rk[0] !== bk[0]) return false;
    for (let r = rk[1] + 1; r < bk[1]; r++) if (B[r][rk[0]]) return false;
    return true;
  }
  function moves(B, side) {
    const out = [];
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = B[r][f]; if (!p || p.side !== side) continue;
      pseudo(B, f, r).forEach(([x, y]) => { const q = B[y][x]; out.push({ f, r, x, y, cap: q ? VAL[q.t] : 0 }); });
    }
    return out.sort((a, b) => b.cap - a.cap);   /* captures first: alpha-beta cuts much more */
  }
  function search(B, side, depth, alpha, beta) {
    if (depth === 0) return score(B, side);
    const other = side === 'r' ? 'b' : 'r';
    let best = -WIN * 2, any = false;
    for (const m of moves(B, side)) {
      const p = B[m.r][m.f], q = B[m.y][m.x];
      if (q && q.t === 'K') return WIN + depth;                 /* the enemy king can be taken: the line before was illegal for them */
      B[m.y][m.x] = p; B[m.r][m.f] = null;
      let v;
      if (kingsFace(B)) v = -WIN; else { any = true; v = -search(B, other, depth - 1, -beta, -alpha); }
      B[m.r][m.f] = p; B[m.y][m.x] = q;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return any ? best : -WIN;
  }

  /* a position as a string: who is to move plus every square, for spotting repeats */
  const key = (B, side) => side + B.map(row => row.map(p => p ? p.side + p.t : '..').join('')).join('');

  /* seen: positions already on the board this game; moving back into one costs a little, so it does not go round in circles */
  function choose(board, side, level, seen) {
    const B = board.map(row => row.slice()), other = side === 'r' ? 'b' : 'r';
    const depth = level >= 2 ? 3 : 2, noise = level >= 2 ? 6 : 40;
    let best = null, bestV = -Infinity;
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = B[r][f]; if (!p || p.side !== side) continue;
      legal(B, f, r).forEach(([x, y]) => {
        const q = B[y][x];
        B[y][x] = p; B[r][f] = null;
        const v = -search(B, other, depth - 1, -Infinity, Infinity) + Math.random() * noise - (seen && seen.has(key(B, other)) ? 30 : 0);
        B[r][f] = p; B[y][x] = q;
        if (v > bestV) { bestV = v; best = { from: [f, r], to: [x, y] }; }
      });
    }
    return best;
  }

  window.XQAI = { choose, key };
})();
