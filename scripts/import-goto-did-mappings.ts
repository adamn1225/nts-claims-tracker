/**
 * Import GoTo DID → Agent Name mappings from exported CSV
 * 
 * Usage: 
 *   npx tsx scripts/import-goto-did-mappings.ts path/to/agent-calls.csv
 * 
 * Reads the GoTo queue-caller CSV export and extracts:
 * - Contact Participant Value (phone number/DID)
 * - Agent Name
 * 
 * Stores mappings in performance_overrides table for display name resolution.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CSVMapping {
  did: string;
  agentName: string;
  userKey?: string;
}

async function parseCSV(filePath: string): Promise<CSVMapping[]> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  
  if (lines.length < 2) {
    throw new Error("CSV file is empty or has no data rows");
  }

  const header = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  const participantIndex = header.indexOf("Contact Participant Value");
  const agentNameIndex = header.indexOf("Agent Name");

  if (participantIndex === -1 || agentNameIndex === -1) {
    throw new Error(`Missing required columns. Found: ${header.join(", ")}`);
  }

  const mappings = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parser (handles quoted fields)
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    const phoneNumber = fields[participantIndex]?.replace(/[^0-9]/g, "");
    const agentName = fields[agentNameIndex]?.replace(/"/g, "").trim();

    if (phoneNumber && agentName && phoneNumber.length >= 10) {
      // Extract clean name (remove "(on deviceId)" suffix)
      const cleanName = agentName.replace(/\s*\(on\s+[^)]+\)/, "").trim();
      mappings.set(phoneNumber, cleanName);
    }
  }

  return Array.from(mappings.entries()).map(([did, agentName]) => ({
    did,
    agentName,
  }));
}

async function matchToUsers(mappings: CSVMapping[]): Promise<CSVMapping[]> {
  // Fetch all GoTo users to match names to userKeys
  const { data: users } = await supabase
    .from("goto_connections")
    .select("goto_user_key, goto_user_email")
    .eq("is_admin_token", false);

  // Also fetch from GoTo IAM API if we have admin token
  const { data: adminConn } = await supabase
    .from("goto_connections")
    .select("access_token")
    .eq("is_admin_token", true)
    .single();

  const userKeyMap = new Map<string, string>(); // name → userKey

  if (adminConn?.access_token) {
    try {
      const resp = await fetch(
        "https://iam.servers.getgo.com/ext-admin/rest/accounts/{accountKey}/users"
        // Note: Need to insert actual account key - this is a placeholder
      );
      // Skipping actual fetch for now - would need account key
    } catch (err) {
      console.warn("Could not fetch GoTo users for matching:", err);
    }
  }

  // For now, return mappings without userKeys - manual step needed
  return mappings;
}

async function importMappings(mappings: CSVMapping[]) {
  console.log(`\n📊 Found ${mappings.length} unique DID → Agent Name mappings\n`);

  // Show sample
  console.log("Sample mappings:");
  mappings.slice(0, 10).forEach(m => {
    console.log(`  ${m.did} → ${m.agentName}`);
  });

  console.log(`\n⚠️  Manual Step Required:`);
  console.log(`This data needs to be matched against GoTo user accounts.`);
  console.log(`\nOption 1: Use Admin UI to map DIDs to broker accounts`);
  console.log(`Option 2: Store raw DID → name in performance_overrides\n`);

  // For now, just output the mappings - would need UI to complete import
  const outputPath = path.join(process.cwd(), "goto-did-mappings.json");
  fs.writeFileSync(outputPath, JSON.stringify(mappings, null, 2));
  console.log(`✅ Saved mappings to: ${outputPath}\n`);
}

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import-goto-did-mappings.ts <csv-file>");
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading CSV: ${csvPath}\n`);
  const mappings = await parseCSV(csvPath);
  await importMappings(mappings);
}

main().catch(console.error);
