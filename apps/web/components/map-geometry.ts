import * as THREE from 'three';
import {solidTop,type Solid} from '@sirocco/shared';

/** One mesh definition drives visible surfaces and the local debris colliders. */
export function solidGeometry(b:Solid):THREE.BufferGeometry {
  let geometry:THREE.BufferGeometry;
  if(b.polygon){
    const shape=new THREE.Shape(b.polygon.map(([x,z])=>new THREE.Vector2(x,-z)));
    geometry=new THREE.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false,steps:1});
    geometry.rotateX(-Math.PI/2);geometry.translate(0,b.y-b.h/2,0);
  }else{
    geometry=new THREE.BoxGeometry(b.w,b.h,b.d);geometry.translate(b.x,b.y,b.z);
    if(b.ramp){const p=geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)>b.y)p.setY(i,solidTop(b,{x:p.getX(i),z:p.getZ(i)}));geometry.computeVertexNormals();}
  }
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/3,(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))/3);
  return geometry;
}
