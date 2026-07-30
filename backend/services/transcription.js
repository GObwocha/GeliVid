const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Convert seconds (float) to SRT timestamp format: HH:MM:SS,mmm
function secondsToSrt(seconds) {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

// Convert raw Gemini transcript text into a basic SRT file.
// Gemini returns plain text; we chunk it into ~5-second subtitle blocks.
function textToSrt(transcriptText) {
  const words = transcriptText.trim().split(/\s+/).filter(Boolean);
  const WORDS_PER_BLOCK = 8;
  const SECONDS_PER_BLOCK = 4;
  const blocks = [];
  for (let i = 0; i < words.length; i += WORDS_PER_BLOCK) {
    const chunk = words.slice(i, i + WORDS_PER_BLOCK).join(' ');
    const startTime = (i / WORDS_PER_BLOCK) * SECONDS_PER_BLOCK;
    const endTime = startTime + SECONDS_PER_BLOCK;
    blocks.push(
      `${blocks.length + 1}\n${secondsToSrt(startTime)} --> ${secondsToSrt(endTime)}\n${chunk}`
    );
  }
  return blocks.join('\n\n') + '\n';
}

async function generateCaptions(audioPath, srtOutputPath) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.log('⚠️  GEMINI_API_KEY not set — using mock captions.');
    writeMockSrt(srtOutputPath, 'Gemini API key not configured. Add GEMINI_API_KEY to .env');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-3.6-flash is multimodal and supports audio input — free tier available
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  

    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = audioBuffer.toString('base64');
    const ext = path.extname(audioPath).replace('.', '');
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: audioBase64
        }
      },
      {
        text: 'Please transcribe this audio accurately. Return ONLY the spoken words as plain text, no timestamps, no labels, no markdown.'
      }
    ]);

    const transcript = result.response.text();
    console.log('Gemini transcript received, length:', transcript.length);

    const srtContent = textToSrt(transcript);
    fs.writeFileSync(srtOutputPath, srtContent);
    console.log('✅ Captions written to', srtOutputPath);
  } catch (error) {
    console.error('Gemini API Error:', error.message);

    const status = error?.status || error?.response?.status;
    if (status === 429 || status === 401 || status === 403) {
      console.log('⚠️  Gemini API quota/auth error — falling back to mock captions.');
      writeMockSrt(srtOutputPath, 'Gemini API limit reached. Check your API key and quota.');
      return;
    }
    throw error;
  }
}

function writeMockSrt(srtOutputPath, message) {
  const srt = `1\n00:00:00,000 --> 00:00:05,000\n${message}\n`;
  fs.writeFileSync(srtOutputPath, srt);
}

module.exports = { generateCaptions };
