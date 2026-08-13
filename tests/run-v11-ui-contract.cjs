const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function need(ok,msg){if(!ok)throw new Error(msg)}
const root=process.cwd(), index=read(root+'/index.html'), s2=read(root+'/style-2/index.html'), js=read(root+'/style-2/js/app.js'), css=read(root+'/style-2/css/app.css'), pkg=JSON.parse(read(root+'/package.json'));
need(pkg.version==='1.1.0','package version must be 1.1.0');
need(index.includes('CHANGE TO STYLE 2'),'Style 1 switch label missing');
need(s2.includes('CHANGE TO STYLE 1'),'Style 2 switch label missing');
need(index.includes('G-TG5921Z2EL')&&s2.includes('G-TG5921Z2EL'),'GA4 missing from a Deck Builder style');
need(s2.includes('id="legacyReferenceOpen"')&&s2.includes('VIEW HERO &amp; LEGACY'),'Legacy reference button missing');
need(s2.includes('id="legacyReferenceDialog"')&&s2.includes('Hero &amp; Legacy Library'),'Legacy reference dialog missing');
need(!/legacyReferenceDialog[\s\S]{0,1200}(searchInput|filterToggle)/.test(s2),'Legacy reference dialog must not include search/filter controls');
need(js.includes("card.family==='Hero'?0:card.family==='LegacyModeDefinition'?1:2"),'Hero-before-Legacy sort lock missing');
need(js.includes('state.legacyCards.slice().sort(legacyReferenceSort)'),'Reference library must display all Hero/Legacy cards');
need(js.includes('bindReviewButtons(root)'),'Reference cards must retain Card Review access');
need(css.includes('opacity:1!important')&&css.includes('filter:none!important'),'Reference cards must not be dimmed');
need(js.includes("builder_version:'2.9-classic-split'")&&read(root+'/js/app.js').includes("builder_version:'3.13-public-deck-builder'"),'Style builder versions not bumped');
console.log('PASS Deck Builder v1.1 UI contract');
