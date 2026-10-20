import {notFound,redirect} from 'next/navigation';
import {BootstrapAuthenticationRequiredError} from '@/server/bootstrap/errors';
import {barReceptionEnabled,barReceptionScope} from '@/server/recette/bar-favorites';
import {handleComposerRequest} from '@/server/phase2/planner/composer-service';
import {BarFavoritesReception} from './reception';
import {BarDockReception} from './dock-reception';
import {barGeometryReceptionEnabled} from '@/server/recette/bar-reception-gate';
import {barClosedFixture} from '@/server/recette/bar-closed-fixture';
import {BarClosedWideReception} from './closed-wide';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{r5catalog?:string;r61?:string;r62?:string}>}){
  if(!barReceptionEnabled())notFound();
  try{
    const scope=await barReceptionScope();
    let initial=await handleComposerRequest(scope.deps,scope.householdId,{kind:'READ',sequence:0,targetMonth:'2026-11'});
    if(!initial.ok)throw new TypeError('BAR_RECEPTION_OPENING_UNAVAILABLE');
    const search=await searchParams;
    const geometry=barGeometryReceptionEnabled(),liveGoogle=geometry&&process.env.BAR_GEOMETRY_LIVE_GOOGLE==='1';
    const closedScenario=search.r62??search.r61;
    if(closedScenario){
      if(!geometry||!['empty','partial','rich','three','five','wide','long'].includes(closedScenario))notFound();
      const id=crypto.randomUUID();
      const seed=await handleComposerRequest(scope.deps,scope.householdId,{kind:'DROP',sequence:1,targetMonth:'2026-11',draft:initial.model.semanticState,assetKey:'template:night-out',presetKey:'bar-apero',identity:id,selectionId:crypto.randomUUID(),target:{kind:'BOARD_ZONE'},values:{}});
      if(!seed.ok)throw new TypeError('BAR_RECEPTION_FIXTURE_UNAVAILABLE');
      initial=await handleComposerRequest(scope.deps,scope.householdId,{kind:'READ',sequence:2,targetMonth:'2026-11',draft:barClosedFixture(seed.model.semanticState,id,(closedScenario==='wide'?'five':closedScenario) as Parameters<typeof barClosedFixture>[2])});
      if(!initial.ok)throw new TypeError('BAR_RECEPTION_FIXTURE_UNAVAILABLE');
      if(closedScenario==='wide')return <div data-bar-product-sha={process.env.VERCEL_GIT_COMMIT_SHA??'LOCAL_UNSTAMPED'}><BarClosedWideReception model={initial.model} id={id}/></div>;
    }
    if(search.r5catalog){
      if(!['25','120','150'].includes(search.r5catalog))notFound();
      const seeded=await handleComposerRequest(scope.deps,scope.householdId,{kind:'DROP',sequence:1,targetMonth:'2026-11',draft:initial.model.semanticState,assetKey:'template:night-out',presetKey:'bar-apero',identity:crypto.randomUUID(),selectionId:crypto.randomUUID(),target:{kind:'BOARD_ZONE'},values:{}});
      if(!seeded.ok)throw new TypeError('BAR_RECEPTION_FIXTURE_UNAVAILABLE');
      return <BarDockReception model={seeded.model} count={Number(search.r5catalog) as 25|120|150}/>;
    }
    return <div data-bar-product-sha={process.env.VERCEL_GIT_COMMIT_SHA??'LOCAL_UNSTAMPED'} data-bar-live-google={liveGoogle} style={{height:'100%',display:'flex',flexDirection:'column',minWidth:0}}><p role="note" style={{fontSize:11,margin:'0 0 6px',flexShrink:0}}>{geometry?liveGoogle?"Recette : connexion habituelle, Board synthétique en mémoire. Recherche Google réelle. Aucun enregistrement distant, favori ou Apply.":"Recette géométrie : connexion habituelle, Board synthétique en mémoire. Lieux simulés. Aucun enregistrement distant, favori ou Apply.":"Recette isolée : Auth et favoris Supabase réels. Composer en mémoire, faits financiers synthétiques. Apply interdit. Les sorties de cette recette ne sont pas sauvegardées."}</p><div style={{flex:1,minHeight:0,minWidth:0}}><BarFavoritesReception model={initial.model} geometry={geometry} liveGoogle={liveGoogle}/></div></div>;
  }catch(e){if(e instanceof BootstrapAuthenticationRequiredError)redirect('/connexion?retour=%2Frecette%2Fbar-favoris');throw e;}
}


