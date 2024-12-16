import pandas as pd
import re
import csv

# Define the input file
INPUT_FILE = "data/places_detailed_cloudflare.csv"
OUTPUT_FILE = "data/places_detailed_cloudflare.csv"

df = pd.read_csv(INPUT_FILE)

# Function to clean the address and extract the ZIP code
def process_address(row):
    address = row['place_address']
    if not isinstance(address, str):
        return row

    # Remove the first character if it's not alphanumeric
    if not address[0].isalnum():
        address = address[1:]

    # Extract the ZIP code using regex
    zip_code_match = re.search(r'\b\d{5}\b', address)
    if zip_code_match:
        zip_code = zip_code_match.group()
        row['place_zipcode'] = zip_code

    # Update the address without the ZIP code
    # address = re.sub(r',? \b\d{5}\b', '', address)
    row['place_address'] = address.strip()

    return row

# Apply the function to each row in the DataFrame
df = df.apply(process_address, axis=1)

# Save the updated DataFrame to a new CSV file
df.to_csv(OUTPUT_FILE, index=False)

print(f"Data has been processed and saved to {OUTPUT_FILE}")
