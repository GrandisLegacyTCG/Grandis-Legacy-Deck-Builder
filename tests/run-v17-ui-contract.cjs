const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
function need(ok,msg){if(!ok){console.error('FAIL',msg);process.exit(1)}}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const js=fs.readFileSync(path.join(root,'style-2/js/app-v1.15.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style-2/css/app-v1.15.css'),'utf8');
const html=fs.readFileSync(path.join(root,'style-2/index.html'),'utf8');
need(pkg.version==='1.26.0','package version must be 1.26.0');
need(html.includes('LEGACY DECK LIBRARY'),'Legacy Deck Library button missing');
need(css.includes('Style 2 v2.15')&&css.includes('.legacy-total-with-library{\n  align-items:center!important;'),'Legacy library button/counter must be vertically centered');
need(js.includes('}).sort(mainDeckSort);\n}\nfunction libraryCardHtml'),'Card Library must use family-first mainDeckSort');
need(js.includes('const MAIN_DECK_FAMILY_ORDER={Skill:0,Event:1,Item:2};'),'family order must be Skill, Event, Item');
need(js.includes("builder_version:'2.16-classic-split'"),'Style 2 builder version not bumped to 2.16');
console.log('PASS Deck Builder v1.15 Style 2 preserved UI/sort contract');

need(fs.readFileSync(path.join(root,'js/data.js'),'utf8').includes('https://grandislegacytcg.github.io/shared/season1/v1/cards/thumbs/'),'Style 1 shared card source missing');
need(fs.readFileSync(path.join(root,'style-2/js/data.js'),'utf8').includes('https://grandislegacytcg.github.io/shared/season1/v1/cards/thumbs/'),'Style 2 shared card source missing');
need(!fs.existsSync(path.join(root,'assets/cards')),'Duplicate local card assets still packaged');
