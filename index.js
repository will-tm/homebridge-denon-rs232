var Service, Characteristic;
var SerialPort = require("serialport");

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-denon-rs232", "DenonRS232", DenonRS232);
}

function appendBufferUntil(buffer, append, until, callback) {
    buffer = Buffer.concat([buffer, append], buffer.length+append.length);
    var index = append.indexOf(until);
    if (index >= 0) {
        buffer = new Buffer(buffer, 0, buffer.length - until.length);
        if (callback != null) {
            callback(buffer);
        }
    }
    return buffer;
}

function ttyWrite(path, data, callback) {
    var port = new SerialPort(path, {
        baudRate: 9600
    }).on('open', function() {
        port.write(data, function(err) {
            port.close();
            callback(err);
        });
    });
}

function ttyRequest(path, request, callback) {
    var read = new Buffer(0);
    var port = new SerialPort(path, {
        baudRate: 9600
    }).on('open', function() {
        port.flush(function(err) {
            port.write(request);
        });
    }).on('data', function (data) {
        read = appendBufferUntil(read, data, "\r", function(buffer) {
            port.close();
            callback(null, buffer);
        });
    });
}

function DenonRS232(log, config) {
    this.log = log;

    this.path = config["path"];
    this.name = config["name"] || "DenonRS232";
    this.manufacturer = config["manufacturer"] || "";
    this.model = config["model"] || "Model not available";
    this.serial = config["serial"] || "Non-defined serial";
}

DenonRS232.prototype = {

    setState: function(value, callback) {
        var self = this;
        ttyWrite(self.path, value?"PWON\r":"PWSTANDBY\r", function(err) {
            self.log("'%s' is now %s", self.name, value ? "on" : "off");
            callback(err);
        });
    },

    getState: function (callback) {
        var self = this;
        ttyRequest(self.path, "PW?\r", function(err, data) {
            var active = data.includes("PWON");
            self.log("'%s' is currently %s", self.name, active ? "on" : "off");
            callback(err, active);
        });
    },

    identify: function (callback) {
        callback();
    },

    getServices: function () {
        var service = new Service.AccessoryInformation();
        service.setCharacteristic(Characteristic.Name, this.name)
               .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
               .setCharacteristic(Characteristic.Model, this.model);

        var switchService = new Service.Switch(this.name);
        switchService.getCharacteristic(Characteristic.On)
                     .on('set', this.setState.bind(this))
                     .on('get', this.getState.bind(this));

        return [service, switchService];
    }
};

