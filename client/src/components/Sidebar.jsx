import '../styles/components.css';

const NAV = [
  { id:'dashboard',  icon:'🗺',  label:'Dashboard'         },
  { id:'alerts',     icon:'⚠️', label:'Drought Alerts'    },
  { id:'explorer',   icon:'🔍', label:'Forecast Explorer' },
  { id:'evaluation', icon:'📊', label:'Model Evaluation'  },
  { id:'about',      icon:'ℹ️', label:'About'             },
];

export default function Sidebar({ page, onNavigate }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-label" style={{ padding:'0 20px', marginBottom:10 }}>Navigation</div>
      {NAV.map(n => (
        <div key={n.id} style={{ padding:'0 12px' }}>
          <button
            className={`nav-item${page === n.id ? ' active' : ''}`}
            onClick={() => onNavigate(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        </div>
      ))}
      <div className="sidebar-divider" />
      <div className="sidebar-footer">
        Final Year Project<br />
        <span style={{ color:'var(--teal)', opacity:0.7 }}>PyTorch Transformer · SPEI-6</span>
      </div>
    </nav>
  );
}
