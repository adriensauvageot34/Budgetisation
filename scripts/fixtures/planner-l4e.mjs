import {p10Month} from './planner-p10.mjs';
import {context} from './planner-headless.mjs';
/** Synthetic dense Boards only. Financial owners and provider data remain fixture-owned. */
export function l4eMonth(count) {
  if (![5,16,30,50].includes(count)) throw Error('L4E_DENSITY_NOT_ADMITTED');
  const f=p10Month();
  f.semantic.contexts=Array.from({length:count},(_,i)=>context(96000+i,'night-out',{},i===Math.floor(count/2)
    ? {label:'Bar / Apéro',composerPresentation:{version:'composer-context-presentation@v1',presetKey:'bar-apero'}}
    : {label:`Soirée fixture ${i+1}`}));
  return f;
}
