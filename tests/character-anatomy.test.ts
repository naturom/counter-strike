import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AVATARS} from '@sirocco/shared';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {realHandGeometry} from '../apps/web/components/character-anatomy';
import {wonderWomanSkirtProfile,poseWonderWomanSkirt} from '../apps/web/components/wonder-woman-skirt';
import {fitWonderWomanTorso,fitWonderWomanFace} from '../apps/web/components/wonder-woman-proportions';
import {cutGeometryY} from '../apps/web/components/costume-geometry';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
test('all character bodies use fitted anatomy, rendered eyes, closed boots and articulated legs',()=>{
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load;
 const ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>ctx})} as unknown as Document;
 THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 try{for(const avatar of AVATARS){const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];const model=buildAvatar(art,avatar.id);
  if(avatar.id==='wonder-woman'){for(const name of ['wonder-woman-eagle-trim','wonder-woman-tiara','wonder-woman-fitted-skirt','wonder-woman-lasso','texturedHair'])assert.ok(model.getObjectByName(name),name);assert.equal(model.getObjectsByProperty('name','wonder-woman-shoulder').length,2);
   let tips=0;for(const hair of model.getObjectsByProperty('name','texturedHair') as THREE.Mesh[]){const p=hair.geometry.attributes.position,n=hair.geometry.attributes.normal;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<1.045){const skirt=wonderWomanSkirtProfile(y),r=(p.getX(i)/skirt.width)**2+((p.getZ(i)-skirt.center)/skirt.depth)**2;assert.ok(r>1.06,'long hair must fall outside the waistband');tips++;}assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<.02,'hair deformation must retain valid shading normals');}}assert.ok(tips>20,'check the actual hair tips beside the waist');
   const skirtMesh=model.getObjectByName('wonder-woman-fitted-skirt') as THREE.Mesh,ray=new THREE.Raycaster();
   for(const angle of [-.34,0,.34])for(const name of ['leftLeg','rightLeg']){const leg=model.getObjectByName(name)!;leg.rotation.x=angle;poseWonderWomanSkirt(model);model.updateMatrixWorld(true);const skin=leg.getObjectByName('anatomy-Skin') as THREE.Mesh,p=skin.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const v=model.worldToLocal(skin.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));if(v.y<(angle===0?.817:.89)||v.y>1.02)continue;ray.set(v,new THREE.Vector3(v.x,0,v.z+.025).normalize());assert.ok(ray.intersectObject(skirtMesh,false).length>0,`skirt must cover the thigh while walking: ${name}, ${angle}, ${v.toArray()}`);}leg.rotation.x=0;}poseWonderWomanSkirt(model);

}
  if(avatar.id==='ultraman'){for(const name of ['ultraman-mask','ultraman-head-fin','ultraman-luminous-eye','ultraman-color-timer','ultraman-mouth'])assert.ok(model.getObjectByName(name),name);assert.equal(model.getObjectByName('ironManArmor'),undefined);assert.equal(model.getObjectByName('ultraman-cheek'),undefined);assert.equal(model.getObjectByName('ultraman-jaw'),undefined);assert.equal(model.getObjectsByProperty('name','ultraman-shoulder-bridge').length,2);}
  if(avatar.id==='ironman'||avatar.id==='ultraman'){const shoulders=model.getObjectsByProperty('name',avatar.id==='ironman'?'shoulder-shell':'ultraman-shoulder-bridge') as THREE.Mesh[];assert.equal(shoulders.length,2);for(const shoulder of shoulders){assert.equal(shoulder.userData.fittedShoulder,true);assert.notEqual(shoulder.geometry.type,'SphereGeometry');}}
  assert.equal(model.userData.realAnatomy,true);assert.ok(model.getObjectByName('leftLeg'));assert.ok(model.getObjectByName('rightLeg'));
  const body=model.children.find(o=>o.name==='anatomy-Skin') as THREE.Mesh;assert.ok(body.geometry.attributes.position.count>3000,'must use the anatomical surface, not primitive body parts');
  if(['thor','wonder-woman','black-widow','hulk'].includes(avatar.id)){const eye=model.getObjectByName('anatomy-Eye') as THREE.Mesh;assert.ok(eye);assert.ok(!Array.isArray(eye.material)||eye.geometry.groups.length>0,'eyes need a renderable material group');assert.ok(model.getObjectByName('texturedHair'));}
  model.traverse(o=>{if(o instanceof THREE.Mesh){assert.ok(o.geometry.attributes.position.count>0);const a=o.geometry.attributes.position.array;assert.ok(Array.from(a).every(Number.isFinite));}});
  const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.y>-.08&&bounds.max.y<1.95,`${avatar.name}: body must fit player height`);disposeGroup(model);art.destroy();
 }}finally{globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
});
test('anatomical grips are detailed and compatible with weapon geometry batching',()=>{
 for(const a of AVATARS)for(const left of [false,true])for(const open of [false,true]){const g=realHandGeometry(a.id,left,open);assert.ok(g.attributes.position.count>1000);assert.ok(g.attributes.normal.array instanceof Float32Array);assert.ok(g.attributes.uv.array instanceof Float32Array);const bounds=new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);assert.ok(bounds.getSize(new THREE.Vector3()).length()<.5);g.dispose();}
});
test('costume seams split crossing triangles exactly at the collar plane',()=>{
 const original=new THREE.BoxGeometry(.4,.5,.2),g=cutGeometryY(original,0),p=g.attributes.position;
 for(let i=0;i<g.index!.count;i+=3){const ys=[0,1,2].map(j=>p.getY(g.index!.getX(i+j)));assert.ok(Math.min(...ys)>=-1e-7||Math.max(...ys)<=1e-7,'no triangle can straddle the skin/costume boundary');}g.dispose();
});


