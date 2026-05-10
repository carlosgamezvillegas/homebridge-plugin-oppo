# Changelog
## [6.0.1] - 2026-05-09
- Bug Fixes
## [6.0.0] - 2026-05-02
### Changed
- Updated the Homebridge engine range to `>=1.0.0 || ^2.0.0-alpha.0` for compatibility with Homebridge 2.0 pre-release and stable versions.
- Refactored constructor-heavy setup into focused builders to reduce initialization complexity:
  - `buildSpeakerVolumeService()`
  - `buildVideoMovieControls()`
  - `buildAdditionalServices()`
  - `buildInputSources()`
- Refactored `buildVideoMovieControls()` and `buildAdditionalServices()` to reduce repeated HomeKit service setup blocks while preserving existing service names/IDs and behavior.
- Reworked event decoding flow so `eventDecoder()` delegates to focused handlers (`handleEventWithRules`, `handlePlaybackEvent`, `handleVolumeEvent`) instead of keeping all logic in one large chain.
- Replaced repeated branch logic with rule tables for command names/logging, playback states, audio decoding, language decoding, and HTTP route mapping.
- Updated sync/state propagation to avoid unnecessary HomeKit writes by using `updateCharacteristicIfChanged()`.
- Improved metadata visibility handling with helper-driven updates (`refreshShowState`, `updateConfiguredNameAndVisibility`, `updateServiceVisibility`).
- Improved reconnect/timer handling with explicit helpers (`clearReconnectAttempt`, `clearReconnectTimers`, `scheduleReconnectAttempt`, `scheduleTimer`, `cancelScheduledTimersByPrefix`).
- Improved command dispatch path by extracting command parsing into `extractCommandCode()` and avoiding in-place mutation of outbound command arrays.
- Switched reusable characteristic wiring from repeated `addCharacteristic(...)` patterns to `getCharacteristic(...)` where appropriate to avoid duplicate characteristic registration risk.
- Split utility logic into dedicated modules (`lib/command-utils.js`, `lib/runtime-validation.js`) to reduce `index.js` coupling and improve testability.
- Enabled `// @ts-check` plus JSDoc typedef annotations to strengthen static typing signals in JavaScript code.

### Added
- New reusable service factories/helpers to centralize HomeKit setup:
  - `createConfiguredService()`
  - `createStatefulSwitch()`
  - `createInputButtonSwitch()`
  - `createMotionSensorService()`
  - `createStatelessSwitch()`
  - `buildDualModeProgressService()`
  - `createInputSourceService()` / `getOrCreateInputSource()`
- Added query/transport guard helpers:
  - query cooldown guard (`canSendQuery`)
  - command-name cache (`cacheCommandName`)
  - debug log rate limiter (`debugLogRateLimited`)
  - TCP write safety wrapper (`safeClientWrite`)
  - HTTP failure accounting and timeout handling in `sendHttp()`
- Added AVCHD name parsing helper (`extractAvchdInputName`) to stabilize media title extraction from nested paths.
- Added detailed method-level comments throughout `index.js` to explain function intent and behavior.
- Added a benchmark harness (`benchmarks/performance.benchmark.js`) and npm script (`benchmark`) for repeatable micro-benchmarking of hot paths.
- Added integration/fault tests (`tests/integration.test.js`) and fixture replay data (`tests/fixtures/oppo-event-replay.log`) covering event replay, malformed HTTP payloads, reconnect storm dedupe, and runtime state normalization.
- Added runtime config/state validation guards (`validateRuntimeConfig`, `validateStateInvariants`) plus normalization helpers for playback/input vectors.

### Fixed
- Fixed strictness and safety regressions around transport/control paths by consolidating logic into shared helpers and removing duplicated branches.
- Fixed style/cleanliness issues in source formatting (removed trailing whitespace and corrected minor syntax/style typos).
- Fixed a visibility-state crash in partial/mock HomeKit runtimes by making `updateServiceVisibility()` tolerate missing visibility characteristic enums and skipping unsupported writes safely.

### Notes
- `autoIP` behavior was intentionally kept unchanged.

## [5.1.0] - 2024-05-23
### Changed
- Bug Fixes
### Added
- Added a Movie Timer
- Added the option to change the Info button in the Remote to the Menu button
## [5.0.0] - 2022-06-26
### Changed
- Bug Fixes
### Added
- TV app selector now shows information about the media being played
- Video and Audio Format sensors are optional
## [4.1.0] - 2022-08-31
### Added
- Added the ability to change the Volume, Movie Progress, Chapter Progress, and the Chapter Selector from Dimmers to Fans
### Changed
- Bug Fixes
## [4.0.2] - 2023-01-20
### Changed
- An infinite command loop has been fixed preventing Homebridge from crashing
## [4.0.1] - 2022-05-07
### Changed
- Typo fixed that prevented the plugin to load correctly
## [4.0.0] - 2022-05-07
### Changed
- The device no longer opens the tray when turned on from the HomeKit remote control
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
- Improvements in Current State of the device
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
- Most of the commands are sent though HTTP now. HTTP is more reliable and even when the Sensor "Oppo Not Responding" is on, the device will continue to excute most of the commands. When "Oppo Not Responding" is on, query requests and other request are not going to work. 
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
- Exposes the Oppo as a TV Accessory (If you are updating the plugin you need remove it from the Home app and add it again to see the change)
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
