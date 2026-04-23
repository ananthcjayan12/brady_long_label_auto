import { useState } from 'react';
import QRTemplatePage from './pages/QRTemplatePage';
import TemplateLayoutSettingsPage from './pages/TemplateLayoutSettingsPage';
import { loadLayoutProfiles, saveLayoutProfiles } from './qrLayoutSettings';

function App() {
  const [activePage, setActivePage] = useState('print');
  const [layoutProfiles, setLayoutProfiles] = useState(() => loadLayoutProfiles());

  const handleSaveProfiles = (profiles) => {
    const saved = saveLayoutProfiles(profiles);
    setLayoutProfiles(saved);
    return saved;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', paddingTop: '16px' }}>
        <button
          className={`btn ${activePage === 'print' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActivePage('print')}
        >
          Print
        </button>
        <button
          className={`btn ${activePage === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActivePage('settings')}
        >
          Layout Settings
        </button>
      </div>

      {activePage === 'print' ? (
        <QRTemplatePage layoutProfiles={layoutProfiles} onOpenSettings={() => setActivePage('settings')} />
      ) : (
        <TemplateLayoutSettingsPage
          profiles={layoutProfiles}
          onSaveProfiles={handleSaveProfiles}
          onBackToPrint={() => setActivePage('print')}
        />
      )}
    </div>
  );
}

export default App;
