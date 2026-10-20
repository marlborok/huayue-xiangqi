/* 花月象棋 — terrain sketch: the board as real land.
 * Flower kingdom (red, +z) is a sunny meadow; Moon kingdom (black, -z) is a dusk lavender land.
 * Rules kept: the play area stays flat at y=0 so every point reads clearly; only the river sinks;
 * anything tall stays outside the 9x10 grid.
 */
(function () {
  const BANK = 0.38;            /* river banks at z = ±0.38, between rank 4 (z=0.5) and rank 5 (z=-0.5) */
  const EDGE = 5.15;            /* play-area land reaches z = ±5.15, x = ±4.6 */
  const PX = 100;               /* canvas pixels per world unit */

  const SIDE = {
    r: { grass: '#A7D98A', grassDark: '#8CC673', path: '#97928C', pathEdge: '#5F5A55', pebble: '#C9C4BD', stone: '#ACA7A0', stoneEdge: '#6F6A64', court: '#F8D9E0', courtLine: '#E9B6C2', mark: '#FF8FB1', ground: '#9DD07F' },
    b: { grass: '#8A8FC4', grassDark: '#777CB5', path: '#8C8B9C', pathEdge: '#4F4D66', pebble: '#BDBBCC', stone: '#A3A2B4', stoneEdge: '#5E5C78', court: '#C8C6EC', courtLine: '#A9A5DA', mark: '#FFE38A', ground: '#8185BD' }
  };

  function M(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o || {})); }

  /* one textured half of the play area, drawn on a canvas: grass, paths on the grid lines, stepping stones on the points */
  function halfTexture(side, aniso) {
    const C = SIDE[side];
    const W = 9.2 * PX, H = (EDGE - BANK) * PX;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    /* canvas top = -z. red half spans z BANK..EDGE, black half spans z -EDGE..-BANK */
    const zTop = side === 'r' ? BANK : -EDGE;
    const X = x => (x + 4.6) * PX, Y = z => (z - zTop) * PX;
    const wx = f => f - 4, wz = r => 4.5 - r;
    const ranks = side === 'r' ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];

    g.fillStyle = C.grass; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { /* grass texture */
      g.strokeStyle = Math.random() < 0.5 ? C.grassDark : 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5;
      const x = Math.random() * W, y = Math.random() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 4 - 2, y - 6 - Math.random() * 6); g.stroke();
    }

    /* palace courtyard tiles */
    const pr = side === 'r' ? [0, 2] : [7, 9];
    const cx0 = X(wx(3)) - 26, cx1 = X(wx(5)) + 26, cz0 = Y(Math.min(wz(pr[0]), wz(pr[1]))) - 26, cz1 = Y(Math.max(wz(pr[0]), wz(pr[1]))) + 26;
    g.fillStyle = C.court; g.fillRect(cx0, cz0, cx1 - cx0, cz1 - cz0);
    g.strokeStyle = C.courtLine; g.lineWidth = 2;
    for (let x = cx0; x <= cx1; x += 25) { g.beginPath(); g.moveTo(x, cz0); g.lineTo(x, cz1); g.stroke(); }
    for (let y = cz0; y <= cz1; y += 25) { g.beginPath(); g.moveTo(cx0, y); g.lineTo(cx1, y); g.stroke(); }

    /* paths: a darker edge stroke, then the lighter path on top */
    const segs = [];
    ranks.forEach(r => segs.push([X(wx(0)), Y(wz(r)), X(wx(8)), Y(wz(r))]));
    for (let f = 0; f < 9; f++) {
      const zs = ranks.map(wz); const zNear = side === 'r' ? BANK : -BANK; /* extend to the river bank so the paths meet the ford stones */
      segs.push([X(wx(f)), Y(Math.min(...zs, zNear)), X(wx(f)), Y(Math.max(...zs, zNear))]);
    }
    segs.push([X(wx(3)), Y(wz(pr[0])), X(wx(5)), Y(wz(pr[1]))], [X(wx(5)), Y(wz(pr[0])), X(wx(3)), Y(wz(pr[1]))]);
    g.lineCap = 'round';
    /* grey roads: a dark kerb, then the road surface, so the grid reads clearly against the grass */
    [[28, C.pathEdge], [20, C.path]].forEach(([w, c]) => {
      g.lineWidth = w; g.strokeStyle = c;
      segs.forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); });
    });
    /* cobble specks on the roads */
    g.fillStyle = C.pebble; g.globalAlpha = 0.5;
    segs.forEach(([a, b, c2, d]) => { const n = Math.hypot(c2 - a, d - b) / 14; for (let i = 0; i < n; i++) { const t = Math.random(); g.beginPath(); g.arc(a + (c2 - a) * t + Math.random() * 8 - 4, b + (d - b) * t + Math.random() * 8 - 4, 1.6, 0, 7); g.fill(); } });
    g.globalAlpha = 1;

    /* stepping stones on every point: a quiet round paving just a shade lighter than the road */
    ranks.forEach(r => { for (let f = 0; f < 9; f++) {
      g.fillStyle = C.stone; g.strokeStyle = C.stoneEdge; g.lineWidth = 2.5;
      g.beginPath(); g.arc(X(wx(f)), Y(wz(r)), 18, 0, 7); g.fill(); g.stroke();
    } });

    /* cannon and pawn points: flowers on the meadow, little stars in the moon land */
    const marks = side === 'r' ? [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3]] : [[1, 7], [7, 7], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]];
    marks.forEach(([f, r]) => {
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
        if ((f === 0 && dx < 0) || (f === 8 && dx > 0)) return;
        const x = X(wx(f)) + dx * 38, y = Y(wz(r)) + dy * 38;
        if (side === 'r') {
          g.fillStyle = C.mark; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, 7); g.fill(); }
          g.fillStyle = '#FFE38A'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
        } else {
          g.fillStyle = C.mark; g.beginPath();
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 4 : 11; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.closePath(); g.fill();
        }
      });
    });
    const t = new THREE.CanvasTexture(cv); t.anisotropy = aniso; return t;
  }

  function waterTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#8FD3E6'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 40; i++) { const x = Math.random() * 256, y = Math.random() * 256, w = 14 + Math.random() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 1); return t;
  }

  function build(scene, aniso) {
    const root = new THREE.Group();
    const anim = [];
    const add = (m, x, y, z, shadow) => { m.position.set(x, y, z); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } root.add(m); return m; };
    const rand = (a, b) => a + Math.random() * (b - a);

    /* sky dome: warm day over the flower side, dusk over the moon side, sunset where they meet */
    const sky = new THREE.SphereGeometry(70, 32, 20);
    const cols = [], pos = sky.attributes.position, c = new THREE.Color();
    const day = new THREE.Color('#FFE6EC'), sunset = new THREE.Color('#F7B9A0'), dusk = new THREE.Color('#3A3F7A');
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
    anim.push(t => { starMat.opacity = 0.7 + Math.sin(t * 1.3) * 0.25; });

    /* lights: a soft cool fill from the moon side */
    const cool = new THREE.DirectionalLight('#A9B2FF', 0.28); cool.position.set(-4, 8, -10); root.add(cool);

    /* surrounding ground and the textured play areas */
    ['r', 'b'].forEach(side => {
      const s = side === 'r' ? 1 : -1;
      const big = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), M(SIDE[side].ground, { roughness: 1 }));
      big.rotation.x = -Math.PI / 2; add(big, 0, -0.01, s * (BANK + 15), false); big.receiveShadow = true;
      const play = new THREE.Mesh(new THREE.PlaneGeometry(9.2, EDGE - BANK), new THREE.MeshStandardMaterial({ map: halfTexture(side, aniso), roughness: 0.95 }));
      play.rotation.x = -Math.PI / 2; add(play, 0, 0.002, s * (BANK + EDGE) / 2, false); play.receiveShadow = true;
    });

    /* the river: sunken bed, moving water, earthen banks */
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(60, BANK * 2), M('#5F8F8A')); bed.rotation.x = -Math.PI / 2; add(bed, 0, -0.22, 0, false);
    const wt = waterTexture();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60, BANK * 2), new THREE.MeshStandardMaterial({ map: wt, transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2; add(water, 0, -0.1, 0, false);
    anim.push(t => { wt.offset.x = t * 0.04; wt.offset.y = Math.sin(t * 0.6) * 0.03; });
    [['r', 1, '#B98A5A'], ['b', -1, '#6E6496']].forEach(([, s, col]) => add(new THREE.Mesh(new THREE.BoxGeometry(60, 0.24, 0.05), M(col)), 0, -0.11, s * BANK));

    /* ford stones on every file: any piece can cross on its own file */
    const stoneMat = M('#ECE5D6', { roughness: 0.7 });
    for (let f = 0; f < 9; f++) [-0.14, 0.14].forEach(z => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 14), stoneMat);
      st.scale.set(rand(0.9, 1.2), 1, rand(0.85, 1.1)); add(st, f - 4 + rand(-0.04, 0.04), -0.07, z);
    });

    /* arched bridges and reeds, outside the board */
    [-6.6, 6.6].forEach(x => {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.11, 10, 24, Math.PI), M('#E9DCC6')); arch.rotation.y = Math.PI / 2; add(arch, x, -0.15, 0);
      [-0.22, 0.22].forEach(dx => { const rail = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 6, 24, Math.PI), M('#C8574E')); rail.rotation.y = Math.PI / 2; add(rail, x + dx, -0.05, 0); });
    });
    const reedMat = M('#6F9E5A');
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() < 0.5 ? -1 : 1) * rand(4.9, 12), z = (Math.random() < 0.5 ? -1 : 1) * rand(BANK - 0.05, BANK + 0.25);
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.03, rand(0.35, 0.6), 5), reedMat); add(reed, x, 0.15, z).rotation.z = rand(-0.2, 0.2);
    }

    /* borders: a flowering hedge for the flower kingdom, a low wall with lanterns for the moon kingdom */
    const hedge = M('#5E9E57'), wall = M('#8D89B8');
    [[1, hedge], [-1, wall]].forEach(([s, mat]) => {
      const h = s > 0 ? 0.24 : 0.18, zc = s * (BANK + EDGE + 0.12) / 2, len = EDGE - BANK + 0.12;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, h, len), mat), -4.78, h / 2, zc);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, h, len), mat), 4.78, h / 2, zc);
      add(new THREE.Mesh(new THREE.BoxGeometry(9.74, h, 0.18), mat), 0, h / 2, s * (EDGE + 0.06));
    });
    const blossom = M('#FF9EB4');
    for (let i = 0; i < 46; i++) {
      const e = Math.random();
      let x, z;
      if (e < 0.35) { x = -4.78; z = rand(BANK, EDGE); } else if (e < 0.7) { x = 4.78; z = rand(BANK, EDGE); } else { x = rand(-4.8, 4.8); z = EDGE + 0.06; }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), blossom), x + rand(-0.06, 0.06), 0.26, z + rand(-0.06, 0.06), false);
    }
    const lampGlow = new THREE.MeshStandardMaterial({ color: '#FFE9A8', emissive: '#FFD36B', emissiveIntensity: 1 });
    const lampPost = M('#5B5786');
    [[-4.78, -1.2], [-4.78, -3.2], [-4.78, -5.21], [4.78, -1.2], [4.78, -3.2], [4.78, -5.21], [-2.4, -5.21], [0, -5.21], [2.4, -5.21]].forEach(([x, z]) => {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 8), lampPost), x, 0.17, z);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), lampGlow), x, 0.38, z, false);
    });
    anim.push(t => { lampGlow.emissiveIntensity = 0.85 + Math.sin(t * 2.3) * 0.15; });

    /* flower kingdom scenery */
    const trunk = M('#8B5A3C'), petal = [M('#FFB7C8'), M('#FF9EB4'), M('#FFD1DC')];
    [[-7, 2.6], [7.2, 2.3], [-6.6, 6.8], [6.9, 7.2], [-3.4, 8.4], [3.6, 8.9], [-9.5, 5], [9.6, 4.8], [0.2, 11]].forEach(([x, z]) => {
      const sc = rand(0.85, 1.15);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.1 * sc, 0.16 * sc, 1.1 * sc, 8), trunk), x, 0.55 * sc, z);
      for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.SphereGeometry(rand(0.45, 0.65) * sc, 14, 10), petal[i % 3]), x + rand(-0.45, 0.45) * sc, (1.3 + rand(0, 0.45)) * sc, z + rand(-0.45, 0.45) * sc);
    });
    /* pavilion behind the flower palace */
    const pav = new THREE.Group();
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), M('#D9445C')); p.position.set(x, 0.45, z); p.castShadow = true; pav.add(p); });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.6, 4), M('#C8574E')); roof.rotation.y = Math.PI / 4; roof.position.y = 1.2; roof.castShadow = true; pav.add(roof);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 4), M('#F5E9CC')); floor.rotation.y = Math.PI / 4; floor.position.y = 0.05; pav.add(floor);
    pav.position.set(0, 0, 7.3); root.add(pav);

    /* moon kingdom scenery: hills, lavender, glowing mushrooms, an observatory */
    [[-8.5, -7, 3.2], [8.8, -6.6, 3.6], [0, -12, 5], [-12, -2.5, 2.4], [12, -3, 2.6]].forEach(([x, z, r]) => {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14), M('#646AA8', { roughness: 1 })); hill.scale.y = 0.35; add(hill, x, -0.1, z);
    });
    const lav = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.32, 5), M('#A58BE0'), 260);
    const dm = new THREE.Object3D(); let n = 0;
    [[-9, -5.4], [5.4, 9]].forEach(([x0, x1]) => {
      for (let row = 0; row < 6; row++) for (let i = 0; i < 22 && n < 260; i++) {
        dm.position.set(x0 + (x1 - x0) * (i / 21) + rand(-0.05, 0.05), 0.16, -1.2 - row * 0.7 + rand(-0.08, 0.08));
        dm.rotation.z = rand(-0.15, 0.15); dm.updateMatrix(); lav.setMatrixAt(n++, dm.matrix);
      }
    });
    lav.count = n; lav.castShadow = true; root.add(lav);
    const capGlow = new THREE.MeshStandardMaterial({ color: '#9FE3F5', emissive: '#58C6E8', emissiveIntensity: 0.8 });
    const capGlow2 = new THREE.MeshStandardMaterial({ color: '#E1C2FF', emissive: '#B07CF0', emissiveIntensity: 0.8 });
    [[-6, -2.2], [-6.4, -2.5], [6.2, -2], [5.9, -2.4], [-5.6, -6.6], [6.4, -7.2], [-2.6, -6.6], [2.8, -6.8]].forEach(([x, z], i) => {
      const s = rand(0.7, 1.2);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.22 * s, 8), M('#F1EEFF')), x, 0.11 * s, z);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? capGlow : capGlow2), x, 0.2 * s, z, false);
    });
    anim.push(t => { capGlow.emissiveIntensity = 0.7 + Math.sin(t * 1.7) * 0.2; capGlow2.emissiveIntensity = 0.7 + Math.cos(t * 1.4) * 0.2; });
    const obs = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.1, 20), M('#7A76AE')); tower.position.y = 0.55; tower.castShadow = true; obs.add(tower);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#D5D8E8', { metalness: 0.5, roughness: 0.35 })); dome.position.y = 1.1; dome.castShadow = true; obs.add(dome);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.9, 12), M('#C9A64B', { metalness: 0.6, roughness: 0.3 })); scope.position.set(0, 1.55, 0.25); scope.rotation.x = 0.7; obs.add(scope);
    obs.position.set(0, 0, -7.4); root.add(obs);

    /* drifting petals over the meadow, fireflies over the moon land */
    const petals = [], petalGeo = new THREE.PlaneGeometry(0.09, 0.07);
    const petalMat = new THREE.MeshBasicMaterial({ color: '#FFB7C8', side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
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
    const hills = root.children.filter(o => o.geometry && o.geometry.type === 'SphereGeometry' && o.scale.y === 0.35);
    const landmarks = [pav, obs, ...hills].map(obj => {
      const mats = [];
      obj.traverse(o => {
        if (!o.material) return;
        o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material);
      });
      const box = new THREE.Box3().setFromObject(obj), center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      return { center, radius, mats, o: 1 };
    });
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
      fog: new THREE.Fog('#E7D3DF', 34, 80),
      update(t, camera, target) { anim.forEach(fn => fn(t)); if (camera) fadeLandmarks(camera, target); }
    };
  }

  window.XQTerrain = { build };
})();
