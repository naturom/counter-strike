import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {isGun,type Equipment,type AvatarId} from '@sirocco/shared';
import type {WorldArt} from './world';
import {realHandGeometry,anatomicalSkinTextures} from './character-anatomy';
import {CHARACTER_STYLE} from './character-style';
import {createSuitArm,updateSuitArm,refreshSuitArmAnchors} from './suit-arm';
import {knifeSwing} from './knife-swing';
import {createSuitGrip} from './suit-grip';
import {WONDER_WOMAN_ARM_LIFT} from './wonder-woman-proportions';
import {fitHandCuff} from './hand-cuff';

type Materials={fabric:THREE.Material;leather:THREE.Material;rubber:THREE.Material;seam:THREE.Material;sleeve:THREE.Material;accent:THREE.Material;glow:THREE.Material;avatar:AvatarId};
const palettes=new WeakMap<WorldArt,Map<AvatarId,Materials>>();
function materials(art:WorldArt,avatar:AvatarId){
  const cache=palettes.get(art)??new Map<AvatarId,Materials>();palettes.set(art,cache);let result=cache.get(avatar);if(result)return result;const style=CHARACTER_STYLE[avatar];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#a69b82';ctx.fillRect(0,0,256,256);
  // Original woven fabric, with a fine, deterministic raised thread pattern.
  for(let y=0;y<256;y+=3)for(let x=0;x<256;x+=3){const n=(x*17+y*31)%23;ctx.fillStyle=`rgba(${n<12?'38,32,24':'237,223,188'},${.08+n*.005})`;ctx.fillRect(x,y,2,1);ctx.fillRect(x+1,y+1,1,2);}
  if(style.surface==='bark'){
    ctx.fillStyle='#b9ab8c';ctx.fillRect(0,0,256,256);
    for(let i=0;i<45;i++){const x=i*6;ctx.strokeStyle=i%3?'#6a604f':'#dfd0af';ctx.lineWidth=i%4===0?3:1;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+14,85,x-12,170,x+4,256);ctx.stroke();}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;art.textures.push(map);
  const bare=style.surface==='skin'||style.surface==='bark',armor=style.surface==='armor';
  result={avatar,fabric:art.material(style.hands,{map:style.surface==='bark'?map:null,bumpMap:armor?null:map,bumpScale:style.surface==='bark'?.004:bare?.0008:.00035,metalness:armor?style.metal:0,roughness:armor?.30:.82,...(style.surface==='skin'?anatomicalSkinTextures(art):{})}),leather:art.material(bare?style.hands:style.trim,{roughness:.76}),rubber:art.material(bare?style.hands:style.trim,{roughness:.87}),seam:art.material(bare?style.secondary:style.trim,{roughness:.85}),sleeve:art.material(bare?style.hands:style.primary,{map:style.surface==='bark'?map:null,bumpMap:armor?null:map,bumpScale:style.surface==='bark'?.006:bare?.001:.0006,metalness:armor?style.metal:.02,roughness:armor?.32:.86,...(style.surface==='skin'?anatomicalSkinTextures(art):{})}),accent:art.material(style.secondary,{metalness:style.metal,roughness:.42}),glow:art.material('#d7f5ff',{emissive:'#83d9ff',emissiveIntensity:2})};
  cache.set(avatar,result);return result;
}
const articulated=(avatar:AvatarId)=>avatar==='ironman'||avatar==='ultraman'||avatar==='wonder-woman';
const v=(p:number[])=>new THREE.Vector3(...p as [number,number,number]);
function rounded(parent:THREE.Group,size:number[],at:number[],mat:THREE.Material,r=.015){const m=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],3,r),mat);m.position.copy(v(at));parent.add(m);return m;}
function oval(parent:THREE.Group,size:number[],at:number[],mat:THREE.Material){const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),mat);m.scale.copy(v(size));m.position.copy(v(at));parent.add(m);return m;}
function tube(parent:THREE.Group,points:number[][],radius:number,mat:THREE.Material){const path=new THREE.CatmullRomCurve3(points.map(v));const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,16,radius,8,false),mat);parent.add(mesh);return mesh;}
function limb(parent:THREE.Group,start:number[],end:number[],a:number,b:number,mat:THREE.Material){const from=v(start),to=v(end),delta=to.clone().sub(from);const mesh=new THREE.Mesh(new THREE.LatheGeometry([[a*.92,-delta.length()/2],[a,-delta.length()*.33],[(a+b)*.52,0],[b,delta.length()*.30],[b*.92,delta.length()/2]].map(([r,y])=>new THREE.Vector2(r,y)),24),mat);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(mesh);oval(parent,[b,b,b],end,mat);}
function bake(group:THREE.Group){
  group.updateMatrixWorld(true);const groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
  group.traverse(o=>{if(o instanceof THREE.Mesh){const mat=o.material as THREE.Material;const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);const list=groups.get(mat)??[];list.push(geo);groups.set(mat,list);o.geometry.dispose();}});
  group.clear();for(const [mat,geos] of groups){const merged=mergeGeometries(geos);geos.forEach(g=>g.dispose());if(merged)group.add(new THREE.Mesh(merged,mat));}
}
function armoredHand(m:Materials,left:boolean,open:boolean,kind:Equipment){
 const g=new THREE.Group();g.name='articulatedIronHand';
 rounded(g,[.093,.043,.092],[0,0,.019],m.rubber,.012);
 rounded(g,[.088,.014,.082],[0,.027,.019],m.fabric,.009);
 for(const side of [-1,1])rounded(g,[.014,.012,.073],[side*.039,.025,.022],m.accent,.004);
 const reactor=new THREE.Mesh(new THREE.CylinderGeometry(.021,.021,.004,32),m.glow);reactor.position.set(0,-.024,.021);g.add(reactor);
 const bezel=new THREE.Mesh(new THREE.TorusGeometry(.023,.003,6,28),m.accent);bezel.rotation.x=Math.PI/2;bezel.position.set(0,-.025,.021);g.add(bezel);
 for(let i=0;i<4;i++){
  const x=-.034+i*.023,index=(isGun(kind)||kind==='bomb')&&!left&&i===0;
  const front=-Math.sqrt(Math.max(.0015,.077**2-(.020-x)**2))-.041;
  const points=kind==='grenade'&&!left?[[x,0,-.01],[x,-.012,-.055],[x,-.050,front],[x,-.09,front]]:open?[[x,0,-.019],[x,.001,-.066],[x,-.008,-.107],[x,-.023,-.127]]:index?[[x,0,-.02],[x,-.005,-.087],[x,-.035,-.108],[x,-.052,-.080]]:[[x,0,-.02],[x,-.005,-.064],[x,-.040,-.073],[x,-.060,-.025]];
  for(let j=0;j<3;j++){limb(g,points[j],points[j+1],.0105-j*.001,.0095-j*.001,m.fabric);oval(g,[.0105,.0105,.0105],points[j],m.rubber);}
  rounded(g,[.019,.009,.023],[x,.028,-.026],i===0?m.accent:m.fabric,.003);
 }
 const side=left?1:-1;const thumb=[[side*.043,0,.038],[side*.062,-.020,.003],[side*.047,-.047,-.027],[side*.024,-.054,-.035]];
 for(let i=0;i<3;i++)limb(g,thumb[i],thumb[i+1],.013-i*.001,.012-i*.001,m.fabric);
 for(let i=0;i<3;i++)rounded(g,[.091,.013,.017],[0,.014,.071+i*.016],i===1?m.accent:m.fabric,.004);
 bake(g);return g;
}
function hand(m:Materials,left:boolean,open=false,kind:Equipment='rifle'){
  if(m.avatar==='ironman')return armoredHand(m,left,open,kind);
  if(m.avatar==='ultraman'&&(kind==='bomb'||kind==='knife'||kind==='grenade'))return createSuitGrip(m.fabric,left,left&&kind==='grenade'?'knife':kind,left&&kind!=='bomb');
  const g=new THREE.Group();
  let geometry=realHandGeometry(m.avatar,left,open);if(m.avatar==='wonder-woman')geometry=fitHandCuff(geometry,.028,.021);
  g.add(new THREE.Mesh(geometry,m.fabric));
  if(m.avatar==='ultraman'||m.avatar==='wonder-woman'){bake(g);return g;}
  rounded(g,[.092,.061,.048],[0,-.001,.102],m.rubber,.012);
  rounded(g,[.078,.012,.022],[0,.031,.103],m.fabric,.004);
  for(let i=0;i<8;i++)rounded(g,[.003,.002,.008],[-.033+i*.009,.038,.103],m.seam,.001);
  if(m.avatar==='spiderman'){
    for(const x of [-.04,0,.04])tube(g,[[x,.029,.08],[x*.75,.029,.01],[x,.023,-.06]],.0016,m.seam);
    for(const z of [-.035,.005,.045,.08])tube(g,[[-.05,.022,z],[0,.030,z-.009],[.05,.022,z]],.0015,m.seam);
  }
  if(m.avatar==='groot')for(let i=0;i<8;i++){const x=-.045+i*.013;tube(g,[[x,.025,.09],[x+.007,.030,.02],[x-.005,.025,-.06]],.0025,i%2?m.accent:m.seam);}
  bake(g);return g;
}
type IronArmRig={palm:THREE.Group;forearm:THREE.Group;upper:THREE.Group;elbow:THREE.Mesh;shoulder:THREE.Vector3;left:boolean;thirdPerson:boolean;skin?:THREE.Mesh;elbowTarget?:THREE.Vector3;relaxedWrist?:{position:THREE.Vector3;rotation:THREE.Quaternion;maxAngle:number}};
function syncIronArm(root:THREE.Group){
 const rig=root.userData.ironArm as IronArmRig|undefined;if(!rig)return;
 if(rig.relaxedWrist){rig.palm.position.copy(rig.relaxedWrist.position);rig.palm.quaternion.copy(rig.relaxedWrist.rotation);}
 root.updateMatrix();rig.palm.updateMatrix();
 const shoulder=rig.shoulder.clone().applyMatrix4(root.matrix.clone().invert()),wrist=new THREE.Vector3(0,0,.12).applyMatrix4(rig.palm.matrix);
 const elbow=shoulder.clone().lerp(wrist,.52).add(new THREE.Vector3(rig.left?-.12:.12,-.10,.08));
 if(rig.thirdPerson){
  // Two-bone IK: both arms use the same anatomical lengths, without stretching
  // a forearm to accommodate an arbitrary elbow position.
  const upperLength=rig.skin?.userData.upperLength??.34/.75,forearmLength=rig.skin?.userData.forearmLength??.32/.75,axis=wrist.clone().sub(shoulder),distance=axis.length();axis.normalize();
  const reach=Math.min(distance,upperLength+forearmLength-.0001);
  const along=(upperLength*upperLength-forearmLength*forearmLength+reach*reach)/(2*reach);
  const bend=rig.elbowTarget?rig.elbowTarget.clone().applyMatrix4(root.matrix.clone().invert()).sub(shoulder):new THREE.Vector3(rig.left?-1:1,rig.skin?-1:-.2,rig.skin?-.12:-.35).transformDirection(root.matrix.clone().invert());
  bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upperLength*upperLength-along*along)));
 }
 const fit=(part:THREE.Group,a:THREE.Vector3,b:THREE.Vector3)=>{const delta=b.clone().sub(a);part.position.copy(a);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());part.scale.y=delta.length();};
 fit(rig.forearm,wrist,elbow);fit(rig.upper,shoulder,elbow);rig.elbow.position.copy(elbow);
 if(rig.relaxedWrist){
  // Keep the guard hand's wrist anchored while reducing its bend relative to
  // the forearm. Reset from the authored pose above so swings cannot accumulate
  // rotation or translation drift. The palm retains its natural finger curl.
  const axis=new THREE.Vector3(0,0,1).applyQuaternion(rig.palm.quaternion),forearm=elbow.clone().sub(wrist).normalize(),angle=axis.angleTo(forearm),limit=rig.relaxedWrist.maxAngle;
  if(angle>limit){
   const turn=new THREE.Quaternion().setFromUnitVectors(axis,forearm),correction=new THREE.Quaternion().slerp(turn,(angle-limit)/angle);
   rig.palm.quaternion.premultiply(correction);
   rig.palm.position.copy(wrist).sub(new THREE.Vector3(0,0,.12).multiply(rig.palm.scale).applyQuaternion(rig.palm.quaternion));
   rig.palm.updateMatrix();
  }
 }
 if(rig.skin){const clavicle=rig.shoulder.clone().add(new THREE.Vector3(rig.left?.20:-.20,.025,0)).applyMatrix4(root.matrix.clone().invert());rig.skin.userData.gloveWrist=rig.palm.matrix;rig.skin.userData.wristRadii=rig.skin.userData.style==='ironman'?[.042,.029]:rig.palm.userData.gripKind?[.034,.027]:rig.skin.userData.style==='wonder-woman'?[.028,.021]:[.032,.023];updateSuitArm(rig.skin,clavicle,shoulder,elbow,wrist);}
}
function ironArm(m:Materials,left:boolean,at:number[],rotation:number[],open:boolean,thirdPerson:boolean,kind:Equipment){
 const root=new THREE.Group(),palm=(m.avatar==='ultraman'||m.avatar==='wonder-woman')?hand(m,left,open,kind):armoredHand(m,left,open,kind);palm.position.copy(v(at));palm.rotation.set(...rotation as [number,number,number]);root.add(palm);
 const forearm=new THREE.Group(),upper=new THREE.Group();root.add(forearm,upper);
 limb(forearm,[0,0,0],[0,1,0],.052,.085,m.rubber);
 if(m.avatar!=='ultraman'){
 const shell=new THREE.Mesh(new THREE.CylinderGeometry(.090,.062,.90,12,1,false),m.sleeve);shell.position.y=.50;forearm.add(shell);
 rounded(forearm,[.10,.66,.035],[0,.52,-.072],m.sleeve,.01);
 rounded(forearm,[.024,.49,.018],[0,.53,-.093],m.accent,.004);
 for(const y of [.19,.86]){const ring=new THREE.Mesh(new THREE.TorusGeometry(y<.5?.063:.088,.004,6,28),m.accent);ring.rotation.x=Math.PI/2;ring.position.y=y;forearm.add(ring);}
 for(let i=0;i<3;i++)rounded(forearm,[.045,.027,.014],[.055,.63+i*.055,-.059],m.seam,.003);
 }else{limb(forearm,[0,0,0],[0,1,0],.048,.066,m.fabric);const band=new THREE.Mesh(new THREE.CylinderGeometry(.067,.062,.20,24),m.accent);band.position.y=.78;forearm.add(band);}
 limb(upper,[0,0,0],[0,1,0],.087,.072,m.sleeve);
 bake(forearm);bake(upper);
 const elbow=new THREE.Mesh(new THREE.SphereGeometry(.065,18,12),m.sleeve);root.add(elbow);
 // Keep the first-person upper-arm seam below the camera even during reloads.
 root.userData.ironArm={palm,forearm,upper,elbow,left,thirdPerson,shoulder:thirdPerson?(m.avatar==='wonder-woman'?new THREE.Vector3(left?-.2266666667:.3866666667,.3466666667,.5):m.avatar==='ultraman'?new THREE.Vector3(left?-.24:.4533333333,.36,.5866666667):new THREE.Vector3(left?-.32:.54,.24,.64)):new THREE.Vector3(left?-.60:.48,-.78,.76)} satisfies IronArmRig;
 if(m.avatar==='wonder-woman'&&left&&kind==='knife')root.userData.ironArm.relaxedWrist={position:palm.position.clone(),rotation:palm.quaternion.clone(),maxAngle:THREE.MathUtils.degToRad(18)};
 if(articulated(m.avatar)){const rig=root.userData.ironArm as IronArmRig;rig.skin=createSuitArm(m.sleeve,m.accent,m.avatar as 'ironman'|'ultraman'|'wonder-woman',left,m.rubber,!thirdPerson);root.add(rig.skin);forearm.visible=upper.visible=elbow.visible=false;}
 syncIronArm(root);return root;
}
function arm(m:Materials,left:boolean,at:number[],rotation:number[],open=false,thirdPerson=false,kind:Equipment='rifle'){
  if(articulated(m.avatar))return ironArm(m,left,at,rotation,open,thirdPerson,kind);
  const root=new THREE.Group(),palm=hand(m,left,open,kind);palm.position.copy(v(at));palm.rotation.set(...rotation as [number,number,number]);root.add(palm);palm.updateMatrixWorld(true);
  const wrist=palm.localToWorld(new THREE.Vector3(0,0,.12));
  const elbow=thirdPerson?new THREE.Vector3(left?-.50:.18,-.13,.30):new THREE.Vector3(left?-.48:.37,-.44,.68),cuff=wrist.clone().lerp(elbow,.18);
  if(thirdPerson)limb(root,elbow.toArray(),[left?-.76:.10,.24,.32],.09,.10,m.sleeve);
  limb(root,cuff.toArray(),elbow.toArray(),.073,.11,m.sleeve);
  limb(root,wrist.toArray(),cuff.toArray(),.043,.071,m.fabric);
  const seam=cuff.clone().lerp(elbow,.65);
  tube(root,[[cuff.x,cuff.y+.052,cuff.z],[seam.x,seam.y+.072,seam.z],[elbow.x,elbow.y+.09,elbow.z]],.002,m.seam);
  if(['ironman','batman','wonder-woman','thor','black-widow'].includes(m.avatar)){
    const panel=new THREE.Group(),delta=elbow.clone().sub(cuff);panel.position.copy(cuff).lerp(elbow,.46);panel.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());root.add(panel);
    const guard=new THREE.Mesh(new THREE.CylinderGeometry(.10,.075,delta.length()*.70,8,1,true),m.avatar==='thor'?m.accent:m.sleeve);panel.add(guard);
    for(const y of [-.08,0,.08])rounded(panel,[.14,.017,.11],[0,y,0],m.rubber,.005);
    if(m.avatar==='batman')for(let i=0;i<3;i++){const fin=new THREE.Mesh(new THREE.ConeGeometry(.026,.09,3),m.accent);fin.position.set(.11,-.08+i*.07,0);fin.rotation.z=-1;panel.add(fin);}
    if(m.avatar==='black-widow')for(let i=0;i<6;i++)oval(panel,[.012,.027,.012],[Math.cos(i*Math.PI/3)*.09,0,Math.sin(i*Math.PI/3)*.09],m.accent);
  }
  if(m.avatar==='spiderman'){
    const axis=elbow.clone().sub(cuff).normalize(),u=new THREE.Vector3(1,0,0).cross(axis).normalize(),w=axis.clone().cross(u).normalize();
    const at=(t:number,a:number)=>cuff.clone().lerp(elbow,t).addScaledVector(u,Math.cos(a)*(.075+t*.038)).addScaledVector(w,Math.sin(a)*(.075+t*.038)).toArray();
    for(let ring=1;ring<7;ring++){const pts=[];for(let i=0;i<=24;i++)pts.push(at(ring/7,i*Math.PI/12));tube(root,pts,.0013,m.seam);}
    for(let line=0;line<8;line++)tube(root,[at(.05,line*Math.PI/4),at(.5,line*Math.PI/4),at(.96,line*Math.PI/4)],.0014,m.seam);
  }
  if(m.avatar==='groot')for(let i=0;i<9;i++){const p=cuff.clone().lerp(elbow,i/10),q=cuff.clone().lerp(elbow,(i+2)/10);tube(root,[[p.x+.06,p.y+.045,p.z],[q.x+.065,q.y+.065,q.z]],.005,i%2?m.accent:m.seam);}
  // Sleeve folds follow the forearm, rather than floating rings.
  if(!['skin','bark'].includes(CHARACTER_STYLE[m.avatar].surface))for(const t of [.28,.42,.61]){const p=cuff.clone().lerp(elbow,t);oval(root,[.077,.016,.03],[p.x,p.y+.045,p.z],m.sleeve);}
  bake(root);return root;
}
export function addHands(art:WorldArt,body:THREE.Group,kind:Equipment,thirdPerson=false,avatar:AvatarId='operator'){
  const m=materials(art,avatar),root=new THREE.Group();body.name='equipmentBody';root.add(body);
  let right:number[]=[.082,-.125,.055],left:number[]=[-.025,-.105,-.33],rr=[0,0,-1.2],lr=[0,0,Math.PI];
  if(kind==='pistol'){left=[-.055,-.14,.075];lr=[.1,.15,1.15];}
  if(kind==='smg')left=[-.025,-.11,-.255];
  if(kind==='marksman')left=[-.025,-.105,-.37];
  if(kind==='knife'){right=[.075,-.025,.04];left=[-.46,-.035,-.08];lr=[-.15,-.3,.5];}
  if(kind==='grenade'){right=[.10,-.025,.04];left=[-.39,-.14,.04];lr=[-.15,-.1,.35];}
  if(kind==='bomb'){right=[.215,-.025,.05];left=[-.215,-.025,.05];rr=[0,-.2,-1.1];lr=[0,.2,1.1];}
  if(articulated(avatar)){
    right=[kind==='grenade'?.10:.064,kind==='knife'?0:kind==='grenade'?-.025:-.125,kind==='knife'?.045:.055];rr=[0,0,-Math.PI/2];
    if(isGun(kind)&&kind!=='pistol'){left=[0,-.09,kind==='marksman'?-.37:kind==='smg'?-.255:-.38];lr=[0,0,Math.PI];}
    if(kind==='pistol'){right=[.063,-.131,.075];rr=[.08,0,-1.40];left=[-.069,-.156,.037];lr=[.10,-.08,1.48];}
    if(kind==='knife')body.rotation.set(0,0,0);
    if(kind==='bomb'){right=[.215,-.035,.045];left=[-.130,-.125,.05];rr=[0,0,-Math.PI/2];lr=[0,0,Math.PI];}
    if(kind==='grenade'){right=[.095,.035,.035];left=[-.22,-.045,.015];rr=[0,0,-Math.PI/2];lr=[.05,-.2,1.15];}
  }
  if(articulated(avatar)&&thirdPerson&&isGun(kind)&&kind!=='pistol')left[2]=avatar==='wonder-woman'?-.020:avatar==='ironman'&&kind==='marksman'?-.085:kind==='marksman'?-.10:-.08;
  if(avatar==='ultraman'){
    if(kind==='knife'){right=[Math.sin(.85)*.034,.031,.040+Math.cos(.85)*.034];rr=[0,.85,0];left=[-.30,-.14,.16];lr=[.25,-.25,.3];}
    if(kind==='grenade'){body.scale.setScalar(.78);right=[.080,.012,.015];rr=[0,0,-Math.PI/2];left=[-.28,-.14,.15];lr=[.2,-.25,.3];}
    if(kind==='bomb'){right=[.13,-.125,-.035];left=[-.13,-.125,-.035];rr=[0,0,Math.PI];lr=[0,0,Math.PI];}
  }
  const r=arm(m,false,right,rr,false,thirdPerson,kind),l=arm(m,true,left,lr,kind==='knife'||kind==='grenade',thirdPerson,kind);r.name='rightArm';l.name='leftArm';root.add(r,l);
  if((avatar==='ultraman'||thirdPerson&&articulated(avatar))&&(kind==='knife'||kind==='grenade'||kind==='bomb')){
    body.updateMatrix();const palm=r.userData.ironArm.palm as THREE.Group;palm.updateMatrix();
    root.userData.suitItemGrip={contact:body.matrix.clone().invert().multiply(palm.matrix),restPosition:body.position.clone(),restQuaternion:body.quaternion.clone()};
  }
  if(kind==='knife'&&!thirdPerson&&avatar!=='ultraman'){
    const pivot=new THREE.Group(),origin=new THREE.Vector3(.075,-.025,.04);pivot.name='knifeWrist';pivot.position.copy(origin);root.add(pivot);pivot.add(body,r);body.position.sub(origin);r.position.sub(origin);root.userData.knifeRig={pivot,origin,rest:articulated(avatar)?new THREE.Vector3(.18,.38,-.08):new THREE.Vector3()};
  }
  if(articulated(avatar)&&kind==='bomb'&&!thirdPerson){root.position.x=-.18;root.rotation.x=.24;}
  root.userData.avatar=avatar;root.userData.thirdPerson=thirdPerson;root.userData.handRig={right:r,left:l,body,magazine:body.getObjectByName('magazine')};if(avatar==='wonder-woman'&&!thirdPerson)root.position.y=WONDER_WOMAN_ARM_LIFT/.75;return root;
}
/** Move a palm to an item contact point without rotating it about the equipment origin. */
function placeIronPalm(arm:THREE.Group,at:number[],rotation:number[],weight:number){
 const iron=arm.userData.ironArm as IronArmRig|undefined;if(!iron)return;
 const desired=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation as [number,number,number]));
 const turn=desired.multiply(iron.palm.quaternion.clone().invert());arm.quaternion.identity().slerp(turn,weight);
 const rest=iron.palm.position.clone().applyQuaternion(arm.quaternion);arm.position.copy(v(at).sub(rest).multiplyScalar(weight));
}
export type HeldPose={reload:number;throwProgress:number;plant:number;slash?:number;reverseSlash?:boolean;reduceMotion?:boolean;death?:number};
export function animateHands(root:THREE.Group,kind:Equipment,pose:HeldPose){
  const rig=root.userData.handRig as {right:THREE.Group;left:THREE.Group;body:THREE.Group;magazine?:THREE.Object3D}|undefined;if(!rig)return;
  if(root.userData.thirdPerson&&root.userData.restPosition&&root.parent){
   root.position.copy(root.userData.restPosition).add(root.userData.motionOffset??new THREE.Vector3());
   root.quaternion.copy(root.userData.restQuaternion);if(root.userData.motionRotation)root.quaternion.multiply(root.userData.motionRotation);
   const reach=THREE.MathUtils.smoothstep(pose.reload,0,.18)*(1-THREE.MathUtils.smoothstep(pose.reload,.8,1));
   if(isGun(kind)&&root.userData.avatar!=='ultraman'){root.position.y+=.18*reach;root.position.z-=.035*reach;root.rotation.x-=.30*reach;root.rotation.z+=.10*reach;}
   refreshSuitArmAnchors(root.parent as THREE.Group,root);
  }
  const handLift=root.userData.avatar==='wonder-woman'&&!root.userData.thirdPerson?WONDER_WOMAN_ARM_LIFT/.75:0;if(handLift)root.position.y=handLift;
  rig.left.position.set(0,0,0);if(kind!=='knife')rig.right.position.set(0,0,0);rig.left.rotation.set(0,0,0);rig.right.rotation.set(0,0,0);rig.body.visible=true;if(articulated(root.userData.avatar)&&isGun(kind)&&!root.userData.thirdPerson){root.position.x=0;root.position.y=handLift;}if(articulated(root.userData.avatar)&&kind==='grenade')rig.body.rotation.set(0,0,0);
  if(isGun(kind)&&pose.reload>0){
    const p=pose.reload,reach=THREE.MathUtils.smoothstep(p,0,.18)*(1-THREE.MathUtils.smoothstep(p,.8,1)),drop=Math.sin(Math.PI*THREE.MathUtils.clamp((p-.18)/.55,0,1));
    rig.left.position.set(.045*reach,-.18*drop,.18*reach);rig.left.rotation.z=-.12*drop;
    if(rig.magazine){rig.magazine.position.y=rig.magazine.userData.restY-.29*drop;rig.magazine.position.z=rig.magazine.userData.restZ+.06*drop;
      const iron=rig.left.userData.ironArm as IronArmRig|undefined;
      if(iron){
        const grab=THREE.MathUtils.smoothstep(p,.02,.22)*(1-THREE.MathUtils.smoothstep(p,.78,.98)),extract=THREE.MathUtils.smoothstep(p,.24,.44)*(1-THREE.MathUtils.smoothstep(p,.54,.76));
        if(!root.userData.thirdPerson){root.position.x=-.08*grab;root.position.y=.11*grab+handLift;}
        rig.magazine.position.set(0,rig.magazine.userData.restY-(kind==='pistol'?.11:.16)*extract,rig.magazine.userData.restZ+.025*extract);
        placeIronPalm(rig.left,[rig.magazine.position.x-.065,rig.magazine.position.y-.02,rig.magazine.position.z+.015],[0,0,Math.PI/2],grab);
      }
    }
  }else if(rig.magazine){rig.magazine.position.y=rig.magazine.userData.restY;rig.magazine.position.z=rig.magazine.userData.restZ;}
  if(kind==='knife'){
    const wrist=root.userData.knifeRig as {pivot:THREE.Group;origin:THREE.Vector3;rest?:THREE.Vector3}|undefined;
    if(wrist){const poseAt=knifeSwing(pose.slash??1,pose.reverseSlash),scale=pose.reduceMotion?.5:1;wrist.pivot.position.copy(wrist.origin).add(new THREE.Vector3(poseAt.x,poseAt.y,poseAt.z).multiplyScalar(scale));wrist.pivot.rotation.set((wrist.rest?.x??0)+poseAt.pitch*scale,(wrist.rest?.y??0)+poseAt.yaw*scale,(wrist.rest?.z??0)+poseAt.roll*scale);rig.left.position.set(-.18*poseAt.guard,-.26*poseAt.guard,.08*poseAt.guard);rig.left.rotation.x=-.08*poseAt.guard;}
  }
  if(kind==='grenade'&&pose.throwProgress>0){rig.body.visible=articulated(root.userData.avatar)&&pose.throwProgress<.5;rig.right.rotation.x=-Math.sin(pose.throwProgress*Math.PI)*.9;if(articulated(root.userData.avatar))rig.body.rotation.x=rig.right.rotation.x;rig.left.position.y=-.12*Math.sin(pose.throwProgress*Math.PI);}
  if(kind==='bomb'&&pose.plant>0){
    if(articulated(root.userData.avatar)){const reach=THREE.MathUtils.smoothstep(pose.plant,0,.18);placeIronPalm(rig.right,[.075+.016*Math.sin(pose.plant*Math.PI*8),.18+.005*Math.sin(pose.plant*Math.PI*16),.035],[0,0,0],reach);}
    else{rig.right.rotation.x=Math.sin(pose.plant*Math.PI*16)*.045;rig.left.position.y=-.015*Math.sin(pose.plant*Math.PI);}
  }
  if(root.userData.suitItemGrip)animateSuitItemGrip(root,rig,kind,pose);
  if(pose.death){
    const weight=THREE.MathUtils.clamp(pose.death,0,1);
    placeIronPalm(rig.right,[.28,-.48,.52],[-Math.PI/2,0,-.1],weight);
    placeIronPalm(rig.left,[-.28,-.48,.52],[-Math.PI/2,0,.1],weight);
    rig.body.visible=weight<.35;
  }
  syncIronArm(rig.left);syncIronArm(rig.right);
}

