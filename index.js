"use strict";
const PLATFORM_NAME = 'oppoPlugin';
const PLUGIN_NAME = 'homebridge-oppo-udp';
const net = require("net");
const OPPO_PORT = 23;
const timeout = 2000;

class oppoAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        this.config = platform.config;
        this.OPPO_IP = this.config.ip;


        //////Initial Switch and sensors state///////////////////////////////////////////////////////////////////////////////////////////////
        this.powerState = false;
        this.playBackState = [false, false, false];
        this.inputState = [false, false, false];
        this.HDROutput = [false, false, false];
        this.audioType = [false, false];
        this.powerState_TV = 0;
        this.currentVolume = 0;
        this.currentMuteState = false;
        this.currentVolumeSwitch = false;
        this.inputID = 1;
        this.mediaState = 3;
        this.turnOffAllUsed = false;
        this.videoState = false;
        this.audioState = false;
        this.inputName='Blu-ray';

        /////MovieConstants

        this.currentMovieProgress = 0;
        this.currentChapterSelector = [0, 0];
        this.currentChapterTime = 0;
        this.currentChapterTimeState = false;
        this.currentChapterSelectorState = false;
        this.currentMovieProgressState = false;
        this.movieElapsed = 0;
        this.movieRemaining = 0;
        this.chapterRemaining = 0;
        this.currentMovieProgressFirst = true;
        this.chapterFirstUpdate = true;
        this.chapterRemainingFirst = 0;
        this.chapterElapsedFirst = 0;
        this.chapterCounter = 0;
        this.chapterUpdateSec = 5;
        ////Connection parameters
        this.reconnectionCounter = 0;
        this.reconnectionTry = 100;
        this.connectionLimit = false;
        this.recoonectionWait = 10000;
        this.firstConnection = false;

        //Device Information//////////////////////////////////////////////////////////////////////////////////////

        this.config.name = platform.config.name || 'Oppo 203';
        this.config.ip = platform.config.ip;
        this.config.manufacture = platform.config.manufacture || 'Oppo';
        this.config.pollingInterval = platform.config.pollingInterval || 1000;
        this.config.modelName = platform.config.modelName || 'UDP-203';
        this.config.serialN = platform.config.serialN || 'B210U71647033894';
        this.config.inputButtons = platform.config.inputButtons || false;
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
        ////Checking if the necessary information was given by the user////////////////////////////////////////////////////
        try {
            if (!this.config.ip) {
                throw new Error(`Oppo ip address is required for ${this.config.name}`);
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
                    this.sending([this.pressedButton('POWER ON')]);
                    //this.newPowerState(true);
                }
                else if (newValue === 0) {
                    this.sending([this.pressedButton('POWER OFF')]);
                    //this.newPowerState(false);
                }
                else {
                    //
                }
                callback(null);
            });

        this.tvService.getCharacteristic(this.platform.Characteristic.RemoteKey)
            .on('set', (newValue, callback) => {
                switch (newValue) {
                    case this.platform.Characteristic.RemoteKey.REWIND: {
                        this.platform.log.debug('set Remote Key Pressed: REWIND');
                        this.sending([this.pressedButton('REWIND')]);
                        //this.newPlayBackState([false,false,false]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
                        this.platform.log.debug('set Remote Key Pressed: FAST_FORWARD');
                        this.sending([this.pressedButton('FORWARD')]);
                        //this.newPlayBackState([false,false,false]);
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
                            //this.newPlayBackState([true,false,false]);
                        }
                        else if (this.playBackState[0] === true) {
                            this.sending([this.pressedButton('PAUSE')]);
                            //this.newPlayBackState([false,true,false]);
                        }
                        else {
                            //
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
                    this.newInputState([false, false, false]);
                }
                if (inputIdentifier === 0) {
                    this.newInputState([false, false, false]);
                }
                else if (inputIdentifier === 1) {
                    this.sending([this.pressedButton('BLURAY INPUT')]);
                    //this.newInputState([true, false, false]);
                }
                else if (inputIdentifier === 2) {
                    this.sending([this.pressedButton('HDMI IN')]);
                    //this.newInputState([false, true, false]);
                }
                else if (inputIdentifier === 3) {
                    this.sending([this.pressedButton('HDMI OUT')]);
                    //this.newInputState([false, false, true]);
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
                    let currentValue = this.newInputName;
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
                if (this.mediaState === 3) {
                    currentValue = 0;
                }
                this.platform.log.debug('Current Playback State', currentValue);

                callback(null, currentValue);
            })
            .on('set', (value, callback) => {

                if (value === 0) {
                    this.sending([this.pressedButton('PLAY')]);
                    //this.newPlayBackState([true, false, false])
                }
                else if (value === 1) {
                    this.sending([this.pressedButton('PAUSE')]);
                    //this.newPlayBackState([false, true, false])
                }
                else if (value === 2) {
                    this.sending([this.pressedButton('STOP')]);
                    //this.newPlayBackState([false, false, true])

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
                this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                callback(null);
            });
        this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
            .on('get', (callback) => {
                let currentValue = false;
                if (this.currentVolume === 0) {
                    currentValue = true;
                }
                if (this.currentVolume != 0) {
                    currentValue = false;
                }
                callback(null, currentValue);

            })
            .on('set', (newValue, callback) => {
                let newVolume = 100;
                if (newValue === false) {
                    this.sending([this.volumeChange(newVolume)]);
                }
                if (newValue === true) {
                    newVolume = 0;
                    this.sending([this.volumeChange(newVolume)]);
                }
                this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                //this.newVolumeState(newVolume);
                callback(null);
            });
        this.speakerService.addCharacteristic(this.platform.Characteristic.Volume)
            .on('get', (callback) => {
                let currentValue = this.currentVolume;

                callback(null, currentValue);

            })
            .on('set', (newValue, callback) => {
                this.sending([this.volumeChange(newValue)]);
                this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                // this.newVolumeState(newValue);
                callback(null);
            });


        this.tvService.addLinkedService(this.speakerService);

        /////Video/Movie Controls/////////////////////////////////////////////////////////////////////

        if (this.config.movieControl === true) {
            this.movieControlL = this.accessory.getService('Movie Progress') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Movie Progress', 'YourUniqueIdentifier-301');
            this.movieControlL.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = this.currentMovieProgressState;

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {

                    this.platform.log('set Movie Control => setNewValue: ' + newValue);
                    callback(null);
                });
            this.movieControlL.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentMovieProgressState;

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {
                    let newSendValue = Math.round(newValue * (this.firstElapsedMovie + this.movieRemaining) / 100);
                    if (newSendValue > 100) { newSendValue = 100; }
                    this.sending([this.movieTime(this.secondsToTime(newSendValue))]);
                    this.platform.log('set Movie Control => setNewValue: ' + newValue);
                    callback(null);
                });

            this.chapterSelectorL = this.accessory.getService('Chapter Number') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Chapter Number', 'YourUniqueIdentifier-302');
            this.chapterSelectorL.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = true;
                    if (this.currentChapterSelector[0] === 0) {
                        currentValue = false;
                    }

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {

                    this.platform.log('set Chapter Selector => setNewValue: ' + newValue);
                    callback(null);
                });
            this.chapterSelectorL.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentChapterSelector[0];

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {
                    if (newValue > this.currentChapterSelector[1]) {
                        newValue = this.currentChapterSelector[1]
                    }
                    this.sending([this.chapterChange(newValue)]);
                    this.platform.log('set Chapter Selector => setNewValue: ' + newValue);

                    callback(null);
                });

            this.chapterControlL = this.accessory.getService('Chapter Progress') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Chapter Progress', 'YourUniqueIdentifier-303');
            this.chapterControlL.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = true;
                    if (this.currentChapterTime === 0) {
                        currentValue = false
                    }

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {

                    this.platform.log('set Chapter progress => setNewValue: ' + newValue);
                    callback(null);
                });
            this.chapterControlL.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentChapterTime;

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {
                    let newSendValue = Math.round(newValue * (this.chapterElapsedFirst + this.chapterRemainingFirst) / 100);
                    if (newSendValue > 100) { newSendValue = 100; }
                    this.sending([this.chapterTime(this.secondsToTime(newSendValue))]);

                    this.platform.log('set Chapter progress => setNewValue: ' + newValue);
                    callback(null);
                });
        }

        /////////////Addtional Services////////////////////////////////////////////////////////////////////////////////////
        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.oppoDisplayName);
        this.service.getCharacteristic(this.platform.Characteristic.On)
            .on('set', this.setOn.bind(this))
            .on('get', this.getOn.bind(this));
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

        this.dolbyVision = this.accessory.getService('Dolby Vision Video') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Vision Video', 'YourUniqueIdentifier-1');
        this.hdr10 = this.accessory.getService('HDR 10 Video') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'HDR 10 Video', 'YourUniqueIdentifier-2');
        this.SDR = this.accessory.getService('SDR Video') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'SDR Video', 'YourUniqueIdentifier-3');
        this.dolbySound = this.accessory.getService('Dolby Atmos') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Atmos Sound', 'YourUniqueIdentifier-8');
        this.dtsSound = this.accessory.getService('DTS') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'DTS', 'YourUniqueIdentifier-9');


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
                        //this.newInputState([true,false,false]);
                    }
                    else {
                        //
                    }
                    callback(null);
                });

            this.hdmiIn = this.accessory.getService('HDMI In Input') ||
                this.accessory.addService(this.platform.Service.Switch, 'HDMI In Input', 'YourUniqueIdentifier-24');
            this.hdmiIn.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('HDMI In Get State');
                    // set this to a valid value for On
                    let currentValue = this.inputState[1];
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('HDMI in set to:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HDMI IN')]);
                        //this.newInputState([false,true,false]);
                    }
                    else {
                        //
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
                        //this.newInputState([false,false,true]);
                    }
                    else {
                        //
                    }
                    callback(null);
                });

        }

        //////Volume control Service as lightbulb////////////////////////////////////////////////////////////////////////////
        if (this.config.volume === true) {

            this.volumeDimmer = this.accessory.getService('Oppo Volume') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Oppo Volume', 'YourUniqueIdentifier-98');
            this.volumeDimmer.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    let currentValue = true;
                    if (this.currentVolume === 0) {
                        currentValue = false
                    }

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {
                    let newVolume = 100;
                    if (newValue === true) {
                        this.sending([this.volumeChange(newVolume)]);
                    }
                    if (newValue === false) {
                        newVolume = 0;
                        this.sending([this.volumeChange(newVolume)]);
                    }

                    this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                    //this.newVolumeState(newVolume);
                    callback(null);
                });

            this.volumeDimmer.addCharacteristic(new this.platform.Characteristic.Brightness())
                .on('get', (callback) => {
                    let currentValue = this.currentVolume;

                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {
                    this.sending([this.volumeChange(newValue)]);
                    this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                    //this.newVolumeState(newValue);
                    callback(null);
                });
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.cursorUp.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.cursorDown.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.cursorLeft.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.cursorRight.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.cursorEnter.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });
        }
        if (this.config.menuB === true) {
            this.menu = this.accessory.getService('Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Menu', 'YourUniqueIdentifier-36');
            this.menu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('TMenu GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Menu SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('MENU')]);
                    }
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.menu.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.backButton.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.clear.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });
        }
        if (this.config.topMenu === true) {
            this.topMenu = this.accessory.getService('Top Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Top Menu', 'YourUniqueIdentifier-41');
            this.topMenu.getCharacteristic(this.platform.Characteristic.On)
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.topMenu.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.option.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.homeMenu.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.infoButton.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.setup.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.goTo.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.pageUp.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.pageDown.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.popUpMenu.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.previous.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.next.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.rewindButton.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.forwardButton.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.dimmer.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.pureAudio.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.red.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.green.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.blue.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.yellow.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.audio.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.subtitle.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.angle.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.zoom.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.sap.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.abReplay.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.repeat.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.pip.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.resolution.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.threeD.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.picture.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.hdrButton.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else if (value === false) {
                        //
                    }
                    else {
                        //
                    }
                    this.subtitleHold.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.infoHold.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.resolutionHold.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.avSync.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.gaplessPlay.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.input.updateCharacteristic(this.platform.Characteristic.On, false);
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
                    else {
                        //
                    }
                    this.ejectDisc.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


        }
        ///////////////Clean up. Delete services not in used
        ////MovieRemove
        if (this.config.movieControl === false) {
            this.accessory.removeService(this.movieControlL);

            this.accessory.removeService(this.chapterControlL);

            this.accessory.removeService(this.chapterSelectorL);
        }

        if (this.config.inputButtons == false) {

            this.accessory.removeService(this.hdmiIn);
            this.accessory.removeService(this.hdmiOut);
        }
        if (this.config.volume === false) {
            this.accessory.removeService(this.volumeDimmer);


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
        if (this.config.topMenu === false) {
            this.accessory.removeService(this.topMenu);
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
        this.netConnect();

        //syncing//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        setInterval(() => {


            if (this.reconnectionCounter > this.reconnectionTry) {
                this.platform.log.debug("Oppo Not Responding");
            }

            this.service.updateCharacteristic(this.platform.Characteristic.On, this.powerState);
            this.dolbyVision.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[0]);
            this.hdr10.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[1]);
            this.SDR.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[2]);
            this.tvService.updateCharacteristic(this.platform.Characteristic.Active, this.powerState_TV);
            this.play.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[0]);
            this.pause.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[1]);
            this.stop.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[2]);
            this.dolbySound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[0]);
            this.dtsSound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[1]);
            this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier).updateValue(this.inputID);
            this.speakerService.getCharacteristic(this.platform.Characteristic.Volume).updateValue(this.currentVolume);
            this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.mediaState);
            this.speakerService.getCharacteristic(this.platform.Characteristic.Mute).updateValue(this.currentMuteState)
            this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);
            this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Volume, this.currentVolume);
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Mute, this.currentMuteState);
            this.bluRay.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName)
            if (this.config.inputButtons === true) {
                this.bluRayInput.updateCharacteristic(this.platform.Characteristic.On, this.inputState[0]);
                this.hdmiIn.updateCharacteristic(this.platform.Characteristic.On, this.inputState[1]);
                this.hdmiOut.updateCharacteristic(this.platform.Characteristic.On, this.inputState[2]);
            }
            if (this.config.volume === true) {
                this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentVolume);
                this.volumeDimmer.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentVolume);
                this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.On, this.currentVolumeSwitch);
            }
            if (this.config.movieControl === true) {
                this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterSelector[0]);
                this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.On, this.currentChapterSelectorState);
                this.chapterControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterTime);
                this.chapterControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentchapterTimeState);
                this.movieControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentMovieProgress);
                this.movieControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentMovieProgressState);

            }
        }, this.config.pollingInterval);

    }

    //////////////Create Client//////////////////////////////////////////////////////////////////////////

    netConnect() {
        ///First instruction to be sent when the conneciton is made
        this.key = this.query('VERBOSE MODE');


        ////Creating the connection
        this.client = new net.Socket();
        //////Connect to client
        this.client.connect(OPPO_PORT, this.OPPO_IP, () => {
            clearTimeout(timer);
            this.platform.log.debug(`[Sending] ${JSON.stringify(this.key)}`);
            this.client.write(this.key);
            this.firstConnection = true;
        });

        /////Receiving Data
        this.client.on('data', (data) => {
            clearTimeout(timer);
            this.eventDecoder(data);
            if (data.includes("UTC")) {
                this.platform.log.debug(`[Response] ${data}`);
            }
            else if (data.includes("SVM")) {
                this.platform.log.debug(`[Response] ${data}`);
            }
            else if (data.includes("QVM")) {
                this.platform.log.debug(`[Response] ${data}`);
            }
            else if (data.includes("QPW OK OFF")) {
                this.platform.log.debug(`[Response] ${data}`);
            }
            else {
                this.platform.log(`[Response] ${data}`);
            }
        });
        /////Errors
        this.client.on('error', (e) => {
            clearTimeout(timer);
            this.platform.log.debug(`[Error] ${e}`);
            this.platform.log.debug(`[Trying to reconnect after an error] ${e}`);
            this.platform.log.debug('[Error] Turn on the device and check the IP Address');
            // if (this.reconnectionCounter < this.reconnectionTry) {
            setTimeout(() => {
                this.reconnectionCounter += 1;
                this.platform.log(this.reconnectionCounter);
                this.client.connect(OPPO_PORT, this.OPPO_IP, () => {
                    clearTimeout(timer);
                    this.platform.log.debug(`Reconnection try number ${this.reconnectionCounter}`);
                    this.platform.log.debug(`[Sending] ${JSON.stringify(this.key)}`);
                    this.client.write(this.key);
                    this.firstConnection = true;

                });

            }, this.recoonectionWait);
            if (this.reconnectionCounter > 100) {
                if (this.turnOffAllUsed === false) {
                    this.turnOffAll()
                    this.turnOffAllUsed = true;
                }

            }

        });
        ////Connection Closed
        this.client.on('close', () => {
            this.platform.log.debug('Disconnected from server');
            this.reconnectionCounter += 1;
            this.firstConnection = true;
            this.currentMovieProgressFirst = true;
            this.chapterFirstUpdate = true;
            setTimeout(() => {
                this.client.destroy();
                this.client.connect(OPPO_PORT, this.OPPO_IP, () => {
                    clearTimeout(timer);
                    this.platform.log.debug(`[Reconnecting on after connection closed]`);
                    this.platform.log.debug(`Reconnection try number ${this.reconnectionCounter}`);
                    this.client.write(this.key);

                    this.platform.log.debug(`[Sending] ${JSON.stringify(this.key)}`);


                });
            }, this.recoonectionWait);
            if (this.reconnectionCounter > 100) {
                if (this.turnOffAllUsed === false) {
                    this.turnOffAll()
                    this.turnOffAllUsed = true;
                }

            }

        });
        /////Time out Timer
        const timer = setTimeout(() => {
            this.platform.log.debug('[ERROR] Attempt at connection exceeded timeout value');
            // client.destroy();
        }, timeout);

    }

    ///////Handlers////////////////////////////////////////////////////////////////////////////////////////
    setOn(value, callback) {
        let oppoState = value;
        if (oppoState === true) {
            // this.newPowerState(true);
            this.sending([this.pressedButton('POWER ON')]);

        }
        else if (oppoState === false) {
            //this.newPowerState(false);
            this.sending([this.pressedButton('POWER OFF')]);
        }
        else {
            //
        }
        this.platform.log.debug('Set Power to ->', value);

        callback(null);
    }

    getOn(callback) {
        let isOn = false;
        isOn = this.powerState;
        //this.platform.log('new power status');
        this.platform.log.debug('Get Power ->', isOn);
        callback(null, isOn);
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////Play
    playSwitchStateGet(callback) {
        this.platform.log.debug('Play State');
        // set this to a valid value for On
        let currentValue = this.playBackState[0];
        callback(null, currentValue);
    }

    playSwitchStateSet(value, callback) {
        this.platform.log.debug('Play set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('PLAY')]);
            //this.newPlayBackState([true,false,false]);
        }

        else {
            //
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////Pause

    pauseSwitchStateGet(callback) {
        this.platform.log.debug('Pause State');
        // set this to a valid value for On
        let currentValue = this.playBackState[1];
        callback(null, currentValue);
    }
    /**
    * Handle requests to set the "Programmable Switch Output State" characteristic
    */
    pauseSwitchStateSet(value, callback) {
        this.platform.log.debug('Pause set to', value);
        if (value === true) {
            this.sending([this.pressedButton('PAUSE')]);
            //this.newPlayBackState([false,true,false]);
        }

        else {
            //
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////stop

    stopSwitchStateGet(callback) {
        this.platform.log.debug('Stop State');
        // set this to a valid value for On
        let currentValue = this.playBackState[2];
        callback(null, currentValue);
    }

    stopSwitchStateSet(value, callback) {
        this.platform.log.debug('Stop set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('STOP')]);
            //this.newPlayBackState([false,false,true]);
        }

        else {
            //s
        }
        callback(null);
    }

    /////Sending Instructions/////////////////////////////////////////////////////////////////////////////////////////////////////
    sending(press) {
        let i = 0;
        while (i < press.length) {
            this.client.write(press[i]);

            if (press[i].includes("QVM")) {
                this.platform.log.debug(`[Sending] ${JSON.stringify(press[i])}`);
            }
            else if (press[i].includes("QPW")) {
                this.platform.log.debug(`[Sending] ${JSON.stringify(press[i])}`);
            }
            else { this.platform.log(`[Sending] ${JSON.stringify(press[i])}`); }

            i += 1;

        }
    }

    //////////Current Status//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    newInputName(newName) {

        this.inputName= newName;
        this.bluRay.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName)
    }

    newChapter(newChapter) {

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
                }, 300);

            }

        }
        this.currentChapterSelector[0] = newChapter;
        this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterSelector[0]);
        this.chapterSelectorL.updateCharacteristic(this.platform.Characteristic.On, this.currentChapterSelectorState);
    }
    newChapterTime(newTime) {


        if (newTime === 0) {
            this.currentchapterTimeState = false;
            this.currentChapterTime = 0;
        }
        if (newTime !== 0) {
            this.currentchapterTimeState = true;
        }
        if (this.chapterElapsedFirst + this.chapterRemainingFirst !== 0) {
            this.currentChapterTime = Math.round(newTime * 100 / (this.chapterElapsedFirst + this.chapterRemainingFirst));
        }

        if (this.currentChapterTime > 100) { this.currentChapterTime = 100 }
        this.chapterControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentChapterTime);
        this.chapterControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentchapterTimeState);
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
        if (this.currentMovieProgress > 100) { this.currentMovieProgress = 100 }

        this.movieControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentMovieProgress);
        this.movieControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentMovieProgressState);
    }

    newPowerState(newValue) {
        if (newValue === true) {
            this.powerState_TV = 1;
        }
        else {
            this.powerState_TV = 0;
        }
        this.powerState = newValue;
        this.service.updateCharacteristic(this.platform.Characteristic.On, this.powerState);
        this.tvService.updateCharacteristic(this.platform.Characteristic.Active, this.powerState_TV);

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
            this.mediaState = 3;
        }
        this.play.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[0]);
        this.pause.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[1]);
        this.stop.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[2]);
        this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);
        this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.mediaState);
    }
    newHDRState(newHDR) {
        this.HDROutput = newHDR;

        this.dolbyVision.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[0]);
        this.hdr10.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[1]);
        this.SDR.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[2]);
    }
    newAudioType(newAT) {
        this.audioType = newAT;
        this.dolbySound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[0]);
        this.dtsSound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[1]);
    }
    newInputState(newInput) {
        this.inputState = newInput;
        if (this.inputState[0] === true) {
            this.inputID = 1;

        }
        if (this.inputState[1] === true) {
            this.inputID = 2;
        }
        if (this.inputState[2] === true) {
            this.inputID = 3;
        }
        if (this.inputState[0] === false && this.inputState[1] === false && this.inputState[2] === false) {
            this.inputID = 0;
        }
        this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
        this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier).updateValue(this.inputID);
        if (this.config.inputButtons === true) {
            this.bluRayInput.updateCharacteristic(this.platform.Characteristic.On, this.inputState[0]);
            this.hdmiIn.updateCharacteristic(this.platform.Characteristic.On, this.inputState[1]);
            this.hdmiOut.updateCharacteristic(this.platform.Characteristic.On, this.inputState[2]);
        }

    }

    newVolumeState(newVolumeNum) {
        this.currentVolume = newVolumeNum;
        if (newVolumeNum === 0) {
            this.currentMuteState = true;
            this.currentVolumeSwitch = false;
        }
        if (newVolumeNum != 0) {
            this.currentMuteState = false;
            this.currentVolumeSwitch = true;
        }

        this.speakerService.updateCharacteristic(this.platform.Characteristic.Volume, this.currentVolume);
        this.speakerService.updateCharacteristic(this.platform.Characteristic.Mute, this.currentMuteState);
        this.speakerService.getCharacteristic(this.platform.Characteristic.Volume).updateValue(this.currentVolume);
        this.speakerService.getCharacteristic(this.platform.Characteristic.Mute).updateValue(this.currentMuteState)
        if (this.config.volume === true) {
            this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentVolume);
            this.volumeDimmer.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentVolume);
            this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.On, this.currentVolumeSwitch);
        }

    }


    ///Event decoder///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    eventDecoder(dataReceived) {
        const str = (`${dataReceived}`);
        const res = str.split('@');
        let i = 0;
        while (i < res.length) {
            if (res[i] === '') {
                //
            }
            else if (res[i].includes('OK OFF') || res[i].includes('POF OK OFF') || res[i].includes('UPW 0')) {
                this.reconnectionCounter = 0;

                this.newPowerState(false);
                this.newPlayBackState([false, false, false]);
                this.newHDRState([false, false, false]);
                this.newAudioType([false, false]);
                this.newVolumeState(0);
                this.newInputName('Blu-ray');
                if (this.config.movieControl === true) {
                    this.currentMovieProgressFirst = true;
                    this.chapterFirstUpdate = true;
                    this.newChapter(0);
                    this.newMovieTime(0);
                    this.newChapterTime(0);

                }
                this.newInputState([false, false, false]);
                this.firstConnection === false;
            }
            else if (res[i].includes('PON OK')) {
                this.reconnectionCounter = 0;
                this.newPowerState(true);
            }
            else if (res[i].includes('OK ON')) {
                this.newPowerState(true);
                if (this.firstConnection === true) {
                    this.platform.log('First Update');
                    setTimeout(() => {
                        this.sending(this.queryKeys(['PLAYBACK STATUS']));
                    }, 200);

                    setTimeout(() => {
                        this.sending(this.queryKeys(['HDR STATUS']));
                    }, 300);
                    setTimeout(() => {
                        this.sending([this.query('INPUT STATUS')]);
                    }, 400);
                    setTimeout(() => {
                        this.sending([this.query('VOLUME STATUS')]);
                    }, 500);
                    this.firstConnection = false;
                }

            }

            else if (res[i].includes('UTC')) {
                let updateString = res[i].split(' ');
                let chapter = parseInt(updateString[2], 10);
                let time = this.timeToSeconds(updateString[4]);
                this.chapterCounter += 1;
                if (this.reconnectionCounter < this.reconnectionTry) {
                    if (this.currentMovieProgressFirst === true) {
                        this.firstElapsedMovie = time;
                        this.reconnectionCounter += 1;

                        setTimeout(() => {
                            this.sending([this.query('CHAPTER NUMBER')]);
                        }, 100);
                        setTimeout(() => {
                            this.sending([this.query('MEDIA TIME REMAINING')]);
                        }, 300);

                    }
                    if (this.currentMovieProgressFirst === false) {
                        this.newChapter(chapter);
                        this.newMovieTime(time);
                    }
                    if (this.chapterCounter > 10) {
                        setTimeout(() => {
                            this.sending([this.query('CHAPTER TIME ELAPSED')]);
                        }, 500);
                        this.chapterCounter = 0;
                    }
                }

            }

            else if (res[i].includes('QCR')) {

                if (this.chapterFirstUpdate === true) {
                    this.chapterRemainingFirst = this.timeToSeconds(this.justNumber(res[i]));
                }

            }
            else if (res[i].includes('QCE')) {
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
            else if (res[i].includes('QRE')) {
                this.currentMovieProgressFirst = false;
                this.movieRemaining = this.timeToSeconds(this.justNumber(res[i]));

            }
            else if (res[i].includes('QCH')) {
                let numberArray = this.justNumber(res[i]).split('/')
                let number = parseInt(numberArray[0])
                this.currentChapterSelector[1] = parseInt(numberArray[1])
                this.reconnectionCounter = 0;
                this.newChapter(number);

            }

            else if (res[i].includes('UPW 1')) {
                this.newPowerState(true);
                this.firstConnection === false;
            }
            else if (res[i].includes('DISC')) {
                this.newPowerState(true);
                this.newPlayBackState([false, false, false]);
                this.newInputName('Blu-ray');
                setTimeout(() => {
                    this.sending(this.queryKeys(['HDR STATUS']));
                }, 100);
                setTimeout(() => {
                    this.sending([this.query('INPUT STATUS')]);
                }, 200);
                setTimeout(() => {
                    this.sending([this.query('VOLUME STATUS')]);
                }, 300);


            }
            else if (res[i].includes('UVL') || res[i].includes('QVL')) {
                if (res[i].includes('UMT')) {
                    this.newVolumeState(100);
                    this.reconnectionCounter = 0;
                }
                else if (!res[i].includes('MUT')) {
                    let numberOnly = res[i].replace(/^\D+/g, '')
                    this.newVolumeState(parseInt(numberOnly, 10))
                    this.reconnectionCounter = 0;
                }
                
                else {
                    this.newVolumeState(0)
                    this.reconnectionCounter = 0;

                }

            }
            else if (res[i].includes('OK PLAY')) {
                this.newPlayBackState([true, false, false]);
                setTimeout(() => {
                    this.sending([this.query('MEDIA NAME')]);
                }, 3000);
            }
            else if (res[i].includes('UPL PLAY')) {
                this.newPlayBackState([true, false, false]);
            }
            else if (res[i].includes('OK PAUSE') || res[i].includes('UPL PAUS')) {
                this.newPlayBackState([false, true, false]);
            }
            else if (res[i].includes('OK STOP') || res[i].includes('UPL STOP')) {
                this.newPlayBackState([false, false, false]);
                this.newInputName('Blu-ray');
                if (this.config.movieControl === true) {
                    this.currentMovieProgressFirst = true;
                    this.chapterFirstUpdate = true;
                    this.newChapter(0);
                    this.newMovieTime(0);
                    this.newChapterTime(0);

                }
            }
            else if (res[i].includes('OK STEP') || res[i].includes('OK FREV') || res[i].includes('OK FREV')
                || res[i].includes('OK SFWD') || res[i].includes('OK SREV') || res[i].includes('UPL STPF') || res[i].includes('UPL STPR')
                || res[i].includes('UPL FFW1') || res[i].includes('UPL FRV1') || res[i].includes('UPL SFW1') || res[i].includes('UPL SRV1')
                || res[i].includes('ER OVERTIME') || res[i].includes('OK MEDIA') || res[i].includes('OK DISC') || res[i].includes('OK SETUP') || res[i].includes('UPL MCTR')
                || res[i].includes('UPL MENUP') || res[i].includes('QPL OK CLOSE')) {
                this.newPlayBackState([false, false, false]);
            }

            else if (res[i].includes('QVM OK 2') || res[i].includes('SVM OK 2')) {
                if (this.config.movieControl === false) { this.sending([this.query('POWER STATUS')]); }
                else { this.sending([this.pressedButton('VERBOSE MODE 3')]); }

            }
            else if (res[i].includes('QVM OK 3') || res[i].includes('SVM OK 3')) {
                if (this.config.movieControl === false) {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
                else {

                    this.sending([this.query('POWER STATUS')]);
                }
            }
            else if (res[i].includes('QVM OK 0')) {
                if (this.config.movieControl === false) {
                    this.sending([this.pressedButton('VERBOSE MODE 2')]);
                }
                else { this.sending([this.pressedButton('VERBOSE MODE 3')]); }
            }
            else if (res[i].includes('U3D 2D')) {
                this.sending([this.pressedButton('RESET')]);
                setTimeout(() => {
                    this.sending(this.queryKeys(['PLAYBACK STATUS']));
                }, 200);

                setTimeout(() => {
                    this.sending(this.queryKeys(['HDR STATUS']));
                }, 2000);
            }
            else if (res[i].includes('OK HDR')) {
                this.newHDRState([false, true, false]);


            }
            else if (res[i].includes('OK SDR')) {
                this.newHDRState([false, false, true]);
                this.reconnectionCounter = 0;

            }
            else if (res[i].includes('OK DOV')) {

                this.newHDRState([true, false, false]);

            }
            else if (res[i].includes('QFN OK')) {
                
                    let nameArray = res[i].split(' ')
                    this.newInputName(nameArray[2]);
                   
              
            }
            else if (res[i].includes('BD-PLAYER')) {
                this.newInputState([true, false, false]);
            }
            else if (res[i].includes('HDMI-IN')) {
                this.newInputState([false, true, false]);
            }
            else if (res[i].includes('ARC-HDMI-OUT')) {
                this.newInputState([false, false, true]);
            }


            else if (res[i].includes('UAT DT')) {
                this.newAudioType([true, false]);

            }
            else if (res[i].includes('UAT TM')) {
                this.newAudioType([false, true]);
            }

            else if (res[i].includes('UAT DP')) {
                this.newAudioType([true, false]);
            }
            else if (res[i].includes('UAT DD') || res[i].includes('UAT TS') || res[i].includes('UAT TH')
                || res[i].includes('UAT TH') || res[i].includes('UAT PC') || res[i].includes('UAT PC')
                || res[i].includes('UAT MP') || res[i].includes('UAT CD') || res[i].includes('UAT UN')) {
                this.newAudioType([false, false]);
            }


            else if (res[i].includes('UPL HOME') || res[i].includes('OK HOME')) {
                this.newPlayBackState([false, false, false]);
                this.newHDRState([false, false, true]);
                this.newAudioType([false, false]);
                this.newInputName('Blu-ray');
                this.reconnectionCounter = 0;
                if (this.config.movieControl === true) {
                    this.currentMovieProgressFirst = true;
                    this.chapterFirstUpdate = true;
                    this.newChapter(0);
                    this.newMovieTime(0);
                    this.newChapterTime(0);

                }
                if (this.firstConnection !== false) {
                    setTimeout(() => {
                        this.sending([this.query('INPUT STATUS')]);
                    }, 100);
                    setTimeout(() => {
                        this.sending([this.query('VOLUME STATUS')]);
                    }, 200);
                }

            }

            else {
                //
            }
            i += 1;
        }
    }

    ///Query////////////////////////////////////////////////////////////////////////////////////////////////////
    queryKeys(buttons) {
        buttons.length;
        const keys = [''];
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
        }
        key += '\r';
        return key;
    }
    /////oppo controls/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    pressedButton(name) {
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
        key += '\r';
        return key;
    }

    /////////Data Management/////////////////////////////////////////////////////////////

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
        var date = new Date(0);
        date.setSeconds(parseInt(seconds)); // specify value for SECONDS here
        var timeString = date.toISOString().substr(11, 8);
        return timeString
    }
    /////Volume, chapter, Movie time change //////////////////////////////////////////////

    volumeChange(number) {
        let key;
        key = '#SVL ';
        key += number.toString();
        key += '\r';
        return key;
    }

    chapterChange(number) {
        let key;
        key = '#SRH C';
        key += number.toString();
        key += '\r';
        return key;
    }
    chapterTime(number) {
        let key;
        key = '#SRH C ';
        key += number
        key += '\r';
        return key;
    }
    movieTime(number) {
        let key;
        key = '#SRH ';
        key += number
        key += '\r';
        return key;
    }

    ////Update instructions
    updateAll() {
        const queryAll = ['POWER STATUS', 'PLAYBACK STATUS', 'HDR STATUS', 'AUDIO TYPE'];
        const KEYS = this.queryKeys(queryAll);
        return KEYS;
    }
    updatePlayback() {
        const queryPlayback = ['PLAYBACK STATUS'];
        const KEYS = this.queryKeys(queryPlayback);
        return KEYS;
    }
    updateHDRStatus() {
        const queryHDR = ['HDR STATUS'];
        const KEYS = this.queryKeys(queryHDR);
        return KEYS;
    }
    turnOffAll() {
        this.newPowerState(false);
        this.newHDRState([false, false, false]);
        this.newPlayBackState([false, false, false]);
        this.newAudioType([false, false]);
        this.newInputState = [false, false, false];
        this.newVolumeState = 0;
        this.newInputName('Blu-ray');
        if (this.config.movieControl === true) {
            this.currentMovieProgressFirst = true;
            this.chapterFirstUpdate = true;
            this.newChapter(0);
            this.newMovieTime(0);
            this.newChapterTime(0);

        }
    }
}
//// Platform/////////////////////////////////////////////////////////////////////////////////////////////////
class oppoPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        // this is used to track restored cached accessories
        this.accessories = [];
        this.log.debug('Finished initializing platform:', this.config.name);

        this.api.on('didFinishLaunching', () => {
            log.debug('didFinishLaunching callback');

            this.discoverDevices();
        });
    }

    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        this.accessories.push(accessory);
    }

    discoverDevices() {

        const oppoDevices = [
            {
                oppoUniqueId: 'AB1212D',
                oppoDisplayName: `${this.config.name} Power Switch`,
            },
        ];
        // loop over the discovered devices and register each one if it has not already been registered
        for (const device of oppoDevices) {

            const uuid = this.api.hap.uuid.generate(device.oppoUniqueId);

            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            if (existingAccessory) {

                if (device) {
                    this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

                    new oppoAccessory(this, existingAccessory);

                    this.api.updatePlatformAccessories([existingAccessory]);
                }
                else if (!device) {
                    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
                    this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
                }
            }
            else {

                this.log.info('Adding new accessory:', device.oppoDisplayName);

                const accessory = new this.api.platformAccessory(device.oppoDisplayName, uuid);
                accessory.category = this.api.hap.Accessory.Categories.TELEVISION;
                accessory.context.device = device;

                new oppoAccessory(this, accessory);

                this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);

            }
        }
    }
}
module.exports = (api) => {
    api.registerPlatform(PLATFORM_NAME, oppoPlatform);
};