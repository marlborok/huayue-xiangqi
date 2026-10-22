/* 花月象棋 — terrain: the board as real land, painted in the same watercolor picture-book style as the characters.
 * Flower kingdom (red, +z) is a sunny meadow; Moon kingdom (black, -z) is a dusk lavender land.
 * Rules kept: the play area stays flat at y=0 so every point reads clearly; only the river sinks;
 * anything tall stays outside the 9x10 grid.
 */
(function () {
  const BANK = 0.38;            /* river banks at z = ±0.38, between rank 4 (z=0.5) and rank 5 (z=-0.5) */
  const EDGE = 5.15;            /* play-area land reaches z = ±5.15, x = ±4.6 */
  const PX = 100;               /* canvas pixels per world unit */

  /* palette taken from the character illustrations: pale sage meadow and blush pinks by day, soft lavender by dusk */
  const SIDE = {
    r: { paper: '#FBF4E6', grass: '#CFE3A6', grassDeep: '#A9CC85', grassWarm: '#E6E2A4', path: '#ABA197', pathEdge: '#6A6058', stone: '#D9D2C8', stoneEdge: '#8C837A', court: '#F6D3DA', courtLine: '#DDA3B1', mark: '#F2A0B4', markMid: '#F7D27A', ground: '#C5DC9E' },
    b: { paper: '#EEEAF5', grass: '#AEACDA', grassDeep: '#8F8CC6', grassWarm: '#C4B6E2', path: '#9997B0', pathEdge: '#504D72', stone: '#CFCDDD', stoneEdge: '#77749A', court: '#D5D1F0', courtLine: '#A9A4D6', mark: '#F4DC8A', markMid: '#FFF3C4', ground: '#9F9DCF' }
  };

  /* matte everywhere: the picture-book look has no plastic sheen */
  function M(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, metalness: 0 }, o || {})); }

  /* ---------- watercolor painting helpers (canvas 2D) ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  /* one wash: an irregular blot, translucent, with the pigment pooling a little darker at its edge */
  function wash(g, x, y, r, color, alpha) {
    const n = 18, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rr = r * rnd(0.72, 1.12); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * rnd(0.8, 1)]); }
    g.beginPath(); g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    pts.forEach((p, i) => { const q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); });
    g.closePath(); g.fillStyle = color; g.globalAlpha = alpha; g.fill();
    g.strokeStyle = color; g.lineWidth = Math.max(1.5, r * 0.04); g.globalAlpha = Math.min(1, alpha * 1.4); g.stroke();
    g.globalAlpha = 1;
  }
  /* a hand-drawn line: slightly wobbly, laid down in a few light passes like a soft pencil */
  function pencil(g, x0, y0, x1, y1, color, width, passes) {
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(2, Math.round(len / 40)), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    for (let p = 0; p < passes; p++) {
      g.beginPath(); g.strokeStyle = color; g.lineWidth = width * rnd(0.8, 1.1); g.globalAlpha = rnd(0.45, 0.7);
      for (let i = 0; i <= steps; i++) { const t = i / steps, j = rnd(-1, 1) * width * 0.35; const x = x0 + (x1 - x0) * t + nx * j, y = y0 + (y1 - y0) * t + ny * j; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  /* paper tooth: faint speckle so washes read as pigment sitting on paper */
  function grain(g, W, H, n) {
    for (let i = 0; i < n; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(120,100,80,0.06)' : 'rgba(255,255,255,0.18)'; g.fillRect(Math.random() * W, Math.random() * H, rnd(1, 2.5), rnd(1, 2.5)); }
  }

  /* one textured half of the play area, painted on a canvas: a meadow wash, grey road washes on the grid lines
   * with a pencil line down their middle, soft round stones on the points */
  function halfTexture(side, aniso) {
    const C = SIDE[side];
    const W = 9.2 * PX, H = (EDGE - BANK) * PX;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    /* canvas top = -z. red half spans z BANK..EDGE, black half spans z -EDGE..-BANK */
    const zTop = side === 'r' ? BANK : -EDGE;
    const X = x => (x + 4.6) * PX, Y = z => (z - zTop) * PX;
    const wx = f => f - 4, wz = r => 4.5 - r;
    const ranks = side === 'r' ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];

    /* meadow: paper, then layered translucent washes of three greens (or lavenders) */
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    g.fillStyle = C.grass; g.globalAlpha = 0.75; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    for (let i = 0; i < 70; i++) wash(g, rnd(0, W), rnd(0, H), rnd(50, 140), [C.grass, C.grassDeep, C.grassWarm][i % 3], rnd(0.12, 0.28));
    for (let i = 0; i < 120; i++) wash(g, rnd(0, W), rnd(0, H), rnd(8, 22), i % 2 ? C.grassDeep : C.paper, rnd(0.1, 0.22));

    /* palace courtyard: a blush wash with faint pencil tiles */
    const pr = side === 'r' ? [0, 2] : [7, 9];
    const cx0 = X(wx(3)) - 30, cx1 = X(wx(5)) + 30, cz0 = Y(Math.min(wz(pr[0]), wz(pr[1]))) - 30, cz1 = Y(Math.max(wz(pr[0]), wz(pr[1]))) + 30;
    g.fillStyle = C.court; g.globalAlpha = 0.8; g.fillRect(cx0, cz0, cx1 - cx0, cz1 - cz0); g.globalAlpha = 1;
    for (let i = 0; i < 10; i++) wash(g, rnd(cx0, cx1), rnd(cz0, cz1), rnd(25, 60), C.court, 0.25);
    for (let x = cx0 + 25; x < cx1; x += 25) pencil(g, x, cz0, x, cz1, C.courtLine, 1.2, 1);
    for (let y = cz0 + 25; y < cz1; y += 25) pencil(g, cx0, y, cx1, y, C.courtLine, 1.2, 1);

    /* roads on the grid lines: a soft grey wash band, edged darker, with a pencil line down the middle so the grid stays crisp */
    const segs = [];
    ranks.forEach(r => segs.push([X(wx(0)), Y(wz(r)), X(wx(8)), Y(wz(r))]));
    for (let f = 0; f < 9; f++) {
      const zs = ranks.map(wz); const zNear = side === 'r' ? BANK : -BANK; /* extend to the river bank so the paths meet the ford stones */
      segs.push([X(wx(f)), Y(Math.min(...zs, zNear)), X(wx(f)), Y(Math.max(...zs, zNear))]);
    }
    segs.push([X(wx(3)), Y(wz(pr[0])), X(wx(5)), Y(wz(pr[1]))], [X(wx(5)), Y(wz(pr[0])), X(wx(3)), Y(wz(pr[1]))]);
    g.lineCap = 'round'; g.lineJoin = 'round';
    segs.forEach(([a, b, c2, d]) => pencil(g, a, b, c2, d, C.pathEdge, 27, 2));
    segs.forEach(([a, b, c2, d]) => pencil(g, a, b, c2, d, C.path, 20, 3));
    segs.forEach(([a, b, c2, d]) => pencil(g, a, b, c2, d, C.pathEdge, 3.2, 3));

    /* stones on every point: a pale round wash with a pencil ring */
    ranks.forEach(r => { for (let f = 0; f < 9; f++) {
      const x = X(wx(f)), y = Y(wz(r));
      wash(g, x, y, 17, C.stone, 0.95);
      g.strokeStyle = C.stoneEdge; g.globalAlpha = 0.7; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x + rnd(-1, 1), y + rnd(-1, 1), 17, 16, rnd(0, 3), 0, 7); g.stroke(); g.globalAlpha = 1;
    } });

    /* cannon and pawn points: watercolor blossoms on the meadow, little stars in the moon land */
    const marks = side === 'r' ? [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3]] : [[1, 7], [7, 7], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]];
    marks.forEach(([f, r]) => {
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
        if ((f === 0 && dx < 0) || (f === 8 && dx > 0)) return;
        const x = X(wx(f)) + dx * 38, y = Y(wz(r)) + dy * 38;
        if (side === 'r') {
          for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; wash(g, x + Math.cos(a) * 6, y + Math.sin(a) * 6, 6, C.mark, 0.8); }
          wash(g, x, y, 3.5, C.markMid, 0.95);
        } else {
          g.fillStyle = C.mark; g.globalAlpha = 0.85; g.beginPath();
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 4 : 11; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.closePath(); g.fill(); g.globalAlpha = 1; wash(g, x, y, 14, C.markMid, 0.18);
        }
      });
    });
    grain(g, W, H, 9000);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = aniso; return t;
  }

  /* the river: a blue wash with lighter streaks left as white paper, tiled along the river */
  function waterTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#B9E0E8'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30; i++) wash(g, rnd(0, 256), rnd(0, 256), rnd(20, 60), i % 2 ? '#9CCFDC' : '#CBE9EE', 0.3);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineCap = 'round';
    for (let i = 0; i < 34; i++) { const x = Math.random() * 256, y = Math.random() * 256, w = 14 + Math.random() * 26; g.lineWidth = rnd(1.5, 3.5); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke(); }
    grain(g, 256, 256, 600);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 1); return t;
  }

  /* the surrounding land: the same washes on a tiling canvas, so the ground outside the board is painted too */
  function groundTexture(side) {
    const C = SIDE[side];
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = C.ground; g.fillRect(0, 0, 512, 512);
    /* each wash is drawn at its tile neighbours too, so the edges wrap */
    for (let i = 0; i < 40; i++) {
      const x = rnd(0, 512), y = rnd(0, 512), r = rnd(40, 110), c = [C.grass, C.grassDeep, C.grassWarm][i % 3], a = rnd(0.12, 0.25);
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) wash(g, x + ox, y + oy, r, c, a);
    }
    grain(g, 512, 512, 2500);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3); return t;
  }

  function build(scene, aniso) {
    const root = new THREE.Group();
    const anim = [];
    const add = (m, x, y, z, shadow) => { m.position.set(x, y, z); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } root.add(m); return m; };
    const rand = (a, b) => a + Math.random() * (b - a);

    /* scenery as paper cutouts: the watercolor drawings in assets/paper/scene-*.webp standing upright and turning to face the camera.
     * size is { h } (height) or { w } (width); the other side follows the picture. They stay hidden until their picture loads.
     * o.soft: the drawing has a painted glow around it, kept translucent (no hard alpha cut, no depth write). */
    const cards = [], loader = new THREE.TextureLoader(), LEAN_BACK = 0.6;
    function cutout(name, size, x, z, o) {
      o = o || {};
      const pivot = new THREE.Group(); pivot.position.set(x, o.y || 0, z); root.add(pivot);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: o.soft ? 0.02 : 0.35, depthWrite: !o.soft, side: THREE.DoubleSide, toneMapped: false });
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.35 });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); card.castShadow = true; card.customDepthMaterial = depth; card.visible = false;
      pivot.add(card);
      loader.load(`assets/paper/${name}.webp`, t => {
        if (window.XQLook) t.encoding = THREE.sRGBEncoding;
        const a = t.image.width / t.image.height, h = size.h || size.w / a, w = size.w || size.h * a;
        card.scale.set(w, h, 1); card.position.y = h / 2;
        mat.map = depth.map = t; mat.needsUpdate = depth.needsUpdate = true; card.visible = true;
      });
      const r = o.landmark || 1;
      pivot.userData = { mat, center: new THREE.Vector3(x, r * 0.5, z), radius: r, lean: o.lean === undefined ? LEAN_BACK : o.lean };
      cards.push(pivot);
      return pivot;
    }
    /* face the camera, and lean back part of the way toward a high camera (base stays put) so they are not seen squashed from above;
     * the wide low hills lean less (o.lean), otherwise they tip over into floating shapes at the top of the view */
    const face = camera => cards.forEach(c => {
      const dx = camera.position.x - c.position.x, dz = camera.position.z - c.position.z, dy = camera.position.y - c.position.y;
      c.rotation.set(-Math.max(0, Math.atan2(dy, Math.hypot(dx, dz))) * c.userData.lean, Math.atan2(dx, dz), 0, 'YXZ');
    });

    /* sky dome: warm day over the flower side, dusk over the moon side, sunset where they meet */
    const sky = new THREE.SphereGeometry(70, 32, 20);
    const cols = [], pos = sky.attributes.position, c = new THREE.Color();
    const day = new THREE.Color('#FDF0E8'), sunset = new THREE.Color('#F6CDB8'), dusk = new THREE.Color('#5A5C98');
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) / 70;
      if (z > 0) c.copy(sunset).lerp(day, Math.min(1, z * 2.2)); else c.copy(sunset).lerp(dusk, Math.min(1, -z * 2.2));
      cols.push(c.r, c.g, c.b);
    }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    root.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

    /* stars over the moon side */
    const sp = [];
    for (let i = 0; i < 260; i++) { const th = rand(0, Math.PI), ph = rand(0.15, 1.3); sp.push(Math.cos(th) * Math.sin(ph) * 65, Math.cos(ph) * 65, -Math.abs(Math.sin(th) * Math.sin(ph) * 65) - 5); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const starMat = new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.35, transparent: true, opacity: 0.9, fog: false });
    root.add(new THREE.Points(sg, starMat));

    /* painted horizons: a wide watercolor landscape hung on a curved backdrop just past the edge of the land,
     * the spring garden behind the flower kingdom and the moonlit hills behind the moon kingdom.
     * The picture fades out at its sides and top so it melts into the sky dome. */
    function backdrop(name, s) {
      const R = 24, ARC = Math.PI * 0.72;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 48, 1, true, (s > 0 ? 0 : Math.PI) - ARC / 2, ARC), mat);
      mesh.visible = false; mesh.renderOrder = -1; root.add(mesh);
      new THREE.TextureLoader().load(`assets/paper/${name}.jpg`, t => {
        const img = t.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
        /* the cylinder is seen from inside, so mirror the picture to read the right way round */
        const flip = document.createElement('canvas'); flip.width = cv.width; flip.height = cv.height;
        const f = flip.getContext('2d'); f.translate(cv.width, 0); f.scale(-1, 1); f.drawImage(cv, 0, 0);
        f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'destination-in';
        const gx = f.createLinearGradient(0, 0, cv.width, 0);
        gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.14, '#000'); gx.addColorStop(0.86, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = gx; f.fillRect(0, 0, cv.width, cv.height);
        const gy = f.createLinearGradient(0, 0, 0, cv.height);
        gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.25, '#000'); gy.addColorStop(1, '#000');
        f.fillStyle = gy; f.fillRect(0, 0, cv.width, cv.height);
        const tex = new THREE.CanvasTexture(flip); if (window.XQLook) tex.encoding = THREE.sRGBEncoding;
        const H = R * ARC / (img.width / img.height);
        mesh.scale.y = H; mesh.position.y = H / 2 - 1;
        mat.map = tex; mat.needsUpdate = true; mesh.visible = true;
      });
    }
    backdrop('sky-flower', 1); backdrop('sky-moon', -1);
    anim.push(t => { starMat.opacity = 0.7 + Math.sin(t * 1.3) * 0.25; });

    /* lights: a soft cool fill from the moon side */
    const cool = new THREE.DirectionalLight('#A9B2FF', 0.28); cool.position.set(-4, 8, -10); root.add(cool);

    /* surrounding ground and the textured play areas */
    ['r', 'b'].forEach(side => {
      const s = side === 'r' ? 1 : -1;
      const big = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ map: groundTexture(side), roughness: 1 }));
      big.rotation.x = -Math.PI / 2; add(big, 0, -0.01, s * (BANK + 15), false); big.receiveShadow = true;
      const play = new THREE.Mesh(new THREE.PlaneGeometry(9.2, EDGE - BANK), new THREE.MeshStandardMaterial({ map: halfTexture(side, aniso), roughness: 1 }));
      play.rotation.x = -Math.PI / 2; add(play, 0, 0.002, s * (BANK + EDGE) / 2, false); play.receiveShadow = true;
    });

    /* the river: sunken bed, moving water, earthen banks */
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(60, BANK * 2), M('#8DB8B5')); bed.rotation.x = -Math.PI / 2; add(bed, 0, -0.22, 0, false);
    const wt = waterTexture();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60, BANK * 2), new THREE.MeshStandardMaterial({ map: wt, transparent: true, opacity: 0.9, roughness: 0.6 }));
    water.rotation.x = -Math.PI / 2; add(water, 0, -0.1, 0, false);
    anim.push(t => { wt.offset.x = t * 0.04; wt.offset.y = Math.sin(t * 0.6) * 0.03; });
    [['r', 1, '#C9A880'], ['b', -1, '#8C84B4']].forEach(([, s, col]) => add(new THREE.Mesh(new THREE.BoxGeometry(60, 0.24, 0.05), M(col)), 0, -0.11, s * BANK));

    /* ford stones on every file: any piece can cross on its own file */
    const stoneMat = M('#F1EADD');
    for (let f = 0; f < 9; f++) [-0.14, 0.14].forEach(z => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 14), stoneMat);
      st.scale.set(rand(0.9, 1.2), 1, rand(0.85, 1.1)); add(st, f - 4 + rand(-0.04, 0.04), -0.07, z);
    });

    /* arched bridges over the river, outside the board, and reeds */
    [-6.6, 6.6].forEach(x => cutout('scene-flower-bridge', { w: 1.9 }, x, 0, { y: -0.12 }));
    const reedMat = M('#9DBE84');
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() < 0.5 ? -1 : 1) * rand(4.9, 12), z = (Math.random() < 0.5 ? -1 : 1) * rand(BANK - 0.05, BANK + 0.25);
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.03, rand(0.35, 0.6), 5), reedMat); add(reed, x, 0.15, z).rotation.z = rand(-0.2, 0.2);
    }

    /* borders: a flowering hedge for the flower kingdom, a low wall with lanterns for the moon kingdom */
    const hedge = M('#9BC487'), wall = M('#A9A5D2');
    [[1, hedge], [-1, wall]].forEach(([s, mat]) => {
      const h = s > 0 ? 0.24 : 0.18, zc = s * (BANK + EDGE + 0.12) / 2, len = EDGE - BANK + 0.12;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, h, len), mat), -4.78, h / 2, zc);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, h, len), mat), 4.78, h / 2, zc);
      add(new THREE.Mesh(new THREE.BoxGeometry(9.74, h, 0.18), mat), 0, h / 2, s * (EDGE + 0.06));
    });
    const blossom = M('#F4AFC0');
    for (let i = 0; i < 46; i++) {
      const e = Math.random();
      let x, z;
      if (e < 0.35) { x = -4.78; z = rand(BANK, EDGE); } else if (e < 0.7) { x = 4.78; z = rand(BANK, EDGE); } else { x = rand(-4.8, 4.8); z = EDGE + 0.06; }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), blossom), x + rand(-0.06, 0.06), 0.26, z + rand(-0.06, 0.06), false);
    }
    [[-4.78, -1.2], [-4.78, -3.2], [-4.78, -5.21], [4.78, -1.2], [4.78, -3.2], [4.78, -5.21], [-2.4, -5.21], [0, -5.21], [2.4, -5.21]]
      .forEach(([x, z]) => cutout('scene-moon-lantern', { h: 0.62 }, x, z));

    /* flower kingdom scenery: cherry trees (two drawings), flower bushes, the pavilion behind the palace */
    [[-7, 2.6], [7.2, 2.3], [-6.6, 6.8], [6.9, 7.2], [-3.4, 8.4], [3.6, 8.9], [-9.5, 5], [9.6, 4.8], [0.2, 11]].forEach(([x, z], i) =>
      cutout(i % 2 ? 'scene-flower-tree2' : 'scene-flower-tree', { h: rand(2.2, 2.7) }, x, z));
    [[-5.6, 1.4], [5.7, 1.2], [-5.4, 4.6], [5.5, 5.4], [-1.8, 6.6], [1.9, 6.4], [-8.2, 8.6], [8.4, 9]].forEach(([x, z]) =>
      cutout('scene-flower-bush', { h: rand(0.6, 0.85) }, x, z));
    const pav = cutout('scene-flower-pavilion', { h: 2.1 }, 0, 7.3, { landmark: 2.4 });

    /* moon kingdom scenery: hills, lavender, glowing mushrooms, an observatory */
    const hills = [[-8.5, -7, 3.2], [8.8, -6.6, 3.6], [0, -12, 5], [-12, -2.5, 2.4], [12, -3, 2.6]]
      .map(([x, z, r]) => cutout('scene-moon-hill', { w: r * 1.9 }, x, z, { landmark: r, lean: 0.2, y: -0.25 }));
    /* lavender fields beside the moon palace: staggered rows of painted clumps */
    [[-9, -5.6], [5.6, 9]].forEach(([x0, x1]) => {
      for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) {
        const x = x0 + (x1 - x0) * ((i + (row % 2) * 0.5) / 3) + rand(-0.15, 0.15);
        cutout('scene-moon-lavender', { h: rand(0.7, 0.9) }, x, -1.4 - row * 1.0 + rand(-0.15, 0.15), { soft: true });
      }
    });
    [[-6.2, -2.3], [6.1, -2.2], [-5.6, -6.6], [6.4, -7.2], [-2.6, -6.6], [2.8, -6.8]].forEach(([x, z]) =>
      cutout('scene-moon-mushrooms', { h: rand(0.45, 0.65) }, x, z));
    const obs = cutout('scene-moon-observatory', { h: 2.2 }, 0, -7.4, { landmark: 2.4 });

    /* drifting petals over the meadow, fireflies over the moon land */
    const petals = [], petalGeo = new THREE.PlaneGeometry(0.09, 0.07);
    const petalMat = new THREE.MeshBasicMaterial({ color: '#F7C2CF', side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 28; i++) { const p = new THREE.Mesh(petalGeo, petalMat); p.position.set(rand(-9, 9), rand(0, 5), rand(0.6, 10)); p.userData = { s: rand(0.25, 0.5), w: rand(0, 6) }; root.add(p); petals.push(p); }
    const flies = [], flyMat = new THREE.MeshBasicMaterial({ color: '#FFF3A8', transparent: true, opacity: 0.9 });
    for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), flyMat); const b = new THREE.Vector3(rand(-9, 9), rand(0.4, 2.2), rand(-10, -0.8)); if (Math.abs(b.x) < 4.9 && b.z > -5.3) b.x = (b.x < 0 ? -1 : 1) * rand(5, 9); f.userData = { b, w: rand(0, 6) }; root.add(f); flies.push(f); }
    let last = 0;
    anim.push(t => {
      const dt = Math.min(0.05, t - last); last = t;
      petals.forEach(p => { const u = p.userData; p.position.y -= u.s * dt; p.position.x += Math.sin(t + u.w) * 0.15 * dt; p.rotation.x += dt * 1.5; p.rotation.y += dt; if (p.position.y < 0) p.position.y = 5; });
      flies.forEach(f => { const u = f.userData; f.position.set(u.b.x + Math.sin(t * 0.7 + u.w) * 0.4, u.b.y + Math.sin(t * 1.1 + u.w) * 0.25, u.b.z + Math.cos(t * 0.5 + u.w) * 0.4); });
      flyMat.opacity = 0.6 + Math.sin(t * 3) * 0.3;
    });

    /* landmarks that can stand between a low camera and the board: they fade out while they block the view */
    const landmarks = [pav, obs, ...hills].map(c => ({ center: c.userData.center, radius: c.userData.radius, mats: [c.userData.mat], o: 1 }));
    const seg = new THREE.Line3(), closest = new THREE.Vector3();
    function fadeLandmarks(camera, target) {
      seg.set(camera.position, target);
      landmarks.forEach(L => {
        seg.closestPointToPoint(L.center, true, closest);
        const blocking = closest.distanceTo(L.center) < L.radius * 0.9 && camera.position.distanceTo(L.center) < camera.position.distanceTo(target);
        const want = blocking ? 0.18 : 1;
        L.o += (want - L.o) * 0.15;
        L.mats.forEach(m => { m.opacity = L.o; m.depthWrite = L.o > 0.95; });
      });
    }

    scene.add(root);
    return {
      root,
      fog: new THREE.Fog('#EFE2E4', 30, 80),
      update(t, camera, target) { anim.forEach(fn => fn(t)); if (camera) { face(camera); fadeLandmarks(camera, target); } }
    };
  }

  window.XQTerrain = { build };
})();
