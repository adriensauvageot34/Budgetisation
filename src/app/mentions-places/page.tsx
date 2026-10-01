export const metadata = { title: "Recherche de lieux · Conditions et confidentialité" };
export default function PlacesNotice() {
  return <main className="mx-auto max-w-2xl space-y-5 px-6 py-12 text-sm leading-7 text-slate-700">
    <h1 className="text-2xl font-bold text-slate-900">Recherche de restaurants</h1>
    <p>Budgetisation utilise Google Maps Platform pour trouver le restaurant associé à votre projet et afficher ses informations et, si disponible, une photo. Les trajets et leurs coûts sont calculés séparément par les fournisseurs du moteur Transport.</p>
    <h2 className="text-lg font-bold">Données utilisées</h2>
    <p>La recherche transmet à Google le texte saisi, la ville choisie et un identifiant aléatoire de session. Une sélection transmet l’identifiant du lieu pour récupérer ses informations. Les montants, ressources du foyer et données bancaires ne sont pas transmis à Google Places. La ville peut être résolue par TomTom pour orienter la recherche ; l’adresse du restaurant est utilisée transitoirement par le moteur Transport pour calculer le trajet.</p>
    <p>Budgetisation conserve l’identifiant Google du lieu et votre intention de projet. Les suggestions, informations Google, coordonnées Google et liens des photos ne sont pas enregistrés dans la dépense. Ils sont rechargés lorsque nécessaire. Les photos sont affichées depuis le fournisseur, avec leurs attributions ; elles ne sont pas copiées dans le stockage Budgetisation.</p>
    <h2 className="text-lg font-bold">Conditions des fournisseurs</h2>
    <p>L’utilisation du contenu Google Maps est soumise aux <a className="underline" href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Conditions d’utilisation de Google Maps</a> et à la <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Politique de confidentialité de Google</a>. Vous pouvez utiliser la saisie manuelle si vous préférez ne pas rechercher avec Google.</p>
  </main>;
}
