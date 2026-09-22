
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
const activeDir=path.join(root,'data/starter-decks/active');
const files=fs.readdirSync(activeDir).filter(x=>/^starter_.*_GL_DECK_1_0\.json$/i.test(x)).sort();assert.strictEqual(files.length,5);
for(const f of files){const s=JSON.parse(fs.readFileSync(path.join(activeDir,f),'utf8'));assert.strictEqual(s.main_deck.reduce((n,x)=>n+Number(x.quantity||0),0),60,f);assert(String(s.format).includes('Starter Deck Authority v1.6.1'),f);}
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'),sandbox);assert.strictEqual(sandbox.window.GL_DECK_BUILDER_DATA.starters.length,5);
for(const rel of ['index.html','style-1/index.html','style-2/index.html'])assert(fs.readFileSync(path.join(root,rel),'utf8').includes('favicon.png'));
console.log('PASS Deck Builder v1.31 Starter Authority v1.6.1 five-starter / favicon regression');
