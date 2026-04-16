import Dexie, { type Table } from "dexie";
import type {
  PackConfig,
  UpdateSettings,
  UpdateLog,
} from "../types";

const DB_NAME = "HTMLReleaseUpdater";
const DB_VERSION = 2;

export interface DatabaseSchema {
  packConfigs: PackConfig;
  updateSettings: UpdateSettings;
  updateLogs: UpdateLog;
  recentPaths: {
    id: string;
    path: string;
    type: "source" | "output" | "check";
    usedAt: Date;
  };
}

function normalizePackConfig(data: any): PackConfig {
  return {
    id: data.id || crypto.randomUUID(),
    templateName: data.templateName || "",
    sourcePath: data.sourcePath || "",
    outputPath: data.outputPath || "",
    packageName: data.packageName || "",
    packageType: data.packageType || "zip",
    fileTypes: Array.isArray(data.fileTypes) ? data.fileTypes : [],
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  };
}

function normalizeUpdateSettings(data: any): UpdateSettings {
  return {
    id: data.id || crypto.randomUUID(),
    checkPaths: Array.isArray(data.checkPaths)
      ? data.checkPaths.map((p: any) => ({
          id: p.id || crypto.randomUUID(),
          type: p.type || "local",
          path: p.path || "",
          enabled: p.enabled !== false,
        }))
      : [],
    checkStrategy: data.checkStrategy || "manual",
    checkCycle: typeof data.checkCycle === "number" ? data.checkCycle : 24,
    backupPath: data.backupPath || "",
    notifyOnce: data.notifyOnce !== false,
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  };
}

function normalizeUpdateLog(data: any): UpdateLog {
  return {
    id: data.id || crypto.randomUUID(),
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    fromVersion: data.fromVersion || "",
    toVersion: data.toVersion || "",
    result: ["success", "failed", "rollback"].includes(data.result)
      ? data.result
      : "failed",
    errorMessage: data.errorMessage || "",
  };
}

function normalizeRecentPath(data: any): {
  id: string;
  path: string;
  type: "source" | "output" | "check";
  usedAt: Date;
} {
  return {
    id: data.id || crypto.randomUUID(),
    path: data.path || "",
    type: ["source", "output", "check"].includes(data.type)
      ? data.type
      : "source",
    usedAt: data.usedAt ? new Date(data.usedAt) : new Date(),
  };
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

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      packConfigs: "++id, templateName, sourcePath, createdAt",
      updateSettings: "++id",
      updateLogs: "++id, timestamp, result",
      recentPaths: "++id, path, type, usedAt",
    });

    this.version(DB_VERSION)
      .stores({
        packConfigs: "++id, templateName, sourcePath, createdAt",
        updateSettings: "++id",
        updateLogs: "++id, timestamp, result",
        recentPaths: "++id, path, type, usedAt",
      })
      .upgrade(async () => {
        console.log(`[DB] Upgrading database to version ${DB_VERSION}...`);
      });
  }
}

export const db = new AppDatabase();

db.on("populate", async () => {
  console.log("[DB] Database populated for the first time");
  await createDefaultSettings();
});

db.on("ready", async () => {
  console.log("[DB] Database ready");
  const settingsCount = await db.updateSettings.count();
  if (settingsCount === 0) {
    console.log("[DB] No settings found, creating default settings...");
    await createDefaultSettings();
  }
});

async function createDefaultSettings() {
  await db.updateSettings.add({
    checkPaths: [],
    checkStrategy: "manual",
    checkCycle: 24,
    backupPath: "",
    notifyOnce: true,
    updatedAt: new Date(),
  });
}

export async function initializeDatabase(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log("[DB] Initializing database...");

    await db.open();

    console.log("[DB] Database initialized successfully");
    return { success: true };
  } catch (error: any) {
    console.error("[DB] Database initialization failed:", error);

    if (error.name === "VersionError" || error.name === "SchemaError") {
      console.warn("[DB] Schema version mismatch, attempting recovery...");
      return await handleSchemaMigration();
    }

    return { success: false, error: error.message };
  }
}

