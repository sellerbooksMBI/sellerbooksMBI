export function getSupabaseConfigStatus() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

  return {
    ready: Boolean(url && key && !url.includes('YOUR_NEW_PROJECT_ID') && !key.includes('YOUR_NEW_')),
    urlConfigured: Boolean(url),
    keyConfigured: Boolean(key),
  };
}
