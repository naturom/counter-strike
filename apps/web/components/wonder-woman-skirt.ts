import * as THREE from 'three';

// Fit the waist and hips independently in width and depth, rather than using a cone.
const profiles=[
 [1.045,.175,.125,-.038],
 [1.010,.184,.132,-.030],
 [.950,.203,.150,-.020],
 [.875,.220,.174,-.023],
 [.805,.235,.192,-.025],
];
export function wonderWomanSkirtProfile(y:number){
 const clamped=THREE.MathUtils.clamp(y,profiles.at(-1)![0],profiles[0][0]);let i=0;while(i<profiles.length-2&&clamped<profiles[i+1][0])i++;
 const a=profiles[i],b=profiles[i+1],t=(a[0]-clamped)/(a[0]-b[0]);
 return {width:THREE.MathUtils.lerp(a[1],b[1],t),depth:THREE.MathUtils.lerp(a[2],b[2],t),center:THREE.MathUtils.lerp(a[3],b[3],t)};
}
export function wonderWomanSkirtPoint(y:number,angle:number,inset=0){
 const p=wonderWomanSkirtProfile(y),fall=THREE.MathUtils.smoothstep(1.045-y,0,.12),pleat=.0018*(.5+.5*Math.cos(angle*12))*fall,hem=THREE.MathUtils.smoothstep(.85-y,0,.045)*.006*(.5+.5*Math.cos(angle*12));
 return new THREE.Vector3(Math.cos(angle)*(p.width+pleat-inset),y-hem,Math.sin(angle)*(p.depth+pleat-inset)+p.center);
}
/** Continuous panelled leather shell, with a lined inside and a finished hem. */
export function wonderWomanSkirtGeometry(){
 const segments=96,rows=16,stride=segments+1,layer=stride*(rows+1),position:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let side=0;side<2;side++)for(let row=0;row<=rows;row++)for(let j=0;j<=segments;j++){
  const t=row/rows,p=wonderWomanSkirtPoint(THREE.MathUtils.lerp(1.045,.805,t),j/segments*Math.PI*2,side*.003);position.push(p.x,p.y,p.z);uv.push(j/segments,t);
 }
 for(let side=0;side<2;side++)for(let row=0;row<rows;row++)for(let j=0;j<segments;j++){
  const a=side*layer+row*stride+j,b=a+1,d=a+stride,c=d+1;indices.push(...(side?[a,d,b,b,d,c]:[a,b,d,b,c,d]));
 }
 for(let j=0;j<segments;j++){
  const bottom=rows*stride+j;indices.push(j,j+layer,j+1,j+1,j+layer,j+layer+1,bottom,bottom+1,bottom+layer,bottom+1,bottom+layer+1,bottom+layer);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 // Match smooth shading across the UV wrap on each side of the skirt.
 const normal=g.attributes.normal;for(let side=0;side<2;side++)for(let row=0;row<=rows;row++){const a=side*layer+row*stride,b=a+segments,n=new THREE.Vector3().fromBufferAttribute(normal,a).add(new THREE.Vector3().fromBufferAttribute(normal,b)).normalize();normal.setXYZ(a,n.x,n.y,n.z);normal.setXYZ(b,n.x,n.y,n.z);}return g;
}

/** Let the lower leather panels follow each thigh while keeping the waistband fixed. */
export function poseWonderWomanSkirt(model:THREE.Group){
 if(model.userData.avatar!=='wonder-woman')return;
 const left=model.getObjectByName('leftLeg')?.rotation.x??0,right=model.getObjectByName('rightLeg')?.rotation.x??0;
 const parts:THREE.Mesh[]=model.userData.skirtParts??=model.getObjectsByProperty('name','wonder-woman-fitted-skirt').concat(model.getObjectsByProperty('name','wonder-woman-skirt-seam'));
 for(const mesh of parts){
  if(mesh.userData.skirtLeft===left&&mesh.userData.skirtRight===right)continue;
  mesh.userData.skirtLeft=left;mesh.userData.skirtRight=right;
  const p=mesh.geometry.attributes.position,rest:Float32Array=mesh.userData.skirtRest??=Float32Array.from(p.array);
  for(let i=0;i<p.count;i++){
   const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2],angle=THREE.MathUtils.lerp(left,right,THREE.MathUtils.smoothstep(x,-.06,.06))*THREE.MathUtils.smoothstep(1.035-y,0,.17),sin=Math.sin(angle),cos=Math.cos(angle),drop=y-.91;
   p.setXYZ(i,x,.91+drop*cos-z*sin,drop*sin+z*cos);
  }
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
 }
}
