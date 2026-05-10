"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const sourcePath = path.resolve(__dirname, "..", "index.js");
const source = fs.readFileSync(sourcePath, "utf8");

// Reconnect timeout checks must be strict comparisons, not assignments.
assert(!source.includes("if (this.netConnectTimeOut = true)"), "Found assignment in netConnect timeout condition.");
assert(/netConnectTimeOut\s*(===|!==)\s*true/.test(source), "Missing strict netConnect timeout guard.");

// Rule handler must be wired into eventDecoder.
assert(source.includes("else if (this.handleEventWithRules(res[i]))"), "eventDecoder is not delegating to handleEventWithRules.");

// Duplicated handled branches should be removed from eventDecoder chain.
assert(!source.includes("else if (res[i].includes('QVM OK 2'))"), "Duplicate QVM OK 2 branch still exists in eventDecoder.");
assert(!source.includes("else if (res[i].includes('QPW OK OFF'))"), "Duplicate QPW OK OFF branch still exists in eventDecoder.");

// Power ON response logic must be present in the rule handler.
assert(source.includes("if (eventMessage.includes('QPW OK ON'))"), "Missing QPW OK ON rule handler.");

// Table-driven playback rules should exist and still schedule detail queries.
assert(source.includes("const PLAYBACK_PLAY_RULES = Object.freeze(["), "Missing PLAYBACK_PLAY_RULES table.");
assert(source.includes("profileName: 'ok'"), "Missing OK play profile.");
assert(source.includes("profileName: 'upl'"), "Missing UPL play profile.");
assert(source.includes("profileName: 'http'"), "Missing HTTP play profile.");
assert(source.includes("this.schedulePlaybackDetailQueries(playRule.profileName"), "Play rule handler not using scheduler.");
assert(source.includes("else if (this.handlePlaybackEvent(res[i]))"), "eventDecoder is not delegating playback events.");
assert(source.includes("else if (this.handleVolumeEvent(res[i]))"), "eventDecoder is not delegating volume events.");

// Timer-managed periodic media updates should be enabled.
assert(source.includes("this.scheduleQueryTask('periodic.media.hdr'"), "Periodic media HDR scheduling missing.");
assert(source.includes("this.scheduleTimer('periodic.media.release'"), "Periodic media release timer missing.");

// Reconnect scheduling should be deduplicated.
assert(source.includes("clearReconnectAttempt()"), "Reconnect dedupe helper is missing.");
assert(source.includes("this.reconnectTimer = setTimeout"), "Reconnect timer handle is not being tracked.");

// Command logging should be table-driven.
assert(source.includes("const COMMAND_LOG_RULES = Object.freeze(["), "Missing command log rule table.");
assert(source.includes("this.applyCommandLogRule(logRule.action, commandPress)"), "Command log rule dispatch missing.");

// UDP decoding and HTTP timeout handling should be optimized.
assert(source.includes("message.toString('utf8')"), "UDP message decoding is not using Buffer.toString.");
assert(source.includes("httpRequest.setTimeout(HTTP_REQUEST_TIMEOUT_MS"), "HTTP timeout handling is missing.");

// HTTP URL routing and AVCHD parsing should use helper-driven logic.
assert(source.includes("const HTTP_URL_ROUTE_RULES = Object.freeze(["), "HTTP URL routing table is missing.");
assert(source.includes("buildMappedHttpUrl(key)"), "HTTP URL mapped route helper is missing.");
assert(source.includes("extractAvchdInputName(bdFilePath)"), "AVCHD input parser helper is missing.");
assert(!source.includes("&& !Object.values(newNameInput)[Object.keys(newNameInput).length - 2] === 'AVCHD'"), "AVCHD parser precedence bug is still present.");

// Audio/language decoding should be table-driven and visibility updates helper-driven.
assert(source.includes("const AUDIO_STATUS_RULES = Object.freeze(["), "Audio status rule table is missing.");
assert(source.includes("const HTTP_AUDIO_STATUS_RULES = Object.freeze(["), "HTTP audio status rule table is missing.");
assert(source.includes("const LANGUAGE_SELECTOR_RULES = Object.freeze(["), "Language selector rule table is missing.");
assert(source.includes("refreshShowState()"), "Playback visibility state helper is missing.");
assert(source.includes("updateConfiguredNameAndVisibility(service, nextValue, shouldShow)"), "ConfiguredName/visibility helper is missing.");

// Input sources should be built through a dedicated helper function.
assert(source.includes("this.buildInputSources();"), "Input source setup is not routed through buildInputSources helper.");
assert(source.includes("createInputSourceService({"), "Input source creation helper is missing.");
assert(source.includes("getOrCreateInputSource(definition)"), "Input source get-or-create helper is missing.");

// Constructor-heavy setup should be split into dedicated service builders.
assert(source.includes("this.buildSpeakerVolumeService();"), "Speaker volume setup is not routed through buildSpeakerVolumeService helper.");
assert(source.includes("this.buildVideoMovieControls();"), "Video/Movie controls are not routed through buildVideoMovieControls helper.");
assert(source.includes("this.buildAdditionalServices(accessory.context.device.oppoDisplayName);"), "Additional services setup is not routed through buildAdditionalServices helper.");
assert(source.includes("buildSpeakerVolumeService()"), "buildSpeakerVolumeService helper is missing.");
assert(source.includes("buildVideoMovieControls()"), "buildVideoMovieControls helper is missing.");
assert(source.includes("buildAdditionalServices(deviceDisplayName)"), "buildAdditionalServices helper is missing.");

// Sync loop should avoid unnecessary characteristic writes.
assert(source.includes("updateCharacteristicIfChanged(service, characteristicType, nextValue)"), "Missing characteristic write guard helper.");
assert(source.includes("this.updateCharacteristicIfChanged(this.service, this.platform.Characteristic.On, this.powerState)"), "Power switch sync is not guarded.");

// History writes should cache directory setup instead of mkdir each call.
assert(source.includes("this.historyDirectoryReady = false;"), "History directory cache state missing.");
assert(source.includes("if (this.historyDirectoryReady && this.historyDirectoryPath === historyDirectory)"), "History directory cache check missing.");

// HTTP health should use failure accounting helper.
assert(source.includes("const recordHttpFailure = (reason) => {"), "HTTP failure accounting helper missing.");
assert(source.includes("this.httpNotResponding = 0;"), "HTTP health reset on response missing.");

console.log("Regression checks passed.");
