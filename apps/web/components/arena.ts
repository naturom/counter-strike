import * as THREE from 'three';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {MAPS,DEFAULT_MAP,DT,WEAPONS,move,wallDistance,plantSite,canReachBomb,neutralInput,eyeOf,nearestPickup,weaponLabel,isGun,type Team,type MapId,type Equipment,type Motion,type Input,type Snapshot,type Player,type CombatEvent} from '@sirocco/shared';
import {MAP_TOUR} from './map-tour';
import {solidGeometry} from './map-geometry';
import {GameAudio} from './audio';
import {FootstepTracker,LandingTracker,surfaceAt} from './combat-audio';
import {ExplosionEffects} from './explosions';
import {WorldArt,disposeGroup} from './world';
import {animateHands} from './held-equipment';
import {KNIFE_SWING_MS} from './knife-swing';
import {heldShotOrigin} from './shot-origin';
import {MUZZLE_Z} from './weapon-models';
import {SniperScope,BASE_FOV,scopeFov,type ScopeLevel} from './sniper-scope';
export interface ArenaCallbacks {input:(i:Input)=>void;lock:(locked:boolean)=>void;board:(show:boolean)=>void;pickup:(label:string)=>void;damage:(angle:number)=>void;scope:(level:ScopeLevel)=>void;}
export class Arena {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(76,1,.06,350);renderer:THREE.WebGLRenderer;
  private viewScene=new THREE.Scene();private viewCamera=new THREE.PerspectiveCamera(65,1,.025,8);
  private scope=new SniperScope();private shownScope:ScopeLevel=0;private cycleUntil=0;
  private throwUntil=0;private equippedAt=0;
  private explosions:ExplosionEffects;private blastShake={start:0,duration:1,strength:0};
  private tourIndex:number|null=null;
  private art:WorldArt;private audio=new GameAudio();private world?:RAPIER.World;private physicsReady=false;
  private mapId:MapId=DEFAULT_MAP;private roots=new Map<MapId,THREE.Group>();private mapRoot?:THREE.Group;
  private avatars=new Map<string,THREE.Group>();private gunModels=new Map<Equipment,THREE.Group>();private gun=new THREE.Group();private gunKind:Equipment='rifle';
  private pickups=new Map<string,THREE.Group>();private grenadeMeshes=new Map<number,THREE.Group>();
  private bombMeshes=new Map<Team,THREE.Group>();private lastBombBeeps=new Map<Team,number>();
  private particles:{mesh:THREE.Mesh;body:RAPIER.RigidBody;until:number}[]=[];
  private traces:{object:THREE.Line|THREE.Mesh;until:number;start:number;localWeapon?:keyof typeof MUZZLE_Z}[]=[];
  private snapshots:{state:Snapshot;received:number}[]=[];private pending:Input[]=[];
  private predicted:Motion={x:0,y:0,z:0,vy:0,grounded:true,crouched:false};private keys=new Set<string>();
  private active=false;private destroyed=false;private raf=0;private last=0;private accumulator=0;private seq=0;
  private yaw=0;private pitch=0;private fire=false;private reload=false;private jump=false;private interact=false;private weapon:Equipment='rifle';
  private id='';private snap?:Snapshot;private flash:THREE.Mesh;private flashUntil=0;private recoil=0;private swingStarted=-Infinity;private reverseSlash=true;private hurtUntil=0;
  private localSteps=new FootstepTracker();private localLanding=new LandingTracker();private remoteLanding=new Map<string,LandingTracker>();private lastBeat=0;private remoteStep=new Map<string,FootstepTracker>();private prompt='';
  private observer:ResizeObserver;private reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private canvas:HTMLCanvasElement,private callbacks:ArenaCallbacks){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
    this.explosions=new ExplosionEffects(this.scene,this.reduceMotion);
    this.art=new WorldArt(this.renderer);this.scene.fog=new THREE.Fog('#d5cbb4',120,280);
    const sky=new Sky();sky.scale.setScalar(350);const u=sky.material.uniforms;u.turbidity.value=5;u.rayleigh.value=1.4;u.mieCoefficient.value=.005;u.mieDirectionalG.value=.8;u.sunPosition.value.set(-35,42,28);this.scene.add(sky);
    this.scene.add(new THREE.HemisphereLight('#d4e3ed','#96846b',.85));const sun=new THREE.DirectionalLight('#fff0d8',3.1);sun.position.set(-60,95,45);sun.castShadow=true;sun.shadow.radius=2;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:230});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;this.scene.add(sun);
    const pmrem=new THREE.PMREMGenerator(this.renderer);const environmentScene=new THREE.Scene();const environmentSky=sky.clone();environmentScene.add(environmentSky);const env=pmrem.fromScene(environmentScene,.04);this.scene.environment=env.texture;this.scene.environmentIntensity=.12;this.art.textures.push(env.texture);pmrem.dispose();
    this.camera.rotation.order='YXZ';this.scene.add(this.camera);this.gun.scale.setScalar(.75);this.gun.position.set(.22,-.23,-.74);this.viewScene.add(this.gun);this.viewScene.add(new THREE.HemisphereLight('#dce8ef','#60513d',1.6));const handLight=new THREE.DirectionalLight('#ffedce',2.5);handLight.position.set(-2,4,3);this.viewScene.add(handLight);this.viewScene.environment=env.texture;this.viewScene.environmentIntensity=.45;this.gun.visible=false;
    this.flash=new THREE.Mesh(new THREE.ConeGeometry(.08,.24,6),new THREE.MeshBasicMaterial({color:'#fff1aa',transparent:true,opacity:.9}));this.flash.rotation.x=-Math.PI/2;this.flash.position.set(0,.035,-.7);this.flash.visible=false;this.gun.add(this.flash);this.setGun('rifle');
    this.setMap(DEFAULT_MAP);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
    document.addEventListener('keydown',this.keydown);document.addEventListener('keyup',this.keyup);document.addEventListener('mousemove',this.mousemove);document.addEventListener('mousedown',this.mousedown);document.addEventListener('mouseup',this.mouseup);this.canvas.addEventListener('contextmenu',this.contextmenu);document.addEventListener('pointerlockchange',this.lockchange);window.addEventListener('blur',this.blur);
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
  private setGun(kind:Equipment){if(this.gunModels.size&&this.gunKind===kind)return;this.gunKind=kind;this.swingStarted=-Infinity;this.reverseSlash=true;this.equippedAt=performance.now();for(const m of this.gunModels.values())m.visible=false;let m=this.gunModels.get(kind);if(!m){m=this.art.weapon(kind);this.gunModels.set(kind,m);this.gun.add(m);}m.visible=true;this.flash.position.z=isGun(kind)?MUZZLE_Z[kind]:-.7;this.resetScope();}
  private resize(){const r=this.canvas.getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.viewCamera.aspect=r.width/r.height;this.viewCamera.updateProjectionMatrix();}
  private resetScope(){this.scope.reset();if(this.shownScope){this.shownScope=0;this.callbacks.scope(0);}this.camera.fov=BASE_FOV;this.camera.updateProjectionMatrix();}
  private scopeContext(){const me=this.snap?.players.find(p=>p.id===this.id);return {weapon:this.weapon,alive:!!me?.hp,locked:document.pointerLockElement===this.canvas,reloading:!!me&&me.reloadUntil>this.snap!.time,sprinting:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'),playing:this.active&&this.snap?.phase==='playing'};}
  start(id:string){this.resetScope();this.localSteps.reset();this.localLanding.reset();this.remoteStep.clear();this.remoteLanding.clear();this.id=id;this.active=true;this.pending=[];this.seq=0;this.snap=undefined;this.snapshots=[];this.keys.clear();this.prompt='';}
  stop(){this.resetScope();this.audio.stopCombat();this.localSteps.reset();this.localLanding.reset();this.remoteStep.clear();this.remoteLanding.clear();this.blastShake.strength=0;this.audio.stopExplosions();this.explosions.clear();for(const mesh of this.bombMeshes.values())mesh.visible=false;this.active=false;this.snap=undefined;this.gun.visible=false;this.pending=[];document.exitPointerLock();this.callbacks.pickup('');for(const a of this.avatars.values())a.visible=false;for(const g of this.grenadeMeshes.values())disposeGroup(g);this.grenadeMeshes.clear();}
  lock(){if(this.active){void this.canvas.requestPointerLock();this.audio.unlock();}}
  setEffects(on:boolean){this.audio.setEnabled(on);}
  update(s:Snapshot){
    if(s.mapId!==this.mapId)this.setMap(s.mapId);
    const me=s.players.find(p=>p.id===this.id),old=this.snap?.players.find(p=>p.id===this.id),oldRound=this.snap?.round;
    if(s.phase==='finished'&&this.snap?.phase!=='finished')document.exitPointerLock();
    // Infer each remote player's gait from server travel, never packet count.
    this.audio.syncReloads(new Set(s.players.filter(p=>p.hp>0&&p.reloadUntil>s.time&&s.phase==='playing').map(p=>p.id)));
    for(const p of s.players){if(p.id===this.id)continue;const steps=this.remoteStep.get(p.id)??new FootstepTracker();
      const landing=this.remoteLanding.get(p.id)??new LandingTracker();if(oldRound!==s.round){steps.reset();landing.reset();}const impact=landing.update(p,s.time,p.hp>0&&p.connected&&s.phase==='playing');this.remoteLanding.set(p.id,landing);if(impact){const at={x:p.x,y:p.y+.18,z:p.z};this.audio.land(impact.strength,at,surfaceAt(p,MAPS[this.mapId].solids),this.soundOccluded(at));}
      const gait=steps.update(p,s.time,p.hp>0&&s.phase==='playing');
      if(gait){const at={x:p.x,y:p.y+.18,z:p.z};this.audio.step(gait.crouched,at,surfaceAt(p,MAPS[this.mapId].solids),gait.sprint,this.soundOccluded(at));}
      this.remoteStep.set(p.id,steps);
    }
    this.snap=s;this.snapshots.push({state:s,received:performance.now()});if(this.snapshots.length>8)this.snapshots.shift();if(!me)return;
    const fresh=!old||old.hp<=0&&me.hp>0||oldRound!==s.round||Math.hypot(old.x-me.x,old.z-me.z)>10;
    if(oldRound!==undefined&&oldRound!==s.round){this.blastShake.strength=0;this.audio.stopCombat();this.audio.stopExplosions();this.explosions.clear();}
    if(fresh){this.yaw=me.yaw;this.pitch=me.pitch;this.weapon=me.weapon;this.pending=[];this.localSteps.reset();this.localLanding.reset();}
    if(this.weapon==='bomb'&&!s.bombs.some(b=>b.carrierId===me.id)){this.weapon=me.weapon==='bomb'?me.primary:me.weapon;this.fire=false;}
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
    if(e.type==='bombPlant'){this.audio.bombPlanted(e.from);this.lastBombBeeps.clear();return;}
    if(e.type==='bombDefuse'){this.audio.bombDefused();return;}
    if(e.type==='pickup'){if(mine)this.audio.pickup();return;}
    if(e.type==='melee'){this.audio.knife(where,occluded,e.target?'player':Math.hypot(e.to.x-e.from.x,e.to.y-e.from.y,e.to.z-e.from.z)<1.75?'wall':'air');if(mine){this.swingStarted=performance.now();this.reverseSlash=!this.reverseSlash;}return;}
    if(e.type==='grenade'){this.audio.grenade(where);if(mine){this.recoil=.12;this.throwUntil=performance.now()+460;}return;}
    if(e.type==='explosion'){
      const kind=e.weapon==='bomb'?'bomb':'grenade',dx=e.from.x-this.camera.position.x,dy=e.from.y-this.camera.position.y,dz=e.from.z-this.camera.position.z,distance=Math.hypot(dx,dy,dz),now=performance.now();
      const occluded=distance>.1&&wallDistance(this.camera.position,{x:dx/distance,y:dy/distance,z:dz/distance},MAPS[this.mapId].solids)<distance-.2;
      this.audio.explode(e.from,kind,occluded);this.explosions.spawn(e.from,kind,now,MAPS[this.mapId].solids);
      const strength=(kind==='bomb'?.045:.025)*Math.max(0,1-distance/(kind==='bomb'?35:16))*(occluded?.4:1);
      if(strength>0)this.blastShake={start:now,duration:kind==='bomb'?2400:1000,strength};
      this.debris(e.from,{x:0,y:1,z:0},kind==='bomb'?24:14,kind==='bomb'?2:1);return;
    }
    if(e.type!=='shot'||!isGun(e.weapon))return;
    this.audio.shot(e.weapon,where,occluded);if(mine){this.flashUntil=performance.now()+55;this.recoil=e.weapon==='marksman'?.065:.035;this.cycleUntil=performance.now()+(e.weapon==='marksman'?550:130);if(e.weapon==='marksman')this.resetScope();}
    const localWeapon=mine&&this.gun.visible?e.weapon:undefined;
    let origin=localWeapon?heldShotOrigin(this.gun,localWeapon,this.viewCamera,this.camera):new THREE.Vector3(e.from.x,e.from.y,e.from.z);
    if(!mine){const held=this.avatars.get(e.shooter)?.getObjectByName('equippedWeapon');if(held){held.updateWorldMatrix(true,false);origin=held.localToWorld(new THREE.Vector3(0,.035,MUZZLE_Z[e.weapon]));}}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,new THREE.Vector3(e.to.x,e.to.y,e.to.z)]),new THREE.LineBasicMaterial({color:e.team==='red'?'#ffc58a':'#d6e8ed',transparent:true,opacity:.65}));this.scene.add(line);this.traces.push({object:line,until:performance.now()+70,start:performance.now(),localWeapon});
    if(this.world){const d={x:e.to.x-e.from.x,y:e.to.y-e.from.y,z:e.to.z-e.from.z},len=Math.hypot(d.x,d.y,d.z);if(len<.1)return;d.x/=len;d.y/=len;d.z/=len;const hit=this.world.castRayAndGetNormal(new RAPIER.Ray(e.from,d),len+.2,true);if(hit)this.debris({x:e.from.x+d.x*hit.timeOfImpact+hit.normal.x*.12,y:e.from.y+d.y*hit.timeOfImpact+hit.normal.y*.12,z:e.from.z+d.z*hit.timeOfImpact+hit.normal.z*.12},hit.normal,3);}
  }
  private debris(point:{x:number;y:number;z:number},normal:{x:number;y:number;z:number},count:number,blast=0){if(!this.world||this.particles.length>54)return;for(let j=0;j<count&&this.particles.length<64;j++){const angle=Math.random()*Math.PI*2,speed=blast?(2+Math.random()*8)*Math.sqrt(blast):0;const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(point.x,point.y,point.z).setLinvel(blast?Math.cos(angle)*speed:normal.x*(1+j)+(Math.random()-.5)*2,blast?2+Math.random()*8:2+j*.3,blast?Math.sin(angle)*speed:normal.z*(1+j)+(Math.random()-.5)*2));this.world.createCollider(RAPIER.ColliderDesc.cuboid(.025,.025,.025).setRestitution(.2),body);const mesh=this.art.box(this.scene,.05,.05,.05,this.art.trim,point.x,point.y,point.z);this.particles.push({mesh,body,until:performance.now()+(blast?2200+blast*700:1100)});}}
  private avatar(p:Player){
    let g=this.avatars.get(p.id);if(g){if(g.userData.weapon!==p.weapon){const old=g.getObjectByName('equippedWeapon');if(old)disposeGroup(old);this.equipAvatar(g,p.weapon);}return g;}g=new THREE.Group();
    const team=this.art.material(p.team==='red'?'#9e5146':'#496c80'),cloth=this.art.material('#4a4e3e'),skin=this.art.material('#b59977');
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.27,.42,5,10),team);torso.position.y=1.05;g.add(torso);this.art.box(g,.48,.5,.35,cloth,0,1.12,.02);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.19,12,10),skin);head.scale.y=1.1;head.position.y=1.61;g.add(head);const helmet=new THREE.Mesh(new THREE.SphereGeometry(.215,12,8,0,Math.PI*2,0,Math.PI*.62),cloth);helmet.position.y=1.65;g.add(helmet);
    for(const side of [-1,1]){const leg=this.art.cylinder(g,.105,.085,.66,cloth,side*.15,.34,0);leg.name=side<0?'leftLeg':'rightLeg';this.art.box(g,.15,.12,.29,cloth,side*.15,.07,-.055);}
    this.equipAvatar(g,p.weapon);g.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});this.avatars.set(p.id,g);this.scene.add(g);return g;
  }
  private equipAvatar(group:THREE.Group,weapon:Equipment){const gun=this.art.weapon(weapon,false,true);gun.name='equippedWeapon';gun.scale.setScalar(.75);gun.position.set(.25,1.14,-.22);group.add(gun);group.userData.weapon=weapon;}
  private frame=(now:number)=>{
    if(this.destroyed)return;const dt=Math.min((now-this.last)/1000||0,.1);this.last=now;
    if(this.active&&this.snap){
      const me=this.snap.players.find(p=>p.id===this.id),locked=document.pointerLockElement===this.canvas,solids=MAPS[this.mapId].solids;
      this.accumulator=Math.min(this.accumulator+dt,DT*3);
      while(this.accumulator>=DT){this.accumulator-=DT;const live=!!locked&&!!me&&me.hp>0&&this.snap.phase==='playing';
        const i:Input={...neutralInput(),seq:++this.seq,forward:live?Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS')):0,strafe:live?Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')):0,yaw:this.yaw,pitch:this.pitch,jump:live&&this.jump,sprint:live&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')),fire:live&&this.fire,reload:live&&this.reload,weapon:this.weapon,crouch:live&&(this.keys.has('KeyC')||this.keys.has('ControlLeft')||this.keys.has('ControlRight')),interact:live&&(this.interact||this.keys.has('KeyE'))};
        this.jump=this.reload=this.interact=false;if(me?.hp&&this.snap.phase==='playing')this.predicted=move(this.predicted,i,solids);this.pending.push(i);if(this.pending.length>90)this.pending.shift();this.callbacks.input(i);
        const gait=this.localSteps.update(this.predicted,this.seq*DT*1000,!!me?.hp&&this.snap.phase==='playing');
        const impact=this.localLanding.update(this.predicted,this.seq*DT*1000,!!me?.hp&&this.snap.phase==='playing');if(impact)this.audio.land(impact.strength,undefined,surfaceAt(this.predicted,solids));
        if(gait)this.audio.step(gait.crouched,undefined,surfaceAt(this.predicted,solids),gait.sprint);
      }
      const hurt=Math.max(0,(this.hurtUntil-now)/300),shake=this.reduceMotion?0:this.blastShake.strength*Math.max(0,1-(now-this.blastShake.start)/this.blastShake.duration)**2;
      this.camera.position.lerp(new THREE.Vector3(this.predicted.x,this.predicted.y+(me?.hp?eyeOf(this.predicted):.55),this.predicted.z),Math.min(1,dt*22));this.camera.rotation.set(this.pitch+(this.reduceMotion?0:this.recoil*.32+hurt*.035)+Math.sin(now*.043)*shake,this.yaw+Math.sin(now*.037)*shake*.55,this.reduceMotion?0:Math.sin(now*.06)*hurt*.012+Math.sin(now*.051)*shake*.5);
      this.audio.listener={x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z};this.audio.yaw=this.yaw;
      const moving=this.keys.has('KeyW')||this.keys.has('KeyA')||this.keys.has('KeyS')||this.keys.has('KeyD');
      if(me&&me.hp>0&&me.hp<=30&&now-this.lastBeat>1150){this.audio.heartbeat();this.lastBeat=now;}
      this.setGun(this.weapon);const scopeLevel=this.scope.sync(this.scopeContext());if(scopeLevel!==this.shownScope){this.shownScope=scopeLevel;this.callbacks.scope(scopeLevel);}
      const targetFov=scopeFov(scopeLevel);this.camera.fov=this.reduceMotion?targetFov:THREE.MathUtils.lerp(this.camera.fov,targetFov,Math.min(1,dt*22));if(Math.abs(this.camera.fov-targetFov)<.01)this.camera.fov=targetFov;this.camera.updateProjectionMatrix();
      this.gun.visible=!scopeLevel&&!!me?.hp&&this.snap.phase==='playing'&&(!(this.weapon==='grenade'&&me.grenades===0)||now<this.throwUntil);
      this.recoil=Math.max(0,this.recoil-dt*.38);
      const slashProgress=this.weapon==='knife'?THREE.MathUtils.clamp((now-this.swingStarted)/KNIFE_SWING_MS,0,1):1;
      const reloadProgress=me&&isGun(this.weapon)&&me.reloadUntil>this.snap.time?THREE.MathUtils.clamp(1-(me.reloadUntil-this.snap.time)/WEAPONS[this.weapon].reload,0,1):0;
      const throwProgress=now<this.throwUntil?1-(this.throwUntil-now)/460:0;
      const planting=this.snap.bombs.find(b=>b.action?.kind==='plant'&&b.action.playerId===this.id)?.action;
      const plantProgress=planting?THREE.MathUtils.clamp((this.snap.time-planting.startedAt)/(planting.completeAt-planting.startedAt),0,1):0;
      const draw=this.reduceMotion?0:Math.max(0,1-(now-this.equippedAt)/240),throwArc=this.weapon==='grenade'?Math.sin(Math.PI*throwProgress):0;
      this.gun.position.set(.22,-.23+(!this.reduceMotion&&moving?Math.sin(now*.013)*.007:0)-draw*.14-plantProgress*.06,-.74+this.recoil+draw*.12);
      this.gun.rotation.x=THREE.MathUtils.lerp(this.gun.rotation.x,reloadProgress?-.3*Math.sin(Math.PI*reloadProgress):throwArc*.6,Math.min(1,dt*14));
      this.gun.rotation.z=THREE.MathUtils.lerp(this.gun.rotation.z,reloadProgress?-.24*Math.sin(Math.PI*reloadProgress):0,Math.min(1,dt*14));
      const held=this.gunModels.get(this.weapon);if(held){animateHands(held,this.weapon,{reload:reloadProgress,throwProgress,plant:plantProgress,slash:slashProgress,reverseSlash:this.reverseSlash,reduceMotion:this.reduceMotion});const body=held.getObjectByName('equipmentBody'),action=body?.getObjectByName(this.weapon==='marksman'?'bolt':'slide');if(action){const duration=this.weapon==='marksman'?550:130,p=THREE.MathUtils.clamp(1-(this.cycleUntil-now)/duration,0,1);action.position.z=p>0&&p<1?Math.sin(p*Math.PI)*.055:0;}}
      this.flash.visible=isGun(this.weapon)&&now<this.flashUntil;

      const available=me&&me.hp?nearestPickup(me,this.snap.pickups,this.snap.time,solids):undefined;
      const ownBomb=this.snap.bombs.find(b=>b.team===me?.team),enemyBomb=this.snap.bombs.find(b=>b.team!==me?.team);
      let label=available?`E · PICK UP ${weaponLabel(available.weapon)}`:'';
      if(me?.hp){
        if(ownBomb?.status==='dropped'&&canReachBomb(me,ownBomb,solids))label='E · RECOVER YOUR C4';
        else if(ownBomb?.carrierId===me.id&&plantSite(me,this.mapId,me.team))label=this.weapon==='bomb'?'HOLD LEFT CLICK · PLANT C4':'5 · SELECT C4 TO PLANT';
        if(enemyBomb?.status==='planted'&&canReachBomb(me,enemyBomb,solids))label='HOLD E · DEFUSE ENEMY C4';
      }
      if(label!==this.prompt){this.prompt=label;this.callbacks.pickup(label);}
      for(const bomb of this.snap.bombs){
        let mesh=this.bombMeshes.get(bomb.team);if(!mesh){mesh=this.art.weapon('bomb',false);this.scene.add(mesh);this.bombMeshes.set(bomb.team,mesh);}
        mesh.visible=bomb.status==='dropped'||bomb.status==='planted';mesh.position.set(bomb.x,bomb.y+.12,bomb.z);
        const left=bomb.explodeAt-this.snap.time-(now-(this.snapshots.at(-1)?.received??now)),last=this.lastBombBeeps.get(bomb.team)??0;
        if(bomb.status==='planted'&&left>0&&now-last>Math.max(120,left/40000*1000)){this.audio.bombBeep(bomb);this.lastBombBeeps.set(bomb.team,now);}
        const light=mesh.getObjectByName('bombLight');if(light)light.visible=bomb.status==='planted'&&now-(this.lastBombBeeps.get(bomb.team)??0)<100;
      }
      const renderTime=now-100;let a=this.snapshots[0],b=this.snapshots.at(-1)!;for(let j=1;j<this.snapshots.length;j++)if(this.snapshots[j].received>=renderTime){a=this.snapshots[j-1];b=this.snapshots[j];break;}const t=a&&b?THREE.MathUtils.clamp((renderTime-a.received)/Math.max(1,b.received-a.received),0,1):1;
      for(const p of this.snap.players){if(p.id===this.id)continue;const avatar=this.avatar(p);avatar.visible=p.hp>0;const previous=a?.state.players.find(q=>q.id===p.id)??p,next=b?.state.players.find(q=>q.id===p.id)??p;avatar.position.set(THREE.MathUtils.lerp(previous.x,next.x,t),THREE.MathUtils.lerp(previous.y,next.y,t),THREE.MathUtils.lerp(previous.z,next.z,t));avatar.rotation.y=next.yaw;avatar.scale.y=THREE.MathUtils.lerp(avatar.scale.y,p.crouched?.61:1,Math.min(1,dt*12));const walking=Math.hypot(next.x-previous.x,next.z-previous.z)>.025;for(const [i,name] of ['leftLeg','rightLeg'].entries()){const leg=avatar.getObjectByName(name);if(leg)leg.rotation.x=walking?Math.sin(now*.014+i*Math.PI)*.32:0;}}
      for(const [id,g] of this.avatars)if(!this.snap.players.some(p=>p.id===id)){disposeGroup(g);this.avatars.delete(id);this.remoteStep.delete(id);this.remoteLanding.delete(id);}
      for(const g of this.snap.grenades){let mesh=this.grenadeMeshes.get(g.id);if(!mesh){mesh=this.art.weapon('grenade',false);mesh.scale.setScalar(1.4);this.grenadeMeshes.set(g.id,mesh);this.scene.add(mesh);}mesh.position.lerp(new THREE.Vector3(g.x,g.y,g.z),Math.min(1,dt*25));mesh.rotation.z=now*.004;}
      for(const [id,g] of this.grenadeMeshes)if(!this.snap.grenades.some(p=>p.id===id)){disposeGroup(g);this.grenadeMeshes.delete(id);}
    }else if(this.tourIndex!==null){const view=MAP_TOUR[this.tourIndex];this.camera.position.set(view.eye.x,view.eye.y,view.eye.z);this.camera.lookAt(view.target.x,view.target.y,view.target.z);}else{const a=now*.000012;if(this.mapId==='dunes'){this.camera.position.set(68+Math.sin(a)*4,65,78+Math.cos(a)*3);this.camera.lookAt(0,0,-5);}else{this.camera.position.set(38+Math.sin(a)*4,31,38+Math.cos(a)*3);this.camera.lookAt(-1,0,0);}}
    for(const p of this.pickups.values()){p.rotation.y=now*.0006;p.position.y=(p.userData.floor??0)+.85+Math.sin(now*.002)*.07;}
    if(this.world){this.world.timestep=Math.max(1/120,Math.min(dt,1/30));this.world.step();for(const p of this.particles){const pos=p.body.translation();p.mesh.position.set(pos.x,pos.y,pos.z);p.mesh.quaternion.copy(p.body.rotation());}this.particles=this.particles.filter(p=>{if(now<p.until)return true;p.mesh.removeFromParent();p.mesh.geometry.dispose();this.world!.removeRigidBody(p.body);return false;});}
    this.traces=this.traces.filter(p=>{if(now<p.until)return true;p.object.removeFromParent();p.object.geometry.dispose();(p.object.material as THREE.Material).dispose();return false;});
    // Keep the near end attached during recoil, camera movement and weapon bob.
    for(const trace of this.traces)if(trace.localWeapon&&this.gun.visible){
      const origin=heldShotOrigin(this.gun,trace.localWeapon,this.viewCamera,this.camera),position=trace.object.geometry.attributes.position;
      position.setXYZ(0,origin.x,origin.y,origin.z);position.needsUpdate=true;trace.object.geometry.computeBoundingSphere();
    }
    this.explosions.update(now);
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);
    if(this.gun.visible){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.viewScene,this.viewCamera);this.renderer.autoClear=true;}
    this.raf=requestAnimationFrame(this.frame);
  };
  private keydown=(e:KeyboardEvent)=>{if(!this.active||e.target instanceof HTMLInputElement)return;if(['Tab','Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ControlLeft','ControlRight','KeyC','KeyR','KeyE','Digit1','Digit2','Digit3','Digit4','Digit5'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.code==='Tab')this.callbacks.board(true);if(document.pointerLockElement!==this.canvas)return;if(e.code==='Space'&&!e.repeat)this.jump=true;if(e.code==='KeyR'&&!e.repeat){this.reload=true;this.resetScope();}if(e.code==='KeyE'&&!e.repeat)this.interact=true;if(e.code==='Digit1')this.weapon='knife';if(e.code==='Digit2')this.weapon=this.snap?.players.find(p=>p.id===this.id)?.primary??'rifle';if(e.code==='Digit3')this.weapon='pistol';if(e.code==='Digit4')this.weapon='grenade';if(e.code==='Digit5'&&this.snap?.bombs.some(b=>b.carrierId===this.id))this.weapon='bomb';};
  private keyup=(e:KeyboardEvent)=>{this.keys.delete(e.code);if(e.code==='Tab')this.callbacks.board(false);};
  private mousemove=(e:MouseEvent)=>{if(document.pointerLockElement!==this.canvas)return;const sensitivity=Math.tan(this.camera.fov*Math.PI/360)/Math.tan(BASE_FOV*Math.PI/360);this.yaw=(this.yaw-e.movementX*.002*sensitivity+Math.PI*3)%(Math.PI*2)-Math.PI;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.002*sensitivity,-1.5,1.5);};
  private mousedown=(e:MouseEvent)=>{if(document.pointerLockElement!==this.canvas)return;if(e.button===0)this.fire=true;if(e.button===2){e.preventDefault();this.scope.cycle(this.scopeContext());}};
  private contextmenu=(e:MouseEvent)=>{if(this.active&&document.pointerLockElement===this.canvas)e.preventDefault();};
  private mouseup=(e:MouseEvent)=>{if(e.button===0)this.fire=false;};private blur=()=>{this.resetScope();this.keys.clear();this.fire=this.jump=this.reload=this.interact=false;};private lockchange=()=>{this.blur();this.callbacks.lock(document.pointerLockElement===this.canvas);};
  destroy(){this.explosions.destroy();this.destroyed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();document.removeEventListener('keydown',this.keydown);document.removeEventListener('keyup',this.keyup);document.removeEventListener('mousemove',this.mousemove);document.removeEventListener('mousedown',this.mousedown);document.removeEventListener('mouseup',this.mouseup);this.canvas.removeEventListener('contextmenu',this.contextmenu);document.removeEventListener('pointerlockchange',this.lockchange);window.removeEventListener('blur',this.blur);this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line)o.geometry.dispose();});this.viewScene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.art.destroy();this.world?.free();this.renderer.dispose();this.audio.destroy();}
}
