'use strict';

const POSITIONS=['LEFT','CENTER','RIGHT'];
function defaultFilterSet(family=''){return {search:'',family,className:'',skillType:'',attackStyle:'',pool:'available',manaMin:0,manaMax:9}}
function resetAllFilterSets(){state.filterSets={all:defaultFilterSet(''),Skill:defaultFilterSet('Skill'),Event:defaultFilterSet('Event'),Item:defaultFilterSet('Item')};state.filters=state.filterSets.all}
const state={
  tab:'legacy',rankView:1,heroPickerSlot:0,
  cards:[],byId:new Map(),legacyCards:[],legacyById:new Map(),sourcePackages:[],
  progressions:[],progressionById:new Map(),progressionByHeroId:new Map(),starters:[],
  deck:{},slots:[emptySlot(),emptySlot(),emptySlot()],
  filters:defaultFilterSet(''),
  filterSets:{all:defaultFilterSet(''),Skill:defaultFilterSet('Skill'),Event:defaultFilterSet('Event'),Item:defaultFilterSet('Item')}
};

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clone=value=>JSON.parse(JSON.stringify(value));
function emptySlot(){return {progressionId:'',legacyId:''}}
function idSort(a,b){return String(a?.id||'').localeCompare(String(b?.id||''),undefined,{numeric:true})}
const MAIN_DECK_FAMILY_ORDER={Skill:0,Event:1,Item:2};
function mainDeckSort(a,b){const aCard=a?.card||a,bCard=b?.card||b;const familyDiff=(MAIN_DECK_FAMILY_ORDER[aCard?.family]??99)-(MAIN_DECK_FAMILY_ORDER[bCard?.family]??99);return familyDiff||idSort(aCard,bCard)}
function countDeck(deck=state.deck){return Object.values(deck).reduce((sum,qty)=>sum+Number(qty||0),0)}
function copyLimit(card){return card?.ultimate?.isUltimate?1:Number(card?.maxCopies||2)}
function selectedProgressions(slots=state.slots){return slots.map(slot=>state.progressionById.get(slot.progressionId)).filter(Boolean)}
function heroFormationComplete(slots=state.slots){return selectedProgressions(slots).length===3}
function legacyUniqueComplete(slots=state.slots){const ids=slots.map(slot=>slot.legacyId).filter(Boolean);return ids.length===3&&new Set(ids).size===3}
function legacyCardCount(slots=state.slots){return slots.reduce((sum,slot)=>sum+(slot.progressionId?3:0)+(slot.legacyId?1:0),0)}
function legacyReady(slots=state.slots){return heroFormationComplete(slots)&&legacyUniqueComplete(slots)&&legacyCardCount(slots)===12}
function cardById(id){return state.byId.get(id)||state.legacyById.get(id)}
function isDeckDirty(){return countDeck()>0||state.slots.some(slot=>slot.progressionId||slot.legacyId)||$('deckName').value.trim()!=='New Deck'}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1900)}

function buildProgressions(){
  const byBase=new Map();
  for(const source of state.sourcePackages){
    if(byBase.has(source.baseCardId))continue;
    const cardIds=(source.heroIds||source.cardIds?.slice(0,3)||[]).slice(0,3);
    byBase.set(source.baseCardId,{id:source.baseCardId,name:state.legacyById.get(source.baseCardId)?.name||source.lineage,baseClass:source.baseClass,race:source.race,lineage:source.lineage,cardIds,classLineage:(source.classLineage||[]).slice(),coverImage:source.coverImage});
  }
  state.progressions=Array.from(byBase.values()).sort((a,b)=>idSort({id:a.id},{id:b.id}));
  state.progressionById=new Map(state.progressions.map(item=>[item.id,item]));
  state.progressionByHeroId=new Map();
  state.progressions.forEach(progression=>progression.cardIds.forEach(id=>state.progressionByHeroId.set(id,progression)));
}

function manaNumber(card){
  const cost=String(card?.cost||'');if(/no mana cost/i.test(cost))return 0;
  const values=[...cost.matchAll(/(\d+)\s*Mana/gi)].map(match=>Number(match[1]));return values.length?Math.min(...values):0;
}
function skillType(card){const text=String(card?.classification||'');if(/Attack/i.test(text))return 'Attack';if(/Defense/i.test(text))return 'Defense';if(/Tactical/i.test(text))return 'Tactical';if(/Support/i.test(text))return 'Support';return ''}
function attackStyle(card){const text=String(card?.classification||'');for(const value of ['Physical','Magical','Area','Range','Casting'])if(text.startsWith(value))return value;return ''}
function cardCompatible(card,slots=state.slots){
  if(!card)return false;if(card.family==='Event')return true;
  const progressions=selectedProgressions(slots),heroIds=new Set(progressions.flatMap(item=>item.cardIds)),lineageClasses=new Set(progressions.flatMap(item=>item.classLineage||[])),baseClasses=new Set(progressions.map(item=>item.baseClass));
  const ultimate=card.ultimate||{};
  if(ultimate.isUltimate&&!Array.from(ultimate.ownerLineageCardIds||[]).some(id=>heroIds.has(id)))return false;
  if(Array.isArray(card.requiredBaseClasses)&&card.requiredBaseClasses.length&&!card.requiredBaseClasses.some(name=>baseClasses.has(name)))return false;
  if(Array.isArray(card.legalActiveClasses)&&card.legalActiveClasses.length&&!card.legalActiveClasses.some(name=>lineageClasses.has(name)))return false;
  return true;
}
function incompatibleDeckEntries(slots=state.slots,deck=state.deck){return Object.entries(deck).filter(([,qty])=>qty>0).map(([id,quantity])=>({card:state.byId.get(id),quantity})).filter(entry=>!cardCompatible(entry.card,slots)).sort((a,b)=>idSort(a.card,b.card))}
function lostCompatibilityEntries(proposedSlots){return Object.entries(state.deck).filter(([,qty])=>qty>0).map(([id,quantity])=>({card:state.byId.get(id),quantity})).filter(entry=>cardCompatible(entry.card,state.slots)&&!cardCompatible(entry.card,proposedSlots)).sort((a,b)=>idSort(a.card,b.card))}
function familyCount(family){return Object.entries(state.deck).reduce((sum,[id,qty])=>sum+(state.byId.get(id)?.family===family?Number(qty):0),0)}

