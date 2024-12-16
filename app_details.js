const { chromium } = require('playwright');
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');
const { generateObject, jsonSchema } = require('ai'); 
const { createOpenAI } = require('@ai-sdk/openai');
const { PlaceModel, place_categories } = require('./constants/placeDetails');
const { fetchWebsiteContent, extractCoordinates } = require('./Utils/utils');
const { classifyAIObject } = require('./constants/aiStructure');

async function __scroll_to_bottom(page, classname, repeat){
    for(let i=0;i<repeat;i++){
        await page.waitForTimeout(500);

        await page.evaluate((classname) => {
            const element = document.querySelector(classname);
            if (element) {
                if (element.scrollHeight > element.clientHeight) {
                    element.scrollTo({
                        top: element.scrollHeight,
                        behavior: 'smooth' 
                    });
                } else {
                    console.log('Element is not scrollable.');
                }
            } else {
                console.log('Element not found.');
            }
        }, classname);
    }
}

async function extractWebsiteContents(page_details){
    let combinedContent = await fetchWebsiteContent(page_details.place_relevant_websites);
    const words = combinedContent.split(/\s+/, 21001);
    combinedContent = words.length > 21000 
    ? words.slice(0, 21000).join(' ')
    : combinedContent;

    const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    const model = openai.chat("gpt-4o-2024-08-06", { structuredOutputs: true });

    const result = await generateObject(classifyAIObject(model, combinedContent, page_details.place_descriptions == ''));

    page_details.place_categories = result.object.categories;
    page_details.place_sub_categories = result.object.sub_categories;
    page_details.place_keywords = result.object.keywords;
    if(page_details.place_descriptions == ''){
        page_details.place_descriptions = result.object.description;
    }
    return page_details;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const page = await context.newPage();

  const outputFilePath = 'data/places_detailed.csv';
  if (!fs.existsSync(outputFilePath)) {
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, `${Object.keys(PlaceModel).join(",")}\n`);
  }

  let gemsFilePath = 'data/extracted_gems.csv';
  const gemsFilePath2 = 'data/final_places.csv';
  gemsFilePath = gemsFilePath2;
  if (!fs.existsSync(gemsFilePath)) {
    console.error(`File not found: ${gemsFilePath}`);
    process.exit(1);
  }

  const csvData = fs.readFileSync(gemsFilePath, 'utf-8');
  const parsedData = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;

  const placesDetailedCsv = fs.readFileSync(outputFilePath, 'utf-8');
  const parsedDetailedData = Papa.parse(placesDetailedCsv, { header: true}).data; 
  const extractedPlaces = new Set(parsedDetailedData.map(row => row.place_name?.trim()).filter(name => name));

  let placesToProcess = parsedData.filter(row => row.status === 'not_extracted');

  const results = [];

  async function extractFromGoogleSearch(placeName, place_details) {
    console.log(`Searching Google for: ${placeName}`);
    const googleLink = `https://www.google.com/search?q=${encodeURIComponent(placeName+" nyc")}`;
    await page.goto(googleLink, { waitUntil: 'networkidle' });

    //Extracting place_name
    let placeTitleDiv = await page.$('div.PZPZlf.ssJ7i.B5dxMb');
    if(placeTitleDiv){
        place_details.place_name = await placeTitleDiv.textContent();
    }
    else{
        placeTitleDiv = await page.$('h2.qrShPb.pXs6bb.PZPZlf.q8U8x.aTI8gc.EaHP9c > span');
        if(placeTitleDiv){
            place_details.place_name = await placeTitleDiv.textContent();
        }
    }

    //Extracting place_address
    let placeAddressdivs = await page.$$('[data-attrid="kc:/location/location:address"]');
    if (placeAddressdivs.length > 0) {
        const place_address = await placeAddressdivs[0].$('span.LrzXr'); 
        if (place_address) {
            place_details.place_address = await place_address.textContent();
        }
    }

    //Extracting place_zipcode
    if(place_details.place_address != ''){
        const zipCodeMatch = place_details.place_address.match(/\b\d{5}\b/);
        if (zipCodeMatch) {
            place_details.place_zipcode = zipCodeMatch[0];
        }
    }

    //Extracting place_descriptions
    if(place_details.place_descriptions == ''){
        let placeDescriptiondivs = await page.$$('[data-attrid="description"]');
        if (placeDescriptiondivs.length > 0) {
            const placeDescription = await placeDescriptiondivs[0].$('div.kno-rdesc > span > span');
            if(placeDescription){
                place_details.place_descriptions = await placeDescription.textContent();
            }
        }
    }

    //Extracting page_website
    let websiteElement = await page.$('a.n1obkb.mI8Pwc');
    if (websiteElement) {
        const href = await websiteElement.getAttribute('href');
        place_details.place_website = href;
    }
    else{
        websiteElement = await page.$('div.IzNS7c.duf-h > div > a');
        if (websiteElement) {
            const href = await websiteElement.getAttribute('href');
            place_details.place_website = href;
        }
    }

    //Extracting page_relevant_websites
    const relevantWebsiteElements = await page.$$('div.kb0PBd.ieodic.jGGQ5e > div > div > span > a');
    const relevant_websites = [];

    for (const el of relevantWebsiteElements) {
        const href = await el.getAttribute('href');
        if (href && !href.includes('/search?') && !href.includes('webcache') && !href.includes('/imgres?')) {
            relevant_websites.push(href);
        }
        if (relevant_websites.length >= 20) {
            break;
        }
    }
    place_details.place_relevant_websites = relevant_websites;

    //Extracting socials
    const socialElements = await page.$$('div.OOijTb.P6Tjc.gDQYEd.Dy8CGd > div');
    const socialLinks = [];
    for (const element of socialElements) {
        const anchorTags = await element.$$('a'); 
        for (const anchor of anchorTags) {
            const href = await anchor.getAttribute('href'); 
            if (href) {
                socialLinks.push(href); 
            }
        }
    }
    place_details.place_socials = socialLinks;

    return place_details;
  }

  async function extractFromGoogleMaps(placeName, place_details) {
    if(place_details.place_name != ''){
        placeName = place_details.place_name;
    }
    console.log(`Searching Google Maps for: ${placeName}`);
    const googleMapSearchLink = `https://www.google.com/maps/search/${encodeURIComponent(placeName)}`
    await page.goto(googleMapSearchLink, { waitUntil: 'networkidle' });

    let placeIdentified = false;

    const selector = `div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd[aria-label="Results for ${placeName}"]`;
    const resultsContainer = await page.$(selector);
    if (resultsContainer) {  
        const firstOption = await resultsContainer.$('div.Nv2PK.THOPZb  > a');
        if (firstOption) {
            const ariaLabel = await firstOption.evaluate(el => el.getAttribute('aria-label'));
            await firstOption.click();
            const placeSelector = `div.m6QErb.WNBkOb.XiKgde[aria-label="${ariaLabel}"]`;
            const placeContainer = await page.waitForSelector(placeSelector);
            let placeAddressDiv = await page.$('[data-item-id="address"]');
            const placeAddress = (await placeAddressDiv.textContent()).trim();
                
            const query = `${ariaLabel} ${placeAddress.split(",")[0]} review`;
            const searchLink = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
            await page.goto(searchLink, { waitUntil: 'networkidle' });
            placeIdentified = true;
        } else {
            const fallbackOptions = await resultsContainer.$$('div.Nv2PK.Q2HXcd.THOPZb > a');
            if (fallbackOptions.length > 0) {
                await fallbackOptions[0].click();
            }
        }
    }
    else{
        placeIdentified = true;
    }

    if(placeIdentified){
        //Extracting place_names
        if(place_details.place_name == ''){
            let placeTitleDiv = await page.$('h1.DUwDvf.lfPIob');
            if(placeTitleDiv){
                place_details.place_name = (await placeTitleDiv.textContent()).trim();
            }
        }

        //Extracting place_address
        if(place_details.place_address == ''){
            let placeAddressDiv = await page.$('[data-item-id="address"]');
            if(placeAddressDiv){
                place_details.place_address = (await placeAddressDiv.textContent()).trim();
            }
        }

        //Extracting place_coordinates
        if(place_details.place_coordinates == ''){
            await page.waitForFunction(() => window.location.href.includes('@'), { timeout: 1500 });
            const coordinates = extractCoordinates(page.url());
            if (coordinates) {
                place_details.place_coordinates = `${coordinates.lat},${coordinates.lng}`;
            }
        }

        const reviewButtonSelector = `button[aria-label="Reviews for ${placeName}"]`;
        const reviewButton = await page.$(reviewButtonSelector);
        if (reviewButton) {
            await reviewButton.click();
        }

        //Extracting place_ratings
        if(place_details.place_ratings == ''){
            let placeRatingsDiv = await page.$('div.jANrlb > div.fontDisplayLarge');
            if(placeRatingsDiv){
                place_details.place_ratings = (await placeRatingsDiv.textContent()).trim();
            }
        }

        //Extracting place_reviews_count
        if(place_details.place_reviews_count == ''){
            let placeRatingCountDiv = await page.$('div.jANrlb > div.fontBodySmall');
            if(placeRatingCountDiv){
                place_details.place_reviews_count = (await placeRatingCountDiv.textContent()).split(" ")[0].trim();
            }
        }

        const overviewButtonSelector = `button[aria-label="Overview of ${placeName}"]`;
        const overviewButton = await page.$(overviewButtonSelector);
        await page.waitForTimeout(100);
        if (overviewButton) {
            await overviewButton.click();
        }

        //Extract place_images
        if(place_details.place_images.length == 0){
            const imageButtonSelector = `button[aria-label="All"]`;
            const imageButton = await page.$(imageButtonSelector);
            await page.waitForTimeout(100);
            if (imageButton) {
                await imageButton.click();
            }

            await __scroll_to_bottom(page, "div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde", 2);
            await page.waitForTimeout(250);

            const imageUrls = []
            const components = page.locator('div[role="img"]');
            const count = await components.count();
            
            for (let i = 0; i < count; i++) {
                const style = await components.nth(i).evaluate(button => button.style.backgroundImage);
                const urlMatch = style.match(/url\("(.+?)"\)/);
                if (urlMatch) {
                    const imageUrl = urlMatch[1].split("=")[0]; 
                    imageUrls.push(imageUrl); 
                }
            }
            place_details.place_images = imageUrls;

        }
    }

    return place_details;
  }

  async function extractFromWikipedia(placeName) {
    console.log(`Searching Wikipedia for: ${placeName}`);
    await page.goto(`https://en.wikipedia.org/wiki/${encodeURIComponent(placeName.replace(/ /g, '_'))}`);
    await page.waitForTimeout(3000);

    let details = {};

    try {
      details.place_description = await page.textContent('p');
      details.place_images = await page.$$eval('img', imgs => imgs.map(img => img.src));
    } catch (err) {
      console.log(`Wikipedia extraction failed for ${placeName}`);
    }

    return details;
  }

  for (const place of placesToProcess) {
    console.log(`Processing: ${place.place_name}`);

    let consolidatedDetails = { place_name: place.place_name };
    let place_details = structuredClone(PlaceModel);
    if(place.place_description){
        place_details.place_descriptions = place.place_description;
    }

    try {
      await extractFromGoogleSearch(place.place_name, place_details);
      await extractFromGoogleMaps(place.place_name, place_details);
    //   const wikipediaDetails = await extractFromWikipedia(place.place_name);

      let addArr = place_details.place_address.split(" ");

      if (!extractedPlaces.has(place_details.place_name) && addArr[addArr.length-2]=="NY") {

        if(place_details.place_images.length > 0){

            place_details = await extractWebsiteContents(place_details);
            console.log("OpenAI proccessed website contents")

            results.push(place_details);
            extractedPlaces.add(place_details.place_name);
            const csvRow = Papa.unparse([place_details], { header: false }).trim(); 
            fs.appendFileSync(outputFilePath, `${csvRow}\n`);
            console.log("[Place added]")
        
            parsedData.forEach(row => {
                if (row.place_name === place.place_name) {
                row.status = 'extracted';
                }
            });
            //   const updatedCsv = Papa.unparse(parsedData, { header: true });
            //   fs.writeFileSync(gemsFilePath, updatedCsv);
        }
        else{
            console.log(`[Skipping place IMGS] ${place_details.place_name}`)
        }
      }
      else{
        console.log(`[Skipping place] ${place_details.place_name}`)
      }

    } catch (err) {
      console.error(`Failed to process ${place.place_name}: ${err}`);
    }

  }

//   const detailedCsv = Papa.unparse(results, { header: true });
//   fs.writeFileSync(outputFilePath, detailedCsv);
//   console.log(`Detailed information saved to ${outputFilePath}`);

  await browser.close();
})();
