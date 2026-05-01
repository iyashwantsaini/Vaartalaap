import { languages } from "./languages";

export type ExecBackend = "codex" | "agent" | "wandbox" | "judge0" | "piston";

export interface ExecResult {
  output: string;
  /** Set when execution succeeded but produced no output. */
  empty?: boolean;
}

// --- Quota store -------------------------------------------------------------
// Judge0 (RapidAPI) returns rate-limit headers on every response. We surface
// the numbers via a tiny pub-sub so the AppBar can show a live remaining count.

export interface ExecQuota {
  backend: ExecBackend;
  remaining: number | null;
  limit: number | null;
  /** Epoch seconds when the window resets, if known. */
  resetAt: number | null;
  lastUpdated: number;
}

const initialQuota: ExecQuota = {
  backend: (import.meta.env.VITE_EXEC_BACKEND as ExecBackend) || "codex",
  remaining: null,
  limit: null,
  resetAt: null,
  lastUpdated: 0,
};

let currentQuota: ExecQuota = initialQuota;
const listeners = new Set<(q: ExecQuota) => void>();

export const getQuota = (): ExecQuota => currentQuota;

export const subscribeQuota = (fn: (q: ExecQuota) => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const setQuota = (next: Partial<ExecQuota>) => {
  currentQuota = { ...currentQuota, ...next, lastUpdated: Date.now() };
  for (const l of listeners) l(currentQuota);
};

// --- Backend selection -------------------------------------------------------

const backend: ExecBackend = (import.meta.env.VITE_EXEC_BACKEND as ExecBackend) || "codex";
const pistonUrl = (import.meta.env.VITE_PISTON_URL as string) || "https://emkc.org/api/v2/piston";
// Judge0 is currently DISABLED — see runOnJudge0 / executeCode. Vars retained
// so re-enabling later is a one-line change and the rest of the calling chain
// stays untouched.
const judge0Host = (import.meta.env.VITE_JUDGE0_HOST as string) || "judge0-ce.p.rapidapi.com";
const judge0Key = (import.meta.env.VITE_JUDGE0_KEY as string) || "";
const codexUrl = (import.meta.env.VITE_CODEX_URL as string) || "https://api.codex.jaagrav.in";
const agentUrl =
  (import.meta.env.VITE_AGENT_URL as string) ||
  "https://agent-gateway-kappa.vercel.app/v1/agent-coderunner/api/execute";
const wandboxUrl = (import.meta.env.VITE_WANDBOX_URL as string) || "https://wandbox.org/api/compile.json";

export const getBackend = (): ExecBackend => backend;

// --- Piston ------------------------------------------------------------------

const runOnPiston = async (langValue: string, code: string, stdin: string): Promise<ExecResult> => {
  const lang = languages.find((l) => l.value === langValue);
  // VITE_PISTON_URL should be the base, e.g. https://emkc.org/api/v2/piston
  // or http://localhost:2000/api/v2 for a self-hosted instance.
  const res = await fetch(`${pistonUrl.replace(/\/+$/, "")}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: lang?.piston || langValue,
      version: "*",
      files: [{ content: code }],
      stdin,
    }),
  });
  const data = (await res.json()) as { run?: { output: string }; message?: string };
  return { output: data.run ? data.run.output : data.message ?? "Unknown error" };
};

// --- Judge0 (RapidAPI) -------------------------------------------------------

const decodeBase64 = (s: string | null | undefined): string => {
  if (!s) return "";
  try { return atob(s); } catch { return s; }
};

const updateQuotaFromHeaders = (headers: Headers) => {
  const remaining = headers.get("x-ratelimit-requests-remaining");
  const limit = headers.get("x-ratelimit-requests-limit");
  const reset = headers.get("x-ratelimit-requests-reset");
  setQuota({
    backend: "judge0",
    remaining: remaining !== null ? Number(remaining) : currentQuota.remaining,
    limit: limit !== null ? Number(limit) : currentQuota.limit,
    resetAt: reset !== null ? Math.floor(Date.now() / 1000) + Number(reset) : currentQuota.resetAt,
  });
};

const runOnJudge0 = async (langValue: string, code: string, stdin: string): Promise<ExecResult> => {
  // Judge0 is disabled — bundling a RapidAPI key in the SPA would expose it to
  // anyone reading our static JS. Leaving the implementation in place so it
  // can be re-enabled (or moved server-side) without rewiring the chain.
  return { output: "Judge0 backend is disabled in this build." };
  // eslint-disable-next-line no-unreachable
  if (!judge0Key) {
    return { output: "Judge0 API key missing.\nSet VITE_JUDGE0_KEY in apps/client/.env (sign up at https://rapidapi.com/judge0-official/api/judge0-ce)." };
  }
  const lang = languages.find((l) => l.value === langValue);
  if (!lang || !lang.judge0) {
    return { output: `Language '${langValue}' is not supported on Judge0. Switch backend to Piston (self-hosted) for SQL.` };
  }

  const res = await fetch(`https://${judge0Host}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,message,status,time,memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": judge0Key,
      "X-RapidAPI-Host": judge0Host,
    },
    body: JSON.stringify({
      language_id: lang.judge0,
      source_code: btoa(unescape(encodeURIComponent(code))),
      stdin: btoa(unescape(encodeURIComponent(stdin || ""))),
    }),
  });

  updateQuotaFromHeaders(res.headers);

  if (res.status === 429) {
    return { output: "Judge0 rate limit reached for today. Switch backend or upgrade your RapidAPI plan." };
  }
  if (!res.ok) {
    return { output: `Judge0 error ${res.status}: ${await res.text()}` };
  }

  const data = await res.json() as {
    stdout?: string; stderr?: string; compile_output?: string; message?: string;
    status?: { description?: string };
    time?: string; memory?: number;
  };

  const stdout = decodeBase64(data.stdout);
  const stderr = decodeBase64(data.stderr);
  const compile = decodeBase64(data.compile_output);
  const msg = decodeBase64(data.message);

  let output = "";
  if (compile) output += compile + "\n";
  if (stdout) output += stdout;
  if (stderr) output += (output ? "\n" : "") + stderr;
  if (!output && msg) output = msg;
  if (!output) output = `(${data.status?.description ?? "no output"})`;

  if (data.time || data.memory) {
    output += `\n\u2014 ${data.time ?? "?"}s, ${data.memory ?? "?"} KB`;
  }

  return { output };
};

