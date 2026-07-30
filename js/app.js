'use strict';

const POSITIONS=['LEFT','CENTER','RIGHT'];
const TAB_FAMILY={skills:'Skill',events:'Event',items:'Item'};
const state={
  libraryTab:'heroes',rankView:1,sectionOpen:{legacy:true,main:false},
  cards:[],byId:new Map(),legacyCards:[],legacyById:new Map(),sourcePackages:[],
  progressions:[],progressionById:new Map(),progressionByHeroId:new Map(),starters:[],
  deck:{},slots:[emptySlot(),emptySlot(),emptySlot()],selectedCardId:'',
  filtersByTab:{
    heroes:{search:'',pool:'all',className:'',skillType:'',attackStyle:'',manaMin:0,manaMax:9},
    legacies:{search:'',pool:'all',className:'',skillType:'',attackStyle:'',manaMin:0,manaMax:9},
    skills:{search:'',pool:'available',className:'',skillType:'',attackStyle:'',manaMin:0,manaMax:9},
    events:{search:'',pool:'available',className:'',skillType:'',attackStyle:'',manaMin:0,manaMax:9},
    items:{search:'',pool:'available',className:'',skillType:'',attackStyle:'',manaMin:0,manaMax:9}
  },
  dragging:null,initialChoicePending:true
};
Object.defineProperty(state,'filters',{
  get(){return state.filtersByTab[state.libraryTab]},
  set(value){state.filtersByTab[state.libraryTab]=value}
});

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clone=value=>JSON.parse(JSON.stringify(value));
function emptySlot(){return {progressionId:'',legacyId:''}}
function countDeck(deck=state.deck){return Object.values(deck).reduce((sum,qty)=>sum+Number(qty||0),0)}
function copyLimit(card){return card?.ultimate?.isUltimate?1:Number(card?.maxCopies||2)}
function selectedProgressions(slots=state.slots){return slots.map(slot=>state.progressionById.get(slot.progressionId)).filter(Boolean)}
function heroFormationComplete(slots=state.slots){return selectedProgressions(slots).length===3}
function hasSelectedHeroes(slots=state.slots){return selectedProgressions(slots).length>0}
function legacyUniqueComplete(slots=state.slots){const ids=slots.map(slot=>slot.legacyId).filter(Boolean);return ids.length===3&&new Set(ids).size===3}
function legacyCardCount(slots=state.slots){return slots.reduce((sum,slot)=>sum+(slot.progressionId?3:0)+(slot.legacyId?1:0),0)}
function isDeckDirty(){return countDeck()>0||state.slots.some(slot=>slot.progressionId||slot.legacyId)||$('deckName').value.trim()!=='New Deck'}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1900)}
function cardById(id){return state.byId.get(id)||state.legacyById.get(id)}
function idSort(a,b){return String(a?.id||'').localeCompare(String(b?.id||''),undefined,{numeric:true})}
function defaultLegacyForProgression(progressionId,slots=state.slots){
  const progression=state.progressionById.get(progressionId);if(!progression)return '';
  const used=new Set(slots.map(slot=>slot.legacyId).filter(Boolean));
  const matches=state.legacyCards.filter(card=>card.family==='LegacyModeDefinition'&&card.classGroup===progression.baseClass&&!used.has(card.id)).sort(idSort);
  return matches[0]?.id||'';
}
function manaNumber(card){
  const cost=String(card?.cost||'');
  if(/no mana cost/i.test(cost))return 0;
  const values=[...cost.matchAll(/(\d+)\s*Mana/gi)].map(match=>Number(match[1]));
  return values.length?Math.min(...values):0;
}
function skillType(card){
  const classification=String(card?.classification||'');
  if(/Attack/i.test(classification))return 'Attack';
  if(/Defense/i.test(classification))return 'Defense';
  if(/Tactical/i.test(classification))return 'Tactical';
  if(/Support/i.test(classification))return 'Support';
  return '';
}
function attackStyle(card){
  const classification=String(card?.classification||'');
  for(const value of ['Physical','Magical','Area','Range','Casting'])if(classification.startsWith(value))return value;
  return '';
}
function cardCompatible(card,slots=state.slots){
  if(!card)return false;
  if(card.family==='Event')return true;
  const progressions=selectedProgressions(slots);
  const heroIds=new Set(progressions.flatMap(progression=>progression.cardIds));
  const lineageClasses=new Set(progressions.flatMap(progression=>progression.classLineage||[]));
  const baseClasses=new Set(progressions.map(progression=>progression.baseClass));
  const ultimate=card.ultimate||{};
  if(ultimate.isUltimate&&!Array.from(ultimate.ownerLineageCardIds||[]).some(id=>heroIds.has(id)))return false;
  if(Array.isArray(card.requiredBaseClasses)&&card.requiredBaseClasses.length&&!card.requiredBaseClasses.some(name=>baseClasses.has(name)))return false;
  if(Array.isArray(card.legalActiveClasses)&&card.legalActiveClasses.length&&!card.legalActiveClasses.some(name=>lineageClasses.has(name)))return false;
  return true;
}
function incompatibleDeckEntries(slots=state.slots,deck=state.deck){
  return Object.entries(deck).filter(([,qty])=>qty>0).map(([id,quantity])=>({card:state.byId.get(id),quantity})).filter(entry=>!cardCompatible(entry.card,slots)).sort((a,b)=>idSort(a.card,b.card));
}
function lostCompatibilityEntries(proposedSlots){
  return Object.entries(state.deck).filter(([,qty])=>qty>0).map(([id,quantity])=>({card:state.byId.get(id),quantity})).filter(entry=>cardCompatible(entry.card,state.slots)&&!cardCompatible(entry.card,proposedSlots)).sort((a,b)=>idSort(a.card,b.card));
}
function familyCount(family){return Object.entries(state.deck).reduce((sum,[id,qty])=>sum+(state.byId.get(id)?.family===family?Number(qty):0),0)}

function progressionLineageRows(progression){
  const lineage=(progression?.classLineage||[]).filter(Boolean);
  if(lineage.length===4){
    return [`${lineage[0]} • ${lineage[1]}`,lineage[2],lineage[3]];
  }
  return lineage;
}

function buildProgressions(){
  const byBase=new Map();
  for(const source of state.sourcePackages){
    if(byBase.has(source.baseCardId))continue;
    byBase.set(source.baseCardId,{
      id:source.baseCardId,name:state.legacyById.get(source.baseCardId)?.name||source.lineage,
      baseClass:source.baseClass,race:source.race,lineage:source.lineage,
      cardIds:(source.heroIds||source.cardIds.slice(0,3)).slice(0,3),classLineage:(source.classLineage||[]).slice(),coverImage:source.coverImage
    });
  }
  state.progressions=Array.from(byBase.values()).sort((a,b)=>idSort({id:a.id},{id:b.id}));
  state.progressionById=new Map(state.progressions.map(progression=>[progression.id,progression]));
  state.progressionByHeroId=new Map();
  state.progressions.forEach(progression=>progression.cardIds.forEach(id=>state.progressionByHeroId.set(id,progression)));
}

