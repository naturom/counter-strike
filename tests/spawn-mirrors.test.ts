import {test} from 'node:test';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {MAPS,wallDistance,type MapId} from '@sirocco/shared';
import {spawnMirrorMounts} from '../apps/web/components/spawn-mirrors';
test('both teams have large wall-supported mirrors near spawn on each map',()=>{
 for(const mapId of ['dunes','relay'] as MapId[]){
  const map=MAPS[mapId],mounts=spawnMirrorMounts(mapId);assert.equal(mounts.length,2);
  for(const m of mounts){
   assert.ok(m.width>=4.8&&m.height>=2.3);
   const nx=Math.sin(m.rotation),nz=Math.cos(m.rotation);
   for(const x of [-m.width/2,0,m.width/2])for(const y of [-m.height/2,m.height/2]){
    const at={x:m.x+nz*x,y:m.y+y,z:m.z-nx*x},distance=wallDistance(at,{x:-nx,y:0,z:-nz},map.solids.filter(b=>b.kind==='wall'));
    assert.ok(distance>.025&&distance<.15,`${mapId} ${m.team} mirror must stand clear of a supporting wall: ${distance}`);
   }
   assert.ok(map.spawns[m.team].some(s=>Math.hypot(s.x-m.x,s.z-m.z)<10),`${mapId} ${m.team}: mirror too far from spawn`);
  }
 }
});

test('mirror quality adapts pixel cost while accepting every display frame',async()=>{
 const {MirrorResolution}=await import('../apps/web/components/spawn-mirrors');
 const smooth=new MirrorResolution(),slow=new MirrorResolution();let high=smooth.update(0,1920,1080),low=slow.update(0,1920,1080);
 for(let i=1;i<=600;i++){high=smooth.update(i*1000/60,1920,1080);low=slow.update(i*1000/30,1920,1080);}
 assert.ok(low.width*low.height<high.width*high.height*.5,'slow frames should reduce reflection resolution');
 assert.ok(high.width<=1024&&high.height<=768,'reflection pixel cost is bounded');
 for(let i=1;i<=144;i++){const size=smooth.update(10001+i*1000/144,1920,1080);assert.ok(size.width>=128&&size.height>=128,'high refresh frames are all accepted');}
 const portrait=smooth.update(12000,600,1200);assert.ok(portrait.height>portrait.width,'resolution follows the viewport aspect');
});

test('visible mirrors render on every frame, include the local body, and skip hidden views',async()=>{
 const {SpawnMirrors}=await import('../apps/web/components/spawn-mirrors'),{WorldArt}=await import('../apps/web/components/world');
 const art=Object.create(WorldArt.prototype) as InstanceType<typeof WorldArt>;art.materials=[];art.textures=[];
 const scene=new THREE.Scene(),mirrors=new SpawnMirrors(art,scene);mirrors.setMap('dunes');scene.updateMatrixWorld(true);
 const mirror=scene.getObjectByName('red spawn mirror') as THREE.Mesh,mount=spawnMirrorMounts('dunes')[0],camera=new THREE.PerspectiveCamera(76,16/9,.06,350);camera.position.set(mount.x,mount.y,mount.z+3);camera.lookAt(mount.x,mount.y,mount.z);camera.updateMatrixWorld(true);
 let renders=0,target:unknown=null;const renderer={getDrawingBufferSize:(out:THREE.Vector2)=>out.set(1280,720),getRenderTarget:()=>target,setRenderTarget:(next:unknown)=>{target=next;},xr:{enabled:false},shadowMap:{autoUpdate:true},state:{buffers:{depth:{setMask:()=>{}}}},autoClear:true,render:(_scene:THREE.Scene,reflected:THREE.Camera)=>{renders++;assert.ok(reflected.layers.isEnabled(1),'local character must be visible in reflection');}} as unknown as THREE.WebGLRenderer;
 const draw=()=>mirror.onBeforeRender(renderer,scene,camera,mirror.geometry,mirror.material as THREE.Material,null as unknown as THREE.Group);
 for(let i=0;i<120;i++)draw();assert.equal(renders,120,'no time cap may drop display frames');assert.equal(mirror.visible,true);
 camera.position.z=mount.z+30;camera.updateMatrixWorld(true);draw();assert.equal(renders,120,'distant mirrors should not render');
 camera.position.z=mount.z-3;camera.updateMatrixWorld(true);draw();assert.equal(renders,120,'mirror back faces should not render');
 mirrors.destroy();art.destroy();
});
