// js/db.js

const DB_NAME = 'MusicFlowDB';
const DB_VERSION = 1;

export class MusicFlowDB {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Erro no IndexedDB:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('playlists')) {
                    db.createObjectStore('playlists', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('favorites')) {
                    db.createObjectStore('favorites', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('playbackPositions')) {
                    db.createObjectStore('playbackPositions', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('stats')) {
                    db.createObjectStore('stats', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('audioCache')) {
                    // Pra guardar os arquivos locais (Blob/File) persistidos pra tocar offline sem recarregar o arquivo
                    db.createObjectStore('audioCache', { keyPath: 'id' });
                }
            };
        });
    }

    async getStore(storeName, mode = 'readonly') {
        await this.initPromise;
        const tx = this.db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    }

    async get(storeName, id) {
        const store = await this.getStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getAll(storeName) {
        const store = await this.getStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async put(storeName, item) {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.put(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async delete(storeName, id) {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async clear(storeName) {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // Limpeza automática de dados muito antigos no cache de áudio (LRU eviction wrapper type)
    async enforceCacheLimit(limit = 50) {
        const all = await this.getAll('audioCache');
        if (all.length > limit) {
            // Ordena pelos mais antigos (supondo que tenham um timestamp lastAccessed)
            all.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
            const toDelete = all.slice(0, all.length - limit);
            for (let item of toDelete) {
                await this.delete('audioCache', item.id);
            }
        }
    }
}

export const db = new MusicFlowDB();