function resetAllFilterStates(hasHeroes=false){
  for(const tab of ['heroes','legacies','skills','events','items']){
    state.filtersByTab[tab]={
      search:'',
      pool:TAB_FAMILY[tab]&&hasHeroes?'available':'all',
      className:'',skillType:'',attackStyle:'',manaMin:0,manaMax:9
    };
  }
}
function syncFilterControlsFromState(){
  const filters=state.filters;
  $('searchInput').value=filters.search;
  $('classFilter').value=filters.className;
  $('skillTypeFilter').value=filters.skillType;
  $('attackStyleFilter').value=filters.attackStyle;
  $('manaMin').value=String(filters.manaMin);
  $('manaMax').value=String(filters.manaMax);
  $('cardPoolSelect').value=hasSelectedHeroes()?filters.pool:'all';
  updateManaRangeLabel();
}
function syncPoolGate(previousHadHeroes=false){
  const hasHeroes=hasSelectedHeroes();
  const select=$('cardPoolSelect');
  if(!hasHeroes){
    select.value='all';
    select.disabled=true;
  }else{
    select.disabled=false;
    if(!previousHadHeroes){
      for(const tab of Object.keys(TAB_FAMILY))state.filtersByTab[tab].pool='available';
    }
    select.value=state.filters.pool;
  }
}
function setLibraryTab(tab){
  if(!['heroes','legacies','skills','events','items'].includes(tab))return;
  state.libraryTab=tab;
  syncFilterControlsFromState();
  document.querySelectorAll('.library-tab').forEach(button=>button.classList.toggle('active',button.dataset.libraryTab===tab));
  const legacyContext=tab==='heroes'||tab==='legacies';
  state.sectionOpen.legacy=legacyContext;state.sectionOpen.main=!legacyContext;
  updateSectionState();updateFilterVisibility();$('libraryContent').scrollTop=0;renderLibrary();
}
function updateSectionState(){
  for(const section of ['legacy','main']){
    const root=$(section==='legacy'?'legacyDeckSection':'mainDeckSection');
    const body=root.querySelector('.deck-section-body');
    const button=root.querySelector('.deck-section-head');
    const open=state.sectionOpen[section];
    root.classList.toggle('expanded',open);root.classList.toggle('collapsed',!open);body.hidden=!open;button.setAttribute('aria-expanded',String(open));
    const chevron=root.querySelector('.chevron');if(chevron)chevron.src=open?'assets/ui/chevron-up.png':'assets/ui/chevron-down.png';
  }
}
function toggleSection(section){state.sectionOpen[section]=!state.sectionOpen[section];updateSectionState()}

function updateFilterVisibility(){
  const tab=state.libraryTab,mainTab=Boolean(TAB_FAMILY[tab]);
  $('cardPoolField').hidden=!mainTab;
  $('classField').hidden=tab==='events';
  $('classField').querySelector('span').textContent=tab==='items'?'Base Class':'Class';
  $('skillTypeField').hidden=tab!=='skills';
  $('attackStyleField').hidden=tab!=='skills';
  $('manaField').hidden=!(tab==='skills'||tab==='events');
  $('filterToggle').hidden=false;
  syncPoolGate(hasSelectedHeroes());
}
function resetFilters(){
  state.filters={search:'',pool:TAB_FAMILY[state.libraryTab]&&hasSelectedHeroes()?'available':'all',className:'',skillType:'',attackStyle:'',manaMin:0,manaMax:9};
  syncFilterControlsFromState();
  syncPoolGate(hasSelectedHeroes());renderLibrary();
}
function updateManaRangeLabel(){
  let min=Number($('manaMin').value),max=Number($('manaMax').value);
  if(min>max){if(document.activeElement===$('manaMin'))max=min;else min=max;$('manaMin').value=String(min);$('manaMax').value=String(max)}
  state.filters.manaMin=min;state.filters.manaMax=max;$('manaRangeValue').textContent=`${min}–${max}`;const track=$('manaRangeTrack');if(track){const minPct=(min/9)*100,maxPct=(max/9)*100;track.style.background=`linear-gradient(to right,#30323d 0 ${minPct}%,#0aa8f6 ${minPct}% ${maxPct}%,#30323d ${maxPct}% 100%)`}
}

function filteredProgressions(){
  const query=state.filters.search.trim().toLowerCase(),className=state.filters.className;
  return state.progressions.filter(progression=>{
    const haystack=[progression.id,progression.name,progression.race,progression.baseClass,progression.lineage,...progression.classLineage].join(' ').toLowerCase();
    return (!query||haystack.includes(query))&&(!className||progression.baseClass===className);
  });
}
function filteredLegacies(){
  const query=state.filters.search.trim().toLowerCase(),className=state.filters.className;
  return state.legacyCards.filter(card=>card.family==='LegacyModeDefinition').filter(card=>{
    const haystack=[card.id,card.name,card.classGroup,card.text].join(' ').toLowerCase();
    return (!query||haystack.includes(query))&&(!className||card.classGroup===className);
  }).sort(idSort);
}
function filteredMainCards(){
  const family=TAB_FAMILY[state.libraryTab];if(!family)return [];
  const query=state.filters.search.trim().toLowerCase(),hasHeroes=hasSelectedHeroes();
  return state.cards.filter(card=>card.family===family).filter(card=>{
    const haystack=[card.id,card.name,card.classification,card.classGroup,card.cost,card.text].join(' ').toLowerCase();
    if(query&&!haystack.includes(query))return false;
    if(family==='Skill'&&state.filters.className&&card.classGroup!==state.filters.className)return false;
    if(family==='Item'&&state.filters.className){
      const required=card.requiredBaseClasses||[];
      if(required.length&&!required.includes(state.filters.className))return false;
      if(!required.length)return false;
    }
    if(family==='Skill'&&state.filters.skillType&&skillType(card)!==state.filters.skillType)return false;
    if(family==='Skill'&&state.filters.attackStyle&&attackStyle(card)!==state.filters.attackStyle)return false;
    if((family==='Skill'||family==='Event')){const mana=manaNumber(card);if(mana<state.filters.manaMin||mana>state.filters.manaMax)return false}
    if(hasHeroes&&state.filters.pool==='available'&&!cardCompatible(card))return false;
    return true;
  }).sort(idSort);
}
function renderLibrary(){
  const tab=state.libraryTab;
  $('heroLibrary').hidden=tab!=='heroes';$('cardLibrary').hidden=tab==='heroes';
  if(tab==='heroes')renderHeroLibrary();
  else if(tab==='legacies')renderLegacyLibrary();
  else renderMainLibrary();
}
function renderHeroLibrary(){
  const progressions=filteredProgressions(),selectedIds=new Set(state.slots.map(slot=>slot.progressionId).filter(Boolean)),full=selectedIds.size>=3;
  $('libraryResultCount').textContent=`${progressions.length} of ${state.progressions.length} Hero packages`;
  $('heroLibrary').innerHTML=progressions.map(progression=>{
    const selected=selectedIds.has(progression.id),cards=progression.cardIds.map(cardById);
    return `<article class="hero-package ${selected?'selected':''}" data-hero-package-id="${progression.id}">
      <div class="hero-rank-cards" draggable="true" data-hero-library-drag="${progression.id}" aria-label="Drag ${esc(progression.name)} to a formation slot">${cards.map(card=>`<span class="hero-rank-card"><img src="${card.image}" alt="${esc(card.name)}"></span>`).join('')}</div>
      <div class="hero-package-info"><span class="info-label">HERO NAME</span><h3>${esc(progression.name)}</h3><dl><div><dt>RACIAL</dt><dd>${esc(progression.race)}</dd></div><div><dt>LINEAGES</dt><dd>${progressionLineageRows(progression).map(esc).join('<br>')}</dd></div></dl>
      <button class="hero-select ${selected?'remove':''}" type="button" data-hero-action="${progression.id}" ${!selected&&full?'disabled':''}>${selected?'REMOVE HERO':'SELECT HERO'}</button></div>
    </article>`;
  }).join('');
  document.querySelectorAll('[data-hero-action]').forEach(button=>button.addEventListener('click',()=>toggleHero(button.dataset.heroAction)));
  bindHeroLibraryDragSources();
}
function legacyDraggable(card){
  if(state.slots.some(slot=>slot.legacyId===card.id))return false;
  return state.slots.some(slot=>state.progressionById.get(slot.progressionId)?.baseClass===card.classGroup);
}
function renderLegacyLibrary(){
  const cards=filteredLegacies();$('libraryResultCount').textContent=`${cards.length} of ${state.legacyCards.filter(card=>card.family==='LegacyModeDefinition').length} Legacy cards`;
  $('cardLibrary').innerHTML=cards.map(card=>{
    const draggable=legacyDraggable(card),used=state.slots.some(slot=>slot.legacyId===card.id),unavailable=!draggable&&!used;
    return `<article class="library-card ${draggable?'available':''} ${unavailable?'unavailable':''}" data-legacy-library-id="${card.id}" aria-label="${esc(card.name)}${draggable?' — drag to a matching slot or double-click when only one matching Base Class is selected':''}" ${draggable?`draggable="true" data-drag-type="legacy" data-card-id="${card.id}"`:''}>
      <span class="card-frame"><img src="${card.image}" alt="${esc(card.name)}">${used?'<span class="owned-badge">×1</span>':''}${unavailable?'<span class="lock-dot">●</span>':''}<button class="library-review-button" type="button" draggable="false" data-open-review-id="${card.id}" aria-label="Review ${esc(card.name)}"><img src="assets/ui/expand.png" alt=""></button></span><span class="library-card-name">${esc(card.name)}</span>
    </article>`;
  }).join('');
  bindLibraryDragSources($('cardLibrary'));bindLibraryReviewButtons($('cardLibrary'));
  document.querySelectorAll('[data-legacy-library-id]').forEach(element=>element.addEventListener('dblclick',event=>{
    if(event.target.closest('.library-review-button'))return;
    event.preventDefault();
    const card=state.legacyById.get(element.dataset.legacyLibraryId);
    if(!card||state.slots.some(slot=>slot.legacyId===card.id))return;
    const eligible=state.slots.map((slot,index)=>({slot,index,progression:state.progressionById.get(slot.progressionId)})).filter(entry=>entry.progression?.baseClass===card.classGroup);
    if(eligible.length===1)assignLegacyToSlot(card.id,eligible[0].index);
  }));
}
function renderMainLibrary(){
  const cards=filteredMainCards(),family=TAB_FAMILY[state.libraryTab],total=state.cards.filter(card=>card.family===family).length,hasHeroes=hasSelectedHeroes();
  $('libraryResultCount').textContent=`${cards.length} of ${total} cards`;
  $('cardLibrary').innerHTML=cards.map(card=>{
    const compatible=cardCompatible(card),available=hasHeroes&&compatible,qty=state.deck[card.id]||0;
    return `<article class="library-card ${available?'available':'unavailable'}" data-main-library-id="${card.id}" ${available?`draggable="true" data-drag-type="main-add" data-card-id="${card.id}"`:''} aria-label="${esc(card.name)}${available?' — left click or drag to add, right click to remove':' — unavailable'}">
      <span class="card-frame"><img src="${card.image}" alt="${esc(card.name)}">${qty?`<span class="owned-badge">×${qty}</span>`:''}${!available?'<span class="lock-dot">●</span>':''}<button class="library-review-button" type="button" draggable="false" data-open-review-id="${card.id}" aria-label="Review ${esc(card.name)}"><img src="assets/ui/expand.png" alt=""></button></span><span class="library-card-name">${esc(card.name)}</span>
    </article>`;
  }).join('');
  bindMainLibraryClicks();bindLibraryReviewButtons($('cardLibrary'));
}
function bindMainLibraryClicks(){
  document.querySelectorAll('[data-main-library-id]').forEach(element=>{
    const id=element.dataset.mainLibraryId;
    element.addEventListener('click',event=>{if(event.target.closest('.library-review-button'))return;event.preventDefault();if(element.classList.contains('available'))addMainCard(id)});
    element.addEventListener('contextmenu',event=>{if(event.target.closest('.library-review-button'))return;event.preventDefault();removeMainCard(id)});
    if(element.draggable){
      element.addEventListener('dragstart',event=>{
        if(event.target.closest('.library-review-button')){event.preventDefault();return}
        state.dragging={type:'main-add',id};element.classList.add('dragging');event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/plain',JSON.stringify(state.dragging));hideHover();
      });
      element.addEventListener('dragend',()=>{element.classList.remove('dragging');clearDragState()});
    }
  });
}

