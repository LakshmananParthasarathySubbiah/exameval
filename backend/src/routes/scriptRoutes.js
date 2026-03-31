const router = require('express').Router();
const controller = require('../controllers/scriptController');
const { authenticate } = require('../middleware/auth');
const { uploadScripts } = require('../middleware/upload');

router.use(authenticate);

router.get('/', controller.getScripts);
router.get('/:id', controller.getScript);

router.post('/upload', (req, res, next) => {
  req.uploadSubDir = 'scripts';
  next();
}, uploadScripts.array('files', 50), controller.uploadScript);

router.delete('/:id', controller.deleteScript);

module.exports = router;