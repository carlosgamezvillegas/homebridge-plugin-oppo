"use strict";
const PLATFORM_NAME = 'oppoPlugin';
const PLUGIN_NAME = 'homebridge-oppo-udp';
const net = require("net");
const request = require('http')
const OPPO_PORT = 23;
const timeout = 2000;
const udp = require('dgram');


module.exports = (api) => {
    api.registerPlatform(PLATFORM_NAME, oppoPlatform);
};
//// Platform/////////////////////////////////////////////////////////////////////////////////////////////////
class oppoPlatform {
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
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    removeAccessory(accessory) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
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
        accessory.category = this.api.hap.Accessory.Categories.TELEVISION;
        accessory.context.device = this.oppoDevice;
        new oppoAccessory(this, accessory);
        this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    }
}
class oppoAccessory {
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
        this.inputState = [false, false, false, false, false, false];
        this.HDROutput = [false, false, false];
        this.audioType = [false, false];
        this.powerStateTV = 0;
        this.currentVolume = 0;
        this.targetVolume = 100;
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
        this.firstHttp = true;
        this.commandChain = false;
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
        this.movieElapsed = 0;
        this.movieRemaining = 0;
        this.firstElapsedMovie = 0;
        this.chapterRemaining = 0;
        this.currentMovieProgressFirst = true;
        this.chapterFirstUpdate = true;
        this.chapterRemainingFirst = 0;
        this.chapterElapsedFirst = 0;
        this.chapterCounter = 0;
        this.chapterUpdateSec = 1;
        this.movieType = '';
        ////Connection parameters
        this.reconnectionCounter = 0;
        this.reconnectionTry = 10;
        this.connectionLimit = false;
        this.connectionLimitStatus = 0;
        this.reconnectionWait = platform.config.pollingInterval || 10000;
        this.firstConnection = false;
        this.newResponse = '';
        //Device Information//////////////////////////////////////////////////////////////////////////////////////
        this.config.name = platform.config.name || 'Oppo 203';
        this.config.manufacture = platform.config.manufacture || 'Oppo';
        this.config.pollingInterval = platform.config.pollingInterval || 1000;
        this.config.modelName = platform.config.modelName || 'UDP-203';
        this.config.serialN = platform.config.serialN || 'B210U71647033894';
        this.config.autoIP = platform.config.autoIP || false;
        this.config.inputButtons = platform.config.inputButtons || false;
        this.config.oppo205 = platform.config.oppo205 || false;
        this.config.volume = platform.config.volume || false;
        this.config.mediaButtons = platform.config.mediaButtons || false;
        this.config.cursorUpB = platform.config.cursorUpB || false;
        this.config.cursorDownB = platform.config.cursorDownB || false;
        this.config.cursorLeftB = platform.config.cursorLeftB || false;
        this.config.cursorRightB = platform.config.cursorRightB || false;
        this.config.cursorEnterB = platform.config.cursorEnterB || false;
        this.config.menuB = platform.config.menuB || false;
        this.config.backButtonB = platform.config.backButtonB || false;
        this.config.clearB = platform.config.clearB || false;
        this.config.topMenuB = platform.config.topMenuB || false;
        this.config.optionB = platform.config.optionB || false;
        this.config.homeMenuB = platform.config.homeMenuB || false;
        this.config.infoB = platform.config.infoB || false;
        this.config.setupB = platform.config.setupB || false;
        this.config.goToB = platform.config.goToB || false;
        this.config.pageUpB = platform.config.pageUpB || false;
        this.config.pageDownB = platform.config.pageDownB || false;
        this.config.popUpMenuB = platform.config.popUpMenuB || false;
        this.config.dimmerB = platform.config.dimmerB || false;
        this.config.pureAudioB = platform.config.pureAudioB || false;
        this.config.redB = platform.config.redB || false;
        this.config.yellowB = platform.config.yellowB || false;
        this.config.blueB = platform.config.blueB || false;
        this.config.audioB = platform.config.audioB || false;
        this.config.greenB = platform.config.greenB || false;
        this.config.subtitleB = platform.config.subtitleB || false;
        this.config.angleB = platform.config.angleB || false;
        this.config.zoomB = platform.config.zoomB || false;
        this.config.sapB = platform.config.sapB || false;
        this.config.abReplayB = platform.config.abReplayB || false;
        this.config.repeatB = platform.config.repeatB || false;
        this.config.pipB = platform.config.pipB || false;
        this.config.resolutionB = platform.config.resolutionB || false;
        this.config.threeDB = platform.config.threeDB || false;
        this.config.pictureB = platform.config.pictureB || false;
        this.config.hdrButtonB = platform.config.hdrButtonB || false;
        this.config.subtitleHoldB = platform.config.subtitleHoldB || false;
        this.config.infoHoldB = platform.config.infoHoldB || false;
        this.config.resolutionHoldB = platform.config.resolutionHoldB || false;
        this.config.avSyncB = platform.config.avSyncB || false;
        this.config.gaplessPlayB = platform.config.gaplessPlayB || false;
        this.config.inputB = platform.config.inputB || false;
        this.config.ejectDiscB = platform.config.ejectDiscB || false;
        this.config.movieControl = platform.config.movieControl || false;
        this.config.chapterControl = platform.config.chapterControl || false;
        this.config.chapterSelector = platform.config.chapterSelector || false;
        this.config.chinoppo = platform.config.chinoppo || false;
        this.config.powerB = platform.config.powerB || false;
        this.config.mediaAudioVideoState = platform.config.mediaAudioVideoState || false;
        this.config.changeDimmersToFan = platform.config.changeDimmersToFan || false;
        if (this.config.autoIP === true) {
            //this.platform.log('set to false');
            this.config.autoIP = false;
        }
        else {
            // this.platform.log('set to true');
            this.config.autoIP = true;
        }
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
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.config.serialN);

        /////////Television Controls///////////////////////////////////////////////////////////////////////////////////////////
        // add the tv service
        this.tvService = this.accessory.getService(this.config.name) ||
            this.accessory.addService(this.platform.Service.Television, this.config.name, 'YourUniqueIdentifier-7');
        this.tvService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.config.name);
        this.tvService.setCharacteristic(this.platform
            .Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
        this.tvService.getCharacteristic(this.platform.Characteristic.Active)
            .on('set', (newValue, callback) => {
                this.platform.log.debug('Set Oppo Active to: ' + newValue);
                if (newValue === 1) {
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
                            if (this.turnOffCommandOn === true) {
                                setTimeout(() => {
                                    this.turnOffCommandOn = false;
                                }, 3000);
                            }
                        }, 500);
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
                        this.platform.log.debug('set Remote Key Pressed: INFORMATION');
                        this.sending([this.pressedButton('INFO')]);
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
                    this.newInputState([false, false, false, false, false, false]);
                }
                if (inputIdentifier === 0) {
                    this.newInputState([false, false, false, false, false, false]);
                }
                else if (inputIdentifier === 1) {
                    this.sending([this.pressedButton('BLURAY INPUT')]);
                }
                else if (inputIdentifier === 2) {
                    this.sending([this.pressedButton('HDMI IN')]);
                }
                else if (inputIdentifier === 3) {
                    this.sending([this.pressedButton('HDMI OUT')]);
                }
                else if (inputIdentifier === 4) {
                    this.sending([this.pressedButton('OPTICAL INPUT')]);
                }
                else if (inputIdentifier === 5) {
                    this.sending([this.pressedButton('COAXIAL INPUT')]);
                }
                else if (inputIdentifier === 6) {
                    this.sending([this.pressedButton('USB AUDIO INPUT')]);
                }
                else {
                    //
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
        this.bluRay = this.accessory.getService('Blu-ray') ||
            this.accessory.addService(this.platform.Service.InputSource, 'Blu-ray', 'YourUniqueIdentifier-1003')
                .setCharacteristic(this.platform.Characteristic.Identifier, 1)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName)
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.APPLICATION)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.SHOWN);
        this.bluRay.getCharacteristic(this.platform.Characteristic.ConfiguredName)
            .on('get', (callback) => {
                let currentValue = this.inputName;
                callback(null, currentValue);
            });
        this.tvService.addLinkedService(this.bluRay);
        this.hdmi1 = this.accessory.getService('HDMI In') ||
            this.accessory.addService(this.platform.Service.InputSource, 'HDMI In', 'YourUniqueIdentifier-1004')
                .setCharacteristic(this.platform.Characteristic.Identifier, 2)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'HDMI In')
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.APPLICATION)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.SHOWN);
        this.tvService.addLinkedService(this.hdmi1);
        this.hdmi2 = this.accessory.getService('HDMI Out') ||
            this.accessory.addService(this.platform.Service.InputSource, 'HDMI Out', 'YourUniqueIdentifier-1005')
                .setCharacteristic(this.platform.Characteristic.Identifier, 3)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'HDMI Out')
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.APPLICATION)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.SHOWN);
        this.tvService.addLinkedService(this.hdmi2);
        this.opticalIn = this.accessory.getService('Optical In') ||
            this.accessory.addService(this.platform.Service.InputSource, 'Optical In', 'YourUniqueIdentifier-4005')
                .setCharacteristic(this.platform.Characteristic.Identifier, 4)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Optical In')
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.HDMI)
                .setCharacteristic(this.platform.Characteristic.TargetVisibilityState, this.config.oppo205 ? this.platform.Characteristic.TargetVisibilityState.SHOWN : this.platform.Characteristic.TargetVisibilityState.HIDDEN)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.config.oppo205 ? this.platform.Characteristic.CurrentVisibilityState.SHOWN : this.platform.Characteristic.CurrentVisibilityState.HIDDEN);
        this.tvService.addLinkedService(this.opticalIn);
        this.coaxialIn = this.accessory.getService('Coaxial In') ||
            this.accessory.addService(this.platform.Service.InputSource, 'Coaxial In', 'YourUniqueIdentifier-4006')
                .setCharacteristic(this.platform.Characteristic.Identifier, 5)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Coaxial In')
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.HDMI)
                .setCharacteristic(this.platform.Characteristic.TargetVisibilityState, this.config.oppo205 ? this.platform.Characteristic.TargetVisibilityState.SHOWN : this.platform.Characteristic.TargetVisibilityState.HIDDEN)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.config.oppo205 ? this.platform.Characteristic.CurrentVisibilityState.SHOWN : this.platform.Characteristic.CurrentVisibilityState.HIDDEN);
        this.tvService.addLinkedService(this.coaxialIn);
        this.usbAudioIn = this.accessory.getService('USB Audio In') ||
            this.accessory.addService(this.platform.Service.InputSource, 'USB Audio In', 'YourUniqueIdentifier-4007')
                .setCharacteristic(this.platform.Characteristic.Identifier, 6)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'USB Audio In')
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.HDMI)
                .setCharacteristic(this.platform.Characteristic.TargetVisibilityState, this.config.oppo205 ? this.platform.Characteristic.TargetVisibilityState.SHOWN : this.platform.Characteristic.TargetVisibilityState.HIDDEN)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.config.oppo205 ? this.platform.Characteristic.CurrentVisibilityState.SHOWN : this.platform.Characteristic.CurrentVisibilityState.HIDDEN);
        this.tvService.addLinkedService(this.usbAudioIn);
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
        ////////Volume services for the Oppo/////////////////////////////////////////////////////////////////////////////////
        this.speakerService = this.accessory.getService('Oppo Volume Control') ||
            this.accessory.addService(this.platform.Service.TelevisionSpeaker, 'Oppo Volume Control', 'YourUniqueIdentifier-20');
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
        this.speakerService.addCharacteristic(this.platform.Characteristic.Volume)
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
        /////Video/Movie Controls/////////////////////////////////////////////////////////////////////
        if (this.config.movieControl === true) {
            if (this.config.changeDimmersToFan === false) {
            this.movieControlL = this.accessory.getService('Movie Progress') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Movie Progress', 'YourUniqueIdentifier-301');
            this.movieControlL.setCharacteristic(this.platform.Characteristic.Name, 'Movie Progress');
            this.movieControlL.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = this.currentMovieProgressState;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.platform.log('Movie progress state set to: ' + newValue);
                    callback(null);
                });
            this.movieControlL.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentMovieProgress;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    let newSendValue = Math.round(newValue * (this.firstElapsedMovie + this.movieRemaining) / 100);
                    let totalMovieTime = this.firstElapsedMovie + this.movieRemaining;
                    if (newSendValue > totalMovieTime) { newSendValue = totalMovieTime; }
                    this.sending([this.movieTime(this.secondsToTime(newSendValue))]);
                    this.platform.log('Movie progress set to: ' + newValue + '%');
                    callback(null);
                });
        }
        else {
            this.movieControlF = this.accessory.getService('Movie Progress') ||
                this.accessory.addService(this.platform.Service.Fanv2, 'Movie Progress', 'YourUniqueIdentifier-301F');
            this.movieControlF.setCharacteristic(this.platform.Characteristic.Name, 'Movie Progress');
            this.movieControlF.getCharacteristic(this.platform.Characteristic.Active)
                .on('get', (callback) => {
                    let currentValue = 0;
                    if (this.currentMovieProgressState === true) {
                        currentValue = 1;
                    }
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.platform.log('Movie progress state set to: ' + newValue);
                    callback(null);
                });
            this.movieControlF.addCharacteristic(new this.platform.Characteristic.RotationSpeed)
                .on('get', (callback) => {
                    let currentValue = this.currentMovieProgress;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    let newSendValue = Math.round(newValue * (this.firstElapsedMovie + this.movieRemaining) / 100);
                    let totalMovieTime = this.firstElapsedMovie + this.movieRemaining;
                    if (newSendValue > totalMovieTime) { newSendValue = totalMovieTime; }
                    this.sending([this.movieTime(this.secondsToTime(newSendValue))]);
                    this.platform.log('Movie progress set to: ' + newValue + '%');
                    callback(null);
                });
        }
    }
    if (this.config.chapterSelector === true) {
        if (this.config.changeDimmersToFan === false) {
            this.chapterSelectorL = this.accessory.getService('Chapter Number') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Chapter Number', 'YourUniqueIdentifier-302');
            this.chapterSelectorL.setCharacteristic(this.platform.Characteristic.Name, 'Chapter Number');
            this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = this.currentChapterSelectorState;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.platform.log('Chapter state set to: ' + newValue);
                    callback(null);
                });
            this.chapterSelectorL.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentChapterSelector[0];
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    if (newValue >= this.currentChapterSelector[1]) {
                        newValue = this.currentChapterSelector[1]
                    }
                    this.sending([this.chapterChange(newValue)]);
                    this.platform.log('Chapter number set to: ' + newValue);
                    callback(null);
                });
        }
        else {
            this.chapterSelectorF = this.accessory.getService('Chapter Number') ||
                this.accessory.addService(this.platform.Service.Fanv2, 'Chapter Number', 'YourUniqueIdentifier-302F');
            this.chapterSelectorF.setCharacteristic(this.platform.Characteristic.Name, 'Chapter Number');
            this.chapterSelectorF.getCharacteristic(this.platform.Characteristic.Active)
                .on('get', (callback) => {
                    let currentValue = 0;
                    if (this.currentChapterSelectorState === true) {
                        currentValue = 1;
                    }
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.platform.log('Chapter state set to: ' + newValue);
                    callback(null);
                });
            this.chapterSelectorF.addCharacteristic(new this.platform.Characteristic.RotationSpeed)
                .on('get', (callback) => {
                    let currentValue = this.currentChapterSelector[0];
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    if (newValue >= this.currentChapterSelector[1]) {
                        newValue = this.currentChapterSelector[1]
                    }
                    this.sending([this.chapterChange(newValue)]);
                    this.platform.log('Chapter number set to: ' + newValue);
                    callback(null);
                });
        }
    }
    if (this.config.chapterControl === true) {
        if (this.config.changeDimmersToFan === false) {
            this.chapterControlL = this.accessory.getService('Chapter Progress') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Chapter Progress', 'YourUniqueIdentifier-303');
            this.chapterControlL.setCharacteristic(this.platform.Characteristic.Name, 'Chapter Progress');
            this.chapterControlL.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = this.currentChapterTimeState;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.platform.log('Chapter progress status set to: ' + newValue);
                    callback(null);
                });
            this.chapterControlL.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentChapterTime;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    let newSendValue = Math.round(newValue * (this.chapterElapsedFirst + this.chapterRemainingFirst) / 100);
                    let totalChapterTime = this.chapterElapsedFirst + this.chapterRemainingFirst;
                    if (newSendValue > totalChapterTime) { newSendValue = totalChapterTime; }
                    this.sending([this.chapterTime(this.secondsToTime(newSendValue))]);
                    this.platform.log('Chapter progress set to: ' + newValue + '%');
                    callback(null);
                });
        }
        else {
            this.chapterControlF = this.accessory.getService('Chapter Progress') ||
                this.accessory.addService(this.platform.Service.Fanv2, 'Chapter Progress', 'YourUniqueIdentifier-303F');
            this.chapterControlF.setCharacteristic(this.platform.Characteristic.Name, 'Chapter Progress');
            this.chapterControlF.getCharacteristic(this.platform.Characteristic.Active)
                .on('get', (callback) => {
                    let currentValue = 0;
                    if (this.currentChapterTimeState === true) {
                        currentValue = 1;
                    }
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.platform.log('Chapter progress status set to: ' + newValue);
                    callback(null);
                });
            this.chapterControlF.addCharacteristic(new this.platform.Characteristic.RotationSpeed)
                .on('get', (callback) => {
                    let currentValue = this.currentChapterTime;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    let newSendValue = Math.round(newValue * (this.chapterElapsedFirst + this.chapterRemainingFirst) / 100);
                    let totalChapterTime = this.chapterElapsedFirst + this.chapterRemainingFirst;
                    if (newSendValue > totalChapterTime) { newSendValue = totalChapterTime; }
                    this.sending([this.chapterTime(this.secondsToTime(newSendValue))]);
                    this.platform.log('Chapter progress set to: ' + newValue + '%');
                    callback(null);
                });
        }
    }
        /////////////Addtional Services////////////////////////////////////////////////////////////////////////////////////
        if (this.config.powerB === true) {
            this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
            this.service.setCharacteristic(this.platform.Characteristic.Name, `${accessory.context.device.oppoDisplayName} Power Switch`);
            this.service.updateCharacteristic(this.platform.Characteristic.Name, `${accessory.context.device.oppoDisplayName} Power Switch`);
            this.service.getCharacteristic(this.platform.Characteristic.On)
                .on('set', this.setOn.bind(this))
                .on('get', this.getOn.bind(this));
        };
        this.play = this.accessory.getService('Play') ||
            this.accessory.addService(this.platform.Service.Switch, 'Play', 'YourUniqueIdentifier-10');
        this.play.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.playSwitchStateGet.bind(this))
            .on('set', this.playSwitchStateSet.bind(this));
        this.pause = this.accessory.getService('Pause') ||
            this.accessory.addService(this.platform.Service.Switch, 'Pause', 'YourUniqueIdentifier-11');
        this.pause.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.pauseSwitchStateGet.bind(this))
            .on('set', this.pauseSwitchStateSet.bind(this));
        this.stop = this.accessory.getService('Stop') ||
            this.accessory.addService(this.platform.Service.Switch, 'Stop', 'YourUniqueIdentifier-12');
        this.stop.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.stopSwitchStateGet.bind(this))
            .on('set', this.stopSwitchStateSet.bind(this));
        //Video and  audio Sensors///////////////////////////////////////////////////////////////////////////
        if (this.config.mediaAudioVideoState === true) {
            this.dolbyVision = this.accessory.getService('Dolby Vision Video') ||
                this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Vision Video', 'YourUniqueIdentifier-1');
            this.dolbyVision.getCharacteristic(this.platform.Characteristic.MotionDetected)
                .on('get', (callback) => {
                    let currentValue = this.HDROutput[0];
                    callback(null, currentValue);
                });
            this.hdr10 = this.accessory.getService('HDR 10 Video') ||
                this.accessory.addService(this.platform.Service.MotionSensor, 'HDR 10 Video', 'YourUniqueIdentifier-2');
            this.hdr10.getCharacteristic(this.platform.Characteristic.MotionDetected)
                .on('get', (callback) => {
                    let currentValue = this.HDROutput[1];
                    callback(null, currentValue);
                });
            this.SDR = this.accessory.getService('SDR Video') ||
                this.accessory.addService(this.platform.Service.MotionSensor, 'SDR Video', 'YourUniqueIdentifier-3');
            this.SDR.getCharacteristic(this.platform.Characteristic.MotionDetected)
                .on('get', (callback) => {
                    let currentValue = this.HDROutput[2];
                    callback(null, currentValue);
                });
            this.dolbySound = this.accessory.getService('Dolby Atmos') ||
                this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Atmos Sound', 'YourUniqueIdentifier-8');
            this.dolbySound.getCharacteristic(this.platform.Characteristic.MotionDetected)
                .on('get', (callback) => {
                    let currentValue = this.audioType[0];
                    callback(null, currentValue);
                });
            this.dtsSound = this.accessory.getService('DTS') ||
                this.accessory.addService(this.platform.Service.MotionSensor, 'DTS', 'YourUniqueIdentifier-9');
            this.dtsSound.getCharacteristic(this.platform.Characteristic.MotionDetected)
                .on('get', (callback) => {
                    let currentValue = this.audioType[1];
                    callback(null, currentValue);
                });

        }
        this.connectionStatus = this.accessory.getService('Oppo Not Responding') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'Oppo Not Responding', 'YourUniqueIdentifier-1010');
        this.connectionStatus.getCharacteristic(this.platform.Characteristic.StatusFault)
            .on('get', (callback) => {
                let currentValue = this.connectionLimitStatus;
                callback(null, currentValue);
            });
        ///////////////////////////////////Input buttons//////////////////////////////////////////////////////////////////////////
        if (this.config.inputButtons === true) {
            this.bluRayInput = this.accessory.getService('Blu-ray Input') ||
                this.accessory.addService(this.platform.Service.Switch, 'Blu-ray Input', 'YourUniqueIdentifier-23');
            this.bluRayInput.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Blu-ray Input Get State');
                    let currentValue = this.inputState[0];
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Blu-ray Input set to:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('BLURAY INPUT')]);
                    }
                    callback(null);
                });
            this.hdmiIn = this.accessory.getService('HDMI In Input') ||
                this.accessory.addService(this.platform.Service.Switch, 'HDMI In Input', 'YourUniqueIdentifier-24');
            this.hdmiIn.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('HDMI In Get State');
                    let currentValue = this.inputState[1];
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('HDMI In set to:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HDMI IN')]);
                    }
                    callback(null);
                });
            this.hdmiOut = this.accessory.getService('HDMI Out Input') ||
                this.accessory.addService(this.platform.Service.Switch, 'HDMI Out Input', 'YourUniqueIdentifier-25');
            this.hdmiOut.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('HDMI Out Get State');
                    let currentValue = this.inputState[2];
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('HDMI Out set to:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HDMI OUT')]);
                    }
                    callback(null);
                });
            if (this.config.oppo205 === true) {
                this.opticalB = this.accessory.getService('Optical Input') ||
                    this.accessory.addService(this.platform.Service.Switch, 'Optical Input', 'YourUniqueIdentifier-4010');
                this.opticalB.getCharacteristic(this.platform.Characteristic.On)
                    .on('get', (callback) => {
                        this.platform.log.debug('Optical Input Get State');
                        let currentValue = this.inputState[3];
                        callback(null, currentValue);
                    })
                    .on('set', (value, callback) => {
                        this.platform.log.debug('Optical Input set to:', value);
                        if (value === true) {
                            this.sending([this.pressedButton('OPTICAL INPUT')]);
                        }
                        callback(null);
                    });
                this.coaxialB = this.accessory.getService('Coaxial Input') ||
                    this.accessory.addService(this.platform.Service.Switch, 'Coaxial Input', 'YourUniqueIdentifier-4011');
                this.coaxialB.getCharacteristic(this.platform.Characteristic.On)
                    .on('get', (callback) => {
                        this.platform.log.debug('Coaxial Get State');
                        let currentValue = this.inputState[4];
                        callback(null, currentValue);
                    })
                    .on('set', (value, callback) => {
                        this.platform.log.debug('Coaxial set to:', value);
                        if (value === true) {
                            this.sending([this.pressedButton('COAXIAL INPUT')]);
                        }
                        callback(null);
                    });
                this.usbAudioB = this.accessory.getService('USB Audio In Input') ||
                    this.accessory.addService(this.platform.Service.Switch, 'USB Audio In Input', 'YourUniqueIdentifier-4012');
                this.usbAudioB.getCharacteristic(this.platform.Characteristic.On)
                    .on('get', (callback) => {
                        this.platform.log.debug('USB Audio In Get State');
                        let currentValue = this.inputState[5];
                        callback(null, currentValue);
                    })
                    .on('set', (value, callback) => {
                        this.platform.log.debug('USB Audio In set to:', value);
                        if (value === true) {
                            this.sending([this.pressedButton('USB AUDIO INPUT')]);
                        }
                        callback(null);
                    });
            }
        }
  //////Volume control Service as lightbulb or fan////////////////////////////////////////////////////////////////////////////
  if (this.config.volume === true) {
    if (this.config.changeDimmersToFan === false) {
            this.volumeDimmer = this.accessory.getService('Oppo Volume') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Oppo Volume', 'YourUniqueIdentifier-98');
            this.volumeDimmer.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = this.currentVolumeSwitch;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    let newVolume = this.targetVolume;
                    if (newValue === true) {
                        this.sending([this.volumeChange(newVolume)]);
                        this.platform.log.debug('Volume Value set to: Unmute');
                    }
                    if (newValue === false) {
                        newVolume = 0;
                        this.sending([this.volumeChange(newVolume)]);
                        this.platform.log.debug('Volume Value set to: Mute');
                    }

                    callback(null);
                });

            this.volumeDimmer.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentVolume;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.sending([this.volumeChange(newValue)]);
                    this.platform.log.debug('Volume Value set to: ' + newValue);

                    callback(null);
                });
        }
        else {
            this.volumeFan = this.accessory.getService('Oppo Volume') ||
                this.accessory.addService(this.platform.Service.Fanv2, 'Oppo Volume', 'YourUniqueIdentifier-98F');
            this.volumeFan.getCharacteristic(this.platform.Characteristic.Active)
                .on('get', (callback) => {
                    let currentValue = 0;
                    if (this.currentVolumeSwitch === true) {
                        currentValue = 1;
                    }
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    let newVolume = this.targetVolume;
                    if (newValue === 1) {
                        this.sending([this.volumeChange(newVolume)]);
                        this.platform.log.debug('Volume Value set to: Unmute');
                    }
                    if (newValue === 0) {
                        newVolume = 0;
                        this.sending([this.volumeChange(newVolume)]);
                        this.platform.log.debug('Volume Value set to: Mute');
                    }

                    callback(null);
                });

            this.volumeFan.addCharacteristic(new this.platform.Characteristic.RotationSpeed)
                .on('get', (callback) => {
                    let currentValue = this.currentVolume;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.sending([this.volumeChange(newValue)]);
                    this.platform.log.debug('Volume Value set to: ' + newValue);
                    callback(null);
                });
        }
    }
        ////other Controls /////////////////////////////////////////////////////////
        if (this.config.cursorUpB === true) {
            this.cursorUp = this.accessory.getService('Cursor Up') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Up', 'YourUniqueIdentifier-31');
            this.cursorUp.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Up GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Up SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR UP')]);
                    }
                    setTimeout(() => {
                        this.cursorUp.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.cursorDownB === true) {
            this.cursorDown = this.accessory.getService('Cursor Down') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Down', 'YourUniqueIdentifier-32');
            this.cursorDown.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Down GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Down SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR DOWN')]);
                    }
                    setTimeout(() => {
                        this.cursorDown.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.cursorLeftB === true) {
            this.cursorLeft = this.accessory.getService('Cursor Left') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Left', 'YourUniqueIdentifier-33');
            this.cursorLeft.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Left GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Left SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR LEFT')]);
                    }
                    setTimeout(() => {
                        this.cursorLeft.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.cursorRightB === true) {
            this.cursorRight = this.accessory.getService('Cursor Right') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Right', 'YourUniqueIdentifier-34');
            this.cursorRight.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Right GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Right SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR RIGHT')]);
                    }
                    setTimeout(() => {
                        this.cursorRight.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.cursorEnterB === true) {
            this.cursorEnter = this.accessory.getService('Cursor Enter') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Enter', 'YourUniqueIdentifier-35');
            this.cursorEnter.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Enter GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Enter SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR ENTER')]);
                    }
                    setTimeout(() => {
                        this.cursorEnter.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.menuB === true) {
            this.menu = this.accessory.getService('Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Menu', 'YourUniqueIdentifier-36');
            this.menu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Menu GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Menu SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('MENU')]);
                    }
                    setTimeout(() => {
                        this.menu.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.backButtonB === true) {
            this.backButton = this.accessory.getService('Back') ||
                this.accessory.addService(this.platform.Service.Switch, 'Back', 'YourUniqueIdentifier-37');
            this.backButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Back GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Back SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('BACK')]);
                    }
                    setTimeout(() => {
                        this.backButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.clearB === true) {
            this.clear = this.accessory.getService('Clear') ||
                this.accessory.addService(this.platform.Service.Switch, 'Clear', 'YourUniqueIdentifier-40');
            this.clear.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Clear GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Clear SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CLEAR')]);
                    }
                    setTimeout(() => {
                        this.clear.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.topMenuB === true) {
            this.topMenuB = this.accessory.getService('Top Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Top Menu', 'YourUniqueIdentifier-41');
            this.topMenuB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Top Menu GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Top Menu SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('TOP MENU')]);
                    }
                    setTimeout(() => {
                        this.topMenuB.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.optionB === true) {
            this.option = this.accessory.getService('Option') ||
                this.accessory.addService(this.platform.Service.Switch, 'Option', 'YourUniqueIdentifier-42');
            this.option.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Option GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Option SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('OPTION')]);
                    }
                    setTimeout(() => {
                        this.option.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.homeMenuB === true) {
            this.homeMenu = this.accessory.getService('Home Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Home Menu', 'YourUniqueIdentifier-43');
            this.homeMenu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Home Menu GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Home Menu SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HOME MENU')]);
                    }
                    setTimeout(() => {
                        this.homeMenu.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.infoB === true) {
            this.infoButton = this.accessory.getService('Info') ||
                this.accessory.addService(this.platform.Service.Switch, 'Info', 'YourUniqueIdentifier-44');
            this.infoButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Info GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Info SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('INFO')]);
                    }
                    setTimeout(() => {
                        this.infoButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.setupB === true) {
            this.setup = this.accessory.getService('Setup') ||
                this.accessory.addService(this.platform.Service.Switch, 'Setup', 'YourUniqueIdentifier-45');
            this.setup.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Setup GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Setup SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SETUP')]);
                    }
                    setTimeout(() => {
                        this.setup.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.goToB === true) {
            this.goTo = this.accessory.getService('Go To') ||
                this.accessory.addService(this.platform.Service.Switch, 'Go To', 'YourUniqueIdentifier-49');
            this.goTo.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Go To GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Go To SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('GO TO')]);
                    }
                    setTimeout(() => {
                        this.goTo.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.pageUpB === true) {
            this.pageUp = this.accessory.getService('Page Up') ||
                this.accessory.addService(this.platform.Service.Switch, 'Page Up', 'YourUniqueIdentifier-50');
            this.pageUp.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Page Up GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Page Up SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PAGE UP')]);
                    }
                    setTimeout(() => {
                        this.pageUp.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.pageDownB === true) {
            this.pageDown = this.accessory.getService('Page Down') ||
                this.accessory.addService(this.platform.Service.Switch, 'Page Down', 'YourUniqueIdentifier-51');
            this.pageDown.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Page Down GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Page Down SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PAGE DOWN')]);
                    }
                    setTimeout(() => {
                        this.pageDown.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.popUpMenuB === true) {
            this.popUpMenu = this.accessory.getService('Pop-Up Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Pop-Up Menu', 'YourUniqueIdentifier-52');
            this.popUpMenu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Pop-Up Menu GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Pop-Up Menu SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('POP-UP MENU')]);
                    }
                    setTimeout(() => {
                        this.popUpMenu.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        //////Additional Media Buttons/////////////////////////////////////////////////
        if (this.config.mediaButtons === true) {
            this.previous = this.accessory.getService('Previous') ||
                this.accessory.addService(this.platform.Service.Switch, 'Previous', 'YourUniqueIdentifier-38');
            this.previous.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Previous GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Previous SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PREVIOUS')]);
                    }
                    setTimeout(() => {
                        this.previous.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
            this.next = this.accessory.getService('Next') ||
                this.accessory.addService(this.platform.Service.Switch, 'Next', 'YourUniqueIdentifier-39');
            this.next.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Next GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Next SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('NEXT')]);
                    }
                    setTimeout(() => {
                        this.next.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
            this.rewindButton = this.accessory.getService('Rewind') ||
                this.accessory.addService(this.platform.Service.Switch, 'Rewind', 'YourUniqueIdentifier-46');
            this.rewindButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Rewind GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Rewind SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('REWIND')]);
                    }
                    setTimeout(() => {
                        this.rewindButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
            this.forwardButton = this.accessory.getService('Forward') ||
                this.accessory.addService(this.platform.Service.Switch, 'Forward', 'YourUniqueIdentifier-80');
            this.forwardButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Forward GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Forward SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('FORWARD')]);
                    }
                    setTimeout(() => {
                        this.forwardButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        /////The rest of the buttons///////////////////////////////////////////////////////////////////
        if (this.config.dimmerB === true) {
            this.dimmer = this.accessory.getService('Dimmer') ||
                this.accessory.addService(this.platform.Service.Switch, 'Dimmer', 'YourUniqueIdentifier-47');
            this.dimmer.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Dimmer GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Dimmer SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('DIMMER')]);
                    }
                    setTimeout(() => {
                        this.dimmer.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.pureAudioB === true) {
            this.pureAudio = this.accessory.getService('Pure Audio') ||
                this.accessory.addService(this.platform.Service.Switch, 'Pure Audio', 'YourUniqueIdentifier-48');
            this.pureAudio.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Pure Audio GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Pure Audio SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PURE AUDIO')]);
                    }
                    setTimeout(() => {
                        this.pureAudio.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.redB === true) {
            this.red = this.accessory.getService('Red') ||
                this.accessory.addService(this.platform.Service.Switch, 'Red', 'YourUniqueIdentifier-53');
            this.red.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Red GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Red SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('RED')]);
                    }
                    setTimeout(() => {
                        this.red.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.greenB === true) {
            this.green = this.accessory.getService('Green') ||
                this.accessory.addService(this.platform.Service.Switch, 'Green', 'YourUniqueIdentifier-54');
            this.green.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Green GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Green SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('GREEN')]);
                    }
                    setTimeout(() => {
                        this.green.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.blueB === true) {
            this.blue = this.accessory.getService('Blue') ||
                this.accessory.addService(this.platform.Service.Switch, 'Blue', 'YourUniqueIdentifier-55');
            this.blue.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Blue GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Blue SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('BLUE')]);
                    }
                    setTimeout(() => {
                        this.blue.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.yellowB === true) {
            this.yellow = this.accessory.getService('Yellow') ||
                this.accessory.addService(this.platform.Service.Switch, 'Yellow', 'YourUniqueIdentifier-56');
            this.yellow.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Yellow GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Yellow SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('YELLOW')]);
                    }
                    setTimeout(() => {
                        this.yellow.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.audioB === true) {
            this.audio = this.accessory.getService('Audio') ||
                this.accessory.addService(this.platform.Service.Switch, 'Audio', 'YourUniqueIdentifier-57');
            this.audio.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Audio GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Audio SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('AUDIO')]);
                    }
                    setTimeout(() => {
                        this.audio.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.subtitleB === true) {
            this.subtitle = this.accessory.getService('Subtitle') ||
                this.accessory.addService(this.platform.Service.Switch, 'Subtitle', 'YourUniqueIdentifier-58');
            this.subtitle.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Subtitle GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Subtitle SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SUBTITLE')]);
                    }
                    setTimeout(() => {
                        this.subtitle.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.angleB === true) {
            this.angle = this.accessory.getService('Angle') ||
                this.accessory.addService(this.platform.Service.Switch, 'Angle', 'YourUniqueIdentifier-59');
            this.angle.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Angle GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Angle SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('ANGLE')]);
                    }
                    setTimeout(() => {
                        this.angle.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.zoomB === true) {
            this.zoom = this.accessory.getService('Zoom') ||
                this.accessory.addService(this.platform.Service.Switch, 'Zoom', 'YourUniqueIdentifier-60');
            this.zoom.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Zoom GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Zoom SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('ZOOM')]);
                    }
                    setTimeout(() => {
                        this.zoom.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.sapB === true) {
            this.sap = this.accessory.getService('SAP') ||
                this.accessory.addService(this.platform.Service.Switch, 'SAP', 'YourUniqueIdentifier-61');
            this.sap.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('SAP GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('SAP SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SAP')]);
                    }
                    setTimeout(() => {
                        this.sap.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.abReplayB === true) {
            this.abReplay = this.accessory.getService('AB Replay') ||
                this.accessory.addService(this.platform.Service.Switch, 'AB Replay', 'YourUniqueIdentifier-62');
            this.abReplay.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('AB Replay GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('AB Replay SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('AB REPLAY')]);
                    }
                    setTimeout(() => {
                        this.abReplay.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.repeatB === true) {
            this.repeat = this.accessory.getService('Repeat') ||
                this.accessory.addService(this.platform.Service.Switch, 'Repeat', 'YourUniqueIdentifier-63');
            this.repeat.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Repeat GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Repeat SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('REPEAT')]);
                    }
                    setTimeout(() => {
                        this.repeat.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.pipB === true) {

            this.pip = this.accessory.getService('PIP') ||
                this.accessory.addService(this.platform.Service.Switch, 'PIP', 'YourUniqueIdentifier-64');
            this.pip.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('PIP GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('PIP SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PIP')]);
                    }
                    setTimeout(() => {
                        this.pip.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.resolutionB === true) {
            this.resolution = this.accessory.getService('Resolution') ||
                this.accessory.addService(this.platform.Service.Switch, 'Resolution', 'YourUniqueIdentifier-65');
            this.resolution.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Resolution GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Resolution SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('RESOLUTION')]);
                    }
                    setTimeout(() => {
                        this.resolution.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.threeDB === true) {
            this.threeD = this.accessory.getService('3D') ||
                this.accessory.addService(this.platform.Service.Switch, '3D', 'YourUniqueIdentifier-67');
            this.threeD.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('3D GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('3D SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('3D')]);
                    }
                    setTimeout(() => {
                        this.threeD.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.pictureB === true) {
            this.picture = this.accessory.getService('Picture') ||
                this.accessory.addService(this.platform.Service.Switch, 'Picture', 'YourUniqueIdentifier-68');
            this.picture.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Picture GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Picture SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PIC')]);
                    }
                    setTimeout(() => {
                        this.picture.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.hdrButtonB === true) {
            this.hdrButton = this.accessory.getService('HDR Button') ||
                this.accessory.addService(this.platform.Service.Switch, 'HDR Button', 'YourUniqueIdentifier-69');
            this.hdrButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('HDR Button GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('HDR Button SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HDR')]);
                    }
                    setTimeout(() => {
                        this.hdrButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.subtitleHoldB === true) {
            this.subtitleHold = this.accessory.getService('Subtitle (Hold)') ||
                this.accessory.addService(this.platform.Service.Switch, 'Subtitle (Hold)', 'YourUniqueIdentifier-70');
            this.subtitleHold.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Subtitle (Hold) GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Subtitle (Hold) SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SUBTITTLE (HOLD)')]);
                    }
                    setTimeout(() => {
                        this.subtitleHold.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.infoHoldB === true) {
            this.infoHold = this.accessory.getService('Info (Hold)') ||
                this.accessory.addService(this.platform.Service.Switch, 'Info (Hold)', 'YourUniqueIdentifier-71');
            this.infoHold.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Info (Hold) GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Info (Hold) SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('INFO (HOLD)')]);
                    }
                    setTimeout(() => {
                        this.infoHold.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.resolutionHoldB === true) {
            this.resolutionHold = this.accessory.getService('Resolution (Hold)') ||
                this.accessory.addService(this.platform.Service.Switch, 'Resolution (Hold)', 'YourUniqueIdentifier-72');
            this.resolutionHold.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Resolution (Hold) GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Resolution (Hold) SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('RESOLUTION (HOLD)')]);
                    }
                    setTimeout(() => {
                        this.resolutionHold.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.avSyncB === true) {
            this.avSync = this.accessory.getService('AV SYNC') ||
                this.accessory.addService(this.platform.Service.Switch, 'AV SYNC', 'YourUniqueIdentifier-73');
            this.avSync.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('AV SYNC GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('AV SYNC SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('AV SYNC')]);
                    }
                    setTimeout(() => {
                        this.avSync.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.gaplessPlayB === true) {
            this.gaplessPlay = this.accessory.getService('Gapless Play') ||
                this.accessory.addService(this.platform.Service.Switch, 'Gapless Play', 'YourUniqueIdentifier-74');
            this.gaplessPlay.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Gapless Play GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Gapless Play SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('GAPLESS PLAY')]);
                    }
                    setTimeout(() => {
                        this.gaplessPlay.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.inputB === true) {
            this.input = this.accessory.getService('Input') ||
                this.accessory.addService(this.platform.Service.Switch, 'Input', 'YourUniqueIdentifier-75');
            this.input.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Input GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Input SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('INPUT')]);
                    }
                    setTimeout(() => {
                        this.input.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.ejectDiscB === true) {

            this.ejectDisc = this.accessory.getService('Eject/Load Disc') ||
                this.accessory.addService(this.platform.Service.Switch, 'Eject/Load Disc', 'YourUniqueIdentifier-76');
            this.ejectDisc.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Eject/Load Disc GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Eject/Load Disc SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('EJECT')]);
                    }
                    setTimeout(() => {
                        this.ejectDisc.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        ///////////////Clean up. Delete services not in used
        if (this.config.powerB === false) {
            this.accessory.removeService(this.service);
        }
        if (this.config.mediaAudioVideoState === false) {
            this.accessory.removeService(this.dolbySound);
            this.accessory.removeService(this.dolbyVision);
            this.accessory.removeService(this.SDR);
            this.accessory.removeService(this.hdr10);
            this.accessory.removeService(this.dtsSound);

        }
        if (this.config.movieControl === false) {
            this.accessory.removeService(this.movieControlL);
            this.accessory.removeService(this.movieControlF);
        }
        if (this.config.chapterControl === false) {
            this.accessory.removeService(this.chapterControlL);
            this.accessory.removeService(this.chapterControlF);
        }
        if (this.config.chapterSelector === false) {
            this.accessory.removeService(this.chapterSelectorL);
            this.accessory.removeService(this.chapterSelectorF);
        }
        if (this.config.inputButtons == false) {
            this.accessory.removeService(this.bluRayInput);
            this.accessory.removeService(this.hdmiIn);
            this.accessory.removeService(this.hdmiOut);
            this.accessory.removeService(this.opticalB);
            this.accessory.removeService(this.coaxialB);
            this.accessory.removeService(this.usbAudioB);
        }
        if (this.config.volume === false) {
            this.accessory.removeService(this.volumeDimmer);
            this.accessory.removeService(this.volumeFan);
        }
        if (this.config.changeDimmersToFan === false) {
            this.accessory.removeService(this.volumeFan);
            this.accessory.removeService(this.chapterSelectorF);
            this.accessory.removeService(this.chapterControlF);
            this.accessory.removeService(this.movieControlF);
        }
        if (this.config.changeDimmersToFan === true) {
            this.accessory.removeService(this.volumeDimmer);
            this.accessory.removeService(this.chapterSelectorL);
            this.accessory.removeService(this.chapterControlL);
            this.accessory.removeService(this.movieControlL);
        }
        if (this.config.cursorUpB === false) {
            this.accessory.removeService(this.cursorUp);
        }
        if (this.config.cursorLeftB === false) {
            this.accessory.removeService(this.cursorLeft);
        }
        if (this.config.cursorDownB === false) {
            this.accessory.removeService(this.cursorDown);
        }
        if (this.config.cursorRightB === false) {

            this.accessory.removeService(this.cursorRight);
        }
        if (this.config.cursorEnterB === false) {

            this.accessory.removeService(this.cursorEnter);
        }
        if (this.config.menuB === false) {
            this.accessory.removeService(this.menu);
        }
        if (this.config.backButtonB === false) {
            this.accessory.removeService(this.backButton);
        }
        if (this.config.clearB === false) {
            this.accessory.removeService(this.clear);
        }
        if (this.config.topMenuB === false) {
            this.accessory.removeService(this.topMenuB);
        }
        if (this.config.optionB === false) {
            this.accessory.removeService(this.option);
        }
        if (this.config.homeMenuB === false) {
            this.accessory.removeService(this.homeMenu);
        }
        if (this.config.infoB === false) {
            this.accessory.removeService(this.infoButton);
        }
        if (this.config.setupB === false) {
            this.accessory.removeService(this.setup);
        }
        if (this.config.goToB === false) {
            this.accessory.removeService(this.goTo);
        }
        if (this.config.pageDownB === false) {
            this.accessory.removeService(this.pageDown);
        }
        if (this.config.pageUpB === false) {
            this.accessory.removeService(this.pageUp);
        }
        if (this.config.popUpMenuB === false) {
            this.accessory.removeService(this.popUpMenu);
        }
        if (this.config.mediaButtons === false) {
            this.accessory.removeService(this.previous);
            this.accessory.removeService(this.next);
            this.accessory.removeService(this.rewindButton);
            this.accessory.removeService(this.forwardButton);
        }
        if (this.config.dimmerB === false) {
            this.accessory.removeService(this.dimmer);
        }
        if (this.config.pureAudioB === false) {
            this.accessory.removeService(this.pureAudio);
        }
        if (this.config.redB === false) {
            this.accessory.removeService(this.red);
        }
        if (this.config.blueB === false) {
            this.accessory.removeService(this.blue);
        }
        if (this.config.yellowB === false) {
            this.accessory.removeService(this.yellow);
        }
        if (this.config.greenB === false) {
            this.accessory.removeService(this.green);
        }
        if (this.config.audioB === false) {
            this.accessory.removeService(this.audio);
        }
        if (this.config.subtitleB === false) {
            this.accessory.removeService(this.subtitle);
        }
        if (this.config.angleB === false) {
            this.accessory.removeService(this.angle);
        }
        if (this.config.zoomB === false) {
            this.accessory.removeService(this.zoom);
        }
        if (this.config.sapB === false) {
            this.accessory.removeService(this.sap);
        }
        if (this.config.abReplayB === false) {
            this.accessory.removeService(this.abReplay);
        }
        if (this.config.repeatB === false) {
            this.accessory.removeService(this.repeat);
        }
        if (this.config.pipB === false) {
            this.accessory.removeService(this.pip);
        }
        if (this.config.resolutionB === false) {
            this.accessory.removeService(this.resolution);
        }
        if (this.config.threeDB === false) {
            this.accessory.removeService(this.threeD);
        }
        if (this.config.pictureB === false) {
            this.accessory.removeService(this.picture);
        }
        if (this.config.hdrButtonB === false) {
            this.accessory.removeService(this.hdrButton);
        }
        if (this.config.subtitleHoldB === false) {
            this.accessory.removeService(this.subtitleHold);
        }
        if (this.config.infoHoldB === false) {
            this.accessory.removeService(this.infoHold);
        }
        if (this.config.resolutionHoldB === false) {
            this.accessory.removeService(this.resolutionHold);
        }
        if (this.config.avSyncB === false) {
            this.accessory.removeService(this.avSync);
        }
        if (this.config.gaplessPlayB === false) {
            this.accessory.removeService(this.gaplessPlay);
        }
        if (this.config.inputB === false) {
            this.accessory.removeService(this.input);
        }
        if (this.config.ejectDiscB === false) {
            this.accessory.removeService(this.ejectDisc);
        }
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
        setInterval(() => {
            if (this.reconnectionCounter >= this.reconnectionTry && this.reconnectionCounter <= this.reconnectionTry + 30) {
                this.platform.log.debug("Oppo Not Responding");
                this.connectionLimit = true;
                this.connectionLimitStatus = 1;
                this.commandChain = false;
            }
            if (this.config.autoIP === false || this.IPReceived === true) {
                if (this.client.readyState === 'Closed') {
                    this.client.end();
                    delete this.client
                    this.netConnect()
                }
                this.platform.log.debug('Socket writable: ', this.client.writable);
                this.platform.log.debug('Number of reconnection tries: ' + this.reconnectionCounter);
            }
            //this.tvService.updateCharacteristic(this.platform.Characteristic.Active, this.powerStateTV);
            this.newPowerState(this.powerState);
            this.newPlayBackState(this.playBackState);
            this.newInputName(this.inputName);
            if (this.config.mediaAudioVideoState === true) {
                this.newHDRState(this.HDROutput);
                this.newAudioType(this.audioType);
            }
            if (this.connectionStatus.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.connectionLimit) {
                this.connectionStatus.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.connectionLimit);
            }
            if (this.connectionStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value !== this.connectionLimitStatus) {
                this.connectionStatus.updateCharacteristic(this.platform.Characteristic.StatusFault, this.connectionLimitStatus);
            }
            if (this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState).value !== this.mediaState) {
                this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);
            }
            if (this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier).value !== this.inputID) {
                this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
            }
            if (this.speakerService.getCharacteristic(this.platform.Characteristic.Volume).value !== this.currentVolume) {
                this.speakerService.updateCharacteristic(this.platform.Characteristic.Volume, this.currentVolume);
            }
            if (this.speakerService.getCharacteristic(this.platform.Characteristic.Mute).value !== this.currentMuteState) {
                this.speakerService.updateCharacteristic(this.platform.Characteristic.Mute, this.currentMuteState);
            }
            if (this.config.powerB === true) {
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.powerState);
            }
            if (this.config.inputButtons === true) {
                this.newInputState(this.inputState);
            }
            if (this.config.volume === true) {
                this.newVolumeStatus(this.currentVolume);
            }
            if (this.config.movieControl === true) {
                if (this.config.changeDimmersToFan === false) {
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentMovieProgress);
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentMovieProgressState);
                }
                else {
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentMovieProgress);
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentMovieProgressState === true ? 1 : 0);
                }
            }
            if (this.config.chapterControl === true) {
                if (this.config.changeDimmersToFan === false) {
                    this.chapterControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterTime);
                    this.chapterControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentChapterTimeState);
                }
                else {
                    this.chapterControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentChapterTime);
                    this.chapterControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentChapterTimeState === true ? 1 : 0);
                }
            }
            if (this.config.chapterSelector === true) {
                this.newChapter(this.currentChapterSelector[0]);
            }
        }, this.config.pollingInterval);
    }
    //////////////Create Client//////////////////////////////////////////////////////////////////////////
    netConnectTO() {
        this.netConnectTimeOut = false;
        setTimeout(() => {
            this.netConnectTimeOut = true;
        }, 1000);
    }
    netConnect() {
        if (this.netConnectTimeOut = true) {
            this.netConnectTO();
            ////Creating the connection
            this.client = new net.Socket();
            this.client.setKeepAlive(true, 0);
            //////Connect to client
            this.client.connect(OPPO_PORT, this.OPPO_IP, () => {
                this.platform.log.debug(`Connecting to ${this.config.name}`);
                clearTimeout(timer);
                //this.platform.log(`Sending: ${this.commandName(this.key)}`);
                // this.client.write(this.key);
                this.firstConnection = true;
            });
            this.client.on('ready', () => {
                clearTimeout(timer);
                this.platform.log.debug(`${this.config.name} is ready`);
                this.platform.log.debug(`Sending: ${this.commandName(this.key)}`);
                this.sending([this.key]);
                // this.client.write(this.key);
                //this.resetCounter()
                this.firstConnection = true;
            });
            /////Receiving Data
            this.client.on('data', (data) => {
                clearTimeout(timer);
                this.eventDecoder(data);
            });
            /////Errors
            this.client.on('error', (e) => {
                clearTimeout(timer);
                this.platform.log.debug(`Error: ${e}`);
                this.platform.log.debug(`Trying to reconnect to ${this.config.name} after an error`);
                this.platform.log.debug(`Turn on ${this.config.name} and check the IP Address`);
                this.client.end();
                this.client.removeAllListeners();
                this.client.destroy();
                this.reconnectionCounter += 1;
                this.firstConnection = true;
                this.platform.log.debug("Reconnection counter is " + this.reconnectionCounter);
                // if (this.reconnectionCounter < this.reconnectionTry) {
                setTimeout(() => {
                    delete this.client
                    this.netConnect();
                }, this.reconnectionWait);
                if (this.reconnectionCounter > this.reconnectionTry) {
                    this.connectionLimit = true;
                    this.connectionLimitStatus = 1;
                    if (this.turnOffAllUsed === false) {
                        this.turnOffAll();
                        this.turnOffAllUsed = true;
                    }
                }
            });
            ////Connection Closed
            this.client.on('close', () => {
                this.platform.log.debug(`Disconnected from ${this.config.name}`);
                this.reconnectionCounter += 1;
                this.firstConnection = true;
                this.currentMovieProgressFirst = true;
                this.chapterFirstUpdate = true;
                this.client.end();
                this.client.removeAllListeners();
                this.client.destroy();
                setTimeout(() => {
                    delete this.client
                    this.netConnect();
                }, this.reconnectionWait);
                if (this.reconnectionCounter > this.reconnectionTry) {
                    if (this.turnOffAllUsed === false) {
                        this.turnOffAll();
                        this.turnOffAllUsed = true;
                    }
                }
            });
            this.client.on('end', () => {
                this.platform.log.debug(`Connection to ${this.config.name} ended`);
                this.reconnectionCounter += 1;
                this.firstConnection = true;
                this.currentMovieProgressFirst = true;
                this.chapterFirstUpdate = true;
                this.client.end();
                this.client.removeAllListeners();
                this.client.destroy();
                setTimeout(() => {
                    delete this.client
                    this.netConnect();
                }, this.reconnectionWait);
                if (this.reconnectionCounter > this.reconnectionTry) {
                    if (this.turnOffAllUsed === false) {
                        this.turnOffAll();
                        this.turnOffAllUsed = true;
                    }
                }
            });
            /////Time out Timer
            const timer = setTimeout(() => {
                this.platform.log.debug('ERROR. Attempt at connection exceeded timeout value');
                // client.destroy();
            }, timeout);
        }
    }

    discoveryUDP() {
        this.discovery = udp.createSocket({ type: 'udp4', reuseAddr: true });
        this.discovery.on('error', (error) => {
            this.platform.log(error);
            this.discovery.close();
        });
        this.discovery.on('listening', () => {
            var address = this.discovery.address();
            this.platform.log('UDP Client listening on ' + address.address + ":" + address.port);
            this.discovery.setBroadcast(true)
            this.discovery.setMulticastTTL(128);
            this.discovery.addMembership('239.255.255.251');
        });

        this.discovery.on('message', (message, remote) => {
            this.platform.log.debug('Message received From: ' + remote.address + ':' + remote.port);
            let newMessage = String.fromCharCode(...message);
            this.platform.log.debug(newMessage);
            var properties = newMessage.split('\n');
            var oppoInfo = {};
            properties.forEach((property) => {
                var tup = property.split(':');
                oppoInfo[tup[0]] = tup[1];
            });
            if (typeof oppoInfo['Server IP'] !== 'undefined') {
                if (this.OPPO_IP !== oppoInfo['Server IP'].replace(/\s+/g, '')) {
                    this.OPPO_IP = oppoInfo['Server IP'].replace(/\s+/g, '');
                    this.platform.log.debug('Oppo IP is: ' + this.OPPO_IP);
                    this.IPReceived = true;
                    //this.discovery.close();
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
    loginTO() {
        this.loginTimeOut = false;;
        setTimeout(() => {
            this.loginTimeOut = true;
        }, 2000);
    }
    login() {
        if (this.loginTimeOut === true) {
            let regexExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
            // this.platform.log(this.OPPO_IP);
            //this.platform.log(regexExp.test(this.OPPO_IP));
            if (regexExp.test(this.OPPO_IP)) {
                this.platform.log('Login to Oppo');
                this.loginClient = udp.createSocket('udp4');
                //buffer msg
                var login = new Buffer.from('NOTIFY OREMOTE LOGIN');
                //sending msg
                this.loginTO();
                this.loginClient.send(login, 7624, this.OPPO_IP, (err) => {

                    //this.platform.log.debug('UDP message sent to ' + this.OPPO_IP + ':' + '7624');
                    this.platform.log.debug('UDP message sent to devices')
                    this.platform.log.debug('Error:' + err);
                    this.loginClient.close();
                });
            }
            else {
                this.platform.log.debug("IP not set yet or is invalid");
            }
        }
    }
    ///////Handlers////////////////////////////////////////////////////////////////////////////////////////
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
                }, 500);
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
    getOn(callback) {
        let isOn = this.powerState;
        this.platform.log.debug('Get Power ->', isOn);
        callback(null, isOn);
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////Play
    playSwitchStateGet(callback) {
        this.platform.log.debug('Play State');
        let currentValue = this.playBackState[0];
        callback(null, currentValue);
    }
    playSwitchStateSet(value, callback) {
        this.platform.log.debug('Play set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('PLAY')]);
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////Pause
    pauseSwitchStateGet(callback) {
        this.platform.log.debug('Pause State');
        let currentValue = this.playBackState[1];
        callback(null, currentValue);
    }
    pauseSwitchStateSet(value, callback) {
        this.platform.log.debug('Pause set to', value);
        if (value === true) {
            this.sending([this.pressedButton('PAUSE')]);
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////stop
    stopSwitchStateGet(callback) {
        this.platform.log.debug('Stop State');
        let currentValue = this.playBackState[2];
        callback(null, currentValue);
    }
    stopSwitchStateSet(value, callback) {
        this.platform.log.debug('Stop set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('STOP')]);
        }
        callback(null);
    }
    /////////////////Command Log
    commandLog(commandPress) {
        if (commandPress.includes("QVM")) {
            this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }
        else if (commandPress.includes("RST")) {
            this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }

        else if (commandPress.includes("QCE")) {
            this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }
        else if (commandPress.includes("QCH")) {
            this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }
        else if (commandPress.includes("QRE")) {
            this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }
        else if (commandPress.includes("SRH T")) {
            this.platform.log(`Sending: Search Title Time ${commandPress} ${this.newResponse}`);
        }
        else if (commandPress.includes("SRH C")) {
            this.platform.log(`Sending: Search Chapter Time ${commandPress} ${this.newResponse}`);
        }
        else if (commandPress.includes("SRH")) {
            this.platform.log(`Sending: Search Time ${commandPress} ${this.newResponse}`);
        }
        else if (commandPress.includes("SVL")) {
            this.platform.log(`Sending: Volume Change to ${commandPress} ${this.newResponse}`);
        }
        else if (commandPress.includes("QPW")) {
            this.newResponse = `by HTTP`;
            this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
            setTimeout(() => {
                this.sendHttp(this.makeUrl(commandPress), (commandPress));
            }, 500);
        }
        else if (commandPress.includes("PON")) {
            //this.newResponse = `by TCP and HTTP`;
            this.platform.log(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
            /*
        setTimeout(() => {
            this.sendHttp(this.makeUrl(commandPress), (commandPress));
        }, 1000);
           */
        }
        else if (this.config.chinoppo === true && commandPress.includes('EJT')) {
            // this.newResponse = `by TCP and HTTP`;
            this.platform.log(`Sending: Power on Command ${this.newResponse}`);
            /* setTimeout(() => {
                    this.sendHttp(this.makeUrl('#PON'), '#PON');
                }, 1000);
                */
        }
        else {
            this.platform.log(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }
    }

    /////Sending Instructions/////////////////////////////////////////////////////////////////////////////////////////////////////
    sending(press) {
        if (this.config.autoIP === false || this.IPReceived === true) {
            let regexExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
            //this.platform.log(regexExp.test(this.OPPO_IP));
            if (regexExp.test(this.OPPO_IP)) {
                this.platform.log.debug(`Connection counter is ${this.reconnectionCounter} `);
                this.platform.log.debug(`${press}`);
                let i = 0;
                while (i < press.length) {
                    let command = press[i].substring(1);
                    if (this.reconnectionCounter < this.reconnectionTry) {
                        //////////////Send By TCP + HTTP
                        if (command.includes('RST') || command.includes('PON') || command.includes('SVM')
                            || command.includes('SIS') || command.includes('SVL') || command.includes('SRH')
                            || command.includes('QAT') || command.includes('QVM') || command.includes('QPW')
                            || command.includes('QHD') || command.includes('QPL') || command.includes('QIS')
                            || command.includes('QVL') || command.includes('QCH') || command.includes('QCR')
                            || command.includes('QCE') || command.includes('QEL') || command.includes('QRE')
                            || command.includes('QVR') || command.includes('EJT')) {
                            this.reconnectionCounter += 1;
                            if (this.client.readyState === 'Closed') {
                                this.client.end();
                                this.key = press[i];
                                delete this.client;
                                this.netConnect();
                                this.keyReset();
                                this.commandLog(press[i]);
                            }
                            else {
                                this.newResponse = `by TCP`;
                                //this.newResponse = `by TCP, try number: ${this.reconnectionCounter}`;
                                this.platform.log.debug(`${press[i]} sent by TCP`);
                                this.client.write(press[i]);
                                this.commandLog(press[i]);
                            }
                        }
                        else {
                            if (this.httpNotResponding <= 3) {
                                //this.newResponse = `by HTTP, try number: (${this.httpNotResponding})`;
                                this.newResponse = `by HTTP`;
                                this.commandLog(press[i]);
                                this.sendHttp(this.makeUrl(press[i]), press[i]);
                            }
                            else {
                                this.newResponse = `by TCP, HTTP not responding`;
                                // this.newResponse = `by TCP, HTTP not responding, try number: ${this.reconnectionCounter}`;
                                this.platform.log.debug(`${press[i]} sent by TCP`);
                                if (press[i].includes('MTR')) {
                                    press[i] = '#QRE';
                                }
                                this.client.write(press[i]);
                                this.commandLog(press[i]);
                                this.login();
                                /*
                                setTimeout(() => {
                                    this.sendHttp(this.makeUrl('#PON'), '#PON');
                                }, 500);
                                */

                            }
                        }
                    }
                    else {
                        if (!press[i].includes('QVM') || !press[i].includes('RST')) {

                            this.newResponse = `by HTTP, TCP not responding`;
                            this.commandLog(press[i]);
                            if (this.config.chinoppo === true && press[i].includes('EJT')) {
                                press[i] = '#PON';
                            }
                            this.sendHttp(this.makeUrl(press[i]), press[i]);
                            if (this.autoIP === true) {
                                this.discoveryUDP();
                            }
                            else {
                                //////Trying to reconnect TCP
                                this.client.end();
                                delete this.client;
                                this.netConnect();
                            }

                        }
                    }
                    i += 1;
                }
            }
            else {
                this.platform.log.debug('IP address is not valid');
            }

        }
        else {
            this.platform.log('IP not set yet');
            // this.helloMessage();
        }
    }
    ///////Send HTTP command///////////////////////////
    /*
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    */
    async sendHttp(url, key) {
        /*
        if (this.tvService.getCharacteristic(this.platform.Characteristic.Active).value === 0 && !key.includes('POF') && !key.includes('QPW')) {
            this.sending([this.pressedButton('POWER ON')]);
            await this.sleep(1000);
        }
        */
        this.platform.log.debug(url);
        this.platform.log.debug(key);
        this.httpNotResponding += 1;
        request.get(url, (res) => {
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    let parsedData = JSON.parse(rawData);
                    this.httpNotResponding = 0;
                    this.httpEventDecoder(parsedData, key);
                } catch (e) {
                    // this.login();
                    //console.error(e.message);
                    //this.platform.log(e);
                }
            });
        }).on('error', (e) => {
            // this.login();
            // console.error(`Got error: ${e.message}`);
        });
    }
    //////////////////Make URL for HTTP///////////////
    makeUrl(key) {
        this.platform.log.debug('HTTP counter: ' + this.httpNotResponding)
        if (key.includes("SRH")) {
            key = key.substring(1);
            let url1 = "http://" + this.OPPO_IP + ":436/setplaytime?";
            let url = '';
            let newKey = '';
            if (key.includes('SRH C')) {
            }
            else if (key.includes('SRH T')) {
                newKey = key.split(' ')
                newKey = newKey[2].split(':')
                this.platform.log.debug(`Sending: Search Time ${key} ${this.newResponse}`);
            }
            else if (key.includes('SRH')) {
                newKey = key.split(' ')
                newKey = newKey[1].split(':')
                this.platform.log.debug(`Sending: Search Time ${key} ${this.newResponse}`);
            }
            url = url + '{"h":' + String(parseInt(newKey[0], 10)) + ',';
            url = url + '"m":' + String(parseInt(newKey[1], 10)) + ',';
            url = url + '"s":' + String(parseInt(newKey[2], 10)) + '}';
            url = url1 + url
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('SVL')) {
            let newKey = key.split(' ')
            let url = "http://" + this.OPPO_IP + ":436/setvolume?%7B%22cur_vol%22%3A" + newKey[1] + "%2C%22connectId%22%3A%22" + this.localIP + "%22%7D";
            this.platform.log.debug(`Sending: Volume Change to ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('PON')) {
// let url = "http://" + this.OPPO_IP + ":436/signin?%7B%22appIconType%22%3A1%2C%22appIpAddress%22%3A%22" + this.localIP + "%22%7D";
let url = "http://" + this.OPPO_IP + ":436/signin?%7B%22appIpAddress%22%3A%22" + this.localIP + "%22%2C%22appIconType%22%3A1%7D";
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('QRE') || key.includes('MTR')) {
            let url = "http://" + this.OPPO_IP + ":436/getplayingtime";
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('QPL') || key.includes('QIS')) {
            let url = "http://" + this.OPPO_IP + ":436/getglobalinfo";
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('QVL')) {
            let url = "http://" + this.OPPO_IP + ":436/getvolume";
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('QPW')) {
            let url = "http://" + this.OPPO_IP + ":436/getglobalinfo";
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('QFN')) {
            let url = "http://" + this.OPPO_IP + ":436/getmovieplayinfo";
            this.platform.log.debug(`Sending: Media Name Query by HTTP`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('SIS')) {
            let url = "http://" + this.OPPO_IP + ":436/sendremotekey?%7B%22SRC%22%3A%22SRC%22%7D";
            this.platform.log(`Sending: Input Change ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else if (key.includes('QAT')) {
            let url = "http://" + this.OPPO_IP + ":436/getaudiomenulist";
            this.platform.log.debug(`Sending: ${this.commandName(key)} ${this.newResponse}`);
            this.platform.log.debug(url);
            return url
        }
        else {
            let Key = key.substring(1);
            Key = Key.replace(/\s/g, '');
            this.platform.log.debug('Key to be sent by HTTP: ' + Key);
            let url = "http://" + this.OPPO_IP + ":436/sendremotekey?%7B%22key%22%3A%22" + Key + "%22%7D";
            this.platform.log.debug(url);
            return url
        }
    }
    //////////Current Status//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
            this.speakerService.getCharacteristic(this.platform.Characteristic.Volume).updateValue(this.currentVolume);
            this.speakerService.getCharacteristic(this.platform.Characteristic.Mute).updateValue(this.currentMuteState)
            if (this.config.volume === true) {
                if (this.config.changeDimmersToFan === false) {
                    this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentVolume);
                    this.volumeDimmer.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentVolume);
                    this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.On, this.currentVolumeSwitch);
                    this.volumeDimmer.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentVolumeSwitch);
                }
                else {
                    this.volumeFan.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentVolume);
                    this.volumeFan.getCharacteristic(this.platform.Characteristic.RotationSpeed).updateValue(this.currentVolume);
                    this.volumeFan.updateCharacteristic(this.platform.Characteristic.Active, this.currentVolumeSwitch === true ? 1 : 0);
                    this.volumeFan.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.currentVolumeSwitch === true ? 1 : 0);
                }
            }
        }
    }
    newInputName(newName) {
        this.inputName = newName;
        if (this.bluRay.getCharacteristic(this.platform.Characteristic.ConfiguredName).value !== this.inputName) {
            this.platform.log.debug(this.inputName);
            this.bluRay.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName)
            this.bluRay.getCharacteristic(this.platform.Characteristic.ConfiguredName).updateValue(this.inputName);
        }
    }
    newChapter(newChapter) {
        if (this.currentChapterSelector[0] !== newChapter) {
            if (newChapter === 0) {
                this.currentChapterSelectorState = false;
            }
            if (newChapter !== 0) {
                this.currentChapterSelectorState = true;
                if (newChapter !== this.currentChapterSelector[0]) {
                    this.chapterFirstUpdate = true;
                    setTimeout(() => {
                        this.sending([this.query('CHAPTER TIME REMAINING')]);
                    }, 200);
                    setTimeout(() => {
                        this.sending([this.query('CHAPTER TIME ELAPSED')]);
                    }, 400);
                }
            }
            this.currentChapterSelector[0] = newChapter;
            if (this.config.chapterSelector === true) {
                if (this.config.changeDimmersToFan === false) {
                if (this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.Brightness).value !== this.currentChapterSelector[0]) {
                    this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterSelector[0]);
                    this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentChapterSelector[0]);
                    this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.On, this.currentChapterSelectorState);
                    this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentChapterSelectorState);
                }
            }
            else {
                if (this.chapterSelectorF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentChapterSelector[0]) {
                    this.chapterSelectorF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentChapterSelector[0]);
                    this.chapterSelectorF.getCharacteristic(this.platform.Characteristic.RotationSpeed).updateValue(this.currentChapterSelector[0]);
                    this.chapterSelectorF.updateCharacteristic(this.platform.Characteristic.Active, this.currentChapterSelectorState === true ? 1 : 0);
                    this.chapterSelectorF.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.currentChapterSelectorState === true ? 1 : 0);
                }
                }
            }
        }
    }
    newChapterTime(newTime) {
        if (newTime === 0) {
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
                this.chapterControlL.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentChapterTime);
                this.chapterControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentChapterTimeState);
                this.chapterControlL.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentChapterTimeState);
            }
        }
        else {
            if (this.chapterControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentChapterTime) {
                this.chapterControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentChapterTime);
                this.chapterControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).updateValue(this.currentChapterTime);
                this.chapterControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentChapterTimeState === true ? 1 : 0);
                this.chapterControlF.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.currentChapterTimeState === true ? 1 : 0);
            }

            }
        }
    }
    newMovieTime(newMovieTime) {
        if (newMovieTime === 0) {
            this.currentMovieProgressState = false;
            this.currentMovieProgress = 0;
        }
        if (newMovieTime !== 0) {
            this.currentMovieProgressState = true;
        }
        if (this.firstElapsedMovie + this.movieRemaining !== 0) {
            this.currentMovieProgress = Math.round(newMovieTime * 100 / (this.firstElapsedMovie + this.movieRemaining));
        }
        if (this.currentMovieProgressState === true && this.currentMovieProgress === 0) {
            this.currentMovieProgress = 1;
        }
        if (this.currentMovieProgress > 100) { this.currentMovieProgress = 100 }
        if (this.config.movieControl === true) {
            if (this.config.changeDimmersToFan === false) {
                if (this.movieControlL.getCharacteristic(this.platform.Characteristic.Brightness).value !== this.currentMovieProgress) {
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentMovieProgress);
                    this.movieControlL.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentMovieProgress);
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentMovieProgressState);
                    this.movieControlL.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentMovieProgressState);
                }
            }
            else {
                if (this.movieControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentMovieProgress) {
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentMovieProgress);
                    this.movieControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).updateValue(this.currentMovieProgress);
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentMovieProgressState === true ? 1 : 0);
                    this.movieControlF.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.currentMovieProgressState === true ? 1 : 0);
                }
            }
        }
    }
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
            this.tvService.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.powerStateTV);
            if (this.config.powerB === true) {
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.powerState);
                this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(this.powerState);
            }
        }
    }
    newPlayBackState(newPlay) {
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
            this.play.getCharacteristic(this.platform.Characteristic.On).updateValue(this.playBackState[0]);
        }
        if (this.pause.getCharacteristic(this.platform.Characteristic.On).value !== this.playBackState[1]) {
            this.pause.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[1]);
            this.pause.getCharacteristic(this.platform.Characteristic.On).updateValue(this.playBackState[1]);
        }
        if (this.stop.getCharacteristic(this.platform.Characteristic.On).value !== this.playBackState[2]) {
            this.stop.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[2]);
            this.stop.getCharacteristic(this.platform.Characteristic.On).updateValue(this.playBackState[2]);
        }
        if (this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState).value !== this.mediaState) {
            this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);
            this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.mediaState);
        }

    }
    newHDRState(newHDR) {
        this.HDROutput = newHDR;
        if (this.config.mediaAudioVideoState === true) {
            if (this.dolbyVision.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.HDROutput[0]) {
                this.dolbyVision.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[0]);
                this.dolbyVision.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(this.HDROutput[0]);
            }
            if (this.hdr10.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.HDROutput[1]) {
                this.hdr10.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[1]);
                this.hdr10.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(this.HDROutput[1]);
            }
            if (this.SDR.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.HDROutput[2]) {
                this.SDR.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[2]);
                this.SDR.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(this.HDROutput[2]);
            }
        }
    }
    newAudioType(newAT) {
        this.audioType = newAT;
        if (this.config.mediaAudioVideoState === true) {
            if (this.dolbySound.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.audioType[0]) {
                this.dolbySound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[0]);
                this.dolbySound.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(this.audioType[0]);
            }
            if (this.dtsSound.getCharacteristic(this.platform.Characteristic.MotionDetected).value !== this.audioType[1]) {
                this.dtsSound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[1]);
                this.dtsSound.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(this.audioType[1]);
            }
        }
    }
    newInputState(newInput) {
        if (this.inputState !== newInput) {
            this.inputState = newInput;
            if (this.inputState[0] === true) {
                this.inputID = 1;
            }
            else if (this.inputState[1] === true) {
                this.inputID = 2;
            }
            else if (this.inputState[2] === true) {
                this.inputID = 3;
            }
            else if (this.inputState[3] === true) {
                this.inputID = 4;
            }
            else if (this.inputState[4] === true) {
                this.inputID = 5;
            }
            else if (this.inputState[5] === true) {
                this.inputID = 6;
            }
            else if (this.inputState[0] === false && this.inputState[1] === false && this.inputState[2] === false
                && this.inputState[3] === false && this.inputState[4] === false && this.inputState[5] === false) {
                this.inputID = 0;
            }
            else {
            }
            this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
            this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier).updateValue(this.inputID);
            if (this.config.inputButtons === true) {
                this.bluRayInput.updateCharacteristic(this.platform.Characteristic.On, this.inputState[0]);
                this.bluRayInput.getCharacteristic(this.platform.Characteristic.On).updateValue(this.inputState[0]);
                this.hdmiIn.updateCharacteristic(this.platform.Characteristic.On, this.inputState[1]);
                this.hdmiIn.getCharacteristic(this.platform.Characteristic.On).updateValue(this.inputState[1]);
                this.hdmiOut.updateCharacteristic(this.platform.Characteristic.On, this.inputState[2]);
                this.hdmiOut.getCharacteristic(this.platform.Characteristic.On).updateValue(this.inputState[2]);
                if (this.config.oppo205 === true) {
                    this.opticalB.updateCharacteristic(this.platform.Characteristic.On, this.inputState[3]);
                    this.opticalB.getCharacteristic(this.platform.Characteristic.On).updateValue(this.inputState[3]);
                    this.coaxialB.updateCharacteristic(this.platform.Characteristic.On, this.inputState[4]);
                    this.coaxialB.getCharacteristic(this.platform.Characteristic.On).updateValue(this.inputState[4]);
                    this.usbAudioB.updateCharacteristic(this.platform.Characteristic.On, this.inputState[5]);
                    this.usbAudioB.getCharacteristic(this.platform.Characteristic.On).updateValue(this.inputState[5]);
                }
            }
        }
    }
    /////////////////HTTP Event decoder
    httpEventDecoder(rawData, key) {
        this.platform.log.debug(`${key} Sent by HTTP`);
        this.platform.log.debug(rawData);
        if (rawData.success === true) {
            if (typeof (rawData.playinfo) !== 'undefined') {
                if (typeof (rawData.playinfo.file_path) !== 'undefined') {
                    if (rawData.playinfo.file_path === 'AVCHD') {
                        let newNameInput = rawData.playinfo.bd_file_path.split('/');
                        this.platform.log.debug(newNameInput);
                        let nameInput = '';
                        if (Object.values(newNameInput)[Object.keys(newNameInput).length - 1] === 'BDMV' && Object.values(newNameInput)[Object.keys(newNameInput).length - 2] === 'AVCHD') {
                            nameInput = Object.values(newNameInput)[Object.keys(newNameInput).length - 3];
                        }
                        else if (Object.values(newNameInput)[Object.keys(newNameInput).length - 1] === 'BDMV'
                            && !Object.values(newNameInput)[Object.keys(newNameInput).length - 2] === 'AVCHD') {
                            nameInput = Object.values(newNameInput)[Object.keys(newNameInput).length - 2];
                        }
                        else if (Object.values(newNameInput)[Object.keys(newNameInput).length - 1] === 'AVCHD') {
                            nameInput = Object.values(newNameInput)[Object.keys(newNameInput).length - 2];
                        }
                        else {
                            nameInput = Object.values(newNameInput)[Object.keys(newNameInput).length - 1];
                        }
                        this.platform.log(`Response: ${nameInput} is Playing`);
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
                        this.platform.log.debug(rawData.audio_list[i].name)
                        this.eventDecoder('@' + rawData.audio_list[i].name)
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
            if (typeof (rawData.is_video_playing) !== 'undefined') {
                if (rawData.is_video_playing === false && rawData.is_audio_playing === false && rawData.is_pic_playing === false
                    && rawData.is_bdmv_playing === false) {
                    this.eventDecoder("@UPL HTTP STOP");
                }
                else {
                    if (this.playBackState[1] === true)
                        this.eventDecoder("@UPL HTTP PAUS");
                    else {
                        this.eventDecoder("@UPL HTTP PLAY");
                    }
                }
            }
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
    eventDecoder(dataReceived) {
        let str = (`${dataReceived}`);
        this.platform.log.debug(str);
        let res = str.split('@');
        let i = 0;
        while (i < res.length) {
            this.platform.log.debug(res[i])
            if (res[i] === '') {
                //
            }
            /////////////////////////////////Verbose Mode/////////////////////////////////////////
            else if (res[i].includes('QVM OK 2')) {
                this.resetCounter();
                this.platform.log.debug(`Response: Verbose Mode 2`);
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    this.sending([this.pressedButton('VERBOSE MODE 3')]);
                }
                else {
                    setTimeout(() => {
                        this.sending([this.query('POWER STATUS')]);
                    }, 500);
                }
            }
            else if (res[i].includes('SVM OK 2')) {
                this.resetCounter();
                this.platform.log.debug(`Response: Verbose Mode 2 Executed`);
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    this.sending([this.pressedButton('VERBOSE MODE 3')]);
                }
                else {
                    setTimeout(() => {
                        this.sending([this.query('POWER STATUS')]);
                    }, 500);
                }
            }
            else if (res[i].includes('QVM OK 3')) {
                this.resetCounter();
                this.platform.log.debug(`Response: Verbose Mode 3`);
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    setTimeout(() => {
                        this.sending([this.query('POWER STATUS')]);
                    }, 500);
                }
                else {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
            }
            else if (res[i].includes('SVM OK 3')) {
                this.resetCounter();
                this.platform.log.debug(`Response: Verbose Mode 3 Executed`);
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    setTimeout(() => {
                        this.sending([this.query('POWER STATUS')]);
                    }, 500);
                }
                else {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
            }
            else if (res[i].includes('QVM OK 0')) {
                this.resetCounter();
                this.platform.log.debug(`Response: Verbose Mode 0`);
                if (this.config.movieControl === true || this.config.chapterControl === true || this.config.chapterSelector === true) {
                    this.sending([this.pressedButton('VERBOSE MODE 3')]);
                }
                else {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
            }
            ///////////////Power Status/////////////////////////////////////////////////////////////////////
            else if (res[i].includes('QPW OK OFF')) {
                this.platform.log.debug(`Response: Power Status Query Executed (Off)`);
                this.resetCounter();
                this.turnOffAll();
            }
            else if (res[i].includes('POF OK')) {
                this.platform.log(`Response: ${this.commandName(res[i])} ${this.newResponse}`);
                this.resetCounter();
                this.turnOffAll();
            }
            else if (res[i].includes('UPW 0') || res[i].includes('OK UPW 0')) {
                if (!res[i].includes('OK UPW 0')) {
                    this.platform.log(`Response: Power Off Executed ${this.newResponse}`);
                }
                this.turnOffAll();
            }
            else if (res[i].includes('UPW 1')) {
                this.platform.log(`Response: Power On Executed`);
                this.newPowerState(true);
                if (this.firstConnection === true) {
                    if (this.reconnectionCounter < this.reconnectionTry) {
                        if (this.commandChain === false) {
                            setTimeout(() => {
                                this.commandChain = true;
                                setTimeout(() => {
                                    this.sending([this.query('INPUT STATUS')]);
                                }, 200);
                                this.resetCommandChain();
                            }, 3000);
                            this.platform.log("Chain of commands starting in 3 seconds");
                        }
                        else {
                            this.platform.log("Chain of command not finished yet")
                        }
                    }
                    if (this.reconnectionCounter >= this.reconnectionTry) {
                        setTimeout(() => {
                            this.sending([this.query('PLAYBACK STATUS')]);
                        }, 3000);
                    }
                }
            }
            else if (res[i].includes('PON OK')) {
                this.platform.log(`Response: ${this.commandName(res[i])}`);
                this.resetCounter();
                this.newPowerState(true);
            }
            else if (res[i].includes('QPW OK ON')) {
                this.platform.log(`Response: Power Status Query Executed (On)`);
                this.newPowerState(true);
                this.resetCounter();
                if (this.firstConnection === true) {
                    this.platform.log.debug('First Update');
                    if (this.reconnectionCounter < this.reconnectionTry) {
                        if (this.commandChain === false) {
                            this.commandChain = true;
                            setTimeout(() => {
                                this.sending([this.query('INPUT STATUS')]);
                            }, 200);
                            this.platform.log("Chain of Commands Started");
                            this.resetCommandChain();
                        }
                        else {
                            this.platform.log("Chain of command not finished yet")
                        }
                    }
                    if (this.reconnectionCounter >= this.reconnectionTry) {
                        this.sending([this.query('PLAYBACK STATUS')]);
                    }
                }
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
                    this.currentChapterSelector[0] = 0;
                }
                this.chapterCounter += 1;
                if (this.reconnectionCounter < this.reconnectionTry) {
                    if (this.currentMovieProgressFirst === true) {
                        this.firstElapsedMovie = time;
                        this.currentChapterSelector[0] = 0;
                        this.reconnectionCounter += 1;
                        this.sending([this.query('MTR')]);
                        this.sending([this.query('CHAPTER NUMBER')]);
                    }
                    if (this.currentMovieProgressFirst === false) {
                        this.newChapter(chapter);
                        this.newMovieTime(time);
                        if (this.movieType === 'C') {
                            this.chapterElapsedFirst = this.firstElapsedMovie;
                            this.chapterRemainingFirst = this.movieRemaining;
                            this.newChapterTime(time);
                        }
                    }
                    if (this.chapterCounter >= this.chapterUpdateSec) {
                        setTimeout(() => {
                            this.sending([this.query('CHAPTER TIME ELAPSED')]);
                        }, 600);
                        this.chapterCounter = 0;
                    }
                }
                if (this.reconnectionCounter >= this.reconnectionTry) {
                    this.newChapter(chapter);
                    this.newMovieTime(time);
                    this.chapterElapsedFirst = this.firstElapsedMovie;
                    this.chapterRemainingFirst = this.movieRemaining;
                    this.newChapterTime(time);
                    if (this.firstHttp === true) {
                        this.sending([this.query('POWER STATUS')]);
                        this.firstHttp = false;
                    }
                }
            }
            else if (res[i].includes('QCR OK')) {
                this.platform.log(`Response: ${res[i]}`);
                this.resetCounter();
                if (this.chapterFirstUpdate === true) {
                    this.chapterRemainingFirst = this.timeToSeconds(this.justNumber(res[i]));
                }
            }
            else if (res[i].includes('QCE OK')) {
                this.platform.log.debug(`Response: ${res[i]}`);
                this.resetCounter();
                if (this.chapterFirstUpdate === true) {
                    this.chapterElapsedFirst = this.timeToSeconds(this.justNumber(res[i]));
                    setTimeout(() => {
                        this.sending([this.query('POWER STATUS')]);
                    }, 300);
                    this.chapterFirstUpdate = false;
                }
                if (this.chapterFirstUpdate === false) {
                    this.newChapterTime(this.timeToSeconds(this.justNumber(res[i])));
                }
            }
            else if (res[i].includes('QRE OK')) {
                this.platform.log(`Response: ${res[i]}`);
                this.currentMovieProgressFirst = false;
                this.movieRemaining = this.timeToSeconds(this.justNumber(res[i]));
            }
            else if (res[i].includes('QCH OK')) {
                this.resetCounter();
                this.platform.log(`Response: ${res[i]}`);
                let numberArray = this.justNumber(res[i]).split('/')
                let number = parseInt(numberArray[0])
                this.currentChapterSelector[1] = parseInt(numberArray[1])
                this.newChapter(number);
                this.sending([this.query('MEDIA TIME REMAINING')]);
            }
            ////////////////Volume state update///////////////////////////////////////////////////////////
            else if (res[i].includes('UVL')) {
                if (res[i].includes('UMT')) {
                    if (this.powerState === false) {
                        this.newVolumeStatus(0);
                    }
                    else {
                        this.platform.log.debug(`Response: Unmuted (UVL)`);
                        this.newVolumeStatus(this.targetVolume);
                    }
                }
                else if (!res[i].includes('MUT')) {
                    let numberOnly = res[i].replace(/^\D+/g, '');
                    this.newVolumeStatus(parseInt(numberOnly, 10));
                    this.targetVolume = numberOnly;
                    if (this.powerState === true) {
                        this.platform.log(`Response: Volume Level set to ${numberOnly} (UVL)`);
                    }
                }
                else {
                    this.platform.log(`Response: Muted (UVL)`);
                    this.newVolumeStatus(0);
                }
            }
            else if (res[i].includes('QVL OK')) {
                this.platform.log(`Response: ${this.commandName(res[i])}`);
                if (res[i].includes('UMT')) {
                    this.newVolumeStatus(this.targetVolume);
                    this.resetCounter();
                }
                else if (!res[i].includes('MUT')) {
                    let numberOnly = res[i].replace(/^\D+/g, '');
                    this.newVolumeStatus(parseInt(numberOnly, 10));
                    this.targetVolume = numberOnly;
                    this.resetCounter();
                }
                else {
                    this.newVolumeStatus(0);
                    this.resetCounter();
                }
                if (this.commandChain === true) {
                    this.platform.log("Second chain response received")
                    this.sending([this.query('PLAYBACK STATUS')]);
                }
            }
            else if (res[i].includes('SVL OK')) {
                if (res[i].includes('MUTE')) {
                    this.platform.log(`Response: Mute Executed (SVL)`);
                    this.newVolumeStatus(0);
                    this.resetCounter();
                }
                else {
                    let numberOnly = res[i].replace(/^\D+/g, '')
                    this.platform.log(`Response: Volume set to ${numberOnly} (SVL)`);
                    this.newVolumeStatus(parseInt(numberOnly, 10));
                    this.targetVolume = numberOnly;
                    this.resetCounter();
                }
            }

            //////Playback update/////////////////////////////////////////////////////////////
            else if (res[i].includes('OK PLAY') || res[i].includes('PLA OK')) {
                this.platform.log(`Response: Play Executed (OK)`);
                this.resetCounter();
                this.newPlayBackState([true, false, false]);
                this.sending([this.query('MTR')]);
                if (this.commandChain === true) {
                    this.platform.log("Third chain response received")
                    this.commandChain = false;
                }
                if (this.inputName === 'Blu-ray') {
                    this.sending([this.query('MEDIA NAME')]);
                }
                if (this.config.mediaAudioVideoState === true) {
                    setTimeout(() => {
                        this.sending([this.query('HDR STATUS')]);
                    }, 2000);
                    if (this.audioType[0] === false && this.audioType[1] === false) {
                        this.sending([this.query('AUDIO TYPE')]);
                    }
                }
            }
            else if (res[i].includes('UPL PLAY')) {
                this.newPowerState(true);
                this.platform.log(`Response: Play Executed (UPL)`);
                this.newPlayBackState([true, false, false]);
                this.sending([this.query('MTR')]);
                if (this.inputName === 'Blu-ray') {
                    this.sending([this.query('MEDIA NAME')]);
                }
                if (this.config.mediaAudioVideoState === true) {
                    setTimeout(() => {
                        this.sending([this.query('HDR STATUS')]);
                    }, 2000);
                    if (this.audioType[0] === false && this.audioType[1] === false) {
                        this.sending([this.query('AUDIO TYPE')]);
                    }
                }
            }
            else if (res[i].includes('UPL HTTP PLAY')) {
                this.newPowerState(true);
                this.platform.log(`Response: Play Executed by HTTP`);
                this.newPlayBackState([true, false, false]);
                this.sending([this.query('MTR')]);
                if (this.inputName === 'Blu-ray') {
                    this.sending([this.query('MEDIA NAME')]);
                }
                if (this.config.mediaAudioVideoState === true) {
                    if (this.audioType[0] === false && this.audioType[1] === false) {
                        this.sending([this.query('AUDIO TYPE')]);
                    }
                    if (this.HDROutput[0] === false && this.HDROutput[1] === false) {
                        this.sending([this.query('HDR STATUS')]);
                    }
                }
            }
            else if (res[i].includes('OK PAUSE') || res[i].includes('PAU OK')) {
                this.platform.log(`Response: Pause Executed`);
                this.resetCounter();
                this.newPlayBackState([false, true, false]);
                if (this.commandChain === true) {
                    this.platform.log("Third chain response received")
                    this.commandChain = false;
                    this.sending([this.query('HDR STATUS')]);
                }
            }
            else if (res[i].includes('UPL PAUS')) {
                this.platform.log(`Response: Pause Executed (UPL)`);
                this.newPlayBackState([false, true, false]);
            }
            else if (res[i].includes('UPL HTTP PAUS')) {
                this.platform.log(`Response: Pause Executed by HTTP`);
                this.newPlayBackState([false, true, false]);
            }
            else if (res[i].includes('OK STOP') || res[i].includes('STP OK')) {
                this.platform.log(`Response: Stop Executed`);
                this.resetCounter();
                this.newPlayBackState([false, false, false]);
                this.newAudioType([false, false]);
                this.newHDRState([false, false, true]);
                this.newInputName('Blu-ray');
                this.movieChapterDefault();
                if (this.commandChain === true) {
                    this.platform.log("Third chain response received")
                    this.commandChain = false;
                    this.sending([this.query('HDR STATUS')]);
                }
            }
            else if (res[i].includes('UPL STOP')) {
                this.platform.log(`Response: Stop Executed (UPL)`);
                this.newPlayBackState([false, false, false]);
                this.newAudioType([false, false]);
                this.newHDRState([false, false, true]);
                this.newInputName('Blu-ray');
                this.movieChapterDefault();
            }
            else if (res[i].includes('UPL HTTP STOP')) {
                if (this.powerState === true) {
                    this.platform.log(`Response: Stop Executed by HTTP`);
                    this.newHDRState([false, false, true]);
                }
                this.newPlayBackState([false, false, false]);
                this.newAudioType([false, false]);
                this.newInputName('Blu-ray');
                this.movieChapterDefault();
            }
            else if (res[i].includes('UPL STPF') || res[i].includes('UPL STPR') || res[i].includes('UPL FFW1') || res[i].includes('UPL FRV1')
                || res[i].includes('UPL SFW1') || res[i].includes('UPL SRV1') || res[i].includes('UPL MCTR') || res[i].includes('UPL MENUP')) {
                this.newPlayBackState([false, false, false]);
                this.platform.log(`Response: ${this.commandName(res[i])}`);
            }
            else if (res[i].includes('OK STEP') || res[i].includes('OK FREV') || res[i].includes('OK FFWD') || res[i].includes('OK SFWD')
                || res[i].includes('OK SREV') || res[i].includes('ER OVERTIME') || res[i].includes('OK MEDIA') || res[i].includes('OK SETUP')
                || res[i].includes('OK SCREEN') || res[i].includes('OK DISC')) {
                this.resetCounter();
                this.newPlayBackState([false, false, false]);
                this.platform.log(`Response: ${this.commandName(res[i])}`);
                if (this.commandChain === true) {
                    this.platform.log("Third chain response received")
                    this.commandChain = false;
                    this.sending([this.query('HDR STATUS')]);
                }
            }
            else if (res[i].includes('HOME MENU') || res[i].includes('UPL HOME')) {
                this.platform.log(`Response: ${this.commandName(res[i])}`);
                if (res[i].includes('HOME MENU')) {
                    this.resetCounter();
                }
                this.newPowerState(true);
                this.newPlayBackState([false, false, false]);
                this.newHDRState([false, false, true]);
                this.newAudioType([false, false]);
                this.newInputName('Blu-ray');
                this.movieChapterDefault();
                if (this.currentVolume === 0) {
                    if (this.commandChain === false) {
                        this.sending([this.query('VOLUME STATUS')]);
                    }
                }
            }
            ///////////////////Video and sound update///////////////////////////////////////////////////
            else if (res[i].includes('U3D 2D') || res[i].includes('U3D 3D')) {
                this.platform.log(`Response: Video playing in ${res[i].substring(4)}`);
                this.currentMovieProgressFirst = true;
                this.chapterFirstUpdate = true;
                if (this.reconnectionCounter < this.reconnectionTry) {
                    if (this.commandChain === false) {
                        this.commandChain = true;
                        this.sending([this.pressedButton('RESET')]);
                        setTimeout(() => {
                            this.sending([this.query('INPUT STATUS')]);
                        }, 200);
                        this.platform.log("Chain of Commands Started");
                        this.resetCommandChain();
                    }
                    else {
                        this.platform.log("Chain of command not finished yet")
                    }
                }
                if (this.reconnectionCounter >= this.reconnectionTry) {
                    this.sending([this.query('PLAYBACK STATUS')]);
                }
            }
            else if (res[i].includes('OK HDR')) {
                this.platform.log(`Response: HDR Video`);
                this.updateHDRStatus([false, true, false]);
            }
            else if (res[i].includes('OK SDR')) {
                this.platform.log(`Response: SDR Video`);
                this.updateHDRStatus([false, false, true]);
            }
            else if (res[i].includes('OK DOV')) {
                this.platform.log(`Response: Dolby Vision Video`);
                this.updateHDRStatus([true, false, false]);
            }
            ////////////////Input Update/////////////////////////////////////////////////////////
            else if (res[i].includes('BD-PLAYER')) {
                this.updateInputStatus([true, false, false, false, false, false], res[i]);
            }
            else if (res[i].includes('HDMI-IN')) {
                this.updateInputStatus([false, true, false, false, false, false], res[i]);
            }
            else if (res[i].includes('ARC-HDMI-OUT')) {
                this.updateInputStatus([false, false, true, false, false, false], res[i]);
            }
            else if (res[i].includes('OPTICAL')) {
                this.updateInputStatus([false, false, false, true, false, false], res[i]);
            }
            else if (res[i].includes('COAXIAL')) {
                this.updateInputStatus([false, false, false, false, true, false], res[i]);
            }
            else if (res[i].includes('USB-AUDIO')) {
                this.updateInputStatus([false, false, false, false, false, true], res[i]);
            }
            /////////////////Sound update/////////////////////////////////Dolby TrueHD
            else if (res[i].includes('UAT DT') || res[i].includes('Dolby TrueHD')) {
                this.platform.log(`Response: Dolby Atmos Sound`);
                this.newAudioType([true, false]);

            }
            else if (res[i].includes('UAT TM') || res[i].includes('UAT TH') || res[i].includes('UAT TS')
                || res[i].includes('OK DTS') || res[i].includes('OK DTS-HD') || res[i].includes('OK TS')
                || res[i].includes('DTS')) {
                this.platform.log(`Response: DTS Sound`);
                this.newAudioType([false, true]);

            }
            else if (res[i].includes('UAT DP') || res[i].includes('Dolby Digital Plus')) {
                this.platform.log(`Response: Dolby Atmos Sound`);
                this.newAudioType([true, false]);

            }
            else if (res[i].includes('UAT DD') || res[i].includes('UAT TS') || res[i].includes('UAT TH')
                || res[i].includes('UAT PC') || res[i].includes('UAT PC') || res[i].includes('OK TS')
                || res[i].includes('UAT MP') || res[i].includes('UAT CD') || res[i].includes('UAT UN')
                || res[i].includes('OK TH') || res[i].includes('OK PC') || res[i].includes('OK PC')
                || res[i].includes('OK MP') || res[i].includes('OK CD') || res[i].includes('OK UN') || res[i].includes('OK LPCM')) {
                this.platform.log(`Response: ${this.commandName(res[i])}, Sound: ${res[i]}`);
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
            i += 1;
        }
    }
    ///Query////////////////////////////////////////////////////////////////////////////////////////////////////
    queryKeys(buttons) {
        buttons.length;
        let keys = [''];
        let i = 0;
        while (i < buttons.length) {
            keys[i] = this.query(buttons[i]);
            i += 1;
        }
        return keys;
    }
    query(qName) {
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
            case 'INPUT STATUS':
                key += 'QIS';
                break;
            case 'VOLUME STATUS':
                key += 'QVL';
                break;
            case "MEDIA NAME":
                key += "QFN";
                break;
            case "CHAPTER NUMBER":
                key += "QCH";
                break;
            case "CHAPTER TIME REMAINING":
                key += "QCR";
                break;
            case "CHAPTER TIME ELAPSED":
                key += "QCE";
                break;
            case "MEDIA TIME ELAPSED":
                key += "QEL";
                break;
            case "MEDIA TIME REMAINING":
                key += "QRE";
                break;
            case "MTR":
                key += "MTR";
                break;
            case "FIRMWARE":
                key += "QVR";
                break;
        }
        key += '\r\n';
        return key;
    }
    //////////Sending Command Dame Decoder///////////
    commandName(keyS) {
        let keySent = '';
        if (keyS.includes('PON')) {
            keySent = 'Power On';
        }
        else if (keyS.includes('POF')) {
            keySent = 'Power Off';
        }
        else if (keyS.includes('SVM 2')) {
            keySent = 'Verbose Mode 2';
        }
        else if (keyS.includes('SVM 3')) {
            keySent = 'Verbose Mode 3';
        }
        else if (keyS.includes('EJT')) {
            if (this.config.chinoppo === false) {
                keySent = 'Eject/Open';
            }
            else {
                keySent = 'Power On';
            }
        }
        else if (keyS.includes('NUP')) {
            keySent = 'Cursor Up';
        }
        else if (keyS.includes('NDN')) {
            keySent = 'Cursor Down';
        }
        else if (keyS.includes('NLT')) {
            keySent = 'Cursor Left';
        }
        else if (keyS.includes('NRT')) {
            keySent = 'Cursor Right';
        }
        else if (keyS.includes('SEL')) {
            keySent = 'Enter';
        }
        else if (keyS.includes('MNU')) {
            keySent = 'Menu';
        }
        else if (keyS.includes('RET')) {
            keySent = 'Back';
        }
        else if (keyS.includes('PAU')) {
            keySent = 'Pause';
        }
        else if (keyS.includes('STP')) {
            keySent = 'Stop';
        }
        else if (keyS.includes('PRE')) {
            keySent = 'Previous Chapter';
        }
        else if (keyS.includes('NXT')) {
            keySent = 'Next Chapter';
        }
        else if (keyS.includes('CLR')) {
            keySent = 'Clear';
        }
        else if (keyS.includes('TTL')) {
            keySent = 'Top Menu';
        }
        else if (keyS.includes('OPT')) {
            keySent = 'Option';
        }
        else if (keyS.includes('DISC MENU')) {
            keySent = 'Disc Menu Screen';
        }
        else if (keyS.includes('MEDIA CENTER')) {
            keySent = 'Media Center Screen';
        }
        else if (keyS.includes('HOME MENU') || keyS.includes('UPL HOME')) {
            keySent = 'Home Menu Screen';
        }
        else if (keyS.includes('HOM')) {
            keySent = 'Home Menu';
        }
        else if (keyS.includes('OSD')) {
            keySent = 'Information';
        }
        else if (keyS.includes('SET')) {
            keySent = 'Setup';
        }
        else if (keyS.includes('REV')) {
            keySent = 'Rewind';
        }
        else if (keyS.includes('FWD')) {
            keySent = 'Forward';
        }
        else if (keyS.includes('SIS 0') || keyS.includes('SIS OK 0') || keyS.includes('QIS OK 0')) {
            keySent = 'Bluray Input';
        }
        else if (keyS.includes('SIS 1') || keyS.includes('SIS OK 1') || keyS.includes('QIS OK 1')) {
            keySent = 'HDMI In';
        }
        else if (keyS.includes('SIS 2') || keyS.includes('SIS OK 2') || keyS.includes('QIS OK 2')) {
            keySent = 'HDMI Out';
        }
        else if (keyS.includes('SIS 3') || keyS.includes('SIS OK 3') || keyS.includes('QIS OK 3')) {
            keySent = 'Optical In';
        }
        else if (keyS.includes('SIS 4') || keyS.includes('SIS OK 4') || keyS.includes('QIS OK 4')) {
            keySent = 'Coaxial In';
        }
        else if (keyS.includes('SIS 5') || keyS.includes('SIS OK 5') || keyS.includes('QIS OK ')) {
            keySent = 'USB Audio In';
        }
        else if (keyS.includes('DIM')) {
            keySent = 'Dimmer';
        }
        else if (keyS.includes('PUR')) {
            keySent = 'Pure Audio';
        }
        else if (keyS.includes('GOT')) {
            keySent = 'Go To';
        }
        else if (keyS.includes('PUP')) {
            keySent = 'Page Up';
        }
        else if (keyS.includes('PDN')) {
            keySent = 'Page Down';
        }
        else if (keyS.includes('MNU')) {
            keySent = 'Pop-Up Menu';
        }
        else if (keyS.includes('RED')) {
            keySent = 'Red';
        }
        else if (keyS.includes('GRN')) {
            keySent = 'Green';
        }
        else if (keyS.includes('BLU')) {
            keySent = 'Blue';
        }
        else if (keyS.includes('YLW')) {
            keySent = 'Yellow';
        }
        else if (keyS.includes('AUD')) {
            keySent = 'Audio';
        }
        else if (keyS.includes('SUB')) {
            keySent = 'Subtitle';
        }
        else if (keyS.includes('ANG')) {
            keySent = 'Angle';
        }
        else if (keyS.includes('ZOM')) {
            keySent = 'Zoom';
        }
        else if (keyS.includes('SAP')) {
            keySent = 'SAP';
        }
        else if (keyS.includes('ATB')) {
            keySent = 'AB Replay';
        }
        else if (keyS.includes('RPT')) {
            keySent = 'Repeat';
        }
        else if (keyS.includes('PIP')) {
            keySent = 'PIP';
        }
        else if (keyS.includes('HDM')) {
            keySent = 'Resolution';
        }
        else if (keyS.includes('M3D')) {
            keySent = '3D';
        }
        else if (keyS.includes('SEH')) {
            keySent = 'Picture';
        }
        else if (keyS.includes('HDR')) {
            keySent = 'HDR';
        }
        else if (keyS.includes('SUH')) {
            keySent = 'Subtitle (Hold)';
        }
        else if (keyS.includes('INH')) {
            keySent = 'Information (Hold)';
        }
        else if (keyS.includes('RLH')) {
            keySent = 'Resolution (Hold)';
        }
        else if (keyS.includes('AVS')) {
            keySent = 'AV Sync';
        }
        else if (keyS.includes('GPA')) {
            keySent = 'Gapless Play';
        }
        else if (keyS.includes('SRC')) {
            keySent = 'Input';
        }
        else if (keyS.includes('VUP')) {
            keySent = 'Volume Up';
        }
        else if (keyS.includes('VDN')) {
            keySent = 'Volume Down';
        }
        else if (keyS.includes('STC T')) {
            keySent = 'Elapse Time';
        }
        else if (keyS.includes('RST')) {
            keySent = 'Reset Command Queue';
        }
        else if (keyS.includes('QVM')) {
            keySent = 'Verbose Mode Status Query';
        }
        else if (keyS.includes('UPL SCSV')) {
            keySent = 'Screen Saver On';
        }
        else if (keyS.includes('USB IN')) {
            keySent = 'USB Connected';
        }
        else if (keyS.includes('USB OU')) {
            keySent = 'USB Disconnected';
        }
        else if (keyS.includes('QPW')) {
            keySent = 'Power Status Query';
        }
        else if (keyS.includes('QHD')) {
            keySent = 'Current Resolution Query';
        }
        else if (keyS.includes('QPL')) {
            keySent = 'Playback Status Query';
        }
        else if (keyS.includes('QAT')) {
            keySent = 'Audio Type Query';
        }
        else if (keyS.includes('QHS')) {
            keySent = 'HDR Status Query';
        }
        else if (keyS.includes('QIS')) {
            keySent = 'Input Status Query';
        }
        else if (keyS.includes('PLA')) {
            keySent = 'Play';
        }
        else if (keyS.includes('QVL')) {
            keySent = 'Volume Status Query';
        }
        else if (keyS.includes('QFN')) {
            keySent = 'Media Name Query';
        }
        else if (keyS.includes('QCH')) {
            keySent = 'Chapter Number Query';
        }
        else if (keyS.includes('QCR')) {
            keySent = 'Chapter Time Remaining Query';
        }
        else if (keyS.includes('QCE')) {
            keySent = 'Chapter Time Elapsed Query';
        }
        else if (keyS.includes('QEL')) {
            keySent = 'Media Time Elapsed Query';
        }
        else if (keyS.includes('QRE') || keyS.includes('MTR')) {
            keySent = 'Media Time Remaining Query';
        }
        else if (keyS.includes('QVR')) {
            keySent = 'Firmware Query';
        }
        else {
            keySent = keyS;
            keySent += ' Executed';
            return keySent
        }
        if (keyS.includes('OK')) {
            keySent += ' Executed';
        }
        else if (keyS.includes('INVALID')) {
            keySent += ' Invalid Command';
        }
        else if (keyS.includes('DISC MENU') || keyS.includes('MEDIA CENTER') || keyS.includes('UPL HOME')
            || keyS.includes('HOME MENU') || keyS.includes('USB IN') || keyS.includes('USB OU')) {
        }
        else {
            keySent += ' Command';
        }
        return keySent
    }
    /////oppo controls/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    pressedButton(name) {
        let key;
        key = '#';
        switch (name) {
            //POWER ButtonGroup
            case 'POWER ON':
                if (this.config.chinoppo === false) {
                    key += 'PON';
                }
                if (this.config.chinoppo === true) {
                    key += 'EJT';
                }
                break;
            case 'POWER OFF':
                key += 'POF';
                break;
            case 'VERBOSE MODE 2':
                key += 'SVM 2';
                break;
            case 'VERBOSE MODE 3':
                key += 'SVM 3';
                break;
            case 'EJECT':
                key += 'EJT';
                break;
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
            case 'MENU':
                key += 'MNU';
                break;
            case 'BACK':
                key += 'RET';
                break;
            case 'PLAY':
                key += 'PLA';
                break;
            case 'PAUSE':
                key += 'PAU';
                break;
            case 'STOP':
                key += 'STP';
                break;
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
            case 'HOME MENU':
                key += 'HOM';
                break;
            case 'INFO':
                key += 'OSD';
                break;
            case 'SETUP':
                key += 'SET';
                break;
            case 'REWIND':
                key += 'REV';
                break;
            case 'FORWAD':
                key += 'FWD';
                break;
            case 'BLURAY INPUT':
                key += 'SIS 0';
                break;
            case 'HDMI IN':
                key += 'SIS 1';
                break;
            case 'HDMI OUT':
                key += 'SIS 2';
                break;
            case 'OPTICAL INPUT':
                key += 'SIS 3';
                break;
            case 'COAXIAL INPUT':
                key += 'SIS 4';
                break;
            case 'USB AUDIO INPUT':
                key += 'SIS 5';
                break;
            case 'DIMMER':
                key += 'DIM';
                break;
            case 'PURE AUDIO':
                key += 'PUR';
                break;
            case 'GO TO':
                key += 'GOT';
                break;
            case 'PAGE UP':
                key += 'PUP';
                break;
            case 'PAGE DOWN':
                key += 'PDN';
                break;
            case 'POP-UP MENU':
                key += 'MNU';
                break;
            case 'RED':
                key += 'RED';
                break;
            case 'GREEN':
                key += 'GRN';
                break;
            case 'BLUE':
                key += 'BLU';
                break;
            case 'YELLOW':
                key += 'YLW';
                break;
            case 'AUDIO':
                key += 'AUD';
                break;
            case 'SUBTITLE':
                key += 'SUB';
                break;
            case 'ANGLE':
                key += 'ANG';
                break;
            case 'ZOOM':
                key += 'ZOM';
                break;
            case 'SAP':
                key += 'SAP';
                break;
            case 'AB REPLAY':
                key += 'ATB';
                break;
            case 'REPEAT':
                key += 'RPT';
                break;
            case 'PIP':
                key += 'PIP';
                break;
            case 'RESOLUTION':
                key += 'HDM';
                break;
            case 'OPTION':
                key += 'OPT';
                break;
            case '3D':
                key += 'M3D';
                break;
            case 'PIC':
                key += 'SEH';
                break;
            case 'HDR':
                key += 'HDR';
                break;
            case 'SUBTITTLE (HOLD)':
                key += 'SUH';
                break;
            case 'INFO (HOLD)':
                key += 'INH';
                break;
            case 'RESOLUTION (HOLD)':
                key += 'RLH';
                break;
            case 'AV SYNC':
                key += 'AVS';
                break;
            case 'GAPLESS PLAY':
                key += 'GPA';
                break;
            case 'INPUT':
                key += 'SRC';
                break;
            case 'VOLUME UP':
                key += 'VUP';
                break;
            case 'VOLUME DOWN':
                key += 'VDN';
                break;
            case 'ELAPTSED TIME':
                key += 'STC T';
                break;
            case 'RESET':
                key += 'RST';
                break;
        }
        key += '\r\n';
        return key;
    }
    /////////Data Management/////////////////////////////////////////////////////////////
    resetCommandChain() {
        setTimeout(() => {
            this.commandChain = false;
        }, 3000);
    }
    keyReset() {
        setTimeout(() => {
            this.key = this.query('VERBOSE MODE');
        }, 1000)
    }
    timeToSeconds(hms) {
        let a = hms.split(':');
        let seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
        return seconds;
    }

    justNumber(number) {
        let timeDate = number.replace(/^\D+/g, '')
        return timeDate
    }
    secondsToTime(seconds) {
        let date = new Date(0);
        date.setSeconds(parseInt(seconds)); // specify value for SECONDS here
        let timeString = date.toISOString().substr(11, 8);
        return timeString
    }
    /////Volume, chapter, Movie time change //////////////////////////////////////////////
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
    chapterChange(number) {
        let key;
        key = '#SRH C';
        key += number.toString();
        key += '\r\n';
        return key;
    }
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
    resetCounter() {
        this.reconnectionCounter = 0;
        this.connectionLimit = false;
        this.connectionLimitStatus = 0;
        this.newResponse = '';
        this.firstHttp = true;
    }
    updateAll() {
        let queryAll = ['POWER STATUS', 'PLAYBACK STATUS', 'HDR STATUS', 'AUDIO TYPE'];
        let KEYS = this.queryKeys(queryAll);
        return KEYS;
    }
    updateInputStatus(newInput, response) {
        this.platform.log(`Response: ${this.commandName(response)}`);
        this.newInputState(newInput);
        if (this.commandChain === true) {
            this.platform.log("First chain response received")
            this.sending([this.query('VOLUME STATUS')]);
        }
    }
    updateHDRStatus(newHDR) {
        this.resetCounter();
        this.newHDRState(newHDR);
        this.firstConnection = false;
        this.commandChain = false;
        if (this.config.mediaAudioVideoState === true) {
            if (this.audioType[0] === false && this.audioType[1] === false && this.playBackState[0] === true) {
                this.sending([this.query('AUDIO TYPE')]);
            }
        }
    }
    movieChapterDefault() {
        if (this.config.movieControl === true) {
            this.currentMovieProgressFirst = true;
            this.newMovieTime(0);
        }
        if (this.config.chapterControl === true) {
            this.chapterFirstUpdate = true;
            this.newChapterTime(0);
        }
        if (this.config.chapterSelector === true) {
            this.chapterFirstUpdate = true;
            this.newChapter(0);
        }
    }
    turnOffAll() {
        this.newPowerState(false);
        this.newHDRState([false, false, false]);
        this.newPlayBackState([false, false, false]);
        this.newAudioType([false, false]);
        this.newInputState([false, false, false, false, false, false]);
        this.newVolumeStatus(0);
        this.newInputName('Blu-ray');
        this.movieChapterDefault();
    }
}
