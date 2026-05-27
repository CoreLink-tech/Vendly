(function () {
  const STORAGE_BUCKET = 'vendor-images';
  const TOAST_MS = 3200;
  const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif'];
  const PRODUCT_IMAGE_MAX_WIDTH = 1200;
  const PRODUCT_IMAGE_WEBP_QUALITY = 0.85;

  function getCurrentPage() {
    return document.body?.dataset?.page || 'dashboard';
  }

  const state = {
    page: getCurrentPage(),
    user: null,
    store: null,
    access: null,
    products: [],
    orders: [],
    storeViews: [],
    productViews: [],
    productFormMode: 'create',
    productPreviewUrl: '',
    productFile: null
  };

  const pageMeta = {
    dashboard: {
      eyebrow: 'Vendor portal',
      title: 'Dashboard',
      subtitle: 'See your store performance, link status, and the next actions that matter.',
      primaryLabel: 'Manage products',
      primaryHref: 'produc.html'
    },
    products: {
      eyebrow: 'Catalog',
      title: 'Products',
      subtitle: 'Add new items, update details, and control what shoppers see in your store.',
      primaryLabel: 'Open dashboard',
      primaryHref: 'dashboard.html'
    },
    orders: {
      eyebrow: 'WhatsApp orders',
      title: 'Orders',
      subtitle: 'Track every order sent from your storefront and keep fulfillment organized.',
      primaryLabel: 'Open dashboard',
      primaryHref: 'dashboard.html'
    },
    analytics: {
      eyebrow: 'Store insights',
      title: 'Analytics',
      subtitle: 'Understand which products pull attention and which ones turn into real orders.',
      primaryLabel: 'Manage products',
      primaryHref: 'produc.html'
    },
    account: {
      eyebrow: 'Store settings',
      title: 'Account',
      subtitle: 'Update seller details, review subscription status, and manage your store access.',
      primaryLabel: 'Activate store',
      primaryHref: 'activate.html'
    }
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

  function isAcceptedImageFile(file) {
    const fileType = String(file?.type || '').toLowerCase();
    return ACCEPTED_IMAGE_TYPES.includes(fileType) || fileType.startsWith('image/');
  }

  /**
   * Converts any image File or Blob to a WebP Blob using the Canvas API.
   * This runs entirely in the browser.
   *
   * @param {File|Blob} file
   * @param {number} quality
   * @returns {Promise<Blob>}
   */
  function convertToWebP(file, quality = PRODUCT_IMAGE_WEBP_QUALITY) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const sourceWidth = img.naturalWidth || img.width || 1;
        const sourceHeight = img.naturalHeight || img.height || 1;
        const canvas = document.createElement('canvas');

        if (sourceWidth > PRODUCT_IMAGE_MAX_WIDTH) {
          canvas.width = PRODUCT_IMAGE_MAX_WIDTH;
          canvas.height = Math.max(1, Math.round(sourceHeight * (PRODUCT_IMAGE_MAX_WIDTH / sourceWidth)));
        } else {
          canvas.width = Math.max(1, sourceWidth);
          canvas.height = Math.max(1, sourceHeight);
        }

        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('This browser could not prepare the image for upload.'));
          return;
        }

        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('WebP conversion failed: canvas.toBlob returned null.'));
            return;
          }
          resolve(blob);
        }, 'image/webp', quality);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not load the selected image for conversion.'));
      };

      img.src = objectUrl;
    });
  }

  function formatMoney(value) {
    return `NGN ${Number(value || 0).toLocaleString('en-NG')}`;
  }

  function formatDateTime(value) {
    if (!value) return 'No date yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No date yet';
    return date.toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  function formatDateOnly(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatRelativeTime(value) {
    if (!value) return 'None yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'None yet';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateOnly(value);
  }

  function shortDayLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-NG', { weekday: 'short' });
  }

  function showToast(message, type = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-dot"></div><div>${escapeHtml(message)}</div>`;
    wrap.appendChild(toast);

    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      window.setTimeout(() => toast.remove(), 180);
    }, TOAST_MS);
  }

  async function getClient() {
    if (window.supabase) return window.supabase;
    if (typeof window.waitForSupabaseClient === 'function') {
      return window.waitForSupabaseClient().catch(() => null);
    }
    return null;
  }

  function iconSvg(name) {
    const icons = {
      box: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
      eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
      users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      clock: '<path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>',
      chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
      list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      order: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
      image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.box}</svg>`;
  }

  function normalizeProduct(product) {
    const numericPrice = typeof product?.price === 'number' ? product.price : Number(product?.price || 0);
    return {
      ...product,
      id: String(product?.id ?? ''),
      name: product?.name || 'Untitled product',
      description: product?.description || '',
      image_url: product?.image_url || product?.image || '',
      status: (product?.status || 'live').toLowerCase(),
      price: Number.isFinite(numericPrice) ? numericPrice : 0,
      created_at: product?.created_at || null,
      updated_at: product?.updated_at || product?.created_at || null
    };
  }

  function normalizeOrder(order) {
    const items = Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.line_items)
        ? order.line_items
        : [];

    return {
      ...order,
      id: String(order?.id ?? ''),
      status: String(order?.status || 'new').toLowerCase(),
      total_amount: Number(order?.total_amount || 0),
      item_count: Number(order?.item_count || items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
      items,
      whatsapp_url: order?.whatsapp_url || '',
      created_at: order?.created_at || null
    };
  }

  function getProductFromState(productId) {
    return state.products.find(product => String(product.id) === String(productId)) || null;
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

  function buildInitials(value) {
    const text = String(value || '').trim();
    if (!text) return 'VD';

    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  function getUserEmail(user = state.user) {
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

  function getUserStoreName(user = state.user) {
    return firstPresentValue(
      user?.storeName,
      user?.store_name,
      user?.store?.name,
      user?.user_metadata?.storeName,
      user?.user_metadata?.store_name
    );
  }

  function getUserSlug(user = state.user) {
    return window.VendlyStores.normalizeSlug(firstPresentValue(
      user?.slug,
      user?.storeSlug,
      user?.store_slug,
      user?.store?.slug,
      user?.user_metadata?.slug,
      user?.user_metadata?.storeSlug,
      user?.user_metadata?.store_slug,
      user?.storeLink?.split('/').pop(),
      getUserStoreName(user)
    ));
  }

  function getUserPhone(user = state.user) {
    return firstPresentValue(
      user?.phone,
      user?.whatsapp,
      user?.whatsapp_number,
      user?.store?.whatsapp,
      user?.store?.phone,
      user?.user_metadata?.phone,
      user?.user_metadata?.whatsapp,
      user?.user_metadata?.whatsapp_number
    );
  }

  function getUserDisplayName(user = state.user) {
    return firstPresentValue(
      user?.displayName,
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim(),
      getUserStoreName(user),
      getUserEmail(user),
      'Vendor account'
    );
  }

  function getUserSubtitle(user = state.user) {
    return firstPresentValue(
      getUserEmail(user),
      user?.storeLink,
      getStoreLabelFromSlug(getUserSlug(user)),
      'Add your account email'
    );
  }

  function getStoreLabelFromSlug(slug) {
    return window.VendlyStores.buildDisplayStoreLink(slug || '');
  }

  function getStoreFromUser(user) {
    if (!user) return null;
    return window.VendlyStores.normalizeStoreRecord({
      ...(user.store || {}),
      id: firstPresentValue(user.storeId, user.store_id, user.store?.id, null),
      owner_id: firstPresentValue(user.id, user.store?.owner_id, null),
      name: getUserStoreName(user),
      slug: getUserSlug(user),
      whatsapp: getUserPhone(user),
      subscription_status: firstPresentValue(
        user.subscription_status,
        user.store?.subscription_status,
        user.user_metadata?.subscription_status,
        null
      ),
      subscription_plan: firstPresentValue(
        user.subscription_plan,
        user.store?.subscription_plan,
        user.user_metadata?.subscription_plan,
        null
      ),
      subscription_started_at: firstPresentValue(
        user.subscription_started_at,
        user.store?.subscription_started_at,
        user.user_metadata?.subscription_started_at,
        null
      ),
      subscription_expires_at: firstPresentValue(
        user.subscription_expires_at,
        user.store?.subscription_expires_at,
        user.user_metadata?.subscription_expires_at,
        null
      ),
      trial_started_at: firstPresentValue(
        user.trial_started_at,
        user.store?.trial_started_at,
        user.user_metadata?.trial_started_at,
        null
      ),
      trial_ends_at: firstPresentValue(
        user.trial_ends_at,
        user.store?.trial_ends_at,
        user.user_metadata?.trial_ends_at,
        null
      ),
      activated_at: firstPresentValue(
        user.activated_at,
        user.store?.activated_at,
        user.user_metadata?.activated_at,
        null
      )
    });
  }

  function getStoreLabel() {
    const resolvedSlug = state.store?.slug || getUserSlug();
    return resolvedSlug
      ? getStoreLabelFromSlug(resolvedSlug)
      : firstPresentValue(state.user?.storeLink, getStoreLabelFromSlug(''));
  }

  function getCanonicalStoreUrl() {
    const resolvedSlug = state.store?.slug || getUserSlug();
    return resolvedSlug
      ? window.VendlyStores.buildCanonicalStoreUrl(resolvedSlug)
      : firstPresentValue(state.user?.storeUrl, window.VendlyStores.buildCanonicalStoreUrl(''));
  }

  function getOpenStoreUrl() {
    const resolvedSlug = state.store?.slug || getUserSlug();
    const hostname = window.location.hostname || '';
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
      return window.VendlyStores.buildPreviewStoreUrl(resolvedSlug || '');
    }
    return getCanonicalStoreUrl();
  }

  function uniqueVisitorsCount(rows) {
    return new Set((rows || []).map(row => row.visitor_key).filter(Boolean)).size;
  }

  function buildSummaryCards(metrics) {
    return [
      {
        label: 'Total products',
        value: String(metrics.totalProducts),
        sub: `${metrics.liveProducts} live, ${metrics.hiddenProducts} hidden`,
        icon: 'box'
      },
      {
        label: 'Store views',
        value: String(metrics.totalViews),
        sub: metrics.viewsLast7Days > 0
          ? `${metrics.viewsLast7Days} in the last 7 days`
          : 'No visits in the last 7 days',
        icon: 'eye'
      },
      {
        label: 'Unique visitors',
        value: String(metrics.uniqueVisitors),
        sub: metrics.uniqueVisitors > 0
          ? 'Distinct browsers tracked'
          : 'No tracked visitors yet',
        icon: 'users'
      },
      {
        label: 'Latest visit',
        value: metrics.lastVisit ? formatRelativeTime(metrics.lastVisit) : 'None yet',
        sub: metrics.lastVisit ? formatDateTime(metrics.lastVisit) : 'Waiting for your first visitor',
        icon: 'clock'
      }
    ];
  }

  function renderSummaryCards(containerId, cards) {
    const container = byId(containerId);
    if (!container) return;

    container.innerHTML = cards.map(card => `
      <article class="summary-card">
        <div class="summary-card-header">
          <div class="summary-label">${escapeHtml(card.label)}</div>
          <div class="summary-icon">${iconSvg(card.icon)}</div>
        </div>
        <div class="summary-value">${escapeHtml(card.value)}</div>
        <div class="summary-sub">${escapeHtml(card.sub)}</div>
      </article>
    `).join('');
  }

  function buildMetrics() {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);
    last7Days.setHours(0, 0, 0, 0);

    const liveProducts = state.products.filter(product => product.status === 'live').length;
    const hiddenProducts = state.products.filter(product => product.status !== 'live').length;
    const viewsLast7Days = state.storeViews.filter(view => new Date(view.viewed_at) >= last7Days).length;
    const newOrders = state.orders.filter(order => order.status === 'new').length;
    const fulfilledOrders = state.orders.filter(order => order.status === 'fulfilled').length;
    const totalRevenue = state.orders
      .filter(order => order.status !== 'cancelled')
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    return {
      totalProducts: state.products.length,
      liveProducts,
      hiddenProducts,
      totalViews: state.storeViews.length,
      viewsLast7Days,
      uniqueVisitors: uniqueVisitorsCount(state.storeViews),
      lastVisit: state.storeViews[0]?.viewed_at || null,
      totalOrders: state.orders.length,
      newOrders,
      fulfilledOrders,
      totalRevenue
    };
  }

  function renderStoreBanner() {
    const bannerLink = byId('storeBannerLink');
    const bannerMeta = byId('storeBannerMeta');
    const bannerStatus = byId('storeStatusChip');
    const resolvedSlug = state.store?.slug || getUserSlug();
    const hasStoreLink = !!resolvedSlug;
    const canonicalStoreUrl = getCanonicalStoreUrl();

    if (bannerLink) {
      bannerLink.textContent = hasStoreLink ? getStoreLabel() : 'Choose a store name to generate your link';
      bannerLink.title = hasStoreLink ? getStoreLabel() : '';
    }
    if (bannerMeta) {
      bannerMeta.textContent = hasStoreLink
        ? (state.access?.message || 'Your storefront link updates as soon as your account is ready.')
        : 'Add or restore your store name and slug so customers can open your storefront.';
    }

    if (bannerStatus) {
      bannerStatus.textContent = state.access?.label || 'Store ready';
      bannerStatus.className = `status-chip ${state.access?.state || 'active'}`;
    }

    const copyBtn = byId('copyStoreLinkBtn');
    if (copyBtn) {
      copyBtn.disabled = !hasStoreLink;
      copyBtn.onclick = async () => {
        if (!hasStoreLink) {
          showToast('Choose a store link before copying it.', 'error');
          return;
        }

        try {
          await navigator.clipboard.writeText(canonicalStoreUrl);
          showToast('Store link copied to your clipboard.');
        } catch (_err) {
          showToast('Could not copy the store link right now.', 'error');
        }
      };
    }

    const openBtn = byId('openStoreBtn');
    if (openBtn) {
      if (hasStoreLink) {
        openBtn.href = getOpenStoreUrl();
        openBtn.removeAttribute('aria-disabled');
      } else {
        openBtn.href = '#';
        openBtn.setAttribute('aria-disabled', 'true');
      }
    }

    const topbarStorefrontBtn = byId('viewStorefrontBtn');
    if (topbarStorefrontBtn) {
      if (hasStoreLink) {
        topbarStorefrontBtn.href = getOpenStoreUrl();
      } else {
        topbarStorefrontBtn.href = '#';
      }
    }

    const sidebarStoreLink = byId('userStoreLink');
    if (sidebarStoreLink) {
      const subtitle = getUserSubtitle();
      sidebarStoreLink.textContent = subtitle;
      sidebarStoreLink.title = subtitle;
    }
  }

  function renderTopbar() {
    const meta = pageMeta[state.page] || pageMeta.dashboard;
    const pageEyebrow = byId('pageEyebrow');
    const pageTitle = byId('pageTitle');
    const pageSubtitle = byId('pageSubtitle');
    const primaryBtn = byId('topbarPrimaryBtn');

    if (pageEyebrow) pageEyebrow.textContent = meta.eyebrow;
    if (pageTitle) pageTitle.textContent = meta.title;
    if (pageSubtitle) pageSubtitle.textContent = meta.subtitle;

    if (primaryBtn) {
      primaryBtn.textContent = meta.primaryLabel;
      primaryBtn.href = meta.primaryHref;
      primaryBtn.style.display = 'inline-flex';
    }

    const userName = byId('userName');
    const userAvatar = byId('userAvatar');
    if (userName) {
      userName.textContent = getUserDisplayName();
      userName.title = userName.textContent;
    }
    if (userAvatar) userAvatar.textContent = state.user?.initials || buildInitials(getUserDisplayName());
  }

  function renderSidebarState() {
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === state.page);
    });

    const productCount = byId('sidebarProductCount');
    const orderCount = byId('sidebarOrderCount');
    if (productCount) productCount.textContent = String(state.products.length);
    if (orderCount) orderCount.textContent = String(state.orders.filter(order => order.status === 'new').length);
  }

  function renderActivationAlert() {
    const alert = byId('activationAlert');
    if (!alert) return;

    if (state.access?.active) {
      alert.innerHTML = '';
      alert.style.display = 'none';
      return;
    }

    alert.style.display = 'flex';
    alert.innerHTML = `
      <div>
        <strong>Store paused</strong>
        <p>${escapeHtml(state.access?.message || 'Activate your store to keep receiving orders.')}</p>
      </div>
      <a class="btn btn-outline btn-sm" href="activate.html">Activate now</a>
    `;
  }

  function renderQuickLinks(metrics) {
    const container = byId('quickLinks');
    if (!container) return;

    const cards = [
      {
        href: 'produc.html',
        icon: 'box',
        title: 'Products',
        copy: `${metrics.totalProducts} total products in your catalog`
      },
      {
        href: 'order.html',
        icon: 'order',
        title: 'Orders',
        copy: `${metrics.totalOrders} order${metrics.totalOrders === 1 ? '' : 's'} logged from WhatsApp checkout`
      },
      {
        href: 'analytics.html',
        icon: 'chart',
        title: 'Analytics',
        copy: `${metrics.totalViews} total store view${metrics.totalViews === 1 ? '' : 's'} tracked`
      },
      {
        href: 'accounts.html',
        icon: 'gear',
        title: 'Account',
        copy: state.access?.label || 'Manage store details and subscription status'
      }
    ];

    container.innerHTML = cards.map(card => `
      <a class="quick-link-card" href="${escapeHtml(card.href)}">
        <div class="quick-link-top">
          <div class="quick-link-icon">${iconSvg(card.icon)}</div>
          <div>${iconSvg('link')}</div>
        </div>
        <div class="quick-link-title">${escapeHtml(card.title)}</div>
        <div class="quick-link-copy">${escapeHtml(card.copy)}</div>
      </a>
    `).join('');
  }

  function renderDashboardStatus(metrics) {
    const container = byId('dashboardStoreHealth');
    if (!container) return;

    const expiresAt = state.store?.subscription_expires_at ? formatDateOnly(state.store.subscription_expires_at) : 'Not set';
    const daysLeft = Number.isFinite(Number(state.store?.days_left)) ? Number(state.store.days_left) : 0;
    container.innerHTML = `
      <div class="stack-list">
        <div class="mini-stat">
          <strong>${escapeHtml(state.access?.label || 'Store ready')}</strong>
          <span>${escapeHtml(state.access?.message || 'Your storefront link is ready to share.')}</span>
        </div>
        <div class="mini-stat">
          <strong>${escapeHtml(String(daysLeft))}</strong>
          <span>Subscription days left</span>
        </div>
        <div class="mini-stat">
          <strong>${escapeHtml(expiresAt)}</strong>
          <span>Subscription expiry date</span>
        </div>
        <div class="mini-stat">
          <strong>${formatMoney(metrics.totalRevenue)}</strong>
          <span>Tracked revenue from storefront orders</span>
        </div>
        <div class="mini-stat">
          <strong>${metrics.newOrders}</strong>
          <span>New orders still waiting for follow-up</span>
        </div>
      </div>
    `;
  }

  function productCardMarkup(product, actionsEnabled = true) {
    const isLive = product.status === 'live';
    return `
      <article class="product-card-admin" data-product-id="${escapeHtml(product.id)}">
        <div class="product-image-admin">
          ${product.image_url
            ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">`
            : iconSvg('image')}
        </div>
        <div class="product-body-admin">
          <div class="product-topline">
            <div class="product-name-admin">${escapeHtml(product.name)}</div>
            <span class="badge ${isLive ? 'live' : 'hidden'}">${isLive ? 'Live' : 'Hidden'}</span>
          </div>
          <div class="product-desc-admin">${escapeHtml(product.description || 'No description yet.')}</div>
          <div class="product-footer-admin">
            <div class="money">${escapeHtml(formatMoney(product.price))}</div>
            <div class="pill-note">${escapeHtml(formatRelativeTime(product.updated_at || product.created_at))}</div>
          </div>
          ${actionsEnabled
            ? `<div class="card-action-row">
                <button class="btn btn-outline btn-sm" type="button" data-action="edit-product" data-product-id="${escapeHtml(product.id)}">Edit</button>
                <button class="btn btn-outline btn-sm" type="button" data-action="toggle-product" data-product-id="${escapeHtml(product.id)}">${isLive ? 'Hide' : 'Make live'}</button>
                <button class="btn btn-light-danger btn-sm" type="button" data-action="delete-product" data-product-id="${escapeHtml(product.id)}">Delete</button>
              </div>`
            : `<div class="card-action-row">
                <a class="btn btn-outline btn-sm" href="produc.html">Manage in products</a>
              </div>`
          }
        </div>
      </article>
    `;
  }

  function renderProductCollection(containerId, products, emptyTitle, emptyText, actionsEnabled = true) {
    const container = byId(containerId);
    if (!container) return;

    if (!products.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>${escapeHtml(emptyTitle)}</strong>
          <div>${escapeHtml(emptyText)}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="product-grid-admin">${products.map(product => productCardMarkup(product, actionsEnabled)).join('')}</div>`;
  }

  function orderCardMarkup(order) {
    const itemRows = (order.items || []).map(item => `
      <div class="item-row">
        <div>
          <strong>${escapeHtml(item.name || 'Unnamed item')}</strong>
          <div class="order-meta">${escapeHtml(formatMoney(item.unit_price || item.total_price || 0))} each</div>
        </div>
        <div>${escapeHtml(`${item.quantity || 0} x`)}</div>
      </div>
    `).join('');

    return `
      <article class="order-card" data-order-id="${escapeHtml(order.id)}">
        <div class="order-top">
          <div>
            <div class="order-id">Order ${escapeHtml(order.id.slice(0, 8).toUpperCase())}</div>
            <div class="order-meta">${escapeHtml(formatDateTime(order.created_at))}</div>
            <div class="order-meta">${escapeHtml(order.item_count)} item${order.item_count === 1 ? '' : 's'} | ${escapeHtml(formatMoney(order.total_amount))}</div>
          </div>
          <span class="badge ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
        </div>
        <div class="item-list">${itemRows || '<div class="empty-state"><strong>No items saved</strong><div>This order did not include line items.</div></div>'}</div>
        <div class="order-actions">
          <button class="btn btn-outline btn-sm" type="button" data-action="mark-order" data-order-id="${escapeHtml(order.id)}" data-status="new">Mark new</button>
          <button class="btn btn-outline btn-sm" type="button" data-action="mark-order" data-order-id="${escapeHtml(order.id)}" data-status="fulfilled">Mark fulfilled</button>
          <button class="btn btn-outline btn-sm" type="button" data-action="mark-order" data-order-id="${escapeHtml(order.id)}" data-status="cancelled">Cancel</button>
          ${order.whatsapp_url
            ? `<a class="btn btn-primary btn-sm" href="${escapeHtml(order.whatsapp_url)}" target="_blank" rel="noopener">Open WhatsApp</a>`
            : ''}
        </div>
      </article>
    `;
  }

  function renderOrderCollection(containerId, orders, emptyTitle, emptyText) {
    const container = byId(containerId);
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>${escapeHtml(emptyTitle)}</strong>
          <div>${escapeHtml(emptyText)}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="table-list">${orders.map(orderCardMarkup).join('')}</div>`;
  }

  function renderDashboard(metrics) {
    renderSummaryCards('dashboardStats', buildSummaryCards(metrics));
    renderQuickLinks(metrics);
    renderDashboardStatus(metrics);

    const recentProducts = [...state.products].slice(0, 4);
    renderProductCollection(
      'dashboardProducts',
      recentProducts,
      'No products yet',
      'Add your first product and your storefront will be ready for customers.',
      false
    );

    const recentOrders = [...state.orders].slice(0, 4);
    renderOrderCollection(
      'dashboardOrders',
      recentOrders,
      'No orders yet',
      'Orders will appear here as soon as shoppers send them to WhatsApp from your store.'
    );
  }

  function renderProductForm() {
    const preview = byId('productPreview');
    if (!preview) return;

    preview.innerHTML = state.productPreviewUrl
      ? `<img src="${escapeHtml(state.productPreviewUrl)}" alt="Product preview">`
      : iconSvg('image');

    const formTitle = byId('productFormTitle');
    const formNote = byId('productFormNote');
    const saveBtn = byId('saveProductBtn');
    const cancelBtn = byId('cancelEditProductBtn');

    if (formTitle) formTitle.textContent = state.productFormMode === 'edit' ? 'Edit product' : 'Add a new product';
    if (formNote) formNote.textContent = state.productFormMode === 'edit'
      ? 'Update the details below and save when you are ready.'
      : 'Upload an image, set the price, and publish it directly to your storefront.';
    if (saveBtn) saveBtn.textContent = state.productFormMode === 'edit' ? 'Save changes' : 'Save product';
    if (cancelBtn) cancelBtn.style.display = state.productFormMode === 'edit' ? 'inline-flex' : 'none';
  }

  function populateProductForm(product) {
    state.productFormMode = product ? 'edit' : 'create';
    state.productFile = null;
    state.productPreviewUrl = product?.image_url || '';

    byId('productId').value = product?.id || '';
    byId('productName').value = product?.name || '';
    byId('productPrice').value = product?.price || '';
    byId('productDescription').value = product?.description || '';
    byId('productStatus').value = product?.status || 'live';
    byId('productImage').value = '';
    renderProductForm();
  }

  function renderProductsPage() {
    const filter = byId('productFilter');
    const activeFilter = filter ? filter.value : 'all';
    const products = state.products.filter(product => {
      if (activeFilter === 'all') return true;
      return product.status === activeFilter;
    });

    renderProductCollection(
      'productsGrid',
      products,
      'No products match this view',
      activeFilter === 'all'
        ? 'Add your first item to start selling through your storefront.'
        : 'Try another filter or change a product status.'
    );

    const count = byId('productsCount');
    if (count) count.textContent = `${products.length} item${products.length === 1 ? '' : 's'} shown`;
    renderProductForm();
  }

  function renderOrdersPage(metrics) {
    const cards = [
      {
        label: 'Total orders',
        value: String(metrics.totalOrders),
        sub: 'Tracked from storefront WhatsApp checkouts',
        icon: 'order'
      },
      {
        label: 'New orders',
        value: String(metrics.newOrders),
        sub: 'Still waiting for follow-up',
        icon: 'clock'
      },
      {
        label: 'Fulfilled orders',
        value: String(metrics.fulfilledOrders),
        sub: 'Marked complete in the portal',
        icon: 'box'
      },
      {
        label: 'Tracked revenue',
        value: formatMoney(metrics.totalRevenue),
        sub: 'Cancelled orders excluded',
        icon: 'chart'
      }
    ];

    renderSummaryCards('ordersStats', cards);

    const filter = byId('orderStatusFilter');
    const activeFilter = filter ? filter.value : 'all';
    const filteredOrders = state.orders.filter(order => activeFilter === 'all' || order.status === activeFilter);

    renderOrderCollection(
      'ordersList',
      filteredOrders,
      'No orders match this filter',
      activeFilter === 'all'
        ? 'Orders placed through your storefront will show up here.'
        : 'Try another status filter to see more orders.'
    );
  }

  function getBestSellingProducts() {
    const tally = new Map();

    state.orders
      .filter(order => order.status !== 'cancelled')
      .forEach(order => {
        order.items.forEach(item => {
          const key = String(item.product_id || item.name || '').trim();
          if (!key) return;
          const previous = tally.get(key) || {
            productId: item.product_id || '',
            name: item.name || 'Unnamed product',
            quantity: 0,
            revenue: 0
          };
          previous.quantity += Number(item.quantity || 0);
          previous.revenue += Number(item.total_price || 0);
          tally.set(key, previous);
        });
      });

    return Array.from(tally.values()).sort((left, right) => right.quantity - left.quantity);
  }

  function getMostViewedProducts() {
    const tally = new Map();

    state.productViews.forEach(view => {
      const product = getProductFromState(view.product_id);
      const key = String(view.product_id || product?.id || '').trim();
      if (!key) return;
      const previous = tally.get(key) || {
        productId: key,
        name: product?.name || 'Unnamed product',
        views: 0
      };
      previous.views += 1;
      tally.set(key, previous);
    });

    return Array.from(tally.values()).sort((left, right) => right.views - left.views);
  }

  function getTrafficByDay() {
    const rows = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let index = 6; index >= 0; index -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - index);
      const key = day.toISOString().slice(0, 10);
      const count = state.storeViews.filter(view => String(view.viewed_at || '').slice(0, 10) === key).length;
      rows.push({
        day: key,
        label: shortDayLabel(day),
        count
      });
    }

    return rows;
  }

  function renderRankingList(containerId, rows, formatter) {
    const container = byId(containerId);
    if (!container) return;

    if (!rows.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>Nothing to show yet</strong>
          <div>Once shoppers visit your store and place orders, the rankings will update here.</div>
        </div>
      `;
      return;
    }

    const peak = Math.max(...rows.map(row => formatter(row).value), 1);
    container.innerHTML = `
      <div class="ranking-list">
        ${rows.map(row => {
          const view = formatter(row);
          const width = Math.max(8, Math.round((view.value / peak) * 100));
          return `
            <div class="ranking-row">
              <div class="ranking-top">
                <div class="ranking-name">${escapeHtml(view.title)}</div>
                <div>${escapeHtml(view.valueLabel)}</div>
              </div>
              <div class="ranking-sub">${escapeHtml(view.subtitle)}</div>
              <div class="progress-track"><div class="progress-fill" style="width:${width}%"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderTrafficRows(containerId, rows) {
    const container = byId(containerId);
    if (!container) return;

    if (!rows.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No traffic history yet</strong>
          <div>We will start plotting visits as soon as your store gets traffic.</div>
        </div>
      `;
      return;
    }

    const peak = Math.max(...rows.map(row => row.count), 1);
    container.innerHTML = `
      <div class="ranking-list">
        ${rows.map(row => {
          const width = row.count === 0 ? 8 : Math.max(8, Math.round((row.count / peak) * 100));
          return `
            <div class="traffic-row">
              <div class="traffic-top">
                <div class="ranking-name">${escapeHtml(row.label)}</div>
                <div>${escapeHtml(String(row.count))} view${row.count === 1 ? '' : 's'}</div>
              </div>
              <div class="traffic-sub">${escapeHtml(formatDateOnly(row.day))}</div>
              <div class="progress-track"><div class="progress-fill" style="width:${width}%"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderAnalyticsPage(metrics) {
    const cards = [
      {
        label: 'Store views',
        value: String(metrics.totalViews),
        sub: `${metrics.viewsLast7Days} in the last 7 days`,
        icon: 'eye'
      },
      {
        label: 'Unique visitors',
        value: String(metrics.uniqueVisitors),
        sub: 'Distinct browsers across tracked visits',
        icon: 'users'
      },
      {
        label: 'Tracked orders',
        value: String(metrics.totalOrders),
        sub: 'Orders sent from the storefront',
        icon: 'order'
      },
      {
        label: 'Revenue tracked',
        value: formatMoney(metrics.totalRevenue),
        sub: 'Based on non-cancelled orders',
        icon: 'chart'
      }
    ];

    renderSummaryCards('analyticsStats', cards);
    renderRankingList('bestSellingList', getBestSellingProducts(), row => ({
      title: row.name,
      value: row.quantity,
      valueLabel: `${row.quantity} sold`,
      subtitle: `${formatMoney(row.revenue)} in tracked revenue`
    }));
    renderRankingList('mostViewedList', getMostViewedProducts(), row => ({
      title: row.name,
      value: row.views,
      valueLabel: `${row.views} view${row.views === 1 ? '' : 's'}`,
      subtitle: 'Tracked when the product entered a shopper viewport'
    }));
    renderTrafficRows('trafficList', getTrafficByDay());
  }

  function renderAccountPage(metrics) {
    renderSummaryCards('accountStats', [
      {
        label: 'Store status',
        value: state.access?.label || 'Store ready',
        sub: state.access?.message || 'Your store is configured.',
        icon: 'link'
      },
      {
        label: 'Days left',
        value: String(Number(state.store?.days_left || 0)),
        sub: state.access?.active ? 'Remaining subscription access' : 'No active subscription yet',
        icon: 'clock'
      },
      {
        label: 'Storefront visits',
        value: String(metrics.totalViews),
        sub: 'Tracked across all shoppers',
        icon: 'eye'
      },
      {
        label: 'Products',
        value: String(metrics.totalProducts),
        sub: `${metrics.liveProducts} live right now`,
        icon: 'box'
      }
    ]);

    const storeLinkLabel = byId('accountStoreLink');
    if (storeLinkLabel) storeLinkLabel.value = getStoreLabel();

    byId('accountFirstName').value = state.user?.firstName || '';
    byId('accountLastName').value = state.user?.lastName || '';
    byId('accountEmail').value = getUserEmail();
    byId('accountStoreName').value = state.store?.name || '';
    byId('accountWhatsapp').value = state.store?.whatsapp || '';
    byId('accountSlug').value = state.store?.slug || '';

    const statusBox = byId('accountStatusBox');
    if (statusBox) {
      const planLabel = state.store?.subscription_plan
        ? `${state.store.subscription_plan[0].toUpperCase()}${state.store.subscription_plan.slice(1)} plan`
        : 'No active plan';
      statusBox.innerHTML = `
        <div class="info-stack">
          <div class="mini-stat">
            <strong>${escapeHtml(state.access?.label || 'Store ready')}</strong>
            <span>${escapeHtml(state.access?.message || 'Your storefront is ready to share.')}</span>
          </div>
          <div class="mini-stat">
            <strong>${escapeHtml(planLabel)}</strong>
            <span>Current subscription plan</span>
          </div>
          <div class="mini-stat">
            <strong>${escapeHtml(formatDateOnly(state.store?.subscription_expires_at))}</strong>
            <span>Subscription expires on</span>
          </div>
          <div class="mini-stat">
            <strong>${escapeHtml(String(Number(state.store?.days_left || 0)))}</strong>
            <span>Days left</span>
          </div>
        </div>
      `;
    }
  }

  function resetProductForm() {
    populateProductForm(null);
  }

  function extractStoragePath(publicUrl) {
    if (!publicUrl || typeof publicUrl !== 'string') return null;
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0]);
  }

  async function uploadProductImage(ownerId, imageBlob) {
    const client = await getClient();
    if (!client || !imageBlob) return null;

    const fileName = `${crypto.randomUUID()}.webp`;
    const storagePath = `${ownerId}/${fileName}`;
    const { error } = await client.storage.from(STORAGE_BUCKET).upload(storagePath, imageBlob, {
      cacheControl: '3600',
      contentType: 'image/webp',
      upsert: false
    });

    if (error) throw error;
    const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return {
      path: storagePath,
      publicUrl: data?.publicUrl || ''
    };
  }

  async function removeProductImage(publicUrl) {
    const client = await getClient();
    if (!client || !publicUrl) return;
    const storagePath = extractStoragePath(publicUrl);
    if (!storagePath) return;
    await client.storage.from(STORAGE_BUCKET).remove([storagePath]);
  }

  async function loadProducts() {
    const client = await getClient();
    if (!client || !state.user?.id) {
      state.products = [];
      return;
    }

    try {
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('owner_id', state.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      state.products = (data || []).map(normalizeProduct);
    } catch (err) {
      console.warn('Failed to load products', err.message || err);
      state.products = [];
    }
  }

  async function loadOrders() {
    const client = await getClient();
    if (!client || !state.user?.id) {
      state.orders = [];
      return;
    }

    try {
      const { data, error } = await client
        .from('orders')
        .select('*')
        .eq('owner_id', state.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      state.orders = (data || []).map(normalizeOrder);
    } catch (err) {
      console.warn('Failed to load orders', err.message || err);
      state.orders = [];
    }
  }

  async function loadStoreViews() {
    const client = await getClient();
    if (!client || !state.user?.id) {
      state.storeViews = [];
      return;
    }

    try {
      const { data, error } = await client
        .from('store_views')
        .select('*')
        .eq('owner_id', state.user.id)
        .order('viewed_at', { ascending: false });
      if (error) throw error;
      state.storeViews = data || [];
    } catch (err) {
      console.warn('Failed to load store views', err.message || err);
      state.storeViews = [];
    }
  }

  async function loadProductViews() {
    const client = await getClient();
    if (!client || !state.user?.id) {
      state.productViews = [];
      return;
    }

    try {
      const { data, error } = await client
        .from('product_views')
        .select('*')
        .eq('owner_id', state.user.id)
        .order('viewed_at', { ascending: false });
      if (error) throw error;
      state.productViews = data || [];
    } catch (err) {
      console.warn('Failed to load product views', err.message || err);
      state.productViews = [];
    }
  }

  async function saveProduct(event) {
    event.preventDefault();

    const name = byId('productName').value.trim();
    const price = Number(byId('productPrice').value || 0);
    const description = byId('productDescription').value.trim();
    const status = byId('productStatus').value;
    const editingId = byId('productId').value;

    if (!name) {
      showToast('Enter a product name before saving.', 'error');
      return;
    }

    if (!price || price <= 0) {
      showToast('Enter a valid price before saving.', 'error');
      return;
    }

    const client = await getClient();
    if (!client || !state.user?.id) {
      showToast('A live Supabase connection is required to save products.', 'error');
      return;
    }

    const saveBtn = byId('saveProductBtn');
    const restoreSaveButton = () => {
      if (!saveBtn) return;
      saveBtn.disabled = false;
      saveBtn.textContent = state.productFormMode === 'edit' ? 'Save changes' : 'Save product';
    };

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = state.productFile ? 'Processing image...' : (state.productFormMode === 'edit' ? 'Saving changes...' : 'Saving product...');
    }

    const basePayload = {
      name,
      description,
      price,
      status,
      owner_id: state.user?.id || null
    };

    try {
      let imageAsset = null;
      const existingProduct = getProductFromState(editingId);
      if (state.productFile && state.user?.id) {
        if (!isAcceptedImageFile(state.productFile)) {
          showToast('Please select a valid image file.', 'error');
          return;
        }

        let imageFileToUpload;
        try {
          imageFileToUpload = await convertToWebP(state.productFile, PRODUCT_IMAGE_WEBP_QUALITY);
        } catch (conversionError) {
          console.error('Image conversion error:', conversionError);
          showToast('Could not process the image. Please try a different file.', 'error');
          return;
        }

        if (imageFileToUpload.type !== 'image/webp') {
          showToast('Could not process the image. Please try a different file.', 'error');
          return;
        }

        if (saveBtn) saveBtn.textContent = 'Uploading...';

        try {
          imageAsset = await uploadProductImage(state.user.id, imageFileToUpload);
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          showToast('Image upload failed. Please try again.', 'error');
          return;
        }
      }

      if (editingId) {
        const payload = {
          ...basePayload,
          image_url: imageAsset?.publicUrl || existingProduct?.image_url || null
        };
        const { error } = await client.from('products').update(payload).eq('id', editingId);
        if (error) throw error;

        if (imageAsset?.publicUrl && existingProduct?.image_url && existingProduct.image_url !== imageAsset.publicUrl) {
          await removeProductImage(existingProduct.image_url);
        }
      } else {
        const payload = {
          ...basePayload,
          image_url: imageAsset?.publicUrl || null
        };
        const { error } = await client.from('products').insert([payload]);
        if (error) throw error;
      }

      showToast(editingId ? 'Product updated.' : 'Product added to your store.');
      resetProductForm();
      await loadProducts();
      renderAll();
    } catch (err) {
      console.warn('Product save failed', err);
      showToast(err.message || 'Could not save this product right now.', 'error');
    } finally {
      restoreSaveButton();
    }
  }

  async function toggleProductStatus(productId) {
    const product = getProductFromState(productId);
    if (!product) return;

    const nextStatus = product.status === 'live' ? 'hidden' : 'live';
    const client = await getClient();
    if (!client || !state.user?.id) {
      showToast('A live Supabase connection is required to update products.', 'error');
      return;
    }

    try {
      const { error } = await client.from('products').update({ status: nextStatus }).eq('id', productId);
      if (error) throw error;

      showToast(`"${product.name}" is now ${nextStatus}.`);
      await loadProducts();
      renderAll();
    } catch (err) {
      showToast(err.message || 'Could not update the product status.', 'error');
    }
  }

  async function deleteProduct(productId) {
    const product = getProductFromState(productId);
    if (!product) return;
    if (!window.confirm(`Delete "${product.name}" from your store?`)) return;

    const client = await getClient();
    if (!client || !state.user?.id) {
      showToast('A live Supabase connection is required to delete products.', 'error');
      return;
    }
    try {
      const { error } = await client.from('products').delete().eq('id', productId);
      if (error) throw error;
      if (product.image_url) await removeProductImage(product.image_url);

      showToast('Product deleted.');
      if (byId('productId').value === productId) resetProductForm();
      await loadProducts();
      renderAll();
    } catch (err) {
      showToast(err.message || 'Could not delete this product.', 'error');
    }
  }

  async function updateOrderStatus(orderId, nextStatus) {
    const client = await getClient();
    if (!client || !state.user?.id) {
      showToast('A live Supabase connection is required to update orders.', 'error');
      return;
    }
    try {
      const { error } = await client.from('orders').update({ status: nextStatus }).eq('id', orderId);
      if (error) throw error;

      showToast(`Order marked ${nextStatus}.`);
      await loadOrders();
      renderAll();
    } catch (err) {
      showToast(err.message || 'Could not update that order.', 'error');
    }
  }

  async function saveAccount(event) {
    event.preventDefault();

    const firstName = byId('accountFirstName').value.trim();
    const lastName = byId('accountLastName').value.trim();
    const storeName = byId('accountStoreName').value.trim();
    const whatsapp = byId('accountWhatsapp').value.trim();

    if (!storeName) {
      showToast('Enter a store name before saving.', 'error');
      return;
    }

    const client = await getClient();
    if (!client || !state.user?.id) {
      showToast('A live Supabase connection is required to save account changes.', 'error');
      return;
    }
    try {
      const profilePayload = {
        id: state.user.id,
        first_name: firstName || null,
        last_name: lastName || null
      };
      await client.from('profiles').upsert([profilePayload], { onConflict: 'id' });

      const storePayload = {
        id: state.store?.id || null,
        owner_id: state.user.id,
        name: storeName,
        slug: state.store?.slug || '',
        whatsapp: whatsapp || null,
        subscription_status: state.store?.subscription_status || null,
        subscription_plan: state.store?.subscription_plan || null,
        subscription_started_at: state.store?.subscription_started_at || null,
        subscription_expires_at: state.store?.subscription_expires_at || null,
        trial_started_at: state.store?.trial_started_at || null,
        trial_ends_at: state.store?.trial_ends_at || null,
        activated_at: state.store?.activated_at || null
      };

      const savedStore = await window.VendlyStores.upsertStore(client, storePayload);
      if (!savedStore) {
        await client.from('stores').upsert([{
          owner_id: state.user.id,
          name: storeName,
          slug: state.store?.slug || '',
          whatsapp: whatsapp || null
        }], { onConflict: 'slug' });
      }

      const mergedUser = {
        ...state.user,
        firstName,
        lastName,
        storeName,
        phone: whatsapp
      };
      state.user = await window.VendlyAuth.setUser(mergedUser);
      state.store = getStoreFromUser(state.user);
      state.access = window.VendlyStores.getAccessState(state.store);
      renderAll();
      showToast('Account details saved.');
    } catch (err) {
      showToast(err.message || 'Could not save account changes.', 'error');
    }
  }

  async function deleteMyAccount() {
    if (!window.confirm('Delete your account, store, products, and analytics history?')) return;

    const client = await getClient();
    if (!client) {
      showToast('Account deletion needs a live Supabase connection.', 'error');
      return;
    }

    try {
      const { error } = await client.rpc('delete_my_account');
      if (error) throw error;
      await window.VendlyAuth.clearUser();
      showToast('Your account has been deleted.');
      window.setTimeout(() => window.VendlyNav.go('signup'), 900);
    } catch (err) {
      showToast(err.message || 'Could not delete your account.', 'error');
    }
  }

  function wireShell() {
    const toggle = byId('sidebarToggle');
    const backdrop = byId('sidebarBackdrop');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-open');
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        document.body.classList.remove('sidebar-open');
      });
    }
  }

  function wirePageEvents() {
    document.body.addEventListener('click', event => {
      const productAction = event.target.closest('[data-action="edit-product"], [data-action="toggle-product"], [data-action="delete-product"]');
      if (productAction) {
        const productId = productAction.dataset.productId;
        if (productAction.dataset.action === 'edit-product') populateProductForm(getProductFromState(productId));
        if (productAction.dataset.action === 'toggle-product') toggleProductStatus(productId);
        if (productAction.dataset.action === 'delete-product') deleteProduct(productId);
        return;
      }

      const orderAction = event.target.closest('[data-action="mark-order"]');
      if (orderAction) {
        updateOrderStatus(orderAction.dataset.orderId, orderAction.dataset.status);
        return;
      }

      if (event.target.closest('#cancelEditProductBtn')) {
        resetProductForm();
      }
    });

    const productForm = byId('productForm');
    if (productForm) productForm.addEventListener('submit', saveProduct);

    const productImage = byId('productImage');
    if (productImage) {
      productImage.addEventListener('change', event => {
        const file = event.target.files?.[0];
        state.productFile = file || null;
        state.productPreviewUrl = file ? URL.createObjectURL(file) : '';
        renderProductForm();
      });
    }

    const productFilter = byId('productFilter');
    if (productFilter) {
      productFilter.addEventListener('change', () => renderProductsPage());
    }

    const accountForm = byId('accountForm');
    if (accountForm) accountForm.addEventListener('submit', saveAccount);

    const deleteAccountBtn = byId('deleteAccountBtn');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', deleteMyAccount);

    const orderStatusFilter = byId('orderStatusFilter');
    if (orderStatusFilter) {
      orderStatusFilter.addEventListener('change', () => renderOrdersPage(buildMetrics()));
    }
  }

  async function loadAllData() {
    await Promise.all([
      loadProducts(),
      loadOrders(),
      loadStoreViews(),
      loadProductViews()
    ]);
  }

  function renderAll() {
    const metrics = buildMetrics();
    renderTopbar();
    renderSidebarState();
    renderStoreBanner();
    renderActivationAlert();

    if (state.page === 'dashboard') renderDashboard(metrics);
    if (state.page === 'products') renderProductsPage(metrics);
    if (state.page === 'orders') renderOrdersPage(metrics);
    if (state.page === 'analytics') renderAnalyticsPage(metrics);
    if (state.page === 'account') renderAccountPage(metrics);
  }

  async function init() {
    state.page = getCurrentPage();
    wireShell();
    wirePageEvents();

    state.user = window.VendlyAuth.getUser?.()
      || window.VendlyAuth.getCachedUser?.()
      || null;
    state.store = getStoreFromUser(state.user);
    state.access = window.VendlyStores.getAccessState(state.store || {});
    renderAll();

    await window.VendlyAuth.restoreSession().catch(() => false);
    state.user = await window.VendlyAuth.refreshUser().catch(() => window.VendlyAuth.getUser()) || window.VendlyAuth.getUser();
    state.store = getStoreFromUser(state.user);
    state.access = window.VendlyStores.getAccessState(state.store || {});
    await loadAllData();

    if (state.page === 'products') resetProductForm();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
