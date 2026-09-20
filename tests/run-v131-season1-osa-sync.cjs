'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const runtime=require(path.join(root,'data/season1/cards.runtime.v0.16.0.json'));
function load(rel){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),ctx);return ctx.window.GL_DECK_BUILDER_DATA;}
assert.equal(require(path.join(root,'package.json')).version,'1.31.0');
assert.equal(runtime.count,200);assert.equal(new Set(runtime.cards.map(c=>c.card_id)).size,200);
assert.equal(runtime.canonical_registry_hash,'85d25ebda9bb2bc260983a566e6d430dde97bfc7a32e8042ec2fddfeaff1b42f');
for(const rel of ['js/data.js','style-2/js/data.js']){
 const d=load(rel),all=[...(d.mainCards||[]),...(d.legacyCards||[])];
 assert.equal(all.length,200,rel+' card count');assert.equal(new Set(all.map(c=>c.id)).size,200,rel+' unique count');
 assert.equal(d.canonicalRegistryHash,runtime.canonical_registry_hash);assert.equal(d.heroComponentRegistryHash,runtime.hero_component_registry_hash);
 assert.equal(d.sourceStack.sourceAuthority,'1.9.0');assert.equal(d.sourceStack.runtimeData,'0.16.0');assert.equal(d.sourceStack.applicationRuntimeSync,'2.58');assert.equal(d.sourceStack.uiContract,'2.52');
 for(const id of ['S1-ITM-019','S1-ITM-020']){const c=all.find(x=>x.id===id);assert(c,id+' missing');assert(c.image.includes('/shared/season1/v1/cards/thumbs/'+id+'.webp'));}
 const by=Object.fromEntries(all.map(c=>[c.id,c]));
 for(const source of runtime.cards){const c=by[source.card_id];assert(c,source.card_id);assert.equal(c.name,source.name,source.card_id+' name');assert.equal(c.classification,source.classification,source.card_id+' classification');assert.equal(c.canonicalHash,source.canonical_hash,source.card_id+' hash');}
 assert.equal(d.starters.length,15,rel+' Starter60 count');
}
console.log('PASS Deck Builder v1.31 OSA v1.9.0 / 200-card sync');
