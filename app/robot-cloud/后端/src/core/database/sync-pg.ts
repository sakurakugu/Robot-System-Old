import path from 'path';
import fs from 'fs';
import { MessageChannel, receiveMessageOnPort, Worker } from 'worker_threads';

export interface 数据库运行结果 {
  changes: number;
  lastInsertRowid?: number | string;
}

export interface 同步数据库语句 {
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
  run(...params: unknown[]): 数据库运行结果;
}

export interface 同步数据库实例 {
  exec(sql: string): void;
  prepare(sql: string): 同步数据库语句;
  close(): void;
}

type Postgres连接配置 = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionString?: string;
};

type 数据库请求模式 = 'exec' | 'query' | 'close';

type 数据库响应 =
  | {
      ok: true;
      rows?: Record<string, unknown>[];
      rowCount?: number;
      command?: string;
    }
  | {
      ok: false;
      error: {
        message: string;
        stack?: string;
      };
    };

function 替换问号参数(sql: string): string {
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let result = '';

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';

    if (char === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  return result;
}

function 规范化SQL(sql: string, isRun: boolean): string {
  let normalized = sql;

  normalized = normalized.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/\bdatetime\s*\(\s*'now'\s*\)/gi, 'CURRENT_TIMESTAMP');
  normalized = normalized.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');
  normalized = normalized.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY');
  normalized = normalized.replace(/\bAUTOINCREMENT\b/gi, '');
  normalized = normalized.replace(/\bjson_extract\s*\(\s*metadata\s*,\s*'\$\.conversationId'\s*\)/gi, 'NULL');
  normalized = normalized.replace(/\bjson_valid\s*\(\s*metadata\s*\)/gi, 'FALSE');
  normalized = 替换问号参数(normalized);

  if (isRun && /^\s*insert\s+/i.test(normalized) && !/\breturning\b/i.test(normalized)) {
    normalized = `${normalized.trimEnd()} RETURNING *`;
  }

  return normalized;
}

function 提取插入主键(row: Record<string, unknown> | undefined): number | string | undefined {
  if (!row) {
    return undefined;
  }

  if (typeof row.id === 'number' || typeof row.id === 'string') {
    return row.id;
  }

  if (typeof row.uuid === 'number' || typeof row.uuid === 'string') {
    return row.uuid;
  }

  return undefined;
}

class Postgres同步语句 implements 同步数据库语句 {
  constructor(
    private readonly 数据库: Postgres同步数据库,
    private readonly 原始SQL: string,
  ) {}

  get(...params: unknown[]): any {
    const rows = this.数据库.执行查询(this.原始SQL, params);
    return rows[0];
  }

  all(...params: unknown[]): any[] {
    return this.数据库.执行查询(this.原始SQL, params);
  }

  run(...params: unknown[]): 数据库运行结果 {
    return this.数据库.执行运行(this.原始SQL, params);
  }
}

export class Postgres同步数据库 implements 同步数据库实例 {
  private worker: Worker;

  constructor(config: Postgres连接配置) {
    const jsWorkerPath = path.join(__dirname, 'worker.js');
    const tsWorkerPath = path.join(__dirname, 'worker.ts');

    if (fs.existsSync(jsWorkerPath)) {
      this.worker = new Worker(jsWorkerPath, {
        workerData: config,
      });
      return;
    }

    if (fs.existsSync(tsWorkerPath)) {
      this.worker = new Worker(tsWorkerPath, {
        workerData: config,
        execArgv: ['-r', 'ts-node/register/transpile-only'],
      });
      return;
    }

    throw new Error(`未找到数据库 worker 文件: ${jsWorkerPath}`);
  }

  exec(sql: string): void {
    this.发送请求('exec', 规范化SQL(sql, false));
  }

  prepare(sql: string): 同步数据库语句 {
    return new Postgres同步语句(this, sql);
  }

  close(): void {
    try {
      this.发送请求('close');
    } finally {
      void this.worker.terminate();
    }
  }

  执行查询(sql: string, params: unknown[]): any[] {
    const response = this.发送请求('query', 规范化SQL(sql, false), params);
    return response.rows || [];
  }

  执行运行(sql: string, params: unknown[]): 数据库运行结果 {
    const response = this.发送请求('query', 规范化SQL(sql, true), params);
    const firstRow = response.rows?.[0];

    return {
      changes: response.rowCount || 0,
      lastInsertRowid: 提取插入主键(firstRow),
    };
  }

  private 发送请求(mode: 数据库请求模式, sql?: string, params?: unknown[]): Extract<数据库响应, { ok: true }> {
    const signalBuffer = new SharedArrayBuffer(4);
    const signal = new Int32Array(signalBuffer);
    const { port1, port2 } = new MessageChannel();

    this.worker.postMessage({
      mode,
      sql,
      params,
      signal: signalBuffer,
      port: port2,
    }, [port2]);

    Atomics.wait(signal, 0, 0);
    const packet = receiveMessageOnPort(port1);
    port1.close();

    if (!packet) {
      throw new Error('数据库工作线程未返回结果');
    }

    const response = packet.message as 数据库响应;
    if (!response.ok) {
      const error = new Error(response.error.message);
      error.stack = response.error.stack;
      throw error;
    }

    return response;
  }
}
