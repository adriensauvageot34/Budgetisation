from __future__ import annotations

import argparse
import hashlib
import json
import unicodedata
import uuid
from pathlib import Path

import pandas as pd


EXPECTED_COLUMNS = [
    "Date",
    "Libellé bancaire",
    "Débit",
    "Crédit",
    "Commerçant / tiers",
    "Famille",
    "Catégorie détaillée",
    "Nature",
    "Mois",
    "Montant net",
    "Flux",
    "Précision",
    "Priorité budgétaire",
    "Groupe budgétaire",
    "Marge de réduction",
    "Conseil de pilotage",
]

TARGET_IMPORTANCE = {
    "Indispensable",
    "Contrainte",
    "Ajustable",
    "Optionnelle",
}

HOUSEHOLD_ID = uuid.uuid5(
    uuid.NAMESPACE_URL,
    "https://budgetisation.local/household/Budgetisation",
)
BATCH_ID = uuid.uuid5(
    uuid.NAMESPACE_URL,
    "https://budgetisation.local/import/historique-initial-2026-04-2026-07",
)


def scalar(value: object) -> object | None:
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if hasattr(value, "item"):
        value = value.item()
    return value


def text(value: object) -> str | None:
    converted = scalar(value)
    if converted is None:
        return None
    result = str(converted).strip()
    return result or None


def money(value: object) -> float | None:
    converted = scalar(value)
    if converted is None:
        return None
    if isinstance(converted, str):
        converted = converted.replace("\u202f", "").replace(" ", "").replace(",", ".")
    return round(float(converted), 2)


def normalized_token(value: str | None) -> str:
    if not value:
        return ""
    return unicodedata.normalize("NFC", value).strip()


def target_flow(raw_flow: str | None, family: str | None, nature: str | None) -> str:
    if family == "Transferts" or nature == "Transfert":
        return "Transfert interne"
    if family == "Remboursements" or nature == "Remboursement":
        return "Remboursement"
    if family == "Revenus" or nature == "Revenu":
        return "Revenu"
    if nature == "À ventiler" or family == "Espèces":
        return "Flux technique"
    if raw_flow == "Revenu":
        return "Revenu"
    return "Dépense"


def analytical_status(nature: str | None, priority: str | None, precision: str | None) -> str:
    if nature == "Exceptionnelle":
        return "Exceptionnel"
    if priority == "Hors budget":
        return "Hors budget"
    if nature == "À ventiler" or precision == "À ventiler":
        return "À ventiler"
    return "Habituel"


def row_fingerprint(row: dict[str, object]) -> str:
    stable = "|".join(
        [
            str(row["date"]),
            normalized_token(row.get("source_label")),
            "" if row.get("debit") is None else f"{row['debit']:.2f}",
            "" if row.get("credit") is None else f"{row['credit']:.2f}",
            f"{row['amount']:.2f}",
            normalized_token(row.get("normalized_merchant")),
            normalized_token(row.get("category")),
            normalized_token(row.get("subcategory")),
            str(row["import_month"]),
        ]
    )
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()


def transform(source_path: Path) -> tuple[list[dict[str, object]], int]:
    workbook = pd.ExcelFile(source_path)
    if workbook.sheet_names != ["Opérations"]:
        raise ValueError(f"Feuilles inattendues : {workbook.sheet_names}")

    frame = pd.read_excel(source_path, sheet_name="Opérations")
    if list(frame.columns) != EXPECTED_COLUMNS:
        raise ValueError(f"Colonnes inattendues : {list(frame.columns)}")
    if len(frame) != 481:
        raise ValueError(f"Nombre de lignes source inattendu : {len(frame)}")

    deduplicated = frame.drop_duplicates(keep="first").copy()
    removed = len(frame) - len(deduplicated)
    if len(deduplicated) != 418 or removed != 63:
        raise ValueError(
            f"Déduplication stricte inattendue : {len(deduplicated)} lignes, {removed} retirées"
        )

    transformed: list[dict[str, object]] = []
    for _, source in deduplicated.iterrows():
        source_date = pd.to_datetime(source["Date"], errors="raise").date().isoformat()
        month = pd.to_datetime(source["Mois"], errors="raise").strftime("%Y-%m-01")
        family = text(source["Famille"])
        subcategory = text(source["Catégorie détaillée"])
        nature = text(source["Nature"])
        priority = text(source["Priorité budgétaire"])
        precision = text(source["Précision"])
        raw_flow = text(source["Flux"])
        amount = money(source["Montant net"])
        if amount is None:
            raise ValueError(f"Montant net absent pour la ligne datée du {source_date}")

        source_metadata = {
            column: scalar(source[column])
            for column in EXPECTED_COLUMNS
        }
        row: dict[str, object] = {
            "date": source_date,
            "import_month": month,
            "amount": amount,
            "debit": money(source["Débit"]),
            "credit": money(source["Crédit"]),
            "source_label": text(source["Libellé bancaire"]),
            "normalized_merchant": text(source["Commerçant / tiers"]),
            "flow": target_flow(raw_flow, family, nature),
            "category": family,
            "subcategory": subcategory,
            "precise_type": None,
            "recurrence": nature if nature in {"Fixe", "Variable"} else None,
            "importance": priority if priority in TARGET_IMPORTANCE else None,
            "analytical_status": analytical_status(nature, priority, precision),
            "note": None,
            "event": None,
            "uncertain": (
                precision in {"À ventiler", "À préciser"}
                or priority == "À identifier"
            ),
            "source_metadata": source_metadata,
        }
        row["fingerprint"] = row_fingerprint(row)
        transformed.append(row)

    return transformed, removed


