const { chromium } = require('playwright');
const fs = require('fs');
const Papa = require('papaparse');

// File paths
const DETAILED_FILE = 'data/places_detailed.csv';
const CLOUDFLARE_FILE = 'data/places_detailed_cloudflare.csv';

// Helper function to read CSV
function readCSV(filePath) {
    if (fs.existsSync(filePath)) {
        const csvData = fs.readFileSync(filePath, 'utf-8');
        return Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;
    }
    return [];
}

// Helper function to write CSV
function writeCSV(filePath, data) {
    const csvString = Papa.unparse(data);
    fs.writeFileSync(filePath, csvString, 'utf-8');
}

// Extract coordinates from Google Maps URL
function extractCoordinatesFromUrl(url) {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
        return { lat: match[1], lng: match[2] };
    }
    return null;
}

(async () => {
    // Launch Playwright
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Process each file
    const filesToProcess = [DETAILED_FILE, CLOUDFLARE_FILE];
    for (const filePath of filesToProcess) {
        console.log(`Processing file: ${filePath}`);

        // Read data
        const data = readCSV(filePath);

        for (const row of data) {
            if (!row.place_name || row.place_coordinates) {
                // Skip if place_name is missing or coordinates already exist
                continue;
            }

            console.log(`Searching for: ${row.place_name}`);

            try {
                const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(row.place_name)}`;
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

                // Wait for URL to change and listen for the final redirected URL
                let coordinates = null;
                await page.waitForFunction(() => window.location.href.includes('@'), { timeout: 15000 });

                const currentUrl = page.url();
                console.log(`Current URL: ${currentUrl}`);

                coordinates = extractCoordinatesFromUrl(currentUrl);
                if (coordinates) {
                    console.log(`Extracted coordinates: ${coordinates.lat}, ${coordinates.lng}`);
                    row.place_coordinates = `${coordinates.lat},${coordinates.lng}`;
                    // Save immediately after updating the row
                    writeCSV(filePath, data);
                    console.log(`Updated coordinates for: ${row.place_name}`);
                } else {
                    console.log(`Failed to extract coordinates for: ${row.place_name}`);
                }
            } catch (error) {
                console.error(`Error processing ${row.place_name}: ${error.message}`);
            }
        }

        console.log(`Updated file saved: ${filePath}`);
    }

    await browser.close();
})();
