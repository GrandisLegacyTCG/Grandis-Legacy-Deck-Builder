'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
function load(rel){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),ctx);return ctx.window.GL_DECK_BUILDER_DATA;}
for(const rel of ['js/data.js','style-2/js/data.js']){
  const d=load(rel),all=[...(d.mainCards||[]),...(d.legacyCards||[])];
  assert.equal(all.length,200,rel+' card count');
  assert.equal(new Set(all.map(c=>c.id)).size,200,rel+' unique count');
  assert.equal(d.sourceStack.oneSourceAuthority,'1.8.1');
  assert.equal(d.sourceStack.runtimeData,'0.15.0');
  for(const id of ['S1-ITM-019','S1-ITM-020']) { const c=all.find(c=>c.id===id); assert(c,id+' missing in '+rel); assert(c.image.includes('/shared/season1/v1/cards/thumbs/'+id+'.webp'),id+' shared art URL missing'); }
}
console.log('PASS Deck Builder v1.30 Season 1 200-card sync');
