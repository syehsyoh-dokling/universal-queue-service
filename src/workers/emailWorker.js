const { Worker } = require('bullmq');
const { connection } = require('../../config/redis');
const transporter = require('../../config/mailer');
const axios = require('axios');

const emailWorker = new Worker('EmailQueue', async (job) => {
  const { to, subject, data, use_ai_personalization, template_id } = job.data;
  
  let finalBody = data.message || `Hello ${data.name}, this is a default message.`;

  // 1. AI Personalization (Optional)
  if (use_ai_personalization) {
    try {
      console.log(`[Job ${job.id}] Calling AI Orchestrator for personalization...`);
      const aiUrl = process.env.AI_ORCHESTRATOR_URL || 'http://localhost:4000/api/orchestrate';
      
      const response = await axios.post(aiUrl, {
        issue_type: template_id || 'email_personalization',
        variables: {
          name: data.name,
          context: data.context || '',
          base_message: finalBody
        }
      });
      
      if (response.data && response.data.data) {
        finalBody = response.data.data;
      }
    } catch (error) {
      console.warn(`[Job ${job.id}] AI Orchestrator failed, falling back to original message. Error:`, error.message);
      // Fallback to original body if AI fails
    }
  }

  // 2. Send Email
  console.log(`[Job ${job.id}] Sending email to ${to}...`);
  const mailOptions = {
    from: `"Universal System" <${process.env.SMTP_USER}>`,
    to: to,
    subject: subject || 'Notification',
    text: finalBody,
    // html: `<p>${finalBody}</p>` // You can use HTML as well
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Job ${job.id}] Email sent successfully: ${info.messageId}`);
  
  return { success: true, messageId: info.messageId };

}, { 
  connection,
  // Rate Limiting Rules (e.g. max 5 emails per second to avoid spam block)
  limiter: {
    max: 5,
    duration: 1000 // in milliseconds (1 second)
  }
});

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = { emailWorker };
