
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
for(const rel of ['index.html','style-1/index.html']){
  const html=read(rel);
  assert.ok(html.includes('id="createBlankDeck"')&&html.includes('id="importDeckStart"'),`${rel}: 50:50 start actions missing`);
  assert.ok(html.includes('id="deckFileInput" type="file" accept="application/json,.json" hidden'),`${rel}: direct JSON device picker missing`);
  assert.ok(html.includes('id="importDeckButton"'),`${rel}: toolbar Import Deck missing`);
}
const css=read('css/app.css');
assert.ok(css.includes('.deck-start-choice-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);'), 'Style 1 Blank/Import is not an equal two-column split');
const app=read('js/app.js');
assert.ok(app.includes("$('importDeckStart').addEventListener('click',()=>$('deckFileInput').click())"),'start Import Deck does not open device file picker');
assert.ok(app.includes("$('importDeckButton').addEventListener('click',()=>$('deckFileInput').click())"),'toolbar Import Deck does not open device file picker');
assert.ok(app.includes("JSON.parse(await file.text())")&&app.includes('applyDeck(normalizeImportedDeck(data))'),'JSON file is not parsed and applied');
assert.ok(app.includes('Math.min(Math.floor(quantity),copyLimit(card))'),'import does not retain per-card copy legality');
assert.ok(!/main_deck_count\s*[!=<>]=?\s*60/.test(app.slice(app.indexOf('function normalizeImportedDeck'),app.indexOf('function compactDeckName'))),'import flow incorrectly requires 60 Main Deck cards');
assert.ok(app.includes('Style 1 v3.24 allows Main Deck export at any card count.'),'flexible Main Deck export policy was not preserved');
console.log('PASS Deck Builder v1.29: Style 1 has equal Blank Deck / Import Deck entry actions, direct device JSON import, per-card copy caps, and no 60-card import/save gate.');
