import * as THREE from 'three';
import {DEPOT,DEPOT_CATWALK,type Solid} from '@sirocco/shared';
import type {WorldArt} from './world';
import {visibleSolidGeometry} from './map-geometry';
import {naturalSand} from './sand-material';
import {roundedBox} from './environment-details';

/** A small, purpose-built industrial arena. Every large obstacle comes from shared collision. */
export function buildDepot(art:WorldArt){
 const root=new THREE.Group();root.name='Depot';
 const concrete=art.material('#9eaaa9',{map:art.plaster.map,normalMap:art.plaster.normalMap,normalScale:new THREE.Vector2(.22,.22),roughness:.95});
 const road=naturalSand(art.material('#939c9e',{map:art.asphalt.map,normalMap:art.asphalt.normalMap,normalScale:new THREE.Vector2(.18,.18),roughness:.94}));
 const steel=art.material('#34464e',{metalness:.6,roughness:.56}),edge=art.material('#8b9696',{metalness:.72,roughness:.48});
 const yellow=art.material('#d3a344',{roughness:.7}),black=art.material('#283132',{roughness:.82}),rubber=art.material('#1d2629',{roughness:.96});
 const crate=art.material('#998268',{map:art.timber.map,normalMap:art.timber.normalMap,normalScale:new THREE.Vector2(.3,.3),roughness:.92});
 const panelCanvas=document.createElement('canvas');panelCanvas.width=256;panelCanvas.height=128;const pc=panelCanvas.getContext('2d')!;
 pc.fillStyle='#b4b9b6';pc.fillRect(0,0,256,128);
 for(let x=0;x<256;x+=16){pc.fillStyle='#939b99';pc.fillRect(x,0,3,128);pc.fillStyle='#d0d3ce';pc.fillRect(x+3,0,2,128);}
 const panelTexture=new THREE.CanvasTexture(panelCanvas);panelTexture.colorSpace=THREE.SRGBColorSpace;panelTexture.wrapS=panelTexture.wrapT=THREE.RepeatWrapping;art.textures.push(panelTexture);
 const panel=(color:string)=>art.material(color,{map:panelTexture,bumpMap:panelTexture,bumpScale:.016,metalness:.48,roughness:.68});
 const blue=panel('#59788a'),red=panel('#a15f4a'),grey=panel('#79878a'),teal=panel('#447e80');
 const plateCanvas=document.createElement('canvas');plateCanvas.width=128;plateCanvas.height=128;const dc=plateCanvas.getContext('2d')!;dc.fillStyle='#6f7c7e';dc.fillRect(0,0,128,128);dc.strokeStyle='#a8b0ac';dc.lineWidth=3;
 for(let y=0;y<128;y+=16)for(let x=0;x<128;x+=16){dc.beginPath();dc.moveTo(x+3,y+4);dc.lineTo(x+10,y+11);dc.stroke();}
 const treadTexture=new THREE.CanvasTexture(plateCanvas);treadTexture.wrapS=treadTexture.wrapT=THREE.RepeatWrapping;treadTexture.repeat.set(6,6);art.textures.push(treadTexture);
 const tread=art.material('#7c898b',{map:treadTexture,bumpMap:treadTexture,bumpScale:.012,roughness:.72,metalness:.55});
 const glass=art.material('#344c59',{roughness:.21,metalness:.4}),light=art.material('#f0e6c8',{emissive:'#ffe4a9',emissiveIntensity:.75,roughness:.4});
 const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>art.box(root,w,h,d,m,x,y,z);
 function finish(b:Solid){
  const name=b.label??'';
  if(b.kind==='crate')return crate;
  if(b.style==='road')return road;
  if(name==='Depot foundation'||name==='Service yard perimeter')return concrete;
  if(name.includes('stair ')&&!name.includes('guard')||name==='Catwalk deck'||name==='Weapon rack stand')return tread;
  if(name.includes('guard'))return steel;
  if(name.includes('forklift'))return name.includes('chassis')?yellow:black;
  if(name==='Teal cargo container')return teal;if(name==='Rust cargo container')return red;
  if(name.includes('rafter')||name.includes('fixture'))return steel;
  if(name.includes('roof'))return grey;
  return name.startsWith('West')?blue:name.startsWith('East')?red:steel;
 }
 const surfaces:{solid:Solid;material:THREE.Material}[]=[];
 for(const b of DEPOT.solids){
  if(b.label?.includes('forklift'))continue;
  // Concrete replaces the lower cladding instead of sitting almost on top of it.
  const base=b.y-b.h/2,top=b.y+b.h/2;
  if(b.kind==='wall'&&base===0&&/^(West|East)/.test(b.label??'')&&!b.label?.includes('stair')){
   surfaces.push({solid:{...b,h:.35,y:.175,label:`${b.label} concrete base`},material:concrete});
   surfaces.push({solid:{...b,h:top-.35,y:(top+.35)/2},material:finish(b)});
  }else{
   // A real container lid owns its top face; the shell ends below the lid.
   const body=b.label?.includes('cargo container')?{...b,h:b.h-.12,y:b.y-.06}:b;
   surfaces.push({solid:body,material:finish(b)});
  }
 }
 const volumes=surfaces.map(s=>s.solid);
 for(const {solid:b,material} of surfaces){
  // One outer shell for all adjoining wall/roof/floor volumes, including catwalk joins.
  const mesh=new THREE.Mesh(visibleSolidGeometry(b,volumes),material);mesh.name=b.label??'';mesh.castShadow=b.kind!=='floor'||b.y+b.h/2>.2;mesh.receiveShadow=true;root.add(mesh);
 }
 for(const b of DEPOT.solids){
  if(b.kind==='crate'){
   for(const y of [b.y-b.h/2+.1,b.y+b.h/2-.1])box(b.w+.025,.09,b.d+.05,steel,b.x,y,b.z);
   for(const x of [-b.w/2+.12,b.w/2-.12])box(.08,b.h-.04,b.d+.03,steel,b.x+x,b.y,b.z);
  }
  if(b.label?.includes('stair ')&&!b.label.includes('guard'))box(.035,.012,b.d-.03,yellow,b.x+(b.x<0?1:-1)*(b.w/2-.025),b.y+b.h/2+.006,b.z);
  if(b.label?.includes('guard'))box(b.w-.006,.025,b.d+.015,yellow,b.x,b.y+b.h/2+.0125,b.z);
  if(b.label?.includes('cargo container'))containerDetails(b,b.label.startsWith('Teal')?teal:red);
 }
 function containerDetails(b:Solid,paint:THREE.Material){
  for(const x of [-1,1])for(const z of [-1,1])box(.12,b.h+.04,.12,edge,b.x+x*(b.w/2-.025),b.h/2,b.z+z*(b.d/2-.025));
  for(const y of [.06,b.h-.06])box(b.w+.04,.12,b.d+.04,paint,b.x,y,b.z);
  for(const sign of [-1,1]){
   const z=b.z+sign*(b.d/2+.018);box(.025,b.h-.22,.025,black,b.x,b.h/2,z);
   for(const x of [-.65,.65]){art.cylinder(root,.022,.022,2.15,edge,b.x+x,1.25,z+sign*.025);box(.2,.045,.08,steel,b.x+x,1.02,z+sign*.04);}
   art.sign(root,sign>0?'CARGO / 07':'DEPOT',b.x,1.85,z+sign*.025,sign>0?0:Math.PI,'#34484c',1.55);
  }
 }
 // Gabled roofs, rafters, columns and rolled shutters are attached to actual warehouse walls.
 for(const side of [-1,1]){
  const cx=side*13,paint=side<0?blue:red;
  for(const half of [-1,1]){
   const roof=box(Math.hypot(7,1.15)+.14,.12,24.5,grey,cx+half*3.5,5.89,0);roof.rotation.z=-half*Math.atan2(1.15,7);
  }
  box(.16,.16,24.7,edge,cx,6.48,0);
  for(const z of [-12.19,12.19]){
   const shape=new THREE.Shape([new THREE.Vector2(-7,0),new THREE.Vector2(7,0),new THREE.Vector2(0,1.15)]);
   const gable=new THREE.Mesh(new THREE.ShapeGeometry(shape),paint);gable.position.set(cx,5.32,z);if(z<0)gable.rotation.y=Math.PI;root.add(gable);
   box(14.2,.14,.18,steel,cx,5.24,z);
   art.sign(root,side<0?'01 / GOODS IN':'02 / DISPATCH',side*14,4.25,z+(z<0?-.035:.035),z<0?Math.PI:0,side<0?'#344c5d':'#6c453b',3.3);
  }
  for(const z of [-11.8,-6,0,6,11.8]){
   box(.14,5,.17,steel,side*20.03,2.6,z);
   box(5.4,.025,.18,light,cx,4.86,z);
  }
  for(const z of [-11.8,-5,5,11.8])box(.14,5,.17,steel,side*6,2.6,z);
  for(const z of [-7,7]){
   // Thin hardware follows the door edges; the four-metre doorway stays fully open.
   for(const dz of [-2,2])box(.12,3.2,.12,edge,side*6,1.6,z+dz);
   const roller=art.cylinder(root,.18,.18,3.95,grey,side*6.22,3.48,z);roller.rotation.x=Math.PI/2;
   box(.28,.22,1.1,steel,side*5.72,3.7,z);box(.26,.035,.92,light,side*5.72,3.57,z);
  }
  for(const z of [-12,12]){
   for(const dx of [-2,2])box(.12,3.2,.16,edge,side*14+dx,1.6,z);
   const roller=art.cylinder(root,.18,.18,3.95,grey,side*14,3.48,z);roller.rotation.z=Math.PI/2;
  }
  // A single high window strip per warehouse, rather than repeated house windows.
  for(let i=0;i<3;i++){box(.035,.7,1.35,glass,side*19.975,4.05,-1.5+i*1.5);box(.08,.06,1.42,edge,side*19.94,3.66,-1.5+i*1.5);}
  art.sign(root,side<0?'WEST / CATWALK':'EAST / CATWALK',side*5.77,4.15,side<0?3.2:-3.2,side<0?Math.PI/2:-Math.PI/2,side<0?'#344c5d':'#6c453b',3);
  box(.14,.14,24.2,steel,side*5.9,5.37,0);
 }
 // Central bridge columns sit within its collision edges, leaving the yard below open.
 for(const x of [-5.95,5.95])for(const z of [-1.22,1.22])box(.12,2.62,.12,steel,x,1.31,z);
 for(const x of [-8,-4,0,4,8])box(.1,.18,2.32,steel,x,DEPOT_CATWALK.height-.22,0);
 forklift();
 function forklift(){
  const g=new THREE.Group();g.position.set(-11,0,-5);root.add(g);
  roundedBox(g,1.12,.58,1.95,yellow,0,.57,0,.08);roundedBox(g,1.16,.3,.6,yellow,0,.8,.7,.07);
  for(const x of [-.55,.55])for(const z of [-.69,.69]){
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.17,20),rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.31,z);g.add(wheel);
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.18,16),steel);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);g.add(hub);
  }
  art.box(g,1.2,2.2,.18,black,0,1.1,-1.15);
  for(const x of [-.43,.43])art.box(g,.08,2.05,.2,edge,x,1.13,-1.2);
  for(const x of [-.5,.5])for(const z of [-.3,.8])art.box(g,.07,1.35,.07,steel,x,1.48,z);
  art.box(g,1.2,.12,1.15,steel,0,2.16,.25);for(const x of [-.42,-.14,.14,.42])art.box(g,.045,.025,1.05,edge,x,2.23,.25);
  roundedBox(g,.65,.12,.58,black,0,1.08,.32,.03);roundedBox(g,.62,.55,.12,black,0,1.3,.56,.04);
  const steering=new THREE.Mesh(new THREE.TorusGeometry(.2,.025,8,20),black);steering.position.set(0,1.2,-.35);steering.rotation.x=-.5;g.add(steering);
  const tank=art.cylinder(g,.19,.19,.8,edge,0,1.13,.83);tank.rotation.z=Math.PI/2;
 }
 // Flush paint is offset once, avoiding coplanar marks and flickering plant areas.
 function groundPaint(text:string,x:number,z:number,w:number,d:number,color='#e1b45a'){
  const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d')!;ctx.strokeStyle=color;ctx.lineWidth=9;ctx.strokeRect(14,14,484,484);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=text.length===1?'bold 260px sans-serif':'bold 70px sans-serif';ctx.fillText(text,256,256);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;art.textures.push(t);const mat=art.material('#ffffff',{map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,roughness:.93});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.012,z);root.add(mesh);
 }
 for(const site of DEPOT.bombSites!)groundPaint(site.id,site.x,site.z,site.w,site.d);
 groundPaint('KEEP CLEAR',0,-10.5,6,1.2);groundPaint('KEEP CLEAR',0,10.5,6,1.2);
 for(const z of [-14.75,14.75]){
  for(const x of [-17,-11,-5,1,7,13,19])box(2.1,.009,.08,yellow,x,.008,z);
  // Loading-bay lamps and wall vents remain attached to the boundary.
  for(const x of [-17,0,17]){box(.8,.16,.3,steel,x,3.2,z<0?-17.42:17.42);box(.65,.035,.22,light,x,3.105,z<0?-17.35:17.35);}
 }
 return root;
}
