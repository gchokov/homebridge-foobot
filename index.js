/* jshint node: true */
"use strict";
var request = require("request");
var os = require('os');
var fs = require('fs');
var path = require('path');
var inherits = require('util').inherits;
var Service, Characteristic;
var moment = require('moment');
var CustomCharacteristic = {};
var hostname = os.hostname();

module.exports = function(homebridge) {
	var FakeGatoHistoryService = require('fakegato-history')(homebridge);
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	
	homebridge.registerAccessory("homebridge-foobot", "Foobot", Foobot);
	
	function Foobot(log, config) {
		this.log = log;
		this.username = config.username;
		this.apikey = config.apikey;
		this.password = config.password;
		this.historicalmeasurements = [];
		this.name = config.name || 'Foobot';
		this.displayName = config.name;
		this.foobotDeviceIndex = config.foobotDeviceIndex || 0;
		this.nameAirQuality = config.nameAirQuality || 'Air Quality';
		this.nameTemperature = config.nameTemperature || 'Temperature';
		this.nameHumidity = config.nameHumidity || 'Humidity';
		this.nameCO2 = config.nameCO2 || 'CO2';
		this.showAirQuality = config.showAirQuality || false;
		this.showTemperature = config.showTemperature || false;
		this.showHumidity = config.showHumidity || false;
		this.showCO2 = config.showCO2 || false;
		this.getHistoricalStats = config.getHistoricalStats || false;
		this.appliance = {};
		this.appliance.info = {};

		this.appliance.info.firmware = "1.2.15"; //tested with this firmware
		
		this.base_API_url = "https://api.foobot.io/v2/user/" + this.username + "/homehost/";
		
		this.services = [];
		
		if(!this.username)
		throw new Error('Your must provide your Foobot username.');
		
		if(!this.password)
		throw new Error('Your must provide your Foobot password.');
		
		if(!this.apikey)
		throw new Error('Your must provide your Foobot API Key.');
		
		
		if(this.showAirQuality){
			this.airQualitySensorService = new Service.AirQualitySensor(this.nameAirQuality);
			
			this.airQualitySensorService
			.getCharacteristic(Characteristic.PM2_5Density)
			.on('get', this.getPM25Density.bind(this))
			.getDefaultValue();
			
			this.airQualitySensorService
			.getCharacteristic(Characteristic.AirQuality)
			.on('get', this.getAirQuality.bind(this))
			.getDefaultValue();
			
			this.airQualitySensorService
			.getCharacteristic(Characteristic.VOCDensity)
			.on('get', this.getVOCDensity.bind(this))
			.getDefaultValue();
			
			this.airQualitySensorService
			.getCharacteristic(Characteristic.CarbonDioxideLevel)
			.on('get', this.getCO2.bind(this))
			.getDefaultValue();
			
			this.airQualitySensorService
			.setCharacteristic(Characteristic.AirParticulateSize, '2.5um');

			this.serviceInfo = new Service.AccessoryInformation();
			this.serviceInfo
			.setCharacteristic(Characteristic.Manufacturer, 'Airboxlab Foobot')
			.setCharacteristic(Characteristic.Model, 'Foobot')
			.setCharacteristic(Characteristic.SerialNumber, hostname + "-" + this.appliance.info.uuid)
			.setCharacteristic(Characteristic.FirmwareRevision, this.appliance.info.firmware);
			
			this.services.push(this.serviceInfo);
			this.services.push(this.airQualitySensorService);
		}
		
		if(this.showTemperature){
			this.temperatureSensorService = new Service.TemperatureSensor(this.nameTemperature);
			
			this.temperatureSensorService
			.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.getTemperature.bind(this))
			.getDefaultValue();
			
			this.services.push(this.temperatureSensorService);
		}
		
		if(this.showHumidity){
			this.humiditySensorService = new Service.HumiditySensor(this.nameHumidity);
			
			this.humiditySensorService
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
			.on('get', this.getHumidity.bind(this))
			.getDefaultValue();
			
			this.services.push(this.humiditySensorService);
		}
		
		if(this.showCO2){
			this.CO2SensorService = new Service.CarbonDioxideSensor(this.nameCO2);
			
			this.CO2SensorService
			.getCharacteristic(Characteristic.CarbonDioxideLevel)
			.on('get', this.getCO2.bind(this))
			.getDefaultValue();
			
			this.CO2SensorService
			.getCharacteristic(Characteristic.CarbonDioxidePeakLevel)
			.on('get', this.getCO2Peak.bind(this))
			.getDefaultValue();
			
			this.CO2SensorService
			.getCharacteristic(Characteristic.CarbonDioxideDetected)
			.on('get', this.getCO2Detected.bind(this))
			.getDefaultValue();
			
			this.services.push(this.CO2SensorService);
		}
		
		if(this.getHistoricalStats){
			console.log("Loggine enabled");
			//Start fakegato-history custom charactaristic (Air Quality PPM charactaristic)
			CustomCharacteristic.AirQualCO2 = function() {
				Characteristic.call(this, 'Air Quality PM25', 'E863F10B-079E-48FF-8F27-9C2605A29F52');
				this.setProps({
					format: Characteristic.Formats.UINT16,
					unit: "ppm",
					maxValue: 99999,
					minValue: 0,
					minStep: 1,
					perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
				});
				this.value = this.getDefaultValue();
			};
			inherits(CustomCharacteristic.AirQualCO2, Characteristic);
			
			this.airQualitySensorService
			.getCharacteristic(CustomCharacteristic.AirQualCO2)
			.on('get', this.getCO2.bind(this));
			//end fakegato-history charactaristic
			
			//Fakegato-history masquerading as Eve Room.
			//Stores history on local filesystem of homebridge appliance
			this.loggingService = new FakeGatoHistoryService("room", this, {
				storage:'fs'
			});
			this.services.push(this.loggingService);
		}
	
		//Poll info on first run and every 10 minutes
		this.getAllState();
		setInterval(this.getAllState.bind(this), 5000); //refresh time 600000
	}
	
	
	Foobot.prototype = {
		
		getAllState: function(){
			if (this.deviceuuid !== 'undefined'){
				this.getLatestValues(function(){});
			} else {
				this.log.debug("Foobot devices not found for this username.");
			}
		},
		
		httpRequest: function(options, callback) {
			request(options,
				function (error, response, body) {
					this.log.debug("Polled API:", options.url, options.json);
					callback(error, response, body);
				}.bind(this));
			},
			
			getHomehost: function(callback) {
				if(this.gothomehost != 1){
					//Build the request
					var options = {
						url: this.base_API_url,
						method: 'get',
						headers: {
							'X-API-KEY-TOKEN': this.apikey
						}
					};
					
					//Send request
					this.httpRequest(options, function(error, response, body) {
						if (error) {
							this.log.debug('HTTP function failed: %s', error);
							callback(error);
						}
						else {
							var json = JSON.parse(body);
							var quotaReached = JSON.stringify(json).includes("quota exceeded. Tomorrow is another day") ? true:false;
							if (quotaReached)
							{
								this.log.debug("Quota exceeded, consider refreshing less often");
							}
							else 
							{
								this.log.debug("Got home region:", json);
								this.gothomehost = 1;
								this.homehost = json;
								callback(null);
							}
						}
					}.bind(this));
				}else{
					this.log.debug("Already have region");
					callback(null);
				}
			},
			
			login: function(callback) {
				if(this.loggedin != 1){
					//Build the request and use returned value
					this.getHomehost(function(){
						var options = {
							url: 'https://' + this.homehost + '/v2/user/' + this.username + '/login/',
							method: 'get',
							headers: {
								'X-API-KEY-TOKEN': this.apikey,
								'Authorization': 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64')
							}
						};
						//Send request
						this.httpRequest(options, function(error, response) {
							if (error) {
								this.log.debug('HTTP function failed: %s', error);
								callback(error);
							}
							else {
								this.loggedin = 1;
								this.log.debug("Logged in to API");
								this.authtoken = response.headers['x-auth-token'];
								callback(null);
							}
						}.bind(this));
					}.bind(this));
				} else {
					this.log.debug("Already logged in");
					callback(null);
				}
			},
			
			GetFoobotID: function(callback) {
				if(this.havedeviceID != 1){
					//Build request and get UUID
					this.login(function(){
						var options = {
							url: 'https://' + this.homehost + '/v2/owner/' + this.username + '/device/',
							method: 'get',
							headers: {
								'X-API-KEY-TOKEN': this.apikey,
								'X-AUTH-TOKEN': this.authtoken
							}
						};
						//Send request
						this.httpRequest(options, function(error, response, body) {
							if (error) {
								this.log.debug('HTTP function failed: %s', error);
								callback(error);
							}
							else {
								var json = JSON.parse(body);
								var numberofdevices = '';
								if (this.foobotDeviceIndex < json.length) {
									this.deviceuuid = json[this.foobotDeviceIndex].uuid;
									this.devicename = json[this.foobotDeviceIndex].name;
									this.havedeviceID = 1;
									this.log.debug("Got device ID"); 
									callback(null);
								} else {
									this.log.debug("Foobot specified is higher than number of foobot devices available");
								}
							}
						}.bind(this));
					}.bind(this));
				} else {
					this.log.debug("Already have device ID");
					callback(null);
				}
			},

			getLatestValues: function(callback) {
				//Get time now and check if we pulled from API in the last 5 minutes
				//if so, don't refresh as this is the max resolution of API
				var time = new Date();
				time.setMinutes(time.getMinutes() - 5);
				if (this.deviceuuid !== 'undefined') {
					if(typeof this.lastSensorRefresh !== 'undefined' || typeof this.measurements == 'undefined') {
						if(time > this.lastSensorRefresh || typeof this.measurements == 'undefined') {
							//Build the request and use returned value
							this.GetFoobotID(function(){
								var options = {
									url: 'https://' + this.homehost + '/v2/device/' + this.deviceuuid + '/datapoint/0/last/0/',
									method: 'get',
									headers: {
										'X-API-KEY-TOKEN': this.apikey,
										'X-AUTH-TOKEN': this.authtoken
									}
								};
								//Send request
								this.httpRequest(options, function(error, response, body) {
									if (error) {
										this.log.debug('HTTP function failed: %s', error);
										callback(error);
									}
									else {
										this.measurements = {};
										var json = JSON.parse(body);

										var quotaReached = JSON.stringify(json).includes("quota exceeded. Tomorrow is another day") ? true:false;
										if (quotaReached)
										{
											this.log.debug("Quota exceeded, consider refreshing less often");
										}
										else if ((json.datapoints.length >= 1) )
										{
											this.lastSensorRefresh = new Date();
											for (let i = 0; i < json.sensors.length; i++) {
												switch(json.sensors[i]) {
													case "pm":
													this.measurements.pm = json.datapoints[0][i];
													//this.log.debug("Particulate matter 2.5:", this.measurements.pm + " " + json.units[i]);
													break;
													
													case "tmp":
													this.measurements.tmp = json.datapoints[0][i];
													//this.log.debug("Temperature:", this.measurements.tmp + " " + json.units[i]);
													break;
													
													case "hum":
													this.measurements.hum = json.datapoints[0][i];
													//this.log.debug("Humidity:", this.measurements.hum + " " + json.units[i]);
													break;
													
													case "co2":
													this.measurements.co2 = json.datapoints[0][i];
													//this.log.debug("CO2:", this.measurements.co2 + " " + json.units[i]);
													var levels = [
														[99999, 2101, Characteristic.AirQuality.POOR],
														[2100, 1601, Characteristic.AirQuality.INFERIOR],
														[1600, 1101, Characteristic.AirQuality.FAIR],
														[1100, 701, Characteristic.AirQuality.GOOD],
														[700, 0, Characteristic.AirQuality.EXCELLENT],
													];
													for(var item of levels){
														if(json.datapoints[0][i] >= item[1] && json.datapoints[0][i] <= item[0]){
															this.measurements.airquality = item[2];
															this.measurements.airqualityppm = json.datapoints[0][i];
														}
													}
													break;
													
													case "voc":
													this.measurements.voc = json.datapoints[0][i];
													//this.log.debug("Volatile organic compounds:", this.measurements.voc + " " + json.units[i]);
													break;
													
													case "allpollu":
													this.measurements.allpollu = item[1];
													//this.log.debug("All Pollution:", this.measurements.allpollu, json.units[i]);
													break;
													
													default:
													break;
												}
											}
											
											//Fakegato-history add data point
											//temperature, humidity and air quality
											//Air Quality measured here as CO2 ppm
											if(this.getHistoricalStats){
												this.loggingService.addEntry({
													time: moment().unix(),
													temp: this.measurements.tmp,
													humidity: this.measurements.hum,
													ppm: this.measurements.airqualityppm
												});
											};
											this.log.debug("Sensor data refreshed");
										} else {
											this.log.debug("No sensor data available");
										}
										callback(null);
									}
								}.bind(this));
							}.bind(this));
						}
						else
						{
							this.log.debug("Sensor data polled in last 5 minutes, waiting.");
							callback(null);
						}
					}
				} else {
					this.log.debug("No Foobot devices for this account found");
				}
			},
			
			getHistoricalValues: function(callback) {
				//Get time now and check if we pulled from API in the last 5 minutes
				//if so, don't refresh as this is the max resolution of API
				var time = new Date();
				time.setMinutes(time.getMinutes() - 30);
				if (this.deviceuuid !== 'undefined') {
					if(typeof this.lastHistoricalRefresh !== 'undefined' || typeof this.historicalmeasurements[0] == 'undefined') {
						if(time > this.lastHistoricalRefresh || typeof this.historicalmeasurements[0] == 'undefined') {
							
							//Build the request and use returned value
							this.GetFoobotID(function(){
								
								var timenow = new Date();
								var timelastmonth = new Date();
								timelastmonth.setMonth(timelastmonth.getMonth() - 1);
								var tsnow = timenow.toISOString();
								var tslastmonth = timelastmonth.toISOString();
								var options = {
									//Get datapoints rounded to 600s as higher resolution reduces history in Eve
									url: 'https://' + this.homehost + '/v2/device/' + this.deviceuuid + '/datapoint/' + tslastmonth + '/' + tsnow + '/600/',
									method: 'get',
									headers: {
										'X-API-KEY-TOKEN': this.apikey,
										'X-AUTH-TOKEN': this.authtoken
									}
								};
								//Send request
								this.httpRequest(options, function(error, response, body) {
									
									if (error) {
										
										this.log.debug('HTTP function failed: %s', error);
										callback(error);
										
									}
									else {
										
										var json = JSON.parse(body);

										var quotaReached = JSON.stringify(json).includes("quota exceeded. Tomorrow is another day") ? true:false;
										if (quotaReached)
										{
											this.log.debug("Quota exceeded, consider adding refreshing less often");
										}
										else if ((json.datapoints.length >= 1) )
										{
											this.log.debug("Downloaded " + json.datapoints.length + " datapoints for " + json.sensors.length + " senors");
											for (let i = 0; i < json.sensors.length; i++) {
												this.historicalmeasurements.push([]);
												switch(json.sensors[i]) {
													case "time":
													for (let j = 0; j < json.datapoints.length; j++){
														this.historicalmeasurements[i][j] = json.datapoints[j][i];
													}
													break;
													
													case "pm":
													for (let j = 0; j < json.datapoints.length; j++){
														this.historicalmeasurements[i][j] = json.datapoints[j][i];
													}
													break;
													
													case "tmp":
													for (let j = 0; j < json.datapoints.length; j++){
														this.historicalmeasurements[i][j] = json.datapoints[j][i];
													}
													break;
													
													case "hum":
													for (let j = 0; j < json.datapoints.length; j++){
														this.historicalmeasurements[i][j] = json.datapoints[j][i];
													}
													break;
													
													case "co2":
													for (let j = 0; j < json.datapoints.length; j++){
														this.historicalmeasurements[i][j] = json.datapoints[j][i];
													}
													break;
													
													case "voc":
													for (let j = 0; j < json.datapoints.length; j++){
														this.historicalmeasurements[i][j] = json.datapoints[j][i];
													}
													break;
													
													case "allpollu":
													for (let j = 0; j < json.datapoints.length; j++){
														this.historicalmeasurements[i][j] = json.datapoints[j][i];
													}
													break;
													
													default:
													break;
												}
											}
										}
										
										this.lastHistoricalRefresh = new Date();
										callback(null);
									}
									
								}.bind(this));
								
							}.bind(this));
							
						}
						
					} else {
						this.log.debug("Pulled historical data in last 30 mins, waiting");
						callback();
					}
				} else {
					this.log.debug("No Foobot devices found");
				}
			},
			
			getAirQuality: function(callback) {
				this.getLatestValues(function(){
					callback(null, this.measurements.airquality);
				}.bind(this));
			},
			
			getPM25Density: function(callback) {
				this.getLatestValues(function(){
					callback(null, this.measurements.pm);
				}.bind(this));
			},
			
			getVOCDensity: function(callback) {
				this.getLatestValues(function(){
					callback(null, this.measurements.voc);
				}.bind(this));
			},
			
			getTemperature: function(callback) {
				this.getLatestValues(function(){
					callback(null, this.measurements.tmp);
				}.bind(this));
			},
			
			getHumidity: function(callback) {
				this.getLatestValues(function(){
					callback(null, this.measurements.hum);
				}.bind(this));
			},
			
			getCO2: function(callback) {
				this.getLatestValues(function(){
					callback(null, this.measurements.co2);
				}.bind(this));
			},
			
			getCO2Peak: function(callback) {
				this.getHistoricalValues(function(){
					var peakCO2 = Math.max(...this.historicalmeasurements[4]);
					callback(null, peakCO2);
				}.bind(this));
			},
			
			getCO2Detected: function(callback) {
				this.getLatestValues(function(){
					if (this.measurements.co2 <= 2000){
						callback(null, 0);
					} else {
						callback(null, 1);
					}
				}.bind(this));
			},
			
			getServices: function() {
				return this.services;
			}
		};
};