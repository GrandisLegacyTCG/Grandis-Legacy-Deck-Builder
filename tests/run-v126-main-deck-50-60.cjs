const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
function must(ok,msg){if(!ok)throw new Error(msg)}
function loadData(rel){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),ctx,{filename:rel});return ctx.window.GL_DECK_BUILDER_DATA;}
const s1=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const s2=fs.readFileSync(path.join(root,'style-2/js/app-v1.21.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for(const rel of ['js/data.js','style-2/js/data.js']){
  const data=loadData(rel),main=data.mainCards||[];
  must(main.length>0,rel+': no main cards');
  for(const card of main){
    const expected=card?.ultimate?.isUltimate?1:3;
    must(Number(card.maxCopies)===expected,`${rel}: ${card.id} copy limit ${card.maxCopies}, expected ${expected}`);
  }
}
must(s1.includes('function isLegalMainDeckSize(total){return total===50||total===60}'),'Style 1 50/60 size helper missing');
must(s1.includes("if(!isLegalMainDeckSize(countDeck()))issues.push(`Main Deck must contain exactly 50 or 60 cards"),'Style 1 validation is not 50/60');
must(s1.includes("if(!isLegalMainDeckSize(countDeck())){toast('Main Deck must contain exactly 50 or 60 cards before exporting')"),'Style 1 export guard is not 50/60');
must(s2.includes('const MAIN_DECK_LEGAL_SIZES=[50,60]'),'Style 2 50/60 legal-size lock missing');
must(s2.includes('wrongSize=!isLegalMainDeckSize(total)'),'Style 2 button legality is not 50/60');
must(s2.includes("if(!isLegalMainDeckSize(countDeck()))issues.push(`Main Deck must contain exactly 50 or 60 cards"),'Style 2 validation is not 50/60');
must(s2.includes("if(!isLegalMainDeckSize(countDeck())){toast('Main Deck must contain exactly 50 or 60 cards before exporting')"),'Style 2 export guard is not 50/60');
must(s1.includes('Number(card?.maxCopies||3)') && s2.includes('Number(card?.maxCopies||3)'),'Normal max-3 fallback missing');
must(s1.includes('card?.ultimate?.isUltimate?1') && s2.includes('card?.ultimate?.isUltimate?1'),'Ultimate max-1 guard missing');
const lock=JSON.parse(fs.readFileSync(path.join(root,'release/DECK_RULE_LOCK_v1.27.json'),'utf8'));
must(JSON.stringify(lock.main_deck_legal_sizes)===JSON.stringify([50,60]),'Release lock 50/60 sizes missing');
must(lock.normal_copy_limit===3 && lock.ultimate_copy_limit===1,'Release copy limits mismatch');
must(pkg.version==='1.27.0','Package version mismatch');
console.log('PASS v1.27: Deck Builder accepts exactly 50 or 60 cards, normal max 3, Ultimate max 1.');
