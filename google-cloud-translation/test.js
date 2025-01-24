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
    const [translation] = await translate.translate(text, targetLanguage);
    return translation;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
};

const main = async () => {
  try {
    const inputFilePath = '../input.txt';
    const outputFilePath = 'output.txt';
    const targetLanguage = 'vi';

    const startTime = new Date();
    console.log(`Start time: ${startTime.toISOString()}`);

    const text = await readFile(inputFilePath);

    const translatedText = await translateText(text, targetLanguage);

    await writeFile(outputFilePath, translatedText);

    const endTime = new Date();
    console.log(`End time: ${endTime.toISOString()}`);

    const duration = (endTime - startTime) / 1000;
    console.log(`Completion time: ${duration} seconds`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

main();
