import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {AVATARS,GUNS,isSidearm,type Weapon,type Equipment} from '@sirocco/shared';
import {createAnatomicalArm} from '../apps/web/components/anatomical-arm';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {animateHands} from '../apps/web/components/held-equipment';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';

test('first-person muscles and armour are fuller while wrist dimensions and world arms stay unchanged',()=>{
 const material=new THREE.MeshStandardMaterial();
 for(const avatar of AVATARS)for(const left of [false,true]){
  const world=createAnatomicalArm(material,material,avatar.id,left),view=createAnatomicalArm(material,material,avatar.id,left,material,true),again=createAnatomicalArm(material,material,avatar.id,left);
  const a=world.geometry.attributes.position,b=view.geometry.attributes.position,shape=world.userData.anatomicalArm,axis=shape.wrist.clone().sub(shape.elbow).normalize(),length=shape.wrist.distanceTo(shape.elbow);let middle=0,wrist=0,fullness=0;
  for(let i=0;i<a.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(a,i),q=new THREE.Vector3().fromBufferAttribute(b,i),t=p.clone().sub(shape.elbow).dot(axis)/length;
   if(t>.1&&t<.4){middle++;fullness+=p.distanceTo(q);}
   if(t>.985){wrist++;assert.ok(p.distanceTo(q)<1e-7,'fuller forearms must taper into the original glove');}
   assert.ok(new THREE.Vector3().fromBufferAttribute(view.geometry.attributes.normal,i).length()>.95,'reshaping must retain valid surface normals');
  }
  assert.ok(middle>50&&fullness/middle>.008,`${avatar.id}: substantial extra forearm volume`);assert.ok(wrist>10);
  assert.deepEqual(again.geometry.attributes.position.array,a.array,'world/mirror geometry must not inherit the viewmodel proportions');
  world.geometry.dispose();view.geometry.dispose();again.geometry.dispose();
 }
 material.dispose();
});

function fixture(run:(art:WorldArt)=>void){
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{run(art);}finally{art.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
}
test('detailed first-person guns retain separate moving magazines, slides and bolts',()=>fixture(art=>{
 for(const kind of GUNS){
  const model=art.weapon(kind,true,false,'ultraman'),body=model.getObjectByName('equipmentBody')!,mag=body.getObjectByName('magazine')!;
  const rest=mag.position.clone(),stamp=mag.getObjectByName('magazine-stampings');assert.ok(stamp);
  animateHands(model,kind,{reload:.48,throwProgress:0,plant:0});assert.ok(kind==='p90'?mag.position.y>rest.y+.05:mag.position.y<rest.y-.05,'reload must move the real magazine in its correct direction');
  assert.equal(stamp.parent,mag);animateHands(model,kind,{reload:0,throwProgress:0,plant:0});assert.ok(mag.position.distanceTo(rest)<1e-7);
  if(kind==='pistol')assert.equal(body.getObjectByName('slide-machining')?.parent,body.getObjectByName('slide'));
  if(kind==='marksman')assert.ok(body.getObjectByName('bolt'));
  model.traverse(o=>{if(o instanceof THREE.Mesh){assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));const normal=o.geometry.attributes.normal;assert.ok(Array.from(normal.array).every(Number.isFinite));}});
  const world=art.weapon(kind,false);assert.ok(world.getObjectByName('machined-weapon-details'),'pickups must use the same finished gun');
  disposeGroup(model);disposeGroup(world);
 }
}));

