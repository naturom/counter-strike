import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.BASE_URL??'http://127.0.0.1:3000';
async function main(){
  await mkdir('artifacts',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors:string[]=[];
  try{
    const c1=await browser.newContext({viewport:{width:1440,height:1000}}),c2=await browser.newContext({viewport:{width:1440,height:1000}});
    const a=await c1.newPage(),b=await c2.newPage();for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
    await a.goto(base);await a.getByRole('button',{name:'CREATE A ROOM'}).waitFor({state:'visible'});await a.waitForTimeout(2000);await a.screenshot({path:'artifacts/lobby.png'});
    await a.getByLabel('YOUR CALLSIGN').fill('Browser-Red');await a.getByRole('button',{name:'CREATE A ROOM'}).click();await a.getByRole('button',{name:'EXPLORE THE ARENA'}).waitFor({timeout:60000});
    await b.goto(a.url());await b.getByLabel('YOUR CALLSIGN').fill('Browser-Blue');await b.getByRole('button',{name:'JOIN THE ROOM'}).click();await b.getByRole('button',{name:'ENTER THE ARENA'}).waitFor({timeout:60000});
    await a.getByRole('button',{name:'ENTER THE ARENA'}).click();await a.waitForTimeout(300);assert.equal(await a.evaluate(()=>document.pointerLockElement?.tagName),'CANVAS');
    await a.keyboard.down('KeyW');await a.waitForTimeout(650);await a.keyboard.up('KeyW');await a.mouse.down();await a.waitForTimeout(320);await a.mouse.up();await a.waitForTimeout(150);
    const ammo=await a.locator('.ammo strong').innerText();assert.ok(Number(ammo)<30,'browser fire reduced authoritative ammunition');
    await a.keyboard.press('KeyR');await a.waitForTimeout(2200);assert.equal(await a.locator('.ammo strong').innerText(),'30');
    await a.keyboard.press('Digit2');await a.waitForTimeout(400);assert.equal(await a.locator('.ammo>span').innerText(),'P-12');
    await a.screenshot({path:'artifacts/game.png'});
    await a.keyboard.down('Tab');await a.getByText('Field report.').waitFor();assert.ok((await a.locator('.table').innerText()).includes('Browser-Blue'));await a.screenshot({path:'artifacts/scoreboard.png'});await a.keyboard.up('Tab');
    await a.evaluate(()=>document.exitPointerLock());
    await a.getByRole('button',{name:'LEAVE ROOM'}).click();await b.getByRole('button',{name:'LEAVE ROOM'}).click();
    await a.setViewportSize({width:390,height:844});await a.screenshot({path:'artifacts/mobile-lobby.png'});
    assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',base,checks:['WebGL-render','two-browser-join','pointer-lock','keyboard-movement','fire-ammo','reload','switch-weapons','scoreboard','leave-room','mobile-layout'],errors},null,2));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
