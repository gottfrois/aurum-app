import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'purge expired audit logs',
  { hours: 1 },
  internal.auditLog.purgeExpiredLogs,
)

crons.interval(
  'purge expired batch operations',
  { minutes: 5 },
  internal.batchOperations.purgeExpiredOperations,
)

export default crons
