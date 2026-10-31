import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {fitHandCuff} from './hand-cuff';

type Grip='knife'|'grenade'|'bomb'|'gun'|'support';
const vector=(p:number[])=>new THREE.Vector3(p[0],p[1],p[2]);
/** Smooth glove fingers with a rounded fingertip, rather than separate joint balls. */
function finger(points:number[][],radius:number){
 const path=new THREE.CatmullRomCurve3(points.map(vector)),rings=28,capRings=6,sides=12,frames=path.computeFrenetFrames(rings,false),p:number[]=[],index:number[]=[];
 for(let i=0;i<=rings;i++){
  const t=i/rings,center=path.getPointAt(t),r=radius*(1-.22*t);
  for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;const at=center.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r*.88);p.push(at.x,at.y,at.z);}
 }
 // A hemispherical cap keeps the glove tips round, including when curled upward.
 for(let i=1;i<=capRings;i++){
  const a=i/capRings*Math.PI/2,r=radius*.78*Math.cos(a),center=path.getPointAt(1).addScaledVector(frames.tangents[rings],radius*.78*Math.sin(a));
  for(let j=0;j<=sides;j++){const b=j/sides*Math.PI*2,at=center.clone().addScaledVector(frames.normals[rings],Math.cos(b)*r).addScaledVector(frames.binormals[rings],Math.sin(b)*r*.88);p.push(at.x,at.y,at.z);}
 }
 for(let i=0;i<rings+capRings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;index.push(a,a+1,b,b,a+1,b+1);}
 const start=p.length/3;p.push(...path.getPointAt(0).toArray());for(let j=0;j<sides;j++)index.push(start,j+1,j);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setIndex(index);geometry.computeVertexNormals();return geometry.toNonIndexed();
}
function palm(){
 // A flattened metacarpal volume narrows gradually into the wrist.
 const profiles=[[-.027,.039,.015],[-.012,.048,.021],[.025,.047,.025],[.065,.038,.027],[.105,.034,.027],[.151,.034,.028]],p:number[]=[],index:number[]=[],sides=32;
 for(const [z,w,h] of profiles)for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;p.push(Math.cos(a)*w,Math.sin(a)*h,z);}
 for(let i=0;i<profiles.length-1;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;index.push(a,a+1,b,b,a+1,b+1);}
 for(const end of [0,profiles.length-1]){const at=p.length/3;p.push(0,0,profiles[end][0]);for(let j=0;j<sides;j++){const a=end*(sides+1)+j;index.push(at,...(end?[a,a+1]:[a+1,a]));}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g.toNonIndexed();
}
function shape(kind:Grip,left:boolean,typing=false,relaxed=false){
 const pieces=[palm()],mirror=left?-1:1;
 for(let i=0;i<4;i++){
  const x=(-.034+i*.023)*mirror,short=i===3?.012:i===0?.006:0;
  let points:number[][];
  if(relaxed)points=[[x,0,-.012],[x,-.008,-.054+short],[x,-.035,-.054+short],[x,-.047,-.025+short],[x,-.035,-.002+short]];
  else if(kind==='gun'&&i===0&&!left)points=[[x,0,-.012],[x,-.008,-.062],[x,-.028,-.094],[x,-.045,-.075]];
  else if(kind==='gun'||kind==='support')points=[[x,0,-.012],[x,-.008,-.054+short],[x,-.038,-.068+short],[x,-.060,-.044+short],[x,-.055,-.010+short]];
  else if(kind==='knife')points=[[x,.002,-.012],[x,-.007,-.058+short],[x,-.036,-.075+short],[x,-.064,-.052+short],[x,-.059,-.018+short]];
  else if(kind==='grenade'){
   const radius=Math.sqrt(.071**2-x*x);points=[[x,-.004,-.016]];
   for(const a of [.55,1.05,1.60,2.1-short*5])points.push([x,-.080+Math.cos(a)*radius,-.015-Math.sin(a)*radius]);
  }else if(typing){
   points=i===0?[[x,0,-.015],[x,-.007,-.060],[x,-.023,-.104],[x,-.035,-.135]]:[[x,0,-.015],[x,-.005,-.055+short],[x,-.032,-.077+short],[x,-.048,-.052+short]];
  }else points=[[x,0,-.015],[x,-.004,-.055+short],[x,-.013,-.095+short],[x,-.040,-.120+short],[x,-.061,-.115+short]];
  pieces.push(finger(points,i===3?.009:.0105));
 }
 const side=left?1:-1;
 const thumb=kind==='grenade'?[[side*.037,-.004,.055],[side*.060,-.026,.035],[side*.069,-.066,.018],[side*.056,-.092,-.001]]:kind==='knife'||kind==='gun'||kind==='support'?[[side*.036,-.003,.050],[side*.058,-.024,.018],[side*.048,-.052,-.004],[side*.022,-.060,-.011]]:typing?[[side*.036,-.003,.05],[side*.059,-.012,.014],[side*.067,-.024,-.016],[side*.053,-.039,-.031]]:[[side*.036,-.003,.054],[side*.065,-.008,.03],[side*.080,-.035,.002],[side*.078,-.055,-.018]];
 pieces.push(finger(thumb,.016));
 // The thumb's thenar pad blends its root into the palm.
 const pad=new THREE.SphereGeometry(1,20,16);pad.scale(.025,.025,.039);pad.translate(side*.031,-.006,.045);pad.deleteAttribute('uv');pieces.push(pad.toNonIndexed());pad.dispose();
 const merged=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());
 if(kind==='knife'&&!relaxed){
  // The fingers close across the handle while the wrist approaches diagonally
  // from behind it. Bending the palm avoids a right-angle hammer grip.
  const p=merged.attributes.position,pivot=new THREE.Vector3(0,-.031,-.034);
  for(let i=0;i<p.count;i++){const at=new THREE.Vector3().fromBufferAttribute(p,i),weight=1-THREE.MathUtils.smoothstep(at.z,.035,.145);at.sub(pivot).applyAxisAngle(new THREE.Vector3(0,1,0),(Math.PI/2-.85)*weight).add(pivot);p.setXYZ(i,at.x,at.y,at.z);}
  merged.deleteAttribute('normal');const smooth=mergeVertices(merged,1e-5);smooth.computeVertexNormals();merged.dispose();return smooth;
 }
 return merged;
}
/** Item-specific grips in the same wrist frame as the anatomical hands. */
export function createSuitGrip(material:THREE.Material,left:boolean,kind:Grip,relaxed=false,female=false){
 const make=(typing=false)=>{const g=shape(kind,left,typing,relaxed);if(female)g.scale(.84,.84,.90);return fitHandCuff(g,female?.028:.034,female?.021:.027);};
 const group=new THREE.Group(),geometry=make(),mesh=new THREE.Mesh(geometry,material);group.name=female?'wonder-woman-equipment-grip':'ultraman-equipment-grip';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 if(kind==='bomb'&&!left){const typing=make(true);geometry.morphAttributes.position=[typing.attributes.position.clone()];geometry.morphAttributes.normal=[typing.attributes.normal.clone()];typing.dispose();mesh.updateMorphTargets();group.userData.typingMesh=mesh;}
 group.userData.gripKind=kind;
 return group;
}
