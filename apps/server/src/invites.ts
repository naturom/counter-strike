import {DEFAULT_TEAM_AVATARS,validTeamAvatars,type TeamAvatars,DEFAULT_MAP,validMap,validMode,type GameMode,type MapId} from '@sirocco/shared';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export type Invite={v:1;id:string;exp:number;mapId?:MapId;mode?:GameMode;teamAvatars?:TeamAvatars};
export function signer(secret:string) {
  if(Buffer.byteLength(secret)<32)throw new Error('INVITE_SECRET must contain at least 32 bytes');
  const sign=(body:string)=>createHmac('sha256',secret).update(body).digest('base64url');
  return {
    create(now=Date.now(),mapId:MapId=DEFAULT_MAP,mode:GameMode='deathmatch',teamAvatars:TeamAvatars=DEFAULT_TEAM_AVATARS) {if(!validTeamAvatars(teamAvatars))throw new Error('Choose a different character for each team');const payload:Invite={v:1,id:randomBytes(16).toString('hex'),exp:now+7*86400000,mapId,mode,teamAvatars:{...teamAvatars}};const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${body}.${sign(body)}`;},
    verify(token:unknown,now=Date.now()):Invite {
      if(typeof token!=='string'||token.length>512)throw new Error('Invalid invitation');
      const [body,sig,extra]=token.split('.');if(!body||!sig||extra)throw new Error('Invalid invitation');
      const expected=Buffer.from(sign(body));const actual=Buffer.from(sig);
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new Error('Invalid invitation');
      let data:Invite;try{data=JSON.parse(Buffer.from(body,'base64url').toString());}catch{throw new Error('Invalid invitation');}
      if(data.v!==1||! /^[a-f0-9]{32}$/.test(data.id)||!Number.isSafeInteger(data.exp)||data.exp<=now)throw new Error('Invitation expired. Create a new room.');
      if(data.mapId!==undefined&&!validMap(data.mapId))throw new Error('Invalid map');
      if(data.mode!==undefined&&!validMode(data.mode))throw new Error('Invalid mode');
      if(data.mode==='defusal'&&data.mapId!=='dunes')throw new Error('Bomb Defusal requires Dust III');
      if(data.teamAvatars!==undefined&&!validTeamAvatars(data.teamAvatars))throw new Error('Invalid team characters');
      return {...data,teamAvatars:{...(data.teamAvatars??DEFAULT_TEAM_AVATARS)},mapId:data.mapId??'relay',mode:data.mode??'deathmatch'};
    }
  };
}
