const os = require('os');

const AlertJob = require('../models/alertJob');
const logger = require('../utils/logger');
const { evaluateAndDispatchAlertForJob } = require('./alertEvaluationService');

const POLL_MS = parseInt(process.env.ALERT_JOB_POLL_MS || '3000', 10);
const LOCK_TTL_MS = parseInt(process.env.ALERT_JOB_LOCK_TTL_MS || '60000', 10);
const MAX_ATTEMPTS = parseInt(process.env.ALERT_JOB_MAX_ATTEMPTS || '5', 10);
const CONCURRENCY = parseInt(process.env.ALERT_JOB_WORKER_CONCURRENCY || '2', 10);
const WORKER_ID = `${os.hostname()}-${process.pid}`;

let workerStarted = false;

function buildDedupeKey(userId, metricType) {
  return `${userId}:${metricType}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueAlertJob({ userId, metricType, source, sourceId, sourceIds = [] }) {
  const now = new Date();
  const dedupeKey = buildDedupeKey(userId, metricType);
  const normalizedSourceIds = [
    ...new Set(
      [sourceId, ...sourceIds]
        .filter(Boolean)
        .map((value) => String(value))
    )
  ];

  const update = {
    $set: {
      available_at: now,
      locked_at: null,
      locked_by: null,
      last_error: null,
      'payload.source': source || null,
      'payload.last_received_at': now
    },
    $addToSet: {}
  };

  if (normalizedSourceIds.length) {
    update.$addToSet['payload.source_ids'] = { $each: normalizedSourceIds };
  } else {
    delete update.$addToSet;
  }

  const existingJob = await AlertJob.findOneAndUpdate(
    {
      dedupe_key: dedupeKey,
      status: { $in: ['pending', 'retry'] }
    },
    update,
    { returnDocument: 'after' }
  );

  if (existingJob) {
    logger.info(`Alert job refreshed: ${dedupeKey}`);
    return existingJob;
  }

  const job = await AlertJob.create({
    user_id: userId,
    metric_type: metricType,
    dedupe_key: dedupeKey,
    status: 'pending',
    attempts: 0,
    max_attempts: MAX_ATTEMPTS,
    available_at: now,
    payload: {
      source: source || null,
      source_ids: normalizedSourceIds,
      last_received_at: now
    }
  });

  logger.info(`Alert job queued: ${dedupeKey}`);
  return job;
}

async function claimNextJob() {
  const now = new Date();
  const staleLockTime = new Date(Date.now() - LOCK_TTL_MS);

  return AlertJob.findOneAndUpdate(
    {
      $or: [
        {
          status: { $in: ['pending', 'retry'] },
          available_at: { $lte: now }
        },
        {
          status: 'processing',
          locked_at: { $lte: staleLockTime }
        }
      ]
    },
    {
      $set: {
        status: 'processing',
        locked_at: now,
        locked_by: WORKER_ID,
        last_error: null
      },
      $inc: {
        attempts: 1
      }
    },
    {
      returnDocument: 'after',
      sort: {
        available_at: 1,
        createdAt: 1
      }
    }
  );
}

async function markJob(jobId, fields) {
  await AlertJob.updateOne(
    { _id: jobId },
    {
      $set: {
        ...fields,
        locked_at: null,
        locked_by: null
      }
    }
  );
}

function getRetryDelayMs(attempts) {
  const seconds = Math.min(60, Math.pow(2, Math.max(0, attempts - 1)) * 5);
  return seconds * 1000;
}

async function processJob(job) {
  try {
    const result = await evaluateAndDispatchAlertForJob(job);

    if (result.status === 'completed') {
      await markJob(job._id, {
        status: 'completed',
        last_error: null
      });
      return;
    }

    await markJob(job._id, {
      status: 'skipped',
      last_error: result.reason || null
    });
  } catch (error) {
    const retryable = job.attempts < job.max_attempts;
    const nextRun = new Date(Date.now() + getRetryDelayMs(job.attempts));

    await markJob(job._id, {
      status: retryable ? 'retry' : 'failed',
      last_error: error.message,
      available_at: retryable ? nextRun : job.available_at
    });

    logger.error(`Alert job failed: ${job.dedupe_key}`, error);
  }
}

async function workerLoop(slot) {
  for (;;) {
    try {
      const job = await claimNextJob();

      if (!job) {
        await sleep(POLL_MS);
        continue;
      }

      await processJob(job);
    } catch (error) {
      logger.error(`Alert job worker loop error [${slot}]`, error);
      await sleep(POLL_MS);
    }
  }
}

function startAlertJobWorker() {
  if (workerStarted) {
    return;
  }

  workerStarted = true;

  for (let slot = 0; slot < CONCURRENCY; slot += 1) {
    void workerLoop(slot);
  }

  logger.info(`Alert job worker started | concurrency=${CONCURRENCY} | worker=${WORKER_ID}`);
}

module.exports = {
  enqueueAlertJob,
  startAlertJobWorker
};
