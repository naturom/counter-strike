import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {addFittedShoulders} from './character-shoulders';
import {wonderWomanSkirtGeometry,wonderWomanSkirtPoint} from './wonder-woman-skirt';
import {WONDER_WOMAN_SHOULDER_CUT} from './wonder-woman-proportions';
import type {WorldArt} from './world';
function tessellate(source:THREE.BufferGeometry,steps:number){
 const p=source.attributes.position,out:number[]=[];for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1).sub(a),c=new THREE.Vector3().fromBufferAttribute(p,i+2).sub(a);const emit=(u:number,v:number)=>{const q=a.clone().addScaledVector(b,u/steps).addScaledVector(c,v/steps);out.push(q.x,q.y,q.z);};for(let u=0;u<steps;u++)for(let v=0;v<steps-u;v++){emit(u,v);emit(u+1,v);emit(u,v+1);if(u+v<steps-1){emit(u+1,v);emit(u+1,v+1);emit(u,v+1);}}}source.dispose();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(out,3));return geometry;
}
export function addWonderWoman(root:THREE.Group,art:WorldArt,gold:THREE.Material,red:THREE.Material,navy:THREE.Material){
 const group=new THREE.Group();group.name='wonderWomanCostume';root.add(group);
 const body=root.children.find(o=>o.name==='anatomy-Skin') as THREE.Mesh,materials=body.material as THREE.Material[];addFittedShoulders(root,group,materials[3],'wonder-woman-shoulder',false,WONDER_WOMAN_SHOULDER_CUT);
 const surface=body.geometry.attributes.position;
 body.updateWorldMatrix(true,false);const ray=new THREE.Raycaster(),frontSamples=new Map<string,number>();
 const fitted=(name:string,points:number[][],material:THREE.Material)=>{
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const geometry=tessellate(new THREE.ExtrudeGeometry(shape,{depth:.003,bevelEnabled:true,bevelSize:.001,bevelThickness:.001,bevelSegments:2}),name.includes('tiara')?8:4),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i);if(name.includes('tiara')){p.setZ(i,-.015-.16*Math.sqrt(Math.max(0,1-(x/.095)**2))-.003+p.getZ(i));continue;}
   const key=`${x.toFixed(6)},${y.toFixed(6)}`;let front=frontSamples.get(key);
   if(front===undefined){
    ray.set(new THREE.Vector3(x,y,-1),new THREE.Vector3(0,0,1));const hit=ray.intersectObject(body,false)[0];
    if(hit)front=hit.point.z;
    else{let nearest=Infinity;front=0;for(let j=0;j<surface.count;j++){const d=(surface.getX(j)-x)**2+(surface.getY(j)-y)**2;if(d<nearest){nearest=d;front=surface.getZ(j);}}}
    frontSamples.set(key,front);
   }p.setZ(i,front-.005+p.getZ(i));
  }
  const smooth=mergeVertices(geometry,1e-5);smooth.computeVertexNormals();geometry.dispose();const mesh=new THREE.Mesh(smooth,material);mesh.name=name;group.add(mesh);
 };
 fitted('wonder-woman-eagle-trim',[[-.15,1.35],[-.055,1.31],[0,1.33],[.055,1.31],[.15,1.35],[.14,1.323],[.055,1.285],[0,1.305],[-.055,1.285],[-.14,1.323]],gold);
 fitted('wonder-woman-waist-crest',[[-.145,1.055],[0,1.01],[.145,1.055],[.145,1.035],[0,.985],[-.145,1.035]],gold);
 fitted('wonder-woman-tiara',[[-.09,1.733],[-.028,1.733],[0,1.715],[.028,1.733],[.09,1.733],[.09,1.718],[.03,1.718],[0,1.697],[-.03,1.718],[-.09,1.718]],gold);
 fitted('wonder-woman-tiara-inset',[[0,1.718],[.009,1.711],[0,1.704],[-.009,1.711]],red);
 const skirt=new THREE.Mesh(wonderWomanSkirtGeometry(),navy);skirt.name='wonder-woman-fitted-skirt';group.add(skirt);
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,points=Array.from({length:17},(_,row)=>wonderWomanSkirtPoint(THREE.MathUtils.lerp(1.038,.806,row/16),angle,-.0007));
  const seam=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.00055,4,false),gold);seam.name='wonder-woman-skirt-seam';group.add(seam);
 }
 const lasso=new THREE.Group();lasso.name='wonder-woman-lasso';lasso.position.set(.18,.955,0);lasso.rotation.y=.9;group.add(lasso);for(let i=0;i<4;i++){const coil=new THREE.Mesh(new THREE.TorusGeometry(.060+i*.002,.002,6,40),gold);coil.position.z=i*.002;lasso.add(coil);}
}
