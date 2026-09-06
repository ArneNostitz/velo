import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";

const port = Number(process.env.PORT || 8787);
const dataFile = process.env.DATA_FILE || "/data/registrations.json";
const secret = process.env.PUSH_SHARED_SECRET;
const audience = process.env.PUBSUB_AUDIENCE || undefined;
const renewMs = Number(process.env.WATCH_RENEW_MS || 3_600_000);
const clients = new Set();
let registrations = new Map();

if (!secret) throw new Error("PUSH_SHARED_SECRET is required");

async function load() {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    for (const item of JSON.parse(raw)) registrations.set(item.email, item);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function save() {
  await fs.mkdir(new URL(".", `file://${dataFile}`).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(dataFile, JSON.stringify([...registrations.values()], null, 2));
}

function authorized(req) {
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-push-secret"];
  return typeof provided === "string" && provided.length === secret.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function gmailWatch(accessToken, topicName) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ topicName, labelIds: ["INBOX"] }),
  });
  if (!response.ok) throw new Error(`Gmail watch failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(payload);
}

async function renew() {
  for (const registration of registrations.values()) {
    if (registration.expiresAt > Date.now() + renewMs * 2) continue;
    try {
      // Access tokens are deliberately not persisted. The desktop client must
      // renew the watch by calling /register again with a fresh token.
      broadcast({ type: "renew-required", email: registration.email });
    } catch (error) {
      console.error("watch renewal check failed", error);
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });
    if (!authorized(req) && url.pathname !== "/pubsub") return json(res, 401, { error: "unauthorized" });

    if (req.method === "POST" && url.pathname === "/register") {
      const input = await body(req);
      if (!input.email || !input.accessToken || !input.topicName) return json(res, 400, { error: "email, accessToken and topicName are required" });
      const result = await gmailWatch(input.accessToken, input.topicName);
      const registration = { email: input.email, topicName: input.topicName, historyId: result.historyId, expiresAt: Number(result.expiration) || Date.now() + 7 * 24 * 3600_000 };
      registrations.set(input.email, registration);
      await save();
      return json(res, 200, registration);
    }

    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/pubsub") {
      const input = await body(req);
      const message = input.message || {};
      const decoded = message.data ? JSON.parse(Buffer.from(message.data, "base64url").toString("utf8")) : {};
      broadcast({ type: "gmail-history", email: decoded.emailAddress, historyId: decoded.historyId, messageId: message.messageId });
      return json(res, 200, { ok: true });
    }

    json(res, 404, { error: "not found" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

await load();
server.listen(port, () => console.log(`gmail-push listening on ${port}`));
setInterval(renew, renewMs).unref();
