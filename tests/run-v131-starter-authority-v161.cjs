'use strict';
const assert=require('assert'),crypto=require('crypto'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const manifest=require(path.join(root,'data/starter-decks/ACTIVE_STARTERS_v1.6.1.json'));
const runtime=require(path.join(root,'data/season1/cards.runtime.v0.16.0.json'));
const canonical=new Set(runtime.cards.map(c=>c.card_id));
assert.equal(manifest.authority_version,'v1.6.1');
assert.equal(manifest.active_starter_count,5);assert.equal(manifest.starters.length,5);
const activeDir=path.join(root,'data/starter-decks/active');
const files=fs.readdirSync(activeDir).filter(f=>f.endsWith('_GL_DECK_1_0.json')).sort();assert.equal(files.length,5);
const expected=manifest.starters.slice().sort((a,b)=>a.slot-b.slot).map(e=>`${e.starter_id}_GL_DECK_1_0.json`);assert.deepStrictEqual(files,expected.slice().sort());
function semantic(s){return {deck_name:s.deck_name,main_deck_count:s.main_deck_count,legacy_deck_package_slots:s.legacy_deck_package_slots,legacy_deck_expanded:s.legacy_deck_expanded,main_deck:s.main_deck,default_formation:s.default_formation};}
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
function semanticHash(s){return crypto.createHash('sha256').update(stable(semantic(s))).digest('hex');}
const expectedSemanticHashes=[
  '12022ab05c4e631626b8e2a0de785226eec036d7ffba6c25cdb2406ac53db686',
  'fa588a8fa167cd3f9f20eb5956f15251854e130989ad0ba8eab1ca0bc0e58829',
  'c79b80526b532382d5ff8936f8f5e56eaf151bc1e7adf590587ec6a5da031234',
  'a08c21e22df05a85e28bedbed5accc7993ae589cb004eb17250306980b03f0ff',
  '2b9c959ad932e88e0a56eec8f77dfb2930e4b2eb3ae65d241d80426d254caabd'
];
const source=expected.map(f=>JSON.parse(fs.readFileSync(path.join(activeDir,f),'utf8')));
source.forEach((s,i)=>{
  assert.equal((s.main_deck||[]).reduce((n,x)=>n+Number(x.quantity||0),0),60,expected[i]);
  for(const x of s.main_deck)assert(canonical.has(x.card_id),`${expected[i]} unknown ${x.card_id}`);
  for(const x of s.legacy_deck_expanded||[])assert(canonical.has(x.card_id),`${expected[i]} unknown legacy ${x.card_id}`);
  assert.equal(semanticHash(s),expectedSemanticHashes[i],`${expected[i]} semantic authority mismatch`);
});
const s1=Object.fromEntries(source[0].main_deck.map(x=>[x.card_id,Number(x.quantity||0)]));
assert.deepStrictEqual(
  Object.fromEntries(['S1-MAG-002','S1-MAG-008','S1-MAG-014','S1-MAG-015','S1-THF-010','S1-THF-013','S1-THF-015','S1-THF-017'].map(id=>[id,s1[id]||0])),
  {'S1-MAG-002':2,'S1-MAG-008':3,'S1-MAG-014':0,'S1-MAG-015':1,'S1-THF-010':3,'S1-THF-013':2,'S1-THF-015':2,'S1-THF-017':0}
);
assert.deepStrictEqual(source[3].legacy_deck_package_slots.map(x=>x.progression),['S1-ARC-H001','S1-ARC-H004','S1-THF-H001'],'Starter 4 composition changed');
function load(rel){const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),c);return c.window.GL_DECK_BUILDER_DATA;}
for(const rel of ['js/data.js','style-2/js/data.js']){
  const d=load(rel);assert.equal(d.starters.length,5);assert.equal(d.sourceStack.sourceAuthority,'1.9.1');assert.equal(d.sourceStack.starter60,'1.6.1');assert.equal(d.sourceStack.starterAuthoritySource,'1.9.5');assert.equal(d.sourceStack.applicationRuntimeSync,'2.59');
  for(let i=0;i<5;i++)assert.deepStrictEqual(JSON.parse(JSON.stringify(semantic(d.starters[i]))),semantic(source[i]),`${rel} starter ${i+1} parity`);
}
const currentRootManifests=fs.readdirSync(path.join(root,'data/starter-decks')).filter(f=>/^ACTIVE_STARTERS_v.*\.json$/.test(f));
assert.deepStrictEqual(currentRootManifests,['ACTIVE_STARTERS_v1.6.1.json'],'more than one current active Starter manifest');
const activeText=[fs.readFileSync(path.join(root,'tools/build-deck-data.cjs'),'utf8'),fs.readFileSync(path.join(root,'js/app.js'),'utf8'),fs.readFileSync(path.join(root,'style-2/js/app-v1.31.js'),'utf8')].join('\n');
assert(!/ACTIVE_STARTERS_v1\.6\.0|Starter Authority v1\.6\.0|starter60\s*[:=]\s*['\"]?1\.6\.0/i.test(activeText),'active Starter Authority v1.6.0 fallback found');
assert(!/starter_count\s*[:=]\s*15|active.{0,20}15.{0,20}starter|fallback.{0,50}15/i.test(activeText),'retired 15-starter current fallback/assumption found');
console.log('PASS Deck Builder v1.31 Starter Authority v1.6.1 exact five-starter semantic parity');
