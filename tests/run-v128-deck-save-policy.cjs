const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'); function must(x,m){if(!x)throw new Error(m)}
const s1=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const s2=fs.readFileSync(path.join(root,'style-2/js/app-v1.21.js'),'utf8');
const pkg=require(path.join(root,'package.json'));
function load(rel){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),ctx);return ctx.window.GL_DECK_BUILDER_DATA;}
for(const rel of ['js/data.js','style-2/js/data.js']){const data=load(rel);for(const c of data.mainCards||[]){must(Number(c.maxCopies)===(c?.ultimate?.isUltimate?1:3),rel+' copy limit mismatch '+c.id)}}
must(!s1.includes('countDeck()>=60'), 'Style 1 still hard-caps Main Deck at 60');
must(!s1.includes('exactly 50 or 60 cards before exporting'), 'Style 1 export still size-gated');
must(!s1.includes('Main Deck must contain exactly 50 or 60 cards (currently'), 'Style 1 validation still size-gated');
must(s1.includes("quantity>=copyLimit(card)?'disabled':''"),'Style 1 copy-limit add button missing');
must(!s2.includes('exactly 50 or 60 cards before exporting'),'Style 2 export still size-gated');
must(!s2.includes('Main Deck must contain exactly 50 or 60 cards (currently'),'Style 2 validation still size-gated');
must(s2.includes('MAIN_DECK_WORKSPACE_LIMIT=80'),'Style 2 80-card cutting workspace changed unexpectedly');
must(s1.includes('card?.ultimate?.isUltimate?1')&&s2.includes('card?.ultimate?.isUltimate?1'),'Ultimate max-1 missing');
must(s1.includes('Number(card?.maxCopies||3)')&&s2.includes('Number(card?.maxCopies||3)'),'Normal max-3 missing');
must(pkg.version==='1.28.0','package version');
console.log('PASS v1.28: Deck Builder save/export is size-unrestricted; normal max 3; Ultimate max 1; Style 2 workspace remains 80.');
