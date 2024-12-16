from flask import Flask, render_template, request, jsonify
import pandas as pd
import os
import socket
import random

app = Flask(__name__)

# Configurations
INIT_FILEPATHS = ["../data/places_detailed.csv", "../data/places_detailed_p.csv", "../data/places_detailed_sean1.csv"]
OUTPUT_PATH_SELECTED = "../data/places_selected.csv"
OUTPUT_PATH_CANCELED = "../data/places_canceled.csv"

# Load and combine CSV files
df = pd.concat([pd.read_csv(file, sep=',') for file in INIT_FILEPATHS], ignore_index=True)

# Ensure output files exist
if not os.path.exists(OUTPUT_PATH_SELECTED):
    pd.DataFrame(columns=df.columns).to_csv(OUTPUT_PATH_SELECTED, index=False)
if not os.path.exists(OUTPUT_PATH_CANCELED):
    pd.DataFrame(columns=df.columns).to_csv(OUTPUT_PATH_CANCELED, index=False)

def get_ip_address():
    """Fetch local IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
    except Exception:
        ip_address = '127.0.0.1'
    finally:
        s.close()
    return ip_address

def get_filtered_df():
    """Filter out already processed places dynamically."""
    canceled_df = pd.read_csv(OUTPUT_PATH_CANCELED)
    selected_df = pd.read_csv(OUTPUT_PATH_SELECTED)
    
    # Use a unique identifier (e.g., place_name) for filtering
    canceled_names = set(canceled_df["place_name"]) if "place_name" in canceled_df.columns else set()
    selected_names = set(selected_df["place_name"]) if "place_name" in selected_df.columns else set()
    processed_names = canceled_names.union(selected_names)

    return df[~df["place_name"].isin(processed_names)]  # Exclude processed places by name

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/select_experience')
def select_experience():
    filtered_df = get_filtered_df()
    if filtered_df.empty:
        return "All places have been processed!"
    
    # Select a random place from the filtered list
    random_index = random.choice(filtered_df.index.tolist())
    current_place = filtered_df.loc[random_index]
    
    images = []
    if pd.notna(current_place['place_images']):
        images = current_place['place_images'].split(',')[:10]  # Extract up to 10 image URLs
    
    return render_template(
        'select_experience.html',
        place=current_place,
        images=images,
        place_id=random_index,  # Pass the DataFrame index as place_id
        total_places=len(filtered_df)
    )

@app.route('/process_experience', methods=['POST'])
def process_experience():
    data = request.json
    place_id = int(data.get('place_id'))
    action = data.get('action')  # 'select' or 'cancel'
    
    if action not in ['select', 'cancel']:
        return jsonify({"error": "Invalid action"}), 400

    # Load existing processed data
    canceled_df = pd.read_csv(OUTPUT_PATH_CANCELED)
    selected_df = pd.read_csv(OUTPUT_PATH_SELECTED)

    # Recompute filtered data
    filtered_df = get_filtered_df()

    # Verify the place is still valid for processing
    if place_id not in filtered_df.index:
        return jsonify({"error": "Place not found or already processed"}), 404

    # Append the row to the appropriate CSV file
    output_path = OUTPUT_PATH_SELECTED if action == 'select' else OUTPUT_PATH_CANCELED
    place_row = df.loc[[place_id]]  # Use the original DataFrame to avoid filtering issues
    place_row.to_csv(output_path, mode='a', header=not os.path.exists(output_path), index=False)

    # Recalculate the remaining places dynamically
    total_remaining_places = len(get_filtered_df())

    return jsonify({"message": "Place processed successfully!", "remaining_places": total_remaining_places})

if __name__ == '__main__':
    app.run(host=get_ip_address(), port=5000, debug=True)
