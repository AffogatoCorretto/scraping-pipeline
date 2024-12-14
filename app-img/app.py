from flask import Flask, render_template, request, jsonify, redirect, url_for
import pandas as pd
import os
import json
import re
import socket

app = Flask(__name__)

def get_ip_address():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
    except Exception:
        ip_address = '127.0.0.1'  
    finally:
        s.close()
    return ip_address

ip_address = get_ip_address()
url = f"http://{ip_address}:5000"

init_filepath = "../data/places_detailed.csv"
output_path = "../data/places_detailed_filtered.csv"

IMAGE_FOLDER = '../data_images'

# Load the CSV file
df = pd.read_csv(init_filepath, sep=',')
print(df.columns)

# Add a new column for 'place_images' if it doesn't exist
if 'place_images' not in df.columns:
    df['place_images'] = ''

def checkexperienceAvailable(df, experiences):
    retrieved_dataframe = []
    c = 0
    zipcode = [experiences[i]["zipcode"] for i in range(len(experiences))]
    no_of_rest = [experiences[i]["no_of_rest"] for i in range(len(experiences))]
    experiences = [experiences[i]["experience"] for i in range(len(experiences))]

    df = df[pd.isna(df['place_images']) | (df['place_images'] == '')]
    
    for i in range(len(experiences)):
        row = df.loc[df["place_name"].str.contains(experiences[i])]
        if len(row) > 1:
            if len(no_of_rest) > i and no_of_rest[i] == "all":
                for z in range(len(row)):
                    retrieved_dataframe.append(row.iloc[z])
                c += 1
            elif len(zipcode) > i:
                r1 = df.loc[(df["place_name"].str.contains(experiences[i])) & (df["place_zipcode"] == zipcode[i])]
                if len(r1) == 1:
                    retrieved_dataframe.append(r1.iloc[0])
                    c += 1
            else:
                print("Found many matches - ", experiences[i], "\npotential list - ", list(row["place_name"]), " Provide a zipcode, \"all\" cmd")
        elif len(row) == 0:
            print("Search string not found - ", experiences[i])
        else:
            retrieved_dataframe.append(row.iloc[0])
            c += 1
            print("Found match - ", row["place_name"].iloc[0])
    
    if c == len(experiences):
        print("All experiences found")
    
    return retrieved_dataframe


def get_images_for_experience(experience):
    place_name = experience["place_name"]
    coords = json.loads(experience["place_coordinates"])
    json_file = os.path.join(IMAGE_FOLDER, f"{place_name}[{coords[0]},{coords[1]}].json")
    
    print(f"{place_name}[{coords[0]},{coords[1]}].json")
    if os.path.exists(json_file):
        with open(json_file, 'r') as f:
            images = json.load(f)
        images = list(set([re.sub(r"=.+$", "", i) for i in images]))
        return images
    return []

def refreshexperienceImageList():
    global experiences, current_index
    current_index = 0
    try:
        with open('experiences_added.json', 'r') as f:
            experiences = json.load(f)
            experiences = checkexperienceAvailable(df, experiences)
        return jsonify({"message": "experiences list refreshed!"})
    except FileNotFoundError:
        return jsonify({"error": "No experiences_added.json file found."}), 404
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Failed to refresh experiences."}), 500
    
def getAddedexperienceList():
    global addedexperiences
    json_file = 'experiences_added.json'
    if os.path.exists(json_file):
        with open(json_file, 'r') as f:
            addedexperiences = json.load(f)
    else:
        addedexperiences = {}
    
@app.route('/select_images')
def select_images():
    global current_index, experiences
    
    if current_index is not None and current_index < len(experiences):
        experience = experiences[current_index]
        images = get_images_for_experience(experience)

        return render_template('select_images.html', experience=experience, images=images, current_index=current_index, total_rest = len(experiences))
    else:
        return "All experiences processed!"

@app.route('/select_image', methods=['POST'])
def select_image():
    global current_index

    data = request.json  # Fetch the data sent as JSON

    selected_images = data.get('selected_images', [])
    place_name = data.get('place_name')
    place_coordinates = data.get('place_coordinates')

    print(f"Selected images: {selected_images}")
    print(f"experience name: {place_name}")
    print(f"experience coordinates: {place_coordinates}")
    
    df.loc[(df['place_name'] == place_name) & (df['place_coordinates'] == place_coordinates), 'place_images'] = json.dumps(selected_images)
    
    df.to_csv(output_path, index=False)
    
    # Step 3: Move to the next experience
    current_index += 1

    return jsonify({"message": "Selection saved!"})

@app.route('/add_experience', methods=['POST'])
def add_experience():
    try:
        data = request.json
        experience_name = data.get('experience_name')
        zipcode = data.get('zipcode', '10001')
        no_of_rest = data.get('no_of_rest', '')

        new_entry = {
            "experience": experience_name,
            "zipcode": int(zipcode),
            "no_of_rest": no_of_rest
        }

        json_file = 'experiences_added.json'

        if os.path.exists(json_file):
            with open(json_file, 'r+') as f:
                existing_data = json.load(f)

                if any(entry['experience'] == experience_name and entry['zipcode'] == zipcode for entry in existing_data):
                    return jsonify({"message": "Experience already exists!"})

                # Append the new entry and save back to the file
                existing_data.append(new_entry)
                f.seek(0)
                json.dump(existing_data, f, indent=4, ensure_ascii=False)
        else:
            # Create a new file with the new entry if it doesn't exist
            with open(json_file, 'w') as f:
                json.dump([new_entry], f, indent=4, ensure_ascii=False)

        return jsonify({"message": "Experience added successfully!"})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Failed to add experience."}), 500


@app.route('/add_experience', methods=['GET'])
def add_experience_page():
    global addedexperiences
    getAddedexperienceList()
    return render_template('add_experience.html', addedexperiences=addedexperiences)



@app.route('/search_experience', methods=['GET'])
def search_experience():
    query = request.args.get('query', '').strip().lower()

    # Filter matching experiences
    matching_experiences = df[df["place_name"].str.lower().str.contains(query, na=False)]

    # Replace NaN values with empty strings to avoid JSON serialization errors
    matching_experiences = matching_experiences.fillna('')

    # Convert to JSON-friendly format
    results = matching_experiences.to_dict(orient='records')
    
    return jsonify(results)

@app.route('/refresh_experiences', methods=['GET'])
def refresh_experiences():
    message = refreshexperienceImageList()
    if(message.status == "200 OK"):
        return redirect(url_for('select_images'))
    return message

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    
    app.run(host=ip_address, port=5000, debug=True)
