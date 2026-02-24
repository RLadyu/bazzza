import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type Database from "better-sqlite3";
import { getAppDataDir } from "../../db/path";
import type { RunCsvImportRequest, RunCsvImportResponse } from "../../contracts/ipc";

interface ParsedRow {
  values: string[];
}

interface ScanResult {
  delimiter: string;
  rows: number;
  cols: number;
}

function uuid(): string {
  return crypto.randomUUID();
}

function fileExt(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

function ensureSupportedExtension(ext: string): asserts ext is ".csv" | ".tsv" | ".txt" {
  if (ext !== ".csv" && ext !== ".tsv" && ext !== ".txt") {
    throw new Error(`Unsupported file extension: ${ext}. Allowed: .csv, .tsv, .txt`);
  }
}

function parseCsvRecord(input: string, delimiter: string): ParsedRow {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        cur += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  if (inQuotes) {
    throw new Error("Unclosed quote in CSV record");
  }

  out.push(cur);
  return { values: out };
}

async function detectDelimiter(filePath: string, ext: ".csv" | ".tsv" | ".txt"): Promise<string> {
  if (ext === ".tsv") return "\t";

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      const commaCount = (line.match(/,/g) ?? []).length;
      const tabCount = (line.match(/\t/g) ?? []).length;
      return tabCount > commaCount ? "\t" : ",";
    }
    return ",";
  } finally {
    rl.close();
    stream.close();
  }
}

async function scanFile(filePath: string, delimiter: string): Promise<ScanResult> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let rows = 0;
  let cols = 0;
  let pending = "";

  try {
    for await (const line of rl) {
      pending = pending.length > 0 ? `${pending}\n${line}` : line;

      try {
        const parsed = parseCsvRecord(pending, delimiter);
        rows += 1;
        cols = Math.max(cols, parsed.values.length);
        pending = "";
      } catch (error) {
        if (error instanceof Error && error.message.includes("Unclosed quote")) {
          continue;
        }
        throw error;
      }
    }

    if (pending.length > 0) {
      const parsed = parseCsvRecord(pending, delimiter);
      rows += 1;
      cols = Math.max(cols, parsed.values.length);
    }

    return { delimiter, rows, cols };
  } finally {
    rl.close();
    stream.close();
  }
}

export async function runCsvImport(db: Database.Database, request: RunCsvImportRequest): Promise<RunCsvImportResponse> {
  const ext = fileExt(request.filePath);
  ensureSupportedExtension(ext);

  if (!request.region || request.region.trim().length === 0) {
    throw new Error("Region is required");
  }

  const importId = uuid();
  const originalName = path.basename(request.filePath);

  const appData = getAppDataDir();
  const importDir = path.join(appData, "imports", importId);
  fs.mkdirSync(importDir, { recursive: true });

  const storedPath = path.join(importDir, originalName);
  fs.copyFileSync(request.filePath, storedPath);

  const fileBuffer = fs.readFileSync(storedPath);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  const delimiter = await detectDelimiter(storedPath, ext);
  const scan = await scanFile(storedPath, delimiter);

  const sheetId = uuid();
  const rowMax = scan.rows > 0 ? scan.rows - 1 : 0;
  const colMax = scan.cols > 0 ? scan.cols - 1 : 0;

  const insertCell = db.prepare(
    `INSERT INTO raw_cells(sheet_id, row_idx, col_idx, value_type, value_text, value_num, value_date_iso, value_bool, formula_text, number_format, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let cellsInserted = 0;

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO imports(id, region_code, source_filename, file_hash, template_signature, imported_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(importId, request.region, originalName, fileHash, `csv:${ext}:${delimiter}`, new Date().toISOString());

    db.prepare(
      `INSERT INTO stored_files(import_id, stored_path)
       VALUES (?, ?)`,
    ).run(importId, storedPath);

    db.prepare(
      `INSERT INTO raw_sheets(id, import_id, sheet_index, sheet_name, row_max, col_max, sheet_meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(sheetId, importId, 0, "Sheet1", rowMax, colMax, JSON.stringify({ delimiter, ext, note: request.note ?? null }));

    const stream = fs.createReadStream(storedPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let rowIdx = 0;
    let pending = "";

    try {
      for await (const line of rl) {
        pending = pending.length > 0 ? `${pending}\n${line}` : line;

        try {
          const parsed = parseCsvRecord(pending, delimiter);
          pending = "";

          for (let colIdx = 0; colIdx < scan.cols; colIdx += 1) {
            const value = parsed.values[colIdx] ?? "";
            insertCell.run(sheetId, rowIdx, colIdx, "string", value, null, null, null, null, null, null);
            cellsInserted += 1;
          }

          rowIdx += 1;
        } catch (error) {
          if (error instanceof Error && error.message.includes("Unclosed quote")) {
            continue;
          }
          throw error;
        }
      }

      if (pending.length > 0) {
        const parsed = parseCsvRecord(pending, delimiter);
        for (let colIdx = 0; colIdx < scan.cols; colIdx += 1) {
          const value = parsed.values[colIdx] ?? "";
          insertCell.run(sheetId, rowIdx, colIdx, "string", value, null, null, null, null, null, null);
          cellsInserted += 1;
        }
      }
    } finally {
      rl.close();
      stream.close();
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    import_id: importId,
    region: request.region,
    rows: scan.rows,
    cols: scan.cols,
    cellsInserted,
  };
}
