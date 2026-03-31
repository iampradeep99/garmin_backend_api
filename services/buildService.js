const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../logger');

const buildsDir = path.join(process.cwd(), 'builds');
const pkgRoot = path.dirname(require.resolve('pkg/package.json'));
const pkgBin = path.join(pkgRoot, 'lib-es5', 'bin.js');
const buildJobs = new Map();

const platforms = {
  windows: {
    id: 'windows',
    label: 'Windows',
    target: 'node16-win-x64',
    extension: '.exe'
  },
  linux: {
    id: 'linux',
    label: 'Linux',
    target: 'node16-linux-x64',
    extension: ''
  },
  mac: {
    id: 'mac',
    label: 'macOS',
    target: 'node16-macos-x64',
    extension: ''
  }
};

function createJobId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function toDownloadUrl(fileName) {
  return `/api/builds/download/${encodeURIComponent(fileName)}`;
}

function detectPlatformFromFileName(fileName) {
  const value = String(fileName || '').toLowerCase();

  if (value.includes('-windows-')) {
    return platforms.windows;
  }

  if (value.includes('-linux-')) {
    return platforms.linux;
  }

  if (value.includes('-mac-')) {
    return platforms.mac;
  }

  return null;
}

function serializeJob(job) {
  return {
    id: job.id,
    platform: job.platform,
    label: job.label,
    target: job.target,
    status: job.status,
    phase: job.phase || null,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    file_name: job.file_name,
    download_url: job.download_url,
    size_bytes: job.size_bytes || 0,
    started_at: job.started_at,
    finished_at: job.finished_at || null,
    error: job.error || null
  };
}

async function ensureBuildDirectory() {
  await fsPromises.mkdir(buildsDir, { recursive: true });
}

async function removeFileIfExists(filePath) {
  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function findActiveJob(platform) {
  for (const job of buildJobs.values()) {
    if (job.platform === platform && (job.status === 'queued' || job.status === 'building')) {
      return serializeJob(job);
    }
  }

  return null;
}

function updateJob(job, nextState = {}) {
  Object.assign(job, nextState);
  job.updated_at = new Date().toISOString();
}

function setJobProgress(job, progress, phase) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  updateJob(job, {
    progress: Math.max(job.progress || 0, safeProgress),
    phase: phase || job.phase
  });
}

function handleBuildOutput(job, chunkText) {
  const value = chunkText.toLowerCase();

  if (value.includes('fetch') || value.includes('download')) {
    setJobProgress(job, 34, 'Collecting runtime assets');
    return;
  }

  if (value.includes('compil') || value.includes('bytecode')) {
    setJobProgress(job, 58, 'Compiling application snapshot');
    return;
  }

  if (value.includes('pack') || value.includes('target')) {
    setJobProgress(job, 76, 'Packaging application files');
    return;
  }

  if (value.trim()) {
    setJobProgress(job, Math.min((job.progress || 0) + 4, 86), 'Packaging application files');
  }
}

function runPkgBuild(job, target, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [pkgBin, 'server.js', '--targets', target, '--output', outputPath],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      handleBuildOutput(job, text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      handleBuildOutput(job, text);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `Build failed with exit code ${code}`));
    });
  });
}

async function executeBuildJob(job, outputPath, platform) {
  let progressTimer = null;

  try {
    updateJob(job, {
      status: 'building',
      phase: 'Preparing build environment',
      progress: 12
    });

    progressTimer = setInterval(() => {
      if (job.status !== 'building') {
        clearInterval(progressTimer);
        return;
      }

      if (job.progress < 90) {
        setJobProgress(job, job.progress + 3, 'Packaging application files');
      }
    }, 900);

    await removeFileIfExists(outputPath);
    await runPkgBuild(job, platform.target, outputPath);

    setJobProgress(job, 96, 'Finalizing artifact');

    const stats = await fsPromises.stat(outputPath);
    updateJob(job, {
      status: 'completed',
      phase: 'Build completed',
      progress: 100,
      size_bytes: stats.size,
      finished_at: new Date().toISOString()
    });
    logger.info(`Build completed for ${platform.label}: ${job.file_name}`);
  } catch (error) {
    updateJob(job, {
      status: 'failed',
      phase: 'Build failed',
      error: error.message,
      finished_at: new Date().toISOString()
    });
    await removeFileIfExists(outputPath);
    logger.error(`Build failed for ${platform.label}: ${error.message}`);
  } finally {
    if (progressTimer) {
      clearInterval(progressTimer);
    }
  }
}

