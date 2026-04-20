export interface TimeSlot {
  id: string;
  from: string; // "HH:mm" format (24h)
  to: string;   // "HH:mm" format (24h)
  category: string;
  color?: string;
}

export interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  Sunrise: string;
}

export interface UserSettings {
  schedule: TimeSlot[];
  autoPrayerAlarm: boolean;
  focusMinutes: number;
  breakMinutes: number;
  earlyWarningMinutes: number;
  calculationMethod: number; 
  googleSheetsEnabled?: boolean;
  googleSheetId?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}
