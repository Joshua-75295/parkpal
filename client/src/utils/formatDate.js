const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

const formatWithFormatter = (formatter, value) => {
  if (!value) {
    return "--";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return formatter.format(date);
};

export const formatDate = (value) => formatWithFormatter(dateFormatter, value);

export const formatDateTime = (value) =>
  formatWithFormatter(dateTimeFormatter, value);

export const formatShortDate = (value) =>
  formatWithFormatter(shortDateFormatter, value);

export const toDateTimeLocalValue = (value) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};
