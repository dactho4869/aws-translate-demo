const fs = require('fs');
const { Translate } = require('@google-cloud/translate').v2;
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const apiKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const translate = new Translate({ key: apiKey });

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

const translateText = async (text, targetLanguage) => {
  try {
    const apiCallTime = new Date();
    console.log(`API call started at: ${apiCallTime.toISOString()}`);
    
    const [translation] = await translate.translate(text, targetLanguage);
    
    const apiEndTime = new Date();
    const apiDuration = (apiEndTime - apiCallTime) / 1000;
    console.log(`API call completed at: ${apiEndTime.toISOString()}`);
    console.log(`API call duration: ${apiDuration} seconds`);
    
    return translation;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
};

const countCharacters = (text) => {
  return text.length;
};

const main = async () => {
  try {
    const inputFilePath = '../input/input500.txt';
    const outputFilePath = 'output.txt';
    const targetLanguage = 'vi';

    const startTime = new Date();
    console.log(`Start time: ${startTime.toISOString()}`);

    const text = await readFile(inputFilePath);
    const originalCharCount = countCharacters(text);
    console.log(`Original text character count: ${originalCharCount}`);

    const translatedText = await translateText(text, targetLanguage);
    const translatedCharCount = countCharacters(translatedText);
    console.log(`Translated text character count: ${translatedCharCount}`);

    await writeFile(outputFilePath, translatedText);

    const endTime = new Date();
    console.log(`End time: ${endTime.toISOString()}`);

    const duration = (endTime - startTime) / 1000;
    console.log(`Total completion time: ${duration} seconds`);
    
    console.log('\nSummary Report:');
    console.log('==============');
    console.log(`Original text length: ${originalCharCount} characters`);
    console.log(`Translated text length: ${translatedCharCount} characters`);
    console.log(`Character count difference: ${translatedCharCount - originalCharCount} characters`);
    console.log(`Total processing time: ${duration} seconds`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

main();
