import type { GlobalExpandedReadModel } from "@/query-api/global-v2";
import { buildPersonaPresentationModel, type PersonaPresentationBlock, type PersonaPresentationProfile } from "./persona-presentation";
import { PersonaEditorialBlock, PersonaMarker } from "./persona-card";
import styles from "../global-v2.module.css";

type EditorialCollection = "dailyRhythms" | "recurringLife" | "phasedProjects";

function profileName(profile: PersonaPresentationProfile): string {
  return profile.displayName ?? "Profil personnel";
}

function PersonaPortraits({ profiles }: { readonly profiles: readonly PersonaPresentationProfile[] }) {
  return <section className={styles.personaPortraits} aria-labelledby="persona-portraits-title">
    <header className={styles.personaSectionHeading}><span>En un regard</span><h3 id="persona-portraits-title">Portraits express</h3></header>
    <div className={styles.personaEditorialColumns} data-column-count={profiles.length}>
      {profiles.map((profile, index) => {
        const titleId = `persona-portrait-${index + 1}`;
        return <article key={profile.personId} className={styles.personaPortrait} aria-labelledby={titleId}>
          <header className={styles.personaPersonHeader}><span>Portrait personnel</span><h4 id={titleId}>{profileName(profile)}</h4></header>
          {profile.markers.length === 0 ? null : <ul className={styles.personaMarkers}>{profile.markers.map((marker) => <PersonaMarker key={marker.traitId} marker={marker} />)}</ul>}
        </article>;
      })}
    </div>
  </section>;
}

function blocksFor(profile: PersonaPresentationProfile, collection: EditorialCollection): readonly PersonaPresentationBlock[] {
  return profile[collection];
}

function PersonaEditorialSection({ profiles, collection, eyebrow, title, personHeading, omitWhenEmpty = false }: {
  readonly profiles: readonly PersonaPresentationProfile[];
  readonly collection: EditorialCollection;
  readonly eyebrow: string;
  readonly title: string;
  readonly personHeading: (displayName: string) => string;
  readonly omitWhenEmpty?: boolean;
}) {
  const visibleProfiles = profiles.filter((profile) => blocksFor(profile, collection).length > 0);
  if (omitWhenEmpty && visibleProfiles.length === 0) return null;
  const titleId = `persona-section-${collection}`;
  return <section className={styles.personaEditorialSection} aria-labelledby={titleId} data-persona-section={collection}>
    <header className={styles.personaSectionHeading}><span>{eyebrow}</span><h3 id={titleId}>{title}</h3></header>
    <div className={styles.personaEditorialColumns} data-column-count={visibleProfiles.length} data-persona-layout={visibleProfiles.length === 1 ? "single" : "paired"}>
      {visibleProfiles.map((profile) => <section key={profile.personId} className={styles.personaEditorialColumn} data-persona-column={profiles.indexOf(profile) + 1} aria-label={personHeading(profileName(profile))}>
        <h4>{personHeading(profileName(profile))}</h4>
        <div className={styles.personaEditorialBlocks}>{blocksFor(profile, collection).map((block) => <PersonaEditorialBlock key={block.traitId} block={block} />)}</div>
      </section>)}
    </div>
  </section>;
}

export function PersonaView({ model, headingId }: { readonly model: GlobalExpandedReadModel; readonly headingId: string }) {
  const presentation = buildPersonaPresentationModel(model);
  const profiles = presentation.profiles.slice(0, 2);
  return <div className={styles.personaView}>
    <header className={styles.personaModuleHeader}>
      <div><span className="eyebrow">Portraits personnels</span><h2 id={headingId}>Nos profils</h2><p className={styles.personaHeroLead}>Deux quotidiens, deux façons de dépenser.</p></div>
      <div className={styles.personaScopeSwitch} role="group" aria-label="Périmètre affiché"><span aria-current="page">Adrien + Manon</span><span>♡ Nous deux</span></div>
    </header>
    <PersonaPortraits profiles={profiles} />
    <PersonaEditorialSection profiles={profiles} collection="dailyRhythms" eyebrow="Le quotidien" title="Vos rythmes du quotidien" personHeading={(name) => `Le rythme de ${name}`} />
    <PersonaEditorialSection profiles={profiles} collection="recurringLife" eyebrow="Les repères réguliers" title="Ce qui revient chez chacun" personHeading={(name) => `Chez ${name}`} omitWhenEmpty />
    <PersonaEditorialSection profiles={profiles} collection="phasedProjects" eyebrow="Les projets et évolutions" title="Ce qui vit par phases" personHeading={(name) => `Chez ${name}`} omitWhenEmpty />
  </div>;
}
