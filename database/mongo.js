const mongoose = require('mongoose');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;

  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error('MONGO_URL not defined');

  await mongoose.connect(uri, {
    maxPoolSize: 10
  });

  isConnected = true;
  console.log('MongoDB connected');
  return mongoose.connection;
}

function getDb() {
  if (!isConnected) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return mongoose.connection;
}

async function closeMongo() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB connection closed');
  }
}

module.exports = {
  connectMongo,
  getDb,
  closeMongo
};
