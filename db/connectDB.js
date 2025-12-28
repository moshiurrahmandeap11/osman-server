import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const uri = process.env.HADI_MONGO_URI;

let client;
let db;

const connectDB = async () => {
  try {
    if (!client) {
      client = new MongoClient(uri);
      await client.connect();
      db = client.db(); 
      console.log("✅ MongoDB connected");
    }
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export { connectDB, db };
