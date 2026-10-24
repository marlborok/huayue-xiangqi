/* 楚漢石棋 — the stone game (explore-3d branch): 劉邦's 漢 army against 項羽's 楚 army as carved stone statues
 * in an underground hall, inspired by the feeling of a giant living chess game (our own designs throughout).
 *
 * figure(side, t)   a statue on its plinth, standing at y=0 and facing +z, about 1.2-1.5 units tall
 * hall(scene, ctx)  the hall: stone floor, the board as two carved slabs with a real water channel between, pillars,
 *                   torches, banners, floating dust. ctx = { sun, hemi } are game.js's lights, retuned for the hall.
 * glow(fig)         the statue wakes: a warm glow that fades, when it is told to move
 * thud(x, z, big)   a puff of dust where a heavy statue lands
 * shatter(fig, dir) the statue breaks into stone chunks that fly away from the attacker and settle, then sink away
 * update(t)         per-frame: chunks, dust, torches, water
 * Statues are built from simple shapes in code (no model files); faces are left plain, like weathered stone.
 */
(function () {
  const STONE = {
    r: { body: '#C48A5C', dark: '#8E5E3C', accent: '#E8C27A', plinth: '#7A6A5E' },   /* 漢: warm sandstone, gold-tinted trim */
    b: { body: '#4A4B57', dark: '#2C2D36', accent: '#8C9BC4', plinth: '#3A3940' }    /* 楚: dark basalt, cold blue-grey trim */
  };
  const BADGE_Y = { K: 1.85, A: 1.55, B: 1.55, R: 1.55, N: 1.7, C: 1.5, P: 1.4 };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function mats(side) {
    const C = STONE[side];
    const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0, flatShading: true, emissive: '#000000' });
    return { body: m(C.body), dark: m(C.dark), accent: new THREE.MeshStandardMaterial({ color: C.accent, roughness: 0.6, metalness: 0.15, flatShading: true, emissive: '#000000' }), plinth: m(C.plinth) };
  }
  const put = (p, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh); return mesh; };
  const cyl = (rt, rb, h, m, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), m);
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const ball = (r, m, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg || 10, Math.max(6, (seg || 10) - 3)), m);
  const cone = (r, h, m, seg) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 8), m);
  const lathe = (pts, m, seg) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg || 12), m);

  /* ---------- figures ---------- */
  /* a standing person: robe or armoured skirt, torso, arms, head. Returns the group and anchor points for hands and head top */
  function person(M, o) {
    const g = new THREE.Group();
    const skirt = o.armour ? [[0.2, 0], [0.22, 0.04], [0.19, 0.3], [0.16, 0.5], [0.15, 0.55]] : [[0.24, 0], [0.26, 0.04], [0.2, 0.3], [0.16, 0.52], [0.15, 0.56]];
    put(g, lathe(skirt, M.body), 0, 0, 0);
    put(g, cyl(0.17, 0.15, 0.3, M.body), 0, 0.7, 0);
    if (o.armour) [0.6, 0.68, 0.76].forEach(y => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.018, 4, 12), M.dark); t.rotation.x = Math.PI / 2; put(g, t, 0, y, 0); });
    else { const sash = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 4, 12), M.accent); sash.rotation.x = Math.PI / 2; put(g, sash, 0, 0.58, 0); }
    [1, -1].forEach(s => {
      put(g, ball(0.08, o.armour ? M.dark : M.body), s * 0.19, 0.83, 0);
      const arm = put(g, cyl(0.05, o.armour ? 0.05 : 0.08, 0.32, M.body), s * 0.22, 0.67, 0.03); arm.rotation.z = s * 0.12;
      put(g, ball(0.045, M.body), s * 0.23, 0.5, 0.06);
    });
    put(g, cyl(0.05, 0.06, 0.08, M.body), 0, 0.88, 0);
    put(g, ball(0.11, M.body, 12), 0, 0.99, 0);
    if (o.beard) put(g, cone(0.06, 0.16, M.dark), 0, 0.88, 0.07).rotation.x = Math.PI;
    return { g, hand: [new THREE.Vector3(0.23, 0.5, 0.06), new THREE.Vector3(-0.23, 0.5, 0.06)], top: 1.1 };
  }
  /* weapons, held upright in the right hand */
  function polearm(g, M, kind, at, len) {
    len = len || 1.45;
    put(g, cyl(0.016, 0.016, len, M.dark, 6), at.x, at.y + len * 0.35, at.z);
    const tip = at.y + len * 0.85;
    put(g, cone(0.035, 0.16, M.accent, 6), at.x, tip + 0.08, at.z);
    if (kind === 'ji') {   /* 戟: a crescent blade beside the spear point */
      const blade = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 4, 10, Math.PI), M.accent); blade.rotation.z = Math.PI / 2; put(g, blade, at.x + 0.02, tip - 0.06, at.z);
    } else if (kind === 'ge') {   /* 戈: a dagger blade out to the side */
      put(g, box(0.16, 0.03, 0.015, M.accent), at.x - 0.07, tip - 0.04, at.z).rotation.z = -0.2;
    }
  }
  function shield(g, M, at) { put(g, box(0.3, 0.38, 0.035, M.dark), at.x + 0.08, at.y + 0.1, at.z + 0.14); put(g, ball(0.05, M.accent), at.x + 0.08, at.y + 0.1, at.z + 0.16); }
  function helmet(g, M, top, plume) {
    put(g, new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.dark), 0, top - 0.1, 0);
    put(g, cone(0.03, plume || 0.14, M.accent), 0, top + 0.05 + (plume || 0.14) / 2, -0.01);
  }
  function plinth(g, M, r) { put(g, cyl(r || 0.38, (r || 0.38) + 0.03, 0.1, M.plinth, 8), 0, 0.05, 0); }

  function horse(M, rider) {
    const g = new THREE.Group();
    const b = put(g, ball(0.2, M.body, 12), 0, 0.52, 0); b.scale.set(0.85, 0.8, 1.7);
    put(g, cyl(0.07, 0.1, 0.36, M.body), 0, 0.72, 0.28).rotation.x = 0.6;
    put(g, box(0.12, 0.14, 0.3, M.body), 0, 0.9, 0.46).rotation.x = 0.5;
    [1, -1].forEach(s => put(g, cone(0.025, 0.08, M.body), s * 0.04, 1.0, 0.36));
    put(g, box(0.03, 0.08, 0.34, M.dark), 0, 0.84, 0.24).rotation.x = 0.6;   /* mane */
    [[0.1, 0.22], [-0.1, 0.22], [0.1, -0.22], [-0.1, -0.22]].forEach(([x, z]) => put(g, cyl(0.04, 0.035, 0.4, M.body, 6), x, 0.2, z));
    put(g, cyl(0.02, 0.05, 0.36, M.dark, 6), 0, 0.42, -0.4).rotation.x = -0.5;   /* tail */
    put(g, box(0.36, 0.05, 0.3, M.accent), 0, 0.66, -0.02);   /* saddle cloth */
    if (rider) {
      const p = person(M, { armour: true }); p.g.scale.setScalar(0.62); p.g.position.set(0, 0.62, -0.04); g.add(p.g);
      helmet(p.g, M, p.top, rider === 'king' ? 0.3 : 0.16);
      polearm(p.g, M, rider === 'king' ? 'ji' : 'spear', p.hand[0], 1.6);
    }
    return g;
  }

  function elephant(M) {
    const g = new THREE.Group();
    const b = put(g, ball(0.3, M.body, 12), 0, 0.6, -0.04); b.scale.set(1, 0.9, 1.35);
    put(g, ball(0.2, M.body, 12), 0, 0.74, 0.4);
    [1, -1].forEach(s => { const e = put(g, ball(0.15, M.body, 10), s * 0.2, 0.76, 0.32); e.scale.set(0.3, 1, 0.9); });
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.66, 0.56), new THREE.Vector3(0, 0.42, 0.7), new THREE.Vector3(0, 0.2, 0.68), new THREE.Vector3(0, 0.14, 0.58)]);
    put(g, new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.05, 6), M.body), 0, 0, 0);
    [1, -1].forEach(s => put(g, cone(0.03, 0.26, M.accent), s * 0.1, 0.56, 0.6).rotation.x = 1.9);
    [[0.17, 0.25], [-0.17, 0.25], [0.17, -0.3], [-0.17, -0.3]].forEach(([x, z]) => put(g, cyl(0.08, 0.085, 0.42, M.body, 8), x, 0.21, z));
    put(g, box(0.34, 0.2, 0.34, M.dark), 0, 0.98, -0.08);   /* the howdah on its back */
    put(g, cone(0.28, 0.2, M.accent, 4), 0, 1.18, -0.08).rotation.y = Math.PI / 4;
    return g;
  }

  function chariot(M) {
    const g = new THREE.Group();
    put(g, box(0.46, 0.06, 0.42, M.dark), 0, 0.32, 0);
    [[0.23, 0], [-0.23, 0]].forEach(([x]) => put(g, box(0.03, 0.18, 0.42, M.body), x, 0.44, 0));
    put(g, box(0.46, 0.18, 0.03, M.body), 0, 0.44, 0.2);
    [1, -1].forEach(s => {
      const w = new THREE.Group(); w.position.set(s * 0.3, 0.3, 0); w.rotation.y = Math.PI / 2; g.add(w);
      put(w, new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 5, 18), M.dark), 0, 0, 0);
      for (let i = 0; i < 4; i++) put(w, box(0.02, 0.54, 0.02, M.body), 0, 0, 0).rotation.z = i * Math.PI / 4;
    });
    put(g, cyl(0.02, 0.02, 0.7, M.dark, 6), 0, 0.3, 0).rotation.z = Math.PI / 2;   /* axle */
    put(g, cyl(0.022, 0.022, 0.6, M.dark, 6), 0, 0.36, 0.48).rotation.x = Math.PI / 2 - 0.15;   /* the shaft */
    const p = person(M, { armour: true }); p.g.scale.setScalar(0.72); p.g.position.set(0, 0.35, -0.04); g.add(p.g);
    helmet(p.g, M, p.top, 0.12); polearm(p.g, M, 'ji', p.hand[0], 1.5);
    put(g, box(0.02, 0.26, 0.2, M.accent), -0.2, 1.05, -0.12);   /* banner */
    put(g, cyl(0.01, 0.01, 0.75, M.dark, 4), -0.2, 0.8, -0.02);
    return g;
  }

  function trebuchet(M) {
    const g = new THREE.Group();
    [1, -1].forEach(s => {
      put(g, box(0.05, 0.05, 0.6, M.dark), s * 0.18, 0.13, 0);
      [-1, 1].forEach(d => put(g, cyl(0.025, 0.03, 0.66, M.body, 6), s * 0.18, 0.42, d * 0.13).rotation.x = -d * 0.4);
    });
    put(g, cyl(0.025, 0.025, 0.44, M.dark, 6), 0, 0.72, 0).rotation.z = Math.PI / 2;
    const arm = new THREE.Group(); arm.position.set(0, 0.72, 0); arm.rotation.x = -0.9; g.add(arm);
    put(arm, cyl(0.025, 0.035, 1.0, M.body, 6), 0, 0.25, 0);
    put(arm, box(0.18, 0.16, 0.16, M.dark), 0, -0.22, 0);   /* counterweight */
    put(arm, ball(0.07, M.accent), 0, 0.76, 0);   /* the stone in its sling */
    return g;
  }

  function figure(side, t) {
    const M = mats(side), red = side === 'r', g = new THREE.Group();
    const mount = (child, y) => { child.position.y = y; g.add(child); return child; };
    if (t === 'N') { plinth(g, M, 0.4); mount(horse(M, 'rider'), 0.1); }
    else if (t === 'R') { plinth(g, M, 0.42); mount(chariot(M), 0.1); }
    else if (t === 'C') { plinth(g, M, 0.4); mount(trebuchet(M), 0.1); }
    else if (t === 'B' && !red) { plinth(g, M, 0.42); mount(elephant(M), 0.1); }
    else {
      plinth(g, M);
      const armour = t === 'P' || (t === 'K' && !red);
      const p = person(M, { armour, beard: t === 'A' || (t === 'B' && red) || (t === 'K' && red) });
      mount(p.g, 0.1);
      if (t === 'K') {
        p.g.scale.setScalar(1.22);
        if (red) {   /* 劉邦: the flat-topped 冕 crown with beads hanging at the front, a sceptre */
          put(p.g, cyl(0.09, 0.1, 0.1, M.accent), 0, p.top, 0);
          put(p.g, box(0.32, 0.025, 0.2, M.accent), 0, p.top + 0.07, 0).rotation.x = -0.1;
          for (let i = -2; i <= 2; i++) put(p.g, cyl(0.006, 0.006, 0.1, M.dark, 4), i * 0.05, p.top + 0.01, 0.11);
          put(p.g, cyl(0.02, 0.02, 0.5, M.accent, 6), p.hand[0].x, p.hand[0].y + 0.15, p.hand[0].z + 0.04);
        } else {   /* 項羽: a tall plumed helmet and his great 戟 */
          helmet(p.g, M, p.top, 0.34); polearm(p.g, M, 'ji', p.hand[0], 1.6);
          const cape = put(p.g, box(0.4, 0.62, 0.03, M.dark), 0, 0.55, -0.18); cape.rotation.x = 0.12;
        }
      } else if (t === 'A') {   /* 謀士: a scholar's tall hat; 張良 with a feather fan, 范增 with a scroll */
        put(p.g, box(0.1, 0.16, 0.12, M.dark), 0, p.top + 0.04, -0.02);
        if (red) { const fan = put(p.g, new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), M.accent), p.hand[0].x, p.hand[0].y + 0.17, p.hand[0].z + 0.04); fan.material = M.accent; fan.material.side = THREE.DoubleSide; }
        else put(p.g, cyl(0.035, 0.035, 0.3, M.accent, 8), 0, 0.52, 0.12).rotation.z = Math.PI / 2;
      } else if (t === 'B') {   /* 丞相: a court official holding his 笏 tablet before him */
        put(p.g, box(0.24, 0.05, 0.08, M.dark), 0, p.top + 0.02, 0);
        put(p.g, box(0.06, 0.3, 0.02, M.accent), 0, 0.62, 0.18);
      } else if (t === 'P') {   /* 步卒: helmet, shield, 戟 for 漢 and 戈 for 楚 */
        helmet(p.g, M, p.top, 0.08); shield(p.g, M, p.hand[1]); polearm(p.g, M, red ? 'ji' : 'ge', p.hand[0], 1.3);
      }
    }
    const all = [];
    g.traverse(o => { if (o.isMesh && !all.includes(o.material)) all.push(o.material); });
    g.userData.stone = { mats: all, body: M.body, glow: 0 };
    return g;
  }

  /* ---------- the hall ---------- */
  let scene = null, torches = [], water = null, motes = null;
  const live = [];   /* chunks and dust puffs */
  const BANK = 0.38, EDGE = 5.3, PX = 90;

  function slabTexture(side) {
    const W = 9.6 * PX, H = (EDGE - BANK) * PX;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const z0 = side === 'r' ? BANK : -EDGE, X = x => (x + 4.8) * PX, Y = z => (z - z0) * PX;
    g.fillStyle = '#8C8590'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const v = rnd(-30, 30) | 0; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 250 : 0},${v > 0 ? 245 : 0},${Math.abs(v) / 600})`; g.fillRect(rnd(0, W), rnd(0, H), rnd(1, 4), rnd(1, 4)); }
    for (let i = 0; i < 10; i++) {   /* hairline cracks */
      g.strokeStyle = 'rgba(40,34,44,0.25)'; g.lineWidth = 1; g.beginPath(); let x = rnd(0, W), y = rnd(0, H); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke();
    }
    /* carved lines: a dark groove with a light lower lip, so they read as cut into the stone */
    const groove = (a, b, c, d) => {
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,248,235,0.35)'; g.lineWidth = 7; g.beginPath(); g.moveTo(a + 1.5, b + 2); g.lineTo(c + 1.5, d + 2); g.stroke();
      g.strokeStyle = '#2B2530'; g.lineWidth = 5; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
    };
    const wx = f => f - 4, wz = r => 4.5 - r, ranks = side === 'r' ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];
    const zs = ranks.map(wz), zmin = Math.min(...zs), zmax = Math.max(...zs);
    ranks.forEach(r => groove(X(-4), Y(wz(r)), X(4), Y(wz(r))));
    for (let f = 0; f < 9; f++) groove(X(wx(f)), Y(zmin), X(wx(f)), Y(zmax));
    const pr = side === 'r' ? [0, 2] : [7, 9];
    groove(X(-1), Y(wz(pr[0])), X(1), Y(wz(pr[1]))); groove(X(1), Y(wz(pr[0])), X(-1), Y(wz(pr[1])));
    /* the small corner marks of the cannon and soldier points */
    const marks = side === 'r' ? [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3]] : [[1, 7], [7, 7], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]];
    marks.forEach(([f, r]) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
      if ((f === 0 && dx < 0) || (f === 8 && dx > 0)) return;
      const x = X(wx(f)) + dx * 9, y = Y(wz(r)) + dy * 9;
      groove(x, y, x + dx * 16, y); groove(x, y, x, y + dy * 16);
    }));
    g.strokeStyle = '#2B2530'; g.lineWidth = 8; g.strokeRect(X(-4.25), Y(side === 'r' ? 0.45 : -4.95), 8.5 * PX, 4.5 * PX);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t;
  }
  function tileTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#3E3842'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = rnd(-10, 10) | 0; g.fillStyle = `rgb(${62 + v},${56 + v},${66 + v})`; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.15)})`; g.fillRect(rnd(0, 256), rnd(0, 256), 2, 2); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(15, 15); t.encoding = THREE.sRGBEncoding; return t;
  }
  function glyphTexture(ch, color, bg) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const g = cv.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 256, 512); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 470, 256, 42); }
    g.font = 'bold 190px "LXGW WenKai TC", "Noto Sans TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    g.fillText(ch, 128, 230);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    if (document.fonts) document.fonts.load(g.font, ch).then(() => {
      g.clearRect(0, 0, 256, 512); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 256, 512); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 470, 256, 42); }
      g.fillStyle = color; g.fillText(ch, 128, 230); t.needsUpdate = true;
    }, () => {});
    return t;
  }
  function soft(color) {   /* a round soft blob for flames, dust and motes */
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
  }

  function hall(sc, ctx) {
    scene = sc;
    sc.background = new THREE.Color('#141016'); sc.environment = null;
    sc.fog = new THREE.Fog('#141016', 16, 42);
    ctx.hemi.color.set('#9A8FA8'); ctx.hemi.groundColor.set('#2A2228'); ctx.hemi.intensity = 0.55;
    ctx.sun.color.set('#D6DCFF'); ctx.sun.intensity = 0.85; ctx.sun.position.set(-3, 14, 5);   /* a shaft of cold light from above */
    const root = new THREE.Group(); sc.add(root);
    const stoneM = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.32; floor.receiveShadow = true; root.add(floor);

    /* the board: two thick slabs, one per kingdom, with the river channel cut between them */
    ['r', 'b'].forEach(side => {
      const s = side === 'r' ? 1 : -1, len = EDGE - BANK, side6 = stoneM('#6E6872');
      const slab = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.32, len), [side6, side6, new THREE.MeshStandardMaterial({ map: slabTexture(side), roughness: 0.9 }), side6, side6, side6]);
      slab.position.set(0, -0.16, s * (BANK + len / 2)); slab.receiveShadow = true; slab.castShadow = true; root.add(slab);
    });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.1, BANK * 2), stoneM('#26303A')); bed.position.y = -0.3; root.add(bed);
    const wc = document.createElement('canvas'); wc.width = 256; wc.height = 64; const wg = wc.getContext('2d');
    wg.fillStyle = '#1D4A5C'; wg.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 40; i++) { wg.strokeStyle = `rgba(160,220,235,${rnd(0.15, 0.4)})`; wg.lineWidth = rnd(1, 2.5); const x = rnd(0, 256), y = rnd(0, 64); wg.beginPath(); wg.moveTo(x, y); wg.quadraticCurveTo(x + 10, y - 3, x + 22, y); wg.stroke(); }
    const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(6, 1); wt.encoding = THREE.sRGBEncoding;
    water = new THREE.Mesh(new THREE.PlaneGeometry(9.6, BANK * 2), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.2, metalness: 0.1, emissive: '#0E3442', emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.13; root.add(water);
    /* 楚河 漢界 carved into the floor beyond each end of the board, and a dais at each end */
    [['漢', 1, '#C48A5C'], ['楚', -1, '#7C88B0']].forEach(([ch, s, col]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), new THREE.MeshBasicMaterial({ map: glyphTexture(ch, col), transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = s > 0 ? 0 : Math.PI; m.position.set(0, -0.31, s * 7.6); root.add(m);
    });

    /* pillars, each with a torch; banners of the two armies hang on the pillars of their own side */
    const flame = new THREE.SpriteMaterial({ map: soft('rgba(255,190,110,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const pm = stoneM('#5A5460');
    [-8.5, -3, 3, 8.5].forEach(z => [-7.2, 7.2].forEach(x => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 11, 12), pm); col.position.set(x, 5.2, z); col.castShadow = true; col.receiveShadow = true; root.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), pm); cap.position.set(x, -0.15, z); root.add(cap);
      const tx = x - Math.sign(x) * 0.55;
      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.3, 6), stoneM('#2A2428')); holder.position.set(tx, 2.4, z); root.add(holder);
      const f = new THREE.Sprite(flame); f.scale.setScalar(0.7); f.position.set(tx, 2.7, z); root.add(f);
      const light = new THREE.PointLight('#FFA45C', 0.9, 9, 2); light.position.set(tx, 2.8, z); root.add(light);
      torches.push({ f, light, ph: rnd(0, 10) });
      if (Math.abs(z) > 5) {
        const red = z > 0, b = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.6), new THREE.MeshStandardMaterial({ map: glyphTexture(red ? '漢' : '楚', red ? '#F2D28A' : '#D8DEF2', red ? '#8A2A22' : '#1E2440'), roughness: 1, side: THREE.DoubleSide }));
        b.position.set(x - Math.sign(x) * 0.46, 4.6, z); b.rotation.y = -Math.sign(x) * Math.PI / 2; root.add(b);
      }
    }));
    /* dust drifting in the light */
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-7, 7); pos[i * 3 + 1] = rnd(0.2, 7); pos[i * 3 + 2] = rnd(-8, 8); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(pg, new THREE.PointsMaterial({ map: soft('rgba(255,240,220,1)'), size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    root.add(motes);
    return root;
  }

  /* ---------- effects ---------- */
  function glow(fig) { if (fig.userData.stone) fig.userData.stone.glow = 1; }

  const dustTex = () => dustTex.t || (dustTex.t = soft('rgba(190,175,160,0.9)'));
  function puff(x, y, z, n, spread, big) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex(), transparent: true, depthWrite: false, opacity: 0.6 }));
      const a = rnd(0, Math.PI * 2), sp = rnd(0.5, 1) * spread;
      s.position.set(x, y + rnd(0, 0.1), z); s.scale.setScalar(rnd(0.3, 0.5) * (big ? 1.4 : 1)); scene.add(s);
      live.push({ kind: 'dust', o: s, v: new THREE.Vector3(Math.cos(a) * sp, rnd(0.1, 0.5), Math.sin(a) * sp), age: 0, life: rnd(0.9, 1.6) });
    }
  }
  function thud(x, z, big) { if (scene) puff(x, 0.05, z, big ? 14 : 8, big ? 1.4 : 0.8, big); }

  const tmpBox = new THREE.Box3();
  function shatter(fig, dir) {
    if (!scene) return;
    tmpBox.setFromObject(fig);
    const mat = fig.userData.stone ? fig.userData.stone.body : null;
    const d = dir && dir.lengthSq() ? dir.clone().setY(0).normalize() : new THREE.Vector3();
    const size = tmpBox.getSize(new THREE.Vector3()), c = tmpBox.getCenter(new THREE.Vector3());
    for (let i = 0; i < 34; i++) {
      const r = rnd(0.05, 0.13), m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat);
      m.castShadow = true; m.position.set(c.x + rnd(-0.5, 0.5) * size.x, tmpBox.min.y + rnd(0.1, 1) * size.y, c.z + rnd(-0.5, 0.5) * size.z);
      m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); scene.add(m);
      const out = new THREE.Vector3(m.position.x - c.x, 0, m.position.z - c.z).normalize().multiplyScalar(rnd(0.6, 1.8)).addScaledVector(d, rnd(1.2, 2.6));
      live.push({ kind: 'chunk', o: m, r, v: new THREE.Vector3(out.x, rnd(1.5, 3.6), out.z), w: new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)), age: 0, life: 4.5 });
    }
    puff(c.x, 0.3, c.z, 18, 1.6, true);
  }

  let last = 0;
  function update(t) {
    const dt = Math.min(0.05, t - last); last = t;
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i]; L.age += dt;
      if (L.kind === 'chunk') {
        const o = L.o;
        if (L.age < L.life - 1) {
          L.v.y -= 9.8 * dt; o.position.addScaledVector(L.v, dt);
          o.rotation.x += L.w.x * dt; o.rotation.y += L.w.y * dt; o.rotation.z += L.w.z * dt;
          if (o.position.y < L.r * 0.7) {   /* bounce on the slab, losing most of the energy, then rest */
            o.position.y = L.r * 0.7; L.v.y = Math.abs(L.v.y) > 0.6 ? -L.v.y * 0.3 : 0; L.v.x *= 0.6; L.v.z *= 0.6; L.w.multiplyScalar(0.5);
          }
        } else o.position.y -= dt * 0.35;   /* the rubble sinks into the stone */
        if (L.age > L.life) { scene.remove(o); o.geometry.dispose(); live.splice(i, 1); }
      } else {
        const k = L.age / L.life; L.o.position.addScaledVector(L.v, dt); L.v.multiplyScalar(0.94);
        L.o.scale.setScalar(L.o.scale.x * (1 + dt * 0.9)); L.o.material.opacity = 0.6 * (1 - k);
        if (k >= 1) { scene.remove(L.o); L.o.material.dispose(); live.splice(i, 1); }
      }
    }
    torches.forEach(T => { const f = 1 + Math.sin(t * 9 + T.ph) * 0.08 + Math.sin(t * 23 + T.ph * 2) * 0.05; T.f.scale.setScalar(0.7 * f); T.light.intensity = 0.9 * f; });
    if (water) { water.material.map.offset.x = t * 0.03; }
    if (motes) { motes.rotation.y = t * 0.01; motes.position.y = Math.sin(t * 0.2) * 0.1; }
  }
  /* statues that woke up glow warm, fading back to stone */
  function updateFig(fig, dt) {
    const S = fig.userData.stone; if (!S || S.glow <= 0) return;
    S.glow = Math.max(0, S.glow - dt * 0.6);
    S.mats.forEach(m => { m.emissive.setRGB(0.55 * S.glow, 0.32 * S.glow, 0.1 * S.glow); });
  }

  window.XQStone = { figure, hall, glow, thud, shatter, update, updateFig, BADGE_Y };
})();
