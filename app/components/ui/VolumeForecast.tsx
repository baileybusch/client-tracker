import { calculateMonthlyGrowthRates, calculateAverageGrowthRate, calculateForecastedVolume } from "@/lib/forecast";
import { ImportClientData } from "@/types/client";

interface VolumeForecastProps {
  usageData: ImportClientData[];
  currentAnnualVolume: number;
}

export function VolumeForecast({ usageData, currentAnnualVolume }: VolumeForecastProps) {
  try {
    const growthRates = calculateMonthlyGrowthRates(usageData);
    const averageGrowthRate = calculateAverageGrowthRate(growthRates);
    const forecastedVolume = calculateForecastedVolume(currentAnnualVolume, averageGrowthRate);

    return (
      <div className="text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Forecasted Next Term:</span>
          <span className="font-medium">
            {Math.round(forecastedVolume).toLocaleString()}
          </span>
          <span className="text-xs opacity-70">
            ({(averageGrowthRate * 100).toFixed(1)}% growth)
          </span>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in VolumeForecast:', error);
    return null;
  }
} 