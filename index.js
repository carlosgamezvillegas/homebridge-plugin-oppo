"use strict";
// @ts-check
const PLATFORM_NAME = 'oppoPlugin';
const PLUGIN_NAME = 'homebridge-oppo-udp';
const net = require("net");
const request = require('http')
const OPPO_PORT = 23;
const timeout = 2000;
const udp = require('dgram');
const {
    extractCommandCode: extractCommandCodeFromPayload,
    parseNumericValue: parseNumericValueFromPayload,
} = require('./lib/command-utils');
const {
    SERVICE_IDS,
    SERVICE_NAMES,
} = require('./lib/service-constants');
const {
    normalizeInputState,
    normalizePlaybackState,
    validateRuntimeConfig: validateRuntimeConfigShape,
} = require('./lib/runtime-validation');
const IPV4_REGEX = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const QUERY_COMMANDS = Object.freeze({
    'VERBOSE MODE': 'QVM',
    'POWER STATUS': 'QPW',
    'CURRENT RESOLUTION': 'QHD',
    'PLAYBACK STATUS': 'QPL',
    'AUDIO TYPE': 'QAT',
    'HDR STATUS': 'QHS',
    'INPUT STATUS': 'QIS',
    'VOLUME STATUS': 'QVL',
    'MEDIA NAME': 'QFN',
    'CHAPTER NUMBER': 'QCH',
    'CHAPTER TIME REMAINING': 'QCR',
    'CHAPTER TIME ELAPSED': 'QCE',
    'MEDIA TIME ELAPSED': 'QEL',
    'MEDIA TIME REMAINING': 'QRE',
    'MTR': 'MTR',
    'FIRMWARE': 'QVR',
});
const BUTTON_COMMANDS = Object.freeze({
    'POWER OFF': 'POF',
    'VERBOSE MODE 2': 'SVM 2',
    'VERBOSE MODE 3': 'SVM 3',
    'EJECT': 'EJT',
    'CURSOR UP': 'NUP',
    'CURSOR DOWN': 'NDN',
    'CURSOR LEFT': 'NLT',
    'CURSOR RIGHT': 'NRT',
    'CURSOR ENTER': 'SEL',
    'MENU': 'MNU',
    'BACK': 'RET',
    'PLAY': 'PLA',
    'PAUSE': 'PAU',
    'STOP': 'STP',
    'PREVIOUS': 'PRE',
    'NEXT': 'NXT',
    'CLEAR': 'CLR',
    'TOP MENU': 'TTL',
    'HOME MENU': 'HOM',
    'INFO': 'OSD',
    'SETUP': 'SET',
    'REWIND': 'REV',
    'FORWARD': 'FWD',
    'BLURAY INPUT': 'SIS 0',
    'HDMI IN': 'SIS 1',
    'HDMI OUT': 'SIS 2',
    'OPTICAL INPUT': 'SIS 3',
    'COAXIAL INPUT': 'SIS 4',
    'USB AUDIO INPUT': 'SIS 5',
    'DIMMER': 'DIM',
    'PURE AUDIO': 'PUR',
    'GO TO': 'GOT',
    'PAGE UP': 'PUP',
    'PAGE DOWN': 'PDN',
    'POP-UP MENU': 'MNU',
    'RED': 'RED',
    'GREEN': 'GRN',
    'BLUE': 'BLU',
    'YELLOW': 'YLW',
    'AUDIO': 'AUD',
    'SUBTITLE': 'SUB',
    'ANGLE': 'ANG',
    'ZOOM': 'ZOM',
    'SAP': 'SAP',
    'AB REPLAY': 'ATB',
    'REPEAT': 'RPT',
    'PIP': 'PIP',
    'RESOLUTION': 'HDM',
    'OPTION': 'OPT',
    '3D': 'M3D',
    'PIC': 'SEH',
    'HDR': 'HDR',
    'SUBTITTLE (HOLD)': 'SUH',
    'INFO (HOLD)': 'INH',
    'RESOLUTION (HOLD)': 'RLH',
    'AV SYNC': 'AVS',
    'GAPLESS PLAY': 'GPA',
    'INPUT': 'SRC',
    'VOLUME UP': 'VUP',
    'VOLUME DOWN': 'VDN',
    'ELAPTSED TIME': 'STC T',
    'RESET': 'RST',
});
const TCP_ROUTED_CODES = new Set([
    'RST',
    'PON',
    'SVM',
    'SIS',
    'SVL',
    'SRH',
    'QVM',
    'QPW',
    'POF',
    'QHD',
    'QPL',
    'QIS',
    'QVL',
    'QCH',
    'QCR',
    'QCE',
    'QEL',
    'QRE',
    'QVR',
    'EJT',
    'QHS',
]);
const DEFAULT_CONFIG = Object.freeze({
    name: 'Oppo 203',
    manufacture: 'Oppo',
    pollingInterval: 1000,
    modelName: 'UDP-203',
    serialN: 'B210U71647033894',
    autoIP: false,
    inputButtons: false,
    oppo205: false,
    volume: false,
    mediaButtons: false,
    cursorUpB: false,
    cursorDownB: false,
    cursorLeftB: false,
    cursorRightB: false,
    cursorEnterB: false,
    menuB: false,
    backButtonB: false,
    clearB: false,
    topMenuB: false,
    optionB: false,
    homeMenuB: false,
    infoB: false,
    setupB: false,
    goToB: false,
    pageUpB: false,
    pageDownB: false,
    popUpMenuB: false,
    dimmerB: false,
    pureAudioB: false,
    redB: false,
    yellowB: false,
    blueB: false,
    audioB: false,
    greenB: false,
    subtitleB: false,
    angleB: false,
    zoomB: false,
    sapB: false,
    abReplayB: false,
    repeatB: false,
    pipB: false,
    resolutionB: false,
    threeDB: false,
    pictureB: false,
    hdrButtonB: false,
    subtitleHoldB: false,
    infoHoldB: false,
    resolutionHoldB: false,
    avSyncB: false,
    gaplessPlayB: false,
    inputB: false,
    ejectDiscB: false,
    movieControl: false,
    chapterControl: false,
    chapterSelector: false,
    chinoppo: false,
    powerB: false,
    mediaAudioVideoState: false,
    changeDimmersToFan: false,
    remainMovieTimer: false,
    infoToMenu: false,
});
const STATELESS_SWITCH_CONFIGS = Object.freeze([
    { configKey: 'cursorUpB', propertyName: 'cursorUp', serviceName: 'Cursor Up', uniqueId: SERVICE_IDS.STATELESS_CURSOR_UP, commandName: 'CURSOR UP' },
    { configKey: 'cursorDownB', propertyName: 'cursorDown', serviceName: 'Cursor Down', uniqueId: SERVICE_IDS.STATELESS_CURSOR_DOWN, commandName: 'CURSOR DOWN' },
    { configKey: 'cursorLeftB', propertyName: 'cursorLeft', serviceName: 'Cursor Left', uniqueId: SERVICE_IDS.STATELESS_CURSOR_LEFT, commandName: 'CURSOR LEFT' },
    { configKey: 'cursorRightB', propertyName: 'cursorRight', serviceName: 'Cursor Right', uniqueId: SERVICE_IDS.STATELESS_CURSOR_RIGHT, commandName: 'CURSOR RIGHT' },
    { configKey: 'cursorEnterB', propertyName: 'cursorEnter', serviceName: 'Cursor Enter', uniqueId: SERVICE_IDS.STATELESS_CURSOR_ENTER, commandName: 'CURSOR ENTER' },
    { configKey: 'menuB', propertyName: 'menu', serviceName: 'Menu', uniqueId: SERVICE_IDS.STATELESS_MENU, commandName: 'MENU' },
    { configKey: 'backButtonB', propertyName: 'backButton', serviceName: 'Back', uniqueId: SERVICE_IDS.STATELESS_BACK, commandName: 'BACK' },
    { configKey: 'clearB', propertyName: 'clear', serviceName: 'Clear', uniqueId: SERVICE_IDS.STATELESS_CLEAR, commandName: 'CLEAR' },
    { configKey: 'topMenuB', propertyName: 'topMenuB', serviceName: 'Top Menu', uniqueId: SERVICE_IDS.STATELESS_TOP_MENU, commandName: 'TOP MENU' },
    { configKey: 'optionB', propertyName: 'option', serviceName: 'Option', uniqueId: SERVICE_IDS.STATELESS_OPTION, commandName: 'OPTION' },
    { configKey: 'homeMenuB', propertyName: 'homeMenu', serviceName: 'Home Menu', uniqueId: SERVICE_IDS.STATELESS_HOME_MENU, commandName: 'HOME MENU' },
    { configKey: 'infoB', propertyName: 'infoButton', serviceName: 'Info', uniqueId: SERVICE_IDS.STATELESS_INFO, commandName: 'INFO' },
    { configKey: 'setupB', propertyName: 'setup', serviceName: 'Setup', uniqueId: SERVICE_IDS.STATELESS_SETUP, commandName: 'SETUP' },
    { configKey: 'goToB', propertyName: 'goTo', serviceName: 'Go To', uniqueId: SERVICE_IDS.STATELESS_GOTO, commandName: 'GO TO' },
    { configKey: 'pageUpB', propertyName: 'pageUp', serviceName: 'Page Up', uniqueId: SERVICE_IDS.STATELESS_PAGE_UP, commandName: 'PAGE UP' },
    { configKey: 'pageDownB', propertyName: 'pageDown', serviceName: 'Page Down', uniqueId: SERVICE_IDS.STATELESS_PAGE_DOWN, commandName: 'PAGE DOWN' },
    { configKey: 'popUpMenuB', propertyName: 'popUpMenu', serviceName: 'Pop-Up Menu', uniqueId: SERVICE_IDS.STATELESS_POPUP_MENU, commandName: 'POP-UP MENU' },
    { configKey: 'mediaButtons', propertyName: 'previous', serviceName: 'Previous', uniqueId: SERVICE_IDS.STATELESS_PREVIOUS, commandName: 'PREVIOUS' },
    { configKey: 'mediaButtons', propertyName: 'next', serviceName: 'Next', uniqueId: SERVICE_IDS.STATELESS_NEXT, commandName: 'NEXT' },
    { configKey: 'mediaButtons', propertyName: 'rewindButton', serviceName: 'Rewind', uniqueId: SERVICE_IDS.STATELESS_REWIND, commandName: 'REWIND' },
    { configKey: 'mediaButtons', propertyName: 'forwardButton', serviceName: 'Forward', uniqueId: SERVICE_IDS.STATELESS_FORWARD, commandName: 'FORWARD' },
    { configKey: 'dimmerB', propertyName: 'dimmer', serviceName: 'Dimmer', uniqueId: SERVICE_IDS.STATELESS_DIMMER, commandName: 'DIMMER' },
    { configKey: 'pureAudioB', propertyName: 'pureAudio', serviceName: 'Pure Audio', uniqueId: SERVICE_IDS.STATELESS_PURE_AUDIO, commandName: 'PURE AUDIO' },
    { configKey: 'redB', propertyName: 'red', serviceName: 'Red', uniqueId: SERVICE_IDS.STATELESS_RED, commandName: 'RED' },
    { configKey: 'greenB', propertyName: 'green', serviceName: 'Green', uniqueId: SERVICE_IDS.STATELESS_GREEN, commandName: 'GREEN' },
    { configKey: 'blueB', propertyName: 'blue', serviceName: 'Blue', uniqueId: SERVICE_IDS.STATELESS_BLUE, commandName: 'BLUE' },
    { configKey: 'yellowB', propertyName: 'yellow', serviceName: 'Yellow', uniqueId: SERVICE_IDS.STATELESS_YELLOW, commandName: 'YELLOW' },
    { configKey: 'audioB', propertyName: 'audio', serviceName: 'Audio', uniqueId: SERVICE_IDS.STATELESS_AUDIO, commandName: 'AUDIO' },
    { configKey: 'subtitleB', propertyName: 'subtitle', serviceName: 'Subtitle', uniqueId: SERVICE_IDS.STATELESS_SUBTITLE, commandName: 'SUBTITLE' },
    { configKey: 'angleB', propertyName: 'angle', serviceName: 'Angle', uniqueId: SERVICE_IDS.STATELESS_ANGLE, commandName: 'ANGLE' },
    { configKey: 'zoomB', propertyName: 'zoom', serviceName: 'Zoom', uniqueId: SERVICE_IDS.STATELESS_ZOOM, commandName: 'ZOOM' },
    { configKey: 'sapB', propertyName: 'sap', serviceName: 'SAP', uniqueId: SERVICE_IDS.STATELESS_SAP, commandName: 'SAP' },
    { configKey: 'abReplayB', propertyName: 'abReplay', serviceName: 'AB Replay', uniqueId: SERVICE_IDS.STATELESS_AB_REPLAY, commandName: 'AB REPLAY' },
    { configKey: 'repeatB', propertyName: 'repeat', serviceName: 'Repeat', uniqueId: SERVICE_IDS.STATELESS_REPEAT, commandName: 'REPEAT' },
    { configKey: 'pipB', propertyName: 'pip', serviceName: 'PIP', uniqueId: SERVICE_IDS.STATELESS_PIP, commandName: 'PIP' },
    { configKey: 'resolutionB', propertyName: 'resolution', serviceName: 'Resolution', uniqueId: SERVICE_IDS.STATELESS_RESOLUTION, commandName: 'RESOLUTION' },
    { configKey: 'threeDB', propertyName: 'threeD', serviceName: '3D', uniqueId: SERVICE_IDS.STATELESS_3D, commandName: '3D' },
    { configKey: 'pictureB', propertyName: 'picture', serviceName: 'Picture', uniqueId: SERVICE_IDS.STATELESS_PICTURE, commandName: 'PIC' },
    { configKey: 'hdrButtonB', propertyName: 'hdrButton', serviceName: 'HDR Button', uniqueId: SERVICE_IDS.STATELESS_HDR_BUTTON, commandName: 'HDR' },
    { configKey: 'subtitleHoldB', propertyName: 'subtitleHold', serviceName: 'Subtitle (Hold)', uniqueId: SERVICE_IDS.STATELESS_SUBTITLE_HOLD, commandName: 'SUBTITTLE (HOLD)' },
    { configKey: 'infoHoldB', propertyName: 'infoHold', serviceName: 'Info (Hold)', uniqueId: SERVICE_IDS.STATELESS_INFO_HOLD, commandName: 'INFO (HOLD)' },
    { configKey: 'resolutionHoldB', propertyName: 'resolutionHold', serviceName: 'Resolution (Hold)', uniqueId: SERVICE_IDS.STATELESS_RESOLUTION_HOLD, commandName: 'RESOLUTION (HOLD)' },
    { configKey: 'avSyncB', propertyName: 'avSync', serviceName: 'AV SYNC', uniqueId: SERVICE_IDS.STATELESS_AV_SYNC, commandName: 'AV SYNC' },
    { configKey: 'gaplessPlayB', propertyName: 'gaplessPlay', serviceName: 'Gapless Play', uniqueId: SERVICE_IDS.STATELESS_GAPLESS_PLAY, commandName: 'GAPLESS PLAY' },
    { configKey: 'inputB', propertyName: 'input', serviceName: 'Input', uniqueId: SERVICE_IDS.STATELESS_INPUT, commandName: 'INPUT' },
    { configKey: 'ejectDiscB', propertyName: 'ejectDisc', serviceName: 'Eject-Load Disc', uniqueId: SERVICE_IDS.STATELESS_EJECT_DISC, commandName: 'EJECT', logLabel: 'Eject/Load Disc' },
]);
const COMMAND_NAME_RULES = Object.freeze([
    { patterns: ['PON'], label: 'Power On' },
    { patterns: ['POF'], label: 'Power Off' },
    { patterns: ['SVM 2'], label: 'Verbose Mode 2' },
    { patterns: ['SVM 3'], label: 'Verbose Mode 3' },
    { patterns: ['NUP'], label: 'Cursor Up' },
    { patterns: ['NDN'], label: 'Cursor Down' },
    { patterns: ['NLT'], label: 'Cursor Left' },
    { patterns: ['NRT'], label: 'Cursor Right' },
    { patterns: ['SEL'], label: 'Enter' },
    { patterns: ['MNU'], label: 'Menu' },
    { patterns: ['RET'], label: 'Back' },
    { patterns: ['PAU'], label: SERVICE_NAMES.PAUSE },
    { patterns: ['STP'], label: SERVICE_NAMES.STOP },
    { patterns: ['PRE'], label: 'Previous Chapter' },
    { patterns: ['NXT'], label: 'Next Chapter' },
    { patterns: ['CLR'], label: 'Clear' },
    { patterns: ['TTL'], label: 'Top Menu' },
    { patterns: ['OPT'], label: 'Option' },
    { patterns: ['DISC MENU'], label: 'Disc Menu Screen' },
    { patterns: ['MEDIA CENTER'], label: 'Media Center Screen' },
    { patterns: ['HOME MENU', 'UPL HOME'], label: 'Home Menu Screen' },
    { patterns: ['HOM'], label: 'Home Menu' },
    { patterns: ['OSD'], label: 'Information' },
    { patterns: ['SET'], label: 'Setup' },
    { patterns: ['REV'], label: 'Rewind' },
    { patterns: ['FWD'], label: 'Forward' },
    { patterns: ['SIS 0', 'SIS OK 0', 'QIS OK 0'], label: 'Bluray Input' },
    { patterns: ['SIS 1', 'SIS OK 1', 'QIS OK 1'], label: 'HDMI In' },
    { patterns: ['SIS 2', 'SIS OK 2', 'QIS OK 2'], label: 'HDMI Out' },
    { patterns: ['SIS 3', 'SIS OK 3', 'QIS OK 3'], label: 'Optical In' },
    { patterns: ['SIS 4', 'SIS OK 4', 'QIS OK 4'], label: 'Coaxial In' },
    { patterns: ['SIS 5', 'SIS OK 5', 'QIS OK 5'], label: 'USB Audio In' },
    { patterns: ['DIM'], label: 'Dimmer' },
    { patterns: ['PUR'], label: 'Pure Audio' },
    { patterns: ['GOT'], label: 'Go To' },
    { patterns: ['PUP'], label: 'Page Up' },
    { patterns: ['PDN'], label: 'Page Down' },
    { patterns: ['RED'], label: 'Red' },
    { patterns: ['GRN'], label: 'Green' },
    { patterns: ['BLU'], label: 'Blue' },
    { patterns: ['YLW'], label: 'Yellow' },
    { patterns: ['AUD'], label: 'Audio' },
    { patterns: ['SUB'], label: 'Subtitle' },
    { patterns: ['ANG'], label: 'Angle' },
    { patterns: ['ZOM'], label: 'Zoom' },
    { patterns: ['SAP'], label: 'SAP' },
    { patterns: ['ATB'], label: 'AB Replay' },
    { patterns: ['RPT'], label: 'Repeat' },
    { patterns: ['PIP'], label: 'PIP' },
    { patterns: ['HDM'], label: 'Resolution' },
    { patterns: ['M3D'], label: '3D' },
    { patterns: ['SEH'], label: 'Picture' },
    { patterns: ['HDR'], label: 'HDR' },
    { patterns: ['SUH'], label: 'Subtitle (Hold)' },
    { patterns: ['INH'], label: 'Information (Hold)' },
    { patterns: ['RLH'], label: 'Resolution (Hold)' },
    { patterns: ['AVS'], label: 'AV Sync' },
    { patterns: ['GPA'], label: 'Gapless Play' },
    { patterns: ['SRC'], label: 'Input' },
    { patterns: ['VUP'], label: 'Volume Up' },
    { patterns: ['VDN'], label: 'Volume Down' },
    { patterns: ['STC T'], label: 'Elapse Time' },
    { patterns: ['RST'], label: 'Reset Command Queue' },
    { patterns: ['QVM'], label: 'Verbose Mode Status Query' },
    { patterns: ['UPL SCSV'], label: 'Screen Saver On' },
    { patterns: ['USB IN'], label: 'USB Connected' },
    { patterns: ['USB OU'], label: 'USB Disconnected' },
    { patterns: ['QPW'], label: 'Power Status Query' },
    { patterns: ['QHD'], label: 'Current Resolution Query' },
    { patterns: ['QPL'], label: 'Playback Status Query' },
    { patterns: ['QAT'], label: 'Audio Type Query' },
    { patterns: ['QHS'], label: 'HDR Status Query' },
    { patterns: ['QIS'], label: 'Input Status Query' },
    { patterns: ['PLA'], label: SERVICE_NAMES.PLAY },
    { patterns: ['QVL'], label: 'Volume Status Query' },
    { patterns: ['QFN'], label: 'Media Name Query' },
    { patterns: ['QCH'], label: 'Chapter Number Query' },
    { patterns: ['QCR'], label: 'Chapter Time Remaining Query' },
    { patterns: ['QCE'], label: 'Chapter Time Elapsed Query' },
    { patterns: ['QEL'], label: 'Media Time Elapsed Query' },
    { patterns: ['QRE', 'MTR'], label: 'Media Time Remaining Query' },
    { patterns: ['QVR'], label: 'Firmware Query' },
]);
const COMMAND_NAME_NO_SUFFIX_PATTERNS = Object.freeze(['DISC MENU', 'MEDIA CENTER', 'UPL HOME', 'HOME MENU', 'USB IN', 'USB OU']);
const QUERY_COMMAND_COOLDOWNS_MS = Object.freeze({
    QHS: 5000,
    QAT: 4000,
    QFN: 5000,
    QVL: 3000,
    QPL: 2500,
    QIS: 2500,
    QPW: 2000,
    QRE: 2500,
    QEL: 2500,
    MTR: 2500,
    QCH: 3500,
    QCR: 3500,
    QCE: 3500,
});
const PLAYBACK_PLAY_RULES = Object.freeze([
    Object.freeze({
        patterns: Object.freeze(['UPL HTTP PLAY']),
        resetCounter: false,
        setPowerOn: true,
        logMessage: 'Response: Play Executed by HTTP',
        profileName: 'http',
        startDelayMs: 20100,
        offsets: Object.freeze({ mtr: 12000, audio: 18000, hdr: 20000, media: 15500 }),
    }),
    Object.freeze({
        patterns: Object.freeze(['UPL PLAY']),
        resetCounter: false,
        setPowerOn: true,
        logMessage: 'Response: Play Executed (UPL)',
        profileName: 'upl',
        startDelayMs: 20100,
        offsets: Object.freeze({ mtr: 12000, audio: 18000, hdr: 20100, media: 15500 }),
    }),
    Object.freeze({
        patterns: Object.freeze(['OK PLAY', 'PLA OK']),
        resetCounter: true,
        setPowerOn: false,
        logMessage: 'Response: Play Executed (OK)',
        profileName: 'ok',
        startDelayMs: 5100,
        offsets: Object.freeze({ mtr: 800, audio: 1500, hdr: 3000, media: 5000 }),
    }),
]);
const PLAYBACK_PAUSE_RULES = Object.freeze([
    Object.freeze({
        patterns: Object.freeze(['UPL HTTP PAUS']),
        resetCounter: false,
        logMessage: 'Response: Pause Executed by HTTP',
    }),
    Object.freeze({
        patterns: Object.freeze(['UPL PAUS']),
        resetCounter: false,
        logMessage: 'Response: Pause Executed (UPL)',
    }),
    Object.freeze({
        patterns: Object.freeze(['OK PAUSE', 'PAU OK']),
        resetCounter: true,
        logMessage: 'Response: Pause Executed',
    }),
]);
const PLAYBACK_STOP_RULES = Object.freeze([
    Object.freeze({
        patterns: Object.freeze(['UPL HTTP STOP']),
        resetCounter: false,
        logMessage: 'Response: Stop Executed by HTTP',
        logOnlyWhenPowered: true,
        hdrResetMode: 'whenPowered',
        resetOrder: 'movieThenMedia',
    }),
    Object.freeze({
        patterns: Object.freeze(['UPL STOP']),
        resetCounter: false,
        logMessage: 'Response: Stop Executed (UPL)',
        logOnlyWhenPowered: false,
        hdrResetMode: 'always',
        resetOrder: 'mediaThenMovie',
    }),
    Object.freeze({
        patterns: Object.freeze(['OK STOP', 'STP OK']),
        resetCounter: true,
        logMessage: 'Response: Stop Executed',
        logOnlyWhenPowered: false,
        hdrResetMode: 'always',
        resetOrder: 'movieThenMedia',
    }),
]);
const PLAYBACK_UPL_PROGRESS_PATTERNS = Object.freeze(['UPL STPF', 'UPL STPR', 'UPL FFW1', 'UPL FRV1', 'UPL SFW1', 'UPL SRV1', 'UPL MCTR', 'UPL MENUP', 'UPL SCSV']);
const PLAYBACK_OK_PROGRESS_PATTERNS = Object.freeze(['OK STEP', 'OK FREV', 'OK FFWD', 'OK SFWD', 'OK SREV', 'ER OVERTIME', 'OK MEDIA', 'OK SETUP', 'OK SCREEN', 'OK DISC']);
const PLAYBACK_HOME_MENU_PATTERNS = Object.freeze(['HOME MENU', 'UPL HOME']);
const COMMAND_LOG_RULES = Object.freeze([
    Object.freeze({ patterns: Object.freeze(['QVM', 'RST', 'QCE', 'QCH', 'QRE']), action: 'debugCommand' }),
    Object.freeze({ patterns: Object.freeze(['SRH T']), action: 'searchTitleTime' }),
    Object.freeze({ patterns: Object.freeze(['SRH C']), action: 'searchChapterTime' }),
    Object.freeze({ patterns: Object.freeze(['SRH']), action: 'searchTime' }),
    Object.freeze({ patterns: Object.freeze(['SVL']), action: 'volumeChange' }),
    Object.freeze({ patterns: Object.freeze(['QPW']), action: 'powerStatusQuery' }),
    Object.freeze({ patterns: Object.freeze(['PON']), action: 'powerOn' }),
]);
const HTTP_URL_ROUTE_RULES = Object.freeze([
    Object.freeze({ patterns: Object.freeze(['QRE', 'MTR']), endpoint: 'getplayingtime', logMode: 'default' }),
    Object.freeze({ patterns: Object.freeze(['QPL', 'QIS', 'QPW']), endpoint: 'getglobalinfo', logMode: 'default' }),
    Object.freeze({ patterns: Object.freeze(['QVL']), endpoint: 'getvolume', logMode: 'default' }),
    Object.freeze({ patterns: Object.freeze(['QFN']), endpoint: 'getmovieplayinfo', logMode: 'mediaNameQuery' }),
    Object.freeze({ patterns: Object.freeze(['SIS']), endpoint: 'sendremotekey?%7B%22SRC%22%3A%22SRC%22%7D', logMode: 'inputChange' }),
    Object.freeze({ patterns: Object.freeze(['QAT']), endpoint: 'getaudiomenulist', logMode: 'default' }),
]);
const MEDIA_NAME_EXTENSIONS = Object.freeze(['.iso', '.mkv', '.mp4', '.mp3']);
const AUDIO_STATUS_RULES = Object.freeze([
    Object.freeze({ patterns: Object.freeze(['DT', 'Dolby TrueHD', 'QAT OK DD']), label: 'Dolby TrueHD (Atmos)' }),
    Object.freeze({ patterns: Object.freeze(['DD']), label: 'Dolby Digital' }),
    Object.freeze({ patterns: Object.freeze(['DP', 'Dolby Digital Plus']), label: 'Dolby Digital Plus' }),
    Object.freeze({ patterns: Object.freeze(['TS']), label: SERVICE_NAMES.DTS }),
    Object.freeze({ patterns: Object.freeze(['TM', 'DTS-HD']), label: 'DTS HD MA - DTS X' }),
    Object.freeze({ patterns: Object.freeze(['TH']), label: 'DTS HD High Resolution' }),
    Object.freeze({ patterns: Object.freeze(['PC']), label: 'LPCM' }),
    Object.freeze({ patterns: Object.freeze(['MP']), label: 'MPEG Audio' }),
    Object.freeze({ patterns: Object.freeze(['CD']), label: 'CD Audio' }),
    Object.freeze({ patterns: Object.freeze(['UNK']), label: 'Unknown' }),
]);
const HTTP_AUDIO_STATUS_RULES = Object.freeze([
    Object.freeze({ patterns: Object.freeze(['Digital Plus']), label: 'Dolby Digital Plus' }),
    Object.freeze({ patterns: Object.freeze(['Dolby Digital']), label: 'Dolby Digital' }),
    Object.freeze({ patterns: Object.freeze(['TrueHD']), label: 'Dolby TrueHD (Atmos)' }),
    Object.freeze({ patterns: Object.freeze(['DTS-HD High', 'DTS HD High']), label: 'DTS-HD High Resolution' }),
    Object.freeze({ patterns: Object.freeze(['DTS HD Master', 'DTS HD MA']), label: 'DTS HD MA - DTS X' }),
    Object.freeze({ patterns: Object.freeze([SERVICE_NAMES.DTS]), label: SERVICE_NAMES.DTS }),
    Object.freeze({ patterns: Object.freeze(['LPCM']), label: 'LPCM' }),
    Object.freeze({ patterns: Object.freeze(['MPEG']), label: 'MPEG Audio' }),
    Object.freeze({ patterns: Object.freeze(['CD Audio']), label: 'CD Audio' }),
]);
const LANGUAGE_SELECTOR_RULES = Object.freeze([
    Object.freeze({ patterns: Object.freeze(['ENG']), label: 'English' }),
    Object.freeze({ patterns: Object.freeze(['ARA']), label: 'Arabic' }),
    Object.freeze({ patterns: Object.freeze(['CAT']), label: 'Catalan' }),
    Object.freeze({ patterns: Object.freeze(['CHI', 'ZHO']), label: 'Chinese' }),
    Object.freeze({ patterns: Object.freeze(['CES', 'CZE']), label: 'Czech' }),
    Object.freeze({ patterns: Object.freeze(['DAN']), label: 'Danish' }),
    Object.freeze({ patterns: Object.freeze(['DEU', 'GMH', 'GOH']), label: 'German' }),
    Object.freeze({ patterns: Object.freeze(['DUM', 'DUT']), label: 'Dutch' }),
    Object.freeze({ patterns: Object.freeze(['EGY']), label: 'Egyptina' }),
    Object.freeze({ patterns: Object.freeze(['ELL', 'GRC', 'GRE']), label: 'Greek' }),
    Object.freeze({ patterns: Object.freeze(['FIN']), label: 'Finnish' }),
    Object.freeze({ patterns: Object.freeze(['FRA', 'FRE', 'FRM', 'FRO']), label: 'French' }),
    Object.freeze({ patterns: Object.freeze(['HEB']), label: 'Hebrew' }),
    Object.freeze({ patterns: Object.freeze(['HIN']), label: 'Hindi' }),
    Object.freeze({ patterns: Object.freeze(['HRV']), label: 'Croatina' }),
    Object.freeze({ patterns: Object.freeze(['HUN']), label: 'Hungarian' }),
    Object.freeze({ patterns: Object.freeze(['ICE', 'ISL']), label: 'Icelandic' }),
    Object.freeze({ patterns: Object.freeze(['ITA']), label: 'Italian' }),
    Object.freeze({ patterns: Object.freeze(['JPN']), label: 'Japanese' }),
    Object.freeze({ patterns: Object.freeze(['KOR']), label: 'Korian' }),
    Object.freeze({ patterns: Object.freeze(['PEO', 'PER']), label: 'Perian' }),
    Object.freeze({ patterns: Object.freeze(['POL']), label: 'Polish' }),
    Object.freeze({ patterns: Object.freeze(['POR']), label: 'Portuguese' }),
    Object.freeze({ patterns: Object.freeze(['RUS']), label: 'Russian' }),
    Object.freeze({ patterns: Object.freeze(['RON', 'RUN']), label: 'Romanian' }),
    Object.freeze({ patterns: Object.freeze(['SPA']), label: 'Spanish' }),
    Object.freeze({ patterns: Object.freeze(['TUR']), label: 'Turkish' }),
    Object.freeze({ patterns: Object.freeze(['UND']), label: 'Language Undefined' }),
    Object.freeze({ patterns: Object.freeze(['UNK']), label: 'Unknown' }),
]);
const HTTP_REQUEST_TIMEOUT_MS = 4000;
/**
 * @typedef {boolean[]} InputStateVector
 * Input-state vector where index 0-9 map to Blu-ray/HDMI/Optical/Coaxial/USB routes.
 */
