'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const runtime=require(path.join(root,'data/season1/cards.runtime.v0.16.0.json'));
const components=require(path.join(root,'data/season1/hero-components.runtime.v1.1.0.json'));
function load(file){const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);return c.window.GL_DECK_BUILDER_DATA;}
assert.equal(components.registry_hash,'f36f1cc83eb9845743176c3af71f7823125353eae73e832588e9d8b42c6818be');
assert.equal(components.racial_traits.length,6);assert.equal(components.class_abilities.length,16);assert.equal(components.hero_profiles.length,10);assert.equal(components.hero_compositions.length,30);
for(const rel of ['js/data.js','style-2/js/data.js']){const d=load(rel);assert.equal(d.heroComponentRegistryHash,components.registry_hash);assert.equal(d.heroComponents.registry_hash,components.registry_hash);assert.equal(d.sourceStack.canonicalCardAuthority,'1.6.0');assert.equal(d.sourceStack.sharedRuntime,'1.94.0');assert.equal(d.sourceStack.effectRecipe,'0.15.0');assert.equal(d.sourceStack.effectCheckpoint,'0.15.0');assert.equal(d.sourceStack.starter60,'1.6.0');assert.equal(d.sourceStack.sourceAuthority,'1.9.1');assert.equal(d.sourceStack.applicationRuntimeSync,'2.59');}
const lock=require(path.join(root,'SOURCE_LOCK_v3.20.json'));assert.equal(lock.status,'ACTIVE');assert.equal(lock.public_package_version,'1.31');assert.equal(lock.canonical_registry_hash,runtime.canonical_registry_hash);assert.equal(lock.hero_component_registry_hash,components.registry_hash);
assert(fs.readdirSync(root).filter(x=>/^SOURCE_LOCK_v.*\.json$/.test(x)).length===1,'more than one active root source lock');
assert(fs.readdirSync(path.join(root,'style-2')).filter(x=>/^SOURCE_LOCK_v.*\.json$/.test(x)).length===1,'more than one active Style 2 source lock');
console.log('PASS Deck Builder v1.31 current authority/source-lock parity');
