export function logPerf(label: string, value?: string | number) {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[Voce Perf] ${label}: ${value ?? `${performance.now().toFixed(0)} ms`}`);
  }
}
