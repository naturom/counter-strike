import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {isGun,type Equipment,type AvatarId} from '@sirocco/shared';
import {addHands} from './held-equipment';
import {addGunDetails} from './weapon-detail';
import type {WorldArt} from './world';

export const MUZZLE_Z={rifle:-.83,pistol:-.37,smg:-.64,marksman:-1.14} as const;
export type WeaponFinish=Record<'steel'|'edge'|'black'|'polymer'|'olive'|'rubber'|'brass'|'blade'|'glass'|'tan'|'chrome'|'recess',THREE.Material>;
type Finish=WeaponFinish;
const finishes=new WeakMap<WorldArt,Finish>();
const lettering=new WeakMap<WorldArt,Map<string,THREE.MeshStandardMaterial>>();
function palette(art:WorldArt){
  let p=finishes.get(art);if(p)return p;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;
  c.fillStyle='#d1d1d1';c.fillRect(0,0,256,256);
  for(let i=0;i<650;i++){const x=(i*97)%256,y=(i*43)%256;c.strokeStyle=`rgba(${i%3?'45,45,45':'235,235,235'},${.025+(i%5)*.012})`;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+i%19,y+.3);c.stroke();}
  const wear=new THREE.CanvasTexture(canvas);wear.wrapS=wear.wrapT=THREE.RepeatWrapping;art.textures.push(wear);
  const gripCanvas=document.createElement('canvas');gripCanvas.width=gripCanvas.height=128;const grip=gripCanvas.getContext('2d')!;grip.fillStyle='#808080';grip.fillRect(0,0,128,128);for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){grip.fillStyle=(x*13+y*7)%11>4?'#aaa':'#555';grip.fillRect(x+(y%8?2:0),y,1.5,1.5);}const stipple=new THREE.CanvasTexture(gripCanvas);stipple.wrapS=stipple.wrapT=THREE.RepeatWrapping;art.textures.push(stipple);
  p={steel:art.material('#3e484f',{metalness:.78,roughness:.48,roughnessMap:wear,bumpMap:wear,bumpScale:.00012}),edge:art.material('#737d82',{metalness:.88,roughness:.36}),black:art.material('#171d23',{metalness:.58,roughness:.46,roughnessMap:wear}),polymer:art.material('#333a38',{roughness:.82,bumpMap:stipple,bumpScale:.00055}),olive:art.material('#52614c',{roughness:.76,bumpMap:stipple,bumpScale:.0003}),rubber:art.material('#1c211f',{roughness:.92,bumpMap:stipple,bumpScale:.00065}),brass:art.material('#b7a065',{metalness:.7,roughness:.45}),blade:art.material('#aebbbd',{metalness:.93,roughness:.24,roughnessMap:wear}),glass:art.material('#142e36',{metalness:.55,roughness:.10,emissive:'#10262b',emissiveIntensity:.025}),tan:art.material('#766b50',{metalness:.32,roughness:.67,roughnessMap:wear}),chrome:art.material('#939d9e',{metalness:.92,roughness:.27,roughnessMap:wear}),recess:art.material('#070b10',{metalness:.15,roughness:.86})};
  finishes.set(art,p);return p;
}
function part(g:THREE.Object3D,size:number[],at:number[],mat:THREE.Material,r=.006){const mesh=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],2,Math.min(r,...size.map(n=>n/4))),mat);mesh.position.set(...at as [number,number,number]);g.add(mesh);return mesh;}
function cylinder(g:THREE.Object3D,r:number,length:number,at:number[],mat:THREE.Material,axis:'x'|'y'|'z'='z',r2=r){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r2,length,24),mat);if(axis==='z')mesh.rotation.x=Math.PI/2;if(axis==='x')mesh.rotation.z=Math.PI/2;mesh.position.set(...at as [number,number,number]);g.add(mesh);return mesh;}
function ring(g:THREE.Object3D,r:number,tube:number,at:number[],mat:THREE.Material,axis:'x'|'y'|'z'='z'){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,32),mat);if(axis==='x')mesh.rotation.y=Math.PI/2;if(axis==='y')mesh.rotation.x=Math.PI/2;mesh.position.set(...at as [number,number,number]);g.add(mesh);return mesh;}
function profile(g:THREE.Object3D,points:number[][],width:number,mat:THREE.Material){const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:2,steps:1,curveSegments:12});geo.rotateY(Math.PI/2);geo.translate(-width/2,0,0);const mesh=new THREE.Mesh(geo,mat);g.add(mesh);return mesh;}
function shoulderStock(body:THREE.Group){const stock=new THREE.Group();stock.name='shoulder-stock';body.add(stock);return stock;}
function cable(g:THREE.Object3D,points:number[][],mat:THREE.Material,r=.004){g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p as [number,number,number]))),20,r,6,false),mat));}
function screw(g:THREE.Object3D,x:number,y:number,z:number,p:Finish,axis:'x'|'y'|'z'='x'){cylinder(g,.006,.004,[x,y,z],p.edge,axis);const slot=part(g,[.002,.007,.002],[x+(axis==='x'?.003:0),y+(axis==='y'?.003:0),z+(axis==='z'?.003:0)],p.black,.0004);if(axis==='z')slot.rotation.z=.6;}
function trigger(g:THREE.Object3D,p:Finish){
  cable(g,[[0,-.058,.008],[0,-.11,.005],[0,-.12,-.09],[0,-.065,-.12]],p.black,.008);
  cable(g,[[0,-.063,-.025],[0,-.085,-.035],[0,-.09,-.055]],p.steel,.004);
}
function magazine(g:THREE.Object3D,p:Finish,kind:'rifle'|'pistol'|'smg'|'marksman'){
  const m=new THREE.Group();m.name='magazine';const pistol=kind==='pistol';m.position.set(0,pistol?-.18:-.14,pistol?.025:-.15);m.userData.restY=m.position.y;m.userData.restZ=m.position.z;
  const depth=pistol?.07:kind==='marksman'?.11:.13,height=kind==='smg'?.23:kind==='marksman'?.13:.2;
  profile(m,[[-depth/2,height/2],[depth/2,height/2],[depth/2+.025,-height/2],[-depth/2+.04,-height/2]],pistol?.055:.065,p.steel);
  for(const x of [-.034,.034])for(let i=0;i<3;i++)part(m,[.003,height*.7,.009],[x,-.01,-depth*.25+i*depth*.24],p.black,.001);
  part(m,[.077,.015,depth+.025],[0,-height/2,depth*.12],p.black);g.add(m);
}
function barrel(g:THREE.Object3D,p:Finish,start:number,end:number,r=.018){
  cylinder(g,r,Math.abs(start-end),[0,.035,(start+end)/2],p.steel);
  cylinder(g,r*1.35,.045,[0,.035,end+.018],p.black);ring(g,r*1.05,.003,[0,.035,end-.006],p.edge);
  cylinder(g,r*.67,.002,[0,.035,end-.008],p.black);
  // Attach effects to the actual bore face, including the pistol's moving slide.
  const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(0,.035,end-.009);g.add(muzzle);
  for(const x of [-r*1.36,r*1.36])for(let i=0;i<2;i++)part(g,[.002,.013,.006],[x,.035,end+.009+i*.013],p.black,.001);
}
function sights(g:THREE.Object3D,p:Finish,front:number,rear=.06,height=.106){
  part(g,[.024,.033,.022],[0,height,front],p.black);part(g,[.014,.024,.01],[0,height+.022,front],p.edge);
  for(const x of [-.025,.025])part(g,[.014,.037,.03],[x,height,rear],p.black);
}
function label(art:WorldArt,g:THREE.Object3D,text:string,at:number[],w:number,h:number,rotation=-Math.PI/2,color='#c6c5ad'){
  const cache=lettering.get(art)??new Map<string,THREE.MeshStandardMaterial>();lettering.set(art,cache);const key=`${text}:${color}`;let mat=cache.get(key);
  if(!mat){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d')!;c.clearRect(0,0,512,128);c.fillStyle=color;c.font='bold 46px monospace';c.textAlign='center';c.fillText(text,256,80);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;art.textures.push(map);mat=new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.8,polygonOffset:true,polygonOffsetFactor:-1});art.materials.push(mat);cache.set(key,mat);}
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);mesh.position.set(...at as [number,number,number]);mesh.rotation.x=rotation;g.add(mesh);return mesh;
}
function rifle(art:WorldArt,g:THREE.Group,p:Finish){
  profile(g,[[.15,.07],[-.30,.07],[-.32,.022],[-.26,-.042],[-.11,-.05],[-.06,-.08],[.13,-.065]],.086,p.steel);
  profile(g,[[.10,-.065],[.035,-.065],[.085,-.255],[.155,-.235]],.068,p.polymer);
  for(let i=0;i<7;i++)part(g,[.071,.008,.055],[0,-.09-i*.021,.055+i*.006],p.rubber,.002);
  const stock=shoulderStock(g);cylinder(stock,.028,.13,[0,.015,.195],p.steel);
  part(g,[.11,.013,.028],[0,.075,.12],p.black,.003);
  profile(stock,[[.24,.055],[.45,.045],[.45,-.10],[.32,-.09],[.26,-.02]],.078,p.polymer);part(stock,[.10,.16,.025],[0,-.025,.46],p.rubber);
  part(g,[.10,.10,.25],[0,.018,-.42],p.polymer);
  for(let i=0;i<9;i++){part(g,[.108,.013,.014],[0,.075,-.30-i*.027],p.steel,.002);for(const x of [-.052,.052])part(g,[.003,.028,.015],[x,.021,-.32-i*.025],p.black,.001);}
  part(g,[.003,.032,.09],[.046,.019,-.028],p.black);part(g,[.015,.012,.042],[.053,.009,-.004],p.edge);
  for(const z of [.075,-.07,-.20])screw(g,.045,-.025,z,p);
  trigger(g,p);magazine(g,p,'rifle');barrel(g,p,-.53,MUZZLE_Z.rifle);sights(g,p,-.57,.075);
  label(art,g,'5.56 × 45',[0,.078,-.13],.10,.023);
}
function pistol(art:WorldArt,g:THREE.Group,p:Finish){
  const slide=new THREE.Group();slide.name='slide';profile(slide,[[.073,.062],[.057,.079],[-.298,.079],[-.330,.063],[-.330,.004],[.073,.004]],.079,p.steel);g.add(slide);
  part(slide,[.004,.025,.055],[.041,.047,-.115],p.black);
  for(const x of [-.041,.041])for(let i=0;i<8;i++)part(slide,[.002,.053,.004],[x,.038,.004+i*.008],p.black,.0005);
  profile(g,[[.075,-.008],[-.21,-.008],[-.19,-.052],[-.05,-.06],[.025,-.07],[.075,-.27],[.145,-.245]],.069,p.polymer);
  for(let i=0;i<9;i++)part(g,[.071,.006,.049],[0,-.095-i*.017,.048+i*.005],p.rubber,.001);
  // Recess the barrel inside a compact ported compensator instead of exposing
  // a long pencil-thin tube beyond the slide.
  part(slide,[.075,.070,.043],[0,.035,-.348],p.black,.005);for(const side of [-1,1])for(let i=0;i<2;i++)part(slide,[.002,.018,.008],[side*.038,.043,-.335-i*.016],p.recess,.001);
  barrel(slide,p,-.295,MUZZLE_Z.pistol,.014);sights(slide,p,-.299,.04,.084);trigger(g,p);magazine(g,p,'pistol');
  for(const z of [.045,-.024])screw(g,.038,-.03,z,p);label(art,slide,'P12  9×19',[0,.079,-.115],.10,.019);
}
function smg(art:WorldArt,g:THREE.Group,p:Finish){
  cylinder(g,.043,.36,[0,.028,-.06],p.steel);part(g,[.074,.053,.20],[0,-.037,-.005],p.polymer);
  profile(g,[[.095,-.058],[.028,-.058],[.065,-.245],[.13,-.228]],.067,p.polymer);
  part(g,[.094,.10,.18],[0,.006,-.29],p.polymer);
  for(let i=0;i<9;i++)part(g,[.098,.085,.009],[0,.006,-.215-i*.019],p.rubber,.003);
  const stock=shoulderStock(g);for(const x of [-.035,.035])cylinder(stock,.009,.24,[x,.032,.21],p.edge);part(stock,[.085,.17,.03],[0,-.012,.34],p.rubber);
  barrel(g,p,-.37,MUZZLE_Z.smg);ring(g,.036,.006,[0,.094,-.45],p.steel);part(g,[.01,.03,.008],[0,.082,-.45],p.edge);
  cylinder(g,.027,.033,[0,.103,.065],p.steel,'y');part(g,[.07,.016,.11],[0,.078,-.09],p.black);
  part(g,[.012,.026,.065],[.05,.035,-.08],p.edge);trigger(g,p);magazine(g,p,'smg');label(art,g,'9×19',[0,.074,-.07],.06,.021);
}
function sniper(art:WorldArt,g:THREE.Group,p:Finish){
  // A long bolt-action receiver over a moulded olive chassis, with an independent optic.
  profile(g,[[.17,-.015],[-.49,-.015],[-.51,-.075],[-.25,-.09],[-.12,-.065],[.005,-.09],[.06,-.25],[.13,-.24],[.10,-.075],[.17,-.07]],.095,p.olive);
  cylinder(g,.036,.42,[0,.035,-.095],p.steel);
  const bolt=new THREE.Group();bolt.name='bolt';cylinder(bolt,.024,.13,[0,.04,.063],p.edge);cylinder(bolt,.012,.065,[.06,.035,.08],p.steel,'x');const knob=new THREE.Mesh(new THREE.SphereGeometry(.023,16,12),p.black);knob.position.set(.10,.015,.08);bolt.add(knob);g.add(bolt);
  part(g,[.006,.034,.105],[.037,.038,-.08],p.black);
  const stock=shoulderStock(g);profile(stock,[[.17,.015],[.47,.025],[.47,-.14],[.34,-.13],[.24,-.08],[.17,-.06]],.10,p.olive);part(stock,[.11,.18,.026],[0,-.06,.48],p.rubber);part(stock,[.095,.039,.15],[0,.048,.33],p.olive);
  for(const z of [-.25,-.44]){screw(g,.05,-.047,z,p);part(g,[.105,.013,.025],[0,-.082,z],p.black);}
  trigger(g,p);magazine(g,p,'marksman');barrel(g,p,-.28,MUZZLE_Z.marksman,.020);
  // Objective bell, ocular bell, adjustment turrets, clamps and glass coated lenses.
  for(const z of [-.26,-.035]){part(g,[.052,.045,.038],[0,.095,z],p.black);ring(g,.037,.008,[0,.151,z],p.steel);}
  cylinder(g,.030,.34,[0,.151,-.15],p.black);
  cylinder(g,.056,.13,[0,.151,-.37],p.steel,'z',.034);cylinder(g,.047,.09,[0,.151,.055],p.black);
  for(const z of [-.44,.105]){ring(g,z<0?.054:.046,.005,[0,.151,z],p.edge);cylinder(g,z<0?.048:.04,.002,[0,.151,z+(z<0?-.002:.002)],p.glass);}
  cylinder(g,.026,.040,[0,.20,-.16],p.black,'y');cylinder(g,.022,.045,[.045,.151,-.16],p.black,'x');
  for(let i=0;i<12;i++){const a=i*Math.PI/6;part(g,[.004,.021,.004],[Math.cos(a)*.026,.20,-.16+Math.sin(a)*.026],p.edge,.001);}
  label(art,g,'3–8× OPTIC',[0,.184,-.13],.08,.017);label(art,g,'PRECISION  .338',[0,-.012,-.365],.12,.024);
}
function knife(g:THREE.Group,p:Finish,view:boolean){
  if(view)g.rotation.set(.35,.9,-.12);
  profile(g,[[.125,.024],[-.075,.024],[-.075,-.025],[.125,-.025]],.058,p.polymer);
  for(let i=0;i<8;i++)part(g,[.063,.057,.009],[0,0,-.06+i*.023],p.rubber,.003);
  part(g,[.145,.023,.032],[0,0,-.092],p.steel);part(g,[.067,.059,.018],[0,0,.132],p.steel);
  for(const z of [-.015,.086])screw(g,0,.03,z,p,'y');
  const shape=new THREE.Shape();shape.moveTo(-.033,0);shape.lineTo(.038,0);shape.lineTo(.035,.23);shape.lineTo(.005,.39);shape.lineTo(-.029,.30);shape.closePath();
  const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:true,bevelSize:.008,bevelThickness:.003,bevelSegments:3,steps:1}),p.blade);blade.rotation.x=-Math.PI/2;blade.position.set(0,0,-.11);g.add(blade);
  // A shallow darker fuller and separate spine make the bevel readable in daylight.
  part(g,[.015,.002,.19],[0,.013,-.225],p.steel,.003);
  for(let i=0;i<6;i++)part(g,[.011,.018,.01],[-.029,.003,-.13-i*.019],p.edge,.002);
}
function grenade(art:WorldArt,g:THREE.Group,p:Finish){
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.077,32,24),p.olive);shell.scale.y=1.18;shell.position.y=.015;g.add(shell);
  for(const y of [-.025,.023,.064]){const r=Math.sqrt(Math.max(.001,.077**2-((y-.015)/1.18)**2));ring(g,r,.0022,[0,y,0],p.black,'y');}
  cylinder(g,.026,.032,[0,.113,0],p.steel,'y');part(g,[.023,.011,.105],[.013,.135,.025],p.steel);const lever=part(g,[.018,.14,.023],[.072,.07,.027],p.steel);lever.rotation.z=.13;
  ring(g,.032,.004,[-.043,.138,.012],p.edge);cylinder(g,.005,.065,[-.014,.133,.013],p.edge,'x');ring(g,.064,.005,[0,.064,0],p.brass,'y');
  label(art,g,'FRAG',[0,.035,.075],.07,.019,0,'#d0bb70');label(art,g,'HE  /  M67',[0,.012,.078],.075,.015,0,'#d0bb70');
}
function bomb(art:WorldArt,g:THREE.Group,p:Finish){
  for(const x of [-.13,0,.13]){part(g,[.119,.16,.27],[x,-.018,0],p.olive,.012);part(g,[.122,.045,.274],[x,-.022,0],p.rubber,.003);}
  part(g,[.34,.027,.23],[0,.086,0],p.black);part(g,[.14,.018,.067],[-.075,.112,-.065],p.polymer);
  const screen=part(g,[.125,.004,.051],[-.075,.124,-.065],art.material('#638d6b',{emissive:'#3b613f',emissiveIntensity:.6}));screen.name='bombScreen';
  label(art,g,'00:40',[-.075,.127,-.065],.105,.033,-Math.PI/2,'#d2e6ba');
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){const x=.027+col*.035,z=-.078+row*.034;part(g,[.025,.014,.024],[x,.113,z],p.rubber,.003);label(art,g,String((row*3+col+1)%10),[x,.122,z],.016,.015);}
  const wireRed=art.material('#9a3c2c',{roughness:.7}),wireBlue=art.material('#315565',{roughness:.7});
  cable(g,[[-.16,.092,.07],[-.20,.12,.09],[-.13,.15,.11],[.02,.12,.08]],wireRed);
  cable(g,[[-.14,.092,.08],[-.17,.14,.12],[-.05,.16,.13],[.12,.11,.07]],wireBlue);
  for(const x of [-.155,.155])for(const z of [-.098,.098])screw(g,x,.102,z,p,'y');
  const led=new THREE.Mesh(new THREE.SphereGeometry(.009,12,10),art.material('#f34a25',{emissive:'#ff3010',emissiveIntensity:2}));led.name='bombLight';led.position.set(-.15,.12,.045);g.add(led);
}
export function equipmentModel(art:WorldArt,kind:Equipment,viewmodel=true,heldByAvatar=false,avatar:AvatarId='operator'){
  const g=new THREE.Group(),p=palette(art);
  switch(kind){case 'rifle':rifle(art,g,p);break;case 'pistol':pistol(art,g,p);break;case 'smg':smg(art,g,p);break;case 'marksman':sniper(art,g,p);break;case 'knife':knife(g,p,viewmodel);break;case 'grenade':grenade(art,g,p);break;case 'bomb':bomb(art,g,p);break;}
  if(isGun(kind))addGunDetails(art,g,kind,p);
  g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return viewmodel||heldByAvatar?addHands(art,g,kind,heldByAvatar,avatar):g;
}
