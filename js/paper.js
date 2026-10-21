/* 花月象棋 — paper-doll characters: the watercolor illustrations in assets/paper/, standing on the board as cards.
 * XQPaper.ready resolves true once all 14 pictures are loaded (false if any fails, so the game keeps the placeholder figures).
 * figure(side, t) returns a THREE.Group standing at y=0 like XQFigures.figure; call face(fig, camera) every frame
 * so the card turns toward the camera around its own upright axis.
 */
(function () {
  const TYPES = ['K', 'A', 'B', 'R', 'N', 'C', 'P'];
  const FILE = { r: 'flower', b: 'moon' };
  /* card height per role: the queens a little taller, the little soldiers shorter */
  const HEIGHT = { K: 1.15, A: 1.05, B: 1.05, R: 1.05, N: 1.1, C: 1.05, P: 0.85 };
  /* badge floats a little above each card's head (game.js moves it with the head as the card leans) */
  const BADGE_UP = 0.3;
  const BADGE_Y = {}; TYPES.forEach(t => { BADGE_Y[t] = HEIGHT[t] + BADGE_UP; });

  const tex = { r: {}, b: {} }, size = { r: {}, b: {} };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const ready = Promise.all(['r', 'b'].flatMap(s => TYPES.map(async t => {
    const img = await load(`assets/paper/${FILE[s]}-${t}.png`);
    const tx = new THREE.Texture(img); tx.needsUpdate = true; tex[s][t] = tx; size[s][t] = img.width / img.height;
  }))).then(() => true, () => false);

  function figure(side, t, aniso) {
    const map = tex[side][t]; map.anisotropy = aniso || 1;
    const H = HEIGHT[t], W = H * size[side][t];
    const g = new THREE.Group(), card = new THREE.Group(); g.add(card);
    /* unlit: the illustration carries its own shading, scene lights would only muddy it */
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
    m.position.y = H / 2; m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.35 });
    card.add(m);
    const top = new THREE.Object3D(); top.position.y = H; card.add(top);
    g.userData.card = card; g.userData.top = top;
    return g;
  }

  /* turn the card toward the camera in its parent's space, so animations on the figure itself (a spin on victory) still show.
   * It also leans back toward a high camera (feet stay planted), otherwise the near top-down home view sees the cards edge-on. */
  const LEAN_BACK = 0.85;       /* share of the camera's elevation the card leans back by: 1 = flat to a straight-down camera */
  const v = new THREE.Vector3();
  function face(fig, camera) {
    const card = fig.userData.card; if (!card || !fig.parent) return;
    v.copy(camera.position); fig.parent.worldToLocal(v); v.sub(fig.position);
    const yaw = Math.atan2(v.x, v.z), elev = Math.atan2(v.y, Math.hypot(v.x, v.z));
    card.rotation.set(-Math.max(0, elev) * LEAN_BACK, yaw, 0, 'YXZ');
  }

  /* world position of the top of the card (her head), so the badge can float above it wherever the card leans */
  function top(fig, out) { return fig.userData.top.getWorldPosition(out); }

  window.XQPaper = { ready, figure, face, top, BADGE_Y, BADGE_UP };
})();
