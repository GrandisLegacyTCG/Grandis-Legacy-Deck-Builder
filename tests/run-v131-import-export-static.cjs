'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');const root=path.resolve(__dirname,'..');
function load(rel){const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),c);return c.window.GL_DECK_BUILDER_DATA;}
for(const rel of ['js/data.js','style-2/js/data.js']){const d=load(rel),all=[...d.mainCards,...d.legacyCards];for(const id of ['S1-ITM-019','S1-ITM-020']){const c=all.find(x=>x.id===id);assert(c,id+' missing '+rel);assert.equal(c.maxCopies,3);}}
const s1=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),s2=fs.readFileSync(path.join(root,'style-2/js/app-v1.31.js'),'utf8');for(const [name,src] of [['Style1',s1],['Style2',s2]]){assert(src.includes('card_id:id'),name+' export card identity missing');assert(/\b(?:item|entry)\.card_id\|\|(?:item|entry)\.cardId\|\|(?:item|entry)\.id/.test(src),name+' import card identity missing');assert(src.includes('source_database_version:window.GL_DECK_BUILDER_DATA.sourceDatabaseVersion'),name+' source metadata export missing');}
console.log('PASS Deck Builder v1.31 Warp Scroll / Freeze Bomb import-export identity contract');
