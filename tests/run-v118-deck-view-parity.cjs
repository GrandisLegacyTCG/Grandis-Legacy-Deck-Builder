'use strict';
const fs=require('fs');
const assert=require('assert');
const css=fs.readFileSync('style-2/css/app-v1.18.css','utf8');
const html=fs.readFileSync('style-2/index.html','utf8');
const js=fs.readFileSync('style-2/js/app-v1.18.js','utf8');
assert(html.includes('app-v1.18.css?v=1.18'),'v1.18 CSS is not active');
assert(html.includes('app-v1.18.js?v=1.18'),'v1.18 JS is not active');
for(const token of [
  'width:min(1320px,calc(100vw - 28px))!important',
  'height:min(820px,calc(100dvh - 28px))!important',
  'display:flex!important',
  'flex-flow:row wrap!important',
  'flex:0 0 134px!important',
  'width:134px!important',
  'flex-basis:142px!important',
  'flex-basis:126px!important',
  'flex-basis:calc((100% - 9px)/2)!important'
]) assert(css.includes(token),`Missing Main Deck View parity geometry: ${token}`);
assert(js.includes('main-deck-view-quantity'),'Quantity badge contract missing');
assert(js.includes('reviewButton(card.id)'),'Enlarge/review button contract missing');
assert(!/data-main-deck-view-(?:add|remove)/.test(js),'Deck View must remain view-only');
console.log('PASS Deck Builder v1.18 Main Deck View matches Legacy Deck Library geometry');