function compatibleLegacies(progressionId,slotIndex,slots=state.slots){
  const progression=state.progressionById.get(progressionId);if(!progression)return [];
  const used=new Set(slots.map((slot,index)=>index===slotIndex?'':slot.legacyId).filter(Boolean));
  return state.legacyCards.filter(card=>card.family==='LegacyModeDefinition'&&card.classGroup===progression.baseClass&&!used.has(card.id)).sort(idSort);
}
function defaultLegacyForProgression(progressionId,slotIndex,slots=state.slots){return compatibleLegacies(progressionId,slotIndex,slots)[0]?.id||''}

function updateTabs(){
  const total=legacyCardCount();
  $('legacyTabCount').textContent=`${total} / 12`;$('legacyDeckTotal').textContent=total;
  $('heroCountBadge').textContent=selectedProgressions().length*3;$('legacyCountBadge').textContent=state.slots.filter(slot=>slot.legacyId).length;
  $('mainTabButton').disabled=false;$('mainTabButton').classList.remove('locked');$('mainTabButton').removeAttribute('title');$('mainTabCount').textContent=`${countDeck()} / 60`;
}
function setTab(tab){
  state.tab=tab;
  document.querySelectorAll('.tab-button').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
  $('legacyView').hidden=tab!=='legacy';$('mainView').hidden=tab!=='main';
  if(tab==='legacy')renderLegacy();else renderMain();
}
function cycleRank(delta){state.rankView=Math.max(1,Math.min(3,state.rankView+delta));renderLegacy()}
function swapSlots(a,b){[state.slots[a],state.slots[b]]=[state.slots[b],state.slots[a]];renderLegacy();renderMain();toast(`${POSITIONS[a]} and ${POSITIONS[b]} swapped`)}

function swapIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10l-3-3M17 17H7l3 3M17 7l3 3-3 3M7 17l-3-3 3-3"/></svg>'}
function positionSwapIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3"/></svg>'}
function reviewButton(cardId){return `<button class="review-button" type="button" data-review-id="${esc(cardId)}" aria-label="Preview card"><img src="../assets/ui/expand.png" alt=""></button>`}
function heroStageHtml(slot,index){
  const progression=state.progressionById.get(slot.progressionId),card=progression?state.legacyById.get(progression.cardIds[state.rankView-1]):null;
  if(!card)return `<button class="card-stage empty" type="button" data-choose-hero="${index}"><span>CLICK TO SELECT<br><b>${POSITIONS[index]} HERO</b></span></button>`;
  return `<div class="card-stage"><img src="${card.image}" alt="${esc(card.name)}"><div class="card-actions"><button class="icon-action" type="button" data-choose-hero="${index}" title="Change Hero Progression" aria-label="Change Hero Progression">${swapIcon()}</button>${reviewButton(card.id)}</div></div>`;
}
function renderLegacy(){
  const grid=[];
  state.slots.forEach((slot,index)=>{
    grid.push(`<article class="hero-slot">${heroStageHtml(slot,index)}<div class="position-label">${POSITIONS[index]}</div></article>`);
    if(index<2)grid.push(`<button class="position-swap" type="button" data-swap-left="${index}" title="Swap Position" aria-label="Swap ${POSITIONS[index]} and ${POSITIONS[index+1]}">${positionSwapIcon()}</button>`);
  });
  $('heroSlotsGrid').innerHTML=grid.join('');$('rankLabel').textContent=`RANK ${['I','II','III'][state.rankView-1]}`;
  $('legacySlotsGrid').innerHTML=state.slots.map((slot,index)=>{
    const card=state.legacyById.get(slot.legacyId),options=compatibleLegacies(slot.progressionId,index).concat(card&&!compatibleLegacies(slot.progressionId,index).some(item=>item.id===card.id)?[card]:[]).sort(idSort);
    const selectOptions=slot.progressionId?options.map(item=>`<option value="${item.id}" ${item.id===slot.legacyId?'selected':''}>${esc(item.name)}</option>`).join(''):'<option value="">Choose a Hero first</option>';
    return `<article class="legacy-slot"><div class="legacy-card-stage">${card?`<img src="${card.image}" alt="${esc(card.name)}">${reviewButton(card.id)}`:`<div class="legacy-placeholder">Legacy appears automatically after choosing a Hero.</div>`}</div><select class="legacy-select" data-legacy-slot="${index}" ${slot.progressionId?'':'disabled'}>${selectOptions}</select></article>`;
  }).join('');
  document.querySelectorAll('[data-choose-hero]').forEach(button=>button.addEventListener('click',()=>openHeroPicker(Number(button.dataset.chooseHero))));
  document.querySelectorAll('[data-swap-left]').forEach(button=>button.addEventListener('click',()=>swapSlots(Number(button.dataset.swapLeft),Number(button.dataset.swapLeft)+1)));
  document.querySelectorAll('[data-legacy-slot]').forEach(select=>select.addEventListener('change',()=>{state.slots[Number(select.dataset.legacySlot)].legacyId=select.value;renderLegacy();renderMain()}));
  bindReviewButtons(document);updateTabs();
}

