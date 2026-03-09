/**
 * Connection states that require user attention or indicate errors.
 * Used to detect connections that need re-authentication or are broken.
 */

const ACTION_NEEDED_STATES = new Set([
  'SCARequired',
  'additionalInformationNeeded',
  'decoupled',
  'webauthRequired',
])

const ERROR_STATES = new Set(['wrongpass', 'bug'])

/**
 * Returns true if the connection state indicates the user needs to take action
 * (either re-authenticate or fix an error).
 */
export function isConnectionStateActionNeeded(
  state: string | null | undefined,
): boolean {
  if (!state) return false
  return ACTION_NEEDED_STATES.has(state) || ERROR_STATES.has(state)
}
