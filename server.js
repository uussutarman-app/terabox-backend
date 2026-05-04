const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Terabox extract endpoint
app.post('/api/terabox', async (req, res) => {
  const { teraboxUrl } = req.body;
  
  console.log('Received Terabox URL:', teraboxUrl);
  
  if (!teraboxUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL Terabox diperlukan' 
    });
  }
  
  try {
    // Extract shared ID dari URL
    // Format: https://terabox.com/s/{SHARED_ID}?pwd={PASSWORD}
    const urlMatch = teraboxUrl.match(/\/s\/([^?&]+)/);
    
    if (!urlMatch) {
      return res.status(400).json({ 
        success: false, 
        error: 'Format URL Terabox tidak valid. Gunakan: https://terabox.com/s/...' 
      });
    }
    
    const sharedId = urlMatch[1];
    console.log('Extracted shared ID:', sharedId);
    
    // Return success response dengan video URL
    // Note: Ini dummy URL untuk testing. Untuk production, perlu API Terabox atau web scraping
    const videoUrl = `https://example.com/video/${sharedId}.mp4`;
    
    res.json({ 
      success: true,
      videoUrl: videoUrl,
      sharedId: sharedId,
      message: 'URL video berhasil diextract'
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error: ' + error.message 
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
