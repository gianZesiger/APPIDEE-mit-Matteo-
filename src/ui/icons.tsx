// Ein einheitliches Icon-Set (Lucide, lokal gebündelt) statt System-Emojis.
// Jede Gewohnheit hat ihr eigenes Icon und eine eigene Tönung (CSS-Variable --tint).
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Armchair,
  BatteryLow,
  BatteryMedium,
  Beer,
  Bike,
  Candy,
  Cigarette,
  Coffee,
  CupSoda,
  Dumbbell,
  Footprints,
  Frown,
  HeartPulse,
  Leaf,
  ListChecks,
  MessageCircleHeart,
  Mountain,
  MountainSnow,
  Package,
  PersonStanding,
  Smartphone,
  Smile,
  Snowflake,
  Sparkles,
  Target,
  Trees,
  Trophy,
  Volleyball,
  Waves,
  Wind,
  Zap,
  Coins,
  Flame,
  Moon,
} from 'lucide-react';

/** Gewohnheit → Icon und Tönung (hell und dunkel lesbar, nur für Flächen und Icons, nie für Text). */
export const HABIT: Record<string, { icon: LucideIcon; tint: string }> = {
  snus: { icon: Package, tint: '#5b7fa6' },
  vape: { icon: Wind, tint: '#7a6fb0' },
  zig: { icon: Cigarette, tint: '#8a7a6a' },
  energy: { icon: Zap, tint: '#c58b1f' },
  mate: { icon: CupSoda, tint: '#4f8a3a' },
  kaffee: { icon: Coffee, tint: '#8a5a3c' },
  alkohol: { icon: Beer, tint: '#b0703a' },
  social: { icon: Smartphone, tint: '#3f86b8' },
  zucker: { icon: Candy, tint: '#c0567a' },
  eigene: { icon: Sparkles, tint: '#0f7f7f' },
};

export const SPORT: Record<string, LucideIcon> = {
  laufen: Footprints,
  velo: Bike,
  wandern: Mountain,
  gehen: PersonStanding,
  schwimmen: Waves,
  kraft: Dumbbell,
  fussball: Volleyball,
  unihockey: Trophy,
  ski: MountainSnow,
  langlauf: Snowflake,
  klettern: Mountain,
  yoga: HeartPulse,
  bewegung: Leaf,
  andere: Activity,
};

export const UI = {
  sos: Leaf,
  breathe: Wind,
  move: Leaf,
  why: MessageCircleHeart,
  plans: ListChecks,
  pot: Target,
  days: Waves,
  money: Coins,
  craving: Leaf,
  rest: Moon,
  sitting: Armchair,
  standing: PersonStanding,
  outside: Trees,
  moodTough: Frown,
  moodOk: Smile,
  moodStrong: Flame,
  feelEmpty: BatteryLow,
  feelOk: BatteryMedium,
  feelGood: Smile,
  feelStrong: Flame,
};

/** Rundes Feld mit dem Icon einer Gewohnheit in ihrer Tönung. */
export function HabitIcon({ k, size = 22, className = '' }: { k: string; size?: number; className?: string }) {
  const h = HABIT[k] ?? HABIT.eigene;
  const I = h.icon;
  return (
    <span className={`habit-ico ${className}`} style={{ ['--tint' as string]: h.tint }} aria-hidden="true">
      <I size={size} strokeWidth={2} />
    </span>
  );
}

export function SportIcon({ k, size = 22 }: { k: string; size?: number }) {
  const I = SPORT[k] ?? Activity;
  return <I size={size} strokeWidth={2} aria-hidden="true" />;
}

/** Einfaches Icon aus dem Set, immer dekorativ (die Bedeutung steht im Text daneben). */
export function Ico({ i: I, size = 22 }: { i: LucideIcon; size?: number }) {
  return <I size={size} strokeWidth={2} aria-hidden="true" />;
}
