import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {dustPoint,type MapId,type Team} from '@sirocco/shared';
import {disposeGroup,type WorldArt} from './world';
export type MirrorMount={team:Team;x:number;y:number;z:number;rotation:number;width:number;height:number;wall:string};
export function spawnMirrorMounts(mapId:MapId):MirrorMount[]{
 if(mapId==='dunes')return [
  {team:'red',...dustPoint(390,881.6,4.48),rotation:0,width:5.8,height:2.36,wall:'T spawn mid screen'},
  {team:'blue',...dustPoint(574.6,185,1.35),rotation:Math.PI/2,width:4.8,height:2.5,wall:'Northern kasbah'},
 ];
 return [
  {team:'red',x:-29.42,y:1.35,z:18,rotation:Math.PI/2,width:5,height:2.5,wall:'west perimeter'},
  {team:'blue',x:29.42,y:1.35,z:-18,rotation:-Math.PI/2,width:5,height:2.5,wall:'east perimeter'},
 ];
}
/** Spend GPU pixels on clarity without adding a separate reflection frame clock. */
export class MirrorResolution{
 private scale=1;private previous=-1;private average=1000/60;private samples=0;private changedAt=0;
 update(now:number,width:number,height:number){
  if(this.previous>=0){const elapsed=now-this.previous;if(elapsed>0&&elapsed<150){this.average+=(elapsed-this.average)*.08;this.samples++;}else if(elapsed>=150){this.average=1000/60;this.samples=0;}}
  this.previous=now;
  if(this.samples>=30&&now-this.changedAt>=1500){
   const next=this.average>22?Math.max(.65,this.scale-.05):this.average<18?Math.min(1,this.scale+.05):this.scale;
   if(next!==this.scale){this.scale=next;this.changedAt=now;}
  }
  const factor=Math.min(this.scale,2560/Math.max(1,width),1600/Math.max(1,height));
  return {width:Math.max(128,Math.round(width*factor/32)*32),height:Math.max(128,Math.round(height*factor/32)*32)};
 }
}
export class SpawnMirrors{
 private group=new THREE.Group();private mirrors:Reflector[]=[];private reflecting=false;
 constructor(private art:WorldArt,private scene:THREE.Scene){}
 setMap(map:MapId){
  this.clear();this.group=new THREE.Group();this.group.name='spawnMirrors';this.scene.add(this.group);
  const frame=this.art.material('#333b3d',{metalness:.85,roughness:.28});
  for(const mount of spawnMirrorMounts(map)){
   const group=new THREE.Group();group.position.set(mount.x,mount.y,mount.z);group.rotation.y=mount.rotation;this.group.add(group);
   const mirror=new Reflector(new THREE.PlaneGeometry(mount.width,mount.height),{textureWidth:256,textureHeight:128,color:'#d8dddd',clipBias:.003,multisample:2});mirror.name=`${mount.team} spawn mirror`;mirror.userData.mount=mount;group.add(mirror);this.mirrors.push(mirror);
   this.art.box(group,mount.width+.14,.07,.09,frame,0,mount.height/2+.035,-.02);this.art.box(group,mount.width+.14,.07,.09,frame,0,-mount.height/2-.035,-.02);
   for(const side of [-1,1])this.art.box(group,.07,mount.height,.09,frame,side*(mount.width/2+.035),0,-.02);
   const render=mirror.onBeforeRender.bind(mirror),quality=new MirrorResolution(),position=new THREE.Vector3(),cameraPosition=new THREE.Vector3(),normal=new THREE.Vector3(),buffer=new THREE.Vector2();
   mirror.onBeforeRender=(renderer,scene,camera,geometry,material,object)=>{
    if(this.reflecting)return;
    mirror.getWorldPosition(position);camera.getWorldPosition(cameraPosition);mirror.getWorldDirection(normal);
    if(cameraPosition.distanceToSquared(position)>25*25||cameraPosition.sub(position).dot(normal)<=0)return;
    // A visible mirror follows every rendered frame; adapt resolution instead of skipping motion.
    renderer.getDrawingBufferSize(buffer);const size=quality.update(performance.now(),buffer.x,buffer.y),target=mirror.getRenderTarget();
    if(target.width!==size.width||target.height!==size.height)target.setSize(size.width,size.height);
    // The local body lives on layer 1, visible only to the reflected camera.
    const reflection=(mirror as unknown as {getReflectionCamera(c:THREE.Camera):THREE.Camera}).getReflectionCamera(camera);reflection.layers.enable(1);
    const visible=this.mirrors.map(m=>m.visible);this.mirrors.forEach(m=>m.visible=false);this.reflecting=true;
    try{render(renderer,scene,camera,geometry,material,object);}finally{this.reflecting=false;this.mirrors.forEach((m,i)=>m.visible=visible[i]);}
   };
  }
 }
 private clear(){for(const m of this.mirrors)m.dispose();this.mirrors=[];disposeGroup(this.group);}
 destroy(){this.clear();}
}
