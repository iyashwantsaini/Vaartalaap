import { io, type Socket } from "socket.io-client";

const DEFAULT_BASE_URL = "http://localhost:4000";

const resolveBaseUrl = () => import.meta.env.VITE_API_BASE ?? DEFAULT_BASE_URL;

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(resolveBaseUrl(), {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
