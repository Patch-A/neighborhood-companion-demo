type Phase = "SESSION" | "FUNCTION" | "RESPONSE";

/** Only phase and a bounded HTTP code may reach the page; retain the original cause for debugging. */
export function cloudFailure(phase: Phase, cause: unknown) {
  const value = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
  const numeric = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  const code = Number.isInteger(numeric) && numeric >= 100 && numeric <= 599 ? numeric : null;
  const diagnosticCode = `QM-${phase}-${code ?? "UNKNOWN"}`;
  const result = new Error(`服务连接暂不可用，请稍后重试或手动选图卡。（${diagnosticCode}）`);
  result.name = "CompanionCloudError";
  return Object.assign(result, {code, diagnosticCode, cause});
}
