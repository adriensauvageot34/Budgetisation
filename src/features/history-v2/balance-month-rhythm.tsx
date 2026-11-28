"use client";

import { useEffect, useState } from "react";
import { readBalanceMonthRhythm } from "@/app/mois-a-venir/composer/bilan/read-month-rhythm";
import type { YearMonth } from "@/core/time";
import { ClayIcon } from "@/components/layout/clay-icon";
import { AmountBars, DetailGroup, moneyAmount } from "./balance-dashboard-widgets";
import { formatCount } from "./presentation";
import { formatMoney } from "./renderers";
import styles from "./balance-dashboard.module.css";

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function BalanceMonthRhythm({ month, domain }: { readonly month: YearMonth; readonly domain: "food" | "car" }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof readBalanceMonthRhythm>>>();
  useEffect(() => {
    let current = true;
    void readBalanceMonthRhythm(month, domain).then(result => {
      if (current) setData(result);
    }, () => {
      if (current) setData(null);
    });
    return () => { current = false; };
  }, [month, domain]);

  const title = domain === "food" ? "Courses, restaurants et livraisons" : "Carburant et trajets";
  return <DetailGroup title={title} note={data ? "Repère du mois · Analyse globale" : undefined}>
    {data === undefined ? <p className={styles.detailLoading} role="status">Chargement du repère mensuel…</p>
      : data === null ? <p className={styles.note}>Repère mensuel non disponible.</p>
      : data.domain === "food" ? <AmountBars rows={data.rows.map((row, index) => ({
        id: row.id, label: row.label, tone: index === 0 ? "accent" : index === 1 ? "secondary" : "neutral",
        amount: row.partial ? { status: "PARTIAL", value: row.amount, partialMeaning: "LOWER_BOUND" } : moneyAmount(row.amount),
      }))} />
      : <>
        <dl className={styles.fuelMarkers}>
          <div><dt><ClayIcon name="car" size={17} /> Payé à la pompe</dt><dd>{formatMoney(data.paid)} · {formatCount(data.count, "paiement")}</dd></div>
          <div><dt>Carburant estimé des trajets</dt><dd>{data.estimated === undefined ? "À confirmer" : "≈ " + formatMoney(data.estimated) + (data.partial ? " · Partiel" : "")}</dd>
            {data.estimated !== undefined && <dd>{integer.format(data.distance)} km reconstitués</dd>}</div>
        </dl>
        {data.estimated !== undefined && <AmountBars rows={data.usage.filter(row => Number(row.amount) !== 0).map(row => ({
          id: row.id, label: row.label, amount: moneyAmount(row.amount),
        }))} />}
      </>}
  </DetailGroup>;
}
