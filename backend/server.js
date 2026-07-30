require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { processVideo } = require('./services/videoProcessor');
const { handleInstagramCallback, publishVideo } = require('./services/instagram');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Ensure upload/output dirs exist before registering static middleware
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
[UPLOADS_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Serve processed files statically (fix: serve dir directly, not relative path)
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/output', express.static(OUTPUT_DIR));

// Health check
app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

// Setup multer disk storage with 2 GB size limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2 GB
});

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Upload & process video
app.post('/api/process', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file received. Ensure field name is "video".' });
  }

  const clientId = req.body.clientId;
  const inputPath = req.file.path;
  // Build an absolute output path
  const outputFilename = `processed_${Date.now()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  // Respond immediately so the client doesn't time out during long processing
  res.json({ message: 'Processing started', outputFilename });

  const emit = (event, data) => {
    if (clientId) {
      io.to(clientId).emit(event, data);
    } else {
      io.emit(event, data);
    }
  };

  try {
    await processVideo(inputPath, outputPath, (progress) => emit('progress', progress));

    // BUG FIX: use the correct /output/<filename> URL, not the raw filesystem path
    const publicUrl = `http://localhost:${process.env.PORT || 3000}/output/${outputFilename}`;
    emit('completed', { url: publicUrl, path: outputPath });

    // Clean up the raw uploaded file after processing
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  } catch (error) {
    console.error('Processing error:', error);
    emit('error', { message: error.message });
  }
});

// Multer error handler (catches file-too-large etc.)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large. Maximum size is 2 GB.' });
  }
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Instagram OAuth Callback
app.get('/api/instagram/callback', handleInstagramCallback);

// Publish to Instagram
app.post('/api/instagram/publish', async (req, res) => {
  const { videoPath, caption } = req.body;
  if (!videoPath) return res.status(400).json({ error: 'videoPath is required' });
  try {
    const result = await publishVideo(videoPath, caption);
    res.json(result);
  } catch (error) {
    console.error('Instagram publish error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
