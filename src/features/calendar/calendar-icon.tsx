"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  Car,
  Circle,
  FileText,
  HeartPulse,
  House,
  Laptop,
  MapPin,
  PartyPopper,
  Plane,
  ShoppingBag,
  Sparkles,
  Theater,
  Users,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { CalendarMarkerKind } from "@/query-api";

const iconByKind: Readonly<Record<CalendarMarkerKind, LucideIcon>> = {
  work: BriefcaseBusiness,
  remote_work: Laptop,
  travel: Plane,
  driving: Car,
  health: HeartPulse,
  meal: Utensils,
  shopping: ShoppingBag,
  culture: Theater,
  family: Users,
  celebration: PartyPopper,
  administrative: FileText,
  home: House,
  place: MapPin,
  moment: Sparkles,
  activity: CalendarDays,
  finance: WalletCards,
  other: Circle,
};

export function CalendarIcon({ kind, className }: { readonly kind: CalendarMarkerKind; readonly className?: string }) {
  const Icon = iconByKind[kind];
  return <Icon aria-hidden="true" className={className} focusable="false" />;
}

