const fs = require('fs');
const pdf = require('pdf-parse');

const extractTextFromPDF = async (input) => {
  try {
    let dataBuffer;
    
    // Check if input is a file path (string) or a buffer
    if (typeof input === 'string') {
      // Original behavior for file path
      dataBuffer = fs.readFileSync(input);
    } else if (Buffer.isBuffer(input)) {
      // New behavior for buffer input
      dataBuffer = input;
    } else {
      throw new Error('Input must be a file path (string) or Buffer');
    }
    
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF.');
  }
};

module.exports = { extractTextFromPDF }; 