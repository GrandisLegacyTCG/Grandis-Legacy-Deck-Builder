'use strict';
const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function need(ok,msg){if(!ok)throw new Error(msg)}
const root=process.cwd(), index=read(root+'/index.html'), s2=read(root+'/style-2/index.html'), js=read(root+'/style-2/js/app.js'), css=read(root+'/style-2/css/app.css'), pkg=JSON.parse(read(root+'/package.json'));
need(pkg.version==='1.5.0','package version must be 1.5.0');
need(index.includes('CHANGE TO STYLE 2'),'Style 1 switch label missing');
need(s2.includes('CHANGE TO STYLE 1'),'Style 2 switch label missing');
need(index.includes('G-TG5921Z2EL')&&s2.includes('G-TG5921Z2EL'),'GA4 missing from a Deck Builder style');
need(s2.includes('id="legacyReferenceOpen"')&&s2.includes('LEGACY DECK LIBRARY'),'Legacy Deck Library button missing');
need(s2.includes('legacy-total-with-library')&&/legacyReferenceOpen[\s\S]{0,160}legacyDeckTotal/.test(s2),'Legacy Deck Library button must sit immediately beside the 0/12 total');
need(s2.includes('id="legacyReferenceDialog"')&&s2.includes('Legacy Deck Library'),'Legacy Deck Library dialog missing');
need(!/legacyReferenceDialog[\s\S]{0,1200}(searchInput|filterToggle)/.test(s2),'Legacy Deck Library must not include search/filter controls');
need(js.includes("card.family==='Hero'?0:card.family==='LegacyModeDefinition'?1:2"),'Hero-before-Legacy sort lock missing');
need(js.includes('state.legacyCards.slice().sort(legacyReferenceSort)'),'Reference library must display all Hero/Legacy cards');
need(js.includes('bindReviewButtons(root)'),'Reference cards must retain Card Review access');
need(css.includes('Style 2 v2.13')&&css.includes('legacy-reference-card-tile')&&css.includes('aspect-ratio:5/7!important')&&css.includes('overflow-x:hidden!important'),'Legacy library cards must use a non-overlapping Main Library-scale grid');
need(css.includes('opacity:1!important')&&css.includes('filter:none!important'),'Reference cards must not be dimmed');
need(js.includes("builder_version:'2.13-classic-split'"),'Style 2 builder version not bumped');
need(read(root+'/js/app.js').includes("builder_version:'3.13-public-deck-builder'"),'Style 1 v3.13 must remain unchanged');
console.log('PASS Deck Builder v1.5 UI contract');
