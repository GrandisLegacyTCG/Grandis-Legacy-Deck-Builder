'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const RUNTIME_PATH=path.join(ROOT,'data/season1/cards.runtime.v0.16.0.json');
const runtime=JSON.parse(fs.readFileSync(RUNTIME_PATH,'utf8'));
const canonicalById=new Map(runtime.cards.map(card=>[card.card_id,card]));

if(runtime.count!==200||canonicalById.size!==200){
  throw new Error(`Canonical Season 1 registry must contain exactly 200 unique cards (found ${canonicalById.size}).`);
}
if(runtime.canonical_registry_hash!=='85d25ebda9bb2bc260983a566e6d430dde97bfc7a32e8042ec2fddfeaff1b42f'){
  throw new Error('Unexpected canonical Season 1 registry hash.');
}
if(runtime.hero_component_registry_hash!=='f36f1cc83eb9845743176c3af71f7823125353eae73e832588e9d8b42c6818be'){
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

function normalizeTermsText(value){
  // Deck Builder is a consumer: preserve approved OSA display/printed wording verbatim.
  return String(value??'');
}
function normalizeTermsDeep(value){
  if(Array.isArray(value))return value.map(normalizeTermsDeep);
  if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=normalizeTermsDeep(v);return out;}
  return typeof value==='string'?normalizeTermsText(value):value;
}

function canonicalRows(card){
  const rows=card.printed?.rows||card.printed?.blocks||[];
  return rows.map((row,index)=>({
    row_id:row.row_id||`row_${index+1}`,
    label:row.label||'Effect',
    damage_text:'',
    effect_text:normalizeTermsText(row.text||''),
    text:normalizeTermsText(row.text||'')
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
    text:normalizeTermsText(card.card_text||card.effect_text||''),
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
    next.heroComponents=normalizeTermsDeep(card.hero_components);
    next.racialAbility=normalizeTermsDeep(card.racial_ability);
    next.classAbility=normalizeTermsDeep(card.class_ability||null);
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
  next.builder_version='1.31-public-deck-builder';
  next.format='Grandis Legacy Season 1 / OSA v1.9.0 / Starter60 v1.5 / 60-card Main Deck / max 3 normal / max 1 Ultimate';
  next.source_database_version=`Grandis Legacy Source Authority v1.9.0 · Runtime Data v0.16.0 · Application Runtime Sync v2.58 · registry ${runtime.canonical_registry_hash}`;
  next.builder_version_note='Deck Builder v1.31 consumes OSA v1.9.0 and Starter60 v1.5. Builder editing/export remains flexible; normal cards are maximum 3 copies and Ultimate cards maximum 1 copy. Official match legality is enforced by gameplay applications.';
  return next;
}

function build(relativePath,builderVersion){
  const previous=readBuilderData(relativePath);
  const all=[...(previous.mainCards||[]),...(previous.legacyCards||[])];
  if(new Set(all.map(card=>card.id)).size<198){
    throw new Error(`${relativePath} must contain the existing canonical card set before regeneration.`);
  }
  for(const card of runtime.cards){
    if(!all.some(current=>current.id===card.card_id)){
      all.push({id:card.card_id,requiredBaseClasses:[],legalActiveClasses:[],ultimate:{isUltimate:!!card.is_ultimate,owner:card.ultimate_owner||'',ownerLineageCardIds:[]}});
    }
  }
  const data={
    ...previous,
    schemaVersion:'GL-DECK-BUILDER-DATA-1.1',
    builderVersion,
    sourceDatabaseVersion:`Grandis Legacy Source Authority v1.9.0 · Runtime Data v0.16.0 · Application Runtime Sync v2.58 · registry ${runtime.canonical_registry_hash}`,
    canonicalRegistryHash:runtime.canonical_registry_hash,
    heroComponentRegistryHash:runtime.hero_component_registry_hash,
    sourceStack:{
      sourceAuthority:'1.9.0',
      oneSourceAuthority:'1.9.0',
      canonicalCardAuthority:'1.6.0',
      sharedRuntime:'1.94.0',
      runtimeData:'0.16.0',
      effectRecipe:'0.15.0',
      effectCheckpoint:'0.15.0',
      starter60:'1.5',
      uiContract:'2.52',
      applicationRuntimeSync:'2.58',
      heroComponentAuthority:'1.1.0'
    },
    heroComponents:normalizeTermsDeep(runtime.hero_components),
    mainCards:all.filter(card=>{const c=canonicalById.get(card.id);return c&&c.family!=='LegacyModeDefinition'&&c.family!=='Hero';}).map(updateCard),
    legacyCards:(previous.legacyCards||[]).map(updateCard),
    starters:fs.readdirSync(path.join(ROOT,'starter_deck_examples')).filter(file=>/^starter_.*_GL_DECK_1_0\.json$/i.test(file)).sort().map(file=>updateStarter(JSON.parse(fs.readFileSync(path.join(ROOT,'starter_deck_examples',file),'utf8'))))
  };
  fs.writeFileSync(path.join(ROOT,relativePath),`window.GL_DECK_BUILDER_DATA = ${JSON.stringify(data)};\n`);
}

build('js/data.js','3.26-public-deck-builder');
build('style-2/js/data.js','2.27-classic-split');
for(const name of fs.readdirSync(path.join(ROOT,'starter_deck_examples')).filter(file=>file.endsWith('.json'))){
  const target=path.join(ROOT,'starter_deck_examples',name);
  const starter=updateStarter(JSON.parse(fs.readFileSync(target,'utf8')));
  fs.writeFileSync(target,`${JSON.stringify(starter,null,2)}\n`);
}
console.log(`Built Deck Builder data from ${runtime.count} canonical cards.`);
