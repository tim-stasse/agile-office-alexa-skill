import Alexa from 'alexa-sdk';
import AWS from 'aws-sdk';
import https from 'https';
import fp from 'lodash/fp';

AWS.config.update({
  region: 'us-east-1'
});

const HELP_MESSAGE = 'Computers are hard!';
const HELP_REPROMPT = 'It works on my machine!';
const STOP_MESSAGE = 'Ciao!';

function officeInformationRequest(endpoint) {
  return new Promise((resolve, reject) => {
    https
      .get(
        'https://fedex-sensor-api.staging.agiledigital.co' + endpoint,
        res => {
          const statusCode = res.statusCode;
          const contentType = res.headers['content-type'];

          let error;
          if (statusCode !== 200) {
            error = new Error(
              'Request Failed.\n' + `Status Code: ${statusCode}`
            );
          } else if (!/^application\/json/.test(contentType)) {
            error = new Error(
              'Invalid content-type.\n' +
                `Expected application/json but received ${contentType}`
            );
          }
          if (error) {
            console.log(error.message);
            // consume response data to free up memory
            res.resume();
            reject(error);
          }

          res.setEncoding('utf8');
          let rawData = '';
          res.on('data', chunk => (rawData += chunk));
          res.on('end', () => {
            try {
              resolve(rawData);
            } catch (e) {
              console.log(e.message);
              reject(e);
            }
          });
        }
      )
      .on('error', e => {
        console.log(`Got error: ${e.message}`);
        reject(e);
      });
  });
}

const getDeviceFnameFromName = async (sensorType, roomName) => {
  const rawData = await officeInformationRequest('/devices');

  const parsedData = JSON.parse(rawData);

  return fp.flow(
    fp.get('result'),
    fp.filter(data => fp.toLower(data.sensor_type) === sensorType),
    fp.filter(data => fp.toLower(data.room) === fp.toLower(roomName)),
    x => x[0].friendly_name,
    fp.replace(' ', '%20'),
  )(parsedData);
};

const getDeviceIDFromName = async (sensorType, roomName) => {
  const rawData = await officeInformationRequest('/devices');

  const parsedData = JSON.parse(rawData);

  return fp.flow(
    fp.get('result'),
    fp.filter(data => fp.toLower(data.sensor_type) === sensorType),
    fp.filter(data => fp.toLower(data.room) === fp.toLower(roomName)),
    x => x[0].deviceId,
    fp.replace(' ', '%20'),
  )(parsedData);
};


function getOfficeInformationDevice() {
  const self = this;
  self.attributes.sensor =
    self.event.request.intent.slots.sensor.value || self.attributes.sensor;

  officeInformationRequest('/devices', function(rawData) {
    const parsedData = JSON.parse(rawData);
    const dataOutput = fp.flow(
      fp.get('result'),
      fp.filter(
        data => fp.toLower(data.sensor_type) === self.attributes.sensor
      ),
      fp.map(data => data.room)
    )(parsedData);

    const GetDevicesMessage = fp.join(', ')(dataOutput);

    self.response.speak(`There are these rooms ${GetDevicesMessage}`).listen();
    self.emit(':responseReady');
  });
}

const getOfficeInformationTemp = async ({ test }) => {
  const self = test;
  const friendlyName = await getDeviceFnameFromName(
    'temperature sensor',
    self.event.request.intent.slots.room.value
  );
  const url = '/temperature?' + `deviceName=${friendlyName}` + '&type=average';
  const rawData = await officeInformationRequest(url);
  const parsedData = JSON.parse(rawData);
  const outputData = fp.forOwn(
    fp.get('results'),
    fp.round(2)
  )(parsedData)
  self.response
    .speak(`The temparature in the ${self.event.request.intent.slots.room.value} is ${outputData}`)
    .listen();
  self.emit(':responseReady');
};

const getOfficeInformationBussy = async ({ test }) => {
  const self = test;
  const friendlyName = await getDeviceIDFromName(
    'motion sensor',
    self.event.request.intent.slots.room.value
  );
  const url = '/busyness?' + `deviceName=${friendlyName}`;
  const rawData = await officeInformationRequest(url);
  const parsedData = JSON.parse(rawData);
  self.response
    .speak(`The bussyness of the ${self.event.request.intent.slots.room.value} is ${parsedData.result}`)
    .listen();
  self.emit(':responseReady');
};

const handlers = {
  LaunchRequest: function() {
    this.response.speak('Skill for the Agile Digital Office').listen();
    this.emit(':responseReady');
  },
  GetDevicesIntent: function() {
    getOfficeInformationDevice.call(this);
  },
  GetTemperatureIntent: function() {
    getOfficeInformationTemp({ test: this });
  },
  GetBussynessIntent: function() {
    getOfficeInformationBussy({ test: this });
  },
  'AMAZON.HelpIntent': function() {
    const speechOutput = HELP_MESSAGE;
    const reprompt = HELP_REPROMPT;

    this.response.speak(speechOutput).listen(reprompt);
    this.emit(':responseReady');
  },
  'AMAZON.CancelIntent': function() {
    this.response.speak(STOP_MESSAGE);
    this.emit(':responseReady');
  },
  'AMAZON.StopIntent': function() {
    delete this.attributes.room;
    this.response.speak(STOP_MESSAGE);
    this.emit(':responseReady');
  },
  'AMAZON.YesIntent': function() {
    this.emit('GetTemperatureIntent');
  },
  'AMAZON.NoIntent': function() {
    this.emit('AMAZON.StopIntent');
  }
};

export const handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context, callback);
  alexa.registerHandlers(handlers);
  alexa.execute();
};
