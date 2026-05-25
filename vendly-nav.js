/* ============================================================
   vendly-nav.js
   Drop this file in your vendly/ folder and add this line
   to the <head> of every HTML file:

     <script src="vendly-nav.js"></script>

   That's it. Navigation, auth guards, and active-link
   highlighting all work automatically.
   ============================================================ */


/* ── Page map ─────────────────────────────────────────────── */
const PAGES = {
  landing:    'index.html',
  login:      'login.html',
  signup:     'signup.html',
  dashboard:  'dashboard.html',
  storefront: 'storefront.html',
};

/* ── Auth state (swap this out for Supabase later) ────────── */
const Auth = {
  // Returns true if a user session exists
  isLoggedIn() {
    return !!localStorage.getItem('vendly_user');
  },

  // Call this on successful login / signup
  // Pass the user object from Supabase: Auth.setUser(session.user)
  setUser(user) {
    localStorage.setItem('vendly_user', JSON.stringify(user));
  },

  // Call this on logout
  clearUser() {
    localStorage.removeItem('vendly_user');
  },

  // Returns the stored user object (or null)
  getUser() {
    const raw = localStorage.getItem('vendly_user');
    return raw ? JSON.parse(raw) : null;
  },
};

/* ── Navigation helpers ────────────────────────────────────── */
const Nav = {
  go(page) {
    const path = PAGES[page];
    if (!path) { console.warn(`Vendly Nav: unknown page "${page}"`); return; }
    window.location.href = path;
  },

  // Go back in browser history (or fall back to a named page)
  back(fallbackPage = 'landing') {
    if (document.referrer) {
      history.back();
    } else {
      Nav.go(fallbackPage);
    }
  },

  // Returns the current page key e.g. 'login'
  current() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    return Object.keys(PAGES).find(k => PAGES[k] === file) || null;
  },
};

/* ── Auth guards ───────────────────────────────────────────── */
// Pages only logged-IN users can see
const PROTECTED = ['dashboard'];

// Pages only logged-OUT users should see (redirect away if already in)
const AUTH_ONLY  = ['login', 'signup'];

function runGuards() {
  const page = Nav.current();
  if (!page) return;

  if (PROTECTED.includes(page) && !Auth.isLoggedIn()) {
    Nav.go('login');
    return;
  }

  if (AUTH_ONLY.includes(page) && Auth.isLoggedIn()) {
    Nav.go('dashboard');
    return;
  }
}

/* ── Wire up any element with data-nav="pageName" ─────────── */
// Example: <button data-nav="dashboard">Go to Dashboard</button>
function wireNavAttributes() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      Nav.go(el.dataset.nav);
    });
  });
}

/* ── Wire logout buttons ───────────────────────────────────── */
// Example: <button data-logout>Log out</button>
function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', () => {
      Auth.clearUser();
      Nav.go('login');
    });
  });
}

/* ── Run everything once DOM is ready ─────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  runGuards();
  wireNavAttributes();
  wireLogout();
});

/* ── Export for inline use ─────────────────────────────────── */
// So your other scripts can call:  Nav.go('dashboard')  or  Auth.setUser(u)
window.VendlyNav  = Nav;
window.VendlyAuth = Auth;
