(function () {
  const DISPLAY_HOST = window.VendlyStores?.APP_DISPLAY_HOST || 'vendly-snowy.vercel.app';
  const APP_BASE_URL = window.VendlyStores?.APP_BASE_URL || `https://${DISPLAY_HOST}`;

  const state = {
    user: null,
    ambassadorStatus: 'none',
    earnings: [],
    withdrawals: [],
    availableBalance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    referralCode: ''
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    return `NGN ${Number(value || 0).toLocaleString('en-NG')}`;
  }

  function formatDate(value) {
    if (!value) return 'No date yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'No date yet';
    return parsed.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function showToast(message, type = 'success') {
    const toast = byId('toast');
    const icon = byId('toastIcon');
    byId('toastMsg').textContent = message;
    toast.className = `toast ${type}`;
    icon.innerHTML = type === 'error'
      ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
      : '<polyline points="20 6 9 17 4 12"></polyline>';
    window.clearTimeout(showToast.timer);
    window.requestAnimationFrame(() => toast.classList.add('show'));
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function renderNoneState() {
    const root = byId('referralAppRoot');
    if (!root) return;
    root.innerHTML = `
      <div style="text-align:center;padding:60px 24px">
        <h2 style="font-family:var(--font-display);font-size:1.8rem;color:var(--black);margin-bottom:12px">Become an Ambassador</h2>
        <p style="color:var(--grey-mid);margin-bottom:24px">Earn NGN 1,000 for every vendor you refer who activates their store.</p>
        <button class="btn btn-primary" onclick="applyForAmbassador()" style="padding:14px 32px;font-size:1rem;border-radius:12px">Apply now</button>
      </div>
    `;
  }

  function renderPendingState() {
    const root = byId('referralAppRoot');
    if (!root) return;
    root.innerHTML = `
      <div style="text-align:center;padding:60px 24px">
        <h2 style="font-family:var(--font-display);font-size:1.8rem;color:var(--black);margin-bottom:12px">Application under review</h2>
        <p style="color:var(--grey-mid);margin-bottom:24px">Your ambassador application is being reviewed. You'll hear from us within 24 hours.</p>
        <div style="display:inline-block;background:var(--green-pale);border:1px solid var(--green-light);border-radius:12px;padding:16px 28px">
          <div style="font-size:0.875rem;color:var(--grey-mid);margin-bottom:4px">Available balance</div>
          <div style="font-family:var(--font-display);font-size:2rem;color:var(--black)">NGN 0</div>
        </div>
      </div>
    `;
    byId('balanceDisplay').textContent = '0';
    byId('statReferrals').textContent = '0';
    byId('statTotalEarned').textContent = formatMoney(0);
    byId('statWithdrawn').textContent = formatMoney(0);
    byId('totalReferrals').textContent = '0';
    byId('totalEarned').textContent = formatMoney(0);
    const withdrawBtn = byId('withdrawBtn');
    if (withdrawBtn) withdrawBtn.disabled = true;
  }

  function renderDeclinedState() {
    const root = byId('referralAppRoot');
    if (!root) return;
    root.innerHTML = `
      <div style="text-align:center;padding:60px 24px">
        <h2 style="font-family:var(--font-display);font-size:1.8rem;color:var(--black);margin-bottom:12px">Not approved</h2>
        <p style="color:var(--grey-mid);margin-bottom:24px">Your ambassador application was not approved. You can reapply if you believe this was a mistake.</p>
        <button class="btn btn-outline" onclick="applyForAmbassador()" style="padding:14px 32px;font-size:1rem;border-radius:12px">Reapply</button>
      </div>
    `;
    byId('balanceDisplay').textContent = '0';
    byId('statReferrals').textContent = '0';
    byId('statTotalEarned').textContent = formatMoney(0);
    byId('statWithdrawn').textContent = formatMoney(0);
    byId('totalReferrals').textContent = '0';
    byId('totalEarned').textContent = formatMoney(0);
    const withdrawBtn = byId('withdrawBtn');
    if (withdrawBtn) withdrawBtn.disabled = true;
  }

  function getWithdrawalBadge(status) {
    if (status === 'paid') return 'badge-green';
    if (status === 'rejected') return 'badge-grey';
    return 'badge-amber';
  }

  function updateSidebarUser() {
    const userName = state.user?.displayName || state.user?.email || 'Vendor account';
    const storeLink = state.user?.slug
      ? `${DISPLAY_HOST}/${state.user.slug}`
      : `${DISPLAY_HOST}/store-link`;

    byId('refUserAvatar').textContent = state.user?.initials || 'VD';
    byId('refUserName').textContent = userName;
    byId('refUserStoreLink').textContent = storeLink;
  }

  async function loadAmbassadorEarnings(client) {
    const { data, error } = await client
      .from('ambassador_earnings')
      .select('amount, status, created_at')
      .eq('ambassador_id', state.user.id);

    if (error) throw error;
    state.earnings = data || [];
  }

  async function loadWithdrawals(client) {
    const { data, error } = await client
      .from('withdrawal_requests')
      .select('id, amount, bank_name, account_number, account_name, status, requested_at, reviewed_at, admin_note, source')
      .eq('owner_id', state.user.id)
      .eq('source', 'ambassador')
      .order('requested_at', { ascending: false });

    if (error) throw error;
    state.withdrawals = data || [];
  }

  async function loadReferralCode(client) {
    const { data } = await client
      .from('referral_codes')
      .select('code')
      .eq('owner_id', state.user.id)
      .maybeSingle();

    state.referralCode = data?.code || '';
  }

  function computeWallet() {
    state.availableBalance = state.earnings
      .filter(row => row.status === 'available')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    state.totalEarned = state.earnings
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    state.totalWithdrawn = state.withdrawals
      .filter(row => row.status === 'paid')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  function renderDashboard() {
    const root = byId('referralAppRoot');
    if (!root) return;

    byId('balanceDisplay').textContent = Number(state.availableBalance || 0).toLocaleString('en-NG');
    byId('totalReferrals').textContent = String(state.earnings.length);
    byId('totalEarned').textContent = formatMoney(state.totalEarned);
    byId('statReferrals').textContent = String(state.earnings.length);
    byId('statTotalEarned').textContent = formatMoney(state.totalEarned);
    byId('statWithdrawn').textContent = formatMoney(state.totalWithdrawn);

    const withdrawBtn = byId('withdrawBtn');
    if (withdrawBtn) withdrawBtn.disabled = state.availableBalance < 1000;
  }

  async function renderReferralsTable() {
    const wrap = byId('refRows');
    byId('refTableCount').textContent = `${state.earnings.length} earning${state.earnings.length === 1 ? '' : 's'}`;

    if (!state.earnings.length) {
      wrap.innerHTML = '<tr><td colspan="5" class="table-empty" style="padding:48px 24px">No earnings yet. Share your referral link to start earning.</td></tr>';
      return;
    }

    wrap.innerHTML = state.earnings.map(row => `
      <tr>
        <td><strong style="color:var(--black)">New vendor</strong></td>
        <td style="color:var(--grey-mid)">Store via code ${escapeHtml(state.referralCode || '')}</td>
        <td style="color:var(--grey-mid)">${escapeHtml(formatDate(row.created_at))}</td>
        <td><span class="badge ${row.status === 'available' ? 'badge-green' : 'badge-amber'}">${escapeHtml(row.status)}</span></td>
        <td><strong style="color:var(--green)">${escapeHtml(formatMoney(row.amount))}</strong></td>
      </tr>
    `).join('');
  }

  async function renderWithdrawalHistory() {
    const wrap = byId('withdrawalHistoryBody');
    byId('withdrawalHistoryCount').textContent = state.withdrawals.length
      ? `${state.withdrawals.length} request${state.withdrawals.length === 1 ? '' : 's'}`
      : 'No withdrawals yet';

    if (!state.withdrawals.length) {
      wrap.className = 'table-empty';
      wrap.innerHTML = `
        <div class="table-icon" style="width:48px;height:48px;border-radius:14px;background:var(--green-pale);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:var(--green);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
        No withdrawals requested yet. Once you have a balance, tap Withdraw above.`;
      return;
    }

    wrap.className = '';
    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Requested</th>
            <th>Amount</th>
            <th>Bank</th>
            <th>Account</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${state.withdrawals.map(row => `
            <tr>
              <td style="color:var(--grey-mid)">${escapeHtml(formatDate(row.requested_at))}</td>
              <td><strong style="color:var(--black)">${escapeHtml(formatMoney(row.amount))}</strong></td>
              <td style="color:var(--grey-mid)">${escapeHtml(row.bank_name)}</td>
              <td style="color:var(--grey-mid)">${escapeHtml(`${row.account_number} | ${row.account_name}`)}</td>
              <td><span class="badge ${escapeHtml(getWithdrawalBadge(row.status))}">${escapeHtml(row.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  async function reloadData() {
    const client = await window.waitForSupabaseClient();
    await Promise.all([
      loadReferralCode(client),
      loadAmbassadorEarnings(client),
      loadWithdrawals(client)
    ]);
    computeWallet();
    renderDashboard();
    await renderReferralsTable();
    await renderWithdrawalHistory();
  }

  async function applyForAmbassador() {
    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('apply_for_ambassador');
      if (error) throw error;
      state.ambassadorStatus = 'pending';
      const user = window.VendlyAuth.getUser();
      if (user) {
        user.ambassador_status = 'pending';
        localStorage.setItem('vendly_user', JSON.stringify(user));
      }
      await initAmbassador();
      showToast('Application submitted. You\'ll hear from us within 24 hours.');
    } catch (err) {
      showToast(err.message || 'Could not submit application.', 'error');
    }
  }

  async function submitWithdrawal() {
    const bankName = byId('bankName').value.trim();
    const accountNumber = byId('accountNumber').value.trim();
    const accountName = byId('accountName').value.trim();

    if (!bankName || !accountNumber || !accountName) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      showToast('Account number must be 10 digits.', 'error');
      return;
    }

    if (state.availableBalance < 1000) {
      showToast('Minimum withdrawal is NGN 1,000.', 'error');
      return;
    }

    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('create_withdrawal_request', {
        p_amount: state.availableBalance,
        p_bank_name: bankName,
        p_account_number: accountNumber,
        p_account_name: accountName,
        p_source: 'ambassador'
      });
      if (error) throw error;
      byId('bankName').value = '';
      byId('accountNumber').value = '';
      byId('accountName').value = '';
      closeWithdraw();
      await reloadData();
      showToast('Withdrawal request submitted.');
    } catch (err) {
      showToast(err.message || 'Could not send withdrawal request.', 'error');
    }
  }

  function openWithdraw() {
    if (state.availableBalance < 1000) {
      showToast('Minimum withdrawal is NGN 1,000.', 'error');
      return;
    }
    byId('modalBalance').textContent = formatMoney(state.availableBalance);
    byId('withdrawModal').classList.add('open');
  }

  function closeWithdraw() {
    byId('withdrawModal').classList.remove('open');
  }

  async function initAmbassador() {
    try {
      await window.VendlyAuth.restoreSession().catch(() => false);
      state.user = await window.VendlyAuth.refreshUser().catch(() => null) || window.VendlyAuth.getUser();
      if (!state.user?.id) return;

      updateSidebarUser();

      const client = await window.waitForSupabaseClient();
      const { data, error } = await client.rpc('get_my_ambassador_status');
      if (error) throw error;
      state.ambassadorStatus = String(data || 'none').toLowerCase();

      if (state.ambassadorStatus === 'none') {
        renderNoneState();
        return;
      }

      if (state.ambassadorStatus === 'pending') {
        renderPendingState();
        return;
      }

      if (state.ambassadorStatus === 'declined') {
        renderDeclinedState();
        return;
      }

      if (state.ambassadorStatus === 'accepted') {
        await reloadData();
        const refLinkText = byId('refLinkText');
        if (refLinkText) {
          refLinkText.innerHTML = `${escapeHtml(DISPLAY_HOST)}/signup.html?ref=<span id="refCode">${escapeHtml(state.referralCode || '')}</span>`;
        }
        return;
      }
    } catch (err) {
      console.warn('Ambassador portal failed to load', err.message || err);
      showToast('Could not load ambassador data.', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireNavAttributes();
    wireLogout();
    initAmbassador();
  });

  function wireNavAttributes() {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        window.Nav.go(el.dataset.nav);
      });
    });
  }

  function wireLogout() {
    document.querySelectorAll('[data-logout]').forEach(el => {
      el.addEventListener('click', async () => {
        await window.VendlyAuth.signOut();
        window.location.href = 'login.html';
      });
    });
  }

  async function copyRefLink() {
    if (!state.referralCode) {
      showToast('Your referral link is not ready yet.', 'error');
      return;
    }
    const link = `${APP_BASE_URL}/signup.html?ref=${encodeURIComponent(state.referralCode)}`;
    await navigator.clipboard.writeText(link);
    showToast('Referral link copied.');
  }

  async function copyRefCode() {
    if (!state.referralCode) {
      showToast('Your referral code is not ready yet.', 'error');
      return;
    }
    await navigator.clipboard.writeText(state.referralCode);
    showToast(`Code "${state.referralCode}" copied.`);
  }

  function shareWhatsApp() {
    if (!state.referralCode) {
      showToast('Your referral link is not ready yet.', 'error');
      return;
    }
    const link = `${APP_BASE_URL}/signup.html?ref=${encodeURIComponent(state.referralCode)}`;
    const message = `Hey! I use Vendly to run my online store and receive orders on WhatsApp. Sign up with my link and we both earn:\n\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  }

  window.applyForAmbassador = applyForAmbassador;
  window.submitWithdrawal = submitWithdrawal;
  window.openWithdraw = openWithdraw;
  window.closeWithdraw = closeWithdraw;
})();