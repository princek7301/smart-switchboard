const express = require('express');
const mqtt = require('mqtt');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// MQTT client setup
const mqttClient = mqtt.connect('mqtts://95f014d6f4804c4ebbf50f356233bfb1.s1.eu.hivemq.cloud:8883', {
  username: 'theProject',
  password: 'theProject@1',
  clientId: 'google_bridge_' + Math.random().toString(16).slice(3)
});
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
});
mqttClient.on('error', (err) => {
  console.error('MQTT error:', err);
});

// Device states (simulated, since NodeMCU publishes state)
let deviceStates = {
  'switch_1': { on: false },
  'switch_2': { on: false },
  'switch_3': { on: false },
  'switch_4': { on: false },
  'switch_5': { on: false },
  'switch_6': { on: false }
};

// Subscribe to state topics for real-time updates
const stateTopics = [
  'home/switch/1/state',
  'home/switch/2/state',
  'home/switch/3/state',
  'home/switch/4/state',
  'home/switch/5/state',
  'home/switch/6/state'
];
mqttClient.on('connect', () => {
  stateTopics.forEach((topic, index) => {
    mqttClient.subscribe(topic, (err) => {
      if (!err) console.log(`Subscribed to ${topic}`);
    });
  });
});
mqttClient.on('message', (topic, message) => {
  const state = message.toString();
  const switchId = `switch_${stateTopics.indexOf(topic) + 1}`;
  deviceStates[switchId].on = (state === 'ON');
  console.log(`Updated ${switchId} state: ${state}`);
});

// Google Smart Home API endpoints
app.post('/smarthome', (req, res) => {
  const { requestId, inputs } = req.body;
  let response = { requestId, payload: {} };

  // Handle different intents
  for (const input of inputs) {
    if (input.intent === 'action.devices.SYNC') {
      response.payload = {
        agentUserId: 'user123',
        devices: [
          { id: 'switch_1', type: 'action.devices.types.LIGHT', traits: ['action.devices.traits.OnOff'], name: { name: 'Switch 1' }, willReportState: true },
          { id: 'switch_2', type: 'action.devices.types.LIGHT', traits: ['action.devices.traits.OnOff'], name: { name: 'Switch 2' }, willReportState: true },
          { id: 'switch_3', type: 'action.devices.types.LIGHT', traits: ['action.devices.traits.OnOff'], name: { name: 'Switch 3' }, willReportState: true },
          { id: 'switch_4', type: 'action.devices.types.LIGHT', traits: ['action.devices.traits.OnOff'], name: { name: 'Switch 4' }, willReportState: true },
          { id: 'switch_5', type: 'action.devices.types.LIGHT', traits: ['action.devices.traits.OnOff'], name: { name: 'Switch 5' }, willReportState: true },
          { id: 'switch_6', type: 'action.devices.types.LIGHT', traits: ['action.devices.traits.OnOff'], name: { name: 'Switch 6' }, willReportState: true }
        ]
      };
    } else if (input.intent === 'action.devices.QUERY') {
      const devices = {};
      for (const device of input.payload.devices) {
        devices[device.id] = { on: deviceStates[device.id].on, online: true };
      }
      response.payload = { devices };
    } else if (input.intent === 'action.devices.EXECUTE') {
      const commands = [];
      for (const command of input.payload.commands) {
        const execution = command.execution[0];
        const devices = [];
        for (const device of command.devices) {
          const switchNum = parseInt(device.id.split('_')[1]);
          const topic = `home/switch/${switchNum}/cmd`;
          const state = execution.command === 'action.devices.commands.OnOff' ? (execution.params.on ? 'ON' : 'OFF') : 'OFF';
          mqttClient.publish(topic, state, { qos: 1 });
          deviceStates[device.id].on = (state === 'ON');
          devices.push({ id: device.id, status: 'SUCCESS' });
        }
        commands.push({ ids: devices.map(d => d.id), status: 'SUCCESS', states: { on: execution.params.on } });
      }
      response.payload = { commands };
    }
  }
  res.json(response);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});