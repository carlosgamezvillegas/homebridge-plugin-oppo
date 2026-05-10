"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { EventEmitter } = require("events");

const pluginModule = require("../index.js");
const TestAccessory = pluginModule.__test && pluginModule.__test.oppoAccessory;

assert(TestAccessory, "Test hooks for oppoAccessory are not exposed.");

function createServiceStub(initialValues = {}) {
    const characteristicValues = new Map(Object.entries(initialValues));
    return {
        updates: [],
        getCharacteristic(characteristicType) {
            if (!characteristicValues.has(characteristicType)) {
                characteristicValues.set(characteristicType, undefined);
            }
            return {
                value: characteristicValues.get(characteristicType),
                updateValue(nextValue) {
                    characteristicValues.set(characteristicType, nextValue);
                    return this;
                },
            };
        },
        updateCharacteristic(characteristicType, nextValue) {
            characteristicValues.set(characteristicType, nextValue);
            this.updates.push([characteristicType, nextValue]);
        },
        addOptionalCharacteristic() {
            return this;
        },
        setCharacteristic(characteristicType, nextValue) {
            characteristicValues.set(characteristicType, nextValue);
            return this;
        },
    };
}

function createBareInstance() {
    const instance = Object.create(TestAccessory.prototype);
    const logStub = () => { };
    logStub.debug = () => { };
    logStub.warn = () => { };
    logStub.info = () => { };
    instance.platform = {
        Characteristic: {
            Active: "Active",
            ActiveIdentifier: "ActiveIdentifier",
            Brightness: "Brightness",
            ConfiguredName: "ConfiguredName",
            CurrentMediaState: "CurrentMediaState",
            CurrentVisibilityState: { SHOWN: 0, HIDDEN: 1 },
            MotionDetected: "MotionDetected",
            Mute: "Mute",
            On: "On",
            RotationSpeed: "RotationSpeed",
            StatusFault: "StatusFault",
            TargetVisibilityState: { SHOWN: 0, HIDDEN: 1 },
            Volume: "Volume",
        },
        log: logStub,
    };
    instance.config = {
        autoIP: false,
        inputButtons: false,
        oppo205: false,
        powerB: false,
        volume: false,
        movieControl: false,
        chapterControl: false,
        chapterSelector: false,
        changeDimmersToFan: false,
    };
    instance.commandNameCache = new Map();
    instance.debugLogWindows = {};
    instance.lastQuerySentAt = {};
    instance.lastCommandSentAt = {};
    instance.scheduledTimers = {};
    instance.metrics = {
        tcpWrites: 0,
        httpRequests: 0,
        skippedQueries: 0,
        coalescedCommands: 0,
        lastMetricsLogAt: Date.now(),
    };
    instance.powerState = false;
    instance.powerStateTV = 0;
    instance.playBackState = [false, false, false];
    instance.inputState = [true, false, false, false, false, false, false, false, false, false];
    instance.HDROutput = [false, false, false];
    instance.audioType = [false, false];
    instance.inputID = 1;
    instance.mediaState = 4;
    instance.currentVolume = 0;
    instance.targetVolume = 100;
    instance.currentMuteState = true;
    instance.currentVolumeSwitch = false;
    instance.inputName = "Blu-ray";
    instance.mediaDuration = "Runtime";
    instance.mediaChapter = "Current Chapter";
    instance.mediaAudioFormat = "Video and Audio Format";
    instance.language = "Audio Language";
    instance.newSubtitle = "";
    instance.showState = false;
    instance.firstConnection = false;
    instance.continueSending = true;
    instance.continueSendingUpdate = true;
    instance.chapterCounter = 0;
    instance.chapterElapsedFirst = 0;
    instance.chapterRemainingFirst = 0;
    instance.currentChapterSelector = [0, 0];
    instance.currentChapterSelectorState = false;
    instance.currentChapterTime = 0;
    instance.currentChapterTimeState = false;
    instance.currentMovieProgress = 0;
    instance.currentMovieProgressState = false;
    instance.firstElapsedMovie = 0;
    instance.movieRemaining = 0;
    instance.movieType = "T";
    instance.connectionLimit = false;
    instance.connectionLimitStatus = 0;
    instance.reconnectionWait = 1000;
    instance.reconnectTimer = null;

    instance.play = createServiceStub({ On: false });
    instance.pause = createServiceStub({ On: false });
    instance.stop = createServiceStub({ On: false });
    instance.tvService = createServiceStub({ Active: 0, CurrentMediaState: 4, ActiveIdentifier: 1 });
    instance.speakerService = createServiceStub({ Volume: 0, Mute: true });
    instance.bluRay = createServiceStub({ ConfiguredName: "Blu-ray" });
    instance.runtime = createServiceStub({ ConfiguredName: "Runtime" });
    instance.currentChaper = createServiceStub({ ConfiguredName: "Current Chapter" });
    instance.audioFormat = createServiceStub({ ConfiguredName: "Video and Audio Format" });
    instance.audioLanguage = createServiceStub({ ConfiguredName: "Audio Language" });
    instance.connectionStatus = createServiceStub({ MotionDetected: false, StatusFault: 0 });

    instance.schedulePlaybackDetailQueries = () => { };
    instance.scheduleQueryTask = () => { };
    instance.scheduleTimer = () => { };
    instance.sending = () => { };
    instance.sleep = () => Promise.resolve();
    instance.writeHistory = () => { };

    return instance;
}

