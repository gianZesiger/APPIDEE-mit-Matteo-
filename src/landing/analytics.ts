// Messung nur auf der Startseite, ohne Cookies, standardmässig aus.
// Einschalten in .env (siehe .env.example): VITE_CF_ANALYTICS_TOKEN=<Token aus Cloudflare Web Analytics>
// Gemessen werden nur Seitenaufrufe (Cloudflare Web Analytics). In der App selbst wird nie gemessen.

export const CF_BEACON = 'https://static.cloudflareinsights.com/beacon.min.js';
const token = (import.meta.env.VITE_CF_ANALYTICS_TOKEN ?? '').trim();

export function initAnalytics() {
  if (!/^[\w-]{8,64}$/.test(token)) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = CF_BEACON;
  s.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  document.head.appendChild(s);
}
