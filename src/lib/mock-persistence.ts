/**
 * Lightweight JSON file-based persistence for mock mode.
 * 
 * Design: All data is stored as a single JSON object keyed by "store name".
 * Each store is an array of [key, value] tuples (Map serialization format).
 * This is intentionally generic — new stores can be added without changing
 * the persistence logic. The engine auto-saves on every mutation.
 * 
 * IMPORTANT: This module uses ZERO top-level Node.js imports. All fs/path
 * operations use inline require() so this file is safe to import in both
 * server and client bundles. The persistence functions gracefully no-op
 * when running in the browser.
 */

interface SaveData {
  _meta: {
    version: 1;
    savedAt: string;
    description: string;
  };
  stores: Record<string, [string, unknown][]>;
}

function isServer(): boolean {
  return typeof window === "undefined";
}

function getSaveDir(): string {
  const path = require("path");
  return path.join(process.cwd(), "data");
}

function getSaveFileInternal(): string {
  const path = require("path");
  return path.join(process.cwd(), "data", "mock-save.json");
}

function dataDirExists(): boolean {
  if (!isServer()) return false;
  try {
    const fs = require("fs");
    return fs.existsSync(getSaveDir());
  } catch {
    return false;
  }
}

/**
 * Create the data directory. Called from the Setup Wizard API route.
 * Returns true if the directory was created or already exists.
 */
export function ensureDataDir(): boolean {
  if (!isServer()) return false;
  try {
    const fs = require("fs");
    const dir = getSaveDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch (err) {
    console.warn("[MockPersistence] Failed to create data directory:", err);
    return false;
  }
}

/**
 * Load entire save file from disk. Returns null if no save file exists,
 * or if running in the browser.
 */
export function loadSaveFile(): SaveData | null {
  if (!isServer()) return null;
  try {
    const fs = require("fs");
    const filePath = getSaveFileInternal();
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SaveData;
  } catch (err) {
    console.warn("[MockPersistence] Failed to read save file:", err);
    return null;
  }
}

/**
 * Load a specific store (Map) from the save file.
 */
export function loadStore<V = unknown>(storeName: string): Map<string, V> | null {
  const data = loadSaveFile();
  if (!data || !data.stores[storeName]) return null;
  return new Map(data.stores[storeName] as [string, V][]);
}

/**
 * Persist a specific store (Map) to disk, merging with existing stores.
 * Called automatically on every write operation.
 * Silently no-ops if the data directory doesn't exist yet.
 */
export function saveStore<V = unknown>(storeName: string, map: Map<string, V>): void {
  if (!isServer() || !dataDirExists()) return;

  try {
    const fs = require("fs");

    let data = loadSaveFile();
    if (!data) {
      data = {
        _meta: {
          version: 1,
          savedAt: new Date().toISOString(),
          description: "Price Guard mock data save file",
        },
        stores: {},
      };
    }

    data.stores[storeName] = Array.from(map.entries()) as [string, unknown][];
    data._meta.savedAt = new Date().toISOString();

    fs.writeFileSync(getSaveFileInternal(), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[MockPersistence] Failed to write save file:", err);
  }
}

/**
 * Export the entire save data as a JSON object (for API download).
 */
export function exportSaveData(): SaveData {
  const data = loadSaveFile();
  if (data) return data;

  return {
    _meta: {
      version: 1,
      savedAt: new Date().toISOString(),
      description: "Price Guard mock data save file (empty)",
    },
    stores: {},
  };
}

/**
 * Import a full save file from an uploaded JSON blob. Overwrites existing data.
 */
export function importSaveData(data: SaveData): boolean {
  if (!isServer()) return false;
  try {
    if (!data._meta || data._meta.version !== 1) {
      console.error("[MockPersistence] Incompatible save file version.");
      return false;
    }

    ensureDataDir();
    const fs = require("fs");
    data._meta.savedAt = new Date().toISOString();
    fs.writeFileSync(getSaveFileInternal(), JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[MockPersistence] Failed to import save data:", err);
    return false;
  }
}

/**
 * Get the path to the save file (for UI display).
 */
export function getSaveFilePath(): string {
  if (!isServer()) return "data/mock-save.json";
  return getSaveFileInternal();
}

/**
 * Check whether a save file exists on disk.
 */
export function hasSaveFile(): boolean {
  if (!isServer()) return false;
  try {
    const fs = require("fs");
    return fs.existsSync(getSaveFileInternal());
  } catch {
    return false;
  }
}
