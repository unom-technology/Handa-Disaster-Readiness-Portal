'use strict';

// Tiny fetch wrapper that adds a timeout (via AbortController) and JSON parsing.
// Uses Node's built-in global fetch (Node 18+), so no extra HTTP dependency.

async function fetchJson(url, { timeout = 12000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...headers },
    });
    if (!res.ok) {
      throw new Error(`Request to ${url} failed with HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchJson };
