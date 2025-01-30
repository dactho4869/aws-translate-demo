const fs = require('fs');
const { Translate } = require('@google-cloud/translate').v2;
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const apiKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const translate = new Translate({ key: apiKey });

// Hàm đọc file
const readFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

// Hàm ghi file
const writeFile = (filePath, content) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, content, 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Hàm chia văn bản thành các đoạn nhỏ
const splitTextIntoChunks = (text, maxChunkSize = 5000) => {
  const chunks = [];
  let currentChunk = '';
  
  // Tách văn bản thành các câu
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};

// Hàm dịch một đoạn văn bản
const translateChunk = async (text, targetLanguage, chunkIndex) => {
  try {
    const apiCallTime = new Date();
    console.log(`Chunk ${chunkIndex + 1} translation started at: ${apiCallTime.toISOString()}`);
    
    const [translation] = await translate.translate(text, targetLanguage);
    
    const apiEndTime = new Date();
    const apiDuration = (apiEndTime - apiCallTime) / 1000;
    console.log(`Chunk ${chunkIndex + 1} translation completed at: ${apiEndTime.toISOString()}`);
    console.log(`Chunk ${chunkIndex + 1} duration: ${apiDuration} seconds`);
    
    return translation;
  } catch (error) {
    console.error(`Error translating chunk ${chunkIndex + 1}:`, error);
    throw error;
  }
};

// Hàm đếm ký tự
const countCharacters = (text) => {
  return text.length;
};

const main = async () => {
  try {
    const inputFilePath = '../input/input100000.txt';
    const outputFilePath = './google-output/google-output-100000.txt';
    const targetLanguage = 'vi';
    const maxChunkSize = 5000; 
    const startTime = new Date();
    console.log(`Start time: ${startTime.toISOString()}`);

    // Đọc và chia văn bản thành các đoạn nhỏ
    const text = await readFile(inputFilePath);
    const originalCharCount = countCharacters(text);
    console.log(`Original text character count: ${originalCharCount}`);

    const textChunks = splitTextIntoChunks(text, maxChunkSize);
    console.log(`Split into ${textChunks.length} chunks`);

    // Dịch song song tất cả các chunk
    const translationPromises = textChunks.map((chunk, index) => 
      translateChunk(chunk, targetLanguage, index)
    );

    // Đợi tất cả các promise hoàn thành
    const translatedChunks = await Promise.all(translationPromises);

    // Ghép các đoạn dịch lại với nhau
    const translatedText = translatedChunks.join(' ');
    const translatedCharCount = countCharacters(translatedText);

    // Ghi kết quả ra file
    await writeFile(outputFilePath, translatedText);

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    // In báo cáo tổng kết
    console.log('\nSummary Report:');
    console.log('==============');
    console.log(`Number of chunks processed: ${textChunks.length}`);
    console.log(`Original text length: ${originalCharCount} characters`);
    console.log(`Translated text length: ${translatedCharCount} characters`);
    console.log(`Character count difference: ${translatedCharCount - originalCharCount} characters`);
    console.log(`Total processing time: ${duration} seconds`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

main();
