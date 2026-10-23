import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {Solid} from '@sirocco/shared';
import type {WorldArt} from './world';

/** Local door axes come from the actual shared collision polygon, not its AABB. */
export function doorFrame(b:Solid){
 const pts=b.polygon;if(!pts||pts.length!==4)throw new Error('Door requires four collision corners');
 const a=pts[0],c=pts[1],d=pts[3];return {width:Math.hypot(c[0]-a[0],c[1]-a[1]),depth:Math.hypot(d[0]-a[0],d[1]-a[1]),angle:-Math.atan2(c[1]-a[1],c[0]-a[0]),x:b.x,y:b.y,z:b.z};
}
export function weatherWall(geometry:THREE.BufferGeometry,b:Solid,base:number){
 const p=geometry.attributes.position,colors=new Float32Array(p.count*3),roof=b.y+b.h/2;
 let seed=0;for(const c of b.label??'wall')seed=(seed*31+c.charCodeAt(0))>>>0;
 for(let i=0;i<p.count;i++){const height=Math.max(0,p.getY(i)-base),lift=Math.min(1,height/1.6),tone=.80+lift*.20+(seed%11-5)*.006;colors[i*3]=tone;colors[i*3+1]=tone*.985;colors[i*3+2]=tone*(.94+.06*Math.min(1,height/Math.max(1,roof-base)));}
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
export function roundedBox(parent:THREE.Object3D,w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,r=.05){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/5,h/5,d/5)),mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function buildDoor(art:WorldArt,b:Solid,wood:THREE.Material,iron:THREE.Material){
 const frame=doorFrame(b),g=new THREE.Group();g.name=b.label??'Gate';g.position.set(frame.x,frame.y,frame.z);g.rotation.y=frame.angle;
 const count=Math.max(6,Math.round(frame.width/.21)),w=frame.width/count,depth=frame.depth;
 for(let i=0;i<count;i++){
  const x=-frame.width/2+(i+.5)*w;
  const plank=art.box(g,w-.006,b.h,depth-.006,wood,x,0,0);const uv=plank.geometry.attributes.uv;
  for(let j=0;j<uv.count;j++)uv.setXY(j,uv.getY(j)*b.h/3.5,uv.getX(j)*.065+(i%11)*.082+.012);
 }
 const railHeight=.075,railDepth=.025;
 for(const side of [-1,1]){
  for(const y of [-b.h*.36,0,b.h*.36]){
   roundedBox(g,frame.width-.045,railHeight,railDepth,iron,0,y,side*(depth/2+.006),.008);
   for(let i=0;i<count;i++){
    const stud=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),iron);stud.scale.z=.45;stud.position.set(-frame.width/2+(i+.5)*w,y,side*(depth/2+.025));g.add(stud);
   }
  }
  // Hardware is mounted to the timber surface on either side of the open leaf.
  const hingeAtEnd=b.label?.includes('right')||b.label?.includes('inner'),handleX=frame.width*(hingeAtEnd?-.26:.26);
  roundedBox(g,.12,.19,.018,iron,handleX,-.14,side*(depth/2+.012),.012);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.085,.012,8,24),iron);ring.position.set(handleX,-.20,side*(depth/2+.035));g.add(ring);
  for(const y of [-b.h*.36,b.h*.36]){
   const hinge=art.cylinder(g,.027,.027,.16,iron,(hingeAtEnd?1:-1)*(frame.width/2-.025),y,side*(depth/2+.009));hinge.name='gateHinge';
  }
 }
 return g;
}
export function portalTrim(art:WorldArt,root:THREE.Group,b:Solid,stone:THREE.Material,base:number){
 // Trim remains on the sides and faces of the existing structural lintel.
 const g=new THREE.Group();g.position.set(b.x,0,b.z);root.add(g);
 const horizontal=b.w>b.d,width=horizontal?b.w:b.d,depth=horizontal?b.d:b.w,bottom=b.y-b.h/2;
 if(!horizontal)g.rotation.y=Math.PI/2;
 for(const side of [-1,1]){
  roundedBox(g,width+.28,.20,.16,stone,0,bottom+.10,side*(depth/2+.035),.025);
  roundedBox(g,width+.36,.12,.19,stone,0,b.y+b.h/2-.02,side*(depth/2+.035),.02);
  for(const x of [-width/2-.08,width/2+.08]){
   for(let y=base+.3;y<bottom;y+=.55)roundedBox(g,.22,Math.min(.51,bottom-y+.25),.18,stone,x,y,side*(depth/2+.02),.018);
  }
  // Stone joints are shallow relief in the header, not a second false opening.
  for(let row=0;row<Math.floor(b.h/.43);row++){const y=bottom+.22+row*.43;for(let x=-width/2+.23+(row%2)*.24;x<width/2-.1;x+=.49)roundedBox(g,.46,.40,.045,stone,x,y,side*(depth/2+.115),.018);}
 }
}
export function streetLamp(art:WorldArt,parent:THREE.Object3D,x:number,base:number,roof:number,metal:THREE.Material){
 art.cylinder(parent,.018,.018,Math.max(.3,roof-base-.65),metal,x,(roof+base)/2-.2,.025);
 const arm=art.box(parent,.035,.035,.42,metal,x,base+3.45,.18);
 const housing=new THREE.Mesh(new THREE.CylinderGeometry(.10,.18,.10,16),metal);housing.position.set(x,base+3.4,.38);parent.add(housing);
 const glass=new THREE.Mesh(new THREE.CircleGeometry(.145,20),art.trim);glass.rotation.x=Math.PI/2;glass.position.set(x,base+3.345,.38);parent.add(glass);
 return arm;
}
export function palmFrond(material:THREE.Material,length:number){
 const positions:number[]=[],uv:number[]=[];
 for(let i=0;i<12;i++){
  const t=i/12,next=(i+1)/12;const point=(v:number,side:number)=>{const width=Math.sin(v*Math.PI)*.26*(1-v*.45);return [side*width,.22*Math.sin(v*Math.PI)-v*v*.9,-v*length];};
  for(const [v,s] of [[t,-1],[next,-1],[next,1],[t,-1],[next,1],[t,1]]){positions.push(...point(v,s));uv.push((s+1)/2,v);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return new THREE.Mesh(geo,material);
}

const weatherMaterials=new WeakMap<WorldArt,THREE.Material>();
export function wallWear(art:WorldArt,parent:THREE.Group,length:number,base:number,seed:number){
 let stain=weatherMaterials.get(art);
 if(!stain){
  const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'rgba(47,42,32,0)');gradient.addColorStop(.55,'rgba(47,42,32,.025)');gradient.addColorStop(1,'rgba(47,42,32,.21)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  for(let i=0;i<32;i++){const x=i*71%256,h=30+i*43%130;ctx.fillStyle=`rgba(61,51,35,${.015+i%4*.006})`;ctx.fillRect(x,256-h,2+i%4,h);}
  const map=new THREE.CanvasTexture(c);map.wrapS=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;art.textures.push(map);stain=art.material('#fff',{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});weatherMaterials.set(art,stain);
 }
 const geo=new THREE.PlaneGeometry(length,1.9),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*length/4);
 const grime=new THREE.Mesh(geo,stain);grime.position.set(0,base+.95,.009);parent.add(grime);
 if(length<5)return;
 const w=.65+seed%5*.11,h=.32+seed%3*.08,x=-length*.32+(seed%7)*length*.08;
 const shape=new THREE.Shape();shape.moveTo(x-w/2,base+.16);shape.lineTo(x-w*.35,base+h*.6);shape.lineTo(x-w*.17,base+h);shape.lineTo(x+w*.31,base+h*.85);shape.lineTo(x+w/2,base+h*.38);shape.lineTo(x+w*.22,base+.14);shape.closePath();
 const chip=new THREE.Mesh(new THREE.ShapeGeometry(shape),art.stone);chip.position.z=.012;parent.add(chip);
}
export function rooftopDetails(art:WorldArt,parent:THREE.Group,roof:number,stone:THREE.Material,metal:THREE.Material){
 const tank=art.cylinder(parent,.43,.43,.82,stone,-.7,roof+.45,-1.1);tank.name='Roof water tank';art.cylinder(parent,.46,.46,.06,metal,-.7,roof+.88,-1.1);art.box(parent,.045,.45,.045,metal,-1.12,roof+.23,-1.1);
 art.cylinder(parent,.018,.018,2.0,metal,.6,roof+1.1,-1.2);for(const y of [roof+1.65,roof+2])art.box(parent,.95,.018,.018,metal,.6,y,-1.2);
 const dishMat=art.material('#c5bda9',{roughness:.7,side:THREE.DoubleSide}),points=[new THREE.Vector2(0,-.12),new THREE.Vector2(.12,-.108),new THREE.Vector2(.25,-.065),new THREE.Vector2(.4,0)];
 const dish=new THREE.Mesh(new THREE.LatheGeometry(points,24),dishMat);dish.position.set(1.6,roof+.62,-1.1);dish.rotation.x=.9;parent.add(dish);art.cylinder(parent,.025,.025,.5,metal,1.6,roof+.25,-1.1);
}

const contactMaterials=new WeakMap<WorldArt,THREE.Material>();
export function groundContact(art:WorldArt,parent:THREE.Object3D,x:number,y:number,z:number,w:number,d:number){
 let mat=contactMaterials.get(art);if(!mat){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!,gradient=ctx.createRadialGradient(64,64,18,64,64,64);gradient.addColorStop(0,'rgba(22,20,15,.26)');gradient.addColorStop(.58,'rgba(22,20,15,.16)');gradient.addColorStop(1,'rgba(22,20,15,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const map=new THREE.CanvasTexture(c);art.textures.push(map);mat=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});art.materials.push(mat);contactMaterials.set(art,mat);}
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(w+.7,d+.7),mat);shadow.rotation.x=-Math.PI/2;shadow.position.set(x,y+.009,z);parent.add(shadow);
}

/** Mount a plaque on the nearest complete wall edge, keeping both ends supported. */
export function wallSignMount(walls:Solid[],near:{x:number;z:number},width:number){
 let best:{x:number;z:number;rotation:number;wall:Solid;distance:number}|undefined;
 for(const wall of walls){
  const pts=wall.polygon??[[wall.x-wall.w/2,wall.z-wall.d/2],[wall.x+wall.w/2,wall.z-wall.d/2],[wall.x+wall.w/2,wall.z+wall.d/2],[wall.x-wall.w/2,wall.z+wall.d/2]];
  const area=pts.reduce((sum,p,i)=>sum+p[0]*pts[(i+1)%pts.length][1]-pts[(i+1)%pts.length][0]*p[1],0);
  for(let i=0;i<pts.length;i++){
   const a=pts[i],b=pts[(i+1)%pts.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),margin=width/2+.12;
   if(length<margin*2)continue;
   const along=Math.max(margin,Math.min(length-margin,((near.x-a[0])*dx+(near.z-a[1])*dz)/length)),nx=dz/length*Math.sign(area),nz=-dx/length*Math.sign(area);
   const x=a[0]+along*dx/length,z=a[1]+along*dz/length,distance=Math.hypot(near.x-x,near.z-z);
   if(!best||distance<best.distance)best={x:x+nx*.045,z:z+nz*.045,rotation:Math.atan2(nx,nz),wall,distance};
  }
 }
 if(!best)throw new Error('No wall edge wide enough for sign');return best;
}
export const DUST_ROUTE_SIGNS=[
 {u:422,v:695,y:4,text:'← B',wall:'Western central block'},
 {u:550,v:840,y:4.7,text:'A →',wall:'T spawn island'},
 {u:435,v:320,y:2.3,text:'B ←',wall:'Lower tunnels block'},
 {u:850,v:318,y:4.3,text:'A ↑',wall:'Catwalk east block'},
 {u:78,v:238,y:4.3,text:'B',wall:'Perimeter'},
] as const;
