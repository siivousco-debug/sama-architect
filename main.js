import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('canvas-container');
const areaVal = document.getElementById('areaVal');
const costoVal = document.getElementById('costoVal');
const volVal = document.getElementById('volVal');
const bInput = document.getElementById('b');
const xInput = document.getElementById('x');
const pisosInput = document.getElementById('pisos');
const estiloSelect = document.getElementById('estilo');
const logDiv = document.getElementById('log');
const extraControls = document.getElementById('extraControls');

let scene, camera, renderer, controls;
let buildingGroup, craneGroup, archGroup;
let time = 0;
const params = {b:60, x:30, pisos:2, estilo:'andres', h_exacta:2.85};

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a101a);
  scene.fog = new THREE.Fog(0x0a101a, 30, 80);
  camera = new THREE.PerspectiveCamera(55, container.clientWidth/container.clientHeight, 0.1, 200);
  camera.position.set(18,14,18);
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0,2,0);

  scene.add(new THREE.AmbientLight(0x8aa0b8, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(10,20,8);
  dir.castShadow = true;
  scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100,100),
    new THREE.MeshStandardMaterial({color:0x111a26})
  );
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(new THREE.GridHelper(100,50,0x1e2d42,0x162032));

  buildingGroup = new THREE.Group();
  craneGroup = new THREE.Group();
  archGroup = new THREE.Group();
  scene.add(buildingGroup, craneGroup, archGroup);

  bInput.addEventListener('input', e=>{
    params.b = parseFloat(e.target.value);
    document.getElementById('bLabel').textContent = params.b;
    buildAll();
  });
  xInput.addEventListener('input', e=>{
    params.x = parseFloat(e.target.value);
    document.getElementById('xLabel').textContent = params.x;
    buildAll();
  });
  pisosInput.addEventListener('input', e=>{
    params.pisos = parseInt(e.target.value);
    document.getElementById('pisosLabel').textContent = params.pisos;
    buildAll();
  });
  estiloSelect.addEventListener('change', e=>{
    params.estilo = e.target.value;
    setupExtra();
    buildAll();
  });

  setupExtra();
  buildAll();
  animate();
}

function setupExtra(){
  extraControls.innerHTML = '';
  if(params.estilo === 'aleja'){
    extraControls.innerHTML = '<div class="sl"><span>Color Muro:</span><input type="color" id="colorMuro" value="#c4b5a0" style="width:100%;height:30px"><span>Luz Industrial:</span><input type="range" id="luzInt" min="0" max="2" step="0.05" value="0.8"></div>';
    setTimeout(()=>{
      document.getElementById('colorMuro')?.addEventListener('input', buildAll);
      document.getElementById('luzInt')?.addEventListener('input', buildAll);
    },100);
  } else if(params.estilo === 'diego'){
    extraControls.innerHTML = '<div class="sl"><span>Altura Arco (h)</span><input type="range" id="hArco" min="2" max="10" step="0.1" value="5"><b id="hArcoLabel">5</b></div>';
    setTimeout(()=>{
      document.getElementById('hArco')?.addEventListener('input', e=>{
        document.getElementById('hArcoLabel').textContent = e.target.value;
        buildAll();
      });
    },100);
  }
}

function calc(){
  const x = params.x, b = params.b;
  const A = -x*x + b*x;
  const x_opt = b/2;
  const A_max = -x_opt*x_opt + b*x_opt;
  const C = A*1200 + 5000;
  const V = A * 2.85 * params.pisos;
  const L = x;
  const hArcoEl = document.getElementById('hArco');
  const hArco = hArcoEl? parseFloat(hArcoEl.value) : 5;
  const a_par = (4*hArco)/(L*L || 1);
  return {A, x_opt, A_max, C, V, a_par, hArco, L};
}

