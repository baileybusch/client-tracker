import { ImportClientData } from "@/types/client";

export const calculateMonthlyGrowthRates = (periodData: ImportClientData[]): number[] => {
  // Sort data by date
  const sortedData = [...periodData].sort((a, b) => 
    new Date(a.usageDate).getTime() - new Date(b.usageDate).getTime()
  );

  // Group data by month
  const monthlyData = sortedData.reduce((acc, curr) => {
    const date = new Date(curr.usageDate);
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    if (!acc[monthKey]) {
      acc[monthKey] = curr.periodQty;
    } else {
      acc[monthKey] += curr.periodQty;
    }
    return acc;
  }, {} as Record<string, number>);

  // Calculate YoY growth rates
  const growthRates: number[] = [];
  const months = Object.keys(monthlyData).sort();
  
  months.forEach((month, index) => {
    const [year, monthNum] = month.split('-').map(Number);
    const lastYear = `${year - 1}-${monthNum}`;
    
    if (monthlyData[lastYear]) {
      const growth = (monthlyData[month] - monthlyData[lastYear]) / monthlyData[lastYear];
      growthRates.push(growth);
    }
  });

  return growthRates;
};

export const calculateAverageGrowthRate = (growthRates: number[]): number => {
  if (growthRates.length === 0) return 0;
  
  // Remove outliers (optional)
  const sortedRates = [...growthRates].sort((a, b) => a - b);
  const q1Index = Math.floor(sortedRates.length * 0.25);
  const q3Index = Math.floor(sortedRates.length * 0.75);
  const filteredRates = sortedRates.slice(q1Index, q3Index + 1);
  
  return filteredRates.reduce((sum, rate) => sum + rate, 0) / filteredRates.length;
};

export const calculateForecastedVolume = (
  currentAnnualVolume: number,
  growthRate: number
): number => {
  return currentAnnualVolume * (1 + growthRate);
}; 