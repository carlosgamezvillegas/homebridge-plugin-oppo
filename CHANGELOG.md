# Changelog
## [4.1.0] - 2023-01-26
### Added
-Added the ability to change the Volume, Movie Progress, Chapter Progress, and the Chapter Selector from Dimmers to Fans
## [4.0.2] - 2023-01-20
### Changed
- An infinite commonad loop has been fixed preventing Homebridge from crashing
## [4.0.1] - 2022-07-09
### Changed
- A Typo in the code that prevented the code to load correctly was fixed
## [4.0.0] - 2022-05-07
### Changed
- The device no longers opens the tray when turned on from the Homekit remote control
### Added
- The device IP can be found automatically now, it takes 10 seconds to capture UDP broadcast
## [3.2.3] - 2022-04-16
- Bug fixes
## [3.2.2] - 2022-03-08
- Stateless switch (button) goes to off state faster
- Fixed a typo that prevented one button to be created
## [3.2.1] - 2022-02-22
- Fixed typo that prevented the plugin from loading
## [3.2.0] - 2022-01-06
- Bug fixes
### Changed
- Improvements in text
- improvements to the Current State of the device
- Power Switch is optional
### Added
- Sound and Video State Sensors are optional
- Movie Progress, Chapter Progress, and Chapter Selector can be added individually
### Note
- To avoid any HTTP communication issues connect to the 
## [3.1.3] - 2021-03-27
- Bug fixes
## [3.1.1] - 2021-03-14
- Movie name bug fixed
### Changed
- TCP commands are going to be sent when HTTP commands are not working. Note: TCP connection drops the connection when the device is connected through Ethernet more often than when it is connected through WiFi.
## [3.1.0] - 2021-03-07
- Bug fixes
### Changed
- Most of the commands are sent through HTTP now. HTTP is more reliable and even when the Sensor "Oppo Not Responding" is on, the device will continue to execute most of the commands. When "Oppo Not Responding" is on, query requests and other requests are not going to work. 
## [3.0.3] - 2021-02-27
- Bug fixes
## [3.0.2] - 2021-02-22
- Bug fixes
## [3.0.1] - 2021-02-21
- Bug fixes
### Added
- Support for Oppo Clones (Chinoppos) by sending the EJT command instead of POWER ON to wake up the device
- When the Oppo is not responding to the TCP/IP Commands, the plugin is going to send them using HTTP Get. Chapter controls, Audio Type, Video Type, and others are not going to work when this happens.
## [2.5.4] - 2021-02-14
- Bug fixes
### Added
- Inputs for Oppo 205
- Sensor indicating that the device is not responding
### Changed
- Sending and Response Logs
## [2.4.7] - 2021-02-06
- Bug fixes
## [2.4.6] - 2021-02-06
- Bug fixes to the Movie and Chapter Progress status
### Added
- The ability to create an accessory with a different UUID
## [2.4.5] - 2021-01-30
- Fixed Movie Progress and Chapter Progress
## [2.4.3] - 2021-01-26
- Bug fixes
## [2.4.0] - 2021-01-17
### Added
- Movie and Chapter progress as a dimmer
- Chapter selector as dimmer
### Changed
- Improved Oppo status reporting
- Improved error logging
## [2.3.1] - 2021-01-17
- Exposes the Oppo as a TV Accessory (If you are updating the plugin you need to remove it from the Home app and add it again to see the change)
## [2.2.1] - 2021-01-16
- Bug fixes
## [1.5.0] - 2021-01-13
### Changed
- Improved Oppo status reporting
- Improved error logging
### Added
- Current Media Status
- Input source selection
- Volume control in TV remote control

