const { chromium } = require("playwright");


async function fetchWebsiteContent(websites) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    let combinedContent = '';

    for (const website of websites) {
        try {
            await page.goto(website, { timeout: 60000, waitUntil: 'domcontentloaded' });
            const bodyText = await page.evaluate(() => document.body.innerText || '');
            combinedContent += `Website: ${website}\n${bodyText.trim()}\n\n`;
        } catch (error) {
        }
    }

    await browser.close();
    return combinedContent;
}

function extractCoordinates(url) {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
        return { lat: match[1], lng: match[2] };
    }
    return null;
}


module.exports = {fetchWebsiteContent, extractCoordinates}