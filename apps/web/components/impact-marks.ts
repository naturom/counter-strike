import * as THREE from 'three';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {IMPACT_RULES,type ImpactMark,type ImpactSurface} from '@sirocco/shared';
import {sprayRotation} from './sprays';

/** Crop a batched world mesh before clipping a tiny decal. This avoids creating
 * thousands of temporary decal vertices for the rest of an entire building. */
export function impactGeometry(mesh:THREE.Mesh,point:THREE.Vector3,rotation:THREE.Euler,size:THREE.Vector3){
 const source=mesh.geometry,p=source.attributes.position,n=source.attributes.normal,index=source.index;
 const local=point.clone().applyMatrix4(mesh.matrixWorld.clone().invert()),scale=new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld),radius=size.length()/2/Math.max(.0001,Math.min(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z)));
 const positions:number[]=[],normals:number[]=[],count=index?.count??p.count;
 for(let i=0;i<count;i+=3){
  const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
  if(Math.max(p.getX(a),p.getX(b),p.getX(c))<local.x-radius||Math.min(p.getX(a),p.getX(b),p.getX(c))>local.x+radius||Math.max(p.getY(a),p.getY(b),p.getY(c))<local.y-radius||Math.min(p.getY(a),p.getY(b),p.getY(c))>local.y+radius||Math.max(p.getZ(a),p.getZ(b),p.getZ(c))<local.z-radius||Math.min(p.getZ(a),p.getZ(b),p.getZ(c))>local.z+radius)continue;
  for(let j=0;j<3;j++){const id=j===0?a:j===1?b:c;positions.push(p.getX(id),p.getY(id),p.getZ(id));if(n)normals.push(n.getX(id),n.getY(id),n.getZ(id));}
 }
 const cropped=new THREE.BufferGeometry();cropped.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 if(n)cropped.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else cropped.computeVertexNormals();
 const target=new THREE.Mesh(cropped);target.matrixWorld.copy(mesh.matrixWorld);
 const decal=new DecalGeometry(target,point,rotation,size);cropped.dispose();return decal;
}

