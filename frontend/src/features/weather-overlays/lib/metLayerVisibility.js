export function getNextMetVisibility(prev, id, { lowPower = false } = {}) {
  if (id === 'wind') {
    const nextWind = !prev.wind
    return {
      ...prev,
      wind: nextWind,
      temp: false,
      cloud: false,
      icing: false,
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
      icing: false,
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
      icing: false,
      windFlow: false,
    }
  }
  if (id === 'icing') {
    const nextIcing = !prev.icing
    return {
      ...prev,
      icing: nextIcing,
      wind: false,
      temp: false,
      cloud: false,
      windFlow: false,
    }
  }
  return { ...prev, [id]: !prev[id] }
}

export default getNextMetVisibility
