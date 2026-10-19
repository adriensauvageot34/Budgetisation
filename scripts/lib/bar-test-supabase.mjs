/** Official CLI credentials in memory only. Strictly the separately approved $0 test project. */
import {spawnSync} from 'node:child_process';
export const BAR_TEST_PROJECT='wlndjknwbceaqrqcwbqw';
export const BAR_TEST_URL=`https://${BAR_TEST_PROJECT}.supabase.co`;
export function barTestKeys(){
 const binary=process.env.BAR_TEST_SUPABASE_CLI;
 if(!binary)throw Error('BAR_TEST_OFFICIAL_CLI_REQUIRED');
 const r=spawnSync(binary,['projects','api-keys','--project-ref',BAR_TEST_PROJECT,'--reveal','--output','json'],{encoding:'utf8',timeout:30000,windowsHide:true});
 let keys;try{keys=JSON.parse(r.stdout);}catch{throw Error('BAR_TEST_CLI_CREDENTIALS_UNAVAILABLE');}
 if(r.status!==0||!Array.isArray(keys))throw Error('BAR_TEST_CLI_CREDENTIALS_UNAVAILABLE');
 const secret=keys.find(k=>k.type==='secret')?.api_key??keys.find(k=>k.name==='service_role')?.api_key;
 const publishable=keys.find(k=>k.type==='publishable')?.api_key??keys.find(k=>k.name==='anon')?.api_key;
 if(!secret||!publishable)throw Error('BAR_TEST_KEYS_MISSING');
 return {secret,publishable};
}
