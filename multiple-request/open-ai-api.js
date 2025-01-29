const fs = require('fs');
const axios = require('axios');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const inputFile = '../input/input2000.txt';
const outputFile = './output/open-ai-output.txt';

const CHUNK_SIZE = 200;

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

function splitIntoChunks(text, maxChunkSize) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
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

async function translateTextWithPrompt(text, chunkIndex, totalChunks) {
  try {
    const messages = [
      {
        role: "system",
        content: "You are a professional translator. Translate the given English text to Vietnamese. Only provide the translated text without any explanations or additional information."
      },
      {
        role: "user",
        content: `This is part ${chunkIndex + 1} of ${totalChunks}, maintain consistency with other parts:\n\n${text}`
      }
    ];

    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`Error during translation for chunk ${chunkIndex + 1}:`, error.response?.data || error.message);
    throw error;
  }
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

async function main() {
  const startTime = Date.now(); 

  try {
    console.log('Reading input file...');
    const inputText = await readTextFromFile(inputFile);

    await writeTextToFile(outputFile, '');

    const chunks = splitIntoChunks(inputText, CHUNK_SIZE);
    console.log(`Split text into ${chunks.length} chunks`);

    console.log('\nTranslating chunks in parallel...');
    const translations = await Promise.all(
      chunks.map((chunk, index) => translateTextWithPrompt(chunk, index, chunks.length))
    );

    console.log('\nCombining translated chunks...');
    const fullTranslation = translations.join('\n\n');

    await writeTextToFile(outputFile, fullTranslation);

    console.log('\nTranslation completed successfully!');
    console.log(`Input length: ${inputText.length} characters`);
    console.log(`Output length: ${fullTranslation.length} characters`);
    console.log(`Number of chunks processed: ${chunks.length}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    const endTime = Date.now(); 
    const totalExecutionTime = endTime - startTime;
    console.log(`\nTotal execution time: ${formatTime(totalExecutionTime)}`);
  }
}

main();