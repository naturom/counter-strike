import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {animateHands} from '../apps/web/components/held-equipment';
import type {Equipment} from '@sirocco/shared';
import {WONDER_WOMAN_ARM_LIFT} from '../apps/web/components/wonder-woman-proportions';
function fixture(run:(art:WorldArt)=>void){const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];try{run(art);}finally{art.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}}
test('Iron Man has a sculpted helmet, sealed collar, reactor and fitted articulated armour',()=>fixture(art=>{const model=buildAvatar(art,'ironman');for(const name of ['sculpted-faceplate','sealed-neck-collar','arc-reactor','reactor-housing','shoulder-shell','thigh-shell'])assert.ok(model.getObjectByName(name),name);assert.equal(model.getObjectByName('shin-shell'),undefined,'floating shin panels must be absent');assert.equal(model.getObjectByName('knee-shell'),undefined,'floating knee blocks must be absent');const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.y>-.08&&bounds.max.y<1.95);disposeGroup(model);}));
test('Iron Man shoulders and wrist connections stay attached through every equipment action',()=>fixture(art=>{for(const third of [false,true])for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){const held=art.weapon(kind,!third,third,'ironman');for(const t of [0,.18,.45,.75,1]){animateHands(held,kind,{reload:t,throwProgress:t,plant:t,slash:t});held.updateMatrixWorld(true);for(const name of ['rightArm','leftArm']){const arm=held.getObjectByName(name)! as THREE.Group,rig=arm.userData.ironArm;assert.ok(rig);const shoulder=rig.upper.position.clone().applyMatrix4(arm.matrix);if(third)assert.ok(shoulder.distanceTo(rig.shoulder)<1e-6,`${kind}: detached shoulder`);const wrist=new THREE.Vector3(0,0,.12).applyMatrix4(rig.palm.matrix);assert.ok(wrist.distanceTo(rig.forearm.position)<1e-6,`${kind}: detached wrist`);}held.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}disposeGroup(held);}}));
test('knife and armoured gripping hand preserve their contact through forehand and backhand swings',()=>fixture(art=>{const held=art.weapon('knife',true,false,'ironman'),rig=held.userData.handRig;let contact:THREE.Vector3|undefined;for(const reverseSlash of [false,true])for(const slash of [0,.15,.36,.7,1]){animateHands(held,'knife',{reload:0,throwProgress:0,plant:0,slash,reverseSlash});held.updateMatrixWorld(true);const palm=rig.right.userData.ironArm.palm,at=new THREE.Vector3().setFromMatrixPosition(palm.matrixWorld);rig.body.worldToLocal(at);contact??=at.clone();assert.ok(at.distanceTo(contact)<1e-6,'knife slipped out of the hand');}disposeGroup(held);}));
test('Iron Man support hand follows the extracted magazine during a reload',()=>fixture(art=>{for(const kind of ['rifle','pistol','smg','marksman'] as Equipment[]){const held=art.weapon(kind,true,false,'ironman'),rig=held.userData.handRig;animateHands(held,kind,{reload:.45,throwProgress:0,plant:0});held.updateMatrixWorld(true);const palm=new THREE.Vector3().setFromMatrixPosition(rig.left.userData.ironArm.palm.matrixWorld);rig.body.worldToLocal(palm);assert.ok(palm.distanceTo(rig.magazine.position)<.08,`${kind}: support hand misses the magazine`);disposeGroup(held);}}));
test('Iron Man holds the grenade through wind-up and releases it during the throw',()=>fixture(art=>{const held=art.weapon('grenade',true,false,'ironman'),rig=held.userData.handRig;animateHands(held,'grenade',{reload:0,throwProgress:.25,plant:0});assert.equal(rig.body.visible,true);assert.equal(rig.body.rotation.x,rig.right.rotation.x);animateHands(held,'grenade',{reload:0,throwProgress:.7,plant:0});assert.equal(rig.body.visible,false);animateHands(held,'grenade',{reload:0,throwProgress:0,plant:0});assert.equal(rig.body.visible,true);assert.equal(rig.body.rotation.x,0);disposeGroup(held);}));
test('reload approaches before extraction, stays compact and resets cleanly',()=>fixture(art=>{for(const kind of ['rifle','pistol','smg','marksman'] as Equipment[]){const held=art.weapon(kind,true,false,'ironman'),rig=held.userData.handRig,rest=rig.magazine.userData.restY;animateHands(held,kind,{reload:.15,throwProgress:0,plant:0});assert.equal(rig.magazine.position.y,rest,'grab before extraction');animateHands(held,kind,{reload:.48,throwProgress:0,plant:0});assert.ok(rest-rig.magazine.position.y<=.161,'avoid stretching the supporting arm');assert.ok(held.position.y>.1,'keep the reload in view');animateHands(held,kind,{reload:0,throwProgress:0,plant:0});assert.equal(rig.magazine.position.y,rest);assert.equal(held.position.y,0);assert.equal(held.position.x,0);disposeGroup(held);}}));
test('planting keeps the C4 support hand steady while the other hand reaches the keypad',()=>fixture(art=>{const held=art.weapon('bomb',true,false,'ironman'),rig=held.userData.handRig;animateHands(held,'bomb',{reload:0,throwProgress:0,plant:0});held.updateMatrixWorld(true);const support=new THREE.Vector3().setFromMatrixPosition(rig.left.userData.ironArm.palm.matrixWorld);for(const plant of [.25,.5,.8]){animateHands(held,'bomb',{reload:0,throwProgress:0,plant});held.updateMatrixWorld(true);assert.ok(new THREE.Vector3().setFromMatrixPosition(rig.left.userData.ironArm.palm.matrixWorld).distanceTo(support)<1e-7);const typing=new THREE.Vector3().setFromMatrixPosition(rig.right.userData.ironArm.palm.matrixWorld);rig.body.worldToLocal(typing);assert.ok(typing.y>.16&&typing.y<.20);assert.ok(typing.x>.04&&typing.x<.11);}animateHands(held,'bomb',{reload:0,throwProgress:0,plant:0});assert.equal(rig.right.position.length(),0);disposeGroup(held);}));

