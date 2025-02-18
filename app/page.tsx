"use client"

import { ChevronDown, Plus, Save } from 'lucide-react'
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ImportClientData } from "@/types/client"

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

const getStatusPriority = (status: UtilizationStatus): number => {
  switch (status) {
    case 'currently-over': return 4;  // Currently Over - highest priority
    case 'over-pace': return 3;       // Over Pace - second priority
    case 'on-target': return 2;       // On Target - third priority
    case 'under-pace': return 1;      // Under Pace - lowest priority
    default: return 0;
  }
};

const getProductUtilization = (
  product: Product,
  utilizationType: 'annual' | 'cumulative',
  contractedAmount: number,
  mostRecentUsageDate: string
) => {
  const contracted = utilizationType === 'annual'
    ? (product.annualQty || contractedAmount)
    : (product.termQty || contractedAmount);

  const utilization = calculateUtilizationStatus(
    product.current,
    contracted,
    product.startDate,
    mostRecentUsageDate,
    utilizationType,
    product.endDate
  );

  const percentage = (product.current / contracted) * 100;

  return {
    status: utilization.status,
    percentage,
    expectedAmount: utilization.expectedAmount,
    monthsElapsed: utilization.monthsElapsed,
    isOverContract: utilization.isOverContract
  };
};

