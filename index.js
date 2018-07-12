import Alexa from 'alexa-sdk';
import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1'
});

const HELP_MESSAGE = 'Computers are hard!';
const HELP_REPROMPT = 'It works on my machine!';
const STOP_MESSAGE = 'Ciao!';

const handlers = {
  LaunchRequest: function() {
    this.response.speak('Skill for the Agile Digital Office').listen();
    this.emit(':responseReady');
  },
  GetTemperatureIntent: function() {
    this.attributes.room =
      this.event.request.intent.slots.room.value || this.attributes.room;

    this.response
      .speak(`It is one hundred degrees celcius in the ${this.attributes.room}`)
      .listen();
    this.emit(':responseReady');
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
