import './styles/main.css';
import { getSupabaseConfigStatus } from './core/config.js';

const statusElement = document.querySelector('#app-status');
const configStatus = getSupabaseConfigStatus();

if (statusElement) {
  statusElement.textContent = configStatus.ready
    ? 'Konfigurasi Supabase tersedia. Fondasi siap untuk tahap integrasi.'
    : 'Kerangka aktif. Supabase belum dikonfigurasi; belum ada koneksi ke database.';
}
