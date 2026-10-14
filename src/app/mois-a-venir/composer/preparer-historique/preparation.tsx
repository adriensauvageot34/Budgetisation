"use client";
import { useState } from "react";
export function HistoryPreparation({month,securityChecks}: {month:string;securityChecks:boolean}) {
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(""),[proof,setProof]=useState<unknown>(null);
  async function prepare() {
    if (busy) return;
    setBusy(true);setStatus("Préparation en cours…");setProof(null);
    try {
      const response = await fetch("/api/composer/activity-history", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({month})});
      const result = await response.json();
      if (!response.ok) throw new Error("Préparation indisponible. Aucune donnée financière n’a été modifiée.");
      setProof(result);setStatus(result.status === "STALE_REJECTED" ? "L’historique a changé pendant la préparation. Réessayez lorsque la mise à jour est terminée." : "Historique préparé et publication relue.");
    } catch { setStatus("Préparation non confirmée. Aucune nouvelle écriture n’est relancée automatiquement."); }
    finally {setBusy(false);}
  }
  async function inspect() {
    if (busy) return;
    setBusy(true);setProof(null);
    try {
      const response=await fetch(`/api/composer/activity-history?month=${month}${securityChecks?'&checks=1':''}`);
      const result=await response.json();
      if (!response.ok) throw new Error();
      setProof(result);setStatus(result.status==='READY'?'Historique disponible et relu.':'Historique à préparer ; Composer utilise la lecture directe.');
    } catch {setStatus('Disponibilité non confirmée.');}
    finally {setBusy(false);}
  }
  return <><button type="button" disabled={busy} onClick={prepare}>Préparer l’historique</button>
    <button type="button" disabled={busy} onClick={inspect}>Vérifier disponibilité</button>
    <p role="status">{status}</p><output hidden data-snap-publication={proof ? JSON.stringify(proof):undefined}/>
    <p><a href={`/mois-a-venir/composer?month=${month}`}>Ouvrir Composer</a></p></>;
}
