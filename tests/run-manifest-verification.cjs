'use strict';

const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const rows=fs.readFileSync(path.join(root,'FILE_MANIFEST_SHA256.csv'),'utf8').trim().split(/\r?\n/);
assert.strictEqual(rows.shift(),'path,bytes,sha256');
assert.ok(rows.length>0);
for(const row of rows){
  const first=row.indexOf(','),second=row.indexOf(',',first+1);
  const rel=row.slice(0,first),bytes=Number(row.slice(first+1,second)),expected=row.slice(second+1);
  const data=fs.readFileSync(path.join(root,rel));
  assert.strictEqual(data.length,bytes,`${rel}: size mismatch`);
  assert.strictEqual(crypto.createHash('sha256').update(data).digest('hex'),expected,`${rel}: hash mismatch`);
}
assert.ok(!rows.some(row=>row.startsWith('FILE_MANIFEST_SHA256.csv,')));
console.log(`PASS Deck Builder v1.17 manifest verification: ${rows.length} files.`);