def seed_sql(rows: list[dict[str, object]], removed: int, source_name: str) -> str:
    rows_json = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    return f"""begin;

insert into public.households (id, name)
values ('{HOUSEHOLD_ID}', 'Budgetisation')
on conflict (id) do update set name = excluded.name;

create temporary table budgetisation_historical_rows (
  row_data jsonb not null
) on commit drop;

insert into budgetisation_historical_rows (row_data)
select value
from jsonb_array_elements($historical_rows${rows_json}$historical_rows$::jsonb);

insert into public.categories (
  household_id,
  name,
  slug,
  included_in_consumption
)
select
  '{HOUSEHOLD_ID}'::uuid,
  row_data ->> 'category',
  private.slugify(row_data ->> 'category'),
  bool_or(row_data ->> 'flow' = 'Dépense')
from budgetisation_historical_rows
where nullif(row_data ->> 'category', '') is not null
group by row_data ->> 'category'
on conflict (household_id, name) do update
set included_in_consumption =
  public.categories.included_in_consumption
  or excluded.included_in_consumption;

insert into public.subcategories (
  household_id,
  category_id,
  name,
  slug
)
select distinct
  '{HOUSEHOLD_ID}'::uuid,
  category.id,
  row_data ->> 'subcategory',
  private.slugify(row_data ->> 'subcategory')
from budgetisation_historical_rows
join public.categories category
  on category.household_id = '{HOUSEHOLD_ID}'::uuid
 and category.name = row_data ->> 'category'
where nullif(row_data ->> 'subcategory', '') is not null
on conflict (category_id, name) do nothing;

with inserted_batch as (
  insert into public.import_batches (
    id,
    household_id,
    filename,
    status,
    row_count,
    warning_count,
    month_start,
    month_end,
    source_metadata
  )
  values (
    '{BATCH_ID}',
    '{HOUSEHOLD_ID}',
    '{source_name.replace("'", "''")}',
    'completed_with_warnings',
    {len(rows)},
    {sum(1 for row in rows if row["uncertain"])},
    '2026-04-01',
    '2026-07-01',
    jsonb_build_object(
      'source', 'historical_xlsx',
      'source_rows', 481,
      'strict_duplicates_removed', {removed}
    )
  )
  on conflict (id) do nothing
  returning id
)
insert into public.operations (
  household_id,
  import_batch_id,
  date,
  import_month,
  amount,
  debit,
  credit,
  source_label,
  normalized_merchant,
  flow,
  category_id,
  subcategory_id,
  precise_type_id,
  recurrence,
  importance,
  analytical_status,
  note,
  event,
  uncertain,
  fingerprint,
  source_metadata
)
select
  '{HOUSEHOLD_ID}'::uuid,
  inserted_batch.id,
  (row_data ->> 'date')::date,
  (row_data ->> 'import_month')::date,
  (row_data ->> 'amount')::numeric(14, 2),
  nullif(row_data ->> 'debit', '')::numeric(14, 2),
  nullif(row_data ->> 'credit', '')::numeric(14, 2),
  row_data ->> 'source_label',
  nullif(row_data ->> 'normalized_merchant', ''),
  row_data ->> 'flow',
  category.id,
  subcategory.id,
  null,
  nullif(row_data ->> 'recurrence', ''),
  nullif(row_data ->> 'importance', ''),
  row_data ->> 'analytical_status',
  null,
  null,
  coalesce((row_data ->> 'uncertain')::boolean, false),
  row_data ->> 'fingerprint',
  coalesce(row_data -> 'source_metadata', '{{}}'::jsonb)
from inserted_batch
cross join budgetisation_historical_rows
left join public.categories category
  on category.household_id = '{HOUSEHOLD_ID}'::uuid
 and category.name = row_data ->> 'category'
left join public.subcategories subcategory
  on subcategory.category_id = category.id
 and subcategory.name = row_data ->> 'subcategory';

commit;
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--seed", type=Path, required=True)
    parser.add_argument("--bootstrap", type=Path, required=True)
    args = parser.parse_args()

    rows, removed = transform(args.source)
    generated_seed = seed_sql(rows, removed, args.source.name)
    args.seed.parent.mkdir(parents=True, exist_ok=True)
    args.seed.write_text(generated_seed, encoding="utf-8")

    schema = args.schema.read_text(encoding="utf-8")
    args.bootstrap.write_text(
        "-- Bootstrap Supabase Budgetisation : schéma, RLS et historique réel.\n"
        "-- À exécuter une seule fois dans Supabase SQL Editor.\n\n"
        f"{schema}\n\n{generated_seed}",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "source_rows": 481,
                "strict_duplicates_removed": removed,
                "operations": len(rows),
                "household_id": str(HOUSEHOLD_ID),
                "batch_id": str(BATCH_ID),
                "seed": str(args.seed),
                "bootstrap": str(args.bootstrap),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
