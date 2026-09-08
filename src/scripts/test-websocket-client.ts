import { io } from "socket.io-client";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW1lcklkIjoiM2MzMWJjYmUtNDNlZi00MGYzLWJlMjYtMjQ0NzAxMjkyMWYxIiwiZW1haWwiOiJhbmRyZWF2aW5kcmEzN0BnbWFpbC5jb20iLCJpYXQiOjE3ODg4NTQ4MjYsImV4cCI6MTc4OTQ1OTYyNn0.R3fSG2jqcKKOzSWUhYpOXR13MdWoiGV7kYBiTkTsdLk";
const LIVE_SESSION_ID = process.env.TEST_LIVE_SESSION_ID!;

const socket = io("http://localhost:3000/moderation", {
  auth: { token: TOKEN },
});

socket.on("connect", () => {
  console.log("Connected! Socket ID:", socket.id);
  socket.emit("subscribe:live-session", { liveSessionId: LIVE_SESSION_ID });
});

socket.on("subscribed", (data) => {
  console.log("Subscribed to:", data);
});

socket.on("chat-message", (data) => {
  console.log("\n[NEW MESSAGE]", data);
});

socket.on("moderation-action", (data) => {
  console.log("\n[MODERATION ACTION]", data);
});

socket.on("error", (data) => {
  console.error("Error:", data);
});

socket.on("disconnect", () => {
  console.log("Disconnected");
});
