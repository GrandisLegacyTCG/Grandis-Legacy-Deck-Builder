
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const manifest=require(path.join(root,'data/starter-decks/ACTIVE_STARTERS_v1.6.0.json'));
const runtime=require(path.join(root,'data/season1/cards.runtime.v0.16.0.json'));
const canonical=new Set(runtime.cards.map(c=>c.card_id));
assert.equal(manifest.osa_version,'v1.9.1');assert.equal(manifest.authority_version,'v1.6.0');assert.equal(manifest.active_starter_count,5);assert.equal(manifest.starters.length,5);
const activeDir=path.join(root,'data/starter-decks/active');
const files=fs.readdirSync(activeDir).filter(f=>f.endsWith('_GL_DECK_1_0.json')).sort();assert.equal(files.length,5);
const expected=manifest.starters.slice().sort((a,b)=>a.slot-b.slot).map(e=>`${e.starter_id}_GL_DECK_1_0.json`);assert.deepStrictEqual(files,expected.slice().sort());
function semantic(s){return {deck_name:s.deck_name,main_deck_count:s.main_deck_count,legacy_deck_package_slots:s.legacy_deck_package_slots,legacy_deck_expanded:s.legacy_deck_expanded,main_deck:s.main_deck,default_formation:s.default_formation};}
const source=expected.map(f=>JSON.parse(fs.readFileSync(path.join(activeDir,f),'utf8')));
source.forEach((s,i)=>{assert.equal((s.main_deck||[]).reduce((n,x)=>n+Number(x.quantity||0),0),60,expected[i]);for(const x of s.main_deck)assert(canonical.has(x.card_id),`${expected[i]} unknown ${x.card_id}`);for(const x of s.legacy_deck_expanded||[])assert(canonical.has(x.card_id),`${expected[i]} unknown legacy ${x.card_id}`);});
assert.deepStrictEqual(source[3].legacy_deck_package_slots.map(x=>x.progression),['S1-ARC-H001','S1-ARC-H004','S1-THF-H001'],'Starter 4 old composition returned');
function load(rel){const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),c);return c.window.GL_DECK_BUILDER_DATA;}
for(const rel of ['js/data.js','style-2/js/data.js']){const d=load(rel);assert.equal(d.starters.length,5);assert.equal(d.sourceStack.sourceAuthority,'1.9.1');assert.equal(d.sourceStack.starter60,'1.6.0');assert.equal(d.sourceStack.applicationRuntimeSync,'2.59');for(let i=0;i<5;i++)assert.deepStrictEqual(JSON.parse(JSON.stringify(semantic(d.starters[i]))),semantic(source[i]),`${rel} starter ${i+1} OSA parity`);}
const activeText=[fs.readFileSync(path.join(root,'tools/build-deck-data.cjs'),'utf8'),fs.readFileSync(path.join(root,'js/app.js'),'utf8'),fs.readFileSync(path.join(root,'style-2/js/app-v1.31.js'),'utf8')].join('\n');
assert(!/starter_count\s*[:=]\s*15|active.{0,20}15.{0,20}starter|fallback.{0,50}15/i.test(activeText),'retired 15-starter current fallback/assumption found');
console.log('PASS Deck Builder v1.31 exact OSA v1.9.1 five-starter semantic parity');
