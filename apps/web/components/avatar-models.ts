import * as THREE from 'three';
import type {AvatarId,Team} from '@sirocco/shared';
import {characterSurface} from './character-surfaces';
import {addWonderWoman} from './wonder-woman-model';
import {addClassicUltraman} from './ultraman-model';
import {ironArmor} from './iron-armor';
import {ironHelmet,spiderLenses} from './character-armor';
import {addRealAnatomy} from './character-anatomy';
import {CHARACTER_STYLE} from './character-style';
import type {WorldArt} from './world';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
const palettes=new WeakMap<WorldArt,Map<AvatarId,THREE.MeshStandardMaterial[]>>();
function palette(art:WorldArt,id:AvatarId){let cache=palettes.get(art);if(!cache){cache=new Map();palettes.set(art,cache);}let p=cache.get(id);if(p)return p;
 const style=CHARACTER_STYLE[id],armored=style.surface==='armor',surface=characterSurface(art,style);
 p=[...[style.primary,style.secondary,style.trim].map((color,i)=>art.material(color,{metalness:i===1?style.metal:armored?style.metal:.025,roughness:armored?(id==='ironman'?.8:.66):1,...surface})),art.material('#c19a7b',{roughness:.82}),art.material('#171d20',{roughness:.45}),art.material('#d9e4dd',{roughness:.28})];cache.set(id,p);return p;
}
export function buildAvatar(art:WorldArt,id:AvatarId,_team:Team='red'){
 const root=new THREE.Group();root.name=id;root.userData.avatar=id;const [main,accent,dark,skin,black,white]=palette(art,id),bulky=id==='hulk'?1.26:id==='groot'?1.05:1,female=id==='wonder-woman'||id==='black-widow',flesh=id==='hulk'?main:skin;
 const ell=(parent:THREE.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;};
 const plate=(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,r=.015)=>{const o=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5)),m);o.position.set(x,y,z);parent.add(o);return o;};
 const limb=(parent:THREE.Object3D,a:number[],b:number[],r1:number,r2:number,m:THREE.Material)=>{const from=new THREE.Vector3(...a as [number,number,number]),to=new THREE.Vector3(...b as [number,number,number]),delta=to.clone().sub(from),mesh=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(r1*.78,-delta.length()/2),new THREE.Vector2(r1,-delta.length()*.34),new THREE.Vector2((r1+r2)*.55,0),new THREE.Vector2(r2,delta.length()*.37),new THREE.Vector2(r2*.8,delta.length()/2)],24),m);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(mesh);return mesh;};
 const path=(pts:number[][],m:THREE.Material,r=.004)=>{const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p as [number,number,number]))),18,r,6,false);const mesh=new THREE.Mesh(geo,m);root.add(mesh);return mesh;};
 const circle=(x:number,y:number,z:number,r:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.CircleGeometry(r,40),m);mesh.rotation.y=Math.PI;mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 const star=(x:number,y:number,z:number,r:number,m:THREE.Material)=>{const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,p=i%2?r*.42:r;const px=Math.cos(a)*p,py=Math.sin(a)*p;i?shape.lineTo(px,py):shape.moveTo(px,py);}shape.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),m);mesh.rotation.y=Math.PI;mesh.position.set(x,y,z);root.add(mesh);};
 const shell=(parent:THREE.Object3D,outline:number[][],z:number,depth:number,m:THREE.Material)=>{const shape=new THREE.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.008,bevelThickness:.007});const mesh=new THREE.Mesh(geo,m);mesh.position.z=z;parent.add(mesh);return mesh;};
 addRealAnatomy(root,art,id,palette(art,id));
 // Layered costume panels and seams give the body definition at gameplay range.
 if(!['hulk','groot','spiderman','ironman','ultraman','wonder-woman'].includes(id)){
  for(const side of [-1,1]){if(['ironman','batman','thor','captain-america'].includes(id))shell(root,[[side*.018,1.36],[side*.14,1.37],[side*.20,1.30],[side*.16,1.23],[side*.025,1.24]],-.17,.022,main);if(id==='ironman'||id==='batman')for(let i=0;i<3;i++)plate(root,side*.062,1.17-i*.057,-.159,.105,.045,.025,main,.01);}
  for(const side of [-1,1]){path([[side*.18,1.21,-.10],[side*.14,1.10,-.105],[side*.13,.98,-.09]],black,.004);}
  plate(root,0,.90,-.11,.34*bulky,.055,.055,dark);plate(root,0,.90,-.147,.065,.065,.025,accent);
 }
 if(id==='ultraman')addClassicUltraman(root,art,main,accent);
 if(id==='ironman'){
  ironHelmet(root,art,main,accent,black);
  ironArmor(root,art,main,accent,black);

 }
 if(id==='spiderman'||id==='deadpool'){
  if(id==='spiderman')spiderLenses(root,black,white);
  if(id==='deadpool')for(const side of [-1,1]){const eye=ell(root,side*.052,1.68,-.156,.046,.040,.020,black);eye.rotation.z=side*.24;if(id==='deadpool')ell(root,side*.052,1.685,-.178,.027,.014,.008,white);}
  if(id==='spiderman'){
   for(const y of [1.55,1.60,1.65,1.71])path([[-.10,y,-.095],[-.06,y-.01,-.154],[0,y,-.175],[.06,y-.01,-.154],[.10,y,-.095]],black,.0009);
   for(const x of [-.075,-.035,0,.035,.075])path([[x*.4,1.78,-.08],[x,1.67,-.166],[x*.7,1.53,-.09]],black,.0009);
   ell(root,0,1.32,-.16,.020,.04,.006,black);for(const side of [-1,1])for(let i=0;i<4;i++)path([[0,1.33-i*.012,-.158],[side*.048,1.35-i*.020,-.155],[side*.072,1.31-i*.019,-.145]],black,.003);

  }else{
   for(const side of [-1,1]){plate(root,side*.17,.89,-.07,.075,.13,.08,dark);limb(root,[side*.17,1.36,.12],[-side*.22,1.63,.16],.018,.018,black);}
   const strap=plate(root,0,1.18,-.15,.05,.46,.025,dark);strap.rotation.z=-.5;
  }
 }
 if(id==='captain-america'){
  star(0,1.29,-.193,.065,white);for(let i=-2;i<=2;i++)plate(root,i*.049,1.01,-.119,.043,.15,.024,i%2?white:dark);
  // Compact shield is secured to the back so the equipped weapon stays clear.
  const shield=new THREE.Group();shield.position.set(0,1.19,.18);root.add(shield);for(const [r,m,z] of [[.27,dark,0],[.22,white,.008],[.17,dark,.016],[.115,main,.024]] as [number,THREE.Material,number][]){const disc=new THREE.Mesh(new THREE.CircleGeometry(r,48),m);disc.position.z=z;shield.add(disc);}
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.fillText('A',32,49);const t=new THREE.CanvasTexture(c);art.textures.push(t);const letter=new THREE.Mesh(new THREE.PlaneGeometry(.08,.085),art.material('#fff',{map:t,transparent:true,depthWrite:false}));letter.rotation.y=Math.PI;letter.position.set(0,1.735,-.102);root.add(letter);
 }
 const cape=(m:THREE.Material)=>{const geo=new THREE.PlaneGeometry(.56,.94,24,24),p=geo.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),drop=(.47-y)/.94;p.setXYZ(i,p.getX(i)*(.65+drop*.70),y,Math.sin(p.getX(i)*40)*(.008+drop*.028)+drop*.12);}geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,m);mesh.position.set(0,.94,.10);root.add(mesh);};
 if(id==='batman'){
  for(const side of [-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.035,.16,4),main);ear.position.set(side*.09,1.79,.005);root.add(ear);}
  cape(art.material('#161d22',{roughness:.94,side:THREE.DoubleSide}));
  const shape=new THREE.Shape();for(const [i,[x,y]] of [[-.13,.04],[-.055,.02],[-.02,.06],[0,.035],[.02,.06],[.055,.02],[.13,.04],[.08,-.03],[.03,-.015],[0,-.055],[-.03,-.015],[-.08,-.03]].entries())i?shape.lineTo(x,y):shape.moveTo(x,y);shape.closePath();const bat=new THREE.Mesh(new THREE.ShapeGeometry(shape),black);bat.rotation.y=Math.PI;bat.position.set(0,1.29,-.193);root.add(bat);
 }
 if(id==='thor'){
  for(const side of [-1,1]){const shoulder=plate(root,side*.265,1.35,0,.15,.13,.21,main,.025);shoulder.rotation.z=side*.25;}
  cape(art.material('#792f36',{roughness:1,side:THREE.DoubleSide}));for(const side of [-1,1])for(const y of [1.34,1.19,1.05]){const disc=art.cylinder(root,.046,.046,.025,accent,side*.105,y,-.156);disc.rotation.x=Math.PI/2;}
  plate(root,.28,.82,.17,.13,.17,.13,accent);limb(root,[.28,.57,.17],[.28,.79,.17],.017,.017,dark);
 }
 if(id==='wonder-woman')addWonderWoman(root,art,accent,main,dark);
 if(id==='black-widow'){
  plate(root,0,1.25,-.15,.015,.26,.01,accent);for(const side of [-1,1]){plate(root,side*.17,.83,-.055,.065,.16,.075,black);for(let i=0;i<5;i++)ell(root,side*.25,1.13,-.21+i*.02,.055,.012,.009,accent);}
  plate(root,0,.90,-.15,.045,.055,.016,art.material('#8f342d'));
 }
 if(id==='groot'){
  for(let i=0;i<26;i++){const x=(i%7-3)*.058,y=.93+(i%6)*.065;path([[x,y,-.12],[x+.015,y+.21,-.155],[x-.012,y+.38,-.12]],i%2?accent:dark,.009);}
  for(const side of [-1,1]){ell(root,side*.052,1.68,-.15,.020,.022,.017,black);for(let i=0;i<3;i++)limb(root,[side*(.03+i*.025),1.75,.01],[side*(.04+i*.030),1.81+(i%2)*.055,.015],.018,.008,main);}
  path([[-.04,1.57,-.115],[0,1.56,-.13],[.04,1.57,-.115]],black,.004);
 }
 if(!['hulk','groot','ultraman','wonder-woman'].includes(id))for(const side of [-1,1]){
  const leg=root.getObjectByName(side<0?'leftLeg':'rightLeg')!;
  const foot=root.userData.feet[leg.name],x=foot.x-leg.position.x,z=foot.z;
  const bootMat=['ironman','spiderman','ultraman'].includes(id)?main:id==='wonder-woman'?accent:black;plate(leg,x,-.845,z,.137,.11,.27,bootMat,.023);
  plate(leg,x,-.885,z,.137,.025,.265,black,.012);
  limb(leg,[x,-.85,z+.04],[x,-.66,z+.07],.067,.060,bootMat);for(let i=0;i<5;i++)plate(leg,x,-.78-i*.016,z-.055,.085,.006,.009,black,.001);
 }
 root.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=o.receiveShadow=true;});return root;
}
