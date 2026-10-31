import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as THREE from 'three';
import {AVATARS} from '@sirocco/shared';
import {AvatarPicker} from '../apps/web/components/AvatarPicker';
import {VisualWorkQueue} from '../apps/web/components/startup-work';
import {WorldArt} from '../apps/web/components/world';
import {Arena} from '../apps/web/components/arena';

test('room character choices render usable image buttons without allocating WebGL canvases',()=>{
 const picked:string[]=[],html=renderToStaticMarkup(createElement(AvatarPicker,{value:'ultraman',disabled:false,onChange:id=>picked.push(id),label:'TEAM B CHARACTER'}));
 assert.match(html,/TEAM B CHARACTER/);assert.equal((html.match(/<button /g)??[]).length,3);assert.equal((html.match(/<img /g)??[]).length,3);assert.ok(!html.includes('<canvas'));
 for(const avatar of AVATARS){assert.ok(html.includes(`/avatars/${avatar.id}.webp`));const file=`apps/web/public/avatars/${avatar.id}.webp`,bytes=readFileSync(file);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(statSync(file).size<25000,'each actual character portrait stays lightweight');}
 assert.match(html,/<button[^>]+aria-pressed="true"[^>]+aria-label="Ultraman"/);
 const disabled=renderToStaticMarkup(createElement(AvatarPicker,{value:'ironman',disabled:true,onChange:()=>{}}));assert.match(disabled,/<fieldset[^>]+disabled/);
});

test('expensive profile previews have separate paint opportunities and cancelled mounts do not initialize',()=>{
 const scheduled:(()=>void)[]=[],events:string[]=[],queue=new VisualWorkQueue(run=>scheduled.push(run));
 queue.add(()=>events.push('first'));const cancel=queue.add(()=>events.push('unmounted'));queue.add(()=>events.push('third'));cancel();
 assert.deepEqual(events,[]);assert.equal(scheduled.length,1);scheduled.shift()!();assert.deepEqual(events,['first']);assert.equal(scheduled.length,1);
 scheduled.shift()!();assert.deepEqual(events,['first']);scheduled.shift()!();assert.deepEqual(events,['first','third']);assert.equal(scheduled.length,0);
});

test('profile previews never request terrain textures',()=>{
 const oldDocument=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;
 THREE.TextureLoader.prototype.load=function(){assert.fail('terrain texture requested by a character preview');};let art:WorldArt|undefined;
 try{art=new WorldArt({} as THREE.WebGLRenderer,{terrain:false});assert.equal(art.stone.map,null);assert.equal(art.asphalt.map,null);assert.equal(art.plaster.normalMap,null);}finally{art?.destroy();globalThis.document=oldDocument;THREE.TextureLoader.prototype.load=load;}
});

test('physics loads once on demand and does not initialize a destroyed arena',async()=>{
 type LazyPhysics={loadPhysics():Promise<void>;physicsReady?:boolean;physicsLoad?:Promise<void>;destroyed:boolean;resetPhysics():void};
 let started=0;const arena=Object.create(Arena.prototype) as LazyPhysics;Object.assign(arena,{destroyed:false,resetPhysics:()=>started++});assert.equal(started,0);assert.equal(arena.physicsLoad,undefined);
 const first=arena.loadPhysics();assert.equal(arena.loadPhysics(),first);await first;assert.equal(started,1);assert.equal(arena.physicsReady,true);
 const abandoned=Object.create(Arena.prototype) as LazyPhysics;Object.assign(abandoned,{destroyed:false,resetPhysics:()=>assert.fail('destroyed arena initialized physics')});const pending=abandoned.loadPhysics();abandoned.destroyed=true;await pending;assert.ok(!abandoned.physicsReady);
});
