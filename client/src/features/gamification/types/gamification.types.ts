// Gamification Types

export interface GamificationTier {
  name: string;
  minPoints: number;
  bonusPercentage: number;
}

export interface GamificationConfig {
  _id?: string;
  enabled: boolean;
  pointsRatio: {
    amountPerPoint: number;
    currency: string;
  };
  cycle: {
    duration: "weekly" | "biweekly" | "monthly";
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  tiers: GamificationTier[];
  productMultipliers: Array<{
    product: string;
    multiplier: number;
  }>;
}

export interface PointsHistoryEntry {
  _id?: string;
  type: "earned" | "reverted" | "reset" | "adjustment";
  points: number;
  sale?: string;
  saleGroupId?: string;
  productName?: string;
  multiplier: number;
  saleAmount: number;
  description: string;
  createdAt: string;
}

export interface RankingEntry {
  position: number;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  currentPoints: number;
  tier: GamificationTier | null;
  nextTier: GamificationTier | null;
  pointsToNextTier: number;
  bonusPercentage: number;
}

export interface MyPointsData {
  enabled: boolean;
  currentPoints: number;
  tier: GamificationTier | null;
  nextTier: GamificationTier | null;
  pointsToNextTier: number;
  bonusPercentage: number;
  isEligibleForBonus: boolean;
  rankPosition: number;
  recentHistory: PointsHistoryEntry[];
  period: {
    start: string | null;
    end: string | null;
    duration: string;
  };
}

export interface RankingData {
  enabled: boolean;
  ranking: RankingEntry[];
  period: {
    start: string | null;
    end: string | null;
    duration: string;
  } | null;
  tiers: GamificationTier[];
}

export interface PeriodWinnerEntry {
  _id: string;
  periodType: string;
  startDate: string;
  endDate: string;
  winner: { _id: string; name: string; email: string };
  winnerName: string;
  totalPointsForPeriod: number;
  topPerformers: Array<{
    employee: { _id: string; name: string; email: string };
    position: number;
    totalPoints: number;
    tierReached: string;
  }>;
}
