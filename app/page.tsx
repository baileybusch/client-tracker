"use client"

import { ChevronDown, Plus, Save } from 'lucide-react'
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  ProgressBar, 
  type UtilizationStatus,
  calculateUtilizationStatus,
  getStatusColor,
  getStatusText,
  getStatusLabel 
} from "@/components/common/ProgressBar"

interface Product {
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

interface Client {
  id: string
  name: string
  accountOwner: string
  arr: number
  products: Product[]
  status: {
    marketing: boolean
    engineering: boolean
    dataCenter: boolean
    deployment: boolean
    integration: boolean
    compliance: boolean
  }
  progress: number
  startDate: string
  endDate: string
}

interface UtilizationData {
  month: string;
  [key: string]: string | number; // For dynamic product columns
}

interface ImportClientData {
  accountOwner: string;
  accountName: string;
  volumeType: string;
  startDate: string;
  endDate: string;
  annualQty: number;
  termQty: number;
  usageDate: string;
  periodQty: number;
  consumedQty: number;
  remainingQty: number;
}

type SortType = 'usage-desc' | 'usage-asc' | 'endDate';

interface SortConfig {
  column: 'name' | 'accountOwner' | string;
  sortType: SortType | 'default';
  productName?: string;
}

const initialClients: Client[] = []

const PRODUCT_OPTIONS = [
  'Email',
  'Mobile App Volume',
  'SMS/MMS',
  'SMS',
  'MMS',
  'Open Channel',
  'Architect'
] as const;

const PRODUCT_NAME_MAPPING: { [key: string]: string } = {
  'Cordial Email': 'Email',
  'Email': 'Email',
  'Mobile App Volume': 'Mobile App Volume',
  'Mobile App': 'Mobile App Volume',
  'SMS/MMS': 'SMS/MMS',
  'SMS': 'SMS',
  'MMS': 'MMS',
  'Open Channel': 'Open Channel',
  'Architect': 'Architect'
}

const parseImportData = (text: string): ImportClientData[] => {
  const lines = text.split('\n')
  const _headers = lines[0].split('\t')
  
  console.log('Parsing import data lines:', lines); // Debug log

  return lines.slice(1) // Skip header row
    .filter(line => line.trim()) // Skip empty lines
    .map(line => {
      const values = line.split('\t')
      
      // Log the raw values for debugging
      console.log('Raw values:', values);

      const parsedData = {
        accountOwner: values[0]?.trim() || '',
        accountName: values[1]?.trim() || '',
        volumeType: values[2]?.trim() || '',
        startDate: values[3]?.trim() || '',
        endDate: values[4]?.trim() || '',
        annualQty: parseInt(values[5]?.replace(/,/g, '')) || 0,  // Remove commas and parse as integer
        termQty: parseInt(values[6]?.replace(/,/g, '')) || 0,    // Remove commas and parse as integer
        usageDate: values[7]?.trim() || '',
        periodQty: parseInt(values[8]?.replace(/,/g, '')) || 0,  // Remove commas and parse as integer
        consumedQty: parseInt(values[9]?.replace(/,/g, '')) || 0, // Remove commas and parse as integer
        remainingQty: parseInt(values[10]?.replace(/,/g, '')) || 0 // Remove commas and parse as integer
      };

      // Log the parsed data for debugging
      console.log('Parsed data:', parsedData);

      return parsedData;
    });
}

const _formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch (_error) {
    console.error('Error formatting date:', dateString);
    return '';
  }
}

const calculateFiscalQuarter = (endDate: string): string => {
  const date = new Date(endDate);
  // Adjust month to fiscal year (Feb start)
  const fiscalMonth = (date.getMonth() + 11) % 12; // Shift months so Feb = 0
  const fiscalQuarter = Math.floor(fiscalMonth / 3) + 1;
  const calendarYear = date.getFullYear();
  // Adjust fiscal year if needed (Jan is part of previous fiscal year)
  const fiscalYear = date.getMonth() === 0 ? calendarYear - 1 : calendarYear;
  
  return `FY${fiscalYear.toString().slice(-2)} Q${fiscalQuarter}`;
};

const calculateAnnualUsage = (
  usageData: ImportClientData[],
  startDate: string,
  mostRecentUsageDate: string
): number => {
  // Get the year from most recent usage date
  const currentYear = new Date(mostRecentUsageDate).getFullYear();
  
  // Create annual period dates
  const start = new Date(startDate);
  start.setFullYear(currentYear);
  
  const end = new Date(start);
  end.setFullYear(currentYear + 1);

  // Sum all Period Qty values that fall within this annual period
  return usageData.reduce((sum, data) => {
    const usageDate = new Date(data.usageDate);
    if (usageDate >= start && usageDate < end) {
      return sum + data.periodQty;
    }
    return sum;
  }, 0);
};

