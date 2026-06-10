// VIEW — khung 3 vùng: Sidebar / TopBar / Workspace.
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'

export default function Layout() {
  return (
    <div className="app">
      <Sidebar />
      <TopBar />
      <main className="workspace">
        <Outlet />
      </main>
    </div>
  )
}
