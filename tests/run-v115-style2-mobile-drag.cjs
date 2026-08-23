'use strict';

const fs=require('fs');
const assert=require('assert');

const js=fs.readFileSync('style-2/js/app-v1.15.js','utf8');
const css=fs.readFileSync('style-2/css/app-v1.15.css','utf8');
const html=fs.readFileSync('style-2/index.html','utf8');

for(const token of [
  'function mobileDeckGroupHtml',
  'class="mobile-deck-row"',
  'class="mobile-deck-thumb"',
  'class="mobile-card-info"',
  'data-mobile-remove',
  'data-mobile-add',
  "['Skill','Event','Item']",
  "quantity>=copyLimit(card)||countDeck()>=MAIN_DECK_WORKSPACE_LIMIT"
])assert(js.includes(token),`Missing mobile Main Deck contract: ${token}`);

for(const token of [
  '.deck-grid.mobile-deck-list',
  '.mobile-deck-row',
  '.mobile-deck-thumb',
  '.mobile-qty-control',
  'grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr) 28px minmax(0,1fr)!important',
  'grid-template-columns:repeat(3,minmax(0,1fr))!important'
])assert(css.includes(token),`Missing responsive CSS contract: ${token}`);

assert(css.includes('.position-swap{\n    display:grid!important;'),'Mobile swap controls must remain accessible');
assert(js.includes("setData('text/grandis-card-id',id)"),'Desktop Library → Deck drag payload missing');
assert(js.includes("setData('text/grandis-remove-card-id',id)"),'Desktop Deck → remove drag payload missing');
assert(js.includes("removeMainCard(id)"),'Removal drop must remove one copy');
assert(js.includes("if(current===1)delete state.deck[id];else state.deck[id]=current-1"),'Drag removal must decrement x2 to x1');
assert(!/reorder|insertBefore|sortOrder/i.test(js),'Manual Main Deck reorder must not be implemented');
assert(html.includes('app-v1.15.js?v=1.15')&&html.includes('app-v1.15.css?v=1.15'),'v1.15 cache-busted assets missing');

console.log('PASS Deck Builder v1.15 Style 2 mobile list/Legacy layout and desktop drag contracts');
