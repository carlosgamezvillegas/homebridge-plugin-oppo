# Changelog
## [3.1.0] - 2021-03-07
- Bug fixes
### Changed
- Most of the commands are sent though HTTP now. HTTP is more reliable and even when the Sensor "Oppo Not Responding" is on, the device will continue to excute most of the commands. When "Oppo Not Responding" is on, query requests and other commands are not going to work. 
## [3.0.3] - 2021-02-27
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
- Sensor indicating that Oppo is not executing commands being sent
### Changed
- Sending and Response Logs
## [2.4.7] - 2021-02-06
- Bug fixes
## [2.4.6] - 2021-02-06
- Bugs fixes to the Movie and Chapter Progress status
### Added
- The ability to create an accessory with a different UUID
## [2.4.5] - 2021-01-30
- Fixed Movie Progress and Chapter Progress
## [2.4.3] - 2021-01-26
- Bug fixes
## [2.4.0] - 2021-01-17
### Added
- Movie and Chapter progress as Lightbulb Dimmer
- Chapter selector as Lightbulb Dimmer
### Changed
- Improved Oppo status reporting
- Improved error logging
## [2.3.1] - 2021-01-17
- Exposes the Oppo as a TV Accessory (If you are updating the plugin you need remove it from the Home app and add it again to see the change)
## [2.2.1] - 2021-01-16
- Bug fixes
## [1.5.0] - 2021-01-13
### Changed
- Improved Oppo status reporting
- Improved error logging
### Added
- Current Media Status
- Input sourse selection
- Volume control in TV remote control
