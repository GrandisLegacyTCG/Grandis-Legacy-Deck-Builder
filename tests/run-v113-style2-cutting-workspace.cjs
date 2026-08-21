const fs=require('fs');
const html=fs.readFileSync('style-2/index.html','utf8');
const js=fs.readFileSync('style-2/js/app-v1.13.js','utf8');
const css=fs.readFileSync('style-2/css/app-v1.13.css','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

function must(condition,message){if(!condition)throw new Error(message)}

must(pkg.version==='1.13.0','Package version must be 1.13.0');
must(html.includes('js/app-v1.13.js') && html.includes('css/app-v1.13.css'),
  'Style 2 must reference versioned v1.13 runtime assets');
must(!fs.existsSync('style-2/js/app.js') && !fs.existsSync('style-2/css/app.css'),
  'Stale unversioned Style 2 behavior assets must not remain in the release');

must(js.includes('const MAIN_DECK_LEGAL_LIMIT=60;'), 'Explicit 60-card legal limit missing');
must(js.includes('const MAIN_DECK_WORKSPACE_LIMIT=80;'), 'Explicit 80-card workspace limit missing');
must(js.includes('countDeck()>=MAIN_DECK_WORKSPACE_LIMIT'), '80-card add guard missing');
must(js.includes('workspace already contains ${MAIN_DECK_WORKSPACE_LIMIT} cards'), '80-card workspace toast missing');
must(!js.includes('Main Deck already contains 60 cards'), 'Stale 60-card add guard/toast remains');

must(js.includes('`${total} / ${MAIN_DECK_LEGAL_LIMIT}`'), 'Visible counter must remain XX / 60');
must(js.includes('overLimit=total>MAIN_DECK_LEGAL_LIMIT'), '61-80 invalid state missing');
must(js.includes('exportButton.disabled=overLimit'), 'Export button must be disabled above 60');
must(js.includes('if(countDeck()>MAIN_DECK_LEGAL_LIMIT)'), 'Hard export guard above 60 missing');
must(js.includes('importedTotal>MAIN_DECK_WORKSPACE_LIMIT'), 'Import guard above 80 missing');

must(html.includes('id="skillSummary"') && html.includes('id="skillClassTooltip"'), 'Skill hover summary markup missing');
must(js.includes('function skillClassBreakdown()') && js.includes('.slice(0,3)'), 'Skill class breakdown must be capped at 3 classes');
must(css.includes('.skill-class-tooltip{\n  display:none;'), 'Skill tooltip must be hidden by default');
must(css.includes('.skill-summary-hover:hover .skill-class-tooltip:not([hidden])'), 'Skill tooltip hover reveal missing');

for(const file of ['index.html','style-1/index.html','style-2/index.html']){
  const page=fs.readFileSync(file,'utf8');
  must(page.includes('href="https://grandislegacytcg.github.io/" aria-label="Grandis Legacy homepage"'), `Homepage logo link missing in ${file}`);
  must(!/target=["']_blank["']/.test(page), `New-tab navigation remains in ${file}`);
}

console.log('PASS Deck Builder v1.13 Style 2 80-card workspace + hover-only Skill tooltip contract');
