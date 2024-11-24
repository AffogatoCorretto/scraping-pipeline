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

  console.log(process.env.OPENAI_API_KEY);
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const model = openai.chat("gpt-4o-2024-08-06", { structuredOutputs: true });

  const schema = jsonSchema({
    type: "object",
    properties: {
      place_name: { type: "string" },
      place_description: { type: "string" },
    },
    required: ["place_name", "place_description"],
    additionalProperties: false,
  });

  let linksToProcess = [];
  let gemLinksData = [];

  if (fs.existsSync(gemLinksFilePath)) {
    const csvData = fs.readFileSync(gemLinksFilePath, 'utf-8');
    const parsedData = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;

    parsedData.forEach(row => {
      if (row.links && row.status) {
        gemLinksData.push({ link: row.links.trim(), status: row.status.trim() });
        if (row.status.trim() === 'not_extracted') {
          linksToProcess.push(row.links.trim());
        }
      }
    });
  } else {
    console.error('gem_links.csv not found.');
    process.exit(1);
  }

  for (let i = 0; i < 1; i++) {
    const link = linksToProcess[i];
    console.log(`Processing link ${i + 1}/${linksToProcess.length}: ${link}`);

    try {
      await page.goto(link, { timeout: 60000, waitUntil: 'networkidle' });
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
      - Extract the name of the place. The name should be accurate, concise, and directly derived from the content.
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
      console.log(data);

    } catch (error) {
      console.error(`Error processing link ${link}:`, error);

      for (let j = 0; j < gemLinksData.length; j++) {
        if (gemLinksData[j].link === link) {
          gemLinksData[j].status = 'failed';
          break;
        }
      }
    }
  }

  // Write gem_links.csv using PapaParse
//   const updatedCsv = Papa.unparse(gemLinksData, { header: true });
//   fs.writeFileSync(gemLinksFilePath, updatedCsv);

  await browser.close();
})();
