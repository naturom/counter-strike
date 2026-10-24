import * as THREE from 'three';
// Split triangles at a tailoring seam so skin/suit boundaries are straight.
export function cutGeometryY(geometry:THREE.BufferGeometry,height:number){
 const p=geometry.attributes.position,n=geometry.attributes.normal,u=geometry.attributes.uv,index=geometry.index,positions:number[]=[],normals:number[]=[],uvs:number[]=[];
 const vertex=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),u.getX(i),u.getY(i)];
 const emit=(poly:number[][])=>{for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]]){positions.push(...v.slice(0,3));normals.push(...v.slice(3,6));uvs.push(...v.slice(6,8));}};
 const count=index?.count??p.count;for(let i=0;i<count;i+=3){const tri=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j)),ys=tri.map(v=>v[1]);if(Math.min(...ys)>=height||Math.max(...ys)<=height){emit(tri);continue;}
  for(const side of [-1,1]){const poly:number[][]=[];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],inside=(a[1]-height)*side>=0,next=(b[1]-height)*side>=0;if(inside)poly.push(a);if(inside!==next){const t=(height-a[1])/(b[1]-a[1]);poly.push(a.map((v,k)=>v+(b[k]-v)*t));}}emit(poly);}
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));result.setIndex(Array.from({length:positions.length/3},(_,i)=>i));geometry.dispose();return result;
}
