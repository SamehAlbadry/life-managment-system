import { PrayerTimes } from '../types';

export async function fetchPrayerTimes(lat: number, lng: number, method: number = 2): Promise<PrayerTimes> {
  const date = new Date().toISOString().split('T')[0];
  const response = await fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lng}&method=${method}`);
  const data = await response.json();
  
  if (data.code === 200) {
    return data.data.timings;
  }
  throw new Error('Failed to fetch prayer times');
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    return data.display_name.split(',')[0] || 'Unknown Location';
  } catch {
    return 'Location Set';
  }
}

export function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    }
  });
}
