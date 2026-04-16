import { ref } from "vue";
import { importDatabase, db } from "../database";
import Dexie from "dexie";

export interface MigrationScript {
  fromVersion: string;
  toVersion: string;
  migrate: () => Promise<void>;
}

const migrationScripts: MigrationScript[] = [];

export function useDbMigration() {
  const migrating = ref(false);
  const migrationProgress = ref({ step: "", percent: 0 });

  function registerMigration(script: MigrationScript) {
    migrationScripts.push(script);
  }

  function findMigrationPath(
    fromVersion: string,
    toVersion: string,
  ): MigrationScript[] {
    const path: MigrationScript[] = [];
    let currentVersion = fromVersion;

    while (currentVersion !== toVersion) {
      const script = migrationScripts.find(
        (s) => s.fromVersion === currentVersion,
      );
      if (!script) break;

      path.push(script);
      currentVersion = script.toVersion;

      if (path.length > 100) break;
    }

    return path;
  }

  async function executeMigration(
    fromVersion: string,
    toVersion: string,
  ): Promise<{ success: boolean; error?: string }> {
    migrating.value = true;
    migrationProgress.value = { step: "准备迁移...", percent: 0 };

    try {
      const scripts = findMigrationPath(fromVersion, toVersion);

      if (scripts.length === 0) {
        migrationProgress.value = { step: "无需数据迁移", percent: 100 };
        return { success: true };
      }

      const totalSteps = scripts.length;
      let currentStep = 0;

      for (const script of scripts) {
        currentStep++;
        migrationProgress.value = {
          step: `执行迁移: ${script.fromVersion} → ${script.toVersion}`,
          percent: Math.floor((currentStep / totalSteps) * 100),
        };

        await script.migrate();
      }

      migrationProgress.value = { step: "迁移完成", percent: 100 };
      return { success: true };
    } catch (error: any) {
      migrationProgress.value = {
        step: `迁移失败: ${error.message}`,
        percent: 0,
      };
      return { success: false, error: error.message };
    } finally {
      migrating.value = false;
    }
  }

  async function restoreFromBackup(
    backupPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI)
      return { success: false, error: "Electron API not available" };

    migrating.value = true;
    migrationProgress.value = { step: "读取备份数据...", percent: 20 };

    try {
      const dbBackupPath = `${backupPath}/indexeddb-backup.json`;
      const exists = await window.electronAPI.fs.exists(dbBackupPath);

      if (!exists) {
        migrationProgress.value = { step: "无 IndexedDB 备份", percent: 100 };
        return { success: true };
      }

      const backupData = await window.electronAPI.fs.readJson(dbBackupPath);

      migrationProgress.value = { step: "导入数据...", percent: 60 };
      await importDatabase(JSON.stringify(backupData));

      migrationProgress.value = { step: "恢复完成", percent: 100 };
      return { success: true };
    } catch (error: any) {
      migrationProgress.value = {
        step: `恢复失败: ${error.message}`,
        percent: 0,
      };
      return { success: false, error: error.message };
    } finally {
      migrating.value = false;
    }
  }

  function needsMigration(fromVersion: string, toVersion: string): boolean {
    const scripts = findMigrationPath(fromVersion, toVersion);
    return scripts.length > 0;
  }

  async function backupDatabase(
    backupPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI)
      return { success: false, error: "Electron API not available" };

    try {
      const data = {
        packConfigs: await db.packConfigs.toArray(),
        updateSettings: await db.updateSettings.toArray(),
        updateLogs: await db.updateLogs.toArray(),
        recentPaths: await db.recentPaths.toArray(),
      };

      const dbBackupPath = `${backupPath}/indexeddb-backup.json`;
      await window.electronAPI.fs.writeJson(dbBackupPath, data);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async function resetDatabase(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      migrating.value = true;
      migrationProgress.value = { step: "重置数据库...", percent: 50 };

      await Dexie.delete("HTMLReleaseUpdater");

      await db.open();

      migrationProgress.value = { step: "数据库重置完成", percent: 100 };
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      migrating.value = false;
    }
  }

  return {
    migrating,
    migrationProgress,
    registerMigration,
    executeMigration,
    restoreFromBackup,
    backupDatabase,
    resetDatabase,
    needsMigration,
  };
}
