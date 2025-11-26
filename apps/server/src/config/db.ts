import type { Collection, Db, Document } from "mongodb";
import { MongoClient } from "mongodb";
import { env } from "./env";
import { logger } from "../lib/logger";

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
