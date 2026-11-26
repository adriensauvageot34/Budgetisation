"use client";

import { useState } from "react";
import { savingsProjects, savingsTravelTopics, type SavingsProject, type SavingsTravelTopic } from "@/domain/phase2/savings-goals";

export function GoalProjectFields({ initialProject, initialTopic }: { initialProject?: SavingsProject; initialTopic?: SavingsTravelTopic | null }) {
  const [project, setProject] = useState(initialProject ?? "other");
  return <>
    <label>Projet<select name="project" value={project} onChange={event => setProject(event.currentTarget.value as SavingsProject)}>
      {Object.entries(savingsProjects).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {project === "travel" && <label>Poste du voyage<select name="travelTopic" defaultValue={initialTopic ?? "other"}>
      {Object.entries(savingsTravelTopics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>}
  </>;
}
