import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const SUPABASE_URL = 'https://vrgiwzxwnfjhpmxcahwo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8Q1xJ_6ji1DqPvbS1GrP-Q_gV9_n3FB';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const root = document.querySelector('#app');
let language = localStorage.getItem('sellerbooks_language') === 'en' ? 'en' : 'id';
let busy = false;

const words = {
  id: {
    subtitle: 'Sistem manajemen penjualan marketplace', eyebrow: 'MARKETPLACE BUSINESS INTELLIGENCE',
    headline: 'Kelola penjualan dengan lebih terukur.', intro: 'Pusat akses SellerBooks untuk mengelola akun dan data bisnis Anda.',
    bullet1: 'Akun dan data setiap client terpisah', bullet2: 'Persetujuan akses oleh Superadmin', bullet3: 'Siap dikembangkan per modul',
    login: 'Masuk', register: 'Daftar akun', email: 'Alamat email', password: 'Kata sandi',
    loginIntro: 'Masuk untuk melanjutkan ke SellerBooks.', registerIntro: 'Buat akun baru SellerBooks.',
    continueGoogle: 'Lanjutkan dengan Google', or: 'atau', name: 'Nama pemilik / usaha',
    pending: 'Akun Anda menunggu persetujuan Superadmin.', approved: 'Akses Anda sudah disetujui.',
    rejected: 'Permintaan akses ditolak. Hubungi administrator.', suspended: 'Akses akun sedang ditangguhkan.',
    admin: 'Panel Superadmin', requests: 'Permintaan akses client', noRequests: 'Belum ada permintaan akses.',
    approve: 'Setujui', reject: 'Tolak', suspend: 'Tangguhkan', refresh: 'Muat ulang', logout: 'Keluar',
    loading: 'Memuat…', sending: 'Memproses…', signedOut: 'Anda telah keluar.',
    checkEmail: 'Pendaftaran diterima. Periksa email untuk konfirmasi sebelum masuk.',
    signUpSuccess: 'Akun berhasil dibuat. Status akses akan menunggu persetujuan Superadmin.',
    loginFailed: 'Login gagal. Periksa email dan kata sandi.', genericError: 'Terjadi kesalahan. Coba lagi.',
    language: 'Bahasa', accessStatus: 'Status akses', emailConfirmed: 'Email sudah terkonfirmasi',
    status: 'Status', requested: 'Diajukan', note: 'Catatan (opsional)', user: 'Client',
    accountReady: 'Koneksi ke Supabase aktif.', notAllowed: 'Akun ini belum memiliki izin administrator.',
    dataUnavailable: 'Tidak dapat memuat data akses. Periksa koneksi atau izin database.'
  },
  en: {
    subtitle: 'Marketplace sales management system', eyebrow: 'MARKETPLACE BUSINESS INTELLIGENCE',
    headline: 'Manage sales with clarity.', intro: 'SellerBooks access center to manage your account and business data.',
    bullet1: 'Separate accounts and client data', bullet2: 'Access approval by Superadmin', bullet3: 'Ready for modular expansion',
    login: 'Sign in', register: 'Create account', email: 'Email address', password: 'Password',
    loginIntro: 'Sign in to continue to SellerBooks.', registerIntro: 'Create a new SellerBooks account.',
    continueGoogle: 'Continue with Google', or: 'or', name: 'Owner / business name',
    pending: 'Your account is waiting for Superadmin approval.', approved: 'Your access has been approved.',
    rejected: 'Access request rejected. Contact the administrator.', suspended: 'Account access is suspended.',
    admin: 'Superadmin panel', requests: 'Client access requests', noRequests: 'No access requests yet.',
    approve: 'Approve', reject: 'Reject', suspend: 'Suspend', refresh: 'Refresh', logout: 'Sign out',
    loading: 'Loading…', sending: 'Working…', signedOut: 'You have signed out.',
    checkEmail: 'Registration received. Check your email to confirm before signing in.',
    signUpSuccess: 'Account created. Access will wait for Superadmin approval.',
    loginFailed: 'Sign-in failed. Check your email and password.', genericError: 'Something went wrong. Please try again.',
    language: 'Language', accessStatus: 'Access status', emailConfirmed: 'Email confirmed',
    status: 'Status', requested: 'Requested', note: 'Note (optional)', user: 'Client',
    accountReady: 'Supabase connection is active.', notAllowed: 'This account does not have administrator permission.',
    dataUnavailable: 'Unable to load access data. Check connection or database permissions.'
  }
};
const t = (key) => words[language][key] || key;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text, type = 'info') {
  const el = document.querySelector('#notice');
  if (el) { el.textContent = text; el.className = 'notice ' + type; el.hidden = !text; }
}
function shell(content, user = null) {
  root.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <img class="brand-mark" src="/sellerbooks-logo.svg" alt="SellerBooks" />
        <div class="brand-copy"><strong>SellerBooks</strong><p>${t('subtitle')}</p></div>
        <div class="header-actions">
          <label for="language-select">${t('language')}</label>
          <select id="language-select" aria-label="${t('language')}">
            <option value="id" ${language === 'id' ? 'selected' : ''}>Indonesia</option>
            <option value="en" ${language === 'en' ? 'selected' : ''}>English</option>
          </select>
          ${user ? `<button id="logout-button" class="button button-quiet">${t('logout')}</button>` : ''}
        </div>
      </header>
      ${content}
      <footer class="app-footer">SellerBooks · Marketplace Business Intelligence</footer>
    </main>`;
  document.querySelector('#language-select')?.addEventListener('change', async (event) => {
    language = event.target.value === 'en' ? 'en' : 'id';
    localStorage.setItem('sellerbooks_language', language);
    if (user) {
      const { error } = await supabase.from('sellerbooks_user_language').upsert({ user_id: user.id, language, updated_at: new Date().toISOString() });
      if (error) console.warn('Could not save language preference:', error.message);
    }
    await render();
  });
  document.querySelector('#logout-button')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    renderAuth(t('signedOut'));
  });
}
function renderAuth(initialNotice = '') {
  shell(`
    <section class="auth-layout">
      <div class="hero-copy">
        <span class="eyebrow">${t('eyebrow')}</span>
        <h1>SellerBooks <span>Core.</span></h1>
        <p class="hero-intro">${t('intro')}</p>
        <ul class="benefits"><li>${t('bullet1')}</li><li>${t('bullet2')}</li><li>${t('bullet3')}</li></ul>
      </div>
      <section class="auth-card">
        <div class="auth-tabs">
          <button type="button" class="auth-tab active" data-mode="login">${t('login')}</button>
          <button type="button" class="auth-tab" data-mode="register">${t('register')}</button>
        </div>
        <h2 id="form-heading">${t('login')}</h2>
        <p id="form-intro" class="form-intro">${t('loginIntro')}</p>
        <div id="notice" class="notice" role="status" hidden></div>
        <form id="auth-form">
          <label id="name-label" for="owner-name" hidden>${t('name')}</label>
          <input id="owner-name" name="ownerName" autocomplete="organization" placeholder="${t('name')}" hidden />
          <label for="email">${t('email')}</label>
          <input id="email" name="email" type="email" autocomplete="email" placeholder="nama@email.com" required />
          <label for="password">${t('password')}</label>
          <input id="password" name="password" type="password" autocomplete="current-password" minlength="8" required />
          <button id="submit-button" class="button button-primary" type="submit">${t('login')}</button>
        </form>
        <div class="divider-label"><span>${t('or')}</span></div>
        <button id="google-button" class="button button-outline" type="button"><span class="google-g">G</span>${t('continueGoogle')}</button>
        <p class="auth-footnote">${language === 'id' ? 'Akun baru akan berstatus PENDING sampai disetujui administrator.' : 'New accounts remain PENDING until approved by an administrator.'}</p>
      </section>
    </section>`);
  if (initialNotice) message(initialNotice);
  let mode = 'login';
  const form = document.querySelector('#auth-form');
  const tabs = [...document.querySelectorAll('.auth-tab')];
  const nameInput = document.querySelector('#owner-name');
  const nameLabel = document.querySelector('#name-label');
  const heading = document.querySelector('#form-heading');
  const intro = document.querySelector('#form-intro');
  const submit = document.querySelector('#submit-button');
  const setMode = (next) => {
    mode = next;
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
    nameInput.hidden = nameLabel.hidden = mode !== 'register';
    nameInput.required = mode === 'register';
    document.querySelector('#password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    heading.textContent = t(mode);
    intro.textContent = t(mode === 'login' ? 'loginIntro' : 'registerIntro');
    submit.textContent = t(mode);
    message('');
  };
  tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true; submit.disabled = true; submit.textContent = t('sending'); message('');
    const email = form.email.value.trim();
    const password = form.password.value;
    let result;
    if (mode === 'register') {
      result = await supabase.auth.signUp({ email, password, options: { data: { owner_name: nameInput.value.trim() } } });
      if (!result.error) {
        const { data: { session } } = result.data;
        if (session) await render();
        else message(t('checkEmail'), 'success');
      }
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error) await render();
    }
    if (result?.error) message(mode === 'login' ? t('loginFailed') + ' (' + result.error.message + ')' : result.error.message, 'error');
    busy = false;
    if (document.querySelector('#submit-button')) {
      submit.disabled = false; submit.textContent = t(mode);
    }
  });
  document.querySelector('#google-button').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
    if (error) message(error.message, 'error');
  });
}
async function renderDashboard(user) {
  const { data: adminRow, error: adminError } = await supabase.from('sellerbooks_core_admins').select('role,is_active').eq('user_id', user.id).maybeSingle();
  const { data: accessRow, error: accessError } = await supabase.from('sellerbooks_client_access').select('status,requested_at,review_note').eq('user_id', user.id).maybeSingle();
  if (adminError || accessError) {
    shell(`<section class="welcome-panel"><h1>${t('dataUnavailable')}</h1><p>${escapeHtml(adminError?.message || accessError?.message || '')}</p></section>`, user);
    return;
  }
  const isAdmin = Boolean(adminRow?.is_active);
  const status = accessRow?.status || 'PENDING';
  const statusKey = status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : status === 'SUSPENDED' || status === 'REVOKED' ? 'suspended' : 'pending';
  if (!accessRow && !isAdmin) {
    const { error } = await supabase.rpc('sellerbooks_request_access');
    if (error) console.warn('Access request could not be created:', error.message);
  }
  let body = `
    <section class="welcome-panel dashboard-panel">
      <span class="eyebrow">${t('accessStatus')}</span>
      <h1>${escapeHtml(user.email || 'SellerBooks')}</h1>
      <p class="status-message status-${status.toLowerCase()}">${t(isAdmin ? 'approved' : statusKey)}</p>
      <p>${t('emailConfirmed')}: <strong>${user.email_confirmed_at ? '✓' : '—'}</strong></p>
      <p class="muted-text">${escapeHtml(accessRow?.review_note || '')}</p>
      ${isAdmin ? '<div id="admin-content"><p class="status-message">' + t('loading') + '</p></div>' : ''}
    </section>`;
  shell(body, user);
  if (isAdmin) await renderAdminRequests();
}
async function renderAdminRequests() {
  const container = document.querySelector('#admin-content');
  if (!container) return;
  container.innerHTML = `<h2>${t('admin')}</h2><h3>${t('requests')}</h3><p class="muted-text">${t('loading')}</p>`;
  const { data, error } = await supabase.rpc('sellerbooks_core_list_access_requests');
  if (error) {
    container.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`;
    return;
  }
  const requests = data || [];
  if (!requests.length) {
    container.innerHTML = `<h2>${t('admin')}</h2><h3>${t('requests')}</h3><p>${t('noRequests')}</p><button class="button button-outline" id="refresh-requests">${t('refresh')}</button>`;
  } else {
    container.innerHTML = `<h2>${t('admin')}</h2><h3>${t('requests')}</h3><div class="request-list">${requests.map(row => `
      <article class="request-row">
        <div class="request-info"><strong>${escapeHtml(row.email || row.user_id)}</strong><span>${t('status')}: ${escapeHtml(row.status)}</span><small>${t('requested')}: ${row.requested_at ? new Date(row.requested_at).toLocaleString(language === 'id' ? 'id-ID' : 'en-US') : '—'}</small></div>
        <div class="request-actions">
          ${row.status !== 'APPROVED' ? `<button class="button button-small button-primary" data-user="${row.user_id}" data-status="APPROVED">${t('approve')}</button>` : ''}
          ${row.status !== 'REJECTED' ? `<button class="button button-small button-outline" data-user="${row.user_id}" data-status="REJECTED">${t('reject')}</button>` : ''}
          ${row.status !== 'SUSPENDED' ? `<button class="button button-small button-quiet" data-user="${row.user_id}" data-status="SUSPENDED">${t('suspend')}</button>` : ''}
        </div>
      </article>`).join('')}</div><button class="button button-outline" id="refresh-requests">${t('refresh')}</button>`;
  }
  container.querySelectorAll('[data-user][data-status]').forEach(button => button.addEventListener('click', async () => {
    if (busy) return;
    busy = true; button.disabled = true;
    const note = window.prompt(t('note') + ':') || null;
    const { error: reviewError } = await supabase.rpc('sellerbooks_review_client_access', { p_user_id: button.dataset.user, p_status: button.dataset.status, p_note: note });
    busy = false;
    if (reviewError) window.alert(reviewError.message);
    await renderAdminRequests();
  }));
  container.querySelector('#refresh-requests')?.addEventListener('click', renderAdminRequests);
}
async function render() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) { renderAuth(error.message); return; }
  if (!session?.user) { renderAuth(); return; }
  const { data: langRow } = await supabase.from('sellerbooks_user_language').select('language').eq('user_id', session.user.id).maybeSingle();
  if (langRow?.language === 'id' || langRow?.language === 'en') {
    language = langRow.language;
    localStorage.setItem('sellerbooks_language', language);
  } else {
    await supabase.from('sellerbooks_user_language').upsert({ user_id: session.user.id, language, updated_at: new Date().toISOString() });
  }
  await renderDashboard(session.user);
}
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') renderAuth();
  else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setTimeout(() => render(), 0);
});
render().catch(error => {
  console.error(error);
  renderAuth(t('genericError') + ' ' + (error?.message || ''));
});
