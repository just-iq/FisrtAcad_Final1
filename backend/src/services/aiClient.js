const { config } = require("../config/config");

function withTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

async function analyzeAnnouncement({ id, title, body }) {
  const { signal, cancel } = withTimeout(30000);
  try {
    const res = await fetch(`${config.aiService.baseUrl}/analyze/announcement`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, title, body }),
      signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  } finally {
    cancel();
  }
}

module.exports = { analyzeAnnouncement };

