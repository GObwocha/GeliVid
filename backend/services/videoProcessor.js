const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const { generateCaptions } = require('./transcription');
const path = require('path');
const fs = require('fs');

async function processVideo(inputPath, outputPath, onProgress) {
  onProgress({ step: 'extracting-audio', percent: 0 });

  // 1. Extract Audio — use default mp3 codec (universally available in static ffmpeg)
  const audioPath = `${inputPath}.wav`; // WAV avoids any codec availability issues
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioFrequency(16000) // 16kHz is ideal for speech-to-text
      .audioChannels(1)      // Mono
      .format('wav')
      .save(audioPath)
      .on('end', resolve)
      .on('error', (err) => {
        console.error('[FFmpeg] Audio extraction error:', err.message);
        reject(new Error(`Audio extraction failed: ${err.message}`));
      });
  });

  onProgress({ step: 'transcribing', percent: 0 });

  // 2. Transcribe to SRT
  const srtPath = `${inputPath}.srt`;
  await generateCaptions(audioPath, srtPath);

  // Clean up temp audio immediately
  if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

  onProgress({ step: 'rendering', percent: 0 });

  // 3. Final render pass
  // Windows subtitles path fix: FFmpeg requires forward slashes AND the colon after drive letter escaped as \:
  // e.g. C:\Users\... → C\:/Users/...
  const srtAbsolutePath = path
    .resolve(srtPath)
    .replace(/\\/g, '/')              // all backslashes → forward slashes
    .replace(/^([A-Za-z]):/, '$1\\:'); // escape drive colon: C: → C\:

  console.log('[FFmpeg] Using SRT path:', srtAbsolutePath);

  // Wrap subtitle path in single quotes (required by ffmpeg filter syntax)
  const subtitleFilter = `subtitles='${srtAbsolutePath}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=1,MarginV=30'`;

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([
        // Cinematic color grade
        'eq=contrast=1.08:brightness=-0.04:saturation=1.25:gamma=0.95',
        subtitleFilter,
      ])
      .audioFilters([
        'loudnorm=I=-14:TP=-2:LRA=11'
      ])
      .videoCodec('libx264')
      .outputOptions([
        '-crf 23',
        '-preset fast',
        '-pix_fmt yuv420p',       // Required for Instagram compatibility
        '-movflags +faststart',   // Optimise for web streaming
      ])
      .audioCodec('aac')
      .audioBitrate('192k')
      .audioFrequency(44100)
      .on('start', (cmd) => console.log('[FFmpeg] Command:', cmd))
      .on('stderr', (line) => console.log('[FFmpeg]', line)) // Full FFmpeg stderr for debugging
      .on('progress', (progress) => {
        const pct = progress.percent
          ? Math.max(0, Math.min(100, Math.round(progress.percent)))
          : 0;
        onProgress({ step: 'rendering', percent: pct });
      })
      .on('end', () => {
        onProgress({ step: 'done', percent: 100 });
        if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('[FFmpeg] Render error:', err.message);
        console.error('[FFmpeg] stderr:', stderr);
        if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
        reject(new Error(`FFmpeg render failed: ${err.message}\n${stderr}`));
      })
      .save(outputPath);
  });
}

module.exports = { processVideo };
