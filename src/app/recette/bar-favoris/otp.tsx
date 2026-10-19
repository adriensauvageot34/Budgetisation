"use client";
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
/** Standard Supabase email OTP, issued only by the isolated test controller.
 * The hash is a URL fragment (never HTTP logs); no admin key enters the client.
 * This component is rendered only behind the server's exact Preview/project gate.
 */
export function BarReceptionOtp(){
  const [status,setStatus]=useState('Vérification de la session fictive…');
  useEffect(()=>{const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token_hash');
    history.replaceState(null,'','/connexion?bar-reception-otp=1');
    if(!token){setStatus('Lien à usage unique absent ou déjà utilisé.');return;}
    let cancelled=false;
    void createClient().auth.verifyOtp({token_hash:token,type:'email'}).then(({data,error})=>{
      if(cancelled)return;
      if(error||data.user?.app_metadata.bar_google_test!=='closure-20261019'){setStatus('Session de test non admise. Aucun accès accordé par la recette.');return;}
      location.replace('/recette/bar-favoris');
    }).catch(()=>{if(!cancelled)setStatus('Connexion non confirmée. Réouvrez le lien de test.');});
    return()=>{cancelled=true;};
  },[]);
  return <p role="status">{status}</p>;
}
