#!/usr/bin/env python3
"""
Filter CSV to only include completed orders (rows with CarrierCompanyName).
"""
import csv

# Read the CSV file
print("Reading OrderRawData.csv...")

with open('OrderRawData.csv', 'r', encoding='utf-8') as infile:
    reader = csv.DictReader(infile)
    fieldnames = reader.fieldnames
    
    # Filter rows where CarrierCompanyName has a value
    completed_rows = []
    total_rows = 0
    
    for row in reader:
        total_rows += 1
        carrier_name = row.get('CarrierCompanyName', '').strip()
        if carrier_name:  # If not empty
            completed_rows.append(row)

print(f"Total rows in original file: {total_rows:,}")
print(f"Completed orders (with carrier): {len(completed_rows):,}")
print(f"Filtered out (no carrier): {total_rows - len(completed_rows):,}")

# Write to new CSV file
output_file = 'OrderRawData_CompletedOnly.csv'
with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(completed_rows)

print(f"\n✅ Created: {output_file}")
print(f"   Contains {len(completed_rows):,} completed orders")
