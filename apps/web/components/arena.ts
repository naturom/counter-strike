import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {SOLIDS, EYE, HEIGHT, DT, move, neutralInput, WEAPONS, type Motion, type Input, type Snapshot, type Player, type CombatEvent} from '@sirocco/shared';
export interface ArenaCallbacks { input:(i:Input)=>void; lock:(locked:boolean)=>void; board:(show:boolean)=>void; }
export class Arena {
  scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(76,1,0.06,240); renderer:THREE.WebGLRenderer;
  private world?:RAPIER.World;
  private avatars=new Map<string,THREE.Group>();
  private materials:THREE.Material[]=[];
  private particles:{mesh:THREE.Mesh;body:RAPIER.RigidBody;until:number}[]=[];
  private tracers:{line:THREE.Line;until:number}[]=[];
  private snapshots:{state:Snapshot;received:number}[]=[];
  private pending:Input[]=[];
  private predicted:Motion={x:0,y:0,z:0,vy:0,grounded:true};
  private keys=new Set<string>();
  private active=false; private destroyed=false; private raf=0; private last=0;private accumulator=0;private seq=0;
  private yaw=0;private pitch=0;private fire=false;private reload=false;private jump=false;private weapon:Input['weapon']='rifle';
  private id='';private snap?:Snapshot;private gun=new THREE.Group();private flash:THREE.Mesh;private flashUntil=0;private recoil=0;private audio?:AudioContext;
  private observer:ResizeObserver;
  private effectsEnabled=true;
  constructor(private canvas:HTMLCanvasElement,private callbacks:ArenaCallbacks){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.scene.background=new THREE.Color('#c6d4d0');this.scene.fog=new THREE.Fog('#d4d5c3',50,150);
    this.scene.add(new THREE.HemisphereLight('#e6f3ff','#967953',2.7));
    const sun=new THREE.DirectionalLight('#ffe2a3',3.6);sun.position.set(-28,44,19);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:110});sun.shadow.bias=-0.0005;this.scene.add(sun);
    const sand=this.material('#b99a6c');const wall=this.material('#c9ad7e');const trim=this.material('#e2cb9c');const dark=this.material('#6f7059');const crate=this.material('#857349');
    const ground=this.box(180,0.2,180,sand,0,-0.1,0);ground.receiveShadow=true;
    for(const b of SOLIDS){
      const mesh=this.box(b.w,b.h,b.d,b.kind==='crate'?crate:wall,b.x,b.y,b.z);mesh.castShadow=true;
      if(b.kind==='wall'){
        this.box(b.w+0.18,0.22,b.d+0.18,trim,b.x,b.y+b.h/2-0.16,b.z);
        this.box(b.w+0.04,0.35,b.d+0.04,dark,b.x,0.175,b.z);
        if(b.w>3&&b.d>3){
          for(let x=-b.w/2+1.5;x<b.w/2;x+=3){this.box(0.72,1.05,0.09,dark,b.x+x,2.7,b.z+b.d/2+0.05);this.box(0.86,0.1,0.2,trim,b.x+x,2.12,b.z+b.d/2+0.1);}
          const roof=this.box(b.w*0.6,0.7,b.d*0.7,wall,b.x,b.h+0.35,b.z);roof.castShadow=true;
        }
      }else if(b.kind==='crate'){
        for(const y of [-b.h/2+0.16,b.h/2-0.16])this.box(b.w+0.04,0.13,b.d+0.04,dark,b.x,b.y+y,b.z);
        for(const x of [-b.w/2+0.18,b.w/2-0.18])this.box(0.12,b.h,b.d+0.03,dark,b.x+x,b.y,b.z);
      }
    }
    // Environmental details are procedural, original assets.
    this.sign('RELAY',0,3,-23.4,'#e2cda2','#3d514b');
    this.sign('WEST PASSAGE',-29.4,2,-1,'#d9c394','#3c5147',Math.PI/2);
    this.sign('01  /  RED',-24,1.4,23.4,'#b4543c','#f3e4c4',Math.PI);
    this.sign('02  /  BLUE',23,1.4,-23.4,'#3a6d7e','#f3e4c4');
    for(let i=0;i<9;i++){
      const x=-50+i*13,z=-48-(i%3)*7;
      const hill=new THREE.Mesh(new THREE.ConeGeometry(11+(i%3)*3,9+i%4,5),this.material(i%2?'#b79a70':'#a99572'));
      hill.position.set(x,2,z);hill.rotation.y=i;this.scene.add(hill);
    }
    this.palm(-27,9);this.palm(27,-8);this.palm(-9,21);this.palm(9,-21);
    // Overhead wires add scale without affecting playable collision.
    for(const z of [-9,9]){
      const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(new THREE.Vector3(-25+50*t,7-Math.sin(t*Math.PI)*1.5,z));}
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#665c47'})));
    }
    this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    const metal=this.material('#252d2e'),stock=this.material('#4b5045');
    this.gun.add(this.boxDetached(0.13,0.16,0.62,metal,0,0,-0.12),this.boxDetached(0.1,0.13,0.32,stock,0,-0.04,0.23),this.boxDetached(0.06,0.07,0.32,metal,0,0.04,-0.55),this.boxDetached(0.07,0.23,0.12,stock,0,-0.17,-0.02),this.boxDetached(0.04,0.06,0.06,metal,0,0.12,-0.25));
    this.gun.scale.setScalar(0.65);this.gun.position.set(0.27,-0.26,-0.5);this.camera.add(this.gun);this.gun.visible=false;
    this.flash=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.3,5),new THREE.MeshBasicMaterial({color:'#fff1ac',transparent:true,opacity:0.95}));
    this.flash.rotation.x=-Math.PI/2;this.flash.position.set(0,0.04,-0.82);this.gun.add(this.flash);this.flash.visible=false;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
    document.addEventListener('keydown',this.keydown);document.addEventListener('keyup',this.keyup);document.addEventListener('mousemove',this.mousemove);document.addEventListener('mousedown',this.mousedown);document.addEventListener('mouseup',this.mouseup);document.addEventListener('pointerlockchange',this.lockchange);window.addEventListener('blur',this.blur);
    this.raf=requestAnimationFrame(this.frame);
    void RAPIER.init().then(()=>{
      if(this.destroyed)return;
      this.world=new RAPIER.World({x:0,y:-18,z:0});
      for(const b of SOLIDS)this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.y,b.z));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(90,0.1,90).setTranslation(0,-0.1,0));this.world.step();
    });
  }
  private material(color:string){const m=new THREE.MeshStandardMaterial({color,roughness:0.95});this.materials.push(m);return m;}
  private boxDetached(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.receiveShadow=true;return mesh;}
  private box(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number){const mesh=this.boxDetached(w,h,d,m,x,y,z);this.scene.add(mesh);return mesh;}
  private sign(text:string,x:number,y:number,z:number,bg:string,fg:string,rotation=0){
    const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.strokeStyle=fg;ctx.lineWidth=4;ctx.strokeRect(10,10,492,108);ctx.font='bold 44px monospace';ctx.textAlign='center';ctx.fillStyle=fg;ctx.fillText(text,256,80);
    const mat=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),roughness:1});this.materials.push(mat);const plane=new THREE.Mesh(new THREE.PlaneGeometry(4,1),mat);plane.position.set(x,y,z);plane.rotation.y=rotation;this.scene.add(plane);
  }
  private palm(x:number,z:number){const trunk=this.material('#82664b');const leaves=this.material('#6c7950');const t=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.28,6,7),trunk);t.position.set(x,3,z);t.castShadow=true;this.scene.add(t);for(let i=0;i<7;i++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(0.65,4.2,3),leaves);leaf.position.set(x+Math.sin(i)*1.3,5.6,z+Math.cos(i)*1.3);leaf.rotation.set(Math.cos(i)*1.1,0,Math.sin(i)*1.1);leaf.castShadow=true;this.scene.add(leaf);}}
  private resize(){const r=this.canvas.getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  start(id:string){this.id=id;this.active=true;this.pending=[];this.seq=0;this.snap=undefined;this.snapshots=[];this.keys.clear();}
  stop(){this.active=false;this.gun.visible=false;this.pending=[];document.exitPointerLock();for(const a of this.avatars.values())a.visible=false;}
  lock(){if(this.active){this.canvas.requestPointerLock();this.audio??=new AudioContext();void this.audio.resume();}}
  setEffects(on:boolean){this.effectsEnabled=on;}
  update(s:Snapshot){
    const me=s.players.find(p=>p.id===this.id);const old=this.snap?.players.find(p=>p.id===this.id);
    this.snap=s;this.snapshots.push({state:s,received:performance.now()});if(this.snapshots.length>8)this.snapshots.shift();
    if(!me)return;
    const fresh=!old||old.hp<=0&&me.hp>0||old&&Math.hypot(old.x-me.x,old.z-me.z)>10;
    if(fresh){this.yaw=me.yaw;this.pitch=me.pitch;this.weapon=me.weapon;this.pending=[];}
    this.seq=Math.max(this.seq,me.ack);this.pending=this.pending.filter(i=>i.seq>me.ack);
    this.predicted={x:me.x,y:me.y,z:me.z,vy:me.vy,grounded:me.grounded};
    if(me.hp>0)for(const i of this.pending)this.predicted=move(this.predicted,i);
    if(fresh)this.camera.position.set(me.x,me.y+EYE,me.z);
  }
  combat(e:CombatEvent){
    if(e.type!=='shot')return;
    if(e.shooter===this.id){this.flashUntil=performance.now()+65;this.recoil=0.075;}
    const points=[new THREE.Vector3(e.from.x,e.from.y-0.1,e.from.z),new THREE.Vector3(e.to.x,e.to.y,e.to.z)];
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:e.team==='red'?'#ffb16b':'#c2f4ff',transparent:true,opacity:0.7}));this.scene.add(line);this.tracers.push({line,until:performance.now()+70});
    if(this.effectsEnabled)this.sound(e.shooter===this.id?0.055:0.012,e.weapon==='rifle'?95:150);
    if(this.world && this.particles.length<24 && this.effectsEnabled){
      const dir={x:e.to.x-e.from.x,y:e.to.y-e.from.y,z:e.to.z-e.from.z};const len=Math.hypot(dir.x,dir.y,dir.z);if(len<0.1)return;dir.x/=len;dir.y/=len;dir.z/=len;
      const hit=this.world.castRayAndGetNormal(new RAPIER.Ray(e.from,dir),len+0.2,true);
      if(hit)for(let j=0;j<3;j++){
        const point={x:e.from.x+dir.x*hit.timeOfImpact+hit.normal.x*0.12,y:e.from.y+dir.y*hit.timeOfImpact+hit.normal.y*0.12,z:e.from.z+dir.z*hit.timeOfImpact+hit.normal.z*0.12};
        const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(point.x,point.y,point.z).setLinvel(hit.normal.x*(1+j),2+j,hit.normal.z*(1+j)));
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.025,0.025,0.025).setRestitution(0.2),body);
        const mesh=this.box(0.05,0.05,0.05,this.materials[0],point.x,point.y,point.z);this.particles.push({mesh,body,until:performance.now()+900});
      }
    }
  }
  private sound(volume:number,freq:number){if(!this.audio)return;const osc=this.audio.createOscillator();const gain=this.audio.createGain();osc.type='sawtooth';osc.frequency.setValueAtTime(freq,this.audio.currentTime);osc.frequency.exponentialRampToValueAtTime(35,this.audio.currentTime+0.07);gain.gain.setValueAtTime(volume,this.audio.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,this.audio.currentTime+0.09);osc.connect(gain).connect(this.audio.destination);osc.start();osc.stop(this.audio.currentTime+0.1);}
  private avatar(p:Player){
    let g=this.avatars.get(p.id);if(g)return g;
    g=new THREE.Group();const team=this.material(p.team==='red'?'#bf5342':'#427f9a');const cloth=this.material('#323d39');const skin=this.material('#d2b38e');
    g.add(this.boxDetached(0.6,0.7,0.35,team,0,1.05,0),this.boxDetached(0.32,0.32,0.32,skin,0,1.58,0),this.boxDetached(0.38,0.14,0.37,cloth,0,1.78,0),this.boxDetached(0.2,0.65,0.24,cloth,-0.18,0.33,0),this.boxDetached(0.2,0.65,0.24,cloth,0.18,0.33,0),this.boxDetached(0.18,0.45,0.2,team,-0.4,1.05,0),this.boxDetached(0.18,0.45,0.2,team,0.4,1.05,0),this.boxDetached(0.12,0.13,0.65,cloth,0.32,1.22,-0.4));
    g.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});this.avatars.set(p.id,g);this.scene.add(g);return g;
  }
  private frame=(now:number)=>{
    if(this.destroyed)return;const dt=Math.min((now-this.last)/1000||0,0.1);this.last=now;
    if(this.active&&this.snap){
      const me=this.snap.players.find(p=>p.id===this.id);const locked=document.pointerLockElement===this.canvas;
      this.accumulator=Math.min(this.accumulator+dt,DT*3);
      while(this.accumulator>=DT){this.accumulator-=DT;
        const live=locked&&me&&me.hp>0&&this.snap.phase==='playing';
        const i:Input={seq:++this.seq,forward:live?(Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'))):0,strafe:live?(Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'))):0,yaw:this.yaw,pitch:this.pitch,jump:!!live&&this.jump,sprint:!!live&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')),fire:!!live&&this.fire,reload:!!live&&this.reload,weapon:this.weapon};
        this.jump=false;this.reload=false;
        if(me?.hp&&this.snap.phase==='playing')this.predicted=move(this.predicted,i);
        this.pending.push(i);if(this.pending.length>90)this.pending.shift();this.callbacks.input(i);
      }
      this.camera.position.lerp(new THREE.Vector3(this.predicted.x,this.predicted.y+(me?.hp?EYE:0.55),this.predicted.z),Math.min(1,dt*24));
      this.camera.rotation.set(this.pitch,this.yaw,0);
      this.gun.visible=!!me?.hp&&this.snap.phase==='playing';this.gun.scale.z=this.weapon==='pistol'?0.45:0.65;
      this.recoil=Math.max(0,this.recoil-dt*0.8);this.gun.position.z=-0.5+this.recoil;
      const reloading=!!me?.reloadUntil;this.gun.rotation.x=THREE.MathUtils.lerp(this.gun.rotation.x,reloading?-0.65:0,dt*8);
      this.gun.position.y=-0.26+(locked&&this.keys.size?Math.sin(now*0.012)*0.008:0);this.flash.visible=now<this.flashUntil;
      const renderTime=now-100;let a=this.snapshots[0],b=this.snapshots.at(-1)!;
      for(let j=1;j<this.snapshots.length;j++)if(this.snapshots[j].received>=renderTime){a=this.snapshots[j-1];b=this.snapshots[j];break;}
      const t=a&&b?THREE.MathUtils.clamp((renderTime-a.received)/Math.max(1,b.received-a.received),0,1):1;
      for(const p of this.snap.players){if(p.id===this.id)continue;const avatar=this.avatar(p);avatar.visible=p.hp>0;
        const previous=a?.state.players.find(q=>q.id===p.id)??p;const next=b?.state.players.find(q=>q.id===p.id)??p;
        avatar.position.set(THREE.MathUtils.lerp(previous.x,next.x,t),THREE.MathUtils.lerp(previous.y,next.y,t),THREE.MathUtils.lerp(previous.z,next.z,t));avatar.rotation.y=next.yaw;
      }
      for(const [id,g] of this.avatars)if(!this.snap.players.some(p=>p.id===id))g.visible=false;
    }else{const a=now*0.000012;this.camera.position.set(38+Math.sin(a)*4,31,38+Math.cos(a)*3);this.camera.lookAt(-1,0,0);}
    if(this.world){this.world.timestep=Math.max(1/120,Math.min(dt,1/30));this.world.step();for(const particle of this.particles){const p=particle.body.translation();particle.mesh.position.set(p.x,p.y,p.z);particle.mesh.quaternion.copy(particle.body.rotation());}this.particles=this.particles.filter(p=>{if(now<p.until)return true;this.scene.remove(p.mesh);p.mesh.geometry.dispose();this.world!.removeRigidBody(p.body);return false;});}
    this.tracers=this.tracers.filter(t=>{if(now<t.until)return true;this.scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();return false;});
    this.renderer.render(this.scene,this.camera);this.raf=requestAnimationFrame(this.frame);
  };
  private keydown=(e:KeyboardEvent)=>{if(!this.active)return;if(['Tab','Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','KeyR','Digit1','Digit2'].includes(e.code)&&!(e.target instanceof HTMLInputElement))e.preventDefault();this.keys.add(e.code);if(e.code==='Tab')this.callbacks.board(true);if(e.code==='Space'&&!e.repeat)this.jump=true;if(e.code==='KeyR')this.reload=true;if(e.code==='Digit1')this.weapon='rifle';if(e.code==='Digit2')this.weapon='pistol';};
  private keyup=(e:KeyboardEvent)=>{this.keys.delete(e.code);if(e.code==='Tab')this.callbacks.board(false);};
  private mousemove=(e:MouseEvent)=>{if(document.pointerLockElement!==this.canvas)return;this.yaw=(this.yaw-e.movementX*0.002+Math.PI*3)%(Math.PI*2)-Math.PI;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*0.002,-1.5,1.5);};
  private mousedown=(e:MouseEvent)=>{if(e.button===0&&document.pointerLockElement===this.canvas)this.fire=true;};
  private mouseup=()=>{this.fire=false;};
  private blur=()=>{this.keys.clear();this.fire=false;};
  private lockchange=()=>{this.blur();this.callbacks.lock(document.pointerLockElement===this.canvas);};
  destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();document.removeEventListener('keydown',this.keydown);document.removeEventListener('keyup',this.keyup);document.removeEventListener('mousemove',this.mousemove);document.removeEventListener('mousedown',this.mousedown);document.removeEventListener('mouseup',this.mouseup);document.removeEventListener('pointerlockchange',this.lockchange);window.removeEventListener('blur',this.blur);this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line)o.geometry.dispose();});for(const m of this.materials){if(m instanceof THREE.MeshStandardMaterial)m.map?.dispose();m.dispose();}this.world?.free();this.renderer.dispose();void this.audio?.close();}
}
