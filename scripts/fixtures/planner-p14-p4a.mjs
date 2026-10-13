import {simpleMonth,nightMonth,weekendMonth,context,night,stay,component,selections} from './planner-headless.mjs';
export function p4Fixture(){const f=simpleMonth();
  f.semantic.contexts=[...nightMonth().semantic.contexts,...weekendMonth().semantic.contexts,
    context(6101,'family-visit',{}, {label:'Visite famille'}),night(6102,'15.00',{extras:selections(component('extra','2.00','p4-start-extra'))})];
  const family=f.semantic.contexts.find(c=>c.templateKey==='family-visit');delete family.fields.plannedDate;
  f.semantic.preferences.flexibility[f.semantic.contexts.find(c=>c.templateKey==='night-out').contextOccurrenceId]='PRESERVE';
  return f;
}
export function p4Extra(n){const i=80000+n;
  const c=n%3===0?stay(i,'50.00'):n%3===1?night(i,'12.00',{extras:selections(component('extra','3.00',`p4-extra-${n}`))}):context(i,'family-visit',{},{});
  c.fields.label=`${c.templateKey==='night-out'?'Soirée':c.templateKey==='short-stay'?'Séjour':'Visite'} ${n}`;
  if(n%2)delete c.fields.plannedDate;return c;
}
