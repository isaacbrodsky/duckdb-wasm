import * as duckdb from '@duckdb/duckdb-wasm/dist/duckdb-esm';
import * as duckdb_sync from '@duckdb/duckdb-wasm/dist/duckdb-node-sync';
import {
    SystemBenchmarkContext,
    SystemBenchmark,
    DuckDBSyncMaterializingVarcharScanBenchmark,
    ArqueroVarcharScanBenchmark,
} from './system';
import { runSystemBenchmarks } from './suite';
import Worker from 'web-worker';
import path from 'path';
import fs from 'fs/promises';

async function main() {
    // Setup DuckDB sync & async
    let duckdbDB: duckdb_sync.DuckDB | null = null;
    let duckdbAsyncDB: duckdb.AsyncDuckDB | null = null;
    let duckdbWorker: Worker | null = null;
    const DUCKDB_BUNDLE = await duckdb.selectBundle({
        asyncDefault: {
            mainModule: path.resolve(__dirname, '../../duckdb-wasm/dist/duckdb.wasm'),
            mainWorker: path.resolve(__dirname, '../../duckdb-wasm/dist/duckdb-node-async.worker.js'),
        },
        asyncNext: {
            mainModule: path.resolve(__dirname, '../../duckdb-wasm/dist/duckdb-next.wasm'),
            mainWorker: path.resolve(__dirname, '../../duckdb-wasm/dist/duckdb-node-async-next.worker.js'),
        },
    });
    const logger = new duckdb_sync.VoidLogger();
    duckdbDB = await new duckdb_sync.DuckDB(
        logger,
        duckdb_sync.NODE_RUNTIME,
        path.resolve(__dirname, '../../duckdb-wasm/dist/duckdb.wasm'),
    ).instantiate();
    duckdbWorker = new Worker(DUCKDB_BUNDLE.mainWorker);
    duckdbAsyncDB = new duckdb.AsyncDuckDB(logger, duckdbWorker);
    await duckdbAsyncDB.instantiate(DUCKDB_BUNDLE.mainModule);

    const ctx: SystemBenchmarkContext = {
        seed: Math.random(),
    };
    const suite: SystemBenchmark[] = [
        new ArqueroVarcharScanBenchmark(1000, 20),
        new ArqueroVarcharScanBenchmark(10000, 20),
        new ArqueroVarcharScanBenchmark(100000, 20),
        new ArqueroVarcharScanBenchmark(1000000, 20),
        new DuckDBSyncMaterializingVarcharScanBenchmark(duckdbDB, 1000, 20),
        new DuckDBSyncMaterializingVarcharScanBenchmark(duckdbDB, 10000, 20),
        new DuckDBSyncMaterializingVarcharScanBenchmark(duckdbDB, 100000, 20),
        new DuckDBSyncMaterializingVarcharScanBenchmark(duckdbDB, 1000000, 20),
    ];
    const results = await runSystemBenchmarks(ctx, suite);
    console.log(results);

    // Terminate the worker
    await duckdbAsyncDB.terminate();

    // Write results
    const reports = path.resolve(__dirname, '../../../reports');
    await fs.mkdir(reports);
    await fs.writeFile(path.resolve(__dirname, './suite_system_scan_text.json'), JSON.stringify(results), 'utf8');
}

main();
