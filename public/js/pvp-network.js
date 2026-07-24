/* Grandis Legacy PvP v2.5.16 network adapter.
   Room/seat/reconnect/private-state transport is preserved. Shared gameplay/UI comes from Local AI v5.33. */
(function(){
  'use strict';
  var VERSION='Grandis Legacy PvP v2.5.16 · Local AI v5.33 shared gameplay bridge client + lobby deck privacy + Authorized Observer + Deck Builder v1.14';
  var STORE_KEY='grandis_legacy_pvp_v20_client_id';
  var ROOM_KEY='grandis_legacy_pvp_v20_room';
  var NAME_KEY='grandis_legacy_pvp_v20_name';
  var ROLE_KEY='grandis_legacy_pvp_v20_role';
  var ws=null,reconnectTimer=null,reconnectDelay=1200,intentTimeoutTimer=null;
  var state={connected:false,snapshot:null,room:'LOBBY',name:'',role:'player',deckKey:'',loadedDeckKey:'',customDeck:null,customDeckName:'',clientId:'',lastAppliedRevision:0,applyingServer:false,intentInFlight:false,intentBaseRevision:0,intentName:'',intentSentAt:0,seatToken:'',lastMatchStatus:'setup',lastObservedTurn:'',pendingTurnAckKey:'',acknowledgedTurnKey:'',seenAnimationIds:{},lastCoinAnimationKey:'',coinResultReadyKey:'',observerPromptShown:false};
  var DECK_OPTIONS=[{"key":"starter_01_elemental_lord_conqueror_saint","label":"Starter 01 — Elemental Lord / Conqueror / Saint"},{"key":"starter_02_crusader_conqueror_saint","label":"Starter 02 — Crusader / Conqueror / Saint"},{"key":"starter_03_saint_crusader_renegade","label":"Starter 03 — Saint / Crusader / Renegade"},{"key":"starter_04_crusader_conqueror_elemental_lord","label":"Starter 04 — Crusader / Conqueror / Elemental Lord"},{"key":"starter_05_renegade_conqueror_grand_ranger","label":"Starter 05 — Renegade / Conqueror / Grand Ranger"},{"key":"starter_06_saint_crusader_grand_ranger","label":"Starter 06 — Saint / Crusader / Grand Ranger"},{"key":"starter_07_elemental_lord_conqueror_renegade","label":"Starter 07 — Elemental Lord / Conqueror / Renegade"},{"key":"starter_08_grand_arbalest_conqueror_grand_ranger","label":"Starter 08 — Grand Arbalest / Conqueror / Grand Ranger"},{"key":"starter_09_arcane_duelist_crusader_renegade","label":"Starter 09 — Arcane Duelist / Crusader / Renegade"},{"key":"starter_10_elemental_lord_conqueror_arcane_duelist","label":"Starter 10 — Elemental Lord / Conqueror / Arcane Duelist"},{"key":"starter_11_renegade_conqueror_arcane_duelist","label":"Starter 11 — Renegade / Conqueror / Arcane Duelist"},{"key":"starter_12_grand_arbalest_crusader_grand_ranger","label":"Starter 12 — Grand Arbalest / Crusader / Grand Ranger"},{"key":"starter_13_grand_ranger_conqueror_elemental_lord","label":"Starter 13 — Grand Ranger / Conqueror / Elemental Lord"},{"key":"starter_14_grand_arbalest_conqueror_renegade","label":"Starter 14 — Grand Arbalest / Conqueror / Renegade"},{"key":"starter_15_elemental_lord_crusader_saint","label":"Starter 15 — Elemental Lord / Crusader / Saint"}];
  var DECK_KEY='grandis_legacy_pvp_v20_deck';
  var LOADED_DECK_KEY='grandis_legacy_pvp_v20_loaded_deck';
  var SEAT_TOKEN_KEY='grandis_legacy_pvp_v20_seat_token';
  function $(id){return document.getElementById(id);} 
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  function safeRoom(v){var x=String(v||'LOBBY').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,48);return x||'LOBBY';}
  function safeName(v){var x=String(v||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,48);return x;}
  function id(){try{var existing=localStorage.getItem(STORE_KEY);if(existing)return existing;var x='c_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(STORE_KEY,x);return x;}catch(e){return 'c_'+Math.random().toString(36).slice(2);}}
  function bridge(){return window.GL_LOCAL_AI_BRIDGE||null;}
  function localSeat(){return state.snapshot&&state.snapshot.local&&state.snapshot.local.seat||null;}
  function localRole(){return state.snapshot&&state.snapshot.local&&state.snapshot.local.role||state.role;}
  function match(){return state.snapshot&&state.snapshot.match||null;}
  function appState(){var b=bridge();return b&&b.getSnapshot&&b.getSnapshot().appState||null;}
  function deckLabel(key){var d=DECK_OPTIONS.find(function(x){return x.key===key;});return d?d.label:'';}
  function deckSelectOptions(selected){return '<option value="">Choose starter deck...</option>'+DECK_OPTIONS.map(function(d){return '<option value="'+esc(d.key)+'" '+(d.key===selected?'selected':'')+'>'+esc(d.label)+'</option>';}).join('');}
  function activeLoadedDeckKey(){return state.loadedDeckKey||((state.snapshot&&state.snapshot.local&&state.snapshot.local.deckKey)||'');}
  function loadedDeckLabel(){return state.customDeckName||(state.snapshot&&state.snapshot.local&&state.snapshot.local.deckName)||deckLabel(activeLoadedDeckKey())||'';}
  function starterObject(key){var b=bridge();try{var opts=b&&b.getStarterDeckOptions&&b.getStarterDeckOptions();return opts&&(opts[key]||opts[String(key)]);}catch(e){return null;}}
  function starterDeckData(key){var o=starterObject(key);return o&&o.deck?o.deck:null;}
  function cardLookup(id){var defs=window.GL_CARD_DEFINITIONS;if(!defs)return null;if(!cardLookup._map){var map={};if(Array.isArray(defs.cards))defs.cards.forEach(function(c){if(c&&c.card_id)map[c.card_id]=c;});else Object.keys(defs.families||{}).forEach(function(f){((defs.families[f]&&defs.families[f].cards)||[]).forEach(function(c){if(c&&c.card_id)map[c.card_id]=c;});});cardLookup._map=map;}return cardLookup._map[id]||null;}
  function cardDisplayName(id){var c=cardLookup(id);return (c&&(c.name||c.card_name))||id||'Unknown';}
  function thumbFor(id){var p;if(id==='__HIDDEN_CARD_BACK__'||id==='__HIDDEN_CARD__')p='assets/cards/ui/Back-of-Card-Main-Deck.webp';else{var root=window.GL_ASSET_MANIFEST||{};var m=(root.cards&&root.cards[id])||root[id];p=(m&&(m.local_thumb_path||m.local_full_path||m.thumb_url||m.full_url))||'assets/cards/ui/Back-of-Card-Main-Deck.webp';}return p+(p.indexOf('?')===-1?'?':'&')+'v=gl-pvp-2.5.16';}
  function currentSelectedDeckData(){return state.customDeck||starterDeckData(state.deckKey)||starterDeckData(activeLoadedDeckKey());}
  function deckFormationHtml(){var d=currentSelectedDeckData();var form=d&&d.default_formation||{};var lanes=['LEFT','CENTER','RIGHT'];if(!d)return '<div class="pvp-empty-deck">Choose and load a starter deck first.</div>';return lanes.map(function(lane){var id=form[lane]||'';return '<div class="pvp-formation-card"><b>'+esc(lane)+'</b><strong>'+esc(cardDisplayName(id))+'</strong><small>'+esc(id)+'</small></div>';}).join('');}
  function localPlayer(){return state.snapshot&&state.snapshot.local||null;}
  function opponentPlayer(){var snap=state.snapshot,me=localPlayer();if(!snap||!me||!snap.players)return null;return snap.players.find(function(p){return p.seat&&p.seat!==me.seat;})||null;}
  function opponentLabel(){var p=opponentPlayer();return p&&p.name?p.name:(localSeat()===2?'Player 1':'Player 2');}
  function playerNameForSeat(seat){var ps=state.snapshot&&state.snapshot.players||[];var p=ps.find(function(x){return Number(x.seat)===Number(seat);});return p&&p.name?p.name:('Player '+seat);}
  function selfLabel(){var me=localPlayer();return me&&me.name?me.name:(localSeat()===2?'Player 2':'Player 1');}
  function sideLabel(side){return side==='AI'?opponentLabel():(side==='PLAYER'?selfLabel():side);}
  function humanizeRuntimeText(v){return String(v==null?'':v).replace(/\bAI\b/g,opponentLabel()).replace(/\bPLAYER\b/g,selfLabel());}
  var COIN_HEAD_SRC='assets/cards/ui/Racial-Token-Head.png?v=gl-pvp-2.5.16';
  var COIN_TAIL_SRC='assets/cards/ui/Racial-Token-Tail.png?v=gl-pvp-2.5.16';
  function coinFaceSrc(face){return String(face||'').toUpperCase()==='TAILS'?COIN_TAIL_SRC:COIN_HEAD_SRC;}
  function coinFaceLabel(face){return String(face||'').toUpperCase()==='TAILS'?'Tails':'Heads';}
  function coinChoiceButton(id,face,scope){var label=coinFaceLabel(face);return '<button id="'+id+'" class="pvp-coin-choice '+(scope||'')+'" type="button" aria-label="Choose '+label+'"><img src="'+coinFaceSrc(face)+'" alt="'+label+'"></button>';}
  function coinChoiceDisplay(face,scope){var label=coinFaceLabel(face);return '<button class="pvp-coin-choice '+(scope||'')+' waiting-display" type="button" disabled aria-disabled="true" aria-label="'+label+' — waiting for opponent choice"><img src="'+coinFaceSrc(face)+'" alt="'+label+'"></button>';}
  function coinFaceDisplay(face,extraClass){var label=coinFaceLabel(face),cls='pvp-coin-result-face'+(extraClass?' '+extraClass:'');return '<img class="'+cls+'" src="'+coinFaceSrc(face)+'" alt="'+label+'">';}
  function setPvpCoinFaceElement(img,face){if(!img)return;var f=String(face||'HEADS').toUpperCase()==='TAILS'?'TAILS':'HEADS';img.src=coinFaceSrc(f);img.alt=coinFaceLabel(f);}
  function pvpCoinResultKey(m){var f=m&&m.openingCoinFlip;return f?[f.choice,f.outcome,f.firstSeat||f.firstPlayerName||''].join('|'):'';}
  function pvpCoinResultReady(m){var key=pvpCoinResultKey(m);return !!key&&state.coinResultReadyKey===key;}
  function animatePvpCoinOutcomeFaces(outcome,onComplete){
    if(typeof document==='undefined'){if(onComplete)onComplete();return false;}
    outcome=String(outcome||'HEADS').toUpperCase()==='TAILS'?'TAILS':'HEADS';
    var nodes=Array.prototype.slice.call(document.querySelectorAll('.pvp-coin-outcome-flip'));if(!nodes.length){if(onComplete)onComplete();return false;}
    var remaining=nodes.length;
    nodes.forEach(function(img){
      var visualFace=outcome==='HEADS'?'TAILS':'HEADS',step=0,totalSteps=8,halfDuration=72,finished=false;
      setPvpCoinFaceElement(img,visualFace);img.style.filter='none';img.style.backfaceVisibility='hidden';img.style.transform='translateY(0) scaleX(1)';
      function done(){if(finished)return;finished=true;setPvpCoinFaceElement(img,outcome);img.style.transition='none';img.style.transform='translateY(0) scaleX(1)';img.style.filter='none';remaining--;if(!remaining&&onComplete)setTimeout(onComplete,1000);}
      function runStep(){if(step>=totalSteps){done();return;}var progress=(step+1)/totalSteps,lift=Math.round(Math.sin(progress*Math.PI)*18);img.style.transition='transform '+halfDuration+'ms cubic-bezier(.45,0,.55,1)';img.style.transform='translateY(-'+lift+'px) scaleX(.04)';setTimeout(function(){visualFace=visualFace==='HEADS'?'TAILS':'HEADS';setPvpCoinFaceElement(img,visualFace);img.style.transition='transform '+halfDuration+'ms cubic-bezier(.2,.75,.3,1)';img.style.transform='translateY(-'+lift+'px) scaleX(1)';setTimeout(function(){step++;runStep();},halfDuration);},halfDuration);}
      runStep();
    });
    return true;
  }
  function maybeAnimatePvpCoinResult(m){
    if(!m||m.status!=='coin-result'||!m.openingCoinFlip){state.lastCoinAnimationKey='';state.coinResultReadyKey='';return false;}
    var key=pvpCoinResultKey(m);if(state.lastCoinAnimationKey===key)return false;state.lastCoinAnimationKey=key;state.coinResultReadyKey='';
    var start=function(){animatePvpCoinOutcomeFaces(m.openingCoinFlip.outcome,function(){state.coinResultReadyKey=key;renderPanel();syncBattlefieldCoinModal();});};if(typeof requestAnimationFrame==='function')requestAnimationFrame(start);else setTimeout(start,0);return true;
  }
  function openingFlipText(m){var f=m&&m.openingCoinFlip;if(!f)return '';var starter=f.firstPlayerName||f.firstSeatLabel||('Player '+(f.firstSeat||'?'));return 'Opening Coin Flip complete. '+starter+' starts in Draw Phase.';}
  function coinFlipControlHtml(m,me){m=m||{};var cf=m.coinFlip||{},chooser=playerNameForSeat(2);if(m.status==='coin-flip'&&cf.pending){if(me&&me.role==='player'&&me.seat===2){return '<div class="pvp-coin-box"><b>Opening Coin Flip</b><span>Choose one coin face.</span><div class="pvp-coin-actions">'+coinChoiceButton('pvpChooseHeadsButton','HEADS','compact')+coinChoiceButton('pvpChooseTailsButton','TAILS','compact')+'</div></div>';}return '<div class="pvp-coin-box waiting"><b>Opening Coin Flip</b><span>Waiting for '+esc(chooser)+' to choose.</span><div class="pvp-coin-actions">'+coinChoiceDisplay('HEADS','compact')+coinChoiceDisplay('TAILS','compact')+'</div></div>';}if(m.status==='coin-result'&&m.openingCoinFlip){return '<div class="pvp-coin-box result"><b>Opening Coin Flip Result</b><div class="pvp-coin-result-grid compact"><div><span>'+esc(chooser)+' chose</span>'+coinFaceDisplay(m.openingCoinFlip.choice)+'</div><div><span>Coin result</span>'+coinFaceDisplay(m.openingCoinFlip.outcome,'pvp-coin-outcome-flip')+'</div></div><span>'+esc(openingFlipText(m))+'</span><div class="pvp-coin-actions single"><button id="pvpConfirmCoinButton" class="gold" type="button" '+(pvpCoinResultReady(m)?'':'disabled aria-disabled="true"')+'>Start Game</button></div></div>';}if(m.status==='started'&&m.openingCoinFlip){return '<div class="pvp-coin-box done"><b>Opening Coin Flip</b><span>'+esc(openingFlipText(m))+'</span></div>';}return '<div class="pvp-coin-box idle"><b>Opening Coin Flip</b><span>'+esc(chooser)+' chooses one coin face after Player 1 starts the match.</span></div>';}
  function wireCoinButtons(){var h=$('pvpChooseHeadsButton'),t=$('pvpChooseTailsButton'),c=$('pvpConfirmCoinButton');if(h)h.onclick=function(){send('choose-coin-flip',{choice:'HEADS'});};if(t)t.onclick=function(){send('choose-coin-flip',{choice:'TAILS'});};if(c)c.onclick=function(){send('confirm-coin-flip');};}
  function closeBattlefieldCoinModal(){var el=$('pvpBattlefieldCoinModal');if(el)el.remove();}
  function syncBattlefieldCoinModal(){var snap=state.snapshot||{},m=snap.match||{},me=snap.local||{},chooser=playerNameForSeat(2);var html='';if(m.status==='coin-flip'&&m.coinFlip&&m.coinFlip.pending&&m.serverBoard){if(me&&me.role==='player'&&me.seat===2){html='<div class="pvp-coin-modal-card"><h2>Opening Coin Flip</h2><p>Choose one coin face.</p><div class="pvp-coin-modal-actions">'+coinChoiceButton('pvpBattleHeads','HEADS','battlefield')+coinChoiceButton('pvpBattleTails','TAILS','battlefield')+'</div></div>';}else{html='<div class="pvp-coin-modal-card waiting-mirror"><h2>Opening Coin Flip</h2><p>Waiting for <b>'+esc(chooser)+'</b> to choose.</p><div class="pvp-coin-modal-actions">'+coinChoiceDisplay('HEADS','battlefield')+coinChoiceDisplay('TAILS','battlefield')+'</div></div>';}}else if(m.status==='coin-result'&&m.openingCoinFlip&&m.serverBoard){var f=m.openingCoinFlip;html='<div class="pvp-coin-modal-card"><h2>Opening Coin Flip Result</h2><p>Review the result, then start Round 1.</p><div class="pvp-coin-result-grid"><div><span>'+esc(chooser)+' chose</span>'+coinFaceDisplay(f.choice)+'</div><div><span>Coin result</span>'+coinFaceDisplay(f.outcome,'pvp-coin-outcome-flip')+'</div></div><div class="pvp-coin-wait"><b>'+esc(f.firstPlayerName||f.firstSeatLabel||'Winner')+'</b> starts first.</div><div class="pvp-coin-modal-actions single"><button id="pvpBattleConfirmCoin" class="gold" type="button" '+(pvpCoinResultReady(m)?'':'disabled aria-disabled="true"')+'>Start Game</button></div></div>';}else{closeBattlefieldCoinModal();return;}var modal=$('pvpBattlefieldCoinModal');if(!modal){modal=document.createElement('div');modal.id='pvpBattlefieldCoinModal';modal.className='pvp-coin-modal';document.body.appendChild(modal);}modal.innerHTML=html;var h=$('pvpBattleHeads'),t=$('pvpBattleTails'),c=$('pvpBattleConfirmCoin');if(h)h.onclick=function(){send('choose-coin-flip',{choice:'HEADS'});};if(t)t.onclick=function(){send('choose-coin-flip',{choice:'TAILS'});};if(c)c.onclick=function(){send('confirm-coin-flip');};}
  function initState(){var u=new URL(location.href);state.clientId=id();try{state.seatToken=localStorage.getItem(SEAT_TOKEN_KEY)||'';}catch(e){state.seatToken='';}state.room=safeRoom(u.searchParams.get('room')||localStorage.getItem(ROOM_KEY)||'LOBBY');state.name=safeName(u.searchParams.get('name')||localStorage.getItem(NAME_KEY)||'');state.role=(u.searchParams.get('role')||localStorage.getItem(ROLE_KEY)||'player').toLowerCase()==='spectator'?'spectator':'player';state.deckKey=String(u.searchParams.get('deck')||localStorage.getItem(DECK_KEY)||'');if(!DECK_OPTIONS.some(function(d){return d.key===state.deckKey;}))state.deckKey='';state.loadedDeckKey=String(u.searchParams.get('deck')||localStorage.getItem(LOADED_DECK_KEY)||state.deckKey||'');if(!DECK_OPTIONS.some(function(d){return d.key===state.loadedDeckKey;}))state.loadedDeckKey='';}
  function wsUrl(){var protocol=location.protocol==='https:'?'wss:':'ws:';var q=new URLSearchParams({room:state.room,client:state.clientId,name:state.name||'Player',role:state.role});if(state.seatToken)q.set('seatToken',state.seatToken);var dk=activeLoadedDeckKey()||state.deckKey;if(dk)q.set('deck',dk);return protocol+'//'+location.host+'/ws?'+q.toString();}
  function send(type,payload){if(!ws||ws.readyState!==WebSocket.OPEN){setStatus('offline','Not connected.');return false;}ws.send(JSON.stringify(Object.assign({type:type},payload||{})));return true;}
  function setStatus(cls,msg){var el=$('pvpNetworkStatus');if(el){el.className='pvp-net-status '+cls;el.textContent=msg;} }
  function currentRevision(){var m=match();return Number(m&&m.serverBoardRevision||0);}
  function clearIntentLock(reason){
    if(intentTimeoutTimer){clearTimeout(intentTimeoutTimer);intentTimeoutTimer=null;}
    state.intentInFlight=false;state.intentBaseRevision=0;state.intentName='';state.intentSentAt=0;
    if(reason==='timeout')setStatus('connecting','Server response timed out. Latest board is still usable; retry the action.');
  }
  function armIntentTimeout(){
    if(intentTimeoutTimer)clearTimeout(intentTimeoutTimer);
    intentTimeoutTimer=setTimeout(function(){
      if(!state.intentInFlight)return;
      clearIntentLock('timeout');
      importServerBoard(true);
    },8000);
  }
  function clearTransientUiState(reason){
    clearIntentLock();
    state.seenAnimationIds={};state.lastCoinAnimationKey='';state.coinResultReadyKey='';
    closeBattlefieldCoinModal();
    closeAuthoritativeDrawReview();
    ['choiceOverlay','infoOverlay','responseOverlay','previewOverlay'].forEach(function(id){var el=$(id);if(el){el.classList.remove('open','deck-setup-open','hand-discard-open');el.removeAttribute('data-pvp-authoritative-draw-review');}});
    var clearIds=['choiceBody','infoBody','responseBody','responseFooter','previewBody'];clearIds.forEach(function(id){var el=$(id);if(el)el.innerHTML='';});
    var choiceConfirm=$('choiceConfirm');if(choiceConfirm){choiceConfirm.style.display='';choiceConfirm.disabled=false;choiceConfirm.textContent='Confirm';}
    var title=$('choiceTitle');if(title)title.textContent='Choice';
    var infoTitle=$('infoTitle');if(infoTitle)infoTitle.textContent='Info';
    document.querySelectorAll('.pvp-coin-modal,.pvp-result-modal,.runtime-debug-overlay').forEach(function(el){if(el&&el.parentNode)el.parentNode.removeChild(el);});
    document.body.classList.remove('modal-open','choice-open','response-open');
    if(reason)setStatus('online','Cleared previous match popups.');
  }
  function closeAuthoritativeDrawReview(){
    var overlay=$('choiceOverlay');
    if(overlay&&overlay.getAttribute&&overlay.getAttribute('data-pvp-authoritative-draw-review')==='1'){
      overlay.classList.remove('open');overlay.removeAttribute('data-pvp-authoritative-draw-review');
    }
  }
  function syncAuthoritativeDrawReview(){
    var s=appState(),p=s&&s.pending,b=bridge();
    if(!p||p.type!=='draw_replacement_choice'||!localOwnsPending()){closeAuthoritativeDrawReview();return false;}
    // The Local AI v5.16 renderer owns both markup and behavior. On every server import,
    // explicitly rebuild the popup from the authoritative pending object so an old/empty
    // choice body can never survive a network snapshot.
    if(b&&b.renderCurrentAuthoritativePendingChoice)return !!b.renderCurrentAuthoritativePendingChoice();
    return false;
  }
  function swapSideForSeat(side,seat){if(Number(seat)!==2)return side;return side==='PLAYER'?'AI':(side==='AI'?'PLAYER':side);}
  function localizeAnimationEvent(evt,seat){
    if(!evt)return null;var x=JSON.parse(JSON.stringify(evt));
    ['actor_side','source_side','target_side'].forEach(function(k){if(x[k])x[k]=swapSideForSeat(x[k],seat);});
    if(x.destination&&x.destination.side)x.destination.side=swapSideForSeat(x.destination.side,seat);
    return x;
  }
  function unseenAnimationEvents(m){
    var list=Array.isArray(m&&m.lastAnimationEvents)?m.lastAnimationEvents.slice():((m&&m.lastAnimationEvent)?[m.lastAnimationEvent]:[]);
    return list.filter(function(raw){return raw&&raw.id&&!state.seenAnimationIds[raw.id];});
  }
  function prepareAuthoritativeAnimations(m,seat,rev){
    var b=bridge();if(!b)return [];
    var plans=[];
    unseenAnimationEvents(m).forEach(function(raw){
      var evt=localizeAnimationEvent(raw,seat),plan={event:evt,captured:null};
      if(evt.kind==='card_play'&&b.captureAuthoritativePlayedCardMotion){
        plan.captured=b.captureAuthoritativePlayedCardMotion(evt.card_id,evt.actor_side,{hand_index:evt.hand_index,source_side:evt.source_side||evt.actor_side,source_lane:evt.source_lane,target_side:evt.target_side,target_lane:evt.target_lane,target_lanes:evt.target_lanes,triple_shot_area:!!evt.triple_shot_area});
      }else if(evt.kind==='tribute'&&b.captureAuthoritativeTributeMotion){
        plan.captured=b.captureAuthoritativeTributeMotion(evt.actor_side,evt.hand_index,evt.card_id,evt.target_lane);
      }else if(evt.kind==='rank_up'&&b.captureAuthoritativeRankUpMotion){
        plan.captured=b.captureAuthoritativeRankUpMotion(evt.actor_side,evt.lane,evt.to_card_id,evt.exp_card_ids||[]);
      }else if(evt.kind==='draw'&&b.captureAuthoritativeDrawMotions){
        plan.captured=b.captureAuthoritativeDrawMotions(evt.actor_side,evt.card_ids||[evt.card_id],evt.count||1);
      }
      state.seenAnimationIds[raw.id]=true;
      plans.push(plan);
    });
    return plans;
  }
  function playAuthoritativeAnimations(plans){
    var b=bridge();if(!b)return false;var ok=false;
    (plans||[]).forEach(function(plan){
      var evt=plan&&plan.event;if(!evt)return;
      if(evt.kind==='card_play'&&plan.captured&&b.commitAuthoritativePlayedCardMotion)ok=b.commitAuthoritativePlayedCardMotion(plan.captured,evt.destination||{type:'target'})||ok;
      else if(evt.kind==='tribute'&&plan.captured&&b.queueAuthoritativeTributeMotion)ok=b.queueAuthoritativeTributeMotion(plan.captured)||ok;
      else if(evt.kind==='rank_up'&&plan.captured&&b.queueCapturedAuthoritativeRankUpMotion)ok=b.queueCapturedAuthoritativeRankUpMotion(plan.captured)||ok;
      else if(evt.kind==='rank_up'&&b.queueAuthoritativeRankUpMotion)ok=b.queueAuthoritativeRankUpMotion(evt.actor_side,evt.lane,evt.to_card_id,evt.exp_card_ids||[])||ok;
      else if(evt.kind==='draw'&&plan.captured&&b.queueCapturedAuthoritativeDrawMotions)ok=b.queueCapturedAuthoritativeDrawMotions(plan.captured)||ok;
      else if(evt.kind==='draw'&&b.queueAuthoritativeDrawMotion)ok=b.queueAuthoritativeDrawMotion(evt.actor_side,evt.card_id,evt.count||1)||ok;
      else if(evt.kind==='legacy_to_field'&&b.queueAuthoritativeLegacyToFieldMotion)ok=b.queueAuthoritativeLegacyToFieldMotion(evt.actor_side,evt.lane,evt.card_id)||ok;
    });
    return ok;
  }
  function importServerBoard(force){var b=bridge(),m=match(),seat=localSeat();if(!b||!m||!m.serverBoard||!seat)return false;var rev=Number(m.serverBoardRevision||0);if(!force&&rev<=state.lastAppliedRevision)return false;var animationPlans=prepareAuthoritativeAnimations(m,seat,rev);state.applyingServer=true;b.setSharedBoardMode(true);window.GL_PVP_LOCAL_SEAT=seat;window.GL_PVP_LOCAL_ROLE=localRole();try{var firstNotice=(rev<=2&&!m.lastIntent&&openingFlipText(m))||'';var notice=firstNotice||('Server authoritative board r'+rev+' applied.');b.importCanonicalSnapshot(m.serverBoard,seat,{notice:notice,skipImportAnimations:true});playAuthoritativeAnimations(animationPlans);syncAuthoritativeDrawReview();if(b.renderCurrentAuthoritativePendingChoice)b.renderCurrentAuthoritativePendingChoice();humanizeVisibleLabels();document.body.classList.remove('pvp-booting');state.lastAppliedRevision=rev;setStatus('online',firstNotice||('Server board r'+rev+' applied'));}finally{state.applyingServer=false;}return true;}
  function pendingDecisionSide(p){if(!p)return null;return p.decision_side||p.response_owner||p.side||p.source_side||(p.type==='hand_limit_discard'?'PLAYER':null)||(p.type==='manual_reposition'?'PLAYER':null);}
  function localOwnsPending(){var s=appState(),p=s&&s.pending;if(!p)return true;return pendingDecisionSide(p)==='PLAYER';}
  function localOwnsResponse(){var s=appState(),rw=s&&s.responseWindow;if(!rw)return true;return rw.response_owner==='PLAYER';}
  function intentNeedsPendingOwner(intent){return ['chooseHeroFromBoard','setArrowBarrageSpend','selectStatusRemovalChoice','selectSaintPurifyChoice','resolveStonebloodChoice','selectScoutingExpChoice','moveCrystalBallOrder','performDualArrowPairChoice','toggleDiscardIndex','selectCardSearchChoice','selectLegacyDefeatChoice','selectLegacyCostChoice','selectLegacyCardChoice','commitDrawReplacementChoice','confirmDrawReplacement','commitMagicalSurgeChoice','commitResponseExtraDiscardChoice','selectOpponentHandChoice','commitOpponentHandChoice','selectResponseExtraDiscardChoice','performOptionalSwapDecision','performOptionalTargetSwapDecision','resolveSecondChanceChoice','performManualReposition','handleChoiceConfirm'].indexOf(intent)!==-1;}
  function intentNeedsResponseOwner(intent){return ['responseSelectNoStuck','confirmSelectedResponse','responsePassNoStuck'].indexOf(intent)!==-1;}
  function runtimeIntent(intent,args){var me=state.snapshot&&state.snapshot.local;if(!me||me.role!=='player'){setStatus('offline','Spectator is read-only.');return false;}var m=match();if(!m||m.status!=='started'){setStatus('offline','Start server match first.');return false;}if(state.applyingServer){setStatus('connecting','Applying the latest server board. Please try again.');return false;}if(state.intentInFlight){setStatus('connecting','Waiting for the server to resolve '+(state.intentName||'the previous action')+'...');return false;}if(intentNeedsResponseOwner(intent)&&!localOwnsResponse()){setStatus('online','Waiting for opponent response.');return false;}if(intentNeedsPendingOwner(intent)&&!localOwnsPending()){setStatus('online','Waiting for opponent decision.');return false;}var base=currentRevision();var ok=send('runtime-intent',{intent:intent,args:args||[],baseRevision:base});if(ok){state.intentInFlight=true;state.intentBaseRevision=base;state.intentName=intent;state.intentSentAt=Date.now();armIntentTimeout();}return ok;}
  function prevent(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}
  function isLocalUiOnlyClick(t){return !!(t&&t.closest&&t.closest('[data-preview],#previewClose,#previewOverlay,[data-info-title],#infoClose,#infoOverlay,[data-op-event-id],[data-op-archive-id],[data-discard-side],#historyButton,#historyButtonBottom,#opponentPlayedPreviewButton,#confirmSurrenderNo'));}
  function isGameplayInteractive(t){return !!(t&&t.closest&&t.closest('#app button,#app [role="button"],#app input,#app select,#app textarea,#app .hero-panel,#choiceOverlay button,#responseOverlay button'));}
  function pendingRevealsHiddenInformation(p){
    if(!p)return false;
    if(p.type==='card_search_choice'&&(p.zone==='deck'||p.zone==='legacy_deck'))return true;
    if(p.type==='legacy_card_choice'&&p.choice_zone==='deck_top')return true;
    if(p.type==='opponent_hand_choice'&&p.reveal_cards)return true;
    if(p.type==='crystal_ball_reorder')return true;
    return false;
  }
  function pendingClosePolicy(s,p){
    if(!p)return 'CLOSE_ONLY';
    var bridgePolicy=bridge()&&bridge().getPendingClosePolicy;try{if(bridgePolicy){var x=bridgePolicy();if(x)return x;}}catch(e){}
    if(p.type==='optional_swap'||p.type==='optional_target_swap'||p.type==='post_attack_reposition_choice'||p.type==='racial_second_chance')return 'POST_RESOLUTION_DECLINE';
    if(['legacy_defeat_choice','hand_limit_discard','draw_replacement_choice','response_window'].indexOf(p.type)!==-1)return 'MANDATORY_NO_CANCEL';
    if(pendingRevealsHiddenInformation(p)||(s&&s.responseWindow))return 'MANDATORY_NO_CANCEL';
    if(['source_selection','target_selection','optional_magical_surge','mana_spend_choice','scouting_target_selection','scouting_exp_selection','status_removal_choice','tribute_target','racial_target_selection','hero_ability_target_selection','legacy_cost_selection','legacy_hero_target_selection','manual_reposition','lane_pair_selection'].indexOf(p.type)!==-1)return 'PRE_COMMIT_CANCEL';
    return 'MANDATORY_NO_CANCEL';
  }
  function blockGameplayClick(ev,msg){prevent(ev);setStatus('connecting',msg||'Waiting for the authoritative server board.');return true;}
  function mapGameplayClick(ev){
    var t=ev.target;
    if(state.applyingServer){if(isGameplayInteractive(t))return blockGameplayClick(ev,'Applying the latest server board...');return false;}
    var node;
    if((node=t.closest&&t.closest('#pvpResultBackLobby'))){prevent(ev);clearTransientUiState('reset');send('reset-room');return true;}
    var panel=ev.target.closest&&ev.target.closest('#pvpNetworkPanel,#pvpSetupOverlay'); if(panel)return false;
    var m=match();
    if((node=t.closest&&t.closest('#surrenderButton'))){prevent(ev);if(localRole()!=='player'){setStatus('offline','Spectator is read-only.');return true;}if(!m||['started','coin-flip','coin-result'].indexOf(m.status)===-1){setStatus('offline','No active PvP match to surrender.');return true;}if(confirm('Surrender this PvP match?'))send('surrender-match');return true;}
    if((node=t.closest&&t.closest('#confirmSurrenderYes'))){prevent(ev);send('surrender-match');return true;}
    if(!m||m.status!=='started')return false;
    if(localRole()!=='player'){if(isLocalUiOnlyClick(t))return false;if(isGameplayInteractive(t)){prevent(ev);setStatus('offline','Spectator is read-only. Local gameplay mutation was blocked.');return true;}return false;}
    if((node=t.closest('#nextPhaseButton'))){prevent(ev);if(node.getAttribute('data-pvp-turn-ack')==='1')return acknowledgeLocalTurn();return runtimeIntent('advancePhase',[]);}
    if((node=t.closest('#cancelActionButton,#manualRepositionCancel'))){prevent(ev);return runtimeIntent('cancelPendingAction',[]);}
    if((node=t.closest('#choiceConfirm'))){prevent(ev);var cs=appState(),cp=cs&&cs.pending;if(cp&&cp.type==='response_extra_discard_choice')return runtimeIntent('commitResponseExtraDiscardChoice',[]);return runtimeIntent('handleChoiceConfirm',[]);}
    if((node=t.closest('[data-pvp-draw-review]'))){prevent(ev);return runtimeIntent('confirmDrawReplacement',[node.getAttribute('data-pvp-draw-review')]);}
    if((node=t.closest('[data-draw-replacement-choice]'))){prevent(ev);return runtimeIntent('confirmDrawReplacement',[node.getAttribute('data-draw-replacement-choice')==='redraw'?'redraw':'keep']);}
    if((node=t.closest('[data-magical-surge-choice]'))){prevent(ev);return runtimeIntent('commitMagicalSurgeChoice',[node.getAttribute('data-magical-surge-choice')==='yes']);}
    if((node=t.closest('[data-second-chance-choice]'))){prevent(ev);return runtimeIntent('resolveSecondChanceChoice',[node.getAttribute('data-second-chance-choice')==='use']);}
    if((node=t.closest('[data-opponent-hand-choice]'))){prevent(ev);return runtimeIntent('selectOpponentHandChoice',[Number(node.getAttribute('data-opponent-hand-choice'))]);}
    if((node=t.closest('[data-response-extra-discard-index]'))){prevent(ev);return runtimeIntent('selectResponseExtraDiscardChoice',[Number(node.getAttribute('data-response-extra-discard-index'))]);}
    if((node=t.closest('[data-source-swap-lane]'))){prevent(ev);return runtimeIntent('performOptionalSwapDecision',[node.getAttribute('data-source-swap-lane')]);}
    if((node=t.closest('#repositionButton'))){prevent(ev);return runtimeIntent('openManualRepositionChoice',[]);}
    if((node=t.closest('[data-play-index]'))){prevent(ev);return runtimeIntent('beginPlayFromHand',[Number(node.getAttribute('data-play-index'))]);}
    if((node=t.closest('[data-tribute-index]'))){prevent(ev);return runtimeIntent('beginTributeFromHand',[Number(node.getAttribute('data-tribute-index'))]);}
    if((node=t.closest('.hero-panel'))){var s=appState(); if(s&&s.pending&&['source_selection','target_selection','exact_two_target_selection','scouting_target_selection','tribute_target','racial_target_selection','hero_ability_target_selection','legacy_hero_target_selection'].indexOf(s.pending.type)!==-1){prevent(ev);return runtimeIntent('chooseHeroFromBoard',[node.getAttribute('data-side'),node.getAttribute('data-lane')]);}}
    if((node=t.closest('[data-mana-spend]'))){prevent(ev);return runtimeIntent('setArrowBarrageSpend',[Number(node.getAttribute('data-mana-spend'))]);}
    if((node=t.closest('[data-status-removal-index]'))){prevent(ev);return runtimeIntent('selectStatusRemovalChoice',[Number(node.getAttribute('data-status-removal-index'))]);}
    if((node=t.closest('[data-saint-status-index]'))){prevent(ev);return runtimeIntent('selectSaintPurifyChoice',[Number(node.getAttribute('data-saint-status-index'))]);}
    if((node=t.closest('[data-stoneblood-choice]'))){prevent(ev);return runtimeIntent('resolveStonebloodChoice',[node.getAttribute('data-stoneblood-choice')==='use']);}
    if((node=t.closest('[data-scouting-exp-choice]'))){prevent(ev);return runtimeIntent('selectScoutingExpChoice',[Number(node.getAttribute('data-scouting-exp-choice'))]);}
    if((node=t.closest('[data-crystal-move]'))){prevent(ev);return runtimeIntent('moveCrystalBallOrder',[node.getAttribute('data-crystal-move')]);}
    if((node=t.closest('[data-dual-arrow-target]'))){prevent(ev);return runtimeIntent('performDualArrowPairChoice',[node.getAttribute('data-dual-arrow-target')]);}
    if((node=t.closest('[data-dual-arrow-pair]'))){prevent(ev);return runtimeIntent('performDualArrowPairChoice',[node.getAttribute('data-dual-arrow-pair')]);}
    if((node=t.closest('[data-discard-index]'))){prevent(ev);return runtimeIntent('toggleDiscardIndex',[Number(node.getAttribute('data-discard-index'))]);}
    if((node=t.closest('[data-search-choice-index]'))){prevent(ev);return runtimeIntent('selectCardSearchChoice',[Number(node.getAttribute('data-search-choice-index'))]);}
    if((node=t.closest('[data-legacy-defeat-choice]'))){prevent(ev);return runtimeIntent('selectLegacyDefeatChoice',[Number(node.getAttribute('data-legacy-defeat-choice'))]);}
    if((node=t.closest('[data-legacy-cost-index]'))){prevent(ev);return runtimeIntent('selectLegacyCostChoice',[Number(node.getAttribute('data-legacy-cost-index'))]);}
    if((node=t.closest('[data-legacy-card-choice]'))){prevent(ev);return runtimeIntent('selectLegacyCardChoice',[Number(node.getAttribute('data-legacy-card-choice'))]);}
    if((node=t.closest('[data-response-select]'))){prevent(ev);return runtimeIntent('responseSelectNoStuck',[Number(node.getAttribute('data-response-select'))]);}
    if((node=t.closest('#responseConfirmButton,#responseResolveButton'))){prevent(ev);return runtimeIntent('confirmSelectedResponse',[]);}
    if((node=t.closest('#responsePassButton,#responseClose'))){prevent(ev);return runtimeIntent('responsePassNoStuck',[]);}
    if((node=t.closest('#optionalSwapYes'))){prevent(ev);return runtimeIntent('performOptionalSwapDecision',[true]);}
    if((node=t.closest('#optionalSwapNo'))){prevent(ev);return runtimeIntent('performOptionalSwapDecision',[false]);}
    if((node=t.closest('[data-target-swap-lane]'))){prevent(ev);return runtimeIntent('performOptionalTargetSwapDecision',[node.getAttribute('data-target-swap-lane')]);}
    if((node=t.closest('#optionalTargetSwapNo'))){prevent(ev);return runtimeIntent('performOptionalTargetSwapDecision',[null]);}
    if((node=t.closest('[data-class-ability-id]'))){prevent(ev);return runtimeIntent('beginActivatedHeroAbility',[node.getAttribute('data-class-ability-side'),node.getAttribute('data-class-ability-lane'),node.getAttribute('data-class-ability-id')]);}
    if((node=t.closest('[data-legacy-id]'))){prevent(ev);return runtimeIntent('beginActivatedLegacyAbility',[node.getAttribute('data-legacy-side'),node.getAttribute('data-legacy-lane'),node.getAttribute('data-legacy-id')]);}
    if((node=t.closest('[data-racial-id]'))){prevent(ev);return runtimeIntent('beginActivatedRacialAbility',[node.getAttribute('data-racial-side'),node.getAttribute('data-racial-lane'),node.getAttribute('data-racial-id')]);}
    if((node=t.closest('[data-reposition-pair]'))){prevent(ev);return runtimeIntent('performManualReposition',[node.getAttribute('data-reposition-pair')]);}
    if((node=t.closest('#choiceClose'))){
      var closeState=appState(),closePending=closeState&&closeState.pending;if(!closePending)return false;prevent(ev);
      var policy=pendingClosePolicy(closeState,closePending);
      if(policy==='PRE_COMMIT_CANCEL')return runtimeIntent('cancelPendingAction',[]);
      if(policy==='POST_RESOLUTION_DECLINE'){
        if(closePending.type==='optional_target_swap')return runtimeIntent('performOptionalTargetSwapDecision',[null]);
        if(closePending.type==='racial_second_chance')return runtimeIntent('resolveSecondChanceChoice',[false]);
        if(closePending.type==='post_attack_reposition_choice')return runtimeIntent('performOptionalSwapDecision',[false]);
        return runtimeIntent('performOptionalSwapDecision',[false]);
      }
      if(pendingRevealsHiddenInformation(closePending))setStatus('online','This choice revealed hidden information and must be completed.');
      else if(closeState&&closeState.responseWindow)setStatus('online','This action opened an opponent response window and cannot be cancelled.');
      else setStatus('online','This mandatory or committed choice must be completed.');
      return true;
    }
    if((node=t.closest('#startFromControl,#deckSetupButton,#startMatchButton,#resetDecks,[data-import-side]'))){prevent(ev);setStatus('online','PvP match setup and reset are controlled by the room server.');return true;}
    if((node=t.closest('#choiceConfirm'))){var s2=appState(); if(s2&&s2.pending){prevent(ev);return runtimeIntent('handleChoiceConfirm',[]);}}
    if(isLocalUiOnlyClick(t))return false;
    if(isGameplayInteractive(t)){prevent(ev);setStatus('offline','This control has no authoritative PvP intent route. Local state mutation was blocked.');return true;}
    return false;
  }

  function currentLocalTurnKey(s){
    if(!s||s.turn!=='PLAYER')return '';
    return 'round-'+Number(s.round||1)+'-player-turn';
  }
  function normalPhaseButtonText(s){return s&&s.phase==='End'?'End Turn / Cleanup':'Next Phase';}
  function acknowledgeLocalTurn(){
    var s=appState(),btn=$('nextPhaseButton'),key=currentLocalTurnKey(s);
    if(!s||s.turn!=='PLAYER'||!s.pvpTurnReady||!btn||!key)return false;
    state.acknowledgedTurnKey=key;state.pendingTurnAckKey='';
    btn.classList.remove('pvp-your-turn-pulse');btn.disabled=true;
    setStatus('connecting','Starting your Draw Phase...');
    return runtimeIntent('acknowledgePvpTurnStart',[]);
  }
  function syncTurnPhaseControl(){
    var s=appState(),btn=$('nextPhaseButton');if(!s||!btn)return;
    var localTurn=s.turn==='PLAYER',key=currentLocalTurnKey(s);
    if(!localTurn){
      state.lastObservedTurn='AI';state.pendingTurnAckKey='';
      btn.removeAttribute('data-pvp-turn-ack');btn.classList.remove('pvp-your-turn-pulse');
      btn.textContent='Opponent Turn — '+String(s.phase||'?')+' Phase';btn.disabled=true;
      return;
    }
    if(s.pvpTurnReady)state.pendingTurnAckKey=key;
    state.lastObservedTurn='PLAYER';
    if(s.pvpTurnReady){
      btn.setAttribute('data-pvp-turn-ack','1');btn.classList.add('pvp-your-turn-pulse');btn.textContent='Your Turn';
      btn.disabled=!!(s.gameOver||s.pending||state.intentInFlight);
      return;
    }
    btn.removeAttribute('data-pvp-turn-ack');btn.classList.remove('pvp-your-turn-pulse');btn.textContent=normalPhaseButtonText(s);
    btn.disabled=!!(s.gameOver||s.pending||state.intentInFlight);
  }
  function humanizeVisibleLabels(){
    var root=document.getElementById('app');
    if(!root)return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
      if(!n.nodeValue||(!/\bAI\b/.test(n.nodeValue)&&!/\bPLAYER\b/.test(n.nodeValue)))return NodeFilter.FILTER_REJECT;
      var p=n.parentElement; if(p&&['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT'].indexOf(p.tagName)!==-1)return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    var nodes=[],n;while((n=walker.nextNode()))nodes.push(n);
    nodes.forEach(function(t){t.nodeValue=t.nodeValue.replace(/\bAI\b/g,opponentLabel()).replace(/\bPLAYER\b/g,selfLabel());});
    syncTurnPhaseControl();
  }
  function installTurnPhaseStyles(){
    var style=document.createElement('style');style.id='pvp-turn-phase-style';style.textContent='\
#nextPhaseButton.pvp-your-turn-pulse{animation:pvpYourTurnPulse .9s ease-in-out infinite;will-change:box-shadow,filter,transform}\
@keyframes pvpYourTurnPulse{0%,100%{box-shadow:0 0 0 0 rgba(244,211,94,.12);filter:brightness(1);transform:translateY(0)}50%{box-shadow:0 0 0 4px rgba(244,211,94,.18),0 0 22px rgba(244,211,94,.55);filter:brightness(1.18);transform:translateY(-1px)}}\
@media(prefers-reduced-motion:reduce){#nextPhaseButton.pvp-your-turn-pulse{animation:none;box-shadow:0 0 0 3px rgba(244,211,94,.25),0 0 16px rgba(244,211,94,.35)}}';document.head.appendChild(style);
  }
  function installStyles(){var css='\
.pvp-net-panel{position:fixed;right:18px;bottom:70px;width:min(390px,calc(100vw - 36px));max-height:82vh;overflow:auto;z-index:9998;background:rgba(19,13,8,.98);border:1px solid rgba(255,215,120,.4);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);color:#f7e7c2;display:none}\
.pvp-net-panel.open{display:block}.pvp-net-inner{padding:14px}.pvp-net-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.pvp-net-head h3{margin:0;font-size:17px}.pvp-net-status{margin:10px 0;padding:8px 10px;border-radius:10px;background:#37230d}.pvp-net-status.online{background:#17361f}.pvp-net-status.offline{background:#3d1717}.pvp-net-status.connecting{background:#343317}\
.pvp-net-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin:8px 0}.pvp-net-row.three{grid-template-columns:1fr 1fr 1fr}.pvp-net-row label{display:grid;gap:4px;font-size:12px}.pvp-net-row input,.pvp-net-row select{width:100%;box-sizing:border-box;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:#120d08;color:#f7e7c2;padding:8px}.pvp-net-row button,.pvp-net-panel button{border-radius:9px;border:1px solid rgba(255,255,255,.22);background:#2c2115;color:#f7e7c2;padding:8px 10px;font-weight:700}.pvp-net-row button.gold,.pvp-net-panel button.gold{background:#6c4b14}.pvp-net-row button.danger,.pvp-net-panel button.danger{background:#5c1e1e}\
.pvp-net-box{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;margin:10px 0;background:rgba(255,255,255,.04)}.pvp-net-box h4{margin:0 0 6px}.pvp-net-small{font-size:12px;opacity:.85;line-height:1.4}.pvp-net-pill{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}.pvp-net-pill:last-child{border-bottom:0}.pvp-net-pill small{display:block;opacity:.78}.pvp-net-log{font-size:12px;max-height:170px;overflow:auto;line-height:1.35}.pvp-net-authority{font-size:12px;color:#ffe6a3;border-left:3px solid #c9962f;padding-left:8px;margin-top:8px}\
.pvp-observer-card{margin-top:10px;border:1px solid #4a637b;border-radius:11px;background:rgba(8,21,34,.9);padding:10px;display:grid;gap:6px}.pvp-observer-card b{color:#f4d88a;letter-spacing:.05em}.pvp-observer-card span{font-size:12px;line-height:1.4;color:#cbd6e2}.pvp-observer-card.authorized{border-color:#4e9e6c;background:rgba(15,52,31,.72)}.pvp-observer-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.pvp-observer-row input{min-width:0;border:1px solid #3a506b;border-radius:9px;background:#101b2a;color:#fff;padding:8px}.pvp-observer-row button{white-space:nowrap}\
body.pvp-lobby-mode{min-width:0!important;overflow-x:hidden!important}body.pvp-lobby-mode #app,body.pvp-booting #app{display:none!important;pointer-events:none;min-width:0!important}\
.pvp-setup-overlay{position:fixed;inset:0;z-index:9997;display:none;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.72);padding:22px 14px;overflow:auto}.pvp-setup-overlay.open{display:flex}.pvp-setup-shell{width:min(980px,100%);border:1px solid rgba(255,215,80,.72);border-radius:16px;background:#06101a;color:#f8f4df;box-shadow:0 28px 80px rgba(0,0,0,.72);overflow:hidden}.pvp-playtest-badge{position:absolute;top:14px;right:16px;padding:4px 8px;border-radius:999px;background:rgba(15,23,42,.88);color:#f4d88a;font-size:10px;font-weight:800;letter-spacing:.12em;line-height:1;pointer-events:none}.pvp-setup-head{position:relative;padding:16px 18px 12px;border-bottom:1px solid rgba(255,215,80,.32);background:linear-gradient(180deg,#0f1b27,#08111b)}.pvp-setup-head .eyebrow{margin:0 0 5px;color:#ffd84d;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:900}.pvp-setup-head h2{margin:0;color:#ffdf62;font-size:26px;line-height:1.1}.pvp-setup-head p{margin:6px 0 0;color:#d9d1b5;font-size:13px}.pvp-setup-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.9fr);gap:14px;padding:16px}.pvp-setup-card{border:1px solid rgba(255,215,80,.52);border-radius:14px;background:#07121c;padding:14px;min-width:0}.pvp-setup-card h3{margin:0 0 12px;color:#fff;font-size:17px}.pvp-field{display:grid;gap:6px;margin:10px 0}.pvp-field label{font-weight:800;color:#fff}.pvp-field input,.pvp-field select{width:100%;border:1px solid #39536b;border-radius:10px;background:#101b2a;color:#fff;padding:10px 11px;font-weight:700;min-height:38px}.pvp-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.pvp-actions button,.pvp-room-actions button,.pvp-deck-builder{border:1px solid #405a73;border-radius:10px;background:#122438;color:#fff;padding:9px 12px;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.pvp-actions .gold,.pvp-room-actions .gold{background:#f5cf43;color:#080808;border-color:#ffe77f}.pvp-actions button:disabled,.pvp-room-actions button:disabled{opacity:.55;cursor:not-allowed}.pvp-deck-status{border:1px solid #344c62;background:#081522;border-radius:10px;padding:9px 10px;color:#f8f4df;font-size:13px}.pvp-deck-status.loaded{border-color:#3c9b62;color:#caffd9}.pvp-formation{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.pvp-formation-card{border:1px solid #31485f;background:#091724;border-radius:10px;padding:10px;min-width:0}.pvp-formation-card b{display:block;color:#ffe04d;font-size:12px}.pvp-formation-card strong{display:block;color:#fff;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:5px}.pvp-formation-card small{display:block;color:#9fb0c3;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}.pvp-empty-deck{grid-column:1/-1;border:1px dashed #405a73;border-radius:10px;padding:14px;color:#bfc9d8;text-align:center}.pvp-room-stat{display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}.pvp-room-stat:last-child{border-bottom:0}.pvp-room-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}.pvp-room-note{font-size:12px;color:#d9d1b5;margin-top:10px;line-height:1.35}.pvp-people-list{margin-top:10px;display:grid;gap:6px}.pvp-person{border:1px solid #263c52;border-radius:10px;background:#081522;padding:8px;font-size:12px}.pvp-person b{color:#ffe04d}.pvp-person span{float:right}.pvp-person small{display:block;color:#c4cfda;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.pvp-coin-box{border:1px solid rgba(255,215,80,.45);border-radius:12px;padding:10px;margin:8px 0;background:rgba(255,215,80,.08);display:grid;gap:6px}.pvp-coin-box b{color:#ffd84a}.pvp-coin-box span{font-size:12px;line-height:1.35}.pvp-coin-box.done{border-color:rgba(80,255,150,.45)}.pvp-coin-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.pvp-coin-actions.single{grid-template-columns:1fr}.pvp-coin-choice{border-radius:50%!important;border:1px solid rgba(255,221,102,.72)!important;background:#08131f!important;padding:7px!important;display:grid!important;place-items:center!important;aspect-ratio:1/1;overflow:hidden;cursor:pointer;box-shadow:inset 0 0 22px rgba(255,215,80,.1),0 8px 22px rgba(0,0,0,.35);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}.pvp-coin-choice:hover,.pvp-coin-choice:focus-visible{transform:translateY(-2px) scale(1.035);filter:brightness(1.12);box-shadow:inset 0 0 28px rgba(255,215,80,.18),0 10px 30px rgba(0,0,0,.46)}.pvp-coin-choice img{display:block;width:100%;height:100%;object-fit:contain;border-radius:50%}.pvp-coin-choice.compact{max-width:84px;justify-self:center;width:100%}.pvp-coin-modal{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:18px}.pvp-coin-modal-card{width:min(460px,calc(100vw - 32px));border:1px solid rgba(255,215,80,.8);border-radius:18px;background:#07121d;color:#f8f4df;box-shadow:0 24px 80px rgba(0,0,0,.72);padding:18px}.pvp-coin-modal-card h2{margin:0 0 8px;color:#ffd84a;font-size:24px}.pvp-coin-modal-card p{margin:8px 0;line-height:1.45}.pvp-coin-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:14px}.pvp-coin-modal-actions .pvp-coin-choice{width:min(148px,100%);justify-self:center}.pvp-coin-modal-actions button:not(.pvp-coin-choice){border-radius:12px;border:1px solid rgba(255,255,255,.25);padding:12px 14px;font-weight:900;background:#1b3048;color:#fff}.pvp-coin-modal-actions button.gold:not(.pvp-coin-choice){background:#f3ce47;color:#111}.pvp-coin-wait{border:1px dashed rgba(255,215,80,.45);border-radius:12px;padding:12px;background:rgba(255,215,80,.08)}.pvp-coin-result-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.pvp-coin-result-grid div{border:1px solid rgba(255,215,80,.38);border-radius:12px;padding:12px;background:rgba(255,215,80,.08);display:grid;gap:8px;place-items:center}.pvp-coin-result-grid span{font-size:12px;color:#d8d4bd}.pvp-coin-result-face{display:block;width:min(118px,100%);aspect-ratio:1/1;object-fit:contain;border-radius:50%;filter:drop-shadow(0 8px 18px rgba(0,0,0,.4))}.pvp-coin-result-grid.compact .pvp-coin-result-face{width:72px}.pvp-coin-result-face.pvp-coin-outcome-flip{animation:pvpOpeningCoinOutcomeFlip 880ms cubic-bezier(.18,.72,.2,1) both;will-change:transform,filter}@keyframes pvpOpeningCoinOutcomeFlip{0%{transform:perspective(520px) rotateY(0deg) translateY(0);filter:brightness(1)}50%{transform:perspective(520px) rotateY(720deg) translateY(-18px);filter:brightness(1.18)}100%{transform:perspective(520px) rotateY(1440deg) translateY(0);filter:brightness(1)}}.pvp-coin-modal-actions.single{grid-template-columns:1fr}.pvp-coin-box.result{border-color:rgba(255,215,80,.8);background:rgba(255,215,80,.12)}\
@media(max-width:820px){body{min-width:0!important}.pvp-setup-overlay{padding:0;align-items:stretch;justify-content:flex-start;overflow-y:auto;-webkit-overflow-scrolling:touch}.pvp-setup-shell{width:100%;min-height:auto;border-radius:0;border-left:0;border-right:0;overflow:visible}.pvp-setup-head{padding:14px 14px 10px}.pvp-setup-head h2{font-size:22px}.pvp-setup-grid{grid-template-columns:1fr;padding:12px;gap:12px}.pvp-setup-card{padding:12px;overflow:visible}.pvp-formation{grid-template-columns:1fr}.pvp-actions{display:grid;grid-template-columns:1fr}.pvp-actions button,.pvp-actions .pvp-deck-builder{width:100%;min-height:44px}.pvp-room-actions{position:sticky;bottom:0;z-index:5;background:linear-gradient(180deg,rgba(7,18,28,.85),#07121c 22%);padding:10px 0 8px;margin-bottom:4px}.pvp-room-actions button{width:100%;min-height:46px}.pvp-people-list{padding-bottom:18px}.pvp-net-panel{left:10px;right:10px;bottom:64px;width:auto}.pvp-net-row,.pvp-net-row.three{grid-template-columns:1fr}';var style=document.createElement('style');style.textContent=css;document.head.appendChild(style);} 

  function observerAccessHtml(prefix,me){
    if(!me||me.role!=='spectator')return '';
    if(me.observerAuthorized)return '<div class="pvp-observer-card authorized"><b>AUTHORIZED OBSERVER</b><span>Both player hands are visible. Main Deck order and private decision prompts remain hidden.</span></div>';
    return '<div class="pvp-observer-card"><b>Observer Hand View</b><span>For teaching or learning. Enter the observer password to reveal both current player hands. This role remains read-only.</span><div class="pvp-observer-row"><input id="'+prefix+'Password" type="password" autocomplete="off" placeholder="Observer password"><button id="'+prefix+'Unlock" type="button">Unlock Both Hands</button></div></div>';
  }
  function wireObserverAccess(prefix){
    var input=$(prefix+'Password'),button=$(prefix+'Unlock');
    function submit(){var value=input&&input.value||'';if(!value){setStatus('offline','Enter the observer password.');return;}send('authorize-observer',{password:value});if(input)input.value='';}
    if(button)button.onclick=submit;if(input)input.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();submit();}};
  }
  function renderObserverAccess(){
    var me=state.snapshot&&state.snapshot.local;
    var lobby=$('pvpSetupObserverAccess');if(lobby){lobby.innerHTML=observerAccessHtml('pvpSetupObserver',me);wireObserverAccess('pvpSetupObserver');}
    var panel=$('pvpObserverAccess');if(panel){panel.innerHTML=observerAccessHtml('pvpPanelObserver',me);panel.closest('.pvp-net-box').hidden=!(me&&me.role==='spectator');wireObserverAccess('pvpPanelObserver');}
  }
  function installLobbyModal(){var wrap=document.createElement('div');wrap.id='pvpSetupOverlay';wrap.className='pvp-setup-overlay';wrap.innerHTML='<section class="pvp-setup-shell"><header class="pvp-setup-head"><div class="pvp-playtest-badge" aria-label="Playtest Build">PLAYTEST BUILD</div><div class="eyebrow">PvP Waiting Room</div><h2>Prepare the PvP Match</h2><p>Each player must enter a name, load a deck, then confirm Ready. The server owns the canonical board.</p></header><div class="pvp-setup-grid"><section class="pvp-setup-card"><h3>Your Package</h3><div class="pvp-field"><label for="pvpSetupName">Display Name</label><input id="pvpSetupName" maxlength="48" placeholder="Your player name"></div><div class="pvp-field"><label for="pvpSetupDeck">Starter Deck</label><select id="pvpSetupDeck"></select></div><div class="pvp-actions"><button id="pvpLoadStarterButton" class="gold" type="button">Load Starter Deck</button><button id="pvpImportDeckButton" type="button">Import Custom Deck JSON</button><input id="pvpImportDeckInput" type="file" accept="application/json,.json" hidden><a id="pvpDeckBuilderLink" class="pvp-deck-builder" role="button" href="/deck-builder/index.html" target="_blank" rel="noopener">Open Deck Builder</a></div><div id="pvpLoadedDeckStatus" class="pvp-deck-status">No deck loaded.</div><div class="pvp-setup-card" style="margin-top:8px;padding:10px"><h3 style="font-size:14px;margin-bottom:2px">Starting Formation</h3><div class="pvp-room-note" style="margin-top:0">Preview from the loaded Starter60 deck.</div><div id="pvpFormationPreview" class="pvp-formation"></div></div></section><section class="pvp-setup-card"><h3>Room Panel</h3><div class="pvp-field"><label for="pvpSetupRoom">Room</label><input id="pvpSetupRoom" maxlength="48" placeholder="ROOM CODE"></div><div id="pvpSetupStats"></div><div id="pvpSetupCoinFlip"></div><div class="pvp-room-actions"><button id="pvpSetupReadyButton" class="gold" type="button">Ready</button><button id="pvpSetupStartButton" class="gold" type="button">Start Match</button><button id="pvpSetupCopyButton" type="button">Copy Invite</button><button id="pvpSetupReconnectButton" type="button">Reconnect</button><button id="pvpSetupSpectatorButton" type="button">Move to Spectator</button></div><div id="pvpSetupHint" class="pvp-room-note"></div><div id="pvpSetupPeople" class="pvp-people-list"></div><div id="pvpSetupObserverAccess"></div></section></div></section>';document.body.appendChild(wrap);
    $('pvpSetupDeck').innerHTML=deckSelectOptions(state.deckKey);$('pvpSetupName').value=state.name;$('pvpSetupRoom').value=state.room;
    $('pvpSetupName').addEventListener('change',function(){state.name=safeName(this.value);localStorage.setItem(NAME_KEY,state.name);if(state.connected&&state.name)send('rename',{name:state.name});renderPanel();});
    $('pvpSetupRoom').addEventListener('change',function(){state.room=safeRoom(this.value);localStorage.setItem(ROOM_KEY,state.room);connect(true);renderPanel();});
    $('pvpSetupDeck').addEventListener('change',function(){state.deckKey=this.value;state.loadedDeckKey='';state.customDeck=null;state.customDeckName='';localStorage.setItem(DECK_KEY,state.deckKey);localStorage.removeItem(LOADED_DECK_KEY);renderPanel();});
    $('pvpLoadStarterButton').onclick=loadStarterDeck;$('pvpImportDeckButton').onclick=function(){$('pvpImportDeckInput').click();};$('pvpImportDeckInput').addEventListener('change',importCustomDeck);
    $('pvpSetupReadyButton').onclick=toggleReady;$('pvpSetupStartButton').onclick=function(){send('start-match',{seed:Math.random().toString(36).slice(2)});};$('pvpSetupCopyButton').onclick=copyRoomLink;$('pvpSetupReconnectButton').onclick=function(){connect(true);};$('pvpSetupSpectatorButton').onclick=function(){state.role=state.role==='spectator'?'player':'spectator';localStorage.setItem(ROLE_KEY,state.role);send('switch-role',{role:state.role});connect(true);};
  }
  function loadStarterDeck(){var sel=$('pvpSetupDeck')||$('pvpDeckInput');var key=sel&&sel.value||state.deckKey;if(!key){setStatus('offline','Choose a starter deck first.');renderPanel();return false;}state.deckKey=key;state.loadedDeckKey=key;state.customDeck=null;state.customDeckName='';localStorage.setItem(DECK_KEY,key);localStorage.setItem(LOADED_DECK_KEY,key);if(state.connected)send('set-deck',{deckKey:key});setStatus('online','Deck loaded: '+deckLabel(key));renderPanel();return true;}
  function importCustomDeck(ev){var file=ev&&ev.target&&ev.target.files&&ev.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){try{var parsed=JSON.parse(String(reader.result||''));var name=safeName(parsed.display_name||parsed.deck_name||file.name.replace(/\.json$/i,''));state.customDeck=parsed;state.customDeckName=name||'Imported Deck';state.loadedDeckKey='CUSTOM';state.deckKey='';localStorage.removeItem(LOADED_DECK_KEY);if(state.connected)send('set-deck',{customDeck:parsed,deckName:state.customDeckName});setStatus('online','Custom deck loaded: '+state.customDeckName);renderPanel();}catch(err){setStatus('offline','Invalid custom deck JSON.');}};reader.readAsText(file);}
  function offlineRemainingMs(p){if(!p||p.connected||!p.offlineExpiresAt)return null;var n=Date.parse(p.offlineExpiresAt)-Date.now();return isFinite(n)?Math.max(0,n):null;}
  function formatOfflineCountdown(p){var ms=offlineRemainingMs(p);if(ms===null)return p&&p.connected?'online':'offline';var total=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(total/60),sec=total%60,label=p.offlineTimeoutAction==='auto-forfeit'?'Auto Forfeit':'Reconnect';return 'offline · '+label+' '+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}
  function renderLobby(){var overlay=$('pvpSetupOverlay');if(!overlay)return;var snap=state.snapshot,me=snap&&snap.local,m=snap&&snap.match||{},started=m.status==='coin-flip'||m.status==='coin-result'||m.status==='started'||m.status==='finished';overlay.classList.toggle('open',!started);document.body.classList.toggle('pvp-lobby-mode',!started);document.body.classList.toggle('pvp-booting',!started);if($('pvpSetupName'))$('pvpSetupName').value=state.name;if($('pvpSetupRoom'))$('pvpSetupRoom').value=state.room;if($('pvpSetupDeck')){$('pvpSetupDeck').innerHTML=deckSelectOptions(state.deckKey||activeLoadedDeckKey());$('pvpSetupDeck').value=state.deckKey||activeLoadedDeckKey()||'';}var loaded=!!(state.customDeck||activeLoadedDeckKey());var status=$('pvpLoadedDeckStatus');if(status){status.className='pvp-deck-status '+(loaded?'loaded':'');status.textContent=loaded?('Deck loaded: '+loadedDeckLabel()):'No deck loaded.';}var fp=$('pvpFormationPreview');if(fp)fp.innerHTML=deckFormationHtml();var ps=(snap&&snap.players)||[],sp=(snap&&snap.spectators)||[];var stats=$('pvpSetupStats');if(stats)stats.innerHTML='<div class="pvp-room-stat"><span>Room</span><b>'+esc(state.room)+'</b></div><div class="pvp-room-stat"><span>Players</span><b>'+ps.length+' / 2</b></div><div class="pvp-room-stat"><span>Spectators</span><b>'+sp.length+'</b></div><div class="pvp-room-stat"><span>Spectator View</span><b>'+((me&&me.observerAuthorized)?'BOTH HANDS':'FAIR')+'</b></div>';var complete=!!(state.name&&loaded);var coin=$('pvpSetupCoinFlip');if(coin){coin.innerHTML=coinFlipControlHtml(m,me);wireCoinButtons();}if($('pvpSetupReadyButton')){$('pvpSetupReadyButton').textContent=(me&&me.ready)?'Unready':'Ready';$('pvpSetupReadyButton').disabled=!(me&&me.role==='player')||!state.connected||!complete||started||m.status==='coin-flip'||m.status==='coin-result';}if($('pvpSetupStartButton'))$('pvpSetupStartButton').disabled=!(me&&me.seat===1)||!state.connected||m.status!=='setup'||!bothPlayersReadyAndDecked(snap);if($('pvpSetupSpectatorButton'))$('pvpSetupSpectatorButton').textContent=(state.role==='spectator'?'Move to Player':'Move to Spectator');var hint=$('pvpSetupHint');if(hint)hint.textContent=m.status==='coin-result'?'Coin result is ready. Press Start Game to begin Round 1 Draw Phase.':(m.status==='coin-flip'?(me&&me.seat===2?'Choose Heads or Tails. The result appears next.':'Waiting for '+playerNameForSeat(2)+' to choose Heads or Tails.'):(me&&me.seat===1?'Start Match opens the battlefield coin flip.':'Wait for Player 1 to start, then Player 2 chooses Heads or Tails.'));var people=$('pvpSetupPeople');if(people)people.innerHTML=ps.length?ps.map(function(p){var deckStatus=p.hasDeck?'Deck locked in':'No deck selected';return '<div class="pvp-person"><b>'+esc(p.seatLabel||('Player '+p.seat))+'</b> '+esc(p.name||'Guest')+'<span>'+esc(formatOfflineCountdown(p))+(p.ready?' · READY':'')+'</span><small>'+esc(deckStatus)+'</small></div>';}).join(''):'<div class="pvp-room-note">Waiting for players...</div>';renderObserverAccess();}
  function installPanel(){var wrap=document.createElement('div');wrap.innerHTML='<aside id="pvpNetworkPanel" class="pvp-net-panel"><div class="pvp-net-inner"><div class="pvp-net-head"><h3>PvP Room · Player vs Player</h3><button id="pvpNetworkClose" type="button">Close</button></div><div id="pvpNetworkStatus" class="pvp-net-status connecting">Connecting...</div><div class="pvp-net-authority">Server is the rules authority. Player 1 and Player 2 both choose name + deck before ready/start.</div><section class="pvp-net-box"><h4>Lobby Setup</h4><div class="pvp-net-row"><label>Room<input id="pvpRoomInput" maxlength="48" placeholder="ROOM CODE"></label><label>Name<input id="pvpNameInput" maxlength="48" placeholder="Your name"></label></div><div class="pvp-net-row"><label>Deck<select id="pvpDeckInput"></select></label><label>Role<select id="pvpRoleInput"><option value="player">Player</option><option value="spectator">Spectator</option></select></label></div><div class="pvp-net-row three"><button id="pvpJoinButton" class="gold" type="button">Save / Join</button><button id="pvpCopyButton" type="button">Copy Link</button><button id="pvpOpenButton" type="button">Open 2P</button></div><div id="pvpLobbyHint" class="pvp-net-small"></div></section><section class="pvp-net-box"><h4>Server Match</h4><div id="pvpBoardStatus" class="pvp-net-small">Not started.</div><div id="pvpCoinFlipPanel"></div><div class="pvp-net-row three" style="margin-top:8px"><button id="pvpReadyButton" class="gold" type="button">Ready</button><button id="pvpStartButton" type="button">Start Match</button><button id="pvpPullBoardButton" type="button">Pull Board</button></div><div class="pvp-net-row" style="margin-top:8px"><button id="pvpResetRoomButton" class="danger" type="button">Reset Room</button><button id="pvpReconnectButton" type="button">Reconnect</button></div></section><section class="pvp-net-box" hidden><h4>Authorized Observer</h4><div id="pvpObserverAccess"></div></section><div class="pvp-net-row"><label>Chat<input id="pvpChatInput" placeholder="short room message"></label><button id="pvpChatButton" type="button">Send</button></div><section class="pvp-net-box"><h4>Players</h4><div id="pvpPlayersList" class="pvp-net-list"></div></section><section class="pvp-net-box"><h4>Spectators</h4><div id="pvpSpectatorsList" class="pvp-net-list"></div></section><section class="pvp-net-box"><h4>Room Log</h4><div id="pvpRoomLog" class="pvp-net-log"></div></section><div class="pvp-net-small">No client board publish. Gameplay clicks become runtime intents and are resolved on the server canonical board.</div></div></aside>';document.body.appendChild(wrap);
    $('pvpDeckInput').innerHTML=deckSelectOptions(state.deckKey);
    document.addEventListener('click',function(ev){var mobile=ev.target&&ev.target.closest&&ev.target.closest('#pvpRoomMobileButton');if(!mobile)return;ev.preventDefault();ev.stopPropagation();$('pvpNetworkPanel').classList.toggle('open');});$('pvpNetworkClose').onclick=function(){$('pvpNetworkPanel').classList.remove('open');};$('pvpJoinButton').onclick=joinFromInputs;$('pvpCopyButton').onclick=copyRoomLink;$('pvpOpenButton').onclick=function(){window.open(roomLink({two:true}),'_blank','noopener');};$('pvpReadyButton').onclick=toggleReady;$('pvpStartButton').onclick=function(){send('start-match',{seed:Math.random().toString(36).slice(2)});};$('pvpPullBoardButton').onclick=function(){importServerBoard(true);};$('pvpResetRoomButton').onclick=function(){if(confirm('Reset this server room to setup?')){clearTransientUiState('reset');send('reset-room');}};$('pvpReconnectButton').onclick=function(){connect(true);};$('pvpChatButton').onclick=function(){var v=$('pvpChatInput').value;if(v.trim()){send('chat',{message:v});$('pvpChatInput').value='';}};$('pvpChatInput').addEventListener('keydown',function(e){if(e.key==='Enter')$('pvpChatButton').click();});$('pvpDeckInput').addEventListener('change',function(){state.deckKey=this.value;state.loadedDeckKey='';state.customDeck=null;state.customDeckName='';localStorage.setItem(DECK_KEY,state.deckKey);localStorage.removeItem(LOADED_DECK_KEY);renderPanel();});$('pvpNameInput').addEventListener('change',function(){state.name=safeName(this.value);localStorage.setItem(NAME_KEY,state.name);if(state.connected&&state.name)send('rename',{name:state.name});renderPanel();});renderPanel();}
  function lobbyComplete(){return !!(state.name&&state.deckKey);}
  function joinFromInputs(){state.room=safeRoom($('pvpRoomInput').value);state.name=safeName($('pvpNameInput').value);state.role=$('pvpRoleInput').value==='spectator'?'spectator':'player';state.deckKey=$('pvpDeckInput').value;localStorage.setItem(ROOM_KEY,state.room);localStorage.setItem(NAME_KEY,state.name);localStorage.setItem(ROLE_KEY,state.role);localStorage.setItem(DECK_KEY,state.deckKey||'');connect(true);renderPanel();}
  function roomLink(opts){opts=opts||{};var u=new URL(location.href);u.searchParams.set('room',state.room);u.searchParams.set('name',opts.two?'Player 2':(state.name||'Player 1'));u.searchParams.set('role',opts.role||'player');var dk=activeLoadedDeckKey()||state.deckKey;if(dk&&dk!=='CUSTOM')u.searchParams.set('deck',dk);return u.toString();}
  function copyRoomLink(){var link=roomLink({});if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(link).then(function(){setStatus('online','Room link copied');});else prompt('Copy room link:',link);}
  function toggleReady(){var me=localPlayer();if(!me||me.role!=='player'){setStatus('offline','Spectator is read-only.');return;}if(!state.name){state.name=(me&&me.seatLabel)||selfLabel()||'Player';localStorage.setItem(NAME_KEY,state.name);send('rename',{name:state.name});}if(!state.customDeck&&!activeLoadedDeckKey()){setStatus('offline','Load your starter deck before ready.');return;}if(state.customDeck)send('set-deck',{customDeck:state.customDeck,deckName:state.customDeckName});else if(activeLoadedDeckKey())send('set-deck',{deckKey:activeLoadedDeckKey()});send('ready',{ready:!(me&&me.ready)});}
  function handleSnapshot(msg){
    var incomingRevision=Number(msg&&msg.match&&msg.match.serverBoardRevision||0),incomingMatch=msg&&msg.match||{},incomingStatus=incomingMatch.status||'setup',lastIntent=incomingMatch.lastIntent||null;
    if(state.intentInFlight&&(incomingRevision>state.intentBaseRevision||(lastIntent&&Number(lastIntent.fromSeat)===Number(localSeat())&&lastIntent.intent===state.intentName)))clearIntentLock();
    if(incomingStatus==='setup'||(incomingStatus==='coin-flip'&&state.lastMatchStatus==='finished'))clearTransientUiState();
    state.lastMatchStatus=incomingStatus;state.snapshot=msg;var me=msg.local||{};window.GL_PVP_LOCAL_SEAT=me.seat||null;window.GL_PVP_LOCAL_ROLE=me.role||state.role;window.GL_PVP_LOCAL_NAME=me.name||state.name||'YOU';var other=((msg.players||[]).filter(function(p){return Number(p.seat)!==Number(me.seat);})[0]);window.GL_PVP_OPPONENT_NAME=(other&&other.name)||'OPPONENT';if(me.name)state.name=me.name;if(me.seatToken){state.seatToken=me.seatToken;try{localStorage.setItem(SEAT_TOKEN_KEY,me.seatToken);}catch(e){}}if(me.deckKey){state.loadedDeckKey=me.deckKey==='CUSTOM'?'':me.deckKey;if(me.deckKey!=='CUSTOM')state.deckKey=me.deckKey;if(me.deckName)state.customDeckName=me.deckKey==='CUSTOM'?me.deckName:state.customDeckName;}if(msg.deckOptions&&msg.deckOptions.length){DECK_OPTIONS=msg.deckOptions;}var m=msg.match||{};var active=(m.status==='coin-flip'||m.status==='coin-result'||m.status==='started'||m.status==='finished');if(active){if(bridge())bridge().setSharedBoardMode(true);importServerBoard(false);}else{closeBattlefieldCoinModal();state.lastAppliedRevision=0;document.body.classList.add('pvp-booting');if(bridge())bridge().setSharedBoardMode(false);}if(active&&me.role==='spectator'&&!me.observerAuthorized&&!state.observerPromptShown){state.observerPromptShown=true;setTimeout(function(){var panel=$('pvpNetworkPanel');if(panel)panel.classList.add('open');var input=$('pvpPanelObserverPassword');if(input)input.focus();},80);}setStatus('online','Connected · '+(msg.local&&msg.local.role==='player'?(msg.local.seatLabel||('Player '+msg.local.seat)):(me.observerAuthorized?'Authorized Observer':'Spectator'))+' · '+msg.room.id+' · r'+Number(m.serverBoardRevision||0));renderPanel();syncBattlefieldCoinModal();maybeAnimatePvpCoinResult(m);setTimeout(function(){humanizeVisibleLabels();syncPvpGameResultUi();},30);}
  function renderPanel(){if(!$('pvpNetworkPanel'))return;$('pvpRoomInput').value=state.room;$('pvpNameInput').value=state.name;$('pvpRoleInput').value=state.role;if($('pvpDeckInput')){$('pvpDeckInput').innerHTML=deckSelectOptions(state.deckKey);$('pvpDeckInput').value=state.deckKey||activeLoadedDeckKey()||'';}var snap=state.snapshot,me=snap&&snap.local,m=snap&&snap.match||{};var complete=!!(state.name&&(state.customDeck||activeLoadedDeckKey()));var coinPanel=$('pvpCoinFlipPanel');if(coinPanel){coinPanel.innerHTML=coinFlipControlHtml(m,me);wireCoinButtons();}$('pvpReadyButton').textContent=(me&&me.ready)?'Unready':'Ready';$('pvpReadyButton').disabled=!(me&&me.role==='player')||!state.connected||!complete||m.status==='started'||m.status==='finished'||m.status==='coin-flip'||m.status==='coin-result';$('pvpStartButton').disabled=!(me&&me.seat===1)||!state.connected||m.status!=='setup'||!bothPlayersReadyAndDecked(snap);$('pvpResetRoomButton').disabled=!(me&&me.seat===1)||!state.connected;$('pvpPullBoardButton').disabled=!m.serverBoard;var hintText=complete?'Lobby ready locally: '+state.name+' · '+loadedDeckLabel():'Enter your name and load a deck before pressing Ready.';if(m.status==='coin-flip')hintText=me&&me.seat===2?'Choose one coin face. Result appears next.':'Waiting for '+playerNameForSeat(2)+' coin choice.';if(m.status==='coin-result')hintText='Coin result ready. Press Start Game to enter Draw Phase.';$('pvpLobbyHint').textContent=hintText;var st='Room status: '+(m.status||'setup')+'. ';st+='Local: '+(me&&me.role==='player'?(me.seatLabel||('Player '+me.seat)):'Spectator')+'. ';st+='Server board r'+Number(m.serverBoardRevision||0)+'. ';if(m.status==='coin-flip')st+='Opening Coin Flip pending: waiting for '+playerNameForSeat(2)+' coin choice. ';if(m.status==='coin-result')st+='Opening Coin Flip result pending confirmation. ';var flipLine=openingFlipText(m);if(flipLine)st+=flipLine+' ';if(m.serverBoard&&m.serverBoard.appState){var a=appState()||m.serverBoard.appState;st+='Turn '+humanizeRuntimeText(a.turn||'?')+' · Phase '+(a.phase||'?')+' · Round '+(a.round||'?')+'.';if(a.gameOver){var r=m.result||a.pvpGameResult||{};st+=' Game over: '+(r.winnerName||humanizeRuntimeText(a.winner||'?'))+' wins.';}}$('pvpBoardStatus').textContent=st;renderPeople('pvpPlayersList',snap&&snap.players,true);renderPeople('pvpSpectatorsList',snap&&snap.spectators,false);renderObserverAccess();renderLobby();var logs=(snap&&snap.logs)||[];$('pvpRoomLog').innerHTML=logs.slice(-35).reverse().map(function(l){return '<div><b>'+esc((l.at||'').slice(11,19))+'</b> '+esc(humanizeRuntimeText(l.message))+'</div>';}).join('')||'<div>No room log yet.</div>';}
  function bothPlayersReadyAndDecked(snap){var ps=snap&&snap.players||[];return ps.length===2&&ps.every(function(p){return p.connected&&p.ready&&p.hasDeck&&p.name;});}
  function renderPeople(id,people,showSeat){var el=$(id),list=people||[],m=state.snapshot&&state.snapshot.match||{},revealDeckIdentity=m.status!=='setup';if(!el)return;el.innerHTML=list.length?list.map(function(p){var deck;if(revealDeckIdentity&&p.deckName)deck='<em>'+esc(p.deckName)+'</em>';else if(p.hasDeck)deck='<em>Deck locked in</em>';else deck='<em class="missing">No deck selected</em>';var observer=p.observerAuthorized?' · AUTHORIZED OBSERVER':'';return '<div class="pvp-net-pill"><span>'+(showSeat?('<b>'+esc(p.seatLabel||('Player '+(p.seat||'?')))+'</b> '):'')+esc(p.name||'Guest')+'<small>'+deck+'</small></span><span>'+esc(formatOfflineCountdown(p))+(p.ready?' · READY':'')+observer+'</span></div>';}).join(''):'<div class="pvp-net-small">Empty</div>';}
  function connect(force){if(ws&&!force&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;if(ws){try{ws.close(4000,'rejoin');}catch(e){}}clearTimeout(reconnectTimer);setStatus('connecting','Connecting to room '+state.room+'...');try{ws=new WebSocket(wsUrl());}catch(e){scheduleReconnect();return;}ws.onopen=function(){clearIntentLock();state.connected=true;reconnectDelay=1200;setStatus('online','Connected to room '+state.room);renderPanel();if(state.name)send('rename',{name:state.name});if(state.role==='player'&&state.customDeck)send('set-deck',{customDeck:state.customDeck,deckName:state.customDeckName});else if(state.role==='player'&&activeLoadedDeckKey())send('set-deck',{deckKey:activeLoadedDeckKey()});};ws.onclose=function(){clearIntentLock();state.connected=false;setStatus('offline','Disconnected. Reconnecting...');renderPanel();scheduleReconnect();};ws.onerror=function(){state.connected=false;setStatus('offline','Network error');};ws.onmessage=function(ev){var msg;try{msg=JSON.parse(ev.data);}catch(e){return;}if(msg.type==='snapshot'){handleSnapshot(msg);return;}if(msg.type==='notice'){if(msg.kind==='error')clearIntentLock();setStatus(msg.kind==='error'?'offline':'online',msg.message||'Notice');return;}if(msg.type==='fatal'){setStatus('offline',msg.message||'Fatal room error');try{ws.close();}catch(e){}}};}
  function scheduleReconnect(){clearTimeout(reconnectTimer);reconnectTimer=setTimeout(function(){connect(false);},reconnectDelay);reconnectDelay=Math.min(reconnectDelay*1.6,10000);} 
  function installGrandisLobbyTheme(){var style=document.createElement('style');style.id='gl-pvp-v259-lobby-theme';style.textContent=`
body.pvp-lobby-mode{background:#151f32 url('assets/Background.png') center/cover fixed!important}
.pvp-setup-overlay{background:linear-gradient(rgba(5,12,22,.62),rgba(8,18,31,.78)),url('assets/Background.png') center/cover fixed!important}
.pvp-setup-shell{background:rgba(13,23,38,.91)!important;border-color:rgba(214,180,95,.58)!important;backdrop-filter:blur(9px)!important}
.pvp-setup-head{background:linear-gradient(180deg,rgba(21,31,50,.96),rgba(13,23,38,.94))!important}
.pvp-setup-card,.pvp-formation-card,.pvp-deck-status,.pvp-person{background:rgba(21,31,50,.88)!important;border-color:#344b67!important}
.pvp-field input,.pvp-field select,.pvp-actions button,.pvp-room-actions button,.pvp-deck-builder{background:#151f32!important;border-color:#3a506b!important;color:#f2f7fc!important}
.pvp-actions .gold,.pvp-room-actions .gold{background:linear-gradient(#8a6923,#574218)!important;border-color:#d6b45f!important;color:#fff1bd!important}
.pvp-room-actions{background:linear-gradient(180deg,rgba(21,31,50,.15),rgba(13,23,38,.94) 28%)!important}
.pvp-setup-head p,.pvp-room-note{color:#aebed0!important}
`;document.head.appendChild(style);}
  function installPvp256UiPatch(){var style=document.createElement('style');style.id='gl-pvp-v259-ui-patch';style.textContent=`
/* PvP-specific presentation only. Shared Local AI gameplay/UI source remains unchanged. */
.pvp-coin-choice.waiting-display{cursor:default!important;opacity:.72!important;filter:saturate(.72)!important;transform:none!important}
.pvp-coin-choice.waiting-display:hover{transform:none!important;filter:saturate(.72)!important}
.pvp-coin-modal-card.waiting-mirror p{margin-bottom:12px!important}
.pvp-game-result-summary{min-width:min(440px,78vw)!important}
.pvp-game-result-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;margin-top:4px!important}
.pvp-game-result-actions button{min-height:46px!important;border-radius:10px!important;border:1px solid #755f1f!important;background:#151f32!important;color:#f4f7fb!important;font-weight:900!important}
.pvp-game-result-actions .primary{background:linear-gradient(180deg,#8d6a19,#3a2a09)!important;border-color:#d6aa35!important;color:#fff3c1!important}
@media(max-width:760px){
  .v96-app .turn-panel{grid-template-columns:72px minmax(0,1fr)!important;min-height:58px!important;padding:4px!important;gap:4px!important}
  .v96-app .mobile-match-menu-button{min-height:50px!important;font-size:8px!important;padding:4px!important}
  .v96-app .turn-summary{padding:1px 3px!important}
  .v96-app .turn-summary strong{font-size:14px!important}.v96-app .turn-summary span{font-size:8px!important}.v96-app .turn-summary .turn-status{font-size:7px!important}
  .v96-app .card-played-panel{min-height:50px!important;max-height:84px!important;grid-template-rows:18px minmax(0,1fr) 18px!important;gap:3px!important;padding:4px!important}
  .v96-app .card-played-panel .empty-state{min-height:24px!important;padding:4px!important;font-size:7px!important}
  .v96-app .main-stage{grid-template-rows:26px 54px auto 6px auto 116px 28px!important;gap:3px!important}
  .v96-app .player-name{height:26px!important;padding:2px 8px!important;font-size:11px!important;overflow:hidden!important}.v96-app .player-name span{font-size:7px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .v96-app .hand-area{grid-template-columns:46px minmax(0,1fr) 46px!important;padding:0 2px!important}
  .v96-app .field{gap:3px!important}
  .v96-app .field--opponent{grid-template-columns:1.05fr .78fr 1.05fr 1.18fr!important;grid-template-rows:58px 264px!important}
  .v96-app .field--player{grid-template-columns:1.18fr 1.05fr .78fr 1.05fr!important;grid-template-rows:264px 58px!important}
  .v96-app .field .hero-row{height:264px!important;min-height:264px!important;padding:3px!important;gap:3px!important}
  .v96-app .zone{height:58px!important;min-height:58px!important;padding:2px 1px!important;gap:1px!important;overflow:hidden!important}
  .v96-app .zone>span{font-size:6px!important;line-height:1!important;white-space:nowrap!important}.v96-app .zone em{font-size:5.5px!important;line-height:1!important}
  .v96-app .zoneCard{height:40px!important;min-height:40px!important;max-height:40px!important}.v96-app .zoneCard img{max-height:40px!important;max-width:42px!important}
  .v96-app .zone[data-zone-type="Main Deck"] .zoneCard>b,.v96-app .zone[data-zone-type="Legacy Deck"] .zoneCard>b,.v96-app .zone[data-zone-type="Discard Pile"] .zoneCard>b{bottom:2px!important;font-size:10px!important}
  .v96-app .zone[data-zone-type="Mana Pool"] .zoneCard>b{font-size:12px!important}
  .v96-app .hero-row--opponent .hero-lane:not(.legacy-slot){grid-template-rows:27px minmax(0,1fr)!important}.v96-app .hero-row--player .hero-lane:not(.legacy-slot){grid-template-rows:minmax(0,1fr) 27px!important}
  .v96-app .attachment-row{gap:2px!important;padding:0 3px!important}.v96-app .attachment-row .slot{font-size:5px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important}
  .v96-app .hero-card.hero-main{width:clamp(78px,23vw,100px)!important}
  .v96-app .field-divider{height:6px!important;padding:0 12px!important}
  .v96-app .hand-area--player .handPanel{scrollbar-width:none!important}.v96-app .hand-area--player .handPanel::-webkit-scrollbar{display:none!important}
  .v96-app .hand-area--player .handCards{height:110px!important;padding:5px 16px 2px!important}
  .v96-app .hand-card{width:70px!important;min-width:70px!important;max-width:70px!important;height:104px!important;flex-basis:70px!important;grid-template-rows:minmax(0,87px) 15px!important}.v96-app .hand-card .hand-art,.v96-app .hand-card .hand-art img{height:87px!important}
  .v96-app .player-footer-bar{height:28px!important}.v96-app .player-footer-bar #historyButtonBottom{font-size:6.5px!important;padding:0 5px!important}
  .v96-app .phase-panel{height:auto!important;min-height:0!important;grid-template-rows:auto auto auto!important;gap:5px!important;padding:5px!important}
  .v96-app .phase-list{grid-template-columns:repeat(5,minmax(0,1fr))!important;grid-template-rows:34px!important;gap:3px!important}.v96-app .phase-list button{height:34px!important;min-height:34px!important;font-size:6px!important;padding:2px!important}
  .v96-app .phase-actions{grid-template-rows:32px 42px!important;gap:4px!important}.v96-app .phase-actions .reposition,.v96-app .phase-actions .cancel-action{height:32px!important;min-height:32px!important}.v96-app .phase-actions .next-phase{height:42px!important;min-height:42px!important;font-size:8px!important}
  .v96-app .phase-actions button:disabled,.v96-app .full-width:disabled{opacity:.46!important;color:#9aa9b7!important}
  .pvp-game-result-actions{grid-template-columns:1fr!important}.pvp-game-result-summary{min-width:0!important;width:100%!important}.game-result-winner strong{font-size:22px!important}.game-result-reason strong{font-size:18px!important}

  /* v2.5.9 mobile density, corner ownership, and shared HP scale metadata. */
  .v96-app .field--opponent,.v96-app .field--player{grid-template-columns:repeat(4,minmax(0,1fr))!important}
  .v96-app .field--opponent{grid-template-rows:54px 230px!important}
  .v96-app .field--player{grid-template-rows:230px 54px!important}
  .v96-app .field .hero-row{height:230px!important;min-height:230px!important;padding:2px!important;gap:3px!important}
  .v96-app .zone{justify-self:center!important;width:clamp(70px,20.5vw,94px)!important;max-width:94px!important;height:54px!important;min-height:54px!important;padding:2px!important;border-radius:8px!important}
  .v96-app .zone.zone--mana{width:clamp(78px,22.5vw,104px)!important;max-width:104px!important}
  .v96-app .zoneCard{height:37px!important;min-height:37px!important;max-height:37px!important}
  .v96-app .zoneCard img{max-height:37px!important;max-width:40px!important}
  .v96-app .zone>span{font-size:5.8px!important;letter-spacing:.02em!important}
  .v96-app .zone em{font-size:5px!important}
  .v96-app .hero-row--opponent .hero-lane:not(.legacy-slot){grid-template-rows:24px minmax(0,1fr)!important}
  .v96-app .hero-row--player .hero-lane:not(.legacy-slot){grid-template-rows:minmax(0,1fr) 24px!important}
  .v96-app .attachment-row{height:24px!important;min-height:24px!important;padding:0 2px!important}
  .v96-app .attachment-row .slot{height:24px!important;min-height:24px!important;font-size:4.8px!important}
  .v96-app .hero-card.hero-main{width:clamp(74px,21.5vw,94px)!important;max-height:calc(100% - 8px)!important}

  /* Mobile status is a single horizontal row at the upper-left corner. */
  .v96-app .hero-status-overlay{top:4px!important;left:4px!important;max-width:calc(100% - 52px)!important;overflow:hidden!important}
  .v96-app .hero-status-overlay .hero-indicator-stack,
  .v96-app .hero-status-overlay .hero-indicator-stack--top,
  .v96-app .hero-status-overlay .hero-indicator-stack--bottom{width:max-content!important;max-width:100%!important;min-height:17px!important;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-start!important;gap:4px!important;overflow:hidden!important}
  .v96-app .hero-status-overlay .hero-info-indicator,
  .v96-app .hero-status-overlay .negative-status-indicator{flex:0 0 auto!important}
  .v96-app .hero-status-overlay button{width:17px!important;height:17px!important;min-width:17px!important;min-height:17px!important}
  .v96-app .hero-status-overlay img{width:17px!important;height:17px!important}

  /* Racial Trait owns the lower-left corner; EXP remains lower-right. */
  .v96-app .hero-stage .heroActions{position:absolute!important;inset:auto 4px 4px 4px!important;z-index:190!important;max-width:none!important;width:auto!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-auto-flow:row!important;gap:3px!important;align-items:end!important;pointer-events:none!important}
  .v96-app .hero-stage .heroActions .actionBtn{pointer-events:auto!important;max-width:92px!important;min-width:0!important;font-size:5.8px!important;line-height:1.05!important;padding:3px 4px!important}
  .v96-app .hero-stage .heroActions .racialAbilityAction{grid-column:1!important;justify-self:start!important;text-align:left!important}
  .v96-app .hero-stage .heroActions .classAbilityAction,
  .v96-app .hero-stage .heroActions .legacyAbilityAction{grid-column:2!important;justify-self:end!important;text-align:right!important}
  .v96-app .hero-exp-badge{left:auto!important;right:4px!important;bottom:4px!important}

  /* Mobile Hand is a straight horizontal carousel: no fan rotation or lift. */
  .v96-app .hand-area--player .handCards{height:108px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:5px!important;padding:5px 12px 2px!important;overflow:visible!important}
  .v96-app .hand-area--player .hand-card,
  .v96-app .hand-area--player .hand-card:hover,
  .v96-app .hand-area--player .hand-card:focus-within,
  .v96-app .hand-area--player .hand-card.hand-hover-active{transform:none!important;rotate:0deg!important;translate:none!important;margin:0!important;transition:none!important}
  .v96-app .hand-area--player .hand-card .hand-art{transform:none!important}
}
`;document.head.appendChild(style);}
  var PVP_MOBILE_MATCH_MENU_OPEN=false;
  function syncPvpMobileMatchMenuState(){var overlay=$('mobileMatchMenuOverlay'),button=$('mobileMatchMenuButton');if(!overlay)return false;if(PVP_MOBILE_MATCH_MENU_OPEN){overlay.hidden=false;overlay.classList.add('open');if(button)button.setAttribute('aria-expanded','true');}else{overlay.classList.remove('open');overlay.hidden=true;if(button)button.setAttribute('aria-expanded','false');}return true;}
  function installPvpMobileMatchMenuController(){document.addEventListener('click',function(ev){var target=ev.target&&ev.target.closest?ev.target:null;if(!target)return;var open=target.closest('#mobileMatchMenuButton');if(open){ev.preventDefault();ev.stopImmediatePropagation();PVP_MOBILE_MATCH_MENU_OPEN=true;syncPvpMobileMatchMenuState();return;}var room=target.closest('#mobilePvpRoomButton');if(room){ev.preventDefault();ev.stopImmediatePropagation();PVP_MOBILE_MATCH_MENU_OPEN=false;syncPvpMobileMatchMenuState();var panel=$('pvpNetworkPanel');if(panel)panel.classList.add('open');return;}var close=target.closest('#mobileMatchMenuClose');var overlay=target.id==='mobileMatchMenuOverlay';if(close||overlay){ev.preventDefault();ev.stopImmediatePropagation();PVP_MOBILE_MATCH_MENU_OPEN=false;syncPvpMobileMatchMenuState();return;}if(target.closest('#mobileDeckSetupButton,#mobileSurrenderButton')){PVP_MOBILE_MATCH_MENU_OPEN=false;setTimeout(syncPvpMobileMatchMenuState,0);}},true);window.addEventListener('gl-local-state-rendered',function(){setTimeout(syncPvpMobileMatchMenuState,0);});}
  function syncPvpGameResultUi(){var title=$('infoTitle'),body=$('infoBody');if(!title||!body||title.textContent.trim()!=='PvP Game Result')return;var current=body.querySelector('.pvp-result-body');if(!current||body.querySelector('.pvp-game-result-summary'))return;var snap=state.snapshot||{},m=snap.match||{},a=appState()||m.serverBoard&&m.serverBoard.appState||{},r=m.result||m.pvpGameResult||a.pvpGameResult||{};var winner=r.winnerName||humanizeRuntimeText(a.winner||'Winner'),reason=r.reason||a.gameEndReason||'Game ended.',round=r.round||a.round||1,phase=r.phase||a.phase||'Unknown';body.innerHTML='<div class="game-result-summary pvp-game-result-summary"><section class="game-result-winner"><span>Winner</span><strong>'+esc(winner)+'</strong></section><section class="game-result-reason"><span>Reason</span><strong>'+esc(reason)+'</strong></section><section class="game-result-round"><span>Round</span><strong>'+esc(round)+'</strong><small>'+esc(phase)+' Phase</small></section><div class="pvp-game-result-actions"><button id="pvpResultBackLobby" class="primary" type="button">Back to Lobby</button></div></div>';}
  function observePvpResultUi(){var body=$('infoBody');if(!body||typeof MutationObserver==='undefined')return;new MutationObserver(function(){setTimeout(syncPvpGameResultUi,0);}).observe(body,{childList:true,subtree:true});}
  function boot(){initState();installStyles();installGrandisLobbyTheme();installPvp256UiPatch();installTurnPhaseStyles();installPanel();installLobbyModal();installPvpMobileMatchMenuController();observePvpResultUi();connect(false);setInterval(function(){var ps=state.snapshot&&state.snapshot.players||[];if(ps.some(function(p){return p.connected===false&&p.offlineExpiresAt;}))renderPanel();},1000);document.addEventListener('click',mapGameplayClick,true);window.addEventListener('gl-local-state-rendered',function(){setTimeout(function(){humanizeVisibleLabels();syncPvpGameResultUi();syncPvpMobileMatchMenuState();},30);});window.GL_PVP_NETWORK={version:VERSION,send:send,reconnect:function(){connect(true);},getSnapshot:function(){return state.snapshot;},pullBoard:function(){return importServerBoard(true);},sendIntent:runtimeIntent,roomLink:roomLink,clearTransientUiState:clearTransientUiState,pendingClosePolicy:pendingClosePolicy};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
