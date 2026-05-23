"use strict";

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const WORKER_URL = process.env.PREPCLI_API_URL || "https://api.prepcli.in";

async function request(method, endpoint, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${WORKER_URL}${endpoint}`, options);
  } catch {
    throw new Error("Cannot reach prepcli server. Check your connection.");
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    if (res.status === 401) throw new Error("session_expired");
    throw new Error(data.error || "Server error");
  }

  return data;
}

module.exports = {
  get:  (endpoint, token)        => request("GET",    endpoint, null, token),
  post: (endpoint, body, token)  => request("POST",   endpoint, body, token),
  put:  (endpoint, body, token)  => request("PUT",    endpoint, body, token),
  del:  (endpoint, token)        => request("DELETE", endpoint, null, token),
};