/** Original impact artwork: chipped masonry/wood, scraped metal and knife gouges. */
export function impactTexture(knife:boolean,surface:ImpactSurface){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
 const chip=surface==='metal'?'#aeb8bd':surface==='wood'?'#ae8660':surface==='sand'?'#a58c67':surface==='asphalt'?'#777b79':'#b6aa94';
 if(knife){
  c.lineCap='round';c.strokeStyle='rgba(15,16,15,.6)';c.lineWidth=11;c.beginPath();c.moveTo(11,72);c.lineTo(40,65);c.lineTo(115,55);c.stroke();
  c.strokeStyle=chip;c.lineWidth=5;c.beginPath();c.moveTo(10,67);c.lineTo(44,60);c.lineTo(117,50);c.stroke();
  c.strokeStyle=surface==='metal'?'#e0e7e9':'#4b4236';c.lineWidth=1.5;c.beginPath();c.moveTo(15,68);c.lineTo(112,52);c.stroke();
  for(let i=0;i<18;i++){c.globalAlpha=.2+(i%3)*.15;c.fillStyle=chip;c.fillRect(16+i*5,52+(i*17%25),1+i%3,1+i%2);}c.globalAlpha=1;
 }else{
  const gradient=c.createRadialGradient(64,64,12,64,64,57);gradient.addColorStop(0,'rgba(15,14,12,.8)');gradient.addColorStop(1,'rgba(20,18,15,0)');c.fillStyle=gradient;c.fillRect(0,0,128,128);
  c.fillStyle=chip;c.beginPath();for(let i=0;i<19;i++){const a=i/19*Math.PI*2,r=24+(i*13%17);const x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();
  c.fillStyle='#24221e';c.beginPath();c.ellipse(64,65,19,17,.2,0,Math.PI*2);c.fill();c.fillStyle='#100f0d';c.beginPath();c.ellipse(66,67,11,10,.2,0,Math.PI*2);c.fill();
  c.strokeStyle=surface==='metal'?'#cbd1d1':'#4b4438';c.lineWidth=1.4;
  for(let i=0;i<9;i++){const a=i*2.399,r=30+i%4*4;c.beginPath();c.moveTo(64+Math.cos(a)*17,64+Math.sin(a)*17);c.lineTo(64+Math.cos(a+.08)*r,64+Math.sin(a+.08)*r);c.lineTo(64+Math.cos(a)*Math.min(57,r+9),64+Math.sin(a)*Math.min(57,r+9));c.stroke();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export class ImpactMarks {
 private records=new Map<number,{mark:ImpactMark;geometry?:THREE.BufferGeometry;key?:string}>();
 private materials=new Map<string,THREE.MeshStandardMaterial>();private meshes:THREE.Mesh[]=[];private dirty=false;
 constructor(private scene:THREE.Scene){}
 add(mark:ImpactMark){if(this.records.has(mark.id))return;this.records.set(mark.id,{mark});while(this.records.size>IMPACT_RULES.limit){const id=this.records.keys().next().value!;this.remove(id);}}
 sync(marks:ImpactMark[],time:number){
  const ids=new Set(marks.map(m=>m.id));for(const [id,r] of this.records)if(r.mark.expiresAt<=time||r.mark.at<=time&&!ids.has(id))this.remove(id);
  for(const mark of marks)if(mark.expiresAt>time)this.add(mark);
 }
 private remove(id:number){const r=this.records.get(id);r?.geometry?.dispose();this.records.delete(id);this.dirty=true;}
 update(map:THREE.Object3D,time:number){
  for(const [id,r] of this.records)if(r.mark.expiresAt<=time)this.remove(id);
  let budget=3;for(const r of this.records.values()){
   if(r.key!==undefined)continue;if(budget--<=0)break;
   const m=r.mark,origin=new THREE.Vector3(m.ray.origin.x,m.ray.origin.y,m.ray.origin.z),direction=new THREE.Vector3(m.ray.direction.x,m.ray.direction.y,m.ray.direction.z).normalize(),position=new THREE.Vector3(m.position.x,m.position.y,m.position.z);
   map.updateWorldMatrix(true,true);const ray=new THREE.Raycaster(origin,direction,.001,origin.distanceTo(position)+.75),hit=ray.intersectObject(map,true).find(h=>h.object instanceof THREE.Mesh);
   r.key='';if(!hit||hit.point.distanceTo(position)>.75)continue;
   const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld)??new THREE.Vector3(m.normal.x,m.normal.y,m.normal.z);if(normal.dot(direction)>0)normal.negate();
   const knife=m.weapon==='knife',rotation=sprayRotation(normal,m.ray.direction);rotation.z+=knife?((m.id%7)-3)*.065:(m.id*2.399);
   const size=knife?new THREE.Vector3(.34,.14,.065):new THREE.Vector3(m.weapon==='marksman'?.12:.09,m.weapon==='marksman'?.12:.09,.045);
   const geometry=impactGeometry(hit.object as THREE.Mesh,hit.point,rotation,size);if(!geometry.attributes.position.count){geometry.dispose();continue;}
   r.geometry=geometry;r.key=`${knife?'knife':'bullet'}-${m.surface}`;this.dirty=true;
   if(!this.materials.has(r.key)){const map=impactTexture(knife,m.surface);this.materials.set(r.key,new THREE.MeshStandardMaterial({map,transparent:true,alphaTest:.025,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,roughness:m.surface==='metal'?.55:1,metalness:m.surface==='metal'?.4:0}));}
  }
  if(!this.dirty)return;this.dirty=false;
  for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose();}this.meshes=[];
  for(const [key,material] of this.materials){const geometries=[...this.records.values()].filter(r=>r.key===key&&r.geometry).map(r=>r.geometry!);if(!geometries.length)continue;const geometry=mergeGeometries(geometries);if(!geometry)continue;const mesh=new THREE.Mesh(geometry,material);mesh.name=`impacts-${key}`;mesh.renderOrder=3;mesh.receiveShadow=true;this.scene.add(mesh);this.meshes.push(mesh);}
 }
 clear(){for(const r of this.records.values())r.geometry?.dispose();this.records.clear();for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose();}this.meshes=[];this.dirty=false;}
 destroy(){this.clear();for(const material of this.materials.values()){material.map?.dispose();material.dispose();}this.materials.clear();}
}
