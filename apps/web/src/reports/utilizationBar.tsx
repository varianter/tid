import { ProgressBar } from "@tid/ui";

const utilizationColor = "var(--palette-purple-500)";

/** Logged time filling up to capacity. Any unit works, as long as both share it. */
export function UtilizationBar({ logged, capacity }: { logged: number; capacity: number }) {
  return <ProgressBar max={capacity} segments={[{ value: logged, color: utilizationColor }]} />;
}
