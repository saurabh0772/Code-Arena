const dotenv = require('dotenv');

// Load environment variables from .env file if present
dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena'
  },
  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret-key' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
};

module.exports = config;
