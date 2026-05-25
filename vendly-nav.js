/* ============================================================
   vendly-nav.js
   Navigation helpers plus shared auth/session utilities.
   ============================================================ */

const PAGES = {
  landing: 'index.html',
  login: 'login.html',
  signup: 'signup.html',
  dashboard: 'dashboard.html',
  storefront: 'storefront.html',
};

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

const Auth = {
  isLoggedIn() {
    return !!Auth.getUser()?.id;
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
    const enriched = {
      ...user,
      firstName: user.firstName || metadata.firstName || metadata.first_name || '',
      lastName: user.lastName || metadata.lastName || metadata.last_name || '',
      storeName: user.storeName || metadata.storeName || '',
      slug: user.slug || metadata.slug || '',
      phone: user.phone || metadata.phone || metadata.whatsapp || '',
      storeId: user.storeId || metadata.storeId || null,
    };

    const client = await Auth.getClient().catch(() => null);
    if (client && enriched.id) {
      try {
        const [{ data: profile }, { data: store }] = await Promise.all([
          client.from('profiles').select('first_name, last_name').eq('id', enriched.id).maybeSingle(),
          client.from('stores').select('id, name, slug, whatsapp').eq('owner_id', enriched.id).maybeSingle()
        ]);

        if (profile) {
          enriched.firstName = profile.first_name || enriched.firstName;
          enriched.lastName = profile.last_name || enriched.lastName;
        }

        if (store) {
          enriched.storeId = store.id;
          enriched.storeName = store.name || enriched.storeName;
          enriched.slug = store.slug || enriched.slug;
          enriched.phone = store.whatsapp || enriched.phone;
        }

        const needsProfile = !profile && (enriched.firstName || enriched.lastName);
        if (needsProfile) {
          await client.from('profiles').upsert([{
            id: enriched.id,
            first_name: enriched.firstName || null,
            last_name: enriched.lastName || null,
          }], { onConflict: 'id' });
        }

        const needsStore = !store && enriched.storeName && enriched.slug;
        if (needsStore) {
          const { data: insertedStore } = await client.from('stores').upsert([{
            owner_id: enriched.id,
            name: enriched.storeName,
            slug: enriched.slug,
            whatsapp: enriched.phone || null,
          }], { onConflict: 'slug' }).select('id, name, slug, whatsapp').maybeSingle();

          if (insertedStore) {
            enriched.storeId = insertedStore.id;
            enriched.storeName = insertedStore.name || enriched.storeName;
            enriched.slug = insertedStore.slug || enriched.slug;
            enriched.phone = insertedStore.whatsapp || enriched.phone;
          }
        }
      } catch (err) {
        console.warn('Could not enrich user context', err.message || err);
      }
    }

    const displayName = [enriched.firstName, enriched.lastName].filter(Boolean).join(' ').trim()
      || enriched.storeName
      || enriched.email
      || 'Vendor';

    enriched.displayName = displayName;
    enriched.initials = buildInitials(displayName);
    return enriched;
  },

  async restoreSession() {
    const client = await Auth.getClient().catch(() => null);
    if (!client) return false;

    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.warn('Supabase session restore failed', error.message);
        return false;
      }

      const user = data?.session?.user;
      if (!user) {
        localStorage.removeItem('vendly_user');
        return false;
      }

      await Auth.setUser(user);
      return true;
    } catch (err) {
      console.warn('Supabase session restore error', err);
      return false;
    }
  },

  async setUser(user) {
    const enriched = await Auth.enrichUser(user);
    localStorage.setItem('vendly_user', JSON.stringify(enriched));
    return enriched;
  },

  async refreshUser() {
    const current = Auth.getUser();
    if (!current?.id) return null;
    return Auth.setUser(current);
  },

  async clearUser() {
    const client = await Auth.getClient().catch(() => null);
    if (client) {
      try {
        await client.auth.signOut();
      } catch (_err) {
        // ignore sign-out failures
      }
    }
    localStorage.removeItem('vendly_user');
  },

  getUser() {
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
    window.location.href = path;
  },

  back(fallbackPage = 'landing') {
    if (document.referrer) {
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

const PROTECTED = ['dashboard'];
const AUTH_ONLY = ['login', 'signup'];

function runGuards() {
  const page = Nav.current();
  if (!page) return;

  if (PROTECTED.includes(page) && !Auth.isLoggedIn()) {
    Nav.go('login');
    return;
  }

  if (AUTH_ONLY.includes(page) && Auth.isLoggedIn()) {
    Nav.go('dashboard');
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

function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', async () => {
      await Auth.clearUser();
      Nav.go('login');
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.restoreSession();
  runGuards();
  wireNavAttributes();
  wireLogout();
});

window.VendlyNav = Nav;
window.VendlyAuth = Auth;
