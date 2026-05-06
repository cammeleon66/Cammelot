import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
const PROVIDER = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();
const DEFAULT_MODEL = process.env.LLM_MODEL ?? "llama3";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const API_KEY = process.env.CAMMELOT_LLM_KEY ?? "";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.LLM_TIMEOUT_MS ?? "10000", 10);
const RATE_LIMIT_CAPACITY = Number.parseInt(process.env.RATE_LIMIT_CAPACITY ?? "60", 10);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REFILL_PER_MS = RATE_LIMIT_CAPACITY / RATE_LIMIT_WINDOW_MS;
const rateLimitBuckets = new Map();

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

function sendJson(res, statusCode, payload) {
  applyCors(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getClientId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket.remoteAddress ?? "unknown";
}

function consumeRateLimitToken(clientId) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(clientId) ?? {
    tokens: RATE_LIMIT_CAPACITY,
    lastRefillAt: now,
  };

  const elapsedMs = now - bucket.lastRefillAt;
  bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + elapsedMs * RATE_LIMIT_REFILL_PER_MS);
  bucket.lastRefillAt = now;

  if (bucket.tokens < 1) {
    rateLimitBuckets.set(clientId, bucket);
    return false;
  }

  bucket.tokens -= 1;
  rateLimitBuckets.set(clientId, bucket);
  return true;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const rawBody = await readRequestBody(req);

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function buildHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };

  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
    headers["X-API-Key"] = API_KEY;
  }

  return headers;
}

function httpRequestJson(targetUrl, { method = "GET", headers = {}, body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const url = new URL(targetUrl);
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  const requestBody = body === undefined ? undefined : JSON.stringify(body);
  const finalHeaders = buildHeaders({
    Accept: "application/json",
    ...headers,
  });

  if (requestBody !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    finalHeaders["Content-Length"] = Buffer.byteLength(requestBody);
  }

  return new Promise((resolve, reject) => {
    const request = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: finalHeaders,
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 500,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      const error = new Error(`Request timed out after ${timeoutMs}ms`);
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });

    request.on("error", reject);

    if (requestBody !== undefined) {
      request.write(requestBody);
    }

    request.end();
  });
}

function findBalancedJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseJsonLenient(rawText) {
  if (typeof rawText !== "string") {
    return null;
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = [trimmed];
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const balanced = findBalancedJsonObject(trimmed);
  if (balanced) {
    candidates.push(balanced.trim());
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue trying fallbacks.
    }
  }

  return null;
}

function clampConfidence(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, numeric));
}

function extractResponseText(providerPayload) {
  if (typeof providerPayload?.response === "string") {
    return providerPayload.response;
  }

  if (typeof providerPayload?.message?.content === "string") {
    return providerPayload.message.content;
  }

  return "";
}

function normalizeThinkResponse(parsed, providerPayload) {
  return {
    action: typeof parsed?.action === "string" && parsed.action.trim() ? parsed.action.trim() : "wait",
    reflection: typeof parsed?.reflection === "string" && parsed.reflection.trim()
      ? parsed.reflection.trim()
      : "No reflection returned.",
    confidence: clampConfidence(parsed?.confidence),
    tokens: {
      input: Number(providerPayload?.prompt_eval_count ?? providerPayload?.prompt_eval_tokens ?? 0),
      output: Number(providerPayload?.eval_count ?? providerPayload?.completion_eval_tokens ?? 0),
    },
  };
}

function fallbackThinkResponse(reason = "LLM unavailable") {
  return {
    action: "fallback",
    reflection: reason,
    error: true,
  };
}

function buildThinkPrompt({ agentId, prompt, personality }) {
  const personalityJson = personality && typeof personality === "object"
    ? JSON.stringify(personality)
    : "{}";

  return [
    "You are a decision engine for a healthcare simulation citizen.",
    "Return exactly one JSON object with this shape:",
    '{"action":"seek_care|wait|refuse|comply|self_manage|escalate","reflection":"short first-person reasoning","confidence":0.0}',
    "Do not include markdown fences or any extra text.",
    `agentId: ${agentId ?? "unknown"}`,
    `personality: ${personalityJson}`,
    "task:",
    String(prompt ?? "").trim(),
  ].join("\n");
}

async function queryOllamaGenerate({ prompt, model }) {
  const response = await httpRequestJson(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    body: {
      model: model || DEFAULT_MODEL,
      prompt,
      stream: false,
      format: "json",
    },
  });

  const providerPayload = parseJsonLenient(response.body);
  if (!providerPayload) {
    throw new Error("Invalid JSON returned by Ollama API");
  }

  return providerPayload;
}

