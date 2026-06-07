/* ============================================================
   vendly-nav.js
   Navigation helpers plus shared auth/session utilities.
   ============================================================ */

const PAGES = {
  landing: 'index.html',
  login: 'login.html',
  adminLogin: 'admin-login.html',
  signup: 'signup.html',
  dashboard: 'dashboard.html',
  admin: 'ADMIN.html',
  adminWithdrawals: 'admin-withdrawals.html',
  adminCodes: 'admin-codes.html',
  adminAccounts: 'admin-accounts.html',
  storefront: 'storefront.html',
  products: 'produc.html',
  orders: 'order.html',
  analytics: 'analytics.html',
  account: 'accounts.html',
  activate: 'activate.html',
  referral: 'referral.html',
  ambassador: 'ambassador.html',
};

const APP_BASE_URL = 'https://vendly-snowy.vercel.app';
const APP_DISPLAY_HOST = APP_BASE_URL.replace(/^https?:\/\//, '');
const sessionState = {
  confirmed: false,
  checked: false,
};

const Loading = (() => {
  let mounted = false;
  let el = null;

  function ensure() {
    if (mounted) return;
    mounted = true;

    const style = document.createElement('style');
    style.setAttribute('data-vendly-loader', 'true');
    style.textContent = `
      .vendly-loader {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(10px);
      }
      .vendly-loader.show { display: flex; }
      .vendly-loader .ring {
        width: 54px;
        height: 54px;
        border-radius: 999px;
        border: 5px solid rgba(22, 163, 74, 0.18);
        border-top-color: rgba(22, 163, 74, 0.95);
        animation: vendlySpin 0.9s linear infinite;
      }
      @keyframes vendlySpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    el = document.createElement('div');
    el.className = 'vendly-loader';
    el.innerHTML = '<div class="ring" aria-label="Loading" role="status"></div>';
    document.body.appendChild(el);
  }

  function show() {
    ensure();
    el?.classList.add('show');
  }

  function hide() {
    if (!mounted) return;
    el?.classList.remove('show');
  }

  return { ensure, show, hide };
})();

function buildInitials(value) {
  const text = (value || '').trim();
  if (!text) return 'V';

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function safeParseStoredUser() {
  try {
    const raw = localStorage.getItem('vendly_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    localStorage.removeItem('vendly_user');
    return null;
  }
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatAccessDate(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'your subscription expiry date';
  return parsed.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeSubscriptionPlan(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'yearly' ? 'yearly' : normalized === 'monthly' ? 'monthly' : null;
}

function normalizeStoreStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['active', 'paused', 'expired', 'pending_activation'].includes(normalized)
    ? normalized
    : null;
}

function normalizeAmbassadorStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['none', 'pending', 'accepted', 'declined'].includes(normalized)
    ? normalized
    : 'none';
}

function getAmbassadorStatus(user) {
  if (!user) return 'none';
  return normalizeAmbassadorStatus(
    firstPresentValue(
      user.ambassador_status,
      user.ambassadorStatus,
      user.user_metadata?.ambassador_status,
      user.user_metadata?.ambassadorStatus,
      user.userMetadata?.ambassador_status,
      user.userMetadata?.ambassadorStatus,
      'none'
    )
  );
}

function buildAmbassadorNavEntry() {
  const navItem = document.createElement('button');
  navItem.type = 'button';
  navItem.dataset.ambassadorEntry = 'true';
  navItem.className = 'nav-item ambassador-nav-item';
  return navItem;
}

function renderAmbassadorNav() {
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (!sidebarNav) return;

  const existing = sidebarNav.querySelector('[data-ambassador-entry]');
  if (existing) existing.remove();

  const user = Auth.getUser() || Auth.getCachedUser();
  const status = getAmbassadorStatus(user);
  const referralLink = sidebarNav.querySelector('a[href="referral.html"]');

  if (status === 'accepted') {
    if (referralLink) referralLink.style.display = 'none';
    const ambassadorLink = document.createElement('a');
    ambassadorLink.className = 'sidebar-link';
    ambassadorLink.href = PAGES.ambassador;
    ambassadorLink.dataset.nav = 'ambassador';
    ambassadorLink.dataset.ambassadorEntry = 'true';
    ambassadorLink.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2v20"></path><path d="M22 12H2"></path></svg><span>Ambassador</span>`;
    if (referralLink) {
      referralLink.insertAdjacentElement('afterend', ambassadorLink);
    } else {
      sidebarNav.appendChild(ambassadorLink);
    }
    wireNavAttributes();
    return;
  }

  if (referralLink) referralLink.style.display = '';

  const actionButton = buildAmbassadorNavEntry();
  if (status === 'pending') {
    actionButton.disabled = true;
    actionButton.classList.add('nav-item-disabled');
    actionButton.textContent = 'Application Pending';
  } else {
    actionButton.textContent = 'Become an Ambassador';
    actionButton.addEventListener('click', openAmbassadorModal);
  }

  if (referralLink && referralLink.parentNode) {
    referralLink.insertAdjacentElement('beforebegin', actionButton);
  } else {
    sidebarNav.prepend(actionButton);
  }
  wireNavAttributes();
}

function ensureAmbassadorStyles() {
  if (document.getElementById('ambassadorStyles')) return;
  const style = document.createElement('style');
  style.id = 'ambassadorStyles';
  style.textContent = `
    .ambassador-nav-item {
      border: none;
      background: none;
      padding: 10px 12px;
      border-radius: 9px;
      color: var(--grey-dark);
      cursor: pointer;
      text-align: left;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.18s ease;
    }
    .ambassador-nav-item:hover:not([disabled]) {
      background: #f3f4f6;
      color: var(--black);
    }
    .ambassador-nav-item[disabled], .nav-item-disabled {
      opacity: 0.56;
      cursor: default;
      pointer-events: none;
    }
    #ambassadorModal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    #ambassadorModal.open { display: flex; }
    #ambassadorModal .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(2px);
    }
    #ambassadorModal .modal-content {
      position: relative;
      width: min(540px, 100%);
      background: white;
      border-radius: 22px;
      padding: 30px 26px;
      box-shadow: 0 32px 72px rgba(15,23,42,0.18);
      display: grid;
      gap: 18px;
      z-index: 1;
    }
    #ambassadorModal .modal-close {
      position: absolute;
      top: 18px;
      right: 18px;
      border: none;
      background: none;
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      color: var(--grey-dark);
    }
    #ambassadorModal h2 {
      margin: 0;
      font-size: 1.55rem;
      color: var(--black);
    }
    #ambassadorModal .modal-copy {
      color: var(--grey-mid);
      line-height: 1.7;
    }
    #ambassadorModal label {
      display: block;
      margin-top: 10px;
      margin-bottom: 8px;
      font-size: 0.88rem;
      color: var(--grey-dark);
      font-weight: 600;
    }
    #ambassadorModal input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid #d1d5db;
      font-size: 0.95rem;
      color: var(--black);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    #ambassadorModal input:focus {
      border-color: var(--green);
      box-shadow: 0 0 0 4px rgba(16,185,129,0.12);
    }
    #ambassadorModal .btn {
      width: 100%;
      justify-content: center;
    }
    #ambassadorModal .modal-feedback {
      margin-top: 6px;
      color: var(--green);
      min-height: 1.4rem;
      font-size: 0.95rem;
    }
  `;
  document.head.appendChild(style);
}

function createAmbassadorModal() {
  ensureAmbassadorStyles();
  if (document.getElementById('ambassadorModal')) return;

  const modal = document.createElement('div');
  modal.id = 'ambassadorModal';
  modal.className = 'ambassador-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" data-ambassador-close></div>
    <div class="modal-content">
      <button type="button" class="modal-close" data-ambassador-close>×</button>
      <h2>Become a Vendly Ambassador</h2>
      <p class="modal-copy">Earn 25% every month on every paying referral you bring in. Forever.</p>
      <form id="ambassadorForm">
        <label>Full name</label>
        <input type="text" name="fullName" id="ambassadorFullName" placeholder="Your full name" autocomplete="name" required>
        <label>Phone number</label>
        <input type="tel" name="phone" id="ambassadorPhone" placeholder="08012345678" autocomplete="tel" required>
        <button type="submit" class="btn btn-primary">Send Application</button>
        <div class="modal-feedback" id="ambassadorFeedback"></div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', event => {
    if (event.target.dataset.ambassadorClose !== undefined) {
      event.preventDefault();
      closeAmbassadorModal();
    }
  });

  const form = modal.querySelector('#ambassadorForm');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    await submitAmbassadorApplication();
  });
}

