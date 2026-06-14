/* Supabase client initializer - fetches config at runtime */
(function () {
  let resolveClient;
  let rejectClient;

  window.supabaseReady = new Promise((resolve, reject) => {
    resolveClient = resolve;
    rejectClient = reject;
  });

  window.waitForSupabaseClient = async function (timeoutMs = 15000) {
    if (window.supabase) return window.supabase;
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase client timed out.')), timeoutMs)
    );
    return Promise.race([window.supabaseReady, timeout]);
  };

  async function bootstrap() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Could not load app config.');
      const { supabaseUrl, supabaseAnonKey } = await res.json();
      if (!supabaseUrl || !supabaseAnonKey) throw new Error('App config is incomplete.');

      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js';
      s.onload = () => {
        try {
          window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
          resolveClient(window.supabase);
        } catch (err) {
          rejectClient(err);
        }
      };
      s.onerror = () => rejectClient(new Error('Failed to load Supabase SDK.'));
      document.head.appendChild(s);
    } catch (err) {
      rejectClient(err);
      console.error('Supabase bootstrap failed:', err.message);
    }
  }

  bootstrap();
})();