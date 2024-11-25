import pandas as pd

file_path = "data/extracted_gems.csv"

try:
    df = pd.read_csv(file_path)

    if 'status' not in df.columns:
        df['status'] = 'not_extracted'
        df.to_csv(file_path, index=False)
        print(f"Column 'status' added with default value 'not_extracted' to {file_path}.")
    else:
        print(f"The 'status' column already exists in {file_path}. No changes made.")

except FileNotFoundError:
    print(f"File not found: {file_path}. Please ensure the file exists.")
except Exception as e:
    print(f"An error occurred: {e}")
