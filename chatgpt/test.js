const fs = require('fs').promises;
const OpenAI = require('openai');
const path = require('path'); 
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
}); 

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHUNK_SIZE = 20000; // Maximum characters per chunk

// Function to format time duration
function formatDuration(milliseconds) {
  const seconds = (milliseconds / 1000).toFixed(2);
  return `${seconds} seconds`;
}

// Function to format timestamp
function getFormattedTimestamp() {
  return new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Function to split text into chunks intelligently
// Function to split text into chunks intelligently
function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  let currentChunk = '';
  
  // Split text into paragraphs, preserving empty lines
  const paragraphs = text.split(/(\n\n+)/);
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    
    // Handle empty lines/separators
    if (paragraph.match(/^\n+$/)) {
      if (currentChunk) {
        currentChunk += paragraph;
      }
      continue;
    }
    
    // If paragraph itself is longer than maxLength, split by sentences
    if (paragraph.length > maxLength) {
      // Improved sentence splitting regex that handles multiple punctuation marks
      const sentences = paragraph.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [paragraph];
      
      for (const sentence of sentences) {
        const sentenceWithSpace = sentence.trim() + (sentence.match(/\s+$/) || [''])[0];
        
        if (currentChunk.length + sentenceWithSpace.length <= maxLength) {
          currentChunk += sentenceWithSpace;
        } else {
          if (currentChunk) chunks.push(currentChunk.trim());
          // If single sentence is longer than maxLength, split it further
          if (sentenceWithSpace.length > maxLength) {
            const words = sentenceWithSpace.split(/\s+/);
            currentChunk = '';
            let tempChunk = '';
            
            for (const word of words) {
              if (tempChunk.length + word.length + 1 <= maxLength) {
                tempChunk += (tempChunk ? ' ' : '') + word;
              } else {
                if (tempChunk) chunks.push(tempChunk.trim());
                tempChunk = word;
              }
            }
            currentChunk = tempChunk;
          } else {
            currentChunk = sentenceWithSpace;
          }
        }
      }
    } else {
      // Handle normal paragraphs
      if (currentChunk.length + paragraph.length <= maxLength) {
        currentChunk += paragraph;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      }
    }
  }
  
  // Add the last chunk if it exists
  if (currentChunk) chunks.push(currentChunk.trim());
  
  return chunks;
}


async function translateText(text, chunkIndex, totalChunks) {
  try {
    const startTime = Date.now();
    console.log(`\nAPI call started for chunk ${chunkIndex + 1}/${totalChunks} at: ${getFormattedTimestamp()}`);
    console.log(`Chunk size: ${text.length} characters`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Translate the following English text to Vietnamese. Keep the formatting and structure of the original text. Translate only the content."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`API call completed for chunk ${chunkIndex + 1} at: ${getFormattedTimestamp()}`);
    console.log(`API call duration: ${formatDuration(duration)}`);

    return response.choices[0].message.content;
  } catch (error) {
    console.error(`Error during translation of chunk ${chunkIndex + 1}:`, error);
    throw error;
  }
}

async function main() {
  try {
    const startTime = Date.now();
    console.log('Translation process started at:', getFormattedTimestamp());

    // Read input file
    const inputFile = '../input/input50000.txt';
    const outputFile = 'output.txt';

    console.log('\nReading input file...');
    const inputText = await fs.readFile(inputFile, 'utf8');
    const inputCharCount = inputText.length;
    console.log(`Total input text character count: ${inputCharCount} characters`);

    // Split text into chunks
    const chunks = splitTextIntoChunks(inputText, CHUNK_SIZE);
    console.log(`\nText split into ${chunks.length} chunks`);

    // Translate each chunk
    const translatedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`\nProcessing chunk ${i + 1} of ${chunks.length}`);
      const translatedChunk = await translateText(chunks[i], i, chunks.length);
      translatedChunks.push(translatedChunk);
    }

    // Combine translated chunks
    const translatedText = translatedChunks.join('\n\n');
    const outputCharCount = translatedText.length;

    // Calculate character difference
    const charDifference = outputCharCount - inputCharCount;
    const charDifferencePercent = ((charDifference / inputCharCount) * 100).toFixed(2);

    // Write to output file
    console.log('\nWriting translation to output file...');
    await fs.writeFile(outputFile, translatedText, 'utf8');

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log('\n=== Translation Summary ===');
    console.log('Translation completed successfully!');
    console.log(`Output saved to: ${outputFile}`);
    console.log(`Total process duration: ${formatDuration(totalDuration)}`);
    console.log('\nStatistics:');
    console.log(`- Start time: ${new Date(startTime).toLocaleString('vi-VN')}`);
    console.log(`- End time: ${new Date(endTime).toLocaleString('vi-VN')}`);
    console.log(`- Number of chunks processed: ${chunks.length}`);
    console.log(`- Input characters: ${inputCharCount}`);
    console.log(`- Output characters: ${outputCharCount}`);
    console.log(`- Character difference: ${charDifference} (${charDifferencePercent}%)`);
    console.log(`- Average chunk size: ${Math.round(inputCharCount / chunks.length)} characters`);

  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the program
main();