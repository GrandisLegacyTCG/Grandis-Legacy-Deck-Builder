import assert from 'node:assert/strict';
import { VERSION, MAIN, HERO, LEGACY, PACKAGES, qaV099FullEngineAudit, qaS1B2PlaytestTuning091 } from './core.mjs';
import data from './data/game_data.json' with { type: 'json' };
import fs from 'node:fs';
import path from 'node:path';

assert.equal(VERSION,'1.0.0');
assert.equal(data.mainPool.length,132);
assert.equal(data.scripts.length,132);
assert.equal(Object.keys(data.heroData).length,24);
assert.equal(Object.keys(data.legacyData).length,10);

const byId=Object.fromEntries(data.mainPool.map(c=>[c.card_id,c]));
assert.equal(byId['S1-ARC-001'].mana_cost,'3');
assert.equal(byId['S1-ARC-001'].base_damage,'10');
assert.equal(byId['S1-ARC-010'].mana_cost,'0');
assert.match(byId['S1-ARC-010'].effect_text,/Spend all your Mana Shards/i);
assert.equal(byId['S1-ARC-018'].is_ultimate,'TRUE');
assert.match(byId['S1-ARC-018'].effect_text,/cannot be dodged/i);
assert.equal(byId['S1-THF-012'].mana_cost,'6');
assert.equal(byId['S1-THF-015'].exp_value,'100');
assert.equal(byId['S1-THF-015'].is_ultimate,'FALSE');
assert.equal(String(byId['S1-THF-015'].ultimate_class_lineage_id||''),'');
assert.equal(String(byId['S1-THF-015'].ultimate_tribute_rule||''),'');
assert.doesNotMatch(String(byId['S1-THF-015'].mechanic_tags||''),/Ultimate/i);
assert.equal(byId['S1-THF-018'].is_ultimate,'TRUE');
assert.match(String(byId['S1-THF-018'].ultimate_class_lineage_id||''),/THF-RENEGADE/);
assert.equal(HERO['S1-THF-H003'].ability_text,'Increase Poison status duration caused by this hero by 1 and increase all attack damage by 10.');
assert.equal(HERO['S1-ARC-H002'].ability_text,'Increase all Single Target Attack damage by 10.');
assert.equal(HERO['S1-ARC-H003'].ability_text,'Increase all Single Target Attack damage by 20.');
assert.equal(HERO['S1-ARC-H003'].class,'Grand Ranger');
assert.equal(LEGACY['S1-ARC-L001'].usage_phase,'Battle Phase');
assert.equal(LEGACY['S1-ARC-L002'].usage_phase,'End Phase');
assert.equal(PACKAGES.has('PKG-ARC-KORVAK-GOLDEN'),true);
assert.equal(PACKAGES.has('PKG-ARC-KORVAK-FALCONER'),true);
assert.match(String(byId['S1-ITM-016'].class_restriction),/Thief/);
assert.doesNotMatch(String(byId['S1-ITM-016'].class_restriction),/Rogue/);
assert.doesNotMatch(String(fs.readFileSync('./core.mjs','utf8')), /'S1-THF-015':'THF-RENEGADE'/, 'Venom Sovereign must not be hardcoded as Ultimate Tribute lineage');
assert.match(String(fs.readFileSync('./core.mjs','utf8')), /venom\\s\+sovereign[\s\S]*return ''/, 'Core must explicitly exempt Venom Sovereign from Ultimate Tribute restriction');

const starterDir='./public/starter_decks';
const files=fs.readdirSync(starterDir).filter(f=>f.endsWith('.json'));
for (const bad of ['Mixed_Starter_Deck_GL_DECK_1_0.json','Hybrid_Starter_Deck_GL_DECK_1_0.json','Half-Hybrid_Starter_Deck_GL_DECK_1_0.json']) assert.equal(files.includes(bad),false,bad+' should be removed');
const clean=['starter_01_elemental_lord_conqueror_saint_GL_DECK_1_0.json','starter_02_saint_crusader_conqueror_GL_DECK_1_0.json','starter_03_elemental_lord_renegade_grand_ranger_GL_DECK_1_0.json','starter_04_grand_ranger_crusader_saint_GL_DECK_1_0.json','starter_05_conqueror_crusader_renegade_GL_DECK_1_0.json'];
for (const f of clean) assert.equal(files.includes(f),true,f+' should exist');
const decks=clean.map(f=>JSON.parse(fs.readFileSync(path.join(starterDir,f),'utf8')));
for (const d of decks){
  assert.equal(d.main_deck_count,50);
  assert.equal(d.legacy_deck_count,20);
  assert.equal(d.main_deck.reduce((a,r)=>a+r.quantity,0),50);
  assert.ok(Math.max(...d.main_deck.map(r=>r.quantity))<=2);
  assert.doesNotMatch(d.deck_name,/\(Basic\)|Mixed Starter|Hybrid Starter|Half-Hybrid|Paladin Center/);
  assert.ok(d.item_event_count>=10 && d.item_event_count<=12);
}
assert.equal(decks[2].default_formation.CENTER,'S1-THF-H001');
assert.equal(decks[4].default_formation.CENTER,'S1-WAR-H004');
for (const cid of ['S1-ARC-001','S1-ARC-010','S1-ARC-018','S1-ARC-H003','S1-ARC-L002','S1-THF-018']){
  assert.equal(fs.existsSync(path.join('runtime_thumbnail_assets','cards',cid+'.webp')),true,cid+' webp');
  assert.equal(fs.existsSync(path.join('runtime_thumbnail_assets','cards',cid+'.jpg')),true,cid+' jpg');
}

const audit=qaV099FullEngineAudit();
assert.ok(audit.healthPotionUsers.includes('LEFT'), 'Stunned hero should remain a legal Health Potion user/target in Discord PvP.');
assert.equal(audit.stunnedHpAfter,90);
assert.equal(audit.stunnedStillStunned,1);
assert.equal(audit.renegadePoisonBonus,1);
assert.equal(audit.roguePoisonBonus,1);
assert.equal(audit.renegadePassiveAttackBonus,10);
assert.equal(audit.marksmanSingleTargetAttackBonus,10);
assert.equal(audit.grandRangerSingleTargetAttackBonus,20);
assert.equal(audit.grandRangerAreaAttackBonus,0);
assert.equal(audit.nightshadeText,'Increase Poison status duration caused by this hero by 1 and increase all attack damage by 10.');
const tuning=qaS1B2PlaytestTuning091();
assert.equal(tuning.renegadePoisonBonus,1);
assert.equal(tuning.renegadePassiveAttackBonus,10);
console.log('[PASS] QA_RUNTIME_TEST', {version:VERSION, archer:'single-target only', starters:clean.length, audit});
