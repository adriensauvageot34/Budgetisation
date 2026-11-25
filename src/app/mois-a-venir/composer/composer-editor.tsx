"use client";

import dynamic from "next/dynamic";

export const ComposerEditor = dynamic(() => import("./composer-shell").then(module => module.ComposerShell), {
  loading: () => <p role="status">Ouverture de l’éditeur…</p>,
});
