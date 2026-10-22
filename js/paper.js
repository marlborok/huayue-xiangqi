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
    const cv = prepare(await load(`assets/paper/${FILE[s]}-${t}.webp`), s);
    tex[s][t] = new THREE.CanvasTexture(cv); size[s][t] = cv.width / cv.height;
    progress.done++; if (progress.on) progress.on(progress.done, progress.total);
  }))).then(() => true, () => false);

  /* optional extra pictures: expressions (-worry, -happy) and the grown-up pawn (P-up). Only the names listed in
   * assets/paper/variants.json are fetched, so a missing drawing costs nothing and the card keeps its usual picture. */
  const extra = { r: {}, b: {} }, extraSize = { r: {}, b: {} };
  const variants = ready.then(ok => ok && fetch('assets/paper/variants.json').then(r => r.ok ? r.json() : []).catch(() => [])).then(list =>
    Promise.all((list || []).map(async name => {          /* e.g. "flower-K-worry" */
      const [file, t, mood] = name.split('-'), s = file === 'flower' ? 'r' : 'b';
      try { const cv = prepare(await load(`assets/paper/${name}.webp`), s); extra[s][t + '-' + mood] = new THREE.CanvasTexture(cv); extraSize[s][t + '-' + mood] = cv.width / cv.height; }
      catch (e) { /* listed but missing: keep the usual picture */ }
    })));

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

  /* watercolor dissolve: as uDis goes 0 -> 1 the picture breaks up along soft noise, its edge bleeding into a wash of the kingdom's colour */
  const WASH = { r: new THREE.Color('#F2A7B8'), b: new THREE.Color('#B7AEE6') };
  function dissolvable(mat, side, dis) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uDis = dis; sh.uniforms.uWash = { value: WASH[side] };
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', `uniform float uDis; uniform vec3 uWash;
          float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + 1.0), f.x), f.y); }
          void main() {`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (uDis > 0.0) {
            float n = vn(vUv * 5.0) * 0.6 + vn(vUv * 17.0) * 0.4;
            n = n * 0.8 + vUv.y * 0.2;                       /* the head melts last */
            if (n < uDis * 1.05) discard;
            float e = smoothstep(uDis * 1.05, uDis * 1.05 + 0.12, n);
            diffuseColor.rgb = mix(uWash, diffuseColor.rgb, e); diffuseColor.a *= mix(0.55, 1.0, e);
          }`);
    };
  }

  function figure(side, t, aniso) {
    const map = tex[side][t]; map.anisotropy = aniso || 1;
    const H = HEIGHT[t], W = H * size[side][t];
    const g = new THREE.Group(), card = new THREE.Group(); g.add(card);
    /* unlit: the illustration carries its own shading, scene lights would only muddy it */
    const dis = { value: 0 }, mat = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, toneMapped: false });
    dissolvable(mat, side, dis);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    m.position.y = H / 2; m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.35 });
    card.add(m);
    const top = new THREE.Object3D(); top.position.y = H; card.add(top);
    /* contact shadow: a soft dark smudge right under her feet, so the card reads as standing on the land */
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.75, 0.42), blobMat());
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = 1; g.add(blob);
    g.userData = { card, top, phase: Math.random() * 6.28, mesh: m, side, t, aspect: size[side][t], look: t, dis, pop: 1 };
    return g;
  }

  /* change her picture: mood 'worry' / 'happy' / null, grown for a pawn over the river; falls back to what exists */
  function setLook(fig, mood, grown) {
    const u = fig.userData; if (!u.mesh) return;
    const base = grown && extra[u.side][u.t + '-up'] ? u.t + '-up' : u.t;
    const want = mood && base === u.t && extra[u.side][u.t + '-' + mood] ? u.t + '-' + mood : base;
    if (want === u.look) return; u.look = want;
    const tx = want === u.t ? tex[u.side][u.t] : extra[u.side][want], a = want === u.t ? u.aspect : extraSize[u.side][want];
    tx.anisotropy = tex[u.side][u.t].anisotropy;
    u.mesh.material.map = tx; u.mesh.customDepthMaterial.map = tx; u.mesh.customDepthMaterial.needsUpdate = true;
    u.mesh.scale.x = a / u.aspect;                         /* keep her height, let the width follow the new picture */
  }
  /* 0 = whole, 1 = gone */
  function dissolve(fig, k) { const u = fig.userData; if (u.dis) { u.dis.value = k; u.mesh.castShadow = k === 0; } }

  /* turn the card toward the camera in its parent's space, so animations on the figure itself (a spin on victory) still show.
   * It also leans back toward a high camera (feet stay planted), otherwise the near top-down home view sees the cards edge-on. */
  const LEAN_BACK = 0.85;       /* share of the camera's elevation the card leans back by: 1 = flat to a straight-down camera */
  const v = new THREE.Vector3();
  /* t (seconds) and amp add an idle sway: a slow rock and a small bob, each card on its own phase; amp 0 holds still */
  function face(fig, camera, t, amp) {
    const card = fig.userData.card; if (!card || !fig.parent) return;
    v.copy(camera.position); fig.parent.worldToLocal(v); v.sub(fig.position);
    const yaw = Math.atan2(v.x, v.z), elev = Math.atan2(v.y, Math.hypot(v.x, v.z));
    const ph = fig.userData.phase, a = amp || 0, k = t || 0;
    /* pop-up book: with pop below 1 she is still lying flat on the page, folding up as it rises */
    const pp = fig.userData.pop === undefined ? 1 : fig.userData.pop, up = pp * pp * (3 - 2 * pp);
    const lean = -Math.max(0, elev) * LEAN_BACK;
    card.rotation.set(-Math.PI / 2 + (lean + Math.PI / 2) * up, yaw, Math.sin(k * 1.7 + ph) * 0.035 * a * up, 'YXZ');
    card.position.y = Math.abs(Math.sin(k * 2.1 + ph)) * 0.035 * a;
  }

  /* world position of the top of the card (her head), so the badge can float above it wherever the card leans */
  function top(fig, out) { return fig.userData.top.getWorldPosition(out); }

  window.XQPaper = { ready, variants, progress, figure, face, top, setLook, dissolve, BADGE_Y, BADGE_UP };
})();
