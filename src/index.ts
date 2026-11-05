import { readFileSync } from "node:fs";
import { ChatOllama } from "@langchain/ollama";
import { Annotation, StateGraph, START, END, MemorySaver } from "@langchain/langgraph";

const llm = new ChatOllama({
    model: "qwen2.5-coder:7b",
    temperature: 0.2,
    numCtx: 8192,
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

const agentPO = async (s: S) => {
    const r = await llm.invoke([["system", AgentPO], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentPO done"] };
};

const agentGit = async (s: S) => {
    const r = await llm.invoke([["system", AgentGIT], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentGit done"] };
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