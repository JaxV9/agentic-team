import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Command } from "@langchain/langgraph";
import { app, MAX_BUDGET, MAX_STEPS } from "./index.js";

const rl = createInterface({ input: stdin, output: stdout });
const config = { configurable: { thread_id: `run-${Date.now()}` }, recursionLimit: 100 };

const request = process.argv.slice(2).join(" ") || (await rl.question("Request: "));

let next: unknown = { input: request };
while (true) {
    try {
        await app.invoke(next as never, config);
    } catch (err: unknown) {
        console.error("\n❌ Graph execution error:", (err as Error)?.message ?? err);
        break;
    }

    const snap = await app.getState(config);
    if (snap.next.length === 0) break; // Finished (END reached)

    const pending = snap.tasks.flatMap((t) => t.interrupts);
    const value = pending[0]?.value as { message?: string; scope?: string; command?: string } | undefined;
    console.log(`\n⏸  ${value?.message ?? "Paused"}`);
    if (value?.scope) console.log(`\n${value.scope}\n`);
    if (value?.command) console.log(`\nCommand: ${value.command}\n`);

    const answer = (await rl.question("Approve? (y = yes, anything else = feedback) ")).trim();
    next = new Command({
        resume: answer.toLowerCase() === "y" ? { approved: true } : { approved: false, feedback: answer },
    });
}

const final = await app.getState(config);
const vals = final.values as {
    status?: string;
    iteration?: number;
    stepCount?: number;
    cumulativeCost?: number;
    totalTokens?: number;
    killSwitchTriggered?: boolean;
    error?: string;
};

if (vals.killSwitchTriggered || vals.error) {
    console.error(`\n🚨 EMERGENCY STOP TRIGGERED: ${vals.error ?? "Kill Switch active"}`);
}

console.log("\nDone.");
console.log(`- Final status: ${vals.status}`);
console.log(`- Rejections: ${vals.iteration ?? 0}`);
console.log(`- Step count: ${vals.stepCount ?? 0} (Max: ${MAX_STEPS})`);
console.log(`- Cumulative cost: $${(vals.cumulativeCost ?? 0).toFixed(4)} (Max budget: $${MAX_BUDGET.toFixed(2)})`);
console.log(`- Total tokens: ${vals.totalTokens ?? 0}`);

rl.close();
