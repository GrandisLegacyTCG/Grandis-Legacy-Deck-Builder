'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const RUNTIME_PATH=path.join(ROOT,'data/season1/cards.runtime.v0.16.0.json');
const ACTIVE_STARTER_MANIFEST_PATH=path.join(ROOT,'data/starter-decks/ACTIVE_STARTERS_v1.6.0.json');
const ACTIVE_STARTER_DIR=path.join(ROOT,'data/starter-decks/active');
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

function loadActiveStarters(){
  const manifest=JSON.parse(fs.readFileSync(ACTIVE_STARTER_MANIFEST_PATH,'utf8'));
  if(manifest.osa_version!=='v1.9.1'||manifest.authority_version!=='v1.6.0'||manifest.active_starter_count!==5||!Array.isArray(manifest.starters)||manifest.starters.length!==5){
    throw new Error('Active Starter Deck manifest must be OSA v1.9.1 / Starter Authority v1.6.0 with exactly five starters.');
  }
  const seenIds=new Set();
  return manifest.starters.slice().sort((a,b)=>a.slot-b.slot).map(entry=>{
    const filename=`${entry.starter_id}_GL_DECK_1_0.json`;
    const file=path.join(ACTIVE_STARTER_DIR,filename);
    if(!fs.existsSync(file))throw new Error(`Missing active OSA starter source: ${filename}`);
    const starter=JSON.parse(fs.readFileSync(file,'utf8'));
    if(seenIds.has(entry.starter_id))throw new Error(`Duplicate active starter id: ${entry.starter_id}`);
    seenIds.add(entry.starter_id);
    const total=(starter.main_deck||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0);
    if(total!==60||Number(starter.main_deck_count)!==60)throw new Error(`${filename} must contain exactly 60 Main Deck cards.`);
    for(const item of starter.main_deck||[]){if(!canonicalById.has(item.card_id))throw new Error(`${filename}: unknown Main Deck card ${item.card_id}`);}
    for(const item of [...(starter.legacy_deck_expanded||[]),...(starter.side_deck_expanded||[])]){if(!canonicalById.has(item.card_id))throw new Error(`${filename}: unknown Hero/Legacy card ${item.card_id}`);}
    if(!String(starter.format||'').includes('v1.9.1')||!String(starter.format||'').includes('v1.6.0'))throw new Error(`${filename}: stale authority metadata`);
    return starter;
  });
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
    sourceDatabaseVersion:`Grandis Legacy Source Authority v1.9.1 · Starter Deck Authority v1.6.0 · Runtime Data v0.16.0 · Application Runtime Sync v2.59 · registry ${runtime.canonical_registry_hash}`,
    canonicalRegistryHash:runtime.canonical_registry_hash,
    heroComponentRegistryHash:runtime.hero_component_registry_hash,
    sourceStack:{
      sourceAuthority:'1.9.1',
      oneSourceAuthority:'1.9.1',
      canonicalCardAuthority:'1.6.0',
      sharedRuntime:'1.94.0',
      runtimeData:'0.16.0',
      effectRecipe:'0.15.0',
      effectCheckpoint:'0.15.0',
      starter60:'1.6.0',
      uiContract:'2.52',
      applicationRuntimeSync:'2.59',
      heroComponentAuthority:'1.1.0'
    },
    heroComponents:normalizeTermsDeep(runtime.hero_components),
    mainCards:all.filter(card=>{const c=canonicalById.get(card.id);return c&&c.family!=='LegacyModeDefinition'&&c.family!=='Hero';}).map(updateCard),
    legacyCards:(previous.legacyCards||[]).map(updateCard),
    starters:loadActiveStarters()
  };
  fs.writeFileSync(path.join(ROOT,relativePath),`window.GL_DECK_BUILDER_DATA = ${JSON.stringify(data)};\n`);
}

build('js/data.js','3.26-public-deck-builder');
build('style-2/js/data.js','2.27-classic-split');
console.log(`Built Deck Builder data from ${runtime.count} canonical cards.`);
