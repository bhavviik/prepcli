export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    function err(message, status = 400) {
      return json({ error: message }, status);
    }

    async function body(req) {
      try { return await req.json(); } catch { return {}; }
    }

    async function supabase(path, options = {}) {
      return fetch(`${env.SUPABASE_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "apikey": env.SUPABASE_ANON_KEY,
          ...options.headers,
        },
      });
    }

    // ── GET /health ──────────────────────────────────────────────────────────
    if (path === "/health" && method === "GET") {
      return json({ ok: true, version: "0.1.0" });
    }

    // ── POST /auth/otp ───────────────────────────────────────────────────────
    if (path === "/auth/otp" && method === "POST") {
      const { email } = await body(request);

      if (!email || !email.includes("@")) {
        return err("Valid email required");
      }

      const res = await supabase("/auth/v1/otp", {
        method: "POST",
        body: JSON.stringify({ email, create_user: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return err(data.msg || data.error_description || "Failed to send code");
      }

      return json({ sent: true });
    }

    // ── POST /auth/verify ────────────────────────────────────────────────────
    if (path === "/auth/verify" && method === "POST") {
      const { email, token } = await body(request);

      if (!email || !token) {
        return err("Email and token required");
      }

      const res = await supabase("/auth/v1/verify", {
        method: "POST",
        body: JSON.stringify({ email, token, type: "email" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.access_token) {
        return err(data.msg || data.error_description || "Invalid or expired code", 401);
      }

      return json({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    data.expires_at,
        user_id:       data.user?.id,
        email:         data.user?.email,
      });
    }

    // ── POST /auth/refresh ───────────────────────────────────────────────────
    if (path === "/auth/refresh" && method === "POST") {
      const { refresh_token } = await body(request);

      if (!refresh_token) {
        return err("refresh_token required");
      }

      const res = await supabase("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.access_token) {
        return err(data.msg || data.error_description || "Session expired", 401);
      }

      return json({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    data.expires_at,
      });
    }

    // ── POST /auth/logout ────────────────────────────────────────────────────
    if (path === "/auth/logout" && method === "POST") {
      const auth = request.headers.get("Authorization");

      if (!auth?.startsWith("Bearer ")) {
        return err("Authorization header required", 401);
      }

      await supabase("/auth/v1/logout", {
        method:  "POST",
        headers: { Authorization: auth },
      }).catch(() => {});

      return json({ ok: true });
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    return err("Not found", 404);
  },
};