test('profile and arena equip the same Iron Man model without duplicate arms or equipment',()=>fixture(art=>{const model=buildAvatar(art,'ironman'),rifle=equipAvatarModel(art,model);assert.equal(model.getObjectByName('unarmedLeftArm')!.visible,false);assert.equal(model.getObjectByName('unarmedRightArm')!.visible,false);assert.equal(rifle.scale.x,.75);assert.ok(rifle.position.x>0&&rifle.position.z<0,'rifle must be shouldered on the right');const pistol=equipAvatarModel(art,model,'pistol');assert.equal(rifle.parent,null);assert.equal(model.getObjectByName('equippedWeapon'),pistol);assert.equal(model.userData.weapon,'pistol');disposeGroup(model);}));

test('reflected Iron Man hands and arm segments clear the torso throughout equipment actions',()=>fixture(art=>{
 for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
  const model=buildAvatar(art,'ironman'),held=equipAvatarModel(art,model,kind);
  for(const t of [0,.1,.25,.45,.6,.8,1]){
   animateHands(held,kind,{reload:t,throwProgress:t,plant:t,slash:t});model.updateMatrixWorld(true);
   for(const name of ['leftArm','rightArm']){
    const arm=held.getObjectByName(name)! as THREE.Group,rig=arm.userData.ironArm;
    const shoulder=rig.shoulder.clone();held.localToWorld(shoulder);
    assert.ok(Math.abs(shoulder.x)>.18&&shoulder.y>1.40,'arm attaches at the anatomical shoulder');
    // Check both bones along their lengths, including the wrist and elbow.
    const shape=rig.skin.userData.anatomicalArm;assert.ok(Math.abs(rig.upper.scale.y*.75-shape.shoulder.distanceTo(shape.elbow))<.002,`${kind}: upper arm stretched`);assert.ok(Math.abs(rig.forearm.scale.y*.75-shape.elbow.distanceTo(shape.wrist))<.01,`${kind}: forearm stretched`);
    const points=[rig.upper,rig.forearm];for(const bone of points)for(let i=0;i<=20;i++){
     const p=bone.localToWorld(new THREE.Vector3(0,i/20,0));
     if(p.y>.94&&p.y<1.40)assert.ok((p.x/.20)**2+(p.z/.175)**2>1,`${kind} ${name} at ${t}: arm crosses torso ${p.toArray()}`);
    }
    const palm=rig.palm;let embedded=0;
    palm.traverse((o:THREE.Object3D)=>{if(!(o instanceof THREE.Mesh))return;const toBody=model.matrixWorld.clone().invert().multiply(o.matrixWorld),positions=o.geometry.attributes.position,point=new THREE.Vector3();for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(toBody);if(point.y>.94&&point.y<1.40&&(point.x/.20)**2+(point.z/.175)**2<1)embedded++;}});
    assert.equal(embedded,0,`${kind} ${name}: actual hand vertices intersect breastplate`);
   }
  }disposeGroup(model);
 }
}));

