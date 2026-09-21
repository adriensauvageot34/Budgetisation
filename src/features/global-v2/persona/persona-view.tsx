import type { GlobalExpandedReadModel } from "@/query-api/global-v2";
import { buildPersonaPresentationModel, orderPersonaPresentationProfiles } from "./persona-presentation";
import { PersonaCard } from "./persona-card";
import styles from "../global-v2.module.css";

export function PersonaView({ model, headingId }: { readonly model: GlobalExpandedReadModel; readonly headingId: string }) {
  const presentation = buildPersonaPresentationModel(model);
  const profiles = orderPersonaPresentationProfiles(presentation.profiles).slice(0, 2);
  return <div className={styles.personaView}>
    <header className={styles.personaModuleHeader}>
      <div><span className="eyebrow">Nos profils</span><h2 id={headingId}>Deux quotidiens, deux façons de dépenser.</h2><p>Deux portraits personnels présentés côte à côte, sans classement ni mise en concurrence.</p></div>
      <div className={styles.personaScopeSwitch} role="group" aria-label="Périmètre affiché"><span aria-current="page">Adrien + Manon</span><span>♡ Nous deux</span></div>
    </header>
    <div className={styles.personaColumns} data-column-count={profiles.length}>
      {profiles.map((profile, index) => {
        const personHeadingId = `persona-person-${index + 1}`;
        return <section key={profile.personId} className={styles.personaColumn} aria-labelledby={personHeadingId}>
          <header className={styles.personaPersonHeader}><span>Portrait personnel</span><h3 id={personHeadingId}>{profile.displayName ?? "Profil personnel"}</h3></header>
          <div className={styles.personaCards}>{profile.cards.map((card) => <PersonaCard key={card.traitId} card={card} />)}</div>
        </section>;
      })}
    </div>
  </div>;
}