export default function ClientTracker() {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'name',
    sortType: 'default'
  });
  const [newClient, setNewClient] = useState({
    name: "",
    arr: "",
    startDate: "",
    endDate: "",
    products: [] as Product[]
  })
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [_editingProduct, setEditingProduct] = useState<{ clientId: string, product: Product } | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [_importData, _setImportData] = useState<ImportClientData[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set(['Email']))
  const [utilizationType, setUtilizationType] = useState<'annual' | 'cumulative'>('annual');
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set());
  const [activeSort, setActiveSort] = useState<{
    productName: string;
    sortType: SortType;
  } | null>(null);

  useEffect(() => {
    // Get all unique account owners
    const owners = new Set(clients.map(client => client.accountOwner));
    setSelectedOwners(owners);
  }, [clients]);

  const handleOwnerSelection = (owner: string) => {
    const newSelected = new Set(selectedOwners);
    if (newSelected.has(owner)) {
      newSelected.delete(owner);
    } else {
      newSelected.add(owner);
    }
    setSelectedOwners(newSelected);
  };

  const _StatusIndicator = ({ 
    label, 
    active, 
    tooltip 
  }: { 
    label: string
    active: boolean
    tooltip: string 
  }) => (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={`inline-flex items-center justify-center w-8 h-8 text-xs font-medium border rounded ${
            active
              ? "bg-primary/10 border-primary text-primary"
              : "bg-muted/50 border-muted-foreground/20 text-muted-foreground"
          }`}
        >
          {label}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )

  const _ProductProgress = ({ 
    contracted, 
    current,
    progress,
    startDate,
    endDate,
    annualQty,
    utilizationType
  }: { 
    contracted: number
    current: number
    progress: number
    startDate: string
    endDate: string
    annualQty?: number
    utilizationType?: 'annual' | 'cumulative'
  }) => {
    // Calculate status
    const { status, expectedAmount } = calculateUtilizationStatus(
      current,
      contracted,
      startDate,
      new Date().toISOString(),
      utilizationType || 'annual'
    );

    return (
      <div className="flex items-center gap-2">
        <ProgressBar 
          contracted={contracted}
          current={current}
          startDate={startDate}
          endDate={endDate}
          annualQty={annualQty}
          utilizationType={utilizationType}
          usageDate={new Date().toISOString()}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div 
                className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                style={{ 
                  backgroundColor: current > contracted ? '#fabc1c' : getStatusColor(status),
                  color: 'white'
                }}
              >
                {getStatusLabel(status)}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div>{getStatusText(status)}</div>
                <div>Expected: {expectedAmount.toLocaleString()}</div>
                <div>Current: {current.toLocaleString()}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  const handleSort = (column: 'name' | 'accountOwner') => {
    // Clear any active product sort
    setActiveSort(null);
    
    setSortConfig({
      column,
      sortType: 'default',
      productName: ''
    });
  };

  const handleProductSort = (productName: string, sortType: SortType) => {
    // Clear any client/account sort
    setSortConfig({
      column: '',
      sortType: 'default',
      productName: ''
    });
    
    setActiveSort({ productName, sortType });
    sortClients(productName, sortType);
  };

  const sortClients = (productName: string, sortType: SortType) => {
    const newSortedClients = [...clients].sort((a, b) => {
      const findProduct = (client: Client, name: string) => {
        return client.products.find(p => 
          p.name === name || 
          PRODUCT_NAME_MAPPING[p.name] === name ||
          name === PRODUCT_NAME_MAPPING[p.name]
        );
      };

      const _productA = findProduct(a, productName);
      const _productB = findProduct(b, productName);

      const hasValidData = (product: Product | undefined) => {
        if (!product) return false;
        if (!product.contracted || product.contracted <= 0) return false;
        if (!product.endDate) return false;
        return true;
      };

      const isValidA = hasValidData(_productA);
      const isValidB = hasValidData(_productB);

      // If either product is invalid, move it to the bottom
      if (!isValidA && isValidB) return 1;
      if (isValidA && !isValidB) return -1;
      if (!isValidA && !isValidB) return 0;

      // Calculate usage percentages and status
      const getProductStatus = (product: Product) => {
        const contracted = utilizationType === 'annual' 
          ? (product.annualQty || product.contracted)
          : (product.termQty || product.contracted);
        const percentage = (product.current / contracted) * 100;
        
        if (percentage > 100) return 'exceeding';
        
        const { status } = calculateUtilizationStatus(
          product.current,
          contracted,
          product.startDate,
          new Date().toISOString(),
          utilizationType
        );
        return status;
      };

      const statusA = getProductStatus(_productA!);
      const statusB = getProductStatus(_productB!);

      // Define status priority (4 = highest, 1 = lowest)
      const getStatusPriority = (status: UtilizationStatus): number => {
        switch (status) {
          case 'exceeding': return 4;    // Currently Over
          case 'over-pacing': return 3;  // Over Pace
          case 'on-target': return 2;    // On Target
          case 'under-pacing': return 1; // Under Pace
          default: return 0;
        }
      };

      if (sortType === 'usage-desc') {
        // First sort by status priority
        const priorityDiff = getStatusPriority(statusB) - getStatusPriority(statusA);
        if (priorityDiff !== 0) return priorityDiff;

        // Within same status, sort by percentage
        const percentageA = (_productA!.current / (utilizationType === 'annual' 
          ? (_productA!.annualQty || _productA!.contracted)
          : (_productA!.termQty || _productA!.contracted))) * 100;
        const percentageB = (_productB!.current / (utilizationType === 'annual'
          ? (_productB!.annualQty || _productB!.contracted)
          : (_productB!.termQty || _productB!.contracted))) * 100;
        return percentageB - percentageA;
      }

      if (sortType === 'usage-asc') {
        // Reverse the priority for ascending sort
        const priorityDiff = getStatusPriority(statusA) - getStatusPriority(statusB);
        if (priorityDiff !== 0) return priorityDiff;

        const percentageA = (_productA!.current / (utilizationType === 'annual'
          ? (_productA!.annualQty || _productA!.contracted)
          : (_productA!.termQty || _productA!.contracted))) * 100;
        const percentageB = (_productB!.current / (utilizationType === 'annual'
          ? (_productB!.annualQty || _productB!.contracted)
          : (_productB!.termQty || _productB!.contracted))) * 100;
        return percentageA - percentageB;
      }

      if (sortType === 'endDate') {
        const dateA = new Date(_productA!.endDate).getTime();
        const dateB = new Date(_productB!.endDate).getTime();
        return dateA - dateB;
      }

      return 0;
    });

    setClients(newSortedClients);
  };

  const handleUtilizationTypeChange = (newType: 'annual' | 'cumulative') => {
    setUtilizationType(newType);
    
    if (activeSort && activeSort.productName) {
      sortClients(activeSort.productName, activeSort.sortType);
    } else if (sortConfig.column === 'name' || sortConfig.column === 'accountOwner') {
      // Re-sort by client name or account owner if that's the active sort
      const newSortedClients = [...clients].sort((a, b) => {
        if (sortConfig.column === 'name') {
          return a.name.localeCompare(b.name);
        }
        return a.accountOwner.localeCompare(b.accountOwner);
      });
      setClients(newSortedClients);
    }
  };

  const sortedClients = [...clients]
    .filter(client => selectedOwners.has(client.accountOwner))
    .sort((a, b) => {
      // Handle basic column sorting
      if (sortConfig.column === 'name') {
        return a.name.localeCompare(b.name);
      }
      
      if (sortConfig.column === 'accountOwner') {
        return a.accountOwner.localeCompare(b.accountOwner);
      }

      // If no basic sort is active but there's an active product sort, use that
      if (activeSort) {
        const findProduct = (client: Client, name: string) => {
          return client.products.find(p => 
            p.name === name || 
            PRODUCT_NAME_MAPPING[p.name] === name ||
            name === PRODUCT_NAME_MAPPING[p.name]
          );
        };

        const _productA = findProduct(a, activeSort.productName);
        const _productB = findProduct(b, activeSort.productName);

        // Use the existing product sorting logic
        // ... rest of your product sorting logic ...
      }

      return 0;
    });

  const _handleAddNewProduct = () => {
    const newProduct: Product = {
      id: `temp-${newClient.products.length + 1}`,
      name: "",
      contracted: 0,
      current: 0,
      progress: 0,
      startDate: newClient.startDate,
      endDate: newClient.endDate,
      periodQty: [],
      growthRate: 0,
      forecastedEndQty: 0
    }
    setNewClient({
      ...newClient,
      products: [...newClient.products, newProduct]
    })
  }

  const _addClient = () => {
    if (newClient.name && newClient.arr && newClient.startDate && newClient.endDate) {
      const newClientData: Client = {
        id: (clients.length + 1).toString(),
        name: newClient.name,
        accountOwner: "",
        arr: parseFloat(newClient.arr),
        products: newClient.products.map(product => ({
          ...product,
          id: `new-${Math.random().toString(36).substr(2, 9)}`
        })),
        status: {
          marketing: false,
          engineering: false,
          dataCenter: false,
          deployment: false,
          integration: false,
          compliance: false,
        },
        progress: 0,
        startDate: newClient.startDate,
        endDate: newClient.endDate,
      }
      setClients([...clients, newClientData])
      setNewClient({
        name: "",
        arr: "",
        startDate: "",
        endDate: "",
        products: []
      })
    }
  }

  const _updateClient = (updatedClient: Client) => {
    const updatedProducts = updatedClient.products.map(product => ({
      ...product,
      startDate: product.startDate === editingClient?.startDate ? updatedClient.startDate : product.startDate,
      endDate: product.endDate === editingClient?.endDate ? updatedClient.endDate : product.endDate,
    }))

    const finalUpdatedClient = {
      ...updatedClient,
      products: updatedProducts
    }

    setClients(clients.map(client => 
      client.id === finalUpdatedClient.id ? finalUpdatedClient : client
    ))
    setEditingClient(null)
  }

  const _deleteClient = (clientId: string) => {
    setClients(clients.filter(client => client.id !== clientId))
    setEditingClient(null)
  }

  const _addProduct = (clientId: string, newProduct: Product) => {
    setClients(prevClients => {
      return prevClients.map(client => {
        if (client.id === clientId) {
          const updatedProducts = [...client.products, {
            ...newProduct,
            progress: (newProduct.current / newProduct.contracted) * 100
          }]
          
          // Calculate new client dates
          const allStartDates = updatedProducts.map(p => new Date(p.startDate).getTime())
          const allEndDates = updatedProducts.map(p => new Date(p.endDate).getTime())
          const newStartDate = new Date(Math.min(...allStartDates)).toISOString().split('T')[0]
          const newEndDate = new Date(Math.max(...allEndDates)).toISOString().split('T')[0]

          return {
            ...client,
            startDate: newStartDate,
            endDate: newEndDate,
            products: updatedProducts
          }
        }
        return client
      })
    })
    
    setEditingProduct(null)
  }

  const _updateProduct = (clientId: string, updatedProduct: Product) => {
    const newProduct = {
      ...updatedProduct,
      progress: (updatedProduct.current / updatedProduct.contracted) * 100,
      startDate: updatedProduct.startDate || '',  // Ensure dates are included
      endDate: updatedProduct.endDate || ''
    }

    setClients(prevClients => {
      return prevClients.map(client => {
        if (client.id === clientId) {
          const updatedProducts = client.products.map(product => 
            product.id === newProduct.id ? newProduct : product
          )
          
          // Calculate new client dates based on all products
          const allStartDates = updatedProducts.map(p => new Date(p.startDate).getTime())
          const allEndDates = updatedProducts.map(p => new Date(p.endDate).getTime())
          const newStartDate = new Date(Math.min(...allStartDates)).toISOString().split('T')[0]
          const newEndDate = new Date(Math.max(...allEndDates)).toISOString().split('T')[0]

          return {
            ...client,
            startDate: newStartDate,
            endDate: newEndDate,
            products: updatedProducts
          }
        }
        return client
      })
    })
    
    setEditingProduct(null)
  }

  const _deleteProduct = (clientId: string, productId: string) => {
    setClients(clients.map(client => {
      if (client.id === clientId) {
        return {
          ...client,
          products: client.products.filter(product => product.id !== productId)
        }
      }
      return client
    }))
    setEditingProduct(null)
  }

  const handleImportClients = () => {
    try {
      const parsedImportData = parseImportData(importText);
      console.log('Initial parsed data:', parsedImportData);

      // Group by account name and account owner
      const clientGroups = parsedImportData.reduce((acc, row) => {
        const accountName = row.accountName.trim()
        if (!acc[accountName]) {
          acc[accountName] = {
            accountOwner: row.accountOwner.trim(),
            products: []
          }
        }
        acc[accountName].products.push({
          ...row,
          annualQty: Number(row.annualQty),
          termQty: Number(row.termQty),
          consumedQty: Number(row.consumedQty),
          periodQty: Number(row.periodQty),
          remainingQty: Number(row.remainingQty)
        })
        return acc
      }, {} as Record<string, { accountOwner: string, products: ImportClientData[] }>)

      console.log('Client groups:', clientGroups);

      const updatedClients = [...clients]
      
      Object.entries(clientGroups).forEach(([accountName, data]) => {
        // Group products by volumeType
        const productUsageMap = data.products.reduce((acc, row) => {
          const volumeType = row.volumeType.trim()
          if (!acc[volumeType]) {
            acc[volumeType] = []
          }
          acc[volumeType].push(row)
          return acc
        }, {} as Record<string, ImportClientData[]>)

        console.log('Product usage map for', accountName, ':', productUsageMap);

        // Process each product type
        const processedProducts = Object.entries(productUsageMap).map(([volumeType, usageData]) => {
          // Sort by usage date to get most recent
          const sortedUsage = [...usageData].sort((a, b) => 
            new Date(b.usageDate).getTime() - new Date(a.usageDate).getTime()
          );
          
          const mostRecent = sortedUsage[0];
          console.log('Most recent usage data for', volumeType, ':', mostRecent);

          // Calculate current based on utilization type
          const currentAmount = utilizationType === 'annual'
            ? calculateAnnualUsage(sortedUsage, mostRecent.startDate, mostRecent.usageDate)
            : mostRecent.consumedQty;

          // Set contracted amount based on utilization type
          const contractedAmount = utilizationType === 'annual' 
            ? mostRecent.annualQty  // Use Annual Qty for annual mode
            : mostRecent.termQty;   // Use Term Qty for cumulative mode

          console.log('Final processed values for', volumeType, ':', {
            current: currentAmount,
            contracted: contractedAmount,
            usageDate: mostRecent.usageDate,
            utilizationType,
            annualQty: mostRecent.annualQty,
            termQty: mostRecent.termQty
          });

          return {
            id: `new-${Math.random().toString(36).substr(2, 9)}`,
            name: volumeType,
            startDate: mostRecent.startDate,
            endDate: mostRecent.endDate,
            current: currentAmount,
            contracted: contractedAmount,
            progress: (currentAmount / contractedAmount) * 100,
            periodQty: [],
            growthRate: 0,
            forecastedEndQty: 0,
            annualQty: mostRecent.annualQty,  // Store both quantities
            termQty: mostRecent.termQty       // Store both quantities
          };
        });

        // Find existing client
        const existingClientIndex = updatedClients.findIndex(
          client => client.name.toLowerCase() === accountName.toLowerCase()
        )

        if (existingClientIndex !== -1) {
          // Update existing client
          updatedClients[existingClientIndex] = {
            ...updatedClients[existingClientIndex],
            accountOwner: data.accountOwner,
            products: processedProducts
          }
        } else {
          // Create new client
          const newClient: Client = {
            id: `new-${Math.random().toString(36).substr(2, 9)}`,
            name: accountName,
            accountOwner: data.accountOwner,
            arr: 0,
            startDate: processedProducts[0]?.startDate || '',
            endDate: processedProducts[0]?.endDate || '',
            products: processedProducts,
            status: {
              marketing: false,
              engineering: false,
              dataCenter: false,
              deployment: false,
              integration: false,
              compliance: false,
            },
            progress: 0
          }
          updatedClients.push(newClient)
        }
      })

      console.log('Final updated clients:', updatedClients);
      setClients(updatedClients)
      setImportText('')
      setIsImportDialogOpen(false)
    } catch (error) {
      console.error('Failed to parse import data:', error)
    }
  }

  const ProductFilter = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="h-10 px-4 py-2 bg-white hover:bg-gray-50 font-medium"
          >
            <Plus className="mr-2 h-4 w-4" />
            Filter Products
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 p-2">
          {PRODUCT_OPTIONS.filter(option => !['Custom'].includes(option as string)).map((product) => (
            <div key={product} className="flex items-center space-x-2 p-2">
              <Checkbox
                id={`filter-${product}`}
                checked={selectedProducts.has(product)}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(selectedProducts)
                  if (checked) {
                    // Add the product to selected products
                    newSelected.add(product)
                    setSelectedProducts(newSelected)
                    
                    // Update clients state with new product data
                    const updatedClients = clients.map(client => {
                      // Find any existing product that matches (including mapped names)
                      const existingProduct = client.products.find(p => 
                        p.name === product || 
                        PRODUCT_NAME_MAPPING[p.name] === product ||
                        (product === 'SMS/MMS' && p.name === 'SMS/MMS') // Special case for SMS/MMS
                      )
                      
                      if (existingProduct) {
                        // If product exists, ensure it has the correct name mapping
                        return {
                          ...client,
                          products: client.products.map(p => 
                            p.id === existingProduct.id 
                              ? { ...p, name: product } // Use the standardized name
                              : p
                          )
                        }
                      }
                      
                      // If no matching product exists, add a new one
                      return {
                        ...client,
                        products: [
                          ...client.products,
                          {
                            id: `new-${Math.random().toString(36).substr(2, 9)}`,
                            name: product, // Use the standardized name
                            contracted: 0,
                            current: 0,
                            progress: 0,
                            startDate: client.startDate,
                            endDate: client.endDate,
                            periodQty: [],
                            growthRate: 0,
                            forecastedEndQty: 0
                          }
                        ]
                      }
                    })
                    
                    setClients(updatedClients)
                  } else {
                    // Remove product if it's not the last one
                    if (newSelected.size > 1) {
                      newSelected.delete(product)
                      setSelectedProducts(newSelected)
                    }
                  }
                }}
              />
              <label
                htmlFor={`filter-${product}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {product}
              </label>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const exportToCSV = () => {
    // Create headers
    const headers = [
      'Client', 
      'Account Owner', 
      'Exceeding Annual Volume', 
      'Exceeding Cumulative Volume'
    ];
    selectedProducts.forEach(product => {
      headers.push(`${product} Contracted`);
      headers.push(`${product} Current`);
      headers.push(`${product} Usage %`);
      headers.push(`${product} Status`);
      headers.push(`${product} End Date`);
    });

    // Create rows
    const rows = sortedClients.map(client => {
      // Check if client is exceeding in either mode
      const exceedingStatus = {
        annual: false,
        cumulative: false
      };

      client.products.forEach(product => {
        // Check Annual
        const annualContracted = product.annualQty || product.contracted;
        if (annualContracted && product.current > annualContracted) {
          exceedingStatus.annual = true;
        }

        // Check Cumulative
        const termContracted = product.termQty || product.contracted;
        if (termContracted && product.current > termContracted) {
          exceedingStatus.cumulative = true;
        }
      });

      const row: (string | number)[] = [
        client.name,
        client.accountOwner,
        exceedingStatus.annual ? 'Yes' : 'No',
        exceedingStatus.cumulative ? 'Yes' : 'No'
      ];

      selectedProducts.forEach(productName => {
        const product = client.products.find(p => p.name === productName);
        const contractedAmount = product ? (utilizationType === 'cumulative' 
          ? (product.termQty ?? product.contracted)
          : (product.annualQty ?? product.contracted)
        ) : 0;
        const current = product?.current || 0;
        const percentage = contractedAmount > 0 ? (current / contractedAmount) * 100 : 0;
        
        const status = product ? calculateUtilizationStatus(
          current,
          contractedAmount,
          product.startDate,
          new Date().toISOString(),
          utilizationType
        ).status : '';

        row.push(contractedAmount);
        row.push(current);
        row.push(`${percentage.toFixed(1)}%`);
        row.push(status);
        row.push(product?.endDate || '');
      });

      return row;
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `client-utilization-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="h-full max-w-[1400px] mx-auto">
        <TooltipProvider>
          <Card className="h-full border shadow-sm rounded-xl overflow-hidden flex flex-col">
            <CardHeader className="border-b bg-white flex-none">
              <CardTitle>Client Utilization Tracker</CardTitle>
              <CardDescription>
                Track client contract volumes and utilization metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex flex-col flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-4 flex-none">
                <div className="flex gap-2">
                  <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-10 px-4 py-2 bg-white hover:bg-gray-50 font-medium"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Import Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[625px] max-h-[90vh] flex flex-col overflow-visible">
                      <DialogHeader className="flex-none">
                        <DialogTitle>Import Data</DialogTitle>
                        <DialogDescription>
                          <ol className="list-decimal list-inside space-y-1 mb-2">
                            <li>Login to Platform Admin</li>
                            <li>Go to Sigma &gt; Client Usage</li>
                            <li>Go to the tab: Total -- Usage Against Contract &gt; Usage by Month chart</li>
                            <li>Click the three elipses in the top right corner &gt; Export &gt; CSV</li>
                            <li>Open file &gt; copy all &gt; paste data in the text box below</li>
                          </ol>
                          <div className="mt-4">
                            <div className="font-medium mb-1">Example of column headers:</div>
                            <pre className="p-2 bg-muted rounded-md text-xs whitespace-pre-wrap">
                              Account Owner	Account Name	Volume Type	Start Date	End Date	Annual Qty	Term Qty	Usage Date	Period Qty	Consumed Qty	Remaining Qty
                              ...
                            </pre>
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto px-1">
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="import-data">Usage by Month Data</Label>
                            <textarea
                              id="import-data"
                              className="min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Paste your data here..."
                              value={importText}
                              onChange={(e) => setImportText(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter className="flex-none border-t bg-white py-4">
                        <Button 
                          onClick={handleImportClients}
                          disabled={!importText}
                        >
                          Import Clients
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button 
                    variant="outline" 
                    className="h-10 px-4 py-2 bg-white hover:bg-gray-50 font-medium"
                    onClick={exportToCSV}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Export to CSV
                  </Button>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2 border rounded-lg p-1">
                    <Button
                      variant={utilizationType === 'annual' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleUtilizationTypeChange('annual')}
                      className="text-sm"
                    >
                      Annual
                    </Button>
                    <Button
                      variant={utilizationType === 'cumulative' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleUtilizationTypeChange('cumulative')}
                      className="text-sm"
                    >
                      Cumulative
                    </Button>
                  </div>
                  <ProductFilter />
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-auto">
                  <div className="min-w-max">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-20">
                        <TableRow>
                          <TableHead 
                            className="w-[25%] pr-0 bg-white"
                            style={{ minWidth: '150px' }}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-left w-full justify-between font-bold text-sm px-2"
                                >
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold">Client</span>
                                    {sortConfig.column === 'name' && 
                                      <span className="text-muted-foreground font-normal"> (Sorted by: Name)</span>
                                    }
                                  </div>
                                  <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem 
                                  onClick={() => handleSort("name")}
                                  className={cn(
                                    sortConfig.column === 'name' && "bg-accent"
                                  )}
                                >
                                  Sort by Name
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableHead>
                          <TableHead 
                            className="w-[25%] pl-2 bg-white"
                            style={{ minWidth: '150px' }}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-left w-full justify-between font-bold text-sm px-2"
                                >
                                  Account Owner
                                  <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuItem onClick={() => handleSort("accountOwner")}>
                                  Sort by Account Owner
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="p-2">
                                  {Array.from(new Set(clients.map(client => client.accountOwner))).map((owner) => (
                                    <div key={owner} className="flex items-center space-x-2 p-2">
                                      <Checkbox
                                        id={`owner-${owner}`}
                                        checked={selectedOwners.has(owner)}
                                        onCheckedChange={() => handleOwnerSelection(owner)}
                                      />
                                      <label
                                        htmlFor={`owner-${owner}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                      >
                                        {owner}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableHead>
                          {Array.from(selectedProducts).map((productName) => (
                            <TableHead 
                              key={productName} 
                              className="w-[50%] px-4 bg-white"
                              style={{ minWidth: '450px' }}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-left w-full justify-between font-bold text-sm px-2"
                                  >
                                    <div className="flex items-center gap-1">
                                      <span className="font-bold">{productName}</span>
                                      {activeSort?.productName === productName && (
                                        <span className="text-muted-foreground font-normal"> (Sorted by: {activeSort.sortType === 'usage-desc' 
                                          ? 'Highest to Lowest' 
                                          : activeSort.sortType === 'usage-asc'
                                          ? 'Lowest to Highest'
                                          : 'Contract End Date'})</span>
                                      )}
                                    </div>
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem 
                                    onClick={() => handleProductSort(productName, 'usage-desc')}
                                    className={cn(
                                      activeSort?.productName === productName && 
                                      activeSort.sortType === 'usage-desc' && 
                                      "bg-accent"
                                    )}
                                  >
                                    Sort by Usage (Highest to Lowest)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleProductSort(productName, 'usage-asc')}
                                    className={cn(
                                      activeSort?.productName === productName && 
                                      activeSort.sortType === 'usage-asc' && 
                                      "bg-accent"
                                    )}
                                  >
                                    Sort by Usage (Lowest to Highest)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleProductSort(productName, 'endDate')}
                                    className={cn(
                                      activeSort?.productName === productName && 
                                      activeSort.sortType === 'endDate' && 
                                      "bg-accent"
                                    )}
                                  >
                                    Sort by Contract End Date
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedClients.length > 0 ? (
                          sortedClients.map((client) => (
                            <TableRow key={client.id} className="hover:bg-gray-50 cursor-pointer">
                              <TableCell 
                                className="w-[25%] pr-0"
                                style={{ minWidth: '150px' }}
                              >
                                <div 
                                  className="cursor-pointer"
                                  onClick={() => {
                                    console.log('Edit Client clicked:', client);
                                    setEditingClient(client);
                                  }}
                                >
                                  {client.name}
                                </div>
                              </TableCell>
                              <TableCell 
                                className="w-[25%] pl-2"
                                style={{ minWidth: '150px' }}
                              >
                                {client.accountOwner}
                              </TableCell>
                              {Array.from(selectedProducts).map((productName) => {
                                const product = client.products.find(p => p.name === productName);
                                // Ensure contractedAmount is always a number
                                const contractedAmount = product ? (utilizationType === 'cumulative' 
                                  ? (product.termQty ?? product.contracted)  // Use nullish coalescing
                                  : (product.annualQty ?? product.contracted)
                                ) : 0;  // Default to 0 if no product found
                                
                                return (
                                  <TableCell 
                                    key={productName} 
                                    className="w-[50%] px-4"
                                    style={{ minWidth: '450px' }}
                                  >
                                    {product && product.contracted > 0 ? (
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-start w-full">
                                          <div 
                                            className="text-xs text-muted-foreground mb-1 cursor-pointer"
                                            onClick={() => {
                                              console.log('Edit Product clicked:', {
                                                clientId: client.id,
                                                product: product
                                              });
                                              setEditingProduct({ 
                                                clientId: client.id, 
                                                product: {
                                                  ...product,
                                                  contracted: contractedAmount
                                                }
                                              });
                                            }}
                                          >
                                            Contracted: {Number(contractedAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })} / 
                                            Current: {Number(product.current).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                          </div>
                                          <div className="text-xs text-muted-foreground mb-1 shrink-0 ml-4">
                                            Renewal: {calculateFiscalQuarter(product.endDate)}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 w-full">
                                          <ProgressBar
                                            contracted={contractedAmount}
                                            current={product.current}
                                            startDate={product.startDate}
                                            endDate={product.endDate}
                                            annualQty={product.annualQty}
                                            termQty={product.termQty}
                                            utilizationType={utilizationType}
                                            usageDate={new Date().toISOString()}
                                          />
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <div 
                                                  className="px-3 py-0.5 rounded-full text-xs font-medium shrink-0 whitespace-nowrap"
                                                  style={{ 
                                                    backgroundColor: product.current > contractedAmount ? '#ef4444' : getStatusColor(
                                                      calculateUtilizationStatus(
                                                        product.current,
                                                        contractedAmount,  // Now guaranteed to be a number
                                                        product.startDate,
                                                        new Date().toISOString(),
                                                        utilizationType
                                                      ).status
                                                    ),
                                                    color: 'white'
                                                  }}
                                                >
                                                  {getStatusLabel(calculateUtilizationStatus(
                                                    product.current,
                                                    contractedAmount,  // Now guaranteed to be a number
                                                    product.startDate,
                                                    new Date().toISOString(),
                                                    utilizationType
                                                  ).status)}
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <div className="text-xs">
                                                  <div>{getStatusText(calculateUtilizationStatus(
                                                    product.current,
                                                    contractedAmount,  // Now guaranteed to be a number
                                                    product.startDate,
                                                    new Date().toISOString(),
                                                    utilizationType
                                                  ).status)}</div>
                                                  <div>
                                                    Expected: {Math.round(calculateUtilizationStatus(
                                                      product.current,
                                                      contractedAmount,  // Now guaranteed to be a number
                                                      product.startDate,
                                                      new Date().toISOString(),
                                                      utilizationType
                                                    ).expectedAmount).toLocaleString()} at {calculateUtilizationStatus(
                                                      product.current,
                                                      contractedAmount,  // Now guaranteed to be a number
                                                      product.startDate,
                                                      new Date().toISOString(),
                                                      utilizationType
                                                    ).monthsElapsed} {calculateUtilizationStatus(
                                                      product.current,
                                                      contractedAmount,  // Now guaranteed to be a number
                                                      product.startDate,
                                                      new Date().toISOString(),
                                                      utilizationType
                                                    ).monthsElapsed === 1 ? 'month' : 'months'} into contract
                                                  </div>
                                                  <div>Current: {product.current.toLocaleString()}</div>
                                                  {product.current > contractedAmount && (
                                                    <div>Over by: {(product.current - contractedAmount).toLocaleString()}</div>
                                                  )}
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-400">No data</div>
                                    )}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell 
                              colSpan={2 + selectedProducts.size} 
                              className="h-[400px] text-center"
                            >
                              <div className="flex flex-col items-center justify-center gap-4">
                                <div className="rounded-full bg-gray-50 p-6">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="48"
                                    height="48"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-gray-400"
                                  >
                                    <path d="M17 6.3a3 3 0 0 1 4 0"/>
                                    <path d="M3 6.3a3 3 0 0 0-4 0"/>
                                    <path d="M20 15.6a9 9 0 0 1-16 0"/>
                                    <circle cx="8" cy="9" r="3"/>
                                    <circle cx="16" cy="9" r="3"/>
                                  </svg>
                                </div>
                                <div className="text-xl font-medium text-gray-900">Explore Your Usage Data</div>
                                <div className="text-sm text-gray-500">
                                  Import your client data to get started with insights
                                </div>
                                <Button 
                                  variant="outline" 
                                  className="h-10 px-4 py-2 bg-white hover:bg-gray-50 font-medium"
                                  onClick={() => setIsImportDialogOpen(true)}
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Import Data
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
      </div>
    </div>
  )
}
