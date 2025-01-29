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

// Maximum characters per chunk
const CHUNK_SIZE = 200;

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

// Function to split text into chunks
function splitIntoChunks(text, maxChunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChunkSize) {
    chunks.push(text.slice(i, i + maxChunkSize));
  }
  return chunks;
}

// Function to call the Gemini API with a translation prompt
async function translateTextWithPrompt(text, chunkIndex, totalChunks) {
  try {
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

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`Error during translation of chunk ${chunkIndex + 1}:`, error.response?.data || error.message);
    throw error;
  }
}

// Main function to handle the translation process
async function main() {
  try {
    console.log('Reading input file...');
    const inputText = await readTextFromFile(inputFile);

    await writeTextToFile(outputFile, ''); // Clear output file

    const chunks = splitIntoChunks(inputText, CHUNK_SIZE);
    console.log(`Split text into ${chunks.length} chunks`);

    const startTime = Date.now(); // Start timer

    // Translate all chunks in parallel
    const translations = await Promise.all(
      chunks.map((chunk, index) =>
        translateTextWithPrompt(chunk, index, chunks.length)
      )
    );

    const endTime = Date.now(); // End timer
    const totalTime = endTime - startTime; // Total execution time

    // Combine all translations and write to output file
    const finalTranslation = translations.join('\n\n');
    await writeTextToFile(outputFile, finalTranslation);

    // Calculate total characters processed
    const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    console.log('\nTranslation completed successfully!');
    console.log(`\n=== Summary ===`);
    console.log(`Total time taken: ${totalTime} ms`);
    console.log(`Total characters translated: ${totalCharacters}`);
    console.log(`Number of chunks processed: ${chunks.length}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();