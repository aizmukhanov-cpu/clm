-- AddValueToEnum: CLMCohort
-- LAPSED_DEEP: 180+ days without transactions (deep churn, win-back scenario)
ALTER TYPE "CLMCohort" ADD VALUE IF NOT EXISTS 'LAPSED_DEEP';
