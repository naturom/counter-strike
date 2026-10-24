import * as THREE from 'three';
import type {WorldArt} from './world';
export function ironHelmet(root:THREE.Group,art:WorldArt,red:THREE.Material,gold:THREE.Material,dark:THREE.Material){
 const group=new THREE.Group();group.name='ironManHelmet';root.add(group);
 const helmet=new THREE.Mesh(new THREE.LatheGeometry([[.058,1.50],[.091,1.54],[.12,1.62],[.126,1.70],[.106,1.765],[.066,1.805],[0,1.819]].map(([r,y])=>new THREE.Vector2(r,y)),48),red);helmet.scale.z=1.215;group.add(helmet);
 const rows=[[1.533,.037,-.116],[1.558,.055,-.142],[1.595,.064,-.157],[1.635,.084,-.166],[1.679,.100,-.153],[1.717,.097,-.159],[1.762,.078,-.134],[1.782,.063,-.112]],vertices:number[]=[],uv:number[]=[],indices:number[]=[];
 rows.forEach(([y,r,front],j)=>{for(let i=0;i<=16;i++){const t=i/8-1,x=t*r,z=front+Math.pow(Math.abs(t),1.6)*.045;vertices.push(x,y,z);uv.push(i/16,(y-1.533)/.249);if(j&&i){const a=j*17+i;indices.push(a,a-1,a-18,a,a-18,a-17);}}});
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const mask=new THREE.Mesh(geo,gold);mask.name='sculpted-faceplate';mask.material.side=THREE.DoubleSide;group.add(mask);
 const black=art.material('#10171b',{metalness:.4,roughness:.48}),glow=art.material('#dbf8ff',{emissive:'#8ddfff',emissiveIntensity:1.6,toneMapped:false});
 const facet=(name:string,points:number[][],material:THREE.Material)=>{const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ShapeGeometry(shape);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,-.168+Math.pow(Math.abs(p.getX(i))/.105,1.6)*.033);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.material.side=THREE.DoubleSide;mesh.name=name;group.add(mesh);return mesh;};
 for(const side of [-1,1]){
  facet('recessed-eye-socket',[[side*.016,1.697],[side*.088,1.708],[side*.087,1.685],[side*.025,1.679]],black);
  const lens=facet('repulsor-eye',[[side*.023,1.694],[side*.082,1.700],[side*.080,1.694],[side*.028,1.689]],glow);lens.position.z=-.0015;
  const cheek=facet('angular-cheek',[[side*.091,1.671],[side*.115,1.657],[side*.099,1.579],[side*.051,1.528],[side*.064,1.588]],red),cp=cheek.geometry.attributes.position;
  for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i),r=y>1.62?.125:y>1.56?.110:.083;cp.setZ(i,-Math.sqrt(Math.max(.0001,r*r-x*x))*1.215-.003);}cheek.geometry.computeVertexNormals();
  const temple=new THREE.Mesh(new THREE.CylinderGeometry(.030,.030,.018,32),gold);temple.rotation.z=Math.PI/2;temple.position.set(side*.12,1.658,.008);group.add(temple);
  const inset=new THREE.Mesh(new THREE.CylinderGeometry(.020,.020,.020,24),black);inset.rotation.z=Math.PI/2;inset.position.copy(temple.position);group.add(inset);

 }
 const mouth=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.040,1.566,-.134),new THREE.Vector3(-.024,1.568,-.150),new THREE.Vector3(0,1.568,-.155),new THREE.Vector3(.024,1.568,-.150),new THREE.Vector3(.040,1.566,-.134)]),24,.0016,5,false),black);mouth.name='mouth-vent';group.add(mouth);
 const chin=facet('chin-lock',[[-.035,1.546],[.035,1.546],[.028,1.533],[-.028,1.533]],red);chin.position.z=.028;

}
export function spiderLenses(root:THREE.Group,black:THREE.Material,white:THREE.Material){
 for(const side of [-1,1])for(const [scale,material,z]of [[1.12,black,-.166],[1,white,-.170]] as [number,THREE.Material,number][]){
  const shape=new THREE.Shape();shape.moveTo(.015,1.688);shape.quadraticCurveTo(.050,1.704,.100,1.718);shape.quadraticCurveTo(.091,1.664,.055,1.655);shape.quadraticCurveTo(.029,1.655,.015,1.688);
  const g=new THREE.ShapeGeometry(shape,16),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=(p.getX(i)-.056)*scale+.056,y=(p.getY(i)-1.685)*scale+1.685;p.setXYZ(i,side*x,y,z+Math.pow(x/.115,2)*.045);}if(side<0){const idx=g.index!;for(let i=0;i<idx.count;i+=3){const a=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,a);}}g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.material.side=THREE.DoubleSide;root.add(mesh);
 }
}
