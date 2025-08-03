# ChatGPT Deep Research Streaming POC

A proof-of-concept implementation demonstrating real-time streaming architecture for ChatGPT-style deep research functionality using Kafka, MongoDB, and Server-Sent Events/HTTP Streaming.

## 🎯 Overview

This project showcases how to build a scalable streaming system that can handle:

- Real-time message streaming with hybrid historical and live data
- Persistent message storage for research sessions
- Multi-client support with session isolation
- Kafka-based message queuing
- Web-based testing interface

## 🏗️ Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │────│   Express API   │────│     Kafka       │
│  (SSE Stream)   │    │  (Node.js/SSE)  │    │   (Message      │
└─────────────────┘    └─────────────────┘    │    Queue)       │
                                │              └─────────────────┘
                                │
                       ┌─────────────────┐
                       │    MongoDB      │
                       │  (Persistence)  │
                       └─────────────────┘
```

## 🚀 Features

- **Hybrid Streaming**: Combines historical data from MongoDB with real-time Kafka messages
- **Session Management**: Isolated research sessions using `researchId` parameter
- **Message Persistence**: All messages are stored in MongoDB for replay capability
- **Real-time Updates**: Live message streaming via HTTP Streaming/Server-Sent Events in another branch
- **Testing Interface**: Built-in web UI for testing streaming functionality
- **Docker Support**: Complete containerized development environment

## 🛠️ Setup Guide

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Infrastructure Services

Start Kafka, Zookeeper, and MongoDB using Docker Compose:

```bash
docker-compose up -d
```

Verify services are running:

```bash
docker-compose ps
```

You should see all services as `Up`:

- `zookeeper` on port 2181
- `kafka` on port 9092  
- `mongo` on port 27017

### 4. Start the Application

```bash
npm start
```

The server will start on `http://localhost:3000`

### 5. Test the Setup

Open your browser and navigate to `http://localhost:3000` to access the testing interface.

## 📖 Usage

### Web Interface (POC Demo)

Access the demo at `http://localhost:3000` to test the streaming POC:

1. **Start Research Session**: Enter a research ID and click "Start Stream"
2. **Observe Hybrid Streaming**:
   - Historical messages load first (demonstrating persistence)
   - Real-time messages appear as they're sent (demonstrating live streaming)
3. **Test Session Isolation**: Use different research IDs to verify message separation
4. **Send Test Messages**: Use the message input to simulate research data flowing through Kafka
5. **Terminate Stream**: Send "end" message to cleanly close the connection

### API Endpoints

The API is **stateless** - each request is independent and the server maintains no client session state. All session context is provided via parameters, making the system highly scalable.

#### Start Streaming

```http
GET /stream?researchId=<research-id>
```

Returns Server-Sent Events stream with historical + real-time messages. The `researchId` parameter determines which research context data to stream - no server-side session tracking required.

#### Send Message

```http
POST /send-message
Content-Type: application/json

{
  "message": "Your message here",
  "researchId": "research-id"
}
```

Each message is self-contained with its research identifier - no server session state required.

#### Get Message History

```http
GET /messages?researchId=<research-id>&limit=50
```

Retrieves historical messages for any research context without maintaining server-side state.

### Research Context Management

Each research context is identified by a `researchId` parameter - **no server-side session state**:

- Messages are isolated by research context using the identifier in each request
- Historical data is replayed when starting a new stream (stateless retrieval)
- Multiple clients can connect to the same research context independently
- Send "end" message to terminate a stream (client-controlled, not server state)
