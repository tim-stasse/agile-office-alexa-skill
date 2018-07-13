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

function officeInformationRequest(endpoint, callback) {
  https
    .get('https://fedex-sensor-api.staging.agiledigital.co' + endpoint, res => {
      const statusCode = res.statusCode;
      const contentType = res.headers['content-type'];

      let error;
      if (statusCode !== 200) {
        error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
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
        return;
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', chunk => (rawData += chunk));
      res.on('end', () => {
        try {
          callback(rawData);
        } catch (e) {
          console.log(e.message);
        }
      });
    })
    .on('error', e => {
      console.log(`Got error: ${e.message}`);
    });
}

function getOfficeInformationDevice() {
  const self = this;
  self.attributes.sensor = self.event.request.intent.slots.sensor.value || self.attributes.sensor;

  officeInformationRequest('/devices', function (rawData) {
    const parsedData = JSON.parse(rawData);
    const dataOutput = fp.flow(
      fp.get('result'),
      x => console.log(self.attributes.sensor) || x,
      fp.filter(data => fp.toLower(data.sensor_type)===self.attributes.sensor),
      fp.map( data => data.room ),
    )(parsedData);

    const GetDevicesMessage = fp.join(', ')(dataOutput);

    self.response.speak(`There are these rooms ${GetDevicesMessage}`).listen();
    self.emit(':responseReady');
  });
}

function getOfficeInformationTemp() {
  const self = this;
  const url = 'temperature?' + 'deviceName=BR%20Temp' + '&type=average';
  self.attributes.sensor = self.event.request.intent.slots.sensor.value || self.attributes.sensor;

  officeInformationRequest(url, function (rawData) {
    const parsedData = JSON.parse(rawData);

    const GetDevicesMessage = parsedData;

    self.response.speak(`There are these rooms ${GetDevicesMessage}`).listen();
    self.emit(':responseReady');
  });
}

const handlers = {
  LaunchRequest: function() {
    this.response.speak('Skill for the Agile Digital Office').listen();
    this.emit(':responseReady');
  },
  GetDevicesIntent: function() {getOfficeInformationDevice.call(this);},
  GetTemperatureIntent: function() {getOfficeInformationTemp.call(this);
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
