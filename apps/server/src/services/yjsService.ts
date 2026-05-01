import * as Y from "yjs";
import { Binary } from "mongodb";
import { getCollection } from "../config/db.js";
import { logger } from "../lib/logger.js";

// One Y.Doc per (roomId, docName). Kept in memory for the lifetime of the
// process so we can apply updates and serve sync responses cheaply. Persisted
// to MongoDB (debounced) so a server restart or a fully-empty room can
// rehydrate state on the next join.
//
// docName examples:
//   "code:cpp", "code:python"  - per-language code buffers
//   "notes"                    - shared notepad
// The set of doc names is open — clients drive it.
const PERSIST_DEBOUNCE_MS = 1500;
const MAX_DOC_BYTES = 1_000_000; // 1 MB per doc — defensive cap

interface DocEntry {
  doc: Y.Doc;
  // Pending persistence timer (debounced).
  persistTimer: ReturnType<typeof setTimeout> | null;
  // True once the initial load from Mongo has been attempted (success or empty).
  loaded: boolean;
}

interface YjsDocRecord {
  roomId: string;
  docName: string;
  state: Binary;
  updatedAt: Date;
}

class YjsService {
  // Composite key: `${roomId}::${docName}`
  #docs = new Map<string, DocEntry>();

  #collection = () => getCollection<YjsDocRecord>("yjsDocs");

  #key(roomId: string, docName: string) {
    return `${roomId}::${docName}`;
  }

  /**
   * Get (or lazily create) a Y.Doc for this room+docName, hydrating from
   * Mongo on first access. Subsequent calls return the same in-memory doc.
   */
  async getDoc(roomId: string, docName: string): Promise<Y.Doc> {
    const key = this.#key(roomId, docName);
    let entry = this.#docs.get(key);
    if (!entry) {
      entry = { doc: new Y.Doc(), persistTimer: null, loaded: false };
      this.#docs.set(key, entry);
    }
    if (!entry.loaded) {
      try {
        const record = await this.#collection().findOne({ roomId, docName });
        if (record?.state) {
          const buf = record.state.buffer;
          // Buffer might be a Node Buffer (which extends Uint8Array) or a
          // raw ArrayBuffer slice — normalise.
          const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
          Y.applyUpdate(entry.doc, bytes);
        }
      } catch (err) {
        logger.error(`yjs: failed to load ${key}`, err);
      }
      entry.loaded = true;
    }
    return entry.doc;
  }

  /**
   * Apply an incoming binary update to the room's doc and schedule a debounced
   * persist. Returns the entry so the caller can decide whether to broadcast.
   */
  async applyUpdate(roomId: string, docName: string, update: Uint8Array): Promise<void> {
    if (update.byteLength > MAX_DOC_BYTES) {
      logger.warn(`yjs: rejecting oversized update (${update.byteLength}) for ${roomId}/${docName}`);
      return;
    }
    const doc = await this.getDoc(roomId, docName);
    Y.applyUpdate(doc, update);
    this.#schedulePersist(roomId, docName);
  }

  /**
   * Encode the current state vector for a peer's sync request, and the full
   * doc state for sync step 2. Returned as Uint8Array — caller is responsible
   * for transporting it (Socket.IO handles binary natively).
   */
  async encodeStateAsUpdate(roomId: string, docName: string, encodedTargetStateVector?: Uint8Array): Promise<Uint8Array> {
    const doc = await this.getDoc(roomId, docName);
    return Y.encodeStateAsUpdate(doc, encodedTargetStateVector);
  }

  async encodeStateVector(roomId: string, docName: string): Promise<Uint8Array> {
    const doc = await this.getDoc(roomId, docName);
    return Y.encodeStateVector(doc);
  }

  /**
   * Atomically seed a Y.Text inside the doc if and only if it is currently
   * empty. Returns the resulting binary update (encoded against an empty
   * state vector) so the caller can broadcast it to every peer — including
   * the requester, who otherwise wouldn't have the seed locally.
   *
   * This is the single source of truth for "first user picks the template":
   * doing the empty-check + insert in one synchronous block on the in-memory
   * Y.Doc is race-free (Node is single-threaded) and prevents the duplicate-
   * seed problem when two tabs join an empty room simultaneously.
   */
  async seedIfEmpty(
    roomId: string,
    docName: string,
    textKey: string,
    text: string
  ): Promise<Uint8Array | null> {
    if (!text) return null;
    if (text.length > MAX_DOC_BYTES) return null;
    const doc = await this.getDoc(roomId, docName);
    const ytext = doc.getText(textKey);
    if (ytext.length > 0) return null;
    const sv = Y.encodeStateVector(doc);
    doc.transact(() => {
      ytext.insert(0, text);
    });
    this.#schedulePersist(roomId, docName);
    // Encode just the diff since the pre-seed state vector — small payload.
    return Y.encodeStateAsUpdate(doc, sv);
  }

  #schedulePersist(roomId: string, docName: string) {
    const key = this.#key(roomId, docName);
    const entry = this.#docs.get(key);
    if (!entry) return;
    if (entry.persistTimer) clearTimeout(entry.persistTimer);
    entry.persistTimer = setTimeout(() => {
      void this.#persist(roomId, docName);
    }, PERSIST_DEBOUNCE_MS);
  }

  async #persist(roomId: string, docName: string) {
    const key = this.#key(roomId, docName);
    const entry = this.#docs.get(key);
    if (!entry) return;
    entry.persistTimer = null;
    try {
      const state = Y.encodeStateAsUpdate(entry.doc);
      await this.#collection().updateOne(
        { roomId, docName },
        {
          $set: {
            roomId,
            docName,
            state: new Binary(Buffer.from(state)),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (err) {
      logger.error(`yjs: failed to persist ${key}`, err);
    }
  }
}

export const yjsService = new YjsService();
