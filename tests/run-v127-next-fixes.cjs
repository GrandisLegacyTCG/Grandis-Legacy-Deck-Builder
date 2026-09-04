const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');function must(x,m){if(!x)throw new Error(m)}
const s1=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),s2=fs.readFileSync(path.join(root,'style-2/js/app-v1.21.js'),'utf8'),css=fs.readFileSync(path.join(root,'style-2/css/app-v1.19.css'),'utf8'),pkg=require(path.join(root,'package.json'));
must(pkg.version==='1.29.0','package version');
must(s1.includes('Number(card?.maxCopies||3)')&&s2.includes('Number(card?.maxCopies||3)'),'max-3 normal missing');
must(s2.includes('.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));')&&!s2.includes('.slice(0,3);\n}\nfunction renderSkillClassTooltip'),'Skill Classes still limited to 3');
must(css.includes('Skill Classes breakdown supports five visible rows')&&css.includes('overflow-y:auto'),'Skill Classes overflow missing');
must(fs.existsSync(path.join(root,'assets/favicon.png')),'favicon missing');
console.log('PASS v1.28 next-fix contract');
