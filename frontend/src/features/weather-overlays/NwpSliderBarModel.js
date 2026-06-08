function formatNwpTime(time, tz = 'KST') {
  const valid = Date.parse(time?.validTime)
  if (!Number.isFinite(valid)) return `+${time?.hf ?? 0}h`
  const offset = tz === 'KST' ? 9 * 60 * 60 * 1000 : 0
  const d = new Date(valid + offset)
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hour = String(d.getUTCHours()).padStart(2, '0')
  const minute = String(d.getUTCMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

export function formatNwpTimeTick(time, previousTime = null, tz = 'KST') {
  const label = formatNwpTime(time, tz)
  const previousLabel = previousTime ? formatNwpTime(previousTime, tz) : null
  const [datePart, timePart] = label.split(' ')
  const previousDatePart = previousLabel?.split(' ')?.[0]
  return !previousTime || datePart !== previousDatePart ? label : timePart || label
}

export function shouldCommitNwpSelection(eventType) {
  return ['change', 'pointerup', 'keyup', 'blur'].includes(eventType)
}

export function getNwpSliderOptions({ levels = [], times = [], selection = null, availability = null }) {
  const availableTimes = selection
    ? times.filter((time) => availability?.[selection.level]?.[String(time.hf)])
    : []
  const availableLevels = levels.filter((level) =>
    times.some((time) => availability?.[level.id]?.[String(time.hf)]),
  )
  return {
    availableLevels,
    availableTimes,
    showTimeSlider: availableTimes.length > 1,
    showLevelSlider: availableLevels.length > 1,
  }
}
