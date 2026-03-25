import { io, Socket } from "socket.io-client";
import { getToken } from "./api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8080";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const token = getToken();
  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined
  });
  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

