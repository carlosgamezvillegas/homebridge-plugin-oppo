# What is this?

Control your Oppo 203/205 from your iOS Device.

This is my first plugin for Homebridge. It needs a lot of work and hopefully I will be able to make it work better in the future. As of now, to make it work you have to do the following:

1. Enable IP control on your Oppo 203/205. Setup>Network Setup> IP Control:On
2. Set the Oppo to Network. Setup>Device Setup> Standby Mode:Network Standby
3. Make sure to turn on the Oppo before setting up homebridge, this is necessary to put the Oppo on VERBOSE MODE 2 and get unsolicited updates from the device.

If you have any suggestions/improvements please let know.

Enjoy!!
### Features
* HomeKit TV integration
* HomeKit automations
* Turn TV on/off
* Mute/Unmute
* Volume control (as light bulb, buttons or through iOS remote app)
* Change sound output
* Switch inputs
* Media control
* Emulate remote control
* Turn on/off the the device


# Installation
install using the following command in terminal:
```sh
npm i homebridge-oppo-udp
```

# Configuration

Add the `oppoPlugin"` platform in `config.json` in your home directory inside `.homebridge`.

Example configuration:

```js
{
  "platforms": [
    {
          "name": "Oppo 203",
            "ip": "Youre IP Address", 
            "pollingInterval": 1000,
            "modelName": "UDP-203",
            "manufactur": "Oppo Digital Inc",
            "serialN": "B210U71647033894",
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
