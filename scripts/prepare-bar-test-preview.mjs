/** Official CLIs; branch-scoped test credentials travel through stdin only. */
import {spawnSync} from 'node:child_process';
import {barTestKeys,BAR_TEST_PROJECT,BAR_TEST_URL} from './lib/bar-test-supabase.mjs';
import {readLiveProviderKeys} from './lib/bar-live-provider-keys.mjs';
await readLiveProviderKeys();
const cli=process.env.BAR_TEST_VERCEL_CLI;if(!cli)throw Error('VERCEL_CLI_REQUIRED');
const {secret,publishable}=barTestKeys();
const vars={NEXT_PUBLIC_SUPABASE_URL:BAR_TEST_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:publishable,SUPABASE_URL:BAR_TEST_URL,SUPABASE_SECRET_KEY:secret,
 BAR_PERSONAL_PLACES_ENABLED:'1',BAR_PERSONAL_PLACES_TRACE:'1',BAR_AUTH_RECEPTION_PROJECT:BAR_TEST_PROJECT,
 COMPOSER_DRAFT_AUTOSAVE_ENABLED:'false',COMPOSER_P14_SNAP3_HISTORICAL_BASIS:'0',COMPOSER_P14_SNAP1_ACTIVITY_HISTORY:'0',
 GOOGLE_MAPS_API_KEY:process.env.GOOGLE_MAPS_API_KEY,TOMTOM_API_KEY:process.env.TOMTOM_API_KEY,HERE_API_KEY:process.env.HERE_API_KEY};
for(const [name,value] of Object.entries(vars)){
 if(!value)throw Error('MISSING_PREVIEW_CONFIGURATION_'+name);
 const args=[cli,'env','add',name,'preview','--git-branch','codex/bar-apero-350-effective-closure','--project','prj_ahtV6haS1FmhhqvoRsN0R9Vf7ueQ','--scope','adriensauvageot34-6137s-projects','--type',name.startsWith('NEXT_PUBLIC_')||!name.endsWith('_KEY')?'config':'secret','--force','--yes'];
 const r=spawnSync(process.execPath,args,{input:value,encoding:'utf8',timeout:60000,windowsHide:true});
 if(r.status!==0)throw Error('PREVIEW_ENV_FAILED_'+name);
 console.log(name+' CONFIGURED_TEST_BRANCH_ONLY');
}
