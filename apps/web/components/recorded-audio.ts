import type {SoundKind} from './combat-audio';
import {GUNS} from '@sirocco/shared';
export const RECORDED_AUDIO:Partial<Record<SoundKind,string[]>>={
 'spray':Array.from({length:3},(_,i)=>`/audio/spray/spray-${i}.wav`),
 'knife':Array.from({length:4},(_,i)=>`/audio/knife/swing-${i}.wav`),
 'knife-hit':Array.from({length:2},(_,i)=>`/audio/knife/hit-${i}.wav`),
 'knife-wall':Array.from({length:2},(_,i)=>`/audio/knife/wall-${i}.wav`),
 ...Object.fromEntries(['asphalt','stone','grit','metal','wood'].map(surface=>[`step-${surface}`,Array.from({length:4},(_,i)=>`/audio/footsteps/${surface}-${i}.wav`)])),
 ...Object.fromEntries(GUNS.map(weapon=>[`reload-${weapon}`,[`/audio/reloads/${weapon}.wav`]])),
};
/** Same-origin, bundled PCM recordings work without third-party services or Ogg
 * codec support. Successful downloads remain cached if another file fails. */
export class RecordedAudio<T> {
 private buffers=new Map<string,T>();private pending?:Promise<boolean>;
 load(decode:(url:string)=>Promise<T>):Promise<boolean>{
  if(this.pending)return this.pending;
  const urls=Object.values(RECORDED_AUDIO).flat().filter(url=>!this.buffers.has(url));
  const request=Promise.all(urls.map(async url=>{try{this.buffers.set(url,await decode(url));return true;}catch{return false;}})).then(results=>results.every(Boolean));
  this.pending=request;void request.finally(()=>{if(this.pending===request)this.pending=undefined;});return request;
 }
 get(kind:SoundKind,variant:number){const files=RECORDED_AUDIO[kind];return files?this.buffers.get(files[variant%files.length]):undefined;}
 clear(){this.buffers.clear();}
}