async function getOllamaModels() {
  try {
    const response = await httpRequestJson(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      timeoutMs: 3000,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return { available: false, models: [] };
    }

    const payload = parseJsonLenient(response.body);
    const models = Array.isArray(payload?.models)
      ? payload.models
          .map((entry) => entry?.name)
          .filter((name) => typeof name === "string" && name.trim())
      : [];

    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

async function handleThink(req, res) {
  const body = await readJsonBody(req);
  const { agentId, prompt, personality, model } = body;

  if (typeof prompt !== "string" || !prompt.trim()) {
    sendJson(res, 400, {
      error: true,
      message: "Request body must include a non-empty prompt string.",
    });
    return;
  }

  if (PROVIDER !== "ollama") {
    sendJson(res, 200, fallbackThinkResponse(`Unsupported provider: ${PROVIDER}`));
    return;
  }

  try {
    const providerPayload = await queryOllamaGenerate({
      model,
      prompt: buildThinkPrompt({ agentId, prompt, personality }),
    });

    const responseText = extractResponseText(providerPayload);
    const parsed = parseJsonLenient(responseText);

    if (!parsed) {
      sendJson(res, 200, fallbackThinkResponse("LLM returned invalid JSON"));
      return;
    }

    sendJson(res, 200, normalizeThinkResponse(parsed, providerPayload));
  } catch (error) {
    const isTimeout = error?.code === "ETIMEDOUT";
    const isConnectionRefused = error?.code === "ECONNREFUSED";
    const reason = isTimeout
      ? "LLM timeout"
      : isConnectionRefused
        ? "LLM unavailable"
        : "LLM unavailable";

    sendJson(res, 200, fallbackThinkResponse(reason));
  }
}

async function handleHealth(res) {
  const ollama = await getOllamaModels();
  sendJson(res, 200, {
    status: "ok",
    provider: PROVIDER,
    ollamaAvailable: ollama.available,
    uptime: Math.floor(process.uptime()),
  });
}

async function handleConfig(res) {
  const ollama = PROVIDER === "ollama" ? await getOllamaModels() : { available: false, models: [] };
  const models = ollama.models.length > 0 ? ollama.models : [DEFAULT_MODEL];

  sendJson(res, 200, {
    provider: PROVIDER,
    models,
    defaultModel: DEFAULT_MODEL,
  });
}

const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${PORT}`}`);
  const path = requestUrl.pathname;
  const method = req.method ?? "GET";
  const clientId = getClientId(req);
  let agentId = "-";

  res.on("finish", () => {
    const latencyMs = Date.now() - startedAt;
    console.log(`[${new Date().toISOString()}] ${method} ${path} agentId=${agentId} status=${res.statusCode} latency=${latencyMs}ms`);
  });

  applyCors(res);

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!consumeRateLimitToken(clientId)) {
    sendJson(res, 429, {
      error: true,
      message: "Rate limit exceeded. Try again in a moment.",
    });
    return;
  }

  try {
    if (method === "GET" && path === "/api/health") {
      await handleHealth(res);
      return;
    }

    if (method === "GET" && path === "/api/config") {
      await handleConfig(res);
      return;
    }

    if (method === "POST" && path === "/api/think") {
      const body = await readJsonBody(req);
      agentId = typeof body.agentId === "string" && body.agentId.trim() ? body.agentId.trim() : "-";

      if (typeof body.prompt !== "string" || !body.prompt.trim()) {
        sendJson(res, 400, {
          error: true,
          message: "Request body must include a non-empty prompt string.",
        });
        return;
      }

      if (PROVIDER !== "ollama") {
        sendJson(res, 200, fallbackThinkResponse(`Unsupported provider: ${PROVIDER}`));
        return;
      }

      try {
        const providerPayload = await queryOllamaGenerate({
          model: body.model,
          prompt: buildThinkPrompt(body),
        });

        const responseText = extractResponseText(providerPayload);
        const parsed = parseJsonLenient(responseText);

        if (!parsed) {
          sendJson(res, 200, fallbackThinkResponse("LLM returned invalid JSON"));
          return;
        }

        sendJson(res, 200, normalizeThinkResponse(parsed, providerPayload));
      } catch (error) {
        const isTimeout = error?.code === "ETIMEDOUT";
        const reason = isTimeout ? "LLM timeout" : "LLM unavailable";
        sendJson(res, 200, fallbackThinkResponse(reason));
      }
      return;
    }

    sendJson(res, 404, {
      error: true,
      message: "Not found",
    });
  } catch (error) {
    const statusCode = error?.statusCode ?? 500;
    sendJson(res, statusCode, {
      error: true,
      message: error?.message ?? "Internal server error",
    });
  }
});

function logStartupBanner() {
  console.log("\n=== Cammelot LLM Proxy ===");
  console.log(`Port: ${PORT}`);
  console.log(`Provider: ${PROVIDER}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`Timeout: ${REQUEST_TIMEOUT_MS}ms`);
}

server.listen(PORT, () => {
  logStartupBanner();

  getOllamaModels()
    .then((ollama) => {
      console.log(`Ollama status: ${ollama.available ? "available" : "down"}`);
      if (!ollama.available) {
        console.warn(`Warning: Ollama not reachable at ${OLLAMA_BASE_URL}`);
      }
    })
    .catch(() => {
      console.warn(`Warning: Failed to check Ollama at ${OLLAMA_BASE_URL}`);
    });
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down LLM proxy...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { server, parseJsonLenient, fallbackThinkResponse };
