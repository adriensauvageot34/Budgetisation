import { redirect } from "next/navigation";

export const metadata = { title: "Analyse" };

export default function AnalysisPage() {
  redirect("/historique/analyse/global");
}
