export function getUserErrorMessage(error: unknown) {
  if (!navigator.onLine) {
    return "You're offline. Reconnect and try again.";
  }
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") {
    return error.data;
  }
  return "The request couldn't be completed. Try again shortly.";
}
