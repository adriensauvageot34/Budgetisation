import assert from 'node:assert/strict';

/** Parameterized PostgREST-shaped transport to the actual synthetic tables and
 * unchanged migrations. This is PostgreSQL persistence, not a real Auth JWT. */
export function prospectivePostgres(pg) {
  const writes=[],reads=[];
  const tables=new Set(['phase2_planned_expenses','phase2_month_inputs']);
  const ident=value=>{assert.match(value,/^[a-z_]+$/);return value;};
  return {writes,reads,from(table){
    assert.ok(tables.has(table));
    let operation='read',payload,projection='*',conflict;
    const filters=[],orders=[];
    const query={
      select(value='*'){projection=value==='*'?'*':value.split(',').map(ident).join(',');return query;},
      eq(key,value){filters.push([ident(key),value]);return query;},
      order(key){orders.push(ident(key));return query;},
      insert(value){operation='insert';payload=value;return query;},
      update(value){operation='update';payload=value;return query;},
      delete(){operation='delete';return query;},
      upsert(value,options){operation='upsert';payload=value;conflict=options.onConflict.split(',').map(ident);return query;},
      async execute(){
        const params=[],bind=value=>{params.push(value!==null&&typeof value==='object'?JSON.stringify(value):value);return `$${params.length}`;};
        const columns=Object.keys(payload??{}).map(ident);
        let sql;
        if(operation==='insert'||operation==='upsert'){
          sql=`insert into public.${table} (${columns}) values (${columns.map(key=>bind(payload[key]))})`;
          if(conflict)sql+=` on conflict (${conflict}) do update set ${columns.filter(key=>!conflict.includes(key)).map(key=>`${key}=excluded.${key}`).join(',')}`;
        }else if(operation==='update')sql=`update public.${table} set ${columns.map(key=>`${key}=${bind(payload[key])}`).join(',')}`;
        else sql=`${operation==='delete'?'delete from':'select '+projection+' from'} public.${table}`;
        if(filters.length)sql+=` where ${filters.map(([key,value])=>`${key}=${bind(value)}`).join(' and ')}`;
        if(operation==='read'&&orders.length)sql+=` order by ${orders.join(',')}`;
        if(operation!=='read')sql+=` returning ${projection}`;
        try{
          const result=await pg.db.query(`with affected as (${sql}) select to_jsonb(affected) as row from affected`,params);
          (operation==='read'?reads:writes).push({table,operation,affected:result.rows.length});
          return {data:result.rows.map(value=>value.row),error:null};
        }catch(error){return {data:null,error:{code:error.code,message:error.message}};}
      },
      async maybeSingle(){const result=await query.execute();return {...result,data:result.data?.[0]??null};},
      async single(){const result=await query.maybeSingle();return result.data||result.error?result:{data:null,error:{code:'PGRST116'}};},
      then(resolve,reject){return query.execute().then(resolve,reject);}
    };return query;
  }};
}
