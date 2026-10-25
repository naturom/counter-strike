import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Weapon} from '@sirocco/shared';
import type {WorldArt} from './world';
import type {WeaponFinish} from './weapon-models';
const lensMaterials=new WeakMap<WorldArt,THREE.MeshPhysicalMaterial>();
const sightMaterials=new WeakMap<WorldArt,{glass:THREE.Material;dot:THREE.Material}>();

function block(g:THREE.Object3D,size:number[],at:number[],mat:THREE.Material,r=.002){const o=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],2,Math.min(r,...size.map(x=>x/4))),mat);o.position.fromArray(at);g.add(o);return o;}
function tube(g:THREE.Object3D,r:number,length:number,at:number[],mat:THREE.Material,axis:'x'|'y'|'z'='z',r2=r){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r2,length,32),mat);o.rotation.set(axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);o.position.fromArray(at);g.add(o);return o;}
function hoop(g:THREE.Object3D,r:number,t:number,at:number[],mat:THREE.Material){const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,40),mat);o.position.fromArray(at);g.add(o);return o;}
function fastener(g:THREE.Object3D,x:number,y:number,z:number,p:WeaponFinish){tube(g,.0048,.003,[x,y,z],p.steel,'x');const s=block(g,[.001,.0013,.0058],[x+Math.sign(x)*.002,y,z],p.recess);s.rotation.x=.55;}
function rail(g:THREE.Object3D,p:WeaponFinish,from:number,to:number,y:number,width=.079){block(g,[width*.85,.012,from-to+.014],[0,y-.009,(from+to)/2],p.black);const count=Math.floor((from-to)/.024);for(let i=0;i<=count;i++)block(g,[width,.008,.012],[0,y,from-i*.024],p.steel,.0015);}

function coatedLens(art:WorldArt,g:THREE.Object3D,r:number,y:number,z:number,front=false){
 let material=lensMaterials.get(art);if(!material){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!,gradient=c.createRadialGradient(49,42,2,64,64,78);
 for(const [at,color] of [[0,'#385967'],[.25,'#183947'],[.65,'#071722'],[.90,'#030a13'],[1,'#254659']] as const)gradient?.addColorStop(at,color);
 c.fillStyle=gradient??'#10232e';c.fillRect(0,0,128,128);c.fillStyle='#a5d3d329';c.beginPath();c.ellipse(43,29,32,7,-.4,0,Math.PI*2);c.fill();
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;art.textures.push(map);
 material=new THREE.MeshPhysicalMaterial({map,color:'#c7d8e5',metalness:.15,roughness:.10,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:.8});art.materials.push(material);lensMaterials.set(art,material);
 }
 const geometry=new THREE.SphereGeometry(r,40,20,0,Math.PI*2,0,Math.PI/2);geometry.rotateX(Math.PI/2);geometry.scale(1,1,.13);const p=geometry.attributes.position,uv=geometry.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/(r*2)+.5,p.getY(i)/(r*2)+.5);
 const lens=new THREE.Mesh(geometry,material);lens.position.set(0,y,z);if(front)lens.rotation.y=Math.PI;g.add(lens);
}

/** An open, bevelled sight hood, rather than a solid box obscuring the view. */
function reflex(art:WorldArt,g:THREE.Object3D,p:WeaponFinish,z:number){
 const optic=new THREE.Group();optic.position.set(0,.092,z);g.add(optic);
 block(optic,[.074,.021,.085],[0,.005,0],p.black);
 const outline=new THREE.Shape();outline.moveTo(-.039,.013);outline.lineTo(.039,.013);outline.lineTo(.043,.072);outline.quadraticCurveTo(.041,.089,.025,.091);outline.lineTo(-.025,.091);outline.quadraticCurveTo(-.041,.089,-.043,.072);outline.closePath();
 const hole=new THREE.Path();hole.moveTo(-.030,.026);hole.lineTo(-.032,.071);hole.quadraticCurveTo(-.031,.080,-.023,.081);hole.lineTo(.023,.081);hole.quadraticCurveTo(.031,.080,.032,.071);hole.lineTo(.030,.026);hole.closePath();outline.holes.push(hole);
 const hood=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.022,bevelEnabled:true,bevelSegments:2,bevelSize:.0015,bevelThickness:.0015,steps:1}),p.black);hood.position.z=-.011;optic.add(hood);
 let finish=sightMaterials.get(art);if(!finish){finish={glass:art.material('#85c4c1',{transparent:true,opacity:.16,metalness:.25,roughness:.13,side:THREE.DoubleSide,depthWrite:false}),dot:art.material('#ff422b',{emissive:'#ff2716',emissiveIntensity:2,roughness:.4})};sightMaterials.set(art,finish);}
 block(optic,[.059,.050,.001],[0,.052,0],finish.glass,.0002);
 const aimingDot=new THREE.Mesh(new THREE.CircleGeometry(.0013,16),finish.dot);aimingDot.position.set(0,.052,.013);optic.add(aimingDot);
 for(const side of [-1,1]){tube(optic,.010,.006,[side*.046,.040,0],p.steel,'x');fastener(optic,side*.036,.004,.02,p);}
}

