import type { Metadata } from "next";
import { CalendarClientPage } from "@/features/calendar";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarOverviewPage() {
  return <CalendarClientPage kind="overview" />;
}
