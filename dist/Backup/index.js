"use strict";
const settings_1 = require("./settings");
const platform_1 = require("./platform");
const console = require('console');
const net = require('net');
const OPPO_IP = '69.104.58.112';
const OPPO_PORT = 23;
let timer;
const timeout = 2000;
let powerState = false;
let playBackState = [false, false, false];
let HDROutput = [false, false, false];
let key = '';
let client;
key = query('POWER STATUS');
console.log(key);
///Connection to Oppo
client = new net.Socket()
    .on('data', (data) => {
    clearTimeout(timer);
    console.log(`[oppo-udp-20x] [Response] ${data}`);
    eventDecoder(data);
    // client.destroy(); // kill client after server's response
});
client.on('error', (e) => {
    clearTimeout(timer);
    console.log(`[oppo-udp-20x] [Error] ${e}`);
});
client.connect(OPPO_PORT, OPPO_IP, () => {
    clearTimeout(timer);
    console.log(`[oppo-udp-20x] [Sending] ${JSON.stringify(key)}`);
    client.write(key);
});
timer = setTimeout(() => {
    console.log('[ERROR] Attempt at connection exceeded timeout value');
    client.clientSocket.end();
}, timeout);
/////Sending Instructions
function sending(press) {
    console.log('1');
    let i = 0;
    while (i < press.length) {
        console.log(`[oppo-udp-20x] [Sending] ${JSON.stringify(press[i])}`);
        client.write(press[i]);
        i += 1;
    }
}
//////////Current Status
function newPowerState(newValue) {
    if (newValue === true) {
        sending(updatePlayback());
        sending(updateHDRStatus());
    }
    else { }
    powerState = newValue;
    console.log(powerState);
}
function newPlayBackState(newPlay) {
    playBackState = newPlay;
    console.log(playBackState);
}
function newHDRState(newHDR) {
    HDROutput = newHDR;
    console.log(HDROutput);
}
////Get values
function getPowerStatus() {
    return powerState;
}
///Event decoder
function eventDecoder(dataReceived) {
    const str = (`${dataReceived}`);
    const res = str.split('@');
    let i = 0;
    console.log(res);
    while (i < res.length) {
        if (res[i] === '') {
            console.log('hello1');
        }
        else if (res[i].includes('QPW OK OFF')) {
            newPowerState(false);
            newPlayBackState([false, false, false]);
            newHDRState([false, false, false]);
        }
        else if (res[i].includes('POF OK OFF')) {
            console.log('power off');
            newPowerState(false);
            newPlayBackState([false, false, false]);
            newHDRState([false, false, false]);
        }
        else if (res[i].includes('PON OK')) {
            newPowerState(true);
        }
        else if (res[i].includes('QPW OK ON')) {
            newPowerState(true);
        }
        else if (res[i].includes('OK PLAY')) {
            newPlayBackState([true, false, false]);
        }
        else if (res[i].includes('OK PAUSE')) {
            newPlayBackState([false, true, false]);
        }
        else if (res[i].includes('OK STOP')) {
            newPlayBackState([false, false, true]);
        }
        else if (res[i].includes('OK STEP')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('OK FREV')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('OK FFWD')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('OK SCREEN')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('OK SFWD')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('OK SREV')) {
            newPlayBackState([false, false, false]);
        }
        ///Video Type
        else if (res[i].includes('OK HDR')) {
            newHDRState([false, true, false]);
        }
        else if (res[i].includes('OK SDR')) {
            newHDRState([false, false, true]);
        }
        else if (res[i].includes('OK DOV')) {
            newHDRState([true, false, false]);
        }
        //unsolicited events
        else if (res[i].includes('UPW 1')) {
            newPowerState(true);
        }
        else if (res[i].includes('UPW 0')) {
            newPowerState(false);
            newPlayBackState([false, false, false]);
            newHDRState([false, false, false]);
        }
        else if (res[i].includes('UPL PLAY')) {
            newPlayBackState([true, false, false]);
        }
        else if (res[i].includes('UPL PAUS')) {
            newPlayBackState([false, true, false]);
        }
        else if (res[i].includes('UPL STOP')) {
            newPlayBackState([false, false, true]);
        }
        else if (res[i].includes('UPL STPF')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL STPR')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL FFW1')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL FRV1')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL SFW1')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL SRV1')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL HOME')) {
            newPowerState(false);
            newPlayBackState([false, false, false]);
            newHDRState([false, false, false]);
        }
        else if (res[i].includes('UPL MCTR')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL SCSV')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UPL MENUP')) {
            newPlayBackState([false, false, false]);
        }
        else if (res[i].includes('UAT')) {
            sending([query('HDR STATUS')]);
        }
        else if (res[i].includes('U3D 2D')) {
            sending([query('HDR STATUS')]);
            console.log(query('HDR STATUS'));
            sending([query('PLAYBACK STATUS')]);
            console.log(query('HDR STATUS'));
        }
        else { }
        i += 1;
    }
}
///Query
function queryKeys(buttons) {
    buttons.length;
    const keys = [''];
    let i = 0;
    while (i < buttons.length) {
        keys[i] = query(buttons[i]);
        i += 1;
    }
    return keys;
}
function query(qName) {
    let key;
    key = '#';
    switch (qName) {
        //POWER ButtonGroup
        case 'VERBOSE MODE':
            key += 'QVM';
            break;
        case 'POWER STATUS':
            key += 'QPW';
            break;
        case 'CURRENT RESOLUTION':
            key += 'QHD';
            break;
        case 'PLAYBACK STATUS':
            key += 'QPL';
            break;
        case 'AUDIO TYPE':
            key += 'QAT';
            break;
        case 'HDR STATUS':
            key += 'QHS';
            break;
        // case "MEDIA NAME":
        //   key += "QFN";
        // break;      
    }
    key += '\r';
    return key;
}
/////oppo controlls
function pressedButton(name) {
    let key;
    key = '#';
    switch (name) {
        //POWER ButtonGroup
        case 'POWER ON':
            key += 'PON';
            break;
        case 'POWER OFF':
            key += 'POF';
            break;
        case 'VERBOSE MODE 2':
            key += 'SVM 2';
            break;
        //Controlpad ButtonGroup
        case 'CURSOR UP':
            key += 'NUP';
            break;
        case 'CURSOR DOWN':
            key += 'NDN';
            break;
        case 'CURSOR LEFT':
            key += 'NLT';
            break;
        case 'CURSOR RIGHT':
            key += 'NRT';
            break;
        case 'CURSOR ENTER':
            key += 'SEL';
            break;
        //Menu and Back ButtonGroup
        case 'MENU':
            key += 'MNU';
            break;
        case 'BACK':
            key += 'RET';
            break;
        //Transport ButtonGroup
        case 'PLAY':
            key += 'PLA';
            break;
        case 'PAUSE':
            key += 'PAU';
            break;
        case 'STOP':
            key += 'STP';
            break;
        //Transport Scan ButtonGroup
        case 'PREVIOUS':
            key += 'PRE';
            break;
        case 'NEXT':
            key += 'NXT';
            break;
        case 'CLEAR':
            key += 'CLR';
            break;
        case 'TOP MENU':
            key += 'TTL';
            break;
        case 'OPTION':
            key += 'OPT';
            break;
        case 'HOME MENU':
            key += 'HOM';
            break;
        case 'INFO':
            key += 'OSD';
            break;
        case 'SETUP':
            key += 'SET';
            break;
    }
    key += '\r';
    return key;
}
function updateAll() {
    const queryAll = ['POWER STATUS', 'PLAYBACK STATUS', 'HDR STATUS'];
    const KEYS = queryKeys(queryAll);
    return KEYS;
}
function updatePlayback() {
    const queryPlayback = ['PLAYBACK STATUS'];
    const KEYS = queryKeys(queryPlayback);
    return KEYS;
}
function updateHDRStatus() {
    const queryHDR = ['HDR STATUS'];
    const KEYS = queryKeys(queryHDR);
    return KEYS;
}
function turnOffAll() {
    newPowerState(false);
    newHDRState([false, false, false]);
    newPlayBackState([false, false, false]);
}
module.exports = { newPowerState, newPlayBackState, newHDRState, sending, getPowerStatus, query, queryKeys,
    updateAll, updateHDRStatus, turnOffAll, pressedButton };
module.exports = (api) => {
    api.registerPlatform(settings_1.PLATFORM_NAME, platform_1.oppoPlatform);
};
//# sourceMappingURL=index.js.map