test('Wonder Woman bust reshaping preserves neckline, waist, back and smooth surface normals',()=>{
 const points=[[-.077,1.285,-.16],[.077,1.285,-.16],[0,1.45,-.1],[.10,1.05,-.13],[.077,1.285,.12],[.25,1.285,-.12]],g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(points.flatMap(()=>[0,0,-1]),3));fitWonderWomanTorso(g);
 const p=g.attributes.position,n=g.attributes.normal;assert.ok(p.getZ(0)<-.20&&p.getZ(1)<-.20,'covered bust should have visibly fuller depth');assert.ok(Math.abs(p.getX(0)+p.getX(1))<1e-7,'proportions must remain symmetric');
 for(let i=2;i<points.length;i++)assert.ok(new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(new THREE.Vector3().fromArray(points[i]))<1e-6,'reshape must stay confined to the bust');
 for(let i=0;i<n.count;i++)assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);g.dispose();
});

test('Wonder Woman rounded chest has a broad apex and finite surface normals',()=>{
 const points=[];for(let y=1.19;y<1.39;y+=.005)for(let x=-.19;x<.19;x+=.005)points.push([x,y,-.16]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(points.flatMap(()=>[0,0,-1]),3));fitWonderWomanTorso(g);
 const p=g.attributes.position,n=g.attributes.normal;let broad=0;for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getZ(i)));assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5,'sculpt must not collapse its shading normals');if(p.getZ(i)<-.23)broad++;}assert.ok(broad>120,'fullness must cover a rounded area rather than two narrow points');g.dispose();
});


test('Wonder Woman has a symmetric subtle smile without changing her crown or neck',()=>{
 const points=[[-.028,1.603,-.15],[.028,1.603,-.15],[0,1.603,-.16],[0,1.78,-.12],[0,1.50,-.08]],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(points.flatMap(()=>[0,0,-1]),3));fitWonderWomanFace(g);const p=g.attributes.position;
 assert.ok(p.getY(0)-points[0][1]>.004&&p.getY(1)-points[1][1]>.004,'both mouth corners should lift');assert.ok(p.getY(0)-p.getY(2)>.003,'smile should curve upward at its corners');assert.ok(Math.abs(p.getY(0)-p.getY(1))<1e-7);
 for(const i of [3,4])assert.ok(new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(new THREE.Vector3().fromArray(points[i]))<1e-6);g.dispose();
});
