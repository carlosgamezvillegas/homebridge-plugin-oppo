<span align="center">

# homebridge-oppo-udp
## HomeKit integration for Oppo UDP 203/205

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

</span>

# What is this?

`homebrige-oppo-udp` is a plugin for homebridge to Control your Oppo 203/205 from your Home app. It should work with Oppo UDP-203 and UDP-205.


### Features
* HomeKit "TV Remote"
* HomeKit automations
* Turn TV on/off
* Play, Pause, and Stop switches
* Sound Output as sensors (Dolby Atmos and DTS)
* HDR Video forma as sensors (HDR, Dolby Vision, and SDR)
* Input Selection
### Optional Features
* Volume control (as light bulb, buttons or through iOS remote app) 
* Media control
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
            "pollingInterval": 1000,
            "modelName": "UDP-203",
            "manufacture": "Oppo Digital Inc",
            "serialN": "B210U71647033894",
            "volume": false,
            "mediaButtons": false,
            "inputButtons":false,
            "movieControl": false,
            "oppo205":false,
            "NameOfTheButton":false,
            "platform": "oppoPlugin"
}
]
}
```

Make sure you change the IP Address the one the devices is currently using.


### Adding the Oppo to the Home app
Since HomeKit expects only one Oppo per bridge they will be declared as external accessories and acts as a bridge.  
This means that a device will not appear in your Home app until you add it!

To add the Oppo to HomeKit follow this steps:

1. Open the Home <img src="https://user-images.githubusercontent.com/3979615/78010622-4ea1d380-738e-11ea-8a17-e6a465eeec35.png" height="16.42px"> app on your device.
2. Tap the Home tab, then tap <img src="https://user-images.githubusercontent.com/3979615/78010869-9aed1380-738e-11ea-9644-9f46b3633026.png" height="16.42px">.
3. Tap *Add Accessory*, and select *I Don't Have a Code or Cannot Scan*.
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
- `volume` [optional]
Enables volume control to the device as a lightbulg. **Default: false**
- `mediaButtons` [optional]
Allows control the playback state of your device. **Default: false**
- `inputButtons` [optional]
Adds input buttons. **Default: false**
- `oppo205` [optional]
Adds inputs exclusive to Oppo 205. **Default: false**
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

Note: You can add  buttons in the "Navagation Buttons" and "other Buttons" in Settings using Hombridge UI
- `newPlatformName` [optional]
Enable this when if you do not see the accessory when you try to add it to the Home App. It will create a  different accessroy every time you chage the Name of the device in Settings. You will have to remove manually an old accessory if it exists in Homekit. **Default: false**

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
 The Oppo player tends to disconnect from hombridge frequently after a while for no apparent reason. So, to get a stable connection again you need to do the following:
 - Disable IP Controls and Network Standby
 - Power cycle the device
 - Enable IP Controls and Network Standby
 - Keep the device turned on
 - Reset hombridge 

## Special thanks
To Fernando for his patience and support.

If you have any suggestions/improvements please let know.

Enjoy!!


