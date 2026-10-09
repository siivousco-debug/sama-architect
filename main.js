import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const canvas=document.getElementById('c');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0a0e13); scene.fog=new THREE.Fog(0x0a0e13,20,80);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true}); renderer.setSize(canvas.clientWidth,canvas.clientHeight,false); renderer.shadowMap.enabled=true;
const camera=new THREE.PerspectiveCamera(60,canvas.clientWidth/canvas.clientHeight,0.1,200); camera.position.set(18,14,18);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.target.set(0,0,0);
const ambient=new THREE.AmbientLight(0xffffff,0.6); scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffffff,1.2); sun.position.set(10,20,10); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); scene.add(sun);
scene.add(new THREE.HemisphereLight(0x7aa8ff,0x0a0e13,0.4));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x101824,roughness:0.9})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
scene.add(new THREE.GridHelper(200,40,0x1e2a3a,0x1a2535));
let cityGroup=new THREE.Group(); scene.add(cityGroup); let currentBuilding=null;
let architectStyles={aleja:{color:0xf5efe6,wood:0xe8dccf,name:'Japandi',emissive:0xfff8e7,roughness:0.8},andres:{color:0x3a3a3a,wood:0x5a4a3a,name:'Industrial',emissive:0xffaa44,roughness:0.4},diana:{color:0xffe6f2,wood:0xd4af37,name:'Rococo',emissive:0xffd700,roughness:0.2},alfred:{color:0xfff4d6,wood:0xe8a87c,name:'Mediterraneo',emissive:0x87ceeb,roughness:0.6},diego:{color:0xeeeeee,wood:0x111111,name:'Contemporaneo',emissive:0x7cffc4,roughness:0.3}};
let currentArch='aleja';
const $=id=>document.getElementById(id);
const lotX=$('lot-x'),lotB=$('lot-b'),hPiso=$('h-piso'),pisos=$('pisos'),valorM2=$('valor-m2'),cFijos=$('c-fijos'),arcoH=$('arco-h'),tipoEdif=$('tipo-edif');
function fmt(n){return n.toFixed(2);}
function calcCuadraticaArea(x,b){return{area:-x*x+b*x,x_opt:b/2,a_max:b*b/4};}
function calcCostoLineal(area,valor,fijos){return area*valor+fijos;}
function calcArco(L,h,x){const a=(4*h)/(L*L); return -a*Math.pow(x-L/2,2)+h;}
function updateMetrics(){
  const x=parseFloat(lotX.value),b=parseFloat(lotB.value),h=parseFloat(hPiso.value);
  const {area,x_opt,a_max}=calcCuadraticaArea(x,b);
  const vol=area*parseFloat(pisos.value)*h;
  const costo=calcCostoLineal(area,parseFloat(valorM2.value),parseFloat(cFijos.value));
  $('m-area').textContent=fmt(area); $('m-vol').textContent=fmt(vol);
  $('m-cost').textContent='$'+costo.toLocaleString('en-US',{maximumFractionDigits:2});
  $('m-solar').textContent=Math.min(98,(area/a_max*80+15)).toFixed(1)+'%';
  $('lot-x-v').textContent=fmt(x); $('lot-b-v').textContent=b; $('h-piso-v').textContent=fmt(h);
  $('pisos-v').textContent=pisos.value; $('valor-m2-v').textContent=valorM2.value; $('c-fijos-v').textContent=cFijos.value; $('arco-h-v').textContent=arcoH.value;
  $('formula-quad').textContent=`A(x) = -${fmt(x)}^2 + ${b}*${fmt(x)} = ${fmt(area)} m2 | x*=${fmt(x_opt)} Amax=${fmt(a_max)} | Volumen = ${fmt(area)}*${pisos.value}*${fmt(h)}=${fmt(vol)} m3 (decimales)`;
  $('formula-lineal').textContent=`C(A)= ${fmt(area)} * ${valorM2.value} + ${cFijos.value} = $${fmt(costo)} - Funcion lineal costo`;
  $('math-log').textContent=`[DECIMALES] altura exacta: ${h} m (ej 2.85)\n[CUADRATICA] A(x)=-x^2+bx -> A=${fmt(area)} x_opt=${fmt(x_opt)}\n[LINEAL] C(A)=A*${valorM2.value}+${cFijos.value}=${fmt(costo)}\n[VOL] V=A*h_pisos=${fmt(vol)}\n[ARCO PARABOLICO] y=-a x^2+bx a=4h/L^2=${(4*parseFloat(arcoH.value)/(x*x)).toFixed(4)}`;
}
[lotX,lotB,hPiso,pisos,valorM2,cFijos,arcoH].forEach(e=>e.addEventListener('input',updateMetrics)); updateMetrics();
document.querySelectorAll('.avatar').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.avatar').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); currentArch=btn.dataset.arch; $('current-style').textContent=architectStyles[currentArch].name; if(currentBuilding) applyStyle(currentBuilding,currentArch);});});
function applyStyle(group,arch){const style=architectStyles[arch]; group.traverse(m=>{if(m.isMesh&&m.material){if(m.userData.isWall){m.material.color.setHex(style.color); m.material.emissive.setHex(style.emissive); m.material.emissiveIntensity=0.08; m.material.roughness=style.roughness;} if(m.userData.isWood) m.material.color.setHex(style.wood);}});}
function buildHouse(x,z){
  const b=parseFloat(lotB.value),ancho=parseFloat(lotX.value);
  const areaData=calcCuadraticaArea(ancho,b); const fondo=Math.max(5,areaData.area/ancho);
  const h=parseFloat(hPiso.value),nPisos=parseInt(pisos.value),tipo=tipoEdif.value,arcoHeight=parseFloat(arcoH.value);
  const group=new THREE.Group(); group.position.set(x,0,z); const style=architectStyles[currentArch];
  const base=new THREE.Mesh(new THREE.BoxGeometry(ancho,0.2,fondo),new THREE.MeshStandardMaterial({color:0x1e2a3a})); base.position.y=0.1; base.receiveShadow=true; group.add(base);
  for(let i=0;i<nPisos;i++){const wallMat=new THREE.MeshStandardMaterial({color:style.color,roughness:style.roughness}); const box=new THREE.Mesh(new THREE.BoxGeometry(ancho*0.85,h*0.9,fondo*0.85),wallMat); box.position.y=0.2+i*h+h/2; box.castShadow=true; box.userData.isWall=true; box.scale.y=0.01; setTimeout(()=>{let s=0.01; const iv=setInterval(()=>{s+=0.08; box.scale.y=Math.min(1,s); if(s>=1)clearInterval(iv);},30);},i*300); group.add(box); if(tipo==='edificio'){const elev=new THREE.Mesh(new THREE.BoxGeometry(1.2,h*0.9,1.2),new THREE.MeshStandardMaterial({color:0x222222,metalness:0.8})); elev.position.set(0,box.position.y,0); group.add(elev);}}
  const L=ancho*0.85; const pts=[]; for(let xi=-L/2;xi<=L/2;xi+=0.2){const y=calcArco(L,arcoHeight,xi+L/2); pts.push(new THREE.Vector3(xi,0.2+y,fondo*0.43));}
  const curve=new THREE.CatmullRomCurve3(pts); const tube=new THREE.TubeGeometry(curve,30,0.08,8,false); const arco=new THREE.Mesh(tube,new THREE.MeshStandardMaterial({color:style.wood})); arco.userData.isWood=true; group.add(arco);
  if(tipo==='hotel'){const pool=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,0.2,16),new THREE.MeshStandardMaterial({color:0x00aaff})); pool.position.set(ancho*0.3,0.3,0); group.add(pool);}
  applyStyle(group,currentArch); cityGroup.add(group); currentBuilding=group;
  const bar=document.getElementById('construction-bar'),prog=document.getElementById('construction-progress'); bar.style.display='block'; let p=0; const iv=setInterval(()=>{p+=5; prog.style.width=p+'%'; if(p>=100){clearInterval(iv); setTimeout(()=>bar.style.display='none',600);}},80);
}
$('btn-construir').addEventListener('click',()=>{buildHouse((Math.random()-0.5)*30,(Math.random()-0.5)*30);});
$('btn-city').addEventListener('click',()=>{for(let i=0;i<5;i++) setTimeout(()=>buildHouse((Math.random()-0.5)*60,(Math.random()-0.5)*60),i*350);});
$('btn-interior').addEventListener('click',()=>{if(currentBuilding){controls.target.copy(currentBuilding.position); camera.position.set(currentBuilding.position.x+4,3,currentBuilding.position.z+4);}});
$('color-muro').addEventListener('input',e=>{if(currentBuilding) currentBuilding.traverse(m=>{if(m.userData.isWall) m.material.color.set(e.target.value);});});
$('luz-int').addEventListener('input',e=>{ambient.intensity=parseFloat(e.target.value);});
window.addEventListener('resize',()=>{renderer.setSize(canvas.clientWidth,canvas.clientHeight,false); camera.aspect=canvas.clientWidth/canvas.clientHeight; camera.updateProjectionMatrix();});
function animate(){requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera);} animate();
setTimeout(()=>buildHouse(0,0),500);