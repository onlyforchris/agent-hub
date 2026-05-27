// Connector Hub：一期实现 excel_import / mock_connector 形态。
// 通过直接 import JSON fixtures 模拟从外部系统取数；esbuild --bundle 会内联，
// dev (tsx) 与 prod (cjs bundle) 行为一致。

import diffsRaw from "./fixtures/diffs.json" with { type: "json" };
import settlementsRaw from "./fixtures/dms-settlement.json" with { type: "json" };
import ledgersRaw from "./fixtures/dms-revenue-ledger.json" with { type: "json" };
import postingsRaw from "./fixtures/sap-posting.json" with { type: "json" };
import interfaceLogsRaw from "./fixtures/sap-interface-log.json" with { type: "json" };
import storesRaw from "./fixtures/master-store.json" with { type: "json" };

type DiffFixture = Array<Record<string, unknown>>;
type SettlementFixture = Record<string, Array<Record<string, unknown>>>;
type LedgerFixture = Record<string, Array<Record<string, unknown>>>;
type PostingFixture = Record<string, Record<string, unknown>>;
type InterfaceLogFixture = Record<string, Array<Record<string, unknown>>>;
type StoreFixture = Record<string, Record<string, unknown>>;

const diffs = diffsRaw as unknown as DiffFixture;
const settlements = settlementsRaw as unknown as SettlementFixture;
const ledgers = ledgersRaw as unknown as LedgerFixture;
const postings = postingsRaw as unknown as PostingFixture;
const interfaceLogs = interfaceLogsRaw as unknown as InterfaceLogFixture;
const stores = storesRaw as unknown as StoreFixture;

export const connectors = {
  finereport: {
    name: "excel_import",
    queryDiffList(): DiffFixture {
      return diffs;
    },
  },
  dms: {
    name: "excel_import",
    querySettlement(settlementNo: string): Array<Record<string, unknown>> {
      return settlements[settlementNo] ?? [];
    },
    queryRevenueLedger(settlementNo: string): Array<Record<string, unknown>> {
      return ledgers[settlementNo] ?? [];
    },
  },
  sap: {
    name: "excel_import",
    queryPosting(settlementNo: string): Record<string, unknown> | null {
      return postings[settlementNo] ?? null;
    },
    queryInterfaceLog(settlementNo: string): Array<Record<string, unknown>> {
      return interfaceLogs[settlementNo] ?? [];
    },
  },
  master: {
    name: "excel_import",
    queryStoreHistory(storeCode: string): Record<string, unknown> | null {
      return stores[storeCode] ?? null;
    },
  },
};