function bindLibraryReviewButtons(root){
  root.querySelectorAll('[data-open-review-id]').forEach(button=>{
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    button.addEventListener('dblclick',event=>event.stopPropagation());
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openCardReview(button.dataset.openReviewId)});
  });
}

function bindHeroLibraryDragSources(){
  document.querySelectorAll('[data-hero-library-drag]').forEach(element=>{
    element.addEventListener('dragstart',event=>{
      state.dragging={type:'hero-library',progressionId:element.dataset.heroLibraryDrag};
      element.closest('.hero-package')?.classList.add('dragging');
      event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',JSON.stringify(state.dragging));hideHover();
    });
    element.addEventListener('dragend',()=>{element.closest('.hero-package')?.classList.remove('dragging');clearDragState()});
  });
}
async function placeHeroAtSlot(progressionId,targetIndex){
  const progression=state.progressionById.get(progressionId);if(!progression||targetIndex<0||targetIndex>2)return;
  const previousComplete=hasSelectedHeroes(),existingIndex=state.slots.findIndex(slot=>slot.progressionId===progressionId);
  const proposed=clone(state.slots);
  if(existingIndex>=0){
    if(existingIndex===targetIndex)return;
    [proposed[existingIndex],proposed[targetIndex]]=[proposed[targetIndex],proposed[existingIndex]];
  }else{
    proposed[targetIndex]={progressionId,legacyId:''};
    proposed[targetIndex].legacyId=defaultLegacyForProgression(progressionId,proposed);
  }
  const removed=lostCompatibilityEntries(proposed);
  if(removed.length){
    const total=removed.reduce((sum,entry)=>sum+entry.quantity,0);
    const ok=await askConfirm({eyebrow:'CHANGE HERO',title:'Change Hero and remove incompatible cards?',message:`This formation change will remove <b>${total}</b> Main Deck card${total===1?'':'s'} that the new Hero lineages cannot use.`,list:removed.map(entry=>({label:entry.card?.name||entry.card?.id||'Unknown card',value:`×${entry.quantity}`})),okLabel:'CHANGE HERO',danger:true});
    if(!ok)return;
    removed.forEach(entry=>{if(entry.card)delete state.deck[entry.card.id]});
  }
  state.slots=proposed;syncPoolGate(previousComplete);renderAll();
}
function bindHeroDropZones(){
  document.querySelectorAll('[data-hero-drop-slot]').forEach(zone=>{
    const targetIndex=Number(zone.dataset.heroDropSlot);
    zone.addEventListener('dragover',event=>{
      const drag=parseDrag(event);if(drag?.type==='hero-library'||drag?.type==='hero-slot'){event.preventDefault();zone.classList.add('drop-ready');event.dataTransfer.dropEffect='move'}
    });
    zone.addEventListener('dragleave',event=>{if(!zone.contains(event.relatedTarget))zone.classList.remove('drop-ready')});
    zone.addEventListener('drop',event=>{
      const drag=parseDrag(event);if(drag?.type==='hero-library'||drag?.type==='hero-slot'){event.preventDefault();placeHeroAtSlot(drag.progressionId,targetIndex)}clearDragState();
    });
  });
  document.querySelectorAll('[data-hero-slot-drag]').forEach(element=>{
    element.addEventListener('dragstart',event=>{
      state.dragging={type:'hero-slot',progressionId:element.dataset.heroSlotDrag,fromIndex:Number(element.dataset.heroSlotIndex)};
      element.closest('.formation-slot')?.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',JSON.stringify(state.dragging));hideHover();
    });
    element.addEventListener('dragend',()=>{element.closest('.formation-slot')?.classList.remove('dragging');clearDragState()});
  });
}

