export interface DbRunResult {
  changes: number;
}

export interface DbStatement {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Array<Record<string, unknown>>;
  run(...params: unknown[]): DbRunResult;
}

export interface DbClient {
  prepare(sql: string): DbStatement;
  exec(sql: string): void;
  pragma(sql: string): void;
  transaction<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R;
  close(): void;
}
