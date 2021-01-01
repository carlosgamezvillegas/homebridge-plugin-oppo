import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Service, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';




import console from 'console';

import net from 'net';
const OPPO_IP ='69.104.58.112';
const OPPO_PORT = 23;
//const timer;
const timeout = 2000;
let powerState = false;
let playBackState = [false, false, false];
let HDROutput = [false, false, false];
let audioType=[false, false];
let key = '';
//const client;
let powerState_TV = 0;

key = query('VERBOSE MODE');

//console.log(key);
///Connection to Oppo/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const client = new net.Socket()
  .on('data', (data) => {
    clearTimeout(timer);
    console.log(`[oppo-udp-20x] [Response] ${data}`);

    eventDecoder(data);


    // client.destroy(); // kill client after server's response
  });
client.on('error', (e) => {
  clearTimeout(timer);
  console.log(`[oppo-udp-20x] [Error] ${e}`);
  console.log(`[oppo-udp-20x] [Trying to reconnect] ${e}`);
  reconnect();


});

function reconnect(){

  client.connect(OPPO_PORT, OPPO_IP, () => {
    clearTimeout(timer);
    console.log(`[oppo-udp-20x] [Sending] ${JSON.stringify(key)}`);
  
  
    client.write(key);
  
  });

}


client.connect(OPPO_PORT, OPPO_IP, () => {
  clearTimeout(timer);
  console.log(`[oppo-udp-20x] [Sending] ${JSON.stringify(key)}`);


  client.write(key);

});

const timer = setTimeout(() => {
  console.log('[ERROR] Attempt at connection exceeded timeout value');
  // client.destroy();
}, timeout);



/////Sending Instructions/////////////////////////////////////////////////////////////////////////////////////////////////////
function sending(press) {

  let i = 0;


  while (i < press.length) {

    console.log(`[oppo-udp-20x] [Sending] ${JSON.stringify(press[i])}`);
    client.write(press[i]);
    i += 1;
  }
}



//////////Current Status//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function newPowerState(newValue) {

  if(newValue===true){
    setTimeout(() => {
      sending(queryKeys(['HDR STATUS']))
      ;
    }, 2000);
    setTimeout(() => {
      sending(queryKeys(['PLAYBACK STATUS']))
      ;
    }, 2000);

    powerState_TV=1;
  } else{
    powerState_TV=0;
  }

  powerState=newValue;
  //console.log(powerState);

}

function newPlayBackState(newPlay) {
  playBackState = newPlay;


  //console.log(playBackState);

}


function newHDRState(newHDR) {
  HDROutput = newHDR;
  //console.log(HDROutput);
}

function newAudioType(newAT) {
  audioType = newAT;
  //console.log(audioType);
}



////Get values

function getPowerStatus(){
  return powerState;
  

}




///Event decoder///////////////////////////////////////////////////////////////////////////////////////////////////////////////


