const { jsonSchema } = require("ai");

const classifySchema = jsonSchema({
    type: "object",
    properties: {
        categories: {
            type: "string",
            enum: [
                'sightseeing_&_landmark',
                'arts_&_culture',
                'entertainment_&_nightlife',
                'dinning_&_culinary',
                'shopping',
                'outdoor_&_natural'
            ]
        },
        sub_categories: {
            type: "array",
            items: { type: "string" },
            description: "General categories describing the place (e.g., architecture, history, family-friendly, nightlife)."
        },
        keywords: {
            type: "array",
            items: { type: "string" },
            description: "Keywords that describe the place, its ambiance, features, and other attributes."
        },
    },
    required: ["categories", "sub_categories", "keywords"],
    additionalProperties: false,
});

const classifyAIObject = (model, content) => ({
    model: model,
    schemaName: 'place_category_extraction',
    schemaDescription: `
    Analyze the webpage content and classify it based on the place's attributes. 
    Identify the most relevant categories, sub-categories, and related keywords.
    `,
    schema: classifySchema,
    prompt: `
    You are an expert content parser. Your task is to analyze the following webpage content and classify it based on the place's attributes.

    For each webpage:
    - Identify the main category (one of ['sightseeing_&_landmark', 'arts_&_culture', 'entertainment_&_nightlife', 'dinning_&_culinary', 'shopping', 'outdoor_&_natural']). 
    This should represent the most relevant high-level classification for the place.

    - Extract sub-categories as an array (e.g., architecture, history, family-friendly, nightlife).

    - Generate keywords as an array. These should include terms that describe the place's ambiance, unique features, services, or offerings.

    Here is the webpage content:
    ---
    ${content}
    `,
});

module.exports = {classifyAIObject};