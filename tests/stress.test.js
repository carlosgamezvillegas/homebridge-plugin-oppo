"use strict";

const assert = require("assert");

const pluginModule = require("../index.js");
const TestAccessory = pluginModule.__test && pluginModule.__test.oppoAccessory;

assert(TestAccessory, "Test hooks for oppoAccessory are not exposed.");

function createServiceStub(initialValues = {}) {
    const characteristicValues = new Map(Object.entries(initialValues));
    return {
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
        },
    };
}

function createBareInstance() {
    const instance = Object.create(TestAccessory.prototype);
    const logStub = () => { };
    logStub.debug = () => { };
    logStub.warn = () => { };
    instance.platform = {
        Characteristic: {
            Active: "Active",
            ActiveIdentifier: "ActiveIdentifier",
            ConfiguredName: "ConfiguredName",
            CurrentMediaState: "CurrentMediaState",
            MotionDetected: "MotionDetected",
            Mute: "Mute",
            On: "On",
            StatusFault: "StatusFault",
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
        chinoppo: false,
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
    instance.OPPO_IP = "192.168.0.10";
    instance.IPReceived = true;
    instance.reconnectionCounter = 0;
    instance.reconnectionTry = 10;
    instance.httpNotResponding = 0;
    instance.newResponse = "";
    instance.playBackState = [false, false, false];
    instance.powerState = false;
    instance.powerStateTV = 0;
    instance.inputState = [true, false, false, false, false, false, false, false, false, false];
    instance.audioType = [false, false];
    instance.HDROutput = [false, false, false];
    instance.currentVolume = 0;
    instance.currentMuteState = true;
    instance.currentVolumeSwitch = false;
    instance.mediaState = 4;
    instance.inputID = 1;
    instance.inputName = "Blu-ray";
    instance.mediaDuration = "Runtime";
    instance.mediaChapter = "Current Chapter";
    instance.mediaAudioFormat = "Video and Audio Format";
    instance.language = "Audio Language";
    instance.chapterElapsedFirst = 0;
    instance.chapterRemainingFirst = 0;
    instance.currentChapterSelector = [0, 0];
    instance.currentMovieProgress = 0;
    instance.currentMovieProgressState = false;
    instance.currentChapterTime = 0;
    instance.currentChapterTimeState = false;
    instance.currentChapterSelectorState = false;
    instance.firstElapsedMovie = 0;
    instance.movieRemaining = 0;
    instance.movieType = "T";
    instance.connectionLimit = false;
    instance.connectionLimitStatus = 0;
    instance.continueSending = true;
    instance.continueSendingUpdate = true;
    instance.mediaDetailsCounter = 0;

    instance.tvService = createServiceStub({ Active: 0, CurrentMediaState: 4, ActiveIdentifier: 1 });
    instance.speakerService = createServiceStub({ Volume: 0, Mute: true });
    instance.play = createServiceStub({ On: false });
    instance.pause = createServiceStub({ On: false });
    instance.stop = createServiceStub({ On: false });
    instance.bluRay = createServiceStub({ ConfiguredName: "Blu-ray" });
    instance.runtime = createServiceStub({ ConfiguredName: "Runtime" });
    instance.currentChaper = createServiceStub({ ConfiguredName: "Current Chapter" });
    instance.audioFormat = createServiceStub({ ConfiguredName: "Video and Audio Format" });
    instance.audioLanguage = createServiceStub({ ConfiguredName: "Audio Language" });
    instance.connectionStatus = createServiceStub({ MotionDetected: false, StatusFault: 0 });

    instance.sendHttp = () => { };
    instance.safeClientWrite = () => true;
    instance.makeUrl = () => "http://127.0.0.1/mock";
    instance.commandLog = () => { };
    instance.netConnect = () => { };
    instance.login = () => { };
    instance.schedulePlaybackDetailQueries = () => { };
    instance.scheduleQueryTask = () => { };
    instance.scheduleTimer = () => { };
    instance.sleep = () => Promise.resolve();
    instance.writeHistory = () => { };

    return instance;
}

async function run() {
    // Stress sending with repetitive commands: should coalesce aggressively.
    {
        const instance = createBareInstance();
        const burst = new Array(1000).fill("#QPW\r\n");
        instance.sending(burst);
        assert(instance.metrics.coalescedCommands > 900, "Repetitive sending burst should coalesce most commands.");
    }

    // Stress sending with unique query payloads: should trigger query cooldown skipping.
    {
        const instance = createBareInstance();
        const burst = [];
        for (let i = 0; i < 1000; i += 1) {
            burst.push(`#QPW TAG${i}\r\n`);
        }
        instance.sending(burst);
        assert(instance.metrics.skippedQueries > 0, "Query cooldown should skip excessive unique query bursts.");
    }

    // Stress decoder by replaying a burst of valid mixed events.
    {
        const instance = createBareInstance();
        const burstPayload = "@QPW OK ON@QVL OK 15@UPL HTTP PLAY@UPL HTTP PAUS@UPL HTTP STOP@";
        for (let i = 0; i < 150; i += 1) {
            await instance.eventDecoder(burstPayload);
        }
        assert.strictEqual(instance.powerState, true, "Burst decode should keep power state coherent.");
        assert.strictEqual(instance.mediaState, 4, "Burst decode should resolve to stopped media state.");
        assert.strictEqual(typeof instance.currentVolume, "number", "Burst decode should keep volume numeric.");
    }

    console.log("Stress checks passed.");
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
