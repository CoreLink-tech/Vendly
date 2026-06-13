(function () {
  const state = {
    user: null,
    isAdmin: false,
    accounts: [],
    withdrawals: [],
    activationCodes: [],
    ambassadorApplications: [],
    ambassadorRequests: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function planLabel(value) {
    return String(value || '').toLowerCase() === 'yearly' ? 'Yearly' : 'Monthly';
  }

  function daysLeft(row) {
    return Math.max(0, Number(row?.days_left || 0));
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
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not set';
    return parsed.toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  function showToast(message, type = 'success') {
    const toast = byId('toast');
    const icon = byId('toastIcon');
    byId('toastMsg').textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    toast.style.background = type === 'error' ? '#7f1d1d' : '#152218';
    icon.innerHTML = type === 'error'
      ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
      : '<polyline points="20 6 9 17 4 12"></polyline>';
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(18px)';
    }, 3200);
  }

  function setUserUi() {
    const displayName = state.user?.displayName || state.user?.email || 'Admin account';
    const avatar = byId('adminUserAvatar');
    const name = byId('adminUserName');
    const email = byId('adminUserEmail');
    if (avatar) avatar.textContent = state.user?.initials || 'AD';
    if (name) name.textContent = displayName;
    if (email) email.textContent = state.user?.email || 'No email';
  }

  function setAdminGate(open) {
    const gate = byId('adminGate');
    const panels = byId('adminPanels');
    const chip = byId('adminStatusChip');
    const meta = byId('adminBannerMeta');
    if (gate) gate.style.display = open ? 'block' : 'none';
    if (panels) panels.style.display = open ? 'none' : 'block';
    if (chip) chip.textContent = open ? 'Locked' : 'Admin ready';
    if (meta) {
      meta.textContent = open
        ? 'This signed-in account is not listed as an admin yet.'
        : 'Project data loaded. You can review vendors, withdrawals, and activation codes below.';
    }
  }

  async function bootstrapAdminAccess() {
    try {
      const btn = byId('bootstrapAdminBtn');
      if (btn) btn.disabled = true;
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('bootstrap_admin_access');
      if (error) throw error;
      showToast('Admin access enabled. Reloading...');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      showToast(err.message || 'Could not enable admin access.', 'error');
    } finally {
      const btn = byId('bootstrapAdminBtn');
      if (btn) btn.disabled = false;
    }
  }

function renderSummary() {
     if (!byId('adminSummary')) return;
     const activeStores = state.accounts.filter(row => row.subscription_status === 'active').length;
     const pendingWithdrawals = state.withdrawals.filter(row => row.status === 'pending').length;
     const unusedCodes = state.activationCodes.filter(row => row.status === 'unused').length;
     const pendingAmbassadorRequests = state.ambassadorRequests.filter(row => row.status === 'pending').length;
     const totalVendors = state.accounts.length;
 
     byId('adminSummary').innerHTML = [
       {
         label: 'Total vendors',
         value: String(totalVendors),
         sub: 'Seller accounts currently in the project',
         icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
       },
       {
         label: 'Active stores',
         value: String(activeStores),
         sub: 'Stores currently live and shareable',
         icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>'
       },
       {
         label: 'Pending withdrawals',
         value: String(pendingWithdrawals),
         sub: 'Referral payout requests awaiting review',
         icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>'
       },
       {
         label: 'Unused codes',
         value: String(unusedCodes),
         sub: 'Activation codes available to send to vendors',
         icon: '<rect x="3" y="7" width="18" height="14" rx="2"></rect><path d="M16 3H8v4h8V3z"></path>'
       },
       {
         label: 'Ambassador requests',
         value: String(pendingAmbassadorRequests),
         sub: 'New ambassador applications waiting review',
         icon: '<path d="M12 5a4 4 0 0 1 0 8 4 4 0 0 1 0-8zm0 10c-4.418 0-8 1.79-8 4v2h16v-2c0-2.21-3.582-4-8-4z"></path>'
       }
     ].map(card => `
       <article class="summary-card">
         <div class="summary-card-header">
           <div class="summary-label">${escapeHtml(card.label)}</div>
           <div class="summary-icon"><svg viewBox="0 0 24 24">${card.icon}</svg></div>
         </div>
         <div class="summary-value">${escapeHtml(card.value)}</div>
         <div class="summary-sub">${escapeHtml(card.sub)}</div>
       </article>
`).join('');
    }

  function renderAmbassadorRequests() {
     const list = byId('ambassadorRequestsList');
     if (!list) return;
 
     if (!state.ambassadorRequests.length) {
       list.innerHTML = '<div class="empty-state"><strong>No ambassador requests pending</strong><div>When vendors submit new ambassador requests, they will appear here.</div></div>';
       return;
     }
 
     list.innerHTML = state.ambassadorRequests.map(row => `
       <article class="admin-card">
         <div class="admin-card-top">
           <div>
             <div class="admin-card-title">${escapeHtml(row.vendor_name || 'Vendor')}</div>
             <div class="admin-card-sub">${escapeHtml(row.store_name || 'Store not set')}</div>
             <div class="admin-card-sub">${escapeHtml(row.email || 'No email on file')}</div>
           </div>
           <span class="status-chip ${row.status === 'approved' ? 'active' : row.status === 'declined' ? 'expired' : 'inactive'}">${escapeHtml(row.status)}</span>
         </div>
         <div class="admin-meta-grid">
           <div class="admin-meta-item">
             <div class="admin-meta-label">Applied</div>
             <div class="admin-meta-value">${escapeHtml(formatDate(row.applied_at))}</div>
           </div>
           <div class="admin-meta-item">
             <div class="admin-meta-label">Reviewed</div>
             <div class="admin-meta-value">${escapeHtml(row.reviewed_at ? formatDate(row.reviewed_at) : 'Pending review')}</div>
           </div>
         </div>
         ${row.status === 'pending' ? `
           <div class="admin-actions">
             <button class="btn btn-primary btn-sm" type="button" data-action="ambassador-request" data-request-id="${escapeHtml(row.request_id)}" data-status="approved">Approve</button>
             <button class="btn btn-light-danger btn-sm" type="button" data-action="ambassador-request" data-request-id="${escapeHtml(row.request_id)}" data-status="declined">Decline</button>
           </div>
         ` : ''}
       </article>
     `).join('');
   }

  function renderWithdrawals() {
    const list = byId('withdrawalsList');
    if (!list) return;
    if (!state.withdrawals.length) {
      list.innerHTML = '<div class="empty-state"><strong>No withdrawal requests yet</strong><div>Vendor referral withdrawals will appear here as soon as they are submitted.</div></div>';
      return;
    }

    list.innerHTML = state.withdrawals.map(row => `
      <article class="admin-card">
        <div class="admin-card-top">
          <div>
            <div class="admin-card-title">${escapeHtml(row.vendor_name || 'Vendor')}</div>
            <div class="admin-card-sub">${escapeHtml(row.store_name || 'Store not set')} | ${escapeHtml(row.store_slug ? `/${row.store_slug}` : 'no slug yet')}</div>
            <div class="admin-card-sub">${escapeHtml(row.vendor_email || 'No email on file')}</div>
          </div>
          <span class="status-chip ${row.status === 'paid' ? 'active' : row.status === 'rejected' ? 'expired' : 'inactive'}">${escapeHtml(row.status)}</span>
        </div>
        <div class="admin-meta-grid">
          <div class="admin-meta-item">
            <div class="admin-meta-label">Amount</div>
            <div class="admin-meta-value">${escapeHtml(formatMoney(row.amount))}</div>
          </div>
          <div class="admin-meta-item">
            <div class="admin-meta-label">Bank</div>
            <div class="admin-meta-value">${escapeHtml(row.bank_name)}</div>
          </div>
          <div class="admin-meta-item">
            <div class="admin-meta-label">Account</div>
            <div class="admin-meta-value">${escapeHtml(`${row.account_number} | ${row.account_name}`)}</div>
          </div>
          <div class="admin-meta-item">
            <div class="admin-meta-label">Requested</div>
            <div class="admin-meta-value">${escapeHtml(formatDate(row.requested_at))}</div>
          </div>
        </div>
        <div class="admin-actions">
          <button class="btn btn-outline btn-sm" type="button" data-action="withdrawal-status" data-request-id="${escapeHtml(row.request_id)}" data-status="approved">Approve</button>
          <button class="btn btn-primary btn-sm" type="button" data-action="withdrawal-status" data-request-id="${escapeHtml(row.request_id)}" data-status="paid">Mark paid</button>
          <button class="btn btn-light-danger btn-sm" type="button" data-action="withdrawal-status" data-request-id="${escapeHtml(row.request_id)}" data-status="rejected">Reject</button>
        </div>
      </article>
    `).join('');
  }

  function renderActivationCodes() {
    const list = byId('activationCodesList');
    if (!list) return;
    if (!state.activationCodes.length) {
      list.innerHTML = '<div class="empty-state"><strong>No activation codes yet</strong><div>Generate your first code to activate a vendor account.</div></div>';
      return;
    }

    list.innerHTML = state.activationCodes.map(row => `
      <article class="admin-card">
        <div class="admin-card-top">
          <div>
            <div class="admin-card-title mono">${escapeHtml(row.code)}</div>
            <div class="admin-card-sub">${escapeHtml(row.note || 'No note added for this code.')}</div>
          </div>
          <span class="status-chip ${row.status === 'redeemed' ? 'active' : row.status === 'void' ? 'expired' : 'inactive'}">${escapeHtml(row.status)}</span>
        </div>
        <div class="admin-meta-grid">
          <div class="admin-meta-item">
            <div class="admin-meta-label">Amount</div>
            <div class="admin-meta-value">${escapeHtml(formatMoney(row.amount))}</div>
          </div>
          <div class="admin-meta-item">
            <div class="admin-meta-label">Plan</div>
            <div class="admin-meta-value">${escapeHtml(planLabel(row.plan_type))}</div>
          </div>
          <div class="admin-meta-item">
            <div class="admin-meta-label">Created</div>
            <div class="admin-meta-value">${escapeHtml(formatDate(row.created_at))}</div>
          </div>
          <div class="admin-meta-item">
            <div class="admin-meta-label">Redeemed</div>
            <div class="admin-meta-value">${escapeHtml(row.redeemed_at ? formatDate(row.redeemed_at) : 'Not redeemed yet')}</div>
          </div>
        </div>
        <div class="admin-actions">
          <button class="btn btn-outline btn-sm" type="button" data-action="copy-code" data-code="${escapeHtml(row.code)}">Copy code</button>
          ${row.status === 'unused'
            ? `<button class="btn btn-light-danger btn-sm" type="button" data-action="void-code" data-code-id="${escapeHtml(row.id)}">Void</button>`
            : ''}
        </div>
      </article>
    `).join('');
  }

  function renderAccounts() {
    const list = byId('accountsList');
    if (!list) return;
    if (!state.accounts.length) {
      list.innerHTML = '<div class="empty-state"><strong>No vendor accounts found</strong><div>Once sellers sign up and create stores, they will appear here.</div></div>';
      return;
    }

    list.innerHTML = state.accounts.map(row => {
      const displayName = row.display_name?.trim() || row.store_name || row.email || 'Vendor';
      const status = row.subscription_status || 'pending_activation';
      const statusClass = status === 'active'
        ? 'active'
        : status === 'paused'
            ? 'paused'
            : status === 'expired'
              ? 'expired'
              : 'inactive';
      return `
        <article class="admin-card">
          <div class="admin-card-top">
            <div>
              <div class="admin-card-title">${escapeHtml(displayName)}</div>
              <div class="admin-card-sub">${escapeHtml(row.store_name || 'Store not set')} | ${escapeHtml(row.store_slug ? `${window.VendlyStores.APP_DISPLAY_HOST}/${row.store_slug}` : 'no public link yet')}</div>
              <div class="admin-card-sub">${escapeHtml(row.email || 'No email on file')}</div>
            </div>
            <span class="status-chip ${statusClass}">${escapeHtml(status)}</span>
          </div>
          <div class="admin-meta-grid">
            <div class="admin-meta-item">
              <div class="admin-meta-label">WhatsApp</div>
              <div class="admin-meta-value">${escapeHtml(row.whatsapp || 'Not set')}</div>
            </div>
            <div class="admin-meta-item">
              <div class="admin-meta-label">Products</div>
              <div class="admin-meta-value">${escapeHtml(String(row.product_count || 0))}</div>
            </div>
            <div class="admin-meta-item">
              <div class="admin-meta-label">Orders</div>
              <div class="admin-meta-value">${escapeHtml(String(row.order_count || 0))}</div>
            </div>
            <div class="admin-meta-item">
              <div class="admin-meta-label">Subscription</div>
              <div class="admin-meta-value">${escapeHtml(row.subscription_plan ? planLabel(row.subscription_plan) : 'Not active')}</div>
            </div>
            <div class="admin-meta-item">
              <div class="admin-meta-label">Days left</div>
              <div class="admin-meta-value">${escapeHtml(String(daysLeft(row)))}</div>
            </div>
            <div class="admin-meta-item">
              <div class="admin-meta-label">Expires</div>
              <div class="admin-meta-value">${escapeHtml(formatDate(row.subscription_expires_at))}</div>
            </div>
          </div>
          <div class="admin-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="account-plan" data-owner-id="${escapeHtml(row.owner_id)}" data-plan="monthly">Activate monthly</button>
            <button class="btn btn-outline btn-sm" type="button" data-action="account-plan" data-owner-id="${escapeHtml(row.owner_id)}" data-plan="yearly">Activate yearly</button>
            <button class="btn btn-outline btn-sm" type="button" data-action="account-status" data-owner-id="${escapeHtml(row.owner_id)}" data-status="paused">Pause</button>
            <button class="btn btn-light-danger btn-sm" type="button" data-action="account-status" data-owner-id="${escapeHtml(row.owner_id)}" data-status="expired">Expire</button>
          </div>
        </article>
      `;
    }).join('');
  }

async function loadAdminData() {
      const client = await window.waitForSupabaseClient();
      const [accountsResponse, withdrawalsResponse, codesResponse, ambassadorApplicationsResponse, ambassadorRequestsResponse] = await Promise.all([
        client.rpc('admin_vendor_accounts'),
        client.rpc('admin_withdrawal_requests'),
        client.from('activation_codes').select('*').order('created_at', { ascending: false }).limit(50),
        client.rpc('admin_ambassador_applications').catch(() => ({ data: [] })),
        client.rpc('admin_ambassador_requests').catch(() => ({ data: [] }))
      ]);
  
      if (accountsResponse.error) throw accountsResponse.error;
      if (withdrawalsResponse.error) throw withdrawalsResponse.error;
      if (codesResponse.error) throw codesResponse.error;
  
      state.accounts = accountsResponse.data || [];
      state.withdrawals = withdrawalsResponse.data || [];
      state.activationCodes = codesResponse.data || [];
      state.ambassadorApplications = ambassadorApplicationsResponse.data || [];
      state.ambassadorRequests = ambassadorRequestsResponse.data || [];
  
      renderSummary();
      renderWithdrawals();
      renderActivationCodes();
      renderAccounts();
      renderAmbassadorRequests();
    }

  async function refreshAdminData() {
    try {
      const refreshBtn = byId('refreshAdminBtn');
      if (refreshBtn) refreshBtn.disabled = true;
      await loadAdminData();
      showToast('Admin data refreshed.');
    } catch (err) {
      console.warn('Admin refresh failed', err.message || err);
      showToast(err.message || 'Could not refresh admin data.', 'error');
    } finally {
      const refreshBtn = byId('refreshAdminBtn');
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  async function generateActivationCode(event) {
    event.preventDefault();
    const client = await window.waitForSupabaseClient();
    const { error } = await client.rpc('admin_generate_activation_code', {
      p_code: byId('codeValue').value.trim() || null,
      p_plan_type: byId('codePlan').value,
      p_amount: Number(byId('codeAmount').value || 0) || null,
      p_note: byId('codeNote').value.trim() || null
    });
    if (error) {
      showToast(error.message || 'Could not generate activation code.', 'error');
      return;
    }

    byId('codeForm').reset();
    byId('codeAmount').value = 4000;
    await refreshAdminData();
  }

  async function updateWithdrawalStatus(requestId, status) {
    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('admin_update_withdrawal_status', {
        p_request_id: requestId,
        p_status: status,
        p_admin_note: null
      });
      if (error) throw error;
      await refreshAdminData();
      showToast(`Withdrawal marked ${status}.`);
    } catch (err) {
      showToast(err.message || 'Could not update withdrawal.', 'error');
    }
  }

  async function updateAccountStatus(ownerId, status) {
    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('admin_set_store_status', {
        p_owner_id: ownerId,
        p_status: status
      });
      if (error) throw error;
      await refreshAdminData();
      showToast(`Store moved to ${status}.`);
    } catch (err) {
      showToast(err.message || 'Could not update store status.', 'error');
    }
  }

  async function activateAccountPlan(ownerId, plan) {
    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('admin_activate_vendor_subscription', {
        p_owner_id: ownerId,
        p_plan_type: plan
      });
      if (error) throw error;
      await refreshAdminData();
      showToast(`${planLabel(plan)} plan activated.`);
    } catch (err) {
      showToast(err.message || 'Could not activate that subscription.', 'error');
    }
  }

  async function updateAmbassadorStatus(userId, status) {
    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('admin_set_ambassador_status', {
        p_user_id: userId,
        p_status: status
      });
      if (error) throw error;
      await refreshAdminData();
      showToast(`Ambassador application ${status}.`);
    } catch (err) {
      showToast(err.message || 'Could not update ambassador application.', 'error');
    }
  }

  async function reviewAmbassadorRequest(requestId, status) {
    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client.rpc('admin_review_ambassador_request', {
        p_request_id: requestId,
        p_status: status
      });
      if (error) throw error;
      await refreshAdminData();
      showToast(`Ambassador request ${status}.`);
    } catch (err) {
      showToast(err.message || 'Could not update ambassador request.', 'error');
    }
  }

  async function voidCode(codeId) {
    try {
      const client = await window.waitForSupabaseClient();
      const { error } = await client
        .from('activation_codes')
        .update({ status: 'void' })
        .eq('id', codeId);
      if (error) throw error;
      await refreshAdminData();
      showToast('Activation code voided.');
    } catch (err) {
      showToast(err.message || 'Could not void that code.', 'error');
    }
  }

  function showAdminSection(sectionId) {
    document.querySelectorAll('[id$="Section"]').forEach(section => {
      section.style.display = section.id === sectionId ? 'block' : 'none';
    });
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.classList.toggle('active', link.dataset.adminPage === document.body.dataset.adminPage ||
        (sectionId === 'overviewSection' && !link.dataset.adminPage));
    });
    renderSummary();
    if (sectionId === 'ambassadorRequestsSection') {
      renderAmbassadorRequests();
    }
  }

  function wireTabNavigation() {
    document.body.addEventListener('click', event => {
      const navTarget = event.target.closest('[data-admin-page]');
      if (!navTarget) return;

      event.preventDefault();
      const page = navTarget.dataset.adminPage;
      document.body.dataset.adminPage = page;

      const sectionMap = {
        overview: 'overviewSection',
        ambassadors: 'ambassadorRequestsSection',
        withdrawals: 'withdrawalsSection',
        codes: 'codesSection',
        accounts: 'accountsSection'
      };

      const targetSection = sectionMap[page];
      if (targetSection) {
        showAdminSection(targetSection);
      }
    });
  }

  function wireInteractions() {
    const sidebarToggle = byId('sidebarToggle');
    const sidebarBackdrop = byId('sidebarBackdrop');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    const refreshBtn = byId('refreshAdminBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshAdminData);
    const codeForm = byId('codeForm');
    if (codeForm) codeForm.addEventListener('submit', generateActivationCode);
    const codePlan = byId('codePlan');
    const codeAmount = byId('codeAmount');
    if (codePlan && codeAmount) {
      codePlan.addEventListener('change', () => {
        codeAmount.value = codePlan.value === 'yearly' ? 40000 : 4000;
      });
    }
    const bootstrapBtn = byId('bootstrapAdminBtn');
    if (bootstrapBtn) bootstrapBtn.addEventListener('click', bootstrapAdminAccess);

    document.body.addEventListener('click', async event => {
      const actionTarget = event.target.closest('[data-action]');
      if (!actionTarget) return;

      const { action } = actionTarget.dataset;
      if (action === 'withdrawal-status') {
        await updateWithdrawalStatus(actionTarget.dataset.requestId, actionTarget.dataset.status);
      }
      if (action === 'account-status') {
        await updateAccountStatus(actionTarget.dataset.ownerId, actionTarget.dataset.status);
      }
      if (action === 'account-plan') {
        await activateAccountPlan(actionTarget.dataset.ownerId, actionTarget.dataset.plan);
      }
      if (action === 'copy-code') {
        try {
          await navigator.clipboard.writeText(actionTarget.dataset.code || '');
          showToast('Activation code copied.');
        } catch (_err) {
          showToast('Could not copy that code right now.', 'error');
        }
      }
      if (action === 'ambassador-status') {
        await updateAmbassadorStatus(actionTarget.dataset.userId, actionTarget.dataset.status);
      }
      if (action === 'ambassador-request') {
        await reviewAmbassadorRequest(actionTarget.dataset.requestId, actionTarget.dataset.status);
      }
      if (action === 'void-code') {
        await voidCode(actionTarget.dataset.codeId);
      }
    });
  }

  async function init() {
    wireTabNavigation();
    wireInteractions();
    await window.VendlyAuth.restoreSession().catch(() => false);
    state.user = await window.VendlyAuth.refreshUser().catch(() => window.VendlyAuth.getUser()) || window.VendlyAuth.getUser();
    setUserUi();

    try {
      const client = await window.waitForSupabaseClient();
      const { data, error } = await client.rpc('is_admin');
      if (error) throw error;
      state.isAdmin = !!data;
    } catch (err) {
      console.warn('Admin access check failed', err.message || err);
      state.isAdmin = false;
    }

    setAdminGate(!state.isAdmin);
    if (!state.isAdmin) return;
    await refreshAdminData();
  }

  init();
})();
