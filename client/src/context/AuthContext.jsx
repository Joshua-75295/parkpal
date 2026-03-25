import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth-context.js";
import { getCurrentUser, logoutUser } from "../services/authService.js";
import { AUTH_SESSION_EXPIRED_EVENT } from "../utils/constants.js";

const normalizeUser = (payload) => {
  const payloadUser = payload?.user ?? payload;
  const id = payloadUser?._id ?? payloadUser?.id ?? "";

  if (!id && !payloadUser?.email) {
    return null;
  }

  return {
    _id: id,
    id,
    name: payloadUser?.name ?? "",
    email: payloadUser?.email ?? "",
    role: payloadUser?.role ?? "user",
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const hydrateCurrentUser = useCallback(async () => {
    try {
      const payload = await getCurrentUser();
      const nextUser = normalizeUser(payload);
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      await hydrateCurrentUser();

      if (isActive) {
        setIsBootstrapping(false);
      }
    };

    bootstrap();

    return () => {
      isActive = false;
    };
  }, [hydrateCurrentUser]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSessionExpired = () => {
      setUser(null);
      setIsBootstrapping(false);
    };

    const handleWindowFocus = () => {
      hydrateCurrentUser().catch(() => null);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener(
        AUTH_SESSION_EXPIRED_EVENT,
        handleSessionExpired
      );
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [hydrateCurrentUser]);

  const login = (payload) => {
    setUser(normalizeUser(payload));
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Even if the session is already gone, clear the local auth state.
    } finally {
      setUser(null);
      setIsBootstrapping(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isBootstrapping,
        login,
        logout,
        refreshCurrentUser: hydrateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
