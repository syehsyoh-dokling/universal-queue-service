const { Queue } = require('bullmq');
const { connection } = require('../../config/redis');

// Create the email queue
const emailQueue = new Queue('EmailQueue', { 
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times if failed
    backoff: {
      type: 'exponential',
      delay: 5000, // Wait 5s before first retry, 10s for second, etc.
    },
    removeOnComplete: 1000, // Keep last 1000 completed jobs in Redis
    removeOnFail: 5000,     // Keep last 5000 failed jobs
  }
});

module.exports = { emailQueue };
