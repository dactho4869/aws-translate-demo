const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const inputFile = '../input/input-code.txt';
const outputFile = 'output.txt';
const codePartsFile = 'code_parts.json';

const CHUNK_SIZE = 200;

function extractAndStoreCodeParts(text) {
  const codeParts = [];
  let modifiedText = text;
  let totalCodeChars = 0;
  
  const codeRegex = /(<[^>]+>|<!DOCTYPE[^>]+>)/g;
  
  let match;
  let index = 0;
  
  while ((match = codeRegex.exec(text)) !== null) {
    totalCodeChars += match[0].length;
    codeParts.push({
      index: index,
      content: match[0],
      position: match.index,
      length: match[0].length
    });
    modifiedText = modifiedText.replace(match[0], `[CODE_PART_${index}]`);
    index++;
  }
  
  return {
    modifiedText,
    codeParts,
    totalCodeChars,
    totalMarkerChars: index * 12
  };
}

function restoreCodeParts(translatedText, codeParts) {
  let cleanedText = translatedText.split('\n')
    .filter(line => !line.match(/Đây là phần \d+ trong \d+/))
    .join('\n');
  
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  let restoredText = cleanedText;
  
  for (let i = codeParts.length - 1; i >= 0; i--) {
    const marker = `[CODE_PART_${i}]`;
    restoredText = restoredText.replace(marker, codeParts[i].content);
  }
  
  return restoredText;
}

function readTextFromFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function writeTextToFile(filePath, text) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, text, 'utf8', (err) => {
      if (err) return reject(err);
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

async function translateTextWithPrompt(text) {
  try {
    const messages = [
      {
        role: "system",
        content: "You are a professional translator. Translate the given English text to Vietnamese. Only provide the translated text without any explanations or additional information. Keep any [CODE_PART_X] markers unchanged in the translation."
      },
      {
        role: "user",
        content: text
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
    console.error('Translation error:', error.response?.data || error.message);
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

    console.log('Extracting code parts...');
    const { modifiedText, codeParts, totalCodeChars, totalMarkerChars } = extractAndStoreCodeParts(inputText);
    
    await writeTextToFile(codePartsFile, JSON.stringify(codeParts, null, 2));

    const chunks = splitIntoChunks(modifiedText, CHUNK_SIZE);
    console.log(`Split text into ${chunks.length} chunks`);

    console.log('\nTranslating chunks in parallel...');
    const translations = await Promise.all(
      chunks.map(chunk => translateTextWithPrompt(chunk))
    );

    console.log('\nCombining translated chunks...');
    const translatedText = translations.join('\n\n');

    console.log('Restoring code parts and cleaning text...');
    const fullTranslation = restoreCodeParts(translatedText, codeParts);

    await writeTextToFile(outputFile, fullTranslation);

    const charsReduced = totalCodeChars - totalMarkerChars;
    console.log('\nTranslation completed successfully!');
    console.log(`Input length: ${inputText.length} characters`);
    console.log(`Output length: ${fullTranslation.length} characters`);
    console.log(`Total code characters: ${totalCodeChars}`);
    console.log(`Characters reduced during processing: ${charsReduced}`);
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