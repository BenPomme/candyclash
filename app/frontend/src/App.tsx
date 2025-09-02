import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { EntryPage } from './pages/EntryPage'
import { GamePage } from './pages/GamePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { AdminPage } from './pages/AdminPage'
import { LevelEditorPage } from './pages/LevelEditorPage'
import { useAuthStore } from './stores/authStore'
import { useEffect } from 'react'

function App() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/entry" element={<EntryPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/editor" element={<LevelEditorPage />} />
      </Routes>
    </Router>
  )
}

export default App