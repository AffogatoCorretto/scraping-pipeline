import requests
import pandas as pd
import json

def format_place_data(row):
    """Format the data according to the API's expected structure."""
    # Load JSON fields safely
    coordinates = row["place_coordinates"].split(",") if pd.notna(row["place_coordinates"]) else [None, None]
    categories = row["place_categories"] if pd.notna(row["place_categories"]) else []
    sub_categories = row["place_sub_categories"].split(",") if pd.notna(row["place_sub_categories"]) else []
    image_urls = row["place_images"].split(",") if pd.notna(row["place_images"]) else []
    keywords = row["place_keywords"].split(",") if pd.notna(row["place_keywords"]) else []
    reviews = row["place_reviews"].split(",") if pd.notna(row["place_reviews"]) else []
    opening_hours = json.loads(row["place_hours"]) if pd.notna(row["place_hours"]) else {}

    formatted_data = {
        # Fields for the 'items' table
        "itemName": row["place_name"],
        "category": categories if categories else None,
        "subCategory": sub_categories,
        "description": row.get("place_descriptions", ""),
        "latitude": float(coordinates[0]) if coordinates[0] else None,
        "longitude": float(coordinates[1]) if coordinates[1] else None,
        "itemAddress": row.get("place_address",""),
        "itemZipcode": row.get("place_zipcode",""),
        "priceRange": row.get("place_price_range", "Moderate"),
        "historicalSignificance": False,  # Default value; adjust if data is available
        "culturalAuthenticity": None,     # Adjust if data is available
        "specialties": [],  # Populate if you have data
        "openingHours": opening_hours,
        "activeStatus": True,
        "imageUrls": image_urls,
        "keywords": keywords,

        # Fields for the 'ratings' table
        "rating": {
            "averageRating": float(row["place_ratings"]) if pd.notna(row["place_ratings"]) else None,
            "reviewCount": int(row["place_reviews_count"].replace(",","")) if pd.notna(row["place_reviews_count"]) else None,
        },

        # 'reviews' data
        "reviews": reviews,

        # 'ambience' and 'vibes' (if available)
        "ambience": [],  # Populate if you have data
        "vibes": [],     # Populate if you have data

        # Additional fields
        "address": row["place_address"] if pd.notna(row["place_address"]) else None,
        "zipcode": int(row["place_zipcode"]) if pd.notna(row["place_zipcode"]) else None,
        "website": row["place_website"] if pd.notna(row["place_website"]) else None,
        "orderLink": None,  # If applicable, include a link for orders
    }

    return formatted_data

def send_place_data(place_data):
    """Send formatted place data to the API."""
    api_url = "http://localhost:8787/WBkI9gfCUk/items"
    bearer_token = 'srg8oaa74l4Ia3Imal4INo0AOXH76mWl'

    headers = {
        'Authorization': f'Bearer {bearer_token}',
        'Content-Type': 'application/json'
    }

    response = requests.post(api_url, headers=headers, json=place_data)

    if response.status_code == 200:
        print("Data successfully sent:", response.json())
    else:
        print(f"Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    # Load and filter the data
    INPUT_FILE = "data/places_detailed_cloudflare.csv"
    df = pd.read_csv(INPUT_FILE)

    # Remove rows with missing images
    df = df[~(pd.isna(df['place_images']) | (df['place_images'] == ''))]

    # Iterate through each row and send data
    for idx, row in df.iterrows():
        try:
            formatted_data = format_place_data(row)
            print(f"Sending data for: {formatted_data['itemName']}")
            send_place_data(formatted_data)
        except Exception as e:
            print("Skipping "+row["place_name"])
