#!/usr/bin/env node
// Minimal session capture for self-learning. Wired via .github/hooks/hooks.json.
//
// Captures the actual Copilot CLI hook payloads (user prompts, tool results,
// errors) into a per-session JSONL log, then on sessionEnd aggregates failures
// and correction-pattern prompts into a lessons block and rewrites the managed
// block in .github/instructions/self-learning.instructions.md.
//
// This is the lean replacement for the previous markdown-self-learning.mjs +
// runtime-artifacts.mjs + session-checkpoint.mjs + harness/event-log.mjs
// stack. Single file, no checkpoints, no eval, no runtime-state directory
// outside a per-session JSONL log.
//
// Hook payload shapes (Copilot CLI):
//   sessionStart          { source, initialPrompt }
//   userPromptSubmitted   { prompt }
//   postToolUse           { toolName, toolArgs, toolResult: { resultType, textResultForLlm } }
//   errorOccurred         { error: { name, message } }
//   sessionEnd            { reason, sessionId }

import { appendFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Buffer } from 'node:buffer';

const EVENT_NAME = process.argv[2];
if (!EVENT_NAME) process.exit(0);

const PAYLOAD_FILE = process.argv.find((a) => a === '--payload-file')
  ? process.argv[process.argv.indexOf('--payload-file') + 1]
  : null;

const RUNTIME_DIR = join(tmpdir(), 'payments-hooks');
const INSTRUCTIONS_PATH = join(
  process.cwd(),
  '.github',
  'instructions',
  'self-learning.instructions.md'
);
const FRONT_MATTER = [
  '---',
  'name: Learned patterns',
  'description: Patterns and corrections mined from past Copilot sessions in this repo. Load at the start of any task to avoid repeating mistakes previously corrected.',
  'applyTo: "**"',
  '---',
  '',
  '',
].join('\n');

const MARKER_START = '<!-- managed-by:hooks start -->';
const MARKER_END = '<!-- managed-by:hooks end -->';

// Progressive disclosure: only surface lessons that have repeated AND are
// recent. One-off corrections are noise; patterns that survive across
// sessions are signal.
const LESSON_LOG_PATH = join(RUNTIME_DIR, 'lessons.jsonl');
const LESSON_PROMOTION_THRESHOLD = 2;
const LESSON_TTL_DAYS = 30;
const LESSON_MAX_DISPLAY = 8;

function lessonKey(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Earlier Lanyard versions of this file used different markers. If the
// regenerate-instructions.mjs script has run, those markers are still in
// the file. We treat that block as also-ours and replace it.
const LEGACY_MARKER_START = '<!-- managed-by:lanyard start -->';
const LEGACY_MARKER_END = '<!-- managed-by:lanyard end -->';

const CORRECTION_PATTERNS = [
  /\bno[,.\s]/i,
  /\bwrong\b/i,
  /\bactually\b/i,
  /\binstead\b/i,
  /\bdon'?t\b/i,
  /\bstop\b/i,
  /\bthat'?s not\b/i,
  /\bshould be\b/i,
  /\buse \w+ not\b/i,
];

const FAILURE_TOOLS = new Set(['bash', 'edit', 'create', 'apply_patch']);

function runtimeFilePath(sessionId) {
  return join(RUNTIME_DIR, `${sessionId}.jsonl`);
}

async function readLessonLog() {
  try {
    const raw = await readFile(LESSON_LOG_PATH, 'utf-8');
    const out = [];
    for (const line of raw.split('\n')) {
      if (!line) continue;
      try { out.push(JSON.parse(line)); } catch { continue; }
    }
    return out;
  } catch {
    return [];
  }
}

async function appendLessonLog(entries) {
  if (entries.length === 0) return;
  await mkdir(RUNTIME_DIR, { recursive: true });
  const lines = entries
    .map((e) => `${JSON.stringify({ ts: new Date().toISOString(), key: e.key, text: e.text, kind: e.kind })}\n`)
    .join('');
  await appendFile(LESSON_LOG_PATH, lines, 'utf-8');
}

function rankLessons(logEntries) {
  const now = Date.now();
  const ttlMs = LESSON_TTL_DAYS * 24 * 60 * 60 * 1000;
  const grouped = new Map();

  for (const entry of logEntries) {
    const ts = Date.parse(entry.ts || '');
    if (!Number.isFinite(ts) || now - ts > ttlMs) continue;
    const k = entry.key;
    if (!k) continue;
    const existing = grouped.get(k) || {
      key: k,
      text: entry.text,
      count: 0,
      lastSeen: 0,
      kind: entry.kind,
    };
    existing.count += 1;
    if (ts > existing.lastSeen) existing.lastSeen = ts;
    grouped.set(k, existing);
  }

  return [...grouped.values()]
    .filter((g) => g.count >= LESSON_PROMOTION_THRESHOLD)
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, LESSON_MAX_DISPLAY);
}

