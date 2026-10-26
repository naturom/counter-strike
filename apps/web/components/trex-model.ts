import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {TREX_RULES,footprint,solidTop,type Solid,type Trex} from '@sirocco/shared';
import {WorldArt,disposeGroup} from './world';

type Palette={skin:THREE.Material;belly:THREE.Material;dark:THREE.Material;gum:THREE.Material;tooth:THREE.Material;eye:THREE.Material;pupil:THREE.Material};
const palettes=new WeakMap<WorldArt,Palette>();
function palette(art:WorldArt){let p=palettes.get(art);if(p)return p;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle='#8e926c';c.fillRect(0,0,256,256);
 for(let row=0;row<40;row++)for(let col=0;col<37;col++){const x=col*7+(row%2)*3.5,y=row*7,n=(row*19+col*31)%37;c.fillStyle=`rgb(${140+n},${136+n},${100+n})`;c.strokeStyle='#777956';c.lineWidth=.8;c.beginPath();c.ellipse(x,y,3.5,3.1,(n%5)*.12,0,Math.PI*2);c.fill();c.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);art.textures.push(texture);
 p={skin:art.material('#c2ad7d',{map:texture,bumpMap:texture,bumpScale:.014,roughness:.82}),belly:art.material('#ded1a4',{map:texture,bumpMap:texture,bumpScale:.008,roughness:.9}),dark:art.material('#686143',{map:texture,roughness:.88}),gum:art.material('#482c29',{roughness:.45}),tooth:art.material('#ded1a9',{roughness:.42}),eye:art.material('#c68b32',{roughness:.22,metalness:.05}),pupil:art.material('#10160f',{roughness:.16})};palettes.set(art,p);return p;
}
function oval(parent:THREE.Object3D,size:number[],at:number[],material:THREE.Material,name=''){
 const geometry=new THREE.SphereGeometry(1,24,16);geometry.scale(size[0],size[1],size[2]);const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(at);mesh.name=name;parent.add(mesh);return mesh;
}
function link(parent:THREE.Object3D,a:number[],b:number[],r1:number,r2:number,material:THREE.Material){const from=new THREE.Vector3().fromArray(a),to=new THREE.Vector3().fromArray(b),geometry=new THREE.CylinderGeometry(r2,r1,from.distanceTo(to),18);geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));geometry.translate(...from.lerp(to,.5).toArray());const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);return mesh;}
function box(parent:THREE.Object3D,size:number[],at:number[],material:THREE.Material,r=.08){const mesh=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],3,r),material);mesh.position.fromArray(at);parent.add(mesh);return mesh;}
function neckSurface(material:THREE.Material){
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.13,.23),new THREE.Vector3(0,.18,-.18),new THREE.Vector3(0,.48,-.54),new THREE.Vector3(0,.60,-.91)]),geometry=new THREE.TubeGeometry(curve,18,1,20,false),p=geometry.attributes.position;
 for(let ring=0;ring<=18;ring++){const t=ring/18,center=curve.getPointAt(t),radius=THREE.MathUtils.lerp(.49,.34,t);for(let j=0;j<=20;j++){const i=ring*21+j,v=new THREE.Vector3().fromBufferAttribute(p,i).sub(center).multiplyScalar(radius).add(center);p.setXYZ(i,v.x,v.y,v.z);}}
 geometry.computeVertexNormals();return new THREE.Mesh(geometry,material);
}
/** Batch only rigid parts; the jaw, limbs, neck and tail retain their own joints. */
function batch(root:THREE.Group){for(const child of [...root.children])if(child instanceof THREE.Group)batch(child);const sets=new Map<THREE.Material,THREE.BufferGeometry[]>();for(const child of [...root.children])if(child instanceof THREE.Mesh&&!Array.isArray(child.material)){child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);const list=sets.get(child.material)??[];list.push(geometry);sets.set(child.material,list);root.remove(child);child.geometry.dispose();}
 for(const [material,geometries] of sets){const plain=geometries.map(g=>g.index?g.toNonIndexed():g.clone()),merged=mergeGeometries(plain);for(const g of [...geometries,...plain])g.dispose();if(!merged)continue;const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
}
export function buildTrex(art:WorldArt){
 const p=palette(art),root=new THREE.Group(),body=new THREE.Group();root.name='trex';body.name='trex-body';root.add(body);
 oval(body,[.66,.78,1.10],[0,2.12,.17],p.skin);oval(body,[.54,.48,.91],[0,1.88,-.08],p.belly);oval(body,[.62,.65,.68],[0,1.93,.72],p.skin);
 // A sloping spine, deep rib cage and powerful hips give the horizontal posture.
 for(let i=0;i<7;i++){const z=-.55+i*.25,y=2.68+Math.sin(i/6*Math.PI)*.19;oval(body,[.16,.045,.20],[0,y,z],p.dark);}
 const neck=new THREE.Group();neck.name='trex-neck';neck.position.set(0,2.44,-.68);body.add(neck);
 neck.add(neckSurface(p.skin));const throat=oval(neck,[.28,.40,.32],[0,.06,-.38],p.belly);throat.rotation.x=.65;
 const head=new THREE.Group();head.name='trex-head';head.position.set(0,.69,-.90);neck.add(head);
 oval(head,[.43,.39,.55],[0,.04,-.03],p.skin);box(head,[.67,.43,1.02],[0,-.035,-.48],p.skin,.12);box(head,[.56,.13,.87],[0,-.24,-.53],p.gum,.04);
 oval(head,[.29,.12,.44],[0,.16,-.47],p.skin);
 for(const side of [-1,1]){
  oval(head,[.065,.055,.095],[side*.29,.10,-.81],p.dark);
  oval(head,[.058,.09,.11],[side*.40,.13,-.02],p.dark);
  oval(head,[.032,.041,.046],[side*.436,.135,-.035],p.eye);
  oval(head,[.008,.031,.022],[side*.461,.135,-.05],p.pupil);
  const brow=oval(head,[.12,.09,.24],[side*.36,.225,-.07],p.dark);brow.rotation.z=side*.16;
  for(let i=0;i<7;i++){const fold=oval(head,[.012,.025,.16],[side*.406,-.09+i*.032,.16],p.dark);fold.rotation.z=side*.17;}
 }
 const jaw=new THREE.Group();jaw.name='trex-jaw';jaw.position.set(0,-.19,.16);head.add(jaw);
 box(jaw,[.59,.20,1.12],[0,-.16,-.61],p.skin,.09);oval(jaw,[.28,.09,.54],[0,-.22,-.60],p.belly);box(jaw,[.49,.06,.94],[0,-.045,-.65],p.gum,.02);
 for(const side of [-1,1])for(let i=0;i<12;i++){
  const length=.095+(i*7%5)*.012,z=-.09-i*.077,x=side*(.255-.035*Math.max(0,(i-7)/5));
  const upper=new THREE.Mesh(new THREE.ConeGeometry(.022,length,9),p.tooth);upper.rotation.z=Math.PI;upper.position.set(x,-.23-length/2,z);head.add(upper);
  const lower=new THREE.Mesh(new THREE.ConeGeometry(.018,length*.7,9),p.tooth);lower.position.set(x*.92,-.04+length*.35,z-.16);jaw.add(lower);
 }
 // Small two-fingered forelimbs, visibly distinct from the heavy hind legs.
 for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.49,2.30,-.62);arm.rotation.z=side*.13;body.add(arm);oval(arm,[.12,.24,.16],[side*.07,-.09,-.08],p.skin);link(arm,[0,0,0],[side*.17,-.30,-.21],.12,.075,p.skin);link(arm,[side*.17,-.30,-.21],[side*.12,-.36,-.48],.075,.045,p.skin);for(const x of [-.035,.035]){link(arm,[side*.12+x,-.36,-.48],[side*.12+x,-.37,-.65],.027,.017,p.skin);link(arm,[side*.12+x,-.37,-.65],[side*.12+x,-.43,-.72],.018,.002,p.tooth);}}
 const legs:THREE.Group[]=[],shins:THREE.Group[]=[],feet:THREE.Group[]=[];
 for(const side of [-1,1]){
  const hip=new THREE.Group();hip.name=side<0?'trex-left-leg':'trex-right-leg';hip.position.set(side*.51,1.92,.53);body.add(hip);legs.push(hip);
  const thigh=oval(hip,[.32,.55,.42],[side*.035,-.35,-.04],p.skin);thigh.rotation.x=-.13;link(hip,[0,0,0],[side*.02,-.73,-.12],.30,.17,p.skin);
  const shin=new THREE.Group();shin.position.set(side*.02,-.73,-.12);hip.add(shin);shins.push(shin);oval(shin,[.18,.20,.19],[0,0,0],p.skin);link(shin,[0,0,0],[0,-.75,.35],.17,.085,p.skin);oval(shin,[.10,.18,.13],[0,-.72,.32],p.dark);
  const foot=new THREE.Group();foot.position.set(0,-.77,.34);shin.add(foot);feet.push(foot);link(foot,[0,0,0],[0,-.29,-.12],.075,.11,p.skin);oval(foot,[.15,.10,.28],[0,-.31,-.22],p.skin);
  for(let toe=0;toe<3;toe++){const x=(toe-1)*.115,end=toe===1?-.66:-.55;link(foot,[x*.55,-.30,-.17],[x,-.36,end],.065,.035,p.skin);const claw=link(foot,[x,-.35,end],[x,-.40,end-.17],.037,.001,p.tooth);claw.name='trex-claw';}
 }
 const tails:THREE.Group[]=[];let parent:THREE.Group=body;
 for(let i=0;i<6;i++){const part=new THREE.Group();part.name=`trex-tail-${i}`;part.position.set(0,i===0?2.02:-.07,i===0?.93:.47);parent.add(part);const radius=.36*(1-i/6)+.018;link(part,[0,0,0],[0,-.07,.51],radius,Math.max(.018,radius-.06),p.skin);oval(part,[radius*.85,radius*.4,.30],[0,-radius*.55,.23],p.belly);tails.push(part);parent=part;}
 batch(body);body.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=o.receiveShadow=true;});root.userData.trexRig={body,neck,head,jaw,legs,shins,feet,tails,phase:0,previous:new THREE.Vector3(),initialized:false};return root;
}

