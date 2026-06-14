export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600');
  res.setHeader('Content-Type', 'application/json');
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}