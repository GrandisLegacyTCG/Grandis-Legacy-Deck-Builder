import { readFileSync } from 'node:fs';
const DATA=JSON.parse(readFileSync(new URL('./data/game_data.json',import.meta.url),'utf8'));
export const VERSION='1.0.0';
export const MAIN=new Map(DATA.mainPool.map(c=>[c.card_id,c]));
export const SCRIPTS=new Map(DATA.scripts.map(s=>[s.card_id,s]));
export const DEF=new Map(DATA.defPool.map(c=>[c.card_id,c]));
export const HERO=DATA.heroData;
export const LEGACY=DATA.legacyData;
export const PACKAGES=new Map(DATA.sidePackages.map(p=>[p.package_id,p]));
const LANES=['LEFT','CENTER','RIGHT'];
const NEGATIVE=['Burn','Bleed','Freeze','Stun','Curse','Poison'];
export function safeRoom(v){return String(v||'missing-room').replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,180)||'missing-room'}
export function safeText(v,max=160){return String(v||'').replace(/[<>]/g,'').slice(0,max)}
const clone=(x)=>JSON.parse(JSON.stringify(x));
const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
const rankNum=(rank)=>String(rank||'').includes('III')?3:String(rank||'').includes('II')?2:1;
const hp=(h)=>Math.max(0,n(h?.maxHp)-n(h?.damage));
const alive=(h)=>!!h&&!h.legacy&&hp(h)>0;
const opponent=(seat)=>seat===1?2:1;

function virtualChoiceCard(id,name,text=''){return{card_id:id,card_name:name,card_type:'Choice',card_subtype:'Choice',mana_cost:0,class_family:'',class_rank:'',timing:'',target_type:'',attack_type:'',base_damage:'',heal:'',effect_text:text,image_url:'',thumbnail_url:'',is_ultimate:'FALSE'}}
function openingFirstTurnLocked(m,seat){return !!(m.openingProtection?.active&&m.openingProtection.seat===seat&&m.activeSeat===seat)}
function offensiveOrDisruptive(card){const txt=String(card?.effect_text||'').toLowerCase(),target=String(card?.target_type||'').toLowerCase();return !!(card&&(card.card_subtype==='ATK'||target.includes('opponent')||/opponent|enemy|damage|stun|burn|freeze|bleed|poison|curse|discard.*opponent|cancel/.test(txt)))}
function enforceFirstTurn(m,seat,card){if(openingFirstTurnLocked(m,seat)&&offensiveOrDisruptive(card))throw new Error('First Turn Rule prevents offensive or disruptive actions during the opening winner turn.')}
function consumeOpeningProtection(room,seat){const m=room.match;if(m.openingProtection?.active&&m.openingProtection.seat===seat){m.openingProtection.active=false;addLog(room,`First Turn protection ends for Player ${seat}.`)}}
function clearSourceTimedEffects(room,seat){for(const p of Object.values(room.match.players||{}))for(const h of Object.values(p.board||{})){if(!h?.tmp)continue;if(h.tmp.tauntExpiresAtStartOf===seat){delete h.tmp.taunt;delete h.tmp.tauntExpiresAtStartOf}if(h.tmp.untargetableExpiresAtStartOf===seat){delete h.tmp.untargetable;delete h.tmp.untargetableExpiresAtStartOf}if(h.tmp.attackUntargetableExpiresAtStartOf===seat){delete h.tmp.attackUntargetable;delete h.tmp.attackUntargetableExpiresAtStartOf}if(h.tmp.attackDebuffExpiresAtStartOf===seat){delete h.tmp.attackDebuff;delete h.tmp.attackDebuffExpiresAtStartOf}if(h.tmp.divinityImmuneExpiresAtStartOf===seat){delete h.tmp.divinityImmune;delete h.tmp.divinityImmuneExpiresAtStartOf}}}
function activeTauntSlot(m,targetSeat){return LANES.find(l=>alive(m.players[targetSeat]?.board?.[l])&&m.players[targetSeat].board[l].tmp?.taunt)||null}
function passiveAttackBonus(h){const id=String(h?.id||'');if(['S1-WAR-H003','S1-MAG-H002','S1-MAG-H003','S1-MAG-H006','S1-THF-H003'].includes(id))return 10;return 0}
function archerSingleTargetAttackBonus(h,card,aoe=false){const id=String(h?.id||'');if(!['S1-ARC-H002','S1-ARC-H003'].includes(id))return 0;if(aoe)return 0;const txt=String([card?.target_type,card?.target_selector,card?.mechanic_tags,card?.effect_text,card?.short_text,card?.full_description].filter(Boolean).join(' ')).toLowerCase();if(/aoe|area|all opponent|all enemy|all active opponent|each opponent|all opposing/.test(txt))return 0;return id==='S1-ARC-H003'?20:10}
function enhancedBurnTrigger(h){return ['S1-MAG-H005','S1-MAG-H006'].includes(String(h?.id||''))}
function removeOneNegative(h){for(const k of NEGATIVE)if(n(h?.status?.[k])>0){delete h.status[k];return k}return null}
function saintCleanseAfterHeal(room,user,target){if(String(user?.id||'')!=='S1-CLE-H003'||!target)return;const removed=removeOneNegative(target);if(removed)addLog(room,`Holy Rejuvenation removes ${removed} from ${target.name}.`)}
function healHero(room,user,target,amount,label){if(!alive(target))return false;if(target.status.Bleed){addLog(room,`${label} healing is prevented by Bleed on ${target.name}.`);return false}const grace=target?.tmp?.ringGrace?20:0,total=Math.max(0,n(amount))+grace,before=target.damage;target.damage=Math.max(0,target.damage-total);const healed=Math.max(0,before-target.damage);addLog(room,`${label} heals ${target.name} by ${healed}${grace?` (Ring of Grace +${grace})`:''}.`);if(healed>0)saintCleanseAfterHeal(room,user,target);return healed>0}
function flashpowderOptions(m,seat){const p=m.players[seat],out=[];for(const [index,card] of p.hand.entries())if(card.card_id==='S1-ITM-017')for(const slot of LANES){const h=p.board[slot];if(alive(h)&&!h.exhausted&&!h.actionZone&&!h.status.Stun)out.push({index,userSlot:slot,card:{...card,card_name:`${card.card_name} — ${slot} / ${h.name}`}})}return out}
function bindingLightOptions(m,seat){const p=m.players[seat],out=[];for(const [index,card] of p.hand.entries())if(card.card_id==='S1-CLE-012'&&p.mana>=n(card.mana_cost))for(const slot of LANES){const h=p.board[slot];if(alive(h)&&!h.exhausted&&!h.actionZone&&!h.status.Stun&&['Priest','Saint'].includes(h.class))out.push({index,userSlot:slot,card:{...card,card_name:`${card.card_name} — ${slot} / ${h.name}`}})}return out}
function maybeOpenFlashpowder(room,eventContext){const m=room.match,seat=opponent(eventContext.seat),options=flashpowderOptions(m,seat);if(!options.length)return false;options.push({index:-1,userSlot:null,card:virtualChoiceCard('PASS-FLASHPOWDER','Pass — let Event resolve','Do not use Flashpowder Bomb.')});m.pendingChoice={type:'FLASHPOWDER_WINDOW',seat,prompt:'Opponent Event declared. Use Flashpowder Bomb or pass.',options,eventContext};addLog(room,`FLASHPOWDER WINDOW: Player ${seat} may cancel ${eventContext.card.card_name} or pass.`);return true}
function maybeOpenBindingLight(room,a){if(!a?.selected||a.bindingLightChecked)return false;const types=(DEF.get(a.selected.card.card_id)?.response_types||[]);if(!types.includes('DODGE'))return false;const options=bindingLightOptions(room.match,a.sourceSeat);if(!options.length){a.bindingLightChecked=true;return false}options.push({index:-1,userSlot:null,card:virtualChoiceCard('PASS-BINDING-LIGHT','Pass — allow Dodge','Do not use Binding Light.')});room.match.pendingChoice={type:'BINDING_LIGHT_WINDOW',seat:a.sourceSeat,prompt:'Opponent selected Dodge. Use Binding Light or pass.',options};addLog(room,`BINDING LIGHT WINDOW: Player ${a.sourceSeat} may cancel the selected Dodge or pass.`);return true}

export function addLog(room,message){room.seq++;room.logs.push({seq:room.seq,message:safeText(message,380),at:new Date().toISOString()});if(room.logs.length>400)room.logs.shift()}
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function fullCard(id){const c=MAIN.get(id);if(!c)throw new Error(`Unknown card ${id}.`);return clone(c)}
function expandMain(rows){const out=[],count=new Map();for(const row of rows||[]){const q=n(row.quantity);if(!Number.isInteger(q)||q<1||q>2)throw new Error(`Invalid quantity for ${row.card_name||row.card_id}.`);count.set(row.card_id,(count.get(row.card_id)||0)+q);for(let i=0;i<q;i++)out.push(fullCard(row.card_id))}if(out.length!==50)throw new Error(`Main Deck must contain exactly 50 cards. Found ${out.length}.`);for(const [id,q] of count)if(q>2)throw new Error(`${id} exceeds the 2-copy limit.`);return out}
function normalizeFormation(input,side){const ids=new Set(side.filter(x=>x.card_type==='Hero').map(x=>x.card_id));const f=input||{};for(const lane of LANES)if(!ids.has(String(f[lane]||'')))throw new Error(`Formation ${lane} must use a Hero Card available in the Legacy Deck.`);if(new Set(LANES.map(l=>f[l])).size!==3)throw new Error('Starting formation must use three different Hero Cards.');return clone(f)}
export function normalizeDeck(input){if(!input||typeof input!=='object')throw new Error('Deck file is not a JSON object.');if(String(input.schema_version||'')!=='GL-DECK-1.0')throw new Error('Deck schema must be GL-DECK-1.0.');const main=expandMain(input.main_deck);const side=((Array.isArray(input.legacy_deck_expanded)&&input.legacy_deck_expanded.length?input.legacy_deck_expanded:input.side_deck_expanded)||[]).map(x=>({card_id:safeText(x.card_id,48),card_name:safeText(x.card_name,90),card_type:safeText(x.card_type,24),package_id:safeText(x.package_id,60)}));if(side.length!==20)throw new Error(`Legacy Deck must contain exactly 20 cards. Found ${side.length}.`);return{schema_version:'GL-DECK-1.0',deck_name:safeText(input.deck_name||'Custom Deck',90),main,side,formation:normalizeFormation(input.default_formation,side)}}
// v0.7.0 RC rank-up resolver fix: visual-source Hero package labels differ from runtime package-instance IDs.
function runtimePackageIdForHero(id,fallback=''){for(const [packageId,pkg] of PACKAGES)if((pkg.cards||[]).some(x=>String(x.card_id||'')===String(id||'')))return packageId;return fallback}
function runtimePackageForHero(h){const packageId=runtimePackageIdForHero(h?.id,h?.packageId||'');return PACKAGES.get(packageId)||PACKAGES.get(h?.packageId)||null}
function makeHero(id){const h=HERO[id];if(!h)throw new Error(`Unknown Hero ${id}.`);return{id:h.id,name:h.name,race:h.race,class:h.class,baseFamily:h.base_family,rank:h.rank,image_url:h.image_url,thumbnail_url:h.thumbnail_url||h.image_url,maxHp:n(h.hp),damage:0,exp:0,expCards:[],exhausted:false,status:{},tmp:{},actionZone:null,legacy:false,legacyUsed:false,racialUsed:false,abilityUsed:false,abilityName:h.ability_name||'',abilityText:h.ability_text||'',packageId:runtimePackageIdForHero(id,h.package),defeatedStack:[]}}
function sideRemove(player,id){const idx=player.side.findIndex(x=>x.card_id===id);if(idx>=0)return player.side.splice(idx,1)[0];return null}
function makeRuntime(client,random=Math.random){const d=client.deck;const p={seat:client.seat,name:client.name,deckName:d.deck_name,deck:shuffle(d.main,random),hand:[],discard:[],side:clone(d.side),mana:2,regen:1,racial:2,racialUsedTurn:false,board:{},casting:[],tributeUsed:0,rankUsed:0,dualCasting:null,finalGritUsedHeroes:{},stonebloodUsedHeroes:{}};for(const lane of LANES){const id=d.formation[lane];sideRemove(p,id);p.board[lane]=makeHero(id)}draw(p,6,false);return p}
function draw(p,amount,required=false){for(let i=0;i<amount;i++){if(!p.deck.length){if(required)return false;break}p.hand.push(p.deck.shift())}return true}
export function createRoom(id){return{id,clients:new Map(),spectators:new Map(),seq:0,logs:[],match:{status:'setup',mode:'MAIN'}}}
export function chooseSeat(room){const s=new Set([...room.clients.values()].map(c=>c.seat));return s.has(1)?2:1}
function statusesText(h){return Object.entries(h.status||{}).map(([k,v])=>`${k} ${v}`).join(', ')}
function publicHero(h){if(!h)return null;return{id:h.id,name:h.name,race:h.race,class:h.class,baseFamily:h.baseFamily,rank:h.rank,image_url:h.image_url,thumbnail_url:h.thumbnail_url||h.image_url,maxHp:h.maxHp,hp:hp(h),damage:h.damage,exp:h.exp,expCards:h.expCards.map(c=>({card_id:c.card_id,card_name:c.card_name,exp:n(c.exp_value,100),ultimate:String(c.is_ultimate).toUpperCase()==='TRUE'})),exhausted:h.exhausted,status:clone(h.status),statusText:statusesText(h),actionZone:h.actionZone,legacy:h.legacy,legacyUsed:h.legacyUsed,racialUsed:h.racialUsed,abilityUsed:h.abilityUsed,abilityName:h.abilityName||'',abilityText:h.abilityText||'',legacyEffectText:h.legacyEffectText||'',tmp:clone(h.tmp),defeatedStack:clone(h.defeatedStack||[])}}
function publicCard(c,index){return{index,card_id:c.card_id,card_name:c.card_name,card_type:c.card_type,card_subtype:c.card_subtype,mana_cost:n(c.mana_cost),class_family:c.class_family,class_rank:c.class_rank,timing:c.timing,target_type:c.target_type,attack_type:c.attack_type,base_damage:c.base_damage,heal:c.heal,effect_text:c.effect_text,image_url:c.image_url,thumbnail_url:c.thumbnail_url||c.image_url,is_ultimate:String(c.is_ultimate).toUpperCase()==='TRUE'}}
function publicPlayer(p,revealHand=false){if(!p)return null;return{seat:p.seat,name:p.name,deckName:p.deckName,deckCount:p.deck.length,handCount:p.hand.length,hand:revealHand?p.hand.map(publicCard):undefined,discardCount:p.discard.length,discard:p.discard.map(publicCard),sideAvailable:p.side.length,mana:p.mana,regen:p.regen,racial:p.racial,board:Object.fromEntries(LANES.map(l=>[l,publicHero(p.board[l])])),casting:p.casting.map(x=>({card_name:x.card.card_name,slot:x.slot,targetSeat:x.targetSeat,targetSlot:x.targetSlot,remaining:x.remaining})),dualCasting:p.dualCasting?clone(p.dualCasting):null}}
function cleanTempAtStart(p){for(const h of Object.values(p.board)){if(!h)continue;h.exhausted=false;h.racialUsed=false;h.abilityUsed=false;h.legacyUsed=false;if(h.tmp.untilOwnStart)delete h.tmp.untilOwnStart;if(h.tmp.heavensFuryArmed){h.tmp.heavensFuryActive=true;delete h.tmp.heavensFuryArmed}if(h.tmp.enrageArmed){h.tmp.enrageActive=true;delete h.tmp.enrageArmed}}p.racialUsedTurn=false}
function cleanupEnd(room,p){p.tmpRevealOpponentHand=false;if(p.dualCasting){addLog(room,'Dual Casting expires at End Phase because its required sequence was not completed.');p.dualCasting=null}for(const h of Object.values(p.board)){if(!h)continue;delete h.tmp.blessingMight;delete h.tmp.blessingWisdom;delete h.tmp.arcaneScroll;delete h.tmp.holyMedallion;delete h.tmp.ringGrace;delete h.tmp.coordination;delete h.tmp.enrageActive;delete h.tmp.heavensFuryActive;delete h.tmp.poisonVial;delete h.tmp.unbrokenStandStatusImmune;for(const k of Object.keys(h.status||{})){const before=n(h.status[k]);h.status[k]=before-1;addLog(room,`STATUS TICK: ${h.name} ${k} ${before} → ${Math.max(0,h.status[k])}.`);if(h.status[k]<=0){delete h.status[k];addLog(room,`STATUS EXPIRED: ${h.name} is no longer affected by ${k}.`)}}}}
function resolveCasting(room,seat){const p=room.match.players[seat];const ready=p.casting.filter(x=>--x.remaining<=0);p.casting=p.casting.filter(x=>x.remaining>0);for(const c of ready){const h=p.board[c.slot];if(!alive(h)||h.status.Stun){addLog(room,`${c.card.card_name} fails because its caster is unavailable or Stunned.`);if(h)h.actionZone=null;p.discard.push(c.card);continue}h.actionZone=null;const info=cardAttackInfo(c.card,h);if(!info.aoe){const occupant=room.match.players[c.targetSeat]?.board?.[c.targetSlot];if(!alive(occupant)){if(occupant?.legacy){const message=`${c.card.card_name} resolves at locked target zone ${c.targetSlot}, now occupied by Legacy ${occupant.name}. Legacy cannot be damaged or receive status. The delayed attack resolves with no effect and cannot retarget.`;addLog(room,message);announceCardUse(room,seat,c.card,message,'Casting Attack Resolves')}else{const message=`${c.card.card_name} resolves at locked target zone ${c.targetSlot}, but no active Hero occupies that zone. The delayed attack resolves with no effect and cannot retarget.`;addLog(room,message);announceCardUse(room,seat,c.card,message,'Casting Attack Resolves')}p.discard.push(c.card);continue}addLog(room,`${c.card.card_name} resolves at locked target zone ${c.targetSlot} and hits ${occupant.name}.`)}else addLog(room,`${c.card.card_name} finishes Casting and resolves as an Area attack.`);openAttack(room,seat,c.card,c.slot,c.targetSeat,c.targetSlot,true)}}
function startTurn(room,seat){const m=room.match,p=m.players[seat];m.activeSeat=seat;m.turnNumber++;if(seat===1)m.round++;m.phase='Draw Phase';clearSourceTimedEffects(room,seat);cleanTempAtStart(p);if(!draw(p,1,true)){finish(room,opponent(seat),`Player ${seat} cannot perform the required Draw Phase draw.`);return}p.mana=Math.min(12,p.mana+p.regen);m.phase='Deploy Phase';addLog(room,`TURN ${m.turnNumber}: Player ${seat} draws 1, gains ${p.regen} mana, and moves to Deploy Phase. Mana ${p.mana}.`)}
export function startMatch(room,mode='MAIN',random=Math.random){const by={};for(const c of room.clients.values())by[c.seat]=makeRuntime(c,random);room.match={status:'active',mode:mode==='QUICK'?'QUICK':'MAIN',round:0,turnNumber:0,activeSeat:null,phase:'Opening Coin Flip',players:by,pendingAttack:null,pendingChoice:null,legacyQueue:[],winner:null,coinFlip:{pending:true,chooserSeat:2},openingProtection:{active:false,seat:null},cardNotices:[]};addLog(room,`MATCH START: ${room.match.mode} MODE. Opening hands: 6. Starting Mana: 2. Regen: 1.`);addLog(room,'OPENING COIN FLIP: Player 2 chooses Heads or Tails. The winner takes the first turn. First-turn offensive/disruptive protection applies to that opening winner turn.')}
export function chooseCoinFlip(room,client,choice,random=Math.random){const m=room.match,c=m.coinFlip;if(m.status!=='active'||!c?.pending)throw new Error('No opening coin flip is waiting.');if(client.seat!==c.chooserSeat)throw new Error('Only Player 2 chooses Heads or Tails.');const pick=String(choice||'').toUpperCase();if(!['HEADS','TAILS'].includes(pick))throw new Error('Choose Heads or Tails.');const outcome=random()<0.5?'HEADS':'TAILS',firstSeat=pick===outcome?client.seat:opponent(client.seat);Object.assign(c,{pending:false,awaitingConfirmation:true,choice:pick,outcome,firstSeat});m.phase='Opening Coin Flip Result';m.openingProtection={active:true,seat:firstSeat};addLog(room,`OPENING COIN FLIP: Player ${client.seat} chooses ${pick}. Result: ${outcome}. Player ${firstSeat} will take the first turn after confirmation.`)}
export function confirmCoinFlip(room,client){const m=room.match,c=m.coinFlip;if(m.status!=='active'||!c?.awaitingConfirmation)throw new Error('No coin-flip result is waiting for confirmation.');c.awaitingConfirmation=false;addLog(room,`OPENING COIN FLIP CONFIRMED: Player ${c.firstSeat} starts with First Turn protection.`);startTurn(room,c.firstSeat)}
export function resetMatch(room){room.match={status:'setup',mode:'MAIN'};for(const c of room.clients.values())c.ready=false;addLog(room,'Match reset to setup lobby.')}
function assertActive(room,client){const m=room.match;if(m.status!=='active')throw new Error('Match has not started.');if([...room.clients.values()].some(c=>c.connected===false))throw new Error('Match is paused while a player reconnects.');if(m.coinFlip?.pending)throw new Error('Finish the opening coin flip first.');if(m.coinFlip?.awaitingConfirmation)throw new Error('Confirm the opening coin-flip result before starting the game.');if(client.seat!==m.activeSeat)throw new Error('Only the active player may do that.');if(m.pendingAttack)throw new Error('Resolve the Response Window first.');if(m.pendingChoice)throw new Error('Finish the required choice first.');return m}
export function nextPhase(room,client){const m=assertActive(room,client),p=m.players[client.seat];if(m.phase==='Deploy Phase'){m.phase='Battle Phase';addLog(room,`Player ${client.seat} moves to Battle Phase.`);resolveCasting(room,client.seat);prepareDualCastingBattle(room,client.seat)}else if(m.phase==='Battle Phase'){m.phase='Reform Phase';p.tributeUsed=0;p.rankUsed=0;addLog(room,`Player ${client.seat} moves to Reform Phase.`)}else if(m.phase==='Reform Phase'){m.phase='End Phase';addLog(room,`Player ${client.seat} moves to End Phase.`)}else if(m.phase==='End Phase'){consumeOpeningProtection(room,client.seat);cleanupEnd(room,p);if(m.status==='active')startTurn(room,opponent(client.seat))}}
export function endTurn(room,client){const m=assertActive(room,client);consumeOpeningProtection(room,client.seat);cleanupEnd(room,m.players[client.seat]);addLog(room,`Player ${client.seat} ends the turn from ${m.phase}.`);if(m.status==='active')startTurn(room,opponent(client.seat))}
function timingAllows(card,phase){const t=String(card.timing||'');if(card.card_type==='Skill'&&card.card_subtype==='SUPPORT')return ['Deploy Phase','Reform Phase'].includes(phase);if(card.card_type==='Skill'){if(card.card_id==='S1-CLE-012')return false;return t.includes(phase)||card.card_subtype==='DEF'&&phase==='Battle Phase'}if(card.card_type==='Item'){if(DEF.has(card.card_id)||card.card_id==='S1-ITM-017')return false;return phase==='Deploy Phase'||phase==='Reform Phase'&&t.includes('Reform Phase')}if(card.card_type==='Event'){if(card.card_id==='S1-EVT-007')return false;if(['S1-EVT-011','S1-EVT-012','S1-EVT-006'].includes(card.card_id))return phase==='Deploy Phase';return ['Deploy Phase','Reform Phase'].includes(phase)}return false}
function classAllowed(card,h){if(card.card_type==='Event')return true;const restriction=String(card.class_restriction||card.class_family||'').toLowerCase(),rankText=String(card.class_rank||'').toLowerCase();if(!restriction||restriction.includes('all class')||restriction==='all')return true;const cls=String(h.class||'').toLowerCase(),fam=String(h.baseFamily||'').toLowerCase(),tokens=restriction.split(/[;,]|\bor\b/i).map(x=>x.trim()).filter(Boolean);if(card.card_name==='Hammer of Justice')return ['cleric','paladin','crusader'].includes(cls);if(card.card_type==='Item')return tokens.some(x=>x&&(cls.includes(x)||fam.includes(x)||x.includes(cls)||x.includes(fam)));if(card.card_type!=='Skill')return true;if(['paladin','crusader'].includes(cls)){if(tokens.includes(cls)||tokens.includes('paladin'))return true;return ['warrior','cleric'].some(base=>tokens.includes(base)&&(rankText.includes(`${base} rank i`)||rankText.includes(`${base} - all ranks`)))}const lineage=reachedClassLine(h);return tokens.some(x=>x&&(lineage.some(stage=>stage===x||stage.includes(x)||x.includes(stage))||fam===x||fam.includes(x)||x.includes(fam)))}
function v083AttachmentCount(h){const list=Array.isArray(h?.attachments)?h.attachments:[];let count=list.length;if(h?.actionZone&&!list.some(a=>a?.kind==='CASTING'))count++;return count}
function v083Relentless(card){return card?.card_id==='S1-EVT-004'||card?.card_name==='Relentless Leveling'}
function v083CastingEntry(m,seat,slot){return (m?.players?.[seat]?.casting||[]).find(e=>(e.userSlot||e.slot)===slot&&n(e.remaining)>0)}
function v083IdleCastingTurn(m,seat,slot){const e=v083CastingEntry(m,seat,slot);if(!e)return true;const declared=n(e.declaredTurn,e.v083DeclaredTurn??-1),turn=n(m?.turnNumber);return turn>declared&&n(e.remaining)>1||n(e.v083IdleTurn,-1)===turn}
function canUser(card,h,m=null,seat=null,slot=null){if(!alive(h)||h.status.Stun||!classAllowed(card,h))return false;if(v083Relentless(card))return !h.exhausted&&v083AttachmentCount(h)<2&&(!h.actionZone||v083IdleCastingTurn(m,seat,slot));if(card?.card_type==='Item')return !h.actionZone;return !h.exhausted&&!h.actionZone}
function access(mode,slot){if(mode==='QUICK')return LANES;if(slot==='LEFT')return['LEFT','CENTER'];if(slot==='RIGHT')return['CENTER','RIGHT'];return LANES}
function attackTargets(m,seat,userSlot){const targetSeat=opponent(seat),opp=m.players[targetSeat],taunt=activeTauntSlot(m,targetSeat),legal=access(m.mode,userSlot).filter(l=>alive(opp.board[l])&&!opp.board[l].tmp.untargetable&&!opp.board[l].tmp.attackUntargetable);return taunt?legal.filter(l=>l===taunt):legal}
function ownTargets(m,seat){return LANES.filter(l=>alive(m.players[seat].board[l]))}
const SKILL_BUFF_NAMES=new Set(['Blessing of Might','Blessing of Wisdom',"Heaven's Fury"]);
function alliedCardTargets(m,seat,userSlot,card){const all=ownTargets(m,seat);if(card?.card_type==='Item'&&String(card.target_type||'').toLowerCase().includes('allied hero'))return all;if(card?.card_name==='Relentless Leveling')return[userSlot];if(card?.card_type==='Skill'&&card?.card_subtype==='SUPPORT')return all;return all}
function parseDynamic(v,h,fallback=0){if(v===null||v===undefined||v==='')return fallback;if(Number.isFinite(+v))return +v;const txt=String(v),pairs=[...txt.matchAll(/([A-Za-z ]+)\s+(\d+)/g)];if(!pairs.length)return n((txt.match(/\d+/)||[])[0],fallback);const cls=String(h.class||'').toLowerCase();let best=null;for(const p of pairs){const k=p[1].trim().toLowerCase();if(cls.includes(k)||k.includes(cls))best=+p[2]}return best??+pairs[0][2]}
function reachedClassLine(h){const cls=String(h?.class||'').trim().toLowerCase(),lines=[['warrior','gladiator','conqueror'],['warrior','paladin','crusader'],['mage','elementalist','elemental lord'],['cleric','priest','saint'],['archer','marksman','grand ranger']];const line=lines.find(x=>x.includes(cls))||[cls],idx=line.indexOf(cls);return idx>=0?line.slice(0,idx+1):[cls]}
function parseStatusDynamic(v,h,fallback=0){if(v===null||v===undefined||v==='')return fallback;if(Number.isFinite(+v))return +v;const txt=String(v),pairs=[...txt.matchAll(/([A-Za-z ]+)\s+(\d+)/g)];if(!pairs.length)return n((txt.match(/\d+/)||[])[0],fallback);const cls=String(h?.class||'').trim().toLowerCase(),exact=pairs.find(p=>p[1].trim().toLowerCase()===cls);if(exact)return +exact[2];const reached=reachedClassLine(h);let best=null,bestIndex=-1;for(const p of pairs){const key=p[1].trim().toLowerCase(),i=reached.indexOf(key);if(i>=0&&i>=bestIndex){best=+p[2];bestIndex=i}}return best??0}
function outgoingAttack(p,h,card,base,aoe,target=null){let dmg=parseDynamic(card.base_damage,h,base)+passiveAttackBonus(h)+archerSingleTargetAttackBonus(h,card,aoe);if(card.card_name==='Rage Blast'&&target?.status?.Bleed)dmg+=20;if(h.tmp.blessingMight&&!aoe&&String(card.attack_type).toLowerCase().includes('physical'))dmg+=20;if(h.tmp.blessingWisdom&&!aoe&&String(card.attack_type).toLowerCase().includes('magical'))dmg+=20;if(h.tmp.arcaneScroll&&!aoe&&String(card.attack_type).toLowerCase().includes('magical'))dmg+=20;if(h.tmp.holyMedallion&&!aoe)dmg+=20;if(h.tmp.coordination&&!aoe)dmg+=h.tmp.coordination;if(h.tmp.enrageActive)dmg+=20;if(h.tmp.heavensFuryActive&&!aoe)dmg*=2;dmg-=n(h.status.Curse)*10;dmg-=n(h.tmp.attackDebuff);return Math.max(0,dmg)}
function statusApply(h,name,duration){duration=n(duration);if(!name||duration<=0||h?.tmp?.divinityImmune||h?.tmp?.unbrokenStandStatusImmune)return false;if(name==='Curse')h.status.Curse=Math.min(5,n(h.status.Curse)+duration);else h.status[name]=n(h.status[name])+duration;return true}
function cardAttackInfo(card,h){const script=SCRIPTS.get(card.card_id),deal=(script?.steps||[]).find(x=>x.step_type==='DEAL_DAMAGE');const aoe=String(card.target_type).toLowerCase().includes('area')||String(deal?.target||'').includes('AOE');const statuses=['Burn','Freeze','Stun','Bleed','Curse','Poison'].map(k=>({status:k,duration:parseStatusDynamic(card[k.toLowerCase()],h,0)})).filter(x=>x.duration>0);if(String(h?.id||'')==='S1-MAG-H003')for(const st of statuses)if(['Burn','Freeze'].includes(st.status))st.duration+=1;if(h?.tmp?.poisonVial&&!statuses.some(x=>x.status==='Poison'))statuses.push({status:'Poison',duration:1});return{aoe,base:parseDynamic(card.base_damage,h,n(deal?.amount)),attackType:String(card.attack_type||deal?.damage_type||'ANY').toUpperCase().includes('MAGICAL')?'MAGICAL':'PHYSICAL',statuses}}
function openAttack(room,seat,card,userSlot,targetSeat,targetSlot,fromCasting=false){const m=room.match,p=m.players[seat],h=p.board[userSlot],info=cardAttackInfo(card,h),taunt=activeTauntSlot(m,targetSeat);if(taunt&&info.aoe){addLog(room,`${card.card_name} fails because Taunt prevents area attacks against Player ${targetSeat}.`);p.discard.push(card);return false}if(taunt&&!info.aoe&&targetSlot!==taunt){addLog(room,`${card.card_name} fails because Taunt requires target ${taunt}.`);p.discard.push(card);return false}const slots=info.aoe?access(m.mode,userSlot).filter(l=>alive(m.players[targetSeat].board[l])):[targetSlot];if(!slots.length){addLog(room,`${card.card_name} has no legal target.`);p.discard.push(card);return false}const targetHero=!info.aoe?m.players[targetSeat].board[targetSlot]:null,dmg=outgoingAttack(p,h,card,info.base,info.aoe,targetHero);m.pendingAttack={attackId:`${m.turnNumber}-${room.seq+1}-${seat}-${card.card_id}-${userSlot}-${targetSlot||'AREA'}`,sourceSeat:seat,targetSeat,card,userSlot,damage:dmg,attackType:info.attackType,aoe:info.aoe,slots,index:0,results:{},selected:null,statuses:info.statuses,fromCasting,execute:card.card_name==='Execute',unblockable:card.card_name==='Execute'||card.card_name==='Charged Shot',tornadoResidual:card.card_name==='Tornado'&&['Elementalist','Elemental Lord'].includes(h.class),redirected:false,chainStep:1,dualCastingAttack:!!p.dualCasting};announceCardUse(room,seat,card,`${h.name} uses ${card.card_name} from ${userSlot} -> ${info.aoe?'AREA':`${targetSlot} / ${targetHero?.name||'-'}`}. Incoming ${dmg} ${info.attackType} damage.`, 'Opponent Declared Attack');addLog(room,`${card.card_name} opens a ${info.aoe?'per-Hero Area ':''}Response Window. ${h.name} (${userSlot}) -> ${info.aoe?'AREA':`${targetSlot} / ${targetHero?.name||'-'}`}. Incoming ${dmg} ${info.attackType} damage.`);return true}
function moveHandToDiscard(p,index){const [c]=p.hand.splice(index,1);if(c)p.discard.push(c);return c}
function scoutingOptionsForHero(h){return (h?.expCards||[]).map((card,index)=>({index,card})).filter(x=>String(x.card.is_ultimate).toUpperCase()!=='TRUE')}
function scoutingTargetSlots(m,targetSeat){return LANES.filter(l=>alive(m.players[targetSeat]?.board?.[l])&&scoutingOptionsForHero(m.players[targetSeat].board[l]).length>0)}
function pushNotice(room,notice={}){const m=room.match;if(!m)return;const seq=room.seq+1,sourceSeat=n(notice.sourceSeat),targetSeat=notice.targetSeat===undefined||notice.targetSeat===null?null:n(notice.targetSeat);const rec={id:`${Date.now()}-${seq}-${sourceSeat||'SYSTEM'}-${notice.card_id||notice.card_name||notice.title||'NOTICE'}`,sourceSeat,targetSeat,title:safeText(notice.title||'Match Update',100),card_name:safeText(notice.card_name||'',120),card_id:safeText(notice.card_id||'',80),image_url:notice.image_url||'',thumbnail_url:notice.thumbnail_url||notice.image_url||'',local_thumbnail_path:notice.local_thumbnail_path||'',message:safeText(notice.message||'',360)};if(!Array.isArray(m.cardNotices))m.cardNotices=[];m.cardNotices.push(rec);if(m.cardNotices.length>100)m.cardNotices.shift()}
function announceCardUse(room,seat,card,message='',title='Opponent Card Played'){if(!card)return;pushNotice(room,{sourceSeat:seat,title,card_name:card.card_name||'',card_id:card.card_id||card.id||'',image_url:card.image_url||'',thumbnail_url:card.thumbnail_url||card.image_url||'',local_thumbnail_path:card.local_thumbnail_path||'',message:message||`Player ${seat} uses ${card.card_name}.`})}
function announceToSeat(room,targetSeat,title,message){pushNotice(room,{sourceSeat:0,targetSeat,title,message})}
function legacyNoticeCard(h){return{card_id:h?.id||'LEGACY',card_name:h?.name||'Legacy Card',image_url:h?.image_url||'',thumbnail_url:h?.thumbnail_url||h?.image_url||'',local_thumbnail_path:h?.local_thumbnail_path||''}}

