"use client";

import { useState } from "react";
import { savingsProjects, savingsTravelTopics, seasonalSavingsProject, type SavingsProject, type SavingsTravelTopic } from "@/domain/phase2/savings-goals";

export function GoalProjectFields({ initialProject, initialTopic, initialSeason, year }: {
  initialProject?: SavingsProject; initialTopic?: SavingsTravelTopic | null; initialSeason?: number | null; year: number;
}) {
  const [project, setProject] = useState(initialProject ?? "other");
  return <>
    <label>Projet<select name="project" value={project} onChange={event => setProject(event.currentTarget.value as SavingsProject)}>
      {Object.entries(savingsProjects).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {project === "travel" && <label>Poste du voyage<select name="travelTopic" defaultValue={initialTopic ?? "other"}>
      {Object.entries(savingsTravelTopics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>}
    {seasonalSavingsProject(project) && <label>Année du projet<input name="season" type="number" min={2000} max={2099}
      placeholder={String(year)} defaultValue={initialSeason ?? ""} /></label>}
  </>;
}
