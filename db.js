// db.js
import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let db;

export async function connect() {
  if (!db) {
    await client.connect();
    db = client.db('kafka_stream_db');
  }
  return db;
}

export function getMessagesCollection() {
  if (!db) throw new Error('Database not connected');
  return db.collection('messages');
}
