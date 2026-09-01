'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
function load(file){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});return ctx.window.GL_DECK_BUILDER_DATA;}
assert.strictEqual(require('../package.json').version,'1.25.0');
for(const file of ['js/data.js','style-2/js/data.js']){
  const data=load(file);
  const main=data.mainCards||[];
  assert(main.length>0,`${file}: no main cards`);
  const normal=main.filter(card=>!card?.ultimate?.isUltimate);
  const ultimate=main.filter(card=>card?.ultimate?.isUltimate);
  assert(normal.length>0,`${file}: no normal cards`);
  assert(ultimate.length>0,`${file}: no Ultimate cards`);
  for(const card of normal)assert.strictEqual(Number(card.maxCopies),3,`${file}: ${card.id} normal copy limit`);
  for(const card of ultimate)assert.strictEqual(Number(card.maxCopies),1,`${file}: ${card.id} Ultimate copy limit`);
}
const style1=fs.readFileSync('js/app.js','utf8');
const style2=fs.readFileSync('style-2/js/app-v1.20.js','utf8');
assert(style1.includes('card?.maxCopies||3'),'Style 1 normal fallback copy limit must be 3');
assert(style2.includes('card?.maxCopies||3'),'Style 2 normal fallback copy limit must be 3');
assert(style1.includes('card?.ultimate?.isUltimate?1'),'Style 1 Ultimate limit must remain 1');
assert(style2.includes('card?.ultimate?.isUltimate?1'),'Style 2 Ultimate limit must remain 1');
const lock=JSON.parse(fs.readFileSync('release/DECK_RULE_LOCK_v1.25.json','utf8'));
assert.strictEqual(lock.normal_copy_limit,3);
assert.strictEqual(lock.ultimate_copy_limit,1);
assert.strictEqual(lock.main_deck_legal_size,60);
assert.strictEqual(lock.style_2_workspace_limit,80);
console.log('PASS Deck Builder v1.25 normal copy limit 3 / Ultimate copy limit 1');
