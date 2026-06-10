// VIEW — routing + layout khung.
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './views/layout/Layout.jsx'
import Dashboard from './views/pages/Dashboard.jsx'
import PipelineRunner from './views/pages/PipelineRunner.jsx'
import Observability from './views/pages/Observability.jsx'
import Evaluation from './views/pages/Evaluation.jsx'
import Artifacts from './views/pages/Artifacts.jsx'
import Chat from './views/pages/Chat.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pipeline" element={<PipelineRunner />} />
        <Route path="/observability" element={<Observability />} />
        <Route path="/evaluation" element={<Evaluation />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/artifacts" element={<Artifacts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