function executeNonAttackCard(room,seat,card,userSlot,targetSeat,targetSlot,script){const m=room.match,p=m.players[seat],user=p.board[userSlot],name=card.card_name,target=m.players[targetSeat]?.board?.[targetSlot];
 if(name==='Sanctuary'){const amount=parseDynamic(card.heal,user,0)+(['S1-CLE-H002','S1-CLE-H003'].includes(String(user?.id||''))?20:0);for(const l of LANES)if(alive(p.board[l]))healHero(room,user,p.board[l],amount,name);return}
 if(name==='Blessing of Divinity'){for(const l of LANES){const h=p.board[l];if(!alive(h))continue;for(const k of NEGATIVE)delete h.status[k];h.tmp.divinityImmune=true;h.tmp.divinityImmuneExpiresAtStartOf=seat}addLog(room,'Blessing of Divinity removes all allied negative statuses and grants damage / negative-status immunity until the start of the owner next turn.');return}
 if(name==='Wildfire'){for(const l of LANES){const h=m.players[opponent(seat)].board[l];if(alive(h)&&statusApply(h,'Burn',2))addLog(room,`${h.name} receives Burn for 2 turn(s).`)}return}
 if(name==='Blessing of Might'){target.tmp.blessingMight=true;addLog(room,`${name} grants +20 ST Physical Attack Damage to ${target.name}.`);return}
 if(name==='Blessing of Wisdom'){target.tmp.blessingWisdom=true;addLog(room,`${name} grants +20 ST Magical Attack Damage to ${target.name}.`);return}
 if(name==="Heaven's Fury"){target.tmp.heavensFuryArmed=true;addLog(room,`${name} arms doubled ST Attack Damage for the next Battle Phase.`);return}
 if(name==='Enrage'){user.tmp.enrageArmed=true;addLog(room,'Enrage arms +20 Attack Damage for the next Battle Phase.');return}
 if(name==='Stamina Potion'){target.exhausted=false;addLog(room,`Stamina Potion removes Exhaust from ${target.name}.`);return}
 if(name==='Arcane Scroll'){target.tmp.arcaneScroll=true;addLog(room,'Arcane Scroll grants +20 ST Magical Attack Damage this Battle Phase.');return}
 if(name==='Holy Medallion'){target.tmp.holyMedallion=true;addLog(room,'Holy Medallion grants +20 ST Attack Damage this Battle Phase.');return}
 if(name==='Ring of Grace'){target.tmp.ringGrace=true;addLog(room,'Ring of Grace increases healing received by 20 this turn.');return}
 if(name==='Invisibility Cloak'){target.tmp.untargetable=true;target.tmp.untargetableExpiresAtStartOf=seat;addLog(room,`${target.name} becomes Untargetable until the start of Player ${seat} next turn.`);return}
 if(name==='Poison Vial'){target.tmp.poisonVial=true;addLog(room,`${target.name} arms Poison Vial: attack damage gives Poison 1 this turn.`);return}
 if(name==='Forged Alliance'){p.racial=Math.min(2,p.racial+1);addLog(room,'Forged Alliance gains 1 Racial Token up to the maximum of 2.');return}
 if(name==='Market Bargain'){draw(p,2,false);addLog(room,'Market Bargain draws 2 cards.');return}
 if(name==="God's Blessing"){m.pendingChoice={type:'GODS_BLESSING_DISCARD',seat,options:p.hand.map((card,index)=>({index,card}))};addLog(room,"God's Blessing: choose 1 card from your hand to discard, then draw 2.");return}
 if(name==='Resurrection'){reviveFromLegacy(room,p,targetSlot,30,'Resurrection');return}
 if(name==='Begin Anew'){p.deck=shuffle(p.hand.splice(0).concat(p.deck));draw(p,5,false);addLog(room,'Begin Anew shuffles the hand into the deck, then draws 5.');return}
 if(name==='Last Resort'){const count=p.hand.length;p.discard.push(...p.hand.splice(0));draw(p,count,false);addLog(room,`Last Resort discards ${count} hand card(s), then draws ${count}.`);return}
 if(name==='Tactical Adaptation'){const count=m.players[opponent(seat)].hand.length;p.deck=shuffle(p.hand.splice(0).concat(p.deck));draw(p,count,false);addLog(room,`Tactical Adaptation shuffles the hand into the deck, then draws ${count} card(s) based on the opponent hand.`);return}
 if(name==='Coordination Attack'){const families=new Set(LANES.filter(l=>alive(p.board[l])).map(l=>p.board[l].baseFamily));for(const l of LANES)if(alive(p.board[l]))p.board[l].tmp.coordination=families.size===3?20:10;addLog(room,'Coordination Attack buffs allied ST attacks this Battle Phase.');return}
 if(name==='Defensive Formation'){const families=new Set(LANES.filter(l=>alive(p.board[l])).map(l=>p.board[l].baseFamily)),amt=families.size===3?20:10;for(const l of LANES){const h=m.players[opponent(seat)].board[l];if(alive(h)){h.tmp.attackDebuff=Math.max(n(h.tmp.attackDebuff),amt);h.tmp.attackDebuffExpiresAtStartOf=seat}}addLog(room,`Defensive Formation applies -${amt} Attack Damage until the start of Player ${seat} next turn.`);return}
 if(name==='Taunt'){user.tmp.taunt=true;user.tmp.tauntExpiresAtStartOf=seat;addLog(room,`${user.name} gains Taunt until the start of Player ${seat} next turn.`);return}
 if(name==='Magic Scope'){p.tmpRevealOpponentHand=true;addLog(room,'Magic Scope reveals the opponent hand until End Phase.');return}
 if(name==='Crystal Ball'){const seen=p.deck.splice(0,Math.min(3,p.deck.length));m.pendingChoice={type:'CRYSTAL_BALL_ORDER',seat,prompt:'Crystal Ball: choose the first card to return to the top of your deck.',seen,ordered:[],options:seen.map((card,index)=>({index,card}))};addLog(room,'Crystal Ball: reorder the top 3 cards, choosing top card first.');return}
 if(name==='Magic Compass'){m.pendingChoice={type:'MAGIC_COMPASS',seat,options:p.deck.map((c,i)=>({index:i,card:c})).filter(x=>x.card.card_type==='Skill')};addLog(room,'Magic Compass: choose 1 Skill Card from your deck.');return}
 if(name==='Déjà vu'){m.pendingChoice={type:'DEJA_VU',seat,options:p.discard.map((c,i)=>({index:i,card:c})).filter(x=>x.card.card_type==='Skill'&&String(x.card.is_ultimate).toUpperCase()!=='TRUE')};addLog(room,'Déjà vu: choose 1 non-Ultimate Skill Card from your discard pile.');return}
 if(name==='Relentless Leveling'){m.pendingChoice={type:'RELENTLESS',seat,targetSlot,options:p.hand.map((c,i)=>({index:i,card:c})).filter(x=>x.card.card_type==='Skill'&&String(x.card.is_ultimate).toUpperCase()!=='TRUE')};addLog(room,'Relentless Leveling: choose 1 non-Ultimate Skill Card from hand as EXP.');return}
 if(name==='Scouting'){const t=m.players[targetSeat].board[targetSlot],options=scoutingOptionsForHero(t);if(!options.length)throw new Error('Scouting requires an opponent Hero with at least 1 non-Ultimate Tribute EXP Card.');m.pendingChoice={type:'SCOUTING',seat,targetSeat,targetSlot,options};addLog(room,'Scouting: choose 1 non-Ultimate Tribute EXP Card stacked under the target hero.');return}
 if(card.heal){const amount=parseDynamic(card.heal,user,0)+(['S1-CLE-H002','S1-CLE-H003'].includes(String(user?.id||''))?20:0);healHero(room,user,target,amount,name);return}
 const steps=script?.steps||[];for(const st of steps){if(st.step_type==='DRAW_CARDS')draw(p,n(st.amount),false);if(st.step_type==='GAIN_MANA_SHARDS')p.mana=Math.min(12,p.mana+n(st.amount));if(st.step_type==='APPLY_STATUS'&&target)statusApply(target,st.status,n(st.duration,1));if(st.step_type==='REMOVE_STATUS'&&target){const key=removeOneNegative(target);if(key)addLog(room,`${name} removes ${key} from ${target.name}.`)}}addLog(room,`Player ${seat} resolves ${name}.`)}

function resolveGeneric(room,seat,index,userSlot,targetSeat,targetSlot){const m=room.match,p=m.players[seat],card=p.hand[index],user=p.board[userSlot];if(!card)throw new Error('Card not found in hand.');enforceFirstTurn(m,seat,card);if(card.card_name==='Dual Casting')return armDualCasting(room,seat,index,userSlot);if(!timingAllows(card,m.phase))throw new Error(`${card.card_name} is not legal during ${m.phase}.`);if(!(card.card_name==='Stamina Potion'?(alive(user)&&!user.actionZone&&!user.status.Stun):canUser(card,user,m,seat,userSlot)))throw new Error('Selected hero cannot use this card.');const dual=p.dualCasting;if(dual?.active){if(card.card_subtype!=='ATK'||!isDualLegalAttack(card)||userSlot!==dual.userSlot)throw new Error('Finish Dual Casting with a legal non-Casting single-target Magical Attack Card from the armed Elemental Lord.');targetSeat=opponent(seat);if(dual.targetSlot&&targetSlot!==dual.targetSlot)throw new Error('Dual Casting attacks must use the same locked target.');if(!dual.targetSlot)dual.targetSlot=targetSlot;if(!alive(m.players[targetSeat].board[dual.targetSlot]))throw new Error('Dual Casting locked target is no longer an active hero.');const cost=n(card.mana_cost);if(p.mana<cost)throw new Error('Not enough mana for this Dual Casting attack.');p.mana-=cost;p.hand.splice(index,1);dual.remaining--;if(dual.remaining<=0)user.exhausted=true;addLog(room,`${user.name} declares Dual Casting attack ${2-dual.remaining} / 2: ${card.card_name} -> ${dual.targetSlot}. ${dual.remaining<=0?'The user becomes Exhausted after both declarations.':'One more attack is required.'}`);openAttack(room,seat,card,userSlot,targetSeat,dual.targetSlot,false);return}if(card.card_name==="God's Blessing"&&p.hand.length<2)throw new Error("God's Blessing requires 1 other card in hand to discard.");const cost=n(card.mana_cost);if(p.mana<cost)throw new Error('Not enough mana.');p.mana-=cost;if((card.card_type==='Skill'&&card.card_subtype!=='DEF')||card.card_type==='Event')user.exhausted=true;const script=SCRIPTS.get(card.card_id);const casting=n(card.casting_time)||(script?.steps||[]).find(x=>x.step_type==='DECLARE_CASTING')?.duration_turns;if(card.card_subtype==='ATK'){if(casting){user.actionZone=card.card_name;p.hand.splice(index,1);p.casting.push({card,userSlot,slot:userSlot,targetSeat,targetSlot,remaining:n(casting,1),declaredTurn:n(m.turnNumber)});const occupant=m.players[targetSeat]?.board?.[targetSlot];const message=`${user.name} declares ${card.card_name}. Locked Hero Zone: ${targetSlot}${occupant?` / current occupant ${occupant.name}`:''}. Resolves at the start of a future Battle Phase.`;announceCardUse(room,seat,card,message,'Opponent Declared a Casting Attack');addLog(room,`Player ${seat} declares Casting ${card.card_name}: locked target zone ${targetSlot}${occupant?` / current occupant ${occupant.name}`:''}. It resolves at the start of a future Battle Phase and checks that zone again.`);return}p.hand.splice(index,1);openAttack(room,seat,card,userSlot,targetSeat,targetSlot,false);return}if(card.card_type==='Event'){p.hand.splice(index,1);const ctx={seat,card,userSlot,targetSeat,targetSlot};if(maybeOpenFlashpowder(room,ctx))return;announceCardUse(room,seat,card,`${user.name} uses ${card.card_name}${targetSlot?` -> ${targetSlot}`:''}.`);p.discard.push(card);executeNonAttackCard(room,seat,card,userSlot,targetSeat,targetSlot,script);return}announceCardUse(room,seat,card,`${user.name} uses ${card.card_name}${targetSlot?` -> ${targetSlot}`:''}.`);moveHandToDiscard(p,index);executeNonAttackCard(room,seat,card,userSlot,targetSeat,targetSlot,script)}
export function playCard(room,client,{index,userSlot,targetSlot}){const m=assertActive(room,client),p=m.players[client.seat],card=p.hand[n(index,-1)];if(!card)throw new Error('Choose a valid card.');if(card.card_subtype==='DEF')throw new Error('DEF cards are used in a Response Window.');if(card.card_name==='Final Grit')return finalGrit(room,client.seat,n(index),targetSlot||userSlot);if(card.card_name==='Phoenix Feather')return phoenixFeather(room,client.seat,n(index),targetSlot||userSlot);if(p.dualCasting?.active&&card.card_subtype!=='ATK')throw new Error('Finish the pending Dual Casting attack sequence first.');const stamina=card.card_name==='Stamina Potion',users=LANES.filter(l=>stamina?(alive(p.board[l])&&!p.board[l].actionZone&&!p.board[l].status.Stun):canUser(card,p.board[l],m,client.seat,l));if(!users.includes(userSlot))throw new Error('Choose a legal hero user.');let targetSeat=client.seat,target=targetSlot||userSlot;const itemOnAlliedHero=card.card_type==='Item'&&String(card.target_type||'').toLowerCase().includes('allied hero');if(itemOnAlliedHero&&!alliedCardTargets(m,client.seat,userSlot,card).includes(target))throw new Error('Choose a legal allied Item target.');if(stamina){if(!alive(p.board[target]))throw new Error('Choose an active allied Hero to receive Stamina Potion.')}else if(card.card_subtype==='ATK'){targetSeat=opponent(client.seat);const info=cardAttackInfo(card,p.board[userSlot]);if(!info.aoe){const legal=attackTargets(m,client.seat,userSlot);if(!legal.includes(target))throw new Error('Choose a legal opponent hero target.');if(card.card_name==='Execute'){const executeTarget=m.players[targetSeat].board[target];if(!alive(executeTarget)||hp(executeTarget)>executeTarget.maxHp/2)throw new Error('Execute may only be declared against a Hero with half or less of Max HP. No Mana, Exhaust, discard, or Response Window is spent.')}}}else if(card.card_name==='Resurrection'){if(!p.board[target]?.legacy)throw new Error('Choose the Legacy replacement stacked with the fallen allied Hero.')}else if(['Blessing of Might','Blessing of Wisdom',"Heaven's Fury",'Arcane Scroll','Holy Medallion','Ring of Grace','Invisibility Cloak','Relentless Leveling'].includes(card.card_name)||String(card.heal||'').trim()!==''||(card.card_type==='Skill'&&card.card_subtype==='SUPPORT'&&String(card.target_type||'').toLowerCase().includes('one of your heroes'))){if(!alliedCardTargets(m,client.seat,userSlot,card).includes(target))throw new Error('Choose a legal allied target inside this Hero Area. Buff Skill Cards remain position-independent.');if(card.card_name==='Relentless Leveling'&&target!==userSlot)throw new Error('Relentless Leveling must be used by the hero receiving the EXP / Rank Up effect.')}else if(['Scouting','Dazed'].includes(card.card_name)){targetSeat=opponent(client.seat);const legal=card.card_name==='Scouting'?scoutingTargetSlots(m,targetSeat):LANES.filter(l=>alive(m.players[targetSeat].board[l]));if(!legal.includes(target))throw new Error(card.card_name==='Scouting'?'Scouting requires an opponent Hero with at least 1 non-Ultimate Tribute EXP Card.':'Choose a legal opponent target.')}resolveGeneric(room,client.seat,n(index),userSlot,targetSeat,target)}
function defLegal(p,card,a,currentSlot){const meta=DEF.get(card.card_id);if(!meta)return false;if(p.mana<n(card.mana_cost))return false;const t=p.board[currentSlot];if(!alive(t)||t.status.Stun)return false;const types=meta.response_types||[];if(!types.includes('REDIRECT')&&!classAllowed(card,t))return false;const req=String(meta.requires_attack_type||'ANY');if(req==='PHYSICAL'&&a.attackType!=='PHYSICAL')return false;if(req==='MAGICAL'&&a.attackType!=='MAGICAL')return false;if(req==='NOT_AREA'&&a.aoe)return false;if(a.unblockable&&types.includes('BLOCK'))return false;if(a.aoe&&(types.includes('NEGATE')||types.includes('COUNTER_RETURN')||types.includes('REDIRECT')))return false;if(a.fromCasting&&types.includes('REDIRECT'))return false;if(a.redirected&&types.includes('REDIRECT'))return false;if(t.status.Freeze&&types.includes('DODGE'))return false;if(card.card_type==='Item'&&t.actionZone)return false;return true}
export function selectResponse(room,client,index,targetSlot=null){const m=room.match,a=m.pendingAttack;if(!a||a.targetSeat!==client.seat)throw new Error('No response is waiting for you.');if(a.selected)throw new Error('Cancel the selected response first.');const p=m.players[client.seat],card=p.hand[n(index,-1)],slot=a.slots[a.index];if(!card||!defLegal(p,card,a,slot))throw new Error('Selected response is not legal.');const meta=DEF.get(card.card_id)||{},types=meta.response_types||[];let redirectTarget=null;if(types.includes('REDIRECT')){const legal=legalRedirectTargets(m,client.seat,slot);if(!legal.includes(String(targetSlot||'')))throw new Error('Choose a legal Warrior-family hero as the Redirect target.');redirectTarget=String(targetSlot)}const cost=n(card.mana_cost);p.mana-=cost;p.hand.splice(n(index),1);a.selected={card,cost,index,redirectTarget};announceCardUse(room,client.seat,card,`Player ${client.seat} selects ${card.card_name}${redirectTarget?` -> ${redirectTarget}`:''} for ${slot}.`);addLog(room,`Player ${client.seat} selects ${card.card_name}${redirectTarget?` -> ${redirectTarget}`:''} for ${slot}.`)}
export function cancelResponse(room,client){const a=room.match.pendingAttack;if(!a||a.targetSeat!==client.seat||!a.selected)throw new Error('No selected response to cancel.');const p=room.match.players[client.seat],s=a.selected;if(s.special==='DRAGON_SCALE'){p.racial++;p.racialUsedTurn=false;p.board[a.slots[a.index]].racialUsed=false}else{p.mana+=s.cost;p.hand.splice(Math.min(s.index,p.hand.length),0,s.card)}a.selected=null;addLog(room,`Player ${client.seat} cancels the selected response.`)}
function heroStateText(h){if(!h)return'Unavailable';const out=[];if(h.legacy)out.push('Legacy');if(h.exhausted)out.push('Exhausted');if(h.actionZone)out.push(`Attachment Slot / Casting Mode: ${h.actionZone}`);if(h.tmp.attackUntargetable)out.push('Cannot be targeted by attacks');const st=statusesText(h);if(st)out.push(st);return out.length?out.join(' · '):'Ready'}
function legalRedirectTargets(m,seat,currentSlot){const p=m.players[seat];return LANES.filter(l=>l!==currentSlot&&alive(p.board[l])&&p.board[l].baseFamily==='Warrior'&&!p.board[l].status.Stun)}
function activeHeroSlots(p){return LANES.filter(l=>alive(p.board[l]))}
function isAutoCenterState(m){return activeHeroSlots(m.players[1]).length===1&&activeHeroSlots(m.players[2]).length===1}
function autoCenter1v1(room){const m=room.match;if(m.status!=='active'||!isAutoCenterState(m))return;for(const seat of [1,2]){const p=m.players[seat],slot=activeHeroSlots(p)[0];if(slot&&slot!=='CENTER'){[p.board.CENTER,p.board[slot]]=[p.board[slot],p.board.CENTER];addLog(room,`AUTO-CENTER 1v1: Player ${seat} remaining active hero moves ${slot} → CENTER without Exhaust.`)}}}
function revivedBaselineExp(heroId){const r=rankNum(HERO[heroId]?.rank);return r===2?300:r===3?700:0}
function reviveFromLegacy(room,p,targetSlot,hpValue,label){const legacy=p.board[targetSlot];if(!legacy?.legacy)throw new Error(`${label} requires a Legacy replacement stacked with a defeated hero.`);const stack=legacy.defeatedStack||[],heroId=stack[stack.length-1];if(!HERO[heroId])throw new Error(`${label} requires a defeated hero stack.`);p.side.push(v052EnrichSideCard({card_id:legacy.id,card_name:legacy.name,card_type:'Legacy',package_id:legacy.packageId||'',image_url:legacy.image_url||'',thumbnail_url:legacy.thumbnail_url||'',local_thumbnail_path:legacy.local_thumbnail_path||''}));const revived=makeHero(heroId);revived.damage=Math.max(0,revived.maxHp-hpValue);revived.exp=revivedBaselineExp(heroId);revived.exhausted=true;revived.defeatedStack=stack.slice(0,-1);revived.stonebloodUsed=v052StonebloodWasUsed(p,revived);p.board[targetSlot]=revived;addLog(room,`${label} returns ${legacy.name} to Legacy Deck and revives ${revived.name} / ${revived.class} with ${hpValue} HP Exhausted and baseline EXP ${revived.exp}.`);return revived}
function phoenixFeather(room,seat,index,targetSlot){const m=room.match,p=m.players[seat],card=p.hand[index];if(!card||card.card_name!=='Phoenix Feather')throw new Error('Phoenix Feather card not found.');if(!timingAllows(card,m.phase))throw new Error(`Phoenix Feather is not legal during ${m.phase}.`);const legacy=p.board[targetSlot];if(!legacy?.legacy)throw new Error('Choose the matching Legacy replacement stacked with the fallen hero.');p.hand.splice(index,1);p.discard.push(card);reviveFromLegacy(room,p,targetSlot,10,'Phoenix Feather')}
function finalGrit(room,seat,index,targetSlot){const m=room.match,p=m.players[seat],card=p.hand[index],legacy=p.board[targetSlot];if(m.phase!=='Deploy Phase')throw new Error('Final Grit is used during Deploy Phase.');if(!card||card.card_name!=='Final Grit')throw new Error('Final Grit card not found.');if(!legacy?.legacy)throw new Error('Choose the Legacy replacement stacked with the defeated Gladiator or Conqueror.');const stack=legacy.defeatedStack||[],heroId=stack[stack.length-1],meta=HERO[heroId];if(!meta||!['Gladiator','Conqueror'].includes(meta.class))throw new Error('Final Grit requires a defeated Gladiator or Conqueror stack.');p.finalGritUsedHeroes=p.finalGritUsedHeroes||{};if(p.finalGritUsedHeroes[heroId])throw new Error('Final Grit can only be used once on the same hero.');const cost=n(card.mana_cost);if(p.mana<cost)throw new Error('Not enough mana.');p.mana-=cost;p.hand.splice(index,1);p.discard.push(card);p.side.push(v052EnrichSideCard({card_id:legacy.id,card_name:legacy.name,card_type:'Legacy',package_id:legacy.packageId||'',image_url:legacy.image_url||'',thumbnail_url:legacy.thumbnail_url||'',local_thumbnail_path:legacy.local_thumbnail_path||''}));const revived=makeHero(heroId);revived.damage=Math.max(0,revived.maxHp-10);revived.exp=revivedBaselineExp(heroId);revived.exhausted=true;revived.defeatedStack=stack.slice(0,-1);revived.stonebloodUsed=v052StonebloodWasUsed(p,revived);p.board[targetSlot]=revived;p.finalGritUsedHeroes[heroId]=true;addLog(room,`Final Grit returns ${legacy.name} to Legacy Deck and revives ${revived.name} / ${revived.class} with 10 HP Exhausted and baseline EXP ${revived.exp}.`)}
function armDualCasting(room,seat,index,userSlot){const m=room.match,p=m.players[seat],card=p.hand[index],h=p.board[userSlot];if(m.phase!=='Deploy Phase')throw new Error('Dual Casting is armed during Deploy Phase.');if(!card||card.card_name!=='Dual Casting'||!canUser(card,h)||h.class!=='Elemental Lord')throw new Error('Choose an eligible Elemental Lord to arm Dual Casting.');const legal=p.hand.filter((c,i)=>i!==index&&isDualLegalAttack(c)),required=n(card.mana_cost)+legal.map(c=>n(c.mana_cost)).sort((a,b)=>a-b).slice(0,2).reduce((a,b)=>a+b,0);if(legal.length<2)throw new Error('Dual Casting requires at least 2 legal non-Casting single-target Magical Attack Cards in hand.');if(p.mana<required)throw new Error('Not enough mana to arm Dual Casting and pay for 2 legal Magical Attack Cards.');p.mana-=n(card.mana_cost);p.hand.splice(index,1);p.discard.push(card);p.dualCasting={userSlot,targetSlot:null,remaining:2,active:false};addLog(room,`${h.name} arms Dual Casting during Deploy Phase. No Exhaust yet; exactly 2 non-Casting ST Magical Attacks are required during this turn's Battle Phase.`)}
function prepareDualCastingBattle(room,seat){const p=room.match.players[seat],d=p.dualCasting;if(!d)return;d.active=true;addLog(room,`Dual Casting is ready for ${p.board[d.userSlot]?.name||d.userSlot}: choose a legal locked target and declare attack 1 / 2.`)}
function isDualLegalAttack(card){return card?.card_subtype==='ATK'&&String(card.attack_type||'').toUpperCase().includes('MAGICAL')&&!String(card.target_type||'').toLowerCase().includes('area')&&!n(card.casting_time)}
function continueDualCasting(room,seat){const m=room.match,p=m.players[seat],d=p.dualCasting;if(!d||!d.active||m.pendingAttack||m.pendingChoice)return;if(d.remaining<=0){p.dualCasting=null;addLog(room,'Dual Casting sequence complete.');return}const target=d.targetSlot?m.players[opponent(seat)].board[d.targetSlot]:null;if(d.targetSlot&&!alive(target)){addLog(room,'Dual Casting ends: locked target was defeated by the first attack. Remaining attack fails with no retarget or Legacy transfer.');p.dualCasting=null;return}addLog(room,`Dual Casting pending: declare attack ${3-d.remaining} / 2${d.targetSlot?` against locked target ${d.targetSlot} / ${target?.name||'-'}`:''}.`)}
function reduceByPassive(h,dmg,type){if(['S1-WAR-H002','S1-WAR-H003'].includes(String(h?.id||''))&&type==='PHYSICAL')return Math.max(0,dmg-10);return dmg}
function openNextLegacyChoice(room){const m=room.match;if(m.pendingChoice||!m.legacyQueue?.length)return;const q=m.legacyQueue.shift(),p=m.players[q.seat];const options=p.side.map((card,sideIndex)=>({sideIndex,card})).filter(x=>x.card.card_type==='Legacy'&&(LEGACY[x.card.card_id]?.class_family===q.family));if(options.length){m.pendingChoice={type:'LEGACY',seat:q.seat,slot:q.slot,family:q.family,options};addLog(room,`Player ${q.seat} must choose a ${q.family} Legacy Card for ${q.slot}.`)}else{const old=p.board[q.slot];p.board[q.slot]={...old,id:`EMPTY-${q.slot}`,name:'Empty Legacy Slot',class:'Legacy',rank:'Legacy',maxHp:0,damage:0,legacy:true,legacyUsed:false,legacyEffectText:'',status:{},tmp:{},exp:0,expCards:[],exhausted:false};addLog(room,`No matching ${q.family} Legacy remains for Player ${q.seat} ${q.slot}.`)}}
function defeat(room,seat,slot){const m=room.match,p=m.players[seat],h=p.board[slot];if(!h||h.legacy)return;h.defeatedStack=[...h.defeatedStack,h.id];addLog(room,`${h.name} is defeated at Player ${seat} ${slot}.`);if(!LANES.some(l=>alive(p.board[l]))){m.legacyQueue=[];finish(room,opponent(seat),`Player ${seat} has no active hero remaining.`);return}m.legacyQueue=m.legacyQueue||[];m.legacyQueue.push({seat,slot,family:h.baseFamily})}
function cancelCastingForDefense(room,p,slot,reason){const h=p.board[slot];if(!h?.actionZone)return;const canceled=p.casting.filter(x=>x.slot===slot);if(!canceled.length){h.actionZone=null;return}p.casting=p.casting.filter(x=>x.slot!==slot);h.actionZone=null;for(const c of canceled)p.discard.push(c.card);addLog(room,`${h.name} cancels Casting because they used ${reason}.`)}
function resolveResponseMath(room,a,slot){const p=room.match.players[a.targetSeat],h=p.board[slot];let dmg=a.damage,avoid=false,negate=false,returnAttack=false,fixedFinal=0,globalBlock=n(a.globalBlock),redirectTarget=null;if(globalBlock)dmg=Math.max(0,dmg-globalBlock);if(a.selected){let types=[],amount=0,name=a.selected.card.card_name;cancelCastingForDefense(room,p,slot,name);if(a.selected.special==='DRAGON_SCALE'){types=['BLOCK'];amount=40}else{const meta=DEF.get(a.selected.card.card_id)||{};types=meta.response_types||[];amount=n(meta.block_amount);p.discard.push(a.selected.card)}if(types.includes('REDIRECT'))redirectTarget=a.selected.redirectTarget;if(types.includes('NEGATE')){negate=true;avoid=true}if(types.includes('COUNTER_RETURN')||types.includes('RETURN_ATTACK'))returnAttack=true;if(types.includes('DODGE')&&!a.selected.bindingLightCanceledDodge){if(a.tornadoResidual){fixedFinal=40;avoid=false}else avoid=true}if(types.includes('DODGE')&&a.selected.bindingLightCanceledDodge)addLog(room,'Binding Light cancels the selected Dodge.');if(types.includes('PREVENT'))avoid=true;if(types.includes('BLOCK')){dmg=Math.max(0,dmg-amount);if(name==='Sacred Bulwark')a.globalBlock=n(a.globalBlock)+amount}if(name==='Unbroken Stand'){h.tmp.unbrokenStandStatusImmune=true;addLog(room,`Unbroken Stand grants ${h.name} immunity to negative statuses until End Phase.`)}if(name==='Ice Block'&&statusApply(h,'Freeze',1))addLog(room,`Ice Block inflicts Freeze 1 on ${h.name}.`) ;addLog(room,`${name} resolves for ${slot}${redirectTarget?` and Redirects the attack to ${redirectTarget}`:''}.`)}return{slot,dmg,avoid,negate,returnAttack,statusApplies:!avoid,fixedFinal,redirectTarget}}
function applyRecordedHit(room,a,r){const p=room.match.players[a.targetSeat],h=p.board[r.slot];if(!alive(h))return;if(r.avoid){addLog(room,`${a.card.card_name} is avoided for Player ${a.targetSeat} ${r.slot} / ${h.name}.`);return}if(h.tmp.divinityImmune){addLog(room,`${a.card.card_name} deals no damage or negative status to ${h.name} because Blessing of Divinity immunity is active.`);return}if(a.execute){const before=hp(h);if(before<=h.maxHp/2){h.damage=h.maxHp;addLog(room,`Execute defeats Player ${a.targetSeat} ${r.slot} / ${h.name} because current HP ${before} is half or less of Max HP ${h.maxHp}.`);defeat(room,a.targetSeat,r.slot)}else addLog(room,`Execute fails to defeat ${h.name}: current HP ${before} is above half of Max HP ${h.maxHp}.`);return}let dmg=r.fixedFinal||reduceByPassive(h,r.dmg,a.attackType);if(!r.fixedFinal&&dmg>0&&h.status.Burn){const source=room.match.players[a.sourceSeat].board[a.userSlot],bonus=enhancedBurnTrigger(source)?20:10;dmg+=bonus;addLog(room,`Burn adds +${bonus} damage to ${h.name}${bonus===20?' through Fire Elemental Mastery':''}.`)}const before=hp(h);h.damage=Math.min(h.maxHp,h.damage+dmg);addLog(room,`${a.card.card_name} total incoming damage: ${dmg} to Player ${a.targetSeat} ${r.slot} / ${h.name} (HP damage applied ${Math.min(before,dmg)}${dmg>before?`, overkill ${dmg-before}`:''}; HP ${before} -> ${hp(h)}).`);const dealt=Math.min(before,dmg);if(a.card.card_name==='Holy Slash'&&dealt>0){const source=room.match.players[a.sourceSeat].board[a.userSlot];healHero(room,source,source,20,'Holy Slash')}if(r.statusApplies)for(const st of a.statuses){if(statusApply(h,st.status,st.duration,st))addLog(room,`${h.name} receives ${st.status} for ${st.duration} turn(s).`)}if(hp(h)<=0)defeat(room,a.targetSeat,r.slot)}
function finishAttack(room,a){const m=room.match,source=m.players[a.sourceSeat];const negated=Object.values(a.results||{}).some(r=>r?.negate);if(a.card.card_name==='Holy Ring'&&!a.resultsReturnAttack&&!negated){const user=source.board[a.userSlot];if(alive(user)){user.tmp.attackUntargetable=true;user.tmp.attackUntargetableExpiresAtStartOf=a.sourceSeat;addLog(room,`Holy Ring protects ${user.name}: the opponent cannot target this Hero with attacks until the start of Player ${a.sourceSeat} next turn. Area attacks still affect this Hero.`)}}if(a.resultsReturnAttack)source.hand.push(a.card);else source.discard.push(a.card);m.pendingAttack=null;if(m.status==='active')continueDualCasting(room,a.sourceSeat);if(m.status==='active')openNextLegacyChoice(room);if(m.status==='active')autoCenter1v1(room);if(m.status==='active')checkWin(room)}
function resolveCurrent(room,pass=false){const m=room.match,a=m.pendingAttack,slot=a.slots[a.index];if(pass)addLog(room,`Player ${a.targetSeat} passes the response for ${slot}.`);const r=resolveResponseMath(room,a,slot);if(r.redirectTarget){a.selected=null;a.redirected=true;a.chainStep=3;a.slots=[r.redirectTarget];a.index=0;a.results={};addLog(room,`REDIRECT FOLLOW-UP: target recalculated immediately to Player ${a.targetSeat} ${r.redirectTarget} / ${m.players[a.targetSeat].board[r.redirectTarget]?.name||'-'}. Final-response window remains open.`);return}a.results[slot]=r;if(r.returnAttack)a.resultsReturnAttack=true;a.selected=null;a.index++;if(a.aoe){if(a.index<a.slots.length){addLog(room,`Area DEF window ${a.index+1}/${a.slots.length}: Player ${a.targetSeat} ${a.slots[a.index]}.`);return}addLog(room,`Area damage resolution begins for ${a.card.card_name}; recorded Hero results apply simultaneously.`);for(const s of a.slots)applyRecordedHit(room,a,a.results[s]);finishAttack(room,a);return}applyRecordedHit(room,a,r);finishAttack(room,a)}
export function passResponse(room,client){const a=room.match.pendingAttack;if(!a||a.targetSeat!==client.seat)throw new Error('No response is waiting for you.');if(a.selected)cancelResponse(room,client);resolveCurrent(room,true)}
export function resolveResponse(room,client){const a=room.match.pendingAttack;if(!a||a.targetSeat!==client.seat)throw new Error('No response is waiting for you.');if(maybeOpenBindingLight(room,a))return;resolveCurrent(room,false)}
function rankReq(h){return rankNum(h.rank)===1?300:rankNum(h.rank)===2?700:null}
function tryRank(room,seat,slot){const m=room.match,p=m.players[seat],h=p.board[slot],req=rankReq(h);if(!req||h.exp<req)return;const pkg=runtimePackageForHero(h),next=pkg?.cards?.find(x=>{const d=HERO[x.card_id];return d&&rankNum(d.rank)===rankNum(h.rank)+1});if(!next)return;const sideCard=sideRemove(p,next.card_id);if(!sideCard)return;const nextHero=makeHero(next.card_id);Object.assign(nextHero,{packageId:pkg.package_id,damage:Math.min(nextHero.maxHp,h.damage),exp:h.exp,expCards:h.expCards,exhausted:h.exhausted,status:h.status,tmp:h.tmp,defeatedStack:h.defeatedStack,actionZone:h.actionZone});p.board[slot]=nextHero;p.regen=Math.min(6,p.regen+1);draw(p,rankNum(nextHero.rank)===2?2:3,false);p.discard.push(...h.expCards);nextHero.expCards=[];addLog(room,`${h.name} ranks up to ${nextHero.class}. Draw bonus and +1 Mana Regen applied.${nextHero.actionZone?' Casting Action Zone and queue remain unchanged.':''}`)}

