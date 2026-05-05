require('dotenv').config({ path: '../../.env' });
const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

// Import Queues and Workers (Instantiating the worker starts it)
const { emailQueue } = require('../queues/emailQueue');
const { socialQueue } = require('../queues/socialQueue');
require('../workers/emailWorker');
require('../workers/socialWorker');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Setup Bull Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(socialQueue)
  ],
  serverAdapter: serverAdapter,
});

// Mount Dashboard
app.use('/admin/queues', serverAdapter.getRouter());

// Universal Endpoint for sending emails (can handle bulk)
app.post('/api/queue/email', async (req, res) => {
  try {
    const { project_name, template_id, use_ai_personalization, recipients } = req.body;

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'recipients array is required' });
    }

    const jobs = recipients.map(recipient => ({
      name: `email-to-${recipient.email}`,
      data: {
        to: recipient.email,
        subject: recipient.subject,
        data: recipient, // pass all data (name, context, etc)
        use_ai_personalization: use_ai_personalization || false,
        template_id: template_id
      },
      opts: {
        // Optional: you can add specific job options here
      }
    }));

    // Add all jobs to the queue at once
    await emailQueue.addBulk(jobs);

    res.status(202).json({
      success: true,
      message: `${jobs.length} emails added to the queue`,
      project: project_name
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to add to queue' });
  }
});

// Universal Endpoint for Social Media Scheduling
app.post('/api/queue/social', async (req, res) => {
  try {
    const { platforms, image_url, caption, include_image, schedule_time } = req.body;

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'platforms array is required (e.g. ["facebook", "instagram"])' });
    }

    const jobOpts = {};
    
    // If schedule_time is provided (ISO string), calculate the delay in milliseconds
    if (schedule_time) {
      const targetTime = new Date(schedule_time).getTime();
      const now = Date.now();
      const delay = targetTime - now;
      
      if (delay > 0) {
        jobOpts.delay = delay;
      }
    }

    const job = await socialQueue.add('post-to-social', {
      platforms,
      image_url,
      caption,
      include_image: include_image !== undefined ? include_image : true
    }, jobOpts);

    res.status(202).json({
      success: true,
      message: 'Social post added to queue successfully',
      jobId: job.id,
      isDelayed: !!jobOpts.delay,
      delayMs: jobOpts.delay
    });
  } catch (error) {
    console.error('Social API Error:', error);
    res.status(500).json({ error: 'Failed to schedule social post' });
  }
});

// Endpoint to list scheduled/pending social posts for the Admin Dashboard
app.get('/api/queue/social/jobs', async (req, res) => {
  try {
    // Get jobs in various states
    const delayed = await socialQueue.getDelayed();
    const waiting = await socialQueue.getWaiting();
    const active = await socialQueue.getActive();
    const completed = await socialQueue.getCompleted();
    const failed = await socialQueue.getFailed();

    const formatJob = (job, status) => ({
      id: job.id,
      data: job.data,
      status: status,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      delay: job.opts.delay,
      failedReason: job.failedReason
    });

    const allJobs = [
      ...delayed.map(j => formatJob(j, 'delayed')),
      ...waiting.map(j => formatJob(j, 'waiting')),
      ...active.map(j => formatJob(j, 'active')),
      ...completed.map(j => formatJob(j, 'completed')),
      ...failed.map(j => formatJob(j, 'failed'))
    ];

    res.json(allJobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Endpoint to delete a pending/delayed social post
app.delete('/api/queue/social/jobs/:id', async (req, res) => {
  try {
    const job = await socialQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    await job.remove();
    res.json({ success: true, message: 'Job removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove job' });
  }
});

app.listen(PORT, () => {
  console.log(`Universal Queue Service running on http://localhost:${PORT}`);
  console.log(`BullMQ Dashboard available at http://localhost:${PORT}/admin/queues`);
});