function deathGround(trex:Trex,solids:Solid[]){
 let floor:Solid|undefined,height=-Infinity;
 for(const solid of solids)if(solid.kind==='floor'&&footprint(trex,solid,0)){const top=solidTop(solid,trex);if(top<=trex.y+.08&&top>height){floor=solid;height=top;}}
 const normal=new THREE.Vector3(0,1,0);
 if(floor?.ramp){const slope=(floor.ramp.to-floor.ramp.from)/(floor.ramp.axis==='x'?floor.w:floor.d);normal[floor.ramp.axis]=-slope;normal.normalize();}
 return {point:new THREE.Vector3(trex.x,floor?height:trex.y,trex.z),normal};
}
/** Measure actual vertices against the supporting plane, rather than a world
 * bounding box whose lower corner is inaccurate on a sloped street. */
function groundClearance(body:THREE.Group,point:THREE.Vector3,normal:THREE.Vector3){
 body.updateWorldMatrix(true,true);let min=Infinity;const vertex=new THREE.Vector3();
 body.traverseVisible(part=>{if(!(part instanceof THREE.Mesh))return;const p=part.geometry.attributes.position;
  for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld).sub(point);min=Math.min(min,vertex.dot(normal));}
 });return min;
}
export function poseTrex(root:THREE.Group,trex:Trex,time:number,dt:number,solids:Solid[]=[]){
 const rig=root.userData.trexRig;if(!rig||trex.hp<=0&&rig.settledAt===trex.deadAt)return;const {body,neck,jaw,legs,shins,feet,tails}=rig as {body:THREE.Group;neck:THREE.Group;jaw:THREE.Group;legs:THREE.Group[];shins:THREE.Group[];feet:THREE.Group[];tails:THREE.Group[]};
 const distance=rig.initialized?Math.hypot(root.position.x-rig.previous.x,root.position.z-rig.previous.z):0;rig.previous.copy(root.position);rig.initialized=true;if(distance<2&&trex.hp>0)rig.phase+=distance*2.3;
 const speed=dt>0?distance/dt:0,moving=trex.hp>0?Math.min(1,speed/2):0,phase=rig.phase,breath=trex.hp>0?Math.sin(time*.002)*.008:0;
 body.rotation.set(0,0,0);body.position.set(0,breath+Math.cos(phase*2)*.025*moving,0);neck.rotation.x=breath*1.8+Math.sin(phase)*.018*moving;neck.rotation.z=0;
 const attack=trex.state==='attack'?Math.max(0,Math.min(1,(time-trex.attackAt)/720)):0;
 jaw.rotation.x=trex.hp<=0?.35:attack?-.60*Math.sin(attack*Math.PI):-.06-Math.max(0,breath);
 neck.rotation.x-=Math.sin(attack*Math.PI)*.16;
 for(let i=0;i<2;i++){const stride=Math.sin(phase+i*Math.PI)*moving;legs[i].position.x=(i===0?-1:1)*.51;legs[i].rotation.set(stride*.32,0,0);shins[i].rotation.x=-Math.max(0,stride)*.38;feet[i].rotation.x=-legs[i].rotation.x-shins[i].rotation.x;}
 tails.forEach((tail,i)=>{tail.rotation.y=trex.hp>0?Math.sin(time*.0018-i*.5)*(.035+.025*moving):0;tail.rotation.x=trex.hp>0?.015*Math.sin(time*.0013-i*.4):0;});
 if(trex.hp<=0){
  if(rig.groundAt!==trex.deadAt){rig.groundAt=trex.deadAt;rig.ground=deathGround(trex,solids);}
  const {point,normal}=rig.ground as ReturnType<typeof deathGround>,fall=THREE.MathUtils.smoothstep((time-trex.deadAt)/1000,0,1.2),pivot=new THREE.Vector3(0,1.65,0);
  // Fold the legs and relax the neck so an outstretched limb does not prop the
  // rib cage and head above the street after the fall.
  neck.rotation.z=fall*.22;
  for(let i=0;i<2;i++){const side=i===0?-1:1;legs[i].position.x=side*THREE.MathUtils.lerp(.51,.27,fall);legs[i].rotation.set(fall*.4,0,-side*fall*.16);shins[i].rotation.x=-fall*.65;feet[i].rotation.x=fall*.25;}
  const localNormal=normal.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert()),tilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),localNormal);
  body.quaternion.identity().slerp(tilt,fall).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),fall*Math.PI/2));body.position.copy(pivot).sub(pivot.clone().applyQuaternion(body.quaternion));
  // A signed correction removes both penetration and the gap left by the hip
  // pivot as the body rolls onto its side. Keep only a tiny render clearance.
  body.position.y+=(.008-groundClearance(body,point,normal))/normal.y;
  if(fall===1)rig.settledAt=trex.deadAt;
 }else{rig.settledAt=undefined;rig.groundAt=undefined;}
 root.updateWorldMatrix(true,true);
}

