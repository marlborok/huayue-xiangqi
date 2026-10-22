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
  /* the flower pictures are pale pink on a pale meadow and blur into it, so every card gets a thin colored edge
   * (like a sticker cut-out) and the flower side a little more saturation and contrast */
  const EDGE = { r: '#B5485F', b: '#262B58' }, LIFT = { r: 'saturate(1.18) contrast(1.08)', b: 'none' }, PAD = 4;
  function prepare(img, side) {
    const cv = document.createElement('canvas'); cv.width = img.width + PAD * 2; cv.height = img.height + PAD * 2;
    const g = cv.getContext('2d');
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.drawImage(img, PAD + Math.cos(a) * 2.5, PAD + Math.sin(a) * 2.5); }
    g.globalCompositeOperation = 'source-in'; g.fillStyle = EDGE[side]; g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'source-over'; g.filter = LIFT[side]; g.drawImage(img, PAD, PAD);
    return cv;
  }
  const progress = { done: 0, total: TYPES.length * 2, on: null };   /* set progress.on(done, total) to follow the loading */
  const ready = Promise.all(['r', 'b'].flatMap(s => TYPES.map(async t => {
    const cv = prepare(await load(`assets/paper/${FILE[s]}-${t}.png`), s);
    tex[s][t] = new THREE.CanvasTexture(cv); size[s][t] = cv.width / cv.height;
    progress.done++; if (progress.on) progress.on(progress.done, progress.total);
  }))).then(() => true, () => false);

  let blobM = null;
  function blobMat() {
    if (blobM) return blobM;
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 32, 0, 64, 32, 32);
    gr.addColorStop(0, 'rgba(60,30,40,0.55)'); gr.addColorStop(0.6, 'rgba(60,30,40,0.22)'); gr.addColorStop(1, 'rgba(60,30,40,0)');
    g.setTransform(2, 0, 0, 1, -64, 0); g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    blobM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, toneMapped: false });
    return blobM;
  }

  function figure(side, t, aniso) {
    const map = tex[side][t]; map.anisotropy = aniso || 1;
    const H = HEIGHT[t], W = H * size[side][t];
    const g = new THREE.Group(), card = new THREE.Group(); g.add(card);
    /* unlit: the illustration carries its own shading, scene lights would only muddy it */
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, toneMapped: false }));
    m.position.y = H / 2; m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.35 });
    card.add(m);
    const top = new THREE.Object3D(); top.position.y = H; card.add(top);
    /* contact shadow: a soft dark smudge right under her feet, so the card reads as standing on the land */
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.75, 0.42), blobMat());
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = 1; g.add(blob);
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

  window.XQPaper = { ready, progress, figure, face, top, BADGE_Y, BADGE_UP };
})();
