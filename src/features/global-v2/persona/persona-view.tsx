"use client";

import { useCallback, useMemo, useState } from "react";
import type { GlobalExpandedReadModel, PersonaOwnerDetailRef } from "@/query-api/global-v2";
import { useGlobalV2Resource } from "../use-global-resource";
import type { GlobalV2VisitRuntime } from "../visit-runtime";
import {
  buildPersonaPresentationModel,
  connectPersonaProfileDetailIndex,
  type PersonaPresentationBlock,
  type PersonaPresentationProfile,
} from "./persona-presentation";
import { personaDetailIndexRequest } from "./persona-detail-resolver";
import { PersonaDetailDrawer } from "./persona-detail-drawer";
import { PersonaEditorialBlock, PersonaMarker } from "./persona-card";
import styles from "../global-v2.module.css";

type EditorialCollection = "dailyRhythms" | "recurringLife" | "phasedProjects";
type OpenPersonaDetail = { readonly detailRef: PersonaOwnerDetailRef; readonly title: string };

const editorialSections: readonly {
  readonly collection: EditorialCollection;
  readonly eyebrow: string;
  readonly title: string;
}[] = Object.freeze([
  { collection: "dailyRhythms", eyebrow: "Le quotidien", title: "Ses rythmes du quotidien" },
  { collection: "recurringLife", eyebrow: "Les repères réguliers", title: "Ce qui revient" },
  { collection: "phasedProjects", eyebrow: "Les projets et évolutions", title: "Ce qui vit par phases" },
]);

function profileName(profile: PersonaPresentationProfile): string {
  return profile.displayName ?? "Profil personnel";
}

function PersonaProfileSection({ profile, collection, eyebrow, title, onDetail }: {
  readonly profile: PersonaPresentationProfile;
  readonly collection: EditorialCollection;
  readonly eyebrow: string;
  readonly title: string;
  readonly onDetail: (block: PersonaPresentationBlock) => void;
}) {
  const blocks = profile[collection];
  if (blocks.length === 0) return null;
  const titleId = `persona-${String(profile.personId)}-${collection}`;
  return <section className={styles.personaEditorialSection} aria-labelledby={titleId} data-persona-section={collection}>
    <header className={styles.personaSectionHeading}><span>{eyebrow}</span><h3 id={titleId}>{title}</h3></header>
    <div className={styles.personaEditorialBlocks}>{blocks.map((block) => <PersonaEditorialBlock key={block.traitId} block={block} onDetail={onDetail} />)}</div>
  </section>;
}

function PersonaProfileColumn({ profile, index, runtime, activePersonId, onDetail }: {
  readonly profile: PersonaPresentationProfile;
  readonly index: number;
  readonly runtime: GlobalV2VisitRuntime;
  readonly activePersonId: string | undefined;
  readonly onDetail: (block: PersonaPresentationBlock) => void;
}) {
  const request = useMemo(() => personaDetailIndexRequest(String(profile.personId)), [profile.personId]);
  const detailIndex = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, true, "BACKGROUND");
  const publishedDetailIndex = detailIndex.state.status === "READY" ? detailIndex.state.data.personaDetailIndex : undefined;
  const connectedProfile = useMemo(
    () => publishedDetailIndex === undefined ? profile : connectPersonaProfileDetailIndex(profile, publishedDetailIndex),
    [profile, publishedDetailIndex],
  );
  const name = profileName(connectedProfile);
  const titleId = `persona-portrait-${index + 1}`;
  return <article
    className={styles.personaProfileColumn}
    data-persona-column={index + 1}
    data-mobile-active={activePersonId === String(profile.personId)}
    aria-labelledby={titleId}
  >
    <header className={styles.personaPersonHeader}><span>Portrait personnel</span><h2 id={titleId}>{name}</h2></header>
    {connectedProfile.markers.length === 0 ? null : <section className={styles.personaPortrait} aria-label={`Les marqueurs de ${name}`}>
      <header className={styles.personaSectionHeading}><span>En un regard</span><h3>Portrait express</h3></header>
      <ul className={styles.personaMarkers}>{connectedProfile.markers.map((marker) => <PersonaMarker key={marker.traitId} marker={marker} />)}</ul>
    </section>}
    {editorialSections.map((section) => <PersonaProfileSection key={section.collection} profile={connectedProfile} {...section} onDetail={onDetail} />)}
  </article>;
}

export function PersonaView({ model, headingId, runtime }: {
  readonly model: GlobalExpandedReadModel;
  readonly headingId: string;
  readonly runtime: GlobalV2VisitRuntime;
}) {
  const presentation = useMemo(() => buildPersonaPresentationModel(model), [model]);
  const profiles = presentation.profiles.slice(0, 2);
  const [activePersonId, setActivePersonId] = useState<string | undefined>(() => profiles[0] === undefined ? undefined : String(profiles[0].personId));
  const [openDetail, setOpenDetail] = useState<OpenPersonaDetail | undefined>();
  const onDetail = useCallback((block: PersonaPresentationBlock) => {
    if (block.detailRef !== undefined) setOpenDetail({ detailRef: block.detailRef, title: block.title });
  }, []);
  const closeDetail = useCallback(() => setOpenDetail(undefined), []);

  return <div className={styles.personaView}>
    <header className={styles.personaModuleHeader}>
      <div><span className="eyebrow">Portraits personnels</span><h2 id={headingId}>Nos profils</h2><p className={styles.personaHeroLead}>Deux quotidiens, deux façons de dépenser.</p></div>
      <div className={styles.personaScopeSwitch} role="group" aria-label="Périmètre affiché"><span aria-current="page">Adrien + Manon</span><span>♡ Nous deux</span></div>
    </header>
    <nav className={styles.personaMobileSwitch} aria-label="Personne affichée sur mobile">
      {profiles.map((profile) => <button key={profile.personId} type="button" aria-pressed={activePersonId === String(profile.personId)} onClick={() => setActivePersonId(String(profile.personId))}>{profileName(profile)}</button>)}
    </nav>
    <section className={`${styles.personaEditorialColumns} ${styles.personaProfileColumns}`} aria-label="Portraits personnels en parallèle" data-column-count={profiles.length}>
      {profiles.map((profile, index) => <PersonaProfileColumn key={profile.personId} profile={profile} index={index} runtime={runtime} activePersonId={activePersonId} onDetail={onDetail} />)}
    </section>
    {openDetail === undefined ? null : <PersonaDetailDrawer runtime={runtime} detailRef={openDetail.detailRef} title={openDetail.title} onClose={closeDetail} />}
  </div>;
}
