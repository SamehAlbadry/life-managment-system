import { TimeSlot } from './types';

export const INITIAL_SCHEDULE: TimeSlot[] = [
  { id: '1', from: '03:00', to: '04:00', category: 'علوم شرعية (تجويد)', color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500' },
  { id: '2', from: '04:00', to: '04:30', category: 'قيام ليل سورة البقرة', color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500' },
  { id: '3', from: '04:30', to: '04:50', category: 'سحور + أسامي الله الحسنى', color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500' },
  { id: '4', from: '04:50', to: '06:30', category: 'صلاة الفجر + تهجد + قرآن', color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500' },
  { id: '5', from: '06:30', to: '07:00', category: 'meditation + plan for day', color: 'bg-sky-100 dark:bg-sky-900 border-sky-500' },
  { id: '6', from: '07:00', to: '12:00', category: 'work (ibsra data solution)', color: 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500' },
  { id: '7', from: '12:00', to: '12:30', category: 'duhr pray', color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500' },
  { id: '8', from: '12:30', to: '14:30', category: 'work (junior)', color: 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500' },
  { id: '9', from: '14:30', to: '15:30', category: 'work (Education)', color: 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500' },
  { id: '10', from: '15:30', to: '16:00', category: 'Asr Pray', color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500' },
  { id: '11', from: '16:00', to: '18:00', category: 'work (Education)', color: 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500' },
  { id: '12', from: '18:00', to: '21:00', category: 'فطار + مغرب + عشاء + تراويح + اعتكاف + من هو الله + مذاكرة تجويد', color: 'bg-slate-200 dark:bg-slate-800 border-slate-500' },
  { id: '13', from: '21:00', to: '03:00', category: 'Sleep', color: 'bg-slate-100 dark:bg-slate-900 border-slate-400 opacity-60' },
];