/** Compare the actual mesh data and material instances, not feature labels. */
function weaponSignature(body:THREE.Object3D){
 const hash=createHash('sha256');body.updateWorldMatrix(true,true);
 body.traverse(o=>{if(o instanceof THREE.Mesh){
  hash.update(JSON.stringify({name:o.name,visible:o.visible,transform:o.matrix.elements,groups:o.geometry.groups,materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.uuid)}));
  for(const name of Object.keys(o.geometry.attributes).sort()){const a=o.geometry.attributes[name].array;hash.update(name);hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
  const index=o.geometry.index?.array;if(index)hash.update(Buffer.from(index.buffer,index.byteOffset,index.byteLength));
 }});return hash.digest('hex');
}
test('first-person, reflected, remote and dropped guns have identical parts and shared finishes',()=>fixture(art=>{
 for(const kind of GUNS){
  const first=art.weapon(kind,true,false,'ironman'),view=first.getObjectByName('equipmentBody')!,textures=art.textures.length,materials=art.materials.length;
  const reflected=art.weapon(kind,false,true,'ironman'),mirror=reflected.getObjectByName('equipmentBody')!,pickup=art.weapon(kind,false);
  assert.equal(art.textures.length,textures,'world weapons reuse the same finish/optic textures');assert.equal(art.materials.length,materials,'world weapons reuse the same materials');
  assert.equal(weaponSignature(mirror),weaponSignature(view),`${kind}: reflected body must match the actual first-person mesh`);
  assert.equal(weaponSignature(pickup),weaponSignature(view),`${kind}: pickups must have the same gun design`);
  for(const reload of [.48,0]){
   for(const held of [first,reflected])animateHands(held,kind,{reload,plant:0,throwProgress:0});
   assert.equal(weaponSignature(mirror),weaponSignature(view),`${kind}: moving parts must stay consistent at reload ${reload}`);
  }
  if(!isSidearm(kind))for(const body of [view,mirror,pickup])assert.equal(body.getObjectByName('shoulder-stock')!.visible,true,'the full-length stock must be present and visible in every view');
  disposeGroup(first);disposeGroup(reflected);disposeGroup(pickup);
 }
}));

test('sniper barrel connects continuously to the receiver when seen from the side',()=>fixture(art=>{
 const body=art.weapon('marksman',false);body.updateWorldMatrix(true,true);
 const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(-1,0,0),0,.2);
 for(const z of [-.46,-.42,-.38,-.34,-.30,-.26]){
  ray.ray.origin.set(.15,.035,z);
  assert.ok(ray.intersectObject(body,true).length>0,`gap between barrel and receiver at ${z}`);
 }
 disposeGroup(body);
}));

test('Wonder Woman knife guard wrist stays relaxed, joined and stable in first-person and mirror poses',()=>fixture(art=>{
 for(const third of [false,true]){
  const model=third?buildAvatar(art,'wonder-woman'):undefined,held=model?equipAvatarModel(art,model,'knife','wonder-woman'):art.weapon('knife',true,false,'wonder-woman'),arm=held.getObjectByName('leftArm')!,rig=arm.userData.ironArm,palm=rig.palm as THREE.Group;
  let idle: number[]|undefined;
  for(let repeat=0;repeat<2;repeat++)for(const reverseSlash of [false,true])for(const slash of [0,.15,.36,.56,.77,1]){
   animateHands(held,'knife',{reload:0,plant:0,throwProgress:0,slash,reverseSlash});held.updateWorldMatrix(true,true);
   const wrist=new THREE.Vector3(0,0,.12).applyMatrix4(palm.matrix),axis=new THREE.Vector3(0,0,1).applyQuaternion(palm.quaternion),forearm=rig.elbow.position.clone().sub(wrist).normalize();
   assert.ok(axis.angleTo(forearm)<=THREE.MathUtils.degToRad(18)+1e-6,'the guard hand must not fold back across the wrist');
   const authored=new THREE.Vector3(0,0,.12).applyQuaternion(rig.relaxedWrist.rotation).add(rig.relaxedWrist.position);assert.ok(wrist.distanceTo(authored)<1e-7,'correcting the hand angle must not detach or shift the wrist');
   const hand=palm.children[0] as THREE.Mesh,p=hand.geometry.attributes.position;let seam=0;
   for(let i=0;i<p.count;i++){
    assert.ok(p.getZ(i)<=.120001,'no jagged hand stub may protrude into the bracer');
    if(Math.abs(p.getZ(i)-.12)<1e-6){seam++;assert.ok(Math.abs((p.getX(i)/.028)**2+(p.getY(i)/.021)**2-1)<1e-5,'hand and forearm must share the same cuff contour');}
   }
   assert.ok(seam>20,'check the actual hand cuff vertices');
   if(slash===1){const current=palm.matrix.elements;if(idle)current.forEach((value:number,i:number)=>assert.ok(Math.abs(value-idle![i])<1e-7,'repeated swings must not accumulate wrist drift'));else idle=current.slice();}
  }
  disposeGroup(model??held);
 }
}));

