import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import mysql from "mysql2/promise";
import pg from "pg";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { cleanHost } from "./connections";
import { decrypt, encrypt } from "./crypto";

/**
 * Business databases (PRD §11): PostgreSQL and MySQL, READ-ONLY.
 * - The password is encrypted on our server and never reaches Claude or the browser.
 * - Queries are checked (one read statement only) AND run in a read-only transaction
 *   with a time limit and a row limit, so a mistake can't change data.
 * - Private network addresses are refused (no reaching the platform's own network).
 */

export const DATABASE_PROVIDER = "database";
export type DbEngine = "postgres" | "mysql";
export type DbConfig = { engine: DbEngine; host: string; port: number; database: string; user: string; ssl: boolean };

const QUERY_TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 8_000;
const MAX_ROWS = 1000;
const MAX_TEXT = 30_000;

// ---------------------------------------------------------------------------
// Network safety
// ---------------------------------------------------------------------------

function privateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

/** Checks the host is a public name (or public IP) that doesn't resolve to a private address. */
async function safeHost(raw: string) {
  const value = raw.trim().toLowerCase();
  const host = isIP(value) ? value : cleanHost(value);
  if (!host) throw new Error("Use the database's public host name, e.g. db.example.com.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new Error(`Couldn't find the host ${host}.`);
  if (addresses.some((a) => privateAddress(a.address))) throw new Error("That host points to a private network address, which isn't allowed.");
  return host;
}

// ---------------------------------------------------------------------------
// SQL checks (the database-level read-only transaction is the real guarantee)
// ---------------------------------------------------------------------------

const WRITE_WORDS =
  /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|copy|call|execute|exec|prepare|vacuum|reindex|pg_sleep|sleep|benchmark|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|dblink|load_file)\b|\binto\s+(outfile|dumpfile)\b|\block\s+tables?\b|\bset\s+(session|global|role|local)\b/i;

/** Returns the cleaned statement, or throws with a reason. */
export function checkReadOnlySql(sql: string) {
  // Remove comments and string literals before checking keywords
  const noComments = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const stripped = noComments.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""').replace(/`[^`]*`/g, "``");
  const statement = noComments.trim().replace(/;\s*$/, "");
  if (!statement) throw new Error("The query is empty.");
  if (statement.length > 20_000) throw new Error("The query is too long.");
  if (stripped.replace(/;\s*$/, "").includes(";")) throw new Error("Send one statement at a time.");
  if (!/^\s*(select|with|show|explain|describe|desc)\b/i.test(stripped)) throw new Error("Only read queries are allowed (SELECT, WITH, SHOW, EXPLAIN, DESCRIBE).");
  if (/^\s*explain\b[\s\S]*\banalyze\b/i.test(stripped)) throw new Error("EXPLAIN ANALYZE isn't allowed (it runs the query).");
  const bad = stripped.match(WRITE_WORDS);
  if (bad) throw new Error(`"${bad[0]}" isn't allowed: database access is read-only.`);
  return statement;
}

// ---------------------------------------------------------------------------
// Running queries
// ---------------------------------------------------------------------------

type Result = { columns: string[]; rows: unknown[][]; truncated: boolean };

async function runPostgres(config: DbConfig, password: string, sql: string, maxRows: number): Promise<Result> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS + 2000,
    application_name: "baba-readonly",
  });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
    const res = await client.query({ text: sql, rowMode: "array" });
    await client.query("ROLLBACK");
    const rows = (res.rows ?? []) as unknown[][];
    return { columns: (res.fields ?? []).map((f) => f.name), rows: rows.slice(0, maxRows), truncated: rows.length > maxRows };
  } finally {
    await client.end().catch(() => {});
  }
}

