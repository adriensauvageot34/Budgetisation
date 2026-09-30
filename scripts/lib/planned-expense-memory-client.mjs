import assert from "node:assert/strict";

/** Prospective table boundary spy with PK uniqueness and atomic predicate matching.
 * Synthetic fixtures only; no network and no historical writes. */
export function plannedExpenseMemoryClient(rows = [], persons = []) {
  const writes = [];
  const client = { rows, persons, writes, beforeUpdate: null, from(table) {
    assert(["phase2_planned_expenses", "persons"].includes(table), `unexpected authority: ${table}`);
    let operation = "read", payload;
    const filters = [];
    const query = {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, order() { return this; },
      insert(value) { operation = "insert"; payload = structuredClone(value); return this; },
      update(value) { operation = "update"; payload = structuredClone(value); return this; },
      delete() { operation = "delete"; return this; },
      execute() {
        const source = table === "persons" ? persons : rows;
        if (operation !== "read") assert.equal(table, "phase2_planned_expenses", "historical mutation forbidden");
        if (operation === "update" && client.beforeUpdate) {
          const hook = client.beforeUpdate; client.beforeUpdate = null; hook(rows);
        }
        const selected = source.filter((row) => filters.every(([key, value]) => row[key] === value));
        if (operation === "insert") {
          if (rows.some((row) => row.planned_expense_id === payload.planned_expense_id))
            return { data: null, error: { code: "23505", message: "duplicate primary key" } };
          const now = new Date().toISOString();
          const row = { ...payload, created_at: now, updated_at: now };
          rows.push(row); writes.push({ table, operation, payload: structuredClone(row) });
          return { data: structuredClone(row), error: null };
        }
        if (operation === "update" || operation === "delete") {
          const row = selected[0];
          if (!row) return { data: null, error: null };
          if (operation === "update") Object.assign(row, payload);
          else rows.splice(rows.indexOf(row), 1);
          writes.push({ table, operation, payload: structuredClone(payload ?? row), filters: structuredClone(filters) });
          return { data: structuredClone(row), error: null };
        }
        return { data: structuredClone(selected), error: null };
      },
      maybeSingle() { const result = this.execute(); return Promise.resolve({ ...result,
        data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }); },
      async single() { const result = await this.maybeSingle(); return result.data || result.error ? result
        : { data: null, error: { code: "PGRST116", message: "no matching row" } }; },
      then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); },
    };
    return query;
  } };
  return client;
}

export const expenseDraft = (row) => ({ familyKey: row.familyKey, subtypeKey: row.subtypeKey, title: row.title,
  plannedDate: row.plannedDate, costItems: row.costItems, context: row.context });
