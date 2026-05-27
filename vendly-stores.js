(function () {
  const BASE_DOMAIN = 'vendly-snowy.vercel.app';

  function normalizeSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function buildDisplayStoreLink(slug) {
    if (!slug) return BASE_DOMAIN;
    return `${BASE_DOMAIN}/${slug}`;
  }

  function buildCanonicalStoreUrl(slug) {
    if (!slug) return `https://${BASE_DOMAIN}`;
    return `https://${BASE_DOMAIN}/${slug}`;
  }

  function buildPreviewStoreUrl(slug) {
    if (!slug) return '/storefront.html';
    return `/storefront.html?slug=${encodeURIComponent(slug)}`;
  }

  function normalizeStoreRecord(store) {
    return {
      id: store?.id || null,
      owner_id: store?.owner_id || null,
      name: store?.name || '',
      slug: normalizeSlug(store?.slug || ''),
      whatsapp: store?.whatsapp || store?.phone || '',
      subscription_status: store?.subscription_status || null,
      subscription_plan: store?.subscription_plan || null,
      subscription_started_at: store?.subscription_started_at || null,
      subscription_expires_at: store?.subscription_expires_at || null,
      trial_started_at: store?.trial_started_at || null,
      trial_ends_at: store?.trial_ends_at || null,
      activated_at: store?.activated_at || null,
      days_left: store?.days_left || 0
    };
  }

  function getAccessState(store) {
    if (!store || !store.slug) {
      return {
        active: false,
        state: 'inactive',
        label: 'Not set up',
        message: 'Complete your store setup to go live.'
      };
    }
    const status = store.subscription_status;
    if (status === 'active') {
      return {
        active: true,
        state: 'active',
        label: 'Store active',
        message: 'Your storefront is live and accepting orders.'
      };
    }
    if (status === 'trial') {
      return {
        active: true,
        state: 'trial',
        label: 'Free trial',
        message: 'You are on a free trial. Activate to keep access.'
      };
    }
    if (store.activated_at) {
      return {
        active: true,
        state: 'active',
        label: 'Store active',
        message: 'Your storefront is live.'
      };
    }
    return {
      active: false,
      state: 'inactive',
      label: 'Not activated',
      message: 'Activate your store so customers can reach it.'
    };
  }

  async function upsertStore(client, storePayload) {
    try {
      const { data, error } = await client
        .from('stores')
        .upsert([storePayload], { onConflict: 'owner_id' })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (err) {
      console.warn('upsertStore failed', err.message || err);
      return null;
    }
  }

  window.VendlyStores = {
    normalizeSlug,
    buildDisplayStoreLink,
    buildCanonicalStoreUrl,
    buildPreviewStoreUrl,
    normalizeStoreRecord,
    getAccessState,
    upsertStore
  };
})();
