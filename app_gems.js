const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { generateObject, jsonSchema } = require('ai'); 
const { createOpenAI } = require('@ai-sdk/openai');
const Papa = require('papaparse');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  const page = await context.newPage();

  const gemLinksFilePath = 'data/gem_links.csv';
  const extractedGemsFilePath = 'data/extracted_gems.csv';

  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const model = openai.chat("gpt-4o-2024-08-06", { structuredOutputs: true });

  const schema = jsonSchema({
    type: "object",
    properties: {
      places: {
        type: "array",
        items: {
          type: "object",
          properties: {
            place_name: { type: "string" },
            place_description: { type: "string" },
          },
          required: ["place_name", "place_description"],
          additionalProperties: false,
        },
      },
    },
    required: ["places"],
    additionalProperties: false,
  });

  let linksToProcess = [];
  let gemLinksData = [];
  let existingPlaces = new Set();

  if (fs.existsSync(gemLinksFilePath)) {
    const csvData = fs.readFileSync(gemLinksFilePath, 'utf-8');
    const parsedData = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;

    parsedData.forEach(row => {
      if (row.links && row.status) {
        gemLinksData.push({ links: row.links.trim(), status: row.status.trim() });
        if (row.status.trim() === 'not_extracted') {
          linksToProcess.push(row.links.trim());
        }
      }
    });
  } else {
    console.error('gem_links.csv not found.');
    process.exit(1);
  }

  if (fs.existsSync(extractedGemsFilePath)) {
    const extractedCsvData = fs.readFileSync(extractedGemsFilePath, 'utf-8');
    const parsedExtractedData = Papa.parse(extractedCsvData, { header: true, skipEmptyLines: true }).data;

    parsedExtractedData.forEach(row => {
      if (row.place_name && row.place_description) {
        existingPlaces.add(`${row.place_name.trim()}|${row.place_description.trim()}`);
      }
    });
  } else {
    fs.mkdirSync(path.dirname(extractedGemsFilePath), { recursive: true });
    fs.writeFileSync(extractedGemsFilePath, 'place_name,place_description,status\n');
  }

  console.log(`Links to process: ${linksToProcess.length}`)

  for (let i = 0; i < linksToProcess.length; i++) {
    const link = linksToProcess[i];
    console.log(`Processing link ${i + 1}/${linksToProcess.length}: ${link}`);

    try {
        try{
            await page.goto(link, { timeout: 5000, waitUntil: 'networkidle' });
        }
        catch(error){
            console.error(`Error processing the link: ${link}`,error)
        }
      const content = await page.evaluate(() => {
        return document.body.innerText;
      });

      const result = await generateObject({
        model: model,
        schemaName: 'hidden_gem_extraction',
        schemaDescription: 'Identify all hidden gem places from the provided webpage content and extract their names and descriptions. Return results in a structured JSON format.',
        schema: schema,
        prompt: `
      You are a highly skilled content parser. Your task is to analyze the following webpage content and extract information about "hidden gem" places. A "hidden gem" is defined as a unique or lesser-known place that stands out for its beauty, uniqueness, cultural significance, or charm.
      
      For each hidden gem:
      - Extract the name of the place. The name should be accurate, concise, and directly derived from the content[dont be a general neighbourhood].
      - Extract a description of the place. The description should summarize why the place is special, including key attributes like ambiance, features, and appeal.
      
      The output must be in JSON format as follows:
      [
        {
          "place_name": "string", // Name of the place
          "place_description": "string" // Brief description of why it's a hidden gem
        },
        ...
      ]
      
      Ensure:
      - The extracted information is relevant to "hidden gems" only.
      - Avoid generic descriptions or places that don't fit the definition of a hidden gem.
      - Maintain clarity and accuracy.
      
      Here is the webpage content:
      ---
      ${content}
        `,
      });      

      const data = result.object;
      
      if (data.places && data.places.length > 0) {
        const newPlaces = [];

        data.places.forEach(place => {
          const placeKey = `${place.place_name.trim()}|${place.place_description.trim()}|not_extracted`;
          if (!existingPlaces.has(placeKey)) {
            existingPlaces.add(placeKey);
            newPlaces.push(place);
          }
        });

        if (newPlaces.length > 0) {
          const newPlacesCsv = Papa.unparse(newPlaces, { header: false });
          fs.appendFileSync(extractedGemsFilePath, `\n${newPlacesCsv}`);
        }
      }

      for (let j = 0; j < gemLinksData.length; j++) {
        if (gemLinksData[j].links === link) {
          gemLinksData[j].status = 'extracted';
          break;
        }
      }

      const updatedCsv = Papa.unparse(gemLinksData, { header: true });
      fs.writeFileSync(gemLinksFilePath, updatedCsv);

    } catch (error) {
      console.error(`Error processing link ${link}:`, error);

      for (let j = 0; j < gemLinksData.length; j++) {
        if (gemLinksData[j].links === link) {
          gemLinksData[j].status = 'failed';
          break;
        }
      }
    }
  }

  await browser.close();
})();