function v092NormLineage(x){x=String(x||'').toUpperCase().trim();if(x==='THF-ROGUE-RENEGADE'||x==='THIEF-ROGUE-RENEGADE'||x==='THF-RENEGADE')return 'THF-RENEGADE';return x}
function v092UltimateNeed(card){const id=String(card?.card_id||card?.card_number||''),nm=String(card?.card_name||'').toLowerCase();if(id==='S1-THF-015'||/venom\s+sovereign/.test(nm))return '';const fixed={'S1-WAR-018':'WAR-CONQUEROR','S1-MAG-018':'MAG-ELEMENTAL-LORD','S1-CLE-018':'CLE-SAINT','S1-CLE-024':'WAR-CRUSADER','S1-THF-018':'THF-RENEGADE','S1-ARC-018':'ARC-GRAND-RANGER'};if(id==='S1-THF-018'||/venom\s+detonation/.test(nm))return 'THF-RENEGADE';return v092NormLineage(fixed[id]||card?.ultimate_class_lineage_id||'')}
function v092HeroLineage(h){const row=HERO[h?.id]||{};if(/^S1-THF-H00[123]$/.test(String(h?.id||'')))return 'THF-RENEGADE';if(/^S1-ARC-H00[123]$/.test(String(h?.id||'')))return 'ARC-GRAND-RANGER';return v092NormLineage(row.ultimate_tribute_lineage_id||row.fixed_class_lineage_id||h?.ultimate_tribute_lineage_id||h?.fixed_class_lineage_id||'')}
function v092CanReceiveTribute(h,card){const need=v092UltimateNeed(card);return !!(alive(h)&&rankNum(h.rank)<3&&(!need||v092HeroLineage(h)===need))}
export function tribute(room,client,index,slot){const m=assertActive(room,client);if(m.phase!=='Reform Phase')throw new Error('Tribute is available during Reform Phase.');const p=m.players[client.seat],h=p.board[slot],card=p.hand[n(index,-1)];if(p.tributeUsed>=1)throw new Error('Normal Tribute limit is 1 per Reform Phase.');if(!card||card.card_type!=='Skill'||!alive(h))throw new Error('Choose a Skill Card and an active hero.');if(rankNum(h.rank)>=3)throw new Error('Max-rank Hero cannot receive normal Tribute.');const need=v092UltimateNeed(card);if(need&&v092HeroLineage(h)!==need)throw new Error(`${card.card_name} may only be Tributed to a Hero in its Class Lineage.`);p.hand.splice(n(index),1);h.expCards.push(card);h.exp+=n(card.exp_value,100);p.tributeUsed++;addLog(room,`Player ${client.seat} Tributes ${card.card_name} to ${h.name} for ${n(card.exp_value,100)} EXP. ${need?'Ultimate Tribute uses matching Class Lineage and no Racial Token cost.':'Tribute is stored beneath the Hero and does not use Action Zone.'}`);tryRank(room,client.seat,slot)}
export function reposition(room,client,a,b){const m=assertActive(room,client);if(m.mode!=='MAIN')throw new Error('Reposition is disabled in Quick Mode.');if(isAutoCenterState(m))throw new Error('Reposition is disabled while both players have exactly 1 active hero remaining.');if(!['Deploy Phase','Reform Phase'].includes(m.phase))throw new Error('Reposition is available during Deploy or Reform Phase.');if(![['LEFT','CENTER'],['CENTER','RIGHT']].some(x=>x[0]===a&&x[1]===b||x[0]===b&&x[1]===a))throw new Error('Only adjacent swaps are legal.');const p=m.players[client.seat],ha=p.board[a],hb=p.board[b];for(const h of [ha,hb])if(!h.legacy&&(!alive(h)||h.exhausted||h.status.Stun||h.status.Freeze||h.actionZone))throw new Error('One of the moving heroes cannot Reposition.');[p.board[a],p.board[b]]=[p.board[b],p.board[a]];if(!ha.legacy)ha.exhausted=true;if(!hb.legacy)hb.exhausted=true;addLog(room,`Player ${client.seat} Repositions ${a} ↔ ${b}.`)}
export function useRacial(room,client,slot){const m=assertActive(room,client),p=m.players[client.seat],h=p.board[slot];if(m.phase!=='Deploy Phase')throw new Error('Human and Elf Racial Traits are used during Deploy Phase.');if(!alive(h)||h.status.Stun||p.racial<=0||p.racialUsedTurn||h.racialUsed)throw new Error('Racial Trait is not available.');if(h.race==='Dragonborn')throw new Error('Dragon Scale is a reactive Response Window ability.');if(h.race==='Dwarf')throw new Error('Stoneblood is an immediate defeat-window Racial Trait.');p.racial--;p.racialUsedTurn=true;h.racialUsed=true;if(h.race==='Human'){draw(p,2,false);addLog(room,`${h.name} uses Human Ambition: draw 2.`)}else if(h.race==='Elf'){p.mana=Math.min(12,p.mana+2);addLog(room,`${h.name} uses Ancestral Focus: gain 2 mana.`)}else throw new Error('This Racial Trait is not implemented.')}
export function useAbility(room,client,slot,targetSlot){const m=assertActive(room,client);if(m.phase!=='Deploy Phase')throw new Error('This Hero Ability is available during Deploy Phase.');const p=m.players[client.seat],h=p.board[slot],t=p.board[targetSlot];if(!alive(h)||!alive(t)||h.exhausted||h.status.Stun||h.actionZone||h.abilityUsed||!['Paladin','Crusader'].includes(h.class))throw new Error('Hero Ability is not available.');if(p.mana<1)throw new Error('Not enough mana. Paladin and Crusader Hero Ability costs 1 mana.');p.mana-=1;const amt=h.class==='Crusader'?20:10;healHero(room,h,t,amt,h.class==='Crusader'?'Radiant Oblivion':'Holy Resurgence');h.exhausted=true;h.abilityUsed=true;addLog(room,`${h.name} spends 1 mana and becomes Exhausted after the activated heal.`)}
function skillFamilyMatches(card,family){if(card?.card_type!=='Skill')return false;const f=String(family||'').toLowerCase(),id=String(card.card_id||''),cf=String(card.class_family||'').toLowerCase();if(f==='warrior')return id.startsWith('S1-WAR-')||cf.includes('warrior');if(f==='mage')return id.startsWith('S1-MAG-')||cf.includes('mage');if(f==='cleric')return id.startsWith('S1-CLE-')||cf.includes('cleric');return cf.includes(f)}
function handSkillOptions(p,family){return p.hand.map((card,index)=>({index,card})).filter(x=>skillFamilyMatches(x.card,family))}
function discardNonUltimateOptions(p){return p.discard.map((card,index)=>({index,card})).filter(x=>String(x.card.is_ultimate).toUpperCase()!=='TRUE')}
function canDragonSkin(m,seat){const a=m.pendingAttack;if(!a||a.targetSeat!==seat||a.aoe||a.selected)return false;const p=m.players[seat],slot=a.slots[a.index],h=p.board[slot];return alive(h)&&h.race==='Dragonborn'&&!h.status.Stun&&!h.racialUsed&&!p.racialUsedTurn&&p.racial>0}
export function selectDragonSkin(room,client){const m=room.match;if(!canDragonSkin(m,client.seat))throw new Error('Dragon Scale is not available for this Response Window.');const a=m.pendingAttack,p=m.players[client.seat],slot=a.slots[a.index],h=p.board[slot];p.racial--;p.racialUsedTurn=true;h.racialUsed=true;a.selected={special:'DRAGON_SCALE',card:{card_id:'RACIAL-DRAGON-SCALE',card_name:'Dragon Scale',card_type:'Racial Trait',card_subtype:'DEF',mana_cost:0,effect_text:'Spend 1 Racial Token to Block 40 incoming Physical or Magical damage.'},cost:0,index:-1};addLog(room,`${h.name} uses Dragon Scale: spend 1 Racial Token to Block 40 incoming damage.`)}
function proactiveLegacyAllowed(m,seat,h){return m.activeSeat===seat&&!m.pendingAttack&&!m.pendingChoice&&h?.legacy&&!h.legacyUsed}
export function useLegacy(room,client,slot){const m=room.match,p=m.players[client.seat],h=p.board[slot];if(!h?.legacy)throw new Error('No Legacy Card is available in that slot.');if(h.legacyUsed)throw new Error('This Legacy Card has already been used this turn.');const id=h.id;if(id==='S1-MAG-L001'){if(!m.pendingAttack||m.pendingAttack.targetSeat!==client.seat)throw new Error('Ancestral Tome is only available during your Response Window.');const options=handSkillOptions(p,'Mage');if(!options.length)throw new Error('Ancestral Tome requires 1 Mage Skill Card in hand.');m.pendingChoice={type:'ANCESTRAL_TOME_DISCARD',seat:client.seat,legacySlot:slot,options};addLog(room,'Ancestral Tome: choose 1 Mage Skill Card to discard.');return}if(!proactiveLegacyAllowed(m,client.seat,h))throw new Error('This Legacy effect is not available now.');if(id==='S1-WAR-L001'||id==='S1-WAR-L002'){if(m.phase!=='Deploy Phase')throw new Error('This Warrior Legacy is available during Deploy Phase.');const options=handSkillOptions(p,'Warrior');if(!options.length)throw new Error('This Warrior Legacy requires 1 Warrior Skill Card in hand.');m.pendingChoice={type:'LEGACY_DISCARD_ONE',seat:client.seat,legacySlot:slot,effect:id==='S1-WAR-L001'?'DRAW_1':'GAIN_MANA_1',options};addLog(room,`${h.name}: choose 1 Warrior Skill Card to discard.`);return}if(id==='S1-MAG-L002'){if(m.phase!=='Deploy Phase')throw new Error('Arcane Wand is available during Deploy Phase.');const options=handSkillOptions(p,'Mage');if(options.length<2)throw new Error('Arcane Wand requires 2 Mage Skill Cards in hand.');m.pendingChoice={type:'LEGACY_DISCARD_MULTI',seat:client.seat,legacySlot:slot,family:'Mage',remaining:2,next:'ARCANE_WAND_PICK',options};addLog(room,'Arcane Wand: choose 2 Mage Skill Cards to discard, one at a time.');return}if(id==='S1-CLE-L001'){if(m.phase!=='End Phase')throw new Error('Sun God Church is available during End Phase.');const options=handSkillOptions(p,'Cleric');if(options.length<2)throw new Error('Sun God Church requires 2 Cleric Skill Cards in hand.');m.pendingChoice={type:'LEGACY_DISCARD_MULTI',seat:client.seat,legacySlot:slot,family:'Cleric',remaining:2,next:'SUN_GOD_PICK',options};addLog(room,'Sun God Church: choose 2 Cleric Skill Cards to discard, one at a time.');return}throw new Error('This Legacy effect is not implemented yet.')}
export function resolveChoice(room,client,index){const m=room.match,c=m.pendingChoice;if(!c||c.seat!==client.seat)throw new Error('No required choice is waiting for you.');const opt=c.options[n(index,-1)];if(!opt)throw new Error('Choose a valid option.');const p=m.players[client.seat];if(c.type==='FLASHPOWDER_WINDOW'){const ctx=c.eventContext,eventOwner=m.players[ctx.seat];if(opt.card.card_id==='PASS-FLASHPOWDER'){eventOwner.discard.push(ctx.card);m.pendingChoice=null;addLog(room,`Player ${client.seat} passes. ${ctx.card.card_name} resolves.`);executeNonAttackCard(room,ctx.seat,ctx.card,ctx.userSlot,ctx.targetSeat,ctx.targetSlot,SCRIPTS.get(ctx.card.card_id))}else{const [bomb]=p.hand.splice(opt.index,1);p.discard.push(bomb);eventOwner.discard.push(ctx.card);m.pendingChoice=null;addLog(room,`${opt.userSlot} uses Flashpowder Bomb: ${ctx.card.card_name} is canceled and discarded.`)}return checkWin(room)}else if(c.type==='BINDING_LIGHT_WINDOW'){const a=m.pendingAttack;if(!a?.selected){m.pendingChoice=null;return}if(opt.card.card_id==='PASS-BINDING-LIGHT'){a.bindingLightChecked=true;m.pendingChoice=null;addLog(room,`Player ${client.seat} passes. The selected Dodge continues.`)}else{const [bind]=p.hand.splice(opt.index,1),h=p.board[opt.userSlot],cost=n(bind.mana_cost);if(p.mana<cost)throw new Error('Not enough mana for Binding Light.');p.mana-=cost;p.discard.push(bind);h.exhausted=true;a.selected.bindingLightCanceledDodge=true;a.bindingLightChecked=true;m.pendingChoice=null;addLog(room,`${h.name} uses Binding Light: the selected Dodge is canceled.`)}return resolveCurrent(room,false)}else if(c.type==='CRYSTAL_BALL_ORDER'){const [picked]=c.seen.splice(opt.index,1);c.ordered.push(picked);if(c.seen.length){c.prompt=`Crystal Ball: choose card ${c.ordered.length+1} of 3 for the next deck position.`;c.options=c.seen.map((card,index)=>({index,card}));addLog(room,`Crystal Ball locks ${picked.card_name} into deck position ${c.ordered.length}.`)}else{p.deck=c.ordered.concat(p.deck);m.pendingChoice=null;addLog(room,'Crystal Ball returns the reordered cards to the top of the deck.')}return}if(c.type==='GODS_BLESSING_DISCARD'){const [card]=p.hand.splice(opt.index,1);p.discard.push(card);draw(p,2,false);addLog(room,`God's Blessing discards ${card.card_name}, then draws 2 cards.`);m.pendingChoice=null}else if(c.type==='MAGIC_COMPASS'){const [card]=p.deck.splice(opt.index,1);p.hand.push(card);addLog(room,`Player ${client.seat} adds a Skill Card from the deck to hand with Magic Compass.`);m.pendingChoice=null}else if(c.type==='DEJA_VU'){const [card]=p.discard.splice(opt.index,1);p.hand.push(card);addLog(room,`Player ${client.seat} returns ${card.card_name} from discard with Déjà vu.`);m.pendingChoice=null}else if(c.type==='RELENTLESS'){const [card]=p.hand.splice(opt.index,1),h=p.board[c.targetSlot];h.expCards.push(card);h.exp+=n(card.exp_value,100);addLog(room,`Relentless Leveling Tributes ${card.card_name} to ${h.name}.`);m.pendingChoice=null;tryRank(room,client.seat,c.targetSlot)}else if(c.type==='SCOUTING'){const h=m.players[c.targetSeat].board[c.targetSlot],[card]=h.expCards.splice(opt.index,1);h.exp=Math.max(0,h.exp-n(card.exp_value,100));m.players[c.targetSeat].discard.push(card);addLog(room,`Scouting discards ${card.card_name} from ${h.name}; EXP decreases.`);m.pendingChoice=null}else if(c.type==='LEGACY'){const card=p.side.splice(opt.sideIndex,1)[0],old=p.board[c.slot],meta=LEGACY[card.card_id]||{};p.board[c.slot]={...old,id:card.card_id,name:card.card_name,image_url:card.image_url||meta.image_url,thumbnail_url:card.thumbnail_url||meta.thumbnail_url||card.image_url||meta.image_url,class:'Legacy',rank:'Legacy',maxHp:0,damage:0,legacy:true,legacyUsed:false,legacyEffectText:meta.effect_text||'',baseFamily:c.family,status:{},tmp:{},exp:0,expCards:[],exhausted:false};addLog(room,`Player ${client.seat} deploys ${card.card_name} as Legacy replacement.`);m.pendingChoice=null}else if(c.type==='ANCESTRAL_TOME_DISCARD'){const [card]=p.hand.splice(opt.index,1),h=p.board[c.legacySlot];p.discard.push(card);h.legacyUsed=true;m.pendingAttack.globalBlock=n(m.pendingAttack.globalBlock)+20;addLog(room,`Ancestral Tome discards ${card.card_name}: incoming attack damage is reduced by 20.`);m.pendingChoice=null}else if(c.type==='LEGACY_DISCARD_ONE'){const [card]=p.hand.splice(opt.index,1),h=p.board[c.legacySlot];p.discard.push(card);h.legacyUsed=true;if(c.effect==='DRAW_1'){draw(p,1,false);addLog(room,`${h.name} discards ${card.card_name} to draw 1 card.`)}else{p.mana=Math.min(12,p.mana+1);addLog(room,`${h.name} discards ${card.card_name} to gain 1 mana.`)}m.pendingChoice=null}else if(c.type==='LEGACY_DISCARD_MULTI'){const [card]=p.hand.splice(opt.index,1);p.discard.push(card);c.remaining--;addLog(room,`${p.board[c.legacySlot].name} discards ${card.card_name}. ${c.remaining} more required.`);if(c.remaining>0){c.options=handSkillOptions(p,c.family)}else if(c.next==='ARCANE_WAND_PICK'){c.type='ARCANE_WAND_PICK';c.options=discardNonUltimateOptions(p);addLog(room,'Arcane Wand: choose 1 non-Ultimate card from discard to return to hand.')}else{c.type='SUN_GOD_PICK';c.seen=p.deck.splice(0,Math.min(5,p.deck.length));c.options=c.seen.map((card,index)=>({index,card}));addLog(room,'Sun God Church: choose 1 of the top 5 cards to add to hand.')}}else if(c.type==='ARCANE_WAND_PICK'){const [card]=p.discard.splice(opt.index,1),h=p.board[c.legacySlot];p.hand.push(card);h.legacyUsed=true;addLog(room,`Arcane Wand returns ${card.card_name} from discard to hand.`);m.pendingChoice=null}else if(c.type==='SUN_GOD_PICK'){const [card]=c.seen.splice(opt.index,1),h=p.board[c.legacySlot];if(card)p.hand.push(card);p.deck=shuffle(c.seen.concat(p.deck));h.legacyUsed=true;addLog(room,`Sun God Church adds ${card?.card_name||'a card'} to hand and shuffles the rest.`);m.pendingChoice=null}openNextLegacyChoice(room);checkWin(room)}
export function surrender(room,client){finish(room,opponent(client.seat),`Player ${client.seat} surrendered.`)}
function checkWin(room){const m=room.match;if(m.status!=='active')return;for(const seat of [1,2]){const any=LANES.some(l=>alive(m.players[seat].board[l]));if(!any&&!m.pendingChoice){finish(room,opponent(seat),`Player ${seat} has no active hero remaining.`);return}}autoCenter1v1(room)}
function finish(room,winner,reason){const m=room.match;m.status='finished';m.winner={seat:winner,reason};m.pendingAttack=null;m.pendingChoice=null;addLog(room,`BATTLE FINISHED: Player ${winner} wins. ${reason}`)}
function legalResponseList(m,seat){const a=m.pendingAttack;if(!a||a.targetSeat!==seat)return[];const p=m.players[seat],slot=a.slots[a.index];return p.hand.map((card,index)=>({card,index})).filter(x=>defLegal(p,x.card,a,slot)).map(x=>({...publicCard(x.card,x.index),redirectTargets:(DEF.get(x.card.card_id)?.response_types||[]).includes('REDIRECT')?legalRedirectTargets(m,seat,slot):[]}))}
function actionHints(m,seat){if(m.status!=='active')return{};const p=m.players[seat];if(m.coinFlip?.pending)return{active:false,coinFlip:seat===m.coinFlip.chooserSeat,waitingCoinFlip:seat!==m.coinFlip.chooserSeat,coinFlipChooser:m.coinFlip.chooserSeat,canNext:false,canEnd:false,canReposition:false,canTribute:false,dualCasting:null,playableCardIndexes:[],legacySlots:[],responseCards:[],waitingForOpponentResponse:null,responseFor:null,choice:null};const active=m.activeSeat===seat&&!m.pendingAttack&&!m.pendingChoice,dual=p.dualCasting?.active,playableCardIndexes=active?p.hand.map((card,index)=>({card,index})).filter(x=>dual?isDualLegalAttack(x.card):(x.card.card_subtype!=='DEF'&&timingAllows(x.card,m.phase)&&(!openingFirstTurnLocked(m,seat)||!offensiveOrDisruptive(x.card)))).map(x=>x.index):[],legacySlots=LANES.filter(l=>p.board[l]?.legacy&&!p.board[l].legacyUsed),a=m.pendingAttack,currentSlot=a?.slots?.[a.index],attacker=a?m.players[a.sourceSeat]?.board?.[a.userSlot]:null,receiver=a?m.players[a.targetSeat]?.board?.[currentSlot]:null;return{active,coinFlip:false,waitingCoinFlip:false,canNext:active&&!dual,canEnd:active&&!dual,canReposition:active&&!dual&&m.mode==='MAIN'&&!isAutoCenterState(m)&&['Deploy Phase','Reform Phase'].includes(m.phase),canTribute:active&&!dual&&m.phase==='Reform Phase',dualCasting:dual?clone(p.dualCasting):null,playableCardIndexes,legacySlots,responseCards:legalResponseList(m,seat),waitingForOpponentResponse:a&&a.targetSeat!==seat?{card_name:a.card.card_name,receiverSlot:currentSlot}:null,responseFor:a?.targetSeat===seat?{card_name:a.card.card_name,card_image:a.card.image_url||'',card_image_thumb:a.card.thumbnail_url||a.card.image_url||'',manaCost:n(a.card.mana_cost),damage:a.damage,attackType:a.attackType,aoe:a.aoe,currentSlot,step:a.index+1,total:a.slots.length,selected:a.selected?{...publicCard(a.selected.card,a.selected.index),redirectTarget:a.selected.redirectTarget||null}:null,redirected:!!a.redirected,chainStep:a.chainStep||1,attacker:{seat:a.sourceSeat,slot:a.userSlot,name:attacker?.name||'-',hp:attacker?hp(attacker):0,maxHp:attacker?.maxHp||0,state:heroStateText(attacker),image_url:attacker?.image_url||'',thumbnail_url:attacker?.thumbnail_url||attacker?.image_url||''},receiver:{seat:a.targetSeat,slot:currentSlot,name:receiver?.name||'-',hp:receiver?hp(receiver):0,maxHp:receiver?.maxHp||0,state:heroStateText(receiver),image_url:receiver?.image_url||'',thumbnail_url:receiver?.thumbnail_url||receiver?.image_url||''},canDragonSkin:canDragonSkin(m,seat),ancestralTomeSlots:LANES.filter(l=>p.board[l]?.legacy&&p.board[l].id==='S1-MAG-L001'&&!p.board[l].legacyUsed&&handSkillOptions(p,'Mage').length)}:null,choice:m.pendingChoice?.seat===seat?{type:m.pendingChoice.type,prompt:m.pendingChoice.prompt||'',remaining:m.pendingChoice.remaining,options:m.pendingChoice.options.map((o,i)=>({index:i,card:publicCard(o.card,i)}))}:null}}
export function publicClient(c){return{clientId:c.clientId,name:c.name,seat:c.seat,ready:c.ready,connected:c.connected!==false,deckLoaded:!!c.deck,deckName:c.deck?.deck_name||''}}
export function publicSpectator(c){return{clientId:c.clientId,name:c.name,connected:c.connected!==false}}
function spectatorHints(m){return{spectator:true,active:false,coinFlip:false,waitingCoinFlip:false,coinFlipResult:null,canNext:false,canEnd:false,canReposition:false,canTribute:false,dualCasting:null,playableCardIndexes:[],legacySlots:[],responseCards:[],waitingForOpponentResponse:m.pendingAttack?{card_name:m.pendingAttack.card?.card_name||'',receiverSlot:m.pendingAttack.slots?.[m.pendingAttack.index]||''}:null,responseFor:null,choice:null}}
export function snapshotFor(room,client){const setup=[...room.clients.values()].map(publicClient).sort((a,b)=>a.seat-b.seat),spectators=[...(room.spectators||new Map()).values()].map(publicSpectator).sort((a,b)=>a.name.localeCompare(b.name)),bothReady=setup.length===2&&setup.every(x=>x.connected!==false&&x.ready&&x.deckLoaded),m=room.match,isSpectator=client.role==='spectator';let match={status:m.status,spectator:isSpectator};if(m.status!=='setup'){match=isSpectator?{status:m.status,spectator:true,mode:m.mode,round:m.round,turnNumber:m.turnNumber,activeSeat:m.activeSeat,phase:m.phase,winner:m.winner,you:publicPlayer(m.players[1],false),opponent:publicPlayer(m.players[2],false),hints:spectatorHints(m)}:{status:m.status,spectator:false,mode:m.mode,round:m.round,turnNumber:m.turnNumber,activeSeat:m.activeSeat,phase:m.phase,winner:m.winner,you:publicPlayer(m.players[client.seat],true),opponent:publicPlayer(m.players[opponent(client.seat)],!!m.players[client.seat]?.tmpRevealOpponentHand),hints:actionHints(m,client.seat)}}return{type:'snapshot',roomId:room.id,role:isSpectator?'spectator':'player',players:setup,spectators,spectatorCount:spectators.filter(x=>x.connected!==false).length,bothReady,canStart:!isSpectator&&bothReady&&client.seat===1&&m.status==='setup',yourSeat:isSpectator?null:client.seat,logs:room.logs,cardNotices:Array.isArray(m.cardNotices)?clone(m.cardNotices):[],match}}


