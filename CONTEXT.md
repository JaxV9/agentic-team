# AI Context — agentic-team

> **For AI assistants working on this project**: This file is your entry point. It gives you a complete picture of the project without having to explore every file. Read this before anything else.

---

## What is this project?

`agentic-team` is an **autonomous AI agent orchestrator** built with **LangGraph** (TypeScript). It simulates a software development team made up of specialized agents, each with a precise role in a sequential delivery pipeline.

The LLM used is **DeepSeek API** (model: `DeepSeek-V4.1-Flash-1017` by default, `temperature: 0.2`, `maxTokens: 32000`). Requires `DEEPSEEK_API_KEY` env var. Model can be overridden with `DEEPSEEK_MODEL`.

---

## Tech Stack

| Element       | Value                                 |
| ------------- | ------------------------------------- |
| Language      | TypeScript (ESM, `"type": "module"`)  |
| Runtime       | Node.js                               |
| Orchestration | `@langchain/langgraph` ^1.7.0         |
| LLM           | `@langchain/openai` → DeepSeek API    |
| Build         | `tsc` → `dist/`                       |
| Dev           | `tsx watch src/index.ts`              |
| CLI Runner    | `tsx src/run.ts`                      |

---

## Project Structure

```
agentic-team/
├── src/
│   ├── index.ts                  # Entry point: State, Graph, Agent Nodes & File I/O
│   ├── run.ts                    # Interactive CLI runner (handles interrupts & approvals)
│   └── agent_systems/            # System prompts for each agent (Markdown)
│       ├── agent_po.md
│       ├── agent_git.md
│       ├── agent_architect.md
│       ├── agent_backend.md
│       ├── agent_frontend.md
│       ├── agent_cyber.md
│       └── agent_qa_tests.md
├── dist/                         # Compiled build output (do not edit)
├── CONTEXT.md                    # This file
├── README.md                     # Workflow documentation (diagram + table)
├── package.json
├── tsconfig.json
└── makefile
```

---

## How It Works

### LangGraph Architecture

The [`src/index.ts`](src/index.ts) file defines:

1. **The LLM**: a shared `ChatOpenAI` instance pointing to DeepSeek API (`https://api.deepseek.com/v1`).
2. **The State**: a LangGraph `Annotation.Root` with 8 fields:
   - `input: string` — the initial user request
   - `humanFeedback: string` — feedback on rejected scope (from human validation)
   - `status: string` — last agent execution status
   - `defects: Defect[]` — current defect list (rejection details & assigned target)
   - `iteration: number` — number of rejections issued so far (escalates to human at `MAX_REJECTIONS = 3`)
   - `remediationTarget: string` — target agent for fixes (`"Backend" | "Frontend" | "Architect" | "none"`)
   - `route: string` — next node chosen dynamically
   - `logs: string[]` — cumulative log (append reducer)
3. **Agent nodes**: `async (s: S) => {...}` functions that assemble context, call the LLM, parse deliverables (`### FILE: path`) and JSON status payloads, and commit phases via Git.
4. **The StateGraph**: fully compiled with a `MemorySaver` checkpointer, conditional edges (`routeFromState`), retry loops, and human-in-the-loop pauses via LangGraph `interrupt()`.
5. **Interactive Runner**: [`src/run.ts`](src/run.ts) loops on `app.invoke()` and resumes interrupts via LangGraph `Command({ resume })`.

### Agent Output & Status Convention

Each agent prompt receives `OUTPUT_RULES` requiring:
- Files to be emitted as `### FILE: relative/path` inside four backticks (````).
- Written to the target project directory (`WORKDIR`, default `./workspace`).
- A JSON control object on the last line:
  ```json
  { "status": "<STATUS_CODE>", "defects": [...] }
  ```

---

## Sequential Agent Flow

```
PO Agent (SCOPE)
  └─► ⏸️ Human Validation (interrupt: approve or provide feedback)
        └─► Git Agent (INIT) — initializes git repo & creates feature branch
              └─► Architect Agent — generates docs/ARCHITECTURE.md + docs/API_CONTRACTS.md
                    └─► Backend Dev Agent — implements API, routes, DB, etc.
                          └─► Frontend Dev Agent — implements UI components & state
                                └─► Cyber Security Agent — automated security & secret audit
                                      ├─ ❌ SECURITY_REJECTED → routes to Backend / Frontend / Architect (retry loop)
                                      └─ ✅ CYBER_COMPLETE → QA Agent
                                                              ├─ Phase 1: writes automated test files
                                                              ├─ Orchestrator runs TEST_COMMAND (npm test)
                                                              └─ Phase 2: writes docs/QA_REPORT.md
                                                                    ├─ ❌ QA_REJECTED / QA_BLOCKED → routes to dev/arch (retry loop)
                                                                    └─ ✅ QA_COMPLETE → PO Agent (REVIEW)
                                                                                          ├─ ❌ REJECTED (iter < 3) → retry loop
                                                                                          ├─ ❌ REJECTED (iter ≥ 3) → HUMAN_ESCALATION (END)
                                                                                          └─ ✅ VALIDATED → Git Agent (FINALIZE)
                                                                                                              └─► ⏸️ Final Human Validation (interrupt)
```

