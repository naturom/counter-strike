import * as THREE from 'three';
import {wallDistance,type Vec3,type Solid} from '@sirocco/shared';
import type {ExplosionKind} from './explosion-audio';
export const EXPLOSION_VISUAL_SECONDS={grenade:4,bomb:10} as const;
type Puff={sprite:THREE.Sprite;origin:THREE.Vector3;velocity:THREE.Vector3;size:number;delay:number;life:number;spin:number;rotation:number;kind:'fire'|'smoke'|'dust'};
type Blast={root:THREE.Group;start:number;duration:number;kind:ExplosionKind;puffs:Puff[];flash:THREE.Sprite;ring:THREE.Mesh;scorch?:THREE.Mesh;embers:THREE.Points;velocities:THREE.Vector3[]};
function cloudTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
  // Overlapping soft lobes give the smoke an irregular, volumetric silhouette.
  for(let i=0;i<22;i++){
    const a=i*2.39996,r=Math.sqrt(i/22)*29,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r,size=20+(i*13%17);
    const g=c.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,'rgba(255,255,255,.2)');g.addColorStop(.45,'rgba(230,230,230,.13)');g.addColorStop(1,'rgba(200,200,200,0)');c.fillStyle=g;c.fillRect(x-size,y-size,size*2,size*2);
  }
  const pixels=c.getImageData(0,0,128,128),hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  const noise=(x:number,y:number)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;};
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,n=noise(x/17,y/17)*.6+noise(x/8,y/8)*.28+noise(x/3,y/3)*.12;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=170+n*85;pixels.data[i+3]*=.3+n*.9;}
  c.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function flashTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!,g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fffde9');g.addColorStop(.16,'#ffe2a0');g.addColorStop(.4,'rgba(255,139,48,.6)');g.addColorStop(1,'rgba(255,90,20,0)');c.fillStyle=g;c.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);}

/** Bounded, time-based presentation. It keeps animating after a round ends and
 * owns/disposes every transient resource independently of gameplay physics. */
