/* 花月象棋 — scene, input, camera and close-ups */
(function () {
  const { CH, NAME, HINT, KINGDOM } = XQRules;
  const { figure, badgeTexture, BADGE_Y, M } = XQFigures;
  const nm = p => NAME[p.t][p.side === 'r' ? 0 : 1];
  const kingName = s => NAME.K[s === 'r' ? 0 : 1];
  const $ = id => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- game state ---------- */
  let board, turn, history, selected = null, legalNow = [], over = false, captured = { r: [], b: [] }, busy = false;
  /* settings */
  let topMode = false, viewSide = 'r', autoTurn = false, cinema = true;

  /* ---------- scene ---------- */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#FBEFEA');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI / 2.1; controls.minDistance = 2.5; controls.maxDistance = 45;
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  const target = controls.target;

  scene.add(new THREE.HemisphereLight('#FFF4EC', '#C99A86', 0.8));
  const sun = new THREE.DirectionalLight('#FFFFFF', 0.7); sun.position.set(5, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); scene.add(sun);
  /* two looks for the board: the classic wooden board on a table, or the terrain (js/terrain.js) */
  const classic = new THREE.Group(); scene.add(classic);
  const table = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: '#F1D3CB', roughness: 1 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.46; table.receiveShadow = true; classic.add(table);
  const base = new THREE.Mesh(new THREE.BoxGeometry(9.9, 0.45, 10.9), new THREE.MeshStandardMaterial({ color: '#B9783F', roughness: 0.8 }));
  base.position.y = -0.225; base.receiveShadow = true; classic.add(base);
  let terrain = null, terrainOn = !!window.XQTerrain;
  function applyLook() {
    if (terrainOn && !terrain && window.XQTerrain) terrain = XQTerrain.build(scene, aniso);
    const on = terrainOn && !!terrain;
    classic.visible = !on; if (terrain) terrain.root.visible = on;
    scene.fog = on ? terrain.fog : null;
    const btn = $('look'); if (btn) { btn.textContent = '地形：' + (on ? '花月大地' : '經典棋盤'); btn.setAttribute('aria-pressed', on); }
  }

  const wx = f => f - 4, wz = r => 4.5 - r;

  function boardTexture() {
    const cv = document.createElement('canvas'); cv.width = 920; cv.height = 1020; const g = cv.getContext('2d');
    g.fillStyle = '#EBC98F'; g.fillRect(0, 0, 920, 1020);
    g.globalAlpha = 0.12; g.strokeStyle = '#8A5A2B';
    for (let i = 0; i < 70; i++) { g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * 1020; g.moveTo(0, y); g.bezierCurveTo(300, y + Math.random() * 30 - 15, 600, y + Math.random() * 30 - 15, 920, y + Math.random() * 20 - 10); g.stroke(); }
    g.globalAlpha = 1;
    const X = f => 60 + f * 100, Y = r => 60 + (9 - r) * 100;
    g.fillStyle = '#BFE3EC'; g.fillRect(X(0), Y(5), 800, 100);
    g.strokeStyle = '#5A3A22'; g.lineWidth = 4;
    for (let r = 0; r < 10; r++) { g.beginPath(); g.moveTo(X(0), Y(r)); g.lineTo(X(8), Y(r)); g.stroke(); }
    for (let f = 0; f < 9; f++) {
      g.beginPath();
      if (f === 0 || f === 8) { g.moveTo(X(f), Y(0)); g.lineTo(X(f), Y(9)); }
      else { g.moveTo(X(f), Y(0)); g.lineTo(X(f), Y(4)); g.moveTo(X(f), Y(5)); g.lineTo(X(f), Y(9)); }
      g.stroke();
    }
    [[0, 2], [7, 9]].forEach(([a, b]) => { g.beginPath(); g.moveTo(X(3), Y(a)); g.lineTo(X(5), Y(b)); g.moveTo(X(5), Y(a)); g.lineTo(X(3), Y(b)); g.stroke(); });
    g.lineWidth = 8; g.strokeRect(X(0) - 16, Y(9) - 16, 832, 932);
    g.fillStyle = '#4A6F86'; g.font = '700 58px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('楚　河', X(2), Y(4.5)); g.fillText('漢　界', X(6), Y(4.5));
    const t = new THREE.CanvasTexture(cv); t.anisotropy = aniso; return t;
  }

  /* ---------- piece visuals ---------- */
  const LEAN = 0.12;            /* slight forward lean: everyone advances toward the enemy */
  const vis = {}; const badgeCache = {};
  function buildVisuals() {
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = board[r][f]; if (!p) continue;
      const outer = new THREE.Group(), orient = new THREE.Group(), tilt = new THREE.Group();
      outer.add(orient);
      if (p.side === 'r') orient.rotation.y = Math.PI;   /* red faces -z (toward black), black faces +z */
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.08, 40), M(p.side === 'r' ? '#D9445C' : '#34457E', { roughness: 0.4 }));
      disc.position.y = 0.04; disc.castShadow = true; disc.receiveShadow = true; orient.add(disc);
      tilt.position.y = 0.08; tilt.rotation.x = LEAN; orient.add(tilt);
      const fig = figure(p.side, p.t); tilt.add(fig);
      /* floating badge: flat, readable from straight above, upright for its own player like a real piece */
      const hold = new THREE.Group(); hold.rotation.y = p.side === 'b' ? Math.PI : 0; outer.add(hold);
      const key = p.side + p.t; badgeCache[key] = badgeCache[key] || badgeTexture(p.side, CH[p.t][p.side], aniso);
      const hm = new THREE.MeshBasicMaterial({ map: badgeCache[key], transparent: true, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), hm);
      halo.rotation.x = -Math.PI / 2 + 0.3; halo.position.y = BADGE_Y[p.t]; halo.renderOrder = 2; hold.add(halo);
      const sm = new THREE.MeshBasicMaterial({ color: p.side === 'r' ? '#D9445C' : '#34457E', transparent: true });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), sm); stem.position.y = BADGE_Y[p.t] - 0.1; hold.add(stem);
      scene.add(outer);
      vis[p.id] = { outer, tilt, fig, halo, mats: [hm, sm] };
    }
  }
  function sync() {
    Object.values(vis).forEach(v => { v.outer.visible = false; });
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = board[r][f]; if (!p) continue;
      const v = vis[p.id];
      v.outer.visible = true; v.outer.position.set(wx(f), 0, wz(r)); v.outer.scale.setScalar(1);
      v.fig.position.set(0, 0, 0); v.fig.rotation.set(0, 0, 0); v.tilt.rotation.set(LEAN, 0, 0);
    }
  }

  /* ---------- markers ---------- */
  const dotGeo = new THREE.CircleGeometry(0.16, 32), ringGeo = new THREE.RingGeometry(0.46, 0.56, 48);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#F0A92E', transparent: true, opacity: 0.95 });
  const capMat = new THREE.MeshBasicMaterial({ color: '#FF3D63', transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const selMat = new THREE.MeshBasicMaterial({ color: '#F0A92E', transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  let markers = [];
  function clearMarkers() { markers.forEach(m => scene.remove(m)); markers = []; }
  function addMarker(geo, mat, f, r, y) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(wx(f), y, wz(r)); scene.add(m); markers.push(m); }
  const checkRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 48), new THREE.MeshBasicMaterial({ color: '#FF3D63', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  checkRing.rotation.x = -Math.PI / 2; checkRing.visible = false; scene.add(checkRing);

  /* ---------- tweens ---------- */
  const tweens = [];
  const tw = (ms, fn) => new Promise(res => { if (ms <= 0) { fn(1); res(); return; } tweens.push({ t0: performance.now(), ms, fn, res }); });
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? Math.min(ms, 300) : ms));
  const es = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const D = ms => (reduceMotion ? 0 : ms);

  /* ---------- camera ---------- */
  let camAnim = false;
  /* frame the whole board for any screen shape: take the larger of the distances needed to fit its height and its width */
  function homeView(side) {
    const s = side === 'r' ? 1 : -1, half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitH = 5.2 / half, fitW = 5.4 / (half * camera.aspect);
    const dist = Math.max(fitH, fitW) * 1.04 + 1.6;
    const phi = topMode ? 0.002 : 0.25;
    const look = new THREE.Vector3(0, 0, topMode ? 0 : 0.25 * s);
    const pos = new THREE.Vector3(0, dist * Math.cos(phi), dist * Math.sin(phi) * s).add(look);
    return { pos, look };
  }
  /* move in spherical coordinates around a moving target, so turns orbit smoothly instead of cutting through the board */
  function camTo(pos, look, ms) {
    const t0 = target.clone();
    const a = new THREE.Spherical().setFromVector3(camera.position.clone().sub(t0));
    const b = new THREE.Spherical().setFromVector3(pos.clone().sub(look));
    let dt = b.theta - a.theta; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
    const s = new THREE.Spherical();
    camAnim = true; controls.enabled = false; atHome = false;
    return tw(D(ms), t => {
      const e = es(t);
      target.lerpVectors(t0, look, e);
      s.set(a.radius + (b.radius - a.radius) * e, a.phi + (b.phi - a.phi) * e, a.theta + dt * e);
      camera.position.setFromSpherical(s).add(target); camera.lookAt(target);
    }).then(() => { camAnim = false; controls.enabled = true; });
  }
  /* while the camera sits at the home view, a resize (phone rotation, address bar) re-frames the board */
  let atHome = true;
  controls.addEventListener('start', () => { atHome = false; });
  const goHome = ms => { const h = homeView(viewSide); return camTo(h.pos, h.look, ms).then(() => { atHome = true; }); };
  /* close-up from the front of a piece: red pieces face -z, black pieces face +z */
  function closeUp(f, r, side) {
    const x = wx(f), z = wz(r), front = side === 'r' ? -1 : 1;
    return camTo(new THREE.Vector3(x + 1.2, 2.2, z + 3.2 * front), new THREE.Vector3(x, 0.55, z), 1500);
  }

  /* ---------- effects ---------- */
  function burst(at, colors, n, up) {
    const geo = new THREE.OctahedronGeometry(0.06), ps = [];
    for (let i = 0; i < n; i++) {
      const c = colors[i % colors.length];
      const m = new THREE.Mesh(geo, M(c, { emissive: c, emissiveIntensity: 0.4, transparent: true }));
      m.position.copy(at);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.6, up ? 1.2 + Math.random() * 1.4 : Math.random() * 0.5, (Math.random() - 0.5) * 1.6);
      scene.add(m); ps.push(m);
    }
    return tw(1400, t => ps.forEach(m => {
      const v = m.userData.v;
      m.position.set(at.x + v.x * t, at.y + v.y * t - (up ? 1.2 * t * t : -0.6 * t), at.z + v.z * t);
      m.rotation.x += 0.15; m.rotation.y += 0.1; m.material.opacity = 1 - t;
    })).then(() => ps.forEach(m => scene.remove(m)));
  }
  function exclaim(at) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#FF3D63'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.fillStyle = '#FFFFFF'; g.font = '900 92px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv) })); s.scale.set(0.4, 0.4, 0.4); s.position.copy(at); scene.add(s); return s;
  }
  const PETALS = ['#FF9EB4', '#FFD1DC', '#FFE38A', '#FFFFFF'], STARS = ['#B7A6F0', '#CBBDFF', '#FFFFFF', '#FFE38A'];

  /* ---------- UI ---------- */
  function speak(side, who, text, again) {
    $('bubble').classList.toggle('moon', side === 'b');
    $('who').textContent = who; $('say').textContent = text; $('again').hidden = !again;
  }
  function updateTurn() {
    $('turn').classList.toggle('moon', turn === 'b');
    $('turnText').textContent = turn === 'r' ? '花之國（紅方）的回合' : '月之國（黑方）的回合';
  }
  function updateTrays() {
    const fill = (el, label, list) => {
      el.textContent = label;
      list.forEach(p => { const c = document.createElement('span'); c.className = 'chip ' + p.side; c.textContent = CH[p.t][p.side]; c.title = nm(p); el.appendChild(c); });
    };
    fill($('trayR'), '花之國收集到：', captured.r); fill($('trayB'), '月之國收集到：', captured.b);
  }
  function updateCheck() {
    if (!over && XQRules.inCheck(board, turn)) { const k = XQRules.findK(board, turn); checkRing.position.set(wx(k[0]), 0.02, wz(k[1])); checkRing.visible = true; }
    else checkRing.visible = false;
  }
  const lockIds = ['undo', 'home', 'view', 'flip', 'auto', 'cinema', 'restart'];
  function lock(b) { busy = b; lockIds.forEach(id => { $(id).disabled = b; }); }

  /* ---------- selection & moves ---------- */
  function deselect() {
    if (selected) { const o = vis[selected.p.id].outer, y0 = o.position.y; tw(150, t => { o.position.y = y0 * (1 - t); }); }
    selected = null; legalNow = []; clearMarkers();
  }
  function select(f, r) {
    deselect();
    const p = board[r][f]; selected = { f, r, p }; legalNow = XQRules.legal(board, f, r);
    const o = vis[p.id].outer; tw(150, t => { o.position.y = 0.25 * t; });
    addMarker(ringGeo, selMat, f, r, 0.02);
    legalNow.forEach(([x, y]) => { if (board[y][x]) addMarker(ringGeo, capMat, x, y, 0.1); else addMarker(dotGeo, dotMat, x, y, 0.02); });
    let say = HINT[p.t];
    if (p.t === 'P' && XQRules.crossed(p, r)) say = '我已經過河了，現在可以往前或往左右走一格！';
    if (!legalNow.length) {
      /* tell a pinned piece apart from a blocked one: it has moves on paper, but every one would expose its own king */
      const pinned = XQRules.pseudo(board, f, r).length > 0;
      say = pinned
        ? `如果我離開這裡，${kingName(p.side)}就會有危險，所以我要留下來保護她！`
        : say + ' 不過我現在被擋住了，沒有地方可以走。';
    } else if (XQRules.pseudo(board, f, r).length > legalNow.length) {
      say += ` 有些地方我不能去，因為那樣${kingName(p.side)}會有危險。`;
    }
    speak(p.side, nm(p), say);
  }

  async function doMove(tx, ty) {
    lock(true);
    const { f, r, p } = selected; const victim = board[ty][tx];
    history.push({ board: board.map(row => row.slice()), turn, captured: { r: captured.r.slice(), b: captured.b.slice() } });
    board[ty][tx] = p; board[r][f] = null;
    clearMarkers(); selected = null; legalNow = [];
    const o = vis[p.id].outer;
    let usedCam = false;

    if (victim && cinema) { usedCam = true; await closeUp(tx, ty, p.side); }

    /* the move itself: a hop, a big leap for horses, a high arc for a cannon capture */
    const arc = p.t === 'N' ? 1.1 : (p.t === 'C' && victim ? 2.2 : 0.45);
    const dur = victim && cinema ? 1100 : 560;
    const sx = o.position.x, sy = o.position.y, sz = o.position.z, ex = wx(tx), ez = wz(ty);
    let popped = false;
    const pop = () => {
      const vv = vis[victim.id];
      burst(new THREE.Vector3(ex, 0.6, ez), p.side === 'r' ? PETALS : STARS, 26, true);
      tw(320, t => vv.outer.scale.setScalar(1 - t)).then(() => { vv.outer.visible = false; });
    };
    await tw(D(dur), t => {
      const e = es(t);
      o.position.set(sx + (ex - sx) * e, sy * (1 - e) + Math.sin(Math.PI * t) * arc, sz + (ez - sz) * e);
      if (victim && !popped && t > 0.62) { popped = true; pop(); }
    });
    if (victim && !popped) pop();
    o.position.set(ex, 0, ez);

    if (victim) {
      captured[p.side].push(victim); updateTrays();
      speak(p.side, nm(p), `${nm(p)}把${nm(victim)}送回休息區了！`);
      if (cinema) { const fg = vis[p.id].fig; await tw(D(600), t => { fg.position.y = Math.abs(Math.sin(Math.PI * t * 2)) * 0.2 * (1 - t); }); await wait(900); }
    }

    turn = turn === 'r' ? 'b' : 'r'; updateTurn();

    if (!XQRules.anyLegal(board, turn)) {
      over = true; const win = turn === 'r' ? 'b' : 'r';
      updateCheck();
      speak(win, kingName(win), `${KINGDOM[win]}贏了！${KINGDOM[turn]}的${kingName(turn)}已經沒有路可以走了。`, true);
      if (cinema) {
        usedCam = true;
        const k = XQRules.findK(board, win); await closeUp(k[0], k[1], win);
        const kv = vis[board[k[1]][k[0]].id];
        burst(new THREE.Vector3(wx(k[0]), 2.4, wz(k[1])), win === 'r' ? PETALS : STARS, 40, false);
        await tw(D(1800), t => { kv.fig.rotation.y = Math.PI * 4 * es(t); kv.fig.position.y = Math.abs(Math.sin(Math.PI * t * 3)) * 0.3; });
        await wait(1200);
      }
    } else if (XQRules.inCheck(board, turn)) {
      updateCheck();
      speak(turn, kingName(turn), `${kingName(turn)}被將軍了！快把她移開、擋住，或吃掉威脅她的棋子！`);
      if (cinema) {
        usedCam = true;
        const k = XQRules.findK(board, turn); await closeUp(k[0], k[1], turn);
        const kv = vis[board[k[1]][k[0]].id];
        const ex2 = exclaim(new THREE.Vector3(wx(k[0]), 1.75, wz(k[1])));
        await tw(D(1500), t => { kv.fig.rotation.z = Math.sin(t * Math.PI * 10) * 0.12 * (1 - t); });
        await wait(700); scene.remove(ex2);
      }
    } else {
      updateCheck();
      if (!victim) speak(turn, kingName(turn), `輪到${KINGDOM[turn]}囉！`);
    }

    let flipped = false;
    if (autoTurn && !over && viewSide !== turn) { viewSide = turn; flipped = true; }
    if (usedCam || flipped) await goHome(flipped ? 2400 : 1600);
    lock(false);
  }

  /* ---------- input: pick by grid square, not by model, so any model size taps the same ---------- */
  let down = null;
  const ray = new THREE.Raycaster(), pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 8 || busy || over) return;
    const rc = canvas.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - rc.left) / rc.width) * 2 - 1, y: -((e.clientY - rc.top) / rc.height) * 2 + 1 }, camera);
    if (!ray.ray.intersectPlane(pickPlane, hit)) return;
    const f = Math.round(hit.x + 4), r = Math.round(4.5 - hit.z);
    if (!XQRules.inB(f, r) || Math.hypot(hit.x - wx(f), hit.z - wz(r)) > 0.5) { deselect(); return; }
    const q = board[r][f];
    if (selected && legalNow.some(([x, y]) => x === f && y === r)) { doMove(f, r); return; }
    if (q && q.side === turn) { if (selected && selected.p.id === q.id) deselect(); else select(f, r); return; }
    if (q) { speak(q.side, nm(q), `現在是${KINGDOM[turn]}的回合，${nm(q)}要等一下喔！`); deselect(); return; }
    deselect();
  });

  /* ---------- buttons ---------- */
  $('undo').onclick = async () => {
    if (busy || !history.length) return;
    const h = history.pop(); board = h.board; turn = h.turn; captured = h.captured; over = false;
    deselect(); sync(); updateTurn(); updateTrays(); updateCheck();
    speak(turn, kingName(turn), `退回一步，${KINGDOM[turn]}再想想看！`);
    if (autoTurn && viewSide !== turn) { lock(true); viewSide = turn; await goHome(2400); lock(false); }
  };
  /* settings panel: closed by default, closes again when the board is touched */
  function setPanel(open) {
    $('panel').hidden = !open;
    $('more').setAttribute('aria-expanded', open);
    $('more').textContent = open ? '收起設定' : '更多設定';
  }
  $('more').onclick = () => setPanel($('panel').hidden);
  if ($('look')) $('look').onclick = () => { terrainOn = !terrainOn; applyLook(); };
  canvas.addEventListener('pointerdown', () => { if (!$('panel').hidden) setPanel(false); });

  $('home').onclick = async () => { if (busy) return; lock(true); await goHome(1200); lock(false); };
  $('view').onclick = async () => {
    if (busy) return; topMode = !topMode; $('view').textContent = topMode ? '切換近俯視' : '切換正俯視';
    lock(true); await goHome(1400); lock(false);
  };
  $('flip').onclick = async () => { if (busy) return; viewSide = viewSide === 'r' ? 'b' : 'r'; lock(true); await goHome(2400); lock(false); };
  $('auto').onclick = () => { autoTurn = !autoTurn; $('auto').textContent = '自動轉向：' + (autoTurn ? '開' : '關'); $('auto').setAttribute('aria-pressed', autoTurn); };
  $('cinema').onclick = () => { cinema = !cinema; $('cinema').textContent = '精彩特寫：' + (cinema ? '開' : '關'); $('cinema').setAttribute('aria-pressed', cinema); };
  let armed = null;
  $('restart').onclick = () => {
    if (busy) return;
    const btn = $('restart');
    if (!armed) {
      btn.textContent = '再按一次確認'; btn.classList.add('warn');
      armed = setTimeout(() => { armed = null; btn.textContent = '重新開始'; btn.classList.remove('warn'); }, 2500);
      return;
    }
    clearTimeout(armed); armed = null; btn.textContent = '重新開始'; btn.classList.remove('warn'); restart();
  };
  $('again').onclick = () => restart();

  function newState() {
    const g = XQRules.newGame(); board = g.board; turn = g.turn;
    history = []; selected = null; legalNow = []; over = false; captured = { r: [], b: [] };
  }
  async function restart() {
    if (busy) return;
    newState(); /* ids are generated in the same order, so the existing visuals map back 1:1 */
    clearMarkers(); sync(); updateTurn(); updateTrays(); updateCheck();
    speak('r', kingName('r'), '新的一局開始！花之國先走，點一下棋子看看它可以走到哪裡。');
    lock(true); viewSide = 'r'; await goHome(1400); lock(false);
  }

  /* ---------- loop ---------- */
  const tmp = new THREE.Vector3();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (atHome && !camAnim && board) { const v = homeView(viewSide); camera.position.copy(v.pos); target.copy(v.look); camera.lookAt(target); }
  }
  new ResizeObserver(resize).observe(canvas);

  function loop(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const x = tweens[i], t = Math.min(1, (now - x.t0) / x.ms);
      x.fn(t); if (t >= 1) { tweens.splice(i, 1); x.res(); }
    }
    /* badges fade out as the camera comes close, so close-ups and zoomed-in viewing show the characters cleanly */
    Object.values(vis).forEach(v => {
      if (!v.outer.visible) return;
      v.halo.getWorldPosition(tmp);
      const d = camera.position.distanceTo(tmp), k = Math.min(1, Math.max(0, (d - 3.6) / 2.6)), o = k * k * (3 - 2 * k);
      v.mats.forEach(m => { m.opacity = o; }); v.halo.visible = o > 0.01;
    });
    const pulse = 1 + Math.sin(now / 220) * 0.08; markers.forEach(m => m.scale.setScalar(pulse));
    if (checkRing.visible) checkRing.scale.setScalar(1 + Math.sin(now / 150) * 0.12);
    if (terrain && terrain.root.visible) terrain.update(now / 1000);
    if (!camAnim) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  async function start() {
    try {
      await Promise.race([
        document.fonts.load('700 150px "LXGW WenKai TC"', '帥將仕士相象俥車傌馬炮包兵卒楚河漢界'),
        new Promise(r => setTimeout(r, 3000))
      ]);
    } catch (e) { /* fall back to system kai font */ }
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 10.2), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.85 }));
    bp.rotation.x = -Math.PI / 2; bp.position.y = 0.002; bp.receiveShadow = true; classic.add(bp);
    applyLook();
    newState(); buildVisuals(); sync(); updateTurn(); updateTrays();
    resize(); const h = homeView('r'); camera.position.copy(h.pos); target.copy(h.look); camera.lookAt(target);
    $('loading').hidden = true;
    requestAnimationFrame(loop);
  }
  start();
})();
