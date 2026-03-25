import { Server as SocketIOServer } from "socket.io";

export const REALTIME_EVENTS = Object.freeze({
  availabilityChanged: "parking:availability-changed",
  bookingChanged: "booking:changed",
  inventoryChanged: "parking:inventory-changed",
});

let io = null;

const isAllowedOrigin = (origin, allowedOrigins) =>
  !origin || allowedOrigins.includes(origin);

export const initializeRealtime = (httpServer, allowedOrigins) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      credentials: true,
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) {
          return callback(null, true);
        }

        return callback(new Error("Socket.IO origin not allowed"));
      },
    },
  });

  io.on("connection", (socket) => {
    socket.emit("realtime:connected", {
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
    });
  });

  return io;
};

const emitRealtimeEvent = (eventName, payload = {}) => {
  if (!io) {
    return;
  }

  io.emit(eventName, {
    ...payload,
    occurredAt: new Date().toISOString(),
  });
};

export const emitAvailabilityChanged = ({ parkingSlotId = "", reason }) => {
  emitRealtimeEvent(REALTIME_EVENTS.availabilityChanged, {
    parkingSlotId: parkingSlotId?.toString?.() ?? "",
    reason,
  });
};

export const emitBookingChanged = ({
  bookingId = "",
  parkingSlotId = "",
  reason,
}) => {
  emitRealtimeEvent(REALTIME_EVENTS.bookingChanged, {
    bookingId: bookingId?.toString?.() ?? "",
    parkingSlotId: parkingSlotId?.toString?.() ?? "",
    reason,
  });
};

export const emitInventoryChanged = ({ parkingSlotId = "", reason }) => {
  emitRealtimeEvent(REALTIME_EVENTS.inventoryChanged, {
    parkingSlotId: parkingSlotId?.toString?.() ?? "",
    reason,
  });
};
