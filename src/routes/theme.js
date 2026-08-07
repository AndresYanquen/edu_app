const express = require('express');
const pool = require('../db');
const { THEME_SETTING_KEY, normalizeTheme } = require('../utils/themeSettings');

const router = express.Router();

router.get('/theme', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
      [THEME_SETTING_KEY],
    );

    return res.json(normalizeTheme(rows[0]?.value));
  } catch (err) {
    console.error('Failed to fetch theme settings', err);
    return res.status(500).json({ error: 'Failed to fetch theme settings' });
  }
});

module.exports = router;
