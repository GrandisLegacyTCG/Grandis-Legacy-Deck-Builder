const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
function need(ok,msg){if(!ok){console.error('FAIL',msg);process.exit(1)}}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const js=fs.readFileSync(path.join(root,'style-2/js/app-v1.31.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style-2/css/app-v1.31.css'),'utf8');
const html=fs.readFileSync(path.join(root,'style-2/index.html'),'utf8');
need(pkg.version==='1.31.0','package version must be 1.31.0');
need(html.includes('LEGACY DECK LIBRARY'),'Legacy Deck Library button missing');
need(js.includes('const MAIN_DECK_FAMILY_ORDER={Skill:0,Event:1,Item:2};'),'family order must be Skill, Event, Item');
need(js.includes("const DECK_BUILDER_RELEASE='1.31';"),'Style 2 public release marker missing');
need(html.includes('css/app-v1.31.css?v=1.31')&&html.includes('js/app-v1.31.js?v=1.31'),'Style 2 active asset refs stale');
need(css.includes('pointer-events:none!important'),'Style 2 hover preview must be non-interactive');
need(fs.readFileSync(path.join(root,'js/data.js'),'utf8').includes('https://grandislegacytcg.github.io/shared/season1/v1/cards/thumbs/'),'Style 1 shared card source missing');
need(fs.readFileSync(path.join(root,'style-2/js/data.js'),'utf8').includes('https://grandislegacytcg.github.io/shared/season1/v1/cards/thumbs/'),'Style 2 shared card source missing');
need(!fs.existsSync(path.join(root,'assets/cards')),'Duplicate local card assets still packaged');
console.log('PASS Deck Builder v1.31 active UI/source contract');
