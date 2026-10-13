/* ==========================================================================
   SAMA ARCHITECT · Simulador Interactivo 3D
   JavaScript ES6+ · Three.js r128
   --------------------------------------------------------------------------
   Requisito matemático (ver objeto `Mat` y `calcular()`):
   1. Decimales  : cotas, alturas de entrepiso (2.85 m), áreas y volúmenes exactos.
   2. Lineales   : Costo = Área × Valor_M2 + Costos_Fijos (por nivel) y
                   balance térmico Q = Σ U·A·ΔT.
   3. Cuadráticas: Área = −x² + b·x  (b = P/2) y arco parabólico
                   y(x) = −(4f/L²)·x² + (4f/L)·x  (flecha f, luz L).
   ========================================================================== */
'use strict';

/* ===========================  1. NÚCLEO MATEMÁTICO  ====================== */
const Mat = {
  b: P => P / 2,                                   // semiperímetro
  fondo: (x, b) => b - x,                          // lado complementario del lote
  area: (x, b) => -x * x + b * x,                  // A(x) = -x² + b·x
  xOptimo: b => b / 2,                             // vértice: x* = b/2
  areaMax: b => (b * b) / 4,                       // A(x*) = b²/4
  costo: (A, valorM2, fijos) => A * valorM2 + fijos,   // C(A) = A·Valor_M2 + Costos_Fijos
  arcoA: (L, f) => -(4 * f) / (L * L),             // coeficiente cuadrático del arco
  arcoB: (L, f) => (4 * f) / L,                    // coeficiente lineal del arco
  arcoY: (x, L, f) => -(4 * f) / (L * L) * x * x + (4 * f) / L * x,
  perdida: (U, A, dT) => U * A * dT,               // Q = U·A·ΔT (W)
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  suave: (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); },
  fmt: (v, d = 2) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  r2: v => Math.round(v * 100) / 100
};
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const prog = (t, t0, dur) => Mat.clamp((t - t0) / dur, 0, 1);

/* ===========================  2. CONFIGURACIÓN  ========================== */
const TIPOS = {
  casa:        { nombre: 'Casa',          icono: '🏠', P: 44, x: 8.0,  pisos: 2,  max: 3,  h: 2.85, hPB: 2.85, valor: 1200, fijos: 5000,  L: 2.2 },
  edificio:    { nombre: 'Edificio',      icono: '🏢', P: 60, x: 11.5, pisos: 10, max: 20, h: 2.85, hPB: 3.45, valor: 1400, fijos: 12000, L: 3.4 },
  hotel:       { nombre: 'Hotel de lujo', icono: '🏨', P: 80, x: 15.0, pisos: 8,  max: 14, h: 2.85, hPB: 3.65, valor: 2600, fijos: 30000, L: 4.2 },
  restaurante: { nombre: 'Restaurante',   icono: '🍽️', P: 56, x: 10.5, pisos: 1,  max: 3,  h: 2.85, hPB: 3.65, valor: 1800, fijos: 9000,  L: 3.0 }
};

const MATERIALES = {
  estuco:   { nombre: 'Estuco blanco',   color: 0xf3ece0, rug: .9,  met: 0,   U: 1.8, k: 0.90 },
  concreto: { nombre: 'Concreto',        color: 0x9c9c9c, rug: .95, met: 0,   U: 2.1, k: 1.00 },
  vidrio:   { nombre: 'Vidrio templado', color: 0x8fc7e6, rug: .15, met: .35, U: 5.8, k: 1.35 },
  madera:   { nombre: 'Madera',          color: 0xb07a45, rug: .8,  met: 0,   U: 0.9, k: 0.85 },
  ladrillo: { nombre: 'Ladrillo',        color: 0xb5553a, rug: .9,  met: 0,   U: 1.6, k: 0.95 },
  marmol:   { nombre: 'Mármol',          color: 0xefe9dc, rug: .25, met: .1,  U: 2.8, k: 1.60 }
};

const ESTILOS = {
  moderno:      { nombre: 'Moderno minimalista',     mat: 'vidrio',   vent: 'banda',   balcon: 'vidrio',    techo: 'plano',      marco: 'acentoOscuro', cornisa: 'acentoOscuro', desplaza: true, flecha: 1.0 },
  mediterraneo: { nombre: 'Mediterráneo con arcos',  mat: 'estuco',   vent: 'arco',    balcon: 'hierro',    techo: 'teja',       marco: 'blanco',       cornisa: 'terracota',    flecha: 1.1 },
  industrial:   { nombre: 'Industrial brutalista',   mat: 'concreto', vent: 'rejilla', balcon: 'hierro',    techo: 'industrial', marco: 'acero',        cornisa: 'acero',        flecha: 0.8 },
  deco:         { nombre: 'Art Déco de lujo',        mat: 'marmol',   vent: 'esbelta', balcon: 'dorado',    techo: 'escalonado', marco: 'dorado',       cornisa: 'dorado',       flecha: 1.8 },
  eco:          { nombre: 'Ecológico bioclimático',  mat: 'madera',   vent: 'media',   balcon: 'jardinera', techo: 'verde',      marco: 'madOscura',    cornisa: 'madOscura',    flecha: 1.4 }
};

const VENT = {
  banda:   { tipo: 'caja', sp: 6.2, fw: .9,  fh: .62, y: .5 },
  arco:    { tipo: 'arco', sp: 3.4, fw: .5,  y0: .2 },
  rejilla: { tipo: 'caja', sp: 3.4, fw: .78, fh: .6,  y: .55 },
  esbelta: { tipo: 'caja', sp: 3.1, fw: .42, fh: .74, y: .5 },
  media:   { tipo: 'caja', sp: 3.8, fw: .6,  fh: .58, y: .52 }
};

const AVATARES = [
  { id: 'aleja',  nombre: 'Aleja',  estilo: 'moderno',      tipo: 'casa',        color: '#ff5fa2', piel: 0xf1c27d, pelo: 0x2b1b12, ropa: 0xff5fa2, pantalon: 0x2d3350, casco: 0xffffff, genero: 'f' },
  { id: 'diana',  nombre: 'Diana',  estilo: 'mediterraneo', tipo: 'restaurante', color: '#ff9a3c', piel: 0xe0ac69, pelo: 0x6b3a1e, ropa: 0xff9a3c, pantalon: 0x3a2f2a, casco: 0xffd54a, genero: 'f' },
  { id: 'andres', nombre: 'Andres', estilo: 'industrial',   tipo: 'edificio',    color: '#8aa0b8', piel: 0xc68642, pelo: 0x1a1a1a, ropa: 0x8aa0b8, pantalon: 0x2a2f3a, casco: 0xff5a36, genero: 'm' },
  { id: 'alfred', nombre: 'Alfred', estilo: 'deco',         tipo: 'hotel',       color: '#e8c24a', piel: 0xf3d2b3, pelo: 0x9a9a9a, ropa: 0x1d2236, pantalon: 0x1d2236, casco: 0xe8c24a, genero: 'm', bigote: true },
  { id: 'diego',  nombre: 'Diego',  estilo: 'eco',          tipo: 'edificio',    color: '#5ee6a8', piel: 0x8d5524, pelo: 0x2a1a0e, ropa: 0x5ee6a8, pantalon: 0x4a3a28, casco: 0x3fae6a, genero: 'm', barba: true }
];