function eventDecoder(dataReceived) {
 


  const str = (`${dataReceived}`);
  const res = str.split('@');

  let i = 0;
  //console.log(res);


  while (i < res.length) {
    if (res[i] === '') {
      //
    } else if (res[i].includes('OK OFF')) {
      newPowerState(false);
      newPlayBackState([false, false, false]);
      newHDRState([false, false, false]);
      newAudioType([false, false]);
    } else if (res[i].includes('POF OK OFF')) {
      //console.log('power off');
      newPowerState(false);
      newPlayBackState([false, false, false]);
      newHDRState([false, false, false]);
      newAudioType([false, false]);
    } else if (res[i].includes('PON OK')) {

      
      newPowerState(true);
     
    } else if (res[i].includes('OK ON')) {
      newPowerState(true);
   
    } else if (res[i].includes('OK PLAY')) {
      newPlayBackState([true, false, false]);

    } else if (res[i].includes('OK PAUSE')) {
      newPlayBackState([false, true, false]);

    } else if (res[i].includes('OK STOP')) {
      newPlayBackState([false, false, true]);

    } else if (res[i].includes('OK STEP')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK FREV')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK FFWD')) {
      newPlayBackState([false, false, false]);

      

    } else if (res[i].includes('OK SCREEN')) {
      newPlayBackState([false, false, false]);

      

    } else if (res[i].includes('OK SFWD')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK SREV')) {
      newPlayBackState([false, false, false]);

    }
    ///Video Type
    else if (res[i].includes('OK HDR')) {
      newHDRState([false, true, false]);

    } else if (res[i].includes('OK SDR')) {

      newHDRState([false, false, true]);
    } else if (res[i].includes('OK DOV')) {

      newHDRState([true, false, false]);
    }

    //unsolicited events
    else if (res[i].includes('UPW 1')) {
      newPowerState(true);

    } else if (res[i].includes('UPW 0')) {
      newPowerState(false);
      newPlayBackState([false, false, false]);
      newHDRState([false, false, false]);
      newAudioType([false, false]);

    } else if (res[i].includes('UPL PLAY')) {
      newPlayBackState([true, false, false]);

    } else if (res[i].includes('UPL PAUS')) {
      newPlayBackState([false, true, false]);

    } else if (res[i].includes('UPL STOP')) {
      newPlayBackState([false, false, true]);

    } else if (res[i].includes('UPL STPF')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL STPR')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL FFW1')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL FRV1')) {

      newPlayBackState([false, false, false]);
    } else if (res[i].includes('UPL SFW1')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL SRV1')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL HOME')) {
      
      newPlayBackState([false, false, false]);
      newHDRState([false, false, true]);
      newAudioType([false, false]);

    } else if (res[i].includes('UPL MCTR')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL SCSV')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL MENUP')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('UAT DT')) {
      newAudioType([true, false]);

    } else if (res[i].includes('UAT TM')) {
      newAudioType([false, true]);
      
      
    } else if (res[i].includes('ER OVERTIME')) {
      newPlayBackState([false, false, false]);
    

    } else if (res[i].includes('OK HOME')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK MEDIA')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK DISC')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK SETUP')) {
      newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK 2')) {
      sending([query('POWER STATUS')]);
  
    } else if (res[i].includes('QVM OK 0')) {
      sending([pressedButton('VERBOSE MODE 2')]);
  
    } else if (res[i].includes('U3D 2D')) {
     
      
      sending(queryKeys(['PLAYBACK STATUS']));
      //console.log(query('HDR STATUS'));  
      setTimeout(() => {
        sending(queryKeys(['HDR STATUS']))
        ;
      }, 2000);

      //sending(queryKeys(['HDR STATUS']));
      // console.log(query('HDR STATUS'));
    } else {
      //
    }
   
    i += 1;

  }


}



///Query////////////////////////////////////////////////////////////////////////////////////////////////////
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






/////oppo controls/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

    case 'REWIND':
      key += 'REV';
      break;

    case 'FORWAD':
      key += 'FWD';
      break;
  

  }

  key += '\r';
  return key;
}



function updateAll(){
  
  const queryAll=['POWER STATUS', 'PLAYBACK STATUS', 'HDR STATUS', 'AUDIO TYPE'];
  const KEYS=queryKeys(queryAll);
  return KEYS;
}

function updatePlayback(){
  
  const queryPlayback=['PLAYBACK STATUS'];
  const KEYS=queryKeys(queryPlayback);
  return KEYS;
     
}

function updateHDRStatus(){

  const queryHDR=['HDR STATUS'];
  const KEYS=queryKeys(queryHDR);
  return KEYS;
}

function turnOffAll(){

  newPowerState(false);
  newHDRState([false, false, false]);
  newPlayBackState([false, false, false]);
  newAudioType([false, false]);


}

