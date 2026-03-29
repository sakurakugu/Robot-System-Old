import { parentPort, workerData } from 'worker_threads';
import type { MessagePort } from 'worker_threads';
import { Pool, types } from 'pg';

type WorkerMessage = {
  mode: 'exec' | 'query' | 'close';
  sql?: string;
  params?: unknown[];
  signal: SharedArrayBuffer;
  port: MessagePort;
};

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(21, (value) => Number(value));
types.setTypeParser(23, (value) => Number(value));

const pool = new Pool({
  host: workerData.host,
  port: workerData.port,
  user: workerData.user,
  password: workerData.password,
  database: workerData.database,
  connectionString: workerData.connectionString,
  max: 1,
});

function 通知完成(signalBuffer: SharedArrayBuffer): void {
  const signal = new Int32Array(signalBuffer);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0, 1);
}

parentPort?.on('message', async (message: WorkerMessage) => {
  const { mode, sql, params = [], signal, port } = message;

  try {
    if (mode === 'close') {
      await pool.end();
      port.postMessage({ ok: true });
      通知完成(signal);
      port.close();
      return;
    }

    if (!sql) {
      throw new Error('缺少 SQL');
    }

    const result = mode === 'exec'
      ? await pool.query(sql)
      : await pool.query(sql, params);

    port.postMessage({
      ok: true,
      rows: result.rows,
      rowCount: result.rowCount,
      command: result.command,
    });
  } catch (error) {
    const err = error as Error;
    port.postMessage({
      ok: false,
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
  } finally {
    通知完成(signal);
    port.close();
  }
});
