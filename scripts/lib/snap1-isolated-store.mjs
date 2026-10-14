import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {PGlite} from '@electric-sql/pglite';
import {require} from './phase2-ts-loader.mjs';
const {ACTIVITY_HISTORY_COVERAGE,ACTIVITY_HISTORY_DEPENDENCIES}=require('@/server/phase2/planner/activity-history-artifact');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const sourceTables=ACTIVITY_HISTORY_DEPENDENCIES.slice(0,4);
const schemaSQL=fs.readFileSync('scripts/fixtures/snap1-isolated.sql','utf8');
const bodyOf=name=>schemaSQL.match(new RegExp(`CREATE FUNCTION snap1_isolated\\.${name}\\(\\).*?AS \\$\\$(.*?)\\$\\$`,'s'))[1];
export async function isolatedStore(directory,{initialize=false,data,nativeTestDatabase}={}){
  // Optional explicitly supplied synthetic test connection; never a runtime adapter.
  const pg=nativeTestDatabase??new PGlite(directory),metrics={sqlReads:0,sourceReads:0,sourceBytes:0,inspectReads:0,inspectBytes:0,calls:[]};
  await pg.waitReady;
  if(initialize){
    await pg.exec(schemaSQL);
    await pg.query('INSERT INTO snap1_isolated.households(id,timezone,canonical) VALUES($1,$2,true)',[data.context.householdId,data.context.timezone]);
    for(const id of data.context.personIds)await pg.query('INSERT INTO snap1_isolated.persons VALUES($1,$2)',[id,data.context.householdId]);
    await pg.query('INSERT INTO snap1_isolated.memberships(user_id,household_id) VALUES($1,$2)',[data.context.userId,data.context.householdId]);
    for(const table of sourceTables)for(const [i,row]of data.tables[table].entries())
      await pg.query(`INSERT INTO snap1_isolated.${table} VALUES($1,$2)`,[String(i),JSON.stringify(row)]);
  }
  let noCoverage=false,networkFailure=false,cap=1000,beforeSource;
  const queryState=async(db,scope,key)=>{
    // One bounded statement / one snapshot: current permissions, versions, generation, payload.
    const {rows}=await db.query(`SELECT
      EXISTS(SELECT 1 FROM snap1_isolated.memberships m JOIN snap1_isolated.households h ON h.id=m.household_id
       WHERE m.user_id=$1 AND m.household_id=$2 AND m.active AND h.timezone=$3 AND h.canonical)
      AND (SELECT count(*) FROM snap1_isolated.households WHERE canonical)=1
      AND (SELECT array_agg(id ORDER BY id) FROM snap1_isolated.persons WHERE household_id=$2)=$4::text[] AS authorized,
      (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='snap1_isolated' AND t.tgname='snap1_version' AND t.tgenabled='A'
       AND t.tgtype=60 AND p.proname='bump_version' AND p.prosrc=$6 AND NOT p.prosecdef)=7
      AND EXISTS(SELECT 1 FROM pg_event_trigger t JOIN pg_proc p ON p.oid=t.evtfoid WHERE t.evtname='snap1_ddl_version'
       AND t.evtenabled='A' AND p.prosrc=$7 AND NOT p.prosecdef) AS writers_covered,
      (SELECT jsonb_object_agg(dependency,revision::text) FROM snap1_isolated.versions) AS revisions,
      (SELECT generation FROM snap1_isolated.artifacts WHERE scope_key=$5) AS generation,
      (SELECT artifact FROM snap1_isolated.artifacts WHERE scope_key=$5) AS artifact`,
      [scope.userId,scope.householdId,scope.timezone,scope.personIds,key,bodyOf('bump_version'),bodyOf('invalidate_ddl')]);
    if(!rows[0].authorized)throw TypeError('SNAP1_PERMISSION_DENIED');
    return {proof:noCoverage||!rows[0].writers_covered?null:{coverage:ACTIVITY_HISTORY_COVERAGE,revisions:rows[0].revisions},generation:Number(rows[0].generation??0),artifact:rows[0].artifact};
  };
  const store={async inspect(scope,key){
    if(networkFailure)throw Error('SNAP1_NETWORK_UNAVAILABLE');
    const at=performance.now(),state=await queryState(pg,scope,key);metrics.sqlReads++;metrics.inspectReads++;
    metrics.inspectBytes+=Buffer.byteLength(JSON.stringify(state));metrics.calls.push({table:'artifact+versions+authorization',ms:performance.now()-at});return state;
  },async publish(scope,key,generation,artifact){
    if(networkFailure)throw Error('SNAP1_NETWORK_UNAVAILABLE');
    return pg.transaction(async tx=>{
      await tx.exec("SET LOCAL lock_timeout='2s'");
      // Serializes against every source/authorization trigger and another publication.
      await tx.query('SELECT dependency FROM snap1_isolated.versions ORDER BY dependency FOR UPDATE');
      const current=await queryState(tx,scope,key);
      if(!current.proof||plannerDigest(current.proof)!==plannerDigest(artifact.proof)||current.generation!==generation||artifact.generation!==generation+1)return false;
      await tx.query(`INSERT INTO snap1_isolated.artifacts VALUES($1,$2,$3)
       ON CONFLICT(scope_key) DO UPDATE SET generation=excluded.generation,artifact=excluded.artifact`,[key,artifact.generation,JSON.stringify(artifact)]);
      return true;
    });
  }};
  const client={from(table){
    let selection='*',exact=false,filters=[],orders=[],offset=0,limit=Infinity;
    const chain={select:(s,o)=>(selection=s,exact=o?.count==='exact',chain),
      in:(c,v)=>(filters.push([c,'in',v]),chain),eq:(c,v)=>(filters.push([c,'=',v]),chain),
      gte:(c,v)=>(filters.push([c,'>=',v]),chain),lte:(c,v)=>(filters.push([c,'<=',v]),chain),lt:(c,v)=>(filters.push([c,'<',v]),chain),
      order:(c,o)=>(orders.push([c,o?.ascending!==false]),chain),range:(a,b)=>(offset=a,limit=b-a+1,chain),limit:n=>(limit=n,chain),
      then(resolve,reject){return(async()=>{
        const at=performance.now();await beforeSource?.(table);
        let rows,count;
        if(table==='canonical_household_scope_control'){
          const result=await pg.query('SELECT id FROM snap1_isolated.households WHERE canonical');
          rows=[{household_count:result.rows.length,household_id:result.rows[0]?.id??null,status:result.rows.length===1?'READY':'AMBIGUOUS'}];
        }else{
          if(!sourceTables.includes(table))throw Error('SNAP1_UNEXPECTED_TABLE_'+table);
          const params=[],bind=v=>(params.push(v),'$'+params.length),field=c=>`payload ->> ${bind(c)}`;
          const where=filters.map(([c,op,v])=>op==='in'?`${field(c)} = ANY(${bind(v)}::text[])`:`${field(c)} ${op} ${bind(String(v))}`);
          const ordering=orders.map(([c,asc])=>`${field(c)} ${asc?'ASC':'DESC'}`).join(',');
          const {rows:result}=await pg.query(`SELECT payload${exact?',count(*) OVER() AS total':''} FROM snap1_isolated.${table}
            ${where.length?'WHERE '+where.join(' AND '):''} ${ordering?'ORDER BY '+ordering:''} LIMIT ${Math.min(limit,cap)} OFFSET ${offset}`,params);
          rows=result.map(r=>r.payload);if(exact)count=Number(result[0]?.total??0);
        }
        if(selection!=='*')rows=rows.map(row=>Object.fromEntries(selection.split(',').map(s=>s.split('::')[0]).filter(c=>Object.hasOwn(row,c)).map(c=>[c,row[c]])));
        const bytes=Buffer.byteLength(JSON.stringify(rows));metrics.sqlReads++;metrics.sourceReads++;metrics.sourceBytes+=bytes;
        metrics.calls.push({table,selection,count:count??null,rows:rows.length,bytes,ms:performance.now()-at});
        return {data:rows,error:null,count:count??null};
      })().then(resolve,reject);}
    };return chain;
  }};
  let closed=false;
  return {pg,store,client,metrics,reset(){Object.assign(metrics,{sqlReads:0,sourceReads:0,sourceBytes:0,inspectReads:0,inspectBytes:0,calls:[]});},
    set options(v){if('cap'in v)cap=v.cap;if('noCoverage'in v)noCoverage=v.noCoverage;if('networkFailure'in v)networkFailure=v.networkFailure;if('beforeSource'in v)beforeSource=v.beforeSource;},
    close:async()=>{if(!closed){closed=true;await pg.close();}}};
}
