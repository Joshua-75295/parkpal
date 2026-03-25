import API from "./api.js";

export const loginUser = async (credentials) => {
  const response = await API.post("/auth/login", credentials);
  return response.data;
};

export const registerUser = async (payload) => {
  const response = await API.post("/auth/register", payload);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await API.get("/auth/me");
  return response.data;
};

export const logoutUser = async () => {
  const response = await API.post(
    "/auth/logout",
    {},
    {
      skipAuthRefresh: true,
    }
  );

  return response.data;
};