**Key rules**:
- The flow is **strictly sequential**. Backend and Frontend do **not** run in parallel.
- Retry loops increment `s.iteration`. At 3 rejections without full validation, execution escalates to `END`.

---

## Artifacts Generated by Agents (in target project `WORKDIR`)

> These files are generated at runtime inside the target workspace.

| File                       | Produced by             | Description |
| -------------------------- | ----------------------- | ----------- |
| `docs/SCOPE.md`            | PO Agent (SCOPE)        | Specs, in/out scope, acceptance criteria |
| `docs/ARCHITECTURE.md`     | Architect Agent         | Tech stack, directory trees, rules, conventions |
| `docs/API_CONTRACTS.md`    | Architect Agent         | Endpoint schemas, DTOs, error contracts |
| `docs/BACKEND_SUMMARY.md`  | Backend Dev Agent       | Backend modules, run commands, assumptions |
| `docs/FRONTEND_SUMMARY.md` | Frontend Dev Agent      | Pages, components, consumed endpoints |
| `docs/CYBER_REPORT.md`     | Cyber Security Agent    | Security audit, vulnerability checklist |
| `docs/QA_REPORT.md`        | QA Agent (Phase 2)      | Real test execution results & criteria coverage |
| `docs/PO_REVIEW.md`        | PO Agent (REVIEW)       | Review feedback if scope criteria are not met |
| `docs/RELEASE_NOTES.md`    | Git Agent (FINALIZE)    | Release summary and changelog |
| Source & Test code files   | Dev and QA Agents       | Application source code and test files |

---

## DeepSeek Prompt Caching Rules

DeepSeek uses exact token-prefix caching on disk/memory. All agent calls in `src/index.ts` must follow two strict rules:

1. **Règle 1 : Static First, Dynamic Last**
   - The message list begins with the static system prompt (`system`).
   - In user messages, static context (documents read from disk, large source code blocks via `readSource()`) **must always be placed at the very beginning**.
   - Dynamic elements (user input, mode switches like `MODE: REVIEW`, dynamic defect lists, execution outputs, and human feedback) **must always be placed at the very end**.

2. **Règle 2 : Immuabilité du contexte statique**
   - Large context blocks (e.g. `readSource()`, up to ~50 000 tokens) must not have volatile or dynamic prefixes (timestamps, iteration counters, session IDs, or dynamic phase headers) prepended to them.
   - Any dynamic variation in prefix invalidates the cache for all subsequent tokens.

---

## Security Guardrails

The team is secured against sensitive data leaks (PII/API keys), prompt injection, and infinite budget-exploding loops via three complementary layers:

1. **Layer 1: Data Protection Middleware (PII & Secrets)**
   - Uses native LangChain `piiMiddleware`.
   - Email detection: `"redact"` strategy to sanitize email addresses (`[REDACTED_EMAIL]`).
   - API key detection: regex `/sk-[a-zA-Z0-9]{32}/g` with `"block"` strategy (raises `PIIDetectionError`).
   - Applied to inputs (`applyToInput: true`) before prompts reach DeepSeek.

2. **Layer 2: Human-in-the-Loop (HITL) for Critical Actions**
   - Configured via `HumanInTheLoopMiddleware` and `guardedAgent` (`createAgent`).
   - `editCodeTool`: mandatory interrupt (`interruptOn`) prior to writing or modifying files on disk.
   - `runTestsTool`: runs automatically without human intervention under nominal conditions, but requires approval if the Kill Switch is triggered.

3. **Layer 3: Kill Switch (Emergency Budget & Step Limit)**
   - Tracked dynamically in LangGraph state (`cumulativeCost`, `stepCount`, `totalTokens`).
   - `MAX_BUDGET`: maximum cumulative budget threshold in USD (default: `$2.00`, configurable via `process.env.MAX_BUDGET`).
   - `MAX_STEPS`: maximum execution steps threshold (default: `25`, configurable via `process.env.MAX_STEPS`).
   - Strict exit condition: if either limit is reached, the graph forces an immediate transition to `END` returning an explicit error state (`KILL_SWITCH_HALT`).

---

## Important Conventions

- **Never modify agent prompts** without understanding their JSON control payload — that is what LangGraph uses for routing.
- **Strict Prefix Preservation**: Keep static documents first and dynamic instructions last in every LLM prompt to ensure high DeepSeek cache hit rates.
- **Security Guardrails Enforcement**: Never disable PII or budget middlewares when deploying to production.
- The LLM runs **via DeepSeek API** — requires `DEEPSEEK_API_KEY` to be set.
