import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {equipmentModel} from './weapon-models';
import {buildDust} from './dust-world';
import {buildDepot} from './depot-world';
import {naturalSand} from './sand-material';
import {indexStaticMesh} from './static-mesh-index';
import {type MapId,type Equipment,type AvatarId} from '@sirocco/shared';
export function disposeGroup(group:THREE.Object3D){group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line)o.geometry.dispose();});group.removeFromParent();}
export class WorldArt {
  materials:THREE.Material[]=[];textures:THREE.Texture[]=[];
  stone:THREE.MeshStandardMaterial;sand:THREE.MeshStandardMaterial;trim:THREE.MeshStandardMaterial;wood:THREE.MeshStandardMaterial;metal:THREE.MeshStandardMaterial;dark:THREE.MeshStandardMaterial;plaster:THREE.MeshStandardMaterial;paving:THREE.MeshStandardMaterial;timber:THREE.MeshStandardMaterial;asphalt:THREE.MeshStandardMaterial;
  constructor(renderer:THREE.WebGLRenderer,{terrain=true}:{terrain?:boolean}={}){
    const load=(name:string,color=false)=>{if(!terrain)return null;const t=new THREE.TextureLoader().load(`/textures/${name}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);return t;};
    this.stone=this.material('#ddc6a3',{map:load('stone-color',true),normalMap:load('stone-normal'),roughnessMap:load('stone-rough'),normalScale:new THREE.Vector2(.6,.6)});
    this.sand=naturalSand(this.material('#c6b591',{map:load('sand-color',true),normalMap:load('sand-normal'),roughness:.96,normalScale:new THREE.Vector2(.24,.24)}));
    this.plaster=this.material('#f4eee0',{map:load('plaster-color',true),normalMap:load('plaster-normal'),roughnessMap:load('plaster-rough'),normalScale:new THREE.Vector2(.5,.5)});
    this.paving=this.material('#d2c8b4',{map:load('paving-color',true),normalMap:load('paving-normal'),roughnessMap:load('paving-rough'),normalScale:new THREE.Vector2(.45,.45)});
    this.timber=this.material('#a48a68',{map:load('timber-color',true),normalMap:load('timber-normal'),roughnessMap:load('timber-rough'),normalScale:new THREE.Vector2(.35,.35)});
    this.asphalt=this.material('#bcb9ae',{map:load('asphalt-color',true),normalMap:load('asphalt-normal'),roughnessMap:load('asphalt-rough'),normalScale:new THREE.Vector2(.3,.3)});
    this.trim=this.material('#d3c0a0');this.metal=this.material('#424b4b',{roughness:.38,metalness:.7});this.dark=this.material('#4e534c');
    const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#81704e';ctx.fillRect(0,0,256,256);for(let i=0;i<240;i++){ctx.strokeStyle=`rgba(25,20,12,${.02+(i%5)*.02})`;ctx.beginPath();ctx.moveTo(i*1.17,0);ctx.bezierCurveTo(i*1.17-7,80,i*1.17+10,170,i*1.17,256);ctx.stroke();}for(let x=0;x<256;x+=64){ctx.fillStyle='#3b302b';ctx.fillRect(x,0,2,256);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;this.textures.push(t);this.wood=this.material('#a18b65',{map:t,roughness:.86});
  }
  material(color:string,options:THREE.MeshStandardMaterialParameters={}){const m=new THREE.MeshStandardMaterial({color,roughness:.88,...options});this.materials.push(m);return m;}
  box(parent:THREE.Object3D,w:number,h:number,d:number,material:THREE.Material,x:number,y:number,z:number,tiled=false){
    const geo=new THREE.BoxGeometry(w,h,d);if(tiled){const pos=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,(nx>.5?pos.getZ(i)+z:pos.getX(i)+x)/2.5,(ny>.5?pos.getZ(i)+z:pos.getY(i)+y)/2.5);}}
    const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  cylinder(parent:THREE.Object3D,top:number,bottom:number,h:number,mat:THREE.Material,x:number,y:number,z:number){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,12),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  sign(parent:THREE.Object3D,text:string,x:number,y:number,z:number,rotation=0,color='#3a615d',width=3.6){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#e5d7b7';ctx.lineWidth=3;ctx.strokeRect(9,9,494,110);ctx.fillStyle='#e9e2cb';ctx.font=text.length<=4?'bold 86px sans-serif':'bold 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;this.textures.push(texture);const m=this.material('#ffffff',{map:texture,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,.9),m);mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);}
  build(mapId:MapId){
    if(mapId==='dunes')return this.batch(buildDust(this));
    return this.batch(buildDepot(this));
  }

  private batch(root:THREE.Group){
    // Bake static scenery by material to keep detailed maps cheap to draw.
    root.updateMatrixWorld(true);const batches=new Map<string,{material:THREE.Material;cast:boolean;receive:boolean;geometries:THREE.BufferGeometry[]}>();const originals:THREE.Mesh[]=[];
    root.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if((o.material as THREE.MeshStandardMaterial).vertexColors&&!geometry.attributes.color){const colors=new Float32Array(geometry.attributes.position.count*3).fill(1);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));}const key=`${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;const batch=batches.get(key)??{material:o.material,cast:o.castShadow,receive:o.receiveShadow,geometries:[] as THREE.BufferGeometry[]};batch.geometries.push(geometry);batches.set(key,batch);originals.push(o);}});
    for(const mesh of originals){mesh.removeFromParent();mesh.geometry.dispose();}
    for(const {material,cast,receive,geometries} of batches.values()){const merged=mergeGeometries(geometries);for(const geometry of geometries)geometry.dispose();if(merged){const mesh=new THREE.Mesh(merged,material);mesh.castShadow=cast;mesh.receiveShadow=receive;root.add(mesh);}}
    root.traverse(o=>{if(o instanceof THREE.Mesh)indexStaticMesh(o);});return root;
  }
  weapon(kind:Equipment,viewmodel=true,heldByAvatar=false,avatar:AvatarId='operator'){return equipmentModel(this,kind,viewmodel,heldByAvatar,avatar);}
  destroy(){for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();}
}
