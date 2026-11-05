# Autonomous Agent Team Workflow

This repository hosts the architecture and execution rules for the autonomous agent team managed via **LangGraph**. The workflow is designed to be fully deterministic, traceable, and secure, relying on a **Single Source of Truth** documented through Markdown files in the `docs/` folder.

---

## 1. Workflow Overview

The development cycle is structured around 3 main phases: **Framing & Isolation**, **Execution & Retroaction Loop** (max. 3 iterations), and **Closure & Release**.

```

[ Workflow Start ]
│
▼

1. PO AGENT (Phase 1: Scope Definition)
│ ─── (Generate docs/SCOPE.md)
▼
┌────────────────────────────────────────┐
│   ⏸️  WAITING_HUMAN_VALIDATION         │
└────────────────────────────────────────┘
│ ─── (User validation)
▼
2. GIT AGENT (Mode: INIT)
│ ─── (Create feature branch after PO scope approval)
▼
3. ARCHITECT AGENT
│ ─── (Generate docs/ARCHITECTURE.md & docs/API_CONTRACTS.md)
▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🔄 Execution & Retroaction Loop (LangGraph - Max 3 iterations)         │
│                                                                        │
│   4. BACKEND & FRONTEND DEV AGENTS                                     │
│        │ ─── (Implementation -> BACKEND_SUMMARY & FRONTEND_SUMMARY)   │
│        ▼                                                               │
│   5. CYBER SECURITY AGENT                                              │
│        ├── ❌ Security Flaws Detected ──> [Retry Devs/Architect]       │
│        └── ✅ Security Gate Passed                                     │
│        ▼                                                               │
│   6. QA / TEST AGENT                                                   │
│        ├── ❌ Test Suite Failures ─────> [Retry Devs/Architect]       │
│        └── ✅ Tests Passed                                             │
│        ▼                                                               │
│   7. PO AGENT (Phase 2: Review & Scope Audit)                          │
│        ├── ❌ REJECTED (Scope Gap / Iteration < 3)  ──> [Retry Loop]   │
│        ├── ⚠️ REJECTED (Scope Gap / Iteration >= 3) ──> [Human Escalation]
│        └── ✅ VALIDATED (GO) ────────────────────────> [Exit loop]    │
└────────────────────────────────────────────────────────────────────────┘
│
▼
4. GIT AGENT (Mode: FINALIZE)
│ ─── (Commit, Tag vX.Y.Z, PR & Release -> docs/RELEASE_NOTES.md)
▼
[ Workflow End ]

```

---

## 2. Agent Roles and Generated Artifacts

| Order  | Agent                      | Core Role                                                                                        | Generated Artifacts / Files                       |
| :----: | :------------------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| **1**  | **PO Agent** (Phase 1)     | Analyzes requirements, defines IN/OUT scope, and establishes binary criteria.                    | `docs/SCOPE.md`                                   |
| **2**  | **Git Agent** (`INIT`)     | Initializes workspace and creates an isolated Git branch (`feature/...`) upon PO scope approval. | State Payload (`INIT`)                            |
| **3**  | **Architect Agent**        | Designs technical architecture and defines interface contracts (API/DTOs).                       | `docs/ARCHITECTURE.md`<br>`docs/API_CONTRACTS.md` |
| **4a** | **Backend Dev Agent**      | Implements backend business logic, persistence, and API endpoints.                               | `docs/BACKEND_SUMMARY.md`                         |
| **4b** | **Frontend Dev Agent**     | Implements user interface, state management, and API integrations.                               | `docs/FRONTEND_SUMMARY.md`                        |
| **5**  | **Cyber Security Agent**   | Audits code and schemas against security risks (OWASP, RBAC, leaks).                             | `docs/CYBER_REPORT.md`                            |
| **6**  | **QA / Test Agent**        | Executes automated test suites and evaluates acceptance criteria compliance.                     | `docs/QA_REPORT.md`                               |
| **7**  | **PO Agent** (Phase 2)     | Performs final audit and autonomous decision (`VALIDATED` vs `REJECTED`).                        | Control Payload                                   |
| **8**  | **Git Agent** (`FINALIZE`) | Versions code (`SemVer`), writes release notes, and creates PR/Tag after PO approval.            | `docs/RELEASE_NOTES.md`<br>`CHANGELOG.md`         |

---

## 3. Retroaction Loop & Rejection Gates (LangGraph)

The workflow incorporates multi-level rejection mechanisms managed by **LangGraph** (max **3 iterations** per global feature flow):

1. **Cyber Gate Rejection:** If `CYBER SECURITY AGENT` detects Critical or High security flaws, it immediately triggers an early retry loop back to the Developers/Architect without waiting for QA or PO review.
2. **QA Gate Rejection:** If `QA / TEST AGENT` detects failing test suites or broken API contracts, it routes the defect report directly back to the Developers.
3. **PO Business Rejection:** `PO AGENT (Phase 2)` performs the final audit. If any binary acceptance criteria from `docs/SCOPE.md` are unmet, it rejects the build and attaches targeted corrective directives.
4. **Human Escalation:** If any rejection gate fails and `iteration_count >= 3`, the workflow pauses with status `HUMAN_INTERVENTION_REQUIRED`.

---

## 4. Documentation Artifacts Structure (`docs/`)

All inter-agent exchanges and decisions rely on structured Markdown files inside the `/docs` directory:

- **`docs/SCOPE.md`**: Functional specifications, IN/OUT execution scope, and binary acceptance criteria (TRUE/FALSE).
- **`docs/ARCHITECTURE.md`**: Technical blueprint (directory trees, tech stacks, dependencies, and isolation rules).
- **`docs/API_CONTRACTS.md`**: Data contracts, DTOs, TypeScript/OpenAPI schemas, and REST/GraphQL endpoints.
- **`docs/BACKEND_SUMMARY.md`**: Backend implementation summary and test execution commands.
- **`docs/FRONTEND_SUMMARY.md`**: UI components overview, views, state management, and API connections.
- **`docs/CYBER_REPORT.md`**: Security audit report, OWASP assessment, and required remediations.
- **`docs/QA_REPORT.md`**: Automated test execution report and PO criteria evaluation state.
- **`docs/RELEASE_NOTES.md`**: Release summary, commit SHA, and Git release identifier.

---

## 5. Security & Execution Principles

- **Zero Code in Architecture / PO:** PO and Architect agents write no executable application code.
- **No Design Component:** The Design Agent has been removed from the pipeline in favor of direct contracts between the Architect and Developer agents.
- **Mandatory Human Validation:** The workflow pauses after Phase 1 of the PO Agent (`WAITING_HUMAN_VALIDATION`) to approve the initial roadmap before branch creation and technical design start.
