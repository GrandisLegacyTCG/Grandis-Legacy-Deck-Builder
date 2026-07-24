import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function verifyRuntimeSyncOrThrow(baseDir){
 const lockPath=join(baseDir,'sync/runtime-sync-lock.v2.23.json'); if(!existsSync(lockPath))throw new Error('Runtime sync lock v2.23 missing.');
 const lock=JSON.parse(readFileSync(lockPath,'utf8')); const errors=[];
 if(lock.version!=='v2.23'||lock.policy!=='RUNTIME_FIRST_FAIL_CLOSED_SYNC')errors.push('lock-version');
 for(const item of lock.runtimeFiles||[]){const p=join(baseDir,item.path);if(!existsSync(p))errors.push(item.path+':missing');else if(sha(p)!==item.sha256)errors.push(item.path+':hash');}
 const pkg=JSON.parse(readFileSync(join(baseDir,'package.json'),'utf8'));const stack=pkg.grandisLegacySourceStack||{};
 for(const [k,v] of Object.entries(lock.requiredSourceStack||{}))if(String(stack[k]||'')!==String(v))errors.push('sourceStack.'+k);
 const index=readFileSync(join(baseDir,'public/index.html'),'utf8');const network=readFileSync(join(baseDir,'public/js/pvp-network.js'),'utf8');const bundle=readFileSync(join(baseDir,'public/js/app.bundle.js'),'utf8');
 if(!index.includes('window.GL_APP_MODE="PVP"'))errors.push('pvp-mode');
 if(!network.includes('gl-pvp-v259-lobby-theme')||!network.includes("url('assets/Background.png')"))errors.push('lobby-theme');
 if(!bundle.includes('Grandis Legacy PvP v2.5.16'))errors.push('shared-bundle-version');
 if(errors.length)throw new Error('Runtime sync startup gate failed: '+errors.join(', '));
 return {ok:true,version:lock.version,policy:lock.policy,verifiedFiles:(lock.runtimeFiles||[]).length,authorityVerified:true,legacyBridgeSynchronized:true,fullIntentOnlyMigrationComplete:false};
}
if(process.argv.includes('--self-test')){const base=join(here,'..');console.log(JSON.stringify(verifyRuntimeSyncOrThrow(base),null,2));}
