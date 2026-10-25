import * as THREE from 'three';
import type {AvatarId} from '@sirocco/shared';
import {suitFoot} from './suit-foot';
import {cutGeometryY} from './costume-geometry';
import {fitWonderWomanTorso,fitWonderWomanFace,wonderWomanComplexion,fitWonderWomanHair} from './wonder-woman-proportions';
import source from './character-anatomy-data.json';
import type {WorldArt} from './world';
type MeshData={part:string;role:string;position:string;normal:string;uv:string;index:string};
const anatomy=source as {hands:Record<string,Record<string,MeshData>>;variants:Record<string,MeshData[]>;hair:Record<string,Record<string,{meshes:MeshData[];textures:{name:string;texture:string|null}[]}>>};
const listeners=new Set<()=>void>();
export function onCharacterTextureReady(callback:()=>void){listeners.add(callback);return()=>{listeners.delete(callback);};}
function bytes(base64:string){const s=atob(base64),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b;}
export function anatomyGeometry(data:MeshData){const g=new THREE.BufferGeometry(),p=new Int16Array(bytes(data.position).buffer),position=Float32Array.from(p,n=>n/10000);g.setAttribute('position',new THREE.BufferAttribute(position,3));g.setAttribute('normal',new THREE.BufferAttribute(Float32Array.from(new Int8Array(bytes(data.normal).buffer),n=>n/127),3));g.setAttribute('uv',new THREE.BufferAttribute(Float32Array.from(new Uint16Array(bytes(data.uv).buffer),n=>n/65535),2));g.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(data.index).buffer),1));return g;}
const textureCaches=new WeakMap<WorldArt,Map<string,THREE.Texture>>();
function texture(art:WorldArt,file:string,color=true){let cache=textureCaches.get(art);if(!cache){cache=new Map();textureCaches.set(art,cache);}let t=cache.get(file);if(t)return t;t=new THREE.TextureLoader().load('/models/characters/'+file,()=>listeners.forEach(f=>f()));if(color)t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.anisotropy=4;art.textures.push(t);cache.set(file,t);return t;}
export function addRealAnatomy(root:THREE.Group,art:WorldArt,id:AvatarId,materials:THREE.MeshStandardMaterial[]){
 const female=id==='wonder-woman'||id==='black-widow',sex=female?'female':'male',variant=id==='hulk'?'heavy':sex,unmasked=['thor','wonder-woman','black-widow','hulk'].includes(id),partial=id==='batman'||id==='captain-america',hasFace=unmasked||partial,[main,accent,dark,,black,white]=materials;
 const skin=hasFace?art.material(id==='hulk'?'#7d9e69':'#e6bfa7',{map:texture(art,'human-skin_albedo.jpg'),normalMap:texture(art,'human-skin_normal.jpg',false),normalScale:new THREE.Vector2(.45,.45),roughness:id==='wonder-woman'?.64:.55,vertexColors:id==='wonder-woman'}):materials[3];
 const eyes=hasFace?art.material('#eef1ec',{map:texture(art,'human-eye.jpg'),roughness:.18}):black;
 const brow=hasFace?art.material(id==='thor'?'#8c704d':'#38291f',{map:texture(art,'human-eyebrow.png'),alphaTest:id==='wonder-woman'?.4:.3,side:THREE.DoubleSide,roughness:.9}):black;
 const lash=hasFace?art.material('#251e1b',{map:texture(art,'human-eyelash.png'),alphaTest:.35,side:THREE.DoubleSide,roughness:.85}):black;
 const groups=new Map<string,THREE.Group>();for(const name of ['leftLeg','rightLeg','unarmedLeftArm','unarmedRightArm']){const group=new THREE.Group();group.name=name;if(name.endsWith('Leg'))group.position.set(name==='leftLeg'?-.10:.10,.91,0);groups.set(name,group);root.add(group);}
 for(const data of anatomy.variants[variant]){
  if(data.role!=='Skin'&&!hasFace)continue;
  if(['Tongue','Teeth','Cornea'].includes(data.role))continue;
  let g=anatomyGeometry(data);if(id==='wonder-woman'&&data.role==='Eyebrow'){const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),arch=Math.exp(-(((Math.abs(x)-.045)/.022)**2));p.setY(i,1.702+(y-1.702)*.72+.0015*arch);}}if(data.part.endsWith('Leg')&&data.role==='Skin'){const p=g.attributes.position,xs:number[]=[],zs:number[]=[];for(let i=0;i<p.count;i++)if(p.getY(i)<.15){xs.push(p.getX(i));zs.push(p.getZ(i));}root.userData.feet??={};root.userData.feet[data.part]={x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2};if(id==='ultraman'||id==='wonder-woman')g=suitFoot(g);if(!['hulk','groot','ultraman','wonder-woman'].includes(id))g=cutGeometryY(g,.17);}if((unmasked||partial)&&data.role==='Skin'&&data.part==='body')g=cutGeometryY(g,partial?1.635:1.51);if(id==='wonder-woman'&&data.role==='Skin')for(const y of [.46,.475,.815,1.035,1.36,1.51])g=cutGeometryY(g,y);if(id==='ironman'&&data.role==='Skin')for(const y of [.46,.72,1.03,1.15,1.49])g=cutGeometryY(g,y);if(id==='ultraman'&&data.role==='Skin'){for(const y of [.39,.48,.62,1.04,1.18,1.21,1.25,1.43,1.49])g=cutGeometryY(g,y);g.rotateZ(Math.PI/2);for(const x of [-.18,-.07,-.02,.02,.07,.18])g=cutGeometryY(g,x);g.rotateZ(-Math.PI/2);}if(id==='spiderman'&&data.role==='Skin')for(const y of [.38,1.07,1.10,1.30])g=cutGeometryY(g,y);const pos=g.attributes.position;
  if(id==='wonder-woman'){fitWonderWomanFace(g);if(data.role==='Skin'){if(data.part==='body')fitWonderWomanTorso(g);wonderWomanComplexion(g);}}
  // Smooth the fitted suit at the pelvis; it is clothing, rather than exposed anatomy.
  if(id!=='groot')for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);if(y>.76&&y<1.01&&Math.abs(x)<.10&&z<-.085)pos.setZ(i,Math.max(z,-.103));}
  if(id==='hulk')for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setX(i,pos.getX(i)*(y>1.05?1.22:1.08));}
  if(id==='groot')for(let i=0;i<pos.count;i++){const y=pos.getY(i);if(y>1.53&&y<1.74&&pos.getZ(i)<-.13)pos.setZ(i,-.14);}
  let mats:THREE.Material[]=data.role==='Skin'?[main,accent,dark,skin,black,white]:[data.role==='Eyebrow'?brow:data.role==='Eyelash'?lash:eyes];
  if(data.role==='Skin'){
   const sections=new Map<number,number[]>(),index=g.index!;
   for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=tri.reduce((n,v)=>n+pos.getX(v),0)/3,y=tri.reduce((n,v)=>n+pos.getY(v),0)/3,z=tri.reduce((n,v)=>n+pos.getZ(v),0)/3;let slot=0;
    if((id==='ironman'||id==='ultraman')&&y>1.49||data.part.endsWith('Leg')&&y<.17&&!['hulk','groot','ultraman','wonder-woman'].includes(id))continue;
    if(unmasked&&y>=1.51||partial&&y>1.52&&y<1.635&&z<-.07)slot=3;
    if((id==='wonder-woman'||id==='thor')&&data.part.includes('Arm'))slot=3;
    if(y<.18&&!['hulk','groot'].includes(id))slot=4;
    if(id==='hulk')slot=y>.68&&y<.99?2:3;
    if(id==='captain-america'){if(y>.92&&y<1.15&&z<-.04)slot=Math.floor((x+.3)*26)%2?5:2;if(data.part.includes('Arm')&&y<1.03)slot=2;}
    if(id==='spiderman'){if(y<1.07&&y>.38)slot=1;if(Math.abs(x)>.14&&y>1.10&&y<1.30)slot=1;}
    if(id==='deadpool'&&Math.abs(x)>.14&&y>.94&&y<1.32)slot=2;
    if(id==='black-widow'&&Math.abs(x)<.012&&y>1.02&&y<1.40&&z<0)slot=1;
    if(id==='ironman'&&data.part.endsWith('Leg')&&y>.46&&y<.72)slot=1;
    if(id==='ironman'&&data.part.includes('Arm'))slot=y>1.21&&y<1.30?1:0;
    if(id==='wonder-woman'){
     slot=data.part.includes('Arm')||y>1.36||data.part.endsWith('Leg')&&y>.475?3:y>.815&&y<1.035?2:y>=.46&&y<=.475?1:0;
    }
    if(id==='ultraman'){
     const chest=y>1.21&&y<1.43&&Math.abs(x)<.18&&(Math.abs(x)<.02||Math.abs(x)>.07);
     const chestRim=y>1.18&&y<=1.25&&Math.abs(x)<.16;
     const shorts=y>.62&&y<1.04;
     const kneeStripe=y>.39&&y<.48;
     const armStripe=data.part.includes('Arm')&&y>1.06&&y<1.30;
     slot=chest||chestRim||shorts||kneeStripe||armStripe||y>1.43?1:0;
    }
    const list=sections.get(slot)??[];list.push(...tri);sections.set(slot,list);
   }
   const sorted:number[]=[];for(const [slot,index]of sections){g.addGroup(sorted.length,index.length,slot);sorted.push(...index);}g.setIndex(sorted);
  }
  const mesh=new THREE.Mesh(g,data.role==='Skin'?mats:mats[0]);mesh.name='anatomy-'+data.role;mesh.castShadow=mesh.receiveShadow=true;const parent=groups.get(data.part)??root;if(parent!==root)g.translate(-parent.position.x,-parent.position.y,-parent.position.z);parent.add(mesh);
 }
 if(id==='thor'){
  const data=anatomy.variants.male.find(m=>m.role==='Skin'&&m.part==='body')!,geo=anatomyGeometry(data),p=geo.attributes.position,n=geo.attributes.normal,idx=geo.index!,lines:number[]=[];
  for(let i=0;i<idx.count;i+=3){const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)],x=ids.reduce((s,j)=>s+p.getX(j),0)/3,y=ids.reduce((s,j)=>s+p.getY(j),0)/3,z=ids.reduce((s,j)=>s+p.getZ(j),0)/3;
   if(y<1.535||y>1.655||z>-.10||Math.abs(x)>.105||Math.abs(x)<.035&&y>1.565&&y<1.615)continue;
   for(let k=0;k<3;k++){const a=((k*37+i*13)%97)/97,b=((k*19+i*7)%89)/89*(1-a),c=1-a-b,v=new THREE.Vector3(),normal=new THREE.Vector3();ids.forEach((j,t)=>{v.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,j),[a,b,c][t]);normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(n,j),[a,b,c][t]);});normal.normalize();v.addScaledVector(normal,.0008);lines.push(v.x,v.y,v.z,v.x+normal.x*.0015,v.y-.002,v.z+normal.z*.0015);}
  }
  const strands=new THREE.BufferGeometry();strands.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));const material=new THREE.LineBasicMaterial({color:'#6a4d31',transparent:true,opacity:.28});art.materials.push(material);root.add(new THREE.LineSegments(strands,material));geo.dispose();
 }
 if(unmasked){const style=id==='black-widow'?'bob02':id==='hulk'?'short02':'long01',hairData=anatomy.hair[style][sex],file=hairData.textures[0].texture!;const hair=art.material(id==='thor'?'#b59c6c':id==='black-widow'?'#783823':'#28251f',{map:texture(art,file),alphaTest:.38,side:THREE.DoubleSide,roughness:.74});for(const data of hairData.meshes){const geometry=anatomyGeometry(data);if(id==='wonder-woman')fitWonderWomanHair(geometry);const mesh=new THREE.Mesh(geometry,hair);mesh.name='texturedHair';mesh.castShadow=true;root.add(mesh);}}
 root.userData.realAnatomy=true;
}

export function realHandGeometry(id:AvatarId,left:boolean,open:boolean){const sex=id==='wonder-woman'||id==='black-widow'?'female':'male';return anatomyGeometry(anatomy.hands[sex][(left?'l':'r')+(open?'Open':'Closed')]);}

export function anatomicalSkinTextures(art:WorldArt){return {map:texture(art,'human-skin_albedo.jpg'),normalMap:texture(art,'human-skin_normal.jpg',false),normalScale:new THREE.Vector2(.45,.45)};}
