const knownErrorMessages: Record<string, string> = {
  "Please sign in to continue.": "请先登录后再继续。",
  "This account is suspended.": "该账户已被暂停使用。",
  "This account has not been invited.": "该账户尚未获得邀请。",
  "This account is not on the lexicon's allowlist.": "该账户未在词库许可名单中。",
  "This lexicon belongs to another account.": "此词库属于其他账户。",
  "Account access required.": "需要账户访问权限。",
  "This device connection was not found.": "未找到该设备连接。",
  "Invalid invitation link.": "邀请链接无效。",
  "Admin access required.": "需要管理员权限。",
  "This invitation is invalid, expired, or already used.": "此邀请链接无效、已过期或已被使用。",
  "This account already has access.": "该账户已拥有访问权限。",
  "Register with an email address to accept this invitation.": "请使用电子邮箱注册以接受此邀请。",
  "Invitation not found.": "未找到该邀请。",
  "Your learning language changed. Refresh and try again.": "学习语种已变更，请刷新页面后重试。",
  "The lookup service is busy. Try again shortly.": "查词服务正忙，请稍候重试。",
  "The lookup timed out. Check your connection and try again.": "查词请求超时，请检查网络连接后重试。",
  "The lookup couldn't be completed. Try again shortly.": "查词未能完成，请稍候重试。",
  "Enter a word to look up.": "请输入要查询的词语。",
  "Invalid month format. Refresh the page and try again.": "月份格式无效，请刷新页面后重试。",
  "Invalid month format.": "月份格式无效。",
  "The lookup service isn't configured. Contact the maintainer.": "查词服务未配置，请联系维护人员。",
  "Voce is invite-only. Open your invitation link to create an account.": "Voce 仅限受邀使用，请通过邀请链接打开并注册账户。",
  "This word no longer exists.": "该词条已不存在或已被删除。",
  "You don't have permission to update this word.": "你没有权限修改该词条。",
  "You don't have permission to delete this word.": "你没有权限删除该词条。",
};

export function getUserErrorMessage(error: unknown) {
  if (!navigator.onLine) {
    return "当前处于离线状态，请检查网络连接后重试。";
  }
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") {
    const rawMessage = error.data.trim();
    if (knownErrorMessages[rawMessage]) {
      return knownErrorMessages[rawMessage];
    }
    const hourlyLimitMatch = rawMessage.match(/^You've reached the hourly lookup limit\. Try again in (\d+) minute(?:s)?\.$/);
    if (hourlyLimitMatch) {
      return `已达到每小时查词上限，请在 ${hourlyLimitMatch[1]} 分钟后重试。`;
    }
    const wordLengthMatch = rawMessage.match(/^Words can't exceed (\d+) characters\.$/);
    if (wordLengthMatch) {
      return `词语长度不能超过 ${wordLengthMatch[1]} 个字符。`;
    }
    return rawMessage;
  }
  return "请求未能完成，请稍后重试。";
}

