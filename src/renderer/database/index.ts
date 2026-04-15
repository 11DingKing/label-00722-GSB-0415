import Dexie, { type Table, type Transaction } from "dexie";
import type {
  PackConfig,
  UpdateSettings,
  UpdateLog,
  CheckPath,
} from "../types";

export const DB_VERSION = 2;
export const DB_NAME = "HTMLReleaseUpdater";

export interface DbMetadata {
  key: string;
  value: any;
}

class AppDatabase extends Dexie {
  packConfigs!: Table<PackConfig, string>;
  updateSettings!: Table<UpdateSettings, string>;
  updateLogs!: Table<UpdateLog, string>;
  recentPaths!: Table<
    {
      id: string;
      path: string;
      type: "source" | "output" | "check";
      usedAt: Date;
    },
    string
  >;
  dbMetadata!: Table<DbMetadata, string>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      packConfigs: "++id, templateName, sourcePath, createdAt",
      updateSettings: "++id",
      updateLogs: "++id, timestamp, result",
      recentPaths: "++id, path, type, usedAt",
    });

    this.version(2)
      .stores({
        packConfigs: "++id, templateName, sourcePath, createdAt",
        updateSettings: "++id",
        updateLogs: "++id, timestamp, result",
        recentPaths: "++id, path, type, usedAt",
        dbMetadata: "++key",
      })
      .upgrade(async (tx) => {
        await migrateV1toV2(tx);
      });

    this.on("blocked", () => {
      console.warn("Database blocked - please close other tabs");
    });

    this.on("versionchange", (event) => {
      console.log("Database version change detected", event);
      if (event.oldVersion < event.newVersion) {
        this.close();
      }
    });
  }
}

async function migrateV1toV2(tx: Transaction): Promise<void> {
  try {
    const settingsTable = tx.table("updateSettings");
    const settings = await settingsTable.toArray();

    for (const setting of settings) {
      let needsUpdate = false;

      if (!setting.checkPaths || !Array.isArray(setting.checkPaths)) {
        setting.checkPaths = [];
        needsUpdate = true;
      } else {
        for (const path of setting.checkPaths) {
          if (typeof path === "string") {
            Object.assign(path, {
              id: crypto.randomUUID(),
              type: "local" as const,
              path: path,
              enabled: true,
            });
            needsUpdate = true;
          }
        }
      }

      if (!setting.updatedAt) {
        setting.updatedAt = new Date();
        needsUpdate = true;
      }

      if (needsUpdate) {
        await settingsTable.put(setting);
      }
    }
  } catch (error) {
    console.error("Error in V1 to V2 migration:", error);
    throw error;
  }
}

export const db = new AppDatabase();

async function backupDatabase(): Promise<string> {
  try {
    const data = {
      packConfigs: await db.packConfigs.toArray(),
      updateSettings: await db.updateSettings.toArray(),
      updateLogs: await db.updateLogs.toArray(),
      recentPaths: await db.recentPaths.toArray(),
      timestamp: new Date().toISOString(),
      version: db.verno,
    };
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error("Backup failed:", error);
    throw error;
  }
}

async function restoreDatabase(jsonData: string): Promise<void> {
  try {
    const data = JSON.parse(jsonData);

    await db.transaction(
      "rw",
      [db.packConfigs, db.updateSettings, db.updateLogs, db.recentPaths],
      async () => {
        if (data.packConfigs?.length) {
          await db.packConfigs.bulkPut(data.packConfigs);
        }
        if (data.updateSettings?.length) {
          await db.updateSettings.bulkPut(data.updateSettings);
        }
        if (data.updateLogs?.length) {
          await db.updateLogs.bulkPut(data.updateLogs);
        }
        if (data.recentPaths?.length) {
          await db.recentPaths.bulkPut(data.recentPaths);
        }
      },
    );
  } catch (error) {
    console.error("Restore failed:", error);
    throw error;
  }
}

