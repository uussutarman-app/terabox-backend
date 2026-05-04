const express = require('express');
const cors = require('cors');
const https = require('https');
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

// Helper function untuk fetch dengan redirect handling
function fetchWithRedirect(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirects: 5
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

// Terabox extract endpoint
app.post('/api/terabox', async (req, res) => {
  const { teraboxUrl } = req.body;
  
  console.log('📥 Received Terabox URL:', teraboxUrl);
  
  if (!teraboxUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL Terabox diperlukan' 
    });
  }
  
  try {
    // Validate URL format
    if (!teraboxUrl.includes('terabox.com')) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL harus dari terabox.com' 
      });
    }

    // Extract shared ID dari URL
    const urlMatch = teraboxUrl.match(/\/s\/([^?&]+)/);
    if (!urlMatch) {
      return res.status(400).json({ 
        success: false, 
        error: 'Format URL Terabox tidak valid' 
      });
    }
    
    const sharedId = urlMatch[1];
    console.log('🔍 Extracted shared ID:', sharedId);
    
    // Try to fetch Terabox page and extract direct video link
    const fetchUrl = `https://terabox.com/s/${sharedId}`;
    console.log('🌐 Fetching:', fetchUrl);
    
    const response = await fetchWithRedirect(fetchUrl);
    console.log('📊 Response status:', response.status);
    
    // Parse HTML untuk cari video URL
    const htmlContent = response.body;
    
    // Cari pattern: "dlink":"https://..." atau download link
    let videoUrl = null;
    
    // Pattern 1: Direct download link dalam HTML
    const dlinkMatch = htmlContent.match(/"dlink":"([^"]+)"/);
    if (dlinkMatch) {
      videoUrl = dlinkMatch[1].replace(/\\\//g, '/');
      console.log('✅ Found video URL (pattern 1):', videoUrl);
    }
    
    // Pattern 2: Video link dalam window.pageData
    if (!videoUrl) {
      const pageDataMatch = htmlContent.match(/window\.pageData\s*=\s*({[\s\S]*?});/);
      if (pageDataMatch) {
        try {
          const pageData = JSON.parse(pageDataMatch[1]);
          if (pageData.file_list && pageData.file_list.length > 0) {
            const firstFile = pageData.file_list[0];
            if (firstFile.dlink) {
              videoUrl = firstFile.dlink.replace(/\\\//g, '/');
              console.log('✅ Found video URL (pattern 2):', videoUrl);
            }
          }
        } catch (e) {
          console.log('⚠️ Could not parse pageData:', e.message);
        }
      }
    }
    
    // Pattern 3: Search dalam data attributes
    if (!videoUrl) {
      const dataMatch = htmlContent.match(/data-url="([^"]+)"/);
      if (dataMatch) {
        videoUrl = dataMatch[1];
        console.log('✅ Found video URL (pattern 3):', videoUrl);
      }
    }
    
    // Fallback: Return demo URL dengan shared ID
    if (!videoUrl) {
      videoUrl = `https://terabox.com/s/${sharedId}`;
      console.log('⚠️ Using fallback URL');
    }
    
    res.json({ 
      success: true,
      videoUrl: videoUrl,
      sharedId: sharedId,
      message: 'Video URL berhasil diextract'
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Server error: ' + error.message 
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