// ============================================================
// v0.4.4 OVERRIDE - LOCAL AI v0.9.61 ATTACHMENT SLOT PARITY
// Guide Pack v1.7.1 current PDF pack / CSV Source Sync v1.8.8
// ============================================================
const V044_ATTACHMENT_LIMIT=2;
const V044_BUFF_META={
 'Blessing of Might':{type:'ATK',activated:true},
 'Blessing of Wisdom':{type:'ATK',activated:true},
 "Heaven's Fury":{type:'ATK',activated:false},
 'Enrage':{type:'ATK',activated:false},
 'Arcane Scroll':{type:'ATK',activated:true},
 'Holy Medallion':{type:'ATK',activated:true},
 'Ring of Grace':{type:'HEAL',activated:true},
 'Poison Vial':{type:'POISON',activated:true},
 'Invisibility Cloak':{type:'UNTARGETABLE',activated:true}
};
function v044Attachments(h){if(!h)return[];if(!Array.isArray(h.attachments))h.attachments=[];return h.attachments}
function v044Free(h){return Math.max(0,V044_ATTACHMENT_LIMIT-v044Attachments(h).length)}
function v044SameType(h,type){return v044Attachments(h).some(a=>a.kind==='BUFF'&&a.buffType===type)}
function v044CanAttach(h,meta){return !!(alive(h)&&meta&&v044Free(h)>0&&!v044SameType(h,meta.type))}
function v044TakeDiscard(p,card){for(let i=p.discard.length-1;i>=0;i--)if(p.discard[i]===card||p.discard[i]?.card_id===card?.card_id)return p.discard.splice(i,1)[0];return card}
function v044AttachBuff(room,p,h,card,meta){if(!v044CanAttach(h,meta))throw new Error('Attachment Slots are full or the same Buff type is already active.');const held=v044TakeDiscard(p,card);v044Attachments(h).push({kind:'BUFF',buffType:meta.type,card:held,cardId:held.card_id,name:held.card_name,durationText:held.buff_duration||'',activated:!!meta.activated});addLog(room,`${held.card_name} remains in ${h.name} Attachment Slot while active${held.buff_duration?` (${held.buff_duration})`:''}.`)}
function v044CastingEntry(p,slot){return p.casting.find(x=>x.slot===slot)}
function v044SyncCasting(p){for(const slot of LANES){const h=p.board[slot];if(!h)continue;const q=v044CastingEntry(p,slot);h.attachments=v044Attachments(h).filter(a=>a.kind!=='CASTING'||!!q);if(q){let a=h.attachments.find(x=>x.kind==='CASTING');if(!a){a={kind:'CASTING',name:q.card.card_name,cardId:q.card.card_id,card:q.card,activated:true,targetSlot:q.targetSlot||''};h.attachments.unshift(a)}else{Object.assign(a,{name:q.card.card_name,cardId:q.card.card_id,card:q.card,activated:true,targetSlot:q.targetSlot||a.targetSlot||''})}}}}
function v044ExpireBuffs(room,p){for(const h of Object.values(p.board||{})){if(!h)continue;const keep=[];for(const a of v044Attachments(h)){if(a.kind==='BUFF'&&a.activated){if(a.card)p.discard.push(a.card);addLog(room,`${a.name} expires at its printed duration, leaves ${h.name} Attachment Slot, and moves to discard pile.`)}else keep.push(a)}h.attachments=keep}}
function v044ClearDefeated(room,p,h,slot){for(const a of v044Attachments(h))if(a.card)p.discard.push(a.card);h.attachments=[];const canceled=p.casting.filter(x=>x.slot===slot);p.casting=p.casting.filter(x=>x.slot!==slot);for(const c of canceled)if(!p.discard.includes(c.card))p.discard.push(c.card);h.actionZone=null}
function v044BuffTarget(name,user,target){return name==='Enrage'?user:target}
function v044Precheck(room,seat,card,userSlot,targetSeat,targetSlot){const meta=V044_BUFF_META[card?.card_name];if(!meta)return;const m=room.match,user=m.players[seat].board[userSlot],target=m.players[targetSeat]?.board?.[targetSlot],h=v044BuffTarget(card.card_name,user,target);if(!v044CanAttach(h,meta))throw new Error(`${card.card_name} cannot attach: the Hero has no empty Attachment Slot or already has an active Buff of the same type.`)}

const normalizeDeck_v044=normalizeDeck;
normalizeDeck=function(input){if(input&&input.legacy_deck_expanded)input={...input,side_deck_expanded:input.legacy_deck_expanded};return normalizeDeck_v044(input)};
const makeHero_v044=makeHero;
makeHero=function(id){const h=makeHero_v044(id);h.attachments=[];h.castingMode=false;return h};
const publicHero_v044=publicHero;
publicHero=function(h){const x=publicHero_v044(h);if(!x)return x;x.local_thumbnail_path=h.local_thumbnail_path||'';x.attachments=clone(v044Attachments(h).map(a=>({kind:a.kind,buffType:a.buffType||'',name:a.name||'',cardId:a.cardId||'',durationText:a.durationText||'',targetSlot:a.targetSlot||'',card:a.card?publicCard(a.card,null):null})));x.attachmentSlots=V044_ATTACHMENT_LIMIT;x.castingMode=!!h.actionZone;return x};
const publicCard_v044=publicCard;
publicCard=function(c,index){const x=publicCard_v044(c,index);x.local_thumbnail_path=c.local_thumbnail_path||'';return x};

const cleanTempAtStart_v044=cleanTempAtStart;
cleanTempAtStart=function(p){cleanTempAtStart_v044(p);for(const h of Object.values(p.board||{}))for(const a of v044Attachments(h))if(a.kind==='BUFF'&&!a.activated&&((a.name==='Enrage'&&h.tmp.enrageActive)||(a.name==="Heaven's Fury"&&h.tmp.heavensFuryActive)))a.activated=true;v044SyncCasting(p)};
const cleanupEnd_v044=cleanupEnd;
cleanupEnd=function(room,p){cleanupEnd_v044(room,p);v044ExpireBuffs(room,p);v044SyncCasting(p)};
const resolveCasting_v044=resolveCasting;
resolveCasting=function(room,seat){const p=room.match.players[seat],r=resolveCasting_v044(room,seat);v044SyncCasting(p);return r};
const executeNonAttackCard_v044=executeNonAttackCard;
executeNonAttackCard=function(room,seat,card,userSlot,targetSeat,targetSlot,script){const meta=V044_BUFF_META[card.card_name];if(meta){const m=room.match,p=m.players[seat],user=p.board[userSlot],target=m.players[targetSeat]?.board?.[targetSlot],h=v044BuffTarget(card.card_name,user,target);v044AttachBuff(room,p,h,card,meta)}return executeNonAttackCard_v044(room,seat,card,userSlot,targetSeat,targetSlot,script)};
const resolveGeneric_v044=resolveGeneric;
resolveGeneric=function(room,seat,index,userSlot,targetSeat,targetSlot){const m=room.match,p=m.players[seat],card=p.hand[index],user=p.board[userSlot];if(card){v044Precheck(room,seat,card,userSlot,targetSeat,targetSlot);const script=SCRIPTS.get(card.card_id),casting=n(card.casting_time)||(script?.steps||[]).find(x=>x.step_type==='DECLARE_CASTING')?.duration_turns;if(card.card_subtype==='ATK'&&casting&&v044Free(user)<1)throw new Error('Casting requires 1 empty Attachment Slot.')}const r=resolveGeneric_v044(room,seat,index,userSlot,targetSeat,targetSlot);v044SyncCasting(p);return r};
const defeat_v044=defeat;
defeat=function(room,seat,slot){const p=room.match.players[seat],h=p.board[slot];if(h&&!h.legacy)v044ClearDefeated(room,p,h,slot);return defeat_v044(room,seat,slot)};
const tryRank_v044=tryRank;
tryRank=function(room,seat,slot){const p=room.match.players[seat],before=p.board[slot],keep=v044Attachments(before).slice(),r=tryRank_v044(room,seat,slot),after=p.board[slot];if(after)after.attachments=keep;v044SyncCasting(p);return r};
const reposition_v044=reposition;
reposition=function(room,client,a,b){const m=room.match;if(!['Deploy Phase','Reform Phase'].includes(m.phase))throw new Error('Reposition is available during Deploy or Reform Phase.');return reposition_v044(room,client,a,b)};
const useAbility_v044=useAbility;
useAbility=function(room,client,slot,targetSlot){const m=room.match;if(!access(m.mode,slot).includes(targetSlot))throw new Error('Aurex heal target must be an allied active Hero inside this Hero Area.');return useAbility_v044(room,client,slot,targetSlot)};
const actionHints_v044=actionHints;
actionHints=function(m,seat){const h=actionHints_v044(m,seat);if(h)h.canReposition=!!(h.canReposition&&['Deploy Phase','Reform Phase'].includes(m.phase));return h};


// ============================================================
// PLAYABLE FLOW / HAND LIMIT UI PARITY
// ============================================================
function v045UsersForCard(m,seat,card){const p=m.players[seat],stamina=card?.card_name==='Stamina Potion';return LANES.filter(l=>stamina?(alive(p.board[l])&&!p.board[l].actionZone&&!p.board[l].status.Stun):canUser(card,p.board[l],m,seat,l))}
function v045OpenHandLimit(room,client,resume){const m=room.match,p=m.players[client.seat];if(p.hand.length<=8)return false;const remaining=p.hand.length-8;m.pendingChoice={seat:client.seat,type:'HAND_LIMIT_DISCARD',prompt:`Hand limit exceeded. Discard ${remaining} card${remaining===1?'':'s'} before the next player turn.`,remaining,resume,options:p.hand.map((card,index)=>({index,card}))};addLog(room,`Player ${client.seat} must discard ${remaining} card${remaining===1?'':'s'} to respect the maximum hand size of 8.`);return true}
const nextPhase_v045=nextPhase;
nextPhase=function(room,client){const m=assertActive(room,client);if(m.phase==='End Phase'&&v045OpenHandLimit(room,client,'NEXT_PHASE'))return;return nextPhase_v045(room,client)};
const endTurn_v045=endTurn;
endTurn=function(room,client){assertActive(room,client);if(v045OpenHandLimit(room,client,'END_TURN'))return;return endTurn_v045(room,client)};
const resolveChoice_v045=resolveChoice;
resolveChoice=function(room,client,index){const m=room.match,c=m.pendingChoice;if(c?.type!=='HAND_LIMIT_DISCARD')return resolveChoice_v045(room,client,index);if(c.seat!==client.seat)throw new Error('This hand-limit choice belongs to the other player.');const p=m.players[client.seat],opt=c.options[n(index,-1)];if(!opt)throw new Error('Choose a valid card to discard.');const [card]=p.hand.splice(opt.index,1);p.discard.push(card);c.remaining--;addLog(room,`Player ${client.seat} discards ${card.card_name} for hand limit. ${Math.max(0,c.remaining)} remaining.`);if(c.remaining>0){c.options=p.hand.map((card,index)=>({index,card}));c.prompt=`Hand limit exceeded. Discard ${c.remaining} more card${c.remaining===1?'':'s'} before the next player turn.`;return}const resume=c.resume;m.pendingChoice=null;if(resume==='NEXT_PHASE')return nextPhase_v045(room,client);return endTurn_v045(room,client)};
const actionHints_v045=actionHints;
actionHints=function(m,seat){const h=actionHints_v045(m,seat);if(!h||m.status!=='active'||m.coinFlip?.pending)return h;const p=m.players[seat];h.playableUsersByCard=Object.fromEntries((h.playableCardIndexes||[]).map(index=>[String(index),v045UsersForCard(m,seat,p.hand[index])]));h.tributeTargetSlots=h.canTribute?LANES.filter(l=>alive(p.board[l])&&rankNum(p.board[l].rank)<3):[];h.abilityTargetsBySlot=Object.fromEntries(LANES.map(slot=>[slot,LANES.filter(target=>alive(p.board[target])&&access(m.mode,slot).includes(target))]));return h};


// ============================================================
// CONFIRMED COIN FLIP / STRICT PLAYABLE HINTS
// ============================================================
const actionHints_v046=actionHints;
actionHints=function(m,seat){
 if(m.status==='active'&&m.coinFlip?.awaitingConfirmation){return{active:false,coinFlip:false,waitingCoinFlip:false,coinFlipResult:{choice:m.coinFlip.choice,outcome:m.coinFlip.outcome,firstSeat:m.coinFlip.firstSeat},canNext:false,canEnd:false,canReposition:false,canTribute:false,dualCasting:null,playableCardIndexes:[],playableUsersByCard:{},tributeTargetSlots:[],legacySlots:[],responseCards:[],waitingForOpponentResponse:null,responseFor:null,choice:null}}
 const h=actionHints_v046(m,seat);if(!h||m.status!=='active'||m.coinFlip?.pending)return h;
 const p=m.players[seat],mapped=h.playableUsersByCard||{};
 h.playableCardIndexes=(h.playableCardIndexes||[]).filter(index=>(mapped[String(index)]||v045UsersForCard(m,seat,p.hand[index])).length>0);
 h.playableUsersByCard=Object.fromEntries((h.playableCardIndexes||[]).map(index=>[String(index),mapped[String(index)]||v045UsersForCard(m,seat,p.hand[index])]));
 return h
};


// ============================================================
// v0.4.8 OVERRIDE - UI parity support
// Reposition remains legal in Main Mode during Deploy or Reform Phase.
// Response-window hints include local Hero thumbnail metadata.
// ============================================================


// ============================================================
// v0.5.2 OVERRIDES — CSV v1.9.4 / Starter Presets v1.8.3
// ============================================================
const normalizeDeck_v052=normalizeDeck;
normalizeDeck=function(input){
 if(input&&input.legacy_deck_expanded)input={...input,side_deck_expanded:input.legacy_deck_expanded};
 const out=normalizeDeck_v052(input),side=out.side||[],heroes=side.filter(x=>x.card_type==='Hero'),legacies=side.filter(x=>x.card_type==='Legacy');
 if(heroes.length!==15||legacies.length!==5)throw new Error('Legacy Deck must contain exactly 15 Hero cards and 5 Legacy Cards.');
 const legacyIds=legacies.map(x=>x.card_id);if(new Set(legacyIds).size!==legacyIds.length)throw new Error('Each Legacy Card may appear at most once in the Legacy Deck.');
 const slots=input?.legacy_deck_package_slots||input?.side_deck_package_slots||[];
 if(slots.length&&slots.length!==5)throw new Error('Legacy Deck must contain exactly 5 progression packages.');
 if(slots.length){const progressions=slots.map(x=>String(x.progression||'')),legacy=slots.map(x=>String(x.legacy||''));if(new Set(progressions).size!==5)throw new Error('Each Hero progression variant may appear at most once in the Legacy Deck.');if(new Set(legacy).size!==5)throw new Error('Each Legacy Card may appear at most once in the Legacy Deck.');for(const x of slots){const fam=String(x.progression||'').slice(3,6),lfam=String(x.legacy||'').slice(3,6);if(fam!==lfam)throw new Error('Legacy replacement slots must match the Hero Rank I base-class family.')}}
 out.defaultFormation=clone(out.formation);return out
};
const createRoom_v052=createRoom;
createRoom=function(id){const room=createRoom_v052(id);room.spectatorMode='FAIR';return room};
export function updateFormation(room,client,formation){if(room.match.status!=='setup')throw new Error('Starting formation can only be changed before match start.');if(!client.deck)throw new Error('Load a deck before editing formation.');client.deck.formation=normalizeFormation(formation,client.deck.side);client.ready=false;addLog(room,`${client.name} confirms the starting formation: LEFT ${client.deck.formation.LEFT}, CENTER ${client.deck.formation.CENTER}, RIGHT ${client.deck.formation.RIGHT}.`)}
export function setSpectatorMode(room,client,mode){if(room.match.status!=='setup')throw new Error('Spectator visibility is locked after match start.');const v=String(mode||'').toUpperCase();if(!['FAIR','LEARNING'].includes(v))throw new Error('Choose FAIR or LEARNING spectator mode.');if(!(client.role==='spectator'||client.seat===1))throw new Error('Only the host spectator or Player 1 may change spectator visibility.');room.spectatorMode=v;addLog(room,`Spectator View changed to ${v} Mode.`)}
const publicClient_v052=publicClient;
publicClient=function(c){const x=publicClient_v052(c),side=c.deck?.side||[];x.formation=c.deck?.formation||null;x.defaultFormation=c.deck?.defaultFormation||c.deck?.formation||null;x.formationOptions=side.filter(card=>card.card_type==='Hero'&&rankNum(HERO[card.card_id]?.rank)===1).map(card=>({id:card.card_id,name:HERO[card.card_id]?.name||card.card_name}));x.mainDeckCount=c.deck?.main?.length||0;x.legacyDeckCount=side.length;return x};
const makeHero_v052=makeHero;
makeHero=function(id){const h=makeHero_v052(id);h.stonebloodUsed=false;h.local_thumbnail_path=HERO[id]?.local_thumbnail_path||'';return h};
// Outside Battle Phase allied utility and Aurex activated heal ignore positional geometry.
useAbility=function(room,client,slot,targetSlot){return useAbility_v044(room,client,slot,targetSlot)};
const actionHints_v052a=actionHints;
actionHints=function(m,seat){const h=actionHints_v052a(m,seat);if(h&&m.status==='active'){const p=m.players[seat];h.abilityTargetsBySlot=Object.fromEntries(LANES.map(slot=>[slot,LANES.filter(target=>alive(p.board[target]))]))}return h};
// Greater Health Potion: receiving Hero is the Item user and becomes Exhausted after healing.
const resolveGeneric_v052=resolveGeneric;
resolveGeneric=function(room,seat,index,userSlot,targetSeat,targetSlot){const p=room.match.players[seat],card=p.hand[index],target=room.match.players[targetSeat]?.board?.[targetSlot];if(card?.card_id==='S1-ITM-002'&&target?.exhausted)throw new Error('Greater Health Potion cannot be used on an already Exhausted Hero.');return resolveGeneric_v052(room,seat,index,userSlot,targetSeat,targetSlot)};
const executeNonAttackCard_v052=executeNonAttackCard;
executeNonAttackCard=function(room,seat,card,userSlot,targetSeat,targetSlot,script){const r=executeNonAttackCard_v052(room,seat,card,userSlot,targetSeat,targetSlot,script);if(card?.card_id==='S1-ITM-002'){const h=room.match.players[targetSeat]?.board?.[targetSlot];if(h){h.exhausted=true;addLog(room,`Greater Health Potion Exhausts ${h.name} after resolution.`)}}return r};
// Turn transition information-only notices.
function v052ResetRacialWindowForNewTurn(m){for(const p of Object.values(m.players||{})){p.racialUsedTurn=false;for(const h of Object.values(p.board||{}))if(h)h.racialUsed=false}}
function v052StonebloodKey(h){return String(h?.packageId||h?.id||'')}
function v052StonebloodWasUsed(p,h){return !!p?.stonebloodUsedHeroes?.[v052StonebloodKey(h)]}
function v062StonebloodEligible(p,h){return !!(h&&!h.legacy&&h.race==='Dwarf'&&p&&p.racial>0&&!p.racialUsedTurn&&!v052StonebloodWasUsed(p,h))}
const startTurn_v052=startTurn;
startTurn=function(room,seat){const m0=room.match;v052ResetRacialWindowForNewTurn(m0);const r=startTurn_v052(room,seat),m=room.match,p=m.players?.[seat];if(m.status==='active'&&p){announceToSeat(room,seat,'Your Turn Begins',`Player ${seat} begins a new turn. Draw Phase is complete: draw 1 card and gain ${p.regen} Mana. Continue from Deploy Phase.`);announceToSeat(room,opponent(seat),'Opponent Turn Begins',`Player ${seat} begins a new turn and moves to Deploy Phase.`)}return r};
// Stoneblood: immediate defeat / 0-HP window before Legacy replacement.
const defeat_v052=defeat;
defeat=function(room,seat,slot){const m=room.match,p=m.players[seat],h=p.board[slot];if(v062StonebloodEligible(p,h)){v044ClearDefeated(room,p,h,slot);m.pendingChoice={type:'STONEBLOOD',seat,slot,prompt:`${h.name} reached 0 HP. Activate Stoneblood now?`,options:[{card:virtualChoiceCard('STONEBLOOD-ACTIVATE','Activate Stoneblood','Spend 1 Racial Token. Revive this Hero with 10 HP Exhausted. This Hero can activate Stoneblood only once for the entire match.')},{card:virtualChoiceCard('STONEBLOOD-DECLINE','Decline Stoneblood','Do not activate Stoneblood.')} ]};addLog(room,`STONEBLOOD WINDOW: ${h.name} reached 0 HP. Player ${seat} may activate Stoneblood or decline.`);return}return defeat_v052(room,seat,slot)};
// Legacy activation, deployment, public recovery notices, same-resolution discard exclusion.
const useLegacy_v052=useLegacy;
useLegacy=function(room,client,slot){const m=room.match,p=m.players[client.seat],h=p.board[slot];const r=useLegacy_v052(room,client,slot);if(h?.legacy)announceCardUse(room,client.seat,legacyNoticeCard(h),`Player ${client.seat} activates ${h.name} in ${slot}.`,'Opponent Uses a Legacy Effect');return r};
function v052ExcludeDiscardedDuringCurrentResolution(choice,options){const excluded=new Set(Array.isArray(choice?.discardedThisResolution)?choice.discardedThisResolution:[]);return(options||[]).filter(o=>!excluded.has(o.card))}
function v052IsDiscardRecoveryChoice(choice){return !!choice&&(choice.recoverFromDiscardPile===true||['ARCANE_WAND_PICK','DEJA_VU'].includes(choice.type))}
const resolveChoice_v052=resolveChoice;
resolveChoice=function(room,client,index){const m=room.match,c=m.pendingChoice,p=m.players?.[client.seat];if(c?.type==='STONEBLOOD'){if(c.seat!==client.seat)throw new Error('This Stoneblood choice belongs to the other player.');const opt=c.options[n(index,-1)],h=p.board[c.slot];if(!opt||!h)throw new Error('Choose Activate or Decline.');m.pendingChoice=null;if(opt.card.card_id==='STONEBLOOD-ACTIVATE'){if(!v062StonebloodEligible(p,h))throw new Error('Stoneblood is no longer available for this Hero.');p.racial--;p.racialUsedTurn=true;p.stonebloodUsedHeroes=p.stonebloodUsedHeroes||{};p.stonebloodUsedHeroes[v052StonebloodKey(h)]=true;h.racialUsed=true;h.stonebloodUsed=true;h.damage=Math.max(0,h.maxHp-10);h.exhausted=true;addLog(room,`${h.name} activates Stoneblood: revives with 10 HP Exhausted. Stoneblood is now spent for this Hero.`);announceCardUse(room,client.seat,{card_id:h.id,card_name:'Stoneblood',image_url:h.image_url,thumbnail_url:h.thumbnail_url,local_thumbnail_path:h.local_thumbnail_path},`${h.name} revives with 10 HP Exhausted. Stoneblood is now spent for this Hero.`,'Opponent Activated Stoneblood')}else{addLog(room,`${h.name} declines Stoneblood.`);defeat_v052(room,client.seat,c.slot);openNextLegacyChoice(room)}checkWin(room);return}
 const beforeType=c?.type, opt=c?.options?.[n(index,-1)], recoveryCard=(beforeType==='DEJA_VU'||beforeType==='ARCANE_WAND_PICK')?opt?.card:null, legacyDeploy=beforeType==='LEGACY'?opt?.card:null, legacySlot=beforeType==='LEGACY'?c?.slot:null, discarded=(beforeType==='LEGACY_DISCARD_MULTI')?opt?.card:null;
 if(c&&beforeType==='LEGACY_DISCARD_MULTI'){if(!Array.isArray(c.discardedThisResolution))c.discardedThisResolution=[];if(discarded)c.discardedThisResolution.push(discarded)}
 const r=resolveChoice_v052(room,client,index);
 const after=m.pendingChoice;
 if(after&&after.type==='ARCANE_WAND_PICK')after.recoverFromDiscardPile=true;
 if(after&&v052IsDiscardRecoveryChoice(after)&&Array.isArray(after.discardedThisResolution)){after.options=v052ExcludeDiscardedDuringCurrentResolution(after,after.options);if(!after.options.length){const h=p.board?.[after.legacySlot];if(h)h.legacyUsed=true;m.pendingChoice=null;addLog(room,'Discard-pile recovery resolves without retrieving a card: no pre-existing eligible card remains after excluding cards discarded during the current resolution.');openNextLegacyChoice(room);checkWin(room)}}
 if(legacyDeploy){const deployed=legacySlot?p.board?.[legacySlot]:null,meta=LEGACY[deployed?.id]||LEGACY[legacyDeploy.card_id]||{};if(deployed){deployed.image_url=meta.image_url||deployed.image_url||'';deployed.thumbnail_url=meta.thumbnail_url||meta.image_url||deployed.thumbnail_url||'';deployed.local_thumbnail_path=meta.local_thumbnail_path||deployed.local_thumbnail_path||'';deployed.packageId=legacyDeploy.package_id||deployed.packageId||''}const noticeCard=deployed||{...legacyDeploy,...meta};announceCardUse(room,client.seat,noticeCard,`Player ${client.seat} deploys ${noticeCard.name||noticeCard.card_name} as a Legacy replacement.`,'Opponent Deploys a Legacy Card')}
 if(recoveryCard)announceCardUse(room,client.seat,recoveryCard,`Player ${client.seat} returned ${recoveryCard.card_name} from the discard pile to hand.`,'Card Recovered from Discard Pile');
 return r
};
// Spectator mode snapshots: Fair hides hands, Learning reveals hands to spectators only.
function v052ReadOnlyResponse(m){const a=m.pendingAttack;if(!a)return null;const slot=a.slots?.[a.index],att=m.players[a.sourceSeat]?.board?.[a.userSlot],rec=m.players[a.targetSeat]?.board?.[slot];return{attackId:a.attackId||'',card_name:a.card?.card_name||'',card_image:a.card?.image_url||'',card_image_thumb:a.card?.thumbnail_url||a.card?.image_url||'',card_local_thumbnail:a.card?.local_thumbnail_path||'',damage:a.damage,attackType:a.attackType,aoe:a.aoe,currentSlot:slot,step:(a.index||0)+1,total:a.slots?.length||1,selected:a.selected?publicCard(a.selected.card,a.selected.index):null,attacker:{seat:a.sourceSeat,slot:a.userSlot,name:att?.name||'-',hp:att?hp(att):0,maxHp:att?.maxHp||0,state:heroStateText(att),image_url:att?.image_url||'',thumbnail_url:att?.thumbnail_url||att?.image_url||'',local_thumbnail_path:att?.local_thumbnail_path||''},receiver:{seat:a.targetSeat,slot,name:rec?.name||'-',hp:rec?hp(rec):0,maxHp:rec?.maxHp||0,state:heroStateText(rec),image_url:rec?.image_url||'',thumbnail_url:rec?.thumbnail_url||rec?.image_url||'',local_thumbnail_path:rec?.local_thumbnail_path||''}}}
const snapshotFor_v052=snapshotFor;
snapshotFor=function(room,client){const snap=snapshotFor_v052(room,client);snap.spectatorMode=room.spectatorMode||'FAIR';if(client.role==='spectator'&&room.match.status!=='setup'){const reveal=snap.spectatorMode==='LEARNING';snap.match.you=publicPlayer(room.match.players[1],reveal);snap.match.opponent=publicPlayer(room.match.players[2],reveal);snap.match.hints={...spectatorHints(room.match),responseReadOnly:v052ReadOnlyResponse(room.match)};snap.match.spectatorMode=snap.spectatorMode}return snap};


