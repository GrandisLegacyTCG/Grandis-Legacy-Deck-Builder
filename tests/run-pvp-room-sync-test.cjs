'use strict';
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const root = path.resolve(__dirname, '..');
const port = 34000 + Math.floor(Math.random()*1500);
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function makeClient(url){
  const ws=new WebSocket(url); const state={ws,snapshot:null,notices:[],waiters:[]};
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw);}catch{return;} if(m.type==='snapshot'){state.snapshot=m; for(const w of state.waiters.splice(0))w();} else state.notices.push(m);});
  state.waitFor=async pred=>{for(let i=0;i<100;i++){if(state.snapshot&&pred(state.snapshot))return state.snapshot;await Promise.race([new Promise(r=>state.waiters.push(r)),sleep(100)]);}throw new Error('Timed out waiting for snapshot');};
  state.waitNotice=async pred=>{for(let i=0;i<100;i++){const found=state.notices.find(pred);if(found)return found;await sleep(50);}throw new Error('Timed out waiting for notice');};
  state.send=(type,payload={})=>ws.send(JSON.stringify({type,...payload}));
  return new Promise((resolve,reject)=>{ws.once('open',()=>resolve(state));ws.once('error',reject);});
}
function allHidden(arr){return Array.isArray(arr)&&arr.every(x=>x==='__HIDDEN_CARD_BACK__');}
(async()=>{
 const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
 let c1,c2,c3,c4;
 try{
   await sleep(1200);
   const base=`ws://127.0.0.1:${port}/ws?room=RUNTIMEQA`;
   c1=await makeClient(`${base}&client=qa1&name=Alice&role=player&deck=starter_01_elemental_lord_conqueror_saint`);
   c2=await makeClient(`${base}&client=qa2&name=Bob&role=player&deck=starter_05_renegade_conqueror_grand_ranger`);
   await c1.waitFor(s=>s.players&&s.players.length===2);
   await c2.waitFor(s=>s.players&&s.players.length===2);
   if(c1.snapshot.local.seat!==1||c2.snapshot.local.seat!==2)throw new Error('Seat assignment/sync failed');
   const c1Own=c1.snapshot.players.find(p=>p.seat===1),c1Other=c1.snapshot.players.find(p=>p.seat===2);
   const c2Own=c2.snapshot.players.find(p=>p.seat===2),c2Other=c2.snapshot.players.find(p=>p.seat===1);
   if(!c1Own?.hasDeck||!c2Own?.hasDeck||!c1Other?.hasDeck||!c2Other?.hasDeck)throw new Error('Lobby deck locked status missing');
   if(c1Other.deckKey||c1Other.deckName||c1Other.deckSource||c2Other.deckKey||c2Other.deckName||c2Other.deckSource)throw new Error('Opponent deck identity leaked during setup');
   if(!c1.snapshot.local.deckName||!c2.snapshot.local.deckName)throw new Error('Local owner deck identity missing');
   c1.send('ready',{ready:true}); c2.send('ready',{ready:true});
   await c1.waitFor(s=>s.players.length===2&&s.players.every(p=>p.ready));
   c1.send('start-match',{seed:'qa-seed'});
   await c2.waitFor(s=>s.match&&s.match.status==='coin-flip');
   c2.send('choose-coin-flip',{choice:'Heads'});
   await c1.waitFor(s=>s.match&&s.match.status==='coin-result');
   c1.send('confirm-coin-flip');
   const s1=await c1.waitFor(s=>s.match&&s.match.status==='started'&&s.match.serverBoard);
   const s2=await c2.waitFor(s=>s.match&&s.match.status==='started'&&s.match.serverBoard);
   const a1=s1.match.serverBoard.appState,a2=s2.match.serverBoard.appState;
   const startedP1=s1.players.find(p=>p.seat===1),startedP2=s1.players.find(p=>p.seat===2);
   if(!startedP1?.deckName||!startedP2?.deckName)throw new Error('Deck identity was not revealed after setup');

   c3=await makeClient(`${base}&client=qa3&name=Student&role=spectator`);
   const regular=await c3.waitFor(s=>s.match&&s.match.status==='started'&&s.match.serverBoard);
   const ar=regular.match.serverBoard.appState;
   if(!allHidden(ar.playerHand)||!allHidden(ar.aiHand))throw new Error('Normal spectator received a player hand');
   if(!allHidden(ar.playerLegacy)||!allHidden(ar.aiLegacy))throw new Error('Normal spectator received a private Legacy zone');
   c4=await makeClient(`${base}&client=qa4&name=Teacher&role=spectator`);
   await c4.waitFor(s=>s.match&&s.match.status==='started'&&s.match.serverBoard);
   c4.send('authorize-observer',{password:'WrongPassword'});
   const denied=await c4.waitNotice(m=>m.type==='notice'&&m.kind==='error'&&/Invalid observer password/i.test(m.message||''));
   if(!denied)throw new Error('Wrong observer password was not rejected');
   c4.send('authorize-observer',{password:'GLObserver'});
   const authorized=await c4.waitFor(s=>s.local&&s.local.observerAuthorized===true&&s.match&&s.match.serverBoard&&s.match.serverBoard.pvpObserverBothHands===true);
   const aa=authorized.match.serverBoard.appState;
   if(allHidden(aa.playerHand)||allHidden(aa.aiHand))throw new Error('Authorized Observer did not receive both current Hands');
   if(!allHidden(aa.playerDeck)||!allHidden(aa.aiDeck))throw new Error('Authorized Observer received Main Deck order');
   if(!allHidden(aa.playerLegacy)||!allHidden(aa.aiLegacy))throw new Error('Authorized Observer received private Legacy zones');
   c4.send('runtime-intent',{intent:'advancePhase',args:[],baseRevision:Number(authorized.match.serverBoardRevision||0)});
   await c4.waitNotice(m=>m.type==='notice'&&m.kind==='error'&&/read-only/i.test(m.message||''));
   if(!Array.isArray(a1.playerHand)||allHidden(a1.playerHand))throw new Error('Player 1 own hand was masked');
   if(!allHidden(a1.aiHand))throw new Error('Player 1 received opponent private hand');
   if(!Array.isArray(a2.aiHand)||allHidden(a2.aiHand))throw new Error('Player 2 own hand was masked');
   if(!allHidden(a2.playerHand))throw new Error('Player 2 received opponent private hand');
   const p1OpponentDraws=(a1.presentationEvents||[]).filter(e=>e&&e.type==='CARD_DRAWN'&&e.side==='AI');
   const p2OpponentDraws=(a2.presentationEvents||[]).filter(e=>e&&e.type==='CARD_DRAWN'&&e.side==='PLAYER');
   if(p1OpponentDraws.some(e=>e.card_id!=='__HIDDEN_CARD_BACK__'))throw new Error('Player 1 received opponent draw identity through presentation events');
   if(p2OpponentDraws.some(e=>e.card_id!=='__HIDDEN_CARD_BACK__'))throw new Error('Player 2 received opponent draw identity through presentation events');
   if(a1.lastDrawnCardBySide&&a1.lastDrawnCardBySide.AI!=='__HIDDEN_CARD_BACK__')throw new Error('Player 1 received opponent last drawn card');
   if(a2.lastDrawnCardBySide&&a2.lastDrawnCardBySide.PLAYER!=='__HIDDEN_CARD_BACK__')throw new Error('Player 2 received opponent last drawn card');
   const before=Number(s1.match.serverBoardRevision||0);
   const activeSeat=a1.turn==='AI'?2:1; const active=activeSeat===1?c1:c2;
   if(a1.pvpTurnReady!==true)throw new Error('Opening turn did not wait for Your Turn acknowledgement');
   active.send('runtime-intent',{intent:'acknowledgePvpTurnStart',args:[],baseRevision:before});
   const acknowledged=await active.waitFor(s=>Number(s.match.serverBoardRevision||0)>before&&s.match.serverBoard.appState.pvpTurnReady!==true);
   const ackRevision=Number(acknowledged.match.serverBoardRevision||0);
   if(acknowledged.match.serverBoard.appState.pending?.type==='draw_replacement_choice'){
     active.send('runtime-intent',{intent:'confirmDrawReplacement',args:['keep'],baseRevision:ackRevision});
     await active.waitFor(s=>Number(s.match.serverBoardRevision||0)>ackRevision&&!s.match.serverBoard.appState.pending);
   }
   const phaseReady=active.snapshot;
   const phaseRevision=Number(phaseReady.match.serverBoardRevision||0);
   active.send('runtime-intent',{intent:'advancePhase',args:[],baseRevision:phaseRevision});
   const changed=await c1.waitFor(s=>Number(s.match.serverBoardRevision||0)>phaseRevision);
   if(Number(changed.match.serverBoardRevision)<=phaseRevision)throw new Error('Server runtime intent did not advance canonical revision');
   console.log(JSON.stringify({ok:true,seats:[c1.snapshot.local.seat,c2.snapshot.local.seat],lobbyDeckIdentityMasked:true,deckIdentityRevealedAfterStart:true,privateStateMasked:true,authorizedObserverBothHands:true,observerOtherPrivateZonesMasked:true,drawIdentityMasked:true,roomStatus:changed.match.status,revisionBefore:phaseRevision,revisionAfter:changed.match.serverBoardRevision},null,2));
 } finally {
   try{c1&&c1.ws.close();}catch{} try{c2&&c2.ws.close();}catch{} try{c3&&c3.ws.close();}catch{} try{c4&&c4.ws.close();}catch{}
   child.kill('SIGTERM'); await sleep(150); if(!child.killed)child.kill('SIGKILL');
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
