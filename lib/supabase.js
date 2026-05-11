require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    "[supabase] 未配置 SUPABASE_URL 或 SUPABASE_ANON_KEY，任务/得分相关接口将不可用"
  );
}

function getSupabase() {
  if (!supabase) {
    const err = new Error("Supabase 未配置：请在 .env 中填写 SUPABASE_URL 与 SUPABASE_ANON_KEY");
    err.code = "SUPABASE_NOT_CONFIGURED";
    throw err;
  }
  return supabase;
}

module.exports = { supabase, getSupabase };
