// Derive compact, posed game meshes from the CC0 CharacterCreator/MakeHuman base.
// Source commit and asset license are recorded in public/models/CREDITS.txt.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const source=process.argv[2]??'artifacts/character-source',dest='apps/web/public/models/characters';
const armsOnly=process.argv.includes('--arms-only');
await fs.mkdir(dest,{recursive:true});
const jointOffsets=JSON.parse(await fs.readFile(path.join(source,'base_body.joints.json'),'utf8')).morphs;
function unpack(buffer){const length=buffer.readUInt32LE(12),json=JSON.parse(buffer.subarray(20,20+length).toString());return {json,bin:buffer.subarray(28+length)};}
function pack(json,bin){const s=Buffer.from(JSON.stringify(json)),pad=Buffer.alloc((4-s.length%4)%4,32),j=Buffer.concat([s,pad]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+bin.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,j,bh,bin]);}
async function load(file,prefix){const {json,bin}=unpack(await fs.readFile(path.join(source,file)));const textures={};
 for(let i=0;i<(json.images??[]).length;i++){const image=json.images[i],view=json.bufferViews[image.bufferView],filename=`${prefix}-${image.name??i}.${image.mimeType==='image/png'?'png':'jpg'}`;if(!armsOnly)await fs.writeFile(path.join(dest,filename),bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));textures[i]=filename;}
 const materials=json.materials.map(m=>({name:m.name,texture:m.pbrMetallicRoughness?.baseColorTexture?textures[json.textures[m.pbrMetallicRoughness.baseColorTexture.index].source]:null}));
 json.materials=json.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.7}}));delete json.images;delete json.textures;delete json.samplers;
 for(const mesh of json.meshes)if(mesh.weights)mesh.weights.fill(0);
 const packed=pack(json,bin),gltf=await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength),'');gltf.scene.updateMatrixWorld(true);return {gltf,materials};}
function rotateBone(bone,child,direction){bone.updateWorldMatrix(true,true);const from=bone.getWorldPosition(new THREE.Vector3()),to=child.getWorldPosition(new THREE.Vector3()).sub(from).normalize(),delta=new THREE.Quaternion().setFromUnitVectors(to,direction.clone().normalize()),world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(world));bone.updateWorldMatrix(true,true);}
function setMorphs(scene,sex,muscle){
 const values={['gender_'+sex]:1,muscle_max:muscle,proportions_ideal:.30,['corr_gender_'+sex+'__muscle_max']:muscle};
 scene.traverse(o=>{if(o.morphTargetInfluences)for(const [name,value]of Object.entries(values)){const i=o.morphTargetDictionary[name];if(i!==undefined)o.morphTargetInfluences[i]=value;}});
 scene.updateMatrixWorld(true);const goals=new Map();scene.traverse(o=>{if(o.isBone){const p=o.getWorldPosition(new THREE.Vector3());for(const [name,weight]of Object.entries(values)){const d=jointOffsets[name]?.[o.name];if(d)p.addScaledVector(new THREE.Vector3(...d),weight);}goals.set(o,p);}});
 // Rebase joints at their morphed locations before posing, preserving the neutral skin.
 scene.traverse(o=>{if(o.isBone){o.position.copy(o.parent.worldToLocal(goals.get(o).clone()));o.updateWorldMatrix(false,false);}});
 scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.calculateInverses();});
}