// ============================================================
// v0.5.2 HARDENING — Rank-I formation + enriched Legacy assets
// ============================================================
function v052EnrichSideCard(card){const meta=HERO[card?.card_id]||LEGACY[card?.card_id]||{};return{...card,card_name:card?.card_name||meta.name||'',image_url:card?.image_url||meta.image_url||'',thumbnail_url:card?.thumbnail_url||meta.thumbnail_url||meta.image_url||card?.image_url||'',local_thumbnail_path:card?.local_thumbnail_path||meta.local_thumbnail_path||''}}
function v052NormalizeStartingFormation(formation,side){const f=normalizeFormation(formation,side);for(const lane of LANES){if(rankNum(HERO[f[lane]]?.rank)!==1)throw new Error(`Starting formation ${lane} must use a Rank I Hero.`)}return f}
const normalizeDeck_v052hard=normalizeDeck;
normalizeDeck=function(input){const out=normalizeDeck_v052hard(input);out.side=(out.side||[]).map(v052EnrichSideCard);out.formation=v052NormalizeStartingFormation(out.formation,out.side);out.defaultFormation=clone(out.formation);return out};
updateFormation=function(room,client,formation){if(room.match.status!=='setup')throw new Error('Starting formation can only be changed before match start.');if(!client.deck)throw new Error('Load a deck before editing formation.');client.deck.formation=v052NormalizeStartingFormation(formation,client.deck.side);client.ready=false;addLog(room,`${client.name} confirms the starting formation: LEFT ${client.deck.formation.LEFT}, CENTER ${client.deck.formation.CENTER}, RIGHT ${client.deck.formation.RIGHT}.`)};


// ============================================================
// v0.5.2 OVERLAP HARDENING — racial turn window + Stoneblood lineage
// ============================================================
const tryRank_v052overlap=tryRank;
tryRank=function(room,seat,slot){const p=room.match.players[seat],before=p.board[slot],key=v052StonebloodKey(before),r=tryRank_v052overlap(room,seat,slot),after=p.board[slot];if(after&&key){after.stonebloodUsed=!!p.stonebloodUsedHeroes?.[key]}return r};


// === v0.5.3 / CSV Source Sync v1.9.6 rule-engine sync ========================
// Generic active-class lineage matching, highest-specificity dynamic rows,
// Quick Mode true-1v1 no-auto-center, Holy Barrier allied provider flow,
// Poison End Phase ticks, and dynamic reference-pool metadata.
const V053_HOLY_BARRIER='S1-CLE-011';
function v053Split(v){return String(v||'').split(/[;,]|\bor\b/i).map(x=>x.trim()).filter(Boolean)}
function v053ParseDepthMap(raw){const out={};for(const token of v053Split(raw)){const [k,v]=token.split('=').map(x=>String(x||'').trim());if(k)out[k.toLowerCase()]=n(v,0)}return out}
const reachedClassLine_v053_base=reachedClassLine;
function v053HeroLineage(h){const src=HERO[h?.id]||{};const explicit=v053Split(src.active_class_lineage||h?.activeClassLineage);if(explicit.length)return explicit;return reachedClassLine_v053_base(h).map(x=>String(x).replace(/\b\w/g,c=>c.toUpperCase()))}
function v053LineageDepth(h){const src=HERO[h?.id]||{};const explicit=v053ParseDepthMap(src.lineage_depth_map||h?.lineageDepthMap);if(Object.keys(explicit).length)return explicit;const out={};v053HeroLineage(h).forEach((x,i)=>out[String(x).toLowerCase()]=i+1);return out}
reachedClassLine=function(h){return v053HeroLineage(h).map(x=>String(x).toLowerCase())};
const classAllowed_v053_base=classAllowed;
classAllowed=function(card,h){
  if(card?.card_type==='Event')return true;
  if(card?.card_type!=='Skill')return classAllowed_v053_base(card,h);
  const printed=v053Split(card.lineage_match_classes||card.class_restriction||card.class_family);
  if(!printed.length||printed.some(x=>['all','all class','all classes'].includes(x.toLowerCase())))return true;
  const lineage=v053HeroLineage(h).map(x=>x.toLowerCase());
  return printed.some(row=>lineage.includes(row.toLowerCase()));
};
function v053ResolveDynamic(v,h,fallback=0){
  if(v===null||v===undefined||v==='')return fallback;
  if(Number.isFinite(+v))return +v;
  const pairs=[...String(v).matchAll(/([A-Za-z ]+)\s+(\d+)/g)];
  if(!pairs.length)return n((String(v).match(/\d+/)||[])[0],fallback);
  const lineage=v053HeroLineage(h).map(x=>x.toLowerCase()),depth=v053LineageDepth(h);
  let best=null,bestDepth=-1;
  for(const p of pairs){const row=p[1].trim().toLowerCase();if(lineage.includes(row)){const d=n(depth[row],0);if(d>bestDepth){best=+p[2];bestDepth=d}}}
  return best??+pairs[0][2];
}
parseDynamic=function(v,h,fallback=0){return v053ResolveDynamic(v,h,fallback)};
parseStatusDynamic=function(v,h,fallback=0){return v053ResolveDynamic(v,h,fallback)};
const makeHero_v053_base=makeHero;
makeHero=function(id){const h=makeHero_v053_base(id);h.activeClassLineage=v053HeroLineage(h);h.lineageDepthMap=v053LineageDepth(h);return h};
const publicHero_v053_base=publicHero;
publicHero=function(h){const x=publicHero_v053_base(h);if(x){x.activeClassLineage=clone(h.activeClassLineage||v053HeroLineage(h));x.lineageDepthMap=clone(h.lineageDepthMap||v053LineageDepth(h))}return x};

const isAutoCenterState_v053_base=isAutoCenterState;
isAutoCenterState=function(m){return m?.mode==='MAIN'&&isAutoCenterState_v053_base(m)};

const openAttack_v053_base=openAttack;
openAttack=function(room,seat,card,userSlot,targetSeat,targetSlot,fromCasting=false){const ok=openAttack_v053_base(room,seat,card,userSlot,targetSeat,targetSlot,fromCasting);if(ok&&room.match.pendingAttack)room.match.pendingAttack.mode=room.match.mode;return ok};
const cardAttackInfo_v053_base=cardAttackInfo;
cardAttackInfo=function(card,h){const info=cardAttackInfo_v053_base(card,h);for(const st of info.statuses||[])if(st.status==='Poison')st.poisonTick=info.aoe?20:10;return info};
const statusApply_v053_base=statusApply;
statusApply=function(h,name,duration,meta={}){const ok=statusApply_v053_base(h,name,duration);if(ok&&name==='Poison'){h.tmp=h.tmp||{};h.tmp.poisonTick=Math.max(n(h.tmp.poisonTick),n(meta?.poisonTick,10))}return ok};
const removeOneNegative_v053_base=removeOneNegative;
removeOneNegative=function(h){const removed=removeOneNegative_v053_base(h);if(removed==='Poison'&&h?.tmp)delete h.tmp.poisonTick;return removed};
const cleanupEnd_v053_base=cleanupEnd;
cleanupEnd=function(room,p){
  for(const [slot,h] of Object.entries(p.board||{}))if(alive(h)&&n(h.status?.Poison)>0){
    const tick=n(h.tmp?.poisonTick,10),before=hp(h);h.damage=Math.min(h.maxHp,h.damage+tick);
    addLog(room,`POISON TICK: ${h.name} takes ${tick} damage at owner End Phase (HP ${before} -> ${hp(h)}).`);
    if(hp(h)<=0)defeat(room,p.seat,slot);
  }
  cleanupEnd_v053_base(room,p);
  for(const h of Object.values(p.board||{}))if(h?.tmp&&!n(h.status?.Poison))delete h.tmp.poisonTick;
  if(room.match.status==='active')openNextLegacyChoice(room);
  if(room.match.status==='active')checkWin(room);
};

function v053HolyBarrierProviderSlots(p,a,receivingSlot){
  const card=MAIN.get(V053_HOLY_BARRIER),mode=a?.mode||'MAIN';
  return LANES.filter(providerSlot=>{const h=p.board[providerSlot];return alive(h)&&!h.status?.Stun&&classAllowed(card,h)&&access(mode,providerSlot).includes(receivingSlot)});
}
const defLegal_v053_base=defLegal;
defLegal=function(p,card,a,currentSlot){
  if(card?.card_id!==V053_HOLY_BARRIER)return defLegal_v053_base(p,card,a,currentSlot);
  const meta=DEF.get(card.card_id),receiver=p.board[currentSlot];if(!meta||p.mana<n(card.mana_cost)||!alive(receiver))return false;
  const types=meta.response_types||[],req=String(meta.requires_attack_type||'ANY');
  if(req==='PHYSICAL'&&a.attackType!=='PHYSICAL')return false;if(req==='MAGICAL'&&a.attackType!=='MAGICAL')return false;
  if(a.unblockable&&types.includes('BLOCK'))return false;if(a.aoe&&(types.includes('NEGATE')||types.includes('COUNTER_RETURN')||types.includes('REDIRECT')))return false;
  return v053HolyBarrierProviderSlots(p,a,currentSlot).length>0;
};
const legalResponseList_v053_base=legalResponseList;
legalResponseList=function(m,seat){const out=legalResponseList_v053_base(m,seat),a=m.pendingAttack,p=m.players[seat],slot=a?.slots?.[a?.index];for(const x of out)if(x.card_id===V053_HOLY_BARRIER)x.providerSlots=v053HolyBarrierProviderSlots(p,a,slot);return out};
const selectResponse_v053_base=selectResponse;
selectResponse=function(room,client,index,targetSlot=null,providerSlot=null){
  const m=room.match,a=m.pendingAttack,p=m.players[client.seat],card=p.hand[n(index,-1)],slot=a?.slots?.[a?.index];
  if(card?.card_id!==V053_HOLY_BARRIER)return selectResponse_v053_base(room,client,index,targetSlot);
  const providers=v053HolyBarrierProviderSlots(p,a,slot);if(!providers.length)throw new Error('No legal Priest or Saint can provide Holy Barrier for this Hero.');
  const chosen=providers.includes(String(providerSlot||''))?String(providerSlot):providers[0];
  selectResponse_v053_base(room,client,index,targetSlot);a.selected.providerSlot=chosen;addLog(room,`Holy Barrier provider: ${p.board[chosen].name} (${chosen}) protects ${slot}.`);
};
const cancelCastingForDefense_v053_base=cancelCastingForDefense;
cancelCastingForDefense=function(room,p,slot,reason){const chosen=room.match.pendingAttack?.selected?.card?.card_id===V053_HOLY_BARRIER?room.match.pendingAttack?.selected?.providerSlot:null;return cancelCastingForDefense_v053_base(room,p,chosen||slot,reason)};
const actionHints_v053_base=actionHints;
actionHints=function(m,seat){const out=actionHints_v053_base(m,seat);if(out.responseFor?.selected&&m.pendingAttack?.selected?.providerSlot)out.responseFor.selected.providerSlot=m.pendingAttack.selected.providerSlot;return out};

// Test helpers for the v0.5.3 parity QA script.
export function qaV053ClassAllowed(cardId,heroId){return classAllowed(MAIN.get(cardId),makeHero(heroId))}
export function qaV053Dynamic(cardId,heroId,field='base_damage'){const c=MAIN.get(cardId);return parseDynamic(c?.[field],makeHero(heroId),0)}
export function qaV053AutoCenterAllowed(mode){return isAutoCenterState({mode,players:{1:{board:{LEFT:makeHero('S1-WAR-H001'),CENTER:null,RIGHT:null}},2:{board:{LEFT:null,CENTER:null,RIGHT:makeHero('S1-CLE-H001')}}}})}
export function qaV053HolyBarrierProviders(mode,providerHeroId,providerSlot='LEFT',receivingHeroId='S1-WAR-H001',receivingSlot='CENTER'){const p={mana:12,board:{LEFT:null,CENTER:null,RIGHT:null}};p.board[providerSlot]=makeHero(providerHeroId);if(providerSlot!==receivingSlot)p.board[receivingSlot]=makeHero(receivingHeroId);return v053HolyBarrierProviderSlots(p,{mode,attackType:'PHYSICAL',aoe:false},receivingSlot)}
export function qaV053PoisonTickValue(aoe=false){return aoe?20:10}
export function qaV053PoisonEndTick(aoe=false,duration=1){
  const room=createRoom('qa-poison'),poisoned=makeHero('S1-WAR-H001'),ally=makeHero('S1-CLE-H001'),enemy=makeHero('S1-MAG-H001');
  poisoned.status.Poison=duration;poisoned.tmp.poisonTick=aoe?20:10;
  const p1={seat:1,board:{LEFT:poisoned,CENTER:ally,RIGHT:null},casting:[],discard:[],dualCasting:null};
  const p2={seat:2,board:{LEFT:enemy,CENTER:null,RIGHT:null},casting:[],discard:[],dualCasting:null};
  room.match={status:'active',mode:'MAIN',players:{1:p1,2:p2},legacyQueue:[],pendingChoice:null};cleanupEnd(room,p1);
  return{hp:hp(poisoned),duration:n(poisoned.status.Poison),tick:aoe?20:10,log:room.logs.map(x=>x.message)};
}
export function qaV053SelectHolyBarrier(providerHeroId='S1-CLE-H002',providerSlot='LEFT',receivingSlot='CENTER',mode='MAIN'){
  const room=createRoom('qa-barrier'),p1={seat:1,mana:10,hand:[clone(MAIN.get(V053_HOLY_BARRIER))],discard:[],casting:[],board:{LEFT:null,CENTER:null,RIGHT:null}},p2={seat:2,mana:10,hand:[],discard:[],casting:[],board:{LEFT:makeHero('S1-WAR-H001'),CENTER:null,RIGHT:null}};
  p1.board[providerSlot]=makeHero(providerHeroId);if(providerSlot!==receivingSlot)p1.board[receivingSlot]=makeHero('S1-WAR-H001');
  room.match={status:'active',mode,players:{1:p1,2:p2},cardNotices:[],pendingAttack:{targetSeat:1,sourceSeat:2,slots:[receivingSlot],index:0,selected:null,attackType:'PHYSICAL',aoe:false,unblockable:false,fromCasting:false,mode}};
  selectResponse(room,{seat:1},0,null,providerSlot);return{providerSlot:room.match.pendingAttack.selected.providerSlot,mana:p1.mana,hand:p1.hand.length,log:room.logs.map(x=>x.message)};
}
// ============================================================================


// ============================================================================
// v0.5.6 PROTOTYPE HOTFIX — resource-cap guards + allied Item targets
// - Forged Alliance cannot be played while the shared Racial Token pool is full.
// - Mana-gain cards cannot be played while the shared Mana pool is full.
// - Elf Ancestral Focus and Statue of the Lightbringer also refuse wasteful use at full Mana.
// - Proactive Items that target an allied Hero may be used by a separate legal Hero user,
//   allowing a Stunned receiving Hero to be healed by another Hero.
// - Ring of Grace is applied centrally inside healHero(), so Holy Slash and all healing
//   sources receive the +20 bonus consistently.
// ============================================================================
const V056_MANA_CAP=12;
const V056_RACIAL_CAP=2;
function v056CardGainsMana(card){return n(card?.mana_gain)>0||(SCRIPTS.get(card?.card_id)?.steps||[]).some(st=>st.step_type==='GAIN_MANA_SHARDS'&&n(st.amount)>0)}
function v056CardGainsRacial(card){return card?.card_id==='S1-EVT-008'||/gain\s+\d+\s+racial token/i.test(String(card?.effect_text||''))}
function v056CardResourceBlockReason(p,card){if(!card)return'';if(v056CardGainsRacial(card)&&n(p?.racial)>=V056_RACIAL_CAP)return'Racial Token pool is already full.';if(v056CardGainsMana(card)&&n(p?.mana)>=V056_MANA_CAP)return'Mana pool is already full.';return''}
function v056AssertCardResourceAvailable(p,card){const reason=v056CardResourceBlockReason(p,card);if(reason)throw new Error(`${card.card_name} cannot be used: ${reason}`)}
const resolveGeneric_v056=resolveGeneric;
resolveGeneric=function(room,seat,index,userSlot,targetSeat,targetSlot){const p=room.match.players[seat],card=p.hand[index];v056AssertCardResourceAvailable(p,card);return resolveGeneric_v056(room,seat,index,userSlot,targetSeat,targetSlot)};
const useRacial_v056=useRacial;
useRacial=function(room,client,slot){const p=room.match.players?.[client.seat],h=p?.board?.[slot];if(h?.race==='Elf'&&n(p?.mana)>=V056_MANA_CAP)throw new Error('Ancestral Focus cannot be used: Mana pool is already full.');return useRacial_v056(room,client,slot)};
const useLegacy_v056=useLegacy;
useLegacy=function(room,client,slot){const p=room.match.players?.[client.seat],h=p?.board?.[slot];if(h?.id==='S1-WAR-L002'&&n(p?.mana)>=V056_MANA_CAP)throw new Error('Statue of the Lightbringer cannot be used: Mana pool is already full.');return useLegacy_v056(room,client,slot)};
const actionHints_v056=actionHints;
actionHints=function(m,seat){const out=actionHints_v056(m,seat);if(!out||m.status!=='active'||m.coinFlip?.pending||m.coinFlip?.awaitingConfirmation)return out;const p=m.players?.[seat];if(!p)return out;const allowed=new Set((out.playableCardIndexes||[]).filter(index=>!v056CardResourceBlockReason(p,p.hand?.[index])));out.playableCardIndexes=[...allowed];out.playableUsersByCard=Object.fromEntries(Object.entries(out.playableUsersByCard||{}).filter(([index])=>allowed.has(Number(index))));out.racialSlots=LANES.filter(slot=>{const h=p.board?.[slot];return alive(h)&&!h.status?.Stun&&!h.racialUsed&&!p.racialUsedTurn&&n(p.racial)>0&&(h.race==='Human'||(h.race==='Elf'&&n(p.mana)<V056_MANA_CAP))});out.legacySlots=(out.legacySlots||[]).filter(slot=>{const h=p.board?.[slot];return !(h?.id==='S1-WAR-L002'&&n(p.mana)>=V056_MANA_CAP)});return out};

// Targeted QA helpers for the v0.5.6 hotfix.
export function qaV056ResourceBlock(cardId,{mana=0,racial=0}={}){return v056CardResourceBlockReason({mana,racial},MAIN.get(cardId))}


// v0.5.7 PROTOTYPE — attack target hint parity
function v057HasAttackTarget(m,seat,userSlot,card){if(card?.card_subtype!=='ATK')return true;const info=cardAttackInfo(card,m.players?.[seat]?.board?.[userSlot]);if(info.aoe)return access(m.mode,userSlot).some(slot=>alive(m.players?.[opponent(seat)]?.board?.[slot]));return attackTargets(m,seat,userSlot).length>0}
const actionHints_v057=actionHints;actionHints=function(m,seat){const out=actionHints_v057(m,seat);if(!out||m.status!=='active'||m.coinFlip?.pending||m.coinFlip?.awaitingConfirmation)return out;const p=m.players?.[seat];if(!p)return out;const mapped={...(out.playableUsersByCard||{})};for(const index of out.playableCardIndexes||[]){const card=p.hand?.[index];mapped[String(index)]=(mapped[String(index)]||[]).filter(slot=>v057HasAttackTarget(m,seat,slot,card))}out.playableCardIndexes=(out.playableCardIndexes||[]).filter(index=>(mapped[String(index)]||[]).length>0);out.playableUsersByCard=Object.fromEntries(out.playableCardIndexes.map(index=>[String(index),mapped[String(index)]||[]]));return out};
export function qaV057AttackTargetHints(protectedTarget=false){const user=makeHero('S1-WAR-H005'),target=makeHero('S1-WAR-H001'),card=clone(MAIN.get('S1-WAR-024'));if(protectedTarget)target.tmp.attackUntargetable=true;const p1={seat:1,hand:[card],mana:12,racial:2,board:{LEFT:user,CENTER:null,RIGHT:null}},p2={seat:2,hand:[],mana:12,racial:2,board:{LEFT:target,CENTER:null,RIGHT:null}},m={status:'active',mode:'MAIN',activeSeat:1,phase:'Battle Phase',players:{1:p1,2:p2},pendingAttack:null,pendingChoice:null,coinFlip:{pending:false,awaitingConfirmation:false},openingProtection:{active:false}};const h=actionHints(m,1);return{playable:h.playableCardIndexes.includes(0),users:h.playableUsersByCard?.['0']||[],targets:attackTargets(m,1,'LEFT')}}


// v0.5.9 targeted QA helpers — resource visuals and Ice Block self-Freeze.
export function qaV059IceBlockSelfFreeze(){
  const h=makeHero('S1-MAG-H002'),room={seq:0,logs:[],match:{players:{1:{board:{LEFT:h,CENTER:null,RIGHT:null},discard:[]},2:{board:{LEFT:null,CENTER:null,RIGHT:null},discard:[]}}}},card=clone(MAIN.get('S1-MAG-011'));
  const a={targetSeat:1,sourceSeat:2,userSlot:'LEFT',targetSlot:'LEFT',damage:50,globalBlock:0,selected:{card,cost:n(card.mana_cost),index:0},statuses:[]};
  const r=resolveResponseMath(room,a,'LEFT');
  return{freeze:n(h.status.Freeze),avoid:r.avoid,discard:room.match.players[1].discard.map(x=>x.card_name),logs:room.logs.map(x=>x.message||x)};
}
export function qaV059ForgedAllianceGain(){
  const h=makeHero('S1-WAR-H001'),room={seq:0,logs:[],match:{phase:'Deploy Phase',players:{1:{mana:12,racial:0,board:{LEFT:h,CENTER:null,RIGHT:null}},2:{board:{LEFT:null,CENTER:null,RIGHT:null}}}}},card=clone(MAIN.get('S1-EVT-008'));
  executeNonAttackCard(room,1,card,'LEFT',1,'LEFT',SCRIPTS.get(card.card_id));
  return{racial:room.match.players[1].racial,fullBlock:qaV056ResourceBlock('S1-EVT-008',{racial:2})};
}


// ============================================================================
// v0.6.0 RC BUNDLE — setup refresh, userless revival hints, self-use Items,
// Legacy stack inspection metadata, and Legacy Required Choice detail parity.
// ============================================================================
const publicHero_v060=publicHero;
publicHero=function(h){
 const x=publicHero_v060(h);if(!x)return x;
 const stack=h.defeatedStack||[],heroId=stack[stack.length-1],meta=HERO[heroId];
 x.lastDefeatedHero=meta?{id:meta.id,name:meta.name,race:meta.race,class:meta.class,rank:meta.rank}:null;
 return x
};
const publicCard_v060=publicCard;
publicCard=function(c,index){
 const x=publicCard_v060(c,index),meta=LEGACY[c?.card_id]||null;
 if(meta){x.card_type=x.card_type||'Legacy';x.card_subtype=x.card_subtype||'Legacy';x.effect_text=x.effect_text||meta.effect_text||meta.effect_description||'';x.timing=x.timing||meta.timing||meta.usage_phase||'';x.local_thumbnail_path=x.local_thumbnail_path||meta.local_thumbnail_path||'';x.image_url=x.image_url||meta.image_url||meta.artwork_url||'';x.thumbnail_url=x.thumbnail_url||meta.thumbnail_url||x.image_url||''}
 return x
};
function v060LegacyStackTop(p,slot){const h=p?.board?.[slot],stack=h?.legacy?(h.defeatedStack||[]):[],id=stack[stack.length-1],meta=HERO[id];return meta?{slot,id,meta}:null}
function v060DirectLegacyTargets(p,card){
 if(card?.card_name==='Phoenix Feather')return LANES.filter(slot=>!!v060LegacyStackTop(p,slot));
 if(card?.card_name==='Final Grit')return LANES.filter(slot=>{const top=v060LegacyStackTop(p,slot);return !!(top&&['Gladiator','Conqueror'].includes(top.meta.class)&&!p.finalGritUsedHeroes?.[top.id])});
 return []
}
const actionHints_v060=actionHints;
actionHints=function(m,seat){
 const out=actionHints_v060(m,seat);if(!out||m.status!=='active'||m.coinFlip?.pending||m.coinFlip?.awaitingConfirmation)return out;
 const p=m.players?.[seat];if(!p)return out;
 const active=m.activeSeat===seat&&!m.pendingAttack&&!m.pendingChoice,allowed=new Set(out.playableCardIndexes||[]),direct={...(out.directLegacyTargetsByCard||{})};
 for(const [index,card] of (p.hand||[]).entries()){
  if(!['Final Grit','Phoenix Feather'].includes(card.card_name))continue;
  const targets=v060DirectLegacyTargets(p,card);direct[String(index)]=targets;
  const legal=active&&n(p.mana)>=n(card.mana_cost)&&targets.length>0&&(card.card_name==='Final Grit'?m.phase==='Deploy Phase':timingAllows(card,m.phase));
  if(legal)allowed.add(index);else allowed.delete(index)
 }
 out.directLegacyTargetsByCard=direct;out.playableCardIndexes=[...allowed].sort((a,b)=>a-b);
 return out
};
function v060ProactiveSelfItem(card){return !!(card&&card.card_type==='Item'&&card.card_subtype!=='DEF'&&card.card_name!=='Phoenix Feather'&&card.card_id!=='S1-ITM-017')}
const playCard_v060=playCard;
playCard=function(room,client,args={}){
 const p=room.match?.players?.[client.seat],card=p?.hand?.[n(args.index,-1)];
 if(v060ProactiveSelfItem(card)){const slot=args.targetSlot||args.userSlot;if(!slot)throw new Error('Choose the Hero that uses this Item on itself.');return playCard_v060(room,client,{...args,userSlot:slot,targetSlot:slot})}
 return playCard_v060(room,client,args)
};

// Targeted QA helpers for v0.6.0.
export function qaV060DirectLegacyTargets(heroId='S1-WAR-H002',cardName='Final Grit'){const p={board:{LEFT:{legacy:true,defeatedStack:[heroId]},CENTER:null,RIGHT:null},finalGritUsedHeroes:{}};return v060DirectLegacyTargets(p,{card_name:cardName})}
export function qaV060LegacyPublicCard(id='S1-CLE-L002'){return publicCard({card_id:id,card_name:LEGACY[id]?.name||id,card_type:'Legacy',card_subtype:'Legacy'},0)}
export function qaV060LastDefeatedHero(heroId='S1-WAR-H002'){return publicHero({id:'S1-WAR-L001',name:'Warrior Relic',race:'',class:'',baseFamily:'Warrior',rank:'',image_url:'',thumbnail_url:'',maxHp:0,damage:0,exp:0,expCards:[],exhausted:false,status:{},tmp:{},actionZone:null,legacy:true,legacyUsed:false,racialUsed:false,abilityUsed:false,defeatedStack:[heroId]}).lastDefeatedHero}
export function qaV060SelfItem(cardId='S1-ITM-010',heroId='S1-MAG-H001'){return v060ProactiveSelfItem(MAIN.get(cardId))&&classAllowed(MAIN.get(cardId),makeHero(heroId))}