async function run() {
    // Replay integration: process a realistic event stream from fixture data.
    {
        const instance = createBareInstance();
        const scheduledProfiles = [];
        instance.schedulePlaybackDetailQueries = (profileName) => {
            scheduledProfiles.push(profileName);
        };
        const fixturePath = path.resolve(__dirname, "fixtures", "oppo-event-replay.log");
        const replayPayload = fs.readFileSync(fixturePath, "utf8");
        await instance.eventDecoder(replayPayload);
        assert.strictEqual(instance.powerState, true, "Replay should drive power state on.");
        assert.strictEqual(instance.currentVolume, 25, "Replay should decode and apply volume.");
        assert.deepStrictEqual(instance.playBackState, [false, false, false], "Replay stop event should end in stopped state.");
        assert.strictEqual(instance.mediaState, 4, "Stopped playback should map to CurrentMediaState.STOP.");
        assert(scheduledProfiles.includes("http"), "Replay should schedule detail queries for HTTP play profile.");
    }

    // Fault injection: malformed HTTP payload should not crash decoder path.
    {
        const instance = createBareInstance();
        let decoderCalls = 0;
        const originalHttpGet = http.get;
        try {
            http.get = (_url, callback) => {
                const requestStub = {
                    setTimeout() {
                        return requestStub;
                    },
                    on() {
                        return requestStub;
                    },
                    destroy() { },
                };
                const response = new EventEmitter();
                response.setEncoding = () => { };
                callback(response);
                response.emit("data", "{invalid-json");
                response.emit("end");
                return requestStub;
            };
            instance.httpEventDecoder = () => {
                decoderCalls += 1;
            };
            instance.sendHttp("http://127.0.0.1/invalid", "QPW");
            await new Promise((resolve) => setImmediate(resolve));
            assert.strictEqual(decoderCalls, 0, "Malformed JSON should not reach HTTP event decoder.");
            assert.strictEqual(instance.httpNotResponding, 0, "Malformed JSON response should still reset timeout counter.");
        } finally {
            http.get = originalHttpGet;
        }
    }

    // Reconnect storm: repeated scheduling should clear previous pending reconnect timers.
    {
        const instance = createBareInstance();
        const originalSetTimeout = global.setTimeout;
        const originalClearTimeout = global.clearTimeout;
        const clearedTimers = [];
        let timerId = 0;
        global.setTimeout = (task, delayMs) => ({ id: ++timerId, task, delayMs });
        global.clearTimeout = (timerHandle) => {
            if (timerHandle && typeof timerHandle.id !== "undefined") {
                clearedTimers.push(timerHandle.id);
            }
        };
        try {
            instance.scheduleReconnectAttempt();
            instance.scheduleReconnectAttempt();
            instance.scheduleReconnectAttempt();
            assert.strictEqual(clearedTimers.length, 2, "Reconnect scheduler should clear previous timer before replacing it.");
            assert.strictEqual(instance.reconnectTimer.id, 3, "Latest reconnect timer should remain active.");
        } finally {
            global.setTimeout = originalSetTimeout;
            global.clearTimeout = originalClearTimeout;
        }
    }

    // State validation: malformed arrays should normalize to expected shapes.
    {
        const instance = createBareInstance();
        instance.playBackState = [true, "invalid", 1];
        instance.inputState = [true];
        instance.validateStateInvariants();
        assert.deepStrictEqual(instance.playBackState, [true, false, false], "Playback state should normalize to boolean triplet.");
        assert.strictEqual(instance.inputState.length, 10, "Input state should normalize to fixed 10-entry vector.");
        assert.strictEqual(instance.inputState[0], true, "Input state should preserve valid true entries.");
        assert.strictEqual(instance.inputState[1], false, "Input state should fill missing entries with false.");
    }

    console.log("Integration checks passed.");
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
