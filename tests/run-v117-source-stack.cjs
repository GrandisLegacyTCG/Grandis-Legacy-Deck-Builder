'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

function loadBuilder(file){
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context.window.GL_DECK_BUILDER_DATA;
}

const runtime=JSON.parse(fs.readFileSync('data/season1/cards.runtime.v0.14.2.json','utf8'));
const components=JSON.parse(fs.readFileSync('data/season1/hero-components.runtime.v1.0.0.json','utf8'));
const canonical=new Map(runtime.cards.map(card=>[card.card_id,card]));

assert.equal(runtime.count,198);
assert.equal(canonical.size,198);
assert.equal(runtime.canonical_registry_hash,'5d362f3c1dd785af82f12297d6ab1ecea4f6c43508a7b0f48319e846dd61139c');
assert.equal(components.registry_hash,'487aa2620b5be99480a81d462082f1a35ee637ec2cc38ebf42b1bcf1103d06c9');

for(const file of ['js/data.js','style-2/js/data.js']){
  const data=loadBuilder(file);
  const cards=[...data.mainCards,...data.legacyCards];
  assert.equal(cards.length,198,`${file}: card count`);
  assert.equal(new Set(cards.map(card=>card.id)).size,198,`${file}: unique IDs`);
  assert.equal(data.canonicalRegistryHash,runtime.canonical_registry_hash,`${file}: canonical hash`);
  assert.equal(data.heroComponentRegistryHash,components.registry_hash,`${file}: Hero component hash`);
  assert.equal(data.heroComponents.racial_traits.length,6,`${file}: racial traits`);
  assert.equal(data.heroComponents.class_abilities.length,16,`${file}: class abilities`);
  assert.equal(data.heroComponents.hero_profiles.length,10,`${file}: Hero profiles`);
  assert.equal(data.heroComponents.hero_compositions.length,30,`${file}: Hero compositions`);
  for(const card of cards){
    const source=canonical.get(card.id);
    assert(source,`${file}: unknown ${card.id}`);
    assert.equal(card.name,source.name,`${file}: name ${card.id}`);
    assert.equal(card.cost,source.cost_display,`${file}: cost ${card.id}`);
    assert.equal(card.text,source.card_text,`${file}: text ${card.id}`);
    assert.equal(card.canonicalHash,source.canonical_hash,`${file}: hash ${card.id}`);
  }
  assert.equal(cards.find(card=>card.id==='S1-THF-010').name,'Back Slash');
  assert(!cards.some(card=>card.name==='Back Stab'));
  for(const starter of data.starters||[]){
    assert(!JSON.stringify(starter).includes('Back Stab'),`${file}: starter retains Back Stab`);
    assert(String(starter.format||'').includes('One Source Authority v1.7.3'),`${file}: starter format is stale`);
    assert(String(starter.source_database_version||'').includes(runtime.canonical_registry_hash),`${file}: starter registry is stale`);
  }
}

for(const name of fs.readdirSync('starter_deck_examples').filter(file=>file.endsWith('.json'))){
  const content=fs.readFileSync(`starter_deck_examples/${name}`,'utf8');
  assert(!content.includes('Back Stab'),`${name}: retired card name remains`);
  assert(!content.includes('One Source Authority v1.4'),`${name}: stale OSA marker remains`);
  assert(!content.includes('Starter60 v1.2'),`${name}: stale Starter60 marker remains`);
  const starter=JSON.parse(content);
  assert.equal(starter.builder_version,'1.23-public-deck-builder',`${name}: stale repository release metadata`);
  for(const field of ['main_deck','main_deck_expanded','legacy_deck_expanded','side_deck_expanded']){
    for(const entry of starter[field]||[]){
      const source=canonical.get(entry.card_id);
      if(source&&entry.card_name)assert.equal(entry.card_name,source.name,`${name}: ${entry.card_id} name mismatch`);
    }
  }
}

const compositionById=new Map(components.hero_compositions.map(hero=>[hero.card_id,hero]));
assert.equal(compositionById.get('S1-CLE-H001').racial_trait_ref,compositionById.get('S1-MAG-H001').racial_trait_ref);
assert.equal(compositionById.get('S1-MAG-H002').class_ability_ref,compositionById.get('S1-MAG-H005').class_ability_ref);
assert.equal(compositionById.get('S1-MAG-H003').class_ability_ref,compositionById.get('S1-MAG-H006').class_ability_ref);

const resurrection=canonical.get('S1-CLE-015');
assert.equal(resurrection.canonical_cost.mana,3);
assert.equal(resurrection.canonical_execution.revive_policy.set_hp,50);
assert.equal(resurrection.canonical_execution.revive.set_hp,50);
assert(!JSON.stringify(resurrection).includes('40 HP'));

console.log('PASS Deck Builder v1.23 corrected 198-card and Hero Component Source Stack parity');
