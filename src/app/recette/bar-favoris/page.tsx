import {notFound,redirect} from 'next/navigation';
import {BootstrapAuthenticationRequiredError} from '@/server/bootstrap/errors';
import {barReceptionEnabled,barReceptionScope} from '@/server/recette/bar-favorites';
import {handleComposerRequest} from '@/server/phase2/planner/composer-service';
import {BarFavoritesReception} from './reception';
export const dynamic='force-dynamic';
export default async function Page(){
  if(!barReceptionEnabled())notFound();
  try{
    const scope=await barReceptionScope();
    const initial=await handleComposerRequest(scope.deps,scope.householdId,{kind:'READ',sequence:0,targetMonth:'2026-11'});
    if(!initial.ok)throw new TypeError('BAR_RECEPTION_OPENING_UNAVAILABLE');
    return <><p role="note">Recette isolée : Auth et favoris Supabase réels. Composer en mémoire, faits financiers synthétiques. Apply interdit. Les sorties de cette recette ne sont pas sauvegardées.</p><div style={{height:'calc(100dvh - 180px)',minWidth:1100}}><BarFavoritesReception model={initial.model}/></div></>;
  }catch(e){if(e instanceof BootstrapAuthenticationRequiredError)redirect('/connexion?retour=%2Frecette%2Fbar-favoris');throw e;}
}
