/* 花月象棋 — the rendering look: correct color space, filmic tone mapping and soft sky light.
 * The rest of the code writes colors as plain sRGB hex (three.js r128 has no automatic color management),
 * so manage(root) converts every material, texture, vertex color, light and fog it finds once, marking what it did.
 * Run it after building the scene and again whenever new objects appear (game.js calls it from the render loop).
 * Paper-doll cards set toneMapped: false so the illustrations keep their exact colors.
 */
(function () {
  const EXPOSURE = 1.0;
  /* ACES filmic was tried first and pulled the pastel grass and petals toward gray; the picture-book palette wants its colors kept */
  const TONE = THREE.NoToneMapping;

  function setup(renderer, scene) {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = TONE;
    renderer.toneMappingExposure = EXPOSURE;
    renderer.physicallyCorrectLights = false;
    /* a soft studio sky for image-based light: gives matte materials gentle sheen and colored bounce instead of flat fills */
    if (THREE.RoomEnvironment) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
  }

  const lin = c => { if (c && c.isColor) c.convertSRGBToLinear(); };
  const MAPS = ['map', 'emissiveMap'];
  function material(m) {
    if (!m || m.userData.cm) return; m.userData.cm = true;
    lin(m.color); lin(m.emissive);
    MAPS.forEach(k => { const t = m[k]; if (t && t.encoding !== THREE.sRGBEncoding) { t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; } });
    if (m.envMap === null && m.isMeshStandardMaterial) m.envMapIntensity = 0.3;
    m.needsUpdate = true;
  }
  function geometry(g) {
    if (!g || g.userData.cm || !g.attributes || !g.attributes.color) return; g.userData.cm = true;
    const a = g.attributes.color, c = new THREE.Color();
    for (let i = 0; i < a.count; i++) { c.setRGB(a.getX(i), a.getY(i), a.getZ(i)).convertSRGBToLinear(); a.setXYZ(i, c.r, c.g, c.b); }
    a.needsUpdate = true;
  }
  function manage(root) {
    if (root.isScene) {
      if (root.background && root.background.isColor && !root.userData.cmBg) { root.userData.cmBg = true; lin(root.background); }
      if (root.fog && !root.fog.userData) root.fog.userData = {};
      if (root.fog && !root.fog.userData.cm) { root.fog.userData.cm = true; lin(root.fog.color); }
    }
    root.traverse(o => {
      if (o.isLight && !o.userData.cm) { o.userData.cm = true; lin(o.color); lin(o.groundColor); }
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(material);
      if (o.geometry && o.material && o.material.vertexColors) geometry(o.geometry);
    });
  }

  window.XQLook = { setup, manage };
})();
