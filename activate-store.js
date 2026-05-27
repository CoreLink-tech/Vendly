(function () {
  const VENDLY_WHATSAPP = '2349168311809';
  const state = {
    user: null,
    store: null,
    access: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function getCurrentUser() {
    return window.VendlyAuth.getUser()
      || window.VendlyAuth.getCachedUser?.()
      || null;
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

  function getStoreFromUser(user) {
    if (!user) return null;
    return window.VendlyStores.normalizeStoreRecord({
      id: user.storeId || null,
      owner_id: user.id || null,
      name: user.storeName || '',
      slug: user.slug || '',
      whatsapp: user.phone || '',
      subscription_status: user.subscription_status || null,
      subscription_plan: user.subscription_plan || null,
      subscription_started_at: user.subscription_started_at || null,
      subscription_expires_at: user.subscription_expires_at || null,
      trial_started_at: user.trial_started_at || null,
      trial_ends_at: user.trial_ends_at || null,
      activated_at: user.activated_at || null
    });
  }

  function computeBannerBadge() {
    if (state.access?.active) return 'Live';
    if (state.store?.subscription_expires_at) return `${state.store.days_left || 0}d`;
    return 'Now';
  }

  function updateBanner() {
    const bannerTitle = byId('bannerTitle');
    const bannerSub = byId('bannerSub');
    const bannerDays = byId('bannerDays');
    const topSub = document.querySelector('.top-sub');

    if (state.access?.active) {
      bannerTitle.textContent = 'Your store is active';
      bannerSub.textContent = state.access.message || 'Your storefront is live and ready to share.';
      if (topSub) topSub.textContent = 'Your store already has an active subscription. Redeem another code only if Vendly asked you to extend or change your plan.';
    } else if (state.access?.state === 'expired') {
      bannerTitle.textContent = 'Your subscription has ended';
      bannerSub.textContent = state.access.message || 'Activate your store to continue receiving orders.';
      if (topSub) topSub.textContent = 'Your store is currently offline. Renew your plan to keep selling without interruptions.';
    } else {
      bannerTitle.textContent = state.access?.label || 'Store activation';
      bannerSub.textContent = state.access?.message || 'Check your access status and redeem your activation code here.';
      if (topSub) topSub.textContent = 'Redeem a valid monthly or yearly activation code to make your store live.';
    }

    bannerDays.textContent = computeBannerBadge();
  }

  function showSuccess(message) {
    byId('formView').style.display = 'none';
    byId('successScreen').classList.add('show');
    const successSub = document.querySelector('.success-sub');
    if (successSub && message) {
      successSub.textContent = message;
    }
  }

  function buildPaymentMessage() {
    const user = state.user || getCurrentUser() || {};
    const slug = user.slug || user.store || 'store-link';
    const sellerName = user.displayName || user.name || user.email || 'Seller';
    const storeLink = window.VendlyStores.buildDisplayStoreLink(slug);
    return `Hello Vendly,\n\nI would like to activate my store.\n\nStore: ${storeLink}\nName: ${sellerName}\n\nPlease confirm my payment and send my activation code. Monthly plan is NGN 4,000 and yearly plan is NGN 40,000.`;
  }

  function buildWALink(event) {
    event.preventDefault();
    const url = `https://wa.me/${VENDLY_WHATSAPP}?text=${encodeURIComponent(buildPaymentMessage())}`;
    window.open(url, '_blank', 'noopener');
  }

  async function submitCode() {
    const input = byId('codeInput');
    const submitButton = document.querySelector('.code-submit');
    const code = input.value.trim().toUpperCase();

    if (!code) {
      input.classList.add('error');
      input.focus();
      window.setTimeout(() => input.classList.remove('error'), 2000);
      showToast('Enter your activation code.', 'error');
      return;
    }

    submitButton.disabled = true;

    try {
      await window.VendlyAuth.restoreSession().catch(() => false);
      state.user = await window.VendlyAuth.refreshUser().catch(() => getCurrentUser()) || getCurrentUser();
      if (!state.user?.id) {
        throw new Error('Sign in again before activating your store.');
      }

      const client = await window.waitForSupabaseClient();
      const { data, error } = await client.rpc('redeem_activation_code', {
        input_code: code
      });
      if (error) throw error;

      state.user = await window.VendlyAuth.refreshUser().catch(() => getCurrentUser()) || getCurrentUser();
      state.store = getStoreFromUser(state.user);
      state.access = window.VendlyStores.getAccessState(state.store || {});

      input.classList.remove('error');
      input.classList.add('success');
      updateBanner();
      showToast(data?.message || 'Activation successful.');
      window.setTimeout(() => {
        showSuccess('Your store is live again. Customers can browse and order from your link.');
      }, 700);
    } catch (err) {
      input.classList.remove('success');
      input.classList.add('error');
      window.setTimeout(() => input.classList.remove('error'), 2500);
      showToast(err.message || 'Could not redeem that activation code.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  }

  async function init() {
    await window.VendlyAuth.restoreSession().catch(() => false);
    state.user = await window.VendlyAuth.refreshUser().catch(() => getCurrentUser()) || getCurrentUser();
    state.store = getStoreFromUser(state.user);
    state.access = window.VendlyStores.getAccessState(state.store || {});
    updateBanner();

    if (state.access?.active && state.access.state === 'active') {
      showSuccess('Your store already has an active subscription. Share your store link and keep receiving orders.');
    }
  }

  byId('codeInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCode();
    }
  });

  window.buildWALink = buildWALink;
  window.submitCode = submitCode;

  init();
})();
