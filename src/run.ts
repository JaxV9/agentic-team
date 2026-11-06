import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Command } from "@langchain/langgraph";
import { app } from "./index.js";

const rl = createInterface({ input: stdin, output: stdout });
// recursionLimit is raised: 3 rejections x several nodes exceed the default of 25
const config = { configurable: { thread_id: `run-${Date.now()}` }, recursionLimit: 100 };

const request = process.argv.slice(2).join(" ") || (await rl.question("Request: "));

let next: unknown = { input: request };
while (true) {
    await app.invoke(next as never, config);
    const snap = await app.getState(config);
    if (snap.next.length === 0) break; // finished (END reached)

    const pending = snap.tasks.flatMap((t) => t.interrupts);
    const value = pending[0]?.value as { message?: string; scope?: string } | undefined;
    console.log(`\n⏸  ${value?.message ?? "Paused"}`);
    if (value?.scope) console.log(`\n${value.scope}\n`);

    const answer = (await rl.question("Approve? (y = yes, anything else = feedback) ")).trim();
    next = new Command({
        resume: answer.toLowerCase() === "y" ? { approved: true } : { approved: false, feedback: answer },
    });
}

const final = await app.getState(config);
console.log("\nDone. Final status:", final.values.status, "| rejections:", final.values.iteration);
rl.close();