import { createHttpError } from "../utils/httpError.js";

export const adminOnly = (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user?.role)) {
    return next(
      createHttpError(403, "Admin access required", {
        code: "ADMIN_ACCESS_REQUIRED",
      })
    );
  }

  return next();
};

export const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== "super_admin") {
    return next(
      createHttpError(403, "Super admin access required", {
        code: "SUPER_ADMIN_ACCESS_REQUIRED",
      })
    );
  }

  return next();
};
