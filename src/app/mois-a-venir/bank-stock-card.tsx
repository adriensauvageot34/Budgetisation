import type { MoneyKnowledge } from "@/server/phase2/bank-cash-projection";
import { controlDate, controlMoney } from "@/domain/phase2/month-control-display";
import { MonthControlLink } from "./month-control-center";
import material from "./month-material.module.css";

export function BankStockCard({ balance, readOnly = false }: { balance: MoneyKnowledge; readOnly?: boolean }) {
  return <article data-bank-stock-card className={`${material.dataCard} mt-3 flex items-center justify-between gap-6 p-5`}>
    <div><h4 className="font-bold">Banque</h4><p className={`${material.data} text-3xl font-black`}>{balance.status === "UNKNOWN" ? readOnly ? "Solde de départ non établi" : "Solde actuel à renseigner" : controlMoney(balance.amount, true)}</p><p className="text-sm text-slate-600">{balance.status === "KNOWN" ? `Solde observé · ${balance.asOfDate ? controlDate(balance.asOfDate) : "Date à confirmer"}` : "À confirmer"}</p></div>
    {!readOnly && <MonthControlLink section="update" focus="BANK" className="font-bold underline">Modifier le solde Banque</MonthControlLink>}
  </article>;
}
