const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
};

// Create a shared Redis connection
const connection = new Redis(redisConfig);

connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

module.exports = { connection, redisConfig };
