import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Read from package.json or hardcoded config
let configStr = "{}";
try {
  configStr = fs.readFileSync('supabase/config.json', 'utf8');
} catch(e) {}
const config = JSON.parse(configStr);

// let's grab credentials from .env
console.log("Checking Supabase DB directly...");
