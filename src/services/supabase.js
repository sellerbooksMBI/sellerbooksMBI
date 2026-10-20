import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfigStatus } from '../core/config.js';

let client;

export function getSupabaseClient() {
  const status = getSupabaseConfigStatus();

  if (!status.ready) {
    throw new Error('Konfigurasi Supabase belum lengkap. Periksa environment variable VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
  }

  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL.trim(),
      import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
    );
  }

  return client;
}