/////platform acccessory///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
class oppoAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private oppoStates = {
    On: false,
    Brightness: 100,
  };

  constructor(
    private readonly platform: oppoPlatform,
    private readonly accessory: PlatformAccessory,
    
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Oppo')
      .setCharacteristic(this.platform.Characteristic.Model, 'UDP-203')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'B210U71647033894');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .on('get', this.getOn.bind(this));               // GET - bind to the `getOn` method below


      
    const play = this.accessory.getService('Play Switch') ||
      this.accessory.addService(this.platform.Service.Switch, 'Play Switch', 'YourUniqueIdentifier-10');
    
    play.getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.playSwitchStateGet.bind(this))
      .on('set', this.playSwitchStateSet.bind(this));

    const pause = this.accessory.getService('Pause Switch') ||
        this.accessory.addService(this.platform.Service.Switch, 'Pause Switch', 'YourUniqueIdentifier-11');
  
  
    pause.getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.pauseSwitchStateGet.bind(this))
      .on('set', this.pauseSwitchStateSet.bind(this));

    const stop = this.accessory.getService('Stop Switch') ||
          this.accessory.addService(this.platform.Service.Switch, 'Stop Switch', 'YourUniqueIdentifier-12');
    
    
    stop.getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.stopSwitchStateGet.bind(this))
      .on('set', this.stopSwitchStateSet.bind(this));
  

    /**
     * Creating multiple services of the same type.
     * 
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     * 
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    
    const dolbyVision = this.accessory.getService('Dolby Vision Video') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Vision Video', 'YourUniqueIdentifier-1');

    const hdr10 = this.accessory.getService('HDR 10 Video') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'HDR 10 Video', 'YourUniqueIdentifier-2');

    const SDR = this.accessory.getService('SDR Video') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'SDR Video', 'YourUniqueIdentifier-3');

    //

    /*
    const playState = this.accessory.getService('Play Status') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Play Status', 'YourUniqueIdentifier-4');

    const stopState = this.accessory.getService('Stop Status') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Stop Status', 'YourUniqueIdentifier-5');

    const pauseState = this.accessory.getService('Pause Status') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Pause Status', 'YourUniqueIdentifier-6');

    */

    const dolbySound = this.accessory.getService('Dolby Atmos') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Dolby Atmos', 'YourUniqueIdentifier-8');

    const dtsSound = this.accessory.getService('DTS') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'DTS', 'YourUniqueIdentifier-9');
    /////////Television Controls///////////////////////////////////////////////////////////////////////////////////////////
    // add the tv service
    


    const tvService = this.accessory.getService('Oppo 203') || 
    this.accessory.addService(this.platform.Service.Television, 'Oppo 203', 'YourUniqueIdentifier-7');

    // set the tv name
    tvService.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Oppo 203');
  
    // set sleep discovery characteristic
    tvService.setCharacteristic(this.platform
      .Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
  
    // handle on / off events using the Active characteristic
    tvService.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', (newValue, callback) => {
        this.platform.log.info('set Active => setNewValue: ' + newValue);
        if (newValue === 1){
          sending([pressedButton('POWER ON')]);
          newPowerState(true);
        } else if (newValue===0){
          newPowerState(false);
          sending([pressedButton('POWER OFF')]); 
        } else {
          //
        }
       
        callback(null);
      });
  
    // tvService.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, 1);
  
    /*/ handle input source changes
    tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .on('set', (newValue, callback) => {
  
        // the value will be the value you set for the Identifier Characteristic
        // on the Input Source service that was selected - see input sources below.
  
        this.platform.log.info('set Active Identifier => setNewValue: ' + newValue);
        callback(null);
      });
      */
  
    // handle remote control input
    tvService.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .on('set', (newValue, callback) => {
        switch(newValue) {
          case this.platform.Characteristic.RemoteKey.REWIND: {
            
            this.platform.log.info('set Remote Key Pressed: REWIND');
            sending([pressedButton('REWIND')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
            this.platform.log.info('set Remote Key Pressed: FAST_FORWARD');
            sending([pressedButton('FORWARD')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
            this.platform.log.info('set Remote Key Pressed: NEXT_TRACK');
            sending([pressedButton('NEXT')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
            this.platform.log.info('set Remote Key Pressed: PREVIOUS_TRACK');
            sending([pressedButton('PREVIOUS')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_UP: {
            this.platform.log.info('set Remote Key Pressed: ARROW_UP');
            sending([pressedButton('CURSOR UP')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
            this.platform.log.info('set Remote Key Pressed: ARROW_DOWN');
            sending([pressedButton('CURSOR DOWN')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
            this.platform.log.info('set Remote Key Pressed: ARROW_LEFT');
            sending([pressedButton('CURSOR LEFT')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
            this.platform.log.info('set Remote Key Pressed: ARROW_RIGHT');
            sending([pressedButton('CURSOR RIGHT')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.SELECT: {
            this.platform.log.info('set Remote Key Pressed: SELECT');
            sending([pressedButton('CURSOR ENTER')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.BACK: {
            this.platform.log.info('set Remote Key Pressed: BACK');
            sending([pressedButton('BACK')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.EXIT: {
            this.platform.log.info('set Remote Key Pressed: EXIT');
            sending([pressedButton('HOME MENU')]);
            break;
          }
          case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
            this.platform.log.info('set Remote Key Pressed: PLAY_PAUSE');
            if (playBackState[0]===false){
              sending([pressedButton('PLAY')]);
            } else if (playBackState[0]===true){
              sending([pressedButton('PAUSE')]);
            } else{
              //
            }
            break;
          }
          case this.platform.Characteristic.RemoteKey.INFORMATION: {
            this.platform.log.info('set Remote Key Pressed: INFORMATION');
            sending([pressedButton('INFO')]);
            break;
          }
        }
  
        // don't forget to callback!
        callback(null);
      });









    //syncing//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Updating characteristics values asynchronously.
     * 
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     * 
     */
    // const MotionDetected = false;
    setInterval(() => {

      //console.log('Updating');
      // console.log(powerState, HDROutput, powerState_TV, playBackState, audioType);
      // EXAMPLE - inverse the trigger
      // MotionDetected = !MotionDetected;
      //this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(powerState);
      // push the new value to HomeKit
      this.service.updateCharacteristic(this.platform.Characteristic.On, powerState);
      dolbyVision.updateCharacteristic(this.platform.Characteristic.MotionDetected, HDROutput[0]);
      hdr10.updateCharacteristic(this.platform.Characteristic.MotionDetected, HDROutput[1]);
      SDR.updateCharacteristic(this.platform.Characteristic.MotionDetected, HDROutput[2]);
      // playState.updateCharacteristic(this.platform.Characteristic.MotionDetected, playBackState[0]);
      // pauseState.updateCharacteristic(this.platform.Characteristic.MotionDetected, playBackState[1]);
      // stopState.updateCharacteristic(this.platform.Characteristic.MotionDetected, playBackState[2]);
      tvService.updateCharacteristic(this.platform.Characteristic.Active, powerState_TV);
      play.updateCharacteristic(this.platform.Characteristic.On, playBackState[0]);
      pause.updateCharacteristic(this.platform.Characteristic.On, playBackState[1]);
      stop.updateCharacteristic(this.platform.Characteristic.On, playBackState[2]);
      dolbySound.updateCharacteristic(this.platform.Characteristic.MotionDetected, audioType[0]);
      dtsSound.updateCharacteristic(this.platform.Characteristic.MotionDetected, audioType[1]);
      //this.platform.log.debug('Triggering dolbyVision:',HDROutput[0]);
      //this.platform.log.debug('Triggering hdr10:', HDROutput[1]);
    }, 1000);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to turn your device on/off
    this.oppoStates.On = value as boolean;
    if (this.oppoStates.On === true){
      powerState_TV=1;
      sending([pressedButton('POWER ON')]);
    } else if(this.oppoStates.On === false){
      powerState_TV=0;
      sending([pressedButton('POWER OFF')]);
    } else{
      //
    }


    this.platform.log.debug('Set Characteristic On ->', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    let isOn = this.oppoStates.On;
    isOn=getPowerStatus();
    //console.log('new power status');

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////Play




  /**
   * Handle requests to get the current value of the "Programmable Switch Output State" characteristic
   */
  playSwitchStateGet(callback) {
    this.platform.log.debug('Triggered GET On');

    // set this to a valid value for On
    const currentValue = playBackState[0];

    callback(null, currentValue);
  }

  /**
   * Handle requests to set the "Programmable Switch Output State" characteristic
   */
  playSwitchStateSet(value, callback) {
    this.platform.log.debug('Triggered SET On:', value);
    
    if (value === true){
      sending([pressedButton('PLAY')]);
    } else if(value === false){
      //sending([pressedButton('PAUSE')]);
    } else{
      //
    }

    callback(null);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////Pause



  /**
 * Handle requests to get the current value of the "Programmable Switch Output State" characteristic
 */
  pauseSwitchStateGet(callback) {
    this.platform.log.debug('Triggered GET On');

    // set this to a valid value for On
    const currentValue = playBackState[1];

    callback(null, currentValue);
  }

  /**
 * Handle requests to set the "Programmable Switch Output State" characteristic
 */
  pauseSwitchStateSet(value, callback) {
    this.platform.log.debug('Triggered SET On:', value);
    if (value === true){
      sending([pressedButton('PAUSE')]);
    } else if(value === false){
      //sending([pressedButton('PLAY')]);
    } else{
      //
    }

    callback(null);
  }
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////stop


 


  /**
 * Handle requests to get the current value of the "Programmable Switch Output State" characteristic
 */
  stopSwitchStateGet(callback) {
    this.platform.log.debug('Triggered GET On');

    // set this to a valid value for On
    const currentValue = playBackState[2];

    callback(null, currentValue);
  }

  /**
 * Handle requests to set the "Programmable Switch Output State" characteristic
 */
  stopSwitchStateSet(value, callback) {
    this.platform.log.debug('Triggered SET On:', value);
    if (value === true){
      sending([pressedButton('STOP')]);
    } else if(value === false){
      //sending([pressedButton('PLAY')]);
    } else{
      //s
    }
    
    callback(null);
  }



}







//// Platform/////////////////////////////////////////////////////////////////////////////////////////////////
class oppoPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('fd didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    // EXAMPLE ONLY
    // A real plugin you would discover accessories from the local network, cloud services
    // or a user-defined array in the platform config.
    const exampleDevices = [
      {
        exampleUniqueId: 'AB1212D',
        exampleDisplayName: 'Oppo On Switch',
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
        } else if (!device) {
          // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
          // remove platform accessories when no longer present
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
        }
      } else {
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






















/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, oppoPlatform);

};
