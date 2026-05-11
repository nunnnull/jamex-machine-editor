const express = require('express');
const router = express.Router();
const queries = require('../database/queries');
const logger = require('../services/logger');

router.get('/auctions', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const auctions = await queries.getAuctions({
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ success: true, data: auctions, count: auctions.length });
  } catch (error) {
    logger.error('[API] Failed to get auctions', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get auctions' });
  }
});

router.get('/auctions/:id', async (req, res) => {
  try {
    const auction = await queries.getAuctionById(req.params.id);
    if (!auction) {
      return res.status(404).json({ success: false, error: 'Auction not found' });
    }
    res.json({ success: true, data: auction });
  } catch (error) {
    logger.error('[API] Failed to get auction details', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get auction details' });
  }
});

module.exports = router;
