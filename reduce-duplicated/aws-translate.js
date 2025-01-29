const fs = require('fs');
const path = require('path');
const { 
    TranslateClient, 
    TranslateTextCommand 
} = require("@aws-sdk/client-translate");

require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

const translate = new TranslateClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const inputFile = 'input5000.txt';
const outputFile = './output/aws-output.txt';
const translationDictFile = 'translation_dict.json';

const CHUNK_SIZE = 9000;
const BATCH_SIZE = 1000; 
const DELAY_MS = 100; 


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


async function translateSingleWord(word) {
    try {
        const params = {
            Text: word,
            SourceLanguageCode: "en",
            TargetLanguageCode: "vi"
        };

        const command = new TranslateTextCommand(params);
        const response = await translate.send(command);
        return response.TranslatedText;
    } catch (error) {
        console.error(`Error translating word '${word}':`, error);
        throw error;
    }
}

async function translateBatch(words) {
    const translations = {};
    for (const word of words) {
        try {
            translations[word] = await translateSingleWord(word);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        } catch (error) {
            console.error(`Failed to translate word: ${word}`);
            translations[word] = word; 
        }
    }
    return translations;
}

// Hàm dịch tất cả các từ theo batch
async function translateWords(words) {
    const translations = {};
    const batches = [];
    
    // Chia từ thành các batch
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
        batches.push(words.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batches of words...`);

    // Xử lý từng batch
    for (let i = 0; i < batches.length; i++) {
        console.log(`Processing batch ${i + 1}/${batches.length}...`);
        const batchTranslations = await translateBatch(batches[i]);
        Object.assign(translations, batchTranslations);
    }

    return translations;
}

// Hàm dịch một đoạn văn bản
async function translateTextWithPrompt(text, chunkIndex, totalChunks) {
    try {
        const params = {
            Text: text,
            SourceLanguageCode: "en",
            TargetLanguageCode: "vi"
        };

        const command = new TranslateTextCommand(params);
        const response = await translate.send(command);
        return response.TranslatedText;
    } catch (error) {
        console.error(`Error translating chunk ${chunkIndex + 1}:`, error);
        throw error;
    }
}

// Các hàm tiện ích giữ nguyên như cũ
function readTextFromFile(filePath) {
    return fs.promises.readFile(filePath, 'utf8');
}

function writeTextToFile(filePath, text) {
    return fs.promises.writeFile(filePath, text, 'utf8');
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

function replaceWithTranslations(text, translationDict) {
    let result = text;
    for (const [englishWord, vietnameseWord] of Object.entries(translationDict)) {
        const regex = new RegExp(`\\b${englishWord}\\b`, 'g');
        result = result.replace(regex, vietnameseWord);
    }
    return result;
}

function formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
}

// Hàm chính
async function main() {
    const startTime = Date.now();

    try {
        console.log('Reading input file...');
        const inputText = await readTextFromFile(inputFile);
        const originalLength = inputText.length;

        console.log('Finding duplicate words...');
        const duplicateWords = findDuplicateWords(inputText);
        console.log(`Found ${duplicateWords.length} duplicate words`);

        console.log('Translating duplicate words...');
        const translationDict = await translateWords(duplicateWords);
        await writeTextToFile(translationDictFile, JSON.stringify(translationDict, null, 2));

        const chunks = splitIntoChunks(inputText, CHUNK_SIZE);
        console.log(`Split text into ${chunks.length} chunks`);

        console.log('\nTranslating chunks...');
        let fullTranslation = '';
        for (let i = 0; i < chunks.length; i++) {
            console.log(`Translating chunk ${i + 1}/${chunks.length}...`);
            const translation = await translateTextWithPrompt(chunks[i], i, chunks.length);
            fullTranslation += translation + '\n\n';
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

        console.log('Replacing words with dictionary translations...');
        fullTranslation = replaceWithTranslations(fullTranslation, translationDict);

        await writeTextToFile(outputFile, fullTranslation);

        console.log('\nTranslation completed successfully!');
        console.log(`Input length: ${inputText.length} characters`);
        console.log(`Output length: ${fullTranslation.length} characters`);
        console.log(`Number of chunks processed: ${chunks.length}`);
        console.log(`Number of duplicate words translated: ${duplicateWords.length}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        const endTime = Date.now();
        const totalExecutionTime = endTime - startTime;
        console.log(`\nTotal execution time: ${formatTime(totalExecutionTime)}`);
    }
}

main();
