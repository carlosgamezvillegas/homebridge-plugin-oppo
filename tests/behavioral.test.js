"use strict";

const assert = require("assert");
const { EventEmitter } = require("events");
const http = require("http");

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
            return { value: characteristicValues.get(characteristicType) };
        },
        updateCharacteristic(characteristicType, nextValue) {
            characteristicValues.set(characteristicType, nextValue);
            this.updates.push([characteristicType, nextValue]);
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
            ActiveIdentifier: "ActiveIdentifier",
            MotionDetected: "MotionDetected",
            StatusFault: "StatusFault",
            CurrentMediaState: "CurrentMediaState",
            Volume: "Volume",
            Mute: "Mute",
            ConfiguredName: "ConfiguredName",
            TargetVisibilityState: { SHOWN: 0, HIDDEN: 1 },
            CurrentVisibilityState: { SHOWN: 0, HIDDEN: 1 },
            On: "On",
            Active: "Active",
            Brightness: "Brightness",
            RotationSpeed: "RotationSpeed",
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
    instance.metrics = {
        tcpWrites: 0,
        httpRequests: 0,
        skippedQueries: 0,
        coalescedCommands: 0,
        lastMetricsLogAt: Date.now(),
    };
    return instance;
}

// commandName cache behavior
{
    const instance = createBareInstance();
    instance.config.chinoppo = false;
    const responseKey = "QPW OK ON";
    const first = instance.commandName(responseKey);
    const second = instance.commandName(responseKey);
    assert.strictEqual(first, second, "Command name should be stable.");
    assert.strictEqual(instance.commandNameCache.get(responseKey), first, "Command name should be cached.");
}

// newInputState mapping behavior
{
    const instance = createBareInstance();
    const updates = [];
    instance.inputState = [false, false, false, false, false, false, false, false, false, false];
    instance.tvService = {
        getCharacteristic() {
            return { value: 4 };
        },
        updateCharacteristic(characteristicType, nextValue) {
            updates.push([characteristicType, nextValue]);
        },
    };
    instance.newInputState([false, false, false, false, false, false, true, false, false, false]);
    assert.strictEqual(instance.inputID, 7, "Input ID should map to selected input index + 1.");
    assert.deepStrictEqual(updates.pop(), ["ActiveIdentifier", 7], "ActiveIdentifier should be updated for selected input.");
    updates.length = 0;
    instance.newInputState([false, false, false, false, false, false, false, false, false, false]);
    assert.strictEqual(instance.inputID, 4, "All-false input state should preserve HomeKit active identifier.");
    assert.deepStrictEqual(updates.pop(), ["ActiveIdentifier", 4], "ActiveIdentifier should be updated from HomeKit fallback.");
}

// debug log rate limiting behavior
{
    const instance = createBareInstance();
    let debugCalls = 0;
    instance.platform.log.debug = () => {
        debugCalls += 1;
    };
    const originalNow = Date.now;
    let nowMs = 1000;
    Date.now = () => nowMs;
    try {
        instance.debugLogRateLimited("hot.path", 1000, "one");
        instance.debugLogRateLimited("hot.path", 1000, "two");
        nowMs += 1001;
        instance.debugLogRateLimited("hot.path", 1000, "three");
    } finally {
        Date.now = originalNow;
    }
    assert.strictEqual(debugCalls, 2, "Rate limiter should suppress repetitive logs inside the window.");
}

// split sync loop behavior (connection + state ticks)
{
    const instance = createBareInstance();
    let netConnectCalls = 0;
    let metricsCalls = 0;
    instance.reconnectionCounter = 0;
    instance.reconnectionTry = 3;
    instance.connectionLimit = false;
    instance.connectionLimitStatus = 0;
    instance.IPReceived = false;
    instance.netConnect = () => {
        netConnectCalls += 1;
    };
    instance.logMetricsIfNeeded = () => {
        metricsCalls += 1;
    };
    instance.debugLogRateLimited = () => { };
    instance.runConnectionHealthTick();
    assert.strictEqual(netConnectCalls, 1, "Connection health tick should reconnect when client is missing.");
    assert.strictEqual(metricsCalls, 1, "Connection health tick should flush metrics.");
}

