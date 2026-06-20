#!/usr/bin/env tsx
/**
 * Load completed orders from JSON into Supabase
 * 
 * Run once to migrate from public/data/completed-orders.json → Supabase table
 * 
 * Usage:
 *   npm install -g tsx
 *   tsx scripts/load-orders-to-supabase.ts
 * 
 * OR:
 *   npx tsx scripts/load-orders-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load from JSON file
const jsonPath = path.join(process.cwd(), 'public', 'data', 'completed-orders.json');
console.log(`📂 Loading orders from: ${jsonPath}`);

interface Order {
    orderId: string;
    orderCreated: string;
    carrierCompanyName: string;
    carrierPay: string;
    quotePrice?: string;
    originCity: string;
    originState: string;
    originZip: string;
    destinationCity: string;
    destinationState: string;
    destinationZip: string;
    cargo: string;
    shipVia: string;
    estShipDate: string;
    deliveredDate: string;
    orderStatus: string;
    assignedTo: string;
}

const orders: Order[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
console.log(`✅ Loaded ${orders.length.toLocaleString()} orders from JSON`);

// Initialize Supabase client (using service role key for admin operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Transform JSON format → Supabase column names
function transformOrder(order: Order) {
    // Helper: Convert empty/invalid dates to null
    const parseDate = (dateStr: string | undefined): string | null => {
        if (!dateStr || dateStr.trim() === '' || dateStr.trim() === ' ') {
            return null;
        }
        // Validate it's a real date
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
            return null;
        }
        return dateStr;
    };

    return {
        order_id: order.orderId,
        order_created: parseDate(order.orderCreated),
        carrier_company_name: order.carrierCompanyName,
        carrier_pay: order.carrierPay || null,
        quote_price: order.quotePrice || null,
        origin_city: order.originCity || null,
        origin_state: order.originState || null,
        origin_zip: order.originZip || null,
        destination_city: order.destinationCity || null,
        destination_state: order.destinationState || null,
        destination_zip: order.destinationZip || null,
        cargo: order.cargo || null,
        ship_via: order.shipVia || null,
        est_ship_date: parseDate(order.estShipDate),
        delivered_date: parseDate(order.deliveredDate),
        order_status: order.orderStatus || null,
        assigned_to: order.assignedTo || null,
    };
}

async function loadOrders() {
    console.log('\n🚀 Starting data load...');

    // Batch insert (1000 at a time to avoid timeout)
    const BATCH_SIZE = 1000;
    let loaded = 0;
    let failed = 0;

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const batch = orders.slice(i, i + BATCH_SIZE);
        const transformed = batch.map(transformOrder);

        const { data, error } = await supabase
            .from('completed_orders')
            .insert(transformed);

        if (error) {
            console.error(`❌ Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
            failed += batch.length;
        } else {
            loaded += batch.length;
            console.log(`✅ Loaded ${loaded.toLocaleString()} / ${orders.length.toLocaleString()} orders...`);
        }
    }

    console.log('\n📊 LOAD COMPLETE:');
    console.log(`   ✅ Successfully loaded: ${loaded.toLocaleString()} orders`);
    if (failed > 0) {
        console.log(`   ❌ Failed: ${failed.toLocaleString()} orders`);
    }

    // Verify count
    const { count } = await supabase
        .from('completed_orders')
        .select('*', { count: 'exact', head: true });

    console.log(`   📦 Total in database: ${count?.toLocaleString()} orders`);

    // Show sample stats
    console.log('\n📈 Sample Statistics:');

    const { data: topCarriers } = await supabase
        .from('completed_orders')
        .select('carrier_company_name')
        .order('carrier_company_name')
        .limit(10);

    console.log('   Top carriers:', topCarriers?.slice(0, 5).map(c => c.carrier_company_name).join(', '));

    const { data: topRoutes } = await supabase.rpc('get_top_routes' as any);
    // Note: This RPC would need to be created separately for route stats
}

// Run the loader
loadOrders()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
