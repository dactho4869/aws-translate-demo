const fs = require('fs');
const axios = require('axios');
const path = require('path'); 
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
}); 


// API configuration
const API_KEY = process.env.OPENAI_API_KEY; 
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Input và output file paths
const inputFile = 'input.txt';
const outputFile = 'output.txt';

// Maximum characters per chunk (điều chỉnh nếu cần)
const CHUNK_SIZE = 20000;

// Các hàm đọc/ghi file giữ nguyên như cũ
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

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
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

let totalApiResponseTime = 0;
let totalExecutionStartTime;

// Hàm gọi API ChatGPT đã được cập nhật
async function translateTextWithPrompt(text, chunkIndex, totalChunks) {
  try {
    const startTime = Date.now();
    
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

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    totalApiResponseTime += responseTime; // Cập nhật tổng thời gian

    console.log(`\n=== Chunk ${chunkIndex + 1}/${totalChunks} Performance Metrics ===`);
    console.log(`API Response Time: ${formatTime(responseTime)}`);
    console.log(`Text length: ${text.length} characters`);
    console.log(`Average speed: ${formatTime(responseTime / (text.length / 100))} per 100 characters`);
    console.log(`Model: GPT-4-mini`);

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error during translation:', error.response?.data || error.message);
    throw error;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function giữ nguyên logic
async function main() {
    try {
      totalExecutionStartTime = Date.now(); // Bắt đầu đếm thời gian thực thi
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
          await delay(1000);
        }
      }
  
      const totalExecutionTime = Date.now() - totalExecutionStartTime;
      const averageResponseTime = totalApiResponseTime / chunks.length;
  
      console.log('\nTranslation completed successfully!');
      console.log('\n=== Time Statistics ===');
      console.log(`Total execution time: ${formatTime(totalExecutionTime)}`);
      console.log(`Total API response time: ${formatTime(totalApiResponseTime)}`);
      console.log(`Average API response time per chunk: ${formatTime(averageResponseTime)}`);
      
      const outputText = await readTextFromFile(outputFile);
      console.log('\n=== Final Statistics ===');
      console.log(`Input length: ${inputText.length} characters`);
      console.log(`Output length: ${outputText.length} characters`);
      console.log(`Number of chunks processed: ${chunks.length}`);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

main();