/** Keep the glove contact in item space while the arm stays attached to the torso. */
function animateSuitItemGrip(root:THREE.Group,rig:{right:THREE.Group;left:THREE.Group;body:THREE.Group},kind:Equipment,pose:HeldPose){
 const saved=root.userData.suitItemGrip as {contact:THREE.Matrix4;restPosition:THREE.Vector3;restQuaternion:THREE.Quaternion},body=rig.body;
 body.position.copy(saved.restPosition);body.quaternion.copy(saved.restQuaternion);
 rig.right.position.set(0,0,0);rig.right.quaternion.identity();
 if(kind==='knife'){
  const swing=knifeSwing(pose.slash??1,pose.reverseSlash),weight=(root.userData.thirdPerson?.55:1)*(pose.reduceMotion?.5:1),turn=new THREE.Quaternion().setFromEuler(new THREE.Euler(swing.pitch*weight,swing.yaw*weight,swing.roll*weight)),pivot=new THREE.Vector3(0,0,.04);
  body.quaternion.premultiply(turn);body.position.copy(pivot).sub(pivot.clone().applyQuaternion(turn)).add(new THREE.Vector3(swing.x,swing.y,swing.z).multiplyScalar(weight));
  rig.left.position.set(-.035*swing.guard,-.055*swing.guard,.025*swing.guard);
 }
 if(kind==='grenade'){
  const p=pose.throwProgress,wind=Math.sin(Math.min(1,p/.5)*Math.PI/2),release=THREE.MathUtils.smoothstep(p,.42,.65);
  body.position.set(.025*wind,.055*wind,-.045*wind-.11*release);body.rotation.set(-.65*wind+.9*release,.12*wind,0);body.visible=p<.5;
  rig.left.position.set(0,-.04*wind,.02*wind);
 }
 body.updateMatrix();const desired=body.matrix.clone().multiply(saved.contact),at=new THREE.Vector3(),turn=new THREE.Quaternion(),scale=new THREE.Vector3();desired.decompose(at,turn,scale);
 const palm=rig.right.userData.ironArm.palm as THREE.Group;
 rig.right.quaternion.copy(turn).multiply(palm.quaternion.clone().invert());rig.right.position.copy(at).sub(palm.position.clone().applyQuaternion(rig.right.quaternion));
 if(kind==='bomb'){
  const reach=THREE.MathUtils.smoothstep(pose.plant,0,.24),tap=pose.plant>.24?Math.sin(pose.plant*Math.PI*16):0;
  // Lift from the carrying grip, turn palm-down, then place the extended index over the keypad.
  placeIronPalm(rig.right,[.073,.163+tap*.003,.075],[0,0,0],reach);
  const typing=palm.userData.typingMesh as THREE.Mesh|undefined;if(typing)typing.morphTargetInfluences![0]=reach;else placeIronPalm(rig.right,[.075+.016*Math.sin(pose.plant*Math.PI*8),.18+.005*Math.sin(pose.plant*Math.PI*16),.035],[0,0,0],reach);
 }
}
