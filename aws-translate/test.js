// Required AWS SDK and file system modules
const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
const fs = require('fs').promises;
const path = require('path'); 
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
}); 


// AWS Configuration
const REGION = "ap-southeast-1"; 
const translate = new TranslateClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Constants
const MAX_CHUNK_SIZE = 9000;

/**
 * Format time duration in milliseconds to readable format
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

function splitIntoChunks(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += sentence + ' ';
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

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

async function translateFile(inputPath, outputPath) {
    const startTime = Date.now();
    let totalOriginalChars = 0;
    let totalTranslatedChars = 0;
    let totalTranslationTime = 0;

    try {
        console.log("Reading input file...");
        const text = await fs.readFile(inputPath, 'utf8');
        totalOriginalChars = text.length;

        console.log(`Original text length: ${totalOriginalChars.toLocaleString()} characters`);
        
        console.log("Splitting text into chunks...");
        const chunks = splitIntoChunks(text);
        console.log(`Total chunks: ${chunks.length}`);

        console.log("\nTranslating chunks...");
        const translatedChunks = [];
        
        for (let i = 0; i < chunks.length; i++) {
            console.log(`\nTranslating chunk ${i + 1}/${chunks.length}`);
            console.log(`Chunk size: ${chunks[i].length.toLocaleString()} characters`);
            
            try {
                const result = await translateText(chunks[i]);
                translatedChunks.push(result.text);
                
                totalTranslationTime += result.duration;
                totalTranslatedChars += result.translatedLength;

                console.log(`Chunk ${i + 1} translation time: ${(result.duration / 1000).toFixed(2)}s`);
                console.log(`Chunk ${i + 1} characters: ${result.originalLength.toLocaleString()} → ${result.translatedLength.toLocaleString()}`);
                
                if (i < chunks.length - 1) {
                    await delay(500);
                }
            } catch (error) {
                console.error(`Error translating chunk ${i + 1}:`, error);
                translatedChunks.push(chunks[i]);
                totalTranslatedChars += chunks[i].length;
            }
        }

        console.log("\nWriting translated text to output file...");
        const finalTranslation = translatedChunks.join('\n');
        await fs.writeFile(outputPath, finalTranslation, 'utf8');

        const totalTime = Date.now() - startTime;

        console.log("\n=== Translation Summary ===");
        console.log(`Total time: ${formatDuration(totalTime)}`);
        console.log(`Pure translation time: ${formatDuration(totalTranslationTime)}`);
        console.log(`Original characters: ${totalOriginalChars.toLocaleString()}`);
        console.log(`Translated characters: ${totalTranslatedChars.toLocaleString()}`);
        console.log(`Character ratio: ${(totalTranslatedChars / totalOriginalChars).toFixed(2)}x`);
        console.log(`Average translation speed: ${Math.round(totalOriginalChars / (totalTranslationTime / 1000))} chars/second`);

    } catch (error) {
        console.error("Error in translation process:", error);
    }
}

// Example usage
const inputFile = path.join(__dirname, '../input.txt');
const outputFile = path.join(__dirname, 'output_vietnamese.txt');

translateFile(inputFile, outputFile);