function openHeroPicker(slotIndex){state.heroPickerSlot=slotIndex;$('heroPickerTitle').textContent=`Select ${POSITIONS[slotIndex]} Hero Progression`;renderHeroPicker();$('heroPickerDialog').showModal()}
function renderHeroPicker(){
  const used=new Set(state.slots.map((slot,index)=>index===state.heroPickerSlot?'':slot.progressionId).filter(Boolean));
  $('heroPickerGrid').innerHTML=state.progressions.map(progression=>{
    const cards=progression.cardIds.map(id=>state.legacyById.get(id)).filter(Boolean);
    const classes=(progression.classLineage||[]).join(' → ')||progression.lineage||progression.baseClass||'';
    return `<button class="hero-choice ${used.has(progression.id)?'used':''}" type="button" data-progression-choice="${progression.id}" ${used.has(progression.id)?'disabled':''}><div class="hero-choice-cards">${cards.map(card=>`<img src="${card.image}" alt="${esc(card.name)}">`).join('')}</div><div class="hero-choice-info"><strong>${esc(progression.name)}</strong><span>${esc(classes)}</span></div></button>`;
  }).join('');
  document.querySelectorAll('[data-progression-choice]').forEach(button=>button.addEventListener('click',()=>selectProgression(state.heroPickerSlot,button.dataset.progressionChoice)));
}
async function selectProgression(slotIndex,progressionId){
  if(state.slots[slotIndex].progressionId===progressionId){$('heroPickerDialog').close();return}
  const proposed=clone(state.slots);proposed[slotIndex].progressionId=progressionId;proposed[slotIndex].legacyId=defaultLegacyForProgression(progressionId,slotIndex,proposed);
  const removed=lostCompatibilityEntries(proposed);
  if(removed.length){
    const total=removed.reduce((sum,item)=>sum+item.quantity,0),ok=await askConfirm({eyebrow:'HERO CHANGE',title:'Change Hero and remove incompatible cards?',message:`Changing this Hero will remove <b>${total}</b> Main Deck card${total===1?'':'s'} that the new formation cannot use.`,list:removed.map(item=>({label:item.card?.name||item.card?.id||'Unknown',value:`×${item.quantity}`})),okLabel:'CHANGE HERO',danger:true});
    if(!ok)return;
  }
  state.slots=proposed;removed.forEach(item=>{if(item.card)delete state.deck[item.card.id]});$('heroPickerDialog').close();renderLegacy();renderMain();toast('Hero progression selected');
}

function syncFilterControls(){
  $('searchInput').value=state.filters.search;$('familyFilter').value=state.filters.family;$('classFilter').value=state.filters.className;$('skillTypeFilter').value=state.filters.skillType;$('attackStyleFilter').value=state.filters.attackStyle;$('manaMin').value=String(state.filters.manaMin);$('manaMax').value=String(state.filters.manaMax);updateManaRange();updateFilterStates();
}
function switchFilterFamily(family){
  const oldKey=state.filters.family||'all';state.filterSets[oldKey]={...state.filters};const key=family||'all';state.filters={...(state.filterSets[key]||defaultFilterSet(family)),family};state.filterSets[key]=state.filters;syncFilterControls();renderLibrary();
}
function updateFilterStates(){
  const skill=state.filters.family==='Skill';
  for(const id of ['classField','skillTypeField']){$(id).classList.toggle('disabled',!skill);$(id).querySelector('select').disabled=!skill}
  const attack=skill&&state.filters.skillType==='Attack';$('attackStyleField').classList.toggle('disabled',!attack);$('attackStyleFilter').disabled=!attack;
  $('allCardsToggle').classList.toggle('active',state.filters.pool==='all');$('allCardsToggle').setAttribute('aria-checked',String(state.filters.pool==='all'));
  $('availableCardsToggle').classList.toggle('active',state.filters.pool==='available');$('availableCardsToggle').setAttribute('aria-checked',String(state.filters.pool==='available'));
}
function updateManaRange(){
  let min=Number($('manaMin').value),max=Number($('manaMax').value);if(min>max){if(document.activeElement===$('manaMin'))max=min;else min=max;$('manaMin').value=String(min);$('manaMax').value=String(max)}
  state.filters.manaMin=min;state.filters.manaMax=max;$('manaRangeValue').textContent=`${min}–${max}`;const minPct=min/9*100,maxPct=max/9*100;$('manaRangeTrack').style.background=`linear-gradient(to right,#30323d 0 ${minPct}%,#0aa8f6 ${minPct}% ${maxPct}%,#30323d ${maxPct}% 100%)`;
}
function filteredCards(){
  const query=state.filters.search.trim().toLowerCase();
  return state.cards.filter(card=>{
    const compatible=cardCompatible(card),mana=manaNumber(card),haystack=String(card.name||'').toLowerCase();
    if(state.filters.pool==='available'&&selectedProgressions().length>0&&!compatible)return false;
    if(query&&!haystack.includes(query))return false;
    if(state.filters.family&&card.family!==state.filters.family)return false;
    if(state.filters.family==='Skill'){
      if(state.filters.className&&card.classGroup!==state.filters.className&&!card.legalActiveClasses?.includes(state.filters.className))return false;
      if(state.filters.skillType&&skillType(card)!==state.filters.skillType)return false;
      if(state.filters.attackStyle&&attackStyle(card)!==state.filters.attackStyle)return false;
    }
    if(mana<state.filters.manaMin||mana>state.filters.manaMax)return false;
    return true;
  }).sort(mainDeckSort);
}
function libraryCardHtml(card){const compatible=cardCompatible(card),quantity=Number(state.deck[card.id]||0);return `<article class="library-card ${compatible?'':'incompatible'}" data-library-card="${card.id}" draggable="${compatible?'true':'false'}" title="${esc(card.name)}${compatible?'':' — Not compatible'}"><img src="${card.image}" alt="${esc(card.name)}">${quantity>0?`<span class="quantity-badge library-quantity-badge">×${quantity}</span>`:''}${reviewButton(card.id)}</article>`}
function renderLibrary(){
  const root=$('cardLibrary'),scrollTop=root.scrollTop,cards=filteredCards();$('resultCount').textContent=cards.length;root.innerHTML=cards.map(libraryCardHtml).join('');root.scrollTop=scrollTop;
  root.querySelectorAll('[data-library-card]').forEach(tile=>{
    const id=tile.dataset.libraryCard;
    tile.addEventListener('click',event=>{if(event.target.closest('.review-button'))return;addMainCard(id)});
    tile.addEventListener('contextmenu',event=>{event.preventDefault();removeMainCard(id)});
    tile.addEventListener('dragstart',event=>{if(!cardCompatible(state.byId.get(id))){event.preventDefault();return}event.dataTransfer.setData('text/grandis-card-id',id);event.dataTransfer.effectAllowed='copy'});
  });
  bindReviewButtons(root);
}
function addMainCard(id){
  const card=state.byId.get(id);if(!card)return;if(!cardCompatible(card)){toast('This card is not compatible with the selected Heroes');return}
  const current=Number(state.deck[id]||0),limit=copyLimit(card);if(countDeck()>=60){toast('Main Deck already contains 60 cards');return}if(current>=limit){toast(`Maximum ${limit} cop${limit===1?'y':'ies'} reached`);return}
  state.deck[id]=current+1;renderLibrary();renderMainDeck();updateTabs();
}
function removeMainCard(id){const current=Number(state.deck[id]||0);if(current<=0)return;if(current===1)delete state.deck[id];else state.deck[id]=current-1;renderLibrary();renderMainDeck();updateTabs()}
function locateCardInLibrary(id){
  const root=$('cardLibrary');
  const findTile=()=>Array.from(root.querySelectorAll('[data-library-card]')).find(tile=>tile.dataset.libraryCard===id);
  let tile=findTile();
  if(!tile){
    const card=state.byId.get(id),family=card?.family||'',fresh=defaultFilterSet(family),key=family||'all';state.filters=fresh;state.filterSets[key]=fresh;syncFilterControls();renderLibrary();
    tile=findTile();
    toast('Filters reset to locate this card');
  }
  if(!tile)return;
  tile.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  tile.classList.remove('located-card');void tile.offsetWidth;tile.classList.add('located-card');
  clearTimeout(locateCardInLibrary.timer);locateCardInLibrary.timer=setTimeout(()=>tile.classList.remove('located-card'),1400);
}
function showHover(cardId,anchor){
  if(window.innerWidth<=760||document.querySelector('dialog[open]'))return;
  const card=cardById(cardId),box=$('hoverCardZoom'),image=$('hoverCardZoomImage');if(!card||!anchor)return;
  image.src=card.image;image.alt=`${card.name} preview`;box.hidden=false;box.classList.add('is-visible');box.setAttribute('aria-hidden','false');
  const rect=anchor.getBoundingClientRect(),panel=anchor.closest('.main-deck-panel')?.getBoundingClientRect(),width=250,height=350,minX=panel?panel.left+8:8,maxX=Math.min(window.innerWidth-width-8,panel?panel.right-width-8:window.innerWidth-width-8);let x=rect.left+(rect.width-width)/2,y=rect.top-height-10;
  if(y<8)y=Math.min(window.innerHeight-height-8,rect.bottom+10);x=Math.max(minX,Math.min(x,maxX));box.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
}
function hideHover(){const box=$('hoverCardZoom');if(!box)return;box.classList.remove('is-visible');box.hidden=true;box.style.transform='translate3d(-9999px,-9999px,0)';box.setAttribute('aria-hidden','true')}
function renderMainDeck(){
  const root=$('deckGrid'),scrollTop=root.scrollTop,entries=Object.entries(state.deck).filter(([,qty])=>qty>0).map(([id,quantity])=>({card:state.byId.get(id),quantity})).filter(item=>item.card).sort(mainDeckSort);
  root.innerHTML=entries.map(({card,quantity})=>`<article class="deck-card" data-deck-card="${card.id}" draggable="true" title="${esc(card.name)}"><img src="${card.image}" alt="${esc(card.name)}"><span class="quantity-badge">×${quantity}</span>${reviewButton(card.id)}</article>`).join('');root.scrollTop=scrollTop;
  root.querySelectorAll('[data-deck-card]').forEach(tile=>{const id=tile.dataset.deckCard;tile.addEventListener('click',event=>{if(event.target.closest('.review-button'))return;locateCardInLibrary(id)});tile.addEventListener('contextmenu',event=>event.preventDefault());tile.addEventListener('dragstart',event=>{if(event.target.closest('.review-button')){event.preventDefault();return}event.dataTransfer.setData('text/grandis-remove-card-id',id);event.dataTransfer.effectAllowed='move';tile.classList.add('dragging')});tile.addEventListener('dragend',()=>tile.classList.remove('dragging'))});bindReviewButtons(root);
  const total=countDeck();$('deckCount').textContent=total;$('mainTabCount').textContent=`${total} / 60`;$('skillCount').textContent=familyCount('Skill');$('eventCount').textContent=familyCount('Event');$('itemCount').textContent=familyCount('Item');
  const valid=validationIssues().length===0;$('deckValidation').textContent=valid?'Deck Valid':'Incomplete';$('deckValidation').classList.toggle('valid',valid);$('emptyDeck').hidden=entries.length>0;
}
function renderMain(){updateFilterStates();renderLibrary();renderMainDeck();updateTabs()}

