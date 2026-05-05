const { Queue } = require('bullmq');
const { connection } = require('../../config/redis');

// Create the social media queue
const socialQueue = new Queue('SocialQueue', { 
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times if Meta API fails (e.g. rate limit / network issue)
    backoff: {
      type: 'exponential',
      delay: 30000, // Wait 30s before first retry
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  }
});

module.exports = { socialQueue };
