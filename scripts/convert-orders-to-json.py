#!/usr/bin/env python3
"""
Convert completed orders CSV to JSON for carrier matching ML/AI.
Processes multiple CSV files and combines them into one dataset.
"""
import csv
import json
import os

# List of CSV files to process
csv_files = [
    'OrderRawData_CompletedOnly.csv',
    'OrderRawData-v2.csv',
    'OrderRawData-v3.csv'
]

all_orders = []
order_ids_seen = set()  # Track duplicate order IDs

for csv_file in csv_files:
    if not os.path.exists(csv_file):
        print(f"⚠️  Skipping {csv_file} (not found)")
        continue
    
    print(f"📂 Processing {csv_file}...")
    
    with open(csv_file, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        file_orders = 0
        skipped = 0
        
        for row in reader:
            # Only include orders with a carrier (completed orders)
            carrier_name = row.get('CarrierCompanyName', '').strip()
            order_id = row.get('Order ID', '').strip()
            
            if not carrier_name:
                skipped += 1
                continue
            
            # Skip duplicate order IDs
            if order_id in order_ids_seen:
                skipped += 1
                continue
            
            order_ids_seen.add(order_id)
            
            # Handle CarrierPay - might be missing in some CSVs
            # Fallback to CODToCarrier or empty string
            carrier_pay = row.get('CarrierPay', '') or row.get('CODToCarrier', '')
            
            # Extract key fields for carrier matching
            order = {
                'orderId': order_id,
                'orderCreated': row.get('OrderCreated', ''),
                'carrierCompanyName': carrier_name,
                'carrierPay': carrier_pay,
                'originCity': row.get('OriginCity', ''),
                'originState': row.get('OriginState', ''),
                'originZip': row.get('OriginZip', ''),
                'destinationCity': row.get('DestinationCity', ''),
                'destinationState': row.get('DestState', ''),
                'destinationZip': row.get('DestinationZip', ''),
                'cargo': row.get('Cargo', ''),
                'shipVia': row.get('ShipVia', ''),  # Trailer type
                'estShipDate': row.get('EstShipDate', ''),
                'deliveredDate': row.get('DeliveredDate', ''),
                'orderStatus': row.get('OrderStatus', ''),
                'assignedTo': row.get('AssignedTo', ''),
            }
            
            all_orders.append(order)
            file_orders += 1
        
        print(f"   ✅ Added {file_orders:,} orders ({skipped:,} skipped)")

# Write to JSON file
output_file = 'public/data/completed-orders.json'
os.makedirs('public/data', exist_ok=True)

with open(output_file, 'w', encoding='utf-8') as jsonfile:
    json.dump(all_orders, jsonfile, indent=2)

print(f"\n🎉 Combined {len(all_orders):,} total orders → {output_file}")
print(f"   File size: {len(json.dumps(all_orders)) / 1024 / 1024:.2f} MB")
