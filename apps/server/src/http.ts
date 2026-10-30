import {DEFAULT_MAP,validMap,validMode} from '@sirocco/shared';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {randomBytes} from 'node:crypto';
import {Server,matchMaker} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {signer} from './invites';
import {ArenaRoom,activeRooms,roomsByInvite,configureRooms,log} from './rooms';
export async function createGameServer(options:{secret?:string;handler?:(req:IncomingMessage,res:ServerResponse)=>void|Promise<void>}={}) {
  const secret=options.secret??process.env.INVITE_SECRET;
  if(!secret&&process.env.NODE_ENV==='production')throw new Error('Production requires INVITE_SECRET from Secret Manager');
  if(!secret)log('development_ephemeral_secret',{message:'Local invitations expire when the server restarts. Set INVITE_SECRET to persist.'});
  const signs=signer(secret??randomBytes(48).toString('base64url'));configureRooms(signs);
  const requests=new Map<string,{time:number;count:number}>();
  const pending=new Map<string,Promise<unknown>>();
  let stopping=false;
  async function serial<T>(key:string,fn:()=>Promise<T>):Promise<T>{
    const prior=pending.get(key)??Promise.resolve();
    const job=prior.catch(()=>{}).then(fn);pending.set(key,job);
    try{return await job;}finally{if(pending.get(key)===job)pending.delete(key);}
  }
  function json(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  const http=createServer(async(req,res)=>{
    const path=(req.url??'/').split('?')[0];
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    if(path==='/health'){json(res,stopping?503:200,{ok:!stopping,service:'desert-fps',rooms:activeRooms.size,version:'2.0.0'});return;}
    if(path.startsWith('/api/')||path.startsWith('/matchmake/')) {
      // Behind Cloud Run the last X-Forwarded-For hop is set by its trusted proxy.
      const forwarded=String(req.headers['x-forwarded-for']??'').split(',').map(s=>s.trim());
      const key=process.env.K_SERVICE?(forwarded.at(-1)||req.socket.remoteAddress||'unknown'):req.socket.remoteAddress||'local';
      const now=Date.now();let b=requests.get(key);if(!b||now-b.time>60000){b={time:now,count:0};requests.set(key,b);}
      if(requests.size>10000)for(const [k,v] of requests)if(now-v.time>60000)requests.delete(k);
      if(++b.count>90){json(res,429,{error:'Too many requests. Wait a minute.'});return;}
      if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){json(res,403,{error:'Origin rejected'});return;}}catch{json(res,403,{error:'Origin rejected'});return;}}
    }
    if(path==='/api/rooms'&&req.method==='POST') {
      try{
        if(stopping){json(res,503,{error:'Server restarting. Retry shortly.'});return;}
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048){json(res,413,{error:'Request too large'});return;}}
        const body=JSON.parse(raw||'{}');
        const createOnly=body.action==='create';
        if(!createOnly&&(typeof body.nickname!=='string'||!body.nickname.trim()||body.nickname.length>20)){json(res,400,{error:'Enter a nickname (1–20 characters).'});return;}
        if(body.mapId!==undefined&&!validMap(body.mapId))throw new Error('Unknown map');
        if(body.mode!==undefined&&!validMode(body.mode))throw new Error('Unknown mode');
        const invite=body.invite??signs.create(Date.now(),body.mapId??DEFAULT_MAP,body.mode??'deathmatch');const payload=signs.verify(invite);
        const result=await serial(payload.id,async()=>{
          let id=roomsByInvite.get(payload.id);let room=id?await matchMaker.query({roomId:id}):[];
          const fresh=!room.length;
          if(!room.length){
            if(activeRooms.size>=12)throw Object.assign(new Error('Server at capacity. Try again later.'),{status:503});
            const created=await matchMaker.createRoom('arena',{invite,awaitProfile:createOnly});id=created.roomId;room=[created];
          }
          const local=activeRooms.get(id!);
          if(local && local.sim.players.size>=8 || room[0].locked)throw Object.assign(new Error('Room full: all 8 seats are occupied or reconnecting.'),{status:409});
          if(createOnly)return {invite,roomId:id,fresh,mapId:payload.mapId,mode:payload.mode,matchId:local?.sim.matchId};
          const reservation=await matchMaker.reserveSeatFor(room[0],{invite,nickname:body.nickname});
          return {invite,reservation,fresh,mapId:payload.mapId,mode:payload.mode,matchId:local?.sim.matchId};
        });
        json(res,200,result);
      }catch(error){const e=error as Error & {status?:number};json(res,e.status??400,{error:e.message||'Unable to join room'});}
      return;
    }
    if(path.startsWith('/matchmake/')&&!path.startsWith('/matchmake/reconnect/')){json(res,403,{error:'Use the signed invitation endpoint.'});return;}
    if(path.startsWith('/matchmake/'))return; // Colyseus installs its own HTTP router.
    if(options.handler){await options.handler(req,res);return;}
    json(res,404,{error:'Not found'});
  });
  const transport=new WebSocketTransport({server:http,maxPayload:4096,pingInterval:0,verifyClient: (info:{origin:string;req:IncomingMessage}) => !info.origin || (()=>{try{return new URL(info.origin).host===info.req.headers.host;}catch{return false;}})()});
  const game=new Server({transport,greet:false,gracefullyShutdown:false});
  game.define('arena',ArenaRoom);
  const appRequest=http.listeners('request')[0];
  function installRouter(){
  const colyseusRequest=http.listeners('request').find(listener=>listener!==appRequest)!;
  http.removeAllListeners('request');
  http.on('request',(req,res)=>{
    const path=(req.url??'/').split('?')[0];
    if(path.includes('/matchmake')) {
      if(!/^\/matchmake\/reconnect\/[A-Za-z0-9_-]+$/.test(path)||req.method!=='POST'){json(res,403,{error:'Use the signed invitation endpoint.'});return;}
      if(Number(req.headers['content-length']??0)>2048){json(res,413,{error:'Request too large'});return;}
      const key='reconnect:'+req.socket.remoteAddress;const now=Date.now();let b=requests.get(key);
      if(!b||now-b.time>60000){b={time:now,count:0};requests.set(key,b);}
      if(++b.count>180){json(res,429,{error:'Reconnect rate limited'});return;}
      if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){json(res,403,{error:'Origin rejected'});return;}}catch{json(res,403,{error:'Origin rejected'});return;}}
    }
    if(path.startsWith('/matchmake/'))colyseusRequest.call(http,req,res);else appRequest.call(http,req,res);
  });
  }
  return {http,game,signs,async listen(port=0){await game.listen(port,'0.0.0.0');installRouter();const address=http.address();return typeof address==='object'&&address?address.port:port;},async close(){stopping=true;await game.gracefullyShutdown(false);}};
}
