import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {equipmentModel} from './weapon-models';
import {buildDust} from './dust-world';
import {MAPS,type MapId,type Equipment} from '@sirocco/shared';
export function disposeGroup(group:THREE.Object3D){group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line)o.geometry.dispose();});group.removeFromParent();}
export class WorldArt {
  materials:THREE.Material[]=[];textures:THREE.Texture[]=[];
  stone:THREE.MeshStandardMaterial;sand:THREE.MeshStandardMaterial;trim:THREE.MeshStandardMaterial;wood:THREE.MeshStandardMaterial;metal:THREE.MeshStandardMaterial;dark:THREE.MeshStandardMaterial;
  constructor(renderer:THREE.WebGLRenderer){
    const load=(name:string,color=false)=>{const t=new THREE.TextureLoader().load(`/textures/${name}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);return t;};
    this.stone=this.material('#ddc6a3',{map:load('stone-color',true),normalMap:load('stone-normal'),roughnessMap:load('stone-rough'),normalScale:new THREE.Vector2(.6,.6)});
    this.sand=this.material('#c6b591',{map:load('sand-color',true),normalMap:load('sand-normal'),roughnessMap:load('sand-rough'),normalScale:new THREE.Vector2(.55,.55)});
    this.trim=this.material('#d3c0a0');this.metal=this.material('#424b4b',{roughness:.38,metalness:.7});this.dark=this.material('#4e534c');
    const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#81704e';ctx.fillRect(0,0,256,256);for(let i=0;i<240;i++){ctx.strokeStyle=`rgba(25,20,12,${.02+(i%5)*.02})`;ctx.beginPath();ctx.moveTo(i*1.17,0);ctx.bezierCurveTo(i*1.17-7,80,i*1.17+10,170,i*1.17,256);ctx.stroke();}for(let x=0;x<256;x+=64){ctx.fillStyle='#3b302b';ctx.fillRect(x,0,2,256);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;this.textures.push(t);this.wood=this.material('#a18b65',{map:t,roughness:.86});
  }
  material(color:string,options:THREE.MeshStandardMaterialParameters={}){const m=new THREE.MeshStandardMaterial({color,roughness:.88,...options});this.materials.push(m);return m;}
  box(parent:THREE.Object3D,w:number,h:number,d:number,material:THREE.Material,x:number,y:number,z:number,tiled=false){
    const geo=new THREE.BoxGeometry(w,h,d);if(tiled){const pos=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,(nx>.5?pos.getZ(i)+z:pos.getX(i)+x)/2.5,(ny>.5?pos.getZ(i)+z:pos.getY(i)+y)/2.5);}}
    const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  cylinder(parent:THREE.Object3D,top:number,bottom:number,h:number,mat:THREE.Material,x:number,y:number,z:number){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,12),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  sign(parent:THREE.Object3D,text:string,x:number,y:number,z:number,rotation=0,color='#3a615d',width=3.6){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#e5d7b7';ctx.lineWidth=3;ctx.strokeRect(9,9,494,110);ctx.fillStyle='#e9e2cb';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,79);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;this.textures.push(texture);const m=this.material('#ffffff',{map:texture});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,.9),m);mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);}
  build(mapId:MapId){
    if(mapId==='dunes')return this.batch(buildDust(this));
    const root=new THREE.Group(),map=MAPS[mapId];this.box(root,180,.2,180,this.sand,0,-.1,0,true);
    for(const b of map.solids){
      this.box(root,b.w,b.h,b.d,b.kind==='crate'?this.wood:this.stone,b.x,b.y,b.z,true);
      if(b.kind==='crate'){
        for(const y of [-b.h/2+.15,b.h/2-.15])this.box(root,b.w+.035,.12,b.d+.035,this.metal,b.x,b.y+y,b.z);
        for(const x of [-b.w/2+.16,b.w/2-.16])this.box(root,.1,b.h,b.d+.04,this.metal,b.x+x,b.y,b.z);
      }else if(b.kind==='wall'){
        this.box(root,b.w+.12,.18,b.d+.12,this.trim,b.x,b.y+b.h/2-.14,b.z);this.box(root,b.w+.02,.3,b.d+.02,this.dark,b.x,.15,b.z);
        if(b.w>7&&b.d>6){
          for(const side of [-1,1])for(let x=-b.w/2+1.3;x<b.w/2-1;x+=2.7){
            const z=b.z+side*(b.d/2+.03);this.box(root,.85,1.25,.1,this.dark,b.x+x,2.65,z);this.box(root,1.1,.12,.38,this.trim,b.x+x,2,z);
            for(let k=0;k<7;k++)this.box(root,.78,.055,.13,this.wood,b.x+x,2.18+k*.15,z+side*.04);
            this.box(root,.08,1.35,.2,this.trim,b.x+x-.48,2.65,z);this.box(root,.08,1.35,.2,this.trim,b.x+x+.48,2.65,z);
          }
          // Exposed brick courses, roof cistern and antenna, all above reachable cover.
          const roof=b.y+b.h/2;this.box(root,b.w*.65,.35,b.d*.55,this.stone,b.x,roof+.17,b.z,true);
          this.cylinder(root,.75,.75,1.15,this.dark,b.x+1,roof+.7,b.z-1);
          this.cylinder(root,.025,.025,2.8,this.metal,b.x-1,roof+1.4,b.z);this.box(root,1.5,.025,.025,this.metal,b.x-1,roof+2.3,b.z);
          for(let k=0;k<5;k++)this.box(root,.6,.16,.03,this.wood,b.x-b.w/2+.5+k*.6,.65+(k%2)*.16,b.z+b.d/2+.04);
        }
      }
    }
    for(const p of map.pickups){this.box(root,1.2,.18,.7,this.dark,p.x,.09,p.z);this.box(root,1.24,.03,.74,this.metal,p.x,.2,p.z);}
    // Brick arch ribs: the actual horizontal tunnel roof is in shared collision geometry.
    const archMat=this.trim;for(const z of [-8,-2,4]){const arch=new THREE.Mesh(new THREE.TorusGeometry(3.15,.16,8,24,Math.PI),archMat);arch.position.set(-25,1,z);root.add(arch);}
    this.sign(root,map.name.toUpperCase(),0,3,-23.43);
    this.sign(root,'WEST / TUNNELS',-29.43,2,-2,Math.PI/2,'#876c48');
    this.sign(root,'01  /  RED',-24,1.4,23.43,Math.PI,'#995b45');this.sign(root,'02  /  BLUE',23,1.4,-23.43,0,'#3c6875');
    const brick=this.material('#9d7c59');
    for(let i=0;i<14;i++){const x=-60+i*9,z=-39-(i%3)*7,h=7+i%5*2;this.box(root,7,h,7,this.stone,x,h/2,z,true);this.box(root,7.2,.25,7.2,this.trim,x,h,z);for(let j=0;j<3;j++)this.box(root,.6,1,.05,this.dark,x-2+j*2,h-2,z+3.53);}
    // Distant minaret and detailed palm silhouettes, no copied game assets.
    this.cylinder(root,1.6,2,19,this.stone,-38,9.5,-26);this.cylinder(root,2.2,2.2,.5,this.trim,-38,17,-26);const dome=new THREE.Mesh(new THREE.SphereGeometry(1.7,20,12,0,Math.PI*2,0,Math.PI/2),brick);dome.position.set(-38,19,-26);root.add(dome);
    for(const [x,z] of [[-28,9],[28,-8],[-8,21],[9,-21]])this.palm(root,x,z);
    for(const z of [-9,10]){const pts=[];for(let i=0;i<=24;i++){const t=i/24;pts.push(new THREE.Vector3(-26+t*52,7-Math.sin(t*Math.PI)*1.5,z));}const mat=new THREE.LineBasicMaterial({color:'#3c3933'});this.materials.push(mat);root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat));}
    // Drain grates and worn ground markings provide visual scale at eye level.
    for(const [x,z] of [[0,6],[26,0],[-26,10]]){for(let i=0;i<8;i++)this.box(root,.6,.015,.025,this.metal,x,.012,z+i*.08);}
    return this.batch(root);
  }
  private batch(root:THREE.Group){
    // Bake static scenery by material to keep detailed maps cheap to draw.
    root.updateMatrixWorld(true);const batches=new Map<string,{material:THREE.Material;cast:boolean;receive:boolean;geometries:THREE.BufferGeometry[]}>();const originals:THREE.Mesh[]=[];
    root.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);const key=`${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;const batch=batches.get(key)??{material:o.material,cast:o.castShadow,receive:o.receiveShadow,geometries:[] as THREE.BufferGeometry[]};batch.geometries.push(geometry);batches.set(key,batch);originals.push(o);}});
    for(const mesh of originals){mesh.removeFromParent();mesh.geometry.dispose();}
    for(const {material,cast,receive,geometries} of batches.values()){const merged=mergeGeometries(geometries);for(const geometry of geometries)geometry.dispose();if(merged){const mesh=new THREE.Mesh(merged,material);mesh.castShadow=cast;mesh.receiveShadow=receive;root.add(mesh);}}
    return root;
  }
  private palm(root:THREE.Group,x:number,z:number){const trunk=this.wood,leaf=this.material('#64704b',{side:THREE.DoubleSide});this.cylinder(root,.15,.28,6.7,trunk,x,3.35,z);for(let i=0;i<9;i++){const g=new THREE.Group();g.position.set(x,6.5,z);g.rotation.y=i*Math.PI*2/9;for(let j=0;j<8;j++){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.7-j*.06,.75),leaf);mesh.position.set(0,-j*j*.022,-j*.38);mesh.rotation.x=-Math.PI/2-j*.07;mesh.rotation.z=(j%2?.12:-.12);g.add(mesh);}root.add(g);}}
  weapon(kind:Equipment,viewmodel=true,heldByAvatar=false){return equipmentModel(this,kind,viewmodel,heldByAvatar);}
  destroy(){for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();}
}
