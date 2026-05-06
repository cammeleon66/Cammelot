// Galahad QA — LLM Proxy Contract Tests
// Regression check: llm-proxy-contracts

import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { pathToFileURL } from "node:url";

const proxyModulePath = "C:\\Users\\Public\\Cammelot\\scripts\\llm-proxy.js";

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function requestProxy(port, { path, method = "GET", headers = {}, json, rawBody } = {}) {
  return new Promise((resolve, reject) => {
    const requestBody = json === undefined
      ? rawBody
      : JSON.stringify(json);
    const finalHeaders = { ...headers };

    if (json !== undefined) {
      finalHeaders["Content-Type"] = "application/json";
    }

    if (requestBody !== undefined) {
      finalHeaders["Content-Length"] = Buffer.byteLength(requestBody);
    }

    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: finalHeaders,
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          let parsedJson = null;

          if (body) {
            try {
              parsedJson = JSON.parse(body);
            } catch {
              parsedJson = null;
            }
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
            json: parsedJson,
          });
        });
      },
    );

    req.on("error", reject);

    if (requestBody !== undefined) {
      req.write(requestBody);
    }

    req.end();
  });
}

describe("LLM proxy server", { concurrency: false }, () => {
  let mockOllamaServer;
  let proxyModule;
  let proxyPort;
  let mockOllamaPort;
  const generateRequests = [];

  before(async () => {
    mockOllamaServer = createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/api/tags") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ models: [{ name: "llama3" }, { name: "mistral" }] }));
        return;
      }

      if (req.method === "POST" && req.url === "/api/generate") {
        const body = JSON.parse((await readRawBody(req)) || "{}");
        generateRequests.push(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          response: JSON.stringify({
            action: "seek_care",
            reflection: "I should seek care now.",
            confidence: 0.87,
          }),
          prompt_eval_count: 123,
          eval_count: 45,
        }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: true, message: "Mock Ollama route not found" }));
    });

    mockOllamaServer.listen(0, "127.0.0.1");
    await once(mockOllamaServer, "listening");
    mockOllamaPort = mockOllamaServer.address().port;

    process.env.PORT = "0";
    process.env.LLM_PROVIDER = "ollama";
    process.env.LLM_MODEL = "mistral";
    process.env.CORS_ORIGIN = "*";
    process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${mockOllamaPort}`;
    process.env.RATE_LIMIT_CAPACITY = "60";

    const moduleUrl = `${pathToFileURL(proxyModulePath).href}?test=${Date.now()}`;
    proxyModule = await import(moduleUrl);

    if (!proxyModule.server.listening) {
      await once(proxyModule.server, "listening");
    }

    proxyPort = proxyModule.server.address().port;
  });

  after(async () => {
    if (proxyModule?.server?.listening) {
      await closeServer(proxyModule.server);
    }

    if (mockOllamaServer?.listening) {
      await closeServer(mockOllamaServer);
    }
  });

  it("exports the expected testing surface", () => {
    assert.ok(proxyModule.server, "server export should exist");
    assert.strictEqual(typeof proxyModule.server.close, "function");
    assert.strictEqual(typeof proxyModule.parseJsonLenient, "function");
    assert.strictEqual(typeof proxyModule.fallbackThinkResponse, "function");

    const parsed = proxyModule.parseJsonLenient("```json\n{\"ok\":true}\n```");
    assert.deepStrictEqual(parsed, { ok: true });
    assert.deepStrictEqual(proxyModule.fallbackThinkResponse("down"), {
      action: "fallback",
      reflection: "down",
      error: true,
    });
  });

  it("GET /api/health returns health JSON", async () => {
    const response = await requestProxy(proxyPort, { path: "/api/health" });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json.status, "ok");
    assert.strictEqual(response.json.provider, "ollama");
    assert.strictEqual(response.json.ollamaAvailable, true);
    assert.strictEqual(typeof response.json.uptime, "number");
  });

  it("GET /api/config returns configured models", async () => {
    const response = await requestProxy(proxyPort, { path: "/api/config" });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json.provider, "ollama");
    assert.deepStrictEqual(response.json.models, ["llama3", "mistral"]);
    assert.strictEqual(response.json.defaultModel, "mistral");
  });

  it("POST /api/think returns a normalized proxy response", async () => {
    const response = await requestProxy(proxyPort, {
      path: "/api/think",
      method: "POST",
      json: {
        agentId: "patient-hendrik-veenstra",
        prompt: "I feel chest pain and dizziness.",
        personality: { riskTolerance: "low" },
        model: "llama3",
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json.action, "seek_care");
    assert.strictEqual(response.json.reflection, "I should seek care now.");
    assert.strictEqual(response.json.confidence, 0.87);
    assert.deepStrictEqual(response.json.tokens, { input: 123, output: 45 });

    const lastGenerateRequest = generateRequests.at(-1);
    assert.strictEqual(lastGenerateRequest.model, "llama3");
    assert.ok(lastGenerateRequest.prompt.includes("agentId: patient-hendrik-veenstra"));
    assert.ok(lastGenerateRequest.prompt.includes("I feel chest pain and dizziness."));
  });

  it("returns a fallback response when Ollama is unreachable", async () => {
    await closeServer(mockOllamaServer);

    const response = await requestProxy(proxyPort, {
      path: "/api/think",
      method: "POST",
      headers: { "x-forwarded-for": "fallback-test" },
      json: {
        agentId: "patient-fallback",
        prompt: "I still need an answer.",
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json.action, "fallback");
    assert.strictEqual(response.json.error, true);
    assert.strictEqual(response.json.reflection, "LLM unavailable");
  });

  it("enforces rate limiting after 60 requests", async () => {
    const responses = [];

    for (let index = 0; index < 61; index += 1) {
      responses.push(await requestProxy(proxyPort, {
        path: "/api/health",
        headers: { "x-forwarded-for": "rate-limit-test" },
      }));
    }

    assert.strictEqual(responses[59].statusCode, 200);
    assert.strictEqual(responses[60].statusCode, 429);
    assert.strictEqual(responses[60].json.error, true);
  });

  it("includes CORS headers on responses", async () => {
    const response = await requestProxy(proxyPort, { path: "/api/health" });

    assert.strictEqual(response.headers["access-control-allow-origin"], "*");
    assert.ok(response.headers["access-control-allow-methods"].includes("GET"));
  });

  it("rejects invalid requests", async () => {
    const missingBody = await requestProxy(proxyPort, {
      path: "/api/think",
      method: "POST",
      headers: { "x-forwarded-for": "missing-body-test" },
    });
    assert.strictEqual(missingBody.statusCode, 400);
    assert.strictEqual(missingBody.json.error, true);

    const wrongMethod = await requestProxy(proxyPort, {
      path: "/api/think",
      method: "GET",
      headers: { "x-forwarded-for": "wrong-method-test" },
    });
    assert.strictEqual(wrongMethod.statusCode, 404);
    assert.strictEqual(wrongMethod.json.error, true);

    const malformedJson = await requestProxy(proxyPort, {
      path: "/api/think",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "bad-json-test",
      },
      rawBody: "{not-valid-json",
    });
    assert.strictEqual(malformedJson.statusCode, 400);
    assert.strictEqual(malformedJson.json.error, true);
    assert.match(malformedJson.json.message, /Invalid JSON body/);
  });
});
