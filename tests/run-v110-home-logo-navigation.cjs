const fs=require('fs');
for(const file of ['index.html','style-1/index.html','style-2/index.html']){
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes('href="https://grandislegacytcg.github.io/" aria-label="Grandis Legacy homepage"')) throw new Error(`Homepage logo link missing in ${file}`);
}
console.log('PASS Deck Builder v1.10 homepage-logo navigation');
