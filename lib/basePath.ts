// Single source of truth for the app's basePath (mirrors Daily Brief's
// approach for the same reason: deployed under filimondanmihai.ro/booking
// via a PHP reverse proxy, see 04_Website's brief/ for the pattern this
// copies). next.config.ts reads this, and a couple of client components
// need it too — next/link and next/navigation apply basePath automatically,
// but a raw `window.location.href = "/admin"` does not.
export const BASE_PATH = "/booking";