test('classic Ultraman uses silver anatomical hands and keeps equipment actions attached',()=>fixture(art=>{for(const third of [false,true])for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){const held=art.weapon(kind,!third,third,'ultraman');for(const t of [0,.25,.5,.75,1]){animateHands(held,kind,{reload:t,plant:t,throwProgress:t,slash:t});held.updateMatrixWorld(true);for(const name of ['leftArm','rightArm']){const rig=held.getObjectByName(name)!.userData.ironArm;assert.ok(rig);assert.equal(rig.palm.getObjectByName('articulatedIronHand'),undefined);assert.ok(new THREE.Vector3(0,0,.12).applyMatrix4(rig.palm.matrix).distanceTo(rig.forearm.position)<1e-6);}held.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}disposeGroup(held);}}));

test('Ultraman arm anchors sit inside the restored shoulder surfaces',()=>fixture(art=>{const model=buildAvatar(art,'ultraman'),held=equipAvatarModel(art,model,'rifle','ultraman');model.updateMatrixWorld(true);const bridges=model.getObjectsByProperty('name','ultraman-shoulder-bridge');assert.ok(bridges.every(bridge=>!bridge.visible),'the anatomical deltoid replaces duplicate shoulder caps');for(const name of ['leftArm','rightArm']){const arm=held.getObjectByName(name)!,rig=arm.userData.ironArm,anchor=held.localToWorld(rig.shoulder.clone());assert.ok(anchor.y>1.39,'arm must attach near the upper shoulder');assert.ok(bridges.some(bridge=>new THREE.Box3().setFromObject(bridge).expandByScalar(.025).containsPoint(anchor)),`${name}: disconnected shoulder`);}disposeGroup(model);}));

test('fitted Iron Man shoulder armor covers each upper arm attachment',()=>fixture(art=>{const model=buildAvatar(art,'ironman'),held=equipAvatarModel(art,model,'rifle','ironman');model.updateMatrixWorld(true);const shoulders=model.getObjectsByProperty('name','shoulder-shell');for(const name of ['leftArm','rightArm']){const rig=held.getObjectByName(name)!.userData.ironArm,anchor=held.localToWorld(rig.shoulder.clone());assert.ok(shoulders.some(shoulder=>new THREE.Box3().setFromObject(shoulder).expandByScalar(.015).containsPoint(anchor)),`${name}: uncovered joint`);}disposeGroup(model);}));

