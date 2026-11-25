"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { JULY_COMPOSER_EDIT_HREF } from "@/domain/phase2/planner/realized-month-entry";

function warmEditor() {
  // Only preload code. The draft must be read when the editor is requested.
  void import("./composer-shell").catch(() => {});
}

export function JulyEditLink({ cardId, children, className }: {
  cardId?: string; children: ReactNode; className?: string;
}) {
  const href = cardId ? `${JULY_COMPOSER_EDIT_HREF}&carte=${encodeURIComponent(cardId)}` : JULY_COMPOSER_EDIT_HREF;
  return <Link href={href} className={className} prefetch={false} onPointerEnter={warmEditor} onFocus={warmEditor}>
    {children}
  </Link>;
}
