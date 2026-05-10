"use strict";

// Parses the first OPPO command token from protocol payloads, e.g. "#QPW\r\n" -> "QPW".
function extractCommandCode(commandPayload) {
    const normalizedPayload = `${commandPayload || ''}`.replace(/^#/, '').trim();
    const separatorIndex = normalizedPayload.indexOf(' ');
    if (separatorIndex === -1) {
        return normalizedPayload;
    }
    return normalizedPayload.substring(0, separatorIndex);
}

// Extracts numeric payload portions from mixed command/response strings.
function parseNumericValue(eventMessage) {
    return `${eventMessage || ''}`.replace(/^\D+/g, '');
}

module.exports = {
    extractCommandCode,
    parseNumericValue,
};
