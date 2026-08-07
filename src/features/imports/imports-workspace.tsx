"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Info,
  Plus,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import type { ImportBatch } from "@/domain/budget";
import { formatMonth } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

const previewRows = [
  {
    date: "29/08/2026",
    label: "CARTE · MARCHÉ DES HALLES",
    amount: "- 73,40 €",
    category: "Alimentation",
    issue: null,
  },
  {
    date: "28/08/2026",
    label: "VIREMENT INTERNE · ÉPARGNE",
    amount: "- 150,00 €",
    category: "Transferts internes",
    issue: null,
  },
  {
    date: "27/08/2026",
    label: "CARTE · LIBELLÉ INCOMPLET",
    amount: "- 24,90 €",
    category: "Achats & maison ?",
    issue: "Classement incertain",
  },
  {
    date: "26/08/2026",
    label: "CARTE · CAFÉ DES QUAIS",
    amount: "- 4,20 €",
    category: "Alimentation",
    issue: "Doublon possible",
  },
];

export function ImportsWorkspace({ batches }: { batches: ImportBatch[] }) {
  const [previewOpen, setPreviewOpen] = useState(true);

  return (
    <div>
      <PageHeader
        eyebrow="Données"
        title="Imports"
        description="Prévisualisez un relevé, repérez les doublons et contrôlez les classements avant un futur enregistrement."
        action={
          <button
            type="button"
            className="button-primary"
            onClick={() => setPreviewOpen(true)}
          >
            <Plus size={17} />
            Nouvel import
          </button>
        }
      />

      <div className="mb-5 flex gap-3 rounded-[var(--radius-md)] border border-[#cfded8] bg-[#e9f1ee] p-4">
        <Info
          size={19}
          className="mt-0.5 shrink-0 text-[var(--color-primary)]"
        />
        <div>
          <p className="font-extrabold">Démonstration sans enregistrement</p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            La zone ci-dessous illustre le futur parcours d’import. Aucun fichier
            n’est transmis, analysé ou conservé dans cette version.
          </p>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="card p-4 sm:p-6">
          <div className="mb-5">
            <p className="eyebrow mb-2">Nouveau fichier</p>
            <h2 className="text-xl font-black">Déposer un relevé</h2>
          </div>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[#bfcac5] bg-[#fafaf7] px-6 text-center transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/35"
          >
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <UploadCloud size={26} />
            </span>
            <span className="font-black">Glissez un fichier Excel ou CSV</span>
            <span className="mt-2 text-sm text-[var(--color-muted)]">
              ou cliquez pour simuler une sélection
            </span>
            <span className="badge mt-4">Fichier fictif uniquement</span>
          </button>
          <button
            type="button"
            className="button-primary mt-4 w-full"
            onClick={() => setPreviewOpen(true)}
          >
            <FileUp size={17} />
            Prévisualiser l’import
          </button>
        </div>

        <div className="card min-w-0 p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Prévisualisation fictive</p>
              <h2 className="text-xl font-black">operations_aout_2026.xlsx</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                42 lignes détectées · 2 points à contrôler
              </p>
            </div>
            <span className="badge" data-tone="warning">
              <TriangleAlert size={13} />
              À contrôler
            </span>
          </div>

          {previewOpen ? (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="soft-card p-3">
                  <p className="text-xs font-bold text-[var(--color-muted)]">
                    Lignes prêtes
                  </p>
                  <p className="mt-1 text-xl font-black">40</p>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[#f6ead2] p-3">
                  <p className="text-xs font-bold text-[#8a6021]">Incertaines</p>
                  <p className="mt-1 text-xl font-black">1</p>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[#f7dfda] p-3">
                  <p className="text-xs font-bold text-[#9a463c]">Doublons</p>
                  <p className="mt-1 text-xl font-black">1</p>
                </div>
              </div>

              <div className="table-shell">
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[700px]">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Libellé</th>
                        <th>Montant</th>
                        <th>Classement proposé</th>
                        <th>Contrôle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={`${row.date}-${row.label}`}>
                          <td>{row.date}</td>
                          <td className="font-extrabold">{row.label}</td>
                          <td className="font-black negative">{row.amount}</td>
                          <td>{row.category}</td>
                          <td>
                            {row.issue ? (
                              <span
                                className="badge"
                                data-tone={
                                  row.issue === "Doublon possible"
                                    ? "negative"
                                    : "warning"
                                }
                              >
                                <AlertTriangle size={12} />
                                {row.issue}
                              </span>
                            ) : (
                              <span className="badge" data-tone="positive">
                                <CheckCircle2 size={12} />
                                Prêt
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setPreviewOpen(false)}
                >
                  Fermer l’aperçu
                </button>
                <button
                  type="button"
                  className="button-primary opacity-55"
                  aria-disabled="true"
                  title="Indisponible dans la démonstration"
                >
                  Confirmer 40 lignes
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-h-[350px] flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-6 text-center">
              <FileSpreadsheet
                size={34}
                className="text-[var(--color-primary)]"
              />
              <p className="mt-3 font-black">Aperçu fermé</p>
              <button
                type="button"
                className="button-secondary mt-4"
                onClick={() => setPreviewOpen(true)}
              >
                Rouvrir la prévisualisation
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
          <p className="eyebrow mb-2">Historique fictif</p>
          <h2 className="text-xl font-black">Imports précédents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Fichier</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Lignes</th>
                <th>Avertissements</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="font-extrabold capitalize">
                    {formatMonth(batch.month)}
                  </td>
                  <td>{batch.filename}</td>
                  <td>
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(batch.importedAt))}
                  </td>
                  <td>
                    <span
                      className="badge"
                      data-tone={batch.warnings ? "warning" : "positive"}
                    >
                      {batch.warnings ? (
                        <TriangleAlert size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      {batch.status}
                    </span>
                  </td>
                  <td>{batch.rows}</td>
                  <td>{batch.warnings || "Aucun"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
