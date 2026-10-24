import * as THREE from 'three';
import type {AvatarId,Team} from '@sirocco/shared';
import {CHARACTER_STYLE} from './character-style';
import type {WorldArt} from './world';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
const palettes=new WeakMap<WorldArt,Map<AvatarId,THREE.MeshStandardMaterial[]>>();
function palette(art:WorldArt,id:AvatarId){let cache=palettes.get(art);if(!cache){cache=new Map();palettes.set(art,cache);}let p=cache.get(id);if(p)return p;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#b8b8b8';ctx.fillRect(0,0,128,128);for(let i=0;i<450;i++){ctx.fillStyle=i%2?'#929292':'#d0d0d0';ctx.fillRect(i*53%128,i*71%128,1,2);}const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;art.textures.push(texture);
 const style=CHARACTER_STYLE[id],armored=style.surface==='armor';
 p=[...[style.primary,style.secondary,style.trim].map((color,i)=>art.material(color,{metalness:i===1?style.metal:armored?style.metal:.025,roughness:armored?.40:.78,roughnessMap:texture,bumpMap:texture,bumpScale:id==='groot'?.004:.0007})),art.material('#c19a7b',{roughness:.82}),art.material('#171d20',{roughness:.45}),art.material('#d9e4dd',{roughness:.28})];cache.set(id,p);return p;
}
export function buildAvatar(art:WorldArt,id:AvatarId,team:Team='red'){
 const root=new THREE.Group();root.name=id;root.userData.avatar=id;const [main,accent,dark,skin,black,white]=palette(art,id),bulky=id==='hulk'?1.26:id==='groot'?1.05:1,female=id==='wonder-woman'||id==='black-widow',flesh=id==='hulk'?main:skin;
 const ell=(parent:THREE.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;};
 const plate=(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,r=.015)=>{const o=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5)),m);o.position.set(x,y,z);parent.add(o);return o;};
 const limb=(parent:THREE.Object3D,a:number[],b:number[],r1:number,r2:number,m:THREE.Material)=>{const from=new THREE.Vector3(...a as [number,number,number]),to=new THREE.Vector3(...b as [number,number,number]),delta=to.clone().sub(from),mesh=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(r1*.78,-delta.length()/2),new THREE.Vector2(r1,-delta.length()*.34),new THREE.Vector2((r1+r2)*.55,0),new THREE.Vector2(r2,delta.length()*.37),new THREE.Vector2(r2*.8,delta.length()/2)],24),m);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(mesh);return mesh;};
 const path=(pts:number[][],m:THREE.Material,r=.004)=>{const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p as [number,number,number]))),18,r,6,false);const mesh=new THREE.Mesh(geo,m);root.add(mesh);return mesh;};
 const circle=(x:number,y:number,z:number,r:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.CircleGeometry(r,40),m);mesh.rotation.y=Math.PI;mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 const star=(x:number,y:number,z:number,r:number,m:THREE.Material)=>{const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,p=i%2?r*.42:r;const px=Math.cos(a)*p,py=Math.sin(a)*p;i?shape.lineTo(px,py):shape.moveTo(px,py);}shape.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),m);mesh.rotation.y=Math.PI;mesh.position.set(x,y,z);root.add(mesh);};
 const shell=(parent:THREE.Object3D,outline:number[][],z:number,depth:number,m:THREE.Material)=>{const shape=new THREE.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.008,bevelThickness:.007});const mesh=new THREE.Mesh(geo,m);mesh.position.z=z;parent.add(mesh);return mesh;};
 // Anatomical proportions: head, chest, pelvis, separate articulated legs and arms.
 ell(root,0,.86,.015,.17*bulky,.14,.12*bulky,id==='hulk'?dark:main);
 const torso=new THREE.Mesh(new THREE.LatheGeometry([[.13,.91],[.15,1.02],[.18,1.15],[female?.21:.245,1.30],[.22,1.36],[.09,1.43]].map(([r,y])=>new THREE.Vector2(r*bulky,y)),32),main);torso.scale.z=.60;root.add(torso);
 ell(root,0,1.02,0,.155*bulky,.18,.115,main);
 for(const side of [-1,1]){
  const leg=new THREE.Group();leg.name=side<0?'leftLeg':'rightLeg';leg.position.set(side*.105*bulky,.85,0);root.add(leg);
  limb(leg,[0,-.02,0],[0,-.37,.005],.085*bulky,.070*bulky,id==='hulk'?dark:main);ell(leg,0,-.39,-.012,.074*bulky,.072,.078,accent);limb(leg,[0,-.42,.005],[0,-.71,-.015],.066*bulky,.048*bulky,id==='hulk'?flesh:main);
  plate(leg,0,-.785,-.065,.125*bulky,.13,.25,['hulk','groot'].includes(id)?main:black,.035);
  if(id!=='hulk'&&id!=='groot')plate(leg,0,-.56,-.063,.09*bulky,.23,.035,accent,.012);
  const armRoot=new THREE.Group();armRoot.name=side<0?'unarmedLeftArm':'unarmedRightArm';root.add(armRoot);
  const shoulder=side*(female?.20:.25)*bulky;ell(armRoot,shoulder,1.32,.005,.105*bulky,.115,.10,main);
  limb(armRoot,[shoulder,1.30,0],[side*.30*bulky,1.13,-.06],.074*bulky,.065*bulky,main);ell(armRoot,side*.30*bulky,1.13,-.06,.068,.065,.065,dark);
  limb(armRoot,[side*.30*bulky,1.12,-.07],[side*.22,1.13,-.27],.063*bulky,.045,main);ell(armRoot,side*.22,1.13,-.29,.055,.045,.075,id==='hulk'||id==='groot'?main:black);
  for(let i=0;i<3;i++)plate(armRoot,side*.22+(i-1)*.023,1.12,-.345,.018,.035,.02,id==='hulk'||id==='groot'?main:black,.006);
 }
 limb(root,[0,1.39,0],[0,1.52,0],.065,.06,['hulk','groot','ironman','spiderman','deadpool','batman'].includes(id)?main:skin);
 const unmasked=['thor','wonder-woman','black-widow','hulk','groot'].includes(id);
 const head=new THREE.Mesh(new THREE.LatheGeometry([[.01,1.49],[.065,1.51],[.098,1.56],[.119,1.62],[.121,1.69],[.10,1.75],[.06,1.78],[0,1.795]].map(([r,y])=>new THREE.Vector2(r,y)),40),unmasked?flesh:main);head.scale.set(bulky,1,.96*bulky);root.add(head);
 if(id==='groot')head.material=main;
 if(unmasked&&id!=='groot'){
  ell(root,0,1.55,-.064,.065,.034,.057,flesh);ell(root,0,1.642,-.121,.016,.033,.026,flesh);
  for(const side of [-1,1]){ell(root,side*.068,1.62,-.083,.036,.026,.031,flesh);ell(root,side*.013,1.618,-.133,.010,.008,.011,flesh);}

  for(const side of [-1,1]){ell(root,side*.052,1.67,-.112,.019,.007,.009,white);ell(root,side*.052,1.670,-.123,.006,.006,.003,black);ell(root,side*.128*bulky,1.64,0,.021,.04,.028,flesh);path([[side*.025,1.697,-.115],[side*.058,1.70,-.115],[side*.081,1.69,-.10]],id==='hulk'?black:dark,.004);}
  path([[-.039,1.572,-.113],[0,1.568,-.122],[.039,1.572,-.113]],dark,.003);
 }
 // Layered costume panels and seams give the body definition at gameplay range.
 if(!['hulk','groot'].includes(id)){
  for(const side of [-1,1]){shell(root,[[side*.018,1.34],[side*.15,1.35],[side*.207,1.29],[side*.17,1.20],[side*.025,1.23]],-.146,.042,main);for(let i=0;i<3;i++)plate(root,side*.062,1.13-i*.057,-.116,.105,.045,.025,id==='ironman'?main:dark,.01);}
  for(const side of [-1,1]){path([[side*.18,1.21,-.10],[side*.14,1.10,-.105],[side*.13,.98,-.09]],black,.004);}
  plate(root,0,.90,-.11,.34*bulky,.055,.055,dark);plate(root,0,.90,-.147,.065,.065,.025,accent);
 }
 if(id==='ironman'){
  shell(root,[[-.075,1.765],[.075,1.765],[.103,1.70],[.079,1.59],[.040,1.51],[-.040,1.51],[-.079,1.59],[-.103,1.70]],-.123,.028,accent);
  shell(root,[[-.028,1.68],[.028,1.68],[.038,1.60],[0,1.58],[-.038,1.60]],-.155,.012,accent);
  for(const side of [-1,1]){const eye=plate(root,side*.053,1.69,-.158,.068,.014,.010,white,.004);eye.rotation.z=side*-.12;path([[side*.092,1.67,-.149],[side*.067,1.60,-.153],[side*.035,1.56,-.148]],main,.006);ell(root,side*.116,1.65,.005,.018,.053,.048,accent);}
  for(let i=0;i<3;i++)plate(root,0,1.405+i*.024,-.048,.103,.012,.11,black,.004);
  const glow=art.material('#b5eafa',{emissive:'#75d8ff',emissiveIntensity:2,roughness:.2});circle(0,1.25,-.175,.045,glow);for(const side of [-1,1])ell(root,side*.25,1.34,-.03,.10,.075,.10,accent);
  plate(root,0,1.56,-.127,.10,.018,.012,black,.004);
 }
 if(id==='spiderman'||id==='deadpool'){
  for(const side of [-1,1]){const eye=ell(root,side*.052,1.67,-.108,.040,.035,.018,id==='deadpool'?black:white);eye.rotation.z=side*.24;if(id==='deadpool')ell(root,side*.052,1.675,-.124,.024,.018,.008,white);}
  if(id==='spiderman'){
   for(const y of [1.55,1.60,1.65,1.71])path([[-.10,y,-.075],[-.06,y-.01,-.114],[0,y,-.130],[.06,y-.01,-.114],[.10,y,-.075]],black,.0024);
   for(const x of [-.075,-.035,0,.035,.075])path([[x*.4,1.78,-.06],[x,1.67,-.123],[x*.7,1.53,-.07]],black,.0024);
   ell(root,0,1.23,-.151,.025,.05,.008,black);for(const side of [-1,1])for(let i=0;i<4;i++)path([[0,1.24-i*.015,-.149],[side*.06,1.27-i*.025,-.151],[side*.09,1.22-i*.023,-.133]],black,.003);
   for(const side of [-1,1])plate(root,side*.17,1.09,.015,.035,.22,.18,accent);
  }else{
   for(const side of [-1,1]){plate(root,side*.17,.89,-.07,.075,.13,.08,dark);limb(root,[side*.17,1.36,.12],[-side*.22,1.63,.16],.018,.018,black);}
   const strap=plate(root,0,1.18,-.15,.05,.46,.025,dark);strap.rotation.z=-.5;
  }
 }
 if(id==='captain-america'){
  ell(root,0,1.565,-.089,.077,.060,.056,skin);for(const side of [-1,1]){plate(root,side*.05,1.673,-.12,.058,.022,.014,black,.005);ell(root,side*.05,1.673,-.13,.019,.007,.004,white);}path([[-.035,1.55,-.132],[0,1.545,-.143],[.035,1.55,-.132]],dark,.003);
  star(0,1.27,-.165,.075,white);for(let i=-2;i<=2;i++)plate(root,i*.049,1.01,-.119,.043,.15,.024,i%2?white:dark);
  // Compact shield is secured to the back so the equipped weapon stays clear.
  const shield=new THREE.Group();shield.position.set(0,1.19,.18);root.add(shield);for(const [r,m,z] of [[.27,dark,0],[.22,white,.008],[.17,dark,.016],[.115,main,.024]] as [number,THREE.Material,number][]){const disc=new THREE.Mesh(new THREE.CircleGeometry(r,48),m);disc.position.z=z;shield.add(disc);}
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.fillText('A',32,49);const t=new THREE.CanvasTexture(c);art.textures.push(t);const letter=new THREE.Mesh(new THREE.PlaneGeometry(.08,.085),art.material('#fff',{map:t,transparent:true,depthWrite:false}));letter.rotation.y=Math.PI;letter.position.set(0,1.735,-.102);root.add(letter);
 }
 const cape=(m:THREE.Material)=>{const geo=new THREE.PlaneGeometry(.56,.94,24,24),p=geo.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),drop=(.47-y)/.94;p.setXYZ(i,p.getX(i)*(.65+drop*.70),y,Math.sin(p.getX(i)*40)*(.008+drop*.028)+drop*.12);}geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,m);mesh.position.set(0,.94,.18);root.add(mesh);};
 if(id==='batman'){
  for(const side of [-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.035,.16,4),main);ear.position.set(side*.09,1.79,.005);root.add(ear);plate(root,side*.05,1.675,-.123,.055,.014,.014,white,.004);}
  ell(root,0,1.565,-.089,.072,.047,.052,skin);cape(art.material('#161d22',{roughness:.94,side:THREE.DoubleSide}));
  const shape=new THREE.Shape();for(const [i,[x,y]] of [[-.13,.04],[-.055,.02],[-.02,.06],[0,.035],[.02,.06],[.055,.02],[.13,.04],[.08,-.03],[.03,-.015],[0,-.055],[-.03,-.015],[-.08,-.03]].entries())i?shape.lineTo(x,y):shape.moveTo(x,y);shape.closePath();const bat=new THREE.Mesh(new THREE.ShapeGeometry(shape),black);bat.rotation.y=Math.PI;bat.position.set(0,1.27,-.15);root.add(bat);
 }
 if(['thor','wonder-woman','black-widow','hulk'].includes(id)){
  const hair=art.material(id==='thor'?'#b9a16b':id==='black-widow'?'#793a26':'#252924',{roughness:.98});ell(root,0,1.732,.025,.132*bulky,.085,.115*bulky,hair);
  if(id!=='hulk')for(let i=0;i<11;i++){const a=-Math.PI/2+i*Math.PI/10,x=Math.sin(a)*.127,z=Math.cos(a)*.11+.018;ell(root,x,1.56,z,.031,id==='black-widow'?.16:.21,.036,hair);for(let k=0;k<3;k++)path([[x+(k-1)*.01,1.73,z-.008],[x+(k-1)*.012,1.56,z-.017],[x+(k-1)*.01,1.39,z+.012]],hair,.0025);}
 }
 if(id==='thor'){
  cape(art.material('#792f36',{roughness:1,side:THREE.DoubleSide}));for(const side of [-1,1])for(const y of [1.34,1.19,1.05]){const disc=art.cylinder(root,.046,.046,.025,accent,side*.105,y,-.144);disc.rotation.x=Math.PI/2;}
  plate(root,.28,.82,.17,.13,.17,.13,accent);limb(root,[.28,.57,.17],[.28,.79,.17],.017,.017,dark);
 }
 if(id==='wonder-woman'){
  plate(root,0,1.73,-.111,.19,.025,.018,accent);star(0,1.73,-.125,.020,main);
  for(const side of [-1,1]){const v=plate(root,side*.065,1.33,-.152,.16,.035,.022,accent);v.rotation.z=side*.35;plate(root,side*.27,1.13,-.19,.09,.11,.06,accent);}
  const lasso=new THREE.Mesh(new THREE.TorusGeometry(.085,.006,8,36),accent);lasso.position.set(.19,.87,.01);root.add(lasso);
 }
 if(id==='black-widow'){
  plate(root,0,1.25,-.15,.015,.26,.01,accent);for(const side of [-1,1]){plate(root,side*.17,.83,-.055,.065,.16,.075,black);for(let i=0;i<5;i++)ell(root,side*.25,1.13,-.21+i*.02,.055,.012,.009,accent);}
  plate(root,0,.90,-.15,.045,.055,.016,art.material('#8f342d'));
 }
 if(id==='hulk'){
  for(const side of [-1,1]){ell(root,side*.125,1.28,-.08,.14,.13,.10,main);ell(root,side*.30,1.25,-.02,.12,.15,.10,main);}
  for(const y of [1.14,1.055,.98])for(const side of [-1,1])ell(root,side*.055,y,-.10,.053,.045,.035,accent);
 }
 if(id==='groot'){
  for(let i=0;i<26;i++){const x=(i%7-3)*.058,y=.93+(i%6)*.065;path([[x,y,.11],[x+.015,y+.21,.13],[x-.012,y+.38,.08]],i%2?accent:dark,.009);}
  for(const side of [-1,1]){ell(root,side*.052,1.67,-.113,.023,.026,.014,black);for(let i=0;i<3;i++)limb(root,[side*(.03+i*.025),1.75,.01],[side*(.04+i*.030),1.81+(i%2)*.055,.015],.018,.008,main);}
  path([[-.04,1.57,-.115],[0,1.56,-.13],[.04,1.57,-.115]],black,.004);
 }
 // Team markers remain independent of costume color.
 const marker=art.material(team==='red'?'#e99067':'#6dc8df',{emissive:team==='red'?'#542519':'#153f50',emissiveIntensity:.35});for(const side of [-1,1])plate(root,side*.27*bulky,1.35,-.077,.07,.025,.018,marker,.004);
 root.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=o.receiveShadow=true;});return root;
}
