const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
for(const rel of ['index.html','style-2/index.html']){
  const html=fs.readFileSync(path.join(root,rel),'utf8');
  assert(html.includes('mobile-app-nav.js?v=1.21'),`${rel}: v1.21 menu controller missing`);
}
const style1=fs.readFileSync(path.join(root,'style-1/index.html'),'utf8');
assert(style1.includes('../js/mobile-app-nav.js?v=1.21'),'style-1: shared mobile nav path not repaired');
const js=fs.readFileSync(path.join(root,'js/mobile-app-nav.js'),'utf8');
assert(js.includes('document.body.appendChild(menu)'),'menu must escape clipping header container');
assert(js.includes("menu.style.position = 'fixed'"),'menu must use viewport positioning');
assert(js.includes('menu.hidden = false'),'menu open state missing');
assert(js.includes("event.key === 'Escape'"),'Escape close missing');
for(const rel of ['css/app.css','style-2/css/app-v1.19.css']){
  const css=fs.readFileSync(path.join(root,rel),'utf8');
  assert(css.includes('.mobile-app-menu{position:fixed!important;z-index:10000!important}'),`${rel}: fixed visible dropdown lock missing`);
}
console.log('Deck Builder v1.21 mobile hamburger dropdown visibility: PASS');
