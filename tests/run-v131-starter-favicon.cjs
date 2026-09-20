'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
const files=fs.readdirSync(path.join(root,'starter_deck_examples')).filter(x=>/^starter_.*_GL_DECK_1_0\.json$/i.test(x)).sort();assert.strictEqual(files.length,15);
for(const f of files){const s=JSON.parse(fs.readFileSync(path.join(root,'starter_deck_examples',f),'utf8'));assert.strictEqual(s.main_deck.reduce((n,x)=>n+Number(x.quantity||0),0),60,f);assert(String(s.format).includes('OSA v1.9.0'),f);assert.strictEqual(s.builder_version,'1.31-public-deck-builder',f);}
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'),sandbox);assert.strictEqual(sandbox.window.GL_DECK_BUILDER_DATA.starters.length,15);
for(const rel of ['index.html','style-1/index.html','style-2/index.html'])assert(fs.readFileSync(path.join(root,rel),'utf8').includes('favicon.png'));
console.log('PASS Deck Builder v1.31 Starter60 v1.5 / favicon regression');
