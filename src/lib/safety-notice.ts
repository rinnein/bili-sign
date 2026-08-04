export const safetyNoticeStorageKey = 'bili-sign:safety-notice:v1'

export function hasAcknowledgedSafetyNotice() {
  return (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(safetyNoticeStorageKey) === 'accepted'
  )
}

export function acknowledgeSafetyNotice() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(safetyNoticeStorageKey, 'accepted')
  }
}