function openAmbassadorModal() {
  createAmbassadorModal();
  const modal = document.getElementById('ambassadorModal');
  if (!modal) return;
  modal.classList.add('open');
}

function closeAmbassadorModal() {
  const modal = document.getElementById('ambassadorModal');
  modal?.classList.remove('open');
}

async function submitAmbassadorApplication() {
  const fullNameInput = document.getElementById('ambassadorFullName');
  const phoneInput = document.getElementById('ambassadorPhone');
  const feedback = document.getElementById('ambassadorFeedback');
  if (!fullNameInput || !phoneInput || !feedback) return;

  const fullName = fullNameInput.value.trim();
  const phone = phoneInput.value.trim();
  if (!fullName || fullName.length < 2) {
    feedback.textContent = 'Enter your full name.';
    return;
  }
  if (!phone) {
    feedback.textContent = 'Enter your phone number.';
    return;
  }

  const user = Auth.getUser() || Auth.getCachedUser();
  const username = user?.slug || user?.email?.split('@')[0] || user?.id || 'unknown';
  const email = user?.email || '';
  const userId = user?.id || '';
  const message = encodeURIComponent(
    `New Ambassador Application\nName: ${fullName}\nPhone: ${phone}\nUsername: ${username}\nEmail: ${email}\nUser ID: ${userId}`
  );
  window.open(`https://wa.me/2349168311809?text=${message}`, '_blank');

  try {
    const client = await Auth.getClient();
    const { data, error } = await client.rpc('apply_for_ambassador');
    if (error) throw error;
    const enriched = Auth.getUser();
    if (enriched) {
      enriched.ambassador_status = 'pending';
      localStorage.setItem('vendly_user', JSON.stringify(enriched));
    }
    feedback.textContent = 'Application sent. You\'ll hear from us within 24 hours.';
    renderAmbassadorNav();
    setTimeout(() => closeAmbassadorModal(), 1600);
  } catch (err) {
    feedback.textContent = err.message || 'Could not send your application right now.';
  }
}

