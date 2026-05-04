import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teraboxUrl } = req.body;
  
  if (!teraboxUrl) {
    return res.status(400).json({ error: 'Missing teraboxUrl' });
  }

  try {
    const run = await client.actor("easyapi/terabox-video-file-downloader").call({
      share_url: teraboxUrl,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    if (items.length > 0) {
      const videoUrl = items[0].direct_link || items[0].download_url || items[0].url;
      return res.status(200).json({ success: true, videoUrl });
    } else {
      return res.status(404).json({ error: 'No video found' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
