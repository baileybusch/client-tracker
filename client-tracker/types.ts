export interface Product {
  id: string
  name: string
  contracted: number
  current: number
  progress: number
  startDate: string
  endDate: string
  periodQty: number[]
  growthRate: number
  forecastedEndQty: number
  utilizationType?: 'annual' | 'cumulative'
  annualQty?: number
  termQty?: number
}