const transform=new THREE.Matrix4().makeRotationY(Math.PI);const SCALE=1.8/1.6594313383;
function b64(typed){return Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength).toString('base64');}
function meshData(mesh,group,scale=SCALE,rotate=true){
 const geo=mesh.geometry,pos=geo.attributes.position,normal=geo.attributes.normal,uv=geo.attributes.uv,skin=geo.attributes.skinIndex,weights=geo.attributes.skinWeight;
 const points=[],uvs=[],types=[],v=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(mesh.morphTargetInfluences)for(let j=0;j<mesh.morphTargetInfluences.length;j++){const w=mesh.morphTargetInfluences[j],a=geo.morphAttributes.position?.[j];if(w&&a)v.addScaledVector(new THREE.Vector3().fromBufferAttribute(a,i),w);}
  if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);if(rotate)v.applyMatrix4(transform);v.multiplyScalar(scale);points.push(v.clone());uvs.push(uv?[uv.getX(i),uv.getY(i)]:[0,0]);
  let bone='';if(skin){let largest=-1;for(let j=0;j<4;j++){const w=weights.getComponent(i,j);if(w>largest){largest=w;bone=mesh.skeleton.bones[skin.getComponent(i,j)].name;}}}
  const side=bone.endsWith('_l')?'Left':'Right';types.push(/thigh|calf|foot|ball/.test(bone)?side.toLowerCase()+'Leg':/arm|hand|index|middle|ring|pinky|thumb/.test(bone)?'unarmed'+side+'Arm':'body');
 }
 const indices=geo.index?Array.from(geo.index.array):Array.from({length:pos.count},(_,i)=>i),sections=new Map();
 for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3);let type=group==='hair'?'hair':types[tri[0]];if(types[tri[1]]===types[tri[2]])type=group==='hair'?'hair':types[tri[1]];const list=sections.get(type)??[];list.push(...tri);sections.set(type,list);}
 const result=[];for(const [part,index] of sections){const used=[...new Set(index)],remap=new Map(used.map((n,i)=>[n,i])),positions=new Float32Array(used.length*3),tex=new Uint16Array(used.length*2);for(let j=0;j<used.length;j++){const i=used[j],p=points[i];positions.set([p.x,p.y,p.z],j*3);tex.set(uvs[i].map(x=>Math.round(THREE.MathUtils.clamp(x,0,1)*65535)),j*2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(index.map(i=>remap.get(i)));g.computeVertexNormals();const normals=new Int8Array(g.attributes.normal.array.length);g.attributes.normal.array.forEach((x,i)=>normals[i]=Math.round(x*127));const quant=new Int16Array(positions.length);positions.forEach((x,i)=>quant[i]=Math.round(x*10000));
  const data={part,role:mesh.material.name,position:b64(quant),normal:b64(normals),uv:b64(tex),index:b64(new Uint16Array(index.map(i=>remap.get(i))))};
  if(armsOnly&&part.includes('Arm')&&skin){
   const compact=new Uint8Array(used.length*4);
   used.forEach((i,j)=>{const w=[0,0,0,0];for(let k=0;k<4;k++){const name=mesh.skeleton.bones[skin.getComponent(i,k)].name,slot=/upperarm/.test(name)?0:/lowerarm/.test(name)?1:/hand|index|middle|ring|pinky|thumb/.test(name)?2:3;w[slot]+=weights.getComponent(i,k);}w.forEach((n,k)=>compact[j*4+k]=Math.round(n*255));});data.weights=b64(compact);
  }
  result.push(data);g.dispose();
 }return result;
}
const output={variants:{},hair:{},hands:{}},arms={};
for(const [name,sex,muscle]of [['male','male',.72],['female','female',.35],['heavy','male',1]]){
 if(armsOnly&&name==='heavy')continue;
 const {gltf,materials}=await load('base_body.glb','human');setMorphs(gltf.scene,sex,muscle);
 for(const side of ['l','r']){const sign=side==='l'?1:-1,upper=gltf.scene.getObjectByName('upperarm_'+side),lower=gltf.scene.getObjectByName('lowerarm_'+side),hand=gltf.scene.getObjectByName('hand_'+side);rotateBone(upper,lower,new THREE.Vector3(sign*.08,-.22,.025));rotateBone(lower,hand,new THREE.Vector3(-sign*.07,-.04,.20));}
 gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(...meshData(o,'body',SCALE*(sex==='male'?1.8/1.877:1.8/1.7275)));});output.variants[name]=meshes;
 if(armsOnly){arms[sex]={};for(const side of ['l','r']){
  const part=side==='l'?'unarmedLeftArm':'unarmedRightArm',point=name=>gltf.scene.getObjectByName(name+'_'+side).getWorldPosition(new THREE.Vector3()),joints=['upperarm','lowerarm','hand'].map(name=>point(name).applyMatrix4(transform).multiplyScalar(SCALE*(sex==='male'?1.8/1.877:1.8/1.7275)).toArray()),forward=point('middle_01').sub(point('hand')).normalize().transformDirection(transform),across=point('index_01').sub(point('pinky_01')).normalize().multiplyScalar(side==='l'?1:-1).transformDirection(transform),up=new THREE.Vector3().crossVectors(forward.clone().negate(),across).normalize();across.crossVectors(up,forward.clone().negate()).normalize();
  arms[sex][side]={...meshes.find(m=>m.part===part&&m.role==='Skin'),joints,handAxes:[across.toArray(),up.toArray(),forward.negate().toArray()]};
 }}
}
if(armsOnly){await fs.writeFile('apps/web/components/character-arm-data.json',JSON.stringify(arms));console.log('Wrote anatomical arms with skin weights');process.exit(0);}
for(const name of ['long01','bob02','short02']){output.hair[name]={};for(const sex of ['male','female']){const {gltf,materials}=await load('hair_'+name+'.glb','hair-'+name);setMorphs(gltf.scene,sex,.5);const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();if(o.isMesh)meshes.push(...meshData(o,'hair',SCALE*(sex==='male'?1.8/1.877:1.8/1.7275)));});output.hair[name][sex]={meshes,textures:materials};}}
for(const sex of ['male','female']){output.hands[sex]={};for(const side of ['l','r'])for(const open of [true,false]){
 const {gltf}=await load('base_body.glb','human');setMorphs(gltf.scene,sex,.45);const hand=gltf.scene.getObjectByName('hand_'+side),wrist=hand.getWorldPosition(new THREE.Vector3()),indexBase=gltf.scene.getObjectByName('index_01_'+side).getWorldPosition(new THREE.Vector3()),pinkyBase=gltf.scene.getObjectByName('pinky_01_'+side).getWorldPosition(new THREE.Vector3()),forward=gltf.scene.getObjectByName('middle_01_'+side).getWorldPosition(new THREE.Vector3()).sub(wrist).normalize(),across=indexBase.sub(pinkyBase).normalize().multiplyScalar(side==='l'?1:-1),up=new THREE.Vector3().crossVectors(forward.clone().negate(),across).normalize();across.crossVectors(up,forward.clone().negate()).normalize();
 if(!open)for(const finger of ['index','middle','ring','pinky'])for(let joint=1;joint<=3;joint++){const bone=gltf.scene.getObjectByName(finger+'_0'+joint+'_'+side),q=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(across,joint===2?-.95:-.6));bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}

 gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const mesh=gltf.scene.getObjectByName('Body'),g=mesh.geometry,inv=hand.matrixWorld.clone().invert(),p=g.attributes.position,uv=g.attributes.uv,positions=new Float32Array(p.count*3),indices=[],v=new THREE.Vector3(),scale=SCALE*(sex==='male'?1.8/1.877:1.8/1.7275)*1.06;
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);for(let j=0;j<mesh.morphTargetInfluences.length;j++){const w=mesh.morphTargetInfluences[j];if(w)v.addScaledVector(new THREE.Vector3().fromBufferAttribute(g.morphAttributes.position[j],i),w);}mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld).sub(wrist).multiplyScalar(scale);positions.set([v.dot(across),v.dot(up),.12-v.dot(forward)],i*3);}
 const si=g.attributes.skinIndex,sw=g.attributes.skinWeight;for(let i=0;i<g.index.count;i+=3){let yes=0;for(let j=0;j<3;j++){const k=g.index.getX(i+j);for(let a=0;a<4;a++){const name=mesh.skeleton.bones[si.getComponent(k,a)].name;if(sw.getComponent(k,a)>.25&&name.endsWith('_'+side)&&/hand|index|middle|ring|pinky|thumb/.test(name)){yes++;break;}}}if(yes>=2)indices.push(g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2));}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('uv',uv);geo.setAttribute('normal',g.attributes.normal);geo.setIndex(indices);const proxy=new THREE.Mesh(geo,mesh.material);proxy.updateMatrixWorld(true);output.hands[sex][side+(open?'Open':'Closed')]=meshData(proxy,'hand',1,false)[0];
}}
await fs.writeFile('apps/web/components/character-anatomy-data.json',JSON.stringify(output));console.log('Wrote human anatomy and hair geometry',((await fs.stat('apps/web/components/character-anatomy-data.json')).size/1024).toFixed(0)+' KB');
