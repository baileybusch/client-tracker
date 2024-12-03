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
  const start = new Date(startDate);
  const usage = new Date(usageDate);
  
  if (utilizationType === 'annual') {
    start.setFullYear(usage.getFullYear());
    const monthsElapsed = (usage.getMonth() - start.getMonth()) +
      (usage.getDate() < start.getDate() ? 0 : 1);
    const monthlyRate = contracted / 12;
    const expectedAmount = monthlyRate * monthsElapsed;
    
    if (current > contracted) {
      return { 
        status: 'exceeding', 
        expectedAmount,
        monthsElapsed
      };
    }

    const variance = Math.abs(current - expectedAmount) / expectedAmount * 100;

    if (variance <= 10) {
      return { status: 'on-target', expectedAmount, monthsElapsed };
    } else if (current > expectedAmount) {
      return { status: 'over-pacing', expectedAmount, monthsElapsed };
    } else {
      return { status: 'under-pacing', expectedAmount, monthsElapsed };
    }
  } else {
    if (!endDate) {
      return {
        status: 'under-pacing',
        expectedAmount: 0,
        monthsElapsed: 0
      };
    }

    const end = new Date(endDate);
    
    const totalContractMonths = 
      (end.getFullYear() - start.getFullYear()) * 12 + 
      (end.getMonth() - start.getMonth());
    
    const monthlyContractedAmount = contracted / totalContractMonths;
    
    const monthsElapsed = 
      (usage.getFullYear() - start.getFullYear()) * 12 + 
      (usage.getMonth() - start.getMonth()) +
      (usage.getDate() < start.getDate() ? 0 : 1);
    
    const expectedAmount = monthlyContractedAmount * monthsElapsed;

    if (current > contracted) {
      return { 
        status: 'exceeding', 
        expectedAmount,
        monthsElapsed 
      };
    }

    const variance = Math.abs(current - expectedAmount) / expectedAmount * 100;

    if (variance <= 10) {
      return { status: 'on-target', expectedAmount, monthsElapsed };
    } else if (current > expectedAmount) {
      return { status: 'over-pacing', expectedAmount, monthsElapsed };
    } else {
      return { status: 'under-pacing', expectedAmount, monthsElapsed };
    }
  }
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
      return 'Projected on target';
    case 'over-pacing':
      return 'Projected to go over';
    case 'under-pacing':
      return 'Projected to be under';
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