function buildAll(){
  const d = calc();
  areaVal.textContent = d.A.toFixed(2);
  costoVal.textContent = d.C.toFixed(0);
  volVal.textContent = d.V.toFixed(2);

  // LOG LIMPIO - SIN PROMPTS
  logDiv.textContent = `[DECIMALES] altura exacta: 2.85 m (ej 2.85)
[CUADRATICA] A(x)=-x^2+${params.b}x -> A=${d.A.toFixed(2)} (max ${d.A_max.toFixed(2)} en x_opt=${d.x_opt.toFixed(2)})
[LINEAL] C(A)=A*1200+5000=${d.C.toFixed(2)}
[VOL] V=A*h_pisos*${params.pisos}=${d.V.toFixed(2)} m3
[ARCO PARABOLICO] y=-a*x^2+bx a=4h/L^2=${d.a_par.toFixed(4)} h=${d.hArco}`;

  buildingGroup.clear();
  craneGroup.clear();
  archGroup.clear();

  const w = Math.min(d.A/(params.b||1)*0.5+4, 12);
  const dep = Math.min(params.x*0.35, 12);
  const colorEl = document.getElementById('colorMuro');
  const wallColor = colorEl? colorEl.value : (params.estilo==='aleja'? '#c4b5a0' : '#9bb0c8');

  // EDIFICIO CON ANIMACION DE CONSTRUCCION
  for(let i=0; i<params.pisos; i++){
    const h = 2.85;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, dep),
      new THREE.MeshStandardMaterial({color: wallColor, roughness:0.7})
    );
    mesh.position.set(0, h/2 + i*h, 0);
    mesh.castShadow = true;
    mesh.scale.set(0.01,0.01,0.01);
    // animacion grow
    setTimeout(()=>{
      const start = Date.now();
      function grow(){
        const t = Math.min((Date.now()-start)/600,1);
        const e = 1-Math.pow(1-t,3);
        mesh.scale.set(e,e,e);
        if(t<1) requestAnimationFrame(grow);
      }
      grow();
    }, i*250);
    buildingGroup.add(mesh);
  }

  // ARCO PARABOLICO - DIEGO
  if(params.estilo === 'diego'){
    const pts = [];
    for(let xi=0; xi<=d.L; xi+=0.2){
      const yReal = -d.a_par*Math.pow(xi-d.L/2,2)+d.hArco;
      pts.push(new THREE.Vector3(xi-d.L/2, Math.max(yReal,0)+0.2, dep/2+1));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 64, 0.15, 8, false);
    archGroup.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({color:0x5ee1ff, emissive:0x0a2a3a})));
  }

  // GRUA ANIMADA
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3,0.4, params.pisos*2.85+6, 8),
    new THREE.MeshStandardMaterial({color:0xffc83d})
  );
  base.position.set(w/2+3, (params.pisos*2.85+6)/2, 0);
  craneGroup.add(base);

  const armGroup = new THREE.Group();
  armGroup.position.set(w/2+3, params.pisos*2.85+5, 0);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(8,0.2,0.2),
    new THREE.MeshStandardMaterial({color:0xffc83d})
  );
  arm.position.set(2,0,0);
  armGroup.add(arm);
  const hook = new THREE.Mesh(
    new THREE.BoxGeometry(0.4,0.4,0.4),
    new THREE.MeshStandardMaterial({color:0xff3b3b})
  );
  hook.position.set(4,-4,0);
  armGroup.add(hook);
  craneGroup.add(armGroup);
  craneGroup.userData.armGroup = armGroup;
}

function animate(){
  requestAnimationFrame(animate);
  time += 0.016;
  if(craneGroup.userData.armGroup){
    craneGroup.userData.armGroup.rotation.y = Math.sin(time*0.5)*0.7;
    craneGroup.userData.armGroup.children[1].position.y = -4 + Math.sin(time*1.5)*0.6;
  }
  buildingGroup.rotation.y = Math.sin(time*0.12)*0.1;
  controls.update();
  renderer.render(scene, camera);
}

init();
