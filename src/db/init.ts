import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type QueryExecResult, type SqlJsStatic } from "sql.js";
import { getDatabasePath } from "./path";
import { applyMigrations } from "./migrate";
import type { DbClient, DbRunResult, DbStatement } from "./client";

function resolveWasmPath(): string {
  const packagedCandidate = path.join(process.resourcesPath || "", "sql-wasm.wasm");
  if (packagedCandidate && fs.existsSync(packagedCandidate)) return packagedCandidate;

  const resolved = require.resolve("sql.js/dist/sql-wasm.wasm");
  if (resolved.includes("app.asar")) {
    const unpacked = resolved.replace("app.asar", "app.asar.unpacked");
    if (fs.existsSync(unpacked)) return unpacked;
  }
  return resolved;
}

function waitForPromise<T>(promise: Promise<T>): T {
  const lock = new Int32Array(new SharedArrayBuffer(4));
  let value: T | undefined;
  let error: unknown;

  promise
    .then((result) => {
      value = result;
      Atomics.store(lock, 0, 1);
      Atomics.notify(lock, 0, 1);
    })
    .catch((err) => {
      error = err;
      Atomics.store(lock, 0, 1);
      Atomics.notify(lock, 0, 1);
    });

  while (Atomics.load(lock, 0) === 0) {
    Atomics.wait(lock, 0, 0, 100);
  }

  if (error) throw error;
  return value as T;
}

function loadSqlJs(): SqlJsStatic {
  return waitForPromise(
    initSqlJs({
      locateFile: (file) => {
        if (file === "sql-wasm.wasm") {
          return resolveWasmPath();
        }
        return path.join(path.dirname(resolveWasmPath()), file);
      },
    }),
  );
}

function normalizeParams(params: unknown[]): unknown[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as unknown[];
  }
  return params;
}

class SqlJsStatement implements DbStatement {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly onWrite: () => void,
  ) {}

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const stmt = this.db.prepare(this.sql);
    try {
      stmt.bind(normalizeParams(params));
      if (!stmt.step()) return undefined;
      return stmt.getAsObject() as Record<string, unknown>;
    } finally {
      stmt.free();
    }
  }

  all(...params: unknown[]): Array<Record<string, unknown>> {
    const stmt = this.db.prepare(this.sql);
    try {
      stmt.bind(normalizeParams(params));
      const rows: Array<Record<string, unknown>> = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  run(...params: unknown[]): DbRunResult {
    const stmt = this.db.prepare(this.sql);
    try {
      stmt.run(normalizeParams(params));
      const changes = this.db.getRowsModified();
      const isWrite = !/^\s*(SELECT|PRAGMA)/i.test(this.sql);
      if (isWrite) this.onWrite();
      return { changes };
    } finally {
      stmt.free();
    }
  }
}

class SqlJsClient implements DbClient {
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: Database,
    private readonly dbPath: string,
  ) {}

  prepare(sql: string): DbStatement {
    return new SqlJsStatement(this.db, sql, () => this.markDirty());
  }

  exec(sql: string): void {
    this.db.exec(sql) as QueryExecResult[];
    if (!/^\s*(SELECT|PRAGMA)/i.test(sql)) this.markDirty();
  }

  pragma(sql: string): void {
    this.db.exec(`PRAGMA ${sql};`);
  }

  transaction<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R {
    return (...args: T) => {
      this.exec("BEGIN");
      try {
        const result = fn(...args);
        this.exec("COMMIT");
        return result;
      } catch (error) {
        this.exec("ROLLBACK");
        throw error;
      }
    };
  }

  close(): void {
    this.flushNow();
    this.db.close();
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flushNow();
    }, 300);
  }

  private flushNow(): void {
    if (!this.dirty) return;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const bytes = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(bytes));
    this.dirty = false;
  }
}

export function initDatabase(dbPath = getDatabasePath()): DbClient {
  const SQL = loadSqlJs();

  let db: Database;
  if (fs.existsSync(dbPath)) {
    const bytes = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(bytes));
  } else {
    db = new SQL.Database();
  }

  const client = new SqlJsClient(db, dbPath);
  client.pragma("foreign_keys = ON");
  applyMigrations(client);
  client.exec("PRAGMA foreign_keys = ON;");
  return client;
}
