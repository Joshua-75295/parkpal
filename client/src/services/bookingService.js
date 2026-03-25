import API from "./api.js";

export const createBooking = async (payload) => {
  const response = await API.post("/bookings", payload);
  return response.data.booking ?? response.data;
};

export const getMyBookings = async () => {
  const response = await API.get("/bookings/my");
  return Array.isArray(response.data) ? response.data : [];
};

export const cancelBooking = async (bookingId) => {
  const response = await API.put(`/bookings/cancel/${bookingId}`);
  return response.data.booking ?? response.data;
};