/* ===========================  3. APLICACIÓN  ============================= */
function iniciar() {
  const $ = id => document.getElementById(id);
  const col = h => new THREE.Color(h).convertSRGBToLinear();
  const std = (h, rug = .8, met = 0, ex = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: col(h), roughness: rug, metalness: met }, ex));
  const rnd = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

  /* ---------- Renderer, cámara y controles ---------- */
  const lienzo = $('lienzo3d'), vista = $('vista3d');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(48, 1, 0.5, 4000);
  camara.position.set(0, 230, 300);
  const controles = new THREE.OrbitControls(camara, lienzo);
  controles.enableDamping = true; controles.dampingFactor = .07;
  controles.maxPolarAngle = Math.PI / 2 - 0.03; controles.minDistance = 12; controles.maxDistance = 650;
  controles.target.set(0, 8, 0);
  controles.autoRotate = true; controles.autoRotateSpeed = .5;

  /* ---------- Materiales compartidos ---------- */
  const M = {
    vidrioVent: std(0x1f3b57, .08, .55, { emissive: col(0xffd27a), emissiveIntensity: 0 }),
    vidrioClaro: std(0x9fd6ee, .05, .3, { transparent: true, opacity: .45 }),
    acentoOscuro: std(0x23272e, .5, .3), acero: std(0x4b5058, .45, .7), dorado: std(0xd4a82b, .28, .85),
    terracota: std(0xc0623a, .8, 0, { flatShading: true }), verde: std(0x3f8f3c, .95), verdeOsc: std(0x2e6a2c, .95),
    blanco: std(0xf4f4f0, .6), madOscura: std(0x5a3a22, .8), madClara: std(0xc89a62, .8), hierro: std(0x2b2b2b, .5, .6),
    concretoOsc: std(0x6d6d70, .95), agua: std(0x3aa8e0, .08, .1, { transparent: true, opacity: .85, emissive: col(0x0b4a77), emissiveIntensity: .35 }),
    rojo: std(0xb21f2d, .8), alfombra: std(0x9d1020, .95), bombilla: std(0xfff1b8, .4, 0, { emissive: col(0xffd36a), emissiveIntensity: 0 }),
    faro: std(0xff3030, .4, 0, { emissive: col(0xff2020), emissiveIntensity: 1 }), ladrilloRojo: std(0x9a4a35, .9),
    boveda: std(0x4c9a46, .95), panel: std(0x14285a, .2, .6), neumatico: std(0x151515, .9), llanta: std(0xbbbbbb, .3, .8),
    tronco: std(0x6b4a2b, .9), hoja: std(0x3e8e3e, .9, 0, { flatShading: true }), pasto: std(0x5a9a46, 1),
    camino: std(0xcfc6b4, .95), borde: std(0xffffff, .5, 0, { emissive: col(0xffffff), emissiveIntensity: .5 }),
    sol: new THREE.MeshBasicMaterial({ color: col(0xfff3c4), fog: false }), luna: new THREE.MeshBasicMaterial({ color: col(0xdfe8ff), fog: false })
  };
  Object.keys(MATERIALES).forEach(k => {
    const m = MATERIALES[k];
    m.m = std(m.color, m.rug, m.met);
    if (k === 'vidrio') { m.m.emissive = col(0x1a3a52); m.m.emissiveIntensity = .25; }
  });

  /* ---------- Utilidades de geometría ---------- */
  const geoCaja = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  function caja(w, h, d, mat, x = 0, y = 0, z = 0, sombra = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; return m;
  }
  function cil(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16, sombra = true) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; return m;
  }
  function esf(r, mat, x = 0, y = 0, z = 0, seg = 14) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), mat);
    m.position.set(x, y, z); m.castShadow = true; return m;
  }
  function liberar(obj) {
    obj.traverse(o => {
      if (o.geometry && !o.userData.compartida) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
  }
  function texturaTexto(texto, o = {}) {
    const w = o.w || 512, h = o.h || 128;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = o.fondo || '#10131c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = o.borde || '#ffffff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    let tam = o.tam || 56;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = o.color || '#ffffff';
    g.font = '700 ' + tam + 'px "Segoe UI", sans-serif';
    while (tam > 18 && g.measureText(texto).width > w - 50) { tam -= 4; g.font = '700 ' + tam + 'px "Segoe UI", sans-serif'; }
    g.fillText(texto, w / 2, h / 2 + 3);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function texCirculo() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /* ---- Arco parabólico: y(x) = hR + (−4f/L²)x² + (4f/L)x  (ecuación cuadrática) ---- */
  function formaArco(L, hR, f, x0 = 0, y0 = 0) {
    const s = new THREE.Shape();
    s.moveTo(x0, y0); s.lineTo(x0 + L, y0); s.lineTo(x0 + L, y0 + hR);
    const N = 18;
    for (let i = 1; i < N; i++) { const u = L * (1 - i / N); s.lineTo(x0 + u, y0 + hR + Mat.arcoY(u, L, f)); }
    s.lineTo(x0, y0 + hR);
    return s;
  }
  function geoArco(L, hR, f, prof) {
    const g = new THREE.ExtrudeGeometry(formaArco(L, hR, f), { depth: prof, bevelEnabled: false });
    g.translate(-L / 2, 0, 0); return g;
  }
  function geoMarcoArco(L, hR, f, prof) {          // marco con hueco (puerta)
    const L2 = L + 0.7, outer = formaArco(L2, hR, f + 0.35);
    outer.holes.push(formaArco(L, hR - 0.3, f, 0.35, 0.3));
    const g = new THREE.ExtrudeGeometry(outer, { depth: prof, bevelEnabled: false });
    g.translate(-L2 / 2, 0, 0); return g;
  }

  /* ---------- Cielo, luces y ciclo día/noche ---------- */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vY; void main(){ float t = smoothstep(-0.05,0.65,vY); gl_FragColor = vec4(mix(bottom,top,t),1.0); #include <encodings_fragment> }',
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat); cielo.renderOrder = -10; cielo.frustumCulled = false; escena.add(cielo);
  escena.fog = new THREE.Fog(0x9fc5e8, 260, 1000);

  const hemi = new THREE.HemisphereLight(0xbfdcff, 0x4a6a3a, .8); escena.add(hemi);
  const solLuz = new THREE.DirectionalLight(0xffffff, 2.5);
  solLuz.castShadow = true; solLuz.shadow.mapSize.set(2048, 2048);
  Object.assign(solLuz.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 800 });
  solLuz.shadow.bias = -0.0004; solLuz.shadow.normalBias = 0.4; escena.add(solLuz); escena.add(solLuz.target);
  const lunaLuz = new THREE.DirectionalLight(0x8fa8ff, 0); escena.add(lunaLuz);

  const solDisco = new THREE.Mesh(new THREE.SphereGeometry(35, 16, 12), M.sol); solDisco.frustumCulled = false; escena.add(solDisco);
  const lunaDisco = new THREE.Mesh(new THREE.SphereGeometry(26, 16, 12), M.luna); lunaDisco.frustumCulled = false; escena.add(lunaDisco);
  const estrellasGeo = new THREE.BufferGeometry(), ePos = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const a = rnd() * Math.PI * 2, e = Math.acos(rnd() * .95 + .05), r = 1350;
    ePos[i * 3] = r * Math.sin(e) * Math.cos(a); ePos[i * 3 + 1] = r * Math.cos(e); ePos[i * 3 + 2] = r * Math.sin(e) * Math.sin(a);
  }
  estrellasGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const estrellas = new THREE.Points(estrellasGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  estrellas.frustumCulled = false; escena.add(estrellas);

  const PAL = {
    diaTop: col(0x3f86d6), diaBot: col(0xbfe0ff), nocheTop: col(0x050818), nocheBot: col(0x141c3a),
    ocasoTop: col(0x5a4a8a), ocasoBot: col(0xff9a5a), solBlanco: col(0xfff6e6), solNaranja: col(0xff8a3a)
  };
  let horaActual = 15.3, noche = 0, altSol = .8;
  const _c1 = new THREE.Color(), _c2 = new THREE.Color();
  function actualizarCielo(h) {
    horaActual = h;
    const ang = (h - 6) / 12 * Math.PI;
    const dir = new THREE.Vector3(Math.cos(ang) * .9, Math.sin(ang), .42).normalize();
    altSol = dir.y;
    const dia = Mat.suave(-0.05, 0.25, altSol);
    const ocaso = Math.max(0, 1 - Math.abs(altSol) / .3) * (altSol > -.2 ? 1 : 0);
    noche = 1 - dia;
    _c1.copy(PAL.nocheTop).lerp(PAL.diaTop, dia).lerp(PAL.ocasoTop, ocaso * .55);
    _c2.copy(PAL.nocheBot).lerp(PAL.diaBot, dia).lerp(PAL.ocasoBot, ocaso * .8);
    skyMat.uniforms.top.value.copy(_c1); skyMat.uniforms.bottom.value.copy(_c2);
    escena.fog.color.copy(_c2);
    solLuz.position.copy(dir).multiplyScalar(380);
    solLuz.intensity = 2.8 * dia * Math.max(.25, Math.min(1, altSol * 1.6));
    solLuz.color.copy(PAL.solBlanco).lerp(PAL.solNaranja, ocaso * .9);
    lunaLuz.position.copy(dir).multiplyScalar(-380); lunaLuz.intensity = .55 * noche;
    hemi.intensity = .22 + .75 * dia + .1 * ocaso;
    hemi.color.copy(_c1).lerp(new THREE.Color(1, 1, 1), .35);
    renderer.toneMappingExposure = .95 + .2 * dia;
    M.vidrioVent.emissiveIntensity = noche * .95;
    M.bombilla.emissiveIntensity = noche * 2.2;
    estrellas.material.opacity = Math.max(0, noche - .15);
    solDisco.visible = altSol > -.12; lunaDisco.visible = altSol < .12;
    solDisco.userData.dir = dir; lunaDisco.userData.dir = dir.clone().multiplyScalar(-1);
    $('icono-hora').textContent = dia > .5 ? '☀️' : '🌙';
    const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
    $('hora-txt').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  /* ---------- Terreno, plaza, caminos, vegetación ---------- */
  function texturaCesped() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#4d8b3f'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = 'hsl(' + (90 + rnd() * 30) + ',' + (40 + rnd() * 20) + '%,' + (26 + rnd() * 18) + '%)'; g.fillRect(rnd() * 256, rnd() * 256, 2, 2 + rnd() * 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(750, 72), new THREE.MeshStandardMaterial({ map: texturaCesped(), roughness: 1 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; escena.add(suelo);

  const R = 100, PAD = 52;
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(46, 64), std(0xd7cfbf, .9)); plaza.rotation.x = -Math.PI / 2; plaza.position.y = .05; plaza.receiveShadow = true; escena.add(plaza);
  const calle = new THREE.Mesh(new THREE.RingGeometry(50, 62, 80), std(0x34363c, .95)); calle.rotation.x = -Math.PI / 2; calle.position.y = .04; calle.receiveShadow = true; escena.add(calle);
  const lineaCalle = new THREE.Mesh(new THREE.RingGeometry(55.8, 56.2, 80), std(0xf2e8b0, .8)); lineaCalle.rotation.x = -Math.PI / 2; lineaCalle.position.y = .06; escena.add(lineaCalle);

  // Fuente central con chorros parabólicos (tiro parabólico y = v·t − ½·g·t²)
  const fuente = new THREE.Group();
  fuente.add(cil(11, 11.5, 1.4, std(0xb9b2a3, .8), 0, .7, 0, 40));
  const aguaF = cil(10.2, 10.2, .2, M.agua, 0, 1.3, 0, 40, false); fuente.add(aguaF);
  fuente.add(cil(1.3, 1.8, 6, std(0xc9c2b2, .7), 0, 3.4, 0, 20));
  fuente.add(cil(4, 1.6, 1.2, std(0xc9c2b2, .7), 0, 6.4, 0, 24));
  const anilloF = new THREE.Mesh(new THREE.TorusGeometry(6.5, .35, 10, 48), M.dorado); anilloF.position.y = 4.2; anilloF.rotation.x = Math.PI / 2.4; anilloF.castShadow = true; fuente.add(anilloF);
  escena.add(fuente);

  // Farolas
  const farolas = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, g = new THREE.Group();
    g.add(cil(.22, .3, 6, M.hierro, 0, 3, 0, 8)); g.add(esf(.8, M.bombilla, 0, 6.3, 0, 10));
    g.position.set(Math.cos(a) * 47.5, 0, Math.sin(a) * 47.5); farolas.add(g);
  }
  escena.add(farolas);

  // Bosque y montañas (instanciados para rendimiento)
  function bosque(n, rMin, rMax, sombra) {
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(.5, .8, 5, 6), M.tronco, n);
    const h1 = new THREE.InstancedMesh(new THREE.ConeGeometry(4.2, 9, 7), M.hoja, n);
    const h2 = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 7, 7), M.hoja, n);
    [tr, h1, h2].forEach(m => { m.frustumCulled = false; m.castShadow = sombra; m.receiveShadow = false; });
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin), s = .8 + rnd() * 1.1, x = Math.cos(a) * r, z = Math.sin(a) * r;
      dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.setScalar(s);
      dummy.position.set(x, 2.5 * s, z); dummy.updateMatrix(); tr.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 8.5 * s, z); dummy.updateMatrix(); h1.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 12.2 * s, z); dummy.updateMatrix(); h2.setMatrixAt(i, dummy.matrix);
    }
    escena.add(tr, h1, h2);
  }
  bosque(90, 140, 230, true); bosque(260, 235, 520, false);
  // Árboles entre lotes
  (function () {
    const n = 5 * 3, tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(.5, .8, 5, 6), M.tronco, n), ho = new THREE.InstancedMesh(new THREE.ConeGeometry(4, 10, 7), M.hoja, n);
    [tr, ho].forEach(m => { m.frustumCulled = false; m.castShadow = true; });
    let k = 0;
    for (let i = 0; i < 5; i++) {
      const th = Math.PI / 2 + (i + .5) * 2 * Math.PI / 5;
      for (let j = 0; j < 3; j++) {
        const r = 82 + j * 14 + rnd() * 6, a = th + (rnd() - .5) * .08, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 1.1 + rnd() * .5;
        dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.setScalar(s);
        dummy.position.set(x, 2.5 * s, z); dummy.updateMatrix(); tr.setMatrixAt(k, dummy.matrix);
        dummy.position.set(x, 9 * s, z); dummy.updateMatrix(); ho.setMatrixAt(k, dummy.matrix); k++;
      }
    }
    escena.add(tr, ho);
  })();
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, r = 560 + rnd() * 90, h = 70 + rnd() * 110;
    const mt = new THREE.Mesh(new THREE.ConeGeometry(70 + rnd() * 60, h, 6 + Math.floor(rnd() * 3)), std(0x587a6e, 1, 0, { flatShading: true }));
    mt.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r); mt.rotation.y = rnd() * 3; escena.add(mt);
  }

  // Nubes
  const nubes = [], matNube = std(0xffffff, 1, 0, { transparent: true, opacity: .9, emissive: col(0x8899aa), emissiveIntensity: .25 });
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 5; j++) { const s = esf(10 + rnd() * 9, matNube, j * 11 - 22, rnd() * 4, (rnd() - .5) * 10, 10); s.scale.y = .6; s.castShadow = false; g.add(s); }
    const a = rnd() * Math.PI * 2, r = 80 + rnd() * 420; g.position.set(Math.cos(a) * r, 130 + rnd() * 70, Math.sin(a) * r);
    g.userData.v = 1.5 + rnd() * 2.5; nubes.push(g); escena.add(g);
  }

  /* ---------- Sistema de partículas ---------- */
  const mapaCirculo = texCirculo();
  class Emisor {
    constructor(o) {
      this.max = o.max || 300; this.grav = o.grav === undefined ? -9.8 : o.grav; this.suelo = o.suelo === undefined ? -999 : o.suelo; this.cursor = 0; this.cols = !!o.colores;
      this.pos = new Float32Array(this.max * 3).fill(-1000); this.vel = new Float32Array(this.max * 3); this.vida = new Float32Array(this.max);
      this.colArr = this.cols ? new Float32Array(this.max * 3) : null;
      this.geo = new THREE.BufferGeometry();
      this.atrPos = new THREE.BufferAttribute(this.pos, 3); this.atrPos.setUsage(THREE.DynamicDrawUsage); this.geo.setAttribute('position', this.atrPos);
      if (this.cols) { this.atrCol = new THREE.BufferAttribute(this.colArr, 3); this.geo.setAttribute('color', this.atrCol); }
      this.pts = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: o.size || 1, map: mapaCirculo, color: o.color || 0xffffff, vertexColors: this.cols, transparent: true, opacity: o.opacity || 1, depthWrite: false, sizeAttenuation: true }));
      this.pts.frustumCulled = false; escena.add(this.pts);
    }
    emitir(x, y, z, vx, vy, vz, vida, r, g, b) {
      const i = this.cursor++ % this.max, k = i * 3;
      this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz; this.vida[i] = vida;
      if (this.cols) { this.colArr[k] = r; this.colArr[k + 1] = g; this.colArr[k + 2] = b; }
    }
    actualizar(dt) {
      for (let i = 0; i < this.max; i++) {
        if (this.vida[i] <= 0) continue;
        const k = i * 3; this.vida[i] -= dt; this.vel[k + 1] += this.grav * dt;
        this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
        if (this.vida[i] <= 0 || this.pos[k + 1] < this.suelo) { this.vida[i] = 0; this.pos[k + 1] = -1000; }
      }
      this.atrPos.needsUpdate = true; if (this.cols) this.atrCol.needsUpdate = true;
    }
  }
  const polvo = new Emisor({ max: 260, size: 3.4, color: 0xb9a98c, grav: .6, opacity: .55 });
  const chispas = new Emisor({ max: 160, size: 1.1, color: 0xffd34a, grav: -14, suelo: .2 });
  const confeti = new Emisor({ max: 500, size: 1.5, colores: true, grav: -5, suelo: .3 });
  const humo = new Emisor({ max: 120, size: 4.5, color: 0xd5d5d5, grav: 1.2, opacity: .45 });
  const chorros = new Emisor({ max: 420, size: 1.3, color: 0xa8e0ff, grav: -9.8, suelo: 1.4, opacity: .9 });
  const _v = new THREE.Vector3();

  /* ---------- Avatares (modelo articulado) ---------- */
  function crearModeloAvatar(c) {
    const g = new THREE.Group();
    const mPiel = std(c.piel, .65), mRopa = std(c.ropa, .7), mPant = std(c.pantalon, .8), mPelo = std(c.pelo, .6), mCasco = std(c.casco, .35, .15);
    const mBota = std(0x2a2a2a, .9), mRef = std(0xe9ff3a, .4, 0, { emissive: col(0xaacc00), emissiveIntensity: .35 }), mOjo = std(0x111111, .3), mMango = std(0x8a5a2b, .8), mMetal = std(0x9aa0a8, .4, .8);
    const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
    const cuerpo = new THREE.Group(); g.add(cuerpo);
    const pierna = x => { const p = new THREE.Group(); p.position.set(x, .86, 0); p.add(mk(new THREE.CylinderGeometry(.14, .12, .8, 10), mPant, 0, -.4, 0), mk(new THREE.BoxGeometry(.28, .15, .42), mBota, 0, -.86, .07)); cuerpo.add(p); return p; };
    const legA = pierna(.17), legB = pierna(-.17);
    cuerpo.add(mk(new THREE.CylinderGeometry(.33, .29, .78, 14), mRopa, 0, 1.25, 0));
    cuerpo.add(mk(new THREE.CylinderGeometry(.312, .312, .1, 14), mRef, 0, 1.12, 0));
    cuerpo.add(mk(new THREE.CylinderGeometry(.327, .327, .1, 14), mRef, 0, 1.4, 0));
    const brazo = x => { const a = new THREE.Group(); a.position.set(x, 1.58, 0); a.add(mk(new THREE.CylinderGeometry(.095, .085, .66, 10), mRopa, 0, -.33, 0), mk(new THREE.SphereGeometry(.1, 10, 8), mPiel, 0, -.69, 0)); cuerpo.add(a); return a; };
    const armA = brazo(.43), armB = brazo(-.43);
    const mart = new THREE.Group(); mart.position.set(0, -.69, .08); mart.rotation.x = Math.PI / 2;
    mart.add(mk(new THREE.CylinderGeometry(.03, .03, .5, 8), mMango, 0, .1, 0), mk(new THREE.BoxGeometry(.26, .12, .12), mMetal, 0, .36, 0)); armB.add(mart);
    const cabeza = new THREE.Group(); cabeza.position.y = 1.88; cuerpo.add(cabeza);
    cabeza.add(mk(new THREE.SphereGeometry(.27, 16, 12), mPiel, 0, 0, 0));
    cabeza.add(mk(new THREE.SphereGeometry(.035, 8, 6), mOjo, .09, .03, .245), mk(new THREE.SphereGeometry(.035, 8, 6), mOjo, -.09, .03, .245));
    cabeza.add(mk(new THREE.SphereGeometry(.277, 14, 10, 0, Math.PI * 2, 0, Math.PI * .55), mPelo, 0, .01, -.02));
    if (c.genero === 'f') { cabeza.add(mk(new THREE.BoxGeometry(.5, .6, .16), mPelo, 0, -.2, -.22)); }
    if (c.barba) cabeza.add(mk(new THREE.SphereGeometry(.275, 14, 10, 0, Math.PI * 2, Math.PI * .62, Math.PI * .38), mPelo, 0, 0, .025));
    if (c.bigote) cabeza.add(mk(new THREE.BoxGeometry(.2, .04, .05), mPelo, 0, -.08, .255));
    cabeza.add(mk(new THREE.SphereGeometry(.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mCasco, 0, .05, 0));
    cabeza.add(mk(new THREE.CylinderGeometry(.34, .34, .035, 18), mCasco, 0, .05, .05));
    g.scale.setScalar(2.4);
    return { grupo: g, cuerpo, legA, legB, armA, armB, cabeza };
  }

  function etiquetaCanvas() { const c = document.createElement('canvas'); c.width = 512; c.height = 144; return c; }
  function dibujarEtiqueta(av) {
    const c = av.etqCanvas, g = c.getContext('2d');
    g.clearRect(0, 0, 512, 144);
    g.fillStyle = 'rgba(10,15,31,.88)'; g.beginPath(); g.moveTo(24, 6); g.arcTo(506, 6, 506, 138, 28); g.arcTo(506, 138, 6, 138, 28); g.arcTo(6, 138, 6, 6, 28); g.arcTo(6, 6, 506, 6, 28); g.fill();
    g.lineWidth = 6; g.strokeStyle = av.color; g.stroke();
    g.fillStyle = av.color; g.font = '800 54px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(av.nombre.toUpperCase(), 256, 50);
    const est = { esperando: '💤 listo para diseñar', construyendo: '🔨 construyendo…', celebrando: '🎉 ¡obra terminada!', listo: '✔ ' + TIPOS[av.st.tipo].nombre };
    g.fillStyle = '#e9eefc'; g.font = '600 34px "Segoe UI", sans-serif'; g.fillText(est[av.fase], 256, 102);
    av.etqTex.needsUpdate = true;
  }

  /* ---------- Grúa torre ---------- */
  function crearGrua() {
    const g = new THREE.Group(), amar = std(0xf2b01e, .5, .3), gris = std(0x666a70, .6, .3);
    const mastil = new THREE.Group();
    [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]].forEach(p => { const c = new THREE.Mesh(new THREE.BoxGeometry(.3, 1, .3), amar); c.position.set(p[0], .5, p[1]); c.castShadow = true; mastil.add(c); });
    g.add(mastil); g.add(caja(3.2, .8, 3.2, M.concretoOsc, 0, .4, 0));
    const brazo = new THREE.Group(); g.add(brazo);
    brazo.add(caja(30, .7, .9, amar, 10, 0, 0), caja(10, .7, .9, amar, -8, 0, 0), caja(2.6, 2, 1.6, gris, -12, -.6, 0), caja(1.6, 1.6, 1.6, std(0x3a6ea5, .4), 1.2, 1.1, 0));
    const pico = cil(0, .8, 4, amar, 0, 2.6, 0, 6); brazo.add(pico);
    const carro = new THREE.Group(); brazo.add(carro); carro.add(caja(1.6, .4, 1.2, gris, 0, -.5, 0));
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1, 6), M.hierro); cable.geometry.translate(0, -.5, 0); carro.add(cable);
    const gancho = caja(.7, .7, .7, M.rojo, 0, -1, 0); carro.add(gancho);
    g.userData = { mastil, brazo, carro, cable, gancho };
    return g;
  }

  /* ---------- Lotes ---------- */
  const lotes = [];
  function crearLote(cfg, k) {
    const av = Object.assign({}, cfg);
    av.k = k; av.theta = Math.PI / 2 + k * 2 * Math.PI / 5;
    const TP = TIPOS[cfg.tipo], E = ESTILOS[cfg.estilo];
    av.st = {
      tipo: cfg.tipo, P: TP.P, x: TP.x, pisos: [], valor: TP.valor, fijos: TP.fijos, flecha: E.flecha
    };
    for (let i = 0; i < TP.pisos; i++) av.st.pisos.push({ h: i === 0 ? TP.hPB : TP.h, mat: E.mat });
    av.fase = 'esperando'; av.t = 0; av.expl = 0; av.explObj = 0; av.s = 0; av.cicloT = 0; av.saludo = 0; av.logro = false; av.sucio = true; av.celebT = 0;

    const g = new THREE.Group(); g.userData.idx = k;
    av.centro = new THREE.Vector3(Math.cos(av.theta) * R, 0, Math.sin(av.theta) * R);
    g.position.copy(av.centro); g.rotation.y = Math.atan2(-Math.cos(av.theta), -Math.sin(av.theta));
    av.lote = g;
    const matBorde = std(0xffffff, .5, 0, { emissive: col(av.color), emissiveIntensity: .6, color: col(av.color) });
    av.matBorde = matBorde;
    const pad = caja(PAD, .7, PAD, M.pasto, 0, -.0, 0); pad.position.y = 0; g.add(pad);
    [[PAD, 1.2, 0, PAD / 2], [PAD, 1.2, 0, -PAD / 2], [1.2, PAD, PAD / 2, 0], [1.2, PAD, -PAD / 2, 0]].forEach(b => {
      const m = caja(b[0], .5, b[1], matBorde, b[2], .35, b[3], false); g.add(m);
    });
    g.add(caja(8, .1, 26, M.camino, 0, .36, PAD / 2 - 13 + .01, false));
    // arbustos en esquinas del lote
    [[-23, -23], [23, -23], [23, 23], [-23, 23]].forEach((p, i) => { const s = esf(1.8 + (i % 2) * .6, M.verdeOsc, p[0], 1.2, p[1], 10); s.scale.y = .8; g.add(s); });

    av.contEdificio = new THREE.Group(); av.contEdificio.position.set(0, .35, -3); g.add(av.contEdificio);
    av.grua = crearGrua(); av.grua.position.set(-21, .35, -21); g.add(av.grua);
    av.andamio = null;

    const mod = crearModeloAvatar(cfg); av.modelo = mod; g.add(mod.grupo);
    av.pos = new THREE.Vector3(10, .35, 10); av.rotY = 0; mod.grupo.position.copy(av.pos);

    av.etqCanvas = etiquetaCanvas(); av.etqTex = new THREE.CanvasTexture(av.etqCanvas); av.etqTex.encoding = THREE.sRGBEncoding;
    av.etiqueta = new THREE.Sprite(new THREE.SpriteMaterial({ map: av.etqTex, transparent: true, depthWrite: false }));
    av.etiqueta.scale.set(15, 4.2, 1); av.etiqueta.position.y = 8.6; mod.grupo.add(av.etiqueta); av.etiqueta.scale.multiplyScalar(1 / 2.4); av.etiqueta.position.y = 3.65;
    dibujarEtiqueta(av);

    av.baliza = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), std(0xffffff, .3, 0, { emissive: col(av.color), emissiveIntensity: 1, color: col(av.color) }));
    av.baliza.position.y = 4.4 / 1; mod.grupo.add(av.baliza); av.baliza.scale.setScalar(1 / 2.4 * 1.0); av.baliza.position.y = 4.55; av.baliza.visible = false;

    escena.add(g); lotes.push(av); return av;
  }
  AVATARES.forEach((cfg, k) => crearLote(cfg, k));
  let sel = lotes[0];

  /* ---------- Cálculo de métricas (decimales + lineal + cuadrática) ---------- */
  function escalasNiveles(av) {
    const n = av.st.pisos.length, arr = new Array(n).fill(1);
    if (av.estilo === 'deco' && (av.st.tipo === 'edificio' || av.st.tipo === 'hotel') && n >= 5) {
      for (let k = 1; k <= 3; k++) arr[n - 1 - (3 - k)] = 1 - 0.14 * k;
    }
    return arr;
  }
  function calcular(av) {
    const st = av.st, b = Mat.b(st.P), x = st.x, y = Mat.fondo(x, b), A0 = Mat.area(x, b);
    const esc = escalasNiveles(av), dT = +$('in-dT').value;
    const niveles = []; let construida = 0, volumen = 0, altura = 0, costo = 0, Q = 0;
    st.pisos.forEach((p, i) => {
      const s = esc[i], A = (x * s) * (y * s), per = 2 * (x * s + y * s), mat = MATERIALES[p.mat];
      const c = Mat.costo(A * mat.k, st.valor, st.fijos);        // C = A·Valor_M2·k_material + Costos_Fijos
      niveles.push({ i, h: p.h, A, c, mat: p.mat });
      construida += A; volumen += A * p.h; altura += p.h; costo += c;
      Q += Mat.perdida(mat.U, per * p.h, dT);                    // fachada: U·(perímetro·h)·ΔT
    });
    const top = niveles[niveles.length - 1];
    Q += Mat.perdida(0.6, top ? top.A : 0, dT);                  // cubierta: U = 0.6 W/m²K
    return { b, x, y, A0, Amax: Mat.areaMax(b), xOpt: Mat.xOptimo(b), niveles, construida, volumen, altura, costo, Q, efic: A0 / Mat.areaMax(b) * 100 };
  }

  /* ---------- Constructor de edificios por estilo ---------- */
  function agregarVentanas(g, w, d, h, vk, op) {
    const V = VENT[vk];
    const lados = [
      { L: w, r: 0, nx: 0, nz: 1, fr: true }, { L: w, r: Math.PI, nx: 0, nz: -1, fr: false },
      { L: d, r: Math.PI / 2, nx: 1, nz: 0, fr: false }, { L: d, r: -Math.PI / 2, nx: -1, nz: 0, fr: false }
    ];
    let pasoMin = Infinity;
    lados.forEach(s => { s.n = Math.max(1, Math.round(s.L / V.sp)); s.paso = s.L / s.n; pasoMin = Math.min(pasoMin, s.paso); });
    const ww = Math.min(V.fw * V.sp, pasoMin * 0.82), wh = V.tipo === 'arco' ? h * 0.66 : h * V.fh;
    const pos = [];
    lados.forEach(s => {
      for (let i = 0; i < s.n; i++) {
        const u = -s.L / 2 + (i + .5) * s.paso;
        if (op.puerta && s.fr && Math.abs(u) < op.anchoPuerta / 2 + ww / 2 + .1) continue;
        const off = (s.nz !== 0 ? d : w) / 2;
        pos.push({ x: s.nz !== 0 ? u : s.nx * off, z: s.nz !== 0 ? s.nz * off : u, r: s.r, nx: s.nx, nz: s.nz });
      }
    });
    if (!pos.length) return;
    let geoV, geoM, yV, yM, sV, sM, zV, zM;
    if (V.tipo === 'arco') {
      const hR = wh * .62, f = Math.max(.15, Math.min(op.flecha * .6, ww * .45, wh * .38));
      geoV = geoArco(ww, hR, f, .16); geoM = geoArco(ww + .4, hR + .1, f + .18, .1);
      yV = h * V.y0; yM = yV - .12; sV = sM = [1, 1, 1]; zV = -.05; zM = -.08;
    } else {
      geoV = geoCaja; geoM = geoCaja; yV = yM = h * V.y; sV = [ww, wh, .16]; sM = [ww + .32, wh + .32, .1]; zV = .02; zM = -.01;
    }
    const iV = new THREE.InstancedMesh(geoV, M.vidrioVent, pos.length), iM = new THREE.InstancedMesh(geoM, op.marco, pos.length);
    if (geoV === geoCaja) { iV.userData.compartida = true; iM.userData.compartida = true; }
    pos.forEach((p, k) => {
      dummy.rotation.set(0, p.r, 0);
      dummy.position.set(p.x + p.nx * zV, yV, p.z + p.nz * zV); dummy.scale.set(sV[0], sV[1], sV[2]); dummy.updateMatrix(); iV.setMatrixAt(k, dummy.matrix);
      dummy.position.set(p.x + p.nx * zM, yM, p.z + p.nz * zM); dummy.scale.set(sM[0], sM[1], sM[2]); dummy.updateMatrix(); iM.setMatrixAt(k, dummy.matrix);
    });
    iV.frustumCulled = iM.frustumCulled = false; g.add(iM, iV);
  }

  function agregarAletas(g, w, d, h, mat) {                    // pilastras Art Déco
    const L = w, n = Math.max(2, Math.round(L / 3.1)), paso = L / n, pos = [];
    for (let k = 0; k <= n; k++) { const u = -L / 2 + k * paso; pos.push([u, d / 2 + .12], [u, -d / 2 - .12]); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(.4, h, .4), mat, pos.length);
    pos.forEach((p, i) => { dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.position.set(p[0], h / 2, p[1]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.frustumCulled = false; g.add(im);
  }

  function balcon(g, w, d, h, tipo) {
    const ancho = w * .92;
    g.add(caja(ancho, .2, 1.9, M.acentoOscuro, 0, .1, d / 2 + .95));
    if (tipo === 'vidrio') g.add(caja(ancho, 1, .06, M.vidrioClaro, 0, .75, d / 2 + 1.85, false));
    else if (tipo === 'jardinera') { g.add(caja(ancho, .55, .6, M.madClara, 0, .47, d / 2 + 1.6)); g.add(caja(ancho * .98, .4, .5, M.verde, 0, .92, d / 2 + 1.6)); }
    else { const m = tipo === 'dorado' ? M.dorado : M.hierro; g.add(caja(ancho, .08, .06, m, 0, 1.15, d / 2 + 1.85, false), caja(ancho, .06, .06, m, 0, .6, d / 2 + 1.85, false)); }
  }

  function sombrilla(g, x, y, z, color) {
    const s = new THREE.Group(); s.position.set(x, y, z);
    s.add(cil(.07, .07, 2.6, M.hierro, 0, 1.3, 0, 6)); s.add(cil(0, 1.7, .7, std(color, .8), 0, 2.8, 0, 12)); g.add(s);
  }
  function coche(color) {
    const g = new THREE.Group(), mc = std(color, .3, .5);
    g.add(caja(4.2, .9, 1.9, mc, 0, .85, 0), caja(2.2, .75, 1.7, std(0x1b2a3a, .1, .6), -.2, 1.6, 0));
    [[-1.4, .8], [1.4, .8], [-1.4, -.8], [1.4, -.8]].forEach(p => { const r = cil(.45, .45, .35, M.neumatico, p[0], .45, p[1], 12); r.rotation.x = Math.PI / 2; g.add(r); });
    return g;
  }
  function palmera(alto) {
    const g = new THREE.Group(); g.add(cil(.3, .45, alto, M.tronco, 0, alto / 2, 0, 8));
    for (let i = 0; i < 7; i++) { const h = caja(.5, .12, 4, M.verde, 0, alto, 0); h.geometry.translate(0, 0, 2); h.rotation.y = i / 7 * Math.PI * 2; h.rotation.x = .5; g.add(h); }
    return g;
  }
  function arbolItem(s) {
    const g = new THREE.Group(); g.add(cil(.5, .7, 4 * s, M.tronco, 0, 2 * s, 0, 6));
    g.add(esf(2.8 * s, M.hoja, 0, 5.5 * s, 0, 9)); return g;
  }

  function construirEdificio(av) {
    const st = av.st, E = ESTILOS[av.estilo], tipo = st.tipo, TP = TIPOS[tipo];
    const b = Mat.b(st.P), w = st.x, d = Mat.fondo(st.x, b), n = st.pisos.length;
    const raiz = new THREE.Group();
    const out = { grupo: raiz, pisos: [], baseY: [], alturas: [], huellas: [], detalles: [], anim: [], w, d, n, yTecho: 0, humoObj: null, techo: null, flechaEf: st.flecha, Larco: TP.L };
    const marco = M[E.marco], corn = M[E.cornisa];
    const esc = escalasNiveles(av);

    const cim = new THREE.Group(); cim.add(caja(w + 1.8, .5, d + 1.8, M.concretoOsc, 0, .25, 0)); raiz.add(cim); out.cimiento = cim;
    // flecha efectiva de la puerta (debe caber en la altura de la planta baja)
    const h0 = st.pisos[0].h, hRP = h0 * .55, Lp = Math.min(TP.L, w * .6);
    const fEf = Math.max(.2, Math.min(st.flecha, h0 - hRP - .3));
    out.flechaEf = fEf; out.Larco = Lp;

    let y = .5, shiftU = 0;
    for (let i = 0; i < n; i++) {
      const pi = st.pisos[i], h = pi.h, s = esc[i], wi = w * s, di = d * s, mp = MATERIALES[pi.mat].m;
      const g = new THREE.Group(); g.position.y = y;
      shiftU = (E.desplaza && n >= 2 && i % 2 === 1) ? 1.0 : 0; g.position.x = shiftU;
      g.add(caja(wi, h, di, mp, 0, h / 2, 0));
      g.add(caja(wi + .35, .24, di + .35, corn, 0, .12, 0), caja(wi + .2, .16, di + .2, corn, 0, h - .08, 0));
      agregarVentanas(g, wi, di, h, E.vent, { puerta: i === 0, anchoPuerta: Lp + .8, marco, flecha: st.flecha });
      if (av.estilo === 'deco') { agregarAletas(g, wi, di, h, M.dorado); g.add(caja(wi + .4, .3, di + .4, M.dorado, 0, h - .15, 0)); }
      if (av.estilo === 'industrial') { [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(c => g.add(caja(.55, h, .55, M.acero, c[0] * wi / 2, h / 2, c[1] * di / 2))); }
      if (av.estilo === 'eco') g.add(caja(wi * .22, h * .9, .2, M.verde, -wi * .36, h / 2, di / 2 + .12));
      if (av.estilo === 'mediterraneo') g.add(caja(wi + .1, .3, di + .1, M.blanco, 0, h * .55, 0, false).clone ? caja(wi + .02, .12, di + .02, M.blanco, 0, h * .62, 0, false) : new THREE.Group());
      const conBalcon = (tipo === 'edificio' || tipo === 'hotel') ? i >= 1 : (tipo === 'casa' ? (n >= 2 && i === n - 1) : (tipo === 'restaurante' && i >= 1));
      if (conBalcon) balcon(g, wi, di, h, E.balcon);
      raiz.add(g); out.pisos.push(g); out.baseY.push(y); out.alturas.push(h); out.huellas.push({ w: wi, d: di, s });
      y += h;
    }
    out.yTecho = y;

    /* ---- Cubierta ---- */
    const tg = new THREE.Group(); tg.position.set(shiftU, y, 0); raiz.add(tg); out.techo = tg;
    const ult = out.huellas[n - 1], wT = ult.w, dT = ult.d;
    const azotea = () => {
      if (tipo === 'hotel') {
        tg.add(caja(wT * .55 + .5, .3, dT * .35 + .5, M.blanco, 0, .4, -dT * .15), caja(wT * .55, .25, dT * .35, M.agua, 0, .5, -dT * .15, false));
        sombrilla(tg, -wT * .2, .3, dT * .22, 0xff5fa2); sombrilla(tg, wT * .05, .3, dT * .22, 0xffd54a); sombrilla(tg, wT * .25, .3, dT * .22, 0x5fd0ff);
        tg.add(caja(wT, 1.1, .06, M.vidrioClaro, 0, .9, dT / 2 + .1, false), caja(wT, 1.1, .06, M.vidrioClaro, 0, .9, -dT / 2 - .1, false));
      } else if (tipo === 'edificio') {
        tg.add(caja(wT * .35, 1.8, dT * .35, M.acero, wT * .15, 1.2, -dT * .1));
        tg.add(cil(.08, .12, 9, M.acero, -wT * .2, 4.8, dT * .1, 6));
        const faro = esf(.35, M.faro, -wT * .2, 9.4, dT * .1, 8); tg.add(faro);
      } else if (tipo === 'casa') {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => tg.add(cil(.1, .1, 2.6, M.madOscura, c[0] * Math.min(wT * .25, 3), 1.5, c[1] * Math.min(dT * .2, 2.5), 6)));
        for (let k = 0; k < 6; k++) tg.add(caja(Math.min(wT * .5, 6.4), .1, .35, M.madOscura, 0, 2.85, -Math.min(dT * .2, 2.5) + k * (Math.min(dT * .4, 5) / 5)));
      }
    };
    const chimenea = () => {
      const ch = new THREE.Group(); ch.position.set(wT * .28, 0, -dT * .22); ch.add(cil(.7, .9, 5, M.ladrilloRojo, 0, 2.7, 0, 10));
      const anc = new THREE.Object3D(); anc.position.y = 5.4; ch.add(anc); tg.add(ch); out.humoObj = anc;
    };
    if (E.techo === 'plano') {
      tg.add(caja(wT + 1.4, .35, dT + 1.4, M.acentoOscuro, 0, .17, 0)); azotea();
    } else if (E.techo === 'teja') {
      const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); geo.rotateY(Math.PI / 4);
      const rh = Math.max(2, Math.min(wT, dT) * .32), tj = new THREE.Mesh(geo, M.terracota);
      tj.scale.set(wT + 1.6, rh, dT + 1.6); tj.position.y = rh / 2 + .3; tj.castShadow = true; tg.add(tj, caja(wT + 1.6, .3, dT + 1.6, M.blanco, 0, .15, 0));
      if (tipo !== 'restaurante') tg.add(caja(1.2, 3, 1.2, M.blanco, wT * .2, rh * .5 + .8, -dT * .1));
    } else if (E.techo === 'industrial') {
      tg.add(caja(wT + .8, .35, dT + .8, M.acero, 0, .17, 0));
      tg.add(cil(.9, 1.2, 7, M.ladrilloRojo, -wT * .3, 3.8, -dT * .25, 12), cil(.8, 1.1, 6, M.ladrilloRojo, -wT * .1, 3.3, -dT * .25, 12));
      const tk = new THREE.Group(); tk.position.set(wT * .25, 0, -dT * .1); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => tk.add(cil(.1, .1, 3, M.acero, c[0] * .9, 1.6, c[1] * .9, 6))); tk.add(cil(1.6, 1.6, 2.6, M.acero, 0, 4.2, 0, 14)); tg.add(tk);
      azotea();
    } else if (E.techo === 'escalonado') {
      tg.add(caja(wT * .8, 2, dT * .8, MATERIALES.marmol.m, 0, 1, 0), caja(wT * .55, 2, dT * .55, M.dorado, 0, 3, 0), caja(wT * .32, 2, dT * .32, MATERIALES.marmol.m, 0, 5, 0));
      const sp = new THREE.Mesh(new THREE.ConeGeometry(.7, 10, 8), M.dorado); sp.position.y = 11; sp.castShadow = true; tg.add(sp, esf(.55, M.dorado, 0, 16.2, 0, 10));
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(c => tg.add(cil(0, .6, 3, M.dorado, c[0] * wT * .4, 1.8, c[1] * dT * .4, 6)));
    } else if (E.techo === 'verde') {
      if (tipo === 'casa' || tipo === 'restaurante') {
        const Lw = wT + .8, f = Math.min(wT * .35, Math.max(1.2, st.flecha * 1.5)), sh = new THREE.Shape();
        sh.moveTo(-Lw / 2, 0);
        for (let i = 0; i <= 20; i++) { const xx = -Lw / 2 + Lw * i / 20; sh.lineTo(xx, f * (1 - Math.pow(2 * xx / Lw, 2))); }
        const geo = new THREE.ExtrudeGeometry(sh, { depth: dT + 1, bevelEnabled: false }); geo.translate(0, 0, -(dT + 1) / 2);
        const bv = new THREE.Mesh(geo, M.boveda); bv.castShadow = true; bv.receiveShadow = true; tg.add(bv); out.flechaBoveda = f; out.Lboveda = Lw;
      } else {
        tg.add(caja(wT + .8, .4, dT + .8, M.madOscura, 0, .2, 0), caja(wT, .5, dT, M.verde, 0, .55, 0));
        const filas = Math.max(1, Math.floor(dT / 4)), cols = Math.max(1, Math.floor(wT / 4) - 1);
        for (let r = 0; r < Math.min(filas, 3); r++) for (let c = 0; c < Math.min(cols, 5); c++) { const p = caja(3, .12, 1.8, M.panel, -wT * .35 + c * 3.6, 1.1, -dT * .3 + r * 3.4); p.rotation.x = -.45; tg.add(p); }
        const tur = new THREE.Group(); tur.position.set(wT * .3, .8, dT * .25); tur.add(cil(.15, .25, 9, M.blanco, 0, 4.5, 0, 8));
        const rotor = new THREE.Group(); rotor.position.set(0, 9, .4);
        for (let k = 0; k < 3; k++) { const a = caja(.25, 4.5, .08, M.blanco, 0, 2.2, 0); const pv = new THREE.Group(); pv.add(a); pv.rotation.z = k * Math.PI * 2 / 3; rotor.add(pv); }
        tur.add(rotor); tg.add(tur); out.anim.push(dt => { rotor.rotation.z -= dt * 2.2; });
      }
    }
    if (tipo === 'restaurante') chimenea();
    if (tipo === 'restaurante' && E.techo !== 'verde') sombrilla(tg, -wT * .25, .3, dT * .2, 0xff7a3c);

    /* ---- Detalles animados (aparecen al finalizar) ---- */
    const item = (px, py, pz) => { const g = new THREE.Group(); g.position.set(px, py, pz); raiz.add(g); out.detalles.push(g); return g; };
    // Puerta con arco parabólico
    {
      const it = item(0, .5, d / 2 + .02);
      const fr = new THREE.Mesh(geoMarcoArco(Lp, hRP, fEf, .3), corn === M.acentoOscuro ? M.acentoOscuro : (E.marco === 'blanco' ? M.terracota : marco)); fr.castShadow = true; it.add(fr);
      const hoja = new THREE.Mesh(geoArco(Lp, hRP - .3, fEf, .1), M.vidrioVent); hoja.position.set(0, .3, -.04); it.add(hoja);
      it.children[1].geometry.translate(0, 0, 0);
      const hoja2 = it.children[1]; hoja2.geometry.translate(0, 0, 0);
      const pasos = item(0, 0, d / 2 + 1.7); pasos.add(caja(Lp + 1.6, .25, 1.4, M.concretoOsc, 0, .125, 0), caja(Lp + 1.2, .25, .8, M.concretoOsc, 0, .375, -.3));
      // letrero en pilón
      const sx = Math.min(w / 2 + 4, PAD / 2 - 5), pil = item(sx, 0, d / 2 + 3); pil.rotation.y = -.25;
      const rot = { casa: 'Casa ', edificio: 'Torre ', hotel: 'Hotel ', restaurante: 'Restaurante ' }[tipo] + av.nombre + (tipo === 'hotel' ? ' ★★★★★' : '');
      pil.add(cil(.12, .12, 4, M.hierro, -2.4, 2, 0, 6), cil(.12, .12, 4, M.hierro, 2.4, 2, 0, 6));
      const tx = texturaTexto(rot, { w: 640, h: 160, fondo: '#10131c', color: av.color, borde: av.color, tam: 62 });
      const cart = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: tx })); cart.position.set(0, 3.6, .08); pil.add(cart, caja(6.6, 1.8, .12, M.hierro, 0, 3.6, 0));
      pil.userData.textura = tx; out.texturas = (out.texturas || []).concat([tx]);
    }
    if (tipo === 'casa') {
      if (w / 2 + 6 < 24) {
        const ga = item(-(w / 2 + 2.8), 0, d / 2 - 3); ga.add(caja(5, 2.7, 6, MATERIALES[st.pisos[0].mat].m, 0, 1.35, 0), caja(4.2, 2.1, .1, M.acero, 0, 1.15, 3.05), caja(5.4, .3, 6.4, corn, 0, 2.85, 0));
      }
      const co = item(-(w / 2 + 2.8), 0, d / 2 + 6); co.add(coche(+('0x' + av.color.slice(1))));
      [-1, 1].forEach(sg => { const bu = item(sg * w * .33, 0, d / 2 + 2.6); const s = esf(1.1, M.verdeOsc, 0, 1, 0, 10); s.scale.y = .8; bu.add(s); });
      if ((av.estilo === 'moderno' || av.estilo === 'eco') && d <= 22) { const pi = item(0, 0, -d / 2 - 5.5); pi.add(caja(w * .55 + 1, .3, 4.6, M.blanco, 0, .15, 0), caja(w * .55, .25, 3.6, M.agua, 0, .22, 0, false)); }
      if (w / 2 + 8 < 25) { const ar = item(w / 2 + 6, 0, -d / 4); ar.add(arbolItem(1.2)); }
    } else if (tipo === 'edificio') {
      const ma = item(0, 0, d / 2 + 2.4); ma.add(caja(Lp + 4, .25, 3.2, corn, 0, h0 + .3, 0), cil(.2, .2, h0, M.acero, -Lp / 2 - 1.5, h0 / 2, 1.3, 8), cil(.2, .2, h0, M.acero, Lp / 2 + 1.5, h0 / 2, 1.3, 8));
      [-1, 1].forEach(sg => { const ja = item(sg * (Lp / 2 + 3.4), 0, d / 2 + 2.4); ja.add(caja(2, .8, 2, M.concretoOsc, 0, .4, 0)); const s = esf(1, M.verde, 0, 1.2, 0, 10); ja.add(s); });
      const bc = item(-(w / 2 + 3), 0, d / 2 + 4); bc.add(caja(2.6, .15, .8, M.madClara, 0, .6, 0), caja(.15, .6, .7, M.hierro, -1, .3, 0), caja(.15, .6, .7, M.hierro, 1, .3, 0));
      const co = item(w / 2 + 1, 0, d / 2 + 8); co.add(coche(0xe84a4a)); if (w / 2 + 4 > 24) co.visible = false;
      const f1 = item(-(Lp / 2 + 7), 0, d / 2 + 5); f1.add(cil(.15, .2, 5, M.hierro, 0, 2.5, 0, 6), esf(.6, M.bombilla, 0, 5.2, 0, 10));
    } else if (tipo === 'hotel') {
      const pc = item(0, 0, d / 2 + 6);
      pc.add(caja(Lp + 10, .5, 8, M.dorado, 0, h0 + .6, 0));
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(c => pc.add(cil(.4, .4, h0 + .4, M.dorado, c[0] * (Lp / 2 + 4), (h0 + .4) / 2, c[1] * 3, 12)));
      const al = item(0, .05, d / 2 + 8.5); al.add(caja(Lp * .8, .06, 13, M.alfombra, 0, .05, 0, false));
      [-1, 1].forEach(sg => { const p = item(sg * (Lp / 2 + 8), 0, d / 2 + 5); p.add(palmera(8)); });
      [-1, 1].forEach(sg => {
        const bd = item(sg * (Lp / 2 + 4.5), 0, d / 2 + 13); bd.add(cil(.12, .12, 9, M.acero, 0, 4.5, 0, 6));
        const fl = caja(2.4, 1.4, .05, std(+('0x' + av.color.slice(1)), .7), 1.3, 8, 0); bd.add(fl); out.anim.push((dt, T) => { fl.rotation.y = Math.sin(T * 3 + sg) * .25; });
      });
      const li = item(w / 2 + 3, 0, d / 2 + 14); li.add(coche(0x111111)); li.children[0].scale.x = 1.25; if (w / 2 + 5 > 24) li.visible = false;
    } else if (tipo === 'restaurante') {
      const to = item(0, h0 * .93, d / 2 + 1.2), nT = 9, aT = (Lp + 3.5) / nT;
      for (let k = 0; k < nT; k++) { const r = caja(aT, .1, 2.6, k % 2 ? M.blanco : M.rojo, -(Lp + 3.5) / 2 + aT * (k + .5), 0, 0); r.rotation.x = .35; to.add(r); }
      const nx = Math.max(2, Math.min(4, Math.floor(w / 4.5)));
      for (let r = 0; r < 2; r++) for (let c = 0; c < nx; c++) {
        const tb = item(-w / 2 + (c + .5) * (w / nx), 0, d / 2 + 6 + r * 5.4);
        tb.add(cil(.9, .9, .1, M.madClara, 0, 1.05, 0, 14), cil(.1, .1, 1, M.hierro, 0, .5, 0, 6), caja(.7, .1, .7, M.rojo, 1.5, .9, 0), caja(.7, .1, .7, M.rojo, -1.5, .9, 0));
        tb.add(caja(.1, .9, .7, M.hierro, 1.9, .9, 0), caja(.1, .9, .7, M.hierro, -1.9, .9, 0)); if ((c + r) % 2 === 0) sombrilla(tb, 0, 0, 0, [0xff7a3c, 0xffd54a, 0x5fd0ff][(c + r) % 3]);
      }
      const lu = item(0, 0, d / 2 + 14);
      lu.add(cil(.12, .12, 5, M.hierro, -w * .45, 2.5, 0, 6), cil(.12, .12, 5, M.hierro, w * .45, 2.5, 0, 6));
      for (let k = 0; k <= 14; k++) { const u = k / 14, xx = (u - .5) * w * .9, yy = 4.9 - 1.3 * (1 - Math.pow(2 * u - 1, 2)); lu.add(esf(.22, M.bombilla, xx, yy, 0, 6)); }
    }
    raiz.userData.item = item;
    return out;
  }

  /* ---------- Ciclo de vida del edificio de cada lote ---------- */
  function reconstruir(av) {
    if (av.edif) { av.contEdificio.remove(av.edif.grupo); liberar(av.edif.grupo); (av.edif.texturas || []).forEach(t => t.dispose()); }
    av.edif = construirEdificio(av); av.contEdificio.add(av.edif.grupo);
    const e = av.edif, H = e.alturas.reduce((a, c) => a + c, 0);
    // crono de construcción
    const n = e.n, dp = Math.max(.35, Math.min(1.1, 9 / n));
    av.crono = { tCim: 1.4, t0: 1.4, dp, tR: 1.4 + n * dp, dDet: .16, tDet0: 1.4 + n * dp + 1.0 };
    av.crono.total = av.crono.tDet0 + e.detalles.length * av.crono.dDet + .6;
    // andamio de malla
    if (av.andamio) { av.contEdificio.remove(av.andamio); av.andamio.geometry.dispose(); }
    const sx = Math.max(2, Math.round((e.w + 2.4) / 2.5)), sz = Math.max(2, Math.round((e.d + 2.4) / 2.5));
    const geo = new THREE.BoxGeometry(e.w + 2.6, 1, e.d + 2.6, sx, Math.max(2, n * 2), sz); geo.translate(0, .5, 0);
    av.andamio = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc400, wireframe: true, transparent: true, opacity: .5 }));
    av.contEdificio.add(av.andamio);
    // grúa
    const hm = Math.max(16, H + 9), u = av.grua.userData;
    u.mastil.scale.y = hm; u.brazo.position.y = hm + .6; av.gruaH = hm;
    aplicarProgreso(av);
    av.sucio = false; av.uiSucio = true;
  }

  function aplicarProgreso(av) {
    const e = av.edif, c = av.crono; if (!e) return;
    const t = av.fase === 'construyendo' ? av.t : 1e9;
    const p0 = prog(t, 0, c.tCim); e.cimiento.visible = p0 > .001; e.cimiento.scale.set(1, Math.max(.01, easeOutBack(p0)), 1);
    let hCons = 0;
    for (let i = 0; i < e.n; i++) {
      const p = prog(t, c.t0 + i * c.dp, c.dp * 1.15), g = e.pisos[i];
      g.visible = p > .001; g.scale.y = Math.max(.01, easeOutBack(p)); hCons += e.alturas[i] * Math.min(1, p);
      g.position.y = e.baseY[i] + av.expl * i * 3.6;
    }
    const pr = prog(t, c.tR, 1.2); e.techo.visible = pr > .001; e.techo.scale.setScalar(Math.max(.01, easeOutBack(pr)));
    e.techo.position.y = e.yTecho + av.expl * e.n * 3.6 + (1 - pr) * 6;
    e.detalles.forEach((d, k) => { const p = prog(t, c.tDet0 + k * c.dDet, .5); d.visible = p > .001 && (d.userData.oculto !== true); const s = Math.max(.01, easeOutBack(p)); d.scale.setScalar(s); });
    av.hConstruida = hCons + .5;
    av.andamio.visible = av.fase === 'construyendo' && hCons > .1; av.andamio.scale.y = hCons + 1.5;
    av.grua.visible = av.fase === 'construyendo';
  }

  function setFase(av, f) { av.fase = f; dibujarEtiqueta(av); actualizarBarra(); if (f === 'construyendo') av.t = av.t || 0; }
  function iniciarConstruccion(av, retraso) {
    reconstruir(av); av.t = -(retraso || 0); av.s = 0; av.cicloT = 0; setFase(av, 'construyendo'); aplicarProgreso(av);
    if (av === sel) aviso('🔨 ' + av.nombre + ' empieza: ' + TIPOS[av.st.tipo].nombre + ' ' + ESTILOS[av.estilo].nombre.toLowerCase());
  }
  function terminarConstruccion(av) {
    setFase(av, 'celebrando'); av.celebT = 3.6; aplicarProgreso(av);
    const top = av.lote.localToWorld(new THREE.Vector3(0, av.edif.yTecho + 6, -3));
    for (let i = 0; i < 140; i++) {
      const a = rnd() * Math.PI * 2, v = 5 + rnd() * 9, c = new THREE.Color().setHSL(rnd(), .9, .6);
      confeti.emitir(top.x, top.y, top.z, Math.cos(a) * v, 8 + rnd() * 12, Math.sin(a) * v, 4.5, c.r, c.g, c.b);
    }
    const m = calcular(av); aviso('🎉 ' + av.nombre + ' terminó su ' + TIPOS[av.st.tipo].nombre.toLowerCase() + ' · US$ ' + Mat.fmt(m.costo, 0));
  }

  /* ---------- Avisos y barra de avatares ---------- */
  function aviso(txt) {
    const d = document.createElement('div'); d.className = 'aviso'; d.textContent = txt; $('avisos').appendChild(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4300);
    while ($('avisos').children.length > 3) $('avisos').removeChild($('avisos').firstChild);
  }
  function crearBarra() {
    const b = $('barra-avatares'); b.innerHTML = '';
    lotes.forEach((av, i) => {
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'avatar-card'; bt.dataset.i = i; bt.style.setProperty('--c', av.color);
      bt.innerHTML = '<span class="ficha">' + av.nombre[0] + '</span><span><b>' + av.nombre + '</b><small id="barra-est-' + i + '"></small></span>';
      bt.addEventListener('click', () => seleccionar(i, true)); b.appendChild(bt);
    });
  }
  function actualizarBarra() {
    lotes.forEach((av, i) => {
      const el = $('barra-est-' + i); if (el) el.textContent = TIPOS[av.st.tipo].icono + ' ' + TIPOS[av.st.tipo].nombre + ' · ' + ESTILOS[av.estilo].nombre.split(' ')[0];
    });
    document.querySelectorAll('.avatar-card').forEach(b => b.classList.toggle('activo', +b.dataset.i === sel.k));
  }

  /* ---------- Cámara: vuelos, vista general y recorrido ---------- */
  let vuelo = null, tour = { activo: false, idx: 0, timer: 0 };
  function volarA(pos, tgt, dur) { vuelo = { t: 0, dur: dur || 1.8, p0: camara.position.clone(), p1: pos.clone(), t0: controles.target.clone(), t1: tgt.clone() }; }
  function vistaGeneral() { volarA(new THREE.Vector3(0, 230, 300), new THREE.Vector3(0, 8, 0), 2); }
  function enfocar(av) {
    const e = av.edif, H = e.alturas.reduce((a, c) => a + c, 0), dirIn = new THREE.Vector3(-Math.cos(av.theta), 0, -Math.sin(av.theta));
    const lat = new THREE.Vector3(-dirIn.z, 0, dirIn.x), dist = 36 + Math.max(e.w, e.d) * .7 + H * .45;
    const pos = av.centro.clone().add(dirIn.clone().multiplyScalar(dist)).add(lat.multiplyScalar(dist * .35)); pos.y = 14 + H * .55 + dist * .18;
    const tgt = av.centro.clone().add(dirIn.clone().multiplyScalar(-3)); tgt.y = H * .42 + 2;
    volarA(pos, tgt, 1.8);
  }
  function seleccionar(i, volar) {
    sel = lotes[i]; lotes.forEach(a => { a.baliza.visible = a === sel; a.matBorde.emissiveIntensity = a === sel ? 1.6 : .45; });
    document.documentElement.style.setProperty('--acento', sel.color);
    sel.saludo = 2.6; if (volar) enfocar(sel);
    lotes.forEach(a => { if (a !== sel) a.explObj = 0; }); $('btn-explosion').classList.toggle('activo', sel.explObj === 1);
    renderControl(); actualizarBarra(); actualizarMetricas();
  }
  function detenerTour() { tour.activo = false; $('btn-tour').classList.remove('activo'); }
  controles.addEventListener('start', () => { vuelo = null; controles.autoRotate = false; if (tour.activo) detenerTour(); });
  $('btn-general').addEventListener('click', () => { detenerTour(); vistaGeneral(); });
  $('btn-tour').addEventListener('click', () => {
    if (tour.activo) { detenerTour(); controles.autoRotate = false; return; }
    tour.activo = true; tour.idx = 0; tour.timer = 0; $('btn-tour').classList.add('activo'); seleccionar(0, true); controles.autoRotate = true; controles.autoRotateSpeed = 1.2;
  });
  $('btn-explosion').addEventListener('click', () => { sel.explObj = sel.explObj ? 0 : 1; $('btn-explosion').classList.toggle('activo', sel.explObj === 1); });
  $('btn-panel-control').addEventListener('click', () => { $('panel-control').classList.toggle('abierto'); $('panel-metricas').classList.remove('abierto'); });
  $('btn-panel-metricas').addEventListener('click', () => { $('panel-metricas').classList.toggle('abierto'); $('panel-control').classList.remove('abierto'); });
  $('hora').addEventListener('input', e => actualizarCielo(+e.target.value));

  /* ---------- Selección con el puntero ---------- */
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = null;
  lienzo.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  function lotePorPuntero(e) {
    const r = lienzo.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camara); const hit = ray.intersectObjects(lotes.map(l => l.lote), true);
    if (!hit.length) return -1; let o = hit[0].object; while (o && o.userData.idx === undefined) o = o.parent; return o ? o.userData.idx : -1;
  }
  lienzo.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) { const i = lotePorPuntero(e); if (i >= 0) seleccionar(i, true); } down = null; });
  let ultHover = 0;
  lienzo.addEventListener('pointermove', e => { const n = performance.now(); if (n - ultHover < 120 || e.buttons) return; ultHover = n; lienzo.style.cursor = lotePorPuntero(e) >= 0 ? 'pointer' : 'grab'; });

  /* ---------- Panel de control (entradas) ---------- */
  function renderControl() {
    const av = sel, st = av.st, TP = TIPOS[st.tipo];
    $('ctl-titulo').textContent = av.nombre + ' · ' + ESTILOS[av.estilo].nombre; $('ctl-estilo').textContent = 'Arquitecto/a de ' + TP.nombre.toLowerCase();
    const bt = $('tipos'); bt.innerHTML = '';
    Object.keys(TIPOS).forEach(k => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (st.tipo === k ? ' activo' : ''); b.textContent = TIPOS[k].icono + ' ' + TIPOS[k].nombre;
      b.addEventListener('click', () => cambiarTipo(av, k)); bt.appendChild(b);
    });
    $('in-pisos').max = TP.max; renderPisos(); sincronizarControles();
  }
  function renderPisos() {
    const av = sel, lp = $('lista-pisos'); lp.innerHTML = '';
    const opts = Object.keys(MATERIALES).map(k => '<option value="' + k + '">' + MATERIALES[k].nombre + '</option>').join('');
    av.st.pisos.forEach((p, i) => {
      const f = document.createElement('div'); f.className = 'fila-piso';
      f.innerHTML = '<span>N' + (i + 1) + '</span><input type="number" step="0.05" min="2.2" max="6" data-i="' + i + '" data-k="h" value="' + Mat.r2(p.h).toFixed(2) + '"><select data-i="' + i + '" data-k="mat">' + opts + '</select>';
      f.querySelector('select').value = p.mat; lp.appendChild(f);
    });
  }
  function sincronizarControles() {
    const av = sel, st = av.st, b = Mat.b(st.P);
    $('in-P').value = st.P; $('out-P').textContent = Mat.fmt(st.P, 1) + ' m';
    const xi = $('in-x'); xi.min = 4; xi.max = Mat.r2(b - 4); xi.value = st.x; $('out-x').textContent = Mat.fmt(st.x, 2) + ' m';
    $('in-pisos').value = st.pisos.length; $('out-pisos').textContent = st.pisos.length;
    $('in-valor').value = st.valor; $('in-fijos').value = st.fijos;
    $('in-flecha').value = st.flecha; $('out-flecha').textContent = Mat.fmt(st.flecha, 2) + ' m';
    $('out-dT').textContent = Mat.fmt(+$('in-dT').value, 1) + ' °C';
    const dentro = $('lista-pisos').querySelectorAll('input[data-k="h"]');
    dentro.forEach((el, i) => { if (document.activeElement !== el && st.pisos[i]) el.value = Mat.r2(st.pisos[i].h).toFixed(2); });
  }
  function marcar(av) { av.sucio = true; av.uiSucio = true; }
  function cambiarTipo(av, k) {
    const TP = TIPOS[k], E = ESTILOS[av.estilo]; av.st.tipo = k; av.st.P = TP.P; av.st.x = TP.x; av.st.valor = TP.valor; av.st.fijos = TP.fijos; av.st.flecha = E.flecha;
    av.st.pisos = []; for (let i = 0; i < TP.pisos; i++) av.st.pisos.push({ h: i === 0 ? TP.hPB : TP.h, mat: E.mat });
    av.logro = false; renderControl(); iniciarConstruccion(av, 0); enfocar(av); actualizarBarra();
  }
  $('in-P').addEventListener('input', e => {
    const av = sel, st = av.st; st.P = +e.target.value; const b = Mat.b(st.P); st.x = Mat.clamp(st.x, 4, b - 4); sincronizarControles(); marcar(av);
  });
  $('in-x').addEventListener('input', e => { sel.st.x = +e.target.value; sincronizarControles(); marcar(sel); });
  $('btn-optimo').addEventListener('click', () => { const b = Mat.b(sel.st.P); sel.st.x = Mat.xOptimo(b); sincronizarControles(); marcar(sel); });
  $('in-pisos').addEventListener('input', e => {
    const st = sel.st, n = +e.target.value;
    while (st.pisos.length < n) { const u = st.pisos[st.pisos.length - 1]; st.pisos.push({ h: TIPOS[st.tipo].h, mat: u.mat }); }
    while (st.pisos.length > n) st.pisos.pop();
    renderPisos(); sincronizarControles(); marcar(sel);
  });
  $('lista-pisos').addEventListener('input', e => {
    const el = e.target, i = +el.dataset.i, st = sel.st; if (isNaN(i)) return;
    if (el.dataset.k === 'h') { const v = parseFloat(el.value); if (!isNaN(v)) st.pisos[i].h = Mat.clamp(v, 2.2, 6); } else st.pisos[i].mat = el.value;
    marcar(sel);
  });
  $('btn-h-todos').addEventListener('click', () => { const v = Mat.clamp(parseFloat($('in-h-todos').value) || 2.85, 2.2, 6); sel.st.pisos.forEach(p => p.h = v); renderPisos(); marcar(sel); });
  $('in-valor').addEventListener('input', e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { sel.st.valor = v; marcar(sel); } });
  $('in-fijos').addEventListener('input', e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { sel.st.fijos = v; marcar(sel); } });
  $('in-flecha').addEventListener('input', e => { sel.st.flecha = +e.target.value; sincronizarControles(); marcar(sel); });
  $('in-dT').addEventListener('input', () => { sincronizarControles(); sel.uiSucio = true; });
  $('btn-construir').addEventListener('click', () => { iniciarConstruccion(sel, 0); enfocar(sel); });
  $('btn-demoler').addEventListener('click', () => {
    const av = sel, TP = TIPOS[av.st.tipo], E = ESTILOS[av.estilo];
    av.st.P = TP.P; av.st.x = TP.x; av.st.valor = TP.valor; av.st.fijos = TP.fijos; av.st.flecha = E.flecha; av.st.pisos = [];
    for (let i = 0; i < TP.pisos; i++) av.st.pisos.push({ h: i === 0 ? TP.hPB : TP.h, mat: E.mat });
    renderControl(); iniciarConstruccion(av, 0);
  });

  /* ---------- Dashboard de métricas y gráficas ---------- */
  function prepararCanvas(c) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth, h = parseInt(c.getAttribute('height'), 10) || 150;
    if (!w) return null;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); return { g, w, h };
  }
  function dibujarGraficas(m) {
    m = m || calcular(sel);
    const cA = prepararCanvas($('graf-area'));
    if (cA) {
      const { g, w, h } = cA, mL = 38, mR = 12, mT = 12, mB = 24, b = m.b, aMax = m.Amax * 1.08;
      const X = v => mL + v / b * (w - mL - mR), Y = v => h - mB - v / aMax * (h - mB - mT);
      g.strokeStyle = 'rgba(255,255,255,.15)'; g.fillStyle = '#9db0da'; g.font = '10px sans-serif'; g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const v = aMax * i / 4; g.beginPath(); g.moveTo(mL, Y(v)); g.lineTo(w - mR, Y(v)); g.stroke(); g.textAlign = 'right'; g.fillText(Math.round(v), mL - 4, Y(v) + 3); }
      g.textAlign = 'center'; for (let i = 0; i <= 4; i++) { const v = b * i / 4; g.fillText(Mat.fmt(v, 1), X(v), h - 8); }
      g.beginPath(); for (let i = 0; i <= 80; i++) { const xx = b * i / 80; i ? g.lineTo(X(xx), Y(Mat.area(xx, b))) : g.moveTo(X(xx), Y(Mat.area(xx, b))); }
      g.lineWidth = 2.5; g.strokeStyle = sel.color; g.stroke();
      g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(X(m.xOpt), Y(0)); g.lineTo(X(m.xOpt), Y(m.Amax)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffd54a'; g.font = '12px sans-serif'; g.fillText('★', X(m.xOpt), Y(m.Amax) - 4);
      g.beginPath(); g.arc(X(m.x), Y(m.A0), 6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = sel.color; g.stroke();
      g.fillStyle = '#eef2ff'; g.font = '11px sans-serif'; g.textAlign = m.x > b * .6 ? 'right' : 'left'; g.fillText('x=' + Mat.fmt(m.x, 2) + '  A=' + Mat.fmt(m.A0, 1), X(m.x) + (m.x > b * .6 ? -10 : 10), Y(m.A0) - 8);
      $('graf-area').dataset.mL = mL; $('graf-area').dataset.mR = mR;
    }
    const cB = prepararCanvas($('graf-arco'));
    if (cB && sel.edif) {
      const { g, w, h } = cB, L = sel.edif.Larco, f = sel.edif.flechaEf, hR = .55, pad = 22, esc = Math.min((w - 2 * pad) / L, (h - 34) / (hR + f + .2));
      const ox = (w - L * esc) / 2, oy = h - 18, X = v => ox + v * esc, Y = v => oy - v * esc;
      g.strokeStyle = sel.color; g.lineWidth = 2.5; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(0), Y(hR));
      for (let i = 0; i <= 60; i++) { const u = L * i / 60; g.lineTo(X(u), Y(hR + Mat.arcoY(u, L, f))); } g.lineTo(X(L), Y(0)); g.closePath(); g.fill(); g.stroke();
      g.setLineDash([4, 4]); g.strokeStyle = '#ffd54a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(L / 2), Y(hR)); g.lineTo(X(L / 2), Y(hR + f)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffd54a'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText('f = ' + Mat.fmt(f, 2) + ' m', X(L / 2) + 6, Y(hR + f / 2));
      g.fillStyle = '#9db0da'; g.textAlign = 'center'; g.fillText('L = ' + Mat.fmt(L, 2) + ' m', X(L / 2), h - 4);
    }
  }
  (function () {
    const c = $('graf-area'); let activo = false;
    const mover = e => {
      const r = c.getBoundingClientRect(), mL = +c.dataset.mL || 38, mR = +c.dataset.mR || 12, b = Mat.b(sel.st.P);
      const v = (e.clientX - r.left - mL) / (r.width - mL - mR) * b; sel.st.x = Mat.clamp(Math.round(v * 20) / 20, 4, b - 4); sincronizarControles(); marcar(sel);
    };
    c.addEventListener('pointerdown', e => { activo = true; c.setPointerCapture && c.setPointerCapture(e.pointerId); mover(e); });
    c.addEventListener('pointermove', e => { if (activo) mover(e); });
    c.addEventListener('pointerup', () => { activo = false; });
  })();

  function actualizarMetricas() {
    const av = sel, m = calcular(av), st = av.st, u = 'US$ ';
    $('m-huella').textContent = Mat.fmt(m.A0) + ' m²';
    $('m-construida').textContent = Mat.fmt(m.construida) + ' m²';
    $('m-volumen').textContent = Mat.fmt(m.volumen) + ' m³';
    $('m-altura').textContent = Mat.fmt(m.altura) + ' m';
    $('m-costo').textContent = u + Mat.fmt(m.costo);
    $('m-termico').textContent = Mat.fmt(m.Q / 1000) + ' kW';
    const n1 = m.niveles[0], mat1 = MATERIALES[n1.mat];
    const eq = [];
    eq.push('<b>Cuadrática</b> (lote)');
    eq.push('b = P/2 = ' + Mat.fmt(st.P, 2) + '/2 = <b>' + Mat.fmt(m.b) + ' m</b>');
    eq.push('A(x) = −x² + b·x = −(' + Mat.fmt(m.x) + ')² + ' + Mat.fmt(m.b) + '·(' + Mat.fmt(m.x) + ') = <b>' + Mat.fmt(m.A0) + ' m²</b>');
    eq.push('fondo = b − x = ' + Mat.fmt(m.y) + ' m  ·  x* = b/2 = ' + Mat.fmt(m.xOpt) + ' m');
    eq.push('A_máx = b²/4 = ' + Mat.fmt(m.Amax) + ' m²  ·  eficiencia ' + Mat.fmt(m.efic, 1) + '%');
    eq.push('<br><b>Lineal</b> (costo por nivel)');
    eq.push('C₁ = A·k·Valor_M2 + Costos_Fijos = ' + Mat.fmt(n1.A) + '×' + Mat.fmt(mat1.k) + '×' + Mat.fmt(st.valor) + ' + ' + Mat.fmt(st.fijos) + ' = <b>' + u + Mat.fmt(n1.c) + '</b>');
    eq.push('Volumen = Σ Aᵢ·hᵢ = ' + Mat.fmt(m.volumen) + ' m³ (h₁ = ' + Mat.fmt(n1.h) + ' m)');
    eq.push('Q = Σ Uᵢ·Aᵢ·ΔT = <b>' + Mat.fmt(m.Q) + ' W</b>  (ΔT = ' + Mat.fmt(+$('in-dT').value, 1) + ' °C)');
    const L = av.edif ? av.edif.Larco : TIPOS[st.tipo].L, f = av.edif ? av.edif.flechaEf : st.flecha;
    eq.push('<br><b>Arco parabólico</b> (puerta)');
    eq.push('y(x) = −(4f/L²)x² + (4f/L)x = <b>' + Mat.fmt(Mat.arcoA(L, f), 4) + 'x² + ' + Mat.fmt(Mat.arcoB(L, f), 4) + 'x</b>');
    eq.push('L = ' + Mat.fmt(L) + ' m · flecha f = ' + Mat.fmt(f) + ' m' + (av.edif && av.edif.flechaBoveda ? ' · bóveda: f = ' + Mat.fmt(av.edif.flechaBoveda) + ' m, L = ' + Mat.fmt(av.edif.Lboveda) + ' m' : ''));
    $('ecuaciones').innerHTML = eq.join('<br>');
    $('eq-cuad').innerHTML = 'b = ' + Mat.fmt(m.b) + ' m · A(x) = −x² + ' + Mat.fmt(m.b) + 'x = <b>' + Mat.fmt(m.A0) + ' m²</b><br>Óptimo: x = ' + Mat.fmt(m.xOpt) + ' m → A = ' + Mat.fmt(m.Amax) + ' m²';
    $('tb-niveles').innerHTML = m.niveles.slice().reverse().map(n => '<tr><td>N' + (n.i + 1) + '</td><td>' + Mat.fmt(n.h) + '</td><td>' + Mat.fmt(n.A) + '</td><td>' + Mat.fmt(n.c) + '</td></tr>').join('') +
      '<tr><td><b>Total</b></td><td>' + Mat.fmt(m.altura) + '</td><td>' + Mat.fmt(m.construida) + '</td><td><b>' + Mat.fmt(m.costo) + '</b></td></tr>';
    const rk = lotes.map(a => ({ a, m: calcular(a) })).sort((p, q) => q.m.efic - p.m.efic);
    $('tb-ranking').innerHTML = rk.map(r => '<tr class="' + (r.a === sel ? 'sel' : '') + '"><td>' + r.a.nombre + '</td><td>' + TIPOS[r.a.st.tipo].icono + '</td><td>' + Mat.fmt(r.m.A0, 1) + '</td><td>' + Mat.fmt(r.m.costo / 1000, 0) + 'k</td><td>' + Mat.fmt(r.m.efic, 1) + '%</td></tr>').join('');
    dibujarGraficas(m);
    // logro: área máxima
    if (Math.abs(m.x - m.xOpt) < .03) { if (!av.logro) { av.logro = true; aviso('🏆 ¡' + av.nombre + ' alcanzó el área máxima A = ' + Mat.fmt(m.Amax) + ' m²!'); const p = av.lote.localToWorld(new THREE.Vector3(0, av.edif ? av.edif.yTecho + 4 : 10, -3)); for (let i = 0; i < 60; i++) { const a = rnd() * 6.28, v = 4 + rnd() * 6, c = new THREE.Color().setHSL(rnd(), .9, .6); confeti.emitir(p.x, p.y, p.z, Math.cos(a) * v, 6 + rnd() * 8, Math.sin(a) * v, 3.5, c.r, c.g, c.b); } }
    } else if (Math.abs(m.x - m.xOpt) > .5) av.logro = false;
    const E = ESTILOS[av.estilo];
    $('hud-info').textContent = av.nombre + ' · ' + TIPOS[st.tipo].nombre + ' ' + E.nombre.toLowerCase() + ' · ' + st.pisos.length + (st.pisos.length === 1 ? ' piso' : ' pisos') + ' · US$ ' + Mat.fmt(m.costo, 0);
    sel.uiSucio = false;
  }

  /* ---------- Animación de avatares ---------- */
  function puntoRect(s, hw, hd) {
    const Lp = 2 * (2 * hw + 2 * hd); s = ((s % Lp) + Lp) % Lp;
    const seg = [[2 * hw, -hw, hd, 1, 0], [2 * hd, hw, hd, 0, -1], [2 * hw, hw, -hd, -1, 0], [2 * hd, -hw, -hd, 0, 1]];
    for (const q of seg) { if (s <= q[0]) return { x: q[1] + q[3] * s, z: q[2] + q[4] * s, dx: q[3], dz: q[4] }; s -= q[0]; }
    return { x: -hw, z: hd, dx: 1, dz: 0 };
  }
  function giraHacia(a, objetivo, k) { let d = objetivo - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * Math.min(1, k); }

  function actualizarAvatar(av, dt, T) {
    const mo = av.modelo, e = av.edif; if (!e) return;
    const cx = 0, cz = -3;                         // centro del edificio en coords del lote
    let caminando = false, martillando = false, saltando = 0, brazosArriba = false, saludando = av.saludo > 0;
    if (av.saludo > 0) av.saludo -= dt;
    let objX, objZ, vel = 4.2;
    if (av.fase === 'construyendo') {
      av.cicloT += dt; const hw = e.w / 2 + 3.5, hd = e.d / 2 + 3.5, ciclo = av.cicloT % 7;
      const tgt = puntoRect(av.s, hw, hd); objX = cx + tgt.x; objZ = cz + tgt.z;
      const dx = objX - av.pos.x, dz = objZ - av.pos.z, dist = Math.hypot(dx, dz);
      if (ciclo < 4.2 || dist > 2.5) {
        if (dist > .05) { const st = Math.min(dist, (dist > 2 ? 9 : 6) * dt); av.pos.x += dx / dist * st; av.pos.z += dz / dist * st; av.rotY = giraHacia(av.rotY, Math.atan2(dx, dz), dt * 10); caminando = true; }
        if (dist < 1.8 && ciclo < 4.2) av.s += vel * dt;
      } else {
        martillando = true; av.rotY = giraHacia(av.rotY, Math.atan2(cx - av.pos.x, cz - av.pos.z), dt * 6);
        if (Math.sin(T * 8) > .96 && rnd() < .6) {
          _v.set(av.pos.x + Math.sin(av.rotY) * 3.4, 3.2 + rnd(), av.pos.z + Math.cos(av.rotY) * 3.4); av.lote.localToWorld(_v);
          for (let i = 0; i < 5; i++) chispas.emitir(_v.x, _v.y, _v.z, (rnd() - .5) * 8, 3 + rnd() * 6, (rnd() - .5) * 8, .6 + rnd() * .5);
        }
      }
      if (rnd() < dt * 22) {                                    // polvo de obra a la altura actual
        const a = rnd() * 6.28, r = Math.max(e.w, e.d) * .5; _v.set(cx + Math.cos(a) * (e.w / 2 + 1), (av.hConstruida || 1) * .5 + rnd() * 3, cz + Math.sin(a) * (e.d / 2 + 1)); av.lote.localToWorld(_v);
        polvo.emitir(_v.x, _v.y, _v.z, (rnd() - .5) * 1.5, .8 + rnd(), (rnd() - .5) * 1.5, 2 + rnd());
      }
    } else if (av.fase === 'celebrando') {
      saltando = Math.abs(Math.sin(T * 5)) * .9; brazosArriba = true; av.rotY += dt * 3; av.celebT -= dt;
      if (av.celebT <= 0) setFase(av, 'listo');
    } else {
      const hx = e.w / 2 + 3.4, hz = (e.d / 2 + 4.2);
      objX = cx + Math.min(hx, 21); objZ = cz + Math.min(hz, 22);
      const dx = objX - av.pos.x, dz = objZ - av.pos.z, dist = Math.hypot(dx, dz);
      if (dist > .15) { const st = Math.min(dist, 7 * dt); av.pos.x += dx / dist * st; av.pos.z += dz / dist * st; av.rotY = giraHacia(av.rotY, Math.atan2(dx, dz), dt * 10); caminando = true; }
      else av.rotY = giraHacia(av.rotY, 0 + Math.sin(T * .6) * .5, dt * 3);
    }
    // limitar al lote
    av.pos.x = Mat.clamp(av.pos.x, -24, 24); av.pos.z = Mat.clamp(av.pos.z, -24, 24);
    // poses
    const cam = Math.sin(T * 9);
    mo.legA.rotation.x = caminando ? cam * .75 : 0; mo.legB.rotation.x = caminando ? -cam * .75 : 0;
    mo.armA.rotation.set(caminando ? -cam * .6 : Math.sin(T * 1.5) * .05, 0, .06); mo.armB.rotation.set(caminando ? cam * .6 : Math.sin(T * 1.5 + 1) * .05, 0, -.06);
    if (martillando) { mo.armB.rotation.set(-1.3 - Math.sin(T * 8) * .9, 0, -.06); mo.armA.rotation.set(-.5, 0, .06); mo.cuerpo.rotation.x = .12; } else mo.cuerpo.rotation.x = 0;
    if (brazosArriba) { mo.armA.rotation.set(0, 0, 2.7); mo.armB.rotation.set(0, 0, -2.7); }
    else if (saludando && !martillando) { mo.armA.rotation.set(0, 0, 2.5 + Math.sin(T * 10) * .35); }
    mo.cabeza.rotation.y = (caminando || martillando) ? 0 : Math.sin(T * .8) * .4;
    mo.cuerpo.position.y = (caminando ? Math.abs(cam) * .08 : Math.sin(T * 2) * .015) + saltando;
    mo.grupo.position.set(av.pos.x, .35, av.pos.z); mo.grupo.rotation.y = av.rotY;
    av.baliza.rotation.y = T * 2; av.baliza.position.y = 4.55 + Math.sin(T * 3) * .12;
  }

  function actualizarGrua(av, T) {
    const u = av.grua.userData; if (!av.grua.visible) return;
    u.brazo.rotation.y = T * .25 + av.k; const x = 12 + 7 * Math.sin(T * .6 + av.k); u.carro.position.set(x, -.2, 0);
    const largo = Math.max(3, av.gruaH * .55 + 3 * Math.sin(T * .9)); u.cable.scale.y = largo; u.gancho.position.y = -largo - .35;
  }

  /* ---------- Bucle principal ---------- */
  const reloj = new THREE.Clock(); let tiempo = 0, acumUI = 0, cargado = false;
  function animar() {
    requestAnimationFrame(animar);
    const dt = Math.min(.05, reloj.getDelta()); tiempo += dt;
    lotes.forEach(av => {
      if (av.sucio) { reconstruir(av); }
      if (av.fase === 'construyendo') {
        av.t += dt; aplicarProgreso(av);
        if (av.t >= av.crono.total) terminarConstruccion(av);
      }
      if (Math.abs(av.expl - av.explObj) > .002) { av.expl += (av.explObj - av.expl) * Math.min(1, dt * 5); aplicarProgreso(av); }
      if (av.edif) { av.edif.anim.forEach(f => f(dt, tiempo)); if (av.edif.humoObj && av.edif.humoObj.visible !== false && rnd() < dt * 14) { av.edif.humoObj.getWorldPosition(_v); humo.emitir(_v.x, _v.y, _v.z, (rnd() - .5) * .8, 2.2 + rnd(), (rnd() - .5) * .8, 3.2); } }
      actualizarAvatar(av, dt, tiempo); actualizarGrua(av, tiempo);
    });
    M.faro.emissiveIntensity = .4 + .8 * (Math.sin(tiempo * 4) > 0 ? 1 : 0);
    anilloF.rotation.z += dt * .8; aguaF.position.y = 1.3 + Math.sin(tiempo * 2) * .03;
    for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, v = 2.5 + rnd() * 4.5; chorros.emitir(Math.cos(a) * .5, 7, Math.sin(a) * .5, Math.cos(a) * v, 11 + rnd() * 5, Math.sin(a) * v, 3); }
    [polvo, chispas, confeti, humo, chorros].forEach(e => e.actualizar(dt));
    nubes.forEach(n => { n.position.x += n.userData.v * dt; if (n.position.x > 520) n.position.x = -520; });
    cielo.position.copy(camara.position); estrellas.position.copy(camara.position);
    if (solDisco.userData.dir) { solDisco.position.copy(camara.position).addScaledVector(solDisco.userData.dir, 1100); lunaDisco.position.copy(camara.position).addScaledVector(lunaDisco.userData.dir, 1100); }
    if (vuelo) { vuelo.t += dt; const u = easeInOut(Math.min(1, vuelo.t / vuelo.dur)); camara.position.lerpVectors(vuelo.p0, vuelo.p1, u); controles.target.lerpVectors(vuelo.t0, vuelo.t1, u); if (u >= 1) vuelo = null; }
    if (tour.activo) { tour.timer += dt; if (tour.timer > 7.5) { tour.timer = 0; tour.idx++; if (tour.idx >= lotes.length) { detenerTour(); vistaGeneral(); } else seleccionar(tour.idx, true); } }
    controles.update();
    acumUI += dt; if (acumUI > .25) { acumUI = 0; if (sel.uiSucio) actualizarMetricas(); }
    renderer.render(escena, camara);
    if (!cargado) { cargado = true; $('cargando').classList.add('oculto'); }
  }

  /* ---------- Arranque ---------- */
  function redimensionar() {
    const w = vista.clientWidth || window.innerWidth, h = vista.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); dibujarGraficas();
  }
  window.addEventListener('resize', redimensionar);
  crearBarra(); actualizarCielo(15.3);
  lotes.forEach((av, i) => { reconstruir(av); av.t = -(i * 2.2); setFase(av, 'construyendo'); aplicarProgreso(av); });
  seleccionar(0, false); redimensionar(); vistaGeneral();
  vuelo = null; camara.position.set(0, 230, 300); controles.target.set(0, 8, 0);
  setTimeout(() => aviso('👷 Los 5 arquitectos empiezan a construir. ¡Toca un lote para diseñar!'), 900);
  animar();
  window.SAMA = { Mat, lotes, calcular, escena, get sel() { return sel; }, seleccionar, iniciarConstruccion, reconstruir, actualizarMetricas, tick: dt => { /* uso en pruebas */ } };
}

if (typeof THREE === 'undefined') {
  const c = document.getElementById('cargando');
  if (c) c.innerHTML = '<p>No se pudo cargar Three.js. Revisa tu conexión a internet y recarga la página.</p>';
} else {
  try { iniciar(); } catch (err) {
    console.error(err);
    const c = document.getElementById('cargando');
    if (c) c.innerHTML = '<p>Tu navegador no pudo iniciar el simulador 3D (WebGL). Prueba con Chrome, Edge o Firefox actualizados.</p><p style="color:#9db0da;font-size:.8rem">' + String(err && err.message || err) + '</p>';
  }
}
