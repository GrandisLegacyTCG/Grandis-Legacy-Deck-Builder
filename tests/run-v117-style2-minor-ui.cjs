'use strict';

const fs=require('fs');
const assert=require('assert');

const js=fs.readFileSync('style-2/js/app-v1.18.js','utf8');
const css=fs.readFileSync('style-2/css/app-v1.18.css','utf8');
const html=fs.readFileSync('style-2/index.html','utf8');

// Active v1.17 assets and Main Deck view control.
assert(html.includes('app-v1.18.js?v=1.18'),'v1.18 JavaScript asset is not active');
assert(html.includes('app-v1.18.css?v=1.18'),'v1.18 CSS asset is not active');
assert(html.includes('id="mainDeckViewOpen"'),'Main Deck VIEW DECK button missing');
assert(html.includes('id="mainDeckViewDialog"'),'Main Deck view dialog missing');
assert(html.includes('id="mainDeckViewGrid"'),'Main Deck view grid missing');
assert(html.includes('VIEW DECK'),'VIEW DECK label missing');

// View-only rendering with quantities and preview support.
for(const token of [
  'function renderMainDeckView()',
  'function openMainDeckView()',
  'mainDeckViewCardHtml(card,quantity)',
  'main-deck-view-quantity',
  'bindReviewButtons(root)',
  "$('mainDeckViewOpen').addEventListener('click',openMainDeckView)"
])assert(js.includes(token),`Missing Main Deck view contract: ${token}`);
assert(!/data-main-deck-view-(?:add|remove)/.test(js),'Deck View must remain view-only');

// Mobile tools are a single four-column row beneath Deck Name.
assert(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))!important'),'Mobile Deck Name tools are not locked to one four-button row');
assert(css.includes('.deck-name-field{\n    grid-column:1/-1!important;'),'Deck Name must remain full width above the four-button row');

// Hero/Legacy LEFT/CENTER/RIGHT card centers share the same 3-column grid.
const threeColumn='grid-template-columns:repeat(3,minmax(0,1fr))!important';
assert((css.match(new RegExp(threeColumn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length>=2,'Hero and Legacy mobile grids must both use the same three-column geometry');
assert(css.includes('.hero-slots-grid>.position-swap[data-swap-left="0"]{left:33.333333%!important}'),'LEFT/CENTER swap boundary missing');
assert(css.includes('.hero-slots-grid>.position-swap[data-swap-left="1"]{left:66.666667%!important}'),'CENTER/RIGHT swap boundary missing');

// Existing constraints remain present in active JS.
assert(js.includes('const MAIN_DECK_LEGAL_LIMIT=60;'),'60-card legal limit changed');
assert(js.includes('const MAIN_DECK_WORKSPACE_LIMIT=80;'),'80-card Style 2 workspace changed');
assert(js.includes("setData('text/grandis-card-id',id)"),'Desktop Library → Deck drag missing');
assert(js.includes("setData('text/grandis-remove-card-id',id)"),'Desktop Deck → remove drag missing');

console.log('PASS Deck Builder v1.18 Style 2 minor mobile alignment and Main Deck view contracts');