async function handleSchemaMigration(): Promise<{
  success: boolean;
  error?: string;
}> {
  let existingData: Record<string, any[]> = {};
  let tempDb: Dexie | null = null;

  try {
    const existingDbNames = await Dexie.getDatabaseNames();

    if (!existingDbNames.includes(DB_NAME)) {
      console.log("[DB] No existing database found, creating new one...");
      return await initializeDatabase();
    }

    console.log("[DB] Existing database found, attempting to migrate...");

    tempDb = new Dexie(DB_NAME);
    await tempDb.open();

    const tables = tempDb.tables;

    for (const table of tables) {
      try {
        existingData[table.name] = await table.toArray();
        console.log(
          `[DB] Backed up ${existingData[table.name].length} records from ${table.name}`,
        );
      } catch (e) {
        console.warn(`[DB] Failed to backup table ${table.name}:`, e);
        existingData[table.name] = [];
      }
    }

    tempDb.close();
    tempDb = null;

    await Dexie.delete(DB_NAME);
    console.log("[DB] Old database deleted");

    await db.open();

    let restoredCount = 0;
    let failedCount = 0;

    await db.transaction("rw", db.tables, async () => {
      for (const [tableName, data] of Object.entries(existingData)) {
        if (data.length > 0 && db[tableName as keyof AppDatabase]) {
          const table = db[tableName as keyof AppDatabase] as Table<
            any,
            string
          >;

          const normalizeFn = getNormalizeFunction(tableName);

          for (const item of data) {
            try {
              const normalizedItem = normalizeFn(item);
              await table.put(normalizedItem);
              restoredCount++;
            } catch (e) {
              failedCount++;
              console.warn(
                `[DB] Failed to migrate record in ${tableName}:`,
                e,
                item,
              );
            }
          }

          console.log(
            `[DB] Restored ${data.length - failedCount} records to ${tableName}, ${failedCount} failed`,
          );
        }
      }
    });

    const settingsCount = await db.updateSettings.count();
    if (settingsCount === 0) {
      await createDefaultSettings();
    }

    console.log(
      `[DB] Schema migration completed: ${restoredCount} records restored, ${failedCount} records skipped`,
    );

    if (failedCount > 0) {
      return {
        success: true,
        error: `Migration completed with ${failedCount} incompatible records skipped.`,
      };
    }

    return { success: true };
  } catch (migrationError: any) {
    console.error("[DB] Schema migration failed:", migrationError);

    if (tempDb) {
      try {
        tempDb.close();
      } catch (e) {}
    }

    try {
      await db.open();

      if (Object.keys(existingData).length > 0) {
        console.log(
          "[DB] Attempting partial data recovery after migration failure...",
        );

        let restoredCount = 0;
        await db.transaction("rw", db.tables, async () => {
          for (const [tableName, data] of Object.entries(existingData)) {
            if (data.length > 0 && db[tableName as keyof AppDatabase]) {
              const table = db[tableName as keyof AppDatabase] as Table<
                any,
                string
              >;
              const normalizeFn = getNormalizeFunction(tableName);

              for (const item of data) {
                try {
                  const normalizedItem = normalizeFn(item);
                  await table.put(normalizedItem);
                  restoredCount++;
                } catch (e) {}
              }
            }
          }
        });

        const settingsCount = await db.updateSettings.count();
        if (settingsCount === 0) {
          await createDefaultSettings();
        }

        console.log(`[DB] Partial recovery: ${restoredCount} records restored`);
        return {
          success: true,
          error: `Migration encountered issues. ${restoredCount} records were recovered.`,
        };
      } else {
        const settingsCount = await db.updateSettings.count();
        if (settingsCount === 0) {
          await createDefaultSettings();
        }

        return {
          success: true,
          error:
            "Migration completed with issues. Database was initialized with defaults.",
        };
      }
    } catch (resetError: any) {
      console.error("[DB] Database recovery failed:", resetError);
      return {
        success: false,
        error: `Database recovery failed: ${resetError.message}`,
      };
    }
  }
}

function getNormalizeFunction(tableName: string): (data: any) => any {
  switch (tableName) {
    case "packConfigs":
      return normalizePackConfig;
    case "updateSettings":
      return normalizeUpdateSettings;
    case "updateLogs":
      return normalizeUpdateLog;
    case "recentPaths":
      return normalizeRecentPath;
    default:
      return (data) => data;
  }
}

export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  defaultValue: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error("[DB] Operation failed:", error);
    return defaultValue;
  }
}

export async function exportDatabase(): Promise<string> {
  const data = {
    packConfigs: await safeDbOperation(() => db.packConfigs.toArray(), []),
    updateSettings: await safeDbOperation(
      () => db.updateSettings.toArray(),
      [],
    ),
    updateLogs: await safeDbOperation(() => db.updateLogs.toArray(), []),
    recentPaths: await safeDbOperation(() => db.recentPaths.toArray(), []),
  };
  return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData);

  await db.transaction(
    "rw",
    [db.packConfigs, db.updateSettings, db.updateLogs, db.recentPaths],
    async () => {
      if (data.packConfigs?.length) {
        await db.packConfigs.clear();
        const normalizedConfigs = data.packConfigs.map(normalizePackConfig);
        await db.packConfigs.bulkAdd(normalizedConfigs);
      }
      if (data.updateSettings?.length) {
        await db.updateSettings.clear();
        const normalizedSettings = data.updateSettings.map(
          normalizeUpdateSettings,
        );
        await db.updateSettings.bulkAdd(normalizedSettings);
      }
      if (data.updateLogs?.length) {
        await db.updateLogs.clear();
        const normalizedLogs = data.updateLogs.map(normalizeUpdateLog);
        await db.updateLogs.bulkAdd(normalizedLogs);
      }
      if (data.recentPaths?.length) {
        await db.recentPaths.clear();
        const normalizedPaths = data.recentPaths.map(normalizeRecentPath);
        await db.recentPaths.bulkAdd(normalizedPaths);
      }
    },
  );
}
