export function getNextMetVisibility(prev, id, { lowPower = false } = {}) {
  if (id === 'wind') {
    const nextWind = !prev.wind
    return {
      ...prev,
      wind: nextWind,
      temp: false,
      cloud: false,
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
      cloud: false,
      windFlow: false,
    }
  }
  if (id === 'cloud') {
    const nextCloud = !prev.cloud
    return {
      ...prev,
      cloud: nextCloud,
      wind: false,
      temp: false,
      windFlow: false,
    }
  }
  return { ...prev, [id]: !prev[id] }
}

export default getNextMetVisibility