// Compare a face with its three shading normals. One corner alone can point
// away from a strongly curved elbow or cuff while the face still points outward.
test('Ultraman sleeves stay continuous through actions and feet remain part of each leg',()=>fixture(art=>{const model=buildAvatar(art,'ultraman'),held=equipAvatarModel(art,model,'pistol','ultraman');assert.equal(model.getObjectByName('ultraman-ankle'),undefined);assert.equal(model.getObjectByName('ultraman-boot'),undefined);for(const name of ['leftLeg','rightLeg']){const leg=model.getObjectByName(name)!,skin=leg.getObjectByName('anatomy-Skin') as THREE.Mesh;skin.geometry.computeBoundingBox();assert.ok(skin.geometry.boundingBox!.min.y+leg.position.y<.05,'foot must share leg geometry');}for(const t of [0,.25,.5,.75,1]){animateHands(held,'pistol',{reload:t,throwProgress:0,plant:0});for(const name of ['leftArm','rightArm']){const rig=held.getObjectByName(name)!.userData.ironArm;assert.ok(rig.skin);assert.equal(rig.upper.visible,false);assert.equal(rig.forearm.visible,false);assert.equal(rig.elbow.visible,false);const p=rig.skin.geometry.attributes.position,shape=rig.skin.userData.anatomicalArm;assert.ok(shape&&p.count>600,'posed arms retain the anatomical mesh');assert.ok(shape.shoulderEdge.length>10&&shape.wristEdge.length>10);assert.ok(rig.skin.geometry.groups.length<=2,'arm materials must batch into two draws');const g=rig.skin.geometry,index=g.index!,normal=g.attributes.normal;let outward=0,total=0;for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),pa=new THREE.Vector3().fromBufferAttribute(p,a),cross=new THREE.Vector3().fromBufferAttribute(p,b).sub(pa).cross(new THREE.Vector3().fromBufferAttribute(p,c).sub(pa));if(cross.dot(new THREE.Vector3().fromBufferAttribute(normal,a).add(new THREE.Vector3().fromBufferAttribute(normal,b)).add(new THREE.Vector3().fromBufferAttribute(normal,c)))>0)outward++;total++;}assert.ok(outward/total>.98,`sleeve faces must face outward: ${name} at ${t}: ${outward}/${total}`);assert.ok(Array.from(p.array as Float32Array).every(Number.isFinite));}}disposeGroup(model);}));

test('Wonder Woman uses proportionate female hands, joined skin arms and weapon grips',()=>fixture(art=>{const model=buildAvatar(art,'wonder-woman');for(const kind of ['rifle','pistol','marksman','knife','grenade','bomb'] as Equipment[]){const held=equipAvatarModel(art,model,kind,'wonder-woman');for(const t of [0,.25,.5,.75,1]){animateHands(held,kind,{reload:t,plant:t,throwProgress:t,slash:t});model.updateMatrixWorld(true);for(const name of ['leftArm','rightArm']){const rig=held.getObjectByName(name)!.userData.ironArm;assert.ok(rig.skin);assert.ok(rig.skin.userData.radiusScale<1);assert.ok(new THREE.Vector3(0,0,.12).applyMatrix4(rig.palm.matrix).distanceTo(rig.forearm.position)<1e-6);rig.skin.traverse((o:THREE.Object3D)=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}}}disposeGroup(model);}));

test('Ultraman shoulder edges coincide with every sleeve through all equipment actions',()=>fixture(art=>{
 const model=buildAvatar(art,'ultraman');model.position.set(7,3,-4);model.rotation.y=.9;model.scale.y=.61;
 for(const crouchScale of [1,.61]){model.scale.y=crouchScale;let baseline:number[][]|undefined;
 for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
  const held=equipAvatarModel(art,model,kind,'ultraman');
  for(let step=0;step<=20;step++){
   const t=step/20;animateHands(held,kind,{reload:t,throwProgress:t,plant:t,slash:t});model.updateMatrixWorld(true);
   const edge:number[][]=[];
   for(const name of ['leftArm','rightArm']){
    const arm=held.getObjectByName(name)! as THREE.Group,rig=arm.userData.ironArm,skin=rig.skin as THREE.Mesh,seam=skin.userData.shoulderSeam,p=skin.geometry.attributes.position;
    assert.ok(seam,'every third person Ultraman arm needs a fitted shoulder boundary');
    for(let j=0;j<seam.points.length;j++){
     const actual=skin.localToWorld(new THREE.Vector3().fromBufferAttribute(p,seam.indices[j])),expected=held.localToWorld(seam.points[j].clone());
     assert.ok(actual.distanceTo(expected)<1e-5,`${kind} ${name} at ${t}: shoulder seam detached`);const normal=skin.geometry.attributes.normal,actualNormal=new THREE.Vector3().fromBufferAttribute(normal,seam.indices[j]).applyMatrix3(new THREE.Matrix3().getNormalMatrix(skin.matrixWorld)).normalize(),expectedNormal=seam.normals[j].clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(held.matrixWorld)).normalize();assert.ok(actualNormal.dot(expectedNormal)>.9999,'shoulder shading must stay continuous');
     edge.push(model.worldToLocal(actual).toArray());
    }
    const wrist=new THREE.Vector3(0,0,.12).applyMatrix4(rig.palm.matrix);assert.ok(wrist.distanceTo(rig.forearm.position)<1e-6,'hand must retain its equipment grip');
    assert.ok(Array.from(p.array as Float32Array).every(Number.isFinite));
   }
   baseline??=edge;assert.equal(edge.length,baseline.length);for(let i=0;i<edge.length;i++)assert.ok(new THREE.Vector3().fromArray(edge[i]).distanceTo(new THREE.Vector3().fromArray(baseline[i]))<1e-5,'weapon/action must not move the torso-side shoulder seam');
  }
 }}disposeGroup(model);
}));


