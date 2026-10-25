import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import source from './character-arm-data.json';

type Style='ultraman'|'wonder-woman'|'ironman';
type ArmData={position:string;normal:string;uv:string;index:string;weights:string;joints:number[][];handAxes:number[][]};
type ArmShape={position:Float32Array;normal:Float32Array;weights:Float32Array;pin:Float32Array;cuff:Float32Array;wristAngles:Float32Array;cuffIndices:number[];shoulder:THREE.Vector3;elbow:THREE.Vector3;wrist:THREE.Vector3;upperInverse:THREE.Matrix4;lowerInverse:THREE.Matrix4;handInverse:THREE.Matrix4;cut:number;foreAxis:THREE.Vector3;shoulderEdge:number[];wristEdge:number[];sourceToHeld?:THREE.Matrix4};
function bytes(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
const vector=(p:number[])=>new THREE.Vector3(p[0],p[1],p[2]);
function boneFrame(a:THREE.Vector3,b:THREE.Vector3,pole:THREE.Vector3,width=1,length=1){
 const y=b.clone().sub(a).normalize(),x=pole.clone().addScaledVector(y,-pole.dot(y)).normalize(),z=new THREE.Vector3().crossVectors(x,y).normalize();
 return new THREE.Matrix4().makeBasis(x.multiplyScalar(width),y.multiplyScalar(length),z.multiplyScalar(width)).setPosition(a);
}
/** Clip all skin attributes together so the shoulder, wrist and costume edges stay continuous. */
function clip(poly:number[][],distance:(v:number[])=>number,sign=1){
 const result:number[][]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a)*sign,db=distance(b)*sign;if(da<=1e-9)result.push(a);if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);result.push(a.map((v,k)=>v+(b[k]-v)*t));}}return result;
}
export function createAnatomicalArm(skin:THREE.Material,accent:THREE.Material,style:Style,left:boolean,joint:THREE.Material=skin,firstPerson=false){
 const data=source[style==='wonder-woman'?'female':'male'][left?'l':'r'] as ArmData,p=new Int16Array(bytes(data.position).buffer),n=new Int8Array(bytes(data.normal).buffer),uv=new Uint16Array(bytes(data.uv).buffer),weights=bytes(data.weights),indices=new Uint16Array(bytes(data.index).buffer),[shoulder,elbow,wrist]=data.joints.map(vector),foreAxis=wrist.clone().sub(elbow).normalize(),pole=elbow.clone().sub(shoulder).cross(foreAxis).normalize(),cut=style==='wonder-woman'?1.335:1.30,positions:number[]=[],normals:number[]=[],uvs:number[]=[],influences:number[]=[],groups:number[]=[];
 const vertex=(i:number)=>[p[i*3]/10000,p[i*3+1]/10000,p[i*3+2]/10000,n[i*3]/127,n[i*3+1]/127,n[i*3+2]/127,uv[i*2]/65535,uv[i*2+1]/65535,...Array.from(weights.subarray(i*4,i*4+4),w=>w/255)];
 // Locate the original open edge where the arm joins the torso. UV splits must
 // not be mistaken for holes, so topology is welded by source position here.
 const key=(i:number)=>`${p[i*3]},${p[i*3+1]},${p[i*3+2]}`,canonical=new Map<string,number>(),remap:number[]=[],edges=new Map<string,{a:number;b:number;count:number}>();
 for(let i=0;i<p.length/3;i++){const k=key(i);if(!canonical.has(k))canonical.set(k,i);remap.push(canonical.get(k)!);}
 for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){const a=remap[indices[i+j]],b=remap[indices[i+(j+1)%3]],k=a<b?`${a},${b}`:`${b},${a}`,edge=edges.get(k);if(edge)edge.count++;else edges.set(k,{a,b,count:1});}
 const boundary=[...new Set([...edges.values()].filter(e=>e.count===1).flatMap(e=>[e.a,e.b]))].map(i=>vector(vertex(i)));
 const along=(v:number[])=>new THREE.Vector3(v[0],v[1],v[2]).sub(elbow).dot(foreAxis),foreLength=elbow.distanceTo(wrist),emit=(poly:number[][],material:number)=>{
  for(let i=1;i<poly.length-1;i++){for(const v of [poly[0],poly[i],poly[i+1]]){positions.push(...v.slice(0,3));normals.push(...v.slice(3,6));uvs.push(...v.slice(6,8));influences.push(...v.slice(8,12));}groups.push(material);}
 };
 for(let i=0;i<indices.length;i+=3){
  const poly=clip(clip([vertex(indices[i]),vertex(indices[i+1]),vertex(indices[i+2])],v=>along(v)-foreLength-.012),v=>v[1]-(style==='wonder-woman'?1.51:1.49));if(poly.length<3)continue;
  if(style==='ironman'){
   const jointStart=(v:number[])=>along(v)+.014,jointEnd=(v:number[])=>along(v)-.014,bicep=(v:number[])=>v[1]-1.34;
   const top=clip(poly,jointStart);emit(clip(top,bicep),1);emit(clip(top,bicep,-1),0);emit(clip(clip(poly,jointStart,-1),jointEnd),2);emit(clip(poly,jointEnd,-1),0);
  }else if(style==='ultraman'){const lower=(v:number[])=>v[1]-elbow.y-.035,upper=(v:number[])=>v[1]-cut;emit(clip(poly,lower),0);emit(clip(clip(poly,lower,-1),upper),1);emit(clip(poly,upper,-1),0);}
  else{const first=(v:number[])=>along(v)-foreLength*.50,last=(v:number[])=>along(v)-foreLength+.012;emit(clip(poly,first),0);emit(clip(clip(poly,first,-1),last),1);emit(clip(poly,last,-1),0);}
 }
 const geometry=new THREE.BufferGeometry(),order=groups.map((material,i)=>({material,i})).sort((a,b)=>a.material-b.material),sorted=(values:number[],size:number)=>order.flatMap(({i})=>values.slice(i*3*size,(i+1)*3*size));
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(sorted(positions,3),3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(sorted(normals,3),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(sorted(uvs,2),2));geometry.setAttribute('armWeights',new THREE.Float32BufferAttribute(sorted(influences,4),4));
 for(let i=0;i<order.length;){let end=i+1;while(end<order.length&&order[end].material===order[i].material)end++;geometry.addGroup(i*3,(end-i)*3,order[i].material);i=end;}
 const handInverse=new THREE.Matrix4().makeBasis(...data.handAxes.map(vector) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).setPosition(wrist).invert();
 const welded=mergeVertices(geometry,1e-5);geometry.dispose();const rest=welded.attributes.position,edge:number[]=[],wristEdge:number[]=[],cuffIndices:number[]=[],pin=new Float32Array(rest.count),cuff=new Float32Array(rest.count),wristAngles=new Float32Array(rest.count);
 for(let i=0;i<rest.count;i++){const at=new THREE.Vector3().fromBufferAttribute(rest,i),distance=Math.min(Math.sqrt(Math.min(...boundary.map(p=>p.distanceToSquared(at)))),Math.abs(at.y-(style==='wonder-woman'?1.51:1.49)));pin[i]=1-THREE.MathUtils.smoothstep(distance,0,.07);if(distance<1e-6)edge.push(i);const local=at.clone().applyMatrix4(handInverse);wristAngles[i]=Math.atan2(local.y/.027,local.x/.034);const distanceToElbow=along(at.toArray());cuff[i]=THREE.MathUtils.smoothstep(distanceToElbow,foreLength-.025,foreLength+.012);if(cuff[i]>0)cuffIndices.push(i);if(Math.abs(distanceToElbow-foreLength-.012)<1e-6)wristEdge.push(i);}
 // Armour follows the anatomical silhouette, with a small shell thickness that
 // fades out at the pinned torso seam and the glove cuff.
 if(style==='ironman')for(let i=0;i<rest.count;i++){const at=new THREE.Vector3().fromBufferAttribute(rest,i),normal=new THREE.Vector3().fromBufferAttribute(welded.attributes.normal,i).normalize(),shell=.006*(1-pin[i])*(1-cuff[i]);at.addScaledVector(normal,shell);rest.setXYZ(i,at.x,at.y,at.z);}
 // Camera-facing arms need more volume than distant player meshes. Expand
 // around the anatomical bone axes, gradually tapering the last half of the
 // forearm into the original wrist instead of producing an abrupt cuff bulge.
 if(firstPerson){
  const upperAxis=elbow.clone().sub(shoulder).normalize(),upperLength=shoulder.distanceTo(elbow),upperWidth=style==='ironman'?1.30:1.23,foreWidth=style==='ironman'?1.44:style==='ultraman'?1.36:1.32;
  for(let i=0;i<rest.count;i++){
   const at=new THREE.Vector3().fromBufferAttribute(rest,i),distance=at.clone().sub(elbow).dot(foreAxis),center=distance>0?elbow.clone().addScaledVector(foreAxis,distance):shoulder.clone().addScaledVector(upperAxis,THREE.MathUtils.clamp(at.clone().sub(shoulder).dot(upperAxis),0,upperLength));
   const width=THREE.MathUtils.lerp(upperWidth,foreWidth,THREE.MathUtils.smoothstep(distance,-.055,.035)),taper=1-THREE.MathUtils.smoothstep(distance/foreLength,.40,.98);
   at.sub(center).multiplyScalar(1+(width-1)*taper).add(center);rest.setXYZ(i,at.x,at.y,at.z);
  }
  welded.computeVertexNormals();
 }
 if(style==='wonder-woman')welded.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(rest.count*3).fill(1),3));
 const mesh=new THREE.Mesh(welded,style==='ironman'?[skin,accent,joint]:[skin,accent]);mesh.name='anatomical-posed-arm';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
 const shape:ArmShape={position:Float32Array.from(rest.array),normal:Float32Array.from(welded.attributes.normal.array),weights:Float32Array.from(welded.attributes.armWeights.array),pin,cuff,wristAngles,cuffIndices,shoulder,elbow,wrist,upperInverse:boneFrame(shoulder,elbow,pole).invert(),lowerInverse:boneFrame(elbow,wrist,pole).invert(),handInverse,cut,foreAxis,shoulderEdge:edge,wristEdge};
 Object.assign(mesh.userData,{anatomicalArm:shape,style,left,firstPerson,radiusScale:style==='wonder-woman'?.84:1,upperLength:shoulder.distanceTo(elbow)/.75,forearmLength:foreLength/.75});return mesh;
}
export function bindAnatomicalArm(mesh:THREE.Mesh,sourceToHeld:THREE.Matrix4){
 const shape=mesh.userData.anatomicalArm as ArmShape;shape.sourceToHeld=sourceToHeld;
}
export function anatomicalShoulder(mesh:THREE.Mesh){return (mesh.userData.anatomicalArm as ArmShape).shoulder.clone();}
/** Skin the original muscle surface to the two arm bones and the hand, preserving elbow anatomy. */
export function poseAnatomicalArm(mesh:THREE.Mesh,shoulder:THREE.Vector3,elbow:THREE.Vector3,wrist:THREE.Vector3,palm:THREE.Matrix4){
 const shape=mesh.userData.anatomicalArm as ArmShape,armInverse=mesh.parent!.matrix.clone().invert();
 const restUpper=shape.elbow.clone().sub(shape.shoulder).normalize(),restLower=shape.wrist.clone().sub(shape.elbow).normalize(),restPole=restUpper.clone().cross(restLower).normalize(),upperPole=restPole.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restUpper,elbow.clone().sub(shoulder).normalize())),lowerPole=restPole.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restLower,wrist.clone().sub(elbow).normalize()));
 const upper=boneFrame(shoulder,elbow,upperPole,1/.75,shoulder.distanceTo(elbow)/shape.shoulder.distanceTo(shape.elbow)).multiply(shape.upperInverse),lower=boneFrame(elbow,wrist,lowerPole,1/.75,elbow.distanceTo(wrist)/shape.elbow.distanceTo(shape.wrist)).multiply(shape.lowerInverse),hand=palm.clone().scale(new THREE.Vector3(1.06,1.06,1.06)).setPosition(wrist).multiply(shape.handInverse),fixed=shape.sourceToHeld?armInverse.clone().multiply(shape.sourceToHeld):upper,matrices=[upper,lower,hand,fixed],out=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
 // Dual-quaternion rotation blending preserves the forearm's volume during
 // pronation. Linear matrix blending would pinch a 180-degree wrist turn shut.
 const dual=matrices.map(m=>{
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();m.decompose(position,rotation,scale);
  const translation=new THREE.Quaternion(position.x,position.y,position.z,0).multiply(rotation),inverseRotation=new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(rotation.clone().conjugate())),stretch=inverseRotation.multiply(new THREE.Matrix3().setFromMatrix4(m));
  return {rotation,translation,stretch:stretch.elements};
 });
 for(let i=0;i<out.count;i++){
  const k=i*3,x=shape.position[k],y=shape.position[k+1],z=shape.position[k+2],nx=shape.normal[k],ny=shape.normal[k+1],nz=shape.normal[k+2],pin=shape.sourceToHeld?shape.pin[i]:0,total=shape.weights[i*4]+shape.weights[i*4+1]+shape.weights[i*4+2]+shape.weights[i*4+3];
   const w0=shape.weights[i*4]/total*(1-pin),w1=shape.weights[i*4+1]/total*(1-pin),w2=shape.weights[i*4+2]/total*(1-pin),w3=shape.weights[i*4+3]/total*(1-pin)+pin;let reference=0,largest=w0;if(w1>largest){reference=1;largest=w1;}if(w2>largest){reference=2;largest=w2;}if(w3>largest)reference=3;
   let rx=0,ry=0,rz=0,rw=0,dx=0,dy=0,dz=0,dw=0,sx=0,sy=0,sz=0;
   for(let b=0;b<4;b++){
    const w=b===0?w0:b===1?w1:b===2?w2:w3;if(w<1e-6)continue;const q=dual[b].rotation,d=dual[b].translation,s=dual[b].stretch,sign=q.dot(dual[reference].rotation)<0?-1:1;
    rx+=q.x*w*sign;ry+=q.y*w*sign;rz+=q.z*w*sign;rw+=q.w*w*sign;dx+=d.x*w*sign*.5;dy+=d.y*w*sign*.5;dz+=d.z*w*sign*.5;dw+=d.w*w*sign*.5;
    sx+=(s[0]*x+s[3]*y+s[6]*z)*w;sy+=(s[1]*x+s[4]*y+s[7]*z)*w;sz+=(s[2]*x+s[5]*y+s[8]*z)*w;
   }
   const length=Math.hypot(rx,ry,rz,rw)||1;rx/=length;ry/=length;rz/=length;rw/=length;dx/=length;dy/=length;dz/=length;dw/=length;
   const dot=rx*dx+ry*dy+rz*dz+rw*dw;dx-=rx*dot;dy-=ry*dot;dz-=rz*dot;dw-=rw*dot;
   const tx=2*(ry*sz-rz*sy),ty=2*(rz*sx-rx*sz),tz=2*(rx*sy-ry*sx),ux=2*(ry*nz-rz*ny),uy=2*(rz*nx-rx*nz),uz=2*(rx*ny-ry*nx);
   out.setXYZ(i,sx+rw*tx+ry*tz-rz*ty+2*(dx*rw-dw*rx-dy*rz+dz*ry),sy+rw*ty+rz*tx-rx*tz+2*(dy*rw-dw*ry-dz*rx+dx*rz),sz+rw*tz+rx*ty-ry*tx+2*(dz*rw-dw*rz-dx*ry+dy*rx));
   const normalLength=Math.hypot(nx,ny,nz)||1;normal.setXYZ(i,(nx+rw*ux+ry*uz-rz*uy)/normalLength,(ny+rw*uy+rz*ux-rx*uz)/normalLength,(nz+rw*uz+rx*uy-ry*ux)/normalLength);

 }
 // The glove and suit share the same wrist ellipse; the blend is limited to the cuff.
 if(mesh.userData.gloveWrist){
  const frameNormal=new THREE.Matrix3().getNormalMatrix(palm),[width,depth]=mesh.userData.wristRadii??[.034,.027],handFrame=palm.clone().invert();
  for(const i of shape.cuffIndices){
   const weight=shape.cuff[i];
   const p=new THREE.Vector3().fromBufferAttribute(out,i),angle=shape.wristAngles[i],target=new THREE.Vector3(Math.cos(angle)*width,Math.sin(angle)*depth,.12).applyMatrix4(palm),n=new THREE.Vector3(Math.cos(angle)/width,Math.sin(angle)/depth,0).applyMatrix3(frameNormal).normalize();p.lerp(target,weight);
   if(mesh.userData.style==='wonder-woman'){
    // Keep successive bracer rings behind the hand's wrist plane. Blending
    // directly toward a tilted hand could curl the middle rings past the open
    // end, producing a hollow lip despite a correctly aligned edge contour.
    p.applyMatrix4(handFrame);p.z=.12+.035*(1-weight);p.applyMatrix4(palm);
   }
   n.lerp(new THREE.Vector3().fromBufferAttribute(normal,i),1-weight).normalize();out.setXYZ(i,p.x,p.y,p.z);normal.setXYZ(i,n.x,n.y,n.z);
  }
 }
 out.needsUpdate=true;normal.needsUpdate=true;mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
}
