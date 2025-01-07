import { ImportClientData } from "@/types/client";

export const calculateMonthlyGrowthRates = (data: ImportClientData[]): number[] => {
  const monthlyRates: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const currentVolume = data[i].volume;
    const previousVolume = data[i - 1].volume;
    const growthRate = ((currentVolume - previousVolume) / previousVolume) * 100;
    monthlyRates.push(growthRate);
  }
  return monthlyRates;
};

export const calculateAverageGrowthRate = (growthRates: number[]): number => {
  if (growthRates.length === 0) return 0;
  const sum = growthRates.reduce((acc, rate) => acc + rate, 0);
  return sum / growthRates.length;
};

export const calculateForecastedVolume = (
  lastVolume: number,
  averageGrowthRate: number,
  months: number = 12
): number => {
  return lastVolume * Math.pow(1 + averageGrowthRate / 100, months);
}; 