test('Ultraman knife and grenade keep their actual grip centers on the item throughout actions',()=>fixture(art=>{
 for(const third of [false,true])for(const kind of ['knife','grenade'] as Equipment[]){
  const held=art.weapon(kind,!third,third,'ultraman'),rig=held.userData.handRig;let relative:THREE.Matrix4|undefined;
  for(const reverseSlash of [false,true])for(let i=0;i<=20;i++){
   const t=i/20;animateHands(held,kind,{reload:0,plant:0,throwProgress:t,slash:t,reverseSlash});held.updateMatrixWorld(true);
   const palm=rig.right.userData.ironArm.palm as THREE.Group,contact:THREE.Matrix4=rig.body.matrixWorld.clone().invert().multiply(palm.matrixWorld);
   relative??=contact.clone();assert.ok(contact.elements.every((n,i)=>Math.abs(n-relative!.elements[i])<1e-6),'item slipped or rotated inside the hand');
   const center=(kind==='knife'?new THREE.Vector3(0,-.031,-.034):new THREE.Vector3(0,-.080,-.015)).applyMatrix4(contact);
   assert.ok(center.distanceTo(kind==='knife'?new THREE.Vector3(0,0,.04):new THREE.Vector3(0,.015,0))<.001,'fingers must close around the handle or shell');
   if(kind==='grenade')assert.equal(rig.body.visible,t<.5,'grenade releases once, halfway through the throw');
  }disposeGroup(held);
 }
}));

test('anatomical arm cuffs meet every hand without gaps throughout equipment actions',()=>fixture(art=>{
 for(const avatar of ['ironman','ultraman','wonder-woman'] as const)for(const third of [false,true])for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
  const held=art.weapon(kind,!third,third,avatar);
  for(let i=0;i<=10;i++){
   const t=i/10;animateHands(held,kind,{reload:0,plant:t,throwProgress:t,slash:t});held.updateMatrixWorld(true);
   for(const name of ['rightArm','leftArm']){
    const rig=held.getObjectByName(name)!.userData.ironArm,skin=rig.skin as THREE.Mesh,p=skin.geometry.attributes.position,edge=skin.userData.anatomicalArm.wristEdge as number[],[width,depth]=skin.userData.wristRadii;
    assert.ok(edge.length>10);for(const j of edge){
     const at=rig.palm.worldToLocal(skin.localToWorld(new THREE.Vector3().fromBufferAttribute(p,j)));
     assert.ok(Math.abs(at.z-.12)<1e-5,'cuff must lie in the glove wrist plane');
     assert.ok(Math.abs((at.x/width)**2+(at.y/depth)**2-1)<1e-4,'cuff must match the glove cross-section');
    }
   }
  }disposeGroup(held);
 }
}));

