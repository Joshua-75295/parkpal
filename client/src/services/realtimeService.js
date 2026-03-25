import { io } from "socket.io-client";
import {
  REALTIME_EVENTS,
  SOCKET_SERVER_URL,
} from "../utils/constants.js";

let socket = null;

const createRealtimeSocket = () =>
  io(SOCKET_SERVER_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

export const getRealtimeSocket = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!socket) {
    socket = createRealtimeSocket();
    return socket;
  }

  if (socket.disconnected) {
    socket.connect();
  }

  return socket;
};

export const subscribeToRealtimeEvent = (eventName, handler) => {
  const realtimeSocket = getRealtimeSocket();

  if (!realtimeSocket) {
    return () => {};
  }

  realtimeSocket.on(eventName, handler);

  return () => {
    realtimeSocket.off(eventName, handler);
  };
};

export { REALTIME_EVENTS };
