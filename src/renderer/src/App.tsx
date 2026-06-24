import { Layout } from '@/components/layout/Layout'
import { useIpcListeners } from '@/hooks/useIpcListeners'
import { ChampionRank } from '@/pages/ChampionRank'
import { DraftAssistant } from '@/pages/DraftAssistant'
import { MatchHistory } from '@/pages/MatchHistory'
import { Settings } from '@/pages/Settings'
import { SpellTrackerPage } from '@/pages/SpellTrackerPage'
import { useAppStore } from '@/stores/app-store'

function App(): React.JSX.Element {
  useIpcListeners()

  const currentPage = useAppStore((state) => state.currentPage)

  const renderPage = (): React.JSX.Element => {
    switch (currentPage) {
      case 'match-history':
        return <MatchHistory />
      case 'spell-tracker':
        return <SpellTrackerPage />
      case 'draft-assistant':
        return <DraftAssistant />
      case 'champion-rank':
        return <ChampionRank />
      case 'settings':
        return <Settings />
      default:
        return <MatchHistory />
    }
  }

  return <Layout>{renderPage()}</Layout>
}

export default App
