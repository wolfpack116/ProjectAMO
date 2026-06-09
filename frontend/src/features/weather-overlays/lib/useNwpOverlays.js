import { useMemo, useState } from 'react'
import { useKimSurfaceWind } from './useKimSurfaceWind.js'
import { useKimTemperature } from './useKimTemperature.js'
import { useKimCloudPotential } from './useKimCloudPotential.js'
import { useKimIcing } from './useKimIcing.js'
import { useKtgTurbulence } from './useKtgTurbulence.js'
import { getCloudPotentialMaxSpread } from './cloudPotentialField.js'

export function useNwpOverlays({ enableWindOverlay, metVisibility, windFlowOpacity, windFlowTrail, windFlowWidth }) {
  const [nwpSelection, setNwpSelection] = useState(null)

  const windEnabled = enableWindOverlay && metVisibility.wind
  const tempEnabled = enableWindOverlay && metVisibility.temp
  const cloudEnabled = enableWindOverlay && metVisibility.cloud
  const icingEnabled = enableWindOverlay && metVisibility.icing
  const turbulenceEnabled = enableWindOverlay && metVisibility.turbulence

  const kimSurfaceWind = useKimSurfaceWind(windEnabled, nwpSelection, setNwpSelection)
  const kimTemperature = useKimTemperature(tempEnabled, nwpSelection, setNwpSelection)
  const kimCloudPotential = useKimCloudPotential(cloudEnabled, nwpSelection, setNwpSelection)
  const kimIcing = useKimIcing(icingEnabled, nwpSelection, setNwpSelection)
  const ktgTurbulence = useKtgTurbulence(turbulenceEnabled)

  const windRendererOptions = useMemo(() => ({
    ...(kimSurfaceWind.lowPower
      ? { desktopCap: 800, mobileCap: 800, frameCap: 15, sampleStep: 4, pixelRatioCap: 1.5 }
      : {}),
    adaptiveParticleDensity: true,
    zoomAdaptiveDensity: true,
    samplerLod: true,
    flowColorMode: metVisibility.windSpeed ? 'neutral' : 'speed',
    flowOpacity: windFlowOpacity,
    flowWidth: windFlowWidth,
    trailPersistence: windFlowTrail,
  }), [kimSurfaceWind.lowPower, metVisibility.windSpeed, windFlowOpacity, windFlowTrail, windFlowWidth])

  const nwpSliderSource = metVisibility.icing
    ? kimIcing
    : metVisibility.cloud
    ? kimCloudPotential
    : metVisibility.temp
      ? kimTemperature
      : kimSurfaceWind

  const nwpSliderIndex = metVisibility.icing
    ? kimIcing.icingIndex
    : metVisibility.cloud
    ? kimCloudPotential.cloudIndex
    : metVisibility.temp
      ? kimTemperature.temperatureIndex
      : kimSurfaceWind.windIndex

  return {
    // map sync
    windField: kimSurfaceWind.windField,
    windRendererOptions,
    temperatureField: kimTemperature.temperatureField,
    cloudField: kimCloudPotential.cloudField,
    icingField: kimIcing.icingField,
    ktgGrid: ktgTurbulence.ktgGrid,
    // WeatherOverlayPanel status + controls
    windStatus: kimSurfaceWind.status,
    tempStatus: kimTemperature.status,
    cloudStatus: kimCloudPotential.status,
    icingStatus: kimIcing.status,
    turbulenceStatus: ktgTurbulence.status,
    lowPower: kimSurfaceWind.lowPower,
    // WeatherLegends
    cloudMaxSpread: getCloudPotentialMaxSpread(kimCloudPotential.cloudField),
    // KTG turbulence altitude slider
    altLevelsFt: ktgTurbulence.altLevelsFt,
    selectedAltFt: ktgTurbulence.selectedAltFt,
    setSelectedAltFt: ktgTurbulence.setSelectedAltFt,
    // NWP level/time slider
    sliderLevels: nwpSliderSource.availableLevels,
    sliderTimes: nwpSliderSource.availableTimes,
    sliderAvailability: nwpSliderIndex?.availability,
    nwpSelection,
    setNwpSelection,
  }
}
