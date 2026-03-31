const router = require('express').Router();
const controller = require('../controllers/scriptController');
const { authenticate } = require('../middleware/auth');
const { uploadScripts } = require('../middleware/upload');
const { getSignedUrl } = require('../utils/cloudinary');
const scriptService = require('../services/scriptService');

router.use(authenticate);

router.get('/', controller.getScripts);
router.get('/:id', controller.getScript);

router.get('/:id/preview-url', async (req, res, next) => {
  try {
    const script = await scriptService.getScriptById(req.params.id);
    const url = await getSignedUrl(script.filePath);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

router.post('/upload', (req, res, next) => {
  req.uploadSubDir = 'scripts';
  next();
}, uploadScripts.array('files', 50), controller.uploadScript);

router.delete('/:id', controller.deleteScript);

module.exports = router;