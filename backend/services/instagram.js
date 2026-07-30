const ngrok = require('ngrok');
const axios = require('axios');

let ngrokUrl = '';

// BUG FIX: Poll the IG container status instead of blindly waiting 10s,
// which is too short for long videos and causes spurious "not_ready" publish failures.
async function waitForContainerReady(creationId, accessToken, maxWaitMs = 300000) {
  const interval = 5000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const statusRes = await axios.get(`https://graph.facebook.com/v18.0/${creationId}`, {
      params: {
        fields: 'status_code,status',
        access_token: accessToken
      }
    });
    const { status_code } = statusRes.data;
    console.log(`Container status: ${status_code}`);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`Instagram media container failed with status: ${status_code}`);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('Timed out waiting for Instagram media container to be ready.');
}

async function getNgrokUrl() {
  if (ngrokUrl) return ngrokUrl;
  try {
    ngrokUrl = await ngrok.connect({
      addr: process.env.PORT || 3000,
      authtoken: process.env.NGROK_AUTHTOKEN
    });
    console.log('Ngrok tunnel created:', ngrokUrl);
    return ngrokUrl;
  } catch (error) {
    console.error('Ngrok error:', error);
    throw error;
  }
}

async function handleInstagramCallback(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code in callback.');
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.IG_APP_ID,
        client_secret: process.env.IG_APP_SECRET,
        redirect_uri: process.env.IG_REDIRECT_URI,
        code
      }
    });

    const shortLivedToken = tokenRes.data.access_token;

    // Exchange for a long-lived token
    const longLivedRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.IG_APP_ID,
        client_secret: process.env.IG_APP_SECRET,
        fb_exchange_token: shortLivedToken
      }
    });

    const longLivedToken = longLivedRes.data.access_token;
    console.log('Long-Lived Access Token obtained:', longLivedToken);
    res.send(`
      <h2>✅ Instagram Connected!</h2>
      <p>Copy this token into your <code>.env</code> file as <strong>IG_ACCESS_TOKEN</strong>:</p>
      <pre>${longLivedToken}</pre>
      <p>You can close this window.</p>
    `);
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.status(500).send('Failed to exchange authorization code. Check server logs.');
  }
}

async function publishVideo(videoPath, caption) {
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;

  if (!accessToken || accessToken === 'your_long_lived_ig_token') {
    throw new Error('IG_ACCESS_TOKEN is not configured in .env');
  }
  if (!igUserId || igUserId === 'your_instagram_professional_account_id') {
    throw new Error('IG_USER_ID is not configured in .env');
  }

  const publicUrl = await getNgrokUrl();
  // BUG FIX: videoPath might already be absolute. Build URL from filename only.
  const filename = videoPath.replace(/\\/g, '/').split('/').pop();
  const videoUrl = `${publicUrl}/output/${filename}`;

  console.log('Publishing video to IG from URL:', videoUrl);

  // 1. Create Media Container
  const containerRes = await axios.post(
    `https://graph.facebook.com/v18.0/${igUserId}/media`,
    null,
    {
      params: {
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: accessToken
      }
    }
  );

  const creationId = containerRes.data.id;
  console.log('Media container created, id:', creationId);

  // 2. Poll until ready (up to 5 minutes)
  await waitForContainerReady(creationId, accessToken);

  // 3. Publish
  const publishRes = await axios.post(
    `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
    null,
    {
      params: {
        creation_id: creationId,
        access_token: accessToken
      }
    }
  );

  console.log('Published successfully:', publishRes.data);
  return publishRes.data;
}

module.exports = { handleInstagramCallback, publishVideo };
