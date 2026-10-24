import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {WorldArt} from './world';
export function ironArmor(root:THREE.Group,art:WorldArt,red:THREE.Material,gold:THREE.Material,dark:THREE.Material){
 const group=new THREE.Group();group.name='ironManArmor';root.add(group);
 const panel=(parent:THREE.Object3D,name:string,points:number[][],z:number,material:THREE.Material,depth=.018)=>{const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:2}),positions=geometry.attributes.position;const cx=points.reduce((sum,p)=>sum+p[0],0)/points.length;for(let i=0;i<positions.count;i++){const x=positions.getX(i);if(name==='thigh-shell'||name==='shin-shell')positions.setZ(i,positions.getZ(i)+Math.pow(Math.abs(x-cx)/.075,1.6)*.045);if(name==='breastplate')positions.setZ(i,positions.getZ(i)+Math.pow(Math.abs(x)/.22,1.6)*.045);}if(name==='thigh-shell'||name==='shin-shell'){
   const skin=parent.children.find(o=>o.name==='anatomy-Skin') as THREE.Mesh|undefined,skinPos=skin?.geometry.attributes.position;
   if(skinPos)for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i);let nearest=Infinity,front=Infinity,fallback=0;for(let j=0;j<skinPos.count;j++){const d=(skinPos.getX(j)-x)**2+(skinPos.getY(j)-y)**2;if(d<nearest){nearest=d;fallback=skinPos.getZ(j);}if(d<.025**2)front=Math.min(front,skinPos.getZ(j));}positions.setZ(i,(Number.isFinite(front)?front:fallback)-.014+Math.min(depth,Math.max(0,positions.getZ(i))));}
   z=0;
  }
  geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.z=z;parent.add(mesh);return mesh;};
 const box=(parent:THREE.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.018,w/6,h/6,d/6)),m);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 panel(group,'collar-carapace',[[-.18,1.43],[-.075,1.475],[.075,1.475],[.18,1.43],[.16,1.389],[-.16,1.389]],-.115,red,.12);
 for(const side of [-1,1]){
  panel(group,'breastplate',[[side*.025,1.365],[side*.155,1.38],[side*.213,1.323],[side*.18,1.248],[side*.075,1.231],[side*.025,1.26]],-.199,red);
  panel(group,'rib-inset',[[side*.174,1.23],[side*.204,1.27],[side*.171,1.10],[side*.119,1.04],[side*.124,1.16]],-.14,gold,.014);
  const shoulder=new THREE.Mesh(new THREE.SphereGeometry(1,28,20,0,Math.PI*2,0,Math.PI*.67),red);shoulder.name='shoulder-shell';shoulder.scale.set(.105,.108,.132);shoulder.position.set(side*.278,1.352,.007);shoulder.rotation.z=-side*.15;group.add(shoulder);
  box(group,'clavicle-lock',.11,.027,.07,side*.13,1.389,-.085,dark);
  panel(group,'hip-plate',[[side*.065,.965],[side*.178,.973],[side*.19,.88],[side*.13,.865],[side*.063,.91]],-.13,red);
  for(let rib=0;rib<3;rib++)box(group,'rib-flex-joint',.075,.013,.04,side*.146,1.165-rib*.035,-.143,dark);
  const leg=root.getObjectByName(side<0?'leftLeg':'rightLeg') as THREE.Group;
  const cx=(side<0?-.105:.105)-leg.position.x,cy=leg.position.y;
  panel(leg,'thigh-shell',[[cx-.075,.82-cy],[cx+.075,.82-cy],[cx+.062,.56-cy],[cx,.51-cy],[cx-.065,.57-cy]],-.112,gold);
  box(leg,'knee-shell',.145,.108,.095,cx,.48-cy,-.088,red);
  panel(leg,'shin-shell',[[cx-.064,.415-cy],[cx+.064,.415-cy],[cx+.056,.195-cy],[cx-.05,.195-cy]],-.115,red,.024);
 }
 for(let row=0;row<4;row++)panel(group,'abdominal-segment',[[-.10,1.20-row*.055],[.10,1.20-row*.055],[.083,1.164-row*.055],[0,1.153-row*.055],[-.083,1.164-row*.055]],-.17,red,.021);
 const neck=art.cylinder(group,.071,.085,.065,dark,0,1.48,0);neck.name='sealed-neck-collar';for(const y of [1.462,1.481,1.50]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.077,.004,6,32),gold);ring.rotation.x=Math.PI/2;ring.position.set(0,y,0);group.add(ring);}
 const ring=(r:number,t:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,48),m);mesh.position.set(0,1.282,z);group.add(mesh);return mesh;};
 ring(.051,.008,-.224,dark).name='reactor-housing';ring(.044,.0035,-.234,gold);
 const glow=art.material('#e1faff',{emissive:'#89e6ff',emissiveIntensity:1.7,toneMapped:false});
 const disc=new THREE.Mesh(new THREE.CircleGeometry(.038,48),glow);disc.rotation.y=Math.PI;disc.position.set(0,1.282,-.237);disc.name='arc-reactor';group.add(disc);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;box(group,'reactor-retainer',.006,.012,.006,Math.cos(a)*.043,1.282+Math.sin(a)*.043,-.239,gold);}
 box(group,'back-reactor-cover',.23,.24,.065,0,1.265,.12,red);for(const side of [-1,1])for(let i=0;i<4;i++)box(group,'back-exhaust',.07,.012,.035,side*.105,1.35-i*.025,.157,dark);
}