async function listBuildFiles() {
  await ensureBuildDirectory();

  const entries = await fsPromises.readdir(buildsDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = path.join(buildsDir, entry.name);
    const stats = await fsPromises.stat(filePath);

    const detectedPlatform = detectPlatformFromFileName(entry.name);

    files.push({
      file_name: entry.name,
      platform: detectedPlatform ? detectedPlatform.id : null,
      platform_label: detectedPlatform ? detectedPlatform.label : 'Unknown',
      size_bytes: stats.size,
      created_at: stats.birthtime.toISOString(),
      updated_at: stats.mtime.toISOString(),
      download_url: toDownloadUrl(entry.name)
    });
  }

  return files.sort((first, second) => {
    return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime();
  });
}

async function deleteBuildFile(fileName) {
  await ensureBuildDirectory();

  const filePath = getBuildFilePath(fileName);

  if (!filePath) {
    const error = new Error('Invalid build file');
    error.statusCode = 400;
    throw error;
  }

  for (const job of buildJobs.values()) {
    if (job.file_name === path.basename(fileName) && (job.status === 'queued' || job.status === 'building')) {
      const error = new Error('Cannot delete a build that is currently in progress');
      error.statusCode = 409;
      throw error;
    }
  }

  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const notFoundError = new Error('Build file not found');
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    throw error;
  }

  return {
    file_name: path.basename(fileName)
  };
}

async function deployBuildFile(fileName, destinationDir) {
  await ensureBuildDirectory();

  const sourcePath = getBuildFilePath(fileName);

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    const error = new Error('Build file not found');
    error.statusCode = 404;
    throw error;
  }

  const targetDirInput = String(destinationDir || '').trim();

  if (!targetDirInput) {
    const error = new Error('Destination path is required');
    error.statusCode = 400;
    throw error;
  }

  const targetDir = path.resolve(targetDirInput);
  await fsPromises.mkdir(targetDir, { recursive: true });

  const destinationPath = path.join(targetDir, path.basename(fileName));
  await fsPromises.copyFile(sourcePath, destinationPath);

  return {
    file_name: path.basename(fileName),
    deployed_path: destinationPath
  };
}

async function createBuild(platformKey) {
  const platform = platforms[platformKey];

  if (!platform) {
    const error = new Error('Invalid platform selected');
    error.statusCode = 400;
    throw error;
  }

  const activeJob = findActiveJob(platformKey);

  if (activeJob) {
    const error = new Error(`${platform.label} build is already in progress`);
    error.statusCode = 409;
    error.data = activeJob;
    throw error;
  }

  await ensureBuildDirectory();

  const fileName = `garmin-backend-${platform.id}-${createTimestamp()}${platform.extension}`;
  const outputPath = path.join(buildsDir, fileName);
  const job = {
    id: createJobId(),
    platform: platform.id,
    label: platform.label,
    target: platform.target,
    status: 'queued',
    phase: 'Queued for packaging',
    progress: 4,
    file_name: fileName,
    download_url: toDownloadUrl(fileName),
    started_at: new Date().toISOString()
  };

  buildJobs.set(job.id, job);
  logger.info(`Build started for ${platform.label} at ${outputPath}`);
  void executeBuildJob(job, outputPath, platform);

  return serializeJob(job);
}

function listBuildJobs() {
  return Array.from(buildJobs.values())
    .map(serializeJob)
    .sort((first, second) => new Date(second.started_at).getTime() - new Date(first.started_at).getTime());
}

function getBuildFilePath(fileName) {
  const safeName = path.basename(fileName);
  const filePath = path.join(buildsDir, safeName);
  const resolved = path.resolve(filePath);
  const resolvedBuildsDir = path.resolve(buildsDir);

  if (!resolved.startsWith(resolvedBuildsDir)) {
    return null;
  }

  return resolved;
}

function getBuildJob(jobId) {
  const job = buildJobs.get(jobId);
  return job ? serializeJob(job) : null;
}

module.exports = {
  platforms,
  createBuild,
  deleteBuildFile,
  deployBuildFile,
  getBuildJob,
  listBuildFiles,
  listBuildJobs,
  getBuildFilePath,
  ensureBuildDirectory
};
