import * as THREE from 'three';
import {solidTop,type Solid} from '@sirocco/shared';

type Point = [number,number,number];
type Plane = [number,number,number,number];
const EPS=1e-5;
const distance=(p:Point,n:Plane)=>p[0]*n[0]+p[1]*n[1]+p[2]*n[2]+n[3];
function clip(points:Point[],plane:Plane,inside:boolean):Point[]{
  const result:Point[]=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=distance(a,plane),db=distance(b,plane);
    const keepA=inside?da>=0:da<=0,keepB=inside?db>=0:db<=0;
    if(keepA)result.push(a);
    if(keepA!==keepB){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}
  }
  return result;
}
function volumePlanes(b:Solid):Plane[]{
  const slope=b.ramp?(b.ramp.to-b.ramp.from)/(b.ramp.axis==='x'?b.w:b.d):0;
  const axis=b.ramp?.axis??'x',start=b[axis]-(axis==='x'?b.w:b.d)/2;
  const intercept=b.ramp?b.ramp.from-slope*start:b.y+b.h/2;
  return [[1,0,0,-b.x+b.w/2],[-1,0,0,b.x+b.w/2],[0,0,1,-b.z+b.d/2],[0,0,-1,b.z+b.d/2],[0,1,0,-b.y+b.h/2],[axis==='x'?slope:0,-1,axis==='z'?slope:0,intercept]];
}

/** Concave building footprints are clipped as a union of triangular prisms. */
function wallVolumes(b:Solid):Plane[][]{
  if(!b.polygon)return [volumePlanes(b)];
  const contour=b.polygon.map(([x,z])=>new THREE.Vector2(x,z));
  return THREE.ShapeUtils.triangulateShape(contour,[]).map(indices=>{
    const pts=indices.map(i=>b.polygon![i]),area=pts.reduce((n,p,i)=>n+p[0]*pts[(i+1)%3][1]-pts[(i+1)%3][0]*p[1],0),sign=Math.sign(area);
    const sides:Plane[]=pts.map((a,i)=>{const c=pts[(i+1)%3],dx=c[0]-a[0],dz=c[1]-a[1];return [-dz*sign,0,dx*sign,(dz*a[0]-dx*a[1])*sign];});
    return [...sides,[0,1,0,-b.y+b.h/2],[0,-1,0,b.y+b.h/2]] as Plane[];
  });
}

/** Render the union of shared box/ramp volumes, retaining the underside of raised bridges.
 * Clipping covered faces prevents both coplanar depth fighting and buried ramp
 * faces. Collision still uses the original, identical shared floor volumes. */
export function visibleSolidGeometry(b:Solid,floors:Solid[],walls:Solid[]=[]):THREE.BufferGeometry {
  const source=solidGeometry(b),raw=source.index?source.toNonIndexed():source;
  const positions=raw.attributes.position,normals=raw.attributes.normal;
  const output:number[]=[],normalOutput:number[]=[],uv:number[]=[];
  const ownIndex=floors.indexOf(b),others=floors.map((other,index)=>({other,index,planes:volumePlanes(other)})).filter(({other})=>other!==b&&Math.abs(other.x-b.x)<(other.w+b.w)/2+EPS&&Math.abs(other.z-b.z)<(other.d+b.d)/2+EPS);
  // Unlike a neighbouring floor, a wall owns coincident faces unconditionally.
  for(const wall of walls)if(Math.abs(wall.x-b.x)<(wall.w+b.w)/2+EPS&&Math.abs(wall.z-b.z)<(wall.d+b.d)/2+EPS){
    for(const planes of wallVolumes(wall))others.push({other:wall,index:-1,planes});
  }
  for(let i=0;i<positions.count;i+=3){
    const normal:Point=[normals.getX(i),normals.getY(i),normals.getZ(i)];
    let fragments:Point[][]=[[0,1,2].map(k=>[positions.getX(i+k),positions.getY(i+k),positions.getZ(i+k)] as Point)];
    for(const {index,planes} of others){
      const next:Point[][]=[];
      for(const polygon of fragments){
        // Coincident outward faces have one deterministic owner. Opposing
        // faces at a join are internal and are removed from both volumes.
        if(index>ownIndex&&planes.some(plane=>polygon.every(p=>Math.abs(distance(p,plane))<EPS)&&-(normal[0]*plane[0]+normal[1]*plane[1]+normal[2]*plane[2])/Math.hypot(plane[0],plane[1],plane[2])>.999)){next.push(polygon);continue;}
        let remaining=polygon;
        for(const plane of planes){
          if(remaining.length<3)break;
          const ds=remaining.map(p=>distance(p,plane));
          if(ds.every(d=>d>=-EPS))continue;
          if(ds.every(d=>d<=EPS)){next.push(remaining);remaining=[];break;}
          const outside=clip(remaining,plane,false);if(outside.length>=3)next.push(outside);
          remaining=clip(remaining,plane,true);
        }
      }
      fragments=next;if(!fragments.length)break;
    }
    for(const polygon of fragments)for(let k=1;k<polygon.length-1;k++){
      const triangle=[polygon[0],polygon[k],polygon[k+1]];
      const a=new THREE.Vector3(...triangle[0]),c=new THREE.Vector3(...triangle[1]).sub(a),d=new THREE.Vector3(...triangle[2]).sub(a);
      if(c.cross(d).lengthSq()<1e-12)continue;
      for(const [x,y,z] of triangle){output.push(x,y,z);normalOutput.push(...normal);uv.push((Math.abs(normal[0])>.5?z:x)/3,(Math.abs(normal[1])>.5?z:y)/3);}
    }
  }
  if(raw!==source)raw.dispose();source.dispose();
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(output,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normalOutput,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}

// Existing elevated floor/ramp callers retain the same ownership and clipping rules.
export const visibleFloorGeometry=visibleSolidGeometry;

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
