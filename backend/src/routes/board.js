const express = require('express');
const router = express.Router();
const pipeline = require('../services/pipeline');

router.post('/review/:id', async (req, res) => {
  try {
    const result = await pipeline.runBoardReview(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
