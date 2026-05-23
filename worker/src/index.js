export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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

    // Supabase call with user JWT so RLS applies
    async function authedSupabase(path, options = {}, userToken) {
      return fetch(`${env.SUPABASE_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "apikey":        env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${userToken}`,
          ...options.headers,
        },
      });
    }

    function extractToken(req) {
      const auth = req.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) return null;
      return auth.slice(7);
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

    // ── POST /projects ────────────────────────────────────────────────────────
    if (path === "/projects" && method === "POST") {
      const token = extractToken(request);
      if (!token) return err("Authorization required", 401);

      const { name, git_remote } = await body(request);
      if (!name) return err("name required");

      // Resolve user id from token
      const userRes  = await authedSupabase("/auth/v1/user", { method: "GET" }, token);
      const userData = await userRes.json().catch(() => ({}));
      if (!userRes.ok || !userData.id) return err("Invalid token", 401);
      const userId = userData.id;

      // Return existing project if the git remote already maps to one
      if (git_remote) {
        const checkRes = await authedSupabase(
          `/rest/v1/projects?owner_id=eq.${userId}&git_remote=eq.${encodeURIComponent(git_remote)}&select=id`,
          { method: "GET" },
          token
        );
        const existing = await checkRes.json().catch(() => []);
        if (Array.isArray(existing) && existing.length > 0) {
          return json({ project_id: existing[0].id, already_existed: true });
        }
      }

      // Create project row
      const projRes  = await authedSupabase("/rest/v1/projects", {
        method: "POST",
        body:   JSON.stringify({ owner_id: userId, name, git_remote: git_remote || null }),
        headers: { "Prefer": "return=representation" },
      }, token);
      const projData = await projRes.json().catch(() => ({}));
      if (!projRes.ok) return err(projData.message || "Failed to create project");

      const project = Array.isArray(projData) ? projData[0] : projData;

      // Seed an empty project_context row
      await authedSupabase("/rest/v1/project_context", {
        method: "POST",
        body: JSON.stringify({
          project_id:         project.id,
          stack:              {},
          active_constraints: [],
          recent_decisions:   [],
          hard_limits:        [],
          conventions:        {},
          open_questions:     [],
        }),
        headers: { "Prefer": "return=minimal" },
      }, token).catch(() => {});

      return json({ project_id: project.id });
    }

    // ── GET /projects/:id/context ─────────────────────────────────────────────
    if (/^\/projects\/[^/]+\/context$/.test(path) && method === "GET") {
      const token = extractToken(request);
      if (!token) return err("Authorization required", 401);

      const projectId = path.split("/")[2];

      const res  = await authedSupabase(
        `/rest/v1/project_context?project_id=eq.${projectId}&select=*`,
        { method: "GET" },
        token
      );
      const data = await res.json().catch(() => []);
      if (!res.ok) return err("Failed to fetch context");

      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return json({ context: null });

      return json({
        context: {
          stack:              row.stack              || {},
          hard_limits:        row.hard_limits        || [],
          active_constraints: row.active_constraints || [],
          conventions:        row.conventions        || {},
          recent_decisions:   row.recent_decisions   || [],
          open_questions:     row.open_questions     || [],
          last_updated:       row.last_updated,
        },
      });
    }

    // ── PUT /projects/:id/context ─────────────────────────────────────────────
    if (/^\/projects\/[^/]+\/context$/.test(path) && method === "PUT") {
      const token = extractToken(request);
      if (!token) return err("Authorization required", 401);

      const projectId = path.split("/")[2];
      const update    = await body(request);

      const allowed = ["stack", "hard_limits", "active_constraints", "conventions", "recent_decisions", "open_questions"];
      const payload  = { last_updated: new Date().toISOString() };
      for (const key of allowed) {
        if (key in update) payload[key] = update[key];
      }

      const res = await authedSupabase(
        `/rest/v1/project_context?project_id=eq.${projectId}`,
        {
          method:  "PATCH",
          body:    JSON.stringify(payload),
          headers: { "Prefer": "return=minimal" },
        },
        token
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return err(d.message || "Failed to update context");
      }

      return json({ ok: true });
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    return err("Not found", 404);
  },
};
