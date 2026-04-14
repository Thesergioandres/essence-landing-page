/**
 * Gamification Types
 * Feature-Based Architecture
 */

export interface SalesTarget {
  level: string;
  minAmount: number;
  bonus: number;
  badge: string;
}

export interface GeneralRules {
  pointsPerCurrencyUnit: number;
  pointsPerSaleConfirmed: number;
  penaltyPerDayLate: number;
  pointsBase?: "sale" | "commission";
}

export interface LevelBenefits {
  commissionBonus: number;
  discountBonus?: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  minPoints: number;
  benefits: LevelBenefits;
}

export interface ActiveMultiplier {
  type: string;
  targetType?: string;
  targetId?: string;
  value: number;
  active: boolean;
}

export interface CycleConfig {
  duration: "monthly" | "quarterly" | "annual" | "infinite" | "custom";
  customDays?: number;
}

export interface ResetPolicy {
  type: "reset" | "carry" | "downlevel";
  carryPercent?: number;
}

export interface ProductBonus {
  product: string;
  bonusPerUnit: number;
  minQuantity?: number;
}

export interface GamificationConfig {
  _id: string;
  generalRules?: GeneralRules;
  levels?: LevelConfig[];
  activeMultipliers?: ActiveMultiplier[];
  cycle?: CycleConfig;
  resetPolicy?: ResetPolicy;
  evaluationPeriod: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  customPeriodDays?: number;
  topPerformerBonus: number;
  secondPlaceBonus: number;
  thirdPlaceBonus: number;
  top1CommissionBonus?: number;
  top2CommissionBonus?: number;
  top3CommissionBonus?: number;
  minAdminProfitForRanking?: number;
  baseCommissionPercentage?: number;
  currentPeriodStart?: string;
  salesTargets: SalesTarget[];
  productBonuses: ProductBonus[];
  pointsPerSale: number;
  pointsPerPeso: number;
  active: boolean;
  nextEvaluationDate?: string;
  lastEvaluationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopPerformer {
  employee: string;
  position: number;
  totalRevenue: number;
  salesCount: number;
  bonus: number;
}

export interface PeriodWinner {
  _id: string;
  periodType: string;
  startDate: string;
  endDate: string;
  winner: unknown | string;
  winnerName: string;
  winnerEmail: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  salesCount: number;
  bonusAmount: number;
  bonusPaid: boolean;
  bonusPaidAt?: string;
  topPerformers: TopPerformer[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  type: string;
  name: string;
  description: string;
  badge: string;
  earnedAt: string;
  value?: number;
}

export interface EmployeeStats {
  _id: string;
  employee: unknown | string;
  totalPoints: number;
  currentMonthPoints: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  totalBonusEarned: number;
  pendingBonuses: number;
  paidBonuses: number;
  lastBonusDate?: string;
  achievements: Achievement[];
  currentLevel: string;
  currentStreak: number;
  longestStreak: number;
  periodWins: number;
  topThreeFinishes: number;
  createdAt: string;
  updatedAt: string;
}

export interface RankingEntry {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  totalUnits: number;
  position: number;
  totalPoints: number;
  currentLevel: string;
  periodWins: number;
  profitPercentage?: number;
}

export interface RankingResponse {
  period: {
    startDate: string;
    endDate: string;
    type: string;
  };
  rankings: RankingEntry[];
  config: {
    topPerformerBonus: number;
    secondPlaceBonus: number;
    thirdPlaceBonus: number;
    top1CommissionBonus?: number;
    top2CommissionBonus?: number;
    top3CommissionBonus?: number;
    evaluationPeriod?: string;
    customPeriodDays?: number;
    currentPeriodStart?: string;
  };
}

export interface WinnersResponse {
  winners: PeriodWinner[];
  currentPage: number;
  totalPages: number;
  total: number;
}

export interface EmployeeStatsResponse {
  stats: EmployeeStats;
  currentRankingPosition: number;
  totalEmployees: number;
}