{
    const instance = createBareInstance();
    const bluRayService = createServiceStub({ ConfiguredName: "Blu-ray" });
    const connectionStatusService = createServiceStub({ MotionDetected: false, StatusFault: 0 });
    const tvService = createServiceStub({ CurrentMediaState: 4, ActiveIdentifier: 1 });
    const speakerService = createServiceStub({ Volume: 0, Mute: true });
    const runtimeService = createServiceStub({ ConfiguredName: "Runtime" });
    const chapterService = createServiceStub({ ConfiguredName: "Current Chapter" });
    const audioFormatService = createServiceStub({ ConfiguredName: "Video and Audio Format" });
    const audioLanguageService = createServiceStub({ ConfiguredName: "Audio Language" });
    let powerCalls = 0;
    let playbackCalls = 0;
    let hdrCalls = 0;
    let audioCalls = 0;
    let inputCalls = 0;
    instance.cachedCharacteristics = {
        bluRayConfiguredName: { value: "Blu-ray" },
        connectionMotionDetected: { value: false },
        connectionStatusFault: { value: 0 },
        tvCurrentMediaState: { value: 4 },
        tvActiveIdentifier: { value: 1 },
        speakerVolume: { value: 0 },
        speakerMute: { value: true },
        runtimeConfiguredName: { value: "Runtime" },
        currentChapterConfiguredName: { value: "Current Chapter" },
        audioFormatConfiguredName: { value: "Video and Audio Format" },
        audioLanguageConfiguredName: { value: "Audio Language" },
    };
    instance.bluRay = bluRayService;
    instance.connectionStatus = connectionStatusService;
    instance.tvService = tvService;
    instance.speakerService = speakerService;
    instance.runtime = runtimeService;
    instance.currentChaper = chapterService;
    instance.audioFormat = audioFormatService;
    instance.audioLanguage = audioLanguageService;
    instance.inputName = "Blu-ray";
    instance.powerState = false;
    instance.playBackState = [false, false, false];
    instance.HDROutput = [false, false, true];
    instance.audioType = [false, false];
    instance.inputState = [true, false, false, false, false, false, false, false, false, false];
    instance.mediaDuration = "Runtime";
    instance.mediaChapter = "Current Chapter";
    instance.mediaAudioFormat = "Video and Audio Format";
    instance.language = "Audio Language";
    instance.showState = false;
    instance.currentMovieProgress = 0;
    instance.currentMovieProgressState = false;
    instance.currentChapterTime = 0;
    instance.currentChapterTimeState = false;
    instance.currentChapterSelector = [0, 0];
    instance.newPowerState = () => { powerCalls += 1; };
    instance.newPlayBackState = () => { playbackCalls += 1; };
    instance.newHDRState = () => { hdrCalls += 1; };
    instance.newAudioType = () => { audioCalls += 1; };
    instance.newInputState = () => { inputCalls += 1; };
    instance.runStateSyncTick();
    assert.strictEqual(powerCalls, 1, "State sync tick should process power state.");
    assert.strictEqual(playbackCalls, 1, "State sync tick should process playback state.");
    assert.strictEqual(hdrCalls, 1, "State sync tick should process HDR state.");
    assert.strictEqual(audioCalls, 1, "State sync tick should process audio state.");
    assert.strictEqual(inputCalls, 1, "State sync tick should process input state.");
}

// HTTP transport behavior
{
    const instance = createBareInstance();
    const originalHttpGet = http.get;
    instance.httpNotResponding = 0;
    instance.httpEventDecoder = () => { };
    try {
        http.get = () => {
            const req = {
                setTimeout(_ms, cb) {
                    cb();
                    return req;
                },
                on() {
                    return req;
                },
                destroy() { },
            };
            return req;
        };
        instance.sendHttp("http://127.0.0.1/timeout", "QPW");
        assert.strictEqual(instance.httpNotResponding, 1, "HTTP timeout should increment failure counter.");
        assert.strictEqual(instance.metrics.httpRequests, 1, "HTTP request metric should increment.");
    } finally {
        http.get = originalHttpGet;
    }
}

{
    const instance = createBareInstance();
    const originalHttpGet = http.get;
    let decodedPayload = null;
    instance.httpNotResponding = 2;
    instance.httpEventDecoder = (payload, key) => {
        decodedPayload = { payload, key };
    };
    try {
        http.get = (_url, callback) => {
            const req = {
                setTimeout() {
                    return req;
                },
                on() {
                    return req;
                },
                destroy() { },
            };
            const response = new EventEmitter();
            response.setEncoding = () => { };
            callback(response);
            response.emit("data", "{\"success\":true}");
            response.emit("end");
            return req;
        };
        instance.sendHttp("http://127.0.0.1/success", "QPW");
        assert.strictEqual(instance.httpNotResponding, 0, "HTTP success should reset failure counter.");
        assert.deepStrictEqual(decodedPayload, { payload: { success: true }, key: "QPW" }, "HTTP decoder should receive parsed payload.");
    } finally {
        http.get = originalHttpGet;
    }
}

// HTTP URL builder behavior
{
    const instance = createBareInstance();
    instance.OPPO_IP = "192.168.0.55";
    instance.localIP = "192.168.0.4";
    instance.httpNotResponding = 0;
    instance.newResponse = "by HTTP";
    const powerUrl = instance.makeUrl("#QPW\r\n");
    const volumeUrl = instance.makeUrl("#SVL 45\r\n");
    const searchUrl = instance.makeUrl("#SRH T 01:02:03\r\n");
    const chapterSearchFallbackUrl = instance.makeUrl("#SRH C3\r\n");
    assert.strictEqual(powerUrl, "http://192.168.0.55:436/getglobalinfo", "QPW should route to global info endpoint.");
    assert.strictEqual(volumeUrl, "http://192.168.0.55:436/setvolume?%7B%22cur_vol%22%3A45%2C%22connectId%22%3A%22192.168.0.4%22%7D", "SVL should route to setvolume endpoint.");
    assert.strictEqual(searchUrl, "http://192.168.0.55:436/setplaytime?{\"h\":1,\"m\":2,\"s\":3}", "SRH time command should build setplaytime payload.");
    assert.strictEqual(chapterSearchFallbackUrl, "http://192.168.0.55:436/sendremotekey?%7B%22key%22%3A%22SRHC3%22%7D", "Unsupported SRH chapter command should fall back to remote key route.");
}