function computeDaysLeft(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.ceil((parsed.getTime() - Date.now()) / 86400000));
}

function firstPresentValue(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }

    if (value !== null && value !== undefined) return value;
  }

  return '';
}

function extractUserEmail(user) {
  if (!user) return '';

  const identities = Array.isArray(user.identities) ? user.identities : [];
  return firstPresentValue(
    user.email,
    user.new_email,
    user.email_address,
    user.user_metadata?.email,
    user.app_metadata?.email,
    ...identities.map(identity => identity?.identity_data?.email)
  );
}

const Stores = {
  APP_BASE_URL,
  APP_DISPLAY_HOST,
  STORE_SELECT: 'id, owner_id, name, slug, whatsapp, subscription_status, subscription_plan, subscription_started_at, subscription_expires_at, trial_started_at, trial_ends_at, activated_at, created_at, updated_at',

  normalizeSlug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  },

  buildDisplayStoreLink(slug) {
    const safeSlug = Stores.normalizeSlug(slug || '');
    return safeSlug ? `${APP_DISPLAY_HOST}/${safeSlug}` : `${APP_DISPLAY_HOST}/store-link`;
  },

  buildCanonicalStoreUrl(slug) {
    const safeSlug = Stores.normalizeSlug(slug || '');
    return safeSlug ? `${APP_BASE_URL}/${encodeURIComponent(safeSlug)}` : APP_BASE_URL;
  },

  buildPreviewStoreUrl(slug) {
    const safeSlug = Stores.normalizeSlug(slug || '');
    return safeSlug ? `storefront.html?slug=${encodeURIComponent(safeSlug)}` : 'storefront.html';
  },

  normalizeStoreRecord(store) {
    if (!store) return null;

    const normalizedName = String(store.name || '').trim();
    const normalizedSlug = Stores.normalizeSlug(store.slug || normalizedName || '');

    return {
      ...store,
      id: store.id || null,
      owner_id: store.owner_id || null,
      name: normalizedName,
      slug: normalizedSlug,
      whatsapp: String(store.whatsapp || store.phone || '').trim(),
      subscription_status: normalizeStoreStatus(store.subscription_status),
      subscription_plan: normalizeSubscriptionPlan(store.subscription_plan),
      subscription_started_at: normalizeIsoDate(store.subscription_started_at),
      subscription_expires_at: normalizeIsoDate(store.subscription_expires_at),
      trial_started_at: normalizeIsoDate(store.trial_started_at),
      trial_ends_at: normalizeIsoDate(store.trial_ends_at),
      activated_at: normalizeIsoDate(store.activated_at),
      days_left: Number.isFinite(Number(store.days_left)) ? Number(store.days_left) : computeDaysLeft(store.subscription_expires_at),
      created_at: normalizeIsoDate(store.created_at),
      updated_at: normalizeIsoDate(store.updated_at),
    };
  },

  buildStorePayload(store) {
    const record = Stores.normalizeStoreRecord(store) || {};
    const subscriptionStatus = record.subscription_status || 'pending_activation';
    const subscriptionPlan = record.subscription_plan || null;
    const subscriptionStartedAt = record.subscription_started_at || null;
    const subscriptionExpiresAt = record.subscription_expires_at || null;
    const activatedAt = record.activated_at || null;

    return {
      owner_id: record.owner_id,
      name: record.name,
      slug: record.slug || Stores.normalizeSlug(record.name || ''),
      whatsapp: record.whatsapp || null,
      subscription_status: subscriptionStatus,
      subscription_plan: subscriptionPlan,
      subscription_started_at: subscriptionStartedAt,
      subscription_expires_at: subscriptionExpiresAt,
      trial_started_at: record.trial_started_at || null,
      trial_ends_at: record.trial_ends_at || null,
      activated_at: activatedAt,
    };
  },

  getAccessState(store) {
    const record = Stores.normalizeStoreRecord(store);
    if (!record?.slug) {
      return {
        active: false,
        state: 'setup',
        label: 'Store setup needed',
        message: 'Complete your store details before sharing your storefront.',
      };
    }

    const daysLeft = computeDaysLeft(record.subscription_expires_at);

    if (record.subscription_status === 'paused') {
      return {
        active: false,
        state: 'paused',
        label: 'Store paused',
        message: 'Your storefront is paused until Vendly reactivates it.',
      };
    }

    if (record.subscription_status === 'active' && record.subscription_expires_at && daysLeft > 0) {
      const planLabel = record.subscription_plan === 'yearly' ? 'Yearly' : 'Monthly';
      return {
        active: true,
        state: 'active',
        label: `${planLabel} plan active`,
        message: `Your storefront is live. ${daysLeft} day${daysLeft === 1 ? '' : 's'} left until ${formatAccessDate(record.subscription_expires_at)}.`,
      };
    }

    if (record.subscription_status === 'active' && record.subscription_expires_at && daysLeft <= 0) {
      return {
        active: false,
        state: 'expired',
        label: 'Subscription expired',
        message: `Your subscription expired on ${formatAccessDate(record.subscription_expires_at)}. Renew it to keep receiving orders.`,
      };
    }

    return {
      active: false,
      state: record.subscription_status === 'expired' ? 'expired' : 'inactive',
      label: record.subscription_status === 'expired' ? 'Subscription expired' : 'Activation needed',
      message: record.subscription_status === 'expired'
        ? `Your subscription has ended${record.subscription_expires_at ? ` on ${formatAccessDate(record.subscription_expires_at)}` : ''}. Renew it to keep your storefront live.`
        : 'Activate your store to make your storefront live and start receiving orders.',
    };
  },

  async upsertStore(client, payload) {
    if (!client) return null;

    const record = Stores.buildStorePayload(payload);
    if (!record?.owner_id || !record?.slug || !record?.name) return null;

    const writeStore = async onConflict => client
      .from('stores')
      .upsert([record], { onConflict })
      .select(Stores.STORE_SELECT)
      .maybeSingle();

    let response = await writeStore('owner_id');
    if (response.error && /unique|constraint/i.test(response.error.message || '')) {
      response = await writeStore('slug');
    }

    if (response.error) throw response.error;
    return Stores.normalizeStoreRecord(response.data || record);
  },
};

