const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const recordDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getLocalMonthGroup(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatMonthGroup(monthGroup: string) {
  return monthGroup.replace("-", ".");
}

export function isMonthGroup(value: string) {
  return monthPattern.test(value);
}

export function formatRecordDate(timestamp: number) {
  return recordDateFormatter.format(new Date(timestamp));
}
