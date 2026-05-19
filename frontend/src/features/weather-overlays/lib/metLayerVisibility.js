export function getNextMetVisibility(prev, id, { lowPower = false } = {}) {
  if (id === 'wind') {
    const nextWind = !prev.wind
    return {
      ...prev,
      wind: nextWind,
      temp: false,
      windFlow: nextWind ? !lowPower : prev.windFlow,
      windSpeed: nextWind ? true : prev.windSpeed,
    }
  }
  if (id === 'temp') {
    const nextTemp = !prev.temp
    return {
      ...prev,
      temp: nextTemp,
      wind: false,
      windFlow: false,
    }
  }
  return { ...prev, [id]: !prev[id] }
}

export default getNextMetVisibility