async function attemptRecovery(existingData: any): Promise<void> {
  console.log("Attempting data recovery...");

  try {
    if (existingData.packConfigs?.length) {
      for (const config of existingData.packConfigs) {
        try {
          await db.packConfigs.put(config);
        } catch (e) {
          console.warn("Skipping invalid packConfig:", config.id);
        }
      }
    }

    if (existingData.updateSettings?.length) {
      for (const setting of existingData.updateSettings) {
        try {
          const normalized = normalizeUpdateSettings(setting);
          await db.updateSettings.put(normalized);
        } catch (e) {
          console.warn("Skipping invalid updateSettings");
        }
      }
    }

    if (existingData.updateLogs?.length) {
      for (const log of existingData.updateLogs) {
        try {
          await db.updateLogs.put(log);
        } catch (e) {
          console.warn("Skipping invalid updateLog");
        }
      }
    }

    if (existingData.recentPaths?.length) {
      for (const path of existingData.recentPaths) {
        try {
          await db.recentPaths.put(path);
        } catch (e) {
          console.warn("Skipping invalid recentPath");
        }
      }
    }

    console.log("Data recovery completed");
  } catch (error) {
    console.error("Recovery failed:", error);
  }
}

function normalizeUpdateSettings(setting: any): UpdateSettings {
  return {
    id: setting.id,
    checkPaths: Array.isArray(setting.checkPaths)
      ? setting.checkPaths.map((p: any) => ({
          id: p.id || crypto.randomUUID(),
          type: p.type || "local",
          path: p.path || p,
          enabled: p.enabled !== undefined ? p.enabled : true,
        }))
      : [],
    checkStrategy: setting.checkStrategy || "manual",
    checkCycle:
      typeof setting.checkCycle === "number" ? setting.checkCycle : 24,
    backupPath: setting.backupPath || "",
    notifyOnce: setting.notifyOnce !== undefined ? setting.notifyOnce : true,
    updatedAt: setting.updatedAt ? new Date(setting.updatedAt) : new Date(),
  };
}

export async function initializeDatabase(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await db.open();

    const settingsCount = await db.updateSettings.count();

    if (settingsCount === 0) {
      await db.updateSettings.add({
        checkPaths: [],
        checkStrategy: "manual",
        checkCycle: 24,
        backupPath: "",
        notifyOnce: true,
        updatedAt: new Date(),
      });
    } else {
      const settings = await db.updateSettings.toArray();
      for (const setting of settings) {
        const normalized = normalizeUpdateSettings(setting);
        if (JSON.stringify(normalized) !== JSON.stringify(setting)) {
          await db.updateSettings.put(normalized);
        }
      }
    }

    await db.dbMetadata.put({
      key: "last_initialized",
      value: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Database initialization failed:", error);

    if (error.name === "VersionError" || error.name === "SchemaError") {
      try {
        console.warn("Schema mismatch detected, attempting safe recovery...");

        const backup = await tryExtractOldData();

        await db.delete();

        await db.open();

        if (backup) {
          await attemptRecovery(backup);
        }

        const settingsCount = await db.updateSettings.count();
        if (settingsCount === 0) {
          await db.updateSettings.add({
            checkPaths: [],
            checkStrategy: "manual",
            checkCycle: 24,
            backupPath: "",
            notifyOnce: true,
            updatedAt: new Date(),
          });
        }

        return { success: true };
      } catch (recoveryError: any) {
        console.error("Recovery failed:", recoveryError);
        return { success: false, error: recoveryError.message };
      }
    }

    return { success: false, error: error.message };
  }
}

async function tryExtractOldData(): Promise<any> {
  try {
    const tempDb = new Dexie(DB_NAME);
    await tempDb.open();

    const data: any = {};

    const tableNames = tempDb.tables.map((t) => t.name);
    for (const tableName of tableNames) {
      try {
        data[tableName] = await tempDb.table(tableName).toArray();
      } catch (e) {
        console.warn(`Could not extract table ${tableName}:`, e);
        data[tableName] = [];
      }
    }

    tempDb.close();
    return data;
  } catch (error) {
    console.error("Could not extract old data:", error);
    return null;
  }
}

export async function exportDatabase(): Promise<string> {
  return await backupDatabase();
}

export async function importDatabase(jsonData: string): Promise<void> {
  await restoreDatabase(jsonData);
}

export async function safeDatabaseOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("Database operation failed:", error);
    return fallback;
  }
}
