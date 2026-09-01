'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const RUNTIME_PATH=path.join(ROOT,'data/season1/cards.runtime.v0.14.2.json');
const runtime=JSON.parse(fs.readFileSync(RUNTIME_PATH,'utf8'));
const canonicalById=new Map(runtime.cards.map(card=>[card.card_id,card]));

if(runtime.count!==198||canonicalById.size!==198){
  throw new Error(`Canonical Season 1 registry must contain exactly 198 unique cards (found ${canonicalById.size}).`);
}
if(runtime.canonical_registry_hash!=='5d362f3c1dd785af82f12297d6ab1ecea4f6c43508a7b0f48319e846dd61139c'){
  throw new Error('Unexpected canonical Season 1 registry hash.');
}
if(runtime.hero_component_registry_hash!=='487aa2620b5be99480a81d462082f1a35ee637ec2cc38ebf42b1bcf1103d06c9'){
  throw new Error('Unexpected Hero Component registry hash.');
}

function readBuilderData(relativePath){
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT,relativePath),'utf8'),context,{filename:relativePath});
  if(!context.window.GL_DECK_BUILDER_DATA)throw new Error(`Missing GL_DECK_BUILDER_DATA in ${relativePath}`);
  return context.window.GL_DECK_BUILDER_DATA;
}

function asList(value){
  if(Array.isArray(value))return value.slice();
  return String(value||'').split(';').map(item=>item.trim()).filter(Boolean);
}

function canonicalRows(card){
  const rows=card.printed?.rows||card.printed?.blocks||[];
  return rows.map((row,index)=>({
    row_id:row.row_id||`row_${index+1}`,
    label:row.label||'Effect',
    damage_text:'',
    effect_text:row.text||'',
    text:row.text||''
  }));
}

function updateCard(current){
  const card=canonicalById.get(current.id);
  if(!card)throw new Error(`Builder card ${current.id} is missing from canonical registry.`);
  const next={
    ...current,
    name:card.name,
    family:card.family,
    classification:card.classification,
    classGroup:card.display_class||card.identity?.display_class||current.classGroup,
    cost:card.cost_display||current.cost,
    text:card.card_text||card.effect_text||'',
    rows:canonicalRows(card),
    image:`https://grandislegacytcg.github.io/shared/season1/v1/cards/thumbs/${card.card_id}.webp`,
    canonicalHash:card.canonical_hash,
    maxCopies:card.is_ultimate===true?1:3
  };

  const legal=asList(card.source_requirement?.legal_active_classes||card.legal_active_classes);
  if(legal.length)next.legalActiveClasses=legal;
  if(typeof card.is_ultimate==='boolean'){
    next.ultimate={...(current.ultimate||{}),isUltimate:card.is_ultimate};
  }

  if(card.family==='Hero'){
    const identity=card.identity||{};
    next.rank=card.rank_numeric;
    next.rankNumeric=card.rank_numeric;
    next.hp=card.hp;
    next.race=card.race||identity.race;
    next.classGroup=identity.display_class||card.display_class||current.classGroup;
    next.meta=[next.classGroup,`Rank ${card.rank_numeric}`,next.race,`${card.hp} HP`];
    next.activeClassLineage=asList(identity.active_class_lineage||card.active_class_lineage);
    next.baseSkillClasses=asList(identity.base_skill_classes||card.base_skill_classes);
    next.rankIBaseClass=identity.rank_i_base_class||card.base_class_family||current.rankIBaseClass;
    next.fixedClassLineageId=identity.fixed_class_lineage_id||current.fixedClassLineageId;
    next.heroComponents=card.hero_components;
    next.racialAbility=card.racial_ability;
    next.classAbility=card.class_ability||null;
  }
  return next;
}

function updateStarter(starter){
  const next=JSON.parse(JSON.stringify(starter));
  for(const key of ['main_deck','legacy_deck_expanded','side_deck_expanded']){
    if(!Array.isArray(next[key]))continue;
    for(const entry of next[key]){
      const card=canonicalById.get(entry.card_id);
      if(card)entry.card_name=card.name;
    }
  }
  next.builder_version='1.25-public-deck-builder';
  next.format='One Source Authority v1.7.3 + Starter60 v1.4';
  next.source_database_version=`Grandis Legacy Source Authority Stack v1.7.3 · OSA v1.7.3 · Runtime Data v0.14.2 · registry ${runtime.canonical_registry_hash}`;
  next.builder_version_note='Deck Builder v1.25 allows up to 3 copies of each normal Main Deck card while Ultimate cards remain maximum 1 copy. Starter60 v1.4 and Source Stack v1.7.3 authority are preserved.';
  return next;
}

function build(relativePath,builderVersion){
  const previous=readBuilderData(relativePath);
  const all=[...(previous.mainCards||[]),...(previous.legacyCards||[])];
  if(all.length!==198||new Set(all.map(card=>card.id)).size!==198){
    throw new Error(`${relativePath} must contain exactly 198 unique card IDs before regeneration.`);
  }
  const data={
    ...previous,
    schemaVersion:'GL-DECK-BUILDER-DATA-1.1',
    builderVersion,
    sourceDatabaseVersion:`Grandis Legacy Source Authority Stack v1.7.3 · OSA v1.7.3 · Runtime Data v0.14.2 · registry ${runtime.canonical_registry_hash}`,
    canonicalRegistryHash:runtime.canonical_registry_hash,
    heroComponentRegistryHash:runtime.hero_component_registry_hash,
    sourceStack:{
      oneSourceAuthority:'1.7.3',
      runtimeFoundation:'1.89',
      runtimeCoreTemplate:'0.57',
      runtimeData:'0.14.2',
      effectRecipe:'0.13.2',
      effectCheckpoint:'0.13.2',
      legalityMap:'0.11.9',
      applicationRuntimeSync:'2.51',
      heroComponentAuthority:'1.0.0'
    },
    heroComponents:runtime.hero_components,
    mainCards:(previous.mainCards||[]).map(updateCard),
    legacyCards:(previous.legacyCards||[]).map(updateCard),
    starters:fs.readdirSync(path.join(ROOT,'starter_deck_examples')).filter(file=>/^Starter_[1-5]_.*\.json$/i.test(file)).sort().map(file=>updateStarter(JSON.parse(fs.readFileSync(path.join(ROOT,'starter_deck_examples',file),'utf8'))))
  };
  fs.writeFileSync(path.join(ROOT,relativePath),`window.GL_DECK_BUILDER_DATA = ${JSON.stringify(data)};\n`);
}

build('js/data.js','3.22-public-deck-builder');
build('style-2/js/data.js','2.24-classic-split');
for(const name of fs.readdirSync(path.join(ROOT,'starter_deck_examples')).filter(file=>file.endsWith('.json'))){
  const target=path.join(ROOT,'starter_deck_examples',name);
  const starter=updateStarter(JSON.parse(fs.readFileSync(target,'utf8')));
  fs.writeFileSync(target,`${JSON.stringify(starter,null,2)}\n`);
}
console.log(`Built Deck Builder data from ${runtime.count} canonical cards.`);