async function toggleHero(progressionId){
  const previousComplete=hasSelectedHeroes();
  const index=state.slots.findIndex(slot=>slot.progressionId===progressionId);
  if(index>=0){
    const proposed=clone(state.slots);proposed.splice(index,1);proposed.push(emptySlot());
    const removed=lostCompatibilityEntries(proposed);
    if(removed.length){
      const total=removed.reduce((sum,entry)=>sum+entry.quantity,0);
      const ok=await askConfirm({eyebrow:'REMOVE HERO',title:'Remove Hero and incompatible cards?',message:`Removing this Hero will also remove <b>${total}</b> Main Deck card${total===1?'':'s'} that the remaining Hero lineages cannot use.`,list:removed.map(entry=>({label:entry.card?.name||entry.card?.id||'Unknown card',value:`×${entry.quantity}`})),okLabel:'REMOVE HERO',danger:true});
      if(!ok)return;
      removed.forEach(entry=>{if(entry.card)delete state.deck[entry.card.id]});
    }
    state.slots=proposed;
  }else{
    const emptyIndex=state.slots.findIndex(slot=>!slot.progressionId);if(emptyIndex<0)return;
    const proposed=clone(state.slots);proposed[emptyIndex].progressionId=progressionId;proposed[emptyIndex].legacyId=defaultLegacyForProgression(progressionId,proposed);
    state.slots=proposed;
  }
  syncPoolGate(previousComplete);renderAll();
}
function swapSlots(leftIndex,rightIndex){
  if(!state.slots[leftIndex]?.progressionId||!state.slots[rightIndex]?.progressionId)return;
  [state.slots[leftIndex],state.slots[rightIndex]]=[state.slots[rightIndex],state.slots[leftIndex]];renderDeckPanels();renderLibrary();
}
function cycleRank(delta){state.rankView=Math.max(1,Math.min(3,state.rankView+delta));renderLegacyDeck()}
function assignLegacyToSlot(cardId,slotIndex){
  const card=state.legacyById.get(cardId),slot=state.slots[slotIndex],progression=state.progressionById.get(slot?.progressionId);if(!card||!progression)return;
  if(card.classGroup!==progression.baseClass)return;
  if(state.slots.some((candidate,index)=>index!==slotIndex&&candidate.legacyId===cardId))return;
  state.slots[slotIndex].legacyId=cardId;renderDeckPanels();renderLibrary();
}

