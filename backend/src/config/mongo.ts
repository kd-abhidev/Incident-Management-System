import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../config';
import { RawSignal } from '../models/signal.model';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (!db) {
    client = new MongoClient(config.mongo.url, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10_000,
    });
    await client.connect();
    db = client.db(config.mongo.dbName);

    // Create indexes for common queries
    const signals = db.collection<RawSignal>(config.mongo.signalsCollection);
    await signals.createIndex({ component_id: 1, received_at: -1 });
    await signals.createIndex({ work_item_id: 1 });
    await signals.createIndex({ received_at: -1 });

    console.log('[MongoDB] Connected and indexes ensured');
  }
  return db;
}

export async function getSignalsCollection(): Promise<Collection<RawSignal>> {
  const database = await getMongoDb();
  return database.collection<RawSignal>(config.mongo.signalsCollection);
}

export async function checkMongoHealth(): Promise<boolean> {
  try {
    const database = await getMongoDb();
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

