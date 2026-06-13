(function () {
  const DISPLAY_HOST = window.VendlyStores?.APP_DISPLAY_HOST || 'vendly-snowy.vercel.app';
  const APP_BASE_URL = window.VendlyStores?.APP_BASE_URL || `https://${DISPLAY_HOST}`;
  const REFERRAL_REWARD = 1000;

  const state = {
    user: null,
    referralCode: '',
    referralLink: '',
    referrals: [],
    withdrawals: [],
    referralAvailableBalance: 0,
    ambassadorAvailableBalance: 0,
    selectedWithdrawalSource: 'referral',
    totalEarned: 0,
    totalWithdrawn: 0
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

  function getWithdrawalBadge(status) {
    if (status === 'paid') return 'badge-green';
    if (status === 'rejected') return 'badge-grey';
    return 'badge-amber';
  }

  function getReferralBadge(status) {
    if (status === 'active') return 'badge-green';
    if (status === 'pending') return 'badge-amber';
    return 'badge-grey';
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

  async function loadReferralCode(client) {
    const { data } = await client
      .from('referral_codes')
      .select('code')
      .eq('owner_id', state.user.id)
      .maybeSingle();

    let code = data?.code || '';
    if (!code) {
      const response = await client.rpc('ensure_my_referral_code', {
        p_seed: state.user.slug || state.user.storeName || state.user.displayName || 'vendly'
      });
      if (response.error) throw response.error;
      code = response.data || '';
    }

    state.referralCode = code;
    state.referralLink = `${APP_BASE_URL}/signup.html?ref=${encodeURIComponent(code)}`;
  }

  async function loadReferrals(client) {
    const { data, error } = await client
      .from('referral_signups')
      .select('referred_name, referred_store_name, referred_slug, reward_amount, status, created_at')
      .eq('referrer_id', state.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    state.referrals = data || [];
  }

  async function loadBalances(client) {
    const [refResponse, ambassadorResponse] = await Promise.all([
      client.rpc('referral_available_balance'),
      client.rpc('ambassador_available_balance')
    ]);

    if (refResponse.error) throw refResponse.error;
    if (ambassadorResponse.error) throw ambassadorResponse.error;

    state.referralAvailableBalance = Number(refResponse.data || 0);
    state.ambassadorAvailableBalance = Number(ambassadorResponse.data || 0);
  }

  async function loadWithdrawals(client) {
    const { data, error } = await client
      .from('withdrawal_requests')
      .select('id, amount, bank_name, account_number, account_name, status, requested_at, reviewed_at, admin_note, source')
      .eq('owner_id', state.user.id)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    state.withdrawals = data || [];
  }

  function computeWallet() {
    state.totalEarned = state.referrals
      .filter(row => row.status === 'active')
      .reduce((sum, row) => sum + Number(row.reward_amount || 0), 0);

    state.totalWithdrawn = state.withdrawals
      .filter(row => row.status === 'paid')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  function renderSummary() {
    byId('balanceDisplay').textContent = Number(state.referralAvailableBalance || 0).toLocaleString('en-NG');
    byId('referralBalanceDisplay').textContent = Number(state.referralAvailableBalance || 0).toLocaleString('en-NG');
    byId('ambassadorBalanceDisplay').textContent = Number(state.ambassadorAvailableBalance || 0).toLocaleString('en-NG');
    byId('modalBalance').textContent = formatMoney(state.selectedWithdrawalSource === 'ambassador'
      ? state.ambassadorAvailableBalance
      : state.referralAvailableBalance);
    byId('totalReferrals').textContent = String(state.referrals.length);
    byId('totalEarned').textContent = formatMoney(state.totalEarned);
    byId('statReferrals').textContent = String(state.referrals.length);
    byId('statTotalEarned').textContent = formatMoney(state.totalEarned);
    byId('statWithdrawn').textContent = formatMoney(state.totalWithdrawn);
    byId('withdrawalSub').textContent = state.withdrawals.length
      ? `${state.withdrawals.length} request${state.withdrawals.length === 1 ? '' : 's'} made`
      : 'no withdrawals yet';

    const activeBalance = state.selectedWithdrawalSource === 'ambassador'
      ? state.ambassadorAvailableBalance
      : state.referralAvailableBalance;
    const withdrawBtn = byId('withdrawBtn');
    if (withdrawBtn) withdrawBtn.disabled = activeBalance < 1000;

    byId('refCode').textContent = state.referralCode || 'UNAVAILABLE';
    byId('refLinkText').innerHTML = `${escapeHtml(DISPLAY_HOST)}/signup.html?ref=<span id="refCode">${escapeHtml(state.referralCode || 'UNAVAILABLE')}</span>`;
  }

  function renderReferralsTable() {
    const wrap = byId('refTableBody');
    byId('refTableCount').textContent = `${state.referrals.length} signup${state.referrals.length === 1 ? '' : 's'}`;

    if (!state.referrals.length) {
      wrap.innerHTML = `
        <div class="table-empty">
          <div class="table-icon" style="width:48px;height:48px;border-radius:14px;background:var(--green-pale);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:var(--green);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          No one has used your referral link yet. Start sharing it.
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Store</th>
            <th>Joined</th>
            <th>Status</th>
            <th>Your earning</th>
          </tr>
        </thead>
        <tbody id="refRows">
          ${state.referrals.map(row => `
            <tr>
              <td><strong style="color:var(--black)">${escapeHtml(row.referred_name || 'New vendor')}</strong></td>
              <td style="color:var(--grey-mid)">${escapeHtml(row.referred_slug ? `${DISPLAY_HOST}/${row.referred_slug}` : (row.referred_store_name || 'Store not set'))}</td>
              <td style="color:var(--grey-mid)">${escapeHtml(formatDate(row.created_at))}</td>
              <td><span class="badge ${escapeHtml(getReferralBadge(row.status))}">${escapeHtml(row.status)}</span></td>
              <td><strong style="color:var(--green)">${escapeHtml(formatMoney(row.reward_amount || REFERRAL_REWARD))}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function renderWithdrawalHistory() {
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
            <th>Source</th>
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
              <td style="color:var(--grey-mid)">${escapeHtml(row.source || 'referral')}</td>
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
      loadReferrals(client),
      loadBalances(client),
      loadWithdrawals(client)
    ]);
    computeWallet();
    renderSummary();
    renderReferralsTable();
    renderWithdrawalHistory();
  }

  async function init() {
    try {
      await window.VendlyAuth.restoreSession().catch(() => false);
      state.user = await window.VendlyAuth.refreshUser().catch(() => window.VendlyAuth.getUser()) || window.VendlyAuth.getUser();
      if (!state.user?.id) return;

      // Check if user is admin - hide ambassador UI if so
      try {
        const client = await window.waitForSupabaseClient();
        const { data, error } = await client.rpc('is_admin');
        state.isAdmin = !error && !!data;
      } catch (err) {
        state.isAdmin = false;
      }

      // Re-render ambassador nav after admin status check
      if (window.VendlyNav && typeof window.VendlyNav.renderAmbassadorNav === 'function') {
        window.VendlyNav.renderAmbassadorNav();
      }

      updateSidebarUser();
      await reloadData();
    } catch (err) {
      console.warn('Referral portal failed to load', err.message || err);
      showToast('Could not load your referral data right now.', 'error');
    }
  }

  async function submitWithdrawal() {
    const bank = byId('bankName').value.trim();
    const accountNumber = byId('accountNumber').value.trim();
    const accountName = byId('accountName').value.trim();

    if (!bank || !accountNumber || !accountName) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      showToast('Account number must be 10 digits.', 'error');
      return;
    }

    const source = byId('withdrawSourceAmbassador')?.checked ? 'ambassador' : 'referral';
    const availableBalance = source === 'ambassador'
      ? state.ambassadorAvailableBalance
      : state.referralAvailableBalance;

    if (availableBalance < 1000) {
      showToast('Minimum withdrawal is NGN 1,000 from the selected balance.', 'error');
      return;
    }

    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('create_withdrawal_request', {
        p_amount: availableBalance,
        p_bank_name: bank,
        p_account_number: accountNumber,
        p_account_name: accountName,
        p_source: source
      });
      if (error) throw error;

      byId('bankName').value = '';
      byId('accountNumber').value = '';
      byId('accountName').value = '';
      closeWithdraw();
      await reloadData();
      showToast('Withdrawal request submitted.');
    } catch (err) {
      showToast(err.message || 'Could not send your withdrawal request.', 'error');
    }
  }

  function openWithdraw() {
    const source = byId('withdrawSourceAmbassador')?.checked ? 'ambassador' : 'referral';
    state.selectedWithdrawalSource = source;
    const availableBalance = source === 'ambassador'
      ? state.ambassadorAvailableBalance
      : state.referralAvailableBalance;

    if (availableBalance < 1000) {
      showToast('Minimum withdrawal is NGN 1,000 from the selected balance.', 'error');
      return;
    }

    const referralRadio = byId('withdrawSourceReferral');
    const ambassadorRadio = byId('withdrawSourceAmbassador');
    if (referralRadio) referralRadio.checked = source === 'referral';
    if (ambassadorRadio) ambassadorRadio.checked = source === 'ambassador';
    byId('modalBalance').textContent = formatMoney(availableBalance);
    byId('withdrawModal').classList.add('open');
  }

  function closeWithdraw() {
    byId('withdrawModal').classList.remove('open');
  }

  async function copyRefLink() {
    if (!state.referralLink) {
      showToast('Your referral link is not ready yet.', 'error');
      return;
    }

    await navigator.clipboard.writeText(state.referralLink);
    const btn = byId('copyLinkBtn');
    btn.classList.add('copied');
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
    showToast('Referral link copied.');
    window.setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy link';
    }, 2400);
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
    if (!state.referralLink) {
      showToast('Your referral link is not ready yet.', 'error');
      return;
    }

    const message = `Hey! I use Vendly to run my online store and receive orders on WhatsApp. Sign up with my link and we both earn:\n\n${state.referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  }

  byId('withdrawModal').addEventListener('click', event => {
    if (event.target === byId('withdrawModal')) closeWithdraw();
  });

  window.copyRefLink = copyRefLink;
  window.copyRefCode = copyRefCode;
  window.shareWhatsApp = shareWhatsApp;
  window.openWithdraw = openWithdraw;
  window.closeWithdraw = closeWithdraw;
  window.submitWithdrawal = submitWithdrawal;

  init();
})();