function reviewEyebrow(card){if(card.family==='Hero')return 'HERO NAME';if(card.family==='Skill')return 'SKILL NAME';if(card.family==='Event')return 'EVENT NAME';if(card.family==='Item')return 'ITEM NAME';if(card.family==='LegacyModeDefinition')return 'LEGACY NAME';return 'CARD NAME'}
function reviewType(card){return card.family==='LegacyModeDefinition'?'Legacy Card':card.family==='Skill'?card.classification:card.family}
function reviewCost(card){return card.cost&&card.cost!=='No Mana cost'?card.cost:'—'}
function reviewManaValue(card){const cost=String(card?.cost||'').trim();if(!cost||cost==='No Mana cost')return '—';if(cost.includes(':'))return cost.replace(/\s*[·•]\s*/g,' • ');const simple=cost.match(/^(\d+)\s*Mana$/i);return simple?simple[1]:cost}
function labeledRowName(label='',prefix=''){const clean=String(label).replace(new RegExp(`^${prefix}\\s*[—-]?\\s*`,'i'),'').trim();return clean||prefix}
function romanRank(value){return ({1:'I',2:'II',3:'III'})[Number(value||1)]||String(value||'—')}
function rankUpBonusText(rank){const value=Number(rank||1);if(value===2)return 'After Rank Up, draw 2 cards and gain +1 Mana Regen.';if(value===3)return 'After Rank Up, draw 3 cards and gain +1 Mana Regen.';return ''}
function heroExpValue(rank){return ({1:'—',2:'300',3:'700'})[Number(rank||1)]||'—'}
function rowClassRank(label=''){const match=String(label).match(/^(.+?)\s*\((Rank\s+[IVX]+)\)\s*$/i);return match?{className:match[1].trim(),rank:match[2].replace(/^rank/i,'Rank')}:{className:String(label).replace(/\s*[—-].*$/,'').trim(),rank:'—'}}
function metricDamageType(card,row={},label=''){if(!['DAMAGE','BLOCK'].includes(label))return '';const primary=label==='DAMAGE'?String(row.damage_text||row.text||card.classification||''):String(row.effect_text||row.text||row.damage_text||'');const hasPhysical=/\bPhysical\b/i.test(primary),hasMagical=/\bMagical\b/i.test(primary);if(hasPhysical&&hasMagical)return 'Physical / Magical';if(hasPhysical)return 'Physical';if(hasMagical)return 'Magical';return ''}
function effectMetric(card,row={}){const classification=String(card.classification||''),source=[row.damage_text,row.effect_text,row.text].filter(Boolean).join(' ');let label='',match=null;if(/Attack/i.test(classification)){label='DAMAGE';match=source.match(/(?:Deal|Inflict)\s+([+-]?\d+)[^.]*?damage/i)||source.match(/([+-]?\d+)\s*(?:Physical|Magical)?\s*damage/i)}else if(/Defense/i.test(classification)){label='BLOCK';match=source.match(/Block\s+([+-]?\d+)/i)}else if(/Support/i.test(classification)){label='HEAL';match=source.match(/(?:Heal|Restore)[^.]*?([+-]?\d+)/i)||source.match(/\+\s*(\d+)\s*HP/i)}return label&&match?{label,value:match[1],damageType:metricDamageType(card,row,label)}:null}
function skillEffectText(row={},metric=null){let effect=String(row.effect_text||row.text||'').trim();if(!metric)return effect||String(row.damage_text||'—').trim()||'—';if(metric.label==='DAMAGE')effect=effect.replace(/^(?:Deal|Inflict)\s+[+-]?\d+[^.]*?damage\.\s*/i,'').trim();else if(metric.label==='BLOCK')effect=effect.replace(/^Block\s+[+-]?\d+[^.]*?damage[^.]*\.\s*/i,'').trim();else if(metric.label==='HEAL')effect=effect.replace(/^(?:Heal|Restore)[^.]*?[+-]?\d+[^.]*\.\s*/i,'').trim();return effect||'—'}
function itemClassText(card){const classes=Array.isArray(card.requiredBaseClasses)?card.requiredBaseClasses.filter(Boolean):[];return classes.length?classes.join(' • '):'All Classes'}
function heroReviewHtml(card){const rows=card.rows||[],racialRow=rows.find(row=>/^Racial Trait/i.test(row.label||'')),dualRow=rows.find(row=>/^Dual Class/i.test(row.label||'')),abilityRow=rows.find(row=>/^Class Ability/i.test(row.label||'')),racialName=labeledRowName(racialRow?.label||'Racial Trait','Racial Trait'),abilityName=abilityRow?labeledRowName(abilityRow.label,'Class Ability'):'',rank=Number(card.rank||card.rankNumeric||1);$('reviewStats').innerHTML=`<div class="review-summary hero-summary"><div class="review-summary-item"><span>RANK</span><strong>Rank ${esc(romanRank(rank))}</strong></div><div class="review-summary-item"><span>HP</span><strong>${esc(card.hp||'—')}</strong></div><div class="review-summary-item"><span>EXP</span><strong>${esc(heroExpValue(rank))}</strong></div></div>`;const blocks=[`<div class="review-hero-block"><span>RACIAL</span><strong>${esc(card.race||'—')}</strong><span>RACIAL TRAIT</span><strong>${esc(racialName)}</strong><p>${esc(racialRow?.text||card.text||'—')}</p></div>`,`<div class="review-hero-block"><span>CLASS</span><strong>${esc(card.classGroup||'—')}</strong>${dualRow?`<span>DUAL CLASS</span><p>${esc(dualRow.text||'—')}</p>`:''}${abilityRow?`<span>CLASS ABILITY</span><strong>${esc(abilityName)}</strong><p>${esc(abilityRow.text||'—')}</p>`:''}</div>`];const bonus=rankUpBonusText(rank);if(bonus)blocks.push(`<div class="review-generic-row rank-up-review"><span>RANK UP BONUS</span><p>${esc(bonus)}</p></div>`);$('reviewRows').innerHTML=blocks.join('')}
function standardReviewHtml(card){const stats=[];if(card.family==='Skill')stats.push(['MANA COST',reviewManaValue(card)],['TYPE',reviewType(card)],['EXP TRIBUTE',card.ultimate?.isUltimate?'200 EXP':'100 EXP']);else if(card.family==='LegacyModeDefinition')stats.push(['COST','—'],['TYPE','Legacy Card'],['CLASS',card.classGroup||'—']);else stats.push(['MANA COST',reviewCost(card)],['TYPE',reviewType(card)]);$('reviewStats').innerHTML=`<div class="review-summary ${stats.length===2?'two-column-summary':''}">${stats.map(([label,value])=>`<div class="review-summary-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;const rows=card.rows?.length?card.rows:[{label:'Effect',text:card.text}];if(card.family==='Skill'){const isUltimate=Boolean(card.ultimate?.isUltimate),effectRows=rows.map((row,index)=>{const parsed=rowClassRank(row.label),metric=effectMetric(card,row),rankText=isUltimate&&/Rank\s+III/i.test(parsed.rank)&&index===rows.length-1?`Ultimate ${parsed.rank}`:parsed.rank,effectText=skillEffectText(row,metric),rankClass=isUltimate&&/^Ultimate\s+Rank\s+III$/i.test(rankText)?' class="ultimate-rank"':'';if(metric)return `<div class="review-effect-row has-metric"><div class="review-effect-class"><span>CLASS</span><strong>${esc(parsed.className||card.classGroup||'—')}</strong></div><div class="review-effect-rank"><span>RANK</span><strong${rankClass}>${esc(rankText)}</strong></div><div class="review-effect-metric"><span>${esc(metric.label)}</span><strong>${esc(metric.value)}</strong>${metric.damageType?`<small class="review-metric-type">${esc(metric.damageType)}</small>`:''}</div><div class="review-effect-info"><span>SKILL EFFECT</span><p>${esc(effectText)}</p></div></div>`;return `<div class="review-effect-row no-metric"><div class="review-effect-class"><span>CLASS</span><strong>${esc(parsed.className||card.classGroup||'—')}</strong></div><div class="review-effect-rank"><span>RANK</span><strong${rankClass}>${esc(rankText)}</strong></div><div class="review-effect-info full-span"><span>SKILL EFFECT</span><p>${esc(effectText)}</p></div></div>`}).join(''),rules=isUltimate&&card.ultimate?.owner?`<div class="review-ultimate-rules"><span>ULTIMATE RULES</span><p>Only ${esc(card.ultimate.owner)} can use this card or Tribute it for EXP.</p></div>`:'';$('reviewRows').innerHTML=effectRows+rules}else if(card.family==='Item'){const effect=rows.map(row=>row.effect_text||row.text||row.damage_text||'').filter(Boolean).join(' ');$('reviewRows').innerHTML=`<div class="review-effect-row item-effect-row no-metric"><div><span>CLASS</span><strong>${esc(itemClassText(card))}</strong></div><div><span>RANK</span><strong>All Ranks</strong></div><div class="review-effect-info full-span"><span>ITEM EFFECT</span><p>${esc(effect||'—')}</p></div></div>`}else if(card.family==='Event'){const effect=rows.map(row=>row.effect_text||row.text||row.damage_text||'').filter(Boolean).join(' ');$('reviewRows').innerHTML=`<div class="review-generic-row review-large-effect"><span>EVENT EFFECT</span><p>${esc(effect||'—')}</p></div>`}else if(card.family==='LegacyModeDefinition'){const effect=rows.map(row=>row.effect_text||row.text||row.damage_text||'').filter(Boolean).join(' ');$('reviewRows').innerHTML=`<div class="review-generic-row"><span>LEGACY ABILITY</span><p>${esc(effect||'—')}</p></div>`}else{$('reviewRows').innerHTML=rows.map(row=>`<div class="review-generic-row"><span>${esc(String(row.label||'CARD EFFECT').toUpperCase())}</span><p>${esc(row.text||row.effect_text||row.damage_text||'—')}</p></div>`).join('')}}
function openCardReview(cardId){
  const card=cardById(cardId);if(!card)return;const dialog=$('cardReviewDialog');dialog.dataset.reviewKind=card.family==='Hero'?'hero':card.family==='Skill'?'skill':card.family==='Item'?'item':card.family==='Event'?'event':card.family==='LegacyModeDefinition'?'legacy':'standard';$('reviewTitle').textContent=card.name;$('reviewEyebrow').textContent=reviewEyebrow(card);$('reviewArt').src=card.image;$('reviewArt').alt=card.name;if(card.family==='Hero')heroReviewHtml(card);else standardReviewHtml(card);
  const progression=state.progressionByHeroId.get(card.id),box=$('reviewProgression');if(progression){box.hidden=false;$('reviewProgressionCards').innerHTML=progression.cardIds.map(id=>{const hero=cardById(id);return `<button class="review-progression-card ${id===card.id?'active':''}" type="button" data-review-rank-id="${id}"><img src="${hero.image}" alt="${esc(hero.name)}"></button>`}).join('');document.querySelectorAll('[data-review-rank-id]').forEach(button=>button.addEventListener('click',()=>openCardReview(button.dataset.reviewRankId)))}else{box.hidden=true;$('reviewProgressionCards').innerHTML=''}
  if(!dialog.open)dialog.showModal();
}
function bindReviewButtons(root){root.querySelectorAll('[data-review-id]').forEach(button=>{if(button.dataset.bound)return;button.dataset.bound='1';button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openCardReview(button.dataset.reviewId)})})}

function legacyReferenceSort(a,b){
  const familyOrder=card=>card.family==='Hero'?0:card.family==='LegacyModeDefinition'?1:2;
  const familyDiff=familyOrder(a)-familyOrder(b);if(familyDiff)return familyDiff;
  return idSort(a,b);
}
function legacyReferenceCardHtml(card){return `<article class="legacy-reference-card-tile" title="${esc(card.name)}"><img src="${card.image}" alt="${esc(card.name)}">${reviewButton(card.id)}</article>`}
function renderLegacyReferenceLibrary(){
  const cards=state.legacyCards.slice().sort(legacyReferenceSort),root=$('legacyReferenceGrid');if(!root)return;
  $('legacyReferenceCount').textContent=cards.length;root.innerHTML=cards.map(legacyReferenceCardHtml).join('');bindReviewButtons(root);
}
function openLegacyReferenceLibrary(){const dialog=$('legacyReferenceDialog');renderLegacyReferenceLibrary();if(dialog&&!dialog.open)dialog.showModal()}

function validationIssues(){
  const issues=[];if(!heroFormationComplete())issues.push('Select three Hero progressions.');if(!legacyUniqueComplete())issues.push('Choose three unique Legacy Cards.');if(legacyCardCount()!==12)issues.push(`Legacy Deck must contain 12 cards (currently ${legacyCardCount()}).`);if(countDeck()!==60)issues.push(`Main Deck must contain exactly 60 cards (currently ${countDeck()}).`);
  const incompatible=incompatibleDeckEntries();if(incompatible.length)issues.push(`${incompatible.reduce((sum,item)=>sum+item.quantity,0)} Main Deck card(s) are incompatible with the selected Heroes.`);for(const [id,quantity] of Object.entries(state.deck)){const card=state.byId.get(id);if(!card)issues.push(`Unknown card ID: ${id}.`);else if(quantity>copyLimit(card))issues.push(`${card.name} exceeds its copy limit.`)}return issues;
}
function askConfirm({eyebrow='CONFIRM',title,message,list=[],okLabel='OK',danger=false}){
  return new Promise(resolve=>{const dialog=$('confirmDialog'),finish=value=>{if(dialog.open)dialog.close();cleanup();resolve(value)},cleanup=()=>{$('confirmOk').onclick=null;$('confirmCancel').onclick=null;$('confirmClose').onclick=null;dialog.oncancel=null};$('confirmEyebrow').textContent=eyebrow;$('confirmTitle').textContent=title;$('confirmMessage').innerHTML=message;const listEl=$('confirmList');if(list.length){listEl.hidden=false;listEl.innerHTML=list.map(item=>`<div class="confirm-item"><span>${esc(item.label)}</span><b>${esc(item.value)}</b></div>`).join('')}else{listEl.hidden=true;listEl.innerHTML=''}$('confirmOk').textContent=okLabel;$('confirmOk').className=danger?'danger':'primary';$('confirmOk').onclick=()=>finish(true);$('confirmCancel').onclick=()=>finish(false);$('confirmClose').onclick=()=>finish(false);dialog.oncancel=event=>{event.preventDefault();finish(false)};dialog.showModal()})
}

