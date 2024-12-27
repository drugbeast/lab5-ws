const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

const authenticateToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
      return res.status(401).json({ error: 'Access token is missing' });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const result = await pool.query('SELECT * FROM blacklisted_tokens WHERE token = $1', [token]);
      
      if (result.rows.length > 0) {
          return res.status(403).json({ error: 'Token is blacklisted, please log in again' });
      }

      req.user = decoded;
      next();
  } catch (err) {
      console.error('Invalid or expired token:', err);
      res.status(403).json({ error: 'Invalid or expired access token' });
  }
};

module.exports = authenticateToken