/** Examine the real open contour, rather than only the intended wrist anchor. */
function openContour(geometry:THREE.BufferGeometry){
 const p=geometry.attributes.position,index=geometry.index,ids:number[]=[],vertices:THREE.Vector3[]=[],canonical=new Map<string,number>(),edges=new Map<string,{a:number;b:number;count:number}>();
 for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),key=v.toArray().map(n=>n.toFixed(6)).join(',');if(!canonical.has(key)){canonical.set(key,vertices.length);vertices.push(v);}ids.push(canonical.get(key)!);}
 const count=index?.count??p.count;for(let i=0;i<count;i+=3)for(let j=0;j<3;j++){const a=ids[index?index.getX(i+j):i+j],b=ids[index?index.getX(i+(j+1)%3):i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});}
 return [...new Set([...edges.values()].filter(e=>e.count===1).flatMap(e=>[e.a,e.b]))].map(i=>vertices[i]);
}
test('both Wonder Woman hand contours seal against the bracers without a folded lip in every equipment pose',()=>fixture(art=>{
 for(const third of [false,true])for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
  const model=third?buildAvatar(art,'wonder-woman'):undefined,held=model?equipAvatarModel(art,model,kind,'wonder-woman'):art.weapon(kind,true,false,'wonder-woman');
  for(const progress of [0,.18,.36,.48,.77,1]){
   animateHands(held,kind,{reload:progress,plant:progress,throwProgress:progress,slash:progress,reverseSlash:progress>.5});held.updateWorldMatrix(true,true);
   for(const name of ['leftArm','rightArm']){
    const rig=held.getObjectByName(name)!.userData.ironArm,palm=rig.palm as THREE.Group,hand=palm.children[0] as THREE.Mesh,skin=rig.skin as THREE.Mesh,contour=openContour(hand.geometry),toPalm=palm.matrixWorld.clone().invert().multiply(skin.matrixWorld),p=skin.geometry.attributes.position;
    assert.ok(contour.length>20);for(const v of contour){assert.ok(Math.abs(v.z-.12)<1e-6,`${kind} ${name}: the entire native wrist opening must meet the bracer`);assert.ok(Math.abs((v.x/.028)**2+(v.y/.021)**2-1)<1e-5);}
    const ring=(skin.userData.anatomicalArm.wristEdge as number[]).map(i=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toPalm)).sort((a,b)=>Math.atan2(a.y/.021,a.x/.028)-Math.atan2(b.y/.021,b.x/.028));
    for(const v of contour){let nearest=Infinity;for(let i=0;i<ring.length;i++){const segment=new THREE.Line3(ring[i],ring[(i+1)%ring.length]);nearest=Math.min(nearest,segment.closestPointToPoint(v,true,new THREE.Vector3()).distanceTo(v));}assert.ok(nearest<.0006,'the visible hand and bracer contours must actually touch');}
    for(const i of skin.userData.anatomicalArm.cuffIndices){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toPalm);assert.ok(v.z>=.1199998,`${kind} ${name}: the bracer must not curl forward past its wrist opening`);}
   }
  }
  disposeGroup(model??held);
 }
}));
