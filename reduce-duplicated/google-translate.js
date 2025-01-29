const fs = require('fs');
const { Translate } = require('@google-cloud/translate').v2;
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const apiKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const translate = new Translate({ key: apiKey });

const CHUNK_SIZE = 5000;
const BATCH_SIZE = 128;
const DELAY_MS = 100;
const translationDictFile = 'translation_dict.json';

function findDuplicateWords(text) {
  const words = text.match(/\b\w+\b/g) || [];
  const wordCount = new Map();
  const duplicateWords = new Set();
  
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
    if (wordCount.get(word) > 1 && word.length > 3) {
      duplicateWords.add(word);
    }
  });

  return Array.from(duplicateWords);
}

async function translateSingleWord(word, targetLanguage) {
  try {
    const [translation] = await translate.translate(word, targetLanguage);
    return translation;
  } catch (error) {
    console.error(`Error translating word '${word}':`, error);
    throw error;
  }
}

async function translateBatch(words, targetLanguage) {
    try {
      const [translations] = await translate.translate(words, targetLanguage);
      
      return words.reduce((result, word, index) => {
        result[word] = translations[index] || word; 
        return result;
      }, {});
    } catch (error) {
      console.error(`Batch translation failed:`, error);
      
      return words.reduce((result, word) => {
        result[word] = word;
        return result;
      }, {});
    }
  }

async function translateWords(words, targetLanguage) {
  const translations = {};
  const batches = [];
  
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    batches.push(words.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${batches.length} batches of words...`);

  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length}...`);
    const batchTranslations = await translateBatch(batches[i], targetLanguage);
    Object.assign(translations, batchTranslations);
  }

  return translations;
}

const readFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

const writeFile = (filePath, content) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, content, 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const splitTextIntoChunks = (text, maxChunkSize = 5000) => {
  const chunks = [];
  let currentChunk = '';
  
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

function replaceWithTranslations(text, translationDict) {
  let result = text;
  for (const [englishWord, vietnameseWord] of Object.entries(translationDict)) {
    const regex = new RegExp(`\\b${englishWord}\\b`, 'g');
    result = result.replace(regex, vietnameseWord);
  }
  return result;
}

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

const countCharacters = (text) => {
  return text.length;
};

const main = async () => {
  try {
    const inputFilePath = 'input5000.txt';
    const outputFilePath = './output/google-output.txt';
    const targetLanguage = 'vi';
    const startTime = new Date();
    console.log(`Start time: ${startTime.toISOString()}`);

    const text = await readFile(inputFilePath);
    const originalCharCount = countCharacters(text);
    console.log(`Original text character count: ${originalCharCount}`);

    console.log('Finding duplicate words...');
    const duplicateWords = findDuplicateWords(text);
    console.log(`Found ${duplicateWords.length} duplicate words`);

    console.log('Translating duplicate words...');
    const translationDict = await translateWords(duplicateWords, targetLanguage);
    await writeFile(translationDictFile, JSON.stringify(translationDict, null, 2));

    const textChunks = splitTextIntoChunks(text, CHUNK_SIZE);
    console.log(`Split into ${textChunks.length} chunks`);

    const translationPromises = textChunks.map((chunk, index) => 
      translateChunk(chunk, targetLanguage, index)
    );

    const translatedChunks = await Promise.all(translationPromises);
    let translatedText = translatedChunks.join(' ');

    console.log('Replacing words with dictionary translations...');
    translatedText = replaceWithTranslations(translatedText, translationDict);

    const translatedCharCount = countCharacters(translatedText);

    await writeFile(outputFilePath, translatedText);

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log('\nSummary Report:');
    console.log('==============');
    console.log(`Number of chunks processed: ${textChunks.length}`);
    console.log(`Number of duplicate words translated: ${duplicateWords.length}`);
    console.log(`Original text length: ${originalCharCount} characters`);
    console.log(`Translated text length: ${translatedCharCount} characters`);
    console.log(`Character count difference: ${translatedCharCount - originalCharCount} characters`);
    console.log(`Total processing time: ${duration} seconds`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

main();
