const fs = require('fs').promises;
const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
const path = require('path'); 
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
}); 

const REGION = "ap-southeast-1"; 
const translate = new TranslateClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const MAX_CHUNK_SIZE = 9000;
const CONCURRENT_REQUESTS = 10; 
const DELAY_BETWEEN_BATCHES = 100;
const inputFile = path.join(__dirname, '../input/input-code.txt');
const outputFile = path.join(__dirname, 'output_code.txt');
const codePartsFile = path.join(__dirname, 'code_parts.json');

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
  let restoredText = translatedText;
  
  for (let i = codeParts.length - 1; i >= 0; i--) {
    const marker = `[CODE_PART_${i}]`;
    restoredText = restoredText.replace(marker, codeParts[i].content);
  }
  
  return restoredText;
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  const milliseconds = ms % 1000;
  
  let result = '';
  if (minutes > 0) result += `${minutes}m `;
  if (seconds > 0 || minutes > 0) result += `${seconds}s `;
  result += `${milliseconds}ms`;
  
  return result.trim();
}

function splitIntoChunks(text) {
  if (text.length <= MAX_CHUNK_SIZE) return [text];

  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    const potentialChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    if (potentialChunk.length > MAX_CHUNK_SIZE && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = potentialChunk;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

async function translateText(text) {
  const startTime = Date.now();
  try {
    const params = {
      Text: text,
      SourceLanguageCode: "en",
      TargetLanguageCode: "vi"
    };

    const command = new TranslateTextCommand(params);
    const response = await translate.send(command);
    const duration = Date.now() - startTime;
    
    return {
      text: response.TranslatedText,
      duration: duration,
      originalLength: text.length,
      translatedLength: response.TranslatedText.length
    };
  } catch (error) {
    console.error("Translation error for chunk:", error);
    throw error;
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function processBatch(chunks, startIndex) {
  const batch = chunks.slice(startIndex, startIndex + CONCURRENT_REQUESTS);
  const promises = batch.map((chunk, index) => {
    return translateText(chunk)
      .then(result => ({
        index: startIndex + index,
        ...result
      }))
      .catch(error => ({
        index: startIndex + index,
        error,
        text: chunk,
        duration: 0,
        originalLength: chunk.length,
        translatedLength: chunk.length
      }));
  });

  return Promise.all(promises);
}

async function translateFile(inputPath, outputPath) {
  const startTime = Date.now();
  let totalOriginalChars = 0;
  let totalTranslatedChars = 0;
  let totalTranslationTime = 0;
  let apiCallTime = 0;

  try {
    console.log("Reading input file...");
    const text = await fs.readFile(inputPath, 'utf8');
    
    console.log("Extracting code parts...");
    const { modifiedText, codeParts, totalCodeChars, totalMarkerChars } = extractAndStoreCodeParts(text);
    await fs.writeFile(codePartsFile, JSON.stringify(codeParts, null, 2));
    
    totalOriginalChars = modifiedText.length;
    console.log(`Original text length (after code extraction): ${totalOriginalChars.toLocaleString()} characters`);
    
    const chunks = splitIntoChunks(modifiedText);
    console.log(`Total chunks: ${chunks.length}`);

    const translationStartTime = Date.now();
    const results = new Array(chunks.length);
    
    for (let i = 0; i < chunks.length; i += CONCURRENT_REQUESTS) {
      const batchResults = await processBatch(chunks, i);
      
      batchResults.forEach(result => {
        results[result.index] = result;
        apiCallTime += result.duration;
        totalTranslatedChars += result.translatedLength;
        
        console.log(`Chunk ${result.index + 1}/${chunks.length} completed:`);
        console.log(`Translation time: ${(result.duration / 1000).toFixed(2)}s`);
        console.log(`Characters: ${result.originalLength.toLocaleString()} → ${result.translatedLength.toLocaleString()}`);
      });

      if (i + CONCURRENT_REQUESTS < chunks.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    totalTranslationTime = Date.now() - translationStartTime;

    console.log("\nRestoring code parts...");
    const translatedText = results.map(r => r.text).join('\n');
    const finalTranslation = restoreCodeParts(translatedText, codeParts);
    
    await fs.writeFile(outputPath, finalTranslation, 'utf8');

    const totalTime = Date.now() - startTime;

    console.log("\n=== Translation Summary ===");
    console.log(`Total time: ${formatDuration(totalTime)}`);
    console.log(`Total translation time (including delays): ${formatDuration(totalTranslationTime)}`);
    console.log(`Pure API call time: ${formatDuration(apiCallTime)}`);
    console.log(`Original characters: ${totalOriginalChars.toLocaleString()}`);
    console.log(`Translated characters: ${totalTranslatedChars.toLocaleString()}`);
    console.log(`Code characters extracted: ${totalCodeChars.toLocaleString()}`);
    console.log(`Characters reduced during processing: ${totalCodeChars - totalMarkerChars}`);
    console.log(`Character ratio: ${(totalTranslatedChars / totalOriginalChars).toFixed(2)}x`);
    console.log(`Average translation speed: ${Math.round(totalOriginalChars / (apiCallTime / 1000))} chars/second`);

  } catch (error) {
    console.error("Error in translation process:", error);
  }
}

translateFile(inputFile, outputFile);