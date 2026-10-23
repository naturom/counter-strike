import * as THREE from 'three';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {MAPS,DEFAULT_MAP,DT,move,wallDistance,plantSite,canReachBomb,neutralInput,eyeOf,nearestPickup,weaponLabel,isGun,type MapId,type Equipment,type Motion,type Input,type Snapshot,type Player,type CombatEvent} from '@sirocco/shared';
import {MAP_TOUR} from './map-tour';
import {solidGeometry} from './map-geometry';
import {GameAudio} from './audio';
import {FootstepTracker,surfaceAt} from './combat-audio';
import {ExplosionEffects} from './explosions';
import {WorldArt,disposeGroup} from './world';
export interface ArenaCallbacks {input:(i:Input)=>void;lock:(locked:boolean)=>void;board:(show:boolean)=>void;pickup:(label:string)=>void;damage:(angle:number)=>void;}
export class Arena {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(76,1,.06,350);renderer:THREE.WebGLRenderer;
  private explosions:ExplosionEffects;private blastShake={start:0,duration:1,strength:0};
  private tourIndex:number|null=null;
  private art:WorldArt;private audio=new GameAudio();private world?:RAPIER.World;private physicsReady=false;
  private mapId:MapId=DEFAULT_MAP;private roots=new Map<MapId,THREE.Group>();private mapRoot?:THREE.Group;
  private avatars=new Map<string,THREE.Group>();private gunModels=new Map<Equipment,THREE.Group>();private gun=new THREE.Group();private gunKind:Equipment='rifle';
  private pickups=new Map<string,THREE.Group>();private grenadeMeshes=new Map<number,THREE.Group>();
  private bombMesh?:THREE.Group;private lastBombBeep=0;
  private particles:{mesh:THREE.Mesh;body:RAPIER.RigidBody;until:number}[]=[];
  private traces:{object:THREE.Line|THREE.Mesh;until:number;start:number}[]=[];
  private snapshots:{state:Snapshot;received:number}[]=[];private pending:Input[]=[];
  private predicted:Motion={x:0,y:0,z:0,vy:0,grounded:true,crouched:false};private keys=new Set<string>();
  private active=false;private destroyed=false;private raf=0;private last=0;private accumulator=0;private seq=0;
  private yaw=0;private pitch=0;private fire=false;private reload=false;private jump=false;private interact=false;private weapon:Equipment='rifle';
  private id='';private snap?:Snapshot;private flash:THREE.Mesh;private flashUntil=0;private recoil=0;private swingUntil=0;private hurtUntil=0;
  private localSteps=new FootstepTracker();private lastBeat=0;private remoteStep=new Map<string,FootstepTracker>();private prompt='';
  private observer:ResizeObserver;private reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private canvas:HTMLCanvasElement,private callbacks:ArenaCallbacks){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.9;
    this.explosions=new ExplosionEffects(this.scene,this.reduceMotion);
    this.art=new WorldArt(this.renderer);this.scene.fog=new THREE.Fog('#d5cbb4',120,280);
    const sky=new Sky();sky.scale.setScalar(350);const u=sky.material.uniforms;u.turbidity.value=5;u.rayleigh.value=1.4;u.mieCoefficient.value=.005;u.mieDirectionalG.value=.8;u.sunPosition.value.set(-35,42,28);this.scene.add(sky);
    this.scene.add(new THREE.HemisphereLight('#c8ddf1','#8f7456',.7));const sun=new THREE.DirectionalLight('#ffe7c0',3.1);sun.position.set(-60,95,45);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:230});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;this.scene.add(sun);
    const pmrem=new THREE.PMREMGenerator(this.renderer);const environmentScene=new THREE.Scene();const environmentSky=sky.clone();environmentScene.add(environmentSky);const env=pmrem.fromScene(environmentScene,.04);this.scene.environment=env.texture;this.scene.environmentIntensity=.35;this.art.textures.push(env.texture);pmrem.dispose();
    this.camera.rotation.order='YXZ';this.scene.add(this.camera);this.gun.scale.setScalar(.75);this.gun.position.set(.26,-.28,-.56);this.camera.add(this.gun);this.gun.visible=false;
    this.flash=new THREE.Mesh(new THREE.ConeGeometry(.08,.24,6),new THREE.MeshBasicMaterial({color:'#fff1aa',transparent:true,opacity:.9}));this.flash.rotation.x=-Math.PI/2;this.flash.position.set(0,.035,-.7);this.flash.visible=false;this.gun.add(this.flash);this.setGun('rifle');
    this.setMap(DEFAULT_MAP);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
    document.addEventListener('keydown',this.keydown);document.addEventListener('keyup',this.keyup);document.addEventListener('mousemove',this.mousemove);document.addEventListener('mousedown',this.mousedown);document.addEventListener('mouseup',this.mouseup);document.addEventListener('pointerlockchange',this.lockchange);window.addEventListener('blur',this.blur);
    this.raf=requestAnimationFrame(this.frame);void RAPIER.init().then(()=>{if(this.destroyed)return;this.physicsReady=true;this.resetPhysics();});
  }
  preview(index:number|null){this.tourIndex=index;if(index!==null)this.setMap('dunes');}
  setMap(mapId:MapId){
    if(this.mapRoot&&this.mapId===mapId)return;this.mapId=mapId;this.mapRoot?.removeFromParent();let root=this.roots.get(mapId);if(!root){root=this.art.build(mapId);this.roots.set(mapId,root);}this.mapRoot=root;this.scene.add(root);
    for(const mesh of this.pickups.values())disposeGroup(mesh);this.pickups.clear();
    for(const p of MAPS[mapId].pickups){const g=new THREE.Group(),gun=this.art.weapon(p.weapon,false);gun.scale.setScalar(.8);gun.rotation.z=Math.PI/2;g.add(gun);const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.018,6,32),new THREE.MeshBasicMaterial({color:'#e9b065'}));ring.rotation.x=Math.PI/2;ring.position.y=-.35;g.add(ring);g.position.set(p.x,p.y+.8,p.z);g.userData.floor=p.y;this.scene.add(g);this.pickups.set(p.id,g);}
    if(this.physicsReady)this.resetPhysics();
  }
  private resetPhysics(){for(const p of this.particles){p.mesh.removeFromParent();p.mesh.geometry.dispose();}this.particles=[];this.world?.free();this.world=new RAPIER.World({x:0,y:-18,z:0});for(const b of MAPS[this.mapId].solids){if(b.polygon||b.ramp){const geometry=solidGeometry(b);const positions=new Float32Array(geometry.attributes.position.array),indices=geometry.index?new Uint32Array(geometry.index.array):Uint32Array.from({length:positions.length/3},(_,i)=>i);this.world.createCollider(RAPIER.ColliderDesc.trimesh(positions,indices));geometry.dispose();}else this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.y,b.z));}this.world.createCollider(RAPIER.ColliderDesc.cuboid(90,.1,90).setTranslation(0,-.1,0));this.world.step();}
  private setGun(kind:Equipment){if(this.gunModels.size&&this.gunKind===kind)return;this.gunKind=kind;for(const m of this.gunModels.values())m.visible=false;let m=this.gunModels.get(kind);if(!m){m=this.art.weapon(kind);this.gunModels.set(kind,m);this.gun.add(m);}m.visible=true;this.flash.position.z=kind==='pistol'?-.33:kind==='marksman'?-.97:-.71;}
  private resize(){const r=this.canvas.getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  start(id:string){this.localSteps.reset();this.remoteStep.clear();this.id=id;this.active=true;this.pending=[];this.seq=0;this.snap=undefined;this.snapshots=[];this.keys.clear();this.prompt='';}
  stop(){this.audio.stopCombat();this.localSteps.reset();this.remoteStep.clear();this.blastShake.strength=0;this.audio.stopExplosions();this.explosions.clear();if(this.bombMesh)this.bombMesh.visible=false;this.active=false;this.snap=undefined;this.gun.visible=false;this.pending=[];document.exitPointerLock();this.callbacks.pickup('');for(const a of this.avatars.values())a.visible=false;for(const g of this.grenadeMeshes.values())disposeGroup(g);this.grenadeMeshes.clear();}
  lock(){if(this.active){void this.canvas.requestPointerLock();this.audio.unlock();}}
  setEffects(on:boolean){this.audio.setEnabled(on);}
  update(s:Snapshot){
    if(s.mapId!==this.mapId)this.setMap(s.mapId);
    const me=s.players.find(p=>p.id===this.id),old=this.snap?.players.find(p=>p.id===this.id),oldRound=this.snap?.round;
    if(s.phase==='finished'&&this.snap?.phase!=='finished')document.exitPointerLock();
    // Infer each remote player's gait from server travel, never packet count.
    this.audio.syncReloads(new Set(s.players.filter(p=>p.hp>0&&p.reloadUntil>s.time&&s.phase==='playing').map(p=>p.id)));
    for(const p of s.players){if(p.id===this.id)continue;const steps=this.remoteStep.get(p.id)??new FootstepTracker();
      if(oldRound!==s.round)steps.reset();const gait=steps.update(p,s.time,p.hp>0&&s.phase==='playing');
      if(gait){const at={x:p.x,y:p.y+.18,z:p.z};this.audio.step(gait.crouched,at,surfaceAt(p,MAPS[this.mapId].solids),gait.sprint,this.soundOccluded(at));}
      this.remoteStep.set(p.id,steps);
    }
    this.snap=s;this.snapshots.push({state:s,received:performance.now()});if(this.snapshots.length>8)this.snapshots.shift();if(!me)return;
    const fresh=!old||old.hp<=0&&me.hp>0||oldRound!==s.round||Math.hypot(old.x-me.x,old.z-me.z)>10;
    if(oldRound!==undefined&&oldRound!==s.round){this.blastShake.strength=0;this.audio.stopCombat();this.audio.stopExplosions();this.explosions.clear();}
    if(fresh){this.yaw=me.yaw;this.pitch=me.pitch;this.weapon=me.weapon;this.pending=[];this.localSteps.reset();}
    if(this.weapon==='bomb'&&s.bomb?.carrierId!==me.id){this.weapon=me.weapon==='bomb'?me.primary:me.weapon;this.fire=false;}
    if(old&&old.primary!==me.primary)this.weapon=me.weapon;
    this.seq=Math.max(this.seq,me.ack);this.pending=this.pending.filter(i=>i.seq>me.ack);this.predicted={x:me.x,y:me.y,z:me.z,vy:me.vy,grounded:me.grounded,crouched:me.crouched};
    if(me.hp>0)for(const i of this.pending)this.predicted=move(this.predicted,i,MAPS[this.mapId].solids);
    if(fresh){this.camera.position.set(me.x,me.y+eyeOf(me),me.z);}
    for(const p of s.pickups){const g=this.pickups.get(p.id);if(g)g.visible=p.availableAt<=s.time;}
  }
  private soundOccluded(at:THREE.Vector3|{x:number;y:number;z:number}){
    const dx=at.x-this.camera.position.x,dy=at.y-this.camera.position.y,dz=at.z-this.camera.position.z,d=Math.hypot(dx,dy,dz);
    return d>.2&&wallDistance(this.camera.position,{x:dx/d,y:dy/d,z:dz/d},MAPS[this.mapId].solids)<d-.15;
  }
  combat(e:CombatEvent){
    const mine=e.shooter===this.id,where=mine?undefined:e.from,occluded=!!where&&this.soundOccluded(where);
    if(e.type==='damage'&&e.target===this.id){this.hurtUntil=performance.now()+300;this.audio.hurt();const angle=Math.atan2(e.from.x-this.predicted.x,-(e.from.z-this.predicted.z))+this.yaw;this.callbacks.damage(angle);return;}
    if(e.type==='reload'){if(isGun(e.weapon))this.audio.reload(e.weapon,e.shooter,where,occluded);return;}
    if(e.type==='bombAction'){this.audio.bombAction(where);return;}
    if(e.type==='bombPlant'){this.audio.bombPlanted(e.from);this.lastBombBeep=0;return;}
    if(e.type==='bombDefuse'){this.audio.bombDefused();return;}
    if(e.type==='pickup'){if(mine)this.audio.pickup();return;}
    if(e.type==='melee'){this.audio.knife(where,occluded,e.target?'player':Math.hypot(e.to.x-e.from.x,e.to.y-e.from.y,e.to.z-e.from.z)<1.75?'wall':'air');if(mine)this.swingUntil=performance.now()+300;return;}
    if(e.type==='grenade'){this.audio.grenade(where);if(mine)this.recoil=.12;return;}
    if(e.type==='explosion'){
      const kind=e.weapon==='bomb'?'bomb':'grenade',dx=e.from.x-this.camera.position.x,dy=e.from.y-this.camera.position.y,dz=e.from.z-this.camera.position.z,distance=Math.hypot(dx,dy,dz),now=performance.now();
      const occluded=distance>.1&&wallDistance(this.camera.position,{x:dx/distance,y:dy/distance,z:dz/distance},MAPS[this.mapId].solids)<distance-.2;
      this.audio.explode(e.from,kind,occluded);this.explosions.spawn(e.from,kind,now,MAPS[this.mapId].solids);
      const strength=(kind==='bomb'?.045:.025)*Math.max(0,1-distance/(kind==='bomb'?35:16))*(occluded?.4:1);
      if(strength>0)this.blastShake={start:now,duration:kind==='bomb'?2400:1000,strength};
      this.debris(e.from,{x:0,y:1,z:0},kind==='bomb'?24:14,kind==='bomb'?2:1);return;
    }
    if(e.type!=='shot'||!isGun(e.weapon))return;
    this.audio.shot(e.weapon,where,occluded);if(mine){this.flashUntil=performance.now()+55;this.recoil=e.weapon==='marksman'?.065:.035;}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.from.x,e.from.y-.08,e.from.z),new THREE.Vector3(e.to.x,e.to.y,e.to.z)]),new THREE.LineBasicMaterial({color:e.team==='red'?'#ffc58a':'#d6e8ed',transparent:true,opacity:.65}));this.scene.add(line);this.traces.push({object:line,until:performance.now()+70,start:performance.now()});
    if(this.world){const d={x:e.to.x-e.from.x,y:e.to.y-e.from.y,z:e.to.z-e.from.z},len=Math.hypot(d.x,d.y,d.z);if(len<.1)return;d.x/=len;d.y/=len;d.z/=len;const hit=this.world.castRayAndGetNormal(new RAPIER.Ray(e.from,d),len+.2,true);if(hit)this.debris({x:e.from.x+d.x*hit.timeOfImpact+hit.normal.x*.12,y:e.from.y+d.y*hit.timeOfImpact+hit.normal.y*.12,z:e.from.z+d.z*hit.timeOfImpact+hit.normal.z*.12},hit.normal,3);}
  }
  private debris(point:{x:number;y:number;z:number},normal:{x:number;y:number;z:number},count:number,blast=0){if(!this.world||this.particles.length>54)return;for(let j=0;j<count&&this.particles.length<64;j++){const angle=Math.random()*Math.PI*2,speed=blast?(2+Math.random()*8)*Math.sqrt(blast):0;const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(point.x,point.y,point.z).setLinvel(blast?Math.cos(angle)*speed:normal.x*(1+j)+(Math.random()-.5)*2,blast?2+Math.random()*8:2+j*.3,blast?Math.sin(angle)*speed:normal.z*(1+j)+(Math.random()-.5)*2));this.world.createCollider(RAPIER.ColliderDesc.cuboid(.025,.025,.025).setRestitution(.2),body);const mesh=this.art.box(this.scene,.05,.05,.05,this.art.trim,point.x,point.y,point.z);this.particles.push({mesh,body,until:performance.now()+(blast?2200+blast*700:1100)});}}
  private avatar(p:Player){
    let g=this.avatars.get(p.id);if(g){if(g.userData.weapon!==p.weapon){const old=g.getObjectByName('equippedWeapon');if(old)disposeGroup(old);this.equipAvatar(g,p.weapon);}return g;}g=new THREE.Group();
    const team=this.art.material(p.team==='red'?'#9e5146':'#496c80'),cloth=this.art.material('#4a4e3e'),skin=this.art.material('#b59977');
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.27,.42,5,10),team);torso.position.y=1.05;g.add(torso);this.art.box(g,.48,.5,.35,cloth,0,1.12,.02);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.19,12,10),skin);head.scale.y=1.1;head.position.y=1.61;g.add(head);const helmet=new THREE.Mesh(new THREE.SphereGeometry(.215,12,8,0,Math.PI*2,0,Math.PI*.62),cloth);helmet.position.y=1.65;g.add(helmet);
    for(const side of [-1,1]){const leg=this.art.cylinder(g,.105,.085,.66,cloth,side*.15,.34,0);leg.name=side<0?'leftLeg':'rightLeg';const arm=this.art.cylinder(g,.09,.075,.48,team,side*.34,1.07,-.02);arm.rotation.x=-.35;this.art.box(g,.15,.12,.29,cloth,side*.15,.07,-.055);}
    this.equipAvatar(g,p.weapon);g.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});this.avatars.set(p.id,g);this.scene.add(g);return g;
  }
  private equipAvatar(group:THREE.Group,weapon:Equipment){const gun=this.art.weapon(weapon,false);gun.name='equippedWeapon';gun.scale.setScalar(.75);gun.position.set(.25,1.14,-.22);group.add(gun);group.userData.weapon=weapon;}
  private frame=(now:number)=>{
    if(this.destroyed)return;const dt=Math.min((now-this.last)/1000||0,.1);this.last=now;
    if(this.active&&this.snap){
      const me=this.snap.players.find(p=>p.id===this.id),locked=document.pointerLockElement===this.canvas,solids=MAPS[this.mapId].solids;
      this.accumulator=Math.min(this.accumulator+dt,DT*3);
      while(this.accumulator>=DT){this.accumulator-=DT;const live=!!locked&&!!me&&me.hp>0&&this.snap.phase==='playing';
        const i:Input={...neutralInput(),seq:++this.seq,forward:live?Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS')):0,strafe:live?Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')):0,yaw:this.yaw,pitch:this.pitch,jump:live&&this.jump,sprint:live&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')),fire:live&&this.fire,reload:live&&this.reload,weapon:this.weapon,crouch:live&&(this.keys.has('KeyC')||this.keys.has('ControlLeft')||this.keys.has('ControlRight')),interact:live&&(this.interact||this.keys.has('KeyE'))};
        this.jump=this.reload=this.interact=false;if(me?.hp&&this.snap.phase==='playing')this.predicted=move(this.predicted,i,solids);this.pending.push(i);if(this.pending.length>90)this.pending.shift();this.callbacks.input(i);
        const gait=this.localSteps.update(this.predicted,this.seq*DT*1000,!!me?.hp&&this.snap.phase==='playing');
        if(gait)this.audio.step(gait.crouched,undefined,surfaceAt(this.predicted,solids),gait.sprint);
      }
      const hurt=Math.max(0,(this.hurtUntil-now)/300),shake=this.reduceMotion?0:this.blastShake.strength*Math.max(0,1-(now-this.blastShake.start)/this.blastShake.duration)**2;
      this.camera.position.lerp(new THREE.Vector3(this.predicted.x,this.predicted.y+(me?.hp?eyeOf(this.predicted):.55),this.predicted.z),Math.min(1,dt*22));this.camera.rotation.set(this.pitch+(this.reduceMotion?0:this.recoil*.32+hurt*.035)+Math.sin(now*.043)*shake,this.yaw+Math.sin(now*.037)*shake*.55,this.reduceMotion?0:Math.sin(now*.06)*hurt*.012+Math.sin(now*.051)*shake*.5);
      this.audio.listener={x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z};this.audio.yaw=this.yaw;
      const moving=this.keys.has('KeyW')||this.keys.has('KeyA')||this.keys.has('KeyS')||this.keys.has('KeyD');
      if(me&&me.hp>0&&me.hp<=30&&now-this.lastBeat>1150){this.audio.heartbeat();this.lastBeat=now;}
      this.gun.visible=!!me?.hp&&this.snap.phase==='playing'&&!(this.weapon==='grenade'&&me.grenades===0);this.setGun(this.weapon);this.recoil=Math.max(0,this.recoil-dt*.38);this.gun.position.z=-.56+this.recoil;const swing=this.weapon==='knife'?Math.sin(Math.PI*Math.max(0,(this.swingUntil-now)/300)):0;this.gun.rotation.x=THREE.MathUtils.lerp(this.gun.rotation.x,me?.reloadUntil?-.65:-swing*.9,Math.min(1,dt*8));this.gun.rotation.z=THREE.MathUtils.lerp(this.gun.rotation.z,me?.reloadUntil?-.25:-swing*.7,Math.min(1,dt*8));this.gun.position.y=-.28+(!this.reduceMotion&&moving?Math.sin(now*.013)*.007:0);this.flash.visible=isGun(this.weapon)&&now<this.flashUntil;
      const available=me&&me.hp?nearestPickup(me,this.snap.pickups,this.snap.time,solids):undefined;const bomb=this.snap.bomb;let label=available?`E · PICK UP ${weaponLabel(available.weapon)}`:'';if(me?.hp&&bomb){if(bomb.status==='dropped'&&me.team==='red'&&canReachBomb(me,bomb,solids))label='E · RECOVER C4';else if(bomb.status==='planted'&&me.team==='blue'&&canReachBomb(me,bomb,solids))label='HOLD E · DEFUSE C4';else if(bomb.carrierId===me.id&&plantSite(me,this.mapId))label=this.weapon==='bomb'?'HOLD LEFT CLICK · PLANT C4':'5 · SELECT C4 TO PLANT';}if(label!==this.prompt){this.prompt=label;this.callbacks.pickup(label);}
      if(bomb){
        if(!this.bombMesh){this.bombMesh=this.art.weapon('bomb',false);this.scene.add(this.bombMesh);}
        this.bombMesh.visible=bomb.status==='dropped'||bomb.status==='planted';this.bombMesh.position.set(bomb.x,bomb.y+.12,bomb.z);
        const left=bomb.explodeAt-this.snap.time-(now-(this.snapshots.at(-1)?.received??now));
        if(bomb.status==='planted'&&left>0&&now-this.lastBombBeep>Math.max(120,left/40000*1000)){this.audio.bombBeep(bomb);this.lastBombBeep=now;}
        const light=this.bombMesh.getObjectByName('bombLight');if(light)light.visible=bomb.status==='planted'&&now-this.lastBombBeep<100;
      }else if(this.bombMesh)this.bombMesh.visible=false;
      const renderTime=now-100;let a=this.snapshots[0],b=this.snapshots.at(-1)!;for(let j=1;j<this.snapshots.length;j++)if(this.snapshots[j].received>=renderTime){a=this.snapshots[j-1];b=this.snapshots[j];break;}const t=a&&b?THREE.MathUtils.clamp((renderTime-a.received)/Math.max(1,b.received-a.received),0,1):1;
      for(const p of this.snap.players){if(p.id===this.id)continue;const avatar=this.avatar(p);avatar.visible=p.hp>0;const previous=a?.state.players.find(q=>q.id===p.id)??p,next=b?.state.players.find(q=>q.id===p.id)??p;avatar.position.set(THREE.MathUtils.lerp(previous.x,next.x,t),THREE.MathUtils.lerp(previous.y,next.y,t),THREE.MathUtils.lerp(previous.z,next.z,t));avatar.rotation.y=next.yaw;avatar.scale.y=THREE.MathUtils.lerp(avatar.scale.y,p.crouched?.61:1,Math.min(1,dt*12));const walking=Math.hypot(next.x-previous.x,next.z-previous.z)>.025;for(const [i,name] of ['leftLeg','rightLeg'].entries()){const leg=avatar.getObjectByName(name);if(leg)leg.rotation.x=walking?Math.sin(now*.014+i*Math.PI)*.32:0;}}
      for(const [id,g] of this.avatars)if(!this.snap.players.some(p=>p.id===id)){disposeGroup(g);this.avatars.delete(id);this.remoteStep.delete(id);}
      for(const g of this.snap.grenades){let mesh=this.grenadeMeshes.get(g.id);if(!mesh){mesh=new THREE.Group();const shell=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),this.art.dark);mesh.add(shell);this.art.box(mesh,.04,.1,.06,this.art.metal,0,.14,0);const glow=new THREE.Mesh(new THREE.SphereGeometry(.025,6,6),new THREE.MeshBasicMaterial({color:'#ff5639'}));glow.position.y=.18;mesh.add(glow);this.grenadeMeshes.set(g.id,mesh);this.scene.add(mesh);}mesh.position.lerp(new THREE.Vector3(g.x,g.y,g.z),Math.min(1,dt*25));mesh.rotation.z=now*.004;}
      for(const [id,g] of this.grenadeMeshes)if(!this.snap.grenades.some(p=>p.id===id)){disposeGroup(g);this.grenadeMeshes.delete(id);}
    }else if(this.tourIndex!==null){const view=MAP_TOUR[this.tourIndex];this.camera.position.set(view.eye.x,view.eye.y,view.eye.z);this.camera.lookAt(view.target.x,view.target.y,view.target.z);}else{const a=now*.000012;if(this.mapId==='dunes'){this.camera.position.set(68+Math.sin(a)*4,65,78+Math.cos(a)*3);this.camera.lookAt(0,0,-5);}else{this.camera.position.set(38+Math.sin(a)*4,31,38+Math.cos(a)*3);this.camera.lookAt(-1,0,0);}}
    for(const p of this.pickups.values()){p.rotation.y=now*.0006;p.position.y=(p.userData.floor??0)+.85+Math.sin(now*.002)*.07;}
    if(this.world){this.world.timestep=Math.max(1/120,Math.min(dt,1/30));this.world.step();for(const p of this.particles){const pos=p.body.translation();p.mesh.position.set(pos.x,pos.y,pos.z);p.mesh.quaternion.copy(p.body.rotation());}this.particles=this.particles.filter(p=>{if(now<p.until)return true;p.mesh.removeFromParent();p.mesh.geometry.dispose();this.world!.removeRigidBody(p.body);return false;});}
    this.traces=this.traces.filter(p=>{if(now<p.until)return true;p.object.removeFromParent();p.object.geometry.dispose();(p.object.material as THREE.Material).dispose();return false;});
    this.explosions.update(now);
    this.renderer.render(this.scene,this.camera);this.raf=requestAnimationFrame(this.frame);
  };
  private keydown=(e:KeyboardEvent)=>{if(!this.active||e.target instanceof HTMLInputElement)return;if(['Tab','Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ControlLeft','ControlRight','KeyC','KeyR','KeyE','Digit1','Digit2','Digit3','Digit4','Digit5'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.code==='Tab')this.callbacks.board(true);if(document.pointerLockElement!==this.canvas)return;if(e.code==='Space'&&!e.repeat)this.jump=true;if(e.code==='KeyR'&&!e.repeat)this.reload=true;if(e.code==='KeyE'&&!e.repeat)this.interact=true;if(e.code==='Digit1')this.weapon='knife';if(e.code==='Digit2')this.weapon=this.snap?.players.find(p=>p.id===this.id)?.primary??'rifle';if(e.code==='Digit3')this.weapon='pistol';if(e.code==='Digit4')this.weapon='grenade';if(e.code==='Digit5'&&this.snap?.bomb?.carrierId===this.id)this.weapon='bomb';};
  private keyup=(e:KeyboardEvent)=>{this.keys.delete(e.code);if(e.code==='Tab')this.callbacks.board(false);};
  private mousemove=(e:MouseEvent)=>{if(document.pointerLockElement!==this.canvas)return;this.yaw=(this.yaw-e.movementX*.002+Math.PI*3)%(Math.PI*2)-Math.PI;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.002,-1.5,1.5);};
  private mousedown=(e:MouseEvent)=>{if(e.button===0&&document.pointerLockElement===this.canvas)this.fire=true;};
  private mouseup=()=>{this.fire=false;};private blur=()=>{this.keys.clear();this.fire=this.jump=this.reload=this.interact=false;};private lockchange=()=>{this.blur();this.callbacks.lock(document.pointerLockElement===this.canvas);};
  destroy(){this.explosions.destroy();this.destroyed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();document.removeEventListener('keydown',this.keydown);document.removeEventListener('keyup',this.keyup);document.removeEventListener('mousemove',this.mousemove);document.removeEventListener('mousedown',this.mousedown);document.removeEventListener('mouseup',this.mouseup);document.removeEventListener('pointerlockchange',this.lockchange);window.removeEventListener('blur',this.blur);this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line)o.geometry.dispose();});this.art.destroy();this.world?.free();this.renderer.dispose();this.audio.destroy();}
}