test('Ultraman cradles C4 below the explosives and extends the index to type on its keypad',()=>fixture(art=>{
 for(const third of [false,true]){
  const held=art.weapon('bomb',!third,third,'ultraman'),rig=held.userData.handRig;
  animateHands(held,'bomb',{reload:0,plant:0,throwProgress:0});held.updateMatrixWorld(true);
  const support=rig.left.userData.ironArm.palm as THREE.Group,baseline=support.matrixWorld.clone();
  for(const arm of [rig.left,rig.right]){
   const hand=arm.userData.ironArm.palm as THREE.Group,mesh=hand.children[0] as THREE.Mesh,p=mesh.geometry.attributes.position;
   let embedded=0;for(let i=0;i<p.count;i++){const v=rig.body.worldToLocal(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));if(Math.abs(v.x)<.181&&Math.abs(v.z)<.127&&v.y>-.094&&v.y<.06)embedded++;}
   assert.ok(embedded/p.count<.01,`carrying fingers must not pass through the explosives: ${arm.name} ${embedded}/${p.count}`);
  }
  for(const plant of [.3,.5,.75,1]){
   animateHands(held,'bomb',{reload:0,plant,throwProgress:0});held.updateMatrixWorld(true);
   assert.ok(support.matrixWorld.elements.every((n,i)=>Math.abs(n-baseline.elements[i])<1e-7),'support hand must stay under C4');
   const palm=rig.right.userData.ironArm.palm as THREE.Group,tip=rig.body.worldToLocal(palm.localToWorld(new THREE.Vector3(-.034,-.035,-.135)));
   assert.ok(tip.x>.02&&tip.x<.06&&tip.y>.120&&tip.y<.134&&tip.z>-.08&&tip.z<-.04,'typing finger must reach the keys');
   assert.equal((palm.userData.typingMesh as THREE.Mesh).morphTargetInfluences![0],1);
  }
  animateHands(held,'bomb',{reload:0,plant:0,throwProgress:0});assert.equal(rig.right.userData.ironArm.palm.userData.typingMesh.morphTargetInfluences[0],0);disposeGroup(held);
 }
}));


test('Wonder Woman keeps raised hands and anatomical shoulder anchors through every equipped action',()=>fixture(art=>{
 const model=buildAvatar(art,'wonder-woman');model.position.set(3,2,-7);model.rotation.y=.65;
 for(const crouch of [1,.61])for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
  model.scale.y=crouch;const held=equipAvatarModel(art,model,kind,'wonder-woman');assert.equal(held.position.y,1.26+WONDER_WOMAN_ARM_LIFT);
  for(let i=0;i<=10;i++){
   const t=i/10;animateHands(held,kind,{reload:t,throwProgress:t,plant:t,slash:t});model.updateMatrixWorld(true);
   for(const name of ['leftArm','rightArm']){
    const arm=held.getObjectByName(name)!,rig=arm.userData.ironArm,skin=rig.skin as THREE.Mesh,seam=skin.userData.shoulderSeam,p=skin.geometry.attributes.position,n=skin.geometry.attributes.normal,uv=skin.geometry.attributes.uv;
    assert.ok(seam,'equipped arms need a fitted shoulder boundary');
    for(let j=0;j<seam.points.length;j++){
     const actual=skin.localToWorld(new THREE.Vector3().fromBufferAttribute(p,seam.indices[j])),expected=held.localToWorld(seam.points[j].clone());assert.ok(actual.distanceTo(expected)<1e-5,`${kind} ${name} at ${t}: detached shoulder`);
     const normal=new THREE.Vector3().fromBufferAttribute(n,seam.indices[j]).applyMatrix3(new THREE.Matrix3().getNormalMatrix(skin.matrixWorld)).normalize(),expectedNormal=seam.normals[j].clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(held.matrixWorld)).normalize();assert.ok(normal.dot(expectedNormal)>.9999,'skin shading must match at the shoulder');
     assert.ok(Math.abs(uv.getX(seam.indices[j])-seam.uv[j].x)<1e-6&&Math.abs(uv.getY(seam.indices[j])-seam.uv[j].y)<1e-6,'skin texture must meet at the same edge');
    }
    assert.ok(Array.from(p.array as Float32Array).every(Number.isFinite));
    const shoulder=model.worldToLocal(held.localToWorld(rig.shoulder.clone()));assert.ok(shoulder.distanceTo(skin.userData.anatomicalArm.shoulder)<1e-6,'raising the hands must not shrug the shoulder joint away from the clavicle');
   }
  }
 }
 for(const kind of ['rifle','pistol','knife','grenade','bomb'] as Equipment[]){const held=art.weapon(kind,true,false,'wonder-woman');for(const t of [0,.3,.6,1]){animateHands(held,kind,{reload:t,throwProgress:t,plant:t,slash:t});assert.ok(held.position.y>=WONDER_WOMAN_ARM_LIFT/.75-1e-7,'first-person equipment must retain its arm lift');}disposeGroup(held);}
 disposeGroup(model);
}));


