/* 楚漢石棋 — the toy look (explore-3d experiment): brick figures by default (?chibi: round chibi vinyl toys),
 * built in code from rounded shapes. Big heads, dot eyes and blush, short limbs; who is who is told by
 * outfit, headgear and weapon rather than by a detailed face. Same cast as docs/石棋角色設計.md.
 *
 * figure(side, t) returns a figure on its round base, standing at y=0 and facing +z, about 1.1 units tall.
 * The meshes are separate parts (head, body, limbs, gear), so a captured toy falls apart into its pieces
 * through XQStone.shatter.
 */
(function () {
  const ARMY = {
    r: { cloth: '#3D63C9', clothDark: '#2A4590', trim: '#F2C14E', plume: '#3D63C9', armour: '#D9B26A' },   /* 漢: royal blue and gold */
    b: { cloth: '#C8323E', clothDark: '#2B2733', trim: '#E2A93B', plume: '#C8323E', armour: '#3A3744' }    /* 楚: crimson and black */
  };
  const BADGE_Y = { K: 1.7, A: 1.45, B: 1.45, R: 1.6, N: 1.75, C: 1.5, P: 1.35 };

  function mats(side) {
    const C = ARMY[side];
    const m = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0 }, o || {}));
    return {
      colors: C, skin: m('#F6CDA8'), blush: m('#F29A9A', { roughness: 0.8 }), ink: m('#2A2228', { roughness: 0.4 }), white: m('#FFFFFF', { roughness: 0.3 }),
      hair: m('#2B2420'), hairWhite: m('#ECE9E4'), beard: m(side === 'b' ? '#ECE9E4' : '#4A3426'),
      cloth: m(C.cloth), clothDark: m(C.clothDark), trim: m(C.trim, { roughness: 0.35, metalness: 0.3 }), plume: m(C.plume),
      armour: m(C.armour, { roughness: 0.45, metalness: 0.2 }), metal: m('#B9C0C8', { roughness: 0.3, metalness: 0.5 }),
      wood: m('#9A6B43'), ivory: m('#F4EEDC'), base: m('#7C7782', { roughness: 0.7 }), jade: m('#6FBF8E', { roughness: 0.3 }),
      glow: new THREE.MeshStandardMaterial({ color: '#FFE08A', emissive: '#FFB547', emissiveIntensity: 0.8, roughness: 0.5 })
    };
  }
  const put = (p, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh); return mesh; };
  const rbox = (w, h, d, m, r) => new THREE.Mesh(THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(w, h, d, 3, r || Math.min(w, h, d) * 0.3) : new THREE.BoxGeometry(w, h, d), m);
  const ball = (r, m, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg || 20, Math.round((seg || 20) * 0.7)), m);
  const cyl = (rt, rb, h, m, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), m);
  const cone = (r, h, m, seg) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 16), m);
  const lathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24), m);
  /* a limb: a rounded stick from a to b */
  function limb(g, m, r, a, b) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const s = put(g, cyl(r, r, len, m, 12), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    put(g, ball(r, m, 12), b.x, b.y, b.z);
    return s;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------- the face: dot eyes, blush, brows and a mouth that carry the character ---------- */
  function face(head, M, o) {
    const r = 0.2, z = r * 0.93;
    [-1, 1].forEach(s => {
      const eye = put(head, ball(0.026, M.ink, 12), s * 0.07, 0.0, z); eye.scale.set(1, 1.25, 0.5);
      put(head, ball(0.008, M.white, 8), s * 0.07 + 0.008, 0.012, z + 0.012);   /* the sparkle */
      const bl = put(head, ball(0.03, M.blush, 12), s * 0.115, -0.05, z * 0.9); bl.scale.set(1.2, 0.6, 0.3);
      if (o.brow) {   /* brows: fierce slant in, kind slant out, calm flat */
        const b = put(head, ball(0.035, o.old ? M.hairWhite : M.hair, 10), s * 0.075, 0.06, z * 0.97); b.scale.set(1.3, 0.35, 0.35);
        b.rotation.z = s * (o.brow === 'fierce' ? 0.45 : o.brow === 'kind' ? -0.35 : 0);
      }
    });
    if (o.mouth === 'grin') { const mth = put(head, new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI), M.ink), 0, -0.07, z * 0.98); mth.rotation.z = Math.PI; }
    else if (o.mouth === 'smirk') { const mth = put(head, new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI * 0.8), M.ink), 0.015, -0.075, z * 0.98); mth.rotation.z = Math.PI + 0.3; }
    else if (o.mouth === 'shout') { const mth = put(head, ball(0.025, M.ink, 12), 0, -0.08, z * 0.95); mth.scale.set(1.2, 0.9, 0.4); }
    else { const mth = put(head, new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), M.ink), 0, -0.065, z * 0.98); mth.rotation.z = Math.PI; }
    if (o.beard === 'long') { const b = put(head, cone(0.06, 0.2, M.beard, 12), 0, -0.2, 0.12); b.rotation.x = Math.PI + 0.25; }
    else if (o.beard === 'full') { const b = put(head, ball(0.12, M.beard, 16), 0, -0.13, 0.08); b.scale.set(1.1, 0.75, 0.7); }
    else if (o.beard) { const b = put(head, cone(0.03, 0.09, M.beard, 10), 0, -0.14, 0.15); b.rotation.x = Math.PI + 0.35; }
    if (o.moustache) [-1, 1].forEach(s => { const m = put(head, ball(0.03, M.beard, 10), s * 0.025, -0.04, z * 0.98); m.scale.set(1.2, 0.35, 0.4); m.rotation.z = -s * 0.3; });
  }
  /* head with hair; returns the head group (its origin is the centre of the head) */
  function head(g, M, y, o) {
    const h = new THREE.Group(); h.position.set(0, y, 0.01); g.add(h);
    put(h, ball(0.2, M.skin, 24), 0, 0, 0);
    if (o.hair !== false) { const cap = put(h, new THREE.Mesh(new THREE.SphereGeometry(0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), o.old ? M.hairWhite : M.hair), 0, 0.01, -0.012); cap.rotation.x = -0.25; }
    face(h, M, o);
    return h;
  }

  /* ---------- bodies ---------- */
  /* a chunky toy soldier: short legs, a rounded torso, short arms, a big head */
  function chibiPerson(M, o) {
    const g = new THREE.Group(); o = o || {};
    const bulk = o.bulk || 1;
    [-1, 1].forEach(s => {
      limb(g, M.clothDark, 0.06, V(s * 0.08, 0.3, 0), V(s * 0.085, 0.08, 0.01));
      const boot = put(g, rbox(0.11, 0.08, 0.15, M.clothDark, 0.035), s * 0.085, 0.04, 0.03);
    });
    put(g, rbox(0.3 * bulk, 0.32, 0.24, o.armour ? M.armour : M.cloth, 0.08), 0, 0.44, 0);   /* torso */
    put(g, cyl(0.155 * bulk, 0.17 * bulk, 0.06, M.trim, 20), 0, 0.31, 0);                     /* belt */
    if (o.armour) {
      put(g, rbox(0.22 * bulk, 0.18, 0.04, M.clothDark, 0.02), 0, 0.46, 0.12);
      [-1, 1].forEach(s => { const p = put(g, ball(0.09, M.armour, 16), s * 0.19 * bulk, 0.57, 0); p.scale.set(1.1, 0.7, 1); });
    }
    const hands = [-1, 1].map(s => {
      const h = V(s * 0.21 * bulk, 0.34, 0.08);
      limb(g, o.armour ? M.armour : M.cloth, 0.05, V(s * 0.16 * bulk, 0.54, 0), h);
      put(g, ball(0.055, M.skin, 14), h.x, h.y, h.z);
      return h;
    });
    const hd = head(g, M, 0.82, o);
    if (o.cape) {
      const geo = new THREE.PlaneGeometry(0.42 * bulk, 0.5, 6, 6), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.cos(x * 5) * 0.05 - (0.25 - y) * 0.15); }
      geo.computeVertexNormals();
      put(g, new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: o.cape, roughness: 0.6, side: THREE.DoubleSide })), 0, 0.36, -0.14);
    }
    return { g, head: hd, hand: hands, arm: [g, g], hl: hands };
  }
  /* an official: a long robe and wide sleeves instead of legs and armour */
  function chibiOfficial(M, o) {
    const g = new THREE.Group();
    put(g, lathe([[0.2, 0], [0.21, 0.03], [0.18, 0.3], [0.15, 0.55], [0.12, 0.62]], M.cloth), 0, 0, 0);
    put(g, cyl(0.15, 0.16, 0.05, M.trim, 20), 0, 0.4, 0);
    put(g, rbox(0.08, 0.3, 0.02, M.trim, 0.008), 0, 0.22, 0.17);
    const hands = [-1, 1].map(s => {
      const sl = put(g, cyl(0.06, 0.1, 0.28, M.cloth, 14), s * 0.17, 0.46, 0.04); sl.rotation.z = s * 0.35; sl.rotation.x = -0.3;
      const h = V(s * 0.1, 0.36, 0.15); put(g, ball(0.05, M.skin, 14), h.x, h.y, h.z); return h;
    });
    const hd = head(g, M, 0.8, o);
    return { g, head: hd, hand: hands, arm: [g, g], hl: hands };
  }

  /* ---------- headgear ---------- */
  function helmet(h, M, plume, crown) {
    const dome = put(h, new THREE.Mesh(new THREE.SphereGeometry(0.225, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.metal), 0, 0.07, -0.01);
    put(h, new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 8, 28), crown ? M.trim : M.armour), 0, 0.085, 0).rotation.x = Math.PI / 2 - 0.15;
    if (crown) put(h, ball(0.03, M.plume, 12), 0, 0.12, 0.2);
    if (plume) { const p = put(h, cone(0.05, plume, M.plume, 12), 0, 0.29 + plume / 2, -0.04); p.rotation.x = -0.35; put(h, ball(0.03, M.trim, 10), 0, 0.28, -0.01); }
  }
  function horns(h, M) { [-1, 1].forEach(s => { const c = put(h, cone(0.035, 0.16, M.ivory, 12), s * 0.17, 0.22, 0); c.rotation.z = -s * 0.7; }); }
  function mian(h, M) {   /* 劉邦's 冕: a flat board on top with strings of jade beads */
    put(h, cyl(0.1, 0.12, 0.1, M.clothDark, 16), 0, 0.22, 0);
    put(h, rbox(0.42, 0.035, 0.28, M.clothDark, 0.012), 0, 0.29, 0).rotation.x = -0.1;
    put(h, rbox(0.43, 0.012, 0.29, M.trim, 0.005), 0, 0.31, 0).rotation.x = -0.1;
    for (let i = -3; i <= 3; i++) for (let k = 0; k < 3; k++) put(h, ball(0.015, M.jade, 8), i * 0.055, 0.26 - k * 0.035, 0.15);
  }
  function cap(h, M, tall) { put(h, rbox(0.14, tall, 0.16, M.clothDark, 0.03), 0, 0.2 + tall / 2 - 0.04, -0.03); put(h, rbox(0.3, 0.02, 0.03, M.clothDark, 0.008), 0, 0.2, -0.03); }

  /* ---------- weapons and props ---------- */
  function pole(g, M, at, len, top) {
    put(g, cyl(0.022, 0.022, len, M.wood, 10), at.x, at.y + len * 0.4, at.z);
    const y = at.y + len * 0.9;
    if (top === 'halberd' || top === 'glaive') {   /* 項羽's great blade (龍且's glaive is a smaller one): see bladeOn */
      bladeOn(g, M, at, y, top === 'halberd' ? 1 : 0.8, top === 'halberd');
    }
    else if (top === 'ji') { put(g, cone(0.035, 0.15, M.metal, 10), at.x, y + 0.08, at.z); put(g, rbox(0.025, 0.06, 0.13, M.metal, 0.01), at.x, y - 0.03, at.z + 0.07); }
    else if (top === 'ge') put(g, rbox(0.025, 0.05, 0.18, M.metal, 0.01), at.x, y, at.z + 0.09);
    else if (top === 'sceptre') { put(g, ball(0.06, M.trim, 14), at.x, y, at.z); put(g, cone(0.045, 0.1, M.trim, 10), at.x, y + 0.08, at.z); }
    else if (top === 'staff') { const k = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 8, 14, Math.PI * 1.4), M.wood), at.x, y + 0.04, at.z); k.rotation.y = Math.PI / 2; }
    else put(g, cone(0.035, 0.15, M.metal, 10), at.x, y + 0.08, at.z);
  }
  /* a curved broad blade like a 大刀, flat to the viewer and swept away from the body, with a gold collar and
   * (for 項羽) a gold back edge and a crimson tassel */
  function bladeOn(g, M, at, y, k, grand) {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.07); sh.lineTo(0.05, -0.08);
    sh.quadraticCurveTo(0.21, -0.03, 0.21, 0.15);
    sh.quadraticCurveTo(0.2, 0.31, 0.05, 0.41);
    sh.quadraticCurveTo(0.09, 0.22, 0, 0.12); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0, 0, -0.01);
    const out = at.x >= 0 ? 1 : -1;
    const b = put(g, new THREE.Mesh(geo, M.metal), at.x + out * 0.015, y - 0.1 * k, at.z);
    b.scale.set(out * k, k, 1);
    if (grand) {
      const edge = new THREE.Shape(); edge.moveTo(0.05, -0.08); edge.quadraticCurveTo(0.21, -0.03, 0.21, 0.15); edge.quadraticCurveTo(0.2, 0.31, 0.05, 0.41);
      edge.quadraticCurveTo(0.17, 0.28, 0.18, 0.14); edge.quadraticCurveTo(0.17, 0.0, 0.05, -0.04); edge.closePath();
      const eg = new THREE.ExtrudeGeometry(edge, { depth: 0.05, bevelEnabled: false, curveSegments: 10 }); eg.translate(0, 0, -0.025);
      const e = put(g, new THREE.Mesh(eg, M.trim), at.x + out * 0.015, y - 0.1 * k, at.z); e.scale.set(out * k, k, 1);
      put(g, cone(0.03, 0.12, M.plume, 10), at.x, y - 0.16, at.z).rotation.x = Math.PI;   /* the tassel */
    }
    put(g, cyl(0.032, 0.032, 0.06, M.trim, 12), at.x, y - 0.12 * k, at.z);   /* collar */
    put(g, cone(0.025, 0.1, M.metal, 10), at.x, y + 0.04, at.z);           /* spike on top of the shaft */
  }
  function shield(g, M, at, round) {
    const s = round ? cyl(0.15, 0.15, 0.04, M.clothDark, 24) : rbox(0.24, 0.3, 0.04, M.cloth, 0.03);
    if (round) s.rotation.x = Math.PI / 2;
    put(g, s, at.x - 0.03, at.y + 0.06, at.z + 0.06);
    put(g, ball(0.045, M.trim, 12), at.x - 0.03, at.y + 0.06, at.z + 0.09);
  }

  /* ---------- mounts and machines ---------- */
  function horse(M, black) {
    const g = new THREE.Group(), coat = new THREE.MeshStandardMaterial({ color: black ? '#2E2A33' : '#C98E5A', roughness: 0.5 });
    const mane = black ? M.plume : new THREE.MeshStandardMaterial({ color: '#6B4426', roughness: 0.6 });
    put(g, rbox(0.3, 0.28, 0.56, coat, 0.12), 0, 0.5, 0);
    const neck = put(g, rbox(0.15, 0.3, 0.16, coat, 0.06), 0, 0.72, 0.26); neck.rotation.x = 0.45;
    const hd = put(g, rbox(0.15, 0.16, 0.3, coat, 0.06), 0, 0.86, 0.4); hd.rotation.x = 0.3;
    [-1, 1].forEach(s => {
      const e = put(g, ball(0.022, M.ink, 10), s * 0.075, 0.9, 0.44); e.scale.set(0.5, 1.2, 1);
      put(g, cone(0.03, 0.08, coat, 8), s * 0.05, 0.98, 0.32);
    });
    const mn = put(g, rbox(0.06, 0.12, 0.32, mane, 0.03), 0, 0.82, 0.2); mn.rotation.x = 0.45;
    [[0.1, 0.18], [-0.1, 0.18], [0.1, -0.18], [-0.1, -0.18]].forEach(([x, z]) => { put(g, cyl(0.05, 0.045, 0.34, coat, 12), x, 0.2, z); put(g, cyl(0.055, 0.055, 0.05, M.ink, 12), x, 0.025, z); });
    const tail = put(g, rbox(0.06, 0.26, 0.07, mane, 0.03), 0, 0.46, -0.32); tail.rotation.x = -0.45;
    put(g, rbox(0.34, 0.05, 0.3, M.cloth, 0.02), 0, 0.65, -0.02);
    return g;
  }
  function chariot(M) {
    const g = new THREE.Group();
    put(g, rbox(0.46, 0.2, 0.32, M.wood, 0.04), 0, 0.36, 0);
    put(g, rbox(0.48, 0.04, 0.34, M.trim, 0.015), 0, 0.47, 0);
    [-1, 1].forEach(s => {
      const w = new THREE.Group(); w.position.set(s * 0.28, 0.24, 0); w.rotation.y = Math.PI / 2; g.add(w);
      put(w, new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 10, 24), M.clothDark), 0, 0, 0);
      for (let i = 0; i < 3; i++) put(w, cyl(0.015, 0.015, 0.4, M.wood, 6), 0, 0, 0).rotation.z = i * Math.PI / 3;
      put(w, cyl(0.05, 0.05, 0.08, M.trim, 12), 0, 0, 0).rotation.x = Math.PI / 2;
    });
    put(g, cyl(0.012, 0.012, 0.75, M.wood, 6), -0.2, 0.75, -0.12);
    put(g, rbox(0.02, 0.22, 0.2, M.cloth, 0.008), -0.2, 1.0, -0.02);
    return g;
  }
  function trebuchet(M, beast) {
    const g = new THREE.Group();
    [-1, 1].forEach(s => {
      put(g, rbox(0.07, 0.07, 0.56, M.wood, 0.025), s * 0.19, 0.06, 0);
      [-1, 1].forEach(d => { const l = put(g, rbox(0.06, 0.62, 0.06, M.wood, 0.02), s * 0.19, 0.36, d * 0.12); l.rotation.x = -d * 0.38; });
    });
    put(g, cyl(0.03, 0.03, 0.46, M.trim, 10), 0, 0.66, 0).rotation.z = Math.PI / 2;
    const arm = new THREE.Group(); arm.position.set(0, 0.66, 0); arm.rotation.x = -0.85; g.add(arm); g.userData.arm = arm;
    put(arm, rbox(0.06, 0.9, 0.06, M.wood, 0.02), 0, 0.2, 0);
    const cw = put(arm, rbox(0.2, 0.18, 0.2, M.clothDark, 0.05), 0, -0.24, 0);
    if (beast) [-1, 1].forEach(s => put(arm, ball(0.02, M.plume, 8), s * 0.05, -0.21, 0.1));   /* 楚: the counterweight has angry red eyes */
    put(arm, ball(0.075, M.glow, 16), 0, 0.68, 0.02);
    put(g, cyl(0.012, 0.012, 0.55, M.wood, 6), -0.25, 0.5, 0.18); put(g, rbox(0.02, 0.15, 0.13, M.cloth, 0.006), -0.25, 0.72, 0.24);
    return g;
  }
  function elephant(M) {
    const g = new THREE.Group(), grey = new THREE.MeshStandardMaterial({ color: '#8C8FA0', roughness: 0.55 });
    const b = put(g, ball(0.3, grey, 24), 0, 0.55, -0.05); b.scale.set(1, 0.95, 1.15);
    put(g, ball(0.2, grey, 20), 0, 0.68, 0.3);
    [-1, 1].forEach(s => {
      const ear = put(g, cyl(0.14, 0.14, 0.03, grey, 20), s * 0.19, 0.7, 0.24); ear.rotation.z = Math.PI / 2; ear.rotation.y = s * 0.35;
      const e = put(g, ball(0.022, M.ink, 10), s * 0.08, 0.74, 0.47); e.scale.set(1, 1.2, 0.6);
      const tusk = put(g, cone(0.03, 0.2, M.ivory, 10), s * 0.08, 0.56, 0.48); tusk.rotation.x = 1.9;
    });
    const curve = new THREE.CatmullRomCurve3([V(0, 0.64, 0.46), V(0, 0.45, 0.58), V(0, 0.26, 0.56), V(0, 0.22, 0.48)]);
    put(g, new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.05, 10), grey), 0, 0, 0);
    [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.22], [-0.15, -0.22]].forEach(([x, z]) => put(g, cyl(0.08, 0.085, 0.32, grey, 14), x, 0.16, z));
    put(g, rbox(0.46, 0.05, 0.46, M.cloth, 0.02), 0, 0.82, -0.06);
    put(g, rbox(0.26, 0.2, 0.26, M.clothDark, 0.04), 0, 0.95, -0.08);
    put(g, cone(0.24, 0.14, M.trim, 4), 0, 1.12, -0.08).rotation.y = Math.PI / 4;
    put(g, rbox(0.24, 0.08, 0.04, M.cloth, 0.015), 0, 0.82, 0.42);   /* head plate */
    return g;
  }


  /* ---------- the brick-figure look (default; ?chibi shows the round chibi toys) ----------
   * A cylinder head with a stud and a printed face, a trapezoid torso with a printed outfit, C-shaped hands,
   * blocky legs. Faces and outfits are painted on canvases, so brows, beards and expressions carry the character. */
  const BRICK = !/[?&]chibi/.test(location.search);
  const YELLOW = '#F5C842';
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); draw(c);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; if (window.XQLook) t.encoding = THREE.sRGBEncoding; return t;
  }
  /* the printed face, centred on the front of the head (the head's texture seam is at the back) */
  function faceTex(o) {
    return canvasTex(512, 256, c => {
      c.fillStyle = YELLOW; c.fillRect(0, 0, 512, 256);
      const ink = '#1E1A1C', hairC = o.old ? '#BDB7AE' : '#1E1A1C', beardC = o.old ? '#EEEAE2' : (o.beardColor || '#4A3020');
      c.lineCap = 'round'; c.lineJoin = 'round';
      [-1, 1].forEach(s => {   /* eyes with a highlight */
        c.fillStyle = ink; c.beginPath(); c.ellipse(256 + s * 30, 118, 9, 12, 0, 0, 7); c.fill();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(256 + s * 30 + 3, 113, 3.2, 0, 7); c.fill();
      });
      c.strokeStyle = hairC; c.lineWidth = 7;   /* brows carry the mood */
      [-1, 1].forEach(s => {
        const x0 = 256 + s * 16, x1 = 256 + s * 46, y = 94;
        c.beginPath();
        if (o.brow === 'fierce') { c.moveTo(x0, y + 6); c.lineTo(x1, y - 6); }
        else if (o.brow === 'kind') { c.moveTo(x0, y - 4); c.quadraticCurveTo((x0 + x1) / 2, y - 9, x1, y + 2); }
        else { c.moveTo(x0, y); c.lineTo(x1, y - 2); }
        c.stroke();
      });
      if (o.lines) { c.strokeStyle = 'rgba(30,26,28,0.45)'; c.lineWidth = 2.5; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(256 + s * 52, 124); c.lineTo(256 + s * 60, 132); c.stroke(); }); }   /* the old man's crow's feet */
      if (o.blush) { c.fillStyle = 'rgba(240,120,110,0.35)'; [-1, 1].forEach(s => { c.beginPath(); c.ellipse(256 + s * 50, 146, 12, 7, 0, 0, 7); c.fill(); }); }
      /* beard drawn before the mouth, so the mouth sits on top of it */
      c.fillStyle = beardC;
      if (o.beard === 'full') { c.beginPath(); c.moveTo(200, 130); c.quadraticCurveTo(205, 205, 256, 215); c.quadraticCurveTo(307, 205, 312, 130); c.quadraticCurveTo(300, 175, 256, 178); c.quadraticCurveTo(212, 175, 200, 130); c.fill(); }
      else if (o.beard === 'long') { c.beginPath(); c.moveTo(228, 170); c.quadraticCurveTo(256, 256, 284, 170); c.closePath(); c.fill(); }
      else if (o.beard) { c.beginPath(); c.moveTo(244, 176); c.lineTo(256, 205); c.lineTo(268, 176); c.closePath(); c.fill(); }
      if (o.moustache || o.beard === 'full' || o.beard === 'long') {
        c.strokeStyle = beardC; c.lineWidth = 6;
        [-1, 1].forEach(s => { c.beginPath(); c.moveTo(256, 150); c.quadraticCurveTo(256 + s * 18, 146, 256 + s * 30, 160); c.stroke(); });
      }
      c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 5;
      if (o.mouth === 'grin') { c.beginPath(); c.moveTo(228, 156); c.quadraticCurveTo(256, 190, 284, 156); c.closePath(); c.fill(); c.fillStyle = '#FFFFFF'; c.fillRect(236, 157, 40, 7); }
      else if (o.mouth === 'smirk') { c.beginPath(); c.moveTo(238, 164); c.quadraticCurveTo(262, 172, 282, 154); c.stroke(); }
      else if (o.mouth === 'shout') { c.beginPath(); c.ellipse(256, 168, 16, 13, 0, 0, 7); c.fill(); c.fillStyle = '#C0393B'; c.beginPath(); c.ellipse(256, 174, 9, 5, 0, 0, 7); c.fill(); }
      else { c.beginPath(); c.arc(256, 150, 20, 0.35, Math.PI - 0.35); c.stroke(); }
    });
  }
  /* the printed front of the torso: armour scales, or a robe's crossed collar and sash */
  function torsoTex(M, o) {
    const A = M.colors;
    return canvasTex(256, 256, c => {
      c.fillStyle = o.print === 'armour' ? A.armour : A.cloth; c.fillRect(0, 0, 256, 256);
      if (o.print === 'armour') {
        for (let y = 40; y < 200; y += 22) for (let x = 40 + ((y / 22) % 2) * 12; x < 220; x += 26) {
          c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.roundRect ? c.roundRect(x, y, 22, 18, 5) : c.rect(x, y, 22, 18); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 3, y + 2, 16, 4);
        }
        c.fillStyle = A.cloth; c.fillRect(0, 0, 256, 34);   /* collar */
        c.fillStyle = A.trim; c.beginPath(); c.arc(128, 120, 26, 0, 7); c.fill();   /* the chest disc */
        c.fillStyle = A.cloth; c.beginPath(); c.arc(128, 120, 16, 0, 7); c.fill();
      } else {
        c.strokeStyle = '#F4EEDC'; c.lineWidth = 16; c.beginPath(); c.moveTo(70, 0); c.lineTo(150, 150); c.stroke();
        c.strokeStyle = A.trim; c.lineWidth = 6; c.beginPath(); c.moveTo(186, 0); c.lineTo(110, 150); c.stroke();
        if (o.emblem) { c.strokeStyle = A.trim; c.lineWidth = 5; c.beginPath(); c.arc(170, 95, 24, 0, 7); c.stroke(); c.beginPath(); c.arc(170, 95, 10, 0, 7); c.stroke(); }
      }
      c.fillStyle = A.trim; c.fillRect(0, 214, 256, 30);   /* belt */
      c.fillStyle = A.clothDark; c.fillRect(112, 210, 32, 38);
    });
  }
  function trapezoid(wTop, wBot, h, d, mats) {
    const g = new THREE.BoxGeometry(wBot, h, d), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * wTop / wBot);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mats);
  }
  /* the head: a printed cylinder with a stud on top and a hair piece; returns the group gear is attached to,
   * scaled so the chibi helmets and crowns fit the smaller head */
  function brickHead(g, M, y, o) {
    const skin = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.35 });
    put(g, cyl(0.055, 0.055, 0.04, skin, 16), 0, y - 0.13, 0);   /* neck */
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 32, 1, false, Math.PI, Math.PI * 2),
      [new THREE.MeshStandardMaterial({ map: faceTex(o), roughness: 0.35 }), skin, skin]), 0, y, 0);
    put(g, cyl(0.065, 0.065, 0.05, skin, 20), 0, y + 0.13, 0);   /* the stud */
    if (o.hair !== false) {
      const hair = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), o.old ? M.hairWhite : M.hair), 0, y + 0.06, -0.01);
      hair.scale.set(1, 0.75, 1);
      put(g, rbox(0.25, 0.12, 0.06, o.old ? M.hairWhite : M.hair, 0.025), 0, y + 0.02, -0.1);   /* hair at the back */
    }
    const gear = new THREE.Group(); gear.position.set(0, y - 0.01, 0); gear.scale.setScalar(0.64); g.add(gear);
    return gear;
  }
  /* the arms hang from shoulder joints, so a weapon or shield held in the hand moves with the arm when it strikes */
  function brickArms(g, M, armMat) {
    const arms = [], local = [], hands = [];
    [-1, 1].forEach(s => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.19, 0.6, 0.0); g.add(pivot);
      const arm = put(pivot, rbox(0.09, 0.26, 0.11, armMat, 0.035), s * 0.02, -0.07, 0.02); arm.rotation.z = s * 0.18; arm.rotation.x = -0.25;
      const hand = put(pivot, new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.02, 8, 16, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.35 })), s * 0.06, -0.2, 0.1);
      hand.rotation.set(Math.PI / 2, 0, Math.PI * 0.75);
      arms.push(pivot); local.push(V(s * 0.06, -0.2, 0.1)); hands.push(V(s * 0.25, 0.4, 0.1));
    });
    return { arms, local, hands };
  }
  function brickPerson(M, o) {
    const g = new THREE.Group(); o = o || {};
    const side = M.cloth, legs = M.clothDark;
    [-1, 1].forEach(s => { put(g, rbox(0.17, 0.27, 0.2, legs, 0.02), s * 0.088, 0.135, 0.005); put(g, rbox(0.17, 0.05, 0.06, legs, 0.015), s * 0.088, 0.025, 0.11); });
    put(g, rbox(0.36, 0.06, 0.2, legs, 0.015), 0, 0.3, 0);   /* hips */
    const front = new THREE.MeshStandardMaterial({ map: torsoTex(M, { print: o.armour ? 'armour' : 'robe', emblem: o.emblem }), roughness: 0.45 });
    const body = o.armour ? M.armour : side;
    put(g, trapezoid(0.29, 0.38, 0.3, 0.19, [body, body, body, body, front, body]), 0, 0.48, 0);
    if (o.armour) [-1, 1].forEach(s => { const p = put(g, rbox(0.14, 0.05, 0.2, M.armour, 0.02), s * 0.15, 0.63, 0); p.rotation.z = -s * 0.25; });
    const A = brickArms(g, M, o.armour ? M.armour : side), hands = A.hands;
    const head = brickHead(g, M, 0.77, o);
    if (o.cape) {
      const geo = new THREE.PlaneGeometry(0.4, 0.55, 6, 6), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.cos(x * 5) * 0.03 - (0.27 - y) * 0.12); }
      geo.computeVertexNormals();
      put(g, new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: o.cape, roughness: 0.6, side: THREE.DoubleSide })), 0, 0.36, -0.12);
    }
    return { g, head, hand: hands, arm: A.arms, hl: A.local };
  }
  function brickOfficial(M, o) {
    const g = new THREE.Group();
    put(g, trapezoid(0.36, 0.44, 0.33, 0.24, M.cloth), 0, 0.165, 0);   /* the long robe in place of legs */
    put(g, rbox(0.08, 0.3, 0.02, M.trim, 0.006), 0, 0.17, 0.125);
    const front = new THREE.MeshStandardMaterial({ map: torsoTex(M, { print: 'robe', emblem: true }), roughness: 0.45 });
    put(g, trapezoid(0.29, 0.38, 0.3, 0.19, [M.cloth, M.cloth, M.cloth, M.cloth, front, M.cloth]), 0, 0.48, 0);
    const A = brickArms(g, M, M.cloth), hands = A.hands;
    [-1, 1].forEach(s => { const sl = put(g, cyl(0.07, 0.1, 0.12, M.cloth, 14), s * 0.25, 0.44, 0.08); sl.rotation.x = -0.4; });   /* wide sleeve cuffs */
    const head = brickHead(g, M, 0.77, o);
    return { g, head, hand: hands, arm: A.arms, hl: A.local };
  }
  const person = (M, o) => BRICK ? brickPerson(M, o) : chibiPerson(M, o);
  const official = (M, o) => BRICK ? brickOfficial(M, o) : chibiOfficial(M, o);

  function figure(side, t) {
    const M = mats(side), chu = side === 'b', g = new THREE.Group();
    let rig = { kind: 'lunge' };   /* how this piece attacks: swing, thrust, throw, or (no weapon arm) a lunge */
    put(g, cyl(0.37, 0.39, 0.07, M.base, 32), 0, 0.035, 0);
    put(g, new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.018, 8, 40), M.trim), 0, 0.07, 0).rotation.x = Math.PI / 2;
    const on = (c, y, s) => { c.position.y = y; if (s) c.scale.setScalar(s); g.add(c); return c; };
    if (t === 'K') {
      if (chu) {   /* 項羽: fierce brows, a cocky smirk, plumed helmet, crimson cape, the great halberd */
        const k = person(M, { armour: true, bulk: 1.15, brow: 'fierce', mouth: 'smirk', cape: '#C8323E' }); on(k.g, 0.07, 1.12);
        helmet(k.head, M, 0.32, true); pole(k.arm[0], M, k.hl[0], 1.3, 'halberd'); rig = { arm: k.arm[0], kind: 'swing' };
      } else {   /* 劉邦: calm smile, moustache and goatee, the 冕 crown, a blue cape, a gold sceptre */
        const k = person(M, { bulk: 1.1, brow: 'calm', mouth: 'smile', beard: true, moustache: true, cape: '#2A4590' }); on(k.g, 0.07, 1.12);
        mian(k.head, M); pole(k.arm[0], M, k.hl[0], 0.75, 'sceptre'); rig = { arm: k.arm[0], kind: 'thrust' };
      }
    } else if (t === 'A') {
      if (chu) {   /* 范增: the old strategist with a long white beard, leaning on his staff */
        const o = official(M, { old: true, brow: 'calm', mouth: 'smirk', beard: 'long' }); on(o.g, 0.07);
        cap(o.head, M, 0.12); pole(o.arm[0], M, o.hl[0], 1.0, 'staff'); rig = { arm: o.arm[0], kind: 'swing' };
      } else {   /* 張良: the young strategist with a feather fan */
        const o = official(M, { brow: 'kind', mouth: 'smirk' }); on(o.g, 0.07);
        cap(o.head, M, 0.18);
        const fan = put(o.g, new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), M.ivory), o.hand[0].x + 0.05, o.hand[0].y + 0.14, o.hand[0].z); fan.material.side = THREE.DoubleSide;
        put(o.g, cyl(0.012, 0.012, 0.12, M.wood, 6), o.hand[0].x + 0.04, o.hand[0].y + 0.05, o.hand[0].z);
      }
    } else if (t === 'B') {
      if (chu) on(elephant(M), 0.07);
      else {   /* 蕭何: the chancellor holding his ivory tablet */
        const o = official(M, { brow: 'kind', mouth: 'smile', beard: 'long', moustache: true }); on(o.g, 0.07);
        cap(o.head, M, 0.14);
        put(o.g, rbox(0.05, 0.28, 0.015, M.ivory, 0.006), 0, 0.5, 0.18);
      }
    } else if (t === 'R') {
      on(chariot(M), 0.07).position.z = -0.14;
      const w = person(M, { armour: true, brow: 'fierce', mouth: chu ? 'shout' : 'grin', beard: 'full' }); on(w.g, 0.07, 0.85).position.z = 0.12;
      if (chu) { helmet(w.head, M, 0); horns(w.head, M); pole(w.arm[0], M, w.hl[0], 1.3, 'glaive'); rig = { arm: w.arm[0], kind: 'swing' }; }
      else { helmet(w.head, M, 0.14); pole(w.arm[0], M, w.hl[0], 1.3, 'spear'); shield(w.arm[1], M, w.hl[1], true); rig = { arm: w.arm[0], kind: 'thrust' }; }
    } else if (t === 'N') {
      on(horse(M, chu), 0.07);
      const r = person(M, { armour: true, brow: chu ? 'fierce' : 'calm', mouth: chu ? 'grin' : 'smirk', moustache: !chu }); on(r.g, 0.6, 0.6).position.z = -0.04;
      helmet(r.head, M, 0.2); pole(r.arm[0], M, r.hl[0], 1.5, 'spear'); rig = { arm: r.arm[0], kind: 'thrust' };
    } else if (t === 'C') {
      const tb = on(trebuchet(M, chu), 0.07); rig = { arm: tb.userData.arm, kind: 'throw' };
    } else {   /* the foot soldier: the smallest toy, earnest and brave */
      const p = person(M, { armour: true, brow: 'fierce', mouth: 'smile' }); on(p.g, 0.07, 0.85);
      helmet(p.head, M, 0.1); pole(p.arm[0], M, p.hl[0], 1.15, chu ? 'ge' : 'ji'); shield(p.arm[1], M, p.hl[1], chu); rig = { arm: p.arm[0], kind: chu ? 'swing' : 'thrust' };
    }
    g.userData.stone = { glowMat: M.glow, glow: 0, rig, rest: rig.arm ? rig.arm.rotation.x : 0 };
    return g;
  }

  window.XQToy = { figure, BADGE_Y };
})();
