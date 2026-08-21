const fs=require('fs');
const html=fs.readFileSync('style-2/index.html','utf8');
const js=fs.readFileSync('style-2/js/app.js','utf8');
const css=fs.readFileSync('style-2/css/app.css','utf8');

function must(condition,message){if(!condition)throw new Error(message)}

must(html.includes('id="skillSummary"') && html.includes('id="skillClassTooltip"'),
  'Style 2 Skill hover summary markup missing');
must(js.includes("countDeck()>=80") && js.includes("workspace already contains 80 cards"),
  'Style 2 80-card workspace guard missing');
must(js.includes("`${total} / 60`"),
  'Visible Style 2 Main Deck counter must remain XX / 60');
must(js.includes("overLimit=total>60") && js.includes("'Deck Invalid'"),
  '61-80 invalid state missing');
must(js.includes("exportButton.disabled=overLimit"),
  'Export button must be disabled above 60');
must(js.includes("if(countDeck()>60){toast('Reduce Main Deck to 60 cards or fewer before exporting');return}"),
  'Hard export guard above 60 missing');
must(js.includes('function skillClassBreakdown()') && js.includes('.slice(0,3)'),
  'Skill Class hover breakdown must be capped at 3 Classes');
must(css.includes('.skill-class-tooltip'),
  'Skill Class tooltip styles missing');

for(const file of ['index.html','style-1/index.html','style-2/index.html']){
  const page=fs.readFileSync(file,'utf8');
  must(page.includes('href="https://grandislegacytcg.github.io/" aria-label="Grandis Legacy homepage"'),
    `Homepage logo link missing in ${file}`);
  must(!/target=["']_blank["']/.test(page),`New-tab navigation remains in ${file}`);
}

console.log('PASS Deck Builder v1.12 Style 2 cutting workspace + Skill hover contract');
