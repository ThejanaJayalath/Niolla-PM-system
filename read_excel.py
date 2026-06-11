import pandas as pd
import json

file_path = 'd:\\Niolla NEXA\\Niolla-PM-system\\NIOLLA NEXA.xlsx'
xls = pd.ExcelFile(file_path)

data = {}
for sheet_name in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet_name)
    # converting all NaNs to None for json serialization
    df = df.where(pd.notnull(df), None)
    data[sheet_name] = df.to_dict(orient='records')

with open('excel_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4)

print("Sheets:", xls.sheet_names)