async function runMysql(config: DbConfig, password: string, sql: string, maxRows: number): Promise<Result> {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: CONNECT_TIMEOUT_MS,
    multipleStatements: false,
    rowsAsArray: true,
  });
  try {
    await conn.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`).catch(() => {});
    await conn.query("START TRANSACTION READ ONLY");
    const [rows, fields] = await conn.query({ sql, timeout: QUERY_TIMEOUT_MS });
    await conn.query("ROLLBACK");
    const list = (Array.isArray(rows) ? rows : []) as unknown[][];
    return { columns: (fields ?? []).map((f) => f.name), rows: list.slice(0, maxRows), truncated: list.length > maxRows };
  } finally {
    await conn.end().catch(() => {});
  }
}

function run(config: DbConfig, password: string, sql: string, maxRows: number) {
  return config.engine === "postgres" ? runPostgres(config, password, sql, maxRows) : runMysql(config, password, sql, maxRows);
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function asTable(result: Result) {
  const head = `| ${result.columns.join(" | ")} |\n| ${result.columns.map(() => "---").join(" | ")} |`;
  const lines: string[] = [];
  let size = head.length;
  let shown = 0;
  for (const row of result.rows) {
    const line = `| ${row.map(cell).join(" | ")} |`;
    if (size + line.length > MAX_TEXT) break;
    lines.push(line);
    size += line.length;
    shown++;
  }
  const more = result.truncated || shown < result.rows.length;
  return `${head}\n${lines.join("\n")}\n\n${shown} row(s) shown${more ? " — more rows exist: add filters, aggregates or LIMIT/OFFSET" : ""}.`;
}

// ---------------------------------------------------------------------------
// Saving connections (from the secure form) and listing them
// ---------------------------------------------------------------------------

export type SaveDatabaseInput = {
  workspaceId: string;
  userId: string;
  name: string;
  engine: string;
  host: string;
  port: number | string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

/** Tests the connection with a read-only query, then saves it (password encrypted). */
export async function saveDatabase(input: SaveDatabaseInput) {
  const engine = input.engine === "mysql" ? "mysql" : input.engine === "postgres" ? "postgres" : null;
  if (!engine) throw new Error("Choose PostgreSQL or MySQL.");
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error("Give the connection a name.");
  const port = Number(input.port || (engine === "postgres" ? 5432 : 3306));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("The port isn't valid.");
  const database = input.database.trim().slice(0, 120);
  const user = input.user.trim().slice(0, 120);
  if (!database || !user) throw new Error("Database name and username are required.");
  if (!input.password || input.password.length > 1000) throw new Error("Enter the password.");
  const host = await safeHost(input.host);
  const config: DbConfig = { engine, host, port, database, user, ssl: input.ssl };

  try {
    await run(config, input.password, "SELECT 1", 1);
  } catch (error) {
    throw new Error(`Couldn't connect: ${error instanceof Error ? error.message.slice(0, 200) : "unknown error"}`);
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("integrations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", DATABASE_PROVIDER)
    .ilike("label", name)
    .maybeSingle();
  const values = {
    workspace_id: input.workspaceId,
    provider: DATABASE_PROVIDER,
    label: name,
    status: "connected",
    connected_by: input.userId,
    config: config as unknown as Json,
  };
  const { data: row, error } = existing
    ? await admin.from("integrations").update(values).eq("id", existing.id).select("id").single()
    : await admin.from("integrations").insert(values).select("id").single();
  if (error || !row) throw new Error(`Couldn't save: ${error?.message ?? "unknown error"}`);
  const { error: credError } = await admin.from("integration_credentials").upsert({
    integration_id: row.id,
    workspace_id: input.workspaceId,
    secret_enc: encrypt(input.password),
    updated_at: new Date().toISOString(),
  });
  if (credError) throw new Error(`Couldn't save: ${credError.message}`);
  return row.id;
}

export async function deleteDatabase(workspaceId: string, integrationId: string) {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .delete()
    .eq("id", integrationId)
    .eq("workspace_id", workspaceId)
    .eq("provider", DATABASE_PROVIDER)
    .select("id");
  if (!data?.length) throw new Error("That connection wasn't found.");
}

export async function listDatabases(workspaceId: string) {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .select("id, label, config, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", DATABASE_PROVIDER)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({ id: r.id, name: r.label, status: r.status, config: r.config as unknown as DbConfig }));
}

/** The db_query tool: one read-only query against a connected database. */
export async function dbQuery(workspaceId: string, input: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const name = typeof input.connection === "string" ? input.connection.trim() : "";
  const sql = typeof input.sql === "string" ? input.sql : "";
  const maxRows = Math.min(MAX_ROWS, Math.max(1, Number(input.max_rows) || 200));
  const dbs = await listDatabases(workspaceId);
  if (dbs.length === 0) return { text: "No database is connected. Use request_database_connection so the user can add one securely.", isError: true };
  const db = name ? dbs.find((d) => d.name.toLowerCase() === name.toLowerCase()) : dbs.length === 1 ? dbs[0] : undefined;
  if (!db) return { text: `Say which connection to use: ${dbs.map((d) => d.name).join(", ")}.`, isError: true };

  let statement: string;
  try {
    statement = checkReadOnlySql(sql);
  } catch (error) {
    return { text: error instanceof Error ? error.message : "Query not allowed.", isError: true };
  }
  const { data: cred } = await getSupabaseAdmin().from("integration_credentials").select("secret_enc").eq("integration_id", db.id).maybeSingle();
  if (!cred) return { text: "This connection's password is missing. Ask the user to add the database again.", isError: true };
  try {
    await safeHost(db.config.host);
    const result = await run(db.config, decrypt(cred.secret_enc), statement, maxRows);
    return { text: `Database: ${db.name} (${db.config.engine}, read-only)\n\n${asTable(result)}`, isError: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (/read-only|read only/i.test(message)) return { text: "The database refused it: only read queries can run.", isError: true };
    return { text: `The query failed: ${message.slice(0, 300)}`, isError: true };
  }
}
