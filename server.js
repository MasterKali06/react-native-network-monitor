const { spawn } = require("child_process");
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8082 });
const clients = new Set();

function parseNetworkLog(line) {
  if (!line.includes("ReactNativeJS")) return null;

  const logMatch = line.match(/ReactNativeJS:\s*'?(.*?)'?$/);
  if (!logMatch) return null;

  const log = logMatch[1];
  console.log("Raw log:", log);

  let network = { timestamp: new Date().toISOString(), raw: log };

  // FIXED PARSING - handle NETWORK_REQUEST properly
  if (log.includes("NETWORK_REQUEST") && !log.includes("BODY")) {
    const match = log.match(/NETWORK_REQUEST\s+(\d+)\s+(\w+)\s+(.+)/);
    if (match) {
      network.type = "request";
      network.id = match[1]; // This should be the number
      network.method = match[2]; // This should be GET/POST/etc
      network.url = match[3]; // This should be the URL
    }
  } else if (log.includes("NETWORK_RESPONSE") && !log.includes("BODY")) {
    const match = log.match(/NETWORK_RESPONSE\s+(\d+)\s+(\d+)\s+(.+?)ms/);
    if (match) {
      network.type = "response";
      network.id = match[1];
      network.status = match[2];
      network.duration = match[3] + "ms";
    }
  } else if (log.includes("NETWORK_REQUEST_BODY")) {
    const match = log.match(/NETWORK_REQUEST_BODY\s+(\d+)\s+(.+)/);
    if (match) {
      network.type = "request_body";
      network.id = match[1];
      network.body = match[2];
    }
  } else if (log.includes("NETWORK_RESPONSE_BODY")) {
    const match = log.match(/NETWORK_RESPONSE_BODY\s+(\d+)\s+(.+)/);
    if (match) {
      network.type = "response_body";
      network.id = match[1];
      network.body = match[2];
    }
  }

  return network.type ? network : null;
}

// Start logcat with broader filter
const adb = spawn("adb", ["logcat", "-s", "ReactNativeJS:I"]);

adb.stdout.on("data", (data) => {
  const lines = data.toString().split("\n");

  lines.forEach((line) => {
    const network = parseNetworkLog(line);
    if (network) {
      console.log("Sending network data:", network); // Debug
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(network));
        }
      });
    }
  });
});

adb.stderr.on("data", (data) => {
  console.error("ADB error:", data.toString());
});

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Client connected");
  ws.on("close", () => {
    clients.delete(ws);
    console.log("Client disconnected");
  });
});

console.log("📡 Logcat WebSocket server running on ws://localhost:8082");