test('anatomical arms keep human bone proportions and elbows beside the torso in the ready pose',()=>fixture(art=>{
 for(const avatar of ['ironman','ultraman','wonder-woman'] as const)for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
  const model=buildAvatar(art,avatar),held=equipAvatarModel(art,model,kind,avatar);model.updateMatrixWorld(true);
  for(const name of ['leftArm','rightArm']){
   const arm=held.getObjectByName(name)!,rig=arm.userData.ironArm,shape=rig.skin.userData.anatomicalArm;
   assert.ok(shape.shoulder.distanceTo(shape.elbow)>.25&&shape.shoulder.distanceTo(shape.elbow)<.28,'upper arm uses anatomical length');assert.ok(shape.elbow.distanceTo(shape.wrist)>.23&&shape.elbow.distanceTo(shape.wrist)<.29,'forearm uses anatomical length');
   const elbow=model.worldToLocal(arm.localToWorld(rig.elbow.position.clone()));assert.ok((elbow.x/.23)**2+(elbow.z/.175)**2>1,`${avatar} ${kind}: elbow folds into torso`);assert.ok(elbow.y>1.05&&elbow.y<1.4,'elbow should sit below the shoulder');
   assert.ok(rig.skin.geometry.attributes.armWeights.count>600,'muscle surface must use its actual skin weights');
  }disposeGroup(model);
 }
}));

test('moving reflected bodies keep anatomical shoulder seams fixed while hands and legs animate',async()=>{
 const {animateAvatarMotion}=await import('../apps/web/components/avatar-motion');
 fixture(art=>{
  for(const avatar of ['ironman','wonder-woman','ultraman'] as const)for(const kind of ['rifle','pistol','knife','grenade','bomb'] as Equipment[]){
   const model=buildAvatar(art,avatar),held=equipAvatarModel(art,model,kind,avatar);model.traverse(o=>o.layers.set(1));
   animateAvatarMotion(model,kind,{reload:0,plant:0,throwProgress:0,slash:1},1/60,true);
   const start=(held.getObjectByName('leftArm')!.userData.ironArm.skin as THREE.Mesh).geometry.attributes.position.array.slice();
   for(let i=1;i<=12;i++){
    model.position.set(3+i*.06,2,-7);model.rotation.y=.65;model.scale.y=i>6?.61:1;
    animateAvatarMotion(model,kind,{reload:i/13,plant:i/13,throwProgress:i/13,slash:i/13},1/60,true,.3*Math.sin(i));
    for(const name of ['leftArm','rightArm']){
     const arm=held.getObjectByName(name)!,rig=arm.userData.ironArm,skin=rig.skin as THREE.Mesh,shape=skin.userData.anatomicalArm,p=skin.geometry.attributes.position;
     for(const j of shape.shoulderEdge){const torso=model.getObjectByName('avatarTorso')??model,actual=skin.localToWorld(new THREE.Vector3().fromBufferAttribute(p,j)),expected=torso.localToWorld(new THREE.Vector3().fromArray(shape.position,j*3));assert.ok(actual.distanceTo(expected)<1e-5,`${avatar} ${kind}: moving mirror shoulder detached`);}
     assert.ok(skin.layers.isEnabled(1),'mirror must render the same posed arm');assert.ok(Array.from(p.array).every(Number.isFinite));
    }
   }
   assert.ok(Math.abs(model.getObjectByName('leftLeg')!.rotation.x)>.01,'walking should animate from rendered local displacement');
   const moved=(held.getObjectByName('leftArm')!.userData.ironArm.skin as THREE.Mesh).geometry.attributes.position.array;assert.ok(start.some((v,i)=>Math.abs(v-moved[i])>.001),'reflected arms must follow actions and movement');
   for(let i=0;i<50;i++)animateAvatarMotion(model,kind,{reload:0,plant:0,throwProgress:0,slash:1},1/60,true);
   assert.ok(Math.abs(model.getObjectByName('leftLeg')!.rotation.x)<.001,'legs should settle when movement stops');disposeGroup(model);
  }
 });
});


