import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {isGun,type Equipment} from '@sirocco/shared';
import type {WorldArt} from './world';
import {knifeSwing} from './knife-swing';

type Materials={fabric:THREE.Material;leather:THREE.Material;rubber:THREE.Material;seam:THREE.Material;sleeve:THREE.Material};
const palettes=new WeakMap<WorldArt,Materials>();
function materials(art:WorldArt){
  let result=palettes.get(art);if(result)return result;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#a69b82';ctx.fillRect(0,0,256,256);
  // Original woven fabric, with a fine, deterministic raised thread pattern.
  for(let y=0;y<256;y+=3)for(let x=0;x<256;x+=3){const n=(x*17+y*31)%23;ctx.fillStyle=`rgba(${n<12?'38,32,24':'237,223,188'},${.08+n*.005})`;ctx.fillRect(x,y,2,1);ctx.fillRect(x+1,y+1,1,2);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;art.textures.push(map);
  result={fabric:art.material('#8d8169',{map,roughness:.95}),leather:art.material('#3c3d35',{roughness:.76}),rubber:art.material('#242b27',{roughness:.87}),seam:art.material('#b6a488',{roughness:1}),sleeve:art.material('#5d6650',{map,roughness:1})};
  palettes.set(art,result);return result;
}
const v=(p:number[])=>new THREE.Vector3(...p as [number,number,number]);
function rounded(parent:THREE.Group,size:number[],at:number[],mat:THREE.Material,r=.015){const m=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],3,r),mat);m.position.copy(v(at));parent.add(m);return m;}
function oval(parent:THREE.Group,size:number[],at:number[],mat:THREE.Material){const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),mat);m.scale.copy(v(size));m.position.copy(v(at));parent.add(m);return m;}
function tube(parent:THREE.Group,points:number[][],radius:number,mat:THREE.Material){const path=new THREE.CatmullRomCurve3(points.map(v));const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,16,radius,8,false),mat);parent.add(mesh);return mesh;}
function limb(parent:THREE.Group,start:number[],end:number[],a:number,b:number,mat:THREE.Material){const from=v(start),to=v(end),delta=to.clone().sub(from);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(b,a,delta.length(),16,1),mat);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(mesh);oval(parent,[b,b,b],end,mat);}
function bake(group:THREE.Group){
  group.updateMatrixWorld(true);const groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
  group.traverse(o=>{if(o instanceof THREE.Mesh){const mat=o.material as THREE.Material;const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);const list=groups.get(mat)??[];list.push(geo);groups.set(mat,list);o.geometry.dispose();}});
  group.clear();for(const [mat,geos] of groups){const merged=mergeGeometries(geos);geos.forEach(g=>g.dispose());if(merged)group.add(new THREE.Mesh(merged,mat));}
}
function hand(m:Materials,left:boolean,open=false){
  const g=new THREE.Group();
  rounded(g,[.112,.052,.137],[0,0,.015],m.fabric,.022);
  rounded(g,[.088,.018,.092],[0,-.028,.013],m.leather,.01);
  // Separate metacarpal pads, finger joints and stitched finger gussets.
  for(let i=0;i<4;i++){
    const x=-.043+i*.028,length=[.088,.104,.099,.077][i];
    const points=open?[[x,0,-.039],[x*1.22,.004,-.075],[x*1.4,-.009,-.055-length],[x*1.48,-.032,-.067-length]]:
      [[x,0,-.039],[x,-.012,-.077],[x,-.052,-.09-length*.22],[x,-.086,-.061],[x,-.071,-.02]];
    tube(g,points,.0135,m.fabric);
    oval(g,[.016,.011,.021],[x,.027,-.026],m.rubber);
    oval(g,[.014,.009,.014],points[1].map((n,j)=>n+(j===1?.01:0)),m.leather);
    tube(g,points.slice(0,3).map(p=>[p[0]+.009,p[1]+.006,p[2]]),.0012,m.seam);
  }
  const side=left?1:-1;
  tube(g,[[side*.045,-.008,.05],[side*.075,-.025,.01],[side*.065,-.056,-.026],[side*.024,-.07,-.044]],.019,m.fabric);
  oval(g,[.022,.011,.025],[side*.061,-.014,.015],m.leather);
  rounded(g,[.092,.061,.048],[0,-.001,.102],m.rubber,.012);
  rounded(g,[.078,.012,.022],[0,.031,.103],m.fabric,.004);
  for(let i=0;i<8;i++)rounded(g,[.003,.002,.008],[-.033+i*.009,.038,.103],m.seam,.001);
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
  // Sleeve folds follow the forearm, rather than floating rings.
  for(const t of [.28,.42,.61]){const p=cuff.clone().lerp(elbow,t);oval(root,[.077,.016,.03],[p.x,p.y+.045,p.z],m.sleeve);}
  bake(root);return root;
}
export function addHands(art:WorldArt,body:THREE.Group,kind:Equipment,thirdPerson=false){
  const m=materials(art),root=new THREE.Group();body.name='equipmentBody';root.add(body);
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
  root.userData.handRig={right:r,left:l,body,magazine:body.getObjectByName('magazine')};return root;
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
