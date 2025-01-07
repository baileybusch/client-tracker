import { ImportClientData } from "@/types/client";

export const calculateMonthlyGrowthRates = (data: ImportClientData[]): number[] => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  try {
    // Sort data by date
    const sortedData = [...data].sort((a, b) => 
      new Date(a.usageDate).getTime() - new Date(b.usageDate).getTime()
    );

    const monthlyRates: number[] = [];
    for (let i = 1; i < sortedData.length; i++) {
      const currentVolume = sortedData[i].periodQty;
      const previousVolume = sortedData[i - 1].periodQty;
      
      // Only calculate growth rate if previous volume is greater than 0
      if (previousVolume > 0) {
        const growthRate = ((currentVolume - previousVolume) / previousVolume) * 100;
        if (!isNaN(growthRate) && isFinite(growthRate)) {
          monthlyRates.push(growthRate);
        }
      }
    }
    return monthlyRates;
  } catch (error) {
    console.error('Error calculating monthly growth rates:', error);
    return [];
  }
};

export const calculateAverageGrowthRate = (growthRates: number[]): number => {
  if (!growthRates || !Array.isArray(growthRates) || growthRates.length === 0) return 0;

  try {
    const validRates = growthRates.filter(rate => !isNaN(rate) && isFinite(rate));
    if (validRates.length === 0) return 0;
    
    const sum = validRates.reduce((acc, rate) => acc + rate, 0);
    return sum / validRates.length;
  } catch (error) {
    console.error('Error calculating average growth rate:', error);
    return 0;
  }
};

export const calculateForecastedVolume = (
  lastVolume: number,
  averageGrowthRate: number,
  months: number = 12
): number => {
  try {
    if (isNaN(lastVolume) || isNaN(averageGrowthRate) || isNaN(months)) {
      return lastVolume;
    }
    
    const result = lastVolume * Math.pow(1 + averageGrowthRate / 100, months);
    return isFinite(result) ? result : lastVolume;
  } catch (error) {
    console.error('Error calculating forecasted volume:', error);
    return lastVolume;
  }
}; 