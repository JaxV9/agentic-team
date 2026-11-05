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

const agentPO = async (s: S) => {
    const r = await llm.invoke([["system", AgentPO], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentPO done"] };
};

const agentArchitect = async (s: S) => {
    const r = await llm.invoke([["system", AgentPO], ["user", s.input]]);
    return { result: String(r.content), logs: ["agentArchitect done"] };
};