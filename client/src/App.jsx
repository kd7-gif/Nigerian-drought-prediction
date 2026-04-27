import { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import StateDetail from './pages/StateDetail';
import Evaluation from './pages/Evaluation';
import Alerts from './pages/Alerts';
import Explorer from './pages/Explorer';
import About from './pages/About';
import './styles/components.css';

export default function App() {
  const [page, setPage]                 = useState('dashboard');
  const [selectedState, setSelectedState] = useState(null);
  // selectedPeriod: "YYYY-MM" string or null (null → server picks default anchor)
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedModel, setSelectedModel] = useState('gru_3m');

  function handleStateSelect(state) {
    setSelectedState(state);
    setPage('state-detail');
  }

  function handleNavigate(p) {
    setPage(p);
    if (p !== 'state-detail') setSelectedState(null);
  }

  function renderPage() {
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            onStateSelect={handleStateSelect}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        );
      case 'state-detail':
        return (
          <StateDetail
            state={selectedState}
            selectedPeriod={selectedPeriod}
            selectedModel={selectedModel}
            onBack={() => setPage('dashboard')}
          />
        );
      case 'alerts':
        return <Alerts onStateSelect={handleStateSelect} selectedPeriod={selectedPeriod} selectedModel={selectedModel} />;
      case 'explorer':
        return <Explorer selectedPeriod={selectedPeriod} selectedModel={selectedModel} />;
      case 'evaluation':
        return <Evaluation selectedModel={selectedModel} onModelChange={setSelectedModel} />;
      case 'about':
        return <About />;
      default:
        return (
          <Dashboard
            onStateSelect={handleStateSelect}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <Header selectedModel={selectedModel} />
      <Sidebar page={page} onNavigate={handleNavigate} />
      <main className="main-content">{renderPage()}</main>
    </div>
  );
}
