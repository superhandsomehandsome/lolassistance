import { ScrollArea } from '@/components/ui/scroll-area'
import { Sidebar } from '@/components/layout/Sidebar'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <ScrollArea className="h-full flex-1">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </main>
    </div>
  )
}
