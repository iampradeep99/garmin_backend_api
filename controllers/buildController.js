const fs = require('fs');
const {
  platforms,
  createBuild,
  deleteBuildFile,
  deployBuildFile,
  getBuildJob,
  listBuildFiles,
  listBuildJobs,
  getBuildFilePath,
  ensureBuildDirectory
} = require('../services/buildService');

async function listBuildResources(req, res) {
  try {
    await ensureBuildDirectory();

    const items = await listBuildFiles();
    const jobs = listBuildJobs();

    return res.status(200).json({
      ok: true,
      platforms: Object.values(platforms),
      jobs,
      files: items
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message
    });
  }
}

async function createBuildArtifact(req, res) {
  const platform = req.body?.platform;

  try {
    const job = await createBuild(platform);

    return res.status(202).json({
      ok: true,
      message: `${job.label} build started successfully`,
      job
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message,
      job: error.data || null
    });
  }
}

function getBuildArtifactStatus(req, res) {
  const job = getBuildJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      ok: false,
      message: 'Build job not found'
    });
  }

  return res.status(200).json({
    ok: true,
    job
  });
}

async function downloadBuildArtifact(req, res) {
  try {
    await ensureBuildDirectory();

    const filePath = getBuildFilePath(req.params.fileName);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        ok: false,
        message: 'Build file not found'
      });
    }

    return res.download(filePath);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message
    });
  }
}

async function deleteBuildArtifact(req, res) {
  try {
    const removed = await deleteBuildFile(req.params.fileName);

    return res.status(200).json({
      ok: true,
      message: `${removed.file_name} deleted successfully`
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message
    });
  }
}

async function deployBuildArtifact(req, res) {
  try {
    const deployed = await deployBuildFile(req.params.fileName, req.body?.destination_path);

    return res.status(200).json({
      ok: true,
      message: `${deployed.file_name} deployed successfully`,
      deployed
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message
    });
  }
}

module.exports = {
  listBuildResources,
  createBuildArtifact,
  deleteBuildArtifact,
  deployBuildArtifact,
  getBuildArtifactStatus,
  downloadBuildArtifact
};