export class TrexModels {
 private models=new Map<string,{root:THREE.Group;bar:THREE.Sprite;canvas:HTMLCanvasElement;texture:THREE.CanvasTexture;hp:number;steps:number;previous:THREE.Vector3;lastStep:number}>();
 constructor(private art:WorldArt,private scene:THREE.Scene){}
 update(creatures:Trex[],time:number,dt:number,camera:THREE.Camera,step:(point:Trex)=>void,solids:Solid[]=[]){
  for(const trex of creatures){let entry=this.models.get(trex.id);if(!entry){const root=buildTrex(this.art),canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const bar=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));bar.scale.set(2,.5,1);bar.position.y=4.3;root.add(bar);this.scene.add(root);entry={root,bar,canvas,texture,hp:-1,steps:0,previous:new THREE.Vector3(trex.x,trex.y,trex.z),lastStep:0};this.models.set(trex.id,entry);}
   const {root}=entry;root.position.lerp(new THREE.Vector3(trex.x,trex.y,trex.z),Math.min(1,dt*22));if(entry.hp===-1||trex.hp<=0){root.position.set(trex.x,trex.y,trex.z);root.rotation.y=trex.yaw;}else root.rotation.y+=Math.atan2(Math.sin(trex.yaw-root.rotation.y),Math.cos(trex.yaw-root.rotation.y))*Math.min(1,dt*16);
   const distance=root.position.distanceTo(entry.previous);entry.previous.copy(root.position);if(trex.hp>0&&distance<2){entry.steps+=distance;if(entry.steps>1.4&&time-entry.lastStep>200){entry.steps%=1.4;entry.lastStep=time;step(trex);}}
   if(entry.hp!==trex.hp){entry.hp=trex.hp;const c=entry.canvas.getContext('2d')!;c.clearRect(0,0,256,64);c.fillStyle='rgba(18,24,18,.8)';c.fillRect(0,0,256,64);c.fillStyle='#eee6ce';c.font='bold 24px sans-serif';c.textAlign='center';c.fillText(`T-REX · ${trex.hp} / ${TREX_RULES.hp}`,128,28);c.fillStyle='#652f22';c.fillRect(8,42,240,13);c.fillStyle='#df9256';c.fillRect(8,42,240*trex.hp/TREX_RULES.hp,13);entry.texture.needsUpdate=true;}
   entry.bar.visible=trex.hp>0&&trex.hp<TREX_RULES.hp&&root.position.distanceTo(camera.position)<35;poseTrex(root,trex,time,dt,solids);
  }
  for(const [id,entry] of this.models)if(!creatures.some(t=>t.id===id)){disposeGroup(entry.root);entry.texture.dispose();entry.bar.material.dispose();this.models.delete(id);}
 }
 clear(){for(const entry of this.models.values()){disposeGroup(entry.root);entry.texture.dispose();entry.bar.material.dispose();}this.models.clear();}
}
