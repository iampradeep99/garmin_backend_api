#!/usr/bin/env node
'use strict';

// Generates idempotent dummy data for the main MongoDB collections.
// Run with `node bin/seedDummyData.js` or add `--reset` to clear the
// existing seedable collections before inserting.

require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { connectMongo, closeMongo } = require('../database/mongo');
const AppUser = require('../models/appUser');
const GarminAuth = require('../models/garminAuthModel');
const GarminDailySummary = require('../models/garmindailySummary');
const GarminHeartRate = require('../models/garminHeartRates');
const GarminBloodPressure = require('../models/garminBloodPressure');

const SHOULD_RESET = process.argv.includes('--reset');

const USERS = [
  {
    user_id: 100001,
    fullname: 'Alice Runner',
    mobile_number: '555-100-001',
    email: 'alice@example.com',
    dob: '1990-05-14',
    gender: 'female',
    height_cm: 165,
    weight_kg: 62,
    password: 'Password123!'
  },
  {
    user_id: 100002,
    fullname: 'Ben Cyclist',
    mobile_number: '555-100-002',
    email: 'ben@example.com',
    dob: '1987-09-02',
    gender: 'male',
    height_cm: 178,
    weight_kg: 75,
    password: 'Password123!'
  },
  {
    user_id: 100003,
    fullname: 'Chloe Hiker',
    mobile_number: '555-100-003',
    email: 'chloe@example.com',
    dob: '1995-12-21',
    gender: 'female',
    height_cm: 170,
    weight_kg: 68,
    password: 'Password123!'
  }
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startOfDayUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function encodedUserId(userId) {
  return `enc-${userId}`;
}

async function clearCollections() {
  await Promise.all([
    AppUser.deleteMany({}),
    GarminAuth.deleteMany({}),
    GarminDailySummary.deleteMany({}),
    GarminHeartRate.deleteMany({}),
    GarminBloodPressure.deleteMany({})
  ]);
}

async function seedUsersAndAuth() {
  const map = new Map();

  for (const baseUser of USERS) {
    const hashedPassword = await bcrypt.hash(baseUser.password, 10);
    const userDoc = {
      ...baseUser,
      dob: baseUser.dob ? new Date(baseUser.dob) : null,
      password: hashedPassword
    };

    await AppUser.updateOne(
      { user_id: userDoc.user_id },
      { $set: userDoc },
      { upsert: true }
    );

    const encoded = encodedUserId(userDoc.user_id);
    const authDoc = {
      user_id: userDoc.user_id,
      access_token: crypto.randomBytes(12).toString('hex'),
      access_token_secret: crypto.randomBytes(12).toString('hex'),
      encoded_user_id: encoded,
      expires_in: 7200,
      connected_at: new Date(Date.now() - randInt(1, 10) * 24 * 60 * 60 * 1000),
      is_connected: true,
      oauth_token: null,
      oauth_token_secret: null,
      connected_garmin_user_id: `garmin-${userDoc.user_id}`
    };

    await GarminAuth.updateOne(
      { user_id: authDoc.user_id },
      { $set: authDoc },
      { upsert: true }
    );

    map.set(userDoc.user_id, { encoded });
  }

  return map;
}

async function seedDailySummaries(userMap) {
  const today = startOfDayUTC(new Date());
  const operations = [];

  for (const [userId, { encoded }] of userMap.entries()) {
    for (let i = 0; i < 7; i++) {
      const day = startOfDayUTC(new Date(today.getTime() - i * 24 * 60 * 60 * 1000));
      const steps = randInt(4000, 14000);
      const dateKey = day.toISOString().slice(0, 10);

      operations.push({
        updateOne: {
          filter: { user_id: userId, calendar_date: day },
          update: {
            $set: {
              encoded_user_id: encoded,
              steps,
              distance_meters: Math.round(steps * 0.78),
              active_kcal: randInt(300, 900),
              bmr_kcal: randInt(1400, 1950),
              avg_heart_rate: randInt(60, 145),
              resting_heart_rate: randInt(52, 76),
              stress_avg: randInt(10, 45),
              stress_max: randInt(25, 80),
              summary_id: `sum-${userId}-${dateKey}`
            },
            $setOnInsert: {
              user_id: userId,
              calendar_date: day
            }
          },
          upsert: true
        }
      });
    }
  }

  if (!operations.length) return { upserted: 0, modified: 0 };

  const result = await GarminDailySummary.bulkWrite(operations);
  return {
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0
  };
}

async function seedHeartRates(userMap) {
  const now = Math.floor(Date.now() / 1000);
  const operations = [];

  for (const [userId, { encoded }] of userMap.entries()) {
    for (let i = 0; i < 48; i++) {
      const timestamp = now - i * 15 * 60; // every 15 minutes
      const heartRate = randInt(55, 175);
      const source = i % 6 === 0 ? 'daily' : 'epoch';

      operations.push({
        updateOne: {
          filter: { user_id: userId, timestamp },
          update: {
            $set: {
              encoded_user_id: encoded,
              heart_rate: heartRate,
              source,
              user_id: userId,
              timestamp
            }
          },
          upsert: true
        }
      });
    }
  }

  if (!operations.length) return { upserted: 0, modified: 0 };

  const result = await GarminHeartRate.bulkWrite(operations);
  return {
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0
  };
}

async function seedBloodPressure(userMap) {
  const now = Math.floor(Date.now() / 1000);
  const operations = [];

  for (const [userId, { encoded }] of userMap.entries()) {
    for (let i = 0; i < 8; i++) {
      const measurementTime = now - i * 6 * 60 * 60; // every 6 hours
      const summaryId = `bp-${userId}-${measurementTime}`;

      operations.push({
        updateOne: {
          filter: { summary_id: summaryId },
          update: {
            $set: {
              user_id: userId,
              encoded_user_id: encoded,
              measurement_time: measurementTime,
              systolic: randInt(105, 145),
              diastolic: randInt(65, 95),
              pulse: randInt(55, 95),
              summary_id: summaryId
            }
          },
          upsert: true
        }
      });
    }
  }

  if (!operations.length) return { upserted: 0, modified: 0 };

  const result = await GarminBloodPressure.bulkWrite(operations);
  return {
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0
  };
}

async function run() {
  try {
    await connectMongo();

    if (SHOULD_RESET) {
      await clearCollections();
      console.log('Cleared existing documents (--reset flag used).');
    }

    const userMap = await seedUsersAndAuth();
    const dailyResult = await seedDailySummaries(userMap);
    const heartResult = await seedHeartRates(userMap);
    const bpResult = await seedBloodPressure(userMap);

    console.log('\nDummy data ready.');
    console.table({
      users: userMap.size,
      daily_upserted: dailyResult.upserted,
      heart_upserted: heartResult.upserted,
      bp_upserted: bpResult.upserted
    });
  } catch (err) {
    console.error('Failed to seed dummy data:', err);
    process.exitCode = 1;
  } finally {
    await closeMongo().catch(() => {});
  }
}

run();
