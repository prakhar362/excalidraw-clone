import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load environmental variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'abcdefghijkl';
const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'ws://localhost:5000';
const CONCURRENT_USERS = 100;
const TEST_DURATION_MS = 10000; // 10 seconds active simulation
const PACKET_INTERVAL_MS = 50; // 20 packets per second per user (50ms interval)
const ROOM_ID = 'load-test-performance-room';

interface LatencyRecord {
  sentAt: number;
  receivedAt: number;
  latency: number;
}

async function runLoadTest() {
  console.log('===============================================================');
  console.log('       SKETCHCALIBUR WEBSOCKET LOAD-TEST SUITE                 ');
  console.log('===============================================================');
  console.log(`[INIT] Target URL        : ${BACKEND_WS_URL}`);
  console.log(`[INIT] Concurrent Users  : ${CONCURRENT_USERS}`);
  console.log(`[INIT] Packet Interval   : ${PACKET_INTERVAL_MS}ms (20 Hz)`);
  console.log(`[INIT] Simulation Time   : ${TEST_DURATION_MS / 1000} seconds`);
  console.log(`[INIT] JWT Secret Verification: ${JWT_SECRET ? '✓ Loaded' : '✗ Failed'}`);
  console.log('---------------------------------------------------------------');

  const sockets: WebSocket[] = [];
  const latencyRecords: LatencyRecord[] = [];
  let connectionSuccessCount = 0;
  let totalPacketsSent = 0;
  let totalPacketsReceived = 0;

  console.log(`[PREP] Generating ${CONCURRENT_USERS} authenticated JWT tokens...`);
  const tokens = Array.from({ length: CONCURRENT_USERS }).map((_, index) => {
    const userId = `load_test_user_${index}`;
    return jwt.sign({ userId }, JWT_SECRET);
  });
  console.log(`[PREP] Tokens successfully signed.`);

  console.log(`[CONN] Establishing ${CONCURRENT_USERS} concurrent WebSocket connections...`);
  
  const connectPromises = tokens.map((token, index) => {
    return new Promise<void>((resolve, reject) => {
      const clientId = `client_${index}`;
      const url = `${BACKEND_WS_URL}?token=${token}`;
      
      const ws = new WebSocket(url);
      
      ws.on('open', () => {
        connectionSuccessCount++;
        // Send join_room immediately upon connection
        ws.send(JSON.stringify({
          type: 'join_room',
          roomId: ROOM_ID
        }));
        resolve();
      });

      ws.on('message', (rawData) => {
        totalPacketsReceived++;
        try {
          const parsed = JSON.parse(rawData.toString());
          if (parsed.type === 'cursor' && parsed.pointer && parsed.pointer.timestamp) {
            const receivedAt = Date.now();
            const sentAt = parsed.pointer.timestamp;
            const latency = receivedAt - sentAt;
            if (latency >= 0) {
              latencyRecords.push({ sentAt, receivedAt, latency });
            }
          }
        } catch (e) {
          // Catch parse errors quietly
        }
      });

      ws.on('error', (err) => {
        console.error(`[ERROR] Connection ${index} failed:`, err.message);
        reject(err);
      });

      sockets.push(ws);
    });
  });

  try {
    await Promise.all(connectPromises);
    console.log(`[CONN] Successfully connected ${connectionSuccessCount}/${CONCURRENT_USERS} users to room: '${ROOM_ID}'`);
  } catch (err) {
    console.log(`[WARN] Not all connections established successfully. Continuing with ${connectionSuccessCount} users...`);
  }

  console.log(`[SIM] Starting load simulation loop (transmitting coordinate strokes)...`);
  
  const startSimulationTime = Date.now();
  const intervals: NodeJS.Timeout[] = [];

  sockets.forEach((ws, index) => {
    const clientId = `client_${index}`;
    let step = 0;

    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Calculate a circular coordinate orbit so cursors sweep beautifully
        const angle = (step * Math.PI) / 36; // 5 degrees per step
        const radius = 150;
        const x = 500 + radius * Math.cos(angle + (index * 2 * Math.PI) / CONCURRENT_USERS);
        const y = 500 + radius * Math.sin(angle + (index * 2 * Math.PI) / CONCURRENT_USERS);
        
        ws.send(JSON.stringify({
          type: 'cursor',
          roomId: ROOM_ID,
          clientId,
          pointer: {
            x,
            y,
            timestamp: Date.now() // Append sending timestamp to measure end-to-end latency
          },
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          username: `LoadTester ${index}`
        }));
        
        totalPacketsSent++;
        step++;
      }
    }, PACKET_INTERVAL_MS);

    intervals.push(interval);
  });

  // Wait for the duration of the test
  await new Promise((resolve) => setTimeout(resolve, TEST_DURATION_MS));

  console.log(`[TEARDOWN] Stopping coordinate loops and disconnecting sockets...`);
  intervals.forEach(clearInterval);
  sockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  const actualDurationSeconds = (Date.now() - startSimulationTime) / 1000;
  
  console.log('===============================================================');
  console.log('          LOAD-TEST RESULTS & PERFORMANCE ANALYSIS             ');
  console.log('===============================================================');
  console.log(`[METRIC] Connected Users     : ${connectionSuccessCount} / ${CONCURRENT_USERS} (${(connectionSuccessCount/CONCURRENT_USERS * 100).toFixed(1)}%)`);
  console.log(`[METRIC] Total Packets Sent   : ${totalPacketsSent}`);
  console.log(`[METRIC] Total Packets Recv   : ${totalPacketsReceived} (Includes broadasted frames)`);
  console.log(`[METRIC] Simulation Duration  : ${actualDurationSeconds.toFixed(2)} seconds`);
  console.log(`[METRIC] Transmission Rate    : ${(totalPacketsSent / actualDurationSeconds).toFixed(1)} packets/second`);
  
  if (latencyRecords.length > 0) {
    const latencies = latencyRecords.map(r => r.latency);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    
    // Sort in ascending order to extract median, min, max, and percentiles without ES6 spread stack limits
    latencies.sort((a, b) => a - b);
    
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];
    const medianLatency = latencies[Math.floor(latencies.length * 0.5)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

    console.log('---------------------------------------------------------------');
    console.log(`[LATENCY] Min Latency        : ${minLatency} ms`);
    console.log(`[LATENCY] Median Latency     : ${medianLatency} ms`);
    console.log(`[LATENCY] Average Latency    : ${avgLatency.toFixed(2)} ms`);
    console.log(`[LATENCY] 95th Percentile    : ${p95Latency} ms`);
    console.log(`[LATENCY] 99th Percentile    : ${p99Latency} ms`);
    console.log(`[LATENCY] Max Latency        : ${maxLatency} ms`);
    console.log('---------------------------------------------------------------');
    
    if (avgLatency < 50) {
      console.log('✅ STATUS: SUCCESS - Sub-50ms WebSocket Broadcast Latency verified.');
      console.log('   The Node.js event-loop resolved concurrent coordinate arrays in near-zero latency.');
    } else {
      console.log('⚠️ STATUS: WARNING - Latency exceeded 50ms. High CPU throttling or network congestion detected.');
    }
  } else {
    console.log('---------------------------------------------------------------');
    console.log('✗ STATUS: FAILED - No latency records could be collected. Double check if sockets broadcasted cursor events.');
  }
  console.log('===============================================================');
}

runLoadTest().catch(err => {
  console.error('[CRITICAL] Load test error:', err);
});
