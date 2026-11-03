import{startRootRelationNativeHost}from'./lib/root-relation-native-host.mjs';
const host=await startRootRelationNativeHost({port:3131,build:true});
console.log(JSON.stringify({origin:host.origin,database:host.fixture.database,syntheticOnly:true,remoteConnections:0}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await host.close();process.exit(0);});