async function trimLessonLog() {
  // Drop entries outside the TTL window so the log doesn't grow unbounded.
  // We do NOT trim by threshold — a single occurrence today is still useful
  // data; the threshold only filters what we surface, not what we keep.
  const now = Date.now();
  const ttlMs = LESSON_TTL_DAYS * 24 * 60 * 60 * 1000;
  const all = await readLessonLog();
  const kept = all.filter((e) => {
    const ts = Date.parse(e.ts || '');
    return Number.isFinite(ts) && now - ts <= ttlMs;
  });
  const lines = kept.map((e) => JSON.stringify(e)).join('\n');
  await writeFile(
    LESSON_LOG_PATH,
    lines.length > 0 ? `${lines}\n` : '',
    'utf-8'
  );
}

function formatLesson(ranked) {
  const last = Number.isFinite(ranked.lastSeen)
    ? ` (last ${new Date(ranked.lastSeen).toISOString().slice(0, 10)})`
    : '';
  return `- **${ranked.text}** — ${ranked.count}×${last}`;
}

function currentSessionId(payload) {
  return (
    payload?.sessionId ||
    payload?.session_id ||
    process.env.LANYARD_SESSION_ID ||
    `pid-${process.pid}`
  );
}

async function readPayload() {
  if (PAYLOAD_FILE) {
    const raw = await readFile(PAYLOAD_FILE, 'utf-8').catch(() => '');
    await rm(PAYLOAD_FILE, { force: true }).catch(() => {});
    return parseJson(raw);
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return parseJson(Buffer.concat(chunks).toString('utf-8'));
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function excerpt(value, max = 240) {
  if (typeof value !== 'string') return undefined;
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 3)}...`;
}

async function appendSessionEvent(sessionId, event, details) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const line = `${JSON.stringify({ ts: new Date().toISOString(), event, ...details })}\n`;
  await appendFile(runtimeFilePath(sessionId), line, 'utf-8');
}

function isCorrectionPrompt(prompt) {
  if (typeof prompt !== 'string' || prompt.length < 8) return false;
  return CORRECTION_PATTERNS.some((re) => re.test(prompt));
}

function isFailure(payload) {
  const resultType = payload?.resultType ?? payload?.toolResult?.resultType;
  if (resultType === 'failure' || resultType === 'failed' || resultType === 'error') return true;
  return FAILURE_TOOLS.has(payload?.toolName) && resultType && resultType !== 'success';
}

function summarize(events) {
  const candidates = [];
  const corrections = [];
  const failures = [];

  for (const e of events) {
    if (e.event === 'userPromptSubmitted' && isCorrectionPrompt(e.prompt)) {
      const text = `User correction: ${excerpt(e.prompt, 200)}`;
      corrections.push(text);
      candidates.push({ key: lessonKey(text), text, kind: 'correction' });
    }
    if (e.event === 'postToolUse' && isFailure(e)) {
      const text = `${e.toolName} failure: ${excerpt(e.textResult ?? e.toolArgs ?? 'failed', 200)}`;
      failures.push(text);
      candidates.push({ key: lessonKey(text), text, kind: 'failure' });
    }
    if (e.event === 'errorOccurred') {
      const text = `${e.errorName ?? 'Error'} failure: ${excerpt(e.errorMessage, 200)}`;
      failures.push(text);
      candidates.push({ key: lessonKey(text), text, kind: 'error' });
    }
  }

  return {
    candidates: candidates.slice(0, 10),
    corrections,
    failures: failures.slice(0, 5),
  };
}

async function updateInstructionsBlock(ranked) {
  let source;
  try {
    source = await readFile(INSTRUCTIONS_PATH, 'utf-8');
  } catch {
    if (ranked.length === 0) return;
    source = FRONT_MATTER;
  }

  const blockLines = ['## Learned patterns', ''];
  if (ranked.length === 0) {
    blockLines.push('_No repeating patterns yet. Lessons surface here after appearing in 2+ sessions._');
  } else {
    for (const r of ranked) blockLines.push(formatLesson(r));
  }
  const block = `${MARKER_START}\n${blockLines.join('\n')}\n${MARKER_END}`;

  // Find every existing managed block — ours or Lanyard's — and remove them all
  // before writing a single fresh hooks block. We do this so we don't leave
  // stale blocks behind when the file already has one of each.
  const candidates = [
    { start: MARKER_START, end: MARKER_END },
    { start: LEGACY_MARKER_START, end: LEGACY_MARKER_END },
  ];

  const removals = [];
  for (const c of candidates) {
    let from = 0;
    while (true) {
      const s = source.indexOf(c.start, from);
      if (s === -1) break;
      const e = source.indexOf(c.end, s);
      if (e === -1) break;
      removals.push({ start: s, end: e + c.end.length });
      from = e + c.end.length;
    }
  }
  removals.sort((a, b) => a.start - b.start);

  let stripped = source;
  for (let i = removals.length - 1; i >= 0; i--) {
    const r = removals[i];
    stripped = stripped.slice(0, r.start) + stripped.slice(r.end);
  }
  stripped = stripped.replace(/\n{3,}/g, '\n\n').trimEnd();

  const newContent = `${stripped}\n\n${block}\n`;

  await mkdir(dirname(INSTRUCTIONS_PATH), { recursive: true });
  await writeFile(INSTRUCTIONS_PATH, newContent, 'utf-8');
}

async function readSessionEvents(sessionId) {
  const path = runtimeFilePath(sessionId);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, 'utf-8').catch(() => '');
  const events = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return events;
}

async function handleSessionStart(payload) {
  const sessionId = currentSessionId(payload);
  process.env.LANYARD_SESSION_ID = sessionId;
  await appendSessionEvent(sessionId, 'sessionStart', {
    source: payload?.source,
    initialPrompt: excerpt(payload?.initialPrompt, 240),
  });
}

async function handlePrompt(payload) {
  const sessionId = currentSessionId(payload);
  await appendSessionEvent(sessionId, 'userPromptSubmitted', {
    prompt: excerpt(payload?.prompt, 400),
  });
}

async function handlePostToolUse(payload) {
  if (!isFailure(payload)) return;
  const sessionId = currentSessionId(payload);
  await appendSessionEvent(sessionId, 'postToolUse', {
    toolName: payload?.toolName,
    resultType: payload?.toolResult?.resultType,
    textResult: excerpt(payload?.toolResult?.textResultForLlm, 240),
    toolArgs: excerpt(payload?.toolArgs, 240),
  });
}

async function handleError(payload) {
  const sessionId = currentSessionId(payload);
  await appendSessionEvent(sessionId, 'errorOccurred', {
    errorName: payload?.error?.name,
    errorMessage: excerpt(payload?.error?.message, 240),
  });
}

async function handleSessionEnd(payload) {
  const sessionId = currentSessionId(payload);
  const events = await readSessionEvents(sessionId);
  const { candidates } = summarize(events);

  await appendLessonLog(candidates);

  const log = await readLessonLog();
  const ranked = rankLessons(log);
  await updateInstructionsBlock(ranked);

  await trimLessonLog();

  await rm(runtimeFilePath(sessionId), { force: true }).catch(() => {});
}

const handlers = {
  sessionStart: handleSessionStart,
  userPromptSubmitted: handlePrompt,
  postToolUse: handlePostToolUse,
  errorOccurred: handleError,
  sessionEnd: handleSessionEnd,
};

const handler = handlers[EVENT_NAME];
if (handler) {
  try {
    const payload = await readPayload();
    await handler(payload);
  } catch (error) {
    console.error(error?.message ?? String(error));
  }
}

process.exit(0);
