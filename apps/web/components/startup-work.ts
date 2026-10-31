/** Give the browser a paint/input opportunity between expensive visual jobs. */
function nextPaint(run:()=>void){
 if(typeof document==='undefined'||document.visibilityState==='hidden')setTimeout(run,0);
 else requestAnimationFrame(()=>setTimeout(run,0));
}
export const afterPaint=()=>new Promise<void>(resolve=>nextPaint(resolve));

export class VisualWorkQueue{
 private jobs:{run:()=>void;cancelled:boolean}[]=[];private pending=false;
 constructor(private defer:(run:()=>void)=>void=nextPaint){}
 add(run:()=>void){const job={run,cancelled:false};this.jobs.push(job);this.schedule();return()=>{job.cancelled=true;};}
 private schedule(){
  if(this.pending||!this.jobs.length)return;this.pending=true;
  this.defer(()=>{this.pending=false;const job=this.jobs.shift();try{if(job&&!job.cancelled)job.run();}finally{this.schedule();}});
 }
}
export const previewWork=new VisualWorkQueue();
