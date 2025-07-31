import cors from 'cors';
import { EventEmitter } from 'events';
import express from 'express';
import { Kafka } from 'kafkajs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { connect, getMessagesCollection } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const kafkaEmitter = new EventEmitter();
kafkaEmitter.setMaxListeners(0);

// Serve the test HTML page
app.get('/', (req, res) => {
  res.sendFile('test-stream.html', { root: __dirname });
});

// Initialize MongoDB connection
await connect();
console.log('✅ Connected to MongoDB');

app.get('/stream', async (req, res) => {
  const { researchId = 'default' } = req.query;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: {"type": "connected", "message": "Stream connected", "researchId": "${researchId}"}\n\n`);

  try {
    // First, stream all historical messages from MongoDB
    const messagesCollection = getMessagesCollection();
    
    // Get all messages from specified research session
    const historicalMessages = await messagesCollection
      .find({ researchId: researchId })
      .sort({ timestamp: 1 })
      .toArray();

    // Stream historical messages
    for (const msg of historicalMessages) {
      res.write(`data: ${JSON.stringify({ ...msg, type: 'historical' })}\n\n`);
      
      // Check if any historical message is "end" to close the connection
      if (msg.text && msg.text.toLowerCase() === 'end') {
        res.write(`data: {"type": "connection_ended", "message": "Stream ended by end command in history"}\n\n`);
        res.end();
        return;
      }
    }

    res.write(`data: {"type": "historical_complete", "message": "All historical messages sent"}\n\n`);

    // Now listen for new real-time messages
    const handler = (msg) => {
      if (msg.researchId === researchId) {
        res.write(`data: ${JSON.stringify({ ...msg, type: 'live' })}\n\n`);
        
        // Check if the message text is "end" to close the connection
        console.log(`Received message: ${msg.text}`);
        if (msg.text && msg.text.toLowerCase() === 'end') {
          res.write(`data: {"type": "connection_ended", "message": "Stream ended by end command"}\n\n`);
          kafkaEmitter.removeListener('message', handler);
          res.end();
          return;
        }
      }
    };

    kafkaEmitter.on('message', handler);

    req.on('close', () => {
      kafkaEmitter.removeListener('message', handler);
      res.end();
    });

  } catch (error) {
    console.error('Error streaming messages:', error);
    res.write(`data: {"type": "error", "message": "Error retrieving messages"}\n\n`);
    res.end();
  }
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'hybrid-stream-app',
  brokers: ['localhost:9092'],
});

const topic = 'research-stream';
const consumer = kafka.consumer({ groupId: 'hybrid-stream-group' });
const producer = kafka.producer();

// Test endpoint to send messages to Kafka
app.post('/send-message', async (req, res) => {
  try {
    const { message, researchId = 'default' } = req.body;
    
    const payload = {
      text: message,
      researchId: researchId,
      timestamp: new Date(),
      id: Date.now().toString()
    };

    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(payload)
        }
      ]
    });

    res.json({ success: true, message: 'Message sent to Kafka', payload });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get message history endpoint
app.get('/messages', async (req, res) => {
  try {
    const { limit = 50, researchId = 'default' } = req.query;

    const messagesCollection = getMessagesCollection();
    const messages = await messagesCollection
      .find({ researchId: researchId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json({ success: true, messages: messages.reverse(), researchId });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function startKafkaConsumer() {
  try {
    await producer.connect();
    console.log('✅ Kafka producer connected');
    
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    console.log('✅ Kafka consumer connected and subscribed to research-stream');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        let payload;
        try {
          payload = JSON.parse(message.value.toString());
        } catch {
          payload = { text: message.value.toString() };
        }

        payload.topic = topic;
        payload.timestamp = new Date();
        payload.partition = partition;

        try {
          // Store message in MongoDB
          const messagesCollection = getMessagesCollection();
          await messagesCollection.insertOne({
            ...payload,
            _kafkaOffset: message.offset,
            _kafkaPartition: partition,
            _kafkaTimestamp: message.timestamp
          });
          
          console.log(`📝 Stored message in MongoDB: ${JSON.stringify(payload)}`);
        } catch (dbError) {
          console.error('❌ Error storing message in MongoDB:', dbError);
        }

        // Emit for real-time streaming
        kafkaEmitter.emit('message', payload);
      },
    });
  } catch (error) {
    console.error('❌ Error starting Kafka consumer:', error);
  }
}

startKafkaConsumer().catch(console.error);

app.listen(PORT, () => {
  console.log(`✅ SSE server running at http://localhost:${PORT}`);
});