function blankDeck(){state.deck={};state.slots=[emptySlot(),emptySlot(),emptySlot()];state.rankView=1;$('deckName').value='New Deck';resetAllFilterSets();setTab('legacy');renderLegacy();renderMain()}
function normalizeImportedDeck(data){
  const deck={};const entries=Array.isArray(data.main_deck)?data.main_deck:Array.isArray(data.mainDeck)?data.mainDeck:[];for(const item of entries){const id=item.card_id||item.cardId||item.id,card=state.byId.get(id),quantity=Number(item.quantity??item.qty??1);if(card&&Number.isFinite(quantity)&&quantity>0)deck[id]=Math.min(Math.floor(quantity),copyLimit(card))}
  let rawSlots=(data.legacy_deck_package_slots||data.side_deck_package_slots||data.legacySlots||[]).slice(0,3).map(slot=>({progressionId:slot.progression||slot.progressionId||'',legacyId:slot.legacy||slot.legacyId||''}));while(rawSlots.length<3)rawSlots.push(emptySlot());
  const formation=data.default_formation||data.formation||{},ordered=[];for(const position of POSITIONS){const heroId=formation[position]||formation[position.toLowerCase()]||'',match=rawSlots.find(slot=>state.progressionById.get(slot.progressionId)?.cardIds[0]===heroId&&!ordered.includes(slot));if(match)ordered.push(match)}rawSlots.forEach(slot=>{if(!ordered.includes(slot))ordered.push(slot)});const slots=ordered.slice(0,3),used=new Set();slots.forEach((slot,index)=>{if(!state.progressionById.has(slot.progressionId)){slots[index]=emptySlot();return}const compatible=compatibleLegacies(slot.progressionId,index,slots);if(!slot.legacyId||used.has(slot.legacyId)||!state.legacyById.has(slot.legacyId))slot.legacyId=compatible.find(card=>!used.has(card.id))?.id||'';if(slot.legacyId)used.add(slot.legacyId)});return {name:data.deck_name||data.deckName||'Imported Deck',deck,slots};
}
function applyDeck(normalized){state.deck={...normalized.deck};state.slots=clone(normalized.slots);$('deckName').value=normalized.name||'New Deck';state.rankView=1;resetAllFilterSets();setTab('legacy');renderLegacy();renderMain()}
function starterCover(starter,index){const preferred=['Warrior','Cleric','Thief','Archer','Mage'][index]||'',slots=starter.legacy_deck_package_slots||starter.side_deck_package_slots||[],preferredSlot=slots.find(slot=>state.progressionById.get(slot.progression)?.baseClass===preferred),progressionId=preferredSlot?.progression||slots[0]?.progression;return state.progressionById.get(progressionId)?.coverImage||state.progressions[0]?.coverImage||''}
function renderStarterDialog(){$('starterList').innerHTML=state.starters.map((starter,index)=>{const raw=String(starter.deck_name||`Starter ${index+1}`).replace(/^Starter\s*\d+\s*[-–—]\s*/i,''),name=raw.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\//g,' / '),classes=(starter.legacy_deck_package_slots||[]).map(slot=>state.progressionById.get(slot.progression)?.baseClass).filter(Boolean).join(' • ');return `<button class="starter-option" type="button" data-starter-index="${index}"><span>STARTER ${index+1}</span><img src="${starterCover(starter,index)}" alt=""><strong>${esc(name)}</strong><small>${esc(classes)}</small></button>`}).join('');document.querySelectorAll('[data-starter-index]').forEach(button=>button.addEventListener('click',()=>{applyDeck(normalizeImportedDeck(state.starters[Number(button.dataset.starterIndex)]));$('starterDialog').close();toast('Starter Deck loaded')}))}
async function openStarter(){if(isDeckDirty()){const ok=await askConfirm({eyebrow:'LOAD STARTER',title:'Replace the current deck?',message:'Loading a Starter replaces the current Legacy Deck, Main Deck, and deck name.',okLabel:'CONTINUE',danger:true});if(!ok)return}$('starterDialog').showModal()}
async function clearDeck(){if(!isDeckDirty()){blankDeck();return}const ok=await askConfirm({eyebrow:'CLEAR DECK',title:'Clear the current deck?',message:'This removes every selected Hero, Legacy, and Main Deck card.',okLabel:'CLEAR DECK',danger:true});if(ok){blankDeck();toast('Deck cleared')}}
async function importDeckFile(file){try{const data=JSON.parse(await file.text());applyDeck(normalizeImportedDeck(data));toast('Deck imported')}catch(error){await askConfirm({eyebrow:'IMPORT ERROR',title:'Could not import this deck',message:esc(error.message||String(error)),okLabel:'CLOSE'})}finally{$('jsonFileInput').value=''}}
function expandedLegacy(){const output=[];state.slots.forEach((slot,index)=>{const progression=state.progressionById.get(slot.progressionId),legacy=state.legacyById.get(slot.legacyId);if(!progression)return;const packageId=`CUSTOM-SLOT-${index+1}`,packageName=`${progression.name}${legacy?` + ${legacy.name}`:''}`;progression.cardIds.forEach(id=>{const card=state.legacyById.get(id);if(card)output.push({card_id:id,card_name:card.name,card_type:'Hero',package_id:packageId,package_name:packageName})});if(legacy)output.push({card_id:legacy.id,card_name:legacy.name,card_type:'Legacy',package_id:packageId,package_name:packageName})});return output}
function exportObject(){const issues=validationIssues(),slots=state.slots.map(slot=>({progression:slot.progressionId,legacy:slot.legacyId}));return {schema_version:'GL-DECK-1.0',builder_version:'2.15-classic-split',deck_name:$('deckName').value.trim()||'New Deck',format:'One Source Authority v1.4 + Public Deck Builder v2.11',main_deck_count:countDeck(),legacy_package_count:selectedProgressions().length,legacy_deck_count:legacyCardCount(),legacy_deck_label:'Legacy Deck',legacy_deck_package_slots:slots,legacy_deck_expanded:expandedLegacy(),side_package_count:selectedProgressions().length,side_deck_count:legacyCardCount(),side_deck_package_slots:slots,side_deck_expanded:expandedLegacy(),is_valid:issues.length===0,validation_issues:issues,validation_warnings:[],main_deck:Object.entries(state.deck).map(([id,quantity])=>({card_id:id,card_name:state.byId.get(id)?.name||id,quantity,family:state.byId.get(id)?.family||''})).sort((a,b)=>mainDeckSort({card:{id:a.card_id,family:a.family}},{card:{id:b.card_id,family:b.family}})).map(({family,...entry})=>entry),default_formation:{LEFT:state.progressionById.get(state.slots[0].progressionId)?.cardIds[0]||'',CENTER:state.progressionById.get(state.slots[1].progressionId)?.cardIds[0]||'',RIGHT:state.progressionById.get(state.slots[2].progressionId)?.cardIds[0]||''},source_database_version:window.GL_DECK_BUILDER_DATA.sourceDatabaseVersion,builder_version_note:'Classic two-tab Deck Builder v2.15 with Card Library sorting locked to Skill, Event, then Item before Card ID order; Legacy Deck Library header controls vertically centered; full-card Legacy reference layout, compact filters, v3.13 Card Review hierarchy, bidirectional drag-and-drop, and PvP navigation preserved.'}}
function downloadJson(object){const safe=(object.deck_name||'Grandis_Legacy_Deck').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'Grandis_Legacy_Deck',blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`${safe}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportDeck(){const object=exportObject();if(!object.is_valid){const ok=await askConfirm({eyebrow:'EXPORT DECK',title:'Export an incomplete deck?',message:'This deck is not match-ready yet.',list:object.validation_issues.map(issue=>({label:issue,value:'Issue'})),okLabel:'EXPORT ANYWAY'});if(!ok)return}downloadJson(object);toast('Deck exported')}

function resetFilters(){const family=state.filters.family,fresh=defaultFilterSet(family),key=family||'all';state.filters=fresh;state.filterSets[key]=fresh;syncFilterControls();renderLibrary()}
function bindStaticEvents(){
  document.querySelectorAll('.tab-button').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.tab)));$('rankPrev').addEventListener('click',()=>cycleRank(-1));$('rankNext').addEventListener('click',()=>cycleRank(1));
  $('heroPickerClose').addEventListener('click',()=>$('heroPickerDialog').close());$('heroPickerDialog').addEventListener('click',event=>{if(event.target===$('heroPickerDialog'))$('heroPickerDialog').close()});$('starterClose').addEventListener('click',()=>$('starterDialog').close());$('starterDialog').addEventListener('click',event=>{if(event.target===$('starterDialog'))$('starterDialog').close()});$('legacyReferenceOpen').addEventListener('click',openLegacyReferenceLibrary);$('legacyReferenceClose').addEventListener('click',()=>$('legacyReferenceDialog').close());$('legacyReferenceDialog').addEventListener('click',event=>{if(event.target===$('legacyReferenceDialog'))$('legacyReferenceDialog').close()});
  $('reviewClose').addEventListener('click',()=>$('cardReviewDialog').close());$('cardReviewDialog').addEventListener('click',event=>{if(event.target===$('cardReviewDialog'))$('cardReviewDialog').close()});
  $('loadStarter').addEventListener('click',openStarter);$('clearDeck').addEventListener('click',clearDeck);$('importJson').addEventListener('click',()=>$('jsonFileInput').click());$('jsonFileInput').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importDeckFile(file)});$('exportJson').addEventListener('click',exportDeck);
  $('filterToggle').addEventListener('click',()=>{const panel=$('filterPanel'),open=panel.hidden;panel.hidden=!open;$('filterToggle').setAttribute('aria-expanded',String(open));$('filterToggle').classList.toggle('open',open);const icon=$('filterChevron');if(icon)icon.src=`../assets/ui/chevron-${open?'up':'down'}.png`});
  $('searchInput').addEventListener('input',event=>{state.filters.search=event.target.value;renderLibrary()});$('familyFilter').addEventListener('change',event=>switchFilterFamily(event.target.value));$('classFilter').addEventListener('change',event=>{state.filters.className=event.target.value;renderLibrary()});$('skillTypeFilter').addEventListener('change',event=>{state.filters.skillType=event.target.value;if(state.filters.skillType!=='Attack'){state.filters.attackStyle='';$('attackStyleFilter').value=''}updateFilterStates();renderLibrary()});$('attackStyleFilter').addEventListener('change',event=>{state.filters.attackStyle=event.target.value;renderLibrary()});
  $('allCardsToggle').addEventListener('click',()=>{state.filters.pool='all';updateFilterStates();renderLibrary()});$('availableCardsToggle').addEventListener('click',()=>{state.filters.pool='available';updateFilterStates();renderLibrary()});['manaMin','manaMax'].forEach(id=>$(id).addEventListener('input',()=>{updateManaRange();renderLibrary()}));$('resetFilters').addEventListener('click',resetFilters);
  const drop=$('deckGrid');drop.addEventListener('dragover',event=>{if(!Array.from(event.dataTransfer.types||[]).includes('text/grandis-card-id'))return;event.preventDefault();event.dataTransfer.dropEffect='copy';drop.classList.add('drag-over')});drop.addEventListener('dragleave',event=>{if(!drop.contains(event.relatedTarget))drop.classList.remove('drag-over')});drop.addEventListener('drop',event=>{const id=event.dataTransfer.getData('text/grandis-card-id');if(!id)return;event.preventDefault();drop.classList.remove('drag-over');addMainCard(id)});
  const libraryDrop=$('cardLibrary');libraryDrop.addEventListener('dragover',event=>{if(!Array.from(event.dataTransfer.types||[]).includes('text/grandis-remove-card-id'))return;event.preventDefault();event.dataTransfer.dropEffect='move';libraryDrop.classList.add('drag-over-remove')});libraryDrop.addEventListener('dragleave',event=>{if(!libraryDrop.contains(event.relatedTarget))libraryDrop.classList.remove('drag-over-remove')});libraryDrop.addEventListener('drop',event=>{const id=event.dataTransfer.getData('text/grandis-remove-card-id');if(!id)return;event.preventDefault();libraryDrop.classList.remove('drag-over-remove');removeMainCard(id)});
}

(function init(){
  const data=window.GL_DECK_BUILDER_DATA;if(!data)throw new Error('Deck Builder data failed to load.');
  state.cards=data.mainCards||[];state.byId=new Map(state.cards.map(card=>[card.id,card]));state.legacyCards=data.legacyCards||[];state.legacyById=new Map(state.legacyCards.map(card=>[card.id,card]));state.sourcePackages=data.legacyPackages||[];state.starters=data.starters||[];buildProgressions();bindStaticEvents();renderStarterDialog();blankDeck();syncFilterControls();
})();
