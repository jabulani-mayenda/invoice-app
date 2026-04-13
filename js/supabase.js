(function () {
  const defaultConfig = {
    url: 'https://yqdhpfwkpftkfyexzwkm.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZGhwZndrcGZ0a2Z5ZXh6d2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzkwNzMsImV4cCI6MjA5MTYxNTA3M30.LAwlkd89Z2su6lZMN9JP7dUyuPC2WHFduWMw-RCuh1E'
  };

  function getConfig() {
    const override = window.__KWEZA_SUPABASE_CONFIG__ || {};
    return {
      url: (override.url || defaultConfig.url || '').trim(),
      anonKey: (override.anonKey || defaultConfig.anonKey || '').trim()
    };
  }

  window.KwezaSupabase = {
    getConfig
  };
})();
