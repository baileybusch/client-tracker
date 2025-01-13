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

export type UtilizationStatus = 'currently-over' | 'over-pace' | 'on-target' | 'under-pace';

interface UtilizationResult {
  status: UtilizationStatus;
  expectedAmount: number;
  monthsElapsed: number;
  isOverContract: boolean;
  periodStart: Date;
  periodEnd: Date;
}

const VOLUME_THRESHOLD = 2_000_000; // 2 million messages
const PERCENTAGE_THRESHOLD = 0.05; // 5% for large volumes
const ON_TARGET_THRESHOLD = 0.02; // 2% under expected

export const calculateUtilizationStatus = (
  current: number,
  contracted: number,
  startDate: string,
  usageDate: string,
  utilizationType: 'annual' | 'cumulative',
  endDate?: string
): UtilizationResult => {
  if (!startDate || !usageDate || !contracted) {
    return {
      status: 'on-target',
      expectedAmount: 0,
      monthsElapsed: 0,
      isOverContract: false,
      periodStart: new Date(),
      periodEnd: new Date()
    };
  }

  const start = new Date(startDate);
  const usage = new Date(usageDate);
  let periodStart: Date;
  let periodEnd: Date;
  let expectedAmount: number;
  let monthsElapsed: number;

  if (utilizationType === 'annual') {
    // Calculate current annual period based on usage date
    const yearsSinceStart = usage.getFullYear() - start.getFullYear();
    periodStart = new Date(start);
    periodStart.setFullYear(start.getFullYear() + yearsSinceStart);
    periodEnd = new Date(periodStart);
    periodEnd.setFullYear(periodStart.getFullYear() + 1);

    // Calculate months elapsed in current annual period
    monthsElapsed = (usage.getMonth() - periodStart.getMonth()) +
      (usage.getDate() >= periodStart.getDate() ? 1 : 0);
    if (monthsElapsed < 0) monthsElapsed += 12;

    // Calculate expected amount for current annual period
    const monthlyQuota = contracted / 12;
    expectedAmount = monthlyQuota * monthsElapsed;
  } else {
    // Cumulative mode
    periodStart = start;
    periodEnd = endDate ? new Date(endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    
    // Calculate total months elapsed since contract start
    monthsElapsed = (usage.getFullYear() - start.getFullYear()) * 12 +
      (usage.getMonth() - start.getMonth()) +
      (usage.getDate() >= start.getDate() ? 1 : 0);

    // Calculate expected amount based on contract duration
    const totalMonths = (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
      (periodEnd.getMonth() - periodStart.getMonth()) +
      (periodEnd.getDate() >= periodStart.getDate() ? 1 : 0);
    
    expectedAmount = (contracted / totalMonths) * monthsElapsed;
  }

  // Determine status using thresholds
  const isOverContract = current >= contracted;
  let status: UtilizationStatus;
  
  if (isOverContract) {
    status = 'currently-over';
  } else {
    // Calculate how far under/over expected we are as a percentage
    const percentageOfExpected = expectedAmount > 0 ? current / expectedAmount : 0;
    
    if (current > expectedAmount) {
      // If current exceeds expected at all, it's over pace
      status = 'over-pace';
    } else if (percentageOfExpected >= (1 - ON_TARGET_THRESHOLD)) {
      // If within 2% under expected, it's on target
      // e.g., if expected is 100M and current is 98.5M (98.5% of expected)
      status = 'on-target';
    } else {
      // If more than 2% under expected, it's under pace
      status = 'under-pace';
    }
  }

  return {
    status,
    expectedAmount,
    monthsElapsed,
    isOverContract,
    periodStart,
    periodEnd
  };
};

export const getStatusColor = (status: UtilizationStatus): string => {
  switch (status) {
    case 'currently-over':
      return '#ef4444';  // red
    case 'on-target':
      return '#22c55e';  // green
    case 'over-pace':
      return '#f97316';  // orange
    case 'under-pace':
      return '#3b82f6';  // blue
    default:
      return '#6b7280';  // gray
  }
};

export const getStatusText = (status: UtilizationStatus): string => {
  switch (status) {
    case 'currently-over':
      return 'Currently exceeding contracted amount';
    case 'on-target':
      return 'On pace with expected volume';
    case 'over-pace':
      return 'Projected to exceed contracted amount';
    case 'under-pace':
      return 'Projected to be under contracted amount';
    default:
      return '';
  }
};

export const getStatusLabel = (status: UtilizationStatus): string => {
  switch (status) {
    case 'currently-over':
      return 'CURRENTLY OVER';
    case 'on-target':
      return 'ON TARGET';
    case 'over-pace':
      return 'OVER PACE';
    case 'under-pace':
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