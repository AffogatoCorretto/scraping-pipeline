const PlaceModel = {
    place_name: '',              // Name of the place
    place_id: '',                // Google Maps identifier for the place (if available)
    place_descriptions: '',      // Descriptions of the place
    place_categories: '',        // Main category for the place
    place_sub_categories: '',    // Array of subcategories
    place_address: '',           // Full address of the place
    place_zipcode: '',           // ZIP code of the place
    place_gmap_link: '',         // Google map link of the place
    place_coordinates: '',       // Array containing latitude and longitude
    place_ratings: '',           // Overall ratings
    place_reviews: '',           // Detailed reviews
    place_reviews_count: '',     // Total number of reviews
    place_hours: '',             // Object representing opening hours
    place_images: '',            // Array of image URLs
    place_amenities: '',         // Object representing amenities available
    place_website: '',           // Website URL of the place
    place_relevant_websites: '', // Array of additional relevant website links
    place_keywords: '',          // Array of Keywords of the place
    place_socials: ''            // Array of socials of the place
  };
  
const place_categories = [
    'sightseeing_&_landmark',     // Landmarks and sightseeing
    'arts_&_culture',             // Arts and cultural attractions
    'entertainment_&_nightlife',  // Entertainment and nightlife spots
    'dinning_&_culinary',         // Dining and culinary experiences
    'shopping',                   // Shopping destinations
    'outdoor_&_natural'           // Outdoor and natural attractions
  ];
  
module.exports = { PlaceModel, place_categories };