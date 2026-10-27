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
 * Statues are stone golems after the character designs (docs/石棋角色設計.md), built from rough rock blocks in code:
 * a glowing core shows through the seams, and a captured statue breaks apart along those same blocks.
 */
(function () {
  /* the two armies, after the character designs in docs/石棋角色設計.md:
   * 楚 dark slate with crimson glowing seams and crimson cloth; 漢 warm sandstone with gold seams and royal blue cloth */
  const ARMY = {
    b: { rock: '#4E586E', rockDark: '#363D4E', glow: '#FF2E3E', cloth: '#A81F2E', trim: '#D9A441', eye: '#FF4050' },
    r: { rock: '#C8925A', rockDark: '#9C6C3E', glow: '#FFC23A', cloth: '#2A4FB0', trim: '#E6B84E', eye: '#FFD45A' }
  };
  const BADGE_Y = { K: 2.0, A: 1.55, B: 1.6, R: 1.7, N: 1.8, C: 1.55, P: 1.45 };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function mats(side) {
    const C = ARMY[side];
    const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, metalness: 0, flatShading: true }, o || {}));
    return {
      rock: std(C.rock), rockDark: std(C.rockDark),
      glow: new THREE.MeshStandardMaterial({ color: C.glow, emissive: C.glow, emissiveIntensity: 0.9, roughness: 0.6 }),   /* the molten core between the rocks */
      eye: new THREE.MeshBasicMaterial({ color: C.eye }),
      cloth: std(C.cloth, { roughness: 0.8, side: THREE.DoubleSide, flatShading: false }),
      trim: std(C.trim, { roughness: 0.45, metalness: 0.5 }),
      metal: std('#8E949C', { roughness: 0.5, metalness: 0.6 }),
      wood: std('#6B4A30'), black: std('#25232A'), ivory: std('#EDE3CC', { roughness: 0.6 }),
      plinth: std('#6E6A72'), beard: std(side === 'b' ? '#C9CCD6' : '#6A4A2E')
    };
  }
  const put = (p, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh); return mesh; };
  const cyl = (rt, rb, h, m, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), m);
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const ball = (r, m, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg || 10, Math.max(6, (seg || 10) - 3)), m);
  const cone = (r, h, m, seg) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 8), m);
  const lathe = (pts, m, seg) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg || 14), m);
  /* a rough block of stone: a box whose corners are nudged so no two look alike; it is one of the pieces a statue breaks into */
  function rock(w, h, d, m) {
    const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, seen = {};
    for (let i = 0; i < p.count; i++) {
      const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(4)).join();
      seen[k] = seen[k] || [rnd(-0.12, 0.12) * w, rnd(-0.1, 0.1) * h, rnd(-0.12, 0.12) * d];
      p.setXYZ(i, p.getX(i) + seen[k][0], p.getY(i) + seen[k][1], p.getZ(i) + seen[k][2]);
    }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m); mesh.userData.block = true; return mesh;
  }
  const R = (g, M, w, h, d, x, y, z, dark) => put(g, rock(w, h, d, dark ? M.rockDark : M.rock), x, y, z);

  /* ---------- the golem body ----------
   * Stacked rocks around a glowing core, so the seams between them shine. Short thick legs, a heavy chest,
   * huge shoulders and fists, a small head sunk between the shoulders. Returns anchor points for gear. */
  function golem(M, o) {
    const g = new THREE.Group(); o = o || {};
    [-1, 1].forEach(s => {
      R(g, M, 0.17, 0.16, 0.19, s * 0.12, 0.09, 0, true);           /* feet */
      R(g, M, 0.16, 0.17, 0.16, s * 0.12, 0.26, 0);                 /* legs */
    });
    put(g, box(0.34, 0.5, 0.22, M.glow), 0, 0.66, 0);               /* the glowing core */
    R(g, M, 0.36, 0.13, 0.25, 0, 0.42, 0, true);                    /* hips */
    [-1, 1].forEach(s => {
      R(g, M, 0.19, 0.17, 0.25, s * 0.1, 0.57, 0.01);               /* belly */
      R(g, M, 0.23, 0.22, 0.28, s * 0.125, 0.77, 0.01);             /* chest */
      R(g, M, 0.29, 0.25, 0.29, s * 0.355, 0.9, 0, true);           /* the great shoulders */
      R(g, M, 0.16, 0.17, 0.17, s * 0.39, 0.7, 0.01);               /* upper arm */
      R(g, M, 0.2, 0.19, 0.2, s * 0.41, 0.52, 0.03);                /* forearm */
      R(g, M, 0.23, 0.2, 0.22, s * 0.42, 0.33, 0.06, true);         /* fist */
    });
    const head = new THREE.Group(); head.position.set(0, 1.0, 0.03); g.add(head);
    if (o.face !== false) face(head, M, o);
    if (o.cape) cape(g, M, o.cape);
    return { g, head, hand: [new THREE.Vector3(0.42, 0.33, 0.12), new THREE.Vector3(-0.42, 0.33, 0.12)], top: 1.12 };
  }
  /* a carved face: smooth stone, a strong brow and jaw, glowing eyes; a beard when asked */
  function face(head, M, o) {
    put(head, box(0.17, 0.19, 0.17, M.rock), 0, 0, 0);
    put(head, box(0.15, 0.045, 0.04, M.rockDark), 0, 0.035, 0.08);   /* brow */
    put(head, box(0.04, 0.06, 0.04, M.rock), 0, -0.01, 0.095);       /* nose */
    put(head, box(0.13, 0.05, 0.03, M.rock), 0, -0.075, 0.08);       /* jaw */
    [-1, 1].forEach(s => put(head, box(0.04, 0.016, 0.012, M.eye), s * 0.04, 0.01, 0.088));
    if (o.beard === 'long') put(head, cone(0.06, 0.2, M.beard, 6), 0, -0.17, 0.07).rotation.x = Math.PI;
    else if (o.beard) put(head, box(0.1, 0.05, 0.03, M.beard), 0, -0.09, 0.09);
  }
  /* a cloth cape hanging from the shoulders, curved round the back */
  function cape(g, M, len) {
    const geo = new THREE.PlaneGeometry(0.78, len, 6, 6), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.cos(x * 3.2) * 0.1 - (len / 2 - y) * 0.12 + Math.sin(y * 9 + x * 4) * 0.012); }
    geo.computeVertexNormals();
    put(g, new THREE.Mesh(geo, M.cloth), 0, 1.0 - len / 2, -0.2);
  }

  /* ---------- helmets and crowns ---------- */
  function scaleHelmet(head, M, plume, crown) {
    const dome = put(head, new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.metal), 0, 0.05, -0.01);
    dome.scale.set(1, 1.1, 1.05);
    [-1, 1].forEach(s => put(head, box(0.03, 0.14, 0.12, M.metal), s * 0.1, -0.02, -0.01));   /* cheek and neck guards */
    put(head, box(0.2, 0.035, 0.04, crown ? M.trim : M.metal), 0, 0.07, 0.085);
    if (crown) put(head, ball(0.022, M.glow), 0, 0.075, 0.108);   /* the red gem */
    if (plume) { const pl = put(head, cone(0.035, plume, M.cloth, 6), 0, 0.17 + plume / 2, -0.03); pl.rotation.x = -0.25; }
  }
  function hornedHelmet(head, M) {
    scaleHelmet(head, M, 0);
    [-1, 1].forEach(s => { const h = put(head, cone(0.025, 0.16, M.black, 6), s * 0.1, 0.16, 0); h.rotation.z = -s * 0.6; });
  }
  function mianCrown(head, M) {   /* 劉邦: the flat-topped 冕 with strings of jade beads */
    put(head, cyl(0.07, 0.08, 0.08, M.black), 0, 0.12, 0);
    put(head, box(0.32, 0.025, 0.22, M.black), 0, 0.17, 0).rotation.x = -0.08;
    put(head, box(0.33, 0.012, 0.23, M.trim), 0, 0.185, 0).rotation.x = -0.08;
    const jade = new THREE.MeshStandardMaterial({ color: '#5FA77A', roughness: 0.4 });
    for (let i = -3; i <= 3; i++) [0.11, -0.11].forEach(z => {
      for (let k = 0; k < 4; k++) put(head, ball(0.011, jade, 6), i * 0.045, 0.15 - k * 0.028, z + (z > 0 ? 0.01 : -0.01));
    });
  }
  function scholarCap(head, M, tall) { put(head, box(0.1, tall || 0.14, 0.12, M.black), 0, 0.14, -0.01); put(head, box(0.2, 0.012, 0.012, M.black), 0, 0.13, -0.01); }

  /* ---------- weapons ---------- */
  function pole(g, M, at, len, top) {
    put(g, cyl(0.02, 0.02, len, M.wood, 6), at.x, at.y + len * 0.42, at.z);
    const y = at.y + len * 0.92;
    if (top === 'halberd') {   /* 項羽's great halberd: a broad blade with a gold edge */
      put(g, box(0.035, 0.36, 0.2, M.metal), at.x, y, at.z + 0.1);
      put(g, box(0.04, 0.38, 0.025, M.trim), at.x, y, at.z + 0.2);
      put(g, box(0.05, 0.08, 0.06, M.glow), at.x, y - 0.12, at.z + 0.04);
    } else if (top === 'glaive') {
      const b = put(g, box(0.03, 0.34, 0.1, M.metal), at.x, y, at.z + 0.05); b.rotation.x = 0.15;
    } else if (top === 'ji') {
      put(g, cone(0.03, 0.16, M.metal, 6), at.x, y + 0.08, at.z);
      put(g, box(0.02, 0.07, 0.13, M.metal), at.x, y - 0.03, at.z + 0.07);
    } else if (top === 'ge') {
      put(g, box(0.02, 0.05, 0.18, M.metal), at.x, y, at.z + 0.09);
    } else if (top === 'sceptre') {
      put(g, ball(0.05, M.trim), at.x, y, at.z); put(g, cone(0.04, 0.09, M.trim, 6), at.x, y + 0.07, at.z);
    } else put(g, cone(0.03, 0.16, M.metal, 6), at.x, y + 0.08, at.z);   /* spear */
  }
  function shield(g, M, at, round) {
    const s = round ? cyl(0.17, 0.17, 0.035, M.black, 16) : box(0.26, 0.34, 0.035, M.trim);
    if (round) s.rotation.x = Math.PI / 2;
    put(g, s, at.x - 0.02, at.y + 0.1, at.z + 0.1);
    put(g, round ? ball(0.05, M.glow) : box(0.1, 0.1, 0.02, M.glow), at.x - 0.02, at.y + 0.1, at.z + 0.13);
  }

  /* ---------- the officials: a normal build, long robes, only a few stone pieces ---------- */
  function official(M, o) {
    const g = new THREE.Group();
    put(g, lathe([[0.2, 0], [0.22, 0.04], [0.17, 0.35], [0.14, 0.7], [0.13, 0.78]], M.cloth), 0, 0, 0);   /* the long robe */
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 4, 14), M.trim); sash.rotation.x = Math.PI / 2; put(g, sash, 0, 0.5, 0);
    put(g, box(0.1, 0.3, 0.02, M.trim), 0, 0.33, 0.16);   /* the front panel */
    [-1, 1].forEach(s => {
      R(g, M, 0.13, 0.1, 0.15, s * 0.17, 0.78, 0);                                   /* stone shoulder pieces */
      const sl = put(g, cyl(0.06, 0.1, 0.32, M.cloth), s * 0.2, 0.6, 0.04); sl.rotation.z = s * 0.15;   /* wide sleeves */
      R(g, M, 0.07, 0.07, 0.07, s * 0.2, 0.43, 0.09);                                /* stone hands */
    });
    const head = new THREE.Group(); head.position.set(0, 0.92, 0.01); head.scale.setScalar(0.9); g.add(head);
    face(head, M, o);
    return { g, head, hand: [new THREE.Vector3(0.2, 0.43, 0.09), new THREE.Vector3(-0.2, 0.43, 0.09)] };
  }

  /* ---------- mounts and machines ---------- */
  function horse(M, black) {
    const g = new THREE.Group(), dark = black ? M.black : M.rockDark, body = black ? M.black : M.rock;
    put(g, box(0.3, 0.3, 0.6, M.glow), 0, 0.52, 0);   /* glowing core between the blocks */
    put(g, rock(0.32, 0.28, 0.32, body), 0, 0.54, 0.15); put(g, rock(0.3, 0.27, 0.3, body), 0, 0.52, -0.17);
    const neck = put(g, rock(0.15, 0.32, 0.17, body), 0, 0.78, 0.32); neck.rotation.x = 0.5;
    const hd = put(g, rock(0.13, 0.14, 0.3, body), 0, 0.92, 0.46); hd.rotation.x = 0.35;
    [-1, 1].forEach(s => { put(g, box(0.03, 0.012, 0.01, M.eye), s * 0.07, 0.96, 0.45); put(g, cone(0.025, 0.07, dark, 4), s * 0.04, 1.03, 0.38); });
    [[0.1, 0.22], [-0.1, 0.22], [0.1, -0.22], [-0.1, -0.22]].forEach(([x, z]) => {
      put(g, rock(0.1, 0.2, 0.1, body), x, 0.29, z); put(g, rock(0.1, 0.18, 0.1, dark), x, 0.1, z);
    });
    const mane = put(g, box(0.05, 0.12, 0.34, black ? M.glow : M.cloth), 0, 0.88, 0.25); mane.rotation.x = 0.5;   /* 烏騅's mane burns crimson */
    const tail = put(g, box(0.05, 0.3, 0.06, black ? M.glow : dark), 0, 0.5, -0.38); tail.rotation.x = -0.4;
    put(g, box(0.36, 0.05, 0.3, M.cloth), 0, 0.69, -0.02);   /* saddle cloth */
    return g;
  }
  function chariot(M) {
    const g = new THREE.Group();
    put(g, rock(0.44, 0.08, 0.32, M.rockDark), 0, 0.3, 0);
    [-1, 1].forEach(s => put(g, rock(0.04, 0.18, 0.32, M.rock), s * 0.22, 0.42, 0));
    [-1, 1].forEach(s => {
      const w = new THREE.Group(); w.position.set(s * 0.28, 0.27, 0); w.rotation.y = Math.PI / 2; g.add(w);
      put(w, new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 5, 16), M.rockDark), 0, 0, 0);
      for (let i = 0; i < 4; i++) put(w, box(0.025, 0.48, 0.025, M.wood), 0, 0, 0).rotation.z = i * Math.PI / 4;
      put(w, cone(0.04, 0.1, M.trim, 6), 0, 0, 0.06).rotation.x = Math.PI / 2;   /* hub spike */
    });
    put(g, cyl(0.012, 0.012, 0.9, M.wood, 4), -0.2, 0.75, -0.1);   /* banner pole */
    put(g, box(0.02, 0.26, 0.2, M.cloth), -0.2, 1.05, 0);
    return g;
  }
  function trebuchet(M, beast) {
    const g = new THREE.Group();
    [-1, 1].forEach(s => {
      put(g, rock(0.07, 0.07, 0.62, M.rockDark), s * 0.2, 0.08, 0);
      [-1, 1].forEach(d => { const l = put(g, rock(0.07, 0.68, 0.07, M.rock), s * 0.2, 0.4, d * 0.13); l.rotation.x = -d * 0.38; });
    });
    put(g, cyl(0.03, 0.03, 0.5, M.trim, 6), 0, 0.72, 0).rotation.z = Math.PI / 2;
    const arm = new THREE.Group(); arm.position.set(0, 0.72, 0); arm.rotation.x = -0.85; g.add(arm);
    put(arm, rock(0.07, 1.0, 0.07, M.rock), 0, 0.22, 0);
    const cw = put(arm, rock(0.2, 0.18, 0.2, M.rockDark), 0, -0.24, 0);
    if (beast) [-1, 1].forEach(s => put(arm, box(0.03, 0.015, 0.01, M.eye), s * 0.05, -0.22, 0.105));   /* 楚: the counterweight is a snarling beast */
    put(arm, ball(0.08, M.glow), 0, 0.76, 0.02);   /* the glowing boulder in its sling */
    put(g, cyl(0.012, 0.012, 0.6, M.wood, 4), -0.26, 0.55, 0.2); put(g, box(0.02, 0.16, 0.14, M.cloth), -0.26, 0.78, 0.26);
    return g;
  }
  function elephant(M) {
    const g = new THREE.Group();
    put(g, box(0.4, 0.38, 0.6, M.glow), 0, 0.62, -0.02);
    put(g, rock(0.46, 0.42, 0.36, M.rock), 0, 0.64, 0.13); put(g, rock(0.44, 0.4, 0.34, M.rock), 0, 0.62, -0.2);
    const hd = put(g, rock(0.32, 0.3, 0.24, M.rock), 0, 0.82, 0.38);
    [-1, 1].forEach(s => { const ear = put(g, rock(0.04, 0.24, 0.2, M.rockDark), s * 0.2, 0.84, 0.32); ear.rotation.y = s * 0.4; });
    put(g, box(0.3, 0.12, 0.06, M.cloth), 0, 0.92, 0.5);   /* armoured head plate */
    put(g, box(0.06, 0.04, 0.02, M.trim), 0, 0.95, 0.535);
    [-1, 1].forEach(s => put(g, box(0.04, 0.015, 0.01, M.eye), s * 0.09, 0.85, 0.505));
    for (let i = 0; i < 4; i++) put(g, rock(0.1 - i * 0.012, 0.1, 0.1, M.rock), 0, 0.7 - i * 0.12, 0.55 + i * 0.03);   /* trunk */
    [-1, 1].forEach(s => { const t = put(g, cone(0.035, 0.32, M.ivory, 6), s * 0.11, 0.66, 0.6); t.rotation.x = 1.75; });
    [[0.15, 0.2], [-0.15, 0.2], [0.15, -0.25], [-0.15, -0.25]].forEach(([x, z]) => {
      put(g, rock(0.15, 0.24, 0.15, M.rock), x, 0.32, z); put(g, rock(0.16, 0.2, 0.16, M.rockDark), x, 0.11, z);
    });
    put(g, box(0.5, 0.05, 0.5, M.cloth), 0, 0.86, -0.06);
    put(g, box(0.28, 0.2, 0.28, M.black), 0, 0.99, -0.08);   /* the war tower */
    put(g, cone(0.26, 0.15, M.trim, 4), 0, 1.16, -0.08).rotation.y = Math.PI / 4;
    put(g, cyl(0.01, 0.01, 0.4, M.wood, 4), 0, 1.35, -0.08); put(g, box(0.02, 0.1, 0.16, M.cloth), 0, 1.48, 0);
    return g;
  }

  function figure(side, t) {
    const M = mats(side), chu = side === 'b', g = new THREE.Group();
    put(g, cyl(0.38, 0.4, 0.08, M.plinth, 20), 0, 0.04, 0);
    const on = (child, y, s) => { child.position.y = y; if (s) child.scale.setScalar(s); g.add(child); return child; };
    if (t === 'K') {
      const k = golem(M, { cape: 0.95, beard: chu ? false : true }); on(k.g, 0.08, 1.15);
      if (chu) { scaleHelmet(k.head, M, 0.3, true); pole(k.g, M, k.hand[0], 1.45, 'halberd'); }
      else { mianCrown(k.head, M); pole(k.g, M, k.hand[0], 0.9, 'sceptre'); }
    } else if (t === 'A') {
      const o = official(M, { beard: chu ? 'long' : false }); on(o.g, 0.08);
      scholarCap(o.head, M, chu ? 0.12 : 0.16);
      if (chu) pole(o.g, M, o.hand[0], 1.0, 'staff');   /* 范增 leans on his staff */
      else { const fan = put(o.g, new THREE.Mesh(new THREE.CircleGeometry(0.11, 10), M.ivory), o.hand[0].x, o.hand[0].y + 0.15, o.hand[0].z + 0.03); fan.material.side = THREE.DoubleSide; }
      put(o.g, cyl(0.03, 0.03, 0.22, M.wood, 8), o.hand[1].x + 0.04, o.hand[1].y + 0.03, o.hand[1].z + 0.03).rotation.z = 1.2;   /* bamboo scroll */
    } else if (t === 'B') {
      if (chu) on(elephant(M), 0.08);
      else {   /* 蕭何 holds his ivory court tablet before him */
        const o = official(M, { beard: 'long' }); on(o.g, 0.08);
        put(o.head, box(0.16, 0.13, 0.13, M.black), 0, 0.13, -0.01).rotation.x = -0.2;
        put(o.g, box(0.05, 0.3, 0.015, M.ivory), 0, 0.6, 0.17);
      }
    } else if (t === 'R') {
      on(chariot(M), 0.08).position.z = -0.12;
      const w = golem(M, { beard: true }); on(w.g, 0.08, 0.82).position.z = 0.1;
      if (chu) { hornedHelmet(w.head, M); pole(w.g, M, w.hand[0], 1.45, 'glaive'); }
      else { scaleHelmet(w.head, M, 0.12); pole(w.g, M, w.hand[0], 1.4, 'spear'); shield(w.g, M, w.hand[1], true); }
    } else if (t === 'N') {
      on(horse(M, chu), 0.08);
      const r = golem(M, { cape: chu ? 0.7 : 0.7 }); on(r.g, 0.62, 0.55).position.z = -0.04;
      scaleHelmet(r.head, M, 0.2); pole(r.g, M, r.hand[0], 1.6, 'spear');
    } else if (t === 'C') {
      on(trebuchet(M, chu), 0.08);
    } else {   /* the foot soldier: the smallest golem */
      const p = golem(M, {}); on(p.g, 0.08, 0.78);
      scaleHelmet(p.head, M, 0.08);
      pole(p.g, M, p.hand[0], 1.35, chu ? 'ge' : 'ji'); shield(p.g, M, p.hand[1], chu);
    }
    g.userData.stone = { glowMat: M.glow, glow: 0 };
    return g;
  }

  /* ---------- the hall ---------- */
  let scene = null, torches = [], water = null, motes = null;
  const live = [];   /* chunks and dust puffs */
  const anims = [];  /* per-frame scenery motion (banners) */
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

  /* ---------- the brick board (with the brick figures) ----------
   * The board is a studded baseplate on a wooden play table: a light half for 漢, a slate half for 楚, the grid and the
   * palace diagonals laid in smooth dark tiles, corner marks on the cannon and soldier points, and a river of clear blue
   * plates with white foam tiles and printed 楚河 漢界 tiles. Bright, warm playroom light. Studs are instanced. */
  function brickHall(sc, ctx) {
    scene = sc;
    sc.background = new THREE.Color('#EFE7DC'); sc.environment = null;
    sc.fog = new THREE.Fog('#EFE7DC', 22, 55);
    ctx.hemi.color.set('#FFFFFF'); ctx.hemi.groundColor.set('#B9A58C'); ctx.hemi.intensity = 0.9;
    ctx.sun.color.set('#FFF3E2'); ctx.sun.intensity = 0.95; ctx.sun.position.set(4, 14, 8);
    const root = new THREE.Group(); sc.add(root);
    const plastic = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.38, metalness: 0 }, o || {}));
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; root.add(m); return m; };
    const PLATE = 0.12, STUD_R = 0.07, STUD_H = 0.045, PITCH = 0.25;

    /* the play table */
    const wc = document.createElement('canvas'); wc.width = 512; wc.height = 512; const wg = wc.getContext('2d');
    wg.fillStyle = '#C99A6B'; wg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60; i++) { wg.strokeStyle = `rgba(110,70,40,${rnd(0.05, 0.16)})`; wg.lineWidth = rnd(1, 4); const y = rnd(0, 512); wg.beginPath(); wg.moveTo(0, y); wg.bezierCurveTo(170, y + rnd(-8, 8), 340, y + rnd(-8, 8), 512, y + rnd(-6, 6)); wg.stroke(); }
    const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(4, 4); wt.encoding = THREE.sRGBEncoding;
    const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.6 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -PLATE; table.receiveShadow = true; root.add(table);

    /* two baseplates and a frame of bricks in each army's colour */
    const halves = [['r', 1, '#E8D6AE', '#3D63C9'], ['b', -1, '#8F8C9C', '#C8323E']];
    const studs = [];
    halves.forEach(([, s, col, frame]) => {
      const z0 = 0.4, z1 = 5.35, len = z1 - z0;
      add(new THREE.Mesh(new THREE.BoxGeometry(9.6, PLATE, len), plastic(col)), 0, -PLATE / 2, s * (z0 + len / 2));
      for (let x = -4.75; x <= 4.76; x += PITCH) for (let z = z0 + 0.125; z < z1; z += PITCH) studs.push([x, s * z, col]);
      const fm = plastic(frame);
      add(new THREE.Mesh(new THREE.BoxGeometry(10.1, 0.2, 0.25), fm), 0, -0.02, s * (z1 + 0.125));
      [-1, 1].forEach(e => add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, len + 0.25), fm), e * 4.925, -0.02, s * (z0 + len / 2 + 0.125)));
      for (let x = -4.875; x <= 4.9; x += PITCH * 2) studs.push([x, s * (z1 + 0.125), frame, 0.08]);
    });
    /* the grid: smooth tiles over the studs, so lines read cleanly */
    const tileM = plastic('#3A3440', { roughness: 0.3 }), tileH = 0.06, tileW = 0.075;   /* taller than the studs, so lines run unbroken */
    const tile = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
      const t = add(new THREE.Mesh(new THREE.BoxGeometry(tileW, tileH, L + tileW), tileM), (x0 + x1) / 2, tileH / 2 + 0.002, (z0 + z1) / 2);
      t.rotation.y = Math.atan2(dx, dz); t.castShadow = false;
    };
    const wx = f => f - 4, wz = r => 4.5 - r;
    for (let r = 0; r < 10; r++) tile(wx(0), wz(r), wx(8), wz(r));
    for (let f = 0; f < 9; f++) {
      tile(wx(f), wz(0), wx(f), wz(4)); tile(wx(f), wz(5), wx(f), wz(9));
      if (f === 0 || f === 8) tile(wx(f), wz(4), wx(f), wz(5));
    }
    [[0, 2], [7, 9]].forEach(([a, b]) => { tile(wx(3), wz(a), wx(5), wz(b)); tile(wx(5), wz(a), wx(3), wz(b)); });
    /* corner marks on the cannon and soldier points */
    [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [1, 7], [7, 7], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]].forEach(([f, r]) =>
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dz]) => {
        if ((f === 0 && dx < 0) || (f === 8 && dx > 0)) return;
        const x = wx(f) + dx * 0.12, z = wz(r) + dz * 0.12;
        tile(x, z, x + dx * 0.16, z); tile(x, z, x, z + dz * 0.16);
      }));

    /* the river: clear blue plates set a little lower, with white foam tiles and printed tiles */
    const riverM = new THREE.MeshStandardMaterial({ color: '#4FA8E8', roughness: 0.15, transparent: true, opacity: 0.78 });
    add(new THREE.Mesh(new THREE.BoxGeometry(9.6, PLATE * 0.8, 0.8), riverM), 0, -PLATE * 0.55, 0).castShadow = false;
    add(new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.02, 0.8), plastic('#2E6FB0')), 0, -PLATE + 0.01, 0);   /* deeper blue under the clear plates */
    for (let x = -4.75; x <= 4.76; x += PITCH) for (const z of [-0.25, 0, 0.25]) studs.push([x, z, '#7CC3F2', -PLATE * 0.15, true]);
    const foamM = plastic('#FFFFFF');
    [[-3.6, -0.12], [-2.1, 0.18], [1.3, -0.2], [3.4, 0.12], [-0.4, 0.22], [2.6, -0.05]].forEach(([x, z]) => {
      const f = add(new THREE.Mesh(new THREE.BoxGeometry(rnd(0.3, 0.55), 0.03, 0.1), foamM), x, -PLATE * 0.1, z); f.castShadow = false;
    });
    const printed = (txt, x, flip) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const g = cv.getContext('2d');
      g.fillStyle = '#F4EEDC'; g.fillRect(0, 0, 512, 192);
      g.strokeStyle = '#C8A04A'; g.lineWidth = 10; g.strokeRect(14, 14, 484, 164);
      g.fillStyle = '#3A3440'; g.font = 'bold 110px "LXGW WenKai TC", "Noto Sans TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const draw = () => { g.fillStyle = '#F4EEDC'; g.fillRect(24, 24, 464, 144); g.fillStyle = '#3A3440'; g.fillText(txt, 256, 100); t.needsUpdate = true; };
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; draw();
      if (document.fonts) document.fonts.load(g.font, txt).then(draw, () => {});
      const side = plastic('#F4EEDC');
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.6), [side, side, new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 }), side, side, side]), x, 0.03, 0);
      if (flip) m.rotation.y = Math.PI;
    };
    printed('楚 河', -2.2, false); printed('漢 界', 2.2, false);

    /* ---------- camps and scenery, all bricks, kept outside the board and low on the near side so nothing hides a piece ----------
     * a brick: a box whose top carries studs (added to the instanced studs below) */
    const brick = (w, h, d, col, x, y, z, studsOn) => {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plastic(col)), x, y + h / 2, z);
      if (studsOn !== false) for (let i = 0; i < Math.max(1, Math.round(w / PITCH)); i++) for (let k = 0; k < Math.max(1, Math.round(d / PITCH)); k++)
        studs.push([x - w / 2 + PITCH * (i + 0.5), z - d / 2 + PITCH * (k + 0.5), col, y + h]);
      return m;
    };
    const flag = (ch, cloth, ink, x, z, h) => {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), plastic('#5A4636')), x, -PLATE + h / 2, z);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192; const g = cv.getContext('2d');
      const paint = () => { g.fillStyle = cloth; g.fillRect(0, 0, 256, 192); g.fillStyle = ink; g.font = 'bold 130px "LXGW WenKai TC", "Noto Sans TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 128, 100); t.needsUpdate = true; };
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; paint();
      if (document.fonts) document.fonts.load('bold 130px "LXGW WenKai TC"', ch).then(paint, () => {});
      const f = add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.03), [plastic(cloth), plastic(cloth), plastic(cloth), plastic(cloth), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }), plastic(cloth)]), x + 0.33, -PLATE + h - 0.26, z);
      f.castShadow = true;
      waves.push({ o: f, ph: rnd(0, 6) });
    };
    const waves = [];
    const G = -PLATE;   /* the table top */

    /* 漢: a low city wall with crenellations and a gate behind the near edge, two gate towers and blue banners */
    const HAN = '#D9CBB0', HAN_DARK = '#B4A27E', BLUE = '#3D63C9';
    for (let x = -5.25; x <= 5.26; x += 0.5) {
      if (Math.abs(x) < 0.8) continue;   /* the gate opening */
      brick(0.5, 0.36, 0.4, (Math.round(x * 2) % 2) ? HAN : HAN_DARK, x, G, 6.25, false);
      if (Math.round(x * 2) % 2) brick(0.25, 0.16, 0.4, HAN, x, G + 0.36, 6.25);   /* merlons */
    }
    [-1, 1].forEach(s => {   /* gate towers kept low: this side faces the players */
      brick(0.6, 0.55, 0.6, HAN_DARK, s * 1.05, G, 6.25);
      brick(0.7, 0.08, 0.7, BLUE, s * 1.05, G + 0.55, 6.25);
    });
    brick(1.5, 0.12, 0.5, BLUE, 0, G + 0.4, 6.25);   /* the gate lintel */
    [-5.6, 5.6].forEach(x => flag('漢', BLUE, '#F2C14E', x, 5.9, 1.5));

    /* 楚: tents and a watchtower beyond the far edge, a dark palisade, crimson banners */
    const SLATE = '#4A4652', RED = '#C8323E';
    for (let x = -5.0; x <= 5.01; x += 0.5) brick(0.4, 0.45, 0.3, SLATE, x, G, -6.0, false);
    for (let x = -5.0; x <= 5.01; x += 0.5) add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.2, 4), plastic(SLATE)), x, G + 0.55, -6.0).rotation.y = Math.PI / 4;   /* sharpened stakes */
    [[-3.4, -7.3], [-1.2, -7.6], [1.3, -7.4], [3.5, -7.2]].forEach(([x, z], i) => {
      brick(1.1, 0.5, 1.0, i % 2 ? RED : '#2B2733', x, G, z, false);
      const roof = add(new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.75, 4), plastic(i % 2 ? '#2B2733' : RED)), x, G + 0.5 + 0.37, z); roof.rotation.y = Math.PI / 4;
      brick(0.3, 0.32, 0.05, '#1E1A1C', x, G, z + 0.5, false);   /* tent door */
    });
    /* the watchtower: four posts, a platform and a little roof */
    [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([dx, dz]) => brick(0.12, 2.0, 0.12, '#6B4A30', 5.4 + dx, G, -8.2 + dz, false));
    brick(0.9, 0.12, 0.9, SLATE, 5.4, G + 2.0, -8.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.55, 4), plastic(RED)), 5.4, G + 2.55, -8.2).rotation.y = Math.PI / 4;
    [-5.6, 0, 5.6].forEach(x => flag('楚', RED, '#1E1A1C', x, -6.4, 1.7));

    /* the land around: green baseplates with brick trees, rocks, flowers and torches at the board's corners */
    [-1, 1].forEach(s => {
      const gp = add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 15), plastic('#5DAE5A')), s * 7.5, G + 0.03, 0); gp.castShadow = false;
      for (let x = 5.6; x < 9.5; x += PITCH * 2) for (let z = -7.25; z < 7.3; z += PITCH * 2) if (Math.random() < 0.6) studs.push([s * x, z, '#5DAE5A', G + 0.06]);
    });
    const tree = (x, z, k) => {
      brick(0.25 * k, 0.5 * k, 0.25 * k, '#7A5233', x, G, z, false);
      [[1.0, 0.0], [0.75, 0.36], [0.5, 0.66]].forEach(([w, y], i) => brick(w * k, 0.36 * k, w * k, i % 2 ? '#3E9446' : '#2F7D3A', x, G + 0.5 * k + y * k, z));
    };
    [[-6.4, -3.4], [-7.6, 0.6], [-6.6, 3.8], [-8.4, -1.6], [6.5, -3.0], [7.8, 0.2], [6.7, 3.5], [8.5, 2.2], [-8.0, 5.0], [8.2, -5.0], [-7.2, -5.6]].forEach(([x, z]) => tree(x, z, rnd(0.85, 1.25)));
    [[-6.0, 1.5], [6.2, -1.2], [-8.8, 3.0], [7.0, 5.4]].forEach(([x, z]) => {   /* rocks: a few stacked grey bricks */
      brick(0.5, 0.2, 0.4, '#9A97A3', x, G + 0.06, z); brick(0.3, 0.16, 0.25, '#B4B1BC', x + 0.05, G + 0.26, z - 0.03);
    });
    const flowers = ['#F2C14E', '#E8505B', '#FFFFFF', '#F28CB1'];
    for (let i = 0; i < 40; i++) {
      const s = Math.random() < 0.5 ? -1 : 1, x = s * rnd(5.6, 9.4), z = rnd(-7, 7);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), plastic(flowers[i % 4])), x, G + 0.08, z).castShadow = false;
    }
    /* torches at the four corners of the board: a brick post with a clear orange flame that flickers */
    const flameM = new THREE.MeshStandardMaterial({ color: '#FFB347', emissive: '#FF8A1F', emissiveIntensity: 1.2, transparent: true, opacity: 0.85, roughness: 0.2 });
    [[-5.35, 5.6], [5.35, 5.6], [-5.35, -5.6], [5.35, -5.6]].forEach(([x, z]) => {
      brick(0.2, 0.7, 0.2, '#5A4636', x, G, z, false);
      const fl = add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), flameM), x, G + 0.86, z); fl.castShadow = false;
      const light = new THREE.PointLight('#FFB066', 0.5, 4, 2); light.position.set(x, G + 1.0, z); root.add(light);
      torches.push({ f: { scale: { setScalar: v => fl.scale.set(v / 0.7, (v / 0.7) * (1 + Math.sin(performance.now() / 90 + x) * 0.1), v / 0.7) } }, light, ph: rnd(0, 10) });
    });
    anims.push(t => waves.forEach(w => { w.o.rotation.y = Math.sin(t * 1.6 + w.ph) * 0.18; }));

    /* all the studs in two instanced meshes: solid plastic, and clear plastic for the river */
    const studGeo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 14);
    [false, true].forEach(clear => {
      const list = studs.filter(s => !!s[4] === clear);
      const mat = clear ? new THREE.MeshStandardMaterial({ roughness: 0.15, transparent: true, opacity: 0.8 }) : plastic('#FFFFFF');
      const im = new THREE.InstancedMesh(studGeo, mat, list.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
      list.forEach(([x, z, col, y], i) => {
        m4.makeTranslation(x, (y === undefined ? 0 : y) + STUD_H / 2, z); im.setMatrixAt(i, m4);
        c.set(col); if (window.XQLook) c.convertSRGBToLinear(); im.setColorAt(i, c);
      });
      im.instanceColor.needsUpdate = true; im.receiveShadow = true; root.add(im);
    });
    return root;
  }

  function hall(sc, ctx) {
    if (window.XQToy && !/[?&]golem/.test(location.search)) return brickHall(sc, ctx);   /* toys play on the brick board */
    scene = sc;
    sc.background = new THREE.Color('#141016'); sc.environment = null;
    sc.fog = new THREE.Fog('#141016', 16, 42);
    ctx.hemi.color.set('#9A8FA8'); ctx.hemi.groundColor.set('#2A2228'); ctx.hemi.intensity = 0.55;
    if (window.XQToy && !/[?&]golem/.test(location.search)) { ctx.hemi.color.set('#FFF2E4'); ctx.hemi.intensity = 0.95; }   /* painted toys want a brighter, warmer fill */
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

  /* the statue breaks apart along its own blocks: every piece of it (rocks, cloth, weapon) flies away from the attacker,
   * bounces on the slab and sinks into the stone. The pieces are copies, so the statue itself is untouched for undo. */
  const tmpBox = new THREE.Box3(), wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
  function shatter(fig, dir) {
    if (!scene) return;
    fig.updateMatrixWorld(true); tmpBox.setFromObject(fig);
    const c = tmpBox.getCenter(new THREE.Vector3()), d = dir && dir.lengthSq() ? dir.clone().setY(0).normalize() : new THREE.Vector3();
    let first = true;
    fig.traverse(o => {
      if (!o.isMesh) return;
      if (first) { first = false; return; }   /* the plinth stays behind, then sinks with the rest */
      o.matrixWorld.decompose(wp, wq, ws);
      const m = new THREE.Mesh(o.geometry, o.material); m.position.copy(wp); m.quaternion.copy(wq); m.scale.copy(ws); m.castShadow = true; scene.add(m);
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const r = Math.max(0.03, o.geometry.boundingSphere.radius * ws.x * 0.6);
      const out = new THREE.Vector3(wp.x - c.x, 0, wp.z - c.z).normalize().multiplyScalar(rnd(0.4, 1.4)).addScaledVector(d, rnd(1.0, 2.4));
      live.push({ kind: 'chunk', o: m, r, v: new THREE.Vector3(out.x, rnd(1.2, 3.2) * (0.5 + wp.y), out.z), w: new THREE.Vector3(rnd(-7, 7), rnd(-7, 7), rnd(-7, 7)), age: 0, life: 4.5 });
    });
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
        if (L.age > L.life) { scene.remove(o); live.splice(i, 1); }   /* geometry is shared with the statue */
      } else {
        const k = L.age / L.life; L.o.position.addScaledVector(L.v, dt); L.v.multiplyScalar(0.94);
        L.o.scale.setScalar(L.o.scale.x * (1 + dt * 0.9)); L.o.material.opacity = 0.6 * (1 - k);
        if (k >= 1) { scene.remove(L.o); L.o.material.dispose(); live.splice(i, 1); }
      }
    }
    anims.forEach(fn => fn(t));
    torches.forEach(T => { const f = 1 + Math.sin(t * 9 + T.ph) * 0.08 + Math.sin(t * 23 + T.ph * 2) * 0.05; T.f.scale.setScalar(0.7 * f); T.light.intensity = 0.9 * f; });
    if (water) { water.material.map.offset.x = t * 0.03; }
    if (motes) { motes.rotation.y = t * 0.01; motes.position.y = Math.sin(t * 0.2) * 0.1; }
  }
  /* the attack, driven by the move's progress t (0..1; the victim breaks at about 0.62):
   * wind up, strike fast, hold, recover. swing = overhead chop, thrust = spear levelled forward,
   * throw = the catapult's arm flung over, lunge = a lean forward for pieces with no weapon arm */
  const STRIKE = { swing: [-2.7, -0.45, -0.1, 0.2], thrust: [0.45, -1.5, -0.04, 0.16], throw: [-1.15, 0.95, 0, 0], lunge: [0, 0, -0.05, 0.28] };
  function strike(fig, t) {
    const S = fig.userData.stone; if (!S || !S.rig) return;
    const P = STRIKE[S.rig.kind] || STRIKE.lunge, rest = S.rest;
    const ease = x => x * x * (3 - 2 * x);
    let w, h;   /* how far into the wind-up, how far into the hit */
    if (t < 0.45) { w = ease(t / 0.45); h = 0; }
    else if (t < 0.62) { w = 1; h = Math.pow((t - 0.45) / 0.17, 2); }
    else if (t < 0.8) { w = 1; h = 1; }
    else { const u = ease(Math.min(1, (t - 0.8) / 0.2)); w = 1 - u; h = 1 - u; }
    const wind = rest + (P[0] - rest) * w, angle = wind + (P[1] - wind) * h;
    if (S.rig.arm) S.rig.arm.rotation.x = t >= 1 ? rest : angle;
    fig.rotation.x = t >= 1 ? 0 : P[2] * w * (1 - h) + P[3] * h;
  }

  /* a statue told to move wakes up: its seams flare bright, then settle back to a steady glow */
  function updateFig(fig, dt) {
    const S = fig.userData.stone; if (!S || S.glow <= 0) return;
    S.glow = Math.max(0, S.glow - dt * 0.6);
    S.glowMat.emissiveIntensity = 0.9 + 2.2 * S.glow;
    if (window.XQToy && !/[?&]golem/.test(location.search)) {   /* a toy wakes with a hop and a quick twist, like a figure picked up */
      const t = 1 - S.glow, k = Math.min(1, t / 0.32);
      fig.position.y = t < 0.32 ? Math.sin(k * Math.PI) * 0.18 : 0;
      fig.rotation.y = t < 0.32 ? Math.sin(k * Math.PI * 2) * 0.35 : 0;
      fig.rotation.z = t < 0.32 ? Math.sin(k * Math.PI) * 0.06 : 0;
    }
  }

  /* the toy look (js/toy.js) is the current experiment; ?golem shows the rock golems instead */
  const toy = !!window.XQToy && !/[?&]golem/.test(location.search);
  window.XQStone = { figure: toy ? XQToy.figure : figure, hall, glow, thud, shatter, strike, update, updateFig, BADGE_Y: toy ? XQToy.BADGE_Y : BADGE_Y, toy, pieces: () => live.filter(L => L.kind === 'chunk').length };
})();
