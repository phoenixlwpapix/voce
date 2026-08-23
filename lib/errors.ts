export function getUserErrorMessage(error: unknown) {
  if (!navigator.onLine) {
    return "当前处于离线状态，请恢复网络后重试。";
  }
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") {
    return error.data;
  }
  return "请求没有完成，请稍后重试。";
}
