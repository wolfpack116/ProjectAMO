export const ADSB_FETCH_DISABLED = false

export async function fetchAdsbData() {
  if (ADSB_FETCH_DISABLED) {
    return null
  }

  try {
    const response = await fetch('/api/adsb');
    if (response.status === 503) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch ADS-B data:', error);
    return null;
  }
}
