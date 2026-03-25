export const createMockResponse = () => ({
  body: undefined,
  clearedCookies: [],
  cookies: [],
  headers: {},
  statusCode: 200,
  clearCookie(name, options) {
    this.clearedCookies.push({ name, options });
    return this;
  },
  cookie(name, value, options) {
    this.cookies.push({ name, options, value });
    return this;
  },
  getHeader(name) {
    return this.headers[name.toLowerCase()];
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  send(payload) {
    this.body = payload;
    return this;
  },
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

export const createNextCollector = () => {
  let capturedError = null;

  const next = (error) => {
    capturedError = error ?? null;
    return capturedError;
  };

  next.error = () => capturedError;

  return next;
};
