// IndexedDB utilities for offline data storage and queue management

const DB_NAME = 'clean-machine-offline';
const DB_VERSION = 1;
const STORES = {
  DASHBOARD: 'dashboard-cache',
  APPOINTMENTS: 'appointments-cache',
  CUSTOMERS: 'customers-cache',
  DRAFTS: 'drafts',
  MUTATION_QUEUE: 'mutation-queue',
};

interface QueuedMutation {
  id?: number;
  url: string;
  method: string;
  data: any;
  timestamp: number;
  retries?: number;
}

class OfflineDb {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineDB] Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.DASHBOARD)) {
          db.createObjectStore(STORES.DASHBOARD, { keyPath: 'date' });
        }
        if (!db.objectStoreNames.contains(STORES.APPOINTMENTS)) {
          db.createObjectStore(STORES.APPOINTMENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
          db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'phone' });
        }
        if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
          db.createObjectStore(STORES.DRAFTS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.MUTATION_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.MUTATION_QUEUE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('[OfflineDB] Database upgraded');
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Dashboard cache methods
  async cacheDashboardData(date: string, data: any): Promise<void> {
    const store = this.getStore(STORES.DASHBOARD, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ date, data, cachedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDashboardData(date: string): Promise<any> {
    const store = this.getStore(STORES.DASHBOARD);
    return new Promise((resolve, reject) => {
      const request = store.get(date);
      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });
  }

  // Appointments cache methods
  async cacheAppointments(appointments: any[]): Promise<void> {
    const store = this.getStore(STORES.APPOINTMENTS, 'readwrite');
    return new Promise((resolve, reject) => {
      const transaction = store.transaction;
      
      appointments.forEach(apt => {
        store.put({ ...apt, cachedAt: Date.now() });
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAppointments(): Promise<any[]> {
    const store = this.getStore(STORES.APPOINTMENTS);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Draft persistence methods
  async saveDraft(key: string, content: any): Promise<void> {
    const store = this.getStore(STORES.DRAFTS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, content, savedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDraft(key: string): Promise<any> {
    const store = this.getStore(STORES.DRAFTS);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.content);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDraft(key: string): Promise<void> {
    const store = this.getStore(STORES.DRAFTS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Mutation queue methods
  async queueMutation(mutation: QueuedMutation): Promise<void> {
    const store = this.getStore(STORES.MUTATION_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add({
        ...mutation,
        retries: 0,
        timestamp: mutation.timestamp || Date.now()
      });
      request.onsuccess = () => {
        console.log('[OfflineDB] Mutation queued:', mutation.url);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedMutations(): Promise<QueuedMutation[]> {
    const store = this.getStore(STORES.MUTATION_QUEUE);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeMutation(id: number): Promise<void> {
    const store = this.getStore(STORES.MUTATION_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        console.log('[OfflineDB] Mutation removed:', id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearQueue(): Promise<void> {
    const store = this.getStore(STORES.MUTATION_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        console.log('[OfflineDB] Queue cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const offlineDb = new OfflineDb();

// Initialize on module load
offlineDb.init().catch(error => {
  console.error('[OfflineDB] Failed to initialize:', error);
});

// OfflineQueue utility class
export class OfflineQueue {
  static async add(url: string, method: string, data: any): Promise<void> {
    await offlineDb.queueMutation({
      url,
      method,
      data,
      timestamp: Date.now()
    });

    // Register background sync if available
    if ('serviceWorker' in navigator && 'sync' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-mutations');
        console.log('[OfflineQueue] Background sync registered');
      } catch (error) {
        console.error('[OfflineQueue] Failed to register sync:', error);
      }
    }
  }

  static async processQueue(): Promise<void> {
    const mutations = await offlineDb.getQueuedMutations();
    
    console.log(`[OfflineQueue] Processing ${mutations.length} queued mutations`);

    for (const mutation of mutations) {
      try {
        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mutation.data),
        });

        if (response.ok) {
          await offlineDb.removeMutation(mutation.id!);
          console.log('[OfflineQueue] Mutation processed successfully:', mutation.url);
        } else {
          console.error('[OfflineQueue] Mutation failed:', response.statusText);
        }
      } catch (error) {
        console.error('[OfflineQueue] Error processing mutation:', error);
      }
    }
  }

  static async clear(): Promise<void> {
    await offlineDb.clearQueue();
  }
}
