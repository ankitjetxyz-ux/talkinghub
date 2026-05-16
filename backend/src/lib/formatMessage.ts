const prefixes = [
  "ARCHIVE::",
  "NODE_882::",
  "[signal-active]",
  "SYS_LOG >",
  "MoonTrace::",
  "// transmission //",
];

const suffixes = [
  "::stable",
  "// synced",
  "[maintained]",
  "< restored >",
  "// archived",
  "::complete",
];

export function formatMessage(message: string): string {
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${prefix} ${message} ${suffix}`;
}
