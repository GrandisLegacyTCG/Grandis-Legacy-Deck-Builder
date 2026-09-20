'use strict';
const assert=require('assert'),path=require('path');const root=path.resolve(__dirname,'..');const data=require(path.join(root,'data/season1/cards.runtime.v0.16.0.json'));const by=Object.fromEntries(data.cards.map(c=>[c.card_id,c]));
const hp={"S1-ARC-H001":90,"S1-ARC-H002":110,"S1-ARC-H003":130,"S1-WAR-H001":90,"S1-WAR-H002":120,"S1-WAR-H003":150,"S1-WAR-H004":100,"S1-WAR-H005":120,"S1-WAR-H006":150};
assert.strictEqual(data.canonical_registry_hash,'85d25ebda9bb2bc260983a566e6d430dde97bfc7a32e8042ec2fddfeaff1b42f');for(const [id,v] of Object.entries(hp))assert.strictEqual(by[id].hp,v,`${id} HP`);assert.strictEqual(require(path.join(root,'package.json')).version,'1.31.0');console.log('PASS Deck Builder v1.31 Hero HP authority sync');
