const express = require('express');
const {
  listBuildResources,
  createBuildArtifact,
  deleteBuildArtifact,
  deployBuildArtifact,
  getBuildArtifactStatus,
  downloadBuildArtifact
} = require('../controllers/buildController');

const router = express.Router();

router.get('/', listBuildResources);
router.post('/', createBuildArtifact);
router.delete('/file/:fileName', deleteBuildArtifact);
router.post('/deploy/:fileName', deployBuildArtifact);
router.get('/:jobId', getBuildArtifactStatus);
router.get('/download/:fileName', downloadBuildArtifact);

module.exports = router;
