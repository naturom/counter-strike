import * as THREE from 'three';
import {wonderWomanSkirtProfile} from './wonder-woman-skirt';

export const WONDER_WOMAN_ARM_LIFT=.045;
export const WONDER_WOMAN_SHOULDER_CUT=1.335;

/** Apply a smooth sculpt to the imported surface without breaking its UV seams. */
function sculpt(geometry:THREE.BufferGeometry,reshape:(p:THREE.Vector3)=>THREE.Vector3){
 const position=geometry.attributes.position,normal=geometry.attributes.normal;
 for(let i=0;i<position.count;i++){
  const original=new THREE.Vector3().fromBufferAttribute(position,i),shaped=reshape(original);if(original.distanceToSquared(shaped)<1e-14)continue;
  position.setXYZ(i,shaped.x,shaped.y,shaped.z);
  const e=.0001,derivative=(axis:THREE.Vector3)=>reshape(original.clone().addScaledVector(axis,e)).sub(reshape(original.clone().addScaledVector(axis,-e))).divideScalar(2*e),x=derivative(new THREE.Vector3(1,0,0)),y=derivative(new THREE.Vector3(0,1,0)),z=derivative(new THREE.Vector3(0,0,1)),jacobian=new THREE.Matrix3().set(x.x,y.x,z.x,x.y,y.y,z.y,x.z,y.z,z.z),n=new THREE.Vector3().fromBufferAttribute(normal,i).applyMatrix3(jacobian.invert().transpose()).normalize();
  normal.setXYZ(i,n.x,n.y,n.z);
 }
 position.needsUpdate=true;normal.needsUpdate=true;
}
/** A broad, rounded bodice volume replaces the narrow additive peaks. */
export function fitWonderWomanTorso(geometry:THREE.BufferGeometry){
 sculpt(geometry,p=>{
  const across=Math.sqrt(p.x*p.x+.0001)-.01,q=((across-.083)/.108)**2+((p.y-1.285)/.100)**2;
  if(q>=1)return p;
  const edge=THREE.MathUtils.smoothstep(.20-Math.abs(p.x),0,.045),front=THREE.MathUtils.smoothstep(-p.z,.04,.115),blend=THREE.MathUtils.smoothstep(1-q,0,.45)*edge*front;
  const roundFront=-.132-.116*Math.sqrt(1-q);
  return new THREE.Vector3(p.x+Math.sign(p.x)*.006*blend,p.y,THREE.MathUtils.lerp(p.z,roundFront,blend*.92));
 });
}
/** Confine the correction to the crease under the lower lip, preserving its edge. */
function lowerLipShadow(x:number,y:number,z:number){
 return Math.exp(-((x/.032)**2)-((y-1.594)/.009)**2)*THREE.MathUtils.smoothstep(-z,.12,.145)*(1-THREE.MathUtils.smoothstep(y,1.600,1.604));
}
/** Subtle adult facial proportions; the same field also moves eyes, lashes and brows. */
export function fitWonderWomanFace(geometry:THREE.BufferGeometry){
 sculpt(geometry,p=>{
  const front=THREE.MathUtils.smoothstep(-p.z,.025,.105),jaw=Math.exp(-(((p.y-1.592)/.034)**2))*front,nose=Math.exp(-(((p.y-1.647)/.026)**2)-(p.x/.023)**2)*front,cheek=Math.exp(-(((p.y-1.647)/.022)**2)-((Math.abs(p.x)-.058)/.032)**2)*front;
  const smile=Math.exp(-(((Math.abs(p.x)-.028)/.013)**2)-((p.y-1.603)/.014)**2)*front;
  return new THREE.Vector3(p.x*(1-.055*jaw-.07*nose)+Math.sign(p.x)*(.0015*cheek+.0008*smile),p.y+.0055*smile+.0015*cheek,p.z+.0038*nose-.0015*cheek-.001*smile);
 });
 // Relax the downward-facing crease normals rather than adding light to the whole face.
 const position=geometry.attributes.position,normal=geometry.attributes.normal;
 for(let i=0;i<position.count;i++){
  const weight=lowerLipShadow(position.getX(i),position.getY(i),position.getZ(i))*.80;if(weight<.001)continue;
  const n=new THREE.Vector3().fromBufferAttribute(normal,i).lerp(new THREE.Vector3(0,0,-1),weight).normalize();normal.setXYZ(i,n.x,n.y,n.z);
 }
 normal.needsUpdate=true;
}
/** Restrained lip and cheek colour, blended into the existing skin texture. */
export function wonderWomanComplexion(geometry:THREE.BufferGeometry){
 const p=geometry.attributes.position,colors:number[]=[],base=new THREE.Color('#ffffff'),lip=new THREE.Color('#b65d68'),blush=new THREE.Color('#ecc3bf');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=THREE.MathUtils.smoothstep(-z,.115,.143),lipHeight=1.602+.0055*Math.exp(-(((Math.abs(x)-.028)/.013)**2)),mouth=(x/.033)**2+((y-lipHeight)/.009)**2,cheek=((Math.abs(x)-.058)/.030)**2+((y-1.639)/.022)**2;
  const color=base.clone().lerp(blush,.15*Math.exp(-cheek)*front).lerp(lip,.50*THREE.MathUtils.smoothstep(1-mouth,0,.5)*front);
  // Lift the crease's skin tone without washing out the lip edge.
  color.multiplyScalar(1+.28*lowerLipShadow(x,y,z));colors.push(color.r,color.g,color.b);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
}

/** Let the long locks fall over the back of the bodice and waistband. */
export function fitWonderWomanHair(geometry:THREE.BufferGeometry){
 sculpt(geometry,p=>{
  const fall=THREE.MathUtils.smoothstep(1.30-p.y,0,.23);if(!fall)return p;
  const skirt=wonderWomanSkirtProfile(p.y),width=skirt.width+.014,depth=skirt.depth+.014,back=skirt.center+depth*Math.sqrt(Math.max(0,1-(p.x/width)**2));
  const z=p.z+.045*fall,clearance=THREE.MathUtils.smoothstep(1.16-p.y,0,.09);
  return new THREE.Vector3(p.x,p.y,z+Math.max(0,back-z)*clearance*.98);
 });
}
