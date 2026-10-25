import * as THREE from 'three';
import {addFittedShoulders} from './character-shoulders';
import {fittedArmorGeometry,frontSurfaceZ} from './fitted-armor';
import type {WorldArt} from './world';
export function ironArmor(root:THREE.Group,art:WorldArt,red:THREE.Material,gold:THREE.Material,dark:THREE.Material){
 const group=new THREE.Group();group.name='ironManArmor';root.add(group);addFittedShoulders(root,group,red,'shoulder-shell',true,1.38);
 const body=root.children.find(o=>o.name==='anatomy-Skin') as THREE.Mesh;
 const panel=(parent:THREE.Object3D,surface:THREE.BufferGeometry,name:string,points:number[][],material:THREE.Material,offset=.006,back=false)=>{
  const mesh=new THREE.Mesh(fittedArmorGeometry(surface,points,offset,.003,back),material);mesh.name=name;mesh.userData.fittedArmor=true;parent.add(mesh);return mesh;
 };
 const framed=(parent:THREE.Object3D,surface:THREE.BufferGeometry,name:string,points:number[][],material:THREE.Material)=>{
  const cx=points.reduce((n,p)=>n+p[0],0)/points.length,cy=points.reduce((n,p)=>n+p[1],0)/points.length;
  panel(parent,surface,name+'-seam',points.map(([x,y])=>[cx+(x-cx)*1.035,cy+(y-cy)*1.035]),dark,.0035);
  return panel(parent,surface,name,points,material,.007);
 };
 framed(group,body.geometry,'collar-carapace',[[-.15,1.422],[-.063,1.463],[.063,1.463],[.15,1.422],[.132,1.396],[-.132,1.396]],red);
 for(const side of [-1,1]){
  framed(group,body.geometry,'breastplate',[[side*.047,1.359],[side*.140,1.378],[side*.184,1.338],[side*.180,1.285],[side*.117,1.242],[side*.047,1.250]],red);
  framed(group,body.geometry,'rib-inset',[[side*.162,1.225],[side*.184,1.237],[side*.169,1.133],[side*.143,1.100],[side*.148,1.180]],gold);
  for(let rib=0;rib<3;rib++){const y=1.174-rib*.030;panel(group,body.geometry,'rib-flex-joint',[[side*.125,y],[side*.168,y+.004],[side*.165,y-.004],[side*.125,y-.008]],dark,.003);}
  const leg=root.getObjectByName(side<0?'leftLeg':'rightLeg') as THREE.Group,skin=leg.getObjectByName('anatomy-Skin') as THREE.Mesh,cx=(side<0?-.105:.105)-leg.position.x,cy=leg.position.y;
  // Compact contoured cuisses end above the knee; the underlying gold suit remains visible.
  framed(leg,skin.geometry,'thigh-shell',[[cx-.060,.800-cy],[cx+.060,.800-cy],[cx+.052,.640-cy],[cx+.023,.580-cy],[cx-.033,.600-cy],[cx-.056,.660-cy]],red);
  panel(leg,skin.geometry,'thigh-inset',[[cx-.028,.766-cy],[cx+.030,.766-cy],[cx+.026,.658-cy],[cx,.622-cy],[cx-.025,.654-cy]],gold,.011);
 }
 for(let row=0;row<4;row++){
  const y=1.203-row*.054,w=.126-row*.006;
  framed(group,body.geometry,'abdominal-segment',[[-w,y],[w,y],[w*.85,y-.030],[0,y-.039],[-w*.85,y-.030]],red);
 }
 const neck=art.cylinder(group,.071,.085,.065,dark,0,1.48,0);neck.name='sealed-neck-collar';for(const y of [1.462,1.481,1.50]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.077,.003,6,32),gold);ring.rotation.x=Math.PI/2;ring.position.set(0,y,0);group.add(ring);}
 const reactorY=1.282,front=frontSurfaceZ(body.geometry,0,reactorY),ring=(r:number,t:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,48),m);mesh.position.set(0,reactorY,z);group.add(mesh);return mesh;};
 ring(.039,.005,front-.012,dark).name='reactor-housing';ring(.034,.0025,front-.016,gold);
 const glow=art.material('#e1faff',{emissive:'#89e6ff',emissiveIntensity:1.7,toneMapped:false}),disc=new THREE.Mesh(new THREE.CircleGeometry(.030,48),glow);disc.rotation.y=Math.PI;disc.position.set(0,reactorY,front-.019);disc.name='arc-reactor';group.add(disc);
 panel(group,body.geometry,'back-reactor-cover',[[-.115,1.38],[.115,1.38],[.123,1.20],[.075,1.16],[-.075,1.16],[-.123,1.20]],red,.006,true);
 for(const side of [-1,1])for(let i=0;i<4;i++){const y=1.35-i*.025;panel(group,body.geometry,'back-exhaust',[[side*.045,y],[side*.101,y],[side*.101,y-.006],[side*.045,y-.006]],dark,.009,true);}
}