export class ExplosionEffects {
  private blasts:Blast[]=[];
  private lights:THREE.PointLight[]=[];private lightRoot=new THREE.Group();
  private smokeColour=new THREE.Color('#a39b8d');
  private cloud:THREE.Texture;private glow:THREE.Texture;
  constructor(private scene:THREE.Scene,private reducedMotion=false,textures?:{cloud:THREE.Texture;glow:THREE.Texture}){
    this.cloud=textures?.cloud??cloudTexture();this.glow=textures?.glow??flashTexture();
    // Keep the light count stable. Adding/removing a light recompiles every lit
    // scenery/character shader, causing a hitch at the busiest combat moments.
    this.lightRoot.name='explosionLights';this.scene.add(this.lightRoot);
    for(let i=0;i<2;i++){const light=new THREE.PointLight('#ffcb85',0,30,2);this.lightRoot.add(light);this.lights.push(light);}
  }
  get activeCount(){return this.blasts.length;}
  spawn(at:Vec3,kind:ExplosionKind,now:number,solids:Solid[]=[]){
    while(this.blasts.length>=4)this.remove(this.blasts.shift()!);
    const bomb=kind==='bomb',root=new THREE.Group();root.position.set(at.x,at.y+.08,at.z);this.scene.add(root);
    const duration=EXPLOSION_VISUAL_SECONDS[kind],puffs:Puff[]=[];let seed=bomb?1147:7919;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const down=wallDistance({x:at.x,y:at.y+.12,z:at.z},{x:0,y:-1,z:0},solids),ground=down<2.5;
    const sprite=(glow=false,fire=false)=>{const m=new THREE.SpriteMaterial({map:glow?this.glow:this.cloud,color:glow?'#ffb35a':'#70685c',transparent:true,opacity:0,depthWrite:false,blending:glow||fire?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:!(glow||fire),fog:!(glow||fire)});const s=new THREE.Sprite(m);root.add(s);return s;};
    for(const type of ['fire','smoke','dust'] as const){
      const count=type==='fire'?(bomb?8:5):type==='smoke'?(bomb?16:10):(bomb?12:7);
      for(let i=0;i<count;i++){
        const a=random()*Math.PI*2,r=random()*.45,origin=new THREE.Vector3(Math.cos(a)*r,(random()-.2)*.3,Math.sin(a)*r);
        const speed=type==='dust'?(bomb?6:3.6)*(1+random()):type==='fire'?(bomb?3:1.9)*(1+random()):(bomb?1.1:.65)*(1+random());
        const velocity=new THREE.Vector3(Math.cos(a)*speed,type==='dust'?.15+random()*.6:type==='fire'?1+random()*2:1.1+random()*1.8,Math.sin(a)*speed);
        // Confine the cloud's centre to the first wall in its direction.
        const distance=wallDistance({x:at.x,y:at.y+.35,z:at.z},{x:Math.cos(a),y:0,z:Math.sin(a)},solids);
        if(distance<speed*1.4){const scale=Math.max(0,distance-.3)/(speed*1.4);velocity.x*=scale;velocity.z*=scale;}
        const s=sprite(false,type==='fire');s.material.rotation=random()*Math.PI*2;
        puffs.push({sprite:s,origin,velocity,size:(type==='dust'?1.2:type==='fire'?.8:1.1)*(bomb?2:1)*(1+random()),delay:type==='fire'?random()*.075:type==='smoke'?.04+random()*.24:.03+random()*.14,life:type==='fire'?(bomb?1.45:.42):type==='smoke'?duration-.7-random()*.7:(bomb?5.8:2.6),spin:(random()-.5)*.3,rotation:s.material.rotation,kind:type});
      }
    }
    const flash=sprite(true);flash.position.y=.35;
    const ring=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:this.cloud,color:'#bdac8e',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=ground?.06-down:0;ring.visible=ground;root.add(ring);
    let scorch:THREE.Mesh|undefined;
    if(ground){scorch=new THREE.Mesh(new THREE.PlaneGeometry(bomb?7:2.4,bomb?7:2.4),new THREE.MeshBasicMaterial({map:this.cloud,color:'#1d1915',transparent:true,opacity:.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));scorch.rotation.x=-Math.PI/2;scorch.position.y=-down+.065;root.add(scorch);}
    const positions=new Float32Array((bomb?32:18)*3),velocities:THREE.Vector3[]=[];
    for(let i=0;i<positions.length/3;i++){const a=random()*Math.PI*2,speed=3+random()*(bomb?13:8);velocities.push(new THREE.Vector3(Math.cos(a)*speed,1+random()*6,Math.sin(a)*speed));}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const embers=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffbd6c',size:.055,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(embers);
    this.blasts.push({root,start:now,duration,kind,puffs,flash,ring,scorch,embers,velocities});this.update(now);
  }
  update(now:number){
    for(const blast of this.blasts){
      const t=Math.max(0,(now-blast.start)/1000),bomb=blast.kind==='bomb';
      blast.flash.scale.setScalar((bomb?3.8:1.8)*(1+t*8));blast.flash.material.opacity=Math.max(0,1-t/(bomb?.18:.09))*(this.reducedMotion?.3:.9);
      blast.flash.visible=blast.flash.material.opacity>.001;
      const ringAge=t/(bomb?.7:.4);blast.ring.scale.setScalar(1+ringAge*(bomb?14:7));(blast.ring.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-ringAge)*.18;
      blast.ring.visible=ringAge<1&&!!blast.scorch;
      if(blast.scorch)(blast.scorch.material as THREE.MeshBasicMaterial).opacity=.38*Math.min(1,Math.max(0,blast.duration-t)/2);
      for(const p of blast.puffs){
        const age=t-p.delay,k=age/p.life;p.sprite.visible=age>=0&&k<1;if(!p.sprite.visible)continue;
        const drift=p.kind==='dust'?1-Math.exp(-age*2):p.kind==='fire'?1-Math.exp(-age*4):Math.log1p(age)*.7;
        p.sprite.position.copy(p.origin).addScaledVector(p.velocity,drift);p.sprite.position.y=p.origin.y+p.velocity.y*(p.kind==='smoke'?age*.38:drift);
        const size=p.size*(p.kind==='fire'?1+age*3:1+Math.sqrt(age)*(p.kind==='dust'?2.2:1.55));p.sprite.scale.set(size,p.kind==='dust'?size*.48:size,1);
        p.sprite.material.rotation=p.rotation+p.spin*age;
        const fadeIn=Math.min(1,age/(p.kind==='fire'?.025:.17)),fadeOut=Math.max(0,1-k)**(p.kind==='fire'?1.9:1.15);
        p.sprite.material.opacity=fadeIn*fadeOut*(p.kind==='fire'?.95:p.kind==='dust'?.4:.62);
        if(p.kind==='fire')p.sprite.material.color.setRGB(bomb?1.6:1,Math.max(.12,.85-k*.7),Math.max(.025,.3-k*.35));
        else if(p.kind==='smoke')p.sprite.material.color.set(bomb?'#51473b':'#857b69').lerp(this.smokeColour,Math.min(1,k*1.4));
      }
      blast.embers.visible=t<(bomb?1.9:1.2);if(!blast.embers.visible)continue;
      const positions=blast.embers.geometry.attributes.position,emberTime=Math.min(t,bomb?1.9:1.2);
      for(let i=0;i<positions.count;i++){const v=blast.velocities[i];positions.setXYZ(i,v.x*emberTime,Math.max(0,v.y*emberTime-6*emberTime*emberTime),v.z*emberTime);}
      positions.needsUpdate=true;blast.embers.geometry.computeBoundingSphere();(blast.embers.material as THREE.PointsMaterial).opacity=Math.max(0,1-t/(bomb?1.9:1.2));
    }
    this.blasts=this.blasts.filter(blast=>{if(now-blast.start<blast.duration*1000)return true;this.remove(blast);return false;});
    const bright=this.blasts.filter(b=>now-b.start<450).sort((a,b)=>this.intensity(b,now)-this.intensity(a,now));
    this.lights.forEach((light,i)=>{const blast=bright[i];light.intensity=blast?this.intensity(blast,now):0;if(blast){light.position.copy(blast.root.position);light.position.y+=.8;light.distance=blast.kind==='bomb'?30:14;}});
  }
  private intensity(blast:Blast,now:number){return(blast.kind==='bomb'?160:60)*Math.exp(-Math.max(0,now-blast.start)*.018)*(this.reducedMotion?.2:1);}
  private remove(blast:Blast){blast.root.removeFromParent();blast.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points)o.geometry.dispose();if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.Sprite){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});}
  clear(){this.blasts.forEach(b=>this.remove(b));this.blasts=[];for(const light of this.lights)light.intensity=0;}
  destroy(){this.clear();this.lightRoot.removeFromParent();for(const light of this.lights)light.dispose();this.cloud.dispose();this.glow.dispose();}
}
