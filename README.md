[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/gchokov/homebridge-foobot)
[![HitCount](http://hits.dwyl.io/gchokov/homebridge-foobot.svg)](http://hits.dwyl.io/gchokov/homebridge-foobot)
[![GitHub last commit](https://img.shields.io/github/last-commit/gchokov/homebridge-foobot.svg)](https://github.com/gchokov/homebridge-foobot)
[![npm](https://img.shields.io/npm/v/homebridge-foobot.svg)](https://www.npmjs.com/package/homebridge-foobot)

# homebridge-foobot
This is a [homebridge](https://github.com/nfarina/homebridge) plugin which lets you integrate your [Foobot](https://foobot.io) air quality monitor into HomeKit. 

## First things first - Thanks to:

This plugin is heavily based on [homebridge-blueair](https://github.com/mylesgray/homebridge-blueair) plugin. Without it, this plugin won't be here now. Thank you **@mylesgray** for the inspiration and work on the blueair and foobot api integration!

Foobot is an awesome little indoor quality monitor gadget by Airboxlab, that I use for years now. Not really sure if official HomeKit support will ever be announced, so time to integrate it with the rest of the HomeKit accessories I already have. 

# General info
This plugin exposes all Foobot API characteristics for Air Quality and assigns them to native HomeKit Characteristics. The plugin will also mimic the Elgato Eve *Room* device such that, if using Eve.app on an iOS device, you will have historical logging and graphs of these metrics.

Currently all history state is stored on the local filesystem of the device running homebridge.

## Screenshots

### Home

Overview           |  Air quality sensor
:-------------------------:|:-------------------------:
![Overview](http://oi64.tinypic.com/715ker.jpg)    |  ![Air Quality](http://oi65.tinypic.com/2rp9r2v.jpg) 

Eve App          |  
:-------------------------:|
![Eve app](http://oi66.tinypic.com/34opqbq.jpg)  | 

## Configuration

### Installation

```
npm install homebridge-foobot
```

### config.json

The configuration is pretty straightforward, with the exception of the API key. You have to obtain it from [Foobot API for Developers page](https://api.foobot.io/apidoc/index.html). Username and Passwords are what you use for to login in Foobot's native mobile app.

*foobotDeviceIndex* - allows you to work with specific devices, in case you have several foobots.

Once you get it working, you can turn off individual sensors, or disable the historical stats via the *getHistoricalStats* flag.

```json
 "accessories": [
  .
  .
  .
  {
      "accessory": "FooBot",
      "name": "Foobot",
      "foobotDeviceIndex": 0,
      "username": "email@domain.com",
      "password": "password",
      "apikey": "a_long_string_of_api_key_here",
      "nameAirQuality": "Air Quality",
      "nameTemperature": "Temperature",
      "nameHumidity": "Humidity",
      "nameCO2": "Carbon Dioxide",
      "showTemperature": true,
      "showHumidity": true,
      "showAirQuality": true,
      "showCO2": true,
      "getHistoricalStats": true,
      "logTempToFile": true,
      "logTempToFilePath": "/Users/georgichokov/foo/temp.txt"
  },
  .
  .
  .
]
```