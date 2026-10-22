/* 花月象棋 — placeholder 3D characters and badge textures.
 * figure(side, t) returns a THREE.Group standing at y=0, facing +z, about 1 unit tall.
 * Swap this module for a GLTFLoader version once the Tripo models are ready.
 */
(function () {
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55 }, o || {}));
  const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m);
  const put = (p, m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  const torus = (r, tube, m, arc) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24, arc || Math.PI * 2), m);

  function figure(side, t) {
    const red = side === 'r';
    const skin = M('#F8DCC8'), dress = M(red ? '#F27D93' : '#4457A0');
    const trim = M(red ? '#F2BE4A' : '#C9CDE0', { metalness: red ? 0.3 : 0.6, roughness: 0.35 });
    const hair = M(red ? '#6B3A2E' : '#2B2547'), acc = M(red ? '#FF9EB4' : '#B7A6F0');
    const glow = M(red ? '#FFD1DC' : '#CBBDFF', { emissive: red ? '#FF8FB1' : '#8E78E8', emissiveIntensity: 0.6 });
    const dark = M('#2A1E22');
    const g = new THREE.Group(), rider = new THREE.Group(); g.add(rider);

    if (t === 'N') { /* steed: unicorn (red) / pegasus (black) */
      const hb = M(red ? '#FFE6EE' : '#F4F4FF');
      const b = sph(0.24, hb); b.scale.set(1, 0.8, 1.5); put(g, b, 0, 0.38, 0);
      const h = sph(0.13, hb); h.scale.set(1, 1.1, 1.4); put(g, h, 0, 0.6, 0.33);
      put(h, sph(0.025, dark), 0.07, 0.03, 0.08); put(h, sph(0.025, dark), -0.07, 0.03, 0.08);
      [[0.12, 0.18], [-0.12, 0.18], [0.12, -0.18], [-0.12, -0.18]].forEach(([x, z]) =>
        put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 10), hb), x, 0.15, z));
      const mane = sph(0.08, acc); mane.scale.set(0.6, 1.6, 1.2); put(g, mane, 0, 0.64, 0.2);
      if (red) put(g, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 10), trim), 0, 0.76, 0.4).rotation.x = 0.5;
      else [1, -1].forEach(s => { put(g, new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.18), trim), s * 0.26, 0.52, -0.05).rotation.z = s * 0.55; });
      rider.position.y = 0.42; rider.scale.setScalar(0.72);
    }

    /* the girl */
    put(rider, new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.5, 28), dress), 0, 0.25, 0);
    const belt = torus(0.12, 0.022, trim); belt.rotation.x = Math.PI / 2; put(rider, belt, 0, 0.38, 0);
    put(rider, sph(0.05, skin), 0.17, 0.33, 0.08); put(rider, sph(0.05, skin), -0.17, 0.33, 0.08);
    const head = new THREE.Group(); head.position.y = 0.66; rider.add(head);
    put(head, sph(0.22, skin), 0, 0, 0);
    const hc = new THREE.Mesh(new THREE.SphereGeometry(0.235, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hc.rotation.x = -0.35; put(head, hc, 0, 0.01, -0.01);
    put(head, sph(0.032, dark), 0.075, 0, 0.2); put(head, sph(0.032, dark), -0.075, 0, 0.2);
    put(head, sph(0.036, M('#FFB3C1')), 0.13, -0.065, 0.16); put(head, sph(0.036, M('#FFB3C1')), -0.13, -0.065, 0.16);

    switch (t) {
      case 'K':
        put(rider, new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), trim), 0.22, 0.45, 0.1);
        if (red) {
          const band = torus(0.15, 0.025, trim); band.rotation.x = Math.PI / 2; put(head, band, 0, 0.17, 0);
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(head, sph(0.055, acc), Math.cos(a) * 0.15, 0.21, Math.sin(a) * 0.15); }
          put(rider, sph(0.06, glow), 0.22, 0.72, 0.1);
        } else {
          const moon = torus(0.13, 0.035, trim, Math.PI * 1.3); moon.rotation.z = -0.65; put(head, moon, 0, 0.25, 0);
          put(rider, new THREE.Mesh(new THREE.OctahedronGeometry(0.07), glow), 0.22, 0.73, 0.1);
        }
        break;
      case 'A':
        put(head, sph(0.09, hair), 0.18, 0.12, -0.03); put(head, sph(0.09, hair), -0.18, 0.12, -0.03);
        if (red) { put(rider, new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.08, 16), trim), 0.2, 0.28, 0.14); put(rider, sph(0.04, acc), 0.2, 0.34, 0.14); }
        else put(rider, sph(0.07, glow), 0.2, 0.28, 0.14);
        break;
      case 'B':
        if (red) {
          [1, -1].forEach(s => put(head, torus(0.05, 0.01, dark), s * 0.075, 0, 0.21));
          put(rider, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.06), acc), 0, 0.36, 0.2);
        } else {
          put(head, new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.36, 20), dress), 0, 0.32, 0).rotation.x = -0.15;
          put(head, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 28), dress), 0, 0.15, 0);
          put(rider, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 12), trim), 0.2, 0.42, 0.12).rotation.x = 0.9;
        }
        break;
      case 'R': {
        put(head, new THREE.Mesh(new THREE.SphereGeometry(0.245, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), trim), 0, 0.02, 0);
        put(head, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 10), acc), 0, 0.32, -0.04);
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20), trim); sh.rotation.x = Math.PI / 2; put(rider, sh, -0.22, 0.3, 0.1);
        [1, -1].forEach(s => { const w = torus(0.16, 0.03, acc); w.rotation.y = Math.PI / 2; put(g, w, s * 0.33, 0.17, -0.12); });
        break;
      }
      case 'C':
        if (red) {
          [1, -1].forEach(s => { put(head, torus(0.055, 0.016, trim), s * 0.08, 0.1, 0.19); put(head, sph(0.045, M('#BFE8F2')), s * 0.08, 0.1, 0.18); });
          put(rider, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 16), trim), 0.1, 0.5, -0.2).rotation.x = -0.7;
        } else {
          put(head, new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.3, 20), dress), 0, 0.2, -0.04);
          put(rider, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), trim), 0.22, 0.42, 0.12);
          put(rider, new THREE.Mesh(new THREE.OctahedronGeometry(0.05), glow), 0.22, 0.62, 0.12);
          [[0.36, 0.6, 0.1], [0.42, 0.8, -0.05], [-0.36, 0.7, 0]].forEach(p => put(rider, sph(0.05, M('#E4DBFF', { transparent: true, opacity: 0.7 })), ...p));
        }
        break;
      case 'P':
        if (red) {
          for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; put(head, sph(0.06, acc), Math.cos(a) * 0.09, 0.22, Math.sin(a) * 0.09); }
          put(head, sph(0.05, M('#FFD54F')), 0, 0.24, 0);
        } else put(head, new THREE.Mesh(new THREE.OctahedronGeometry(0.08), glow), 0, 0.3, 0);
        break;
    }
    g.scale.setScalar(t === 'K' ? 1.08 : t === 'P' ? 0.82 : 0.96);
    return g;
  }

  /* height of the floating badge above the board, per piece type */
  const BADGE_Y = { N: 1.42, K: 1.28, P: 1.0, A: 1.18, B: 1.18, R: 1.18, C: 1.18 };

  function badgeTexture(side, ch, aniso) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    /* an ink stamp on cream paper: a slightly uneven double ring, ink a little patchy, so it sits with the watercolor art */
    const main = side === 'r' ? '#C8304C' : '#34457E';
    const blob = (r, wob) => { g.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, rr = r + Math.sin(a * 3 + wob) * 2.2 + Math.sin(a * 5 + wob * 2) * 1.4; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); } g.closePath(); };
    g.fillStyle = main; blob(126, side === 'r' ? 0.4 : 1.7); g.fill();
    g.fillStyle = '#FFF8EC'; blob(114, 2.3); g.fill();
    g.strokeStyle = main; g.lineWidth = 3; blob(105, 0.9); g.stroke();
    /* paper tooth showing through the ink */
    for (let i = 0; i < 260; i++) { const a = Math.random() * 7, r = 114 + Math.random() * 12; g.fillStyle = 'rgba(255,248,236,0.55)'; g.fillRect(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2, 2); }
    /* large glyph, thickened with a stroke of the same colour so it reads as bold even at small sizes */
    g.font = '700 168px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.strokeStyle = main; g.lineWidth = 9; g.strokeText(ch, 128, 138);
    g.fillStyle = main; g.fillText(ch, 128, 138);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = aniso || 1; return t;
  }

  window.XQFigures = { figure, badgeTexture, BADGE_Y, M };
})();
