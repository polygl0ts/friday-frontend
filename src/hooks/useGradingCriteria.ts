import { useQuery } from "@tanstack/react-query";
import { getGradingCriteria } from "../api/extras";
import type { GradingCriteria } from "../types";

/**
 * The shape of a grading sheet, from the server. Admin-only endpoint, so
 * callers pass `enabled` from their admin check rather than letting a 403
 * land in the query cache. Effectively constant for a deployment, hence the
 * long stale time.
 */
export function useGradingCriteria(enabled = true) {
  return useQuery<GradingCriteria>({
    queryKey: ["gradingCriteria"],
    queryFn: getGradingCriteria,
    enabled,
    staleTime: Infinity,
  });
}
