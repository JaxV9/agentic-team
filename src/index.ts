import { readFileSync } from "node:fs";
import { ChatOllama } from "@langchain/ollama";
import { Annotation, StateGraph, START, END, MemorySaver, interrupt } from "@langchain/langgraph";

const llm = new ChatOllama({
    model: "qwen2.5-coder:14b",
    temperature: 0.2,
    numCtx: 16384,
});

const State = Annotation.Root({
    input: Annotation<string>(),
    result: Annotation<string>(),

    logs: Annotation<string[]>({
        reducer: (ancien, nouveau) => [...ancien, ...nouveau],
        default: () => [],
    }),
});
type S = typeof State.State;

const AgentPO = readFileSync(new URL("./agent_systems/agent_po.md", import.meta.url), "utf-8");
const AgentGIT = readFileSync(new URL("./agent_systems/agent_git.md", import.meta.url), "utf-8");
const AgentArchitect = readFileSync(new URL("./agent_systems/agent_architect.md", import.meta.url), "utf-8");
const AgentBackend = readFileSync(new URL("./agent_systems/agent_backend.md", import.meta.url), "utf-8");
const AgentFrontend = readFileSync(new URL("./agent_systems/agent_frontend.md", import.meta.url), "utf-8");
const AgentCyber = readFileSync(new URL("./agent_systems/agent_cyber.md", import.meta.url), "utf-8");
const AgentQaTests = readFileSync(new URL("./agent_systems/agent_qa_tests.md", import.meta.url), "utf-8");

// Extract the JSON control payload from an agent's markdown response
function extractPayload(result: string): Record<string, unknown> {
    const match = result.match(/```json\s*([\s\S]*?)```/);
    if (!match || !match[1]) return {};
    try {
        return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
        return {};
    }
}

const agentPO = async (s: S) => {
    const r = await llm.invoke([["system", AgentPO], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentPO done"] };
};

// Pause and wait for human approval before continuing
const humanValidation = async (s: S) => {
    interrupt({ message: "PO scope ready — approve to continue", result: s.result });
    return { logs: ["humanValidation done"] };
};

const agentGitInit = async (s: S) => {
    const prompt = `${s.input}\n\nMode: INIT — create the feature branch.`;
    const r = await llm.invoke([["system", AgentGIT], ["user", prompt]]);
    return { result: String(r.content), logs: ["agentGitInit done"] };
};

const agentArchitect = async (s: S) => {
    const r = await llm.invoke([["system", AgentArchitect], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentArchitect done"] };
};

const agentBackend = async (s: S) => {
    const r = await llm.invoke([["system", AgentBackend], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentBackend done"] };
};

const agentFrontend = async (s: S) => {
    const r = await llm.invoke([["system", AgentFrontend], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentFrontend done"] };
};

const agentCyber = async (s: S) => {
    const r = await llm.invoke([["system", AgentCyber], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentCyber done"] };
};

const agentQaTests = async (s: S) => {
    const r = await llm.invoke([["system", AgentQaTests], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentQaTests done"] };
};

const agentGitFinalize = async (s: S) => {
    const prompt = `${s.input}\n\nMode: FINALIZE — commit, tag, and release.`;
    const r = await llm.invoke([["system", AgentGIT], ["user", prompt]]);
    return { result: String(r.content), logs: ["agentGitFinalize done"] };
};

// Pause for final human sign-off before closing the workflow
const finalHumanValidation = async (s: S) => {
    interrupt({ message: "Release ready — final human approval", result: s.result });
    return { logs: ["finalHumanValidation done"] };
};

// Routing after Cyber Security audit
function routeAfterCyber(s: S): string {
    const payload = extractPayload(s.result);
    const next = String(payload.next_agent ?? "");

    if (next === "QA Agent") return "agentQaTests";
    if (next === "Backend Developer Agent") return "agentBackend";
    if (next === "Frontend Developer Agent") return "agentFrontend";
    if (next === "Architect Agent") return "agentArchitect";
    return END; // HUMAN_ESCALATION or unknown
}

// Routing after QA tests
function routeAfterQA(s: S): string {
    const payload = extractPayload(s.result);
    const next = String(payload.next_agent ?? "");

    if (next === "PO Agent") return "agentPO_review";
    if (next === "Backend Developer Agent") return "agentBackend";
    if (next === "Frontend Developer Agent") return "agentFrontend";
    if (next === "Architect Agent") return "agentArchitect";
    return END; // HUMAN_ESCALATION or unknown
}

// Routing after PO review (Phase 2)
function routeAfterPOReview(s: S): string {
    const payload = extractPayload(s.result);
    const next = String(payload.next_agent ?? "");

    if (next === "Git Agent (FINALIZE)") return "agentGitFinalize";
    if (next === "Backend Developer Agent") return "agentBackend";
    if (next === "Frontend Developer Agent") return "agentFrontend";
    if (next === "Architect Agent") return "agentArchitect";
    return END; // HUMAN_ESCALATION or max iterations reached
}

// PO Phase 2 node — reuses the same LLM call but is a separate graph node for routing
const agentPO_review = async (s: S) => {
    const r = await llm.invoke([["system", AgentPO], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentPO_review done"] };
};

const memory = new MemorySaver();

const graph = new StateGraph(State)
    .addNode("agentPO", agentPO)
    .addNode("humanValidation", humanValidation)
    .addNode("agentGitInit", agentGitInit)
    .addNode("agentArchitect", agentArchitect)
    .addNode("agentBackend", agentBackend)
    .addNode("agentFrontend", agentFrontend)
    .addNode("agentCyber", agentCyber)
    .addNode("agentQaTests", agentQaTests)
    .addNode("agentPO_review", agentPO_review)
    .addNode("agentGitFinalize", agentGitFinalize)
    .addNode("finalHumanValidation", finalHumanValidation)

    // Linear start
    .addEdge(START, "agentPO")
    .addEdge("agentPO", "humanValidation")
    .addEdge("humanValidation", "agentGitInit")
    .addEdge("agentGitInit", "agentArchitect")
    .addEdge("agentArchitect", "agentBackend")
    .addEdge("agentBackend", "agentFrontend")
    .addEdge("agentFrontend", "agentCyber")

    // Conditional routing from Cyber (pass → QA, fail → Backend/Frontend/Architect, escalate → END)
    .addConditionalEdges("agentCyber", routeAfterCyber, {
        agentQaTests: "agentQaTests",
        agentBackend: "agentBackend",
        agentFrontend: "agentFrontend",
        agentArchitect: "agentArchitect",
        [END]: END,
    })

    // Conditional routing from QA (pass → PO review, fail → Backend/Frontend/Architect, escalate → END)
    .addConditionalEdges("agentQaTests", routeAfterQA, {
        agentPO_review: "agentPO_review",
        agentBackend: "agentBackend",
        agentFrontend: "agentFrontend",
        agentArchitect: "agentArchitect",
        [END]: END,
    })

    // Conditional routing from PO review (validated → Finalize, rejected → retry loop, escalate → END)
    .addConditionalEdges("agentPO_review", routeAfterPOReview, {
        agentGitFinalize: "agentGitFinalize",
        agentBackend: "agentBackend",
        agentFrontend: "agentFrontend",
        agentArchitect: "agentArchitect",
        [END]: END,
    })

    .addEdge("agentGitFinalize", "finalHumanValidation")
    .addEdge("finalHumanValidation", END);

export const app = graph.compile({
    checkpointer: memory,
    interruptBefore: ["humanValidation", "finalHumanValidation"],
});