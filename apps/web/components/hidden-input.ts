/** Local gesture only; the server independently validates every summon request. */
export class HiddenInput {
 private last=-Infinity;
 reset(){this.last=-Infinity;}
 key(event:{code:string;repeat:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean},now:number){
  if(event.repeat)return false;
  if(event.code!=='KeyK'||event.ctrlKey||event.metaKey||event.altKey){this.reset();return false;}
  const trigger=now-this.last>=0&&now-this.last<=450;this.last=trigger?-Infinity:now;return trigger;
 }
}
