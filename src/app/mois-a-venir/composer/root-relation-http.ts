import { ROOT_RELATION_HTTP_CONTRACT, type RootRelationTransport } from "@/domain/phase2/planner/root-relation-ui-contract";
export const rootRelationHttp: RootRelationTransport = async request => {
  const response = await fetch("/api/composer/root-relations", { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Composer-Root-Relation-Contract": ROOT_RELATION_HTTP_CONTRACT }, body: JSON.stringify(request) });
  if (response.headers.get("X-Composer-Root-Relation-Contract") !== ROOT_RELATION_HTTP_CONTRACT) throw new Error("N1_HTTP_CONTRACT_INVALID");
  return response.json();
};
export function rootRelationMessage(code: string) {
  if (/STALE|VERSION_CHANGED/.test(code)) return "La version du brouillon ou du Plan a changé. L’organisation locale reste ici ; aucune sauvegarde ni application n’a été lancée.";
  if (/PERMISSION|ACCESS|AUTHENTICATION/.test(code)) return "L’accès à cette organisation n’est pas autorisé. Les décisions locales sont conservées.";
  if (/PRESERVED/.test(code)) return "Cette activité est protégée. Son organisation ne peut pas être modifiée.";
  if (/MEMBER|SCOPE/.test(code)) return "Cette transition invaliderait un membre de la sortie. Détachez-le explicitement avant de le modifier.";
  return `Organisation refusée (${code}). Le brouillon et son historique sont conservés.`;
}
