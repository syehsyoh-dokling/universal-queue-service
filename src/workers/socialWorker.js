const { Worker } = require('bullmq');
const { connection } = require('../../config/redis');
const axios = require('axios');

const GRAPH_BASE = "https://graph.facebook.com/v25.0";

const socialWorker = new Worker('SocialQueue', async (job) => {
  const { platforms, image_url, caption, include_image } = job.data;
  const results = [];

  const fbPageId = process.env.FB_PAGE_ID;
  const fbToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;
  const igToken = process.env.IG_ACCESS_TOKEN;

  for (const platform of platforms) {
    const p = platform.trim().toLowerCase();
    
    if (p === 'facebook') {
      if (!fbPageId || !fbToken) throw new Error("FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN is missing");
      
      if (include_image) {
        if (!image_url) throw new Error("Facebook with image selected but image_url is empty");
        
        // Post Photo
        console.log(`[Job ${job.id}] Posting Photo to Facebook...`);
        const url = `${GRAPH_BASE}/${fbPageId}/photos`;
        const resp = await axios.post(url, {
          url: image_url,
          caption: caption,
          access_token: fbToken
        });
        results.push(`FB Photo OK: ${resp.data.id}`);
        
      } else {
        // Post Text
        console.log(`[Job ${job.id}] Posting Text to Facebook...`);
        const url = `${GRAPH_BASE}/${fbPageId}/feed`;
        const resp = await axios.post(url, {
          message: caption,
          access_token: fbToken
        });
        results.push(`FB Text OK: ${resp.data.id}`);
      }
      
    } else if (p === 'instagram') {
      if (!igUserId || !igToken) throw new Error("IG_USER_ID or IG_ACCESS_TOKEN is missing");
      if (!include_image) throw new Error("Instagram requires an image.");
      if (!image_url) throw new Error("Instagram selected but image_url is empty");
      
      console.log(`[Job ${job.id}] Creating Instagram Media Container...`);
      // Step 1: Create Container
      const createUrl = `${GRAPH_BASE}/${igUserId}/media`;
      const createResp = await axios.post(createUrl, {
        image_url: image_url,
        caption: caption,
        access_token: igToken
      });
      
      const creationId = createResp.data.id;
      if (!creationId) throw new Error("Failed to create IG media container");
      
      console.log(`[Job ${job.id}] Publishing Instagram Media (Container ID: ${creationId})...`);
      // Step 2: Publish Container
      const publishUrl = `${GRAPH_BASE}/${igUserId}/media_publish`;
      const publishResp = await axios.post(publishUrl, {
        creation_id: creationId,
        access_token: igToken
      });
      
      results.push(`IG OK: ${publishResp.data.id}`);
      
    } else {
      throw new Error(`Unknown platform: ${platform}`);
    }
  }

  const finalResult = results.join(' | ');
  console.log(`[Job ${job.id}] Completed: ${finalResult}`);
  return { success: true, details: finalResult };

}, { 
  connection,
  limiter: {
    max: 2, // Max 2 posts per 10 seconds to avoid Meta rate limits
    duration: 10000 
  }
});

socialWorker.on('failed', (job, err) => {
  console.error(`[Job ${job.id}] Social Worker failed: ${err.message}`);
});

module.exports = { socialWorker };
