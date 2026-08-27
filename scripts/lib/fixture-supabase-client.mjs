import fs from "node:fs";
import path from "node:path";

function compareValues(left, right) {
  if (left === right) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  return String(left).localeCompare(String(right));
}

class FixtureQuery {
  #filters = [];
  #orders = [];
  #limit;
  #selection = "*";

  constructor(tables, table) {
    this.tables = tables;
    this.table = table;
  }

  select(selection = "*") {
    this.#selection = selection;
    return this;
  }

  eq(column, value) {
    this.#filters.push((row) => row[column] === value);
    return this;
  }

  in(column, values) {
    const allowed = new Set(values);
    this.#filters.push((row) => allowed.has(row[column]));
    return this;
  }

  gte(column, value) {
    this.#filters.push((row) => row[column] !== null
      && row[column] !== undefined
      && String(row[column]) >= String(value));
    return this;
  }

  gt(column, value) {
    this.#filters.push((row) => row[column] !== null
      && row[column] !== undefined
      && String(row[column]) > String(value));
    return this;
  }

  lte(column, value) {
    this.#filters.push((row) => row[column] !== null
      && row[column] !== undefined
      && String(row[column]) <= String(value));
    return this;
  }

  lt(column, value) {
    this.#filters.push((row) => row[column] !== null
      && row[column] !== undefined
      && String(row[column]) < String(value));
    return this;
  }

  order(column, options = {}) {
    this.#orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(value) {
    this.#limit = value;
    return this;
  }

  async execute() {
    const source = this.tables.get(this.table);
    if (source === undefined) {
      return {
        data: null,
        error: {
          code: "PGRST205",
          message: `Could not find the table public.${this.table} in the schema cache`,
        },
      };
    }
    let rows = source.filter((row) => this.#filters.every((filter) => filter(row)));
    if (this.#orders.length > 0) {
      rows = [...rows].sort((left, right) => {
        for (const order of this.#orders) {
          const compared = compareValues(left[order.column], right[order.column]);
          if (compared !== 0) return order.ascending ? compared : -compared;
        }
        return 0;
      });
    }
    if (this.#limit !== undefined) rows = rows.slice(0, this.#limit);
    return { data: rows.map((row) => this.#project(row)), error: null };
  }

  #project(row) {
    const fields = this.#selection.split(",").map((field) => field.trim());
    const projection = (field) => {
      const separator = field.indexOf(":");
      const hasAlias = separator >= 0 && field[separator + 1] !== ":";
      const alias = hasAlias
        ? field.slice(0, separator)
        : field.replace(/::text$/u, "");
      const sourceExpression = hasAlias ? field.slice(separator + 1) : field;
      return [alias, sourceExpression.replace(/::text$/u, "")];
    };
    if (fields.includes("*")) {
      const projected = { ...row };
      for (const field of fields) {
        if (field === "*") continue;
        const [alias, source] = projection(field);
        projected[alias] = row[source];
      }
      return projected;
    }
    return Object.fromEntries(fields.map((field) => {
      const [alias, source] = projection(field);
      return [alias, row[source]];
    }));
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

export function loadFixtureTables(directory) {
  const tables = new Map();
  for (const name of fs.readdirSync(directory).sort()) {
    const match = /^(?<table>[a-z0-9_]+)\.page\d+\.json$/.exec(name);
    if (match === null) continue;
    const rows = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
    if (!Array.isArray(rows)) throw new TypeError(`${name} ne contient pas un tableau.`);
    const table = match.groups.table;
    tables.set(table, [...(tables.get(table) ?? []), ...rows]);
  }
  return tables;
}

export function createFixtureSupabaseClient(directory) {
  const tables = loadFixtureTables(directory);
  return {
    from(table) {
      return new FixtureQuery(tables, table);
    },
  };
}
