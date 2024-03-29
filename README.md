<span align="center">

# homebridge-oppo-udp
## HomeKit integration for Oppo UDP 203/205

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![homebridge-oppo-udp](https://badgen.net/npm/v/homebridge-oppo-udp?icon=npm)](https://www.npmjs.com/package/homebridge-oppo-udp)
[![mit-license](https://badgen.net/npm/license/lodash)](https://github.com/merdok/homebridge-plugin-oppo/blob/master/LICENSE)
</span>

</span>

# What is this?

`homebrige-oppo-udp` is a plugin for Homebridge to Control your Oppo 203/205 from your Home app. It should work with Oppo UDP-203 and UDP-205.


### Features
* HomeKit "TV Remote"
* HomeKit automations
* Turn TV on/off
* Play, Pause, and Stop switches
* Sound Output as sensors (Dolby Atmos and DTS)
* HDR Video format as sensors (HDR, Dolby Vision, and SDR)
* Input Selection
* Not Responding Sensor
### Optional Features
* Volume control (as light bulb, buttons or through iOS remote app) 
* Media control
* Chapter and Movie Progress control
* Navegation Control (Stateless switches)
* Input control
* The rests of the Remote buttons (Stateless switches)

# Preparation
1. Enable IP control on your Oppo 203/205. Go to Setup>Network Setup> IP Control:On
2. Set the Oppo to Network Standby mode.Go to Setup>Device Setup> Standby Mode:Network Standby
3. Make sure to turn on the Oppo before setting up homebridge, this is necessary to put the Oppo on VERBOSE MODE 2 and get unsolicited updates from the device.

# Installation
install using the following command in terminal:
```sh
npm i homebridge-oppo-udp
```

# Configuration

Add the `oppoPlugin` platform in `config.json` in your home directory inside `.homebridge`.

Example configuration:

```js
{
  "platforms": [
    {
            "name": "Oppo 203",
            "ip": "Youre IP Address", 
            "pollingInterval": 5000,
            "modelName": "UDP-203",
            "manufacture": "Oppo Digital Inc",
            "serialN": "B210U71647033894",
            "autoIP": false,
            "volume": false,
            "mediaButtons": false,
            "inputButtons":false,
            "movieControl": false,
            "NameOfTheButton": false,
            "newPlatformUUID":false,
            "chinoppo":false,
            "platform": "oppoPlugin"
}
]
}
```

### Adding the Oppo to the Home app
Since HomeKit expects only one Oppo per bridge they will be declared as external accessories and acts as a bridge.  
This means that a device will not appear in your Home app until you add it!

To add the Oppo to HomeKit follow this steps:

1. Open the Home <img src="https://user-images.githubusercontent.com/3979615/78010622-4ea1d380-738e-11ea-8a17-e6a465eeec35.png" height="16.42px"> app on your device.
2. Tap the Home tab, then tap <img src="https://user-images.githubusercontent.com/3979615/78010869-9aed1380-738e-11ea-9644-9f46b3633026.png" height="16.42px">.
3. Tap *Add Accessory*, and select *I Don't Have a Code or Cannot Scan* or *More Options...* whichever is available.
4. Select the accessory you want to pair.
5. Enter the Homebridge PIN, this can be found under the QR code in Homebridge UI or your Homebridge logs, alternatively you can select *Use Camera* and scan the QR code again.

For more info check the homebridge wiki [Connecting Homebridge To HomeKit](https://github.com/homebridge/homebridge/wiki/Connecting-Homebridge-To-HomeKit).

### Configuration
#### Platform Configuration fields
- `platform` [required]
Should always be **"oppoPlugin"**.
#### TV Configuration fields
- `name` [required]
Name of your Oppo.
- `ip` [required]
ip address of your TV.
- `pollingInterval` [optional]
The TV state background polling interval in seconds. **Default: 10000**
- `modelName` [optional]
Model name of your device
- `manufacture` [optional]
The manufcturer of your device
- `serialN` [optional]
Serial Number of your device
- `autoIP` [optional]
Set the IP address manually. Use this option if the device cannot be found automatically. **Default: false**
- `volume` [optional]
Enables volume control to the device as a lightbulg. **Default: false**
- `mediaButtons` [optional]
Allows control the playback state of your device. **Default: false**
- `inputButtons` [optional]
Adds input buttons. **Default: false**
- `NameOfTheButton` [optional]
Adds the button you want to add and can add as many as you want (refer to the button list bellow) **Default: false**

Button Name List is :
- cursorUpB
- cursorDownB 
- cursorLeftB
- cursorRightB
- cursorEnterB
- menuB
- backButtonB
- clearB 
- topMenuB
- optionB
- homeMenuB 
- infoB
- setupB
- goToB
- pageUpB
- pageDownB
- popUpMenuB
- dimmerB
- pureAudioB
- redB
- yellowB
- blueB
- audioB
- greenB
- subtitleB
- angleB
- zoomB
- sapB
- abReplayB
- repeatB 
- pipB 
- resolutionB
- threeDB
- pictureB 
- hdrButtonB 
- subtitleHoldB 
- infoHoldB 
- resolutionHoldB
- avSyncB
- gaplessPlayB
- inputB
- ejectDiscB

Note: You can add  buttons in the "Navagation Buttons" and "other Buttons" in Settings using Homebridge UI
- `newPlatformUUID` [optional]
Enable this if you do not see the accessory when you try to add it to the Home App after deleting it. It will also create a different accesssory every time you chage the Name of the device in Settings. If an old accessory already exists in the Home App you will have to remove it manually. **Default: false**
- `chinoppo` [optional]
Enable this in case the Oppo clone does not turn on with the On/Off button. It sends the Eject command instead. **Default: false**

## Troubleshooting
If you have any issues with the plugin or Oppo services then you can run homebridge in debug mode, which will provide some additional information. This might be useful for debugging issues.

Homebridge debug mode:
```sh
homebridge -D
```

Deep debug log, add the following to your config.json:
```json
"deepDebugLog": true
```
This will enable additional extra log which might be helpful to debug all kind of issues. Just be aware that this will produce a lot of log information so it is recommended to use a service like https://pastebin.com/ when providing the log for inspection.

Note: Controls won't update if the plugin does not receive a confirmation message from the device

## Known Issues
 The Oppo player tends to disconnect from Hemebridge frequently after a while for no apparent reason. So, to get a stable connection again you need to do the following:
 - Disable IP Controls and Network Standby
 - Power cycle the device
 - Enable IP Controls and Network Standby
 - Keep the device turned on
 - Reset Homebridge 


## Special thanks
To Fernando for his patience and support.

If you have any suggestions/improvements please let know.

Enjoy!!
