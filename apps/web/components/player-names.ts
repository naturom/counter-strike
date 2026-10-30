import * as THREE from 'three';
import {TEAMS,wallDistance,eyeOf,type Player,type Solid} from '@sirocco/shared';

type Tag={sprite:THREE.Sprite;texture:THREE.CanvasTexture;width:number;key:string;checkAt:number;clear:boolean};
const LABEL_HEIGHT=.22;
/** Lightweight, camera-facing callsigns. Depth testing and a cached head ray
 * keep names from identifying opponents through walls. */
export class PlayerNames{
 private tags=new Map<string,Tag>();
 private origin=new THREE.Vector3();private head=new THREE.Vector3();private direction=new THREE.Vector3();
 constructor(private scene:THREE.Scene){}
 update(players:Player[],models:Map<string,THREE.Group>,localId:string,camera:THREE.Camera,solids:Solid[],dt:number,time:number){
  camera.getWorldPosition(this.origin);
  for(const p of players){const model=models.get(p.id);if(!model)continue;const key=`${p.team}:${p.name}`;let tag=this.tags.get(p.id);
   if(!tag||tag.key!==key){if(tag)this.remove(p.id);tag=this.create(p);this.tags.set(p.id,tag);}
   const {sprite}=tag,own=p.id===localId;sprite.layers.set(own?1:0);const distance=model.position.distanceTo(this.origin);
   const targetY=model.position.y+(p.crouched?1.48:2.16);if(!sprite.userData.placed){sprite.position.set(model.position.x,targetY,model.position.z);sprite.userData.placed=true;}else{sprite.position.x=model.position.x;sprite.position.z=model.position.z;sprite.position.y=THREE.MathUtils.lerp(sprite.position.y,targetY,1-Math.exp(-dt*20));}
   if(time>=tag.checkAt){tag.checkAt=time+100;this.head.copy(model.position);this.head.y+=eyeOf(p);this.direction.copy(this.head).sub(this.origin);const length=this.direction.length();tag.clear=own||length<.01||wallDistance(this.origin,this.direction.multiplyScalar(1/length),solids)>=length-.08;}
   sprite.visible=model.visible&&p.connected&&p.hp>0&&distance<40&&tag.clear;
   const size=THREE.MathUtils.clamp(distance/8,1,3);sprite.scale.set(tag.width*size,LABEL_HEIGHT*size,1);sprite.material.opacity=THREE.MathUtils.clamp((40-distance)/10,0,1);
  }
  for(const id of this.tags.keys())if(!players.some(p=>p.id===id))this.remove(id);
 }
 private create(p:Player):Tag{
  const canvas=document.createElement('canvas'),c=canvas.getContext('2d')!,color=p.team==='red'?'#f28973':'#86c4e0',label=`${TEAMS[p.team].name.slice(-1)} · ${p.name}`;c.font='bold 32px sans-serif';canvas.width=Math.min(512,Math.max(160,Math.ceil(c.measureText(label).width+44)));canvas.height=72;
  c.fillStyle='rgba(13,25,22,.90)';c.fillRect(0,0,canvas.width,72);c.fillStyle=color;c.fillRect(0,0,6,72);c.textAlign='center';c.textBaseline='middle';c.font='bold 32px sans-serif';c.fillText(label,canvas.width/2+3,37,canvas.width-28);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:true,toneMapped:false}));sprite.name=`callsign-${p.id}`;sprite.renderOrder=10;this.scene.add(sprite);return {sprite,texture,width:canvas.width/72*LABEL_HEIGHT,key:`${p.team}:${p.name}`,checkAt:0,clear:false};
 }
 private remove(id:string){const tag=this.tags.get(id);if(!tag)return;tag.sprite.removeFromParent();tag.texture.dispose();tag.sprite.material.dispose();this.tags.delete(id);}
 clear(){for(const id of this.tags.keys())this.remove(id);}
}