/**
 * @typedef {boolean[]} PlaybackStateVector
 * Playback-state vector in [playing, paused, stopped] order.
 */
/**
 * @typedef {{tcpWrites:number,httpRequests:number,skippedQueries:number,coalescedCommands:number,lastMetricsLogAt:number}} RuntimeMetrics
 */

module.exports = (api) => {
    api.registerPlatform(PLUGIN_NAME,PLATFORM_NAME, oppoPlatform, true);
};
//// Platform/////////////////////////////////////////////////////////////////////////////////////////////////
class oppoPlatform {
    // Initializes the platform plugin lifecycle hooks and cached accessory container.
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.config.name = this.config.name || 'Oppo UDP';
        this.config.newPlatformUUID = this.config.newPlatformUUID || false;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.log.debug('Finished initializing platform:', this.config.name);
        this.api.on('didFinishLaunching', () => {
            log.debug('didFinishLaunching callback');
            this.iniDevice();
        });
        this.api.on('shutdown', () => {
            if (this.oppoAccessoryInstance && typeof this.oppoAccessoryInstance.cleanupRuntimeResources === 'function') {
                this.oppoAccessoryInstance.cleanupRuntimeResources();
            }
        });
    }
    // Registers accessories restored from Homebridge cache for later reconciliation.
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    // Builds the external TV accessory instance and publishes it with a deterministic UUID strategy.
    iniDevice() {
        if (this.config.newPlatformUUID === false) {
            this.oppoDevice =
            {
                oppoUniqueId: 'AB1212D',
                oppoDisplayName: `${this.config.name}`
            };
        }
        if (this.config.newPlatformUUID === true) {
            this.oppoDevice =
            {
                oppoUniqueId: `${this.config.name}AB1212D`,
                oppoDisplayName: `${this.config.name}`
            };
            this.log.debug('Generationg a new UUID');
        }
        const uuid = this.api.hap.uuid.generate(this.oppoDevice.oppoUniqueId);
        this.log.debug('Adding new accessory:', this.oppoDevice.oppoDisplayName);
        const accessory = new this.api.platformAccessory(this.oppoDevice.oppoDisplayName, uuid);
        accessory.category = 35;
        accessory.context.device = this.oppoDevice;
        this.oppoAccessoryInstance = new oppoAccessory(this, accessory);
        this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    }

    // Unregisters a previously published accessory from Homebridge.
    removeAccessory(accessory) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
}
class oppoAccessory {
    // Bootstraps runtime state, wires HomeKit services, then starts discovery/TCP sync loops.
    constructor(platform, accessory) {

        this.platform = platform;
        this.accessory = accessory;
        this.config = platform.config;
        this.OPPO_IP = this.config.ip;
        this.IPReceived = false;
        this.localIP = '192.168.0.2'
        this.statelessTimeOut = 1000;
        //////Initial Switch and sensors state///////////////////////////////////////////////////////////////////////////////////////////////
        this.powerState = false;
        this.playBackState = [false, false, false];
        this.inputState = [false, false, false, false, false, false, false, false, false, false];
        this.HDROutput = [false, false, false];
        this.audioType = [false, false];
        this.powerStateTV = 0;
        this.currentVolume = 0;
        this.targetVolume = 100;
        this.currentTime = 0;
        this.currentMuteState = true;
        this.currentVolumeSwitch = false;
        this.inputID = 1;
        this.mediaState = 4;
        this.loginTimeOut = true;
        this.netConnectTimeOut = true;
        this.turnOffAllUsed = false;
        this.videoState = false;
        this.audioState = false;
        this.inputName = 'Blu-ray';
        this.mediaDuration = 'Runtime';
        this.mediaChapter = 'Current Chapter';
        this.mediaAudioFormat = 'Video and Audio Format';
        this.language = 'Audio Language';
        this.latestAudioType = '';
        this.latestAudioName = '';
        this.newSubtitle = '';
        this.showState = false;
        this.firstHttp = true;
        this.continueSendingUpdate = true
        this.key = this.query('VERBOSE MODE');
        this.httpNotResponding = 0;
        this.turnOffCommandOn = false;
        this.turnOnCommandOn = false;
        /////MovieConstants
        this.currentMovieProgress = 0;
        this.currentChapterSelector = [0, 0];
        this.currentChapterTime = 0;
        this.currentChapterTimeState = false;
        this.currentChapterSelectorState = false;
        this.currentMovieProgressState = false;
        this.movieRemaining = 0;
        this.firstElapsedMovie = 0;
        this.chapterRemaining = 0;
        this.currentMovieProgressFirst = true;
        this.chapterFirstUpdate = true;
        this.chapterFirstUpdateRemaining = true;
        this.chapterRemainingFirst = 0;
        this.chapterElapsedFirst = 0;
        this.chapterCounter = 0;
        this.chapterUpdateSec = 60;
        this.movieType = '';
        this.diskType = ''
        this.chapterProgressUpdate = true;
        this.chapterNumberRequest = true;
        ////Connection parameters
        this.reconnectionCounter = 0;
        this.reconnectionTry = 10;
        this.connectionLimit = false;
        this.connectionLimitStatus = 0;
        this.mediaDetailsCounter = 0;
        this.reconnectionWait = platform.config.pollingInterval || 10000;
        this.firstConnection = false;
        this.reconnectTimer = null;
        this.hourlyReconnectTimer = null;
        this.connectionInterval = null;
        this.syncInterval = null;
        this.historyInterval = null;
        this.continueSending = true;
        this.newResponse = '';
        this.videoIn3D = '';
        this.loginCounter = 0;
        this.mediaHoursOrMinutes = '';
        this.chapterHoursOrMinutes = '';
        this.lastQuerySentAt = {};
        this.lastCommandSentAt = {};
        this.scheduledTimers = {};
        this.historyDirectoryReady = false;
        this.historyDirectoryPath = '';
        this.commandNameCache = new Map();
        this.debugLogWindows = {};
        this.metrics = {
            tcpWrites: 0,
            httpRequests: 0,
            skippedQueries: 0,
            coalescedCommands: 0,
            lastMetricsLogAt: Date.now(),
        };
        //Device Information//////////////////////////////////////////////////////////////////////////////////////
        this.applyConfigDefaults(platform.config);
        this.validateRuntimeConfig();
        if (this.config.autoIP === true) {
            this.config.autoIP = false;
        }
        else {
            this.config.autoIP = true;
        }
        this.reconnectionWait = this.config.pollingInterval || 10000;
        ////Checking if the necessary information was given by the user////////////////////////////////////////////////////
        try {
            if (!this.OPPO_IP && this.config.autoIP === false) {
                throw new Error(`Oppo IP address is required for ${this.config.name}`);
            }
        } catch (error) {
            this.platform.log(error);
            this.platform.log('Failed to create platform device, missing mandatory information!');
            this.platform.log('Please check your device config!');
            return;
        }
        // set accessory information//////////////////////////////////////////////////////////////////////////////////////////
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, this.config.manufacture)
            .setCharacteristic(this.platform.Characteristic.Model, this.config.modelName)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.config.serialN)
            .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '5.1.0');
        /////////Television Controls///////////////////////////////////////////////////////////////////////////////////////////
        // add the tv service
        this.tvService = this.accessory.getService(this.config.name) ||
            this.accessory.addService(this.platform.Service.Television, this.config.name, SERVICE_IDS.TV_MAIN);
        this.tvService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.config.name);
        this.tvService.setCharacteristic(this.platform
            .Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
        this.tvService.getCharacteristic(this.platform.Characteristic.Active)
            .on('set', (newValue, callback) => {
                this.platform.log.debug('Set Oppo Active to: ' + newValue);
                if (newValue === 1) {
                    this.turnOffCommandOn = false;
                    this.turnOnCommandOn = true;
                    ///this.platform.log('Hello33');////////////////
                    this.sending([this.pressedButton('POWER ON')]);
                    if (this.turnOnCommandOn === true) {
                        setTimeout(() => {
                            this.turnOnCommandOn = false;
                        }, 3000);
                    }
                }
                else {
                    this.turnOnCommandOn = false;
                    this.turnOffCommandOn = true;
                    if (this.playBackState[0] === true || this.playBackState[1] === true) {
                        this.sending([this.pressedButton('STOP')]);
                        setTimeout(() => {
                            this.turnOffAll();
                            this.sending([this.pressedButton('POWER OFF')]);
                            if (this.turnOffCommandOn === true) {
                                setTimeout(() => {
                                    this.turnOffCommandOn = false;
                                }, 3000);
                            }
                        }, 1000);
                    }
                    else {
                        this.turnOffAll();
                        this.sending([this.pressedButton('POWER OFF')]);
                        if (this.turnOffCommandOn === true) {
                            setTimeout(() => {
                                this.turnOffCommandOn = false;
                            }, 3000);
                        }
                    }
                }
                callback(null);
            })
            .on('get', (callback) => {
                let currentValue = this.powerStateTV;
                callback(null, currentValue);
            });
        this.tvService.getCharacteristic(this.platform.Characteristic.ClosedCaptions)
            .on('get', (callback) => {
                this.platform.log.debug('Subtitle GET On');
                let currentValue = 0;
                callback(null, currentValue);
            })
            .on('set', (value, callback) => {
                this.platform.log.debug('Subtitle SET On:', value);
                if (value === 1) {
                    this.sending([this.pressedButton('SUBTITLE')]);
                }
                this.tvService.updateCharacteristic(this.platform.Characteristic.ClosedCaptions, 0);
                callback(null);
            });
        //////Things to remove
        this.tvService.getCharacteristic(this.platform.Characteristic.Brightness)
            .on('get', (callback) => {
                let currentValue = this.currentVolume;
                callback(null, currentValue);
            })
            .on('set', (newValue, callback) => {
                this.sending([this.volumeChange(newValue)]);
                this.platform.log.debug('Volume Value set to: ' + newValue);
                callback(null);
            });
        this.tvService.getCharacteristic(this.platform.Characteristic.PictureMode)
            .on('set', (newValue, callback) => {
                if (newValue === 1) {
                    this.sending([this.pressedButton('VOLUME DOWN')]);
                }
                if (newValue === 0) {
                    this.sending([this.pressedButton('VOLUME UP')]);
                }
                this.platform.log('Volume Value moved by: ' + newValue);
                callback(null);
            });
        ////////////////
        this.tvService.getCharacteristic(this.platform.Characteristic.RemoteKey)
            .on('set', (newValue, callback) => {
                switch (newValue) {
                    case this.platform.Characteristic.RemoteKey.REWIND: {
                        this.platform.log.debug('set Remote Key Pressed: REWIND');
                        this.sending([this.pressedButton('REWIND')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
                        this.platform.log.debug('set Remote Key Pressed: FAST_FORWARD');
                        this.sending([this.pressedButton('FORWARD')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
                        this.platform.log.debug('set Remote Key Pressed: NEXT_TRACK');
                        this.sending([this.pressedButton('NEXT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
                        this.platform.log.debug('set Remote Key Pressed: PREVIOUS_TRACK');
                        this.sending([this.pressedButton('PREVIOUS')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_UP: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_UP');
                        this.sending([this.pressedButton('CURSOR UP')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_DOWN');
                        this.sending([this.pressedButton('CURSOR DOWN')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_LEFT');
                        this.sending([this.pressedButton('CURSOR LEFT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_RIGHT');
                        this.sending([this.pressedButton('CURSOR RIGHT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.SELECT: {
                        this.platform.log.debug('set Remote Key Pressed: SELECT');
                        this.sending([this.pressedButton('CURSOR ENTER')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.BACK: {
                        this.platform.log.debug('set Remote Key Pressed: BACK');
                        this.sending([this.pressedButton('BACK')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.EXIT: {
                        this.platform.log.debug('set Remote Key Pressed: EXIT');
                        this.sending([this.pressedButton('HOME MENU')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
                        this.platform.log.debug('set Remote Key Pressed: PLAY_PAUSE');
                        if (this.playBackState[0] === false) {
                            this.sending([this.pressedButton('PLAY')]);
                        }
                        else {
                            this.sending([this.pressedButton('PAUSE')]);
                        }
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.INFORMATION: {
                        if (this.config.infoToMenu) {
                            if (this.movieType === 'C') {
                                this.platform.log.debug('set Remote Key Pressed: OPTION');
                                this.sending([this.pressedButton('OPTION')]);
                            }
                            else {
                                this.platform.log.debug('set Remote Key Pressed: MENU');
                                this.sending([this.pressedButton('POP-UP MENU')]);
                            }
                        }
                        else {
                            this.platform.log.debug('set Remote Key Pressed: INFORMATION');
                            this.sending([this.pressedButton('INFO')]);
                        }
                        break;
                    }
                }
                callback(null);
            });
        //////////////////////////////////TV Service//////////////////////////////////////////////////////////////////////////
        this.tvService
            .setCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
        this.tvService
            .getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
            .on('set', (inputIdentifier, callback) => {
                this.platform.log.debug('Active Identifier set to:', inputIdentifier);
                if (inputIdentifier === 999999) {
                    this.newInputState([false, false, false, false, false, false, false, false, false, false]);
                    this.inputID = 1;
                }
                if (inputIdentifier === 0) {
                    this.inputID = 1;
                    this.newInputState([false, false, false, false, false, false, false, false, false, false]);
                }
                else if (inputIdentifier === 1) {
                    this.inputID = inputIdentifier;
                    this.sending([this.pressedButton('BLURAY INPUT')]);
                }
                else if (inputIdentifier === 2) {
                    this.inputID = inputIdentifier;
                }
                else if (inputIdentifier === 3) {
                    this.inputID = inputIdentifier;
                }
                else if (inputIdentifier === 4) {
                    this.inputID = inputIdentifier;
                }
                else if (inputIdentifier === 5) {
                    this.inputID = inputIdentifier;
                }
                else if (inputIdentifier === 6) {
                    this.inputID = inputIdentifier;
                    this.sending([this.pressedButton('HDMI IN')]);
                }
                else if (inputIdentifier === 7) {
                    this.inputID = inputIdentifier;
                    this.sending([this.pressedButton('HDMI OUT')]);
                }
                else if (inputIdentifier === 8) {
                    this.inputID = inputIdentifier;
                    this.sending([this.pressedButton('OPTICAL INPUT')]);
                }
                else if (inputIdentifier === 9) {
                    this.inputID = inputIdentifier;
                    this.sending([this.pressedButton('COAXIAL INPUT')]);
                }
                else if (inputIdentifier === 10) {
                    this.inputID = inputIdentifier;
                    this.sending([this.pressedButton('USB AUDIO INPUT')]);
                }
                else {
                    this.inputID = 1;
                }
                callback();
            })
            .on('get', (callback) => {
                let currentValue = this.inputID;
                this.platform.log.debug('Active Identifier set to:', currentValue);
                callback(null, currentValue);
            });
        this.tvService
            .getCharacteristic(this.platform.Characteristic.PowerModeSelection)
            .on('set', (newValue, callback) => {
                this.platform.log.debug('Requested Oppo Settings ' + newValue);
                if (this.playBackState[0] === false && this.playBackState[1] === false && this.playBackState[2] === false) {
                    this.sending([this.pressedButton('SETUP')]);
                }
                else {
                    this.sending([this.pressedButton('POP-UP MENU')]);
                }
                callback();
            });

        // Input Sources///////////////////////////////////////////////////////////////////////////////////////////////////////////
        this.buildInputSources();

        /////Media State/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
            .on('get', (callback) => {
                let currentValue = this.mediaState;
                this.platform.log.debug('Current Playback State', currentValue);
                callback(null, currentValue);
            });
        this.tvService.getCharacteristic(this.platform.Characteristic.TargetMediaState)
            .on('get', (callback) => {
                let currentValue = this.mediaState;
                if (this.mediaState === 4) {
                    currentValue = 2;
                }
                this.platform.log.debug('Current Playback State', currentValue);
                callback(null, currentValue);
            })
            .on('set', (value, callback) => {
                if (value === 0) {
                    this.sending([this.pressedButton('PLAY')]);
                }
                else if (value === 1) {
                    this.sending([this.pressedButton('PAUSE')]);
                }
                else if (value === 2) {
                    this.sending([this.pressedButton('STOP')]);
                }
                this.platform.log.debug('Playback State set to:', value);
                callback(null);
            });
        this.buildSpeakerVolumeService();
        this.buildVideoMovieControls();
        this.buildAdditionalServices(accessory.context.device.oppoDisplayName);
        ////other Controls /////////////////////////////////////////////////////////
        this.setupStatelessSwitches();

        //Movie Timer
        if (this.config.remainMovieTimer) {
            this.movieTimer = accessory.getService(this.platform.Service.Valve) || accessory.addService(this.platform.Service.Valve, 'Oppo Movie Timer', 'Movie Timer');
            this.movieTimer.setCharacteristic(this.platform.Characteristic.Name, 'Movie Timer');
            this.movieTimer.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.movieTimer.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Oppo Movie Timer');
            this.movieTimer.setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.IRRIGATION);
            this.movieTimer.getCharacteristic(this.platform.Characteristic.Active)
                .on('get', (callback) => {
                    let currentValue = this.currentMovieProgressState ? 1 : 0
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    callback(null);
                });
            this.movieTimer.setCharacteristic(this.platform.Characteristic.InUse, this.platform.Characteristic.InUse.NOT_IN_USE);
            this.movieTimer.getCharacteristic(this.platform.Characteristic.RemainingDuration)
                .on('get', (callback) => {
                    let currentValue = this.movieRemaining;
                    callback(null, currentValue);
                })
                .setProps({
                    maxValue: 86400 / 4, // 1 day
                });
            this.movieTimer.getCharacteristic(this.platform.Characteristic.SetDuration)
                .on('get', (callback) => {
                    let currentValue = this.firstElapsedMovie + this.movieRemaining;
                    callback(null, currentValue);
                })
                .setProps({
                    maxValue: 86400 / 4, // 1 day
                });

        }
        this.initCharacteristicCache();
        ///////////////Clean up. Delete services not in used
        this.cleanupServices();
        //////////////////Connecting to Oppo
        if (this.config.autoIP === true) {
            this.discoveryUDP();
        }
        else {
            this.login();
            setTimeout(() => {
                this.netConnect();
            }, 1000);
        }
        //syncing////////////////////////////////////////////////////////////////////////////////////////
        this.connectionInterval = setInterval(() => {
            this.runConnectionHealthTick();
        }, Math.max(1000, this.config.pollingInterval));
        this.syncInterval = setInterval(() => {
            this.runStateSyncTick();
        }, this.config.pollingInterval);
        this.historyInterval = setInterval(() => {
            if (this.cachedCharacteristics.tvActive.value === 1 && this.playBackState[0] === true) {
            }
        }, 120000);
    }
    // Routes command logging through rule actions so log output stays consistent by command category.
    applyCommandLogRule(action, commandPress) {
        switch (action) {
            case 'debugCommand':
                this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
                return true;
            case 'searchTitleTime':
                this.platform.log(`Sending: Search Title Time ${commandPress} ${this.newResponse}`);
                return true;
            case 'searchChapterTime':
                this.platform.log(`Sending: Search Chapter Time ${commandPress} ${this.newResponse}`);
                return true;
            case 'searchTime':
                this.platform.log(`Sending: Search Time ${commandPress} ${this.newResponse}`);
                return true;
            case 'volumeChange':
                this.platform.log(`Sending: Volume Change to ${commandPress} ${this.newResponse}`);
                return true;
            case 'powerStatusQuery':
                this.newResponse = `by HTTP`;
                this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
                setTimeout(() => {
                    this.sendHttp(this.makeUrl(commandPress), commandPress);
                }, 500);
                return true;
            case 'powerOn':
                this.platform.log(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
                return true;
            default:
                return false;
        }
    }
    /////////////////Command Log
    applyConfigDefaults(rawConfig) {
        const source = rawConfig || {};
        for (const key in DEFAULT_CONFIG) {
            this.config[key] = source[key] ?? DEFAULT_CONFIG[key];
        }
    }
    // Maps progress-state flags into paused or stopped playback characteristics.
    applyPlaybackPauseOrStoppedState() {
        if (this.currentMovieProgressState) {
            this.newPlayBackState([false, true, false]);
        }
        else {
            this.newPlayBackState([false, false, false]);
        }
    }
    // Resets playback and media metadata state in the requested update order.
    applyPlaybackStopReset(resetOrder) {
        this.newPlayBackState([false, false, false]);
        this.newAudioType([false, false]);
        this.newInputName('Blu-ray');
        if (resetOrder === 'mediaThenMovie') {
            this.mediaDetailsReset();
            this.movieChapterDefault();
            return;
        }
        this.movieChapterDefault();
        this.mediaDetailsReset();
    }
    // Registers optional switches/sensors and input-button services based on plugin config flags.
    buildAdditionalServices(deviceDisplayName) {
        if (this.config.powerB === true) {
            const powerSwitchServiceName = `${deviceDisplayName} Power Switch`;
            this.service = this.accessory.getService(powerSwitchServiceName)
                || this.accessory.addService(this.platform.Service.Switch, powerSwitchServiceName, 'CataNicoGaTa-PWR-Oppo');
            this.service.setCharacteristic(this.platform.Characteristic.Name, powerSwitchServiceName);
            this.service.updateCharacteristic(this.platform.Characteristic.Name, powerSwitchServiceName);
            this.service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, powerSwitchServiceName);
            this.service.getCharacteristic(this.platform.Characteristic.On)
                .on('set', this.setOn.bind(this))
                .on('get', this.getOn.bind(this));
        };
        const playbackSwitchConfigs = [
            {
                propertyName: 'play',
                serviceName: SERVICE_NAMES.PLAY,
                uniqueId: SERVICE_IDS.PLAY_SWITCH,
                onGet: this.playSwitchStateGet,
                onSet: this.playSwitchStateSet,
            },
            {
                propertyName: 'pause',
                serviceName: SERVICE_NAMES.PAUSE,
                uniqueId: SERVICE_IDS.PAUSE_SWITCH,
                onGet: this.pauseSwitchStateGet,
                onSet: this.pauseSwitchStateSet,
            },
            {
                propertyName: 'stop',
                serviceName: SERVICE_NAMES.STOP,
                uniqueId: SERVICE_IDS.STOP_SWITCH,
                onGet: this.stopSwitchStateGet,
                onSet: this.stopSwitchStateSet,
            },
        ];
        for (const switchConfig of playbackSwitchConfigs) {
            this.createStatefulSwitch(switchConfig);
        }
        // Video/audio status sensors are table-driven to avoid repeated setup blocks.
        if (this.config.mediaAudioVideoState === true) {
            const mediaSensorConfigs = [
                {
                    propertyName: 'dolbyVision',
                    serviceName: SERVICE_NAMES.DOLBY_VISION_VIDEO,
                    uniqueId: SERVICE_IDS.DOLBY_VISION_SENSOR,
                    getValue: () => this.HDROutput[0],
                },
                {
                    propertyName: 'hdr10',
                    serviceName: SERVICE_NAMES.HDR10_VIDEO,
                    uniqueId: SERVICE_IDS.HDR10_SENSOR,
                    getValue: () => this.HDROutput[1],
                },
                {
                    propertyName: 'SDR',
                    serviceName: SERVICE_NAMES.SDR_VIDEO,
                    uniqueId: SERVICE_IDS.SDR_SENSOR,
                    getValue: () => this.HDROutput[2],
                },
                {
                    propertyName: 'dolbySound',
                    serviceName: SERVICE_NAMES.DOLBY_ATMOS_SOUND,
                    existingServiceName: 'Dolby Atmos',
                    uniqueId: SERVICE_IDS.DOLBY_ATMOS_SENSOR,
                    getValue: () => this.audioType[0],
                },
                {
                    propertyName: 'dtsSound',
                    serviceName: SERVICE_NAMES.DTS,
                    uniqueId: SERVICE_IDS.DTS_SENSOR,
                    getValue: () => this.audioType[1],
                },
            ];
            for (const sensorConfig of mediaSensorConfigs) {
                this.createMotionSensorService(sensorConfig);
            }
        }
        this.createMotionSensorService({
            propertyName: 'connectionStatus',
            serviceName: SERVICE_NAMES.CONNECTION_STATUS,
            uniqueId: SERVICE_IDS.CONNECTION_STATUS_SENSOR,
            characteristicType: this.platform.Characteristic.StatusFault,
            getValue: () => this.connectionLimitStatus,
        });
        if (this.config.inputButtons === true) {
            const inputButtonConfigs = [
                {
                    propertyName: 'bluRayInput',
                    serviceName: SERVICE_NAMES.BLURAY_INPUT_SWITCH,
                    uniqueId: SERVICE_IDS.BLURAY_INPUT_SWITCH,
                    stateIndex: 0,
                    commandName: 'BLURAY INPUT',
                    logLabel: SERVICE_NAMES.BLURAY_INPUT_SWITCH,
                },
                {
                    propertyName: 'hdmiIn',
                    serviceName: SERVICE_NAMES.HDMI_IN_INPUT_SWITCH,
                    uniqueId: SERVICE_IDS.HDMI_IN_INPUT_SWITCH,
                    stateIndex: 5,
                    commandName: 'HDMI IN',
                    logLabel: 'HDMI In',
                },
                {
                    propertyName: 'hdmiOut',
                    serviceName: SERVICE_NAMES.HDMI_OUT_INPUT_SWITCH,
                    uniqueId: SERVICE_IDS.HDMI_OUT_INPUT_SWITCH,
                    stateIndex: 6,
                    commandName: 'HDMI OUT',
                    logLabel: 'HDMI Out',
                },
            ];
            if (this.config.oppo205 === true) {
                inputButtonConfigs.push(
                    {
                        propertyName: 'opticalB',
                        serviceName: SERVICE_NAMES.OPTICAL_INPUT_SWITCH,
                        uniqueId: SERVICE_IDS.OPTICAL_INPUT_SWITCH_205,
                        stateIndex: 7,
                        commandName: 'OPTICAL INPUT',
                        logLabel: SERVICE_NAMES.OPTICAL_INPUT_SWITCH,
                    },
                    {
                        propertyName: 'coaxialB',
                        serviceName: SERVICE_NAMES.COAXIAL_INPUT_SWITCH,
                        uniqueId: SERVICE_IDS.COAXIAL_INPUT_SWITCH_205,
                        stateIndex: 8,
                        commandName: 'COAXIAL INPUT',
                        logLabel: 'Coaxial',
                    },
                    {
                        propertyName: 'usbAudioB',
                        serviceName: SERVICE_NAMES.USB_AUDIO_INPUT_SWITCH,
                        uniqueId: SERVICE_IDS.USB_AUDIO_INPUT_SWITCH_205,
                        stateIndex: 9,
                        commandName: 'USB AUDIO INPUT',
                        logLabel: 'USB Audio In',
                    },
                );
            }
            for (const buttonConfig of inputButtonConfigs) {
                this.createInputButtonSwitch(buttonConfig);
            }
        }
        if (this.config.volume === true) {
            this.buildDualModeProgressService({
                isEnabled: true,
                serviceName: SERVICE_NAMES.OPPO_VOLUME,
                lightPropertyName: 'volumeDimmer',
                fanPropertyName: 'volumeFan',
                lightUniqueId: SERVICE_IDS.VOLUME_DIMMER,
                fanUniqueId: SERVICE_IDS.VOLUME_FAN,
                setNameCharacteristic: false,
                stateGetter: () => this.currentVolumeSwitch,
                onStateSet: (newValue, usesFanMode) => {
                    let newVolume = this.targetVolume;
                    if (usesFanMode === true) {
                        if (newValue === 1) {
                            this.sending([this.volumeChange(newVolume)]);
                            this.platform.log.debug('Volume Value set to: Unmute');
                        }
                        if (newValue === 0) {
                            newVolume = 0;
                            this.sending([this.volumeChange(newVolume)]);
                            this.platform.log.debug('Volume Value set to: Mute');
                        }
                        return;
                    }
                    if (newValue === true) {
                        this.sending([this.volumeChange(newVolume)]);
                        this.platform.log.debug('Volume Value set to: Unmute');
                    }
                    if (newValue === false) {
                        newVolume = 0;
                        this.sending([this.volumeChange(newVolume)]);
                        this.platform.log.debug('Volume Value set to: Mute');
                    }
                },
                valueGetter: () => this.currentVolume,
                onValueSet: (newValue) => {
                    this.sending([this.volumeChange(newValue)]);
                    this.platform.log.debug('Volume Value set to: ' + newValue);
                },
            });
        }
    }
    // Builds a shared Lightbulb/Fanv2 control with parallel state and percentage characteristics.
    buildDualModeProgressService({
        isEnabled,
        serviceName,
        lightPropertyName,
        fanPropertyName,
        lightUniqueId,
        fanUniqueId,
        stateGetter,
        onStateSet,
        valueGetter,
        onValueSet,
        valueProps,
        setNameCharacteristic = true,
    }) {
        if (isEnabled !== true) {
            return;
        }
        const usesFanMode = this.config.changeDimmersToFan === true;
        const propertyName = usesFanMode ? fanPropertyName : lightPropertyName;
        const serviceType = usesFanMode ? this.platform.Service.Fanv2 : this.platform.Service.Lightbulb;
        const uniqueId = usesFanMode ? fanUniqueId : lightUniqueId;
        const stateCharacteristic = usesFanMode ? this.platform.Characteristic.Active : this.platform.Characteristic.On;
        const valueCharacteristicType = usesFanMode ? this.platform.Characteristic.RotationSpeed : this.platform.Characteristic.Brightness;
        const service = this.createConfiguredService({
            propertyName,
            serviceType,
            serviceName,
            uniqueId,
            setNameCharacteristic,
        });
        service.getCharacteristic(stateCharacteristic)
            .on('get', (callback) => {
                const rawValue = stateGetter();
                if (usesFanMode) {
                    callback(null, rawValue === true ? 1 : 0);
                    return;
                }
                callback(null, rawValue);
            })
            .on('set', (newValue, callback) => {
                onStateSet(newValue, usesFanMode);
                callback(null);
            });
        let rangeCharacteristic = service.getCharacteristic(valueCharacteristicType);
        if (valueProps) {
            rangeCharacteristic = rangeCharacteristic.setProps(valueProps);
        }
        rangeCharacteristic
            .on('get', (callback) => {
                callback(null, valueGetter());
            })
            .on('set', (newValue, callback) => {
                onValueSet(newValue, usesFanMode);
                callback(null);
            });
    }
    // Builds the base OPPO HTTP URL for a given endpoint using the active player IP.
    buildHttpBaseUrl(endpoint) {
        return `http://${this.OPPO_IP}:436/${endpoint}`;
    }
    // Creates and links all TV input sources from a single definition list.
    buildInputSources() {
        this.refreshShowState();
        const currentShown = this.platform.Characteristic.CurrentVisibilityState.SHOWN;
        const currentHidden = this.platform.Characteristic.CurrentVisibilityState.HIDDEN;
        const targetShown = this.platform.Characteristic.TargetVisibilityState.SHOWN;
        const targetHidden = this.platform.Characteristic.TargetVisibilityState.HIDDEN;
        const showMediaDetails = this.showState ? currentShown : currentHidden;
        const showMediaDetailsTarget = this.showState ? targetShown : targetHidden;
        const oppo205CurrentVisibility = this.config.oppo205 ? currentShown : currentHidden;
        const oppo205TargetVisibility = this.config.oppo205 ? targetShown : targetHidden;
        const inputSourceDefinitions = [
            {
                propertyName: 'bluRay',
                serviceName: 'Blu-ray',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_BLURAY,
                identifier: 1,
                configuredName: () => this.inputName,
                inputSourceType: this.platform.Characteristic.InputSourceType.APPLICATION,
                currentVisibility: currentShown,
                onGet: () => this.inputName,
            },
            {
                propertyName: 'runtime',
                serviceName: 'Runtime',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_RUNTIME,
                identifier: 2,
                configuredName: () => this.mediaDuration,
                inputSourceType: this.platform.Characteristic.InputSourceType.HDMI,
                currentVisibility: showMediaDetails,
                onGet: () => this.mediaDuration,
                logOnGet: true,
            },
            {
                propertyName: 'currentChaper',
                serviceName: 'Current Chapter',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_CURRENT_CHAPTER,
                identifier: 3,
                configuredName: () => this.mediaChapter,
                inputSourceType: this.platform.Characteristic.InputSourceType.HDMI,
                targetVisibility: showMediaDetailsTarget,
                currentVisibility: showMediaDetails,
                onGet: () => this.mediaChapter,
                logOnGet: true,
            },
            {
                propertyName: 'audioFormat',
                serviceName: 'Video and Audio Format',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_AUDIO_FORMAT,
                identifier: 4,
                configuredName: () => this.mediaAudioFormat,
                inputSourceType: this.platform.Characteristic.InputSourceType.HDMI,
                targetVisibility: showMediaDetailsTarget,
                currentVisibility: showMediaDetails,
                onGet: () => this.mediaAudioFormat,
                logOnGet: true,
            },
            {
                propertyName: 'audioLanguage',
                serviceName: 'Audio Language',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_AUDIO_LANGUAGE,
                identifier: 5,
                configuredName: () => this.language,
                inputSourceType: this.platform.Characteristic.InputSourceType.HDMI,
                targetVisibility: showMediaDetailsTarget,
                currentVisibility: showMediaDetails,
                onGet: () => this.language,
                logOnGet: true,
            },
            {
                propertyName: 'hdmi1',
                serviceName: 'HDMI In',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_HDMI_IN,
                identifier: 6,
                configuredName: 'HDMI In',
                inputSourceType: this.platform.Characteristic.InputSourceType.APPLICATION,
                currentVisibility: currentShown,
            },
            {
                propertyName: 'hdmi2',
                serviceName: 'HDMI Out',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_HDMI_OUT,
                identifier: 7,
                configuredName: 'HDMI Out',
                inputSourceType: this.platform.Characteristic.InputSourceType.APPLICATION,
                currentVisibility: currentShown,
            },
            {
                propertyName: 'opticalIn',
                serviceName: 'Optical In',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_OPTICAL_IN,
                identifier: 8,
                configuredName: 'Optical In',
                inputSourceType: this.platform.Characteristic.InputSourceType.HDMI,
                targetVisibility: oppo205TargetVisibility,
                currentVisibility: oppo205CurrentVisibility,
            },
            {
                propertyName: 'coaxialIn',
                serviceName: 'Coaxial In',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_COAXIAL_IN,
                identifier: 9,
                configuredName: 'Coaxial In',
                inputSourceType: this.platform.Characteristic.InputSourceType.HDMI,
                targetVisibility: oppo205TargetVisibility,
                currentVisibility: oppo205CurrentVisibility,
            },
            {
                propertyName: 'usbAudioIn',
                serviceName: 'USB Audio In',
                uniqueId: SERVICE_IDS.INPUT_SOURCE_USB_AUDIO_IN,
                identifier: 10,
                configuredName: 'USB Audio In',
                inputSourceType: this.platform.Characteristic.InputSourceType.HDMI,
                targetVisibility: oppo205TargetVisibility,
                currentVisibility: oppo205CurrentVisibility,
            },
        ];
        for (const definition of inputSourceDefinitions) {
            this.getOrCreateInputSource(definition);
        }
    }
    // Resolves supported command codes into concrete HTTP routes and applies route-specific logging.
    buildMappedHttpUrl(key) {
        const urlRoute = this.findRuleMatch(key, HTTP_URL_ROUTE_RULES);
        if (!urlRoute) {
            return null;
        }
        const url = this.buildHttpBaseUrl(urlRoute.endpoint);
        if (urlRoute.logMode === 'mediaNameQuery') {
            this.platform.log.debug('Sending: Media Name Query by HTTP');
        }
        else if (urlRoute.logMode === 'inputChange') {
            this.platform.log(`Sending: Input Change ${this.newResponse}`);
        }
        else {
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
        }
        this.platform.log.debug(url);
        return url;
    }
    // Converts a raw command payload into the OPPO sendremotekey HTTP format.
    buildRemoteKeyUrl(key) {
        let remoteKey = key.substring(1);
        remoteKey = remoteKey.replace(/\s/g, '');
        this.platform.log.debug('Key to be sent by HTTP: ' + remoteKey);
        const url = this.buildHttpBaseUrl(`sendremotekey?%7B%22key%22%3A%22${remoteKey}%22%7D`);
        this.platform.log.debug(url);
        return url;
    }
    //////////////////Make URL for HTTP///////////////
    buildSearchTimeUrl(key) {
        const rawCommand = key.substring(1).trim();
        const commandParts = rawCommand.split(/\s+/);
        if (commandParts[0] !== 'SRH') {
            return null;
        }
        let timeValue = '';
        if (commandParts.length >= 3 && (commandParts[1] === 'T' || commandParts[1] === 'C')) {
            timeValue = commandParts[2];
        }
        else if (commandParts.length >= 2) {
            timeValue = commandParts[1];
        }
        if (!timeValue || !timeValue.includes(':')) {
            return null;
        }
        const newKey = timeValue.split(':');
        if (newKey.length !== 3) {
            return null;
        }
        const hours = parseInt(newKey[0], 10);
        const minutes = parseInt(newKey[1], 10);
        const seconds = parseInt(newKey[2], 10);
        if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
            return null;
        }
        this.platform.log.debug(`Sending: Search Time ${key} ${this.newResponse}`);
        const payload = `{"h":${hours},"m":${minutes},"s":${seconds}}`;
        return `${this.buildHttpBaseUrl('setplaytime?')}${payload}`;
    }
    // Owns the TelevisionSpeaker service and normalizes volume/mute control paths.
    buildSpeakerVolumeService() {
        this.speakerService = this.accessory.getService(SERVICE_NAMES.OPPO_VOLUME_CONTROL) ||
            this.accessory.addService(this.platform.Service.TelevisionSpeaker, SERVICE_NAMES.OPPO_VOLUME_CONTROL, SERVICE_IDS.TV_SPEAKER_VOLUME);
        this.speakerService
            .setCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE)
            .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);
        this.speakerService.getCharacteristic(this.platform.Characteristic.VolumeSelector)
            .on('set', (newValue, callback) => {
                if (newValue === 1) {
                    this.sending([this.pressedButton('VOLUME DOWN')]);
                }
                if (newValue === 0) {
                    this.sending([this.pressedButton('VOLUME UP')]);
                }
                this.platform.log('Volume Value moved by: ' + newValue);
                callback(null);
            });
        this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
            .on('get', (callback) => {
                let currentValue = this.currentMuteState;
                callback(null, currentValue);
            })
            .on('set', (newValue, callback) => {
                let newVolume = this.targetVolume;
                if (newValue === false) {
                    this.sending([this.volumeChange(newVolume)]);
                    this.platform.log.debug('Volume Value set to: Unmute');
                }
                if (newValue === true) {
                    newVolume = 0;
                    this.sending([this.volumeChange(newVolume)]);
                    this.platform.log.debug('Volume Value set to: Mute');
                }

                callback(null);
            });
        this.speakerService.getCharacteristic(this.platform.Characteristic.Volume)
            .on('get', (callback) => {
                let currentValue = this.currentVolume;
                callback(null, currentValue);
            })
            .on('set', (newValue, callback) => {
                this.sending([this.volumeChange(newValue)]);
                this.platform.log.debug('Volume Value set to: ' + newValue);
                callback(null);
            });
        this.tvService.addLinkedService(this.speakerService);
    }
    // Builds movie/chapter progress controls (Lightbulb or Fanv2 variants).
    buildVideoMovieControls() {
        this.buildDualModeProgressService({
            isEnabled: this.config.movieControl === true,
            serviceName: SERVICE_NAMES.MOVIE_PROGRESS,
            lightPropertyName: 'movieControlL',
            fanPropertyName: 'movieControlF',
            lightUniqueId: SERVICE_IDS.MOVIE_PROGRESS_DIMMER,
            fanUniqueId: SERVICE_IDS.MOVIE_PROGRESS_FAN,
            stateGetter: () => this.currentMovieProgressState,
            onStateSet: (newValue) => {
                this.platform.log('Movie progress state set to: ' + newValue);
            },
            valueGetter: () => this.currentMovieProgress,
            onValueSet: (newValue) => {
                let newSendValue = Math.round(newValue * (this.firstElapsedMovie + this.movieRemaining) / 100);
                let totalMovieTime = this.firstElapsedMovie + this.movieRemaining;
                if (newSendValue > totalMovieTime) { newSendValue = totalMovieTime; }
                this.sending([this.movieTime(this.secondsToTime(newSendValue))]);
                this.platform.log('Movie progress set to: ' + newValue + '%');
            },
        });
        this.buildDualModeProgressService({
            isEnabled: this.config.chapterSelector === true,
            serviceName: SERVICE_NAMES.CHAPTER_NUMBER,
            lightPropertyName: 'chapterSelectorL',
            fanPropertyName: 'chapterSelectorF',
            lightUniqueId: SERVICE_IDS.CHAPTER_NUMBER_DIMMER,
            fanUniqueId: SERVICE_IDS.CHAPTER_NUMBER_FAN,
            stateGetter: () => this.currentChapterSelectorState,
            onStateSet: (newValue) => {
                this.platform.log('Chapter state set to: ' + newValue);
            },
            valueGetter: () => this.currentChapterSelector[0],
            onValueSet: (newValue) => {
                if (newValue >= this.currentChapterSelector[1]) {
                    newValue = this.currentChapterSelector[1];
                }
                this.sending([this.chapterChange(newValue)]);
                this.platform.log('Chapter number set to: ' + newValue);
            },
            valueProps: {
                minValue: 0,
                maxValue: 100,
                minStep: 1,
            },
        });
        this.buildDualModeProgressService({
            isEnabled: this.config.chapterControl === true,
            serviceName: SERVICE_NAMES.CHAPTER_PROGRESS,
            lightPropertyName: 'chapterControlL',
            fanPropertyName: 'chapterControlF',
            lightUniqueId: SERVICE_IDS.CHAPTER_PROGRESS_DIMMER,
            fanUniqueId: SERVICE_IDS.CHAPTER_PROGRESS_FAN,
            stateGetter: () => this.currentChapterTimeState,
            onStateSet: (newValue) => {
                this.platform.log('Chapter progress status set to: ' + newValue);
            },
            valueGetter: () => this.currentChapterTime,
            onValueSet: (newValue, usesFanMode) => {
                let newSendValue = Math.round(newValue * (this.chapterElapsedFirst + this.chapterRemainingFirst) / 100);
                let totalChapterTime = this.chapterElapsedFirst + this.chapterRemainingFirst;
                if (newSendValue > totalChapterTime) { newSendValue = totalChapterTime; }
                if (usesFanMode === false) {
                    this.chapterCounter = newSendValue;
                }
                this.sending([this.chapterTime(this.secondsToTime(newSendValue))]);
                this.platform.log('Chapter progress set to: ' + newValue + '%');
            },
        });
    }
    // Builds the OPPO setvolume HTTP endpoint payload for an absolute volume value.
    buildVolumeUrl(key) {
        const newKey = key.split(' ');
        const volumeLevel = (newKey[1] || '').trim();
        return this.buildHttpBaseUrl(`setvolume?%7B%22cur_vol%22%3A${volumeLevel}%2C%22connectId%22%3A%22${this.localIP}%22%7D`);
    }
    // Stores decoded command labels in a bounded cache to reduce repeat parsing work.
    cacheCommandName(keyS, decodedName) {
        this.commandNameCache.set(keyS, decodedName);
        if (this.commandNameCache.size > 1000) {
            this.commandNameCache.clear();
            this.commandNameCache.set(keyS, decodedName);
        }
        return decodedName;
    }
    // Cancels scheduled timer handles whose keys share a common prefix.
    cancelScheduledTimersByPrefix(prefix) {
        for (const key in this.scheduledTimers) {
            if (key.startsWith(prefix)) {
                clearTimeout(this.scheduledTimers[key]);
                delete this.scheduledTimers[key];
            }
        }
    }
    // Applies per-query cooldown rules to prevent flooding repetitive status commands.
    canSendQuery(commandCode) {
        if (!(commandCode.startsWith('Q') || commandCode === 'MTR')) {
            return true;
        }
        const now = Date.now();
        const cooldown = QUERY_COMMAND_COOLDOWNS_MS[commandCode] || 1200;
        const last = this.lastQuerySentAt[commandCode] || 0;
        if (now - last < cooldown) {
            this.metrics.skippedQueries += 1;
            return false;
        }
        this.lastQuerySentAt[commandCode] = now;
        return true;
    }
    // Formats a chapter-number seek command in OPPO protocol syntax.
    chapterChange(number) {
        let key;
        key = '#SRH C';
        key += number.toString();
        key += '\r\n';
        return key;
    }
    // Formats a chapter/time seek command, selecting title or chapter mode from current media type.
    chapterTime(number) {
        let key;
        if (!this.movieType.includes('C')) {
            key = '#SRH C ';
        }
        else {
            key = '#SRH T ';
        }
        key += number
        key += '\r\n';
        return key;
    }
    // Called on shutdown to stop timers, close sockets, and release listeners cleanly.
    cleanupRuntimeResources() {
        this.clearReconnectTimers();
        this.clearAllScheduledTimers();
        if (this.connectionInterval) {
            clearInterval(this.connectionInterval);
            this.connectionInterval = null;
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.historyInterval) {
            clearInterval(this.historyInterval);
            this.historyInterval = null;
        }
        if (this.discovery) {
            try {
                this.discovery.removeAllListeners();
                this.discovery.close();
            } catch (error) {
                this.platform.log.debug(`Discovery cleanup error: ${error.message}`);
            } finally {
                delete this.discovery;
            }
        }
        if (this.server) {
            try {
                this.server.removeAllListeners();
                this.server.close();
            } catch (error) {
                this.platform.log.debug(`UDP server cleanup error: ${error.message}`);
            } finally {
                delete this.server;
            }
        }
        this.teardownClient();
        delete this.client;
    }
    // Removes HomeKit services that are disabled by config or incompatible with active mode settings.
    cleanupServices() {
        if (this.config.remainMovieTimer === false) {
            this.removeServiceIfPresent(this.movieTimer);
        }
        if (this.config.powerB === false) {
            this.removeServiceIfPresent(this.service);
        }
        if (this.config.mediaAudioVideoState === false) {
            this.removeServiceIfPresent(this.dolbySound);
            this.removeServiceIfPresent(this.dolbyVision);
            this.removeServiceIfPresent(this.SDR);
            this.removeServiceIfPresent(this.hdr10);
            this.removeServiceIfPresent(this.dtsSound);
        }
        if (this.config.movieControl === false) {
            this.removeServiceIfPresent(this.movieControlL);
            this.removeServiceIfPresent(this.movieControlF);
        }
        if (this.config.chapterControl === false) {
            this.removeServiceIfPresent(this.chapterControlL);
            this.removeServiceIfPresent(this.chapterControlF);
        }
        if (this.config.chapterSelector === false) {
            this.removeServiceIfPresent(this.chapterSelectorL);
            this.removeServiceIfPresent(this.chapterSelectorF);
        }
        if (this.config.inputButtons === false) {
            this.removeServiceIfPresent(this.bluRayInput);
            this.removeServiceIfPresent(this.hdmiIn);
            this.removeServiceIfPresent(this.hdmiOut);
            this.removeServiceIfPresent(this.opticalB);
            this.removeServiceIfPresent(this.coaxialB);
            this.removeServiceIfPresent(this.usbAudioB);
        }
        if (this.config.volume === false) {
            this.removeServiceIfPresent(this.volumeDimmer);
            this.removeServiceIfPresent(this.volumeFan);
        }
        if (this.config.changeDimmersToFan === false) {
            this.removeServiceIfPresent(this.volumeFan);
            this.removeServiceIfPresent(this.chapterSelectorF);
            this.removeServiceIfPresent(this.chapterControlF);
            this.removeServiceIfPresent(this.movieControlF);
        }
        if (this.config.changeDimmersToFan === true) {
            this.removeServiceIfPresent(this.volumeDimmer);
            this.removeServiceIfPresent(this.chapterSelectorL);
            this.removeServiceIfPresent(this.chapterControlL);
            this.removeServiceIfPresent(this.movieControlL);
        }
        for (const buttonConfig of this.getStatelessSwitchConfigs()) {
            if (this.config[buttonConfig.configKey] === false) {
                this.removeServiceIfPresent(this[buttonConfig.propertyName]);
            }
        }
    }
    // Cancels all tracked scheduled timers used by deferred query tasks.
    clearAllScheduledTimers() {
        this.cancelScheduledTimersByPrefix('');
    }
    // Clears the pending reconnect timeout handle if one is queued.
    clearReconnectAttempt() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    // Clears reconnect-related timeout handles used by retry and hourly reconnect logic.
    clearReconnectTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.hourlyReconnectTimer) {
            clearTimeout(this.hourlyReconnectTimer);
            this.hourlyReconnectTimer = null;
        }
    }
    // Builds user-facing command log messages with special handling for selected command families.
    commandLog(commandPress) {
        const logRule = this.findRuleMatch(commandPress, COMMAND_LOG_RULES);
        if (logRule && this.applyCommandLogRule(logRule.action, commandPress)) {
            return;
        }
        if (this.config.chinoppo === true && commandPress.includes('EJT')) {
            this.platform.log(`Sending: Power on Command ${this.newResponse}`);
            return;
        }
        this.platform.log(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
    }

    /////Sending Instructions/////////////////////////////////////////////////////////////////////////////////////////////////////
    commandName(keyS) {
        const cachedName = this.commandNameCache.get(keyS);
        if (cachedName) {
            return cachedName;
        }
        let keySent = '';
        if (keyS.includes('EJT')) {
            keySent = this.config.chinoppo === false ? 'Eject/Open' : 'Power On';
        }
        else {
            for (const rule of COMMAND_NAME_RULES) {
                if (rule.patterns.some((pattern) => keyS.includes(pattern))) {
                    keySent = rule.label;
                    break;
                }
            }
        }
        if (keySent === '') {
            const decodedName = `${keyS} Executed`;
            return this.cacheCommandName(keyS, decodedName);
        }
        if (keyS.includes('OK')) {
            const decodedName = `${keySent} Executed`;
            return this.cacheCommandName(keyS, decodedName);
        }
        if (keyS.includes('INVALID')) {
            const decodedName = `${keySent} Invalid Command`;
            return this.cacheCommandName(keyS, decodedName);
        }
        if (COMMAND_NAME_NO_SUFFIX_PATTERNS.some((pattern) => keyS.includes(pattern))) {
            return this.cacheCommandName(keyS, keySent);
        }
        const decodedName = `${keySent} Command`;
        return this.cacheCommandName(keyS, decodedName);
    }
    /////oppo controls/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Reusable service initializer: get-or-create + configured name + optional Name characteristic.
    createConfiguredService({
        propertyName,
        serviceType,
        serviceName,
        uniqueId,
        configuredName = serviceName,
        existingServiceName = serviceName,
        setNameCharacteristic = false,
    }) {
        const service = this.accessory.getService(existingServiceName) ||
            this.accessory.addService(serviceType, serviceName, uniqueId);
        if (setNameCharacteristic === true) {
            service.setCharacteristic(this.platform.Characteristic.Name, serviceName);
        }
        service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
        service.setCharacteristic(this.platform.Characteristic.ConfiguredName, configuredName);
        this[propertyName] = service;
        return service;
    }
    // Creates stateful input-selection switches that reflect active input state and send input commands.
    createInputButtonSwitch({ propertyName, serviceName, uniqueId, stateIndex, commandName, logLabel }) {
        const service = this.createConfiguredService({
            propertyName,
            serviceType: this.platform.Service.Switch,
            serviceName,
            uniqueId,
        });
        service.getCharacteristic(this.platform.Characteristic.On)
            .on('get', (callback) => {
                this.platform.log.debug(`${logLabel} Get State`);
                callback(null, this.inputState[stateIndex]);
            })
            .on('set', (value, callback) => {
                this.platform.log.debug(`${logLabel} set to:`, value);
                if (value === true) {
                    this.sending([this.pressedButton(commandName)]);
                }
                callback(null);
            });
        return service;
    }
    createInputSourceService({
        serviceName,
        uniqueId,
        identifier,
        configuredName,
        inputSourceType,
        targetVisibility,
        currentVisibility,
    }) {
        const configuredNameValue = typeof configuredName === 'function' ? configuredName() : configuredName;
        const service = this.accessory.addService(this.platform.Service.InputSource, serviceName, uniqueId)
            .setCharacteristic(this.platform.Characteristic.Identifier, identifier)
            .setCharacteristic(this.platform.Characteristic.ConfiguredName, configuredNameValue)
            .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
            .setCharacteristic(this.platform.Characteristic.InputSourceType, inputSourceType);
        if (typeof targetVisibility !== 'undefined') {
            service.setCharacteristic(this.platform.Characteristic.TargetVisibilityState, targetVisibility);
        }
        if (typeof currentVisibility !== 'undefined') {
            service.setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, currentVisibility);
        }
        return service;
    }
    createMotionSensorService({
        propertyName,
        serviceName,
        uniqueId,
        getValue,
        existingServiceName = serviceName,
        characteristicType = this.platform.Characteristic.MotionDetected,
    }) {
        const service = this.createConfiguredService({
            propertyName,
            serviceType: this.platform.Service.MotionSensor,
            serviceName,
            uniqueId,
            existingServiceName,
        });
        service.getCharacteristic(characteristicType)
            .on('get', (callback) => {
                callback(null, getValue());
            });
        return service;
    }
    // Creates a switch service whose get/set handlers are provided by bound accessory methods.
    createStatefulSwitch({ propertyName, serviceName, uniqueId, onGet, onSet }) {
        const service = this.createConfiguredService({
            propertyName,
            serviceType: this.platform.Service.Switch,
            serviceName,
            uniqueId,
        });
        service.getCharacteristic(this.platform.Characteristic.On)
            .on('get', onGet.bind(this))
            .on('set', onSet.bind(this));
        return service;
    }
    // Creates a momentary switch that always resets to Off after issuing its command.
    createStatelessSwitch({ propertyName, serviceName, uniqueId, commandName, logLabel }) {
        const label = logLabel || serviceName;
        this[propertyName] = this.accessory.getService(serviceName) ||
            this.accessory.addService(this.platform.Service.Switch, serviceName, uniqueId);
        this[propertyName].addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
        this[propertyName].setCharacteristic(this.platform.Characteristic.ConfiguredName, serviceName);
        this[propertyName].getCharacteristic(this.platform.Characteristic.On)
            .on('get', (callback) => {
                this.platform.log.debug(`${label} GET On`);
                callback(null, false);
            })
            .on('set', (value, callback) => {
                this.platform.log.debug(`${label} SET On:`, value);
                if (value === true) {
                    this.sending([this.pressedButton(commandName)]);
                }
                setTimeout(() => {
                    this[propertyName].updateCharacteristic(this.platform.Characteristic.On, false);
                }, this.statelessTimeOut);
                callback(null);
            });
    }
    //////////////Create Client//////////////////////////////////////////////////////////////////////////
    debugLogRateLimited(rateKey, intervalMs, ...args) {
        const now = Date.now();
        const lastLoggedAt = this.debugLogWindows[rateKey] || 0;
        if (now - lastLoggedAt < intervalMs) {
            return;
        }
        this.debugLogWindows[rateKey] = now;
        this.platform.log.debug(...args);
    }
    // Starts SSDP/UDP discovery listeners to auto-detect OPPO IP updates and reconnect transport.
    discoveryUDP() {
        if (this.discovery) {
            return;
        }
        this.discovery = udp.createSocket({ type: 'udp4', reuseAddr: true });
        this.discovery.on('error', (error) => {
            this.platform.log(error);
            this.discovery.close();
        });
        this.discovery.on('close', () => {
            delete this.discovery;
        });
        this.discovery.on('listening', () => {
            const address = this.discovery.address();
            this.platform.log('UDP Client listening on ' + address.address + ":" + address.port);
            this.discovery.setBroadcast(true)
            this.discovery.setMulticastTTL(128);
            this.discovery.addMembership('239.255.255.251');
        });

        this.discovery.on('message', (message, remote) => {
            this.platform.log.debug('Message received From: ' + remote.address + ':' + remote.port);
            const newMessage = message.toString('utf8');
            this.platform.log.debug(newMessage);
            const properties = newMessage.split('\n');
            const oppoInfo = {};
            properties.forEach((property) => {
                const tup = property.split(':');
                oppoInfo[tup[0]] = tup[1];
            });
            if (typeof oppoInfo['Server IP'] !== 'undefined') {
                if (this.OPPO_IP !== oppoInfo['Server IP'].replace(/\s+/g, '')) {
                    this.OPPO_IP = oppoInfo['Server IP'].replace(/\s+/g, '');
                    this.platform.log.debug('Oppo IP is: ' + this.OPPO_IP);
                    this.IPReceived = true;
                    setTimeout(() => {
                        this.login();
                    }, 500);
                    setTimeout(() => {
                        this.netConnect();
                    }, 1000);
                }
            }
        });
        this.discovery.bind(7624);

    }
    //////////////////UDP Server
    // Central event pipeline: dedupes raw events and routes to feature-specific handlers.
    async eventDecoder(dataReceived) {
        let str = (`${dataReceived}`);
        this.debugLogRateLimited('eventDecoder.raw', 2000, str);
        let res = str.split('@');
        res = [...new Set(res)];
        let i = 0;
        while (i < res.length) {
            if (res[i] === '') {
                //
            }
            else if (this.handleEventWithRules(res[i])) {
                //
            }
            //////////////Movie and chapter progress/////////////////////////////////////////////////
            else if (res[i].includes('UTC')) {
                this.newPowerState(true);
                this.newPlayBackState([true, false, false]);
                this.platform.log.debug(`Response: ${this.commandName(res[i])}`);
                let updateString = res[i].split(' ');
                let chapter = parseInt(updateString[2], 10);
                let time = this.timeToSeconds(updateString[4]);
                this.movieType = updateString[3];
                if (time === 0) {
                    this.currentMovieProgressFirst = true;
                    this.chapterFirstUpdate = true;
                    this.chapterFirstUpdateRemaining = true;
                    this.currentChapterSelector[0] = 0;
                }
                if (this.reconnectionCounter < this.reconnectionTry) {
                    if (this.currentMovieProgressFirst === true) {
                        this.firstElapsedMovie = time;
                        this.currentChapterSelector[0] = 0;
                        this.reconnectionCounter += 1;
                        if (this.chapterNumberRequest) {
                            this.chapterNumberRequest = false;
                            setTimeout(() => {
                                this.sending([this.query('MTR')]);
                            }, 1000);
                            setTimeout(() => {
                                this.sending([this.query('CHAPTER NUMBER')]);
                            }, 5000);
                            setTimeout(() => {
                                this.chapterNumberRequest = true;
                            }, 5100);
                        }
                    }
                    if (this.currentMovieProgressFirst === false) {
                        if (this.movieType === 'C') {
                            this.chapterElapsedFirst = this.firstElapsedMovie;
                            this.chapterRemainingFirst = this.movieRemaining;
                            this.newChapterTime(time);
                        }
                        this.newChapter(chapter);
                        this.newMovieTime(time);
                    }
                    if (this.chapterCounter === 0) {
                        this.currentTime = time;
                        this.chapterCounter = 1;
                    }
                    else {
                        if (this.currentTime !== time) {
                            this.chapterCounter = (time - this.currentTime);
                        }
                    }
                    if (this.chapterProgressUpdate) {
                        if (this.chapterCounter <= this.chapterElapsedFirst + this.chapterRemainingFirst && this.chapterCounter >= 0) {
                            if (this.movieType !== 'C') {
                                this.newChapterTime(this.chapterCounter);
                            }
                        }
                    }

                }
                if (this.reconnectionCounter >= this.reconnectionTry) {
                    this.chapterElapsedFirst = this.firstElapsedMovie;
                    this.chapterRemainingFirst = this.movieRemaining;
                    this.newChapter(chapter);
                    this.newMovieTime(time);
                    this.newChapterTime(time);
                    if (this.firstHttp === true) {
                        setTimeout(() => {
                            this.sending([this.query('POWER STATUS')]);
                        }, 1000);
                        this.firstHttp = false;
                    }
                }
            }
            else if (res[i].includes('QCE OK')) {
                this.platform.log.debug(`Response: ${res[i]}`);
                this.resetCounter();
                this.chapterCounter = this.timeToSeconds(this.justNumber(res[i]))
                if (this.chapterFirstUpdate === true) {
                    this.chapterElapsedFirst = this.timeToSeconds(this.justNumber(res[i]));
                    if (this.powerStateTV !== 1) {
                        setTimeout(() => {
                            this.sending([this.query('POWER STATUS')]);
                        }, 1000);
                    }
                    this.chapterFirstUpdate = false;
                }
                if (this.chapterFirstUpdate === false) {
                    this.newChapterTime(this.timeToSeconds(this.justNumber(res[i])));
                }
            }
            else if (res[i].includes('QCR OK')) {
                this.platform.log.debug(`Response: ${res[i]}`);
                this.resetCounter();
                if (this.chapterFirstUpdateRemaining === true) {
                    this.chapterRemainingFirst = this.timeToSeconds(this.justNumber(res[i])) + 3;
                    this.chapterFirstUpdateRemaining = false;
                }
            }
            else if (res[i].includes('MTR')) {
                this.platform.log.debug(`Response: ${res[i]}`);
                this.currentMovieProgressFirst = false;
            }
            else if (res[i].includes('QRE OK')) {
                this.platform.log.debug(`Response: ${res[i]}`);
                this.currentMovieProgressFirst = false;
                this.movieRemaining = this.timeToSeconds(this.justNumber(res[i]));
                if (this.firstElapsedMovie === 0) {
                    setTimeout(() => {
                        this.sending([this.query('MEDIA TIME ELAPSED')]);
                    }, 1000);
                }
            }
            else if (res[i].includes('QEL OK')) {
                this.platform.log.debug(`Response: ${res[i]}`);
                this.firstElapsedMovie = this.timeToSeconds(this.justNumber(res[i]));

            }
            else if (res[i].includes('QCH OK')) {
                this.resetCounter();
                this.platform.log.debug(`Response: ${res[i]}`);
                let numberArray = this.justNumber(res[i]).split('/')
                let number = parseInt(numberArray[0])
                this.currentChapterSelector[1] = parseInt(numberArray[1])
                this.newChapter(number);

            }
            ////////////////Volume and playback state update///////////////////////////////////////////////////////////
            else if (this.handleVolumeEvent(res[i])) {
                //
            }
            else if (this.handlePlaybackEvent(res[i])) {
                //
            }
            ///////////////////Video and sound update///////////////////////////////////////////////////
            else if (res[i].includes('U3D 2D') || res[i].includes('U3D 3D')) {
                this.currentMovieProgressFirst = true;
                this.chapterFirstUpdate = true;
                this.chapterFirstUpdateRemaining = true
                if (res[i].includes('U3D 3D')) {
                    this.videoIn3D = ' (3D)';
                }
                else {
                    this.videoIn3D = '';
                }

            }
            else if (res[i].includes('UDT')) {
                this.platform.log.debug(`Response: Disk Detected`);
                if (res[i].includes('UHBD')) {
                    this.diskType = 'Ultra HD Blu-ray Disc';
                }
                else if (res[i].includes('BDMV')) {
                    this.diskType = 'Blu-ray Disc';
                }
                else if (res[i].includes('DVDV')) {
                    this.diskType = 'DVD-Video';
                }
                else if (res[i].includes('DVDA')) {
                    this.diskType = 'DVD-Audio';
                }
                else if (res[i].includes('SACD')) {
                    this.diskType = 'SACD';
                }
                else if (res[i].includes('CDDA')) {
                    this.diskType = 'CDDA';
                }
                else if (res[i].includes('DATA')) {
                    this.diskType = 'Data disc';
                }
                else if (res[i].includes('VCD2')) {
                    this.diskType = 'VCD 2.0';
                }
                else if (res[i].includes('SVCD')) {
                    this.diskType = 'SVCD';
                }
                else if (res[i].includes('UNKW')) {
                    this.diskType = 'Unknown disc';
                }
                else {
                    this.diskType = 'Blu-Ray';
                }
            }
            else if (res[i].includes('UST')) {
                if (res[i].includes('00/')) {
                    this.newSubtitle = '';
                }
                else {
                    this.newSubtitle = ' (Subtitles in ' + this.newLanguageSelector(res[i]) + ')';
                }
                this.newLanguage(this.latestAudioName);

            }
            else if (res[i].includes('OK HDR')) {
                this.platform.log(`Response: HDR 10 Video`);
                this.updateHDRStatus([false, true, false]);
                this.newAudioFormat(this.latestAudioType);
            }
            else if (res[i].includes('OK SDR')) {
                this.platform.log(`Response: SDR Video`);
                this.updateHDRStatus([false, false, true]);
                this.newAudioFormat(this.latestAudioType);
            }
            else if (res[i].includes('OK DOV')) {
                this.platform.log(`Response: Dolby Vision Video`);
                this.updateHDRStatus([true, false, false]);
                this.newAudioFormat(this.latestAudioType);
            }
            ////////////////Input Update/////////////////////////////////////////////////////////
            else if (res[i].includes('BD-PLAYER')) {
                this.updateInputStatus([true, false, false, false, false, false, false, false, false, false], res[i]);
            }
            else if (res[i].includes('HDMI-IN')) {
                this.updateInputStatus([false, false, false, false, false, true, false, false, false, false], res[i]);
            }
            else if (res[i].includes('ARC-HDMI-OUT')) {
                this.updateInputStatus([false, false, false, false, false, false, true, false, false, false], res[i]);
            }
            else if (res[i].includes('OPTICAL')) {
                this.updateInputStatus([false, false, false, false, false, false, false, true, false, false], res[i]);
            }
            else if (res[i].includes('COAXIAL')) {
                this.updateInputStatus([false, false, false, false, false, false, false, false, true, false], res[i]);
            }
            else if (res[i].includes('USB-AUDIO')) {
                this.updateInputStatus([false, false, false, false, false, false, false, false, false, true], res[i]);
            }
            /////////////////Sound update/////////////////////////////////Dolby TrueHD
            else if (res[i].includes('UAT TM') || res[i].includes('UAT TH') || res[i].includes('UAT TS')
                || res[i].includes('OK DTS') || res[i].includes('OK DTS-HD') || res[i].includes('OK TS')
                || res[i].includes(SERVICE_NAMES.DTS)) {
                this.platform.log(`Response: DTS Sound`);
                this.newAudioStatus(res[i]);
                this.newLanguage(this.newLanguageSelector(res[i]));
                this.newAudioType([false, true]);
            }
            else if (res[i].includes('UAT DT') || res[i].includes('Dolby TrueHD') || res[i].includes('OK DT') || res[i].includes('QAT OK DD')) {
                this.platform.log(`Response: Dolby Atmos Sound`);
                this.newAudioStatus(res[i]);
                this.newLanguage(this.newLanguageSelector(res[i]));
                this.newAudioType([true, false]);
            }
            else if (res[i].includes('UAT DP') || res[i].includes('Dolby Digital Plus')) {
                this.platform.log(`Response: Dolby Atmos Sound`);
                this.newAudioStatus(res[i]);
                this.newLanguage(this.newLanguageSelector(res[i]));
                this.newAudioType([true, false]);

            }
            else if (res[i].includes('UAT DD') || res[i].includes('UAT TS') || res[i].includes('UAT TH')
                || res[i].includes('UAT PC') || res[i].includes('UAT PC') || res[i].includes('OK TS')
                || res[i].includes('UAT MP') || res[i].includes('UAT CD') || res[i].includes('UAT UN')
                || res[i].includes('OK TH') || res[i].includes('OK PC') || res[i].includes('OK PC')
                || res[i].includes('OK MP') || res[i].includes('OK CD') || res[i].includes('OK UN') || res[i].includes('OK LPCM')) {
                this.platform.log(`Response: ${this.commandName(res[i])}, Sound: ${res[i]}`);
                this.newLanguage(this.newLanguageSelector(res[i]));
                this.newAudioStatus(res[i]);
                this.newAudioType([false, false]);
            }
            else {
                if (!res[i].includes('QFN') && !res[i].includes('UAR') && !res[i].includes('UV') && !res[i].includes('UDT') && !res[i].includes('RST')) {
                    if (res[i].includes('DISC MENU') || res[i].includes('MEDIA CENTER') || res[i].includes('HOME MENU')
                        || res[i].includes('UPL HOME') || res[i].includes('USB IN') || res[i].includes('USB OU')) {
                        this.newResponse = '';
                    }
                    this.platform.log(`Response: ${this.commandName(res[i])} ${this.newResponse}`);
                }
                if (res[i].includes('OK')) {
                    this.resetCounter();
                }
            }
            await this.sleep(1000);
            i += 1;
        }
    }
    ///Query////////////////////////////////////////////////////////////////////////////////////////////////////
    // Extracts AVCHD display names from nested file paths while avoiding brittle index assumptions.
    extractAvchdInputName(bdFilePath) {
        const pathChunks = `${bdFilePath || ''}`.split('/').filter((chunk) => chunk !== '');
        this.platform.log.debug(pathChunks);
        if (pathChunks.length === 0) {
            return 'AVCHD';
        }
        const lastIndex = pathChunks.length - 1;
        const lastSegment = pathChunks[lastIndex];
        const previousSegment = pathChunks[lastIndex - 1];
        const thirdFromEndSegment = pathChunks[lastIndex - 2];
        if (lastSegment === 'BDMV' && previousSegment === 'AVCHD' && typeof thirdFromEndSegment !== 'undefined') {
            return thirdFromEndSegment;
        }
        if (lastSegment === 'BDMV' && previousSegment !== 'AVCHD' && typeof previousSegment !== 'undefined') {
            return previousSegment;
        }
        if (lastSegment === 'AVCHD' && typeof previousSegment !== 'undefined') {
            return previousSegment;
        }
        return lastSegment;
    }
    // Extracts the leading OPPO command token from a raw payload (for example "#QPW\r\n" -> "QPW").
    extractCommandCode(commandPayload) {
        return extractCommandCodeFromPayload(commandPayload);
    }
    //////////Current Status//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    findRuleMatch(eventMessage, rules) {
        for (const rule of rules) {
            if (this.matchesAnyPattern(eventMessage, rule.patterns)) {
                return rule;
            }
        }
        return null;
    }
    // Returns the cached power state when HomeKit requests the power switch state.
    getOn(callback) {
        let isOn = this.powerState;
        this.platform.log.debug('Get Power ->', isOn);
        callback(null, isOn);
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////Play
    getOrCreateInputSource(definition) {
        const service = this.accessory.getService(definition.serviceName) || this.createInputSourceService(definition);
        if (typeof definition.onGet === 'function') {
            service.getCharacteristic(this.platform.Characteristic.ConfiguredName)
                .on('get', (callback) => {
                    const currentValue = definition.onGet();
                    if (definition.logOnGet === true) {
                        this.platform.log.debug('Getting' + currentValue);
                    }
                    callback(null, currentValue);
                });
        }
        this.tvService.addLinkedService(service);
        this[definition.propertyName] = service;
        return service;
    }
    // Returns the static declarative list of optional stateless remote-button services.
    getStatelessSwitchConfigs() {
        return STATELESS_SWITCH_CONFIGS;
    }
    // Processes high-priority power and verbose-mode events before generic decoder handling.
    handleEventWithRules(eventMessage) {
        const nextVerboseAction = () => {
            if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                this.sending([this.pressedButton('VERBOSE MODE 3')]);
            }
            else {
                this.sending([this.query('POWER STATUS')]);
            }
        };
        if (eventMessage.includes('QVM OK 2')) {
            this.resetCounter();
            this.platform.log.debug('Response: Verbose Mode 2');
            setTimeout(() => nextVerboseAction(), 1000);
            return true;
        }
        if (eventMessage.includes('SVM OK 2')) {
            this.resetCounter();
            this.platform.log.debug('Response: Verbose Mode 2 Executed');
            setTimeout(() => nextVerboseAction(), 1000);
            return true;
        }
        if (eventMessage.includes('QVM OK 3')) {
            this.resetCounter();
            this.platform.log.debug('Response: Verbose Mode 3');
            setTimeout(() => {
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    this.sending([this.query('POWER STATUS')]);
                }
                else {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
            }, 1000);
            return true;
        }
        if (eventMessage.includes('SVM OK 3')) {
            this.resetCounter();
            this.platform.log.debug('Response: Verbose Mode 3 Executed');
            setTimeout(() => {
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    this.sending([this.query('POWER STATUS')]);
                }
                else {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
            }, 1000);
            return true;
        }
        if (eventMessage.includes('QVM OK 0')) {
            this.resetCounter();
            this.platform.log.debug('Response: Verbose Mode 0');
            setTimeout(() => {
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    this.sending([this.pressedButton('VERBOSE MODE 3')]);
                }
                else {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
            }, 1000);
            return true;
        }
        if (eventMessage.includes('QPW OK OFF')) {
            this.platform.log.debug('Response: Power Status Query Executed (Off)');
            this.resetCounter();
            this.turnOffAll();
            return true;
        }
        if (eventMessage.includes('POF OK')) {
            this.platform.log(`Response: ${this.commandName(eventMessage)} ${this.newResponse}`);
            this.resetCounter();
            this.turnOffAll();
            return true;
        }
        if (eventMessage.includes('UPW 0') || eventMessage.includes('OK UPW 0')) {
            if (!eventMessage.includes('OK UPW 0')) {
                this.platform.log(`Response: Power Off Executed ${this.newResponse}`);
            }
            this.turnOffAll();
            return true;
        }
        if (eventMessage.includes('UPW 1')) {
            this.platform.log('Response: Power On Executed');
            this.newPowerState(true);
            return true;
        }
        if (eventMessage.includes('PON OK')) {
            this.platform.log(`Response: ${this.commandName(eventMessage)}`);
            this.resetCounter();
            this.newPowerState(true);
            return true;
        }
        if (eventMessage.includes('QPW OK ON')) {
            this.platform.log('Response: Power Status Query Executed (On)');
            this.newPowerState(true);
            this.resetCounter();
            if (this.firstConnection === true) {
                this.firstConnection = false;
                this.cancelScheduledTimersByPrefix('poweron.');
                this.scheduleQueryTask('poweron.input', 1000, 'INPUT STATUS');
                if (this.playBackState[0] === false && this.playBackState[1] === false && this.playBackState[2] === false) {
                    this.scheduleQueryTask('poweron.playback', 4000, 'PLAYBACK STATUS');
                }
                if (this.currentVolume === 0) {
                    this.scheduleQueryTask('poweron.volume', 7000, 'VOLUME STATUS');
                }
                if (this.HDROutput[0] === false && this.HDROutput[1] === false && this.HDROutput[2] === false) {
                    this.scheduleQueryTask('poweron.hdr', 10000, 'HDR STATUS');
                }
            }
            return true;
        }
        return false;
    }
    // Processes playback lifecycle events and schedules follow-up media detail queries.
    handlePlaybackEvent(eventMessage) {
        const playRule = this.findRuleMatch(eventMessage, PLAYBACK_PLAY_RULES);
        if (playRule) {
            if (playRule.resetCounter) {
                this.resetCounter();
            }
            if (playRule.setPowerOn) {
                this.newPowerState(true);
            }
            this.newPlayBackState([true, false, false]);
            if (this.continueSending) {
                this.platform.log(playRule.logMessage);
                this.schedulePlaybackDetailQueries(playRule.profileName, playRule.startDelayMs, playRule.offsets);
            }
            return true;
        }
        if (eventMessage.includes('SRH OK')) {
            this.chapterFirstUpdate = true;
            this.chapterFirstUpdateRemaining = true;
            if (this.chapterProgressUpdate) {
                this.chapterProgressUpdate = false;
                if (this.loginCounter <= 10) {
                    setTimeout(() => {
                        this.sending([this.query('CHAPTER TIME ELAPSED')]);
                    }, 1000);
                    setTimeout(() => {
                        this.sending([this.query('CHAPTER TIME REMAINING')]);
                    }, 4000);
                    setTimeout(() => {
                        this.chapterProgressUpdate = true;
                    }, 4100);
                }
            }
            return true;
        }
        const pauseRule = this.findRuleMatch(eventMessage, PLAYBACK_PAUSE_RULES);
        if (pauseRule) {
            this.platform.log(pauseRule.logMessage);
            if (pauseRule.resetCounter) {
                this.resetCounter();
            }
            this.newPlayBackState([false, true, false]);
            return true;
        }
        const stopRule = this.findRuleMatch(eventMessage, PLAYBACK_STOP_RULES);
        if (stopRule) {
            if (!stopRule.logOnlyWhenPowered || this.powerState === true) {
                this.platform.log(stopRule.logMessage);
            }
            if (stopRule.resetCounter) {
                this.resetCounter();
            }
            if (stopRule.hdrResetMode === 'always' || (stopRule.hdrResetMode === 'whenPowered' && this.powerState === true)) {
                this.newHDRState([false, false, true]);
            }
            this.applyPlaybackStopReset(stopRule.resetOrder);
            return true;
        }
        if (this.matchesAnyPattern(eventMessage, PLAYBACK_UPL_PROGRESS_PATTERNS)) {
            this.applyPlaybackPauseOrStoppedState();
            this.platform.log(`Response: ${this.commandName(eventMessage)}`);
            return true;
        }
        if (this.matchesAnyPattern(eventMessage, PLAYBACK_OK_PROGRESS_PATTERNS)) {
            this.resetCounter();
            this.applyPlaybackPauseOrStoppedState();
            this.platform.log(`Response: ${this.commandName(eventMessage)}`);
            return true;
        }
        if (this.matchesAnyPattern(eventMessage, PLAYBACK_HOME_MENU_PATTERNS)) {
            this.platform.log(`Response: ${this.commandName(eventMessage)}`);
            if (eventMessage.includes('HOME MENU')) {
                this.resetCounter();
            }
            this.newPowerState(true);
            this.newPlayBackState([false, false, false]);
            this.newHDRState([false, false, true]);
            this.newAudioType([false, false]);
            this.newInputName('Blu-ray');
            this.movieChapterDefault();
            this.mediaDetailsReset();
            if (this.currentVolume === 0) {
                this.scheduleQueryTask('home.volume', 2000, 'VOLUME STATUS');
            }
            return true;
        }
        return false;
    }
    // Enforces reconnect-limit behavior and transitions services to offline state once exceeded.
    handleReconnectLimitExceeded(updateConnectionLimitStatus) {
        if (this.reconnectionCounter > this.reconnectionTry) {
            if (updateConnectionLimitStatus) {
                this.connectionLimit = true;
                this.connectionLimitStatus = 1;
            }
            if (this.turnOffAllUsed === false) {
                this.turnOffAll();
                this.turnOffAllUsed = true;
            }
        }
    }
    // Parses TCP/HTTP volume responses and normalizes mute/level updates into shared state.
    handleVolumeEvent(eventMessage) {
        if (eventMessage.includes('UVL')) {
            if (eventMessage.includes('UMT')) {
                if (this.powerState === false) {
                    this.newVolumeStatus(0);
                }
                else {
                    this.platform.log.debug('Response: Unmuted (UVL)');
                    this.newVolumeStatus(this.targetVolume);
                }
            }
            else if (!eventMessage.includes('MUT')) {
                const numberOnly = this.parseNumericValue(eventMessage);
                this.newVolumeStatus(parseInt(numberOnly, 10));
                this.targetVolume = numberOnly;
                if (this.powerState === true) {
                    this.platform.log(`Response: Volume Level set to ${numberOnly} (UVL)`);
                }
            }
            else {
                this.platform.log('Response: Muted (UVL)');
                this.newVolumeStatus(0);
            }
            return true;
        }
        if (eventMessage.includes('QVL OK')) {
            this.platform.log(`Response: ${this.commandName(eventMessage)}`);
            if (eventMessage.includes('UMT')) {
                this.newVolumeStatus(this.targetVolume);
            }
            else if (!eventMessage.includes('MUT')) {
                const numberOnly = this.parseNumericValue(eventMessage);
                this.newVolumeStatus(parseInt(numberOnly, 10));
                this.targetVolume = numberOnly;
            }
            else {
                this.newVolumeStatus(0);
            }
            this.resetCounter();
            return true;
        }
        if (eventMessage.includes('SVL OK')) {
            if (eventMessage.includes('MUTE')) {
                this.platform.log('Response: Mute Executed (SVL)');
                this.newVolumeStatus(0);
            }
            else {
                const numberOnly = this.parseNumericValue(eventMessage);
                this.platform.log(`Response: Volume set to ${numberOnly} (SVL)`);
                this.newVolumeStatus(parseInt(numberOnly, 10));
                this.targetVolume = numberOnly;
            }
            this.resetCounter();
            return true;
        }
        return false;
    }
    // Translates OPPO HTTP payload responses into synthetic decoder events and state updates.
    httpEventDecoder(rawData, key) {
        if (rawData.success === true) {
            if (typeof (rawData.playinfo) !== 'undefined') {
                if (typeof (rawData.playinfo.file_path) !== 'undefined') {
                    if (rawData.playinfo.file_path === 'AVCHD') {
                        const nameInput = this.extractAvchdInputName(rawData.playinfo.bd_file_path || rawData.playinfo.file_path);
                        this.newInputName(nameInput);

                    }
                }
                if (typeof (rawData.playinfo.file_name) !== 'undefined') {
                    this.newInputName(rawData.playinfo.file_name)
                    this.platform.log(`Response: ${rawData.playinfo.file_name} is Playing`);
                }
                if (typeof (rawData.playinfo.total_time) !== 'undefined') {
                    this.firstElapsedMovie = rawData.playinfo.cur_time
                    this.platform.log.debug(this.firstElapsedMovie)
                    this.movieRemaining = rawData.playinfo.total_time - rawData.playinfo.cur_time
                    this.platform.log.debug(this.movieRemaining)
                    this.newMovieTime(rawData.playinfo.cur_time)
                }
            }
            if (typeof (rawData.is_muted) !== 'undefined') {
                if (rawData.is_muted === true) {
                    this.eventDecoder('@UVL MUT')
                }
                if (rawData.is_muted === false) {
                    this.eventDecoder('@UVL UMT');
                }
            }
            if (typeof (rawData.audio_list) !== 'undefined') {
                let i = 0;
                while (rawData.audio_list.length > i) {
                    this.platform.log.debug(rawData.audio_list[i]);
                    if (rawData.audio_list[i].selected === true) {
                        let newAudioPlusLanguage = rawData.audio_list[i].name.split(' ');
                        if (newAudioPlusLanguage[1].length < 2) {
                            this.newLanguage('Unknown' + ' (' + newAudioPlusLanguage[0] + ')')
                        }
                        else {
                            this.newLanguage(newAudioPlusLanguage[1] + ' (' + newAudioPlusLanguage[0] + ')')
                        }
                        this.newAudioStatusHttp(rawData.audio_list[i].name);
                        i = rawData.audio_list.length;
                    }
                    else {
                        i += 1;
                    }
                }
            }
            if (typeof (rawData.curr_volume) !== 'undefined') {
                if (this.powerState === true) {
                    this.eventDecoder("@UVL " + rawData.curr_volume)
                }
                if (this.powerState === false) {
                    this.eventDecoder("@UVL 0")
                }
            }
            /////////////////////////Needs Work
            if (typeof (rawData.is_video_playing) !== 'undefined') {
                if (rawData.is_video_playing === false && rawData.is_audio_playing === false && rawData.is_pic_playing === false
                    && rawData.is_bdmv_playing === false) {
                    this.eventDecoder("@UPL HTTP STOP");
                }
                else {
                    if (this.playBackState[1] === true)
                        this.eventDecoder("@UPL HTTP PAUS");
                    else if (this.playBackState[0] === true) {
                        this.eventDecoder("@UPL HTTP PLAY");
                    }
                }
            }
            ///////
            if (typeof (rawData.total_time) !== 'undefined') {
                if (rawData.total_time !== 0 || rawData.disc_total_time !== 0) {
                    if (rawData.total_time < rawData.disc_total_time) {
                        this.firstElapsedMovie = rawData.disc_cur_time
                        this.movieRemaining = rawData.disc_total_time - rawData.disc_cur_time
                        this.newMovieTime(rawData.disc_cur_time)
                    }
                    else {
                        this.firstElapsedMovie = rawData.cur_time
                        this.movieRemaining = rawData.total_time - rawData.cur_time
                        this.newMovieTime(rawData.cur_time)
                    }
                }
            }
            key = key.substring(1);
            if (!key.startsWith("Q")) {
                this.platform.log.debug("Command Sent through HTTP: " + key)
                if (this.powerStateTV === 1) {
                    switch (key) {
                        //POWER ButtonGroup
                        case 'POF':
                            key = 'OK UPW 0';
                            break;
                        case 'PLA':
                            key = 'UPL HTTP PLAY';
                            break;
                        case 'PAU':
                            key = 'UPL HTTP PAUS';
                            break;
                        case 'STP':
                            key = 'UPL HTTP STOP';
                            break;
                    }
                    this.eventDecoder("@" + key);
                }
            }
            else {
            }
        }
    }
    ///Event decoder//////////////////////////////////////////////////////////////////////////////////////////////////////////////
    initCharacteristicCache() {
        this.cachedCharacteristics = {
            tvActive: this.tvService.getCharacteristic(this.platform.Characteristic.Active),
            tvCurrentMediaState: this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState),
            tvActiveIdentifier: this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier),
            bluRayConfiguredName: this.bluRay.getCharacteristic(this.platform.Characteristic.ConfiguredName),
            runtimeConfiguredName: this.runtime.getCharacteristic(this.platform.Characteristic.ConfiguredName),
            currentChapterConfiguredName: this.currentChaper.getCharacteristic(this.platform.Characteristic.ConfiguredName),
            audioFormatConfiguredName: this.audioFormat.getCharacteristic(this.platform.Characteristic.ConfiguredName),
            audioLanguageConfiguredName: this.audioLanguage.getCharacteristic(this.platform.Characteristic.ConfiguredName),
            connectionMotionDetected: this.connectionStatus.getCharacteristic(this.platform.Characteristic.MotionDetected),
            connectionStatusFault: this.connectionStatus.getCharacteristic(this.platform.Characteristic.StatusFault),
            speakerVolume: this.speakerService.getCharacteristic(this.platform.Characteristic.Volume),
            speakerMute: this.speakerService.getCharacteristic(this.platform.Characteristic.Mute),
        };
    }
    // Returns true when the TCP socket exists and is writable for outbound commands.
    isClientReady() {
        return !!this.client && this.client.writable && this.client.destroyed !== true;
    }
    // Determines whether playback-dependent metadata should be shown in HomeKit services.
    isPlaybackVisible() {
        return this.playBackState[0] === true || this.playBackState[1] === true;
    }
    // Extracts numeric content from protocol strings that include command prefixes or labels.
    justNumber(number) {
        let timeDate = number.replace(/^\D+/g, '')
        return timeDate
    }
    // Resets the default queued key to the verbose-mode query after transient command use.
    keyReset() {
        setTimeout(() => {
            this.key = this.query('VERBOSE MODE');
        }, 1000)
    }
    // Performs the power-on/login bootstrap sequence and primes initial status query flow.
    login() {
        if (this.loginTimeOut === true && this.loginCounter <= 30) {
            if (IPV4_REGEX.test(this.OPPO_IP)) {
                this.loginCounter += 1;
                this.platform.log.debug('Login to Oppo');
                const loginClient = udp.createSocket('udp4');
                const login = Buffer.from('NOTIFY OREMOTE LOGIN');
                this.loginTO();
                loginClient.send(login, 7624, this.OPPO_IP, (err) => {
                    this.platform.log.debug('UDP message sent to devices')
                    this.platform.log.debug('Error:' + err);
                    loginClient.close();
                });
            }
            else {
                this.platform.log.debug("IP not set yet or is invalid");
            }
        }
    }
    ///////Handlers////////////////////////////////////////////////////////////////////////////////////////
    loginTO() {
        this.loginTimeOut = false;
        setTimeout(() => {
            this.loginTimeOut = true;
        }, 5 * 60000);
    }
    // Periodically emits transport metrics and resets counters for the next interval window.
    logMetricsIfNeeded() {
        const now = Date.now();
        if (now - this.metrics.lastMetricsLogAt < 300000) {
            return;
        }
        this.metrics.lastMetricsLogAt = now;
        this.platform.log.debug(`Metrics tcpWrites=${this.metrics.tcpWrites} httpRequests=${this.metrics.httpRequests} skippedQueries=${this.metrics.skippedQueries} coalescedCommands=${this.metrics.coalescedCommands} reconnectionCounter=${this.reconnectionCounter}`);
        this.metrics.tcpWrites = 0;
        this.metrics.httpRequests = 0;
        this.metrics.skippedQueries = 0;
        this.metrics.coalescedCommands = 0;
    }
    // Resolves a command payload into the best HTTP URL path using route and fallback builders.
    makeUrl(key) {
        this.platform.log.debug('HTTP counter: ' + this.httpNotResponding)
        if (key.includes('SRH')) {
            const searchUrl = this.buildSearchTimeUrl(key);
            if (searchUrl) {
                this.platform.log.debug(searchUrl);
                return searchUrl;
            }
        }
        if (key.includes('SVL')) {
            const url = this.buildVolumeUrl(key);
            this.platform.log.debug(`Sending: Volume Change to ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        if (key.includes('PON')) {
            // let url = "http://" + this.OPPO_IP + ":436/signin?%7B%22appIconType%22%3A1%2C%22appIpAddress%22%3A%22" + this.localIP + "%22%7D";
            const url = this.buildHttpBaseUrl(`signin?%7B%22appIpAddress%22%3A%22${this.localIP}%22%2C%22appIconType%22%3A1%7D`);
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        const mappedUrl = this.buildMappedHttpUrl(key);
        if (mappedUrl) {
            return mappedUrl;
        }
        return this.buildRemoteKeyUrl(key);
    }
    // Returns true when an event matches at least one string pattern in a rule set.
    matchesAnyPattern(eventMessage, patterns) {
        return patterns.some((pattern) => eventMessage.includes(pattern));
    }
    // Resets media metadata strings to default placeholders used in hidden/idle states.
    mediaDetailsReset() {
        this.showState = false;
        this.continueSending = true;
        this.continueSendingUpdate = true;
        this.mediaDetailsCounter = 0;
        this.videoIn3D = '';
        this.newSubtitle = '';
        this.diskType = '';
        this.chapterNumberRequest = true;
        this.chapterProgressUpdate = true;
        this.newInputName('Blu-ray');
        this.newAudioFormat('Video and Audio Format');
        this.newInputDuration('Runtime');
        this.newCurrentChapter('Current Chapter');
        this.newLanguage('Audio Language');
    }
    // Resets movie/chapter progress trackers and associated control-state flags.
    movieChapterDefault() {
        this.currentTime = 0;
        this.movieRemaining = 0;
        this.firstElapsedMovie = 0;
        this.chapterRemaining = 0;
        this.chapterRemainingFirst = 0;
        this.chapterElapsedFirst = 0;
        this.chapterCounter = 0;
        if (this.config.movieControl === true) {
            this.currentMovieProgressFirst = true;
            this.newMovieTime(0);
        }
        if (this.config.chapterControl === true) {
            this.chapterFirstUpdate = true;
            this.chapterFirstUpdateRemaining = true
            this.newChapterTime(0);
        }
        if (this.config.chapterSelector === true) {
            this.chapterFirstUpdate = true;
            this.chapterFirstUpdateRemaining = true;
            this.newChapter(0);
        }
    }
    // Formats an OPPO search command that seeks to a movie time position.
    movieTime(number) {
        let key;
        if (!this.movieType.includes('C')) {
            key = '#SRH ';
        }
        else {
            key = '#SRH T ';
        }
        key += number
        key += '\r\n';
        return key;
    }
    ////Update instructions
    netConnect() {
        if (this.connectionLimitStatus !== 1) {
            this.startSocketConnection();
        }
        else {
            if (!this.hourlyReconnectTimer) {
                this.hourlyReconnectTimer = setTimeout(() => {
                    this.hourlyReconnectTimer = null;
                    this.startSocketConnection();
                }, 3600000);
            }
        }
    }
    // Re-enables TCP connection attempts after the configured connection timeout window.
    netConnectTO() {
        this.netConnectTimeOut = false;
        setTimeout(() => {
            this.netConnectTimeOut = true;
        }, 1000);
    }
    // Normalizes and publishes the current audio format label to linked HomeKit metadata services.
    newAudioFormat(audioType) {
        this.latestAudioType = audioType;
        this.refreshShowState();
        ///Video Format
        let videoFormat = '';
        if (this.HDROutput[0] === true) {
            videoFormat = 'Dolby Vision';
        }
        else if (this.HDROutput[1] === true) {
            videoFormat = 'HDR 10';
        }
        else if (this.HDROutput[2] === true) {
            videoFormat = 'SDR';
        }
        if (videoFormat === '' && this.latestAudioType !== '') {
            this.mediaAudioFormat = this.latestAudioType;
        }
        else if (videoFormat !== '' && this.latestAudioType === 'Video and Audio Format') {
            this.mediaAudioFormat = this.latestAudioType;
        }
        else if (videoFormat === '' && this.latestAudioType === '') {
            this.mediaAudioFormat = 'No Video or Sound Type Available'
        }
        else if (videoFormat !== '' && this.latestAudioType === '') {
            this.mediaAudioFormat = videoFormat;
        }
        else {
            this.mediaAudioFormat = videoFormat + ' - ' + this.latestAudioType;
        }
        ///////
        if (typeof this.mediaAudioFormat !== 'undefined') {
            this.platform.log.debug('New video or audio format: ' + this.mediaAudioFormat);
            if (this.audioFormat.getCharacteristic(this.platform.Characteristic.ConfiguredName).value !== this.mediaAudioFormat) {
                this.updateConfiguredNameAndVisibility(this.audioFormat, this.mediaAudioFormat, this.showState);
            }
        }
    }
    // Decodes TCP audio format responses using prioritized rule mapping.
    newAudioStatus(audio) {
        this.platform.log('Audio', audio);
        const newAudio = this.resolveMappedLabel(audio, AUDIO_STATUS_RULES, 'Unknown');
        this.newAudioFormat(newAudio);
    }
    // Decodes HTTP audio format strings using HTTP-specific rule mapping.
    newAudioStatusHttp(audio) {
        this.platform.log.debug(audio);
        const newAudio = this.resolveMappedLabel(audio, HTTP_AUDIO_STATUS_RULES, (value) => value.split(' ')[2] || 'Unknown');
        this.newAudioFormat(newAudio);
    }

    // Updates binary audio-type sensor state (Dolby/DTS) while preserving cached state.
    newAudioType(newAT) {
        this.audioType = newAT;
        if (this.config.mediaAudioVideoState === true) {
            if (this.dolbySound.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.audioType[0]) {
                this.dolbySound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[0]);
            }
            if (this.dtsSound.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.audioType[1]) {
                this.dtsSound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[1]);
            }
        }
    }
    // Updates chapter selector values and derived chapter progress percentages.
    newChapter(newChapterUpdate) {
        if (newChapterUpdate === 0) {
            this.currentChapterSelectorState = false;
            this.currentChapterSelector[0] = 0;

            if (this.config.chapterSelector === true) {
                if (this.config.changeDimmersToFan === false) {
                    this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.Brightness)
                        .setProps({
                            minValue: 0,
                            maxValue: 100,
                            minStep: 1,
                        })
                }
                else {
                    this.chapterSelectorF.getCharacteristic(this.platform.Characteristic.RotationSpeed)
                        .setProps({
                            minValue: 0,
                            maxValue: 100,
                            minStep: 1,
                        })
                }
            }

        }
        if (this.currentChapterSelector[0] !== newChapterUpdate) {
            if (newChapterUpdate === 0) {
                this.currentChapterSelectorState = false;
            }
            if (newChapterUpdate !== 0) {
                this.currentChapterSelectorState = true;
                if (newChapterUpdate !== this.currentChapterSelector[0]) {
                    this.chapterFirstUpdate = true;
                    this.chapterFirstUpdateRemaining = true;
                    this.chapterCounter = 0
                    if (this.chapterProgressUpdate) {
                        this.chapterProgressUpdate = false;
                        if (this.loginCounter <= 10) {
                            setTimeout(() => {
                                this.sending([this.query('CHAPTER TIME ELAPSED')]);
                            }, 500);
                            setTimeout(() => {
                                this.sending([this.query('MTR')]);
                            }, 2000);
                            setTimeout(() => {
                                this.sending([this.query('CHAPTER TIME REMAINING')]);
                            }, 3500);
                        }
                        setTimeout(() => {
                            this.chapterProgressUpdate = true;
                        }, 3600);
                    }
                    if (this.firstElapsedMovie + this.movieRemaining > 1800 && this.currentChapterSelector[1] > 10) {
                        if (this.config.chapterSelector === true) {
                            if (this.config.changeDimmersToFan === false) {
                                this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.Brightness)
                                    .setProps({
                                        minValue: 0,
                                        maxValue: this.currentChapterSelector[1],
                                        minStep: 1,
                                    })

                            }
                            else {
                                this.chapterSelectorF.getCharacteristic(this.platform.Characteristic.RotationSpeed)
                                    .setProps({
                                        minValue: 0,
                                        maxValue: this.currentChapterSelector[1],
                                        minStep: 1,
                                    })
                            }
                        }

                    }
                }
            }
            this.currentChapterSelector[0] = newChapterUpdate;
            if (this.config.chapterSelector === true) {
                if (this.config.changeDimmersToFan === false) {
                    if (this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.Brightness).value !== this.currentChapterSelector[0]) {
                        this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterSelector[0]);
                        this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.On, this.currentChapterSelectorState);
                    }
                }
                else {
                    if (this.chapterSelectorF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentChapterSelector[0]) {
                        this.chapterSelectorF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentChapterSelector[0]);
                        this.chapterSelectorF.updateCharacteristic(this.platform.Characteristic.Active, this.currentChapterSelectorState === true ? 1 : 0);
                    }
                }
            }
            setTimeout(() => {
                if (this.chapterProgressUpdate) {
                    let totalChapterTime = '';
                    if (this.chapterElapsedFirst + this.chapterRemainingFirst !== 0) {
                        totalChapterTime = this.secondsToTime(this.chapterElapsedFirst + this.chapterRemainingFirst);
                    }
                    if (totalChapterTime.startsWith('0')) {
                        totalChapterTime = totalChapterTime.substring(1);
                    }
                    if (this.chapterElapsedFirst + this.chapterRemainingFirst === 0) {
                        this.newCurrentChapter('Chapter ' + this.currentChapterSelector[0] + '/' + this.currentChapterSelector[1]);
                    }
                    else {
                        if (this.chapterElapsedFirst + this.chapterRemainingFirst > 3600) {
                            this.chapterHoursOrMinutes = 'Hours';
                        }
                        else if (this.chapterElapsedFirst + this.chapterRemainingFirst === 3600) {
                            this.chapterHoursOrMinutes = 'Hour';
                        }
                        else {
                            this.chapterHoursOrMinutes = 'Minutes';
                        }
                        this.newCurrentChapter('Chapter ' + this.currentChapterSelector[0] + '/' + this.currentChapterSelector[1] + ', Duration: ' + totalChapterTime + ' ' + this.chapterHoursOrMinutes);
                    }
                }
            }, 10000);

        }
    }
    // Updates chapter elapsed/remaining progress values and chapter control switch state.
    newChapterTime(newTime) {
        if (newTime === 0 && this.playBackState[0] === false && this.playBackState[1] === false) {
            this.currentChapterTimeState = false;
            this.currentChapterTime = 0;
        }
        if (newTime !== 0) {
            this.currentChapterTimeState = true;
        }
        if (this.chapterElapsedFirst + this.chapterRemainingFirst !== 0) {
            this.currentChapterTime = Math.round(newTime * 100 / (this.chapterElapsedFirst + this.chapterRemainingFirst));
        }
        if (this.currentChapterTimeState === true && this.currentChapterTime === 0) {
            this.currentChapterTime = 1;
        }
        if (this.currentChapterTime > 100) { this.currentChapterTime = 100 }
        if (this.config.chapterControl === true) {
            if (this.config.changeDimmersToFan === false) {
                if (this.chapterControlL.getCharacteristic(this.platform.Characteristic.Brightness).value !== this.currentChapterTime) {
                    this.chapterControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterTime);
                    this.chapterControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentChapterTimeState);
                }
            }
            else {
                if (this.chapterControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentChapterTime) {
                    this.chapterControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentChapterTime);
                    this.chapterControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentChapterTimeState === true ? 1 : 0);
                }

            }
        }
    }
    // Publishes current chapter metadata text with visibility-aware updates.
    newCurrentChapter(currentChapter) {
        this.refreshShowState();
        if (typeof currentChapter !== 'undefined') {
            if (currentChapter.length >= 64) {
                currentChapter = currentChapter.slice(0, 60) + "...";
            }
            this.platform.log.debug('New input progress: ' + currentChapter);
            if (this.mediaChapter !== currentChapter) {
                this.mediaChapter = currentChapter;
                this.updateConfiguredNameAndVisibility(this.currentChaper, this.mediaChapter, this.showState);
            }
        }
    }
    // Updates HDR sensor state flags and synchronizes related metadata presentation.
    newHDRState(newHDR) {
        this.HDROutput = newHDR;
        if (this.config.mediaAudioVideoState === true) {
            if (this.dolbyVision.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.HDROutput[0]) {
                this.dolbyVision.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[0]);
            }
            if (this.hdr10.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.HDROutput[1]) {
                this.hdr10.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[1]);
            }
            if (this.SDR.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.HDROutput[2]) {
                this.SDR.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[2]);
            }
        }

    }
    // Publishes runtime metadata text with current playback visibility rules.
    newInputDuration(newDuration) {
        if (typeof newDuration !== 'undefined') {
            this.platform.log.debug('New input duraiton: ' + newDuration);
            if (!newDuration.includes('Runtime')) {
                this.mediaDuration = 'Runtime: ' + newDuration + ' ' + this.mediaHoursOrMinutes;

            }
            else {
                this.mediaDuration = newDuration;
            }
            if (this.runtime.getCharacteristic(this.platform.Characteristic.ConfiguredName).value !== this.mediaDuration) {
                this.updateConfiguredNameAndVisibility(this.runtime, this.mediaDuration, this.showState);
            }
        }
    }
    // Normalizes, trims, and publishes active media title/name metadata.
    newInputName(newName) {
        this.refreshShowState();
        newName = this.stripMediaNameExtension(newName);
        this.inputName = newName + this.videoIn3D
        if (newName.includes('Blu-ray') && this.diskType !== '') {
            this.inputName = this.diskType + this.videoIn3D
        }

        if (this.inputName.length >= 64) {
            this.inputName = this.inputName.slice(0, 60) + "...";
        }

        if (this.bluRay.getCharacteristic(this.platform.Characteristic.ConfiguredName).value !== this.inputName) {
            this.platform.log.debug(this.inputName);
            this.bluRay.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName)
        }
    }
    // Updates input-state array and maps active source to HomeKit ActiveIdentifier.
    /** @param {InputStateVector} newInput */
    newInputState(newInput) {
        newInput = normalizeInputState(newInput);
        const isSameInputState = Array.isArray(this.inputState)
            && Array.isArray(newInput)
            && this.inputState.length === newInput.length
            && this.inputState.every((value, index) => value === newInput[index]);
        if (!isSameInputState) {
            this.inputState = [...newInput];
            const selectedInputIndex = this.inputState.findIndex((inputStateValue) => inputStateValue === true);
            if (selectedInputIndex >= 0) {
                this.inputID = selectedInputIndex + 1;
            }
            else {
                this.inputID = this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier).value;
            }
            this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
            if (this.config.inputButtons === true) {
                this.bluRayInput.updateCharacteristic(this.platform.Characteristic.On, this.inputState[0]);
                this.hdmiIn.updateCharacteristic(this.platform.Characteristic.On, this.inputState[5]);
                this.hdmiOut.updateCharacteristic(this.platform.Characteristic.On, this.inputState[6]);
                if (this.config.oppo205 === true) {
                    this.opticalB.updateCharacteristic(this.platform.Characteristic.On, this.inputState[7]);
                    this.coaxialB.updateCharacteristic(this.platform.Characteristic.On, this.inputState[8]);
                    this.usbAudioB.updateCharacteristic(this.platform.Characteristic.On, this.inputState[9]);
                }
            }
        }
    }
    /////////////////HTTP Event decoder
    newLanguage(lang) {
        this.latestAudioName = lang;
        this.platform.log.debug('New audio language: ' + lang);
        this.refreshShowState();
        if (typeof lang !== 'undefined') {
            this.platform.log.debug('New audio language: ' + lang + this.newSubtitle);
            if (this.language !== 'Audio: ' + lang + this.newSubtitle) {
                if (lang === 'Audio Language') {
                    this.language = lang;
                }
                else {
                    this.language = 'Audio: ' + lang + this.newSubtitle;
                }
                this.updateConfiguredNameAndVisibility(this.audioLanguage, this.language, this.showState);
            }
        }
    }

    // Maps language codes from transport events to human-readable labels.
    newLanguageSelector(langSelector) {
        const correctLanguage = this.resolveMappedLabel(langSelector, LANGUAGE_SELECTOR_RULES, 'Language Undefined');
        this.platform.log.debug('New language', correctLanguage);
        return correctLanguage;
    }
    // Updates movie progress percentage and state from elapsed/remaining counters.
    newMovieTime(newMovieTime) {
        this.showState = true;
        if (newMovieTime === 0) {
            this.currentMovieProgressState = false;
            this.currentMovieProgress = 0;
        }
        if (newMovieTime !== 0) {
            this.currentMovieProgressState = true;
        }
        if (this.firstElapsedMovie + this.movieRemaining !== 0) {
            this.currentMovieProgress = Math.round(newMovieTime * 100 / (this.firstElapsedMovie + this.movieRemaining));
            let runtimeNumber = this.secondsToTime(parseInt(this.firstElapsedMovie + this.movieRemaining));
            if (runtimeNumber.startsWith('0')) {
                runtimeNumber = runtimeNumber.substring(1);
            }
            if (this.firstElapsedMovie + this.movieRemaining > 3600) {
                this.mediaHoursOrMinutes = 'Hours';
            }
            else if (this.firstElapsedMovie + this.movieRemaining === 3600) {
                this.mediaHoursOrMinutes = 'Hour';
            }
            else {
                this.mediaHoursOrMinutes = 'Minutes';
            }
            this.newInputDuration(runtimeNumber);
        }
        if (this.currentMovieProgressState === true && this.currentMovieProgress === 0) {
            this.currentMovieProgress = 1;
        }
        if (this.currentMovieProgress > 100) { this.currentMovieProgress = 100 }
        if (this.config.movieControl === true) {
            if (this.config.changeDimmersToFan === false) {
                if (this.movieControlL.getCharacteristic(this.platform.Characteristic.Brightness).value !== this.currentMovieProgress) {
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentMovieProgress);
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentMovieProgressState);
                }
            }
            else {
                if (this.movieControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentMovieProgress) {
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentMovieProgress);
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentMovieProgressState === true ? 1 : 0);
                }
            }
        }
        if (this.config.remainMovieTimer) {
            if (this.movieTimer.getCharacteristic(this.platform.Characteristic.Active).value !== (this.currentMovieProgressState ? 1 : 0)) {
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.Active, this.currentMovieProgressState ? 1 : 0);
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.InUse, this.currentMovieProgressState ? 1 : 0);
            }
            if (this.firstElapsedMovie + this.movieRemaining - newMovieTime !== this.movieTimer.getCharacteristic(this.platform.Characteristic.RemainingDuration).value) {
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.firstElapsedMovie + this.movieRemaining - newMovieTime);
            }
            if (this.firstElapsedMovie + this.movieRemaining !== this.movieTimer.getCharacteristic(this.platform.Characteristic.SetDuration).value) {
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.SetDuration, this.firstElapsedMovie + this.movieRemaining);
            }
        }

    }
    // Updates playback tri-state (playing/paused/stopped) and linked HomeKit characteristics.
    /** @param {PlaybackStateVector} newPlay */
    newPlayBackState(newPlay) {
        newPlay = normalizePlaybackState(newPlay);
        this.playBackState = newPlay;
        if (this.playBackState[0] === true) {
            this.mediaState = 0;
        }
        if (this.playBackState[1] === true) {
            this.mediaState = 1;
        }
        if (this.playBackState[2] === true) {
            this.mediaState = 2;
        }
        if (this.playBackState[0] === false && this.playBackState[1] === false && this.playBackState[2] === false) {
            this.mediaState = 4;
        }
        if (this.play.getCharacteristic(this.platform.Characteristic.On).value !== this.playBackState[0]) {
            this.play.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[0]);
        }
        if (this.pause.getCharacteristic(this.platform.Characteristic.On).value !== this.playBackState[1]) {
            this.pause.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[1]);
        }
        if (this.stop.getCharacteristic(this.platform.Characteristic.On).value !== this.playBackState[2]) {
            this.stop.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[2]);
        }
        if (this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState).value !== this.mediaState) {
            this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);

        }

    }
    // Updates power state and synchronizes dependent media/input defaults on transitions.
    newPowerState(newValue) {

        if (newValue === true && this.turnOffCommandOn === true) {
            newValue = false;
        }
        if (newValue === false && this.turnOnCommandOn === true) {
            newValue = true;
        }
        if (newValue === true) {
            this.powerStateTV = 1;
        }
        else {
            this.powerStateTV = 0;
        }
        this.powerState = newValue;
        if (this.tvService.getCharacteristic(this.platform.Characteristic.Active).value !== this.powerStateTV) {
            this.tvService.updateCharacteristic(this.platform.Characteristic.Active, this.powerStateTV);
            if (this.config.powerB === true) {
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.powerState);
            }
        }
    }
    // Updates volume, mute, and derived switch characteristics from latest volume state.
    newVolumeStatus(newVolumeNum) {
        this.currentVolume = newVolumeNum;
        if (newVolumeNum === 0) {
            this.currentMuteState = true;
            this.currentVolumeSwitch = false;
        }
        if (newVolumeNum !== 0) {
            this.currentMuteState = false;
            this.currentVolumeSwitch = true;
        }
        if (this.speakerService.getCharacteristic(this.platform.Characteristic.Volume).value !== this.currentVolume) {
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Volume, this.currentVolume);
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Mute, this.currentMuteState);
            if (this.config.volume === true) {
                if (this.config.changeDimmersToFan === false) {
                    this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentVolume);
                    this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.On, this.currentVolumeSwitch);
                }
                else {
                    this.volumeFan.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentVolume);
                    this.volumeFan.updateCharacteristic(this.platform.Characteristic.Active, this.currentVolumeSwitch === true ? 1 : 0);
                }
            }
        }
    }
    // Extracts numeric payload values from command responses using shared parser logic.
    parseNumericValue(eventMessage) {
        return parseNumericValueFromPayload(eventMessage);
    }
    // Returns Pause switch state for HomeKit reads.
    pauseSwitchStateGet(callback) {
        this.platform.log.debug('Pause State');
        let currentValue = this.playBackState[1];
        callback(null, currentValue);
    }
    // Handles Pause switch writes by dispatching pause commands and resetting switch state.
    pauseSwitchStateSet(value, callback) {
        this.platform.log.debug('Pause set to', value);
        if (value === true) {
            this.sending([this.pressedButton('PAUSE')]);
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////stop
    playSwitchStateGet(callback) {
        this.platform.log.debug('Play State');
        let currentValue = this.playBackState[0];
        callback(null, currentValue);
    }
    // Handles Play switch writes by dispatching play commands and resetting switch state.
    playSwitchStateSet(value, callback) {
        this.platform.log.debug('Play set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('PLAY')]);
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////Pause
    pressedButton(name) {
        if (name === 'POWER ON') {
            return `#${this.config.chinoppo === true ? 'EJT' : 'PON'}\r\n`;
        }
        const code = BUTTON_COMMANDS[name] || '';
        return `#${code}\r\n`;
    }
    /////////Data Management/////////////////////////////////////////////////////////////
    query(qName) {
        const code = QUERY_COMMANDS[qName] || '';
        return `#${code}\r\n`;
    }
    //////////Sending Command Dame Decoder///////////
    queryKeys(buttons) {
        return buttons.map((button) => this.query(button));
    }
    // Recomputes media-details visibility from current playback state.
    refreshShowState() {
        this.showState = this.isPlaybackVisible();
        return this.showState;
    }
    // Safely removes a HomeKit service only when the instance exists.
    removeServiceIfPresent(service) {
        if (service) {
            this.accessory.removeService(service);
        }
    }
    // Resets reconnect/health counters after receiving expected successful activity.
    resetCounter() {
        this.reconnectionCounter = 0;
        this.connectionLimit = false;
        this.connectionLimitStatus = 0;
        this.newResponse = '';
        this.firstHttp = true;
    }
    // Generic rule matcher used by audio/language decoders to avoid repetitive if/else trees.
    resolveMappedLabel(value, rules, fallbackLabel) {
        const normalizedValue = `${value || ''}`;
        const matchedRule = this.findRuleMatch(normalizedValue, rules);
        if (matchedRule) {
            return matchedRule.label;
        }
        if (typeof fallbackLabel === 'function') {
            return fallbackLabel(normalizedValue);
        }
        return fallbackLabel;
    }
    // Periodic health tick that handles reconnect thresholds and socket liveness.
    runConnectionHealthTick() {
        if (this.reconnectionCounter >= this.reconnectionTry && this.reconnectionCounter <= this.reconnectionTry + 30) {
            this.debugLogRateLimited('connection.notResponding', 10000, "Oppo Not Responding");
            this.connectionLimit = true;
            this.connectionLimitStatus = 1;
        }
        if (this.config.autoIP === false || this.IPReceived === true) {
            if (typeof this.client !== "undefined") {
                if (this.client.readyState === 'Closed') {
                    this.teardownClient();
                    delete this.client;
                    this.netConnect();
                }
                this.debugLogRateLimited('connection.socketWritable', 5000, 'Socket writable: ', this.client.writable);
                this.debugLogRateLimited('connection.reconnectCounter', 5000, 'Number of reconnection tries: ' + this.reconnectionCounter);
            }
            else {
                this.netConnect();
            }
        }
        this.logMetricsIfNeeded();
    }
    // Periodic HomeKit state sync with characteristic-write guards to reduce churn.
    runStateSyncTick() {
        this.validateStateInvariants();
        if (this.cachedCharacteristics.bluRayConfiguredName.value !== this.inputName) {
            this.bluRay.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName);
        }
        this.newPowerState(this.powerState);
        this.newPlayBackState(this.playBackState);
        this.newHDRState(this.HDROutput);
        this.newAudioType(this.audioType);
        this.newInputState(this.inputState);

        if (this.cachedCharacteristics.connectionMotionDetected.value !== this.connectionLimit) {
            this.connectionStatus.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.connectionLimit);
        }
        if (this.cachedCharacteristics.connectionStatusFault.value !== this.connectionLimitStatus) {
            this.connectionStatus.updateCharacteristic(this.platform.Characteristic.StatusFault, this.connectionLimitStatus);
        }
        if (this.cachedCharacteristics.tvCurrentMediaState.value !== this.mediaState) {
            this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);
        }
        if (this.cachedCharacteristics.tvActiveIdentifier.value !== this.inputID) {
            this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
        }
        if (this.cachedCharacteristics.speakerVolume.value !== this.currentVolume) {
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Volume, this.currentVolume);
        }
        if (this.cachedCharacteristics.speakerMute.value !== this.currentMuteState) {
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Mute, this.currentMuteState);
        }
        if (this.config.powerB === true) {
            this.updateCharacteristicIfChanged(this.service, this.platform.Characteristic.On, this.powerState);
        }
        if (this.config.volume === true) {
            this.newVolumeStatus(this.currentVolume);
        }
        if (this.config.movieControl === true) {
            if (this.config.changeDimmersToFan === false) {
                this.updateCharacteristicIfChanged(this.movieControlL, this.platform.Characteristic.Brightness, this.currentMovieProgress);
                this.updateCharacteristicIfChanged(this.movieControlL, this.platform.Characteristic.On, this.currentMovieProgressState);
            }
            else {
                this.updateCharacteristicIfChanged(this.movieControlF, this.platform.Characteristic.RotationSpeed, this.currentMovieProgress);
                this.updateCharacteristicIfChanged(this.movieControlF, this.platform.Characteristic.Active, this.currentMovieProgressState === true ? 1 : 0);
            }
        }
        if (this.config.chapterControl === true) {
            if (this.playBackState[0] === false && this.playBackState[1] === false && this.playBackState[2] === false) {
                this.currentChapterTime = 0
                this.currentChapterTimeState = false;
            }
            if (this.config.changeDimmersToFan === false) {
                this.updateCharacteristicIfChanged(this.chapterControlL, this.platform.Characteristic.Brightness, this.currentChapterTime);
                this.updateCharacteristicIfChanged(this.chapterControlL, this.platform.Characteristic.On, this.currentChapterTimeState);
            }
            else {
                this.updateCharacteristicIfChanged(this.chapterControlF, this.platform.Characteristic.RotationSpeed, this.currentChapterTime);
                this.updateCharacteristicIfChanged(this.chapterControlF, this.platform.Characteristic.Active, this.currentChapterTimeState === true ? 1 : 0);
            }
        }
        if (this.config.chapterSelector === true) {
            this.newChapter(this.currentChapterSelector[0]);
        }
        if (this.playBackState[0] === true || this.playBackState[1] === true) {
            this.showState = true;
            if (this.continueSendingUpdate && this.mediaDetailsCounter < 3) {
                this.mediaDetailsCounter += 1;
                this.continueSendingUpdate = false;
                this.scheduleQueryTask('periodic.media.hdr', 1000, 'HDR STATUS', () =>
                    (!this.mediaAudioFormat.includes('SDR') && !this.mediaAudioFormat.includes('HDR 10') && !this.mediaAudioFormat.includes('Dolby Vision'))
                    || (this.firstElapsedMovie + this.movieRemaining > 60 * 10 && this.mediaAudioFormat.includes('SDR'))
                );
                this.scheduleQueryTask('periodic.media.audio', 2500, 'AUDIO TYPE', () => this.language === 'Audio Language');
                this.scheduleQueryTask('periodic.media.name', 5000, 'MEDIA NAME', () => this.inputName === 'Blu-ray');
                this.scheduleTimer('periodic.media.release', 5100, () => {
                    this.continueSendingUpdate = true;
                });
            }
        }
        else {
            this.showState = false;
        }
        if (this.cachedCharacteristics.runtimeConfiguredName.value !== this.mediaDuration) {
            this.platform.log.debug('Updating Runtime');
            this.updateConfiguredNameAndVisibility(this.runtime, this.mediaDuration, this.showState);
        }
        if (this.cachedCharacteristics.currentChapterConfiguredName.value !== this.mediaChapter) {
            this.platform.log.debug('Updating Current Chapter');
            this.updateConfiguredNameAndVisibility(this.currentChaper, this.mediaChapter, this.showState);
        }
        if (this.cachedCharacteristics.audioFormatConfiguredName.value !== this.mediaAudioFormat) {
            this.platform.log.debug('Updating Video and Audio Format');
            this.updateConfiguredNameAndVisibility(this.audioFormat, this.mediaAudioFormat, this.showState);
        }
        if (this.cachedCharacteristics.audioLanguageConfiguredName.value !== this.language) {
            this.platform.log.debug('Updating Language');
            this.updateConfiguredNameAndVisibility(this.audioLanguage, this.language, this.showState);
        }
    }
    // Writes to TCP only when the socket is ready and tracks write metrics.
    safeClientWrite(payload) {
        if (!this.isClientReady()) {
            return false;
        }
        this.client.write(payload);
        this.metrics.tcpWrites += 1;
        return true;
    }
    // Queues delayed metadata queries for playback startup stabilization.
    schedulePlaybackDetailQueries(profileName, startDelayMs, offsets) {
        this.cancelScheduledTimersByPrefix('playback.');
        this.continueSending = false;
        const prefix = `playback.${profileName}`;
        this.scheduleTimer(`${prefix}.release`, startDelayMs, () => {
            this.continueSending = true;
        });
        this.scheduleQueryTask(`${prefix}.mtr`, startDelayMs + offsets.mtr, 'MTR');
        this.scheduleQueryTask(`${prefix}.audio`, startDelayMs + offsets.audio, 'AUDIO TYPE', () => this.audioType[0] === false && this.audioType[1] === false);
        this.scheduleQueryTask(`${prefix}.hdr`, startDelayMs + offsets.hdr, 'HDR STATUS', () => this.HDROutput[0] === false && this.HDROutput[1] === false);
        this.scheduleQueryTask(`${prefix}.media`, startDelayMs + offsets.media, 'MEDIA NAME', () => this.inputName === 'Blu-ray');
    }
    // Schedules a named future query with optional runtime condition gating.
    scheduleQueryTask(timerKey, delayMs, queryName, conditionFn) {
        this.scheduleTimer(timerKey, delayMs, () => {
            if (!conditionFn || conditionFn()) {
                this.sending([this.query(queryName)]);
            }
        });
    }
    // Schedules a reconnect attempt while deduplicating existing timers.
    scheduleReconnectAttempt() {
        this.clearReconnectAttempt();
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            delete this.client;
            this.netConnect();
        }, this.reconnectionWait);
    }
    // Registers and tracks a named timer so later calls can replace or cancel it safely.
    scheduleTimer(timerKey, delayMs, task) {
        if (this.scheduledTimers[timerKey]) {
            clearTimeout(this.scheduledTimers[timerKey]);
        }
        this.scheduledTimers[timerKey] = setTimeout(() => {
            delete this.scheduledTimers[timerKey];
            task();
        }, delayMs);
    }
    // Converts seconds into HH:MM:SS string format expected by seek commands.
    secondsToTime(seconds) {
        let date = new Date(0);
        date.setSeconds(parseInt(seconds)); // specify value for SECONDS here
        let timeString = date.toISOString().substr(11, 8);
        return timeString
    }
    /////Volume, chapter, Movie time change //////////////////////////////////////////////
    // HTTP transport wrapper with timeout/failure accounting and JSON decode handoff.
    sendHttp(url, key) {
        this.metrics.httpRequests += 1;
        this.platform.log.debug(url);
        let failureRecorded = false;
        const recordHttpFailure = (reason) => {
            if (failureRecorded) {
                return;
            }
            failureRecorded = true;
            this.httpNotResponding += 1;
            this.platform.log.debug(`HTTP request ${reason} for command ${key}. failureCount=${this.httpNotResponding}`);
        };
        let requestTimedOut = false;
        const httpRequest = request.get(url, (res) => {
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                if (failureRecorded) {
                    return;
                }
                this.httpNotResponding = 0;
                try {
                    let parsedData = JSON.parse(rawData);
                    this.httpEventDecoder(parsedData, key);
                } catch (e) {
                    this.platform.log.debug(`HTTP parse error for command ${key}: ${e.message}`);
                }
            });
        });
        httpRequest.setTimeout(HTTP_REQUEST_TIMEOUT_MS, () => {
            requestTimedOut = true;
            recordHttpFailure(`timeout (${HTTP_REQUEST_TIMEOUT_MS}ms)`);
            httpRequest.destroy();
        });
        httpRequest.on('error', (e) => {
            if (requestTimedOut) {
                return;
            }
            recordHttpFailure(`error: ${e.message}`);
        });
    }
    // Command dispatch: rate-limits queries, coalesces bursts, and chooses TCP vs HTTP fallback.
    sending(press) {
        if (this.config.autoIP === false || this.IPReceived === true) {
            if (IPV4_REGEX.test(this.OPPO_IP)) {
                this.debugLogRateLimited('sending.connectionCounter', 3000, `Connection counter is ${this.reconnectionCounter} `);
                let i = 0;
                while (i < press.length) {
                    const rawCommand = press[i];
                    const commandCode = this.extractCommandCode(rawCommand);
                    const now = Date.now();
                    const lastCommandTime = this.lastCommandSentAt[rawCommand] || 0;
                    if (now - lastCommandTime < 100) {
                        this.metrics.coalescedCommands += 1;
                        i += 1;
                        continue;
                    }
                    this.lastCommandSentAt[rawCommand] = now;
                    if (!this.canSendQuery(commandCode)) {
                        i += 1;
                        continue;
                    }
                    if (this.reconnectionCounter < this.reconnectionTry) {
                        //////////////Send By TCP + HTTP
                        if (TCP_ROUTED_CODES.has(commandCode)) {
                            //  || command.includes('QAT')
                            if (!this.client || this.client.readyState === 'Closed') {
                                this.teardownClient();
                                this.key = rawCommand;
                                delete this.client;
                                this.netConnect();
                                this.keyReset();
                                this.commandLog(rawCommand);
                            }
                            else {
                                this.newResponse = `by TCP`;
                                this.debugLogRateLimited('sending.tcp.sent', 2000, `${rawCommand} sent by TCP`);
                                if (this.safeClientWrite(rawCommand)) {
                                    this.commandLog(rawCommand);
                                }
                            }
                        }
                        else {
                            if (this.httpNotResponding <= 3) {
                                this.newResponse = `by HTTP`;
                                this.commandLog(rawCommand);
                                this.sendHttp(this.makeUrl(rawCommand), rawCommand);
                            }
                            else {
                                this.newResponse = `by TCP, HTTP not responding`;
                                let outboundCommand = rawCommand;
                                this.debugLogRateLimited('sending.tcp.fallback', 2000, `${rawCommand} sent by TCP`);
                                if (outboundCommand.includes('MTR')) {
                                    outboundCommand = '#QRE';
                                }
                                if (this.safeClientWrite(outboundCommand)) {
                                    this.commandLog(outboundCommand);
                                }
                                this.login();


                            }
                        }
                    }
                    else {
                        if (!rawCommand.includes('QVM') && !rawCommand.includes('RST')) {
                            this.login();
                            this.newResponse = `by HTTP, TCP not responding`;
                            this.commandLog(rawCommand);
                            let outboundCommand = rawCommand;
                            if (this.config.chinoppo === true && outboundCommand.includes('EJT')) {
                                outboundCommand = '#PON';
                            }
                            this.sendHttp(this.makeUrl(outboundCommand), outboundCommand);
                            if (this.config.autoIP === true) {
                                this.discoveryUDP();
                            }
                            else {
                                //////Trying to reconnect TCP
                                this.teardownClient();
                                delete this.client;
                                this.netConnect();
                            }

                        }
                    }
                    i += 1;
                }
            }
            else {
                this.debugLogRateLimited('sending.invalidIp', 5000, 'IP address is not valid');
            }

        }
        else {
            this.platform.log('IP not set yet');
        }

    }
    ///////Send HTTP command///////////////////////////
    setOn(value, callback) {
        let oppoState = value;
        if (oppoState === true) {
            this.turnOffCommandOn = false;
            this.turnOnCommandOn = true;
            this.sending([this.pressedButton('POWER ON')]);
            if (this.turnOnCommandOn === true) {
                setTimeout(() => {
                    this.turnOnCommandOn = false;
                }, 3000);
            }
        }
        else {
            this.turnOnCommandOn = false;
            this.turnOffCommandOn = true;
            if (this.playBackState[0] === true || this.playBackState[1] === true) {
                this.sending([this.pressedButton('STOP')]);
                setTimeout(() => {
                    this.turnOffAll();
                    this.sending([this.pressedButton('POWER OFF')]);
                }, 2500);
                if (this.turnOffCommandOn === true) {
                    setTimeout(() => {
                        this.turnOffCommandOn = false;
                    }, 3000);
                }
            }
            else {
                this.turnOffAll();
                this.sending([this.pressedButton('POWER OFF')]);
                if (this.turnOffCommandOn === true) {
                    setTimeout(() => {
                        this.turnOffCommandOn = false;
                    }, 3000);
                }
            }
        }
        this.platform.log.debug('Set Power to ->', value);
        callback(null);
    }
    // Creates all optional stateless remote-control switches enabled by config.
    setupStatelessSwitches() {
        const buttonConfigs = this.getStatelessSwitchConfigs();
        for (const buttonConfig of buttonConfigs) {
            if (this.config[buttonConfig.configKey] === true) {
                this.createStatelessSwitch(buttonConfig);
            }
        }
    }
    // Returns a promise-based delay helper used by asynchronous decoder workflows.
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Creates and wires the persistent TCP socket used for low-latency OPPO control.
    startSocketConnection() {
        if (this.netConnectTimeOut !== true) {
            return;
        }
        this.clearReconnectAttempt();
        this.netConnectTO();
        this.client = new net.Socket();
        this.client.setKeepAlive(true, 0);
        const timer = setTimeout(() => {
            this.platform.log.debug('ERROR. Attempt at connection exceeded timeout value');
        }, timeout);
        this.client.connect(OPPO_PORT, this.OPPO_IP, () => {
            this.platform.log.debug(`Connecting to ${this.config.name}`);
            clearTimeout(timer);
            this.clearReconnectAttempt();
            this.firstConnection = true;
        });
        this.client.on('ready', () => {
            clearTimeout(timer);
            this.platform.log.debug(`${this.config.name} is ready`);
            this.platform.log.debug(`Sending: ${this.commandName(this.key)}`);
            this.sending([this.key]);
            this.clearReconnectAttempt();
            this.firstConnection = true;
        });
        this.client.on('data', (data) => {
            clearTimeout(timer);
            this.loginCounter = 0;
            this.eventDecoder(data);
        });
        this.client.on('error', (e) => {
            clearTimeout(timer);
            this.platform.log.debug(`Error: ${e}`);
            this.platform.log.debug(`Trying to reconnect to ${this.config.name} after an error`);
            this.platform.log.debug(`Turn on ${this.config.name} and check the IP Address`);
            this.teardownClient();
            this.updateReconnectState(false);
            this.platform.log.debug("Reconnection counter is " + this.reconnectionCounter);
            this.scheduleReconnectAttempt();
            this.handleReconnectLimitExceeded(true);
        });
        this.client.on('close', () => {
            clearTimeout(timer);
            this.platform.log.debug(`Disconnected from ${this.config.name}`);
            this.updateReconnectState(true);
            this.teardownClient();
            this.scheduleReconnectAttempt();
            this.handleReconnectLimitExceeded(false);
        });
        this.client.on('end', () => {
            clearTimeout(timer);
            this.platform.log.debug(`Connection to ${this.config.name} ended`);
            this.updateReconnectState(true);
            this.teardownClient();
            this.scheduleReconnectAttempt();
            this.handleReconnectLimitExceeded(false);
        });
    }
    // Returns Stop switch state for HomeKit reads.
    stopSwitchStateGet(callback) {
        this.platform.log.debug('Stop State');
        let currentValue = this.playBackState[2];
        callback(null, currentValue);
    }
    // Handles Stop switch writes by dispatching stop commands and resetting switch state.
    stopSwitchStateSet(value, callback) {
        this.platform.log.debug('Stop set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('STOP')]);
        }
        callback(null);
    }
    // Removes known media filename extensions for cleaner HomeKit display names.
    stripMediaNameExtension(name) {
        const normalizedName = `${name || ''}`;
        const lowerName = normalizedName.toLowerCase();
        for (const extension of MEDIA_NAME_EXTENSIONS) {
            if (lowerName.endsWith(extension)) {
                return normalizedName.slice(0, -extension.length);
            }
        }
        return normalizedName;
    }
    // Detaches listeners and closes the TCP client socket safely.
    teardownClient() {
        if (!this.client) {
            return;
        }
        this.client.end();
        this.client.removeAllListeners();
        this.client.destroy();
    }
    // Returns the current local time as HH:MM:SS string.
    time() {
        let time = new Date();
        return time.toLocaleDateString() + ' ' + time.toLocaleString('en-US', {
            hour12: false,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZoneName: 'short',
        });
    }
    // Converts HH:MM:SS strings into total-seconds integers for progress calculations.
    timeToSeconds(hms) {
        if (typeof hms !== 'undefined') {
            let a = hms.split(':');
            let seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
            return seconds;
        }
        else {
            return 0;
        }
    }

    // Applies full power-off state reset across playback, media metadata, and status services.
    turnOffAll() {
        this.continueSending = true;
        this.continueSendingUpdate = true;
        this.mediaDetailsCounter = 0;
        this.videoIn3D = '';
        this.newSubtitle = '';
        this.diskType = '';
        this.chapterProgressUpdate = true;
        this.chapterNumberRequest = true;
        this.newPowerState(false);
        this.newHDRState([false, false, false]);
        this.newPlayBackState([false, false, false]);
        this.newAudioType([false, false]);
        this.newInputState([false, false, false, false, false, false, false, false, false, false]);
        this.newVolumeStatus(0);
        this.movieChapterDefault();
        this.mediaDetailsReset();

    }
    // Creates the local UDP listener that receives OPPO broadcast transport messages.
    udpServer() {
        this.server = udp.createSocket({ type: 'udp4', reuseAddr: true });
        this.server.on('error', (error) => {
            this.platform.log.debug(error);
            this.server.close();
        });
        // emits on new datagram msg
        this.server.on('message', (msg, info) => {
            let embyName = msg.toString();
            let eName = embyName.split('/');
            this.platform.log.debug(eName);
            if (eName[eName.length - 1].includes('AVCHD')) {
                this.newEmbyName = eName[eName.length - 2];
            }
        });
        //emits when socket is ready and listening for datagram msgs
        this.server.on('listening', () => {
            let address = this.server.address();
            let port = address.port;
            let family = address.family;
            let ipaddr = address.address;
            this.platform.log('Server is listening at port ' + port);
            this.platform.log('Server ip ' + ipaddr);
            this.platform.log('Server is IP4/IP6 : ' + family);
        });

        //emits after the socket is closed using socket.close();
        this.server.on('close', () => {
            this.platform.log('Socket is closed !');
        });
        this.server.bind(1900, '239.255.255.250');
    }
    // Runs a full state refresh pass to synchronize all exported HomeKit characteristics.
    updateAll() {
        let queryAll = ['POWER STATUS', 'PLAYBACK STATUS', 'HDR STATUS', 'AUDIO TYPE'];
        let KEYS = this.queryKeys(queryAll);
        return KEYS;
    }
    // Compatibility write wrapper: prefers updateCharacteristic and falls back to updateValue when needed.
    setCharacteristicValue(service, characteristicType, nextValue) {
        if (!service) {
            return false;
        }
        if (typeof service.updateCharacteristic === 'function') {
            service.updateCharacteristic(characteristicType, nextValue);
            return true;
        }
        const characteristic = service.getCharacteristic(characteristicType);
        if (characteristic && typeof characteristic.updateValue === 'function') {
            characteristic.updateValue(nextValue);
            return true;
        }
        return false;
    }
    // Compatibility write wrapper that avoids unnecessary writes when value is unchanged.
    setCharacteristicValueIfChanged(service, characteristicType, nextValue) {
        if (!service) {
            return false;
        }
        const characteristic = service.getCharacteristic(characteristicType);
        if (characteristic.value === nextValue) {
            return false;
        }
        return this.setCharacteristicValue(service, characteristicType, nextValue);
    }
    // Avoids unnecessary HomeKit writes by updating only when value changed.
    updateCharacteristicIfChanged(service, characteristicType, nextValue) {
        return this.setCharacteristicValueIfChanged(service, characteristicType, nextValue);
    }
    // Updates metadata labels and corresponding source visibility together.
    updateConfiguredNameAndVisibility(service, nextValue, shouldShow) {
        service.updateCharacteristic(this.platform.Characteristic.ConfiguredName, nextValue);
        this.updateServiceVisibility(service, shouldShow);
    }
    // Applies HDR state updates and refreshes related media presentation values.
    updateHDRStatus(newHDR) {
        this.resetCounter();
        this.newHDRState(newHDR);
        if (this.audioType[0] === false && this.audioType[1] === false && this.playBackState[0] === true) {
            this.sending([this.query('AUDIO TYPE')]);
        }
    }
    // Applies input-state transitions and sets active source metadata from protocol response.
    updateInputStatus(newInput, response) {
        this.platform.log(`Response: ${this.commandName(response)}`);
        this.newInputState(newInput);

    }
    // Advances reconnect counters and optionally resets playback progress bootstrap flags.
    updateReconnectState(resetPlaybackProgressState) {
        this.reconnectionCounter += 1;
        this.firstConnection = true;
        if (resetPlaybackProgressState) {
            this.currentMovieProgressFirst = true;
            this.chapterFirstUpdate = true;
            this.chapterFirstUpdateRemaining = true;
        }
    }
    // Toggles service visibility characteristics based on current playback context.
    updateServiceVisibility(service, shouldShow) {
        const targetVisibilityCharacteristic = this.platform.Characteristic.TargetVisibilityState;
        const currentVisibilityCharacteristic = this.platform.Characteristic.CurrentVisibilityState;
        const targetVisibilityEnum = targetVisibilityCharacteristic || { SHOWN: 0, HIDDEN: 1 };
        const currentVisibilityEnum = currentVisibilityCharacteristic || { SHOWN: 0, HIDDEN: 1 };
        const targetVisibility = shouldShow ? targetVisibilityEnum.SHOWN : targetVisibilityEnum.HIDDEN;
        const currentVisibility = shouldShow ? currentVisibilityEnum.SHOWN : currentVisibilityEnum.HIDDEN;
        if (targetVisibilityCharacteristic) {
            service.updateCharacteristic(targetVisibilityCharacteristic, targetVisibility);
        }
        if (currentVisibilityCharacteristic) {
            service.updateCharacteristic(currentVisibilityCharacteristic, currentVisibility);
        }
    }
    // Validates runtime config values against expected types/ranges and logs any normalization warnings.
    validateRuntimeConfig() {
        const { config, warnings } = validateRuntimeConfigShape(this.config, DEFAULT_CONFIG);
        this.config = config;
        if (warnings.length === 0) {
            return;
        }
        for (const warning of warnings) {
            this.platform.log.warn(`[config] ${warning}`);
        }
    }
    // Guards key runtime state arrays so periodic sync loops never operate on malformed state.
    validateStateInvariants() {
        const currentPlaybackState = Array.isArray(this.playBackState) ? this.playBackState : [];
        const currentInputState = Array.isArray(this.inputState) ? this.inputState : [];
        const nextPlaybackState = normalizePlaybackState(this.playBackState);
        const nextInputState = normalizeInputState(this.inputState);
        const playbackStateChanged = currentPlaybackState.length !== nextPlaybackState.length
            || currentPlaybackState.some((value, index) => value !== nextPlaybackState[index]);
        const inputStateChanged = currentInputState.length !== nextInputState.length
            || currentInputState.some((value, index) => value !== nextInputState[index]);
        if (playbackStateChanged) {
            this.platform.log.warn('Playback state was normalized due to invalid shape/value.');
            this.playBackState = nextPlaybackState;
        }
        if (inputStateChanged) {
            this.platform.log.warn('Input state was normalized due to invalid shape/value.');
            this.inputState = nextInputState;
        }
    }
    // Formats an absolute volume command in OPPO protocol syntax.
    volumeChange(number) {
        let key;
        key = '#SVL ';
        key += number.toString();
        key += '\r\n';
        if (number !== 0) {
            this.targetVolume = number;
        }
        return key;
    }
}
module.exports.__test = {
    oppoAccessory,
    oppoPlatform,
};
