const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const pages=['index.html','style-1/index.html','style-2/index.html'];
for(const rel of pages){
  const html=fs.readFileSync(path.join(root,rel),'utf8');
  assert(html.includes('class="mobile-app-menu-button"'),`${rel}: hamburger missing`);
  assert(html.includes('id="mobile-app-menu"'),`${rel}: mobile menu missing`);
  assert(html.includes('https://grandislegacytcg.github.io/Grandis-Legacy-VS-AI/'),`${rel}: VS AI link missing`);
  assert(html.includes('https://grandislegacytcg.github.io/pvp/'),`${rel}: PvP link missing`);
  assert(html.includes('https://grandislegacytcg.github.io/Grandis-Legacy-Deck-Builder/style-2/'),`${rel}: mobile Deck Builder must point Style 2`);
  assert(html.includes('mobile-app-nav.js?v=1.20'),`${rel}: menu controller missing`);
}
for(const rel of ['css/app.css','style-2/css/app-v1.19.css']){
  const css=fs.readFileSync(path.join(root,rel),'utf8');
  assert(css.includes('.mobile-app-menu-button{display:none'),`${rel}: desktop-hide contract missing`);
  assert(css.includes('.global-nav{display:none!important}'),`${rel}: mobile regular nav must hide`);
  assert(css.includes('.mobile-app-menu-button{display:flex}'),`${rel}: mobile hamburger must show`);
}
const js=fs.readFileSync(path.join(root,'js/mobile-app-nav.js'),'utf8');
assert(js.includes("aria-expanded"),'mobile menu accessibility state missing');
assert(js.includes("document.addEventListener('click'"),'outside click close missing');
console.log('Deck Builder v1.20 mobile navigation: PASS');
