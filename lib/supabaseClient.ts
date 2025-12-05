import { createBrowserClient } from "@supabase/ssr";

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file."
    );
  }

  return { url: supabaseUrl, key: supabaseAnonKey };
}

export function createSupabaseBrowserClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}

// For backward compatibility, export a singleton instance (lazy initialization)
let _supabaseBrowser: ReturnType<typeof createBrowserClient> | null = null;

export const supabaseBrowser = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    if (!_supabaseBrowser) {
      const { url, key } = getSupabaseConfig();
      _supabaseBrowser = createBrowserClient(url, key);
    }
    return (_supabaseBrowser as any)[prop];
  },
});

