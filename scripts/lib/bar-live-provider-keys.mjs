/** Ephemeral server input, never a key file or a shell argument. */
export async function readLiveProviderKeys(){
 if(process.env.BAR_LIVE_KEYS_STDIN!=='1')return;
 const {createInterface}=await import('node:readline');
 if(!process.stdin.isTTY||!process.stdin.setRawMode)throw Error('CREDENTIAL_CHANNEL_REQUIRES_NON_ECHO_TTY');
 process.stdin.setRawMode(true);
 const input=createInterface({input:process.stdin,terminal:false});
 console.log('CREDENTIAL_CHANNEL_READY_NO_ECHO');
 try {
 const line=await new Promise((resolve,reject)=>{input.once('line',resolve);input.once('close',()=>reject(Error('CREDENTIAL_INPUT_MISSING')));});
 const values=JSON.parse(line);for(const key of ['GOOGLE_MAPS_API_KEY','TOMTOM_API_KEY','HERE_API_KEY']){
   if(typeof values[key]!=='string'||values[key].length<10||values[key].length>512)throw Error();process.env[key]=values[key];delete values[key];
 }}catch{throw Error('CREDENTIAL_INPUT_INVALID');}finally{input.close();process.stdin.setRawMode(false);process.stdin.pause();}
 if(process.env.BAR_LIVE_STDIN_CHECK_ONLY==='1'){console.log('CREDENTIAL_CHANNEL_CHECK_PASS_VALUES_NOT_PRINTED');process.exit(0);}
}
