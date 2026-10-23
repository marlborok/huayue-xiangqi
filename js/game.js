/* 花月象棋 — scene, input, camera and close-ups */
(function () {
  const { CH, NAME, HINT, KINGDOM } = XQRules;
  const { badgeTexture, M } = XQFigures;
  /* characters: the paper-doll illustrations (js/paper.js) once loaded, the geometric placeholders otherwise */
  let paper = false;
  const figure = (side, t) => paper ? XQPaper.figure(side, t, aniso) : XQFigures.figure(side, t);
  const badgeY = t => (paper ? XQPaper.BADGE_Y : XQFigures.BADGE_Y)[t];
  const nm = p => NAME[p.t][p.side === 'r' ? 0 : 1];
  const kingName = s => NAME.K[s === 'r' ? 0 : 1];
  const $ = id => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- game state ---------- */
  let board, turn, history, selected = null, legalNow = [], over = false, captured = { r: [], b: [] }, busy = false;
  /* settings */
  let topMode = false, viewSide = 'r', autoTurn = false, cinema = true;
  /* how the game is played (chosen on the cover): 'ai' one child against the computer, 'same' two players sharing one view,
   * 'f2f' two players face to face with the tablet flat between them */
  let mode = 'same', humanSide = 'r', aiLevel = 1, names = { r: '', b: '' };
  /* 小幫手: for a learning player, mark the pieces of the side to move that the other side could take right now */
  let helper = true; try { helper = localStorage.getItem('huayue.helper') !== 'off'; } catch (e) { /* default on */ }
  let threats = {};   /* piece id -> the enemy piece aiming at it */
  const f2f = () => mode === 'f2f';
  const landscape = () => innerWidth > innerHeight;
  const cine = () => cinema && !f2f();                 /* close-ups swing the camera: not when the board must stay put between two players */
  const label = s => names[s] ? `${names[s]}（${KINGDOM[s]}）` : KINGDOM[s];
  const other = s => s === 'r' ? 'b' : 'r';

  /* ---------- scene ---------- */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#FBEFEA');
  const look = !!window.XQLook; if (look) XQLook.setup(renderer, scene);   /* color space, tone mapping, sky light (js/look.js) */
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI / 2.1; controls.minDistance = 2.5; controls.maxDistance = 45;
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  const target = controls.target;

  /* watercolor light: a strong soft fill with a lavender ground colour, so shadows come out pale and tinted rather than grey,
   * and a weaker sun whose low-resolution shadow map gives blurred, gentle edges */
  const hemi = new THREE.HemisphereLight('#FFF6EE', look ? '#B4A6D4' : '#C99A86', look ? 0.62 : 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF4E8', look ? 0.5 : 0.7); sun.position.set(5, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); scene.add(sun);
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
  /* the helper's mark: an orange drop with a white "!", drawn round so it reads the same from either side of the table */
  const worryTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.fillStyle = '#E8762B'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill();
    g.fillStyle = '#FFFFFF'; g.fillRect(56, 26, 16, 50); g.beginPath(); g.arc(64, 94, 9, 0, 7); g.fill();
    const t = new THREE.CanvasTexture(cv); if (look) t.encoding = THREE.sRGBEncoding; return t;
  })();
  const vis = {}; const badgeCache = {};
  function buildVisuals() {
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = board[r][f]; if (!p) continue;
      const outer = new THREE.Group(), orient = new THREE.Group(), tilt = new THREE.Group();
      outer.add(orient);
      if (p.side === 'r') orient.rotation.y = Math.PI;   /* red faces -z (toward black), black faces +z */
      if (paper) { /* a soft watercolor pool under the paper doll, instead of a solid base that hides her feet */
        const pool = new THREE.Mesh(new THREE.CircleGeometry(0.4, 40), new THREE.MeshBasicMaterial({ color: p.side === 'r' ? '#C9B89A' : '#8E8CCB', transparent: true, opacity: p.side === 'r' ? 0.4 : 0.5, depthWrite: false }));
        pool.rotation.x = -Math.PI / 2; pool.position.y = 0.015; orient.add(pool);
      } else {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.08, 40), M(p.side === 'r' ? '#D9445C' : '#34457E', { roughness: 0.4 }));
        disc.position.y = 0.04; disc.castShadow = true; disc.receiveShadow = true; orient.add(disc);
      }
      tilt.position.y = paper ? 0.02 : 0.08; tilt.rotation.x = LEAN; orient.add(tilt);
      const fig = figure(p.side, p.t); tilt.add(fig);
      /* floating badge: flat, readable from straight above, upright for its own player like a real piece */
      const hold = new THREE.Group(); hold.rotation.y = p.side === 'b' ? Math.PI : 0; outer.add(hold);
      const key = p.side + p.t; badgeCache[key] = badgeCache[key] || badgeTexture(p.side, CH[p.t][p.side], aniso);
      const hm = new THREE.MeshBasicMaterial({ map: badgeCache[key], transparent: true, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.CircleGeometry(paper ? 0.28 : 0.36, 40), hm);
      halo.rotation.x = -Math.PI / 2 + 0.3; halo.position.y = badgeY(p.t); halo.renderOrder = 2; hold.add(halo);
      const sm = new THREE.MeshBasicMaterial({ color: p.side === 'r' ? '#D9445C' : '#34457E', transparent: true });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), sm); stem.position.y = badgeY(p.t) - 0.1; hold.add(stem);
      scene.add(outer);
      const worry = new THREE.Sprite(new THREE.SpriteMaterial({ map: worryTex, depthTest: false, transparent: true }));
      worry.scale.setScalar(0.42); worry.renderOrder = 6; worry.visible = false; scene.add(worry);
      vis[p.id] = { outer, tilt, fig, halo, stem, mats: [hm, sm], side: p.side, worry, key };
    }
  }
  function sync() {
    Object.values(vis).forEach(v => { v.outer.visible = false; });
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = board[r][f]; if (!p) continue;
      const v = vis[p.id];
      v.outer.visible = true; v.outer.position.set(wx(f), 0, wz(r)); v.outer.scale.setScalar(1);
      v.fig.position.set(0, 0, 0); v.fig.rotation.set(0, 0, 0); v.tilt.rotation.set(LEAN, 0, 0);
      if (paper) { XQPaper.dissolve(v.fig, 0); v.halo.scale.setScalar(1); v.stem.scale.setScalar(1); }
    }
  }

  /* ---------- markers ---------- */
  /* drawn on small canvases with a dark outline, so they stay readable on the pale watercolor ground */
  function markTex(draw) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); draw(g);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = aniso; if (look) t.encoding = THREE.sRGBEncoding; return t;
  }
  const ring = (g, color, r, w) => {
    g.lineWidth = w + 8; g.strokeStyle = 'rgba(60,35,30,0.75)'; g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke();
    g.lineWidth = w; g.strokeStyle = color; g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(64, 64, r - w / 2 + 1, 0, 7); g.stroke();
  };
  const markMat = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const quad = s => new THREE.PlaneGeometry(s, s);
  /* where the selected piece can go: a bright gold drop with a dark rim and a white glint */
  const dotGeo = quad(0.5), dotMat = markMat(markTex(g => {
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.fillStyle = '#6E4210'; g.beginPath(); g.arc(64, 64, 40, 0, 7); g.fill();
    g.fillStyle = '#FFC93C'; g.beginPath(); g.arc(64, 64, 33, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(54, 54, 10, 0, 7); g.fill();
  }));
  const ringGeo = quad(1.2);
  const capMat = markMat(markTex(g => ring(g, '#E8264F', 54, 10)));   /* a piece that can be captured */
  const selMat = markMat(markTex(g => ring(g, '#FFC93C', 54, 9)));    /* the selected piece */
  let markers = [];
  function clearMarkers() { markers.forEach(m => scene.remove(m)); markers = []; }
  function addMarker(geo, mat, f, r, y) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(wx(f), y, wz(r)); m.renderOrder = 3; scene.add(m); markers.push(m); }

  /* the last move stays marked until the next one: a dashed ring where the piece left, a soft glow where it landed,
   * in the mover's colour, so the player whose turn it is can see what just happened */
  const SIDE_INK = { r: '#D9445C', b: '#4B5BA8' };
  const lastTex = {};
  ['r', 'b'].forEach(s => {
    lastTex[s] = {
      from: markTex(g => { g.setLineDash([14, 10]); g.lineCap = 'round'; ring(g, SIDE_INK[s], 44, 7); }),
      to: markTex(g => {
        const gr = g.createRadialGradient(64, 64, 10, 64, 64, 62);
        gr.addColorStop(0, SIDE_INK[s] + '55'); gr.addColorStop(0.75, SIDE_INK[s] + '33'); gr.addColorStop(1, SIDE_INK[s] + '00');
        g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
        g.lineWidth = 6; g.strokeStyle = SIDE_INK[s]; g.globalAlpha = 0.85; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.stroke(); g.globalAlpha = 1;
      })
    };
  });
  const lastFrom = new THREE.Mesh(quad(1.0), markMat(null)), lastTo = new THREE.Mesh(quad(1.2), markMat(null));
  [lastFrom, lastTo].forEach(m => { m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.renderOrder = 2; m.visible = false; scene.add(m); });
  let lastMove = null;   /* { side, from: [f, r], to: [f, r] } */
  function showLast() {
    const on = !!lastMove; lastFrom.visible = lastTo.visible = on; if (!on) return;
    const T = lastTex[lastMove.side];
    lastFrom.material.map = T.from; lastTo.material.map = T.to; lastFrom.material.needsUpdate = lastTo.material.needsUpdate = true;
    lastFrom.position.set(wx(lastMove.from[0]), 0.025, wz(lastMove.from[1]));
    lastTo.position.set(wx(lastMove.to[0]), 0.025, wz(lastMove.to[1]));
  }

  /* whose turn: the active kingdom's half of the board glows softly along its edges */
  const turnTex = {};
  ['r', 'b'].forEach(s => {
    const cv = document.createElement('canvas'); cv.width = 460; cv.height = 240; const g = cv.getContext('2d');
    const c = s === 'r' ? '255,110,150' : '255,205,90';
    for (let i = 0; i < 22; i++) { g.strokeStyle = `rgba(${c},${0.8 * (1 - i / 22) ** 2})`; g.lineWidth = 2; g.strokeRect(1 + i, 1 + i, 458 - 2 * i, 238 - 2 * i); }
    turnTex[s] = new THREE.CanvasTexture(cv); if (look) turnTex[s].encoding = THREE.sRGBEncoding;
  });
  const turnGlow = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 4.9), markMat(turnTex.r));
  turnGlow.rotation.x = -Math.PI / 2; turnGlow.position.y = 0.03; turnGlow.renderOrder = 1; scene.add(turnGlow);
  function showTurnGlow() {
    const s = turn === 'r' ? 1 : -1;
    turnGlow.material.map = turnTex[turn]; turnGlow.material.needsUpdate = true;
    turnGlow.position.z = s * 2.76; turnGlow.visible = !over;
  }
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
    if (f2f()) return f2fView();
    const s = side === 'r' ? 1 : -1, half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitH = 5.2 / half, fitW = 5.4 / (half * camera.aspect);
    /* a tall phone is limited by the board's width: keep the margin small there, or the board shrinks into a strip of scenery */
    const dist = Math.max(fitH, fitW) * 1.04 + (camera.aspect < 0.8 ? 0.3 : 1.6);
    /* paper dolls are flat cards, so they need a lower camera than the 3D figures to be seen standing */
    const phi = topMode ? 0.002 : paper ? 0.6 : 0.25;
    const look = new THREE.Vector3(0, 0, topMode ? 0 : 0.25 * s);
    const pos = new THREE.Vector3(0, dist * Math.cos(phi), dist * Math.sin(phi) * s).add(look);
    return { pos, look };
  }
  /* face to face: straight down onto the board, the flower kingdom toward one player and the moon kingdom toward the other.
   * Portrait: players at the bottom (flower) and top (moon). Landscape: players at the right (flower) and left (moon) ends,
   * with the seats along those edges taking SEAT_PX of the width. */
  const SEAT_PX = 116;
  function f2fView() {
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), land = landscape();
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, a = land ? Math.max(0.5, (w - 2 * SEAT_PX) / h) : w / h;
    const along = 5.7, across = 5.0;                  /* half extents of the board with its pieces and badges */
    const dist = land ? Math.max(across / half, along / (half * a)) : Math.max(along / half, across / (half * a));
    return { pos: new THREE.Vector3(0, dist * 1.02, 0), look: new THREE.Vector3(0, 0, 0), up: land ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, -1) };
  }
  function placeF2F() {
    const v = f2fView(); camera.up.copy(v.up); camera.position.copy(v.pos); target.copy(v.look); camera.lookAt(target); atHome = true;
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
    }).then(() => { camAnim = false; controls.enabled = !f2f(); });
  }
  /* while the camera sits at the home view, a resize (phone rotation, address bar) re-frames the board */
  let atHome = true;
  controls.addEventListener('start', () => { atHome = false; });
  const goHome = ms => {
    updateTrays();
    if (f2f()) { placeF2F(); return Promise.resolve(); }
    const h = homeView(viewSide); return camTo(h.pos, h.look, ms).then(() => { atHome = true; });
  };
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
    })).then(() => { ps.forEach(m => { scene.remove(m); m.material.dispose(); }); geo.dispose(); });
  }
  function exclaim(at) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#FF3D63'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.fillStyle = '#FFFFFF'; g.font = '900 92px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv) })); s.scale.set(0.4, 0.4, 0.4); s.position.copy(at); scene.add(s); return s;
  }
  const PETALS = ['#FF9EB4', '#FFD1DC', '#FFE38A', '#FFFFFF'], STARS = ['#B7A6F0', '#CBBDFF', '#FFFFFF', '#FFE38A'];

  /* ---------- UI ---------- */
  /* the line appears letter by letter like a character talking: every letter is laid out from the start (hidden),
   * so the bubble never grows and pushes the board while she speaks; a short pause after punctuation; a tap shows it all */
  const SAY_MS = 36, PAUSE = { '，': 140, '、': 140, '；': 160, '：': 160, '！': 240, '？': 240, '。': 260, '…': 260 };
  let sayTimer = null, saySide = 'r';
  const sfx = (name, side) => { if (window.XQSound) XQSound.play(name, side); };
  function finishSay() { clearTimeout(sayTimer); sayTimer = null; $('say').querySelectorAll('.h').forEach(s => s.classList.remove('h')); }
  function typeSay(text) {
    finishSay();
    const el = $('say'); el.textContent = '';
    const spans = Array.from(text, ch => { const s = document.createElement('span'); s.textContent = ch; s.className = 'h'; el.appendChild(s); return s; });
    if (reduceMotion) { finishSay(); return; }
    let i = 0;
    const step = () => {
      if (i >= spans.length) { sayTimer = null; return; }
      const s = spans[i++]; s.classList.remove('h');
      if (i % 3 === 1) sfx('blip', saySide);
      sayTimer = setTimeout(step, SAY_MS + (PAUSE[s.textContent] || 0));
    };
    step();
  }
  $('bubble').addEventListener('click', e => { if (sayTimer && e.target.id !== 'again') finishSay(); });

  function speak(side, who, text, again) {
    saySide = side; moveBubble(side);
    $('bubble').classList.toggle('moon', side === 'b');
    $('who').textContent = who; typeSay(text); $('again').hidden = !again;
    $('sayLive').textContent = who + '：' + text;   /* screen readers get the whole line at once, not letter by letter */
    /* the speaker's portrait: the top of her paper-doll picture */
    const t = Object.keys(NAME).find(k => NAME[k].includes(who)), av = $('avatar');
    av.hidden = !(paper && t);
    if (!av.hidden) av.src = `assets/paper/${side === 'r' ? 'flower' : 'moon'}-${t}.webp`;
  }
  /* who can take whom right now: every enemy piece's moves (pins ignored: a pinned attacker still scares a child's piece) */
  function updateHelp() {
    threats = {};
    const mine = turn, ok = !over && board;
    if (ok) for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = board[r][f]; if (!p || p.side === mine) continue;
      XQRules.pseudo(board, f, r).forEach(([x, y]) => { const q = board[y][x]; if (q && q.side === mine && q.t !== 'K' && !threats[q.id]) threats[q.id] = p; });
    }
    const show = helper && (mode !== 'ai' || turn === humanSide);
    Object.entries(vis).forEach(([id, v]) => { v.worry.visible = show && !!threats[id] && v.outer.visible; });
    updateMoods();
  }
  /* faces: worried when aimed at or when her queen is in check, delighted for a while after a capture and when her side wins;
   * a pawn over the river wears her grown-up picture. Only pictures that exist are used (js/paper.js). */
  const happyUntil = {};
  let winner = null;
  function updateMoods() {
    if (!paper || !board) return;
    const now = performance.now(), checked = !over && XQRules.inCheck(board, turn) ? XQRules.findK(board, turn) : null;
    for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
      const p = board[r][f]; if (!p) continue;
      let mood = null;
      if (over) mood = winner === p.side ? 'happy' : winner ? 'worry' : null;
      else if (happyUntil[p.id] > now) mood = 'happy';
      else if (threats[p.id] || (checked && checked[0] === f && checked[1] === r)) mood = 'worry';
      XQPaper.setLook(vis[p.id].fig, mood, p.t === 'P' && XQRules.crossed(p, r));
    }
  }
  function updateTurn() {
    updateHelp(); refreshMarks(); setDay();
    $('turn').classList.toggle('moon', turn === 'b');
    $('turnText').textContent = mode === 'ai' ? (turn === humanSide ? `輪到你了（${KINGDOM[turn]}）` : `電腦思考中…（${KINGDOM[turn]}）`) : `${label(turn)}的回合`;
    showTurnGlow();
    ['r', 'b'].forEach(sd => {
      $('seat-' + sd).classList.toggle('active', sd === turn && !over);
      $('seat-' + sd).querySelector('.slot').dataset.wait = over ? '' : sd === turn ? '輪到你囉！' : `${label(turn)}正在想…`;
    });
  }
  /* which way a player at the given side reads, in face-to-face mode */
  const facing = side => !f2f() ? '' : landscape() ? (side === 'r' ? 'rot-r' : 'rot-l') : (side === 'b' ? 'rot-180' : '');
  /* the turn changes hands: a big card for a moment, turned toward the player whose turn it is */
  let bannerTimer = null;
  function showBanner(side) {
    const b = $('banner');
    $('bannerText').textContent = mode === 'ai' ? (side === humanSide ? '輪到你囉！' : '換電腦囉…') : `輪到${label(side)}囉！`;
    $('bannerFace').src = `assets/paper/${side === 'r' ? 'flower' : 'moon'}-K.webp`; $('bannerFace').hidden = !paper;
    b.className = 'banner ' + side + ' ' + facing(side); b.hidden = false;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, reduceMotion ? 900 : 1300);
  }
  /* lay the page out for the current mode and orientation; the speech bubble lives in the seat of whoever speaks */
  function layout() {
    const ff = f2f();
    document.body.classList.toggle('f2f', ff); document.body.classList.toggle('land', landscape());
    ['r', 'b'].forEach(sd => { const st = $('seat-' + sd); st.hidden = !ff; st.className = 'seat ' + sd + ' ' + facing(sd) + (sd === turn && !over ? ' active' : ''); });
    const pn = $('panel'), dock = document.querySelector('.dock');
    if (ff && pn.parentNode !== document.body) document.body.appendChild(pn);
    if (!ff && pn.parentNode !== dock) dock.insertBefore(pn, dock.firstChild);
    if (!ff) { const bub = $('bubble'); if (bub.parentNode !== document.body) document.body.insertBefore(bub, document.querySelector('.stage')); }
    else moveBubble(saySide);
  }
  function moveBubble(side) { if (f2f()) $('seat-' + side).querySelector('.slot').appendChild($('bubble')); }
  /* who each kingdom has sent to rest, shown on the board itself: the near edge for the side we view from, the far edge for the other.
   * Portraits of the captured characters when the paper dolls are in, little stamps otherwise. */
  function updateTrays() {
    const fill = (el, side) => {
      const list = captured[side]; el.textContent = ''; el.hidden = !list.length; el.className = 'tally ' + (side === viewSide ? 'near' : 'far') + ' ' + side;
      const lab = document.createElement('span'); lab.className = 'tlabel'; lab.textContent = KINGDOM[side] + '收集到'; el.appendChild(lab);
      list.forEach(p => {
        let c;
        if (paper) { c = document.createElement('img'); c.className = 'face ' + p.side; c.src = `assets/paper/${p.side === 'r' ? 'flower' : 'moon'}-${p.t}.webp`; c.alt = nm(p); }
        else { c = document.createElement('span'); c.className = 'chip ' + p.side; c.textContent = CH[p.t][p.side]; }
        c.title = nm(p); el.appendChild(c);
      });
    };
    fill($('tallyNear'), viewSide); fill($('tallyFar'), viewSide === 'r' ? 'b' : 'r');
    if (f2f()) ['r', 'b'].forEach(sd => { const el = $('seat-' + sd).querySelector('.caps'); fill(el, sd); el.className = 'caps ' + sd; });
  }
  function updateCheck() {
    if (!over && XQRules.inCheck(board, turn)) { const k = XQRules.findK(board, turn); checkRing.position.set(wx(k[0]), 0.02, wz(k[1])); checkRing.visible = true; }
    else checkRing.visible = false;
    cloudSide = checkRing.visible ? turn : null;
  }

  /* ---------- the board remembers the game ----------
   * Footprints along the last few moves (petals for the flower kingdom, little stars for the moon), fading as they age,
   * and a small blossom or star left on every square where someone was captured. Both are rebuilt from the history
   * after every move, so undo, a resumed game and a new game are always right. */
  const decalTex = {};
  ['r', 'b'].forEach(sd => {
    decalTex[sd] = {
      print: markTex(g => {
        g.fillStyle = sd === 'r' ? '#F2A0B4' : '#F4D27A';
        if (sd === 'r') { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.beginPath(); g.ellipse(64 + Math.cos(a) * 22, 64 + Math.sin(a) * 22, 20, 13, a, 0, 7); g.fill(); } }
        else { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 18 : 46; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
      }),
      bloom: markTex(g => {
        const c1 = sd === 'r' ? '#F7B6C6' : '#C9BEF2', c2 = sd === 'r' ? '#F7D27A' : '#FFF3C4';
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.fillStyle = c1; g.beginPath(); g.arc(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 20, 0, 7); g.fill(); }
        g.fillStyle = c2; g.beginPath(); g.arc(64, 64, 15, 0, 7); g.fill();
      })
    };
  });
  const decals = new THREE.Group(); scene.add(decals);
  const decal = (tex, x, z, size, opacity, rot) => {
    const m = new THREE.Mesh(quad(size), markMat(tex)); m.material.opacity = opacity;
    m.rotation.set(-Math.PI / 2, 0, rot || 0); m.position.set(x, 0.022, z); m.renderOrder = 1; decals.add(m);
  };
  function moveList() {   /* every move played, oldest first, with whether it captured */
    const out = [], total = c => c.r.length + c.b.length;
    for (let k = 1; k <= history.length; k++) {
      const mv = k < history.length ? history[k].last : lastMove, after = k < history.length ? history[k].captured : captured;
      if (mv) out.push({ ...mv, took: total(after) > total(history[k - 1].captured) });
    }
    return out;
  }
  function refreshMarks() {
    decals.children.forEach(m => { m.material.dispose(); m.geometry.dispose(); }); decals.clear();
    if (!board) return;
    const moves = moveList();
    moves.forEach(m => { if (m.took) decal(decalTex[m.side].bloom, wx(m.to[0]), wz(m.to[1]), 0.36, 0.75, m.to[0] * 1.7); });
    moves.slice(-3).forEach((m, i, arr) => {
      const age = arr.length - 1 - i, op = [0.7, 0.42, 0.2][age];
      const x0 = wx(m.from[0]), z0 = wz(m.from[1]), x1 = wx(m.to[0]), z1 = wz(m.to[1]), len = Math.hypot(x1 - x0, z1 - z0), n = Math.min(6, Math.max(2, Math.round(len / 0.7)));   /* a few prints, even for a long rook run */
      for (let j = 1; j < n; j++) { const t = j / n; decal(decalTex[m.side].print, x0 + (x1 - x0) * t + Math.sin(j * 2.1) * 0.05, z0 + (z1 - z0) * t, 0.2, op, j); }
    });
  }

  /* ---------- the day passes as the game goes on: a warm morning at the opening, bright noon in the middle game,
   * a golden evening for a long endgame. Changes ease in over a few seconds. ---------- */
  const DAY = [ /* [plies, sun colour, sun strength, sky colour] */
    [0, '#FFE2C8', 0.46, '#FFF1E2'], [40, '#FFF4E8', 0.52, '#FFF6EE'], [90, '#FFC796', 0.44, '#FFE6D2'], [140, '#F7A982', 0.36, '#F6D9CF']];
  const dayNow = { sun: new THREE.Color(), sky: new THREE.Color(), k: 0.5 }, dayWant = { sun: new THREE.Color('#FFF4E8'), sky: new THREE.Color('#FFF6EE'), k: 0.5 };
  const asLight = (c, hex) => { c.set(hex); if (look) c.convertSRGBToLinear(); return c; };
  function setDay() {
    const n = history ? history.length : 0;
    let i = 0; while (i < DAY.length - 2 && n > DAY[i + 1][0]) i++;
    const [a, b] = [DAY[i], DAY[i + 1]], t = Math.min(1, Math.max(0, (n - a[0]) / (b[0] - a[0])));
    const ca = new THREE.Color(), cb = new THREE.Color();
    dayWant.sun.copy(asLight(ca, a[1])).lerp(asLight(cb, b[1]), t);
    dayWant.sky.copy(asLight(ca, a[3])).lerp(asLight(cb, b[3]), t);
    dayWant.k = a[2] + (b[2] - a[2]) * t;
  }
  let dayInit = false;

  /* ---------- a cloud passes over the side whose queen is in check ---------- */
  let cloudSide = null;
  const cloudTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48, r = 30 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(70,60,95,0.30)'); gr.addColorStop(1, 'rgba(70,60,95,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    }
    const t = new THREE.CanvasTexture(cv); if (look) t.encoding = THREE.sRGBEncoding; return t;
  })();
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.5), markMat(cloudTex));
  cloud.rotation.x = -Math.PI / 2; cloud.position.y = 0.04; cloud.renderOrder = 1; cloud.material.opacity = 0; scene.add(cloud);
  const lockIds = ['undo', 'home', 'view', 'flip', 'auto', 'cinema', 'restart', 'toCover'];
  function lock(b) { busy = b; lockIds.forEach(id => { $(id).disabled = b; }); document.querySelectorAll('.seat button[data-act="undo"]').forEach(x => { x.disabled = b; }); }

  /* ---------- selection & moves ---------- */
  function deselect() {
    if (selected) { const o = vis[selected.p.id].outer, y0 = o.position.y; tw(150, t => { o.position.y = y0 * (1 - t); }); }
    selected = null; legalNow = []; clearMarkers();
  }
  function select(f, r, quiet) {
    deselect();
    const p = board[r][f]; selected = { f, r, p }; legalNow = XQRules.legal(board, f, r);
    const o = vis[p.id].outer; tw(150, t => { o.position.y = 0.25 * t; });
    addMarker(ringGeo, selMat, f, r, 0.02);
    legalNow.forEach(([x, y]) => { if (board[y][x]) addMarker(ringGeo, capMat, x, y, 0.1); else addMarker(dotGeo, dotMat, x, y, 0.02); });
    let say = HINT[p.t];
    if (p.t === 'P' && XQRules.crossed(p, r)) {
      const atEnd = p.side === 'r' ? r === 9 : r === 0;
      say = atEnd
        ? '我已經走到最底了！小兵不能後退，現在只能往左或往右走一格。'
        : '我已經過河了，現在可以往前或往左右走一格！記得我不能後退喔。';
    }
    if (threats[p.id] && helper) say = `小心！${nm(threats[p.id])}正在瞄準我！` + say;
    if (!legalNow.length) {
      /* tell a pinned piece apart from a blocked one: it has moves on paper, but every one would expose its own king */
      const pinned = XQRules.pseudo(board, f, r).length > 0;
      say = pinned
        ? `如果我離開這裡，${kingName(p.side)}就會有危險，所以我要留下來保護她！`
        : say + ' 不過我現在被擋住了，沒有地方可以走。';
    } else if (XQRules.pseudo(board, f, r).length > legalNow.length) {
      say += ` 有些地方我不能去，因為那樣${kingName(p.side)}會有危險。`;
    }
    if (!quiet) speak(p.side, nm(p), say);
    sfx('select');
  }

  async function doMove(tx, ty) {
    lock(true);
    const { f, r, p } = selected; const victim = board[ty][tx];
    Object.values(vis).forEach(v => { v.worry.visible = false; });
    history.push({ board: board.map(row => row.slice()), turn, captured: { r: captured.r.slice(), b: captured.b.slice() }, last: lastMove, storyLen: story.length });
    board[ty][tx] = p; board[r][f] = null;
    lastMove = { side: p.side, from: [f, r], to: [tx, ty] }; showLast();
    tellMove(p, victim, r, ty);
    clearMarkers(); selected = null; legalNow = [];
    const o = vis[p.id].outer;
    let usedCam = false;

    if (victim && cine()) { usedCam = true; await closeUp(tx, ty, p.side); }

    /* the move itself: a hop, a big leap for horses, a high arc for a cannon capture */
    const arc = p.t === 'N' ? 1.1 : (p.t === 'C' && victim ? 2.2 : 0.45);
    const dur = victim && cine() ? 1100 : 560;
    const sx = o.position.x, sy = o.position.y, sz = o.position.z, ex = wx(tx), ez = wz(ty);
    let popped = false;
    const pop = () => {
      const vv = vis[victim.id];
      burst(new THREE.Vector3(ex, 0.6, ez), p.side === 'r' ? PETALS : STARS, 26, true);
      sfx('capture', p.side);
      happyUntil[p.id] = performance.now() + 2600;
      if (paper) tw(D(800), t => { XQPaper.dissolve(vv.fig, t); vv.halo.scale.setScalar(1 - t); vv.stem.scale.setScalar(1 - t); }).then(() => { vv.outer.visible = false; });
      else tw(320, t => vv.outer.scale.setScalar(1 - t)).then(() => { vv.outer.visible = false; });
    };
    await tw(D(dur), t => {
      const e = es(t);
      o.position.set(sx + (ex - sx) * e, sy * (1 - e) + Math.sin(Math.PI * t) * arc, sz + (ez - sz) * e);
      if (victim && !popped && t > 0.62) { popped = true; pop(); }
    });
    if (victim && !popped) pop();
    o.position.set(ex, 0, ez); if (!victim) sfx('move');

    if (victim) {
      captured[p.side].push(victim); updateTrays();
      speak(p.side, nm(p), `${nm(p)}把${nm(victim)}送回休息區了！`);
      if (cine()) { const fg = vis[p.id].fig; await tw(D(600), t => { fg.position.y = Math.abs(Math.sin(Math.PI * t * 2)) * 0.2 * (1 - t); }); await wait(900); }
    }

    turn = turn === 'r' ? 'b' : 'r'; updateTurn();
    const drawWhy = XQRules.anyLegal(board, turn) ? drawReason() : '';   /* a mate wins even if it also repeats a position */

    if (drawWhy) {
      over = true; showTurnGlow(); updateCheck();
      speak(turn, kingName(turn), `平手！${drawWhy}`);
    } else if (!XQRules.anyLegal(board, turn)) {
      over = true; showTurnGlow(); const win = turn === 'r' ? 'b' : 'r';
      updateCheck();
      sfx('win', win); speak(win, kingName(win), `${KINGDOM[win]}贏了！${KINGDOM[turn]}的${kingName(turn)}已經沒有路可以走了。`);
      if (cine()) {
        usedCam = true;
        const k = XQRules.findK(board, win); await closeUp(k[0], k[1], win);
        const kv = vis[board[k[1]][k[0]].id];
        burst(new THREE.Vector3(wx(k[0]), 2.4, wz(k[1])), win === 'r' ? PETALS : STARS, 40, false);
        await tw(D(1800), t => { kv.fig.rotation.y = Math.PI * 4 * es(t); kv.fig.position.y = Math.abs(Math.sin(Math.PI * t * 3)) * 0.3; });
        await wait(1200);
      }
    } else if (XQRules.inCheck(board, turn)) {
      updateCheck();
      tellCheck(turn); sfx('check'); speak(turn, kingName(turn), `${kingName(turn)}被將軍了！快把她移開、擋住，或吃掉威脅她的棋子！`);
      if (cine()) {
        usedCam = true;
        const k = XQRules.findK(board, turn); await closeUp(k[0], k[1], turn);
        const kv = vis[board[k[1]][k[0]].id];
        const ex2 = exclaim(new THREE.Vector3(wx(k[0]), 1.75, wz(k[1])));
        await tw(D(1500), t => { kv.fig.rotation.z = Math.sin(t * Math.PI * 10) * 0.12 * (1 - t); });
        await wait(700); scene.remove(ex2); ex2.material.map.dispose(); ex2.material.dispose();
      }
    } else {
      updateCheck();
      if (!victim) speak(turn, kingName(turn), `輪到${KINGDOM[turn]}囉！`);
    }

    let flipped = false;
    if (autoTurn && mode === 'same' && !over && viewSide !== turn) { viewSide = turn; flipped = true; }
    if (usedCam || flipped) await goHome(flipped ? 2400 : 1600);
    lock(false);
    if (victim) { happyUntil[p.id] = performance.now() + 2600; updateMoods(); }   /* still pleased when the camera is back on the board */
    if (over) { winner = drawWhy ? null : turn === 'r' ? 'b' : 'r'; updateMoods(); showEnd(winner, drawWhy); return; }
    saveGame();
    if (mode !== 'ai' || turn === humanSide) showBanner(turn);
    maybeAI();
  }

  /* ---------- opening like a pop-up book: the land's cutouts first, then the pieces row by row from each side ---------- */
  async function popUp() {
    if (!paper || reduceMotion) return;
    Object.values(vis).forEach(v => { v.fig.userData.pop = 0; });
    if (terrain) terrain.pop(0);
    sfx('move');
    await tw(1700, t => {
      if (terrain) terrain.pop(t);
      Object.values(vis).forEach(v => {
        const z = Math.abs(v.outer.position.z), delay = (5 - z) / 5 * 0.45 + Math.abs(v.outer.position.x) * 0.012;   /* the back rows rise first */
        v.fig.userData.pop = Math.min(1, Math.max(0, (t - delay) / 0.45));
      });
    });
  }

  /* ---------- the story of this game, told as it happens ----------
   * A few lines per game: how it began, the first pawn over the river, captures, checks, how it ended.
   * Kept with the saved game, and the finished story goes to the story book (the last 30 games). */
  let story = [];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const who = s => names[s] ? `${names[s]}的${KINGDOM[s]}` : KINGDOM[s];
  function tell(side, t, text) { story.push({ side, t, text }); }
  function tellStart() {
    story = [];
    const [sd, text] = pick([   /* the picture beside the line is whoever the line is about */
      ['b', `在一個櫻花盛開的早晨，${who('b')}的月光公主寄來一封星星信：「我們來比一場吧！」`],
      ['r', `楚河邊的風輕輕吹著，${who('r')}的櫻花公主帶著大家，和${who('b')}隔河相望。`],
      ['b', `月亮還掛在天邊，太陽已經升起，${who('r')}和${who('b')}的冒險開始了！`]]);
    tell(sd, 'K', text);
  }
  function tellMove(p, victim, fromRank, toRank) {
    const crossedNow = p.t === 'P' && !XQRules.crossed(p, fromRank) && XQRules.crossed(p, toRank);
    if (crossedNow && !story.some(l => l.cross === p.side)) {
      story.push({ side: p.side, t: 'P', cross: p.side, text: `${nm(p)}鼓起勇氣，第一個渡過了楚河！` });
    }
    if (victim) tell(p.side, p.t, pick([
      `${nm(p)}把${nm(victim)}送回了休息區。`,
      `${nm(p)}一個轉身，請${nm(victim)}先回家休息。`,
      `${nm(victim)}被${nm(p)}追上了，只好先回城堡喝茶。`]) + (victim.t === 'R' ? '少了一位騎士，戰況一下子變了！' : ''));
  }
  function tellCheck(side) { tell(other(side), 'K', `${KINGDOM[other(side)]}一路前進，讓${kingName(side)}嚇了一跳——將軍！`); }
  function tellEnd(win, why) {
    if (!win) tell('r', 'K', `最後兩國握手言和：${why}兩位公主約好下次再比。`);
    else tell(win, 'K', `${who(win)}贏得了這一局！${kingName(win)}開心地轉了好幾圈。`);
  }
  const STORIES = 'huayue.stories';
  function storyBook() { try { return JSON.parse(localStorage.getItem(STORIES)) || []; } catch (e) { return []; } }
  function keepStory(win) {
    const list = storyBook();
    list.unshift({ date: new Date().toISOString(), mode, names, win, lines: story });
    try { localStorage.setItem(STORIES, JSON.stringify(list.slice(0, 30))); } catch (e) { /* not kept */ }
  }
  function showStory(st) {
    const el = $('storyPage'), d = new Date(st.date);
    $('storyTitle').textContent = `花月故事・${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    const body = $('storyBody'); body.innerHTML = '';
    st.lines.forEach(l => {
      const row = document.createElement('p'); row.className = 'story-line ' + l.side;
      if (paper) { const im = document.createElement('img'); im.src = `assets/paper/${l.side === 'r' ? 'flower' : 'moon'}-${l.t}.webp`; im.alt = ''; row.appendChild(im); }
      const tx = document.createElement('span'); tx.textContent = l.text; row.appendChild(tx); body.appendChild(row);
    });
    const end = document.createElement('p'); end.className = 'story-end'; end.textContent = '（完）'; body.appendChild(end);
    el.hidden = false;
  }
  function showStoryList() {
    const list = storyBook(), box = $('storyBody');
    $('storyTitle').textContent = '故事書'; box.innerHTML = '';
    if (!list.length) { const e = document.createElement('p'); e.className = 'story-end'; e.textContent = '還沒有故事，下完一局就會寫下第一個故事喔！'; box.appendChild(e); }
    list.forEach(st => {
      const d = new Date(st.date), b = document.createElement('button'); b.className = 'story-item ' + (st.win || 'draw');
      const res = !st.win ? '平手' : (st.names && st.names[st.win] ? st.names[st.win] + '（' + KINGDOM[st.win] + '）' : KINGDOM[st.win]) + '贏了';
      b.textContent = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}・${res}・${st.lines.length} 段`;
      b.onclick = () => showStory(st); box.appendChild(b);
    });
    $('storyPage').hidden = false;
  }

  /* ---------- draws ----------
   * Simplified for a family game: the same position three times, a long stretch with nobody taken,
   * or neither side has anything left that can cross the river and attack. */
  const NO_CAPTURE_PLIES = 120;
  const seenKeys = () => history.map(h => XQAI.key(h.board, h.turn));
  function drawReason() {
    const now = XQAI.key(board, turn);
    if (seenKeys().filter(k => k === now).length >= 2) return '同樣的局面已經出現三次了。';
    const total = c => c.r.length + c.b.length, n = total(captured);
    let quiet = 0; for (let i = history.length - 1; i >= 0 && total(history[i].captured) === n; i--) quiet++;
    if (quiet >= NO_CAPTURE_PLIES) return `已經 ${NO_CAPTURE_PLIES / 2} 回合都沒有人被吃了。`;
    if (!board.some(row => row.some(p => p && 'RNCP'.includes(p.t)))) return '兩邊都沒有可以進攻的棋子了。';
    return '';
  }

  /* ---------- the computer player ---------- */
  async function maybeAI() {
    if (mode !== 'ai' || over || turn === humanSide || busy) return;
    lock(true);
    await wait(450);                                   /* let the child see the board settle before the computer answers */
    await new Promise(r => setTimeout(r, 30));        /* paint "電腦思考中…" before the search blocks the page */
    const m = XQAI.choose(board, turn, aiLevel, new Set([...seenKeys(), XQAI.key(board, turn)]));   /* it avoids going round in circles */
    if (!m) { lock(false); return; }
    select(m.from[0], m.from[1], true);                /* stays locked until its move lands: no undo halfway through */
    await wait(650);                                   /* show which piece it picked and where it can go, like a person would */
    doMove(m.to[0], m.to[1]);
  }

  /* ---------- end of a game ---------- */
  /* win: 'r' / 'b', or null for a draw (why says what happened) */
  function showEnd(win, why) {
    const e = $('endcard');
    $('endFace').src = `assets/paper/${win === 'b' ? 'moon' : 'flower'}-K${paper && win && XQPaper.has(win, 'K-happy') ? '-happy' : ''}.webp`;   /* the winning queen cheering, when that picture exists */ $('endFace').hidden = !paper || !win;
    $('endTitle').textContent = !win ? '平手！兩國都很厲害！'
      : mode === 'ai' ? (win === humanSide ? '你贏了！好厲害！' : '電腦贏了，再挑戰一次吧！') : `${label(win)}贏了！`;
    const moves = history.length;
    $('endStats').textContent = (why ? why + ' ' : '') + `${KINGDOM.r}收集了 ${captured.r.length} 個、${KINGDOM.b}收集了 ${captured.b.length} 個，一共走了 ${moves} 步。`;
    e.className = 'endcard ' + (win || 'draw') + ' ' + (win ? facing(win) : ''); e.hidden = false;
    tellEnd(win, why); keepStory(win); lastStory = storyBook()[0];
    clearGame(); awake(false);
  }
  let lastStory = null;

  /* ---------- input: pick by grid square, not by model, so any model size taps the same ---------- */
  let down = null;
  const ray = new THREE.Raycaster(), pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 8 || busy || over || (mode === 'ai' && turn !== humanSide)) return;
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
    let h = history.pop();
    const keepLines = n => { story = story.slice(0, n); };
    while (mode === 'ai' && h.turn !== humanSide && history.length) h = history.pop();   /* back to the child's own move */
    board = h.board; turn = h.turn; captured = h.captured; over = false; winner = null; lastMove = h.last; showLast(); $('endcard').hidden = true;
    if (h.storyLen !== undefined) keepLines(h.storyLen);
    deselect(); sync(); updateTurn(); updateTrays(); updateCheck();
    speak(turn, kingName(turn), `退回一步，${KINGDOM[turn]}再想想看！`);
    if (autoTurn && mode === 'same' && viewSide !== turn) { lock(true); viewSide = turn; await goHome(2400); lock(false); }
    saveGame(); awake(true);
    maybeAI();   /* undone back to the computer's own first move: it plays again */
  };
  /* settings panel: closed by default, closes again when the board is touched */
  function setPanel(open) {
    const pn = $('panel');
    /* face to face the settings card opens in the middle, turned toward the player who asked for it */
    pn.className = 'panel gutter' + (f2f() ? ' floating ' + facing(pn.dataset.from || 'r') : '');
    pn.hidden = !open;
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
  $('auto').onclick = () => { autoTurn = !autoTurn; $('auto').setAttribute('aria-pressed', autoTurn); };
  $('cinema').onclick = () => { cinema = !cinema; $('cinema').setAttribute('aria-pressed', cinema); };
  $('helper').setAttribute('aria-pressed', helper);
  $('helper').onclick = () => {
    helper = !helper; $('helper').setAttribute('aria-pressed', helper); updateHelp();
    try { localStorage.setItem('huayue.helper', helper ? 'on' : 'off'); } catch (e) { /* not remembered, still applies */ }
  };
  if (window.XQSound) {
    $('sound').setAttribute('aria-pressed', XQSound.enabled);
    $('sound').onclick = () => { XQSound.setEnabled(!XQSound.enabled); $('sound').setAttribute('aria-pressed', XQSound.enabled); };
  } else $('sound').hidden = true;
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
  document.querySelectorAll('.seat').forEach(st => st.addEventListener('click', e => {
    const act = e.target.dataset && e.target.dataset.act; if (!act) return;
    if (act === 'undo') $('undo').click();
    if (act === 'more') { const pn = $('panel'); pn.dataset.from = st.dataset.side; setPanel(pn.hidden); }
  }));
  $('endAgain').onclick = () => { $('endcard').hidden = true; restart(); };
  $('endStory').onclick = () => { if (lastStory) showStory(lastStory); };
  $('coverStories').onclick = showStoryList;
  $('storyClose').onclick = () => { $('storyPage').hidden = true; };
  $('endCover').onclick = () => { $('endcard').hidden = true; showCover(); };
  $('toCover').onclick = () => { if (!busy) { setPanel(false); showCover(); } };

  /* ---------- the game in progress survives a reload (a swipe, a closed tab, the tablet freeing memory) ----------
   * Pieces are stored by id: every piece object is rebuilt from a new game's set, so ids keep matching the visuals. */
  const GAME = 'huayue.game';
  const flat = B => B.flat().map(p => p ? p.id : -1);
  function saveGame() {
    if (over || !board) return;
    const g = { v: 1, mode, humanSide, aiLevel, names, turn, board: flat(board), captured: { r: captured.r.map(p => p.id), b: captured.b.map(p => p.id) }, last: lastMove,
      history: history.map(h => ({ board: flat(h.board), turn: h.turn, captured: { r: h.captured.r.map(p => p.id), b: h.captured.b.map(p => p.id) }, last: h.last, storyLen: h.storyLen })), story };
    try { localStorage.setItem(GAME, JSON.stringify(g)); } catch (e) { /* not kept; the game goes on */ }
  }
  function clearGame() { try { localStorage.removeItem(GAME); } catch (e) { /* nothing to clear */ } }
  function savedGame() { try { const g = JSON.parse(localStorage.getItem(GAME)); return g && g.v === 1 ? g : null; } catch (e) { return null; } }
  function loadGame(g) {
    const P = {}; XQRules.newGame().board.flat().forEach(p => { if (p) P[p.id] = p; });
    const unflat = a => Array.from({ length: 10 }, (_, r) => a.slice(r * 9, r * 9 + 9).map(id => id < 0 ? null : P[id]));
    const caps = c => ({ r: c.r.map(id => P[id]), b: c.b.map(id => P[id]) });
    board = unflat(g.board); turn = g.turn; captured = caps(g.captured); lastMove = g.last; over = false; selected = null; legalNow = [];
    history = g.history.map(h => ({ board: unflat(h.board), turn: h.turn, captured: caps(h.captured), last: h.last, storyLen: h.storyLen }));
    story = g.story || []; winner = null;
  }

  /* ---------- keep the tablet awake while a game is on (thinking takes a while) ---------- */
  let wakeLock = null;
  async function awake(on) {
    try {
      if (on && !over && document.visibilityState === 'visible' && navigator.wakeLock && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* not supported or refused: the screen may dim, nothing else changes */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('cover').hidden && !over) awake(true); });

  /* ---------- cover ---------- */
  const SAVE = 'huayue.setup';
  function showCover() {
    awake(false);
    const g = savedGame();
    $('resume').hidden = !g;
    if (g) $('resume').textContent = `繼續上一局（${g.mode === 'ai' ? '跟電腦下' : g.mode === 'f2f' ? '面對面' : '兩人同一邊'}・第 ${g.history.length + 1} 步）`;
    let sv = {}; try { sv = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) { /* storage blocked: defaults */ }
    const m = sv.mode || 'same';
    document.querySelectorAll('input[name="mode"]').forEach(x => { x.checked = x.value === m; });
    $('humanSide').value = sv.humanSide || 'r'; $('aiLevel').value = String(sv.aiLevel || 1);
    $('nameR').value = sv.names ? sv.names.r : ''; $('nameB').value = sv.names ? sv.names.b : '';
    coverOpts(); $('cover').hidden = false;
  }
  function coverOpts() {
    const m = (document.querySelector('input[name="mode"]:checked') || {}).value;
    $('aiOpts').hidden = m !== 'ai'; $('nameOpts').hidden = m === 'ai';
  }
  document.querySelectorAll('input[name="mode"]').forEach(x => { x.onchange = coverOpts; });
  /* the page set up for the chosen way of playing */
  function applyMode() {
    $('cover').hidden = true;
    /* the view-side settings only make sense when two people share one view */
    ['flip', 'auto'].forEach(id => { $(id).hidden = mode !== 'same'; });
    $('view').hidden = f2f(); $('cinema').hidden = f2f();
    controls.enabled = !f2f(); if (!f2f()) camera.up.set(0, 1, 0);
    layout();
  }
  $('go').onclick = () => {
    if (busy) return;
    mode = (document.querySelector('input[name="mode"]:checked') || { value: 'same' }).value;
    humanSide = $('humanSide').value; aiLevel = +$('aiLevel').value;
    names = mode === 'ai' ? { r: '', b: '' } : { r: $('nameR').value.trim(), b: $('nameB').value.trim() };
    try { localStorage.setItem(SAVE, JSON.stringify({ mode, humanSide, aiLevel, names })); } catch (e) { /* not remembered, still applies */ }
    applyMode(); restart(true);
  };
  $('resume').onclick = async () => {
    const g = savedGame(); if (!g || busy) return;
    mode = g.mode; humanSide = g.humanSide; aiLevel = g.aiLevel; names = g.names || { r: '', b: '' };
    applyMode(); loadGame(g);
    clearMarkers(); sync(); showLast(); updateTurn(); updateTrays(); updateCheck(); $('endcard').hidden = true;
    speak(turn, kingName(turn), `歡迎回來！接著上一局，輪到${label(turn)}。`);
    lock(true); viewSide = mode === 'ai' ? humanSide : mode === 'same' ? turn : 'r'; await Promise.all([goHome(1400), popUp()]); lock(false);
    awake(true); showBanner(turn); maybeAI();
  };

  function newState() {
    const g = XQRules.newGame(); board = g.board; turn = g.turn;
    history = []; selected = null; legalNow = []; over = false; captured = { r: [], b: [] }; lastMove = null; showLast();
  }
  async function restart() {
    if (busy) return;
    newState(); winner = null; tellStart(); /* ids are generated in the same order, so the existing visuals map back 1:1 */
    clearMarkers(); sync(); updateTurn(); updateTrays(); updateCheck(); $('endcard').hidden = true;
    const first = mode === 'ai' && humanSide === 'b' ? '新的一局開始！花之國先走，電腦正在想第一步。' : `新的一局開始！${label('r')}先走，點一下棋子看看它可以走到哪裡。`;
    speak('r', kingName('r'), first);
    lock(true); viewSide = mode === 'ai' ? humanSide : 'r'; await Promise.all([goHome(1400), popUp()]); lock(false);
    saveGame(); awake(true);
    showBanner('r'); maybeAI();
  }

  /* ---------- loop ---------- */
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), seatEye = new THREE.Object3D();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (f2f()) { layout(); if (board) placeF2F(); return; }
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
      if (paper) { /* paper dolls lean back toward the camera (face to face: toward their own player); keep the badge above her head */
        if (f2f()) { v.outer.getWorldPosition(tmp); seatEye.position.set(tmp.x, tmp.y + 10, tmp.z + (v.side === 'r' ? 4 : -4)); }
        XQPaper.face(v.fig, f2f() ? seatEye : camera, reduceMotion ? 0 : now / 1000, v.side === turn && !over ? 1 : 0.35);
        v.halo.parent.worldToLocal(XQPaper.top(v.fig, tmp)); tmp.y += XQPaper.BADGE_UP;
        if (f2f()) { tmp.z -= 0.42; tmp.y -= 0.2; }   /* seen from straight above, float the badge past her head instead of on it */
        v.halo.position.copy(tmp); v.stem.position.set(tmp.x, tmp.y - 0.1, tmp.z);
      }
      v.halo.getWorldPosition(tmp);
      /* tilt each badge with the camera's viewing angle: pitch only, so the text keeps facing its own player like a real piece */
      tmp2.copy(camera.position); v.halo.parent.worldToLocal(tmp2); tmp2.sub(v.halo.position);
      const pitch = Math.max(-1.35, Math.min(1.35, Math.atan2(tmp2.z, tmp2.y)));
      v.halo.rotation.x = -Math.PI / 2 + pitch;
      if (v.worry.visible) { v.worry.position.copy(tmp); v.worry.position.y += 0.05 + Math.abs(Math.sin(now / 260)) * 0.08; v.worry.position.x += 0.32; }
      const d = camera.position.distanceTo(tmp), k = Math.min(1, Math.max(0, (d - 3.6) / 2.6)), o = k * k * (3 - 2 * k);
      v.mats.forEach(m => { m.opacity = o; }); v.halo.visible = o > 0.01;
    });
    const pulse = 1 + Math.sin(now / 220) * 0.08; markers.forEach(m => m.scale.setScalar(pulse));
    if (checkRing.visible) checkRing.scale.setScalar(1 + Math.sin(now / 150) * 0.12);
    turnGlow.material.opacity = 0.75 + Math.sin(now / 700) * 0.25;
    if (!dayInit) { dayNow.sun.copy(dayWant.sun); dayNow.sky.copy(dayWant.sky); dayNow.k = dayWant.k; dayInit = true; }
    const ease = reduceMotion ? 1 : 0.02;
    dayNow.sun.lerp(dayWant.sun, ease); dayNow.sky.lerp(dayWant.sky, ease); dayNow.k += (dayWant.k - dayNow.k) * ease;
    if (look) { sun.color.copy(dayNow.sun); sun.intensity = dayNow.k; hemi.color.copy(dayNow.sky); }
    const cw = cloudSide && !over ? 1 : 0;
    cloud.material.opacity += (cw - cloud.material.opacity) * (reduceMotion ? 1 : 0.04);
    cloud.visible = cloud.material.opacity > 0.01;
    if (cloudSide) cloud.position.z = cloudSide === 'r' ? 2.7 : -2.7;
    cloud.position.x = Math.sin(now / 4000) * 0.6;   /* drifting slowly */
    if (paper && (now | 0) % 300 < 17) updateMoods();   /* happy faces wear off after a while */
    if (terrain && terrain.root.visible) terrain.update(now / 1000, camera, target);
    if (!camAnim && !f2f()) controls.update();
    if (look) XQLook.manage(scene);   /* new objects (particles, markers, the other board look) get converted before they are drawn */
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
    const BADGE_FONT = '700 150px "LXGW WenKai TC"';
    if (!document.fonts.check(BADGE_FONT, '帥將')) document.fonts.load(BADGE_FONT, '帥將仕士相象俥車傌馬炮包兵卒').then(() => {
      Object.keys(badgeCache).forEach(k => { const old = badgeCache[k]; badgeCache[k] = badgeTexture(k[0], CH[k[1]][k[0]], aniso); old.dispose(); });
      Object.values(vis).forEach(v => { v.halo.material.map = badgeCache[v.key]; v.halo.material.needsUpdate = true; });
    }).catch(() => { /* stays on the fallback font */ });
    if (window.XQPaper) { /* show how many characters have arrived, so a slow connection does not look frozen */
      const show = (n, t) => { $('loading').textContent = `角色準備中… ${n} / ${t}`; };
      XQPaper.progress.on = show; show(XQPaper.progress.done, XQPaper.progress.total);
    }
    paper = window.XQPaper ? await XQPaper.ready : false;
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 10.2), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.85 }));
    bp.rotation.x = -Math.PI / 2; bp.position.y = 0.002; bp.receiveShadow = true; classic.add(bp);
    applyLook();
    newState(); buildVisuals(); sync(); updateTurn(); updateTrays();
    resize(); const h = homeView('r'); camera.position.copy(h.pos); target.copy(h.look); camera.lookAt(target);
    $('loading').hidden = true;
    requestAnimationFrame(loop);
    showCover();
  }
  /* test hook, only with ?debug in the address: set up a position and play moves without tapping */
  if (/[?&]debug/.test(location.search)) window.XQDebug = {
    setup(pieces, side) {      /* pieces: [[side, type, file, rank], ...]; ids follow the order of a new game so the visuals map */
      const ids = {}, fresh = XQRules.newGame().board; for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) { const p = fresh[r][f]; if (p) (ids[p.side + p.t] = ids[p.side + p.t] || []).push(p.id); }
      board = Array.from({ length: 10 }, () => Array(9).fill(null));
      pieces.forEach(([sd, t, f, r]) => { board[r][f] = { id: ids[sd + t].shift(), side: sd, t }; });
      turn = side || 'r'; history = []; over = false; captured = { r: [], b: [] }; lastMove = null; showLast();
      deselect(); sync(); updateTurn(); updateTrays(); updateCheck(); $('endcard').hidden = true;
    },
    async move(f, r, x, y) { select(f, r, true); await doMove(x, y); },
    select(f, r) { select(f, r); },
    looks: () => Object.values(vis).filter(v => v.outer.visible && v.fig.userData.look && v.fig.userData.look !== v.fig.userData.t).map(v => v.side + v.fig.userData.look),
    story: () => story.map(l => l.text),
    scene: () => ({ decals: decals.children.length, cloud: +cloud.material.opacity.toFixed(2), cloudSide, sun: '#' + dayWant.sun.getHexString(), sunK: +dayWant.k.toFixed(2) }),
    threats: () => Object.entries(threats).map(([id, by]) => [Object.values(vis)[id] ? id : id, nm(by)]),
    state: () => ({ turn, over, mode, history: history.length, board: board.map(row => row.map(p => p ? p.side + p.t : '')) })
  };
  start();
})();