function renderDeckPanels(){renderLegacyDeck();renderMainDeck();updateExportButton()}
function renderLegacyDeck(){
  const selected=selectedProgressions();$('legacyTotal').textContent=`${legacyCardCount()}/12`;$('heroTotalBadge').textContent=String(selected.length*3);$('legacyCountBadge').textContent=String(state.slots.filter(slot=>slot.legacyId).length);$('rankLabel').textContent=`RANK ${['I','II','III'][state.rankView-1]}`;
  const chunks=[];
  state.slots.forEach((slot,index)=>{
    const progression=state.progressionById.get(slot.progressionId),card=progression?cardById(progression.cardIds[state.rankView-1]):null;
    if(index>0)chunks.push(`<button class="swap-button" type="button" data-swap-left="${index-1}" data-swap-right="${index}" ${state.slots[index-1].progressionId&&slot.progressionId?'':'disabled'} aria-label="Swap ${POSITIONS[index-1]} and ${POSITIONS[index]}">↔</button>`);
    chunks.push(card?`<article class="formation-slot" data-hero-drop-slot="${index}"><div class="deck-card-visual"><button class="formation-card-button" type="button" draggable="true" data-hero-slot-drag="${progression.id}" data-hero-slot-index="${index}"><img src="${card.image}" alt="${esc(card.name)}"></button><button class="deck-review-button" type="button" data-review-id="${card.id}" aria-label="Review ${esc(card.name)}"><img src="assets/ui/expand.png" alt=""></button></div><div class="formation-position">${POSITIONS[index]}</div></article>`:`<article class="formation-slot empty" data-hero-drop-slot="${index}"><div class="formation-card-placeholder">Drag or select Hero</div><div class="formation-position">${POSITIONS[index]}</div></article>`);
  });
  $('formationGrid').innerHTML=chunks.join('');
  document.querySelectorAll('[data-swap-left]').forEach(button=>button.addEventListener('click',()=>swapSlots(Number(button.dataset.swapLeft),Number(button.dataset.swapRight))));
  bindCardReviewAndHover($('formationGrid'));bindHeroDropZones();
  $('legacySlotsGrid').innerHTML=state.slots.map((slot,index)=>{
    const progression=state.progressionById.get(slot.progressionId),card=state.legacyById.get(slot.legacyId);
    if(!progression)return `<article class="legacy-slot empty" data-legacy-drop-slot="${index}"><div class="legacy-empty-card">Select a Hero first</div><div class="legacy-position-label">${POSITIONS[index]}</div></article>`;
    const choices=state.legacyCards.filter(candidate=>candidate.family==='LegacyModeDefinition'&&candidate.classGroup===progression.baseClass).sort(idSort);
    const options=[`<option value="" disabled ${card?'':'selected'}>Choose Legacy</option>`,...choices.map(candidate=>{const usedElsewhere=state.slots.some((other,otherIndex)=>otherIndex!==index&&other.legacyId===candidate.id);return `<option value="${candidate.id}" ${candidate.id===slot.legacyId?'selected':''} ${usedElsewhere?'disabled':''}>${esc(candidate.name)}</option>`})].join('');
    const visual=card?`<div class="deck-card-visual"><div class="legacy-card-button"><img src="${card.image}" alt="${esc(card.name)}"></div><button class="deck-review-button" type="button" data-review-id="${card.id}" aria-label="Review ${esc(card.name)}"><img src="assets/ui/expand.png" alt=""></button></div>`:`<div class="legacy-card-placeholder">Drag a ${esc(progression.baseClass)} Legacy here</div>`;
    return `<article class="legacy-slot ${card?'':'empty-choice'}" data-legacy-drop-slot="${index}">${visual}<label class="legacy-select-wrap"><select class="legacy-slot-select" data-legacy-select-slot="${index}" aria-label="Choose ${esc(progression.baseClass)} Legacy">${options}</select></label><div class="legacy-position-label">${POSITIONS[index]}</div></article>`;
  }).join('');
  document.querySelectorAll('[data-legacy-select-slot]').forEach(select=>select.addEventListener('change',()=>{const id=select.value;if(id)assignLegacyToSlot(id,Number(select.dataset.legacySelectSlot))}));
  bindCardReviewAndHover($('legacySlotsGrid'));bindLegacyDropZones();
}
function renderMainDeck(){
  const entries=Object.entries(state.deck).filter(([,qty])=>qty>0).map(([id,quantity])=>({card:state.byId.get(id),quantity})).filter(entry=>entry.card).sort((a,b)=>idSort(a.card,b.card));
  $('mainTotal').textContent=`${countDeck()}/60`;$('skillCount').textContent=familyCount('Skill');$('eventCount').textContent=familyCount('Event');$('itemCount').textContent=familyCount('Item');
  $('skillGroupCount').textContent=String(familyCount('Skill'));$('eventGroupCount').textContent=String(familyCount('Event'));$('itemGroupCount').textContent=String(familyCount('Item'));
  const issues=validationIssues();$('deckStatus').textContent=issues.length?'Incomplete':'Deck Valid';$('deckStatus').classList.toggle('valid',!issues.length);
  const rowHtml=({card,quantity})=>{const ultimate=Boolean(card.ultimate?.isUltimate),meta=ultimate?`<span class="main-ultimate-label">Ultimate Skill Card</span>${compactManaCost(card)?` • ${esc(compactManaCost(card))}`:''}`:`${esc(card.classification)}${card.cost&&card.cost!=='No Mana cost'?` • ${esc(card.cost)}`:''}`;return `<article class="main-deck-row ${ultimate?'ultimate-card-row':''}" draggable="true" data-main-deck-id="${card.id}" data-drag-type="deck-remove" data-review-id="${card.id}" data-hover-card-id="${card.id}">
    <img src="${card.image}" alt="${esc(card.name)}">
    <div class="main-card-info"><strong>${esc(card.name)}</strong><small>${meta}</small></div>
    <button class="qty-control" type="button" data-remove-main="${card.id}" aria-label="Remove one ${esc(card.name)}">−</button><span class="main-qty">${quantity}</span><button class="qty-control" type="button" data-add-main="${card.id}" ${quantity>=copyLimit(card)||countDeck()>=60?'disabled':''} aria-label="Add one ${esc(card.name)}">+</button>
  </article>`};
  for(const family of ['Skill','Event','Item']){
    const familyEntries=entries.filter(entry=>entry.card.family===family),prefix=family.toLowerCase();
    $(`${prefix}DeckList`).innerHTML=familyEntries.map(rowHtml).join('');
    $(`${prefix}EmptyState`).hidden=familyEntries.length>0;
  }
  $('mainEmptyState').hidden=entries.length>0;
  bindCardReviewAndHover($('mainDeckDropZone'));
  document.querySelectorAll('[data-add-main]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();addMainCard(button.dataset.addMain)}));
  document.querySelectorAll('[data-remove-main]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();removeMainCard(button.dataset.removeMain)}));
  bindDeckRemoveDragSources();
}
function renderAll(){renderDeckPanels();renderLibrary()}

function addMainCard(id){
  const card=state.byId.get(id);if(!card||!hasSelectedHeroes()||!cardCompatible(card))return;
  const quantity=state.deck[id]||0;if(quantity>=copyLimit(card)||countDeck()>=60)return;
  state.deck[id]=quantity+1;renderMainDeck();renderLibrary();updateExportButton();
}
function removeMainCard(id){
  const quantity=state.deck[id]||0;if(!quantity)return;
  if(quantity===1)delete state.deck[id];else state.deck[id]=quantity-1;
  renderMainDeck();renderLibrary();updateExportButton();
}

function bindLibraryDragSources(root){
  root.querySelectorAll('[draggable="true"][data-drag-type="legacy"]').forEach(element=>{
    element.addEventListener('dragstart',event=>{
      state.dragging={type:'legacy',id:element.dataset.cardId};element.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',JSON.stringify(state.dragging));hideHover();
    });
    element.addEventListener('dragend',()=>{element.classList.remove('dragging');clearDragState()});
  });
}
function bindDeckRemoveDragSources(){
  document.querySelectorAll('[data-main-deck-id]').forEach(row=>{
    row.addEventListener('dragstart',event=>{
      if(event.target.closest('button')){event.preventDefault();return}
      state.dragging={type:'deck-remove',id:row.dataset.mainDeckId};row.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',JSON.stringify(state.dragging));$('removeDropOverlay').hidden=false;$('libraryContent').classList.add('drag-remove-active');hideHover();
    });
    row.addEventListener('dragend',()=>{row.classList.remove('dragging');clearDragState()});
  });
}
function clearDragState(){
  state.dragging=null;$('removeDropOverlay').hidden=true;$('libraryContent').classList.remove('drag-remove-active');
  document.querySelectorAll('.legacy-slot,.formation-slot,.main-deck-row,.hero-package,.library-card,.main-deck-groups').forEach(element=>element.classList.remove('drop-ready','dragging'));
}
function parseDrag(event){
  if(state.dragging)return state.dragging;
  try{return JSON.parse(event.dataTransfer.getData('text/plain'))}catch{return null}
}
function bindGlobalDropZones(){
  const removeZone=$('libraryContent'),mainDropZone=$('mainDeckDropZone');
  removeZone.addEventListener('dragover',event=>{const drag=parseDrag(event);if(drag?.type==='deck-remove'){event.preventDefault();event.dataTransfer.dropEffect='move'}});
  removeZone.addEventListener('drop',event=>{const drag=parseDrag(event);if(drag?.type==='deck-remove'){event.preventDefault();removeMainCard(drag.id)}clearDragState()});
  mainDropZone.addEventListener('dragover',event=>{const drag=parseDrag(event);if(drag?.type==='main-add'){event.preventDefault();mainDropZone.classList.add('drop-ready');event.dataTransfer.dropEffect='copy'}});
  mainDropZone.addEventListener('dragleave',event=>{if(!mainDropZone.contains(event.relatedTarget))mainDropZone.classList.remove('drop-ready')});
  mainDropZone.addEventListener('drop',event=>{const drag=parseDrag(event);if(drag?.type==='main-add'){event.preventDefault();addMainCard(drag.id)}clearDragState()});
}
function bindLegacyDropZones(){
  document.querySelectorAll('[data-legacy-drop-slot]').forEach(zone=>{
    zone.addEventListener('dragover',event=>{
      const drag=parseDrag(event),card=state.legacyById.get(drag?.id),slotIndex=Number(zone.dataset.legacyDropSlot),progression=state.progressionById.get(state.slots[slotIndex]?.progressionId);
      if(drag?.type==='legacy'&&card&&progression&&card.classGroup===progression.baseClass&&!state.slots.some((slot,index)=>index!==slotIndex&&slot.legacyId===card.id)){event.preventDefault();zone.classList.add('drop-ready');event.dataTransfer.dropEffect='move'}
    });
    zone.addEventListener('dragleave',()=>zone.classList.remove('drop-ready'));
    zone.addEventListener('drop',event=>{const drag=parseDrag(event);if(drag?.type==='legacy'){event.preventDefault();assignLegacyToSlot(drag.id,Number(zone.dataset.legacyDropSlot))}clearDragState()});
  });
}

function bindCardReviewAndHover(root){
  root.querySelectorAll('[data-review-id]').forEach(element=>{
    element.addEventListener('click',event=>{if(event.target.closest('[data-hero-action],.qty-control'))return;event.stopPropagation();openCardReview(element.dataset.reviewId)});
  });
  root.querySelectorAll('[data-hover-card-id]').forEach(element=>{
    element.addEventListener('mouseenter',()=>showHover(element.dataset.hoverCardId,element));
    element.addEventListener('mouseleave',hideHover);
  });
}
function showHover(cardId,anchor){
  if(window.innerWidth<=760||state.dragging||document.querySelector('dialog[open]'))return;
  const card=cardById(cardId),box=$('hoverCardZoom'),image=$('hoverCardZoomImage');if(!card||!anchor)return;
  image.src=card.image;image.alt=`${card.name} preview`;box.hidden=false;box.classList.add('is-visible');box.setAttribute('aria-hidden','false');
  const rect=anchor.getBoundingClientRect(),width=250,height=350;let x=rect.left+(rect.width-width)/2,y=Math.max(8,rect.top-height-10);
  x=Math.max(8,Math.min(x,window.innerWidth-width-8));y=Math.min(y,window.innerHeight-height-8);box.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
}
function hideHover(){const box=$('hoverCardZoom');box.classList.remove('is-visible');box.hidden=true;box.style.transform='translate3d(-9999px,-9999px,0)';box.setAttribute('aria-hidden','true')}

function reviewEyebrow(card){
  if(card.family==='Hero')return 'HERO NAME';
  if(card.family==='Skill')return 'SKILL NAME';
  if(card.family==='Event')return 'EVENT NAME';
  if(card.family==='Item')return 'ITEM NAME';
  if(card.family==='LegacyModeDefinition')return 'LEGACY NAME';
  return 'CARD NAME';
}
function reviewType(card){return card.family==='LegacyModeDefinition'?'Legacy Card':card.family==='Skill'?card.classification:card.family}
function reviewCost(card){return card.cost&&card.cost!=='No Mana cost'?card.cost:'-'}
function reviewManaValue(card){
  const cost=String(card?.cost||'').trim();
  if(!cost||cost==='No Mana cost')return '-';
  if(cost.includes(':'))return cost.replace(/\s*[·•]\s*/g,' • ');
  const simple=cost.match(/^(\d+)\s*Mana$/i);
  return simple?simple[1]:cost;
}
function compactManaCost(card){
  const matches=String(card?.cost||'').match(/(\d+)\s*Mana/gi)||[];
  const values=matches.map(value=>Number(value.match(/\d+/)?.[0])).filter(Number.isFinite);
  return values.length?`${Math.min(...values)} Mana Cost`:'';
}
function labeledRowName(label='',prefix=''){
  const clean=String(label).replace(new RegExp(`^${prefix}\\s*[—-]?\\s*`,'i'),'').trim();
  return clean||prefix;
}
function romanRank(value){return ({1:'I',2:'II',3:'III'})[Number(value||1)]||String(value||'-')}
function rankUpBonusText(rank){
  const value=Number(rank||1);
  if(value===2)return 'After Rank Up, draw 2 cards and gain +1 Mana Regen.';
  if(value===3)return 'After Rank Up, draw 3 cards and gain +1 Mana Regen.';
  return '';
}
function heroExpValue(rank){return ({1:'-',2:'300',3:'700'})[Number(rank||1)]||'-'}
function rowClassRank(label=''){
  const match=String(label).match(/^(.+?)\s*\((Rank\s+[IVX]+)\)\s*$/i);
  return match?{className:match[1].trim(),rank:match[2].replace(/^rank/i,'Rank')}:{className:String(label).replace(/\s*[—-].*$/,'').trim(),rank:'-'};
}
function metricDamageType(card,row={},label=''){
  if(!['DAMAGE','BLOCK'].includes(label))return '';
  const primary=label==='DAMAGE'
    ? String(row.damage_text||row.text||card.classification||'')
    : String(row.effect_text||row.text||row.damage_text||'');
  const hasPhysical=/\bPhysical\b/i.test(primary);
  const hasMagical=/\bMagical\b/i.test(primary);
  if(hasPhysical&&hasMagical)return 'Physical / Magical';
  if(hasPhysical)return 'Physical';
  if(hasMagical)return 'Magical';
  return '';
}
function effectMetric(card,row={}){
  const classification=String(card.classification||'');
  const source=[row.damage_text,row.effect_text,row.text].filter(Boolean).join(' ');
  let label='',match=null;
  if(/Attack/i.test(classification)){
    label='DAMAGE';
    match=source.match(/(?:Deal|Inflict)\s+([+-]?\d+)[^.]*?damage/i)||source.match(/([+-]?\d+)\s*(?:Physical|Magical)?\s*damage/i);
  }else if(/Defense/i.test(classification)){
    label='BLOCK';
    match=source.match(/Block\s+([+-]?\d+)/i);
  }else if(/Support/i.test(classification)){
    label='HEAL';
    match=source.match(/(?:Heal|Restore)[^.]*?([+-]?\d+)/i)||source.match(/\+\s*(\d+)\s*HP/i);
  }
  return label&&match?{label,value:match[1],damageType:metricDamageType(card,row,label)}:null;
}
function skillEffectText(row={},metric=null){
  let effect=String(row.effect_text||row.text||'').trim();
  if(!metric)return effect||String(row.damage_text||'-').trim()||'-';
  if(metric.label==='DAMAGE')effect=effect.replace(/^(?:Deal|Inflict)\s+[+-]?\d+[^.]*?damage\.\s*/i,'').trim();
  else if(metric.label==='BLOCK')effect=effect.replace(/^Block\s+[+-]?\d+[^.]*?damage[^.]*\.\s*/i,'').trim();
  else if(metric.label==='HEAL')effect=effect.replace(/^(?:Heal|Restore)[^.]*?[+-]?\d+[^.]*\.\s*/i,'').trim();
  return effect||'-';
}
function itemClassText(card){
  const classes=Array.isArray(card.requiredBaseClasses)?card.requiredBaseClasses.filter(Boolean):[];
  return classes.length?classes.join(' • '):'All Classes';
}
function heroReviewHtml(card){
  const rows=card.rows||[];
  const racialRow=rows.find(row=>/^Racial Trait/i.test(row.label||''));
  const dualRow=rows.find(row=>/^Dual Class/i.test(row.label||''));
  const abilityRow=rows.find(row=>/^Class Ability/i.test(row.label||''));
  const racialName=labeledRowName(racialRow?.label||'Racial Trait','Racial Trait');
  const abilityName=abilityRow?labeledRowName(abilityRow.label,'Class Ability'):'';
  const rank=Number(card.rank||card.rankNumeric||1);
  $('reviewStats').innerHTML=`<div class="review-summary hero-summary"><div class="review-summary-item"><span>RANK</span><strong>Rank ${esc(romanRank(rank))}</strong></div><div class="review-summary-item"><span>HP</span><strong>${esc(card.hp||'-')}</strong></div><div class="review-summary-item"><span>EXP</span><strong>${esc(heroExpValue(rank))}</strong></div></div>`;
  const detailBlocks=[];
  detailBlocks.push(`<div class="review-hero-block"><span>RACIAL</span><strong>${esc(card.race||'-')}</strong><span>RACIAL TRAIT</span><strong>${esc(racialName)}</strong><p>${esc(racialRow?.text||card.text||'-')}</p></div>`);
  detailBlocks.push(`<div class="review-hero-block"><span>CLASS</span><strong>${esc(card.classGroup||'-')}</strong>${dualRow?`<span>DUAL CLASS</span><p>${esc(dualRow.text||'-')}</p>`:''}${abilityRow?`<span>CLASS ABILITY</span><strong>${esc(abilityName)}</strong><p>${esc(abilityRow.text||'-')}</p>`:''}</div>`);
  const bonus=rankUpBonusText(rank);
  if(bonus)detailBlocks.push(`<div class="review-generic-row rank-up-review"><span>RANK UP BONUS</span><p>${esc(bonus)}</p></div>`);
  $('reviewRows').innerHTML=detailBlocks.join('');
}
function standardReviewHtml(card){
  const stats=[];
  if(card.family==='Skill')stats.push(['MANA COST',reviewManaValue(card)],['TYPE',reviewType(card)],['EXP TRIBUTE',card.ultimate?.isUltimate?'200 EXP':'100 EXP']);
  else if(card.family==='LegacyModeDefinition')stats.push(['COST','-'],['TYPE','Legacy Card'],['CLASS',card.classGroup||'-']);
  else stats.push(['MANA COST',reviewCost(card)],['TYPE',reviewType(card)]);
  $('reviewStats').innerHTML=`<div class="review-summary ${stats.length===2?'two-column-summary':''}">${stats.map(([label,value])=>`<div class="review-summary-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;
  const rows=card.rows?.length?card.rows:[{label:'Effect',text:card.text}];
  if(card.family==='Skill'){
    const isUltimate=Boolean(card.ultimate?.isUltimate);
    const effectRows=rows.map((row,index)=>{
      const parsed=rowClassRank(row.label);
      const metric=effectMetric(card,row);
      const rankText=isUltimate&&/Rank\s+III/i.test(parsed.rank)&&index===rows.length-1?`Ultimate ${parsed.rank}`:parsed.rank;
      const effectText=skillEffectText(row,metric);
      const rankClass=isUltimate&&/^Ultimate\s+Rank\s+III$/i.test(rankText)?' class="ultimate-rank"':'';
      if(metric){
        return `<div class="review-effect-row has-metric"><div class="review-effect-class"><span>CLASS</span><strong>${esc(parsed.className||card.classGroup||'-')}</strong></div><div class="review-effect-rank"><span>RANK</span><strong${rankClass}>${esc(rankText)}</strong></div><div class="review-effect-metric"><span>${esc(metric.label)}</span><strong>${esc(metric.value)}</strong>${metric.damageType?`<small class="review-metric-type">${esc(metric.damageType)}</small>`:''}</div><div class="review-effect-info"><span>SKILL EFFECT</span><p>${esc(effectText)}</p></div></div>`;
      }
      return `<div class="review-effect-row no-metric"><div class="review-effect-class"><span>CLASS</span><strong>${esc(parsed.className||card.classGroup||'-')}</strong></div><div class="review-effect-rank"><span>RANK</span><strong${rankClass}>${esc(rankText)}</strong></div><div class="review-effect-info full-span"><span>SKILL EFFECT</span><p>${esc(effectText)}</p></div></div>`;
    }).join('');
    const rules=isUltimate&&card.ultimate?.owner?`<div class="review-ultimate-rules"><span>ULTIMATE RULES</span><p>Only ${esc(card.ultimate.owner)} can use this card or Tribute it for EXP.</p></div>`:'';
    $('reviewRows').innerHTML=effectRows+rules;
  }else if(card.family==='Item'){
    const effect=rows.map(row=>row.effect_text||row.text||row.damage_text||'').filter(Boolean).join(' ');
    $('reviewRows').innerHTML=`<div class="review-effect-row item-effect-row no-metric"><div><span>CLASS</span><strong>${esc(itemClassText(card))}</strong></div><div><span>RANK</span><strong>All Ranks</strong></div><div class="review-effect-info full-span"><span>ITEM EFFECT</span><p>${esc(effect||'-')}</p></div></div>`;
  }else if(card.family==='Event'){
    const effect=rows.map(row=>row.effect_text||row.text||row.damage_text||'').filter(Boolean).join(' ');
    $('reviewRows').innerHTML=`<div class="review-generic-row review-large-effect"><span>EVENT EFFECT</span><p>${esc(effect||'-')}</p></div>`;
  }else if(card.family==='LegacyModeDefinition'){
    const effect=rows.map(row=>row.effect_text||row.text||row.damage_text||'').filter(Boolean).join(' ');
    $('reviewRows').innerHTML=`<div class="review-generic-row"><span>LEGACY ABILITY</span><p>${esc(effect||'-')}</p></div>`;
  }else{
    $('reviewRows').innerHTML=rows.map(row=>`<div class="review-generic-row"><span>${esc(String(row.label||'CARD EFFECT').toUpperCase())}</span><p>${esc(row.text||row.effect_text||row.damage_text||'-')}</p></div>`).join('');
  }
}
function openCardReview(cardId){
  const card=cardById(cardId);if(!card)return;state.selectedCardId=cardId;hideHover();
  const dialog=$('cardReviewDialog');dialog.dataset.reviewKind=card.family==='Hero'?'hero':card.family==='Skill'?'skill':card.family==='Item'?'item':card.family==='Event'?'event':card.family==='LegacyModeDefinition'?'legacy':'standard';
  $('reviewTitle').textContent=card.name;$('reviewEyebrow').textContent=reviewEyebrow(card);$('reviewArt').src=card.image;$('reviewArt').alt=card.name;
  if(card.family==='Hero')heroReviewHtml(card);else standardReviewHtml(card);
  const progression=state.progressionByHeroId.get(card.id),progressionBox=$('reviewProgression');
  if(progression){
    progressionBox.hidden=false;$('reviewProgressionCards').innerHTML=progression.cardIds.map(id=>{const hero=cardById(id);return `<button class="review-progression-card ${id===card.id?'active':''}" type="button" data-review-rank-id="${id}"><img src="${hero.image}" alt="${esc(hero.name)}"></button>`}).join('');
    document.querySelectorAll('[data-review-rank-id]').forEach(button=>button.addEventListener('click',()=>openCardReview(button.dataset.reviewRankId)));
  }else{progressionBox.hidden=true;$('reviewProgressionCards').innerHTML=''}
  if(!dialog.open)dialog.showModal();
}

function validationIssues(){
  const issues=[];
  if(!heroFormationComplete())issues.push('Select three Hero progression packages.');
  if(!legacyUniqueComplete())issues.push('Choose three unique Legacy Cards.');
  if(legacyCardCount()!==12)issues.push(`Legacy Deck must contain 12 cards (currently ${legacyCardCount()}).`);
  if(countDeck()!==60)issues.push(`Main Deck must contain exactly 60 cards (currently ${countDeck()}).`);
  const incompatible=incompatibleDeckEntries();if(incompatible.length)issues.push(`${incompatible.reduce((sum,entry)=>sum+entry.quantity,0)} Main Deck card(s) are incompatible with the selected Heroes.`);
  for(const [id,quantity] of Object.entries(state.deck)){const card=state.byId.get(id);if(!card)issues.push(`Unknown card ID: ${id}.`);else if(quantity>copyLimit(card))issues.push(`${card.name} exceeds its copy limit (${quantity}/${copyLimit(card)}).`)}
  return issues;
}
function updateExportButton(){$('exportDeckButton').disabled=validationIssues().length>0}

function askConfirm({eyebrow='CONFIRM',title,message,list=[],okLabel='OK',danger=false}){
  return new Promise(resolve=>{
    const dialog=$('confirmDialog');
    const finish=value=>{if(dialog.open)dialog.close();cleanup();resolve(value)};
    const cleanup=()=>{$('confirmOk').onclick=null;$('confirmCancel').onclick=null;$('confirmClose').onclick=null;dialog.oncancel=null};
    $('confirmEyebrow').textContent=eyebrow;$('confirmTitle').textContent=title;$('confirmMessage').innerHTML=message;
    const listElement=$('confirmList');listElement.hidden=!list.length;listElement.innerHTML=list.map(item=>`<div class="confirm-item"><span>${esc(item.label)}</span><b>${esc(item.value)}</b></div>`).join('');
    $('confirmOk').textContent=okLabel;$('confirmOk').className=danger?'danger':'primary-action';$('confirmOk').onclick=()=>finish(true);$('confirmCancel').onclick=()=>finish(false);$('confirmClose').onclick=()=>finish(false);dialog.oncancel=event=>{event.preventDefault();finish(false)};dialog.showModal();
  });
}

function blankDeck(){
  state.deck={};state.slots=[emptySlot(),emptySlot(),emptySlot()];state.rankView=1;$('deckName').value='New Deck';resetAllFilterStates(false);syncPoolGate(false);setLibraryTab('heroes');renderAll();
}
function normalizeImportedDeck(data){
  const deck={};
  const entries=Array.isArray(data.main_deck)?data.main_deck:Array.isArray(data.mainDeck)?data.mainDeck:[];
  for(const entry of entries){const id=entry.card_id||entry.cardId||entry.id,card=state.byId.get(id),quantity=Number(entry.quantity??entry.qty??1);if(card&&Number.isFinite(quantity)&&quantity>0)deck[id]=Math.min(Math.floor(quantity),copyLimit(card))}
  const rawSlots=(data.legacy_deck_package_slots||data.side_deck_package_slots||data.legacySlots||[]).slice(0,3).map(slot=>({progressionId:slot.progression||slot.progressionId||'',legacyId:slot.legacy||slot.legacyId||''}));
  while(rawSlots.length<3)rawSlots.push(emptySlot());
  const formation=data.default_formation||data.formation||{},ordered=[];
  for(const position of POSITIONS){const heroId=formation[position]||formation[position.toLowerCase()]||'';const match=rawSlots.find(slot=>state.progressionById.get(slot.progressionId)?.cardIds[0]===heroId&&!ordered.includes(slot));if(match)ordered.push(match)}
  rawSlots.forEach(slot=>{if(!ordered.includes(slot))ordered.push(slot)});
  const slots=ordered.slice(0,3);const usedLegacy=new Set();slots.forEach(slot=>{if(slot.legacyId&&usedLegacy.has(slot.legacyId))slot.legacyId='';else if(slot.legacyId)usedLegacy.add(slot.legacyId)});
  return {name:data.deck_name||data.deckName||'Imported Deck',deck,slots};
}
function compactDeckName(name=''){
  const value=String(name||'New Deck').trim();
  const starter=value.match(/^Starter\s*(\d+)/i);
  return starter?`Starter ${starter[1]}`:value;
}
function applyDeck(normalized){
  const previousComplete=hasSelectedHeroes();state.deck={...normalized.deck};state.slots=clone(normalized.slots);while(state.slots.length<3)state.slots.push(emptySlot());$('deckName').value=compactDeckName(normalized.name||'New Deck');state.rankView=1;resetAllFilterStates(hasSelectedHeroes());syncPoolGate(previousComplete);setLibraryTab('heroes');renderAll();
}
function starterCover(starter,index){
  const preferred=['Warrior','Cleric','Thief','Archer','Mage'][index]||'';
  const slots=starter.legacy_deck_package_slots||starter.side_deck_package_slots||[];
  const preferredSlot=slots.find(slot=>state.progressionById.get(slot.progression)?.baseClass===preferred);
  const progressionId=preferredSlot?.progression||slots[0]?.progression;
  return state.progressionById.get(progressionId)?.coverImage||state.progressions[0]?.coverImage||'';
}
function renderStarterDialog(){
  $('starterDeckGrid').innerHTML=state.starters.map((starter,index)=>{
    const rawName=String(starter.deck_name||`Starter ${index+1}`).replace(/^Starter\s*\d+\s*[-–—]\s*/i,'');
    const name=rawName.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\//g,' / ');
    const classes=(starter.legacy_deck_package_slots||[]).map(slot=>state.progressionById.get(slot.progression)?.baseClass).filter(Boolean).join(' • ');
    return `<button class="starter-option" type="button" data-starter-index="${index}"><span>STARTER ${index+1}</span><img src="${starterCover(starter,index)}" alt=""><strong>${esc(name)}</strong><small>${esc(classes)}</small></button>`;
  }).join('');
  document.querySelectorAll('[data-starter-index]').forEach(button=>button.addEventListener('click',()=>chooseStarter(Number(button.dataset.starterIndex))));
}
function showNewDeckDialog(initial=false){state.initialChoicePending=initial;$('newDeckClose').hidden=initial;const dialog=$('newDeckDialog');if(!dialog.open)dialog.showModal()}
function closeNewDeckDialog(){if(state.initialChoicePending)return;const dialog=$('newDeckDialog');if(dialog.open)dialog.close()}
function chooseBlank(){blankDeck();state.initialChoicePending=false;$('newDeckDialog').close();toast('Blank deck created')}
function chooseStarter(index){const starter=state.starters[index];if(!starter)return;applyDeck(normalizeImportedDeck(starter));state.initialChoicePending=false;$('newDeckDialog').close();toast(`${starter.deck_name} loaded`)}
async function openNewDeckFlow(){
  if(isDeckDirty()){const ok=await askConfirm({eyebrow:'NEW DECK',title:'Replace the current deck?',message:'Starting another deck will replace the current Legacy Deck, Main Deck, Formation, and deck name.',okLabel:'CONTINUE',danger:true});if(!ok)return}
  showNewDeckDialog(false);
}
async function importDeckFile(file){
  try{const data=JSON.parse(await file.text());applyDeck(normalizeImportedDeck(data));toast('Deck imported')}
  catch(error){await askConfirm({eyebrow:'IMPORT ERROR',title:'Could not import this deck',message:esc(error.message||String(error)),okLabel:'CLOSE'})}
  finally{$('deckFileInput').value=''}
}
function expandedLegacy(){
  const output=[];state.slots.forEach((slot,index)=>{const progression=state.progressionById.get(slot.progressionId),legacy=state.legacyById.get(slot.legacyId);if(!progression)return;const packageId=`CUSTOM-SLOT-${index+1}`,packageName=`${progression.name}${legacy?` + ${legacy.name}`:''}`;progression.cardIds.forEach(id=>{const card=state.legacyById.get(id);if(card)output.push({card_id:id,card_name:card.name,card_type:'Hero',package_id:packageId,package_name:packageName})});if(legacy)output.push({card_id:legacy.id,card_name:legacy.name,card_type:'Legacy',package_id:packageId,package_name:packageName})});return output;
}
function exportObject(){
  const issues=validationIssues(),slots=state.slots.map(slot=>({progression:slot.progressionId,legacy:slot.legacyId})),expanded=expandedLegacy();
  return {schema_version:'GL-DECK-1.0',builder_version:'3.12-public-deck-builder',deck_name:$('deckName').value.trim()||'New Deck',format:'One Source Authority v1.4 + Public Deck Builder v3.12',main_deck_count:countDeck(),legacy_package_count:selectedProgressions().length,legacy_deck_count:legacyCardCount(),legacy_deck_label:'Legacy Deck',legacy_deck_package_slots:slots,legacy_deck_expanded:expanded,side_package_count:selectedProgressions().length,side_deck_count:legacyCardCount(),side_deck_package_slots:slots,side_deck_expanded:expanded,is_valid:issues.length===0,validation_issues:issues,validation_warnings:[],main_deck:Object.entries(state.deck).map(([id,quantity])=>({card_id:id,card_name:state.byId.get(id)?.name||id,quantity})).sort((a,b)=>String(a.card_id).localeCompare(String(b.card_id),undefined,{numeric:true})),default_formation:{LEFT:state.progressionById.get(state.slots[0].progressionId)?.cardIds[0]||'',CENTER:state.progressionById.get(state.slots[1].progressionId)?.cardIds[0]||'',RIGHT:state.progressionById.get(state.slots[2].progressionId)?.cardIds[0]||''},source_database_version:window.GL_DECK_BUILDER_DATA.sourceDatabaseVersion,builder_version_note:'Desktop-first Deck Builder. Skill Card Review keeps DAMAGE, BLOCK, or HEAL as the metric label and shows Physical, Magical, or Physical / Magical beneath applicable Damage and Block values. Hero Review scroll and independent per-tab filters remain unchanged.'};
}
function downloadJson(object){const safe=(object.deck_name||'Grandis_Legacy_Deck').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'Grandis_Legacy_Deck';const blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`${safe}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportDeck(){const object=exportObject();if(!object.is_valid){const ok=await askConfirm({eyebrow:'EXPORT DECK',title:'Export an incomplete deck?',message:'This deck is not match-ready yet.',list:object.validation_issues.map(issue=>({label:issue,value:'Issue'})),okLabel:'EXPORT ANYWAY'});if(!ok)return}downloadJson(object);toast('Deck exported')}

function bindStaticEvents(){
  document.querySelectorAll('.library-tab').forEach(button=>button.addEventListener('click',()=>setLibraryTab(button.dataset.libraryTab)));
  document.querySelectorAll('[data-section-toggle]').forEach(button=>button.addEventListener('click',()=>toggleSection(button.dataset.sectionToggle)));
  $('filterToggle').addEventListener('click',()=>{const panel=$('filterPanel'),open=panel.hidden;panel.hidden=!open;$('filterToggle').setAttribute('aria-expanded',String(open))});
  $('searchInput').addEventListener('input',event=>{state.filters.search=event.target.value;renderLibrary()});
  $('cardPoolSelect').addEventListener('change',event=>{state.filters.pool=event.target.value;renderLibrary()});
  $('classFilter').addEventListener('change',event=>{state.filters.className=event.target.value;renderLibrary()});
  $('skillTypeFilter').addEventListener('change',event=>{state.filters.skillType=event.target.value;if(state.filters.skillType!=='Attack'){state.filters.attackStyle='';$('attackStyleFilter').value=''}renderLibrary()});
  $('attackStyleFilter').addEventListener('change',event=>{state.filters.attackStyle=event.target.value;renderLibrary()});
  ['manaMin','manaMax'].forEach(id=>$(id).addEventListener('input',()=>{updateManaRangeLabel();renderLibrary()}));
  $('resetFilters').addEventListener('click',resetFilters);$('rankPrev').addEventListener('click',()=>cycleRank(-1));$('rankNext').addEventListener('click',()=>cycleRank(1));
  $('newDeckButton').addEventListener('click',openNewDeckFlow);$('createBlankDeck').addEventListener('click',chooseBlank);$('newDeckClose').addEventListener('click',closeNewDeckDialog);
  $('importDeckButton').addEventListener('click',()=>$('deckFileInput').click());$('deckFileInput').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importDeckFile(file)});$('exportDeckButton').addEventListener('click',exportDeck);
  $('reviewClose').addEventListener('click',()=>$('cardReviewDialog').close());$('cardReviewDialog').addEventListener('click',event=>{if(event.target===$('cardReviewDialog'))$('cardReviewDialog').close()});
  $('newDeckDialog').addEventListener('cancel',event=>{if(state.initialChoicePending)event.preventDefault()});$('newDeckDialog').addEventListener('click',event=>{if(event.target===$('newDeckDialog')&&!state.initialChoicePending)$('newDeckDialog').close()});
  $('deckName').addEventListener('input',updateExportButton);bindGlobalDropZones();
}

(function init(){
  const data=window.GL_DECK_BUILDER_DATA;if(!data)throw new Error('Deck Builder data failed to load.');
  state.cards=data.mainCards||[];state.byId=new Map(state.cards.map(card=>[card.id,card]));state.legacyCards=data.legacyCards||[];state.legacyById=new Map(state.legacyCards.map(card=>[card.id,card]));state.sourcePackages=data.legacyPackages||[];state.starters=data.starters||[];buildProgressions();bindStaticEvents();renderStarterDialog();blankDeck();updateManaRangeLabel();showNewDeckDialog(true);
})();
