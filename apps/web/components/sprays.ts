import * as THREE from 'three';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import type {Vec3,Spray} from '@sirocco/shared';

/** Original painted emblem, drawn at runtime with no external image dependency. */
export function pingPongTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;
 const bat=(x:number,y:number,angle:number,color:string)=>{
  c.save();c.translate(x,y);c.rotate(angle);c.lineJoin='round';
  c.fillStyle='#c08d51';c.strokeStyle='#f0deba';c.lineWidth=12;c.beginPath();c.roundRect(-20,62,40,160,10);c.fill();c.stroke();
  c.fillStyle='#252e2b';c.beginPath();c.ellipse(0,0,104,126,0,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle=color;c.beginPath();c.ellipse(0,-2,93,114,0,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,255,255,.36)';c.lineWidth=5;c.beginPath();c.ellipse(-5,-9,77,96,0,Math.PI*1.06,Math.PI*1.55);c.stroke();
  c.strokeStyle='#765330';c.lineWidth=4;for(let j=0;j<4;j++){c.beginPath();c.moveTo(-13,110+j*23);c.lineTo(13,106+j*23);c.stroke();}c.restore();
 };
 bat(319,189,.60,'#277e91');bat(192,189,-.60,'#c54839');
 c.fillStyle='#eee9d5';c.strokeStyle='#26332c';c.lineWidth=10;c.beginPath();c.arc(340,350,48,0,Math.PI*2);c.fill();c.stroke();
 c.strokeStyle='#b6b9a7';c.lineWidth=4;c.beginPath();c.arc(334,345,36,.2,1.5);c.stroke();
 // Small transparent flecks soften the silhouette like paint on masonry.
 c.globalCompositeOperation='destination-out';for(let i=0;i<950;i++){const x=i*173%512,y=i*283%512;c.globalAlpha=.12+(i%4)*.08;c.fillRect(x,y,1+i%3,1+i%2);}c.globalAlpha=1;
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
/** Freeze the artwork's screen-up direction from the original spray aim. */
export function sprayRotation(surfaceNormal:THREE.Vector3,aim?:Vec3){
 const normal=surfaceNormal.clone().normalize(),up=new THREE.Vector3(0,1,0);
 if(aim){
  const forward=new THREE.Vector3(aim.x,aim.y,aim.z).normalize();
  // Reconstruct camera up (no roll), then project it onto the receiving plane.
  up.addScaledVector(forward,-up.dot(forward));
 }
 up.addScaledVector(normal,-up.dot(normal));
 if(up.lengthSq()<1e-8&&aim){up.set(aim.x,aim.y,aim.z);up.addScaledVector(normal,-up.dot(normal));}
 if(up.lengthSq()<1e-8){up.set(0,0,-1);up.addScaledVector(normal,-up.dot(normal));}
 if(up.lengthSq()<1e-8){up.set(1,0,0);up.addScaledVector(normal,-up.dot(normal));}
 up.normalize();const right=new THREE.Vector3().crossVectors(up,normal).normalize();up.crossVectors(normal,right).normalize();
 return new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal));
}

export class SprayMarks {
 private marks=new Map<number,THREE.Mesh>();private texture=pingPongTexture();
 private material=new THREE.MeshStandardMaterial({map:this.texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,roughness:1,side:THREE.DoubleSide});
 constructor(private scene:THREE.Scene){}
 sync(sprays:Spray[],map:THREE.Object3D){
  const ids=new Set(sprays.map(s=>s.id));for(const [id,mesh] of this.marks)if(!ids.has(id)){mesh.removeFromParent();mesh.geometry.dispose();this.marks.delete(id);}
  if(sprays.every(s=>this.marks.has(s.id)))return;map.updateMatrixWorld(true);
  for(const spray of sprays){if(this.marks.has(spray.id))continue;
   const position=new THREE.Vector3(spray.position.x,spray.position.y,spray.position.z),normal=new THREE.Vector3(spray.normal.x,spray.normal.y,spray.normal.z);
   // The server validates range/occlusion against shared collision. Raycast the
   // detailed render mesh as well, so paint follows sloped car panels and trim.
   const ray=spray.ray?new THREE.Raycaster(new THREE.Vector3(spray.ray.origin.x,spray.ray.origin.y,spray.ray.origin.z),new THREE.Vector3(spray.ray.direction.x,spray.ray.direction.y,spray.ray.direction.z).normalize(),0,4.02):new THREE.Raycaster(position.clone().addScaledVector(normal,.10),normal.clone().negate(),0,.22);
   const hit=ray.intersectObject(map,true).find(h=>h.object instanceof THREE.Mesh);if(!hit||hit.point.distanceTo(position)>.7)continue;
   position.copy(hit.point);if(hit.face){normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);if(normal.dot(ray.ray.direction)>0)normal.negate();}
   const rotation=sprayRotation(normal,spray.ray?.direction);
   const geometry=new DecalGeometry(hit.object as THREE.Mesh,position,rotation,new THREE.Vector3(spray.size??1.15,spray.size??1.15,.10)),mesh=new THREE.Mesh(geometry,this.material);mesh.renderOrder=2;mesh.receiveShadow=true;this.scene.add(mesh);this.marks.set(spray.id,mesh);
  }
 }
 clear(){for(const mesh of this.marks.values()){mesh.removeFromParent();mesh.geometry.dispose();}this.marks.clear();}
 destroy(){this.clear();this.material.dispose();this.texture.dispose();}
}
