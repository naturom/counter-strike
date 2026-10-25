import * as THREE from 'three';
import {cutGeometryY} from './costume-geometry';
/** Preserve the fitted deltoid surface when the resting arms are replaced by posed arms. */
export function addFittedShoulders(root:THREE.Group,parent:THREE.Group,material:THREE.Material,name:string,armor=false,cutHeight=1.30){
 for(const side of [-1,1]){
  const resting=root.getObjectByName(side<0?'unarmedLeftArm':'unarmedRightArm')!,skin=resting.getObjectByName('anatomy-Skin') as THREE.Mesh;
  const geometry=cutGeometryY(skin.geometry.clone(),cutHeight),position=geometry.attributes.position,normal=geometry.attributes.normal,index=geometry.index!,indices:number[]=[];
  for(let i=0;i<index.count;i+=3){const triangle=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(triangle.every(j=>position.getY(j)>=cutHeight-1e-6))indices.push(...triangle);}
  geometry.clearGroups();geometry.setIndex(indices);
  if(armor)for(let i=0;i<position.count;i++){position.setXYZ(i,position.getX(i)+(position.getX(i)-side*.16)*.18+normal.getX(i)*.007,position.getY(i)+normal.getY(i)*.007,position.getZ(i)+normal.getZ(i)*.007);}
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.userData.fittedShoulder=true;mesh.userData.side=side;mesh.userData.cutHeight=cutHeight;parent.add(mesh);
 }
}
