// Converts a private, read-only PostgREST predicate inventory to EXPLAIN requests.
// Output includes private IDs; keep it OUTSIDE the repository.
import fs from 'node:fs';
import path from 'node:path';
const [directory,output,mode='family']=process.argv.slice(2);
if(!directory||!output||path.resolve(output).startsWith(path.resolve(process.cwd())))throw new Error('Private external output required');
const files=fs.readdirSync(directory),events=files.filter(f=>/^server-.*jsonl$/.test(f)).flatMap(f=>fs.readFileSync(path.join(directory,f),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse));
const queries=files.filter(f=>/^private-queries-.*jsonl$/.test(f)).flatMap(f=>fs.readFileSync(path.join(directory,f),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse));
const groups={};for(const event of events.filter(e=>e.type==='fetch'&&e.business)){
 const key=mode==='all'?event.exact:event.path;const group=groups[key]??={table:event.path.slice('/rest/v1/'.length),count:0,total:0,max:0,exact:event.exact};group.count++;group.total+=event.headerDuration??0;
 if((event.headerDuration??0)>group.max){group.max=event.headerDuration;group.exact=event.exact;}
}
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const identifier=value=>{if(!/^[A-Za-z_]\w*$/.test(value))throw new Error('UNSUPPORTED_IDENTIFIER');return '"'+value+'"';};
const requests=[];
for(const group of Object.values(groups).sort((a,b)=>b.total-a.total)){
 const q=queries.find(q=>q.exact===group.exact);if(!q)continue;
 try{
  const parameters=new Map(q.parameters),select=parameters.get('select')??'*';
  const columns=select.split(',').map(raw=>{
   if(raw==='*')return '*';const alias=/^([\w]+):(?!:)(.*)$/.exec(raw),value=alias?alias[2]:raw;
   const match=/^(\w+)(?:::(text|numeric|integer))?$/.exec(value);if(!match)throw new Error('UNSUPPORTED_SELECT');
   return identifier(match[1])+(match[2]?'::'+match[2]:'')+(alias?' as '+identifier(alias[1]):'');
  }).join(',');
  const clauses=[];
  for(const [column,predicate]of q.parameters){
   if(['select','order','limit','offset'].includes(column))continue;
   const m=/^(eq|neq|gte|gt|lte|lt|is|in)\.(.*)$/s.exec(predicate);if(!m)throw new Error('UNSUPPORTED_FILTER');
   const field=identifier(column),op=m[1],value=m[2];
   if(op==='in') {if(!/^\(.*\)$/.test(value))throw new Error('UNSUPPORTED_IN');const values=value.slice(1,-1).match(/"(?:[^"\\]|\\.)*"|[^,]+/g)??[];
    clauses.push(field+' in ('+values.map(v=>literal(v.startsWith('"')?JSON.parse(v):v)).join(',')+')');}
   else if(op==='is'&&value==='null')clauses.push(field+' is null');
   else if(op==='is'&&['true','false'].includes(value))clauses.push(field+' is '+value);
   else clauses.push(field+' '+({eq:'=',neq:'<>',gte:'>=',gt:'>',lte:'<=',lt:'<'}[op])+' '+literal(value));
  }
  const order=parameters.get('order')?.split(',').map(value=>{const m=/^(\w+)\.(asc|desc)(?:\.(nullsfirst|nullslast))?$/.exec(value);if(!m)throw new Error('UNSUPPORTED_ORDER');return identifier(m[1])+' '+m[2]+(m[3]?' nulls '+m[3].slice(5):'');}).join(',');
  const number=name=>{const value=parameters.get(name);if(value&&!/^\d+$/.test(value))throw new Error('UNSUPPORTED_LIMIT');return value?' '+name+' '+value:'';};
  const sql='EXPLAIN (FORMAT JSON, VERBOSE TRUE) SELECT '+columns+' FROM public.'+identifier(group.table)+(clauses.length?' WHERE '+clauses.join(' AND '):'')+(order?' ORDER BY '+order:'')+number('limit')+number('offset')+';';
  requests.push({...group,mean:group.total/group.count,sql});
 }catch(error){requests.push({...group,error:error.message});}
}
fs.writeFileSync(output,JSON.stringify(requests,null,2));console.log(JSON.stringify(requests.map(({table,count,total,max,error,sql})=>({table,count,total,max,error,sqlBytes:sql?.length})),null,2));
