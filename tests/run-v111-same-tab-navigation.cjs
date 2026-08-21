const fs=require('fs');
for(const file of ['index.html','style-1/index.html','style-2/index.html']){
  const html=fs.readFileSync(file,'utf8');
  if(/target=["']_blank["']/.test(html)) throw new Error(`New-tab navigation remains in ${file}`);
  if(!html.includes('href="https://grandislegacytcg.github.io/Grandis-Legacy-VS-AI/"')) throw new Error(`VS AI public route missing in ${file}`);
  if(!html.includes('href="https://grandislegacytcg.github.io/pvp/"')) throw new Error(`PvP public route missing in ${file}`);
  if(html.includes('p01--grandis-legacy-pvp--2kwws8nzlcc2.code.run')) throw new Error(`Old direct PvP frontend URL remains in ${file}`);
}
console.log('PASS Deck Builder v1.11 same-tab public app navigation');
