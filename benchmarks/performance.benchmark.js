"use strict";

const { performance } = require("perf_hooks");
const pluginModule = require("../index.js");

const TestAccessory = pluginModule.__test && pluginModule.__test.oppoAccessory;
if (!TestAccessory) {
    throw new Error("Test hooks for oppoAccessory are not exposed.");
}

function createBenchmarkInstance() {
    const instance = Object.create(TestAccessory.prototype);
    instance.config = { chinoppo: false };
    instance.commandNameCache = new Map();
    return instance;
}

function runBenchmark(name, iterations, task) {
    const startedAt = performance.now();
    for (let i = 0; i < iterations; i += 1) {
        task(i);
    }
    const finishedAt = performance.now();
    const totalMs = finishedAt - startedAt;
    const perOpUs = (totalMs * 1000) / iterations;
    console.log(`${name.padEnd(32)} ${iterations.toString().padStart(10)} ops  ${totalMs.toFixed(2).padStart(10)} ms  ${perOpUs.toFixed(3).padStart(10)} us/op`);
}

function run() {
    const instance = createBenchmarkInstance();
    const commandSamples = [
        "QPW OK ON",
        "QPW OK OFF",
        "UPL PLAY",
        "QVL OK 35",
        "SIS OK 2",
        "UAT TH",
    ];
    console.log("homebridge-oppo-udp benchmark");
    console.log("".padEnd(78, "-"));
    runBenchmark("commandName cache miss mix", 120000, (i) => {
        const sample = commandSamples[i % commandSamples.length];
        instance.commandName(`${sample}-${i}`);
    });
    runBenchmark("commandName cache hit mix", 400000, (i) => {
        const sample = commandSamples[i % commandSamples.length];
        instance.commandName(sample);
    });
    runBenchmark("extractCommandCode", 600000, (i) => {
        const sample = i % 2 === 0 ? "#QPW\r\n" : "#SVL 45\r\n";
        instance.extractCommandCode(sample);
    });
    runBenchmark("parseNumericValue", 600000, (i) => {
        const sample = i % 2 === 0 ? "QVL OK 35" : "UVL MUT";
        instance.parseNumericValue(sample);
    });
}

run();
