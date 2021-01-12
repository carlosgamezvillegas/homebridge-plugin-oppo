# What is this?

Control your Oppo 203/205 from your iOS Device.

This is my first plugin for Homebridge. It needs a lot of work and hopefully I will be able to make it work better in the future. As of now, to make it work you have to do the following:

1. Enable IP control on your Oppo 203/205. Setup>Network Setup> IP Control:On
2. Set the Oppo to Network. Setup>Device Setup> Standby Mode:Network Standby
3. Make sure to turn on the Oppo before setting up homebridge, this is necessary to put the Oppo on VERBOSE MODE 2 and get unsolicited updates from the device.

If you have any suggestions/improvements please let know.

Enjoy!!


install using:

npm i homebridge-oppo-udp

In the config file under the platform section add the following:
            "name": "Oppo 203",
            "ip": "Youre IP Address", 
            "pollingInterval": 1000,
            "modelName": "UDP-203",
            "manufactur": "Oppo Digital Inc",
            "serialN": "B210U71647033894",
            "platform": "oppoPlugin"
            
            
Make sure you change the IP Address

Note: Right now plugin is published as an external device. After you include information in the config file and restart homebridge, please add accessory  manually the in the home app (just click add accessroy>I don't have a code or cannot scan>). The accessory should be visible there and to add it just use your Homebridge setup code.


