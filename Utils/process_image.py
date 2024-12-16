import os
import json
import requests
import pandas as pd
from random import sample

INPUT_FILE = "data/places_selected_final.csv"
OUTPUT_FILE = "data/places_detailed_cloudflare.csv"
OUTPUT_DIR = "images"
CLOUDFLARE_UPLOAD_URL = "https://api.cloudflare.com/client/v4/accounts/a9fc6b705a3b059d93f090ae8deb4c48/images/v1"
AUTH_TOKEN = "1713q2ORBgfz_J5NKlxff4EMhO_ewAKG-l4olGPA"

os.makedirs(OUTPUT_DIR, exist_ok=True)

if not os.path.exists(INPUT_FILE):
    raise FileNotFoundError(f"Input file {INPUT_FILE} does not exist.")

df = pd.read_csv(INPUT_FILE)
if os.path.exists(OUTPUT_FILE):
    output_df = pd.read_csv(OUTPUT_FILE)
else:
    output_df = pd.DataFrame(columns=df.columns)

def upload_to_cloudflare(file_path):
    with open(file_path, 'rb') as f:
        response = requests.post(
            CLOUDFLARE_UPLOAD_URL,
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
            files={"file": f}
        )
    if response.status_code == 200 and response.json().get("success"):
        return response.json()['result']['variants'][0]
    else:
        print(f"Upload failed for {file_path}: {response.status_code} - {response.text}")
        return None

def download_image(url):
    file_name = url.split("/")[-1]
    file_path = os.path.join(OUTPUT_DIR, file_name)

    if os.path.exists(file_path):
        print(f"Image already exists: {file_name}")
        return file_path

    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            print(f"Downloaded: {file_name}")
            return file_path
        else:
            print(f"Failed to download {url}: {response.status_code}")
    except Exception as e:
        print(f"Error downloading {url}: {e}")

    return None

def process_place_images(row):
    if row['place_images'] == '' or pd.isna(row['place_images']):
        return None

    if not output_df.empty and row['place_name'] in output_df['place_name'].values:
        print(f"Skipping already processed: {row['place_name']}")
        return None

    image_urls = row['place_images'].split(',')
    selected_urls = sample(image_urls, min(5, len(image_urls)))

    uploaded_urls = []
    for url in selected_urls:
        file_path = download_image(url)
        if file_path:
            uploaded_url = upload_to_cloudflare(file_path)
            if uploaded_url:
                uploaded_urls.append(uploaded_url)

    row['place_images'] = ','.join(uploaded_urls)

    output_row = pd.DataFrame([row])
    output_row.to_csv(OUTPUT_FILE, mode='a', index=False, header=not os.path.exists(OUTPUT_FILE))
    print(f"Updated and saved: {row['place_name']}")


df.apply(process_place_images, axis=1)

print(f"Processing complete. Saved to {OUTPUT_FILE}")
