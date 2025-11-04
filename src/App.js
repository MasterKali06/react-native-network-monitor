import React, { useState, useEffect } from "react";
import "./App.css";
import ReactJsonPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css"; // Dark theme like Chrome

function App() {
  const [requests, setRequests] = useState({});
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connectWebSocket = () => {
      setConnectionStatus("connecting");

      try {
        ws = new WebSocket("ws://localhost:8082");

        ws.onopen = () => {
          console.log("✅ Connected to logcat server");
          setConnectionStatus("connected");
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log("Received:", data);

          setRequests((prev) => {
            const updated = { ...prev };
            const requestId = data.id;

            if (!updated[requestId]) {
              updated[requestId] = {
                id: requestId,
                method: "",
                url: "",
                timestamp: data.timestamp,
                status: "Pending",
                duration: "",
                requestBody: "",
                responseBody: "",
              };
            }

            switch (data.type) {
              case "request":
                updated[requestId].method = data.method;
                updated[requestId].url = data.url;
                break;
              case "response":
                updated[requestId].status = data.status;
                updated[requestId].duration = data.duration;
                break;
              case "request_body":
                updated[requestId].requestBody = data.body;
                break;
              case "response_body":
                updated[requestId].responseBody = data.body;
                break;
              default:
                break;
            }

            return updated;
          });
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionStatus("error");
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected");
          setConnectionStatus("disconnected");
          // Try to reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setConnectionStatus("error");
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  const requestsList = Object.values(requests)
    .filter((req) => req.url)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  console.log(selectedRequest);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "#4CAF50";
      case "connecting":
        return "#FF9800";
      case "error":
        return "#F44336";
      default:
        return "#9E9E9E";
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>📡 React Native Network Monitor</h1>
        <div
          className="connection-status"
          style={{ backgroundColor: getStatusColor() }}
        >
          Status: {connectionStatus.toUpperCase()}
        </div>
      </div>

      <div className="stats">
        Total Requests: {requestsList.length}
        {connectionStatus === "disconnected" && (
          <span style={{ color: "#F44336", marginLeft: "10px" }}>
            ⚠️ Server not connected. Make sure to run: node logcat-server.js
          </span>
        )}
      </div>

      <div className="container">
        <div className="requests-table">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>URL</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {requestsList.map((req) => (
                <tr
                  key={req.id}
                  className={selectedRequest?.id === req.id ? "selected" : ""}
                  onClick={() => setSelectedRequest(req)}
                >
                  <td className={`method ${req.method}`}>
                    {req.method || "?"}
                  </td>
                  <td className="url" title={req.url}>
                    {req.url
                      ? req.url.replace(/(https?:\/\/[^\/]+\/)/, "")
                      : "Loading..."}
                  </td>
                  <td className={`status ${req.status}`}>
                    {req.status === "Pending" ? "⏳" : req.status}
                  </td>
                  <td className="duration">{req.duration || "-"}</td>
                  <td className="time">
                    {new Date(req.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {requestsList.length === 0 && (
            <div className="empty-state">
              {connectionStatus !== "connected" ? (
                <div>
                  <h3>Waiting for connection...</h3>
                  <p>Make sure the logcat server is running:</p>
                  <code>node logcat-server.js</code>
                </div>
              ) : (
                <div>
                  <h3>No network requests detected</h3>
                  <p>
                    Make network calls in your React Native app to see them
                    here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedRequest && (
          <div className="request-details">
            <h3>Request Details</h3>
            <div className="detail-section">
              <strong>ID:</strong> {selectedRequest.id}
            </div>
            <div className="detail-section">
              <strong>Method:</strong> {selectedRequest.method}
            </div>
            <div className="detail-section">
              <strong>URL:</strong> {selectedRequest.url}
            </div>
            <div className="detail-section">
              <strong>Status:</strong>{" "}
              <span className={`status ${selectedRequest.status}`}>
                {selectedRequest.status}
              </span>
            </div>
            <div className="detail-section">
              <strong>Duration:</strong> {selectedRequest.duration || "Pending"}
            </div>

            <div className="detail-section">
              <strong>Request Body:</strong>
              <div className="json-viewer">
                <ReactJsonPretty
                  data={JSON.parse(selectedRequest.requestBody || "{}")}
                  theme="monikai"
                  mainStyle="padding: 10px; background: #1e1e1e;"
                />
              </div>
            </div>

            <div className="detail-section">
              <strong>Response Body:</strong>
              <div className="json-viewer">
                <ReactJsonPretty
                  data={JSON.parse(selectedRequest.responseBody || "{}")}
                  theme="monikai"
                  mainStyle="padding: 10px; background: #1e1e1e;"
                />
              </div>
            </div>

            <button onClick={() => setSelectedRequest(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
