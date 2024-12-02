import { ProgressBar } from "@/components/common/ProgressBar"
import { AlertIcon } from "@/components/common/AlertIcon"

interface Product {
  name: string
  startDate: string
  endDate: string
  current: number
  contracted: number
}

interface Client {
  id: string
  name: string
  amount: number
  products: Product[]
}

export default function ClientList() {
  const clients: Client[] = [
    {
      id: '1',
      name: 'Client 1',
      amount: 4000,
      products: [
        {
          name: 'Product A',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          current: 800,
          contracted: 1000
        },
        {
          name: 'Product B',
          startDate: '2023-02-01',
          endDate: '2024-01-31',
          current: 600,
          contracted: 500
        }
      ]
    },
    // Add Client 2 with similar structure
  ]

  return (
    <div className="divide-y">
      {clients.map((client) => (
        <div key={client.id} className="grid grid-cols-[2fr_1fr_3fr_2fr] gap-4 py-6">
          <div className="font-medium">{client.name}</div>
          <div className="font-medium">${client.amount.toLocaleString()}</div>
          <div className="space-y-6">
            {client.products.map((product) => (
              <div key={product.name} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{product.name}</span>
                  {product.current > product.contracted && <AlertIcon />}
                </div>
                <div className="text-sm text-gray-500">
                  {product.startDate} - {product.endDate}
                </div>
                <div className="text-sm text-gray-500">
                  Current: {product.current} / Contracted: {product.contracted}
                </div>
                <ProgressBar 
                  current={product.current} 
                  contracted={product.contracted}
                  startDate={product.startDate}
                  endDate={product.endDate}
                  usageDate={new Date().toISOString()}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button className="w-8 h-8 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">M</button>
            <button className="w-8 h-8 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">E</button>
            <button className="w-8 h-8 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">DC</button>
            <button className="w-8 h-8 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">DP</button>
            <button className="w-8 h-8 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">I</button>
            <button className="w-8 h-8 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">C</button>
          </div>
        </div>
      ))}
    </div>
  )
} 