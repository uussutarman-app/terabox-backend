const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const app = express();

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Server is running', 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Helper untuk fetch URL dengan timeout
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = options.timeout || 10000;
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://terabox.com/'
      },
      timeout: timeout
    }, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 5 * 1024 * 1024) { // 5MB limit
          req.destroy();
          reject(new Error('Response too large'));
        }
      });
      
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Extract video URL dari Terabox
async function extractTeraboxVideo(teraboxUrl) {
  console.log('🔍 Starting extraction for:', teraboxUrl);
  
  try {
    // Fetch halaman Terabox
    console.log('📥 Fetching Terabox page...');
    const response = await fetchUrl(teraboxUrl);
    const html = response.body;
    
    console.log('📊 Response length:', html.length);
    
    // Try multiple extraction patterns
    let videoUrl = null;
    
    // Pattern 1: Direct dlink dalam HTML
    console.log('🔎 Trying pattern 1: dlink...');
    let match = html.match(/"dlink":"([^"]+)"/);
    if (match) {
      videoUrl = match[1].replace(/\\\//g, '/');
      console.log('✅ Found via pattern 1:', videoUrl.substring(0, 100));
      return videoUrl;
    }
    
    // Pattern 2: fs_id dan file info
    console.log('🔎 Trying pattern 2: fs_id...');
    const fsIdMatch = html.match(/"fs_id":(\d+)/);
    const filenameMatch = html.match(/"filename":"([^"]+)"/);
    if (fsIdMatch && filenameMatch) {
      console.log('Found fs_id:', fsIdMatch[1], 'filename:', filenameMatch[1]);
      // Return a constructed URL
      videoUrl = `https://d.terabox.com/d/1/${fsIdMatch[1]}/${filenameMatch[1]}`;
      console.log('✅ Found via pattern 2 (constructed)');
      return videoUrl;
    }
    
    // Pattern 3: Cari dalam window object
    console.log('🔎 Trying pattern 3: window.pageData...');
    const windowMatch = html.match(/window\.pageData\s*=\s*\{[\s\S]*?"download_url":"([^"]+)"/);
    if (windowMatch) {
      videoUrl = windowMatch[1].replace(/\\\//g, '/');
      console.log('✅ Found via pattern 3:', videoUrl.substring(0, 100));
      return videoUrl;
    }
    
    // Pattern 4: Media URL dalam meta tags
    console.log('🔎 Trying pattern 4: meta tags...');
    const metaMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/);
    if (metaMatch) {
      videoUrl = metaMatch[1];
      console.log('✅ Found via pattern 4:', videoUrl.substring(0, 100));
      return videoUrl;
    }
    
    // Pattern 5: Direct video src
    console.log('🔎 Trying pattern 5: video src...');
    const videoMatch = html.match(/<video[^>]*src="([^"]+)"/);
    if (videoMatch) {
      videoUrl = videoMatch[1];
      console.log('✅ Found via pattern 5:', videoUrl.substring(0, 100));
      return videoUrl;
    }
    
    // Pattern 6: Search dalam data attribute
    console.log('🔎 Trying pattern 6: data attributes...');
    const dataMatch = html.match(/data-url="([^"]+)"|data-src="([^"]+)"/);
    if (dataMatch) {
      videoUrl = dataMatch[1] || dataMatch[2];
      console.log('✅ Found via pattern 6:', videoUrl.substring(0, 100));
      return videoUrl;
    }
    
    console.log('⚠️ No video URL found in HTML');
    console.log('HTML length:', html.length);
    console.log('First 500 chars:', html.substring(0, 500));
    
    throw new Error('Could not extract video URL from Terabox page');
    
  } catch (error) {
    console.error('❌ Extraction error:', error.message);
    throw error;
  }
}

// Main endpoint
app.post('/api/terabox', async (req, res) => {
  const { teraboxUrl } = req.body;
  
  console.log('\n═══════════════════════════════════');
  console.log('📥 New request - Terabox URL:', teraboxUrl);
  console.log('═══════════════════════════════════\n');
  
  if (!teraboxUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL Terabox diperlukan' 
    });
  }
  
  if (!teraboxUrl.includes('terabox.com')) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL harus dari terabox.com' 
    });
  }
  
  try {
    const videoUrl = await extractTeraboxVideo(teraboxUrl);
    
    res.json({ 
      success: true,
      videoUrl: videoUrl,
      message: 'Video URL berhasil diextract'
    });
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Gagal extract video dari Terabox'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
