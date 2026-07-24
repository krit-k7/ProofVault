/** Cache-busted fetch for /keys and /zkir — avoids stale N=64 artifacts after circuit upgrades. */
export function createZkFetch(baseFetch: typeof fetch = fetch.bind(globalThis)): typeof fetch {
  const zkBuildId = import.meta.env.VITE_ZK_BUILD_ID?.trim();
  if (!zkBuildId) return baseFetch;

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);

    if (!href.includes('/keys/') && !href.includes('/zkir/')) {
      return baseFetch(input, init);
    }

    const url = new URL(href, globalThis.location?.origin ?? undefined);
    url.searchParams.set('v', zkBuildId);
    return baseFetch(url.toString(), init);
  };
}
