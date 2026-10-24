import * as THREE from 'three';
import type {WorldArt} from './world';
export function ironHelmet(root:THREE.Group,art:WorldArt,red:THREE.Material,gold:THREE.Material,dark:THREE.Material){
 const helmet=new THREE.Mesh(new THREE.LatheGeometry([[.055,1.49],[.09,1.53],[.125,1.61],[.128,1.70],[.105,1.77],[.065,1.81],[0,1.825]].map(([r,y])=>new THREE.Vector2(r,y)),48),red);helmet.scale.z=.92;root.add(helmet);
 const rows=[[1.52,.043],[1.56,.067],[1.61,.083],[1.68,.102],[1.74,.089],[1.785,.074]],vertices:number[]=[],indices:number[]=[];
 rows.forEach(([y,r],j)=>{for(let i=0;i<=12;i++){const x=(i/6-1)*r,z=-.142+Math.pow(Math.abs(x/r),1.7)*.055-(j===2?(1-Math.abs(x/r))*.013:0);vertices.push(x,y,z);if(j&&i){const a=j*13+i;indices.push(a,a-1,a-14,a,a-14,a-13);}}});
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const mask=new THREE.Mesh(geo,gold);mask.material.side=THREE.DoubleSide;root.add(mask);
 const black=art.material('#12191e',{metalness:.4,roughness:.5}),glow=art.material('#c6f4ff',{emissive:'#8adcfb',emissiveIntensity:2.2});
 for(const side of [-1,1]){
  const eye=new THREE.Mesh(new THREE.BoxGeometry(.071,.018,.016),black);eye.position.set(side*.05,1.687,-.143);eye.rotation.z=side*-.13;root.add(eye);const lens=new THREE.Mesh(new THREE.BoxGeometry(.058,.007,.008),glow);lens.position.set(side*.05,1.688,-.154);lens.rotation.z=side*-.13;root.add(lens);
  const cheek=new THREE.Mesh(new THREE.BoxGeometry(.012,.12,.013),red);cheek.position.set(side*.087,1.609,-.105);cheek.rotation.z=-side*.24;root.add(cheek);
  const temple=new THREE.Mesh(new THREE.CylinderGeometry(.033,.033,.017,32),gold);temple.rotation.z=Math.PI/2;temple.position.set(side*.121,1.66,.004);root.add(temple);
 }
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.065,.009,.009),dark);mouth.position.set(0,1.562,-.139);root.add(mouth);
}
export function spiderLenses(root:THREE.Group,black:THREE.Material,white:THREE.Material){
 for(const side of [-1,1])for(const [scale,material,z]of [[1.12,black,-.166],[1,white,-.170]] as [number,THREE.Material,number][]){
  const shape=new THREE.Shape();shape.moveTo(.015,1.688);shape.quadraticCurveTo(.050,1.704,.100,1.718);shape.quadraticCurveTo(.091,1.664,.055,1.655);shape.quadraticCurveTo(.029,1.655,.015,1.688);
  const g=new THREE.ShapeGeometry(shape,16),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=(p.getX(i)-.056)*scale+.056,y=(p.getY(i)-1.685)*scale+1.685;p.setXYZ(i,side*x,y,z+Math.pow(x/.115,2)*.045);}if(side<0){const idx=g.index!;for(let i=0;i<idx.count;i+=3){const a=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,a);}}g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.material.side=THREE.DoubleSide;root.add(mesh);
 }
}