const groupAndSortClients = (
  clients: Client[], 
  productName: string, 
  sortType: SortType,
  utilizationType: 'annual' | 'cumulative',
  importData: ImportClientData[]
) => {
  // If sorting by end date, use a different sorting logic
  if (sortType === 'endDate') {
    return clients.sort((a, b) => {
      const findProduct = (client: Client) => {
        return client.products.find(p => 
          p.name === productName || 
          PRODUCT_NAME_MAPPING[p.name] === productName ||
          productName === PRODUCT_NAME_MAPPING[p.name]
        );
      };

      const productA = findProduct(a);
      const productB = findProduct(b);

      // Handle cases where products don't exist
      if (!productA && !productB) return 0;
      if (!productA) return 1;
      if (!productB) return -1;

      // Sort by end date (closest date first)
      const dateA = new Date(productA.endDate).getTime();
      const dateB = new Date(productB.endDate).getTime();
      return dateA - dateB;
    });
  }

  // Rest of the existing grouping and sorting logic for usage sorts
  const groups: { [key in UtilizationStatus]: Array<{client: Client; percentage: number}> } = {
    'currently-over': [],
    'over-pace': [],
    'on-target': [],
    'under-pace': []
  };

  // First pass: calculate status and percentage for each client and group them
  clients.forEach(client => {
    const product = client.products.find(p => 
      p.name === productName || 
      PRODUCT_NAME_MAPPING[p.name] === productName ||
      productName === PRODUCT_NAME_MAPPING[p.name]
    );

    if (!product || !product.contracted || product.contracted <= 0) return;

    // Get usage data for this product
    const productUsageData = importData
      .filter(data => 
        data.accountName.toLowerCase() === client.name.toLowerCase() && 
        data.volumeType === product.name
      )
      .sort((a, b) => new Date(b.usageDate).getTime() - new Date(a.usageDate).getTime());

    const mostRecentUsageDate = productUsageData[0]?.usageDate || new Date().toISOString();
    const contractedAmount = utilizationType === 'annual'
      ? (product.annualQty || product.contracted)
      : (product.termQty || product.contracted);

    const { status, percentage } = getProductUtilization(
      product,
      utilizationType,
      contractedAmount,
      mostRecentUsageDate
    );

    groups[status].push({ client, percentage });
  });

  // Sort each group by percentage
  Object.values(groups).forEach(group => {
    group.sort((a, b) => 
      sortType === 'usage-desc' 
        ? b.percentage - a.percentage 
        : a.percentage - b.percentage
    );
  });

  // Combine groups in the correct order
  const orderedGroups = sortType === 'usage-desc'
    ? ['currently-over', 'over-pace', 'on-target', 'under-pace']
    : ['under-pace', 'on-target', 'over-pace', 'currently-over'];

  // Return flattened array of clients in correct order
  return orderedGroups.flatMap(status => 
    groups[status as UtilizationStatus].map(item => item.client)
  );
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
  const [importData, setImportData] = useState<ImportClientData[]>([]);

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

    // Apply sort immediately
    const sortedClients = [...clients].sort((a, b) => {
      if (column === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (column === 'accountOwner') {
        return a.accountOwner.localeCompare(b.accountOwner);
      }
      return 0;
    });

    // Update clients with new sort order
    setClients(sortedClients);
  };

  const handleProductSort = (productName: string, sortType: SortType) => {
    // Clear any client/account sort
    setSortConfig({
      column: '',
      sortType: 'default',
      productName: ''
    });
    
    setActiveSort({ productName, sortType });
    
    // Apply sort immediately
    const sortedClients = groupAndSortClients(
      clients,
      productName,
      sortType,
      utilizationType,
      importData
    );
    
    // Update clients with new sort order
    setClients(sortedClients);
  };

  const handleUtilizationTypeChange = (newType: 'annual' | 'cumulative') => {
    setUtilizationType(newType);
    
    // Get current order of clients
    const currentOrder = clients.map(client => client.id);
    
    // Update clients with new utilization values while preserving order
    const updatedClientsMap = new Map(
      clients.map(client => {
        const updatedProducts = client.products.map(product => {
          const productUsageData = importData
            .filter(data => 
              data.accountName.toLowerCase() === client.name.toLowerCase() && 
              data.volumeType === product.name
            )
            .sort((a, b) => new Date(b.usageDate).getTime() - new Date(a.usageDate).getTime());

          if (productUsageData.length === 0) return product;

          const mostRecentData = productUsageData[0];
          
          const currentAmount = newType === 'annual'
            ? calculateAnnualUsage(productUsageData, product.startDate, mostRecentData?.usageDate)
            : mostRecentData?.consumedQty || 0;

          return {
            ...product,
            current: currentAmount
          };
        });

        return [client.id, {
          ...client,
          products: updatedProducts
        }];
      })
    );

    // Preserve the current order when updating clients
    const orderedUpdatedClients = currentOrder
      .map(id => updatedClientsMap.get(id))
      .filter((client): client is Client => client !== undefined);

    setClients(orderedUpdatedClients);
  };

  const sortedClients = clients.filter(client => 
    selectedOwners.has(client.accountOwner)
  );

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
      setImportData(parsedImportData);

      // Only set initial owners if none are selected
      if (selectedOwners.size === 0) {
        const initialOwners = new Set(
          parsedImportData.map(data => data.accountOwner.trim())
        );
        setSelectedOwners(initialOwners);
      }

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
    // Local state to track changes before applying them
    const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set(selectedProducts));
    const [open, setOpen] = useState(false);

    // Handle applying changes when dropdown closes
    const handleOpenChange = (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen && !areSetsEqual(pendingSelections, selectedProducts)) {
        // Apply all changes at once when closing
        const addedProducts = new Set(
          Array.from(pendingSelections).filter(x => !selectedProducts.has(x))
        );
        
        // Update clients with new product data
        const updatedClients = clients.map(client => {
          let updatedClient = { ...client };
          
          // Add new products
          addedProducts.forEach(product => {
            const existingProduct = client.products.find(p => 
              p.name === product || 
              PRODUCT_NAME_MAPPING[p.name] === product ||
              (product === 'SMS/MMS' && p.name === 'SMS/MMS')
            );
            
            if (existingProduct) {
              updatedClient.products = updatedClient.products.map(p => 
                p.id === existingProduct.id 
                  ? { ...p, name: product }
                  : p
              );
            } else {
              updatedClient.products.push({
                id: `new-${Math.random().toString(36).substr(2, 9)}`,
                name: product,
                contracted: 0,
                current: 0,
                progress: 0,
                startDate: client.startDate,
                endDate: client.endDate,
                periodQty: [],
                growthRate: 0,
                forecastedEndQty: 0
              });
            }
          });

          return updatedClient;
        });

        setSelectedProducts(pendingSelections);
        setClients(updatedClients);
      }
    };

    // Helper function to compare sets
    const areSetsEqual = (a: Set<string>, b: Set<string>) => 
      a.size === b.size && Array.from(a).every(value => b.has(value));

    return (
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
            <div 
              key={product} 
              className="flex items-center space-x-2 p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                id={`filter-${product}`}
                checked={pendingSelections.has(product)}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(pendingSelections);
                  if (checked) {
                    newSelected.add(product);
                  } else if (newSelected.size > 1) {
                    newSelected.delete(product);
                  }
                  setPendingSelections(newSelected);
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
    );
  };

  const exportToCSV = () => {
    // Get currently visible clients
    const visibleClients = sortedClients;
    
    // Get selected products for columns
    const selectedProductsList = Array.from(selectedProducts);

    // Create headers for each product
    const headers = [
      'Client',
      'Account Owner',
      ...selectedProductsList.flatMap(product => [
        `${product} Annual Pacing`,
        `${product} Annual Qty Used`,
        `${product} Cumulative Pacing`,
        `${product} Cumulative Qty Used`,
        `${product} Contract End Date`,
        `${product} Renewal Quarter`
      ])
    ];

    // Create rows
    const rows = visibleClients.map(client => {
      const baseData = [client.name, client.accountOwner];

      const productData = selectedProductsList.flatMap(productName => {
        const product = client.products.find(p => p.name === productName);
        
        if (!product || !product.contracted) {
          return ['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
        }

        // Get usage data
        const productUsageData = importData
          .filter(data => 
            data.accountName.toLowerCase() === client.name.toLowerCase() && 
            data.volumeType === product.name
          )
          .sort((a, b) => new Date(b.usageDate).getTime() - new Date(a.usageDate).getTime());

        const mostRecentUsageDate = productUsageData[0]?.usageDate || new Date().toISOString();
        const cumulativeConsumed = productUsageData[0]?.consumedQty || 0;

        // Calculate annual status
        const annualStatus = calculateUtilizationStatus(
          product.current,
          product.annualQty || product.contracted,
          product.startDate,
          mostRecentUsageDate,
          'annual',
          product.endDate
        );

        // Calculate cumulative status
        const cumulativeStatus = calculateUtilizationStatus(
          cumulativeConsumed,
          product.termQty || product.contracted,
          product.startDate,
          mostRecentUsageDate,
          'cumulative',
          product.endDate
        );

        // Calculate percentages
        const annualPercentage = ((product.current / (product.annualQty || product.contracted)) * 100).toFixed(1);
        const cumulativePercentage = ((cumulativeConsumed / (product.termQty || product.contracted)) * 100).toFixed(1);

        return [
          getStatusLabel(annualStatus.status),
          `${annualPercentage}%`,
          getStatusLabel(cumulativeStatus.status),
          `${cumulativePercentage}%`,
          product.endDate,
          calculateFiscalQuarter(product.endDate)
        ];
      });

      return [...baseData, ...productData];
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
    link.setAttribute('download', `client-utilization-summary-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const AccountOwnerFilter = () => {
    const [open, setOpen] = useState(false);
    
    // Get unique account owners from clients
    const accountOwners = Array.from(new Set(clients.map(client => client.accountOwner))).sort();

    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-left w-full justify-between font-bold text-sm px-2"
          >
            <div className="flex items-center gap-1">
              <span className="font-bold">Account Owner</span>
              {sortConfig.column === 'accountOwner' && 
                <span className="text-muted-foreground font-normal"> (Sorted by: Name)</span>
              }
            </div>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem 
            onClick={() => handleSort('accountOwner')}
            className={cn(
              sortConfig.column === 'accountOwner' && "bg-accent"
            )}
          >
            Sort by Account Owner
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          
          <div className="p-2">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Filter by Account Owner
            </div>
            <div className="space-y-2">
              {accountOwners.map((owner) => (
                <div key={owner} className="flex items-center space-x-2">
                  <Checkbox 
                    id={owner}
                    checked={selectedOwners.has(owner)}
                    onCheckedChange={() => handleOwnerSelection(owner)}
                  />
                  <label
                    htmlFor={owner}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {owner}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const ClientFilter = () => {
    const [open, setOpen] = useState(false);

    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
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
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem 
            onClick={() => handleSort('name')}
            className={cn(
              sortConfig.column === 'name' && "bg-accent"
            )}
          >
            Sort by Client (A-Z)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
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
            <CardContent className="p-6 flex flex-col flex-1">
              <div className="flex justify-between items-center mb-4">
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
              <div className="flex-1 overflow-hidden">
                <div className="relative h-full">
                  {/* Single container for both horizontal and vertical scrolling */}
                  <div className="overflow-auto h-full max-h-[calc(100vh-250px)]">
                    <div className="min-w-max"> {/* Ensures minimum width for all content */}
                      <Table>
                        {/* Fixed header */}
                        <TableHeader className="sticky top-0 bg-white z-20">
                          <TableRow>
                            <TableHead 
                              className="w-[25%] pl-2 bg-white border-b"
                              style={{ minWidth: '150px' }}
                            >
                              <ClientFilter />
                            </TableHead>
                            <TableHead 
                              className="w-[25%] pl-2 bg-white border-b"
                              style={{ minWidth: '150px' }}
                            >
                              <AccountOwnerFilter />
                            </TableHead>
                            {Array.from(selectedProducts).map((productName) => (
                              <TableHead 
                                key={productName} 
                                className="w-[50%] px-4 bg-white border-b"
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

                        {/* Table body */}
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
                                    ? (product.termQty ?? product.contracted)  // For cumulative, use termQty
                                    : (product.annualQty ?? product.contracted)) // For annual, use annualQty
                                  : 0;

                                  // Add these calculations
                                  if (product && product.contracted > 0) {
                                    // Get usage data for this product
                                    const productUsageData = importData
                                      .filter(data => 
                                        data.accountName.toLowerCase() === client.name.toLowerCase() && 
                                        data.volumeType === product.name
                                      )
                                      .sort((a, b) => new Date(b.usageDate).getTime() - new Date(a.usageDate).getTime());

                                    const mostRecentUsageDate = productUsageData[0]?.usageDate || new Date().toISOString();
                                    const contractAmount = utilizationType === 'annual' ? 
                                      (product.annualQty || contractedAmount) : 
                                      (product.termQty || contractedAmount);

                                    // Calculate utilization once and reuse
                                    const utilization = calculateUtilizationStatus(
                                      product.current,
                                      contractAmount,
                                      product.startDate,
                                      mostRecentUsageDate,
                                      utilizationType,
                                      product.endDate
                                    );

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
                                                contracted={contractAmount}
                                                current={product.current}
                                                startDate={product.startDate}
                                                endDate={product.endDate}
                                                annualQty={product.annualQty}
                                                termQty={product.termQty}
                                                utilizationType={utilizationType}
                                                usageDate={mostRecentUsageDate}
                                                showStatus={false}
                                              />
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger>
                                                    <div 
                                                      className="px-3 py-0.5 rounded-full text-xs font-medium shrink-0 whitespace-nowrap"
                                                      style={{ 
                                                        backgroundColor: getStatusColor(utilization.status),
                                                        color: 'white'
                                                      }}
                                                    >
                                                      {getStatusLabel(utilization.status)}
                                                    </div>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <div className="text-xs">
                                                      <>
                                                        <div>{getStatusText(utilization.status)}</div>
                                                        <div>
                                                          Expected: {Math.round(utilization.expectedAmount).toLocaleString()} at {
                                                            utilization.monthsElapsed
                                                          } {utilization.monthsElapsed === 1 ? 'month' : 'months'} into {
                                                            utilizationType === 'annual' ? 'year' : 'contract'
                                                          }
                                                        </div>
                                                        <div>Current: {product.current.toLocaleString()}</div>
                                                        {utilization.isOverContract && (
                                                          <div>Over by: {(product.current - contractAmount).toLocaleString()}</div>
                                                        )}
                                                      </>
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
                                    );
                                  }
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
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
      </div>
    </div>
  )
}