const Auth = {
  isLoggedIn() {
    return sessionState.confirmed && !!safeParseStoredUser()?.id;
  },

  isAdmin() {
    return !!safeParseStoredUser()?.isAdmin;
  },

  hasConfirmedSession() {
    return sessionState.confirmed;
  },

  async getClient() {
    if (window.supabase) return window.supabase;
    if (typeof window.waitForSupabaseClient === 'function') {
      return window.waitForSupabaseClient();
    }
    return null;
  },

  async enrichUser(user) {
    if (!user) return null;

    const metadata = user.user_metadata || {};
    const cachedUser = safeParseStoredUser();
    const fallbackStoreName = firstPresentValue(
      user.storeName,
      user.store_name,
      user.store?.name,
      metadata.storeName,
      metadata.store_name,
      cachedUser?.storeName,
      cachedUser?.store?.name
    );
    const fallbackSlug = Stores.normalizeSlug(firstPresentValue(
      user.slug,
      user.storeSlug,
      user.store_slug,
      user.store?.slug,
      metadata.slug,
      metadata.storeSlug,
      metadata.store_slug,
      cachedUser?.slug,
      cachedUser?.store?.slug,
      fallbackStoreName
    ));
    const fallbackPhone = firstPresentValue(
      user.phone,
      user.whatsapp,
      user.whatsapp_number,
      user.store?.whatsapp,
      user.store?.phone,
      metadata.phone,
      metadata.whatsapp,
      metadata.whatsapp_number,
      cachedUser?.phone,
      cachedUser?.store?.whatsapp
    );
    const enriched = {
      ...user,
      email: extractUserEmail(user) || extractUserEmail(cachedUser),
      firstName: firstPresentValue(
        user.firstName,
        user.first_name,
        metadata.firstName,
        metadata.first_name,
        cachedUser?.firstName,
        cachedUser?.first_name
      ),
      lastName: firstPresentValue(
        user.lastName,
        user.last_name,
        metadata.lastName,
        metadata.last_name,
        cachedUser?.lastName,
        cachedUser?.last_name
      ),
      storeName: fallbackStoreName,
      slug: fallbackSlug,
      phone: fallbackPhone,
      storeId: firstPresentValue(
        user.storeId,
        user.store_id,
        user.store?.id,
        metadata.storeId,
        metadata.store_id,
        cachedUser?.storeId,
        cachedUser?.store?.id,
        null
      ),
      subscription_status: normalizeStoreStatus(firstPresentValue(
        user.subscription_status,
        user.store?.subscription_status,
        metadata.subscription_status,
        cachedUser?.subscription_status,
        cachedUser?.store?.subscription_status
      )),
      subscription_plan: normalizeSubscriptionPlan(firstPresentValue(
        user.subscription_plan,
        user.store?.subscription_plan,
        metadata.subscription_plan,
        cachedUser?.subscription_plan,
        cachedUser?.store?.subscription_plan
      )),
      subscription_started_at: normalizeIsoDate(firstPresentValue(
        user.subscription_started_at,
        user.store?.subscription_started_at,
        metadata.subscription_started_at,
        cachedUser?.subscription_started_at,
        cachedUser?.store?.subscription_started_at
      )),
      subscription_expires_at: normalizeIsoDate(firstPresentValue(
        user.subscription_expires_at,
        user.store?.subscription_expires_at,
        metadata.subscription_expires_at,
        cachedUser?.subscription_expires_at,
        cachedUser?.store?.subscription_expires_at
      )),
      trial_started_at: normalizeIsoDate(firstPresentValue(
        user.trial_started_at,
        user.store?.trial_started_at,
        metadata.trial_started_at,
        cachedUser?.trial_started_at,
        cachedUser?.store?.trial_started_at
      )),
      trial_ends_at: normalizeIsoDate(firstPresentValue(
        user.trial_ends_at,
        user.store?.trial_ends_at,
        metadata.trial_ends_at,
        cachedUser?.trial_ends_at,
        cachedUser?.store?.trial_ends_at
      )),
      activated_at: normalizeIsoDate(firstPresentValue(
        user.activated_at,
        user.store?.activated_at,
        metadata.activated_at,
        cachedUser?.activated_at,
        cachedUser?.store?.activated_at
      )),
      isAdmin: false,
    };

    const client = await Auth.getClient().catch(() => null);
    if (client && enriched.id) {
      try {
        const [{ data: profile }, { data: store }] = await Promise.all([
          client.from('profiles').select('first_name, last_name').eq('id', enriched.id).maybeSingle(),
          client.from('stores').select(Stores.STORE_SELECT).eq('owner_id', enriched.id).maybeSingle(),
        ]);

        if (profile) {
          enriched.firstName = profile.first_name || enriched.firstName;
          enriched.lastName = profile.last_name || enriched.lastName;
        }

        let normalizedStore = Stores.normalizeStoreRecord(store);

        const needsStore = !normalizedStore && enriched.storeName && enriched.slug;
        if (needsStore) {
          normalizedStore = await Stores.upsertStore(client, {
            owner_id: enriched.id,
            name: enriched.storeName,
            slug: enriched.slug,
            whatsapp: enriched.phone || null,
          });
        }

        if (normalizedStore) {
          enriched.storeId = normalizedStore.id || enriched.storeId;
          enriched.storeName = normalizedStore.name || enriched.storeName;
          enriched.slug = normalizedStore.slug || enriched.slug;
          enriched.phone = normalizedStore.whatsapp || enriched.phone;
          enriched.subscription_status = normalizedStore.subscription_status;
          enriched.subscription_plan = normalizedStore.subscription_plan;
          enriched.subscription_started_at = normalizedStore.subscription_started_at;
          enriched.subscription_expires_at = normalizedStore.subscription_expires_at;
          enriched.trial_started_at = normalizedStore.trial_started_at;
          enriched.trial_ends_at = normalizedStore.trial_ends_at;
          enriched.activated_at = normalizedStore.activated_at;
        }

        const needsProfile = !profile && (enriched.firstName || enriched.lastName);
        if (needsProfile) {
          await client.from('profiles').upsert([{
            id: enriched.id,
            first_name: enriched.firstName || null,
            last_name: enriched.lastName || null,
          }], { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Could not enrich user context', err.message || err);
      }

      // Role lookup: admins should be kept inside the admin portal only.
      try {
        const [{ data: isAdmin }, { data: ambassadorStatus }] = await Promise.all([
          client.rpc('is_admin'),
          client.rpc('get_my_ambassador_status')
        ]);
        enriched.isAdmin = !!isAdmin;
        enriched.ambassador_status = normalizeAmbassadorStatus(ambassadorStatus);
      } catch (err) {
        enriched.isAdmin = false;
        enriched.ambassador_status = normalizeAmbassadorStatus(
          firstPresentValue(user.ambassador_status, user.ambassadorStatus, cachedUser?.ambassador_status, cachedUser?.ambassadorStatus, 'none')
        );
        console.warn('Could not determine admin or ambassador status', err?.message || err);
      }
    }

    const derivedStore = Stores.normalizeStoreRecord({
      id: enriched.storeId,
      owner_id: enriched.id || null,
      name: enriched.storeName,
      slug: enriched.slug,
      whatsapp: enriched.phone,
      subscription_status: enriched.subscription_status,
      subscription_plan: enriched.subscription_plan,
      subscription_started_at: enriched.subscription_started_at,
      subscription_expires_at: enriched.subscription_expires_at,
      trial_started_at: enriched.trial_started_at,
      trial_ends_at: enriched.trial_ends_at,
      activated_at: enriched.activated_at,
    });

    const displayName = [enriched.firstName, enriched.lastName].filter(Boolean).join(' ').trim()
      || enriched.storeName
      || enriched.email
      || 'Vendor';

    enriched.store = (derivedStore?.id || derivedStore?.name || derivedStore?.slug || derivedStore?.whatsapp)
      ? derivedStore
      : null;
    enriched.displayName = displayName;
    enriched.initials = buildInitials(displayName);
    enriched.storeLink = Stores.buildDisplayStoreLink(enriched.slug);
    enriched.storeUrl = Stores.buildCanonicalStoreUrl(enriched.slug);
    enriched.subscription_days_left = computeDaysLeft(enriched.subscription_expires_at);
    enriched.isAdmin = !!enriched.isAdmin;
    return enriched;
  },

  async restoreSession() {
    const client = await Auth.getClient().catch(() => null);
    sessionState.checked = true;

    if (!client) {
      sessionState.confirmed = false;
      return false;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        sessionState.confirmed = false;
        console.warn('Supabase session restore failed', error.message);
        return false;
      }

      const user = data?.session?.user;
      if (!user) {
        sessionState.confirmed = false;
        localStorage.removeItem('vendly_user');
        return false;
      }

      await Auth.setUser(user);
      return true;
    } catch (err) {
      sessionState.confirmed = false;
      console.warn('Supabase session restore error', err);
      return false;
    }
  },

  async setUser(user) {
    const enriched = await Auth.enrichUser(user);
    if (!enriched) {
      sessionState.confirmed = false;
      localStorage.removeItem('vendly_user');
      return null;
    }

    sessionState.checked = true;
    sessionState.confirmed = true;
    localStorage.setItem('vendly_user', JSON.stringify(enriched));
    return enriched;
  },

  async refreshUser() {
    if (!sessionState.confirmed) return null;

    const current = safeParseStoredUser();
    if (!current?.id) return null;
    return Auth.setUser(current);
  },

  async clearUser() {
    const client = await Auth.getClient().catch(() => null);
    if (client) {
      try {
        await client.auth.signOut();
      } catch (_err) {
        // Ignore sign-out failures.
      }
    }

    sessionState.checked = true;
    sessionState.confirmed = false;
    localStorage.removeItem('vendly_user');
  },

  getUser() {
    return sessionState.confirmed ? safeParseStoredUser() : null;
  },

  getCachedUser() {
    return safeParseStoredUser();
  },
};

const Nav = {
  go(page) {
    const path = PAGES[page];
    if (!path) {
      console.warn(`Vendly Nav: unknown page "${page}"`);
      return;
    }
    Loading.show();
    window.location.href = path;
  },

  back(fallbackPage = 'landing') {
    if (document.referrer) {
      Loading.show();
      history.back();
    } else {
      Nav.go(fallbackPage);
    }
  },

  current() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    return Object.keys(PAGES).find(key => PAGES[key] === file) || null;
  },
};

const PROTECTED = ['dashboard', 'products', 'orders', 'analytics', 'account', 'activate', 'referral', 'ambassador', 'admin', 'adminWithdrawals', 'adminCodes', 'adminAccounts'];
const AUTH_ONLY = ['login', 'signup', 'adminLogin'];
const ADMIN_ONLY = ['admin', 'adminWithdrawals', 'adminCodes', 'adminAccounts'];
const VENDOR_ONLY = ['dashboard', 'products', 'orders', 'analytics', 'account', 'activate', 'referral'];

async function runGuards() {
  const page = Nav.current();
  if (!page) return;

  if (PROTECTED.includes(page) && !Auth.isLoggedIn()) {
    Nav.go(ADMIN_ONLY.includes(page) ? 'adminLogin' : 'login');
    return;
  }

  if (AUTH_ONLY.includes(page) && Auth.isLoggedIn()) {
    Nav.go(Auth.isAdmin() ? 'admin' : 'dashboard');
    return;
  }

  if (Auth.isLoggedIn()) {
    const user = Auth.getUser() || Auth.getCachedUser();
    const isAdmin = !!user?.isAdmin;

    if (ADMIN_ONLY.includes(page) && !isAdmin) {
      Nav.go('dashboard');
      return;
    }

    if (VENDOR_ONLY.includes(page) && isAdmin) {
      Nav.go('admin');
      return;
    }
  }
}

function wireNavAttributes() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      Nav.go(el.dataset.nav);
    });
  });
}

function wirePageLoader() {
  Loading.ensure();

  // Hide loader whenever the browser completes navigation (including bfcache restores).
  window.addEventListener('pageshow', () => Loading.hide());
  window.addEventListener('load', () => Loading.hide());

  // Show loader on same-origin page navigations triggered by links.
  document.addEventListener('click', e => {
    const anchor = e.target?.closest ? e.target.closest('a[href]') : null;
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (anchor.hasAttribute('download') || anchor.target === '_blank') return;

    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
    } catch (_err) {
      return;
    }

    Loading.show();
  }, { capture: true });
}

function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', async () => {
      await Auth.clearUser();
      Nav.go('login');
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  wirePageLoader();
  await Auth.restoreSession();
  await runGuards();
  wireNavAttributes();
  renderAmbassadorNav();
  wireLogout();
});

window.VendlyNav = Nav;
window.VendlyAuth = Auth;
window.VendlyStores = Stores;
