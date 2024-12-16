import pandas as pd

# File paths from the uploaded files
INPUT_FILE = "data/places_selected.csv"
DATA_FILE = "data/places_detailed.csv"
OUTPUT_FILE = "data/places_selected_final.csv"

# Read the input CSV files
try:
    selected_df = pd.read_csv(INPUT_FILE)
    detailed_df = pd.read_csv(DATA_FILE)
except FileNotFoundError as e:
    print(f"Error: {e}")
    exit()

# Ensure the necessary columns exist
if "place_name" not in selected_df.columns:
    print("Error: 'place_name' column is not present in the selected data file.")
    exit()

if "place_name" not in detailed_df.columns:
    print("Error: 'place_name' column is not present in the detailed data file.")
    exit()

# Extract the rows from detailed_df that match the place_name in selected_df
matching_places = detailed_df[detailed_df["place_name"].isin(selected_df["place_name"])]

# Save the resulting DataFrame to the output file
matching_places.to_csv(OUTPUT_FILE, index=False)
print(f"Matching rows have been saved to {OUTPUT_FILE}.")
