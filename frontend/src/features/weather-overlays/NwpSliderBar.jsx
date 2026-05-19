import { formatNwpTimeTick, getNwpSliderOptions } from './NwpSliderBarModel.js'

function NwpSliderBar({
  isVisible,
  levels = [],
  times = [],
  selection = null,
  availability = null,
  isElevated = false,
  onSelectionChange,
}) {
  if (!isVisible || !selection) return null

  const { availableLevels, availableTimes, showTimeSlider, showLevelSlider } = getNwpSliderOptions({
    levels,
    times,
    selection,
    availability,
  })
  if (!showTimeSlider && !showLevelSlider) return null

  const selectedIndex = Math.max(0, availableTimes.findIndex((time) => Number(time.hf) === Number(selection.hf)))
  const selectedLevelIndex = Math.max(0, availableLevels.findIndex((level) => level.id === selection.level))
  const selectedLevel = availableLevels[selectedLevelIndex] || availableLevels[0]

  const selectLevel = (levelIndex) => {
    const nextLevel = availableLevels[levelIndex]
    if (!nextLevel) return
    const currentHfAvailable = availability?.[nextLevel.id]?.[String(selection.hf)]
    const nextTime = currentHfAvailable
      ? { hf: selection.hf }
      : times.find((time) => availability?.[nextLevel.id]?.[String(time.hf)])
    if (!nextTime) return
    onSelectionChange?.({ ...selection, level: nextLevel.id, hf: Number(nextTime.hf) })
  }

  return (
    <>
      {showTimeSlider && (
        <div className={`nwp-time-slider-bar${isElevated ? ' nwp-time-slider-bar--elevated' : ''}`}>
          <div className="nwp-time-slider-main">
            <input
              className="nwp-time-slider"
              type="range"
              min="0"
              max={String(availableTimes.length - 1)}
              step="1"
              value={String(selectedIndex)}
              aria-label="NWP forecast time"
              onChange={(event) => {
                const nextTime = availableTimes[Number(event.target.value)]
                if (!nextTime) return
                onSelectionChange?.({ ...selection, hf: Number(nextTime.hf) })
              }}
            />
            <div className="nwp-time-slider-ticks" aria-hidden="true">
              {availableTimes.map((time, index) => (
                <span
                  key={time.hf}
                  className={`nwp-time-slider-tick${Number(time.hf) === Number(selection.hf) ? ' is-active' : ''}`}
                >
                  {formatNwpTimeTick(time, availableTimes[index - 1])}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {showLevelSlider && selectedLevel && (
        <div className="nwp-level-slider-rail" aria-label="NWP level selector">
          <input
            className="nwp-level-slider"
            type="range"
            min="0"
            max={String(availableLevels.length - 1)}
            step="1"
            value={String(selectedLevelIndex)}
            aria-label="NWP level"
            onChange={(event) => selectLevel(Number(event.target.value))}
          />
          <div className="nwp-level-slider-ticks" aria-hidden="true">
            {[...availableLevels].reverse().map((level) => (
              <span
                key={level.id}
                className={`nwp-level-slider-tick${level.id === selection.level ? ' is-active' : ''}`}
              >
                {level.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default NwpSliderBar
