import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard    from './pages/Dashboard';
import LojasPage    from './pages/LojasPage';
import VendedoresPage from './pages/VendedoresPage';
import ProdutosPage from './pages/ProdutosPage';
import EstoquePage  from './pages/EstoquePage';
import VendasPage   from './pages/VendasPage';
import RelatoriosPage from './pages/RelatoriosPage';
import BenchmarkPage from './pages/BenchmarkPage';

const DB = import.meta.env.VITE_DB_LABEL || 'mysql';

const links = [
  { to: '/',           icon: '⊞', label: 'Dashboard'   },
  { to: '/lojas',      icon: '🏪', label: 'Lojas'       },
  { to: '/vendedores', icon: '👤', label: 'Vendedores'  },
  { to: '/produtos',   icon: '👕', label: 'Produtos'    },
  { to: '/estoque',    icon: '📦', label: 'Estoque'     },
  { to: '/vendas',     icon: '💰', label: 'Vendas'      },
  { to: '/relatorios', icon: '📊', label: 'Relatórios'  },
  { to: '/benchmark',  icon: '⏱', label: 'Benchmark'    },
];

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <BrowserRouter>
      <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
        <aside className="sidebar">
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? '›' : '‹'}
          </button>

          <div className="sidebar-logo">
            {collapsed ? <span className="logo-mark">SR</span> : <>Saas<span>Roupas</span></>}
          </div>

          <nav>
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} title={l.label}
                       className={({isActive}) => isActive ? 'active' : ''}>
                <span className="nav-icon">{l.icon}</span>
                <span className="nav-label">{l.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <span className="nav-label">Banco: {DB.toUpperCase()}</span>
            <span className="nav-icon-only">{DB.slice(0, 2).toUpperCase()}</span>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <h1>Sistema de Vendas de Roupas</h1>
            <span className="db-badge">{DB}</span>
          </div>
          <div className="page">
            <Routes>
              <Route path="/"           element={<Dashboard />} />
              <Route path="/lojas"      element={<LojasPage />} />
              <Route path="/vendedores" element={<VendedoresPage />} />
              <Route path="/produtos"   element={<ProdutosPage />} />
              <Route path="/estoque"    element={<EstoquePage />} />
              <Route path="/vendas"     element={<VendasPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/benchmark"  element={<BenchmarkPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