// --- CodeX (jaagrav, no key) -------------------------------------------------

class BackendUnavailable extends Error {}

const runOnCodex = async (langValue: string, code: string, stdin: string): Promise<ExecResult> => {
  const lang = languages.find((l) => l.value === langValue);
  if (!lang || !lang.codex) {
    throw new BackendUnavailable(`CodeX has no runtime for '${langValue}'.`);
  }
  let res: Response;
  try {
    res = await fetch(`${codexUrl.replace(/\/+$/, "")}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language: lang.codex, input: stdin || "" }),
    });
  } catch (err) {
    throw new BackendUnavailable(`CodeX network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new BackendUnavailable(`CodeX HTTP ${res.status}`);
  }
  const data = (await res.json()) as { output?: string; error?: string; language?: string; info?: string };
  const output = (data.output || "").trim();
  const error = (data.error || "").trim();
  if (error && !output) {
    // CodeX returns `error` for both compile + runtime + service errors.
    // Treat empty-output + "error" as a runtime error to surface, not a fallback trigger.
    return { output: error };
  }
  let combined = output;
  if (error) combined += (combined ? "\n" : "") + error;
  return { output: combined || "(no output)", empty: !combined };
};

// --- Agent Code Runner (no key, py/js/ts/bash) -------------------------------

const runOnAgent = async (langValue: string, code: string, stdin: string): Promise<ExecResult> => {
  const lang = languages.find((l) => l.value === langValue);
  if (!lang || !lang.agent) {
    throw new BackendUnavailable(`Agent Code Runner has no runtime for '${langValue}'.`);
  }
  if (stdin) {
    // Agent Code Runner has no stdin field; surface this honestly.
    return { output: "Agent Code Runner does not accept stdin. Switch backend or remove the input." };
  }
  let res: Response;
  try {
    res = await fetch(agentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang.agent, code }),
    });
  } catch (err) {
    throw new BackendUnavailable(`Agent network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new BackendUnavailable(`Agent HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    stdout?: string; stderr?: string; exitCode?: number;
    duration?: number; timedOut?: boolean; truncated?: boolean;
  };
  let out = data.stdout || "";
  if (data.stderr) out += (out ? "\n" : "") + data.stderr;
  if (!out) out = data.timedOut ? "(timed out)" : "(no output)";
  if (typeof data.duration === "number") out += `\n\u2014 ${data.duration} ms`;
  if (data.timedOut) out += " (timed out)";
  if (data.truncated) out += " (truncated)";
  return { output: out };
};

// --- Wandbox (no key, broad language coverage) -------------------------------

const runOnWandbox = async (langValue: string, code: string, stdin: string): Promise<ExecResult> => {
  const lang = languages.find((l) => l.value === langValue);
  if (!lang || !lang.wandbox) {
    throw new BackendUnavailable(`Wandbox has no compiler for '${langValue}'.`);
  }
  let res: Response;
  try {
    res = await fetch(wandboxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: lang.wandbox,
        code,
        stdin: stdin || "",
        save: false,
      }),
    });
  } catch (err) {
    throw new BackendUnavailable(`Wandbox network error: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new BackendUnavailable(`Wandbox HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string; signal?: string;
    compiler_error?: string; compiler_output?: string;
    program_output?: string; program_error?: string;
    program_message?: string;
  };
  let out = "";
  if (data.compiler_error) out += data.compiler_error;
  if (data.program_output) out += (out ? "\n" : "") + data.program_output;
  if (data.program_error) out += (out ? "\n" : "") + data.program_error;
  if (!out && data.program_message) out = data.program_message;
  if (!out && data.compiler_output) out = data.compiler_output;
  if (!out) out = `(exit ${data.status ?? "?"}${data.signal ? `, signal ${data.signal}` : ""})`;
  return { output: out };
};

// --- Public API --------------------------------------------------------------

export const executeCode = async (
  language: string,
  code: string,
  stdin: string
): Promise<ExecResult> => {
  if (backend === "piston") return runOnPiston(language, code, stdin);
  // Judge0 path is disabled — see runOnJudge0. Falls through to default chain.
  // if (backend === "judge0") return runOnJudge0(language, code, stdin);
  if (backend === "agent") return runOnAgent(language, code, stdin);
  if (backend === "wandbox") return runOnWandbox(language, code, stdin);

  // Default: try Wandbox -> CodeX -> Agent in order. Wandbox covers everything
  // except Kotlin and is by far the most reliable of the free public hosts.
  const errors: string[] = [];
  for (const runner of [runOnWandbox, runOnCodex, runOnAgent] as const) {
    try {
      const result = await runner(language, code, stdin);
      if (errors.length) {
        return { ...result, output: `${result.output}\n\u2014 (after ${errors.length} backend${errors.length > 1 ? "s" : ""} failed)` };
      }
      return result;
    } catch (err) {
      if (err instanceof BackendUnavailable) {
        errors.push(`${runner.name}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }
  return {
    output: `No free backend could run '${language}'.\n` + errors.map((e) => "  • " + e).join("\n"),
  };
};
