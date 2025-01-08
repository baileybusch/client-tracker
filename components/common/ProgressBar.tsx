import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface ProgressBarProps {
  current: number
  contracted: number
  startDate: string
  endDate: string
  annualQty?: number
  termQty?: number
  utilizationType?: 'annual' | 'cumulative'
  usageDate: string
  showStatus?: boolean
}

export type UtilizationStatus = 'exceeding' | 'on-target' | 'over-pacing' | 'under-pacing';

export const calculateUtilizationStatus = (
  current: number,
  contracted: number,
  startDate: string,
  usageDate: string,
  utilizationType: 'annual' | 'cumulative',
  endDate?: string
): { status: UtilizationStatus; expectedAmount: number; monthsElapsed: number } => {
  if (!startDate || !usageDate || !contracted) {
    return { status: 'on-target', expectedAmount: 0, monthsElapsed: 0 };
  }

  const start = new Date(startDate);
  const usage = new Date(usageDate);
  const end = endDate ? new Date(endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());

  let monthsElapsed: number;
  let expectedAmount: number;

  if (utilizationType === 'annual') {
    // For annual mode:
    // Calculate the monthly quota (annual amount divided by 12)
    const monthlyQuota = contracted / 12;

    // Calculate months elapsed in the current annual term
    const monthsSinceStart = (usage.getFullYear() - start.getFullYear()) * 12 + 
      (usage.getMonth() - start.getMonth()) +
      (usage.getDate() >= start.getDate() ? 1 : 0);

    // If we're in the first year of the contract
    if (monthsSinceStart <= 12) {
      monthsElapsed = monthsSinceStart;
    } else {
      // If we're beyond the first year, calculate months elapsed in current annual term
      const yearsPassed = Math.floor(monthsSinceStart / 12);
      monthsElapsed = monthsSinceStart - (yearsPassed * 12);
    }

    // Calculate expected amount based on monthly quota and elapsed months
    expectedAmount = monthlyQuota * monthsElapsed;
  } else {
    // For cumulative mode:
    // 1. Calculate total months elapsed since contract start
    monthsElapsed = (usage.getFullYear() - start.getFullYear()) * 12 + 
      (usage.getMonth() - start.getMonth()) +
      (usage.getDate() >= start.getDate() ? 1 : 0);

    // 2. Calculate total contract duration in months
    const totalContractMonths = (end.getFullYear() - start.getFullYear()) * 12 + 
      (end.getMonth() - start.getMonth()) +
      (end.getDate() >= start.getDate() ? 1 : 0);

    // 3. Calculate expected amount based on elapsed portion of total contract
    expectedAmount = (contracted / totalContractMonths) * monthsElapsed;
  }

  // Ensure we don't have negative values
  monthsElapsed = Math.max(0, monthsElapsed);
  expectedAmount = Math.max(0, expectedAmount);

  // Calculate the percentage difference between actual and expected
  const difference = expectedAmount > 0 ? ((current - expectedAmount) / expectedAmount) * 100 : 0;

  // Determine status
  let status: UtilizationStatus;
  if (current >= contracted) {
    status = 'exceeding';
  } else if (difference >= 10) {
    status = 'over-pacing';
  } else if (difference <= -10) {
    status = 'under-pacing';
  } else {
    status = 'on-target';
  }

  return { status, expectedAmount, monthsElapsed };
};

export const getStatusColor = (status: UtilizationStatus): string => {
  switch (status) {
    case 'exceeding':
      return '#ef4444';
    case 'on-target':
      return '#22c55e';
    case 'over-pacing':
      return '#f97316';
    case 'under-pacing':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
};

export const getStatusText = (status: UtilizationStatus): string => {
  switch (status) {
    case 'exceeding':
      return 'Currently exceeding contracted amount';
    case 'on-target':
      return 'On pace with expected volume';
    case 'over-pacing':
      return 'Projected to exceed contracted amount';
    case 'under-pacing':
      return 'Projected to be under contracted amount';
    default:
      return '';
  }
};

export const getStatusLabel = (status: UtilizationStatus): string => {
  switch (status) {
    case 'exceeding':
      return 'CURRENTLY OVER';
    case 'on-target':
      return 'ON TARGET';
    case 'over-pacing':
      return 'OVER PACE';
    case 'under-pacing':
      return 'UNDER PACE';
    default:
      return '';
  }
};

export function ProgressBar({ 
  current, 
  contracted, 
  startDate, 
  endDate, 
  annualQty,
  termQty,
  utilizationType = 'annual',
  usageDate,
  showStatus = true
}: ProgressBarProps) {
  const effectiveContracted = utilizationType === 'annual' 
    ? (annualQty || contracted) 
    : (termQty || contracted);

  const percentage = (current / effectiveContracted) * 100
  const isOverage = percentage > 100
  
  const blackBarWidth = isOverage 
    ? (effectiveContracted / current) * 100
    : percentage

  const utilization = calculateUtilizationStatus(
    current,
    effectiveContracted,
    startDate,
    usageDate,
    utilizationType,
    endDate
  );

  const getAnnualBreakpoints = () => {
    if (utilizationType !== 'cumulative' || !annualQty) return [];
    
    const breakpoints = [];
    let currentBreakpoint = annualQty;
    
    while (currentBreakpoint < effectiveContracted) {
      breakpoints.push((currentBreakpoint / effectiveContracted) * 100);
      currentBreakpoint += annualQty;
    }

    if (currentBreakpoint <= effectiveContracted && 
        (currentBreakpoint / effectiveContracted) * 100 < 98) {
      breakpoints.push((currentBreakpoint / effectiveContracted) * 100);
    }
    
    return breakpoints;
  }

  const annualBreakpoints = getAnnualBreakpoints();

  const hundredPercentPosition = isOverage 
    ? (100 / percentage) * 100  // Convert to percentage of total width
    : 100;

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="relative h-2 bg-gray-100 rounded-lg overflow-visible w-[200px] shrink-0">
        <div 
          className="absolute h-full bg-black"
          style={{ 
            width: `${blackBarWidth}%`,
            borderTopLeftRadius: '0.5rem',
            borderBottomLeftRadius: '0.5rem'
          }}
        />
        
        {isOverage && (
          <div 
            className="absolute h-full"
            style={{ 
              left: `${blackBarWidth}%`,
              right: 0,
              backgroundColor: '#ef4444'
            }}
          />
        )}

        <div className="absolute inset-0">
          <div 
            className="absolute w-0.5 bg-black z-10"
            style={{ 
              left: `${hundredPercentPosition}%`,
              height: '200%',
              top: '-50%',
              transform: 'translateX(-50%)'
            }}
          />

          {utilizationType === 'cumulative' && annualBreakpoints.map((breakpoint, index) => (
            <div 
              key={index}
              className="absolute w-0.5 bg-black z-10 opacity-50"
              style={{ 
                left: `${breakpoint}%`, 
                height: '160%',
                top: '-30%',
                transform: 'translateX(-50%)'
              }}
            />
          ))}
        </div>
      </div>
      <span className="text-xs text-gray-600 whitespace-nowrap shrink-0">
        {percentage > 999 ? '999+' : percentage.toFixed(1)}% used of {utilizationType === 'annual' ? 'Annual' : 'Cumulative'} Qty ({startDate} - {endDate})
      </span>
    </div>
  )
} 