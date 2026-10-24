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
export class SpawnMirrors{
 private group=new THREE.Group();private mirrors:Reflector[]=[];private last=new WeakMap<Reflector,number>();
 constructor(private art:WorldArt,private scene:THREE.Scene){}
 setMap(map:MapId){
  this.clear();this.group=new THREE.Group();this.group.name='spawnMirrors';this.scene.add(this.group);
  const frame=this.art.material('#333b3d',{metalness:.85,roughness:.28});
  for(const mount of spawnMirrorMounts(map)){
   const group=new THREE.Group();group.position.set(mount.x,mount.y,mount.z);group.rotation.y=mount.rotation;this.group.add(group);
   const mirror=new Reflector(new THREE.PlaneGeometry(mount.width,mount.height),{textureWidth:1024,textureHeight:512,color:'#d8dddd',clipBias:.003,multisample:0});mirror.name=`${mount.team} spawn mirror`;mirror.userData.mount=mount;group.add(mirror);this.mirrors.push(mirror);
   this.art.box(group,mount.width+.14,.07,.09,frame,0,mount.height/2+.035,-.02);this.art.box(group,mount.width+.14,.07,.09,frame,0,-mount.height/2-.035,-.02);
   for(const side of [-1,1])this.art.box(group,.07,mount.height,.09,frame,side*(mount.width/2+.035),0,-.02);
   const render=mirror.onBeforeRender.bind(mirror);
   mirror.onBeforeRender=(renderer,scene,camera,geometry,material,object)=>{
    const now=performance.now(),position=mirror.getWorldPosition(new THREE.Vector3());
    if(camera.position.distanceTo(position)>25||now-(this.last.get(mirror)??-Infinity)<50)return;
    // The local body lives on layer 1, visible only to the reflected camera.
    const reflection=(mirror as unknown as {getReflectionCamera(c:THREE.Camera):THREE.Camera}).getReflectionCamera(camera);reflection.layers.enable(1);
    const visible=this.mirrors.map(m=>m.visible);this.mirrors.forEach(m=>m.visible=false);
    try{render(renderer,scene,camera,geometry,material,object);this.last.set(mirror,now);}finally{this.mirrors.forEach((m,i)=>m.visible=visible[i]);}
   };
  }
 }
 private clear(){for(const m of this.mirrors)m.dispose();this.mirrors=[];disposeGroup(this.group);}
 destroy(){this.clear();}
}
