import { BarChart3, Settings, Shield, Swords, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type AppPage, useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'

const navItems: Array<{ id: AppPage; label: string; icon: typeof Swords }> = [
  { id: 'match-history', label: '战绩查询', icon: Swords },
  { id: 'draft-assistant', label: '选人助手', icon: Shield },
  { id: 'spell-tracker', label: '技能追踪', icon: Timer },
  { id: 'champion-rank', label: '英雄排行', icon: BarChart3 },
  { id: 'settings', label: '设置', icon: Settings }
]

export function Sidebar(): React.JSX.Element {
  const currentPage = useAppStore((state) => state.currentPage)
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)

  return (
    <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-card py-4">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        LOL
      </div>
      <Separator className="mb-4 w-10" />
      <TooltipProvider delayDuration={0}>
        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  variant={currentPage === id ? 'secondary' : 'ghost'}
                  size="icon"
                  className={cn('h-10 w-10', currentPage === id && 'bg-accent')}
                  onClick={() => setCurrentPage(id)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </TooltipProvider>
    </aside>
  )
}