/** Batch the small static pieces by finish; moving slides, bolts and magazines
 * remain independent so firing and reload animations still use their real parts. */
function batch(g:THREE.Group){
 g.updateMatrixWorld(true);const byMaterial=new Map<THREE.Material,THREE.BufferGeometry[]>();
 for(const child of [...g.children])if(child instanceof THREE.Mesh){child.updateMatrix();const geo=(child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix),list=byMaterial.get(child.material as THREE.Material)??[];list.push(geo);byMaterial.set(child.material as THREE.Material,list);child.geometry.dispose();g.remove(child);}
 for(const [material,pieces] of byMaterial){const geometry=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());if(geometry)g.add(new THREE.Mesh(geometry,material));}
}
/** One design for held guns, mirror reflections, other players and pickups. */
export function addGunDetails(art:WorldArt,body:THREE.Group,kind:Weapon,p:WeaponFinish){
 const g=new THREE.Group();g.name='machined-weapon-details';body.add(g);
 const features:string[]=['machined-receiver','recessed-fasteners','grip-texture'];
 if(kind==='rifle'){
  // Distinct upper/lower receiver, rear charging handle and buffer assembly.
  block(g,[.083,.034,.335],[0,.058,-.075],p.black,.009);
  block(g,[.094,.034,.040],[0,.014,.147],p.black,.004);
  block(g,[.10,.014,.035],[0,.075,.112],p.steel);for(const side of [-1,1])block(g,[.017,.019,.04],[side*.047,.07,.109],p.black);
  // A recessed bolt port and dust-cover hinge on the right, controls on left.
  block(g,[.003,.034,.12],[.046,.023,-.075],p.recess,.003);block(g,[.003,.018,.068],[.048,.023,-.069],p.chrome,.001);
  tube(g,.003,.124,[.049,.003,-.075],p.steel);block(g,[.008,.012,.018],[.052,.02,-.133],p.black);
  tube(g,.014,.009,[-.049,-.023,.012],p.black,'x');const selector=block(g,[.009,.011,.044],[-.055,-.024,.031],p.steel);selector.rotation.x=-.32;
  block(g,[.010,.034,.020],[-.051,.003,-.123],p.black);
  for(const side of [-1,1])for(const z of [.075,-.20,-.29])fastener(g,side*.047,-.031,z,p);
  // Skeletonised handguard with inset M-LOK channels and contrasting clamps.
  for(const side of [-1,1]){
   block(g,[.004,.067,.235],[side*.054,.012,-.423],p.tan,.005);
   for(let i=0;i<4;i++){const z=-.335-i*.052;block(g,[.002,.016,.034],[side*.057,.018,z],p.recess,.004);block(g,[.002,.007,.026],[side*.058,-.020,z],p.black,.002);}
   for(const z of [-.315,-.529])fastener(g,side*.058,.041,z,p);
  }
  block(g,[.091,.015,.237],[0,-.038,-.423],p.tan,.003);rail(g,p,.084,-.551,.087);
  tube(g,.029,.040,[0,.035,-.579],p.black);tube(g,.011,.26,[0,.066,-.63],p.steel);
  reflex(art,g,p,-.095);
  features.push('open-reflex-sight','mlok-handguard','charging-handle','bolt-port');
 }
 if(kind==='pistol'){
  const slide=body.getObjectByName('slide')!;const moving=new THREE.Group();moving.name='slide-machining';slide.add(moving);
  // Inlaid chamber, broad bevels and fore/aft cuts in the reciprocating slide.
  block(moving,[.052,.003,.068],[0,.081,-.116],p.recess,.003);block(moving,[.041,.003,.056],[.002,.083,-.116],p.chrome,.002);
  for(const side of [-1,1]){
   for(const [start,count] of [[.038,7],[-.205,5]])for(let i=0;i<count;i++){const cut=block(moving,[.002,.043,.003],[side*.042,.034,start-i*.009],p.recess,.0005);cut.rotation.x=-.20;}
   block(moving,[.003,.016,.13],[side*.040,.006,-.095],p.black,.002);
  }
  for(const x of [-.022,.022])tube(moving,.0024,.002,[x,.109,.044],p.glass);tube(moving,.0024,.002,[0,.116,-.299],p.glass);
  block(moving,[.048,.048,.003],[0,.034,.078],p.black,.006);tube(moving,.004,.002,[0,.038,.081],p.chrome);
  for(const y of [.022,.029,.036,.043])block(moving,[.037,.0015,.001],[0,y,.080],p.steel,.0003);
  block(g,[.058,.024,.105],[0,-.048,-.237],p.black);for(let i=0;i<3;i++)block(g,[.064,.008,.009],[0,-.062,-.20-i*.03],p.steel);
  block(g,[.009,.011,.047],[-.042,-.022,-.009],p.steel);tube(g,.007,.005,[-.042,-.073,.042],p.steel,'x');
  for(const side of [-1,1]){const grip=block(g,[.004,.11,.044],[side*.037,-.16,.076],p.rubber,.005);grip.rotation.x=-.25;fastener(g,side*.038,-.058,.044,p);}
  batch(moving);features.push('reciprocating-slide','exposed-chamber','accessory-rail','serrated-slide');
 }
 if(kind==='smg'){
  block(g,[.080,.036,.18],[0,.048,-.078],p.black,.01);rail(g,p,.038,-.19,.078,.066);
  for(const side of [-1,1]){
   block(g,[.003,.022,.072],[side*.043,.027,-.09],p.recess,.005);
   for(const z of [-.18,-.008])fastener(g,side*.041,-.02,z,p);
  }
  tube(g,.009,.040,[-.065,.050,-.221],p.steel,'x');block(g,[.028,.027,.021],[-.085,.049,-.221],p.black,.005);
  tube(g,.013,.008,[-.044,-.027,.039],p.steel,'x');const selector=block(g,[.008,.009,.035],[-.05,-.03,.055],p.black);selector.rotation.x=-.35;
  hoop(g,.030,.007,[0,.121,.061],p.black);hoop(g,.014,.004,[0,.121,.067],p.steel);
  for(const z of [-.21,-.36])tube(g,.049,.015,[0,.006,z],p.steel);
  for(const side of [-1,1])for(let i=0;i<5;i++)block(g,[.003,.017,.013],[side*.049,.025,-.24-i*.025],p.recess,.003);
  features.push('diopter-sight','charging-handle','ribbed-handguard');
 }
 if(kind==='marksman'){
  // Bedding screws and slotted chassis side, with a folded bipod under barrel.
  for(const side of [-1,1]){
   block(g,[.004,.042,.235],[side*.05,-.048,-.36],p.tan,.008);
   for(let i=0;i<4;i++)block(g,[.002,.011,.028],[side*.053,-.045,-.28-i*.052],p.recess,.004);
   for(const z of [-.24,-.455])fastener(g,side*.054,-.064,z,p);
   tube(g,.008,.28,[side*.045,-.091,-.615],p.black);block(g,[.020,.029,.04],[side*.045,-.095,-.757],p.rubber);
  }
  block(g,[.12,.033,.046],[0,-.076,-.48],p.steel);tube(g,.027,.045,[0,.035,-.50],p.black);rail(g,p,.075,-.30,.082,.062);
  // Knurled magnification collar and marked turrets, rather than smooth tubes.
  for(const z of [.022,.043,.065])hoop(g,.047,.0025,[0,.151,z],p.rubber);
  for(let i=0;i<24;i++){const a=i*Math.PI/12;block(g,[.003,.003,.035],[Math.cos(a)*.048,.151+Math.sin(a)*.048,.054],p.steel,.0005);}
  for(const z of [-.26,-.035])for(const side of [-1,1])fastener(g,side*.039,.151,z,p);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;block(g,[.0018,.009,.0018],[Math.cos(a)*.027,.219,-.16+Math.sin(a)*.027],p.chrome,.0003);}
  coatedLens(art,g,.039,.151,.109);coatedLens(art,g,.047,.151,-.444,true);hoop(g,.041,.0015,[0,.151,.109],p.black);
  const bolt=body.getObjectByName('bolt')!;for(let i=0;i<5;i++)tube(bolt,.024,.003,[.10,.004+i*.005,.08],p.steel,'y');
  features.push('coated-optic','knurled-zoom-collar','folded-bipod','bedded-chassis');
 }
 const mag=body.getObjectByName('magazine');if(mag){const detail=new THREE.Group();detail.name='magazine-stampings';mag.add(detail);if(kind!=='pistol')for(const side of [-1,1])for(let i=0;i<4;i++){const rib=block(detail,[.003,kind==='marksman'?.075:.145,.005],[side*.035,-.010,-.038+i*.025],p.black,.001);rib.rotation.x=kind==='rifle'?-.12:0;}batch(detail);}
 batch(g);body.userData.weaponDetails=features;
}