// Additional executable v0.6.0 QA fixture helpers.
function v060QaLegacy(slotHeroId='S1-WAR-H002'){return{id:'S1-WAR-L001',name:"Warrior's Relic",race:'',class:'',baseFamily:'Warrior',rank:'',image_url:'',thumbnail_url:'',local_thumbnail_path:'',maxHp:0,damage:0,exp:0,expCards:[],exhausted:false,status:{},tmp:{},actionZone:null,legacy:true,legacyUsed:false,racialUsed:false,abilityUsed:false,defeatedStack:[slotHeroId],attachments:[]}}
function v060QaPlayer(hand=[],board={}){return{seat:1,name:'QA',deckName:'QA',deck:[],hand,discard:[],side:[],mana:12,regen:1,racial:2,racialUsedTurn:false,board:{LEFT:null,CENTER:null,RIGHT:null,...board},casting:[],tributeUsed:0,rankUsed:0,dualCasting:null,finalGritUsedHeroes:{},stonebloodUsedHeroes:{}}}
function v060QaMatch(p1,p2){return{status:'active',mode:'MAIN',round:1,turnNumber:1,activeSeat:1,phase:'Deploy Phase',players:{1:p1,2:p2},pendingAttack:null,pendingChoice:null,legacyQueue:[],winner:null,coinFlip:{pending:false,awaitingConfirmation:false},openingProtection:{active:false,seat:null},cardNotices:[]}}
export function qaV060FinalGritHint(){const p1=v060QaPlayer([clone(MAIN.get('S1-WAR-014'))],{LEFT:v060QaLegacy('S1-WAR-H002'),CENTER:makeHero('S1-CLE-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),h=actionHints(v060QaMatch(p1,p2),1);return{playable:h.playableCardIndexes.includes(0),targets:h.directLegacyTargetsByCard?.['0']||[],users:h.playableUsersByCard?.['0']||[]}}
export function qaV060FinalGritRevive(){const p1=v060QaPlayer([clone(MAIN.get('S1-WAR-014'))],{LEFT:v060QaLegacy('S1-WAR-H002'),CENTER:makeHero('S1-CLE-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v060-final-grit',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};playCard(room,{seat:1},{index:0,targetSlot:'LEFT'});const h=p1.board.LEFT;return{id:h.id,class:h.class,hp:hp(h),exhausted:h.exhausted,hand:p1.hand.length,discard:p1.discard.map(x=>x.card_name),legacyDeck:p1.side.map(x=>x.card_name),used:!!p1.finalGritUsedHeroes[h.id],logs:room.logs.map(x=>x.message)}}
export function qaV060HealthPotionSelfUse(){const target=makeHero('S1-WAR-H001'),other=makeHero('S1-MAG-H001');target.damage=40;other.damage=30;const p1=v060QaPlayer([clone(MAIN.get('S1-ITM-001'))],{LEFT:target,CENTER:other}),p2=v060QaPlayer([],{CENTER:makeHero('S1-CLE-H001')}),room={id:'qa-v060-item-self',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};playCard(room,{seat:1},{index:0,userSlot:'CENTER',targetSlot:'LEFT'});return{leftHp:hp(target),centerHp:hp(other),hand:p1.hand.length,discard:p1.discard.map(x=>x.card_name),logs:room.logs.map(x=>x.message)}}


// ============================================================================
// v0.6.1 RC BUNDLE — clickable Attachment Slot preview payload parity.
// ============================================================================
export function qaV061AttachmentPreviewPayload(){
 const h=makeHero('S1-MAG-H002'),card=clone(MAIN.get('S1-MAG-007'));
 h.attachments=[{kind:'CASTING',name:card.card_name,cardId:card.card_id,card,targetSlot:'RIGHT',activated:true}];
 const out=publicHero(h).attachments[0];
 return{kind:out.kind,name:out.name,cardId:out.cardId,targetSlot:out.targetSlot,card_name:out.card?.card_name||'',effect_text:out.card?.effect_text||'',local_thumbnail_path:out.card?.local_thumbnail_path||''}
}


// v0.6.2 targeted QA helper — printed Stoneblood once-per-same-Hero match restriction.
export function qaV062StonebloodOncePerSameHero(){
  const first=makeHero('S1-CLE-H004'),different=makeHero('S1-CLE-H004'),support=makeHero('S1-WAR-H001');
  first.packageId='PKG-QA-STONEBLOOD-A';different.packageId='PKG-QA-STONEBLOOD-B';
  const p=v060QaPlayer([],{LEFT:first,CENTER:support,RIGHT:different}),enemy=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v062-stoneblood',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p,enemy)};
  room.match.phase='Battle Phase';first.damage=first.maxHp;defeat(room,1,'LEFT');const firstWindow=room.match.pendingChoice?.type||null;resolveChoice(room,{seat:1},0);
  const firstResult={hp:hp(first),exhausted:first.exhausted,used:v052StonebloodWasUsed(p,first),racial:p.racial};
  p.racialUsedTurn=false;first.racialUsed=false;different.racialUsed=false;room.match.pendingChoice=null;room.match.legacyQueue=[];
  first.damage=first.maxHp;defeat(room,1,'LEFT');const sameHeroLaterWindow=room.match.pendingChoice?.type||null;
  room.match.pendingChoice=null;room.match.legacyQueue=[];different.damage=different.maxHp;defeat(room,1,'RIGHT');const differentHeroLaterWindow=room.match.pendingChoice?.type||null;
  return{firstWindow,firstResult,sameHeroLaterWindow,differentHeroLaterWindow,usedKey:v052StonebloodKey(first),differentKey:v052StonebloodKey(different)};
}


// ============================================================================
// v0.7.0 RC BUNDLE — Bleed targeted-heal prevalidation parity.
// ============================================================================
const V063_TARGETED_HEAL_IDS=new Set(['S1-ITM-001','S1-ITM-002','S1-CLE-005','S1-CLE-017','S1-CLE-022']);
function v063Bleeding(h){return !!(alive(h)&&n(h?.status?.Bleed)>0)}
function v063DirectTargetHeal(card){return !!card&&V063_TARGETED_HEAL_IDS.has(String(card.card_id||''))}
function v063HealingSlots(m,seat){return LANES.filter(slot=>alive(m.players?.[seat]?.board?.[slot])&&!v063Bleeding(m.players[seat].board[slot]))}

const alliedCardTargets_v063=alliedCardTargets;
alliedCardTargets=function(m,seat,userSlot,card){
 const slots=alliedCardTargets_v063(m,seat,userSlot,card);
 return v063DirectTargetHeal(card)?slots.filter(slot=>!v063Bleeding(m.players?.[seat]?.board?.[slot])):slots
};

const v045UsersForCard_v063=v045UsersForCard;
v045UsersForCard=function(m,seat,card){
 const slots=v045UsersForCard_v063(m,seat,card);
 return v063DirectTargetHeal(card)&&card?.card_type==='Item'?slots.filter(slot=>!v063Bleeding(m.players?.[seat]?.board?.[slot])):slots
};

const actionHints_v063=actionHints;
actionHints=function(m,seat){
 const out=actionHints_v063(m,seat);
 if(!out||m.status!=='active'||m.coinFlip?.pending||m.coinFlip?.awaitingConfirmation)return out;
 const p=m.players?.[seat];if(!p)return out;
 const legalHealing=v063HealingSlots(m,seat),allowed=new Set(out.playableCardIndexes||[]);
 out.abilityTargetsBySlot=Object.fromEntries(LANES.map(slot=>[slot,legalHealing]));
 for(const index of [...allowed]){const card=p.hand?.[index];if(v063DirectTargetHeal(card)&&!legalHealing.length)allowed.delete(index)}
 out.playableCardIndexes=[...allowed].sort((a,b)=>a-b);
 if(out.playableUsersByCard){
  for(const [index,slots] of Object.entries(out.playableUsersByCard)){
   const card=p.hand?.[Number(index)];
   if(v063DirectTargetHeal(card)&&card?.card_type==='Item')out.playableUsersByCard[index]=(slots||[]).filter(slot=>!v063Bleeding(p.board?.[slot]))
  }
 }
 return out
};

const useAbility_v063=useAbility;
useAbility=function(room,client,slot,targetSlot){
 const p=room.match?.players?.[client.seat],target=p?.board?.[targetSlot];
 if(v063Bleeding(target))throw new Error('A Hero affected by Bleed cannot be selected for targeted healing.');
 return useAbility_v063(room,client,slot,targetSlot)
};

export function qaV063BleedTargetValidation(){
 const bleeding=makeHero('S1-WAR-H001'),healthy=makeHero('S1-MAG-H001'),aurex=makeHero('S1-WAR-H005');
 bleeding.damage=40;bleeding.status.Bleed=1;healthy.damage=30;
 const p1=v060QaPlayer([clone(MAIN.get('S1-ITM-001')),clone(MAIN.get('S1-CLE-005'))],{LEFT:bleeding,CENTER:healthy,RIGHT:aurex});
 const p2=v060QaPlayer([],{CENTER:makeHero('S1-CLE-H001')});
 const m=v060QaMatch(p1,p2);m.phase='Deploy Phase';
 const potion=alliedCardTargets(m,1,'LEFT',p1.hand[0]),heal=alliedCardTargets(m,1,'RIGHT',p1.hand[1]),hints=actionHints(m,1);
 const room={id:'qa-v063-bleed',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:m};
 let abilityBlocked='';try{useAbility(room,{seat:1},'RIGHT','LEFT')}catch(e){abilityBlocked=e.message}
 return{potion,heal,abilityTargets:hints.abilityTargetsBySlot?.RIGHT||[],potionUsers:hints.playableUsersByCard?.['0']||[],abilityBlocked,mana:p1.mana,aurexExhausted:aurex.exhausted}
}


// ============================================================================
// S1B1 CSV SOURCE SYNC v2.0.0 LOCKED RULE PATCH
// Version label intentionally remains v0.7.0 RC until official source promotion.
// No S1B2 cards are loaded by this runtime.
// ============================================================================
const V118_DF='S1-EVT-012';
const V118_DC='S1-MAG-018';
const V118_BOD='S1-CLE-024';
const V118_ULTIMATE_LINEAGE={
 'S1-WAR-018':'WAR-CONQUEROR',
 'S1-MAG-018':'MAG-ELEMENTAL-LORD',
 'S1-CLE-018':'CLE-SAINT',
 'S1-CLE-024':'WAR-CRUSADER',
 'S1-THF-018':'THF-RENEGADE'
};
function v118HeroLineageId(h){const row=HERO[h?.id]||{};let line=String(row.ultimate_tribute_lineage_id||row.fixed_class_lineage_id||'');if(line==='THF-ROGUE-RENEGADE'||line==='THIEF-ROGUE-RENEGADE')line='THF-RENEGADE';return line}
function v118IsUltimate(card){return String(card?.is_ultimate||'').toUpperCase()==='TRUE'}
function v118UltimateCost(card,h){const base=n(card?.mana_cost);return v118IsUltimate(card)&&String(card?.ultimate_rank2_class||'')===String(h?.class||'')?base+n(card?.ultimate_rank2_extra_mana):base}
function v118ReactiveEventUserSlot(p){return LANES.find(slot=>alive(p.board?.[slot])&&!p.board[slot].exhausted&&!p.board[slot].actionZone&&!p.board[slot].status?.Stun)||null}
function v118FormationReduction(p){return new Set(LANES.filter(l=>alive(p.board?.[l])).map(l=>p.board[l].baseFamily)).size===3?40:20}
function v118LegalSingleTargetAttack(card){return !!card&&card.card_subtype==='ATK'&&!String(card.target_type||'').toLowerCase().includes('area')&&!n(card.casting_time)}

// Statuses still apply through Blessing of Divinity. Only damage is prevented.
statusApply=function(h,name,duration,meta={}){duration=n(duration);if(!name||duration<=0||h?.tmp?.unbrokenStandStatusImmune)return false;if(name==='Curse')h.status.Curse=Math.min(5,n(h.status.Curse)+duration);else h.status[name]=n(h.status[name])+duration;if(name==='Poison'){h.tmp=h.tmp||{};h.tmp.poisonTick=Math.max(n(h.tmp.poisonTick),n(meta?.poisonTick,10))}return true};

// Poison duration still decreases when Blessing of Divinity prevents the tick.
cleanupEnd=function(room,p){
 for(const [slot,h] of Object.entries(p.board||{}))if(alive(h)&&n(h.status?.Poison)>0){const tick=n(h.tmp?.poisonTick,10),before=hp(h);if(h.tmp?.divinityImmune)addLog(room,`POISON TICK PREVENTED: Blessing of Divinity prevents ${tick} damage to ${h.name}; Poison duration still decreases normally.`);else{h.damage=Math.min(h.maxHp,h.damage+tick);addLog(room,`POISON TICK: ${h.name} takes ${tick} damage at owner End Phase (HP ${before} -> ${hp(h)}).`);if(hp(h)<=0)defeat(room,p.seat,slot)}}
 cleanupEnd_v053_base(room,p);
 for(const h of Object.values(p.board||{}))if(h?.tmp&&!n(h.status?.Poison))delete h.tmp.poisonTick;
 if(room.match.status==='active')openNextLegacyChoice(room);if(room.match.status==='active')checkWin(room)
};

// Execute is a targeted defeat effect, not damage. Blessing prevents damage only.
applyRecordedHit=function(room,a,r){const p=room.match.players[a.targetSeat],h=p.board[r.slot];if(!alive(h))return;if(r.avoid){addLog(room,`${a.card.card_name} is avoided for Player ${a.targetSeat} ${r.slot} / ${h.name}.`);return}if(a.execute){const before=hp(h);if(before<=h.maxHp/2){h.damage=h.maxHp;addLog(room,`Execute defeats Player ${a.targetSeat} ${r.slot} / ${h.name} because current HP ${before} is half or less of Max HP ${h.maxHp}.`);defeat(room,a.targetSeat,r.slot)}else addLog(room,`Execute fails to defeat ${h.name}: current HP ${before} is above half of Max HP ${h.maxHp}.`);return}let dmg=r.fixedFinal||reduceByPassive(h,r.dmg,a.attackType);if(h.tmp?.divinityImmune){addLog(room,`${a.card.card_name} damage is prevented by Blessing of Divinity on ${h.name}.`);dmg=0}else if(!r.fixedFinal&&dmg>0&&h.status.Burn){const source=room.match.players[a.sourceSeat].board[a.userSlot],bonus=enhancedBurnTrigger(source)?20:10;dmg+=bonus;addLog(room,`Burn adds +${bonus} damage to ${h.name}${bonus===20?' through Fire Elemental Mastery':''}.`)}const before=hp(h);h.damage=Math.min(h.maxHp,h.damage+dmg);addLog(room,`${a.card.card_name} total incoming damage: ${dmg} to Player ${a.targetSeat} ${r.slot} / ${h.name} (HP ${before} -> ${hp(h)}).`);const dealt=Math.min(before,dmg);if(a.card.card_name==='Holy Slash'&&dealt>0){const source=room.match.players[a.sourceSeat].board[a.userSlot];healHero(room,source,source,20,'Holy Slash')}if(r.statusApplies)for(const st of a.statuses){if(statusApply(h,st.status,st.duration,st))addLog(room,`${h.name} receives ${st.status} for ${st.duration} turn(s).`)}if(hp(h)<=0)defeat(room,a.targetSeat,r.slot)};

// Ultimate Tribute: no Racial Token payment; enforce fixed Class Lineage.
tribute=function(room,client,index,slot){const m=assertActive(room,client);if(m.phase!=='Reform Phase')throw new Error('Tribute is available during Reform Phase.');const p=m.players[client.seat],h=p.board[slot],card=p.hand[n(index,-1)];if(p.tributeUsed>=1)throw new Error('Normal Tribute limit is 1 per Reform Phase.');if(!alive(h)||!card||card.card_type!=='Skill')throw new Error('Choose a Skill Card and an active hero.');if(rankNum(h.rank)>=3)throw new Error('Max-rank Hero cannot receive normal Tribute.');const need=V118_ULTIMATE_LINEAGE[String(card.card_id||'')];if(need&&v118HeroLineageId(h)!==need)throw new Error(`${card.card_name} may only be Tributed to a Hero in its Class Lineage.`);p.hand.splice(n(index),1);h.expCards.push(card);h.exp+=n(card.exp_value,100);p.tributeUsed++;addLog(room,`Player ${client.seat} Tributes ${card.card_name} to ${h.name} for ${n(card.exp_value,100)} EXP.`);tryRank(room,client.seat,slot)};

// Defensive Formation: one reactive global Area reduction per Area Attack.
const defLegal_v118=defLegal;
defLegal=function(p,card,a,currentSlot){if(card?.card_id!==V118_DF)return defLegal_v118(p,card,a,currentSlot);return !!(a?.aoe&&!a.v118FormationUsed&&p.mana>=n(card.mana_cost)&&v118ReactiveEventUserSlot(p))};
const selectResponse_v118=selectResponse;
selectResponse=function(room,client,index,targetSlot=null,providerSlot=null){const m=room.match,a=m.pendingAttack,p=m.players?.[client.seat],card=p?.hand?.[n(index,-1)];if(card?.card_id!==V118_DF)return selectResponse_v118(room,client,index,targetSlot,providerSlot);if(!a||a.targetSeat!==client.seat||a.selected)throw new Error('No open Area response is waiting for Defensive Formation.');if(!defLegal(p,card,a,a.slots[a.index]))throw new Error('Defensive Formation is not legal for this Area Attack.');const userSlot=v118ReactiveEventUserSlot(p),user=p.board[userSlot],cost=n(card.mana_cost),amount=v118FormationReduction(p);p.mana-=cost;p.hand.splice(n(index),1);user.exhausted=true;a.v118FormationUsed=true;a.selected={card,cost,index,special:'V118_DEFENSIVE_FORMATION',amount,userSlot};announceCardUse(room,client.seat,card,`${user.name} declares Defensive Formation: reduce this Area Attack by ${amount}.`);addLog(room,`${user.name} becomes Exhausted for Defensive Formation. This Area Attack receives -${amount} damage.`)};
const cancelResponse_v118=cancelResponse;
cancelResponse=function(room,client){const a=room.match.pendingAttack,s=a?.selected;if(s?.special!=='V118_DEFENSIVE_FORMATION')return cancelResponse_v118(room,client);const p=room.match.players[client.seat];p.mana+=s.cost;p.hand.splice(Math.min(s.index,p.hand.length),0,s.card);if(p.board[s.userSlot])p.board[s.userSlot].exhausted=false;a.v118FormationUsed=false;a.selected=null;addLog(room,'Player cancels the selected Defensive Formation response before resolution.')};
const resolveResponseMath_v118=resolveResponseMath;
resolveResponseMath=function(room,a,slot){if(a?.selected?.special!=='V118_DEFENSIVE_FORMATION')return resolveResponseMath_v118(room,a,slot);const p=room.match.players[a.targetSeat],amount=n(a.selected.amount),dmg=Math.max(0,n(a.damage)-amount);p.discard.push(a.selected.card);a.globalBlock=amount;addLog(room,`Defensive Formation resolves: this Area Attack is reduced by ${amount} for every affected Hero.`);return{slot,dmg,avoid:false,negate:false,returnAttack:false,statusApplies:true,fixedFinal:0,redirectTarget:null}};
const legalResponseList_v118=legalResponseList;
legalResponseList=function(m,seat){const out=legalResponseList_v118(m,seat);const a=m.pendingAttack,p=m.players?.[seat];if(a?.targetSeat===seat&&a.aoe&&!a.v118FormationUsed){for(const [index,card] of (p?.hand||[]).entries())if(card.card_id===V118_DF&&defLegal(p,card,a,a.slots[a.index]))out.push(publicCard(card,index))}return out};

// Blessing of Divinity: proactive Ultimate DEF; damage immunity only, statuses remain legal.
function v118UseDivinity(room,seat,index,userSlot){const m=room.match,p=m.players[seat],card=p.hand[index],user=p.board[userSlot];if(!['Deploy Phase','Reform Phase'].includes(m.phase))throw new Error('Blessing of Divinity is used during Deploy or Reform Phase.');if(!card||card.card_id!==V118_BOD||!canUser(card,user)||!['Paladin','Crusader'].includes(user.class))throw new Error('Choose an eligible Paladin or Crusader.');const cost=v118UltimateCost(card,user);if(p.mana<cost)throw new Error(`Not enough mana. Blessing of Divinity costs ${cost} for ${user.class}.`);p.mana-=cost;p.hand.splice(index,1);p.discard.push(card);user.exhausted=true;for(const h of Object.values(p.board||{})){if(!alive(h))continue;h.tmp.divinityImmune=true;h.tmp.divinityImmuneExpiresAtStartOf=seat;if(user.class==='Crusader')healHero(room,user,h,20,'Blessing of Divinity')}announceCardUse(room,seat,card,`${user.name} uses Blessing of Divinity. Allied Heroes cannot take damage until the start of Player ${seat} next turn.`);addLog(room,`Blessing of Divinity grants allied damage immunity${user.class==='Crusader'?' and heals each allied Hero by 20':''}. Negative statuses may still be applied and their duration decreases normally.`)}

// Double Casting: activate in Deploy without Exhaust. Pay one follow-up ST Attack once; duplicate that same attack.
isDualLegalAttack=function(card){return v118LegalSingleTargetAttack(card)}
armDualCasting=function(room,seat,index,userSlot){const m=room.match,p=m.players[seat],card=p.hand[index],h=p.board[userSlot];if(m.phase!=='Deploy Phase')throw new Error('Double Casting is activated during Deploy Phase.');if(!card||card.card_id!==V118_DC||!canUser(card,h)||!['Elementalist','Elemental Lord'].includes(h.class))throw new Error('Choose an eligible Elementalist or Elemental Lord.');if(!p.hand.some((c,i)=>i!==index&&v118LegalSingleTargetAttack(c)))throw new Error('Double Casting requires a legal non-Casting Single Target Attack Skill in hand.');const cost=v118UltimateCost(card,h);if(p.mana<cost)throw new Error(`Not enough mana. Double Casting costs ${cost} for ${h.class}.`);p.mana-=cost;p.hand.splice(index,1);p.discard.push(card);p.dualCasting={userSlot,rank3:h.class==='Elemental Lord',active:false,copiedCard:null,firstTargetSlot:null,remainingCopies:0};addLog(room,`${h.name} activates Double Casting for ${cost} mana without becoming Exhausted. The next Single Target Attack Skill this turn will attack twice.`)}
prepareDualCastingBattle=function(room,seat){const p=room.match.players[seat],d=p.dualCasting;if(!d)return;d.active=true;addLog(room,`Double Casting is ready for ${p.board[d.userSlot]?.name||d.userSlot}: choose one legal Single Target Attack Skill.`)}
function v118OpenCopiedAttack(room,seat,targetSlot){const m=room.match,p=m.players[seat],d=p.dualCasting;if(!d?.copiedCard)return;const copied=clone(d.copiedCard);copied.v118DoubleCastingCopy=true;d.remainingCopies--;openAttack(room,seat,copied,d.userSlot,opponent(seat),targetSlot,false)}
continueDualCasting=function(room,seat){const m=room.match,p=m.players[seat],d=p.dualCasting;if(!d||m.pendingAttack||m.pendingChoice)return;if(!d.active)return;if(d.remainingCopies<=0){p.dualCasting=null;addLog(room,'Double Casting sequence complete.');return}if(d.rank3){const targets=attackTargets(m,seat,d.userSlot);if(!targets.length){p.dualCasting=null;addLog(room,'Double Casting copy fails because no legal second target remains.');return}m.pendingChoice={type:'V118_DOUBLE_CASTING_SECOND_TARGET',seat,prompt:'Double Casting: choose the target for the second attack.',options:targets.map(slot=>({slot,card:virtualChoiceCard(`DOUBLE-${slot}`,`${slot} / ${m.players[opponent(seat)].board[slot]?.name||'-'}`,'Choose the second attack target.')}))};return}const t=d.firstTargetSlot;if(!alive(m.players[opponent(seat)].board[t])){p.dualCasting=null;addLog(room,'Double Casting copy fails because the Rank II locked target is no longer active.');return}v118OpenCopiedAttack(room,seat,t)}
const finishAttack_v118=finishAttack;
finishAttack=function(room,a){const copied=!!a?.card?.v118DoubleCastingCopy,source=room.match.players?.[a?.sourceSeat];finishAttack_v118(room,a);if(copied&&source){const i=source.discard.findIndex(c=>c?.v118DoubleCastingCopy);if(i>=0)source.discard.splice(i,1)}};

const resolveChoice_v118=resolveChoice;
resolveChoice=function(room,client,index){const c=room.match.pendingChoice;if(c?.type!=='V118_DOUBLE_CASTING_SECOND_TARGET')return resolveChoice_v118(room,client,index);if(c.seat!==client.seat)throw new Error('This Double Casting choice belongs to the other player.');const opt=c.options[n(index,-1)];if(!opt)throw new Error('Choose a legal second target.');room.match.pendingChoice=null;v118OpenCopiedAttack(room,client.seat,opt.slot)};

const timingAllows_v118=timingAllows;
timingAllows=function(card,phase){if(card?.card_id===V118_DF)return false;if(card?.card_id===V118_DC)return phase==='Deploy Phase';if(card?.card_id===V118_BOD)return ['Deploy Phase','Reform Phase'].includes(phase);return timingAllows_v118(card,phase)};
const resolveGeneric_v118=resolveGeneric;
resolveGeneric=function(room,seat,index,userSlot,targetSeat,targetSlot){const p=room.match.players[seat],card=p.hand[index],user=p.board[userSlot];if(card?.card_id===V118_DC)return armDualCasting(room,seat,index,userSlot);if(p.dualCasting?.active){if(!v118LegalSingleTargetAttack(card)||userSlot!==p.dualCasting.userSlot)throw new Error('Finish Double Casting with one legal Single Target Attack Skill from the armed Hero.');targetSeat=opponent(seat);if(!attackTargets(room.match,seat,userSlot).includes(targetSlot))throw new Error('Choose a legal opponent Hero target.');const cost=n(card.mana_cost);if(p.mana<cost)throw new Error('Not enough mana for the Attack Skill.');p.mana-=cost;p.hand.splice(index,1);user.exhausted=true;p.dualCasting.copiedCard=clone(card);p.dualCasting.firstTargetSlot=targetSlot;p.dualCasting.remainingCopies=1;addLog(room,`${user.name} uses ${card.card_name} once for ${cost} mana. Double Casting creates a second attack from the same Skill Card.`);openAttack(room,seat,card,userSlot,targetSeat,targetSlot,false);return}if(card&&v118IsUltimate(card)){const original=card.mana_cost;card.mana_cost=v118UltimateCost(card,user);try{return resolveGeneric_v118(room,seat,index,userSlot,targetSeat,targetSlot)}finally{card.mana_cost=original}}return resolveGeneric_v118(room,seat,index,userSlot,targetSeat,targetSlot)};
const playCard_v118=playCard;
playCard=function(room,client,args){const p=room.match?.players?.[client.seat],card=p?.hand?.[n(args?.index,-1)];if(card?.card_id===V118_BOD){assertActive(room,client);return v118UseDivinity(room,client.seat,n(args.index),args.userSlot)}return playCard_v118(room,client,args)};

export function qaS1B1LockedSyncSummary(){return{mainPool:MAIN.size,doubleCasting:MAIN.get(V118_DC)?.card_name,tributeRule:MAIN.get(V118_DC)?.ultimate_tribute_rule,defensiveFormation:MAIN.get(V118_DF)?.full_description,blessing:MAIN.get(V118_BOD)?.full_description}}
export function qaS1B1UltimateTribute(){const p1=v060QaPlayer([clone(MAIN.get('S1-WAR-018'))],{LEFT:makeHero('S1-WAR-H001'),CENTER:makeHero('S1-WAR-H004')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v118-tribute',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Reform Phase';const before=p1.racial;tribute(room,{seat:1},0,'LEFT');return{racialBefore:before,racialAfter:p1.racial,exp:p1.board.LEFT.exp,logs:room.logs.map(x=>x.message)}}
export function qaS1B1UltimateWrongLineage(){const p1=v060QaPlayer([clone(MAIN.get('S1-WAR-018'))],{LEFT:makeHero('S1-WAR-H004')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v118-tribute-bad',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Reform Phase';let error='';try{tribute(room,{seat:1},0,'LEFT')}catch(e){error=e.message}return{error,racial:p1.racial,hand:p1.hand.length}}
export function qaS1B1DefensiveFormation(){const p1=v060QaPlayer([clone(MAIN.get(V118_DF))],{LEFT:makeHero('S1-WAR-H001'),CENTER:makeHero('S1-MAG-H001'),RIGHT:makeHero('S1-CLE-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v118-df',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';room.match.pendingAttack={sourceSeat:2,targetSeat:1,card:clone(MAIN.get('S1-WAR-008')),userSlot:'CENTER',damage:50,attackType:'PHYSICAL',aoe:true,slots:['LEFT','CENTER','RIGHT'],index:0,results:{},selected:null,statuses:[],fromCasting:false,unblockable:false};selectResponse(room,{seat:1},0);resolveResponse(room,{seat:1});return{globalBlock:room.match.pendingAttack?.globalBlock||40,firstResult:room.match.pendingAttack?.results?.LEFT||null,mana:p1.mana,discard:p1.discard.map(c=>c.card_name),exhausted:p1.board.LEFT.exhausted||p1.board.CENTER.exhausted||p1.board.RIGHT.exhausted,logs:room.logs.map(x=>x.message)}}
export function qaS1B1BlessingStatusDuration(){const p1=v060QaPlayer([clone(MAIN.get(V118_BOD))],{LEFT:makeHero('S1-WAR-H005'),CENTER:makeHero('S1-WAR-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v118-bod',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Deploy Phase';playCard(room,{seat:1},{index:0,userSlot:'LEFT'});const target=p1.board.CENTER;statusApply(target,'Poison',1,{poisonTick:10});const hp0=hp(target);cleanupEnd(room,p1);return{hpBefore:hp0,hpAfter:hp(target),poison:n(target.status.Poison),immune:!!target.tmp.divinityImmune,logs:room.logs.map(x=>x.message)}}
export function qaS1B1DoubleCasting(){const p1=v060QaPlayer([clone(MAIN.get(V118_DC)),clone(MAIN.get('S1-MAG-001'))],{LEFT:makeHero('S1-MAG-H002')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')}),room={id:'qa-v118-dc',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Deploy Phase';playCard(room,{seat:1},{index:0,userSlot:'LEFT'});room.match.phase='Battle Phase';prepareDualCastingBattle(room,1);playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'CENTER'});passResponse(room,{seat:2});passResponse(room,{seat:2});return{mana:p1.mana,hand:p1.hand.length,discard:p1.discard.map(c=>c.card_name),dual:p1.dualCasting,logs:room.logs.map(x=>x.message)}}

// v0.7.0 RC - Relentless Leveling clarity QA.
// Relentless Leveling excludes Ultimate Skill Cards and intentionally does not validate Class Lineage.
export function qaV070RelentlessLeveling(){
  const p1=v060QaPlayer([clone(MAIN.get('S1-EVT-004')),clone(MAIN.get('S1-MAG-001')),clone(MAIN.get('S1-WAR-018'))],{LEFT:makeHero('S1-WAR-H001')});
  const p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')});
  const room={id:'qa-v070-relentless',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};
  room.match.phase='Deploy Phase';
  playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'});
  return {
    type:room.match.pendingChoice?.type||'',
    targetSlot:room.match.pendingChoice?.targetSlot||'',
    options:(room.match.pendingChoice?.options||[]).map(x=>x.card.card_name),
    logs:room.logs.map(x=>x.message)
  };
}


// v0.7.0 RC mandatory automatic Rank Up resolver QA.
export function qaV070MandatoryRankUpNormalTribute(){
  const p1=v060QaPlayer([clone(MAIN.get('S1-MAG-001'))],{LEFT:makeHero('S1-MAG-H001'),CENTER:makeHero('S1-WAR-H001')});
  p1.side=[{card_id:'S1-MAG-H002',card_name:'Vaelis Stormweave',card_type:'Hero',package_id:'PKG-MAG-VAELIS'}];
  p1.board.LEFT.exp=200;p1.board.LEFT.expCards=[clone(MAIN.get('S1-MAG-002')),clone(MAIN.get('S1-MAG-003'))];
  const p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')});
  const room={id:'qa-v070-rank-normal',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};
  room.match.phase='Reform Phase';tribute(room,{seat:1},0,'LEFT');
  return{id:p1.board.LEFT.id,rank:p1.board.LEFT.rank,class:p1.board.LEFT.class,exp:p1.board.LEFT.exp,side:p1.side.map(x=>x.card_id),discard:p1.discard.map(x=>x.card_name),logs:room.logs.map(x=>x.message)};
}
export function qaV070MandatoryRankUpRelentless(){
  const p1=v060QaPlayer([clone(MAIN.get('S1-EVT-004')),clone(MAIN.get('S1-MAG-001'))],{LEFT:makeHero('S1-MAG-H001'),CENTER:makeHero('S1-WAR-H001')});
  p1.side=[{card_id:'S1-MAG-H002',card_name:'Vaelis Stormweave',card_type:'Hero',package_id:'PKG-MAG-VAELIS'}];
  p1.board.LEFT.exp=200;p1.board.LEFT.expCards=[clone(MAIN.get('S1-MAG-002')),clone(MAIN.get('S1-MAG-003'))];
  const p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')});
  const room={id:'qa-v070-rank-relentless',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};
  room.match.phase='Deploy Phase';playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'});resolveChoice(room,{seat:1},0);
  return{id:p1.board.LEFT.id,rank:p1.board.LEFT.rank,class:p1.board.LEFT.class,exp:p1.board.LEFT.exp,side:p1.side.map(x=>x.card_id),discard:p1.discard.map(x=>x.card_name),logs:room.logs.map(x=>x.message)};
}


// v0.8.1 RC authoritative runtime parity QA exports.
export function qaV080UltimateWrongLineageMage(){const p1=v060QaPlayer([clone(MAIN.get('S1-WAR-018'))],{LEFT:makeHero('S1-MAG-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')}),room={id:'qa-v080-tribute-mage',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Reform Phase';let error='';try{tribute(room,{seat:1},0,'LEFT')}catch(e){error=e.message}return{error,hand:p1.hand.length,racial:p1.racial,exp:p1.board.LEFT.exp}}
export function qaV080SourceVisuals(){return{execute:MAIN.get('S1-WAR-018')?.image_url,doubleCasting:MAIN.get('S1-MAG-018')?.image_url,blessing:MAIN.get('S1-CLE-024')?.image_url,defensiveFormation:MAIN.get('S1-EVT-012')?.full_description,targeting:(DATA.targetingRules||[]).find(x=>x.targeting_id==='TGT-030')?.description,deckRule:(DATA.deckRules||[]).find(x=>x.rule_id==='DR-043')?.description}}


// ============================================================================
// v0.8.3 RC — final idle-turn Casting marker sync.
// A multi-turn Casting Hero may use Relentless Leveling only on an idle turn:
// not the declaration turn and not the resolution turn.
const resolveCasting_v083Idle=resolveCasting;
resolveCasting=function(room,seat){const r=resolveCasting_v083Idle(room,seat),m=room.match;for(const e of (m.players[seat].casting||[]))if(n(e.remaining)>0)e.v083IdleTurn=n(m.turnNumber);return r};

// v0.8.3 RC — CSV v2.1.3 Relentless idle multi-turn Casting + Item Exhaust parity QA
function v083QaCastingRoom({remaining=2,declaredTurn=1,turn=1,phase='Deploy Phase',full=false}={}){
 const h=makeHero('S1-MAG-H002'),cast=clone(MAIN.get('S1-MAG-007'));
 h.actionZone='Tornado';h.attachments=[{kind:'CASTING',name:cast.card_name,cardId:cast.card_id,card:cast,activated:true,targetSlot:'CENTER'}];
 if(full)h.attachments.push({kind:'BUFF',name:'Blessing of Wisdom',cardId:'S1-CLE-007',card:clone(MAIN.get('S1-CLE-007')),buffType:'ATK',activated:true});
 const p1=v060QaPlayer([clone(MAIN.get('S1-EVT-004')),clone(MAIN.get('S1-MAG-001'))],{LEFT:h}),p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')});
 p1.casting=[{card:cast,userSlot:'LEFT',slot:'LEFT',targetSeat:2,targetSlot:'CENTER',remaining,declaredTurn}];
 const room={id:'qa-v083-casting',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase=phase;room.match.turnNumber=turn;
 return{room,p1,h}
}
export function qaV083RelentlessCastingDeclarationBlocked(){const {room,p1,h}=v083QaCastingRoom({remaining:2,declaredTurn:1,turn:1});let error='';try{playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'})}catch(e){error=e.message}return{error,hand:p1.hand.length,exhausted:h.exhausted,attachments:h.attachments.length,discard:p1.discard.length}}
export function qaV083RelentlessCastingSecondSlot(){const {room,p1,h}=v083QaCastingRoom({remaining:2,declaredTurn:1,turn:2});playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'});return{type:room.match.pendingChoice?.type||'',options:(room.match.pendingChoice?.options||[]).map(x=>x.card.card_name),exhausted:h.exhausted,attachments:h.attachments.length,actionZone:h.actionZone,discard:p1.discard.map(x=>x.card_name),logs:room.logs.map(x=>x.message)}}
export function qaV083RelentlessCastingIdleReform(){const {room,p1,h}=v083QaCastingRoom({remaining:2,declaredTurn:1,turn:2});resolveCasting(room,1);room.match.phase='Reform Phase';playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'});return{type:room.match.pendingChoice?.type||'',options:(room.match.pendingChoice?.options||[]).map(x=>x.card.card_name),remaining:p1.casting[0]?.remaining,idleTurn:p1.casting[0]?.v083IdleTurn,exhausted:h.exhausted}}
export function qaV083RelentlessCastingResolutionBlocked(){const {room,p1,h}=v083QaCastingRoom({remaining:1,declaredTurn:1,turn:3});p1.casting[0].v083IdleTurn=2;let error='';try{playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'})}catch(e){error=e.message}return{error,hand:p1.hand.length,exhausted:h.exhausted,attachments:h.attachments.length,discard:p1.discard.length}}
export function qaV083RelentlessCastingFullSlots(){const {room,p1,h}=v083QaCastingRoom({remaining:2,declaredTurn:1,turn:2,full:true});let error='';try{playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'})}catch(e){error=e.message}return{error,hand:p1.hand.length,exhausted:h.exhausted,attachments:h.attachments.length,discard:p1.discard.map(x=>x.card_name)}}
export function qaV083ItemNoExhaust(){
 const h=makeHero('S1-MAG-H001');h.exhausted=true;
 const p1=v060QaPlayer([clone(MAIN.get('S1-ITM-006'))],{LEFT:h}),p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')});
 const room={id:'qa-v083-item-no-exhaust',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Deploy Phase';
 playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'});
 return{exhausted:h.exhausted,hand:p1.hand.length,discard:p1.discard.map(x=>x.card_name),revealed:!!p1.tmpRevealOpponentHand,logs:room.logs.map(x=>x.message)}
}
export function qaV083SourceAlignment(){return{version:VERSION,schema:DATA.schema_version,alignment:DATA.alignment,targeting:(DATA.targetingRules||[]).find(x=>x.targeting_id==='TGT-045')?.description||'',execute:(DATA.targetingRules||[]).find(x=>x.targeting_id==='TGT-046')?.description||'',relentless:(MAIN.get('S1-EVT-004')||{}).targeting_override||''}}

// v0.8.3 RC - Execute declaration legality, Relentless idle multi-turn Casting timing, Chain Mail Archer sync.
export function qaV083ExecuteIllegalDeclaration(){const h=makeHero('S1-WAR-H003'),t=makeHero('S1-MAG-H001');const p1=v060QaPlayer([clone(MAIN.get('S1-WAR-018'))],{LEFT:h}),p2=v060QaPlayer([],{CENTER:t}),room={id:'qa-v083-execute-illegal',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';const before={mana:p1.mana,hand:p1.hand.length,exhausted:h.exhausted};let error='';try{playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'CENTER'})}catch(e){error=e.message}return{error,before,after:{mana:p1.mana,hand:p1.hand.length,exhausted:h.exhausted,pending:!!room.match.pendingAttack,discard:p1.discard.length}}}
export function qaV083ExecuteLegalDeclaration(){const h=makeHero('S1-WAR-H003'),t=makeHero('S1-MAG-H001');t.damage=Math.ceil(t.maxHp/2);const p1=v060QaPlayer([clone(MAIN.get('S1-WAR-018'))],{LEFT:h}),p2=v060QaPlayer([],{CENTER:t}),room={id:'qa-v083-execute-legal',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'CENTER'});return{mana:p1.mana,hand:p1.hand.length,exhausted:h.exhausted,pending:!!room.match.pendingAttack}}
export function qaV083ChainMail(){return MAIN.get('S1-ITM-016')}


// ============================================================================
// v0.9.0 RC — S1B1 + S1B2 combined Discord PvP add-on branch.
// S1B1 checkpoint remains external; S1B2 Thief/Rogue/Renegade mechanics are
// integrated here for two-player browser testing.
// ============================================================================
const S1B2_THIEF_CLASSES=new Set(['Thief','Rogue','Renegade']);
function s1b2IsThiefHero(h){return !!h&&S1B2_THIEF_CLASSES.has(String(h.class||''));}
function s1b2PoisonBonus(h){return h?.class==='Renegade'?1:h?.class==='Rogue'?1:0;}
function s1b2PoisonDuration(h,base){return Math.max(1,n(base,1)+s1b2PoisonBonus(h));}
function s1b2IsTacticalSupport(card){return card?.card_type==='Skill'&&['TACTICAL','Tactical','SUPPORT','Support'].includes(String(card.card_subtype||''));}
function s1b2IsS1B2(card){return String(card?.card_id||'').startsWith('S1-THF-');}
function s1b2ThiefOptions(p){return p.hand.map((card,index)=>({index,card})).filter(x=>x.card.card_type==='Skill'&&String(x.card.class_family||'').includes('Thief'));}
function s1b2ItemEventDiscardOptions(p){return p.discard.map((card,index)=>({index,card})).filter(x=>['Item','Event'].includes(x.card.card_type));}

const timingAllows_v090=timingAllows;
timingAllows=function(card,phase){
 if(s1b2IsTacticalSupport(card))return phase==='Deploy Phase';
 return timingAllows_v090(card,phase);
};

const canUser_v090=canUser;
canUser=function(card,h,m=null,seat=null,slot=null){
 if(s1b2IsS1B2(card)&&card.card_type==='Skill'&&card.card_subtype!=='DEF'){
   if(!alive(h)||h.status.Stun||!classAllowed(card,h))return false;
   return !h.exhausted&&!h.actionZone;
 }
 return canUser_v090(card,h,m,seat,slot);
};

const cardAttackInfo_v090=cardAttackInfo;
cardAttackInfo=function(card,h){
 const info=cardAttackInfo_v090(card,h);
 if(s1b2IsS1B2(card)){
   for(const st of info.statuses||[])if(st.status==='Poison')st.duration=s1b2PoisonDuration(h,st.duration);
   if(card.card_id==='S1-THF-014'&&h?.class==='Renegade'&&!info.statuses.some(x=>x.status==='Stun'))info.statuses.push({status:'Stun',duration:1});
 }
 return info;
};

const openAttack_v090=openAttack;
openAttack=function(room,seat,card,userSlot,targetSeat,targetSlot,fromCasting=false){
 const m=room.match,p=m.players[seat],user=p.board[userSlot];
 if(card?.card_id==='S1-THF-015'){
   const t=m.players[targetSeat]?.board?.[targetSlot];
   const bonus=n(t?.status?.Poison)>0?(user?.class==='Renegade'?60:user?.class==='Rogue'?40:0):0;
   card={...card,base_damage:String(20+bonus)};
   if(bonus)addLog(room,`Venom Sovereign gains +${bonus} damage because the target has Poison.`);
 }
 return openAttack_v090(room,seat,card,userSlot,targetSeat,targetSlot,fromCasting);
};

const defLegal_v090=defLegal;
defLegal=function(p,card,a,currentSlot){
 const types=(DEF.get(card?.card_id)||{}).response_types||[];
 if(['S1-THF-009','S1-THF-010'].includes(String(a?.card?.card_id||''))&&types.includes('DODGE'))return false;
 return defLegal_v090(p,card,a,currentSlot);
};

function s1b2OpenPoisonBurst(room,seat,index,userSlot){
 const m=room.match,p=m.players[seat],card=p.hand[index],user=p.board[userSlot],targetSeat=opponent(seat);
 if(m.phase!=='Battle Phase')throw new Error('Venom Detonation is an Attack Skill and is used during Battle Phase.');
 if(!canUser(card,user,m,seat,userSlot))throw new Error('Selected hero cannot use Venom Detonation.');
 const slots=LANES.filter(l=>alive(m.players[targetSeat].board[l])&&n(m.players[targetSeat].board[l].status?.Poison)>0);
 if(!slots.length)throw new Error('Venom Detonation requires at least one opponent Hero with Poison.');
 const cost=n(card.mana_cost);if(p.mana<cost)throw new Error('Not enough mana for Venom Detonation.');
 p.mana-=cost;p.hand.splice(index,1);user.exhausted=true;
 const base=user?.class==='Renegade'?20:10;const damageBySlot=Object.fromEntries(slots.map(l=>[l,base*n(m.players[targetSeat].board[l].status.Poison)]));
 m.pendingAttack={attackId:`${m.turnNumber}-${room.seq+1}-${seat}-${card.card_id}-${userSlot}-POISON`,sourceSeat:seat,targetSeat,card,userSlot,damage:0,damageBySlot,attackType:'MAGICAL',aoe:true,slots,index:0,results:{},selected:null,statuses:[],fromCasting:false,unblockable:false,poisonBurst:true,chainStep:1};
 addLog(room,`${user.name} uses Venom Detonation. Poisoned opponent Heroes open individual Magical Response Windows: ${slots.map(l=>`${l}=${damageBySlot[l]}`).join(', ')}.`);
}

const resolveResponseMath_v090=resolveResponseMath;
resolveResponseMath=function(room,a,slot){
 if(a?.poisonBurst&&a.damageBySlot){const old=a.damage;a.damage=n(a.damageBySlot[slot]);try{return resolveResponseMath_v090(room,a,slot)}finally{a.damage=old}}
 return resolveResponseMath_v090(room,a,slot);
};

const applyRecordedHit_v090=applyRecordedHit;
applyRecordedHit=function(room,a,r){
 const target=room.match.players[a.targetSeat]?.board?.[r.slot];
 const beforePoison=n(target?.status?.Poison);
 applyRecordedHit_v090(room,a,r);
 if(a?.poisonBurst&&target&&beforePoison>0){delete target.status.Poison;if(target.tmp)delete target.tmp.poisonTick;addLog(room,`Venom Detonation removes Poison from ${target.name}.`)}
 const source=room.match.players[a.sourceSeat]?.board?.[a.userSlot];
 if(a?.card?.card_id==='S1-THF-017'&&source?.class==='Renegade'&&!r.avoid){const opp=room.match.players[a.targetSeat];if(n(opp.mana)>0){opp.mana=Math.max(0,n(opp.mana)-1);addLog(room,`Venom Binding discards 1 Mana Shard from Player ${a.targetSeat}.`)}}
};

const playCard_v090=playCard;
playCard=function(room,client,args){
 const p=room.match.players[client.seat],card=p.hand[n(args?.index,-1)];
 if(card?.card_id==='S1-THF-018')return s1b2OpenPoisonBurst(room,client.seat,n(args.index),args.userSlot);
 return playCard_v090(room,client,args);
};

const executeNonAttackCard_v090=executeNonAttackCard;
executeNonAttackCard=function(room,seat,card,userSlot,targetSeat,targetSlot,script){
 const m=room.match,p=m.players[seat],user=p.board[userSlot],opp=m.players[opponent(seat)];
 if(card?.card_id==='S1-THF-004'){
   if(n(opp.mana)<=0)throw new Error('Steal requires the opponent to have at least 1 Mana Shard.');
   opp.mana=Math.max(0,n(opp.mana)-1);p.mana=Math.min(12,n(p.mana)+1);addLog(room,`${user.name} uses Steal: Player ${opponent(seat)} loses 1 Mana and Player ${seat} gains 1 Mana.`);return;
 }
 if(card?.card_id==='S1-THF-005'){
   const options=p.deck.map((c,i)=>({index:i,card:c})).filter(x=>x.card.card_type==='Skill'&&x.card.card_subtype==='DEF');
   if(!options.length)throw new Error('Sixth Sense requires a Defend Skill Card in deck.');
   m.pendingChoice={type:'S1B2_SIXTH_SENSE',seat,options};addLog(room,'Sixth Sense: choose 1 DEF Skill Card from your deck, then shuffle.');return;
 }
 if(card?.card_id==='S1-THF-006'){
   user.tmp.attackUntargetable=true;user.tmp.attackUntargetableExpiresAtStartOf=seat;addLog(room,`${user.name} uses Smoke Screen and cannot be targeted by attacks until the start of Player ${seat}'s next turn.`);return;
 }
 if(card?.card_id==='S1-THF-012'){
   const dur=s1b2PoisonDuration(user,2);for(const l of LANES){const h=opp.board[l];if(alive(h)&&statusApply(h,'Poison',dur,{poisonTick:10}))addLog(room,`${h.name} receives Poison for ${dur} turn(s) from Poison Mist.`)}return;
 }
 return executeNonAttackCard_v090(room,seat,card,userSlot,targetSeat,targetSlot,script);
};

const resolveGeneric_v090=resolveGeneric;
resolveGeneric=function(room,seat,index,userSlot,targetSeat,targetSlot){
 const p=room.match.players[seat],card=p.hand[index],user=p.board[userSlot];
 if(card?.card_id==='S1-THF-009'){
   const hasH=p.hand.findIndex((c,i)=>i!==index&&c.card_id==='S1-THF-007');
   const hasV=p.hand.findIndex((c,i)=>i!==index&&c.card_id==='S1-THF-008');
   if(hasH<0||hasV<0)throw new Error('X Cross Slash requires Horizontal Slash and Vertical Slash in hand as additional cost.');
   // remove larger index first, then pay normal X Cross cost through the base resolver
   for(const ix of [hasH,hasV].sort((a,b)=>b-a)){const [c]=p.hand.splice(ix,1);p.discard.push(c);if(ix<index)index--;}
   addLog(room,`${user.name} discards Horizontal Slash and Vertical Slash as the additional cost for X Cross Slash.`);
 }
 return resolveGeneric_v090(room,seat,index,userSlot,targetSeat,targetSlot);
};

const resolveCurrent_v090=resolveCurrent;
resolveCurrent=function(room,pass=false){
 const m=room.match,a=m.pendingAttack?clone(room.match.pendingAttack):null;
 let secondChanceEligible=false;
 if(a&&!a.secondChanceReplay&&a.card?.card_type==='Skill'&&a.sourceSeat&&a.targetSeat){
   const p=m.players[a.sourceSeat],h=p?.board?.[a.userSlot],sel=a.selected,types=sel?.special==='DRAGON_SCALE'?['BLOCK']:(DEF.get(sel?.card?.card_id)||{}).response_types||[];
   const blockedOrDodged=types.includes('BLOCK')||types.includes('DODGE');
   secondChanceEligible=!!(blockedOrDodged&&s1b2IsThiefHero(h)&&n(p.racial)>0&&!p.racialUsedTurn&&!h.racialUsed);
 }
 const ret=resolveCurrent_v090(room,pass);
 if(secondChanceEligible&&m.status==='active'&&!m.pendingAttack&&!m.pendingChoice){
   const p=m.players[a.sourceSeat],targetAlive=a.aoe?true:alive(m.players[a.targetSeat]?.board?.[a.slots?.[0]||a.targetSlot]);
   if(targetAlive){m.pendingChoice={type:'S1B2_SECOND_CHANCE',seat:a.sourceSeat,attack:a,prompt:'Second Chance: spend 1 Racial Token to replay this Skill Card immediately for 0 Mana?',options:[{index:0,card:virtualChoiceCard('S1B2-SECOND-YES','Use Second Chance','Spend 1 Racial Token and replay the Skill Card.')},{index:1,card:virtualChoiceCard('S1B2-SECOND-NO','Skip Second Chance','Do not spend a Racial Token.')} ]};addLog(room,'Second Chance available. Choose whether to spend 1 Racial Token.');}
 }
 return ret;
};

const useLegacy_v090=useLegacy;
useLegacy=function(room,client,slot){
 const m=room.match,p=m.players[client.seat],h=p.board[slot];
 if(h?.id==='S1-THF-L001'){
   if(!proactiveLegacyAllowed(m,client.seat,h)||m.phase!=='Deploy Phase')throw new Error('Hidden Stash is available during your Deploy Phase.');
   const options=s1b2ThiefOptions(p);if(options.length<2)throw new Error('Hidden Stash requires 2 Thief Skill Cards in hand.');
   m.pendingChoice={type:'S1B2_HIDDEN_STASH',seat:client.seat,legacySlot:slot,remaining:2,chosen:[],options};addLog(room,'Hidden Stash: choose 2 Thief Skill Cards to discard.');return;
 }
 if(h?.id==='S1-THF-L002'){
   if(!proactiveLegacyAllowed(m,client.seat,h)||m.phase!=='Deploy Phase')throw new Error('Hidden Archives is available during your Deploy Phase.');
   const options=s1b2ThiefOptions(p);if(options.length<2)throw new Error('Hidden Archives requires 2 Thief Skill Cards in hand.');
   if(!s1b2ItemEventDiscardOptions(p).length)throw new Error('Hidden Archives requires an Item or Event Card in discard pile.');
   m.pendingChoice={type:'S1B2_HIDDEN_ARCHIVES',seat:client.seat,legacySlot:slot,remaining:2,chosen:[],options};addLog(room,'Hidden Archives: choose 2 Thief Skill Cards to discard.');return;
 }
 return useLegacy_v090(room,client,slot);
};

const resolveChoice_v090=resolveChoice;
resolveChoice=function(room,client,index){
 const m=room.match,c=m.pendingChoice,p=m.players[client.seat];
 if(c?.type==='S1B2_SIXTH_SENSE'){
   if(c.seat!==client.seat)throw new Error('This choice belongs to the other player.');
   const opt=c.options[n(index,-1)];if(!opt)throw new Error('Choose a DEF Skill Card.');
   const [card]=p.deck.splice(opt.index,1);p.hand.push(card);p.deck=shuffle(p.deck);m.pendingChoice=null;addLog(room,`Sixth Sense adds ${card.card_name} to hand, then shuffles the deck.`);return;
 }
 if(c?.type==='S1B2_SECOND_CHANCE'){
   if(c.seat!==client.seat)throw new Error('This choice belongs to the other player.');
   const opt=c.options[n(index,-1)];if(!opt)throw new Error('Choose Second Chance or Skip.');
   const a=c.attack,h=p.board[a.userSlot];m.pendingChoice=null;
   if(opt.card.card_id==='S1B2-SECOND-NO'){addLog(room,'Second Chance declined.');return;}
   if(!h||!s1b2IsThiefHero(h)||p.racial<=0||p.racialUsedTurn||h.racialUsed)throw new Error('Second Chance is no longer available.');
   p.racial--;p.racialUsedTurn=true;h.racialUsed=true;
   const replay={...a,selected:null,results:{},index:0,chainStep:1,secondChanceReplay:true};
   replay.slots=Array.isArray(a.slots)?a.slots:[a.targetSlot].filter(Boolean);
   m.pendingAttack=replay;addLog(room,`${h.name} uses Second Chance: spend 1 Racial Token to replay ${a.card.card_name} for 0 Mana. A new Response Window opens.`);return;
 }
 if(c?.type==='S1B2_HIDDEN_STASH'||c?.type==='S1B2_HIDDEN_ARCHIVES'){
   if(c.seat!==client.seat)throw new Error('This Legacy choice belongs to the other player.');
   const opt=c.options[n(index,-1)];if(!opt)throw new Error('Choose a Thief Skill Card.');
   const [card]=p.hand.splice(opt.index,1);p.discard.push(card);c.chosen.push(card);c.remaining--;addLog(room,`${p.board[c.legacySlot].name} discards ${card.card_name}. ${c.remaining} more required.`);
   if(c.remaining>0){c.options=s1b2ThiefOptions(p);return;}
   const h=p.board[c.legacySlot];h.legacyUsed=true;
   if(c.type==='S1B2_HIDDEN_STASH'){p.racial=Math.min(2,n(p.racial)+1);m.pendingChoice=null;addLog(room,'Hidden Stash gains 1 Racial Token.');return;}
   c.type='S1B2_HIDDEN_ARCHIVES_PICK';c.options=s1b2ItemEventDiscardOptions(p);addLog(room,'Hidden Archives: choose 1 Item or Event Card from discard to return to hand.');return;
 }
 if(c?.type==='S1B2_HIDDEN_ARCHIVES_PICK'){
   if(c.seat!==client.seat)throw new Error('This Legacy choice belongs to the other player.');
   const opt=c.options[n(index,-1)];if(!opt)throw new Error('Choose an Item or Event Card from discard.');
   const [card]=p.discard.splice(opt.index,1);p.hand.push(card);p.board[c.legacySlot].legacyUsed=true;m.pendingChoice=null;addLog(room,`Hidden Archives returns ${card.card_name} to hand.`);return;
 }
 return resolveChoice_v090(room,client,index);
};

const actionHints_v090=actionHints;
actionHints=function(m,seat){
 const out=actionHints_v090(m,seat);if(!out||m.status!=='active'||m.coinFlip?.pending||m.coinFlip?.awaitingConfirmation)return out;
 const p=m.players[seat];
 // Prevent Play buttons for Tactical/Support outside Deploy and for Phoenix Feather without fallen Hero.
 out.playableCardIndexes=(out.playableCardIndexes||[]).filter(index=>{const card=p.hand[index];if(s1b2IsTacticalSupport(card)&&m.phase!=='Deploy Phase')return false;if(card?.card_id==='S1-ITM-008'&&!LANES.some(l=>p.board[l]?.legacy))return false;return true;});
 out.playableUsersByCard=Object.fromEntries(Object.entries(out.playableUsersByCard||{}).filter(([idx])=>out.playableCardIndexes.includes(Number(idx))));
 return out;
};

export function qaS1B2IntegrationSummary(){return{version:VERSION,mainPool:MAIN.size,heroes:Object.keys(HERO).length,legacy:Object.keys(LEGACY).length,packages:PACKAGES.size,thiefCards:[...MAIN.keys()].filter(x=>x.startsWith('S1-THF-')).length,hasFinnian:!!HERO['S1-THF-H001'],hasHiddenStash:!!LEGACY['S1-THF-L001']}}
export function qaS1B2PoisonBurstMultiTarget(){const p1=v060QaPlayer([clone(MAIN.get('S1-THF-018'))],{LEFT:makeHero('S1-THF-H003')}),p2=v060QaPlayer([],{LEFT:makeHero('S1-WAR-H001'),RIGHT:makeHero('S1-MAG-H001')});statusApply(p2.board.LEFT,'Poison',1,{poisonTick:10});statusApply(p2.board.RIGHT,'Poison',2,{poisonTick:10});const room={id:'qa-s1b2-pb',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';playCard(room,{seat:1},{index:0,userSlot:'LEFT'});return{slots:room.match.pendingAttack?.slots,damageBySlot:room.match.pendingAttack?.damageBySlot,aoe:room.match.pendingAttack?.aoe,attackType:room.match.pendingAttack?.attackType}}
export function qaS1B2SecondChanceChoice(){const p1=v060QaPlayer([clone(MAIN.get('S1-THF-001'))],{LEFT:makeHero('S1-THF-H001')}),p2=v060QaPlayer([clone(MAIN.get('S1-WAR-003'))],{CENTER:makeHero('S1-WAR-H001')});const room={id:'qa-s1b2-second',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'CENTER'});selectResponse(room,{seat:2},0);resolveResponse(room,{seat:2});return{choice:room.match.pendingChoice?.type,options:(room.match.pendingChoice?.options||[]).map(o=>o.card.card_name),racial:p1.racial,logs:room.logs.map(x=>x.message)}}
export function qaS1B2TacticalDeployOnly(){const p1=v060QaPlayer([clone(MAIN.get('S1-THF-012'))],{LEFT:makeHero('S1-THF-H002')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')}),room={id:'qa-s1b2-tactical',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';let error='';try{playCard(room,{seat:1},{index:0,userSlot:'LEFT'})}catch(e){error=e.message}return{error,playable:actionHints(room.match,1).playableCardIndexes}}

// v0.9.2 RC — S1B2 playtest tuning QA exports.

export function qaS1B2PlaytestTuning091(){
 const mist=MAIN.get('S1-THF-012'),ren=makeHero('S1-THF-H003'),rog=makeHero('S1-THF-H002');
 return {version:VERSION,poisonMistCost:n(mist?.mana_cost),poisonMistTiming:mist?.timing||mist?.usage_phase,renegadePoisonBonus:s1b2PoisonBonus(ren),roguePoisonBonus:s1b2PoisonBonus(rog),renegadePassiveAttackBonus:passiveAttackBonus(ren),nightshadeText:HERO['S1-THF-H003']?.ability_text};
}
export function qaS1B2PoisonMistCost091(){const p1=v060QaPlayer([clone(MAIN.get('S1-THF-012'))],{LEFT:makeHero('S1-THF-H002')}),p2=v060QaPlayer([],{LEFT:makeHero('S1-WAR-H001'),RIGHT:makeHero('S1-MAG-H001')});const room={id:'qa-s1b2-mist091',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Deploy Phase';p1.mana=5;let errorLow='';try{playCard(room,{seat:1},{index:0,userSlot:'LEFT'})}catch(e){errorLow=e.message}p1.mana=6;playCard(room,{seat:1},{index:0,userSlot:'LEFT'});return{errorLow,manaAfter:p1.mana,leftPoison:p2.board.LEFT.status.Poison,rightPoison:p2.board.RIGHT.status.Poison,logs:room.logs.map(x=>x.message)}}


// v0.9.2 RC — S1B2 Ultimate Tribute lineage alias + Final Grit QA exports.
export function qaV092S1B2VenomSovereignTribute(){const p1=v060QaPlayer([clone(MAIN.get('S1-THF-015'))],{LEFT:makeHero('S1-THF-H001'),CENTER:makeHero('S1-WAR-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v092-thf-tribute',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Reform Phase';const before=p1.racial;tribute(room,{seat:1},0,'LEFT');return{racialBefore:before,racialAfter:p1.racial,exp:p1.board.LEFT.exp,hand:p1.hand.length,logs:room.logs.map(x=>x.message)}}
export function qaV092S1B2VenomWrongLineage(){const p1=v060QaPlayer([clone(MAIN.get('S1-THF-015'))],{LEFT:makeHero('S1-WAR-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-MAG-H001')}),room={id:'qa-v092-thf-bad',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Reform Phase';let error='';try{tribute(room,{seat:1},0,'LEFT')}catch(e){error=e.message}return{error,hand:p1.hand.length,racial:p1.racial,exp:p1.board.LEFT.exp}}


// v0.10.0 RC — full engine audit alignment for S1B2 Nightshade + healing/Stun targeting.
const V099_HEALING_ITEM_IDS=new Set(['S1-ITM-001','S1-ITM-002']);
function v099HealingItem(card){const txt=String([card?.card_name,card?.effect_text,card?.short_text,card?.full_description].filter(Boolean).join(' ')).toLowerCase();return !!(card?.card_type==='Item'&&(V099_HEALING_ITEM_IDS.has(String(card?.card_id||''))||n(card?.heal)>0||(/heal/.test(txt)&&/potion|health/.test(txt))))}
function v099Bleeding(h){return !!n(h?.status?.Bleed)}
const passiveAttackBonus_v099=passiveAttackBonus;
passiveAttackBonus=function(h){const id=String(h?.id||'');if(id==='S1-THF-H003')return 10;return passiveAttackBonus_v099(h)};
s1b2PoisonBonus=function(h){return ['Rogue','Renegade'].includes(String(h?.class||''))?1:0};
s1b2PoisonDuration=function(h,base){return Math.max(1,n(base,1)+s1b2PoisonBonus(h))};
const canUser_v099=canUser;
canUser=function(card,h,m=null,seat=null,slot=null){
 if(v099HealingItem(card))return !!(alive(h)&&!h.actionZone&&classAllowed(card,h));
 return canUser_v099(card,h,m,seat,slot)
};
const v045UsersForCard_v099=v045UsersForCard;
v045UsersForCard=function(m,seat,card){
 if(v099HealingItem(card)){const p=m.players[seat];return LANES.filter(l=>{const h=p.board[l];return alive(h)&&!h.actionZone&&!v099Bleeding(h)&&classAllowed(card,h)})}
 return v045UsersForCard_v099(m,seat,card)
};
const alliedCardTargets_v099=alliedCardTargets;
alliedCardTargets=function(m,seat,userSlot,card){
 const slots=alliedCardTargets_v099(m,seat,userSlot,card);
 return v099HealingItem(card)?slots.filter(slot=>!v099Bleeding(m.players?.[seat]?.board?.[slot])):slots
};
const actionHints_v099=actionHints;
actionHints=function(m,seat){
 const out=actionHints_v099(m,seat);if(!out||m.status!=='active')return out;
 const p=m.players?.[seat];if(!p)return out;
 const mapped={...(out.playableUsersByCard||{})};
 for(const index of out.playableCardIndexes||[]){const card=p.hand?.[index];if(v099HealingItem(card)){mapped[String(index)]=v045UsersForCard(m,seat,card)}}
 out.playableUsersByCard=mapped;
 out.playableCardIndexes=(out.playableCardIndexes||[]).filter(index=>(mapped[String(index)]||v045UsersForCard(m,seat,p.hand?.[index])||[]).length>0);
 return out
};
export function qaV099FullEngineAudit(){
 const stunned=makeHero('S1-WAR-H001'),caster=makeHero('S1-MAG-H001');stunned.damage=40;stunned.status.Stun=1;
 const p1=v060QaPlayer([clone(MAIN.get('S1-ITM-001'))],{LEFT:stunned,CENTER:caster}),p2=v060QaPlayer([],{CENTER:makeHero('S1-CLE-H001')});
 const room={id:'qa-v099-full-audit',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Deploy Phase';
 const hintsBefore=actionHints(room.match,1);
 playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'LEFT'});
 const ren=makeHero('S1-THF-H003'),rog=makeHero('S1-THF-H002'),arch2=makeHero('S1-ARC-H002'),arch3=makeHero('S1-ARC-H003');
 return {version:VERSION,stunnedHpAfter:hp(stunned),stunnedStillStunned:n(stunned.status.Stun),healthPotionUsers:hintsBefore.playableUsersByCard?.['0']||[],renegadePoisonBonus:s1b2PoisonBonus(ren),roguePoisonBonus:s1b2PoisonBonus(rog),renegadePassiveAttackBonus:passiveAttackBonus(ren),marksmanSingleTargetAttackBonus:archerSingleTargetAttackBonus(arch2,MAIN.get('S1-ARC-001'),false),grandRangerSingleTargetAttackBonus:archerSingleTargetAttackBonus(arch3,MAIN.get('S1-ARC-001'),false),grandRangerAreaAttackBonus:archerSingleTargetAttackBonus(arch3,{card_id:'TEST-AOE',card_type:'Skill',card_subtype:'ATK',target_type:'All opponent Heroes',effect_text:'Area damage to all opponent Heroes'},true),nightshadeText:HERO['S1-THF-H003']?.ability_text,logs:room.logs.map(x=>x.message)}
}

// ============================================================
// v1.0.1 Closed Alpha — safer Rank Up resolver
// Some hosted starter presets use custom package slot ids. Rank Up should
// still resolve from the player's own Legacy Deck by hero identity/lineage.
// ============================================================
const tryRank_v101_rankFallback = tryRank;
function v101HeroLineageKeyById(heroId){
  const h = HERO[heroId] || {};
  return String(h.fixed_class_lineage_id || h.ultimate_tribute_lineage_id || h.fixed_class_lineage_path || h.evolution_path || h.package || '').trim().toLowerCase();
}
function v101FindNextHeroSideCard(p,h,nextRank){
  const name = String(h?.name || '').trim().toLowerCase();
  const key = v101HeroLineageKeyById(h?.id);
  return (p.side || []).find(card=>{
    if(String(card?.card_type || '') !== 'Hero') return false;
    const meta = HERO[card.card_id] || {};
    if(rankNum(meta.rank) !== nextRank) return false;
    if(name && String(meta.name || card.card_name || '').trim().toLowerCase() === name) return true;
    const k2 = v101HeroLineageKeyById(card.card_id);
    return !!(key && k2 && key === k2);
  }) || null;
}
tryRank = function(room,seat,slot){
  const m = room.match, p = m?.players?.[seat], before = p?.board?.[slot];
  const beforeId = before?.id, beforeRank = rankNum(before?.rank);
  const result = tryRank_v101_rankFallback(room,seat,slot);
  const afterBase = p?.board?.[slot];
  if(!before || !afterBase || afterBase.id !== beforeId || rankNum(afterBase.rank) > beforeRank) return result;
  const req = rankReq(before);
  if(!req || before.exp < req || beforeRank >= 3) return result;
  const nextSide = v101FindNextHeroSideCard(p,before,beforeRank+1);
  if(!nextSide) {
    addLog(room,`RANK UP BLOCKED: ${before.name} has ${before.exp} EXP, but no Rank ${beforeRank+1} Hero card was found in this player's Legacy Deck.`);
    return result;
  }
  const sideCard = sideRemove(p,nextSide.card_id);
  if(!sideCard) return result;
  const nextHero = makeHero(sideCard.card_id);
  Object.assign(nextHero,{
    packageId: sideCard.package_id || before.packageId || nextHero.packageId,
    damage: Math.min(nextHero.maxHp,before.damage),
    exp: before.exp,
    expCards: before.expCards,
    exhausted: before.exhausted,
    status: before.status,
    tmp: before.tmp,
    defeatedStack: before.defeatedStack,
    actionZone: before.actionZone
  });
  p.board[slot] = nextHero;
  p.regen = Math.min(6,p.regen+1);
  draw(p,rankNum(nextHero.rank)===2?2:3,false);
  p.discard.push(...before.expCards);
  nextHero.expCards = [];
  const msg = `${before.name} ranks up to ${nextHero.class}. Draw bonus and +1 Mana Regen applied.`;
  addLog(room,msg);
  announceCardUse(room,seat,nextHero,`Player ${seat}: ${msg}`,'Rank Up');
  return result;
};

// ============================================================
// v1.0.3 Closed Alpha — browser PvP rules patch
// - announce Tribute cards to opponent action history
// - Arrow Barrage mana choice before Response Window
// - Archer additional costs before Response Window
// ============================================================
const tribute_v103 = tribute;
tribute = function(room,client,index,slot){
  const p = room.match?.players?.[client.seat];
  const card = p?.hand?.[n(index,-1)];
  const r = tribute_v103(room,client,index,slot);
  if(card) announceCardUse(room,client.seat,card,`Player ${client.seat} Tributes ${card.card_name} to ${slot} for ${n(card.exp_value,100)} EXP.`,'Tribute');
  return r;
};

const playCard_v103 = playCard;
function v103CardCostType(card){ return String(card?.cost_type || '').trim().toLowerCase(); }
function v103CardCostValue(card,def=0){ return n(card?.cost_value,def); }
function v103IsArcherAttackCost(card){
  const id = String(card?.card_id || '');
  return id === 'S1-ARC-008' || id === 'S1-ARC-018' || id === 'S1-ARC-016';
}
function v103DiscardCostNeeded(card){ return v103CardCostType(card).includes('discard') && v103CardCostValue(card,1) > 0; }
function v103SelfDamageCostNeeded(card){ return v103CardCostType(card).includes('self damage') && v103CardCostValue(card,0) > 0; }
function v103VirtualOption(id,name,text){ return virtualChoiceCard(id,name,text); }
function v103OpenDiscardCostChoice(room,client,payload,card,amount){
  const p = room.match.players[client.seat];
  const originalIndex = n(payload.index,-1);
  const options = p.hand.map((c,i)=>({index:i,card:c})).filter(o=>o.index !== originalIndex);
  if(options.length < amount) throw new Error(`${card.card_name} requires discarding ${amount} other card(s) from hand before the Response Window opens.`);
  room.match.pendingChoice = {type:'V103_ARCHER_DISCARD_COST',seat:client.seat,payload:{...payload},remaining:amount,discarded:[],options,prompt:`${card.card_name}: discard ${amount} other card(s) from hand as additional cost before the opponent Response Window opens.`};
  addLog(room,`${card.card_name}: Player ${client.seat} must discard ${amount} card(s) as additional cost before the attack is declared.`);
}
function v103OpenArrowManaChoice(room,client,payload,card){
  const p = room.match.players[client.seat];
  const max = n(p.mana);
  if(max <= 0) throw new Error('Arrow Barrage requires at least 1 Mana Shard to spend.');
  room.match.pendingChoice = {type:'V103_ARROW_BARRAGE_MANA',seat:client.seat,payload:{...payload},options:Array.from({length:max},(_,i)=>{const mana=i+1;return {manaSpent:mana,card:v103VirtualOption(`ARROW-BARRAGE-${mana}`,`${mana} Mana`,`${card.card_name}: spend ${mana} Mana for ${mana*10} base damage.`)}}),prompt:'Arrow Barrage: choose how many Mana Shards to spend before the opponent Response Window opens.'};
  addLog(room,`Arrow Barrage: Player ${client.seat} chooses Mana spent before the attack is declared.`);
}
function v103PlayArrowBarrage(room,client,payload,card){
  const spent = n(payload.manaSpent,0);
  const p = room.match.players[client.seat];
  if(spent <= 0) return v103OpenArrowManaChoice(room,client,payload,card);
  if(spent > n(p.mana)) throw new Error(`Arrow Barrage cannot spend ${spent} Mana; only ${p.mana} available.`);
  const oldCost = card.mana_cost, oldBase = card.base_damage, oldText = card.effect_text;
  let ok = false;
  card.mana_cost = String(spent);
  card.base_damage = String(spent * 10);
  card.effect_text = `${oldText || card.full_description || ''} [Chosen Mana: ${spent}; base damage ${spent*10}.]`;
  try{
    const r = playCard_v103(room,client,payload);
    ok = true;
    addLog(room,`Arrow Barrage spends ${spent} Mana for ${spent*10} base damage before response modifiers.`);
    return r;
  }finally{
    if(!ok){ card.mana_cost = oldCost; card.base_damage = oldBase; card.effect_text = oldText; }
  }
}
function v103ApplySelfDamageCost(room,client,payload,card){
  const p = room.match.players[client.seat];
  const h = p.board?.[payload.userSlot];
  const amount = v103CardCostValue(card,0);
  if(!alive(h)) throw new Error(`${card.card_name} requires an active user.`);
  if(hp(h) <= amount) throw new Error(`${card.card_name} requires more than ${amount} HP to pay its self-damage cost.`);
  let ok=false;
  h.damage = Math.min(h.maxHp,h.damage+amount);
  try{
    const r = playCard_v103(room,client,{...payload,__v103CostPaid:true});
    ok=true;
    addLog(room,`${h.name} pays ${amount} HP as additional cost for ${card.card_name}.`);
    return r;
  }finally{
    if(!ok) h.damage = Math.max(0,h.damage-amount);
  }
}
playCard = function(room,client,payload={}){
  const m = assertActive(room,client), p = m.players[client.seat], card = p.hand[n(payload.index,-1)];
  if(!card) throw new Error('Choose a valid card.');
  if((card.card_id === 'S1-ARC-010' || card.card_name === 'Arrow Barrage') && !payload.__v103CostPaid){
    return v103PlayArrowBarrage(room,client,payload,card);
  }
  if(v103IsArcherAttackCost(card) && !payload.__v103CostPaid){
    if(v103DiscardCostNeeded(card)) return v103OpenDiscardCostChoice(room,client,payload,card,v103CardCostValue(card,1));
    if(v103SelfDamageCostNeeded(card)) return v103ApplySelfDamageCost(room,client,payload,card);
  }
  return playCard_v103(room,client,payload);
};

const resolveChoice_v103 = resolveChoice;
resolveChoice = function(room,client,index){
  const m = room.match, c = m.pendingChoice, p = m.players?.[client.seat];
  if(c?.type === 'V103_ARROW_BARRAGE_MANA'){
    if(c.seat !== client.seat) throw new Error('This Arrow Barrage choice belongs to the other player.');
    const opt = c.options[n(index,-1)];
    if(!opt) throw new Error('Choose how much Mana Arrow Barrage spends.');
    const payload = {...c.payload, manaSpent:n(opt.manaSpent,0), __v103CostPaid:true};
    m.pendingChoice = null;
    return v103PlayArrowBarrage(room,client,payload,p.hand[n(payload.index,-1)]);
  }
  if(c?.type === 'V103_ARCHER_DISCARD_COST'){
    if(c.seat !== client.seat) throw new Error('This Archer cost choice belongs to the other player.');
    const opt = c.options[n(index,-1)];
    if(!opt) throw new Error('Choose a card to discard.');
    const originalCardId = p.hand[n(c.payload.index,-1)]?.card_id;
    const [discarded] = p.hand.splice(opt.index,1);
    if(discarded) p.discard.push(discarded);
    c.discarded.push(discarded);
    if(opt.index < c.payload.index) c.payload.index--;
    c.remaining--;
    addLog(room,`Player ${client.seat} discards ${discarded?.card_name || 'a card'} as additional cost.`);
    if(c.remaining > 0){
      c.options = p.hand.map((card,i)=>({index:i,card})).filter(o=>o.card?.card_id !== originalCardId || o.index !== c.payload.index);
      return;
    }
    const payload = {...c.payload,__v103CostPaid:true};
    m.pendingChoice = null;
    return playCard(room,client,payload);
  }
  return resolveChoice_v103(room,client,index);
};

export function qaV103ArrowBarrageChoice(){
  const p1=v060QaPlayer([clone(MAIN.get('S1-ARC-010'))],{LEFT:makeHero('S1-ARC-H002')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')});
  const room={id:'qa-v103-arrow',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';p1.mana=3;
  playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'CENTER'});
  const choice=room.match.pendingChoice?.type;
  resolveChoice(room,{seat:1},1);
  return {choice,manaAfter:p1.mana,pendingAttack:room.match.pendingAttack?.card?.card_name,damage:room.match.pendingAttack?.damage};
}
export function qaV103AmbushDiscardBeforeResponse(){
  const p1=v060QaPlayer([clone(MAIN.get('S1-ARC-008')),clone(MAIN.get('S1-WAR-001'))],{LEFT:makeHero('S1-ARC-H001')}),p2=v060QaPlayer([],{CENTER:makeHero('S1-WAR-H001')});
  const room={id:'qa-v103-ambush',clients:new Map(),spectators:new Map(),seq:0,logs:[],match:v060QaMatch(p1,p2)};room.match.phase='Battle Phase';p1.mana=10;
  playCard(room,{seat:1},{index:0,userSlot:'LEFT',targetSlot:'CENTER'});
  const before=room.match.pendingChoice?.type;
  resolveChoice(room,{seat:1},0);
  return {before,pendingAttack:room.match.pendingAttack?.card?.card_name,hand:p1.hand.map(c=>c.card_name),discard:p1.discard.map(c=>c.card_name)};
}

// ============================================================
// v1.0.4 Closed Alpha browser PvP rules/visibility fixes
// - suppress delayed Casting re-announcement in Opponent Played
// - Sacred Stormblade cannot offer Dodge responses
// - Venom Detonation enters Opponent Played and allows Blessing of Divinity response
// - Final Grit accepts the latest eligible defeated Gladiator/Conqueror stack
// - enrich Legacy replacement image paths for board display
// ============================================================
(function(){
  const V104_SACRED_STORMBLADE = 'S1-WAR-021';
  const V104_BLESSING_DIVINITY = 'S1-CLE-024';
  const V104_VENOM_DETONATION = 'S1-THF-018';

  function v104IsAliveHero(h){ return !!(h && !h.legacy && n(h.maxHp) > 0 && hp(h) > 0); }
  function v104DivinityProviders(p, card){
    return LANES.filter(slot=>{
      const h=p?.board?.[slot];
      if(!v104IsAliveHero(h) || h.status?.Stun) return false;
      if(!['Paladin','Crusader'].includes(String(h.class||''))) return false;
      return n(p?.mana) >= v104DivinityCost(card,h);
    });
  }
  function v104DivinityCost(card,h){
    const base=n(card?.mana_cost);
    return String(h?.class||'') === String(card?.ultimate_rank2_class||'Paladin') ? base+n(card?.ultimate_rank2_extra_mana,2) : base;
  }
  function v104SnapshotDivinityState(p){
    return LANES.map(slot=>{
      const h=p?.board?.[slot];
      return h?{slot,damage:h.damage,exhausted:h.exhausted,tmp:clone(h.tmp||{})}:null;
    }).filter(Boolean);
  }
  function v104RestoreDivinityState(p, snapshots){
    for(const s of snapshots||[]){
      const h=p?.board?.[s.slot];
      if(!h) continue;
      h.damage=s.damage;
      h.exhausted=s.exhausted;
      h.tmp=clone(s.tmp||{});
    }
  }
  function v104ApplyDivinityResponse(room, seat, card, providerSlot){
    const m=room.match, p=m.players[seat], user=p.board[providerSlot];
    for(const h of Object.values(p.board||{})){
      if(!v104IsAliveHero(h)) continue;
      h.tmp=h.tmp||{};
      h.tmp.divinityImmune=true;
      h.tmp.divinityImmuneExpiresAtStartOf=seat;
      if(user?.class==='Crusader') healHero(room,user,h,20,'Blessing of Divinity');
    }
  }
  function v104LegacyMeta(id){ return LEGACY?.[id] || {}; }
  function v104EnrichLegacyHero(h){
    if(!h?.legacy) return h;
    const meta=v104LegacyMeta(h.id);
    if(meta){
      h.image_url=h.image_url||meta.image_url||meta.artwork_url||'';
      h.thumbnail_url=h.thumbnail_url||meta.thumbnail_url||meta.image_url||h.image_url||'';
      h.local_thumbnail_path=h.local_thumbnail_path||meta.local_thumbnail_path||`runtime_thumbnail_assets/cards/${h.id}.webp`;
      h.legacyEffectText=h.legacyEffectText||meta.effect_text||meta.effect_description||'';
    }else if(h.id){
      h.local_thumbnail_path=h.local_thumbnail_path||`runtime_thumbnail_assets/cards/${h.id}.webp`;
    }
    return h;
  }

  const pushNotice_v104 = pushNotice;
  pushNotice = function(room, notice={}){
    const title=String(notice?.title||'');
    if(room?.match?.v104SuppressCastingOpponentPlayed && (/Casting Attack Resolves/i.test(title) || /Opponent Declared Attack/i.test(title))){
      return;
    }
    return pushNotice_v104(room, notice);
  };

  const resolveCasting_v104 = resolveCasting;
  resolveCasting = function(room, seat){
    if(room?.match) room.match.v104SuppressCastingOpponentPlayed = true;
    try { return resolveCasting_v104(room, seat); }
    finally { if(room?.match) delete room.match.v104SuppressCastingOpponentPlayed; }
  };

  const defLegal_v104 = defLegal;
  defLegal = function(p,card,a,currentSlot){
    const types=(DEF.get(card?.card_id)||{}).response_types||[];
    if(String(a?.card?.card_id||'')===V104_SACRED_STORMBLADE && types.includes('DODGE')) return false;
    if(card?.card_id===V104_BLESSING_DIVINITY && a?.poisonBurst) return v104DivinityProviders(p,card).length>0;
    return defLegal_v104(p,card,a,currentSlot);
  };

  const legalResponseList_v104 = legalResponseList;
  legalResponseList = function(m,seat){
    const out=legalResponseList_v104(m,seat), a=m?.pendingAttack, p=m?.players?.[seat];
    if(a?.targetSeat===seat && a.poisonBurst){
      for(const [index,card] of (p?.hand||[]).entries()){
        if(card?.card_id===V104_BLESSING_DIVINITY && defLegal(p,card,a,a.slots?.[a.index])){
          if(!out.some(x=>x.index===index && x.card_id===V104_BLESSING_DIVINITY)){
            out.push({...publicCard(card,index), providerSlots:v104DivinityProviders(p,card), responseNote:'Blessing of Divinity may be used against Venom Detonation.'});
          }else{
            const row=out.find(x=>x.index===index && x.card_id===V104_BLESSING_DIVINITY);
            row.providerSlots=v104DivinityProviders(p,card);
          }
        }
      }
    }
    return out;
  };

  const selectResponse_v104 = selectResponse;
  selectResponse = function(room,client,index,targetSlot=null,providerSlot=null){
    const m=room.match, a=m.pendingAttack, p=m.players?.[client.seat], card=p?.hand?.[n(index,-1)];
    if(card?.card_id!==V104_BLESSING_DIVINITY || !a?.poisonBurst) return selectResponse_v104(room,client,index,targetSlot,providerSlot);
    if(!a || a.targetSeat!==client.seat || a.selected) throw new Error('No open Venom Detonation response is waiting for Blessing of Divinity.');
    const providers=v104DivinityProviders(p,card);
    if(!providers.length) throw new Error('No legal Paladin or Crusader can use Blessing of Divinity now.');
    const chosen=providers.includes(String(providerSlot||''))?String(providerSlot):providers[0];
    const user=p.board[chosen], cost=v104DivinityCost(card,user);
    if(p.mana<cost) throw new Error(`Not enough mana. Blessing of Divinity costs ${cost} for ${user.class}.`);
    const before=v104SnapshotDivinityState(p);
    p.mana-=cost;
    p.hand.splice(n(index),1);
    user.exhausted=true;
    v104ApplyDivinityResponse(room, client.seat, card, chosen);
    a.selected={card,cost,index,providerSlot:chosen,special:'V104_DIVINITY_RESPONSE',before};
    announceCardUse(room,client.seat,card,`${user.name} declares Blessing of Divinity against Venom Detonation. Allied Heroes cannot take damage during this resolution.${user.class==='Crusader'?' Allied Heroes are healed by 20.':''}`,'Opponent Selects DEF Response');
    addLog(room,`${user.name} uses Blessing of Divinity as a response to Venom Detonation.`);
  };

  const cancelResponse_v104 = cancelResponse;
  cancelResponse = function(room,client){
    const a=room.match?.pendingAttack, s=a?.selected;
    if(s?.special==='V104_DIVINITY_RESPONSE'){
      const p=room.match.players[client.seat];
      p.mana+=n(s.cost);
      p.hand.splice(Math.min(n(s.index),p.hand.length),0,s.card);
      v104RestoreDivinityState(p,s.before);
      a.selected=null;
      addLog(room,`Player ${client.seat} cancels Blessing of Divinity response.`);
      return;
    }
    return cancelResponse_v104(room,client);
  };

  const resolveResponseMath_v104 = resolveResponseMath;
  resolveResponseMath = function(room,a,slot){
    if(a?.selected?.special==='V104_DIVINITY_RESPONSE'){
      const p=room.match.players[a.targetSeat], h=p.board[slot], card=a.selected.card;
      p.discard.push(card);
      addLog(room,`Blessing of Divinity protects ${h?.name||slot} from Venom Detonation damage.`);
      return {slot,dmg:n(a.damageBySlot?.[slot],a.damage),avoid:false,negate:false,returnAttack:false,statusApplies:true,fixedFinal:0,redirectTarget:null};
    }
    return resolveResponseMath_v104(room,a,slot);
  };

  if(typeof s1b2OpenPoisonBurst === 'function'){
    const s1b2OpenPoisonBurst_v104 = s1b2OpenPoisonBurst;
    s1b2OpenPoisonBurst = function(room,seat,index,userSlot){
      const p=room.match.players[seat], card=p.hand[index], user=p.board[userSlot];
      const r=s1b2OpenPoisonBurst_v104(room,seat,index,userSlot);
      announceCardUse(room,seat,card,`${user?.name||'Hero'} uses Venom Detonation. Poisoned opponent Heroes open individual Magical Response Windows.`,'Opponent Declared Attack');
      return r;
    };
  }

  const finalGrit_v104 = finalGrit;
  finalGrit = function(room,seat,index,targetSlot){
    const m=room.match,p=m.players[seat],card=p.hand[index],legacy=p.board[targetSlot];
    if(!legacy?.legacy || !Array.isArray(legacy.defeatedStack)) return finalGrit_v104(room,seat,index,targetSlot);
    const topEligible=[...legacy.defeatedStack].reverse().find(id=>['Gladiator','Conqueror'].includes(HERO[id]?.class));
    const topActual=legacy.defeatedStack[legacy.defeatedStack.length-1];
    if(!topEligible || topEligible===topActual) return finalGrit_v104(room,seat,index,targetSlot);
    const newStack=legacy.defeatedStack.filter(id=>id!==topEligible).concat(topEligible);
    const oldStack=legacy.defeatedStack;
    legacy.defeatedStack=newStack;
    try { return finalGrit_v104(room,seat,index,targetSlot); }
    finally { if(p.board[targetSlot]===legacy) legacy.defeatedStack=oldStack; }
  };

  const publicHero_v104 = publicHero;
  publicHero = function(h){
    v104EnrichLegacyHero(h);
    const x=publicHero_v104(h);
    if(x?.legacy){
      const meta=v104LegacyMeta(x.id);
      x.image_url=x.image_url||meta.image_url||meta.artwork_url||'';
      x.thumbnail_url=x.thumbnail_url||meta.thumbnail_url||meta.image_url||x.image_url||'';
      x.local_thumbnail_path=x.local_thumbnail_path||meta.local_thumbnail_path||`runtime_thumbnail_assets/cards/${x.id}.webp`;
      x.legacyEffectText=x.legacyEffectText||meta.effect_text||meta.effect_description||'';
    }
    return x;
  };

  const resolveChoice_v104 = resolveChoice;
  resolveChoice = function(room,client,index){
    const before=room.match?.pendingChoice;
    const r=resolveChoice_v104(room,client,index);
    if(before?.type==='LEGACY'){
      const h=room.match.players?.[client.seat]?.board?.[before.slot];
      v104EnrichLegacyHero(h);
    }
    return r;
  };
})();

// ============================================================
// v1.0.5 Closed Alpha server follow-up
// - Delayed Casting should appear in Opponent Played when declared, and again when it resolves.
//   v1.0.4 suppressed the resolve notice; this bypasses that suppression without changing attack math.
// - Venom Detonation remains non-targeted: after choosing the user, it resolves against all poisoned opponent Heroes.
// ============================================================
(function(){
  const pushNotice_v105CastingResolve = pushNotice;
  pushNotice = function(room, notice={}){
    const title = String(notice?.title || '');
    const bypassCastingResolveSuppression = !!(room?.match?.v104SuppressCastingOpponentPlayed && (/Casting Attack Resolves/i.test(title) || /Opponent Declared Attack/i.test(title)));
    if(bypassCastingResolveSuppression){
      const old = room.match.v104SuppressCastingOpponentPlayed;
      delete room.match.v104SuppressCastingOpponentPlayed;
      try { return pushNotice_v105CastingResolve(room, notice); }
      finally { room.match.v104SuppressCastingOpponentPlayed = old; }
    }
    return pushNotice_v105CastingResolve(room, notice);
  };
})();