test('Wonder Woman rifle support arm hangs below her relaxed shoulder instead of reaching straight out',()=>fixture(art=>{
 const model=buildAvatar(art,'wonder-woman');for(const kind of ['rifle','smg','marksman'] as Equipment[]){const held=equipAvatarModel(art,model,kind,'wonder-woman'),arm=held.getObjectByName('leftArm')!,rig=arm.userData.ironArm;model.updateMatrixWorld(true);const shoulder=model.worldToLocal(held.localToWorld(rig.shoulder.clone())),elbow=model.worldToLocal(arm.localToWorld(rig.elbow.position.clone())),wrist=model.worldToLocal(rig.palm.localToWorld(new THREE.Vector3(0,0,.12)));
 assert.ok(shoulder.y-elbow.y>.17,`${kind}: upper arm should drop naturally below the shoulder`);assert.ok(Math.abs(elbow.y-wrist.y)<.10,`${kind}: forearm should support the weapon without lifting the elbow`);assert.ok(Math.abs(elbow.distanceTo(wrist)-rig.skin.userData.anatomicalArm.elbow.distanceTo(rig.skin.userData.anatomicalArm.wrist))<.002,'supporting forearm must not stretch');}disposeGroup(model);
}));

test('Iron Man chest and thigh plates stay within a thin fitted shell while the legs move',()=>fixture(art=>{
 const model=buildAvatar(art,'ironman'),body=model.children.find(o=>o.name==='anatomy-Skin') as THREE.Mesh,ray=new THREE.Raycaster(),names=['collar-carapace','breastplate','abdominal-segment','thigh-shell','thigh-inset'];
 for(const angle of [0,.34]){
  model.getObjectByName('leftLeg')!.rotation.x=angle;model.getObjectByName('rightLeg')!.rotation.x=-angle;model.updateMatrixWorld(true);
  for(const name of names)for(const plate of model.getObjectsByProperty('name',name) as THREE.Mesh[]){
   const g=plate.geometry,fit=g.userData.fittedArmor;assert.ok(fit&&fit.offset<=.011&&fit.thickness<=.003,'armour must use a thin body-fitted shell');assert.ok(fit.surfaceVertices>8,'plate must follow multiple body triangles');assert.notEqual(g.type,'ExtrudeGeometry');
   const skin=plate.parent?.name.endsWith('Leg')?plate.parent.getObjectByName('anatomy-Skin') as THREE.Mesh:body,p=g.attributes.position,n=g.attributes.normal,matrix=new THREE.Matrix3().getNormalMatrix(plate.matrixWorld);
   for(let i=0;i<fit.surfaceVertices;i+=Math.max(1,Math.floor(fit.surfaceVertices/9))){const point=plate.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)),inward=new THREE.Vector3().fromBufferAttribute(n,i).applyMatrix3(matrix).normalize().negate();ray.set(point,inward);ray.far=.02;const hit=ray.intersectObject(skin,false)[0];assert.ok(hit&&Math.abs(hit.distance-fit.offset)<.0001,`${name}: plate must follow its underlying body rather than float in front`);}
  }
 }
 const reactor=model.getObjectByName('arc-reactor') as THREE.Mesh;assert.ok((reactor.geometry as THREE.CircleGeometry).parameters.radius<.035,'reactor should be integrated and compact');disposeGroup(model);
}));
