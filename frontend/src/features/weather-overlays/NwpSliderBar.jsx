import { useEffect, useState } from 'react'

import { formatNwpTimeTick, getNwpSliderOptions, shouldCommitNwpSelection } from './NwpSliderBarModel.js'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'

function NwpSliderBar({
  isVisible,
  levels = [],
  times = [],
  selection = null,
  availability = null,
  isElevated = false,
  onSelectionChange,
}) {
  const { tz } = useTimeZone()
  const [draftSelection, setDraftSelection] = useState(selection)

  useEffect(() => {
    setDraftSelection(selection)
  }, [selection?.tmfc, selection?.hf, selection?.level])

  if (!isVisible || !selection) return null

  const activeSelection = draftSelection || selection

  const { availableLevels, availableTimes, showTimeSlider, showLevelSlider } = getNwpSliderOptions({
    levels,
    times,
    selection: activeSelection,
    availability,
  })
  if (!showTimeSlider && !showLevelSlider) return null

  const selectedIndex = Math.max(0, availableTimes.findIndex((time) => Number(time.hf) === Number(activeSelection.hf)))
  const selectedLevelIndex = Math.max(0, availableLevels.findIndex((level) => level.id === activeSelection.level))
  const selectedLevel = availableLevels[selectedLevelIndex] || availableLevels[0]

  const nextTimeSelection = (timeIndex) => {
    const nextTime = availableTimes[timeIndex]
    return nextTime ? { ...selection, ...activeSelection, hf: Number(nextTime.hf) } : null
  }

  const nextLevelSelection = (levelIndex) => {
    const nextLevel = availableLevels[levelIndex]
    if (!nextLevel) return null
    const currentHfAvailable = availability?.[nextLevel.id]?.[String(activeSelection.hf)]
    const nextTime = currentHfAvailable
      ? { hf: activeSelection.hf }
      : times.find((time) => availability?.[nextLevel.id]?.[String(time.hf)])
    if (!nextTime) return null
    return { ...selection, ...activeSelection, level: nextLevel.id, hf: Number(nextTime.hf) }
  }

  const updateDraft = (nextSelection) => {
    if (nextSelection) setDraftSelection(nextSelection)
  }

  const commitSelection = (nextSelection) => {
    if (nextSelection) onSelectionChange?.(nextSelection)
  }

  const handleTimeInput = (event) => updateDraft(nextTimeSelection(Number(event.target.value)))
  const handleTimeChange = (event) => {
    const nextSelection = nextTimeSelection(Number(event.currentTarget.value))
    updateDraft(nextSelection)
    commitSelection(nextSelection)
  }
  const handleTimeCommit = (event) => {
    if (shouldCommitNwpSelection(event.type)) {
      commitSelection(nextTimeSelection(Number(event.currentTarget.value)))
    }
  }
  const handleLevelInput = (event) => updateDraft(nextLevelSelection(Number(event.target.value)))
  const handleLevelChange = (event) => {
    const nextSelection = nextLevelSelection(Number(event.currentTarget.value))
    updateDraft(nextSelection)
    commitSelection(nextSelection)
  }
  const handleLevelCommit = (event) => {
    if (shouldCommitNwpSelection(event.type)) {
      commitSelection(nextLevelSelection(Number(event.currentTarget.value)))
    }
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
              onInput={handleTimeInput}
              onChange={handleTimeChange}
              onPointerUp={handleTimeCommit}
              onKeyUp={handleTimeCommit}
              onBlur={handleTimeCommit}
            />
            <div className="nwp-time-slider-ticks" aria-hidden="true">
              {availableTimes.map((time, index) => (
                <span
                  key={time.hf}
                  className={`nwp-time-slider-tick${Number(time.hf) === Number(activeSelection.hf) ? ' is-active' : ''}`}
                >
                  {formatNwpTimeTick(time, availableTimes[index - 1], tz)}
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
            onInput={handleLevelInput}
            onChange={handleLevelChange}
            onPointerUp={handleLevelCommit}
            onKeyUp={handleLevelCommit}
            onBlur={handleLevelCommit}
          />
          <div className="nwp-level-slider-ticks" aria-hidden="true">
            {[...availableLevels].reverse().map((level) => (
              <span
                key={level.id}
                className={`nwp-level-slider-tick${level.id === activeSelection.level ? ' is-active' : ''}`}
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
