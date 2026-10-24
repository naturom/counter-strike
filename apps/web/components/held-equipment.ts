import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {isGun,type Equipment,type AvatarId} from '@sirocco/shared';
import type {WorldArt} from './world';
import {realHandGeometry,anatomicalSkinTextures} from './character-anatomy';
import {CHARACTER_STYLE} from './character-style';
import {knifeSwing} from './knife-swing';

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
  result={avatar,fabric:art.material(style.hands,{map:style.surface==='bark'?map:null,bumpMap:map,bumpScale:style.surface==='bark'?.004:bare?.0008:.00035,metalness:armor?style.metal:0,roughness:armor?.38:.82,...(style.surface==='skin'?anatomicalSkinTextures(art):{})}),leather:art.material(bare?style.hands:style.trim,{roughness:.76}),rubber:art.material(bare?style.hands:style.trim,{roughness:.87}),seam:art.material(bare?style.secondary:style.trim,{roughness:.85}),sleeve:art.material(bare?style.hands:style.primary,{map:style.surface==='bark'?map:null,bumpMap:map,bumpScale:style.surface==='bark'?.006:bare?.001:.0006,metalness:armor?style.metal:.02,roughness:armor?.4:.86}),accent:art.material(style.secondary,{metalness:style.metal,roughness:.42}),glow:art.material('#d7f5ff',{emissive:'#83d9ff',emissiveIntensity:2})};
  cache.set(avatar,result);return result;
}
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
function hand(m:Materials,left:boolean,open=false){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(realHandGeometry(m.avatar,left,open),m.fabric));
  rounded(g,[.092,.061,.048],[0,-.001,.102],m.rubber,.012);
  rounded(g,[.078,.012,.022],[0,.031,.103],m.fabric,.004);
  for(let i=0;i<8;i++)rounded(g,[.003,.002,.008],[-.033+i*.009,.038,.103],m.seam,.001);
  if(m.avatar==='ironman'){
    rounded(g,[.10,.016,.09],[0,.032,.012],m.accent,.01);
    const reactor=new THREE.Mesh(new THREE.CylinderGeometry(.023,.023,.005,32),m.glow);reactor.position.set(0,-.039,.01);g.add(reactor);
    for(let i=0;i<4;i++)rounded(g,[.018,.012,.035],[-.043+i*.028,.025,-.045],m.accent,.004);
  }
  if(m.avatar==='spiderman'){
    for(const x of [-.04,0,.04])tube(g,[[x,.029,.08],[x*.75,.029,.01],[x,.023,-.06]],.0016,m.seam);
    for(const z of [-.035,.005,.045,.08])tube(g,[[-.05,.022,z],[0,.030,z-.009],[.05,.022,z]],.0015,m.seam);
  }
  if(m.avatar==='groot')for(let i=0;i<8;i++){const x=-.045+i*.013;tube(g,[[x,.025,.09],[x+.007,.030,.02],[x-.005,.025,-.06]],.0025,i%2?m.accent:m.seam);}
  bake(g);return g;
}
function arm(m:Materials,left:boolean,at:number[],rotation:number[],open=false,thirdPerson=false){
  const root=new THREE.Group(),palm=hand(m,left,open);palm.position.copy(v(at));palm.rotation.set(...rotation as [number,number,number]);root.add(palm);palm.updateMatrixWorld(true);
  const wrist=palm.localToWorld(new THREE.Vector3(0,0,.12));
  const elbow=thirdPerson?new THREE.Vector3(left?-.50:.18,-.13,.30):new THREE.Vector3(left?-.48:.37,-.44,.68),cuff=wrist.clone().lerp(elbow,.18);
  if(thirdPerson)limb(root,elbow.toArray(),[left?-.76:.10,.24,.32],.09,.10,m.sleeve);
  limb(root,cuff.toArray(),elbow.toArray(),.073,.11,m.sleeve);
  limb(root,wrist.toArray(),cuff.toArray(),.043,.071,m.fabric);
  const seam=cuff.clone().lerp(elbow,.65);
  tube(root,[[cuff.x,cuff.y+.052,cuff.z],[seam.x,seam.y+.072,seam.z],[elbow.x,elbow.y+.09,elbow.z]],.002,m.seam);
  if(['ironman','batman','wonder-woman','thor','black-widow'].includes(m.avatar)){
    const panel=new THREE.Group(),delta=elbow.clone().sub(cuff);panel.position.copy(cuff).lerp(elbow,.46);panel.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());root.add(panel);
    const guard=new THREE.Mesh(new THREE.CylinderGeometry(.10,.075,delta.length()*.70,8,1,true),m.avatar==='wonder-woman'||m.avatar==='thor'?m.accent:m.sleeve);panel.add(guard);
    for(const y of [-.08,0,.08])rounded(panel,[.14,.017,.11],[0,y,0],m.avatar==='ironman'?m.accent:m.rubber,.005);
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
  const r=arm(m,false,right,rr,false,thirdPerson),l=arm(m,true,left,lr,kind==='knife'||kind==='grenade',thirdPerson);r.name='rightArm';l.name='leftArm';root.add(r,l);
  if(kind==='knife'&&!thirdPerson){
    const pivot=new THREE.Group(),origin=new THREE.Vector3(.075,-.025,.04);pivot.name='knifeWrist';pivot.position.copy(origin);root.add(pivot);pivot.add(body,r);body.position.sub(origin);r.position.sub(origin);root.userData.knifeRig={pivot,origin};
  }
  root.userData.avatar=avatar;root.userData.handRig={right:r,left:l,body,magazine:body.getObjectByName('magazine')};return root;
}
export type HeldPose={reload:number;throwProgress:number;plant:number;slash?:number;reverseSlash?:boolean;reduceMotion?:boolean};
export function animateHands(root:THREE.Group,kind:Equipment,pose:HeldPose){
  const rig=root.userData.handRig as {right:THREE.Group;left:THREE.Group;body:THREE.Group;magazine?:THREE.Object3D}|undefined;if(!rig)return;
  rig.left.position.set(0,0,0);rig.left.rotation.set(0,0,0);rig.right.rotation.set(0,0,0);rig.body.visible=true;
  if(isGun(kind)&&pose.reload>0){
    const p=pose.reload,reach=THREE.MathUtils.smoothstep(p,0,.18)*(1-THREE.MathUtils.smoothstep(p,.8,1)),drop=Math.sin(Math.PI*THREE.MathUtils.clamp((p-.18)/.55,0,1));
    rig.left.position.set(.045*reach,-.18*drop,.18*reach);rig.left.rotation.z=-.12*drop;
    if(rig.magazine){rig.magazine.position.y=rig.magazine.userData.restY-.29*drop;rig.magazine.position.z=rig.magazine.userData.restZ+.06*drop;}
  }else if(rig.magazine){rig.magazine.position.y=rig.magazine.userData.restY;rig.magazine.position.z=rig.magazine.userData.restZ;}
  if(kind==='knife'){
    const wrist=root.userData.knifeRig as {pivot:THREE.Group;origin:THREE.Vector3}|undefined;
    if(wrist){const poseAt=knifeSwing(pose.slash??1,pose.reverseSlash),scale=pose.reduceMotion?.5:1;wrist.pivot.position.copy(wrist.origin).add(new THREE.Vector3(poseAt.x,poseAt.y,poseAt.z).multiplyScalar(scale));wrist.pivot.rotation.set(poseAt.pitch*scale,poseAt.yaw*scale,poseAt.roll*scale);rig.left.position.set(-.18*poseAt.guard,-.26*poseAt.guard,.08*poseAt.guard);rig.left.rotation.x=-.08*poseAt.guard;}
  }
  if(kind==='grenade'&&pose.throwProgress>0){rig.body.visible=false;rig.right.rotation.x=-Math.sin(pose.throwProgress*Math.PI)*.9;rig.left.position.y=-.12*Math.sin(pose.throwProgress*Math.PI);}
  if(kind==='bomb'&&pose.plant>0){rig.right.rotation.x=Math.sin(pose.plant*Math.PI*16)*.045;rig.left.position.y=-.015*Math.sin(pose.plant*Math.PI);}
}
