"use strict";

const MIN_POLLING_INTERVAL_MS = 250;
const INPUT_STATE_LENGTH = 10;
const PLAYBACK_STATE_LENGTH = 3;

function normalizeInputState(inputState) {
    const normalizedState = new Array(INPUT_STATE_LENGTH).fill(false);
    if (!Array.isArray(inputState)) {
        return normalizedState;
    }
    for (let i = 0; i < INPUT_STATE_LENGTH; i += 1) {
        normalizedState[i] = inputState[i] === true;
    }
    return normalizedState;
}

function normalizePlaybackState(playbackState) {
    const normalizedState = new Array(PLAYBACK_STATE_LENGTH).fill(false);
    if (!Array.isArray(playbackState)) {
        return normalizedState;
    }
    for (let i = 0; i < PLAYBACK_STATE_LENGTH; i += 1) {
        normalizedState[i] = playbackState[i] === true;
    }
    return normalizedState;
}

function validateRuntimeConfig(config, defaultConfig) {
    const validatedConfig = { ...config };
    const warnings = [];
    for (const key in defaultConfig) {
        const defaultValue = defaultConfig[key];
        const currentValue = validatedConfig[key];
        if (typeof defaultValue === 'boolean') {
            if (typeof currentValue !== 'boolean') {
                validatedConfig[key] = defaultValue;
                if (typeof currentValue !== 'undefined') {
                    warnings.push(`Config "${key}" must be boolean. Using default (${defaultValue}).`);
                }
            }
            continue;
        }
        if (typeof defaultValue === 'number') {
            if (typeof currentValue !== 'number' || Number.isNaN(currentValue)) {
                validatedConfig[key] = defaultValue;
                if (typeof currentValue !== 'undefined') {
                    warnings.push(`Config "${key}" must be number. Using default (${defaultValue}).`);
                }
            }
            continue;
        }
        if (typeof defaultValue === 'string') {
            if (typeof currentValue !== 'string' || currentValue.trim() === '') {
                validatedConfig[key] = defaultValue;
                if (typeof currentValue !== 'undefined') {
                    warnings.push(`Config "${key}" must be non-empty string. Using default.`);
                }
            }
        }
    }
    const pollingInterval = Math.round(validatedConfig.pollingInterval);
    if (!Number.isFinite(pollingInterval) || pollingInterval < MIN_POLLING_INTERVAL_MS) {
        validatedConfig.pollingInterval = MIN_POLLING_INTERVAL_MS;
        warnings.push(`Config "pollingInterval" was too low. Clamped to ${MIN_POLLING_INTERVAL_MS}ms.`);
    }
    else {
        validatedConfig.pollingInterval = pollingInterval;
    }
    if (validatedConfig.oppo205 !== true && validatedConfig.inputButtons === true) {
        warnings.push('Oppo 205-only controls (Optical/Coaxial/USB Audio In) stay disabled because "oppo205" is false.');
    }
    if (validatedConfig.oppo205 === true && validatedConfig.inputButtons !== true) {
        warnings.push('oppo205 is enabled but "inputButtons" is false, so Oppo 205 input controls will not be created.');
    }
    if (validatedConfig.changeDimmersToFan === true
        && validatedConfig.volume !== true
        && validatedConfig.movieControl !== true
        && validatedConfig.chapterControl !== true
        && validatedConfig.chapterSelector !== true) {
        warnings.push('changeDimmersToFan is enabled but no dimmer/fan controls are enabled; setting has no effect.');
    }
    return {
        config: validatedConfig,
        warnings,
    };
}

module.exports = {
    normalizeInputState,
    normalizePlaybackState,
    validateRuntimeConfig,
};