// AVCHD input-name parsing behavior
{
    const instance = createBareInstance();
    const parsedNames = [];
    instance.newInputName = (nextName) => {
        parsedNames.push(nextName);
    };
    instance.eventDecoder = () => { };
    instance.httpEventDecoder({
        success: true,
        playinfo: {
            file_path: "AVCHD",
            bd_file_path: "/media/NAS/My Movie/AVCHD/BDMV",
        },
    }, "#QFN");
    instance.httpEventDecoder({
        success: true,
        playinfo: {
            file_path: "AVCHD",
            bd_file_path: "/media/NAS/Concert/BDMV",
        },
    }, "#QFN");
    instance.httpEventDecoder({
        success: true,
        playinfo: {
            file_path: "AVCHD",
        },
    }, "#QFN");
    assert.deepStrictEqual(parsedNames, ["My Movie", "Concert", "AVCHD"], "AVCHD parser should extract stable media names.");
}

// Runtime cleanup behavior
{
    const instance = createBareInstance();
    let discoveryClosed = 0;
    let serverClosed = 0;
    let clientEnded = 0;
    let clientDestroyed = 0;
    instance.reconnectTimer = setTimeout(() => { }, 60000);
    instance.hourlyReconnectTimer = setTimeout(() => { }, 60000);
    instance.connectionInterval = setInterval(() => { }, 60000);
    instance.syncInterval = setInterval(() => { }, 60000);
    instance.historyInterval = setInterval(() => { }, 60000);
    instance.scheduledTimers = {
        "playback.release": setTimeout(() => { }, 60000),
        "periodic.media.audio": setTimeout(() => { }, 60000),
    };
    instance.discovery = {
        removeAllListeners() { },
        close() {
            discoveryClosed += 1;
        },
    };
    instance.server = {
        removeAllListeners() { },
        close() {
            serverClosed += 1;
        },
    };
    instance.client = {
        end() {
            clientEnded += 1;
        },
        removeAllListeners() { },
        destroy() {
            clientDestroyed += 1;
        },
    };
    instance.cleanupRuntimeResources();
    assert.strictEqual(instance.reconnectTimer, null, "Reconnect timer should be cleared.");
    assert.strictEqual(instance.hourlyReconnectTimer, null, "Hourly reconnect timer should be cleared.");
    assert.strictEqual(instance.connectionInterval, null, "Connection interval should be cleared.");
    assert.strictEqual(instance.syncInterval, null, "Sync interval should be cleared.");
    assert.strictEqual(instance.historyInterval, null, "History interval should be cleared.");
    assert.strictEqual(discoveryClosed, 1, "Discovery socket should be closed during cleanup.");
    assert.strictEqual(serverClosed, 1, "UDP server should be closed during cleanup.");
    assert.strictEqual(clientEnded, 1, "TCP client should be ended during cleanup.");
    assert.strictEqual(clientDestroyed, 1, "TCP client should be destroyed during cleanup.");
    assert(!("client" in instance), "Client reference should be removed after cleanup.");
}

// Rule-driven decoder behavior
{
    const instance = createBareInstance();
    let audioFormat = "";
    instance.newAudioFormat = (nextValue) => {
        audioFormat = nextValue;
    };
    instance.newAudioStatus("QAT OK DD");
    assert.strictEqual(audioFormat, "Dolby TrueHD (Atmos)", "Audio status decoder should honor priority rules.");
    instance.newAudioStatusHttp("Track Dolby Digital Plus");
    assert.strictEqual(audioFormat, "Dolby Digital Plus", "HTTP audio decoder should map Digital Plus.");
    instance.newAudioStatusHttp("foo bar CUSTOM");
    assert.strictEqual(audioFormat, "CUSTOM", "HTTP audio decoder fallback should preserve tokenized format.");
    assert.strictEqual(instance.newLanguageSelector("UAT ENG"), "English", "Language decoder should map ENG.");
    assert.strictEqual(instance.newLanguageSelector("UAT ZHO"), "Chinese", "Language decoder should map ZHO.");
    assert.strictEqual(instance.newLanguageSelector("UAT ???"), "Language Undefined", "Language decoder should fallback when unknown.");
}

// Media name extension normalization
{
    const instance = createBareInstance();
    assert.strictEqual(instance.stripMediaNameExtension("Movie.ISO"), "Movie", "ISO extension should be stripped.");
    assert.strictEqual(instance.stripMediaNameExtension("Track.mp3"), "Track", "MP3 extension should be stripped.");
    assert.strictEqual(instance.stripMediaNameExtension("Concert.flac"), "Concert.flac", "Unknown extension should stay unchanged.");
}

console.log("Behavioral checks passed.");
