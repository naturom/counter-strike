import {createGameServer} from '../../apps/server/src/http';
async function main(){const server=await createGameServer({secret:process.env.INVITE_SECRET});const port=await server.listen();process.send?.({port});process.on('SIGTERM',()=>{void server.close().then(()=>process.exit(0));});}
void main();
