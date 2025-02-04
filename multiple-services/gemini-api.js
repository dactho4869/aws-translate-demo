const fs = require('fs');
const axios = require('axios');
const path = require('path'); 
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
}); 


// API configuration
const API_KEY = process.env.GEMINI_API_KEY; 
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent';

// Input and output file paths
const inputFile = '../input/input500.txt';
const outputFile = 'output.txt';

// Maximum characters per chunk (adjust as needed)
const CHUNK_SIZE = 10000;

let totalProcessingTime = 0;


// Function to read text from a file
function readTextFromFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
}

// Function to write text to a file
function writeTextToFile(filePath, text) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, text, 'utf8', (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

// Function to append text to a file
function appendTextToFile(filePath, text) {
  return new Promise((resolve, reject) => {
    fs.appendFile(filePath, text, 'utf8', (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

// Function to format milliseconds to a readable string
function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}


// Function to split text into chunks at sentence boundaries
function splitIntoChunks(text, maxChunkSize) {
  const sentences = text.match(/[^.!?;\n]+[.!?;\n]+/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Function to call the Gemini API with a translation prompt
async function translateTextWithPrompt(text, chunkIndex, totalChunks) {
  try {
    const startTime = Date.now();
    
    const prompt = `You are a professional translator. Please translate the following English text to Vietnamese. Only provide the translated text without any explanations or additional information. This is part ${chunkIndex + 1} of ${totalChunks}, maintain consistency with other parts:

Original text:
${text}

Vietnamese translation:`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 1,
          topP: 1,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    totalProcessingTime += responseTime;

    console.log(`\n=== Chunk ${chunkIndex + 1}/${totalChunks} Performance Metrics ===`);
    console.log(`API Response Time: ${formatTime(responseTime)}`);
    console.log(`Text length: ${text.length} characters`);
    console.log(`Average speed: ${formatTime(responseTime / (text.length / 100))} per 100 characters`);
    console.log(`Model: Gemini 1.5 Flash`);

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error during translation:', error.response?.data || error.message);
    throw error;
  }
}
// Add delay between API calls to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function to handle the translation process
async function main() {
  try {
    const mainStartTime = Date.now();
    
    console.log('Reading input file...');
    const inputText = await readTextFromFile(inputFile);

    await writeTextToFile(outputFile, '');

    const chunks = splitIntoChunks(inputText, CHUNK_SIZE);
    console.log(`Split text into ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      console.log(`\nTranslating chunk ${i + 1}/${chunks.length}...`);
      const translatedChunk = await translateTextWithPrompt(chunks[i], i, chunks.length);
      
      await appendTextToFile(outputFile, (i === 0 ? '' : '\n\n') + translatedChunk);
      
      if (i < chunks.length - 1) {
        await delay(500); 
      }
    }

    const mainEndTime = Date.now();
    const totalTime = mainEndTime - mainStartTime;

    console.log('\nTranslation completed successfully!');
    
    // Print final statistics
    const outputText = await readTextFromFile(outputFile);
    console.log('\n=== Final Statistics ===');
    console.log(`Input length: ${inputText.length} characters`);
    console.log(`Output length: ${outputText.length} characters`);
    console.log(`Number of chunks processed: ${chunks.length}`);
    console.log(`Total API processing time: ${formatTime(totalProcessingTime)}`);
    console.log(`Total execution time: ${formatTime(totalTime)}`);
    console.log(`Average time per chunk: ${formatTime(totalProcessingTime / chunks.length)}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
main();