import {notFound,redirect} from 'next/navigation';
import {BootstrapAuthenticationRequiredError} from '@/server/bootstrap/errors';
import {barReceptionEnabled,barReceptionScope} from '@/server/recette/bar-favorites';
import {handleComposerRequest} from '@/server/phase2/planner/composer-service';
import {BarFavoritesReception} from './reception';
import {BarDockReception} from './dock-reception';
import {barGeometryReceptionEnabled} from '@/server/recette/bar-reception-gate';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{r5catalog?:string}>}){
  if(!barReceptionEnabled())notFound();
  try{
    const scope=await barReceptionScope();
    const initial=await handleComposerRequest(scope.deps,scope.householdId,{kind:'READ',sequence:0,targetMonth:'2026-11'});
    if(!initial.ok)throw new TypeError('BAR_RECEPTION_OPENING_UNAVAILABLE');
    const search=await searchParams;
    if(search.r5catalog){
      if(!['25','120','150'].includes(search.r5catalog))notFound();
      const seeded=await handleComposerRequest(scope.deps,scope.householdId,{kind:'DROP',sequence:1,targetMonth:'2026-11',draft:initial.model.semanticState,assetKey:'template:night-out',presetKey:'bar-apero',identity:crypto.randomUUID(),selectionId:crypto.randomUUID(),target:{kind:'BOARD_ZONE'},values:{}});
      if(!seeded.ok)throw new TypeError('BAR_RECEPTION_FIXTURE_UNAVAILABLE');
      return <BarDockReception model={seeded.model} count={Number(search.r5catalog) as 25|120|150}/>;
    }
    return <><p role="note">{barGeometryReceptionEnabled()?"Recette géométrie : connexion habituelle, Board synthétique en mémoire. Aucun enregistrement distant, favori ou Apply.":"Recette isolée : Auth et favoris Supabase réels. Composer en mémoire, faits financiers synthétiques. Apply interdit. Les sorties de cette recette ne sont pas sauvegardées."}</p><div style={{height:'calc(100dvh - 180px)',minWidth:1100}}><BarFavoritesReception model={initial.model}/></div></>;
  }catch(e){if(e instanceof BootstrapAuthenticationRequiredError)redirect('/connexion?retour=%2Frecette%2Fbar-favoris');throw e;}
}
