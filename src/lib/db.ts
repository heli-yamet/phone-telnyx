import mongoose from "mongoose";

const globalWithMongoose = global as typeof globalThis & {
  mongoosePromise?: Promise<typeof mongoose>;
};

export async function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.DB_URL?.trim();
  if (!uri) {
    throw new Error("DB_URL is not configured");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!globalWithMongoose.mongoosePromise) {
    globalWithMongoose.mongoosePromise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  await globalWithMongoose.mongoosePromise;
  return mongoose;
}
