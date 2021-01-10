"use strict";
const PLATFORM_NAME = 'oppoPlugin';
const PLUGIN_NAME = 'homebridge-oppo-203';
const net = require("net");
const OPPO_PORT = 23;
const timeout = 2000;


class oppoAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        this.config = platform.config;
        this.client;
        let OPPO_IP = this.config.ip;


        //////Initial Switch and sensors state
        this.powerState = false;
        this.playBackState = [false, false, false];
        this.inputState = [false, false, false];
        this.HDROutput = [false, false, false];
        this.audioType = [false, false];
        this.powerState_TV = 0;
        this.currentVolume = 100;
        this.currentMuteState = false;

        ////Connection parameters
        this.reconnectionCounter = 0;
        this.reconntionTry = 100;
        this.connectionLimit = false;
        this.recoonectionWait = 5000;
        this.firstConnection = false;

        //Device Information

        this.config.name = platform.config.name || 'Oppo 203';
        this.config.ip = platform.config.ip;
        this.config.manufactur = platform.config.manufactur || 'Oppo';
        this.config.pollingInterval = platform.config.pollingInterval || 1000;
        this.config.modelName = platform.config.modelName || 'UDP-203';
        this.config.serialN = platform.config.serialN || 'B210U71647033894';
        this.config.volume = platform.config.volume || false;
        this.config.wholeRemote = platform.config.wholeRemote || false;
        this.config.mediaButtons = platform.config.mediaButtons || false;
        this.config.navegationButtons = platform.config.navegationButtons || false;


        ////Checking if the necessary information was given by the user
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


        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, this.config.manufactur)
            .setCharacteristic(this.platform.Characteristic.Model, this.config.modelName)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.config.serialN);

        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);
        this.service.getCharacteristic(this.platform.Characteristic.On)
            .on('set', this.setOn.bind(this))
            .on('get', this.getOn.bind(this));
        this.play = this.accessory.getService('Play Switch') ||
            this.accessory.addService(this.platform.Service.Switch, 'Play Switch', 'YourUniqueIdentifier-10');
        this.play.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.playSwitchStateGet.bind(this))
            .on('set', this.playSwitchStateSet.bind(this));
        this.pause = this.accessory.getService('Pause Switch') ||
            this.accessory.addService(this.platform.Service.Switch, 'Pause Switch', 'YourUniqueIdentifier-11');
        this.pause.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.pauseSwitchStateGet.bind(this))
            .on('set', this.pauseSwitchStateSet.bind(this));
        this.stop = this.accessory.getService('Stop Switch') ||
            this.accessory.addService(this.platform.Service.Switch, 'Stop Switch', 'YourUniqueIdentifier-12');
        this.stop.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.stopSwitchStateGet.bind(this))
            .on('set', this.stopSwitchStateSet.bind(this));



        /**
         * Creating multiple services .
         */
        this.dolbyVision = this.accessory.getService('Dolby Vision Video') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Vision Video', 'YourUniqueIdentifier-1');
        this.hdr10 = this.accessory.getService('HDR 10 Video') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'HDR 10 Video', 'YourUniqueIdentifier-2');
        this.SDR = this.accessory.getService('SDR Video') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'SDR Video', 'YourUniqueIdentifier-3');
        this.dolbySound = this.accessory.getService('Dolby Atmos') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Atmos', 'YourUniqueIdentifier-8');
        this.dtsSound = this.accessory.getService('DTS') ||
            this.accessory.addService(this.platform.Service.MotionSensor, 'DTS', 'YourUniqueIdentifier-9');




        /////////Television Controls///////////////////////////////////////////////////////////////////////////////////////////
        // add the tv service
        this.tvService = this.accessory.getService(this.config.name) ||
            this.accessory.addService(this.platform.Service.Television, this.config.name, 'YourUniqueIdentifier-7');
        // set the tv name
        this.tvService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.config.name);
        // set sleep discovery characteristic
        this.tvService.setCharacteristic(this.platform
            .Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
        // handle on / off events using the Active characteristic
        this.tvService.getCharacteristic(this.platform.Characteristic.Active)
            .on('set', (newValue, callback) => {
                this.platform.log.info('set Active => setNewValue: ' + newValue);
                if (newValue === 1) {
                    this.sending([this.pressedButton('POWER ON')]);
                    this.newPowerState(true);
                }
                else if (newValue === 0) {
                    this.newPowerState(false);
                    this.sending([this.pressedButton('POWER OFF')]);
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
                        this.platform.log.info('set Remote Key Pressed: REWIND');
                        this.sending([this.pressedButton('REWIND')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
                        this.platform.log.info('set Remote Key Pressed: FAST_FORWARD');
                        this.sending([this.pressedButton('FORWARD')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
                        this.platform.log.info('set Remote Key Pressed: NEXT_TRACK');
                        this.sending([this.pressedButton('NEXT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
                        this.platform.log.info('set Remote Key Pressed: PREVIOUS_TRACK');
                        this.sending([this.pressedButton('PREVIOUS')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_UP: {
                        this.platform.log.info('set Remote Key Pressed: ARROW_UP');
                        this.sending([this.pressedButton('CURSOR UP')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
                        this.platform.log.info('set Remote Key Pressed: ARROW_DOWN');
                        this.sending([this.pressedButton('CURSOR DOWN')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
                        this.platform.log.info('set Remote Key Pressed: ARROW_LEFT');
                        this.sending([this.pressedButton('CURSOR LEFT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
                        this.platform.log.info('set Remote Key Pressed: ARROW_RIGHT');
                        this.sending([this.pressedButton('CURSOR RIGHT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.SELECT: {
                        this.platform.log.info('set Remote Key Pressed: SELECT');
                        this.sending([this.pressedButton('CURSOR ENTER')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.BACK: {
                        this.platform.log.info('set Remote Key Pressed: BACK');
                        this.sending([this.pressedButton('BACK')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.EXIT: {
                        this.platform.log.info('set Remote Key Pressed: EXIT');
                        this.sending([this.pressedButton('HOME MENU')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
                        this.platform.log.info('set Remote Key Pressed: PLAY_PAUSE');
                        if (this.playBackState[0] === false) {
                            this.sending([this.pressedButton('PLAY')]);
                        }
                        else if (this.playBackState[0] === true) {
                            this.sending([this.pressedButton('PAUSE')]);
                        }
                        else {
                            //
                        }
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.INFORMATION: {
                        this.platform.log.info('set Remote Key Pressed: INFORMATION');
                        this.sending([this.pressedButton('INFO')]);
                        break;
                    }
                }

                callback(null);


            });


        this.bluRayInput = this.accessory.getService('Blu-ray Input') ||
            this.accessory.addService(this.platform.Service.Switch, 'Blu-ray Input', 'YourUniqueIdentifier-23');
        this.bluRayInput.getCharacteristic(this.platform.Characteristic.On)
            .on('get', (callback) => {
                this.platform.log.debug('Triggered GET On');

                let currentValue = this.inputState[0];
                callback(null, currentValue);
            })
            .on('set', (value, callback) => {
                this.platform.log.debug('Triggered SET On:', value);
                if (value === true) {
                    this.sending([this.pressedButton('BLURAY INPUT')]);
                }
                else if (value === false) {
                    //this.sending([this.pressedButton('PAUSE')]);
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
                this.platform.log.debug('Triggered GET On');
                // set this to a valid value for On
                let currentValue = this.inputState[1];
                callback(null, currentValue);
            })
            .on('set', (value, callback) => {
                this.platform.log.debug('Triggered SET On:', value);
                if (value === true) {
                    this.sending([this.pressedButton('HDMI IN')]);
                }
                else if (value === false) {
                    //this.sending([this.pressedButton('PAUSE')]);
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
                this.platform.log.debug('Triggered GET On');
                // set this to a valid value for On
                let currentValue = this.inputState[2];
                callback(null, currentValue);
            })
            .on('set', (value, callback) => {
                this.platform.log.debug('Triggered SET On:', value);
                if (value === true) {
                    this.sending([this.pressedButton('HDMI OUT')]);
                }
                else if (value === false) {
                    //this.sending([this.pressedButton('PAUSE')]);
                }
                else {
                    //
                }
                callback(null);
            });



        //////Volume control Service////////////////////////////////////////////////////////////////////////////
        if (this.config.volume === true) {

            /*
            this.speakerService = this.accessory.getService('Oppo Volume') ||
                this.accessory.addService(this.platform.Service.TelevisionSpeaker, 'Oppo Volume', 'YourUniqueIdentifier-20');
            this.speakerService
                .setCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE)
                .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);
            this.speakerService.getCharacteristic(this.platform.Characteristic.Volume)
                .on('get', (callback) => {
                    let currentValue = this.currentVolume;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {
                    this.sending([this.volumeChange(newValue)]);
                    this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                    this.currentVolume = newValue;
                    callback(null);
                });



            this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
                .on('get', (callback) => {

                    if (this.currentVolume != 0) {
                        this.currentMuteState = false;

                    }
                    else if (this.currentVolume === 0) { this.currentMuteState = true; }
                    let currentValue = this.currentMuteState;
                    callback(null, currentValue);
                })
                .on('set', (newValue, callback) => {

                    if (newValue === false) {
                        this.sending([this.volumeChange(100)]);
                        this.currentMuteState = false;
                        this.currentVolume = 100;

                    }
                    else if (newValue === true) {
                        this.sending([this.volumeChange(0)]);
                        this.currentMuteState = true;
                        this.currentVolume = 0;
                    }

                    else {
                        //
                    }
                    this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                   
                    callback(null);
                });

*/


            this.volumeDimmer = this.accessory.getService('Oppo Volume') ||
                this.accessory.addService(this.platform.Service.Lightbulb, 'Oppo Volume', 'YourUniqueIdentifier-98');
            this.volumeDimmer.getCharacteristic(this.platform.Characteristic.Brightness)
                .on('get', (callback) => {
                    let currentValue = this.currentVolume;
                    this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness,this.currentVolume);
                    callback(null, currentValue);

                })
                .on('set', (newValue, callback) => {
                    this.sending([this.volumeChange(newValue)]);


                    this.platform.log('set VolumeSelector => setNewValue: ' + newValue);
                    this.currentVolume = newValue;
                    callback(null);
                });





        }

        ////Navegation Controls /////////////////////////////////////////////////////////
        if (this.config.navegationButtons === true) {

            this.cursorUp = this.accessory.getService('Cursor Up') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Up', 'YourUniqueIdentifier-31');
            this.cursorUp.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR UP')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.cursorUp.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });

            this.cursorDown = this.accessory.getService('Cursor Down') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Down', 'YourUniqueIdentifier-32');
            this.cursorDown.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR DOWN')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.cursorDown.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.cursorLeft = this.accessory.getService('Cursor Left') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Left', 'YourUniqueIdentifier-33');
            this.cursorLeft.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR LEFT')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.cursorLeft.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.cursorRight = this.accessory.getService('Cursor Right') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Right', 'YourUniqueIdentifier-34');
            this.cursorRight.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR RIGHT')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.cursorRight.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.cursorEnter = this.accessory.getService('Cursor Enter') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Enter', 'YourUniqueIdentifier-35');
            this.cursorEnter.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR ENTER')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.cursorEnter.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });

            this.menu = this.accessory.getService('Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Menu', 'YourUniqueIdentifier-36');
            this.menu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('MENU')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.menu.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });

            this.backButton = this.accessory.getService('Back') ||
                this.accessory.addService(this.platform.Service.Switch, 'Back', 'YourUniqueIdentifier-37');
            this.backButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('BACK')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.backButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.clear = this.accessory.getService('Clear') ||
                this.accessory.addService(this.platform.Service.Switch, 'Clear', 'YourUniqueIdentifier-40');
            this.clear.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CLEAR')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.clear.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.topMenu = this.accessory.getService('Top Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Top Menu', 'YourUniqueIdentifier-41');
            this.topMenu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('TOP MENU')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.topMenu.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.option = this.accessory.getService('Option') ||
                this.accessory.addService(this.platform.Service.Switch, 'Option', 'YourUniqueIdentifier-42');
            this.option.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('OPTION')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.option.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.homeMenu = this.accessory.getService('Home Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Home Menu', 'YourUniqueIdentifier-43');
            this.homeMenu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HOME MENU')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.homeMenu.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.infoButton = this.accessory.getService('Info') ||
                this.accessory.addService(this.platform.Service.Switch, 'Info', 'YourUniqueIdentifier-44');
            this.infoButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('INFO')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.infoButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.setup = this.accessory.getService('Setup') ||
                this.accessory.addService(this.platform.Service.Switch, 'Setup', 'YourUniqueIdentifier-45');
            this.setup.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SETUP')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.setup.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.goTo = this.accessory.getService('Go To') ||
                this.accessory.addService(this.platform.Service.Switch, 'Go To', 'YourUniqueIdentifier-49');
            this.goTo.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('GO TO')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.goTo.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.pageUp = this.accessory.getService('Page Up') ||
                this.accessory.addService(this.platform.Service.Switch, 'Page Up', 'YourUniqueIdentifier-50');
            this.pageUp.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PAGE UP')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.pageUp.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.pageDown = this.accessory.getService('Page Down') ||
                this.accessory.addService(this.platform.Service.Switch, 'Page Down', 'YourUniqueIdentifier-51');
            this.pageDown.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PAGE DOWN')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.pageDown.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });

            this.popUpMenu = this.accessory.getService('Pop-Up Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Pop-Up Menu', 'YourUniqueIdentifier-52');
            this.popUpMenu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('POP-UP MENU')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
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
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PREVIOUS')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
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
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('NEXT')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
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
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('REWIND')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
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
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('FORWARD')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.forwardButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });

        }
        /////The rest of the buttons///////////////////////////////////////////////////////////////////

        if (this.config.wholeRemote === true) {



            this.dimmer = this.accessory.getService('Dimmer') ||
                this.accessory.addService(this.platform.Service.Switch, 'Dimmer', 'YourUniqueIdentifier-47');
            this.dimmer.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('DIMMER')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.dimmer.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.pureAudio = this.accessory.getService('Pure Audio') ||
                this.accessory.addService(this.platform.Service.Switch, 'Pure Audio', 'YourUniqueIdentifier-48');
            this.pureAudio.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PURE AUDIO')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.pureAudio.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.red = this.accessory.getService('Red') ||
                this.accessory.addService(this.platform.Service.Switch, 'Red', 'YourUniqueIdentifier-53');
            this.red.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('RED')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.red.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.green = this.accessory.getService('Green') ||
                this.accessory.addService(this.platform.Service.Switch, 'Green', 'YourUniqueIdentifier-54');
            this.green.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('GREEN')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.green.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.blue = this.accessory.getService('Blue') ||
                this.accessory.addService(this.platform.Service.Switch, 'Blue', 'YourUniqueIdentifier-55');
            this.blue.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('BLUE')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.blue.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.yellow = this.accessory.getService('Yellow') ||
                this.accessory.addService(this.platform.Service.Switch, 'Yellow', 'YourUniqueIdentifier-56');
            this.yellow.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('YELLOW')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.yellow.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.audio = this.accessory.getService('Audio') ||
                this.accessory.addService(this.platform.Service.Switch, 'Audio', 'YourUniqueIdentifier-57');
            this.audio.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('AUDIO')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.audio.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.subtitle = this.accessory.getService('Subtitle') ||
                this.accessory.addService(this.platform.Service.Switch, 'Subtitle', 'YourUniqueIdentifier-58');
            this.subtitle.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SUBTITLE')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.subtitle.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.angle = this.accessory.getService('Angle') ||
                this.accessory.addService(this.platform.Service.Switch, 'Angle', 'YourUniqueIdentifier-59');
            this.angle.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('ANGLE')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.angle.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.zoom = this.accessory.getService('Zoom') ||
                this.accessory.addService(this.platform.Service.Switch, 'Zoom', 'YourUniqueIdentifier-60');
            this.zoom.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('ZOOM')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.zoom.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.sap = this.accessory.getService('SAP') ||
                this.accessory.addService(this.platform.Service.Switch, 'SAP', 'YourUniqueIdentifier-61');
            this.sap.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SAP')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.sap.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });




            this.abReplay = this.accessory.getService('AB Replay') ||
                this.accessory.addService(this.platform.Service.Switch, 'AB Replay', 'YourUniqueIdentifier-62');
            this.abReplay.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('AB REPLAY')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.abReplay.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.repeat = this.accessory.getService('Repeat') ||
                this.accessory.addService(this.platform.Service.Switch, 'Repeat', 'YourUniqueIdentifier-63');
            this.repeat.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('REPEAT')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.repeat.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.pip = this.accessory.getService('PIP') ||
                this.accessory.addService(this.platform.Service.Switch, 'PIP', 'YourUniqueIdentifier-64');
            this.pip.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PIP')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.pip.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.resolution = this.accessory.getService('Resolution') ||
                this.accessory.addService(this.platform.Service.Switch, 'Resolution', 'YourUniqueIdentifier-65');
            this.resolution.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('RESOLUTION')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.resolution.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.threeD = this.accessory.getService('3D') ||
                this.accessory.addService(this.platform.Service.Switch, '3D', 'YourUniqueIdentifier-67');
            this.threeD.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('3D')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.threeD.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.picture = this.accessory.getService('Picture') ||
                this.accessory.addService(this.platform.Service.Switch, 'Picture', 'YourUniqueIdentifier-68');
            this.picture.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PIC')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.picture.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.hdrButton = this.accessory.getService('HDR Button') ||
                this.accessory.addService(this.platform.Service.Switch, 'HDR Button', 'YourUniqueIdentifier-69');
            this.hdrButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HDR')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.hdrButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.subtitleHold = this.accessory.getService('Subtitle (Hold)') ||
                this.accessory.addService(this.platform.Service.Switch, 'Subtitle (Hold)', 'YourUniqueIdentifier-70');
            this.subtitleHold.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SUBTITTLE (HOLD)')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.subtitleHold.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.infoHold = this.accessory.getService('Info (Hold)') ||
                this.accessory.addService(this.platform.Service.Switch, 'Info (Hold)', 'YourUniqueIdentifier-71');
            this.infoHold.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('INFO (HOLD)')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.infoHold.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });



            this.resolutionHold = this.accessory.getService('Resolution (Hold)') ||
                this.accessory.addService(this.platform.Service.Switch, 'Resolution (Hold)', 'YourUniqueIdentifier-72');
            this.resolutionHold.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('RESOLUTION (HOLD)')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.resolutionHold.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.avSync = this.accessory.getService('AV SYNC') ||
                this.accessory.addService(this.platform.Service.Switch, 'AV SYNC', 'YourUniqueIdentifier-73');
            this.avSync.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('AV SYNC')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.avSync.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });

            this.gaplessPlay = this.accessory.getService('Gapless Play') ||
                this.accessory.addService(this.platform.Service.Switch, 'Gapless Play', 'YourUniqueIdentifier-74');
            this.gaplessPlay.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('GAPLESS PLAY')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.gaplessPlay.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.input = this.accessory.getService('Input') ||
                this.accessory.addService(this.platform.Service.Switch, 'Input', 'YourUniqueIdentifier-75');
            this.input.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('INPUT')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.input.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


            this.ejectDisc = this.accessory.getService('Eject/Load Disc') ||
                this.accessory.addService(this.platform.Service.Switch, 'Eject/Load Disc', 'YourUniqueIdentifier-76');
            this.ejectDisc.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Triggered GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Triggered SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('EJECT')]);
                    }
                    else if (value === false) {
                        //this.sending([this.pressedButton('PAUSE')]);
                    }
                    else {
                        //
                    }
                    this.ejectDisc.updateCharacteristic(this.platform.Characteristic.On, false);
                    callback(null);
                });


        }

        ///////////////Clean up. Delete services not in used

        if (this.config.volume === false) {
            this.accessory.removeService(this.speakerService);
            this.accessory.removeService(this.volumeDimmer);
        }
        if (this.config.navegationButtons === false) {
            this.accessory.removeService(this.cursorUp);
            this.accessory.removeService(this.cursorLeft);
            this.accessory.removeService(this.cursorDown);
            this.accessory.removeService(this.cursorRight);
            this.accessory.removeService(this.cursorEnter);
            this.accessory.removeService(this.menu);
            this.accessory.removeService(this.backButton);
            this.accessory.removeService(this.clear);
            this.accessory.removeService(this.topMenu);
            this.accessory.removeService(this.option);
            this.accessory.removeService(this.homeMenu);
            this.accessory.removeService(this.infoButton);
            this.accessory.removeService(this.setup);
            this.accessory.removeService(this.goTo);
            this.accessory.removeService(this.pageDown);
            this.accessory.removeService(this.pageUp);
            this.accessory.removeService(this.popUpMenu);

        }
        if (this.config.mediaButtons === false) {
            this.accessory.removeService(this.previous);
            this.accessory.removeService(this.next);
            this.accessory.removeService(this.rewindButton);
            this.accessory.removeService(this.forwardButton);
        }
        if (this.config.wholeRemote === false) {
            this.accessory.removeService(this.dimmer);
            this.accessory.removeService(this.pureAudio);
            this.accessory.removeService(this.red);
            this.accessory.removeService(this.blue);
            this.accessory.removeService(this.yellow);
            this.accessory.removeService(this.green);
            this.accessory.removeService(this.audio);
            this.accessory.removeService(this.subtitle);
            this.accessory.removeService(this.angle);
            this.accessory.removeService(this.zoom);
            this.accessory.removeService(this.sap);
            this.accessory.removeService(this.abReplay);
            this.accessory.removeService(this.repeat);
            this.accessory.removeService(this.pip);
            this.accessory.removeService(this.resolution);
            this.accessory.removeService(this.threeD);
            this.accessory.removeService(this.picture);
            this.accessory.removeService(this.hdrButton);
            this.accessory.removeService(this.subtitleHold);
            this.accessory.removeService(this.infoHold);
            this.accessory.removeService(this.resolutionHold);
            this.accessory.removeService(this.avSync);
            this.accessory.removeService(this.gaplessPlay);
            this.accessory.removeService(this.input);
            this.accessory.removeService(this.ejectDisc);
        }





        ///First instruction to be sent when the conneciton is made
        let key = this.query('VERBOSE MODE');
        //////////////Create Client//////////////////////////////////////////////////////////////////////////


        ////Creating the connection
        this.client = new net.Socket();


        //////Connect to client
        this.client.connect(OPPO_PORT, OPPO_IP, () => {
            clearTimeout(timer);
            this.platform.log(`[Sending] ${JSON.stringify(key)}`);
            this.client.write(key);
            //this.reconnectionCounter = 0;
            this.firstConnection = true;
        });

        /////Receiving Data
        this.client.on('data', (data) => {
            clearTimeout(timer);
            this.platform.log(`[Response] ${data}`);
            //this.reconnectionCounter = 0;
            this.eventDecoder(data);
            // client.destroy(); // kill client after server's response
        });

        /////Errors
        this.client.on('error', (e) => {
            clearTimeout(timer);
            this.platform.log(`[Error] ${e}`);
            this.platform.log(`[Trying to reconnect after an error] ${e}`);
            this.platform.log('[Error] Turn on the device and check the IP Address');


            // if (this.reconnectionCounter < this.reconntionTry) {
            setTimeout(() => {
                //this.reconnectionCounter += 1;
                this.client.connect(OPPO_PORT, OPPO_IP, () => {
                    clearTimeout(timer);


                    this.platform.log(`Reconnection try number ${this.reconnectionCounter}`);
                });



            }, this.recoonectionWait);

            //}
            /*
            else {

            }
*/
        });


        ////Connection Closed

        this.client.on('close', () => {
            this.platform.log('Disconnected from server');
            //this.reconnectionCounter += 1;

            // if (this.reconnectionCounter < this.reconntionTry) {
            setTimeout(() => {
                this.client.destroy();
                this.client.connect(OPPO_PORT, OPPO_IP, () => {
                    clearTimeout(timer);
                    this.platform.log(`[Reconnecting on after connection closed]`);
                    //this.platform.log(`Reconnection try number ${this.reconnectionCounter}`);



                });
            }, this.recoonectionWait);

            // } else {
            ///
            // }


        });
        /////Time out Timer
        const timer = setTimeout(() => {
            this.platform.log('[ERROR] Attempt at connection exceeded timeout value');
            // client.destroy();
        }, timeout);


        /////Reconnection Interval
        /*
                setInterval(() => {
        
        
                    let connetionState = this.client.writable
                    if (connetionState === false) {
                        this.reconnectionCounter += 1;
                        if (this.reconnectionCounter < this.reconntionTry) {
                            this.client.destroy();
        
                            this.client.connect(OPPO_PORT, OPPO_IP, () => {
                                clearTimeout(timer);
                                this.platform.log('[Reconnecting after client not being writable]');
                                this.platform.log(`Reconnection try number ${this.reconnectionCounter}`);
                                this.client.write(this.query('VERBOSE MODE'));
        
                            })
                        }
                    }
                    else {
        
                        //
                    }
                }, this.recoonectionWait);
        */
        //syncing//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



        setInterval(() => {

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
            this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness,this.currentVolume);
            this.bluRayInput.updateCharacteristic(this.platform.Characteristic.On, this.inputState[0]);
            this.hdmiIn.updateCharacteristic(this.platform.Characteristic.On, this.inputState[1]);
            this.hdmiOut.updateCharacteristic(this.platform.Characteristic.On, this.inputState[2]);



            /*
                        if (this.reconntionTry >= this.reconnectionCounter) {
                            this.platform.log(this.connectionLimit);
                            if (this.connectionLimit === false) {
                                this.platform.log('Maximum number of reconnection tries reached')
                                this.connectionLimit === true;
                                this.platform.log(this.connectionLimit);
            
                            }
                        }
            */
        }, this.config.pollingInterval);
    }


    /*
         * Handle "SET" requests from HomeKit
         * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
         */
    setOn(value, callback) {
        // implement your own code to turn your device on/off
        let oppoState = value;
        if (oppoState === true) {
            this.powerState_TV = 1;
            this.sending([this.pressedButton('POWER ON')]);

        }
        else if (oppoState === false) {
            this.powerState_TV = 0;
            this.sending([this.pressedButton('POWER OFF')]);
        }
        else {
            //
        }
        this.platform.log.debug('Set Characteristic On ->', value);
        // you must call the callback function
        callback(null);
    }

    getOn(callback) {
        // implement your own code to check if the device is on
        let isOn = false;
        isOn = this.powerState;
        //this.platform.log('new power status');
        this.platform.log.debug('Get Characteristic On ->', isOn);
        // you must call the callback function
        // the first argument should be null if there were no errors
        // the second argument should be the value to return
        callback(null, isOn);
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////Play
    playSwitchStateGet(callback) {
        this.platform.log.debug('Triggered GET On');
        // set this to a valid value for On
        let currentValue = this.playBackState[0];
        callback(null, currentValue);
    }

    playSwitchStateSet(value, callback) {
        this.platform.log.debug('Triggered SET On:', value);
        if (value === true) {
            this.sending([this.pressedButton('PLAY')]);
        }
        else if (value === false) {
            //this.sending([this.pressedButton('PAUSE')]);
        }
        else {
            //
        }
        callback(null);
    }

    /*
     
        bluRayInputStateGet(callback) {
            this.platform.log.debug('Triggered GET On');
            // set this to a valid value for On
            let currentValue = this.inputState[0];
            callback(null, currentValue);
        }
     
        bluRayInputStateSet(value, callback) {
            this.platform.log.debug('Triggered SET On:', value);
            if (value === true) {
                this.sending([this.pressedButton('BLURAY INPUT')]);
            }
            else if (value === false) {
                //this.sending([this.pressedButton('PAUSE')]);
            }
            else {
                //
            }
            callback(null);
        }
     
        hdmiInStateGet(callback) {
            this.platform.log.debug('Triggered GET On');
            // set this to a valid value for On
            let currentValue = this.inputState[1];
            callback(null, currentValue);
        }
     
        hdmiInStateSet(value, callback) {
            this.platform.log.debug('Triggered SET On:', value);
            if (value === true) {
                this.sending([this.pressedButton('HDMI IN')]);
            }
            else if (value === false) {
                //this.sending([this.pressedButton('PAUSE')]);
            }
            else {
                //
            }
            callback(null);
        }
     
        hdmiOutStateGet(callback) {
            this.platform.log.debug('Triggered GET On');
            // set this to a valid value for On
            let currentValue = this.inputState[2];
            callback(null, currentValue);
        }
     
        hdmiOutStateSet(value, callback) {
            this.platform.log.debug('Triggered SET On:', value);
            if (value === true) {
                this.sending([this.pressedButton('HDMI OUT')]);
            }
            else if (value === false) {
                //this.sending([this.pressedButton('PAUSE')]);
            }
            else {
                //
            }
            callback(null);
        }
    */

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////Pause

    pauseSwitchStateGet(callback) {
        this.platform.log.debug('Triggered GET On');
        // set this to a valid value for On
        let currentValue = this.playBackState[1];
        callback(null, currentValue);
    }
    /**
    * Handle requests to set the "Programmable Switch Output State" characteristic
    */
    pauseSwitchStateSet(value, callback) {
        this.platform.log.debug('Triggered SET On:', value);
        if (value === true) {
            this.sending([this.pressedButton('PAUSE')]);
        }
        else if (value === false) {
            //this.sending([this.pressedButton('PLAY')]);
        }
        else {
            //
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////stop

    stopSwitchStateGet(callback) {
        this.platform.log.debug('Triggered GET On');
        // set this to a valid value for On
        let currentValue = this.playBackState[2];
        callback(null, currentValue);
    }

    stopSwitchStateSet(value, callback) {
        this.platform.log.debug('Triggered SET On:', value);
        if (value === true) {
            this.sending([this.pressedButton('STOP')]);
        }
        else if (value === false) {
            //this.sending([this.pressedButton('PLAY')]);
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
            this.platform.log(`[Sending] ${JSON.stringify(press[i])}`);
            this.client.write(press[i]);
            i += 1;
        }
    }

    //////////Current Status//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    newPowerState(newValue) {
        if (newValue === true) {
            setTimeout(() => {
                this.sending(this.queryKeys(['HDR STATUS']));
            }, 2000);
            setTimeout(() => {
                this.sending(this.queryKeys(['PLAYBACK STATUS']));
            }, 2000);
            this.powerState_TV = 1;
        }
        else {
            this.powerState_TV = 0;
        }
        this.powerState = newValue;
        
        this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness,this.currentVolume);
        this.service.updateCharacteristic(this.platform.Characteristic.On, this.powerState);
        this.tvService.updateCharacteristic(this.platform.Characteristic.Active, this.powerState_TV);
        //this.platform.log(powerState);
    }
    newPlayBackState(newPlay) {
        this.playBackState = newPlay;
        this.play.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[0]);
        this.pause.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[1]);
        this.stop.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[2]);

        //this.platform.log(playBackState);
    }
    newHDRState(newHDR) {
        this.HDROutput = newHDR;

        this.dolbyVision.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[0]);
        this.hdr10.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[1]);
        this.SDR.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.HDROutput[2]);
        this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness,this.currentVolume);
        //this.platform.log(HDROutput);
    }
    newAudioType(newAT) {
        this.audioType = newAT;
        this.dolbySound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[0]);
        this.dtsSound.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.audioType[1]);



        //this.platform.log(audioType);
    }
    newInputState(newInput) {
        this.inputState = newInput;

        if (this.config.wholeRemote === true) {
            this.bluRayInput.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.inputState[0]);
            this.hdmiIn.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.inputState[1]);
            this.hdmiOut.updateCharacteristic(this.platform.Characteristic.MotionDetected, this.inputState[2]);

        }
        //this.platform.log(audioType);
    }
    ///Event decoder///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    eventDecoder(dataReceived) {
        const str = (`${dataReceived}`);
        const res = str.split('@');
        let i = 0;
        //this.platform.log(res);
        while (i < res.length) {
            if (res[i] === '') {
                //
            }
            else if (res[i].includes('OK OFF') || res[i].includes('POF OK OFF') || res[i].includes('UPW 0')) {
                this.newPowerState(false);
                this.newPlayBackState([false, false, false]);
                this.newHDRState([false, false, false]);
                this.newAudioType([false, false]);
                this.firstConnection === false;
            }/*
            else if (res[i].includes('POF OK OFF')) {
                //this.platform.log('power off');
                this.newPowerState(false);
                this.newPlayBackState([false, false, false]);
                this.newHDRState([false, false, false]);
                this.newAudioType([false, false]);
            }
            */
            else if (res[i].includes('PON OK') || res[i].includes('OK ON') || res[i].includes('UPW 1')) {
                this.newPowerState(true);

                if (this.firstConnection === true) {
                    this.platform.log('First Update');
                    this.sending(this.queryKeys(['PLAYBACK STATUS']));
                    //this.platform.log(query('HDR STATUS'));  
                    setTimeout(() => {
                        this.sending(this.queryKeys(['HDR STATUS']));
                    }, 2000);
                    this.firstConnection = false;
                }



            }


            else if (res[i].includes('UVL') || res[i].includes('QVL')) {

                let numberOnly = res[i].replace(/^\D+/g, '')
                this.currentVolume = parseInt(numberOnly, 10)

            }


            /*
            
            
            
            
            
            /*

            
            else if (res[i].includes('OK ON')) {
                this.newPowerState(true);
            }*/
            else if (res[i].includes('OK PLAY') || res[i].includes('UPL PLAY')) {
                this.newPlayBackState([true, false, false]);
            }
            else if (res[i].includes('OK PAUSE') || res[i].includes('UPL PAUS')) {
                this.newPlayBackState([false, true, false]);
            }
            else if (res[i].includes('OK STOP') || res[i].includes('UPL STOP')) {
                this.newPlayBackState([false, false, true]);
            }
            else if (res[i].includes('OK STEP') || res[i].includes('OK FREV') || res[i].includes('OK FREV') || res[i].includes('OK SCREEN')
                || res[i].includes('OK SFWD') || res[i].includes('OK SREV') || res[i].includes('UPL STPF') || res[i].includes('UPL STPR')
                || res[i].includes('UPL FFW1') || res[i].includes('UPL FRV1') || res[i].includes('UPL SFW1') || res[i].includes('UPL SRV1')
                || res[i].includes('ER OVERTIME') || res[i].includes('OK MEDIA') || res[i].includes('OK DISC') || res[i].includes('OK SETUP') || res[i].includes('UPL MCTR')
                || res[i].includes('UPL SCSV') || res[i].includes('UPL MENUP')) {
                this.newPlayBackState([false, false, false]);
            }

            else if (res[i].includes('OK 2')) {
                this.sending([this.query('POWER STATUS')]);
            }
            else if (res[i].includes('QVM OK 0')) {
                this.sending([this.pressedButton('VERBOSE MODE 2')]);
            }
            else if (res[i].includes('U3D 2D')) {
                this.sending(this.queryKeys(['PLAYBACK STATUS']));
                //this.platform.log(query('HDR STATUS'));  
                setTimeout(() => {
                    this.sending(this.queryKeys(['HDR STATUS']));
                }, 2000);
                //this.sending(this.queryKeys(['HDR STATUS']));
                // this.platform.log(this.query('HDR STATUS'));
            }
            else if (res[i].includes('OK HDR')) {
                this.newHDRState([false, true, false]);
            }
            else if (res[i].includes('OK SDR')) {
                this.newHDRState([false, false, true]);
            }
            else if (res[i].includes('OK DOV')) {
                this.newHDRState([true, false, false]);
            }
            else if (res[i].includes('BD-PLAYER')) {
                this.newInputState([true, false, false]);
            }
            else if (res[i].includes('HDMI-IN')) {
                this.newInputState([false, true, false]);
            }
            else if (res[i].includes('ARC-HDMI-OUT')) {
                this.newInputState([true, false, true]);
            }
            //unsolicited events
            /*
            else if (res[i].includes('UPW 1')) {
                this.newPowerState(true);
            }
            */
            else if (res[i].includes('UAT DT') || res[i].includes('UAT DP')) {
                this.newAudioType([true, false]);
            }
            else if (res[i].includes('UAT TM')) {
                this.newAudioType([false, true]);
            }
            else if (res[i].includes('UPL HOME') || res[i].includes('OK HOME')) {
                this.newPlayBackState([false, false, false]);
                this.newHDRState([false, false, true]);
                this.newAudioType([false, false]);
                this.sending([this.query('INPUT STATUS')]);
                this.sending([this.query('VOLUME STATUS')]);
            }
            /*
    
            
            else if (res[i].includes('OK FREV')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('OK FREV')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('OK SCREEN')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('OK SFWD')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('OK SREV')) {
                this.newPlayBackState([false, false, false]);
    
            }
    
            else if (res[i].includes('UPL STPF')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('UPL STPR')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('UPL FFW1')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('UPL FRV1')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('UPL SFW1')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('UPL SRV1')) {
                this.newPlayBackState([false, false, false]);
            }*/
            ///Video Type

            /*
            else if (res[i].includes('UPW 0')) {
                this.newPowerState(false);
                this.newPlayBackState([false, false, false]);
                this.newHDRState([false, false, false]);
                this.newAudioType([false, false]);
            }
            else if (res[i].includes('UPL PLAY')) {
                this.newPlayBackState([true, false, false]);
            }
            else if (res[i].includes('UPL PAUS')) {
                this.newPlayBackState([false, true, false]);
            }
            else if (res[i].includes('UPL STOP')) {
                this.newPlayBackState([false, false, true]);
            }
            */

            /*
            else if (res[i].includes('UPL MCTR')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('UPL SCSV')) {
                this.newPlayBackState([false, false, false]);
            }
            else if (res[i].includes('UPL MENUP')) {
                this.newPlayBackState([false, false, false]);
            }
            */

            /*
             else if (res[i].includes('ER OVERTIME')) {
                 this.newPlayBackState([false, false, false]);
             }
             else if (res[i].includes('OK HOME')) {
                 this.newPlayBackState([false, false, false]);
             }
             else if (res[i].includes('OK MEDIA')) {
                 this.newPlayBackState([false, false, false]);
             }
             else if (res[i].includes('OK DISC')) {
                 this.newPlayBackState([false, false, false]);
             }
             else if (res[i].includes('OK SETUP')) {
                 this.newPlayBackState([false, false, false]);
             }
             */

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
            // case "MEDIA NAME":
            //   key += "QFN";
            // break;      
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
        }
        key += '\r';
        return key;
    }

    /////Volume Change //////////////////////////////////////////////
    volumeChange(number) {
        let key;
        key = '#SVL ';
        key += number.toString();
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

        const exampleDevices = [
            {
                exampleUniqueId: 'AB1212D',
                exampleDisplayName: `${this.config.name} Power Switch`,
            },
        ];
        // loop over the discovered devices and register each one if it has not already been registered
        for (const device of exampleDevices) {
            // generate a unique id for the accessory this should be generated from
            // something globally unique, but constant, for example, the device serial
            // number or MAC address
            const uuid = this.api.hap.uuid.generate(device.exampleUniqueId);
            // see if an accessory with the same uuid has already been registered and restored from
            // the cached devices we stored in the `configureAccessory` method above
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            if (existingAccessory) {
                // the accessory already exists
                if (device) {
                    this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
                    // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
                    // existingAccessory.context.device = device;
                    // this.api.updatePlatformAccessories([existingAccessory]);
                    // create the accessory handler for the restored accessory
                    // this is imported from `platformAccessory.ts`
                    new oppoAccessory(this, existingAccessory);
                    // update accessory cache with any changes to the accessory details and information
                    this.api.updatePlatformAccessories([existingAccessory]);
                }
                else if (!device) {
                    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
                    // remove platform accessories when no longer present
                    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
                    this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
                }
            }
            else {
                // the accessory does not yet exist, so we need to create it
                this.log.info('Adding new accessory:', device.exampleDisplayName);
                // create a new accessory
                const accessory = new this.api.platformAccessory(device.exampleDisplayName, uuid);
                // store a copy of the device object in the `accessory.context`
                // the `context` property can be used to store any data about the accessory you may need
                accessory.context.device = device;
                // create the accessory handler for the newly create accessory
                // this is imported from `platformAccessory.ts`


                new oppoAccessory(this, accessory);
                // link the accessory to your platform
                this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
                //this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
        }
    }
}
module.exports = (api) => {
    api.registerPlatform(PLATFORM_NAME, oppoPlatform);
};
