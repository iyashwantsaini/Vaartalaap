import type { Collection, Db, Document } from "mongodb";
import { MongoClient } from "mongodb";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";

let client: MongoClient | null = null;
let database: Db | null = null;

export const initDb = async (): Promise<Db> => {
  if (database) {
    return database;
  }

  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  database = client.db();
  logger.info(`Connected to MongoDB • ${database.databaseName}`);

  await database.collection("rooms").createIndex({ roomId: 1 }, { unique: true });
  // TTL: auto-expire rooms after 30 days (rooms.createdAt set on insert).
  await database
    .collection("rooms")
    .createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

  // yjsDocs: composite uniqueness + TTL on updatedAt. 30 days of inactivity
  // ⇒ doc is dropped. updatedAt is refreshed on every persist, so active
  // docs never expire while the room is in use.
  await database
    .collection("yjsDocs")
    .createIndex({ roomId: 1, docName: 1 }, { unique: true });
  await database
    .collection("yjsDocs")
    .createIndex({ updatedAt: 1 }, { expireAfterSeconds: 2592000 });

  return database;
};

export const getCollection = <TSchema extends Document = Document>(name: string): Collection<TSchema> => {
  if (!database) {
    throw new Error("Database not initialised. Call initDb() first.");
  }
  return database.collection<TSchema>(name);
};

export const closeDb = async () => {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
};
