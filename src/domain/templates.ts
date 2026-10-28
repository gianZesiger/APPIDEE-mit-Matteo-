import { app } from '../i18n/de-CH';
import { PRESETS } from './presets';

export interface HabitTemplate {
  key: string;
  name: string;
  emoji: string;
  unit: string;
  question: string;
  perDay: number;
  price: number;
  step: number;
  priceHint: string;
  timeBased?: boolean; // Social Media: Stunden statt Geld
}

export const TEMPLATES: HabitTemplate[] = PRESETS.map((b) => ({ ...b, ...app.templates[b.key] }));

export function templateByKey(key: string): HabitTemplate {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[TEMPLATES.length - 1];
}
