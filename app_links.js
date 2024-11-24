const { chromium } = require('playwright');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');


(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const page = await context.newPage();
  await page.goto('https://www.google.com');
  await page.waitForLoadState('load');

  const cookies = await context.cookies();
  const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

  const queries = [
    'hidden gems in nyc',
  ];

  const googleGemsFilePath = 'data/google_gems.csv';
  const gemlinksFilePath = 'data/gem_links.csv';

  let existingPlaces = new Set();
  if (fs.existsSync(googleGemsFilePath)) {
    const csvData = fs.readFileSync(googleGemsFilePath, 'utf-8');
    const parsedData = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    parsedData.data.forEach(row => {
      if (row.place_name) {
        existingPlaces.add(row.place_name.trim());
      }
    });
  } else {
    fs.mkdirSync(path.dirname(googleGemsFilePath), { recursive: true });
    fs.writeFileSync(googleGemsFilePath, 'place_name,place_description\n');
  }

  let existingLinks = new Set();
  if (fs.existsSync(gemlinksFilePath)) {
    const csvData = fs.readFileSync(gemlinksFilePath, 'utf-8');
    const parsedData = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    parsedData.data.forEach(row => {
      if (row.links) {
        existingLinks.add(row.links.trim());
      }
    });
  } else {
    fs.mkdirSync(path.dirname(gemlinksFilePath), { recursive: true });
    fs.writeFileSync(gemlinksFilePath, 'links,status\n');
  }

  async function extractGoogleGems(page, query) {
    const sourcesTextSelector = '//div[contains(text(), "From sources across the web")]';
    const sourcesElement = await page.$(sourcesTextSelector);

    await page.waitForTimeout(3000);
    if (sourcesElement) {
        const sinMWDivs = await page.$$('div.sinMW > aside');
        console.log(`"From sources across the web" found for query "${query}", length - ${sinMWDivs.length}`);

        for (let i = 0; i < sinMWDivs.length; i++) {
            const div = sinMWDivs[i];
            const placeNameDiv = await div.$('div.I506P.IFnjPb > a');
            const descriptionDiv = await div.$('div > div.YbOmnd.s0Odib.wHYlTd');
            let placeName = '', placeDescription = '';
            if (placeNameDiv) {
                placeName = await placeNameDiv.textContent();
            }
            if(descriptionDiv) {
                const spanTexts = await descriptionDiv.$$eval('span', spans => spans.map(span => span.textContent.trim()));
                placeDescription = spanTexts.join(' ');
            }
            
            if (placeName && !existingPlaces.has(placeName)) {
                existingPlaces.add(placeName);
                const csvRow = Papa.unparse([{ place_name: placeName.trim(), place_description: placeDescription.trim() }], { header: false });
                fs.appendFileSync(googleGemsFilePath, `${csvRow}\n`);
            }
        }
    } else {
        console.log(`"From sources across the web" not found for query "${query}"`);
    }
  }

  async function extractLinks(query) {
    const encodedQuery = encodeURIComponent(query);
    await page.route('**/*', (route, request) => {
      const headers = {
        ...request.headers(),
        'Cookie': cookieString,
      };
      route.continue({ headers });
    });

    await page.goto(`https://www.google.com/search?q=${encodedQuery}`);
    await page.waitForSelector('div.g');

    await extractGoogleGems(page, query);

    const links = await page.$$eval('div.g a', elements => {
      const urls = [];
      for (const el of elements) {
        const href = el.href;
        if (href && !href.includes('/search?') && !href.includes('webcache') && !href.includes('/imgres?')) {
          urls.push(href);
        }
        if (urls.length >= 20) {
          break;
        }
      }
      return urls;
    });

    console.log(`Links for query "${query}": 20`);

    for (let i = 0; i < links.length; i++) {
      if (links[i] && !existingLinks.has(links[i])) {
        existingLinks.add(links[i]);
        const csvRow = Papa.unparse([{ links: links[i].trim(), status: 'not_extracted' }], { header: false });
        fs.appendFileSync(gemlinksFilePath, `${csvRow}\n`);
      }
    }
    
  }

  for (const query of queries) {
    await extractLinks(query);
  }

  await browser.close();
})();