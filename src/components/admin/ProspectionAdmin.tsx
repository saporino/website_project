import { useState } from 'react';
import ProspectionManager from './ProspectionManager';
import PoolAssignment from './PoolAssignment';
import { List, Users, MapPin } from 'lucide-react';

function goToMap() { window.history.pushState({}, '', '/repco/inteligencia/cobertura'); window.dispatchEvent(new PopStateEvent('popstate')); }

type Tab = 'listas' | 'pools';

export default function ProspectionAdmin({ refreshKey }: { refreshKey?: number }) {
  const [tab, setTab] = useState<Tab>('listas');

  const TabBtn = ({ id, icon, label, badge }: { id: Tab; icon: React.ReactNode; label: string; badge?: number }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg ${tab === id ? 'bg-[#8B2214] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {icon} {label}
      {badge ? <span className={`ml-1 rounded-full px-1.5 text-[10px] ${tab === id ? 'bg-white/25' : 'bg-amber-100 text-amber-800'}`}>{badge}</span> : null}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          <TabBtn id="listas" icon={<List className="w-4 h-4" />} label="Listas / Importar" />
          <TabBtn id="pools" icon={<Users className="w-4 h-4" />} label="Atribuir pools" />
        </div>
        <button onClick={goToMap}
          className="flex items-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <MapPin className="w-4 h-4" /> Buscar leads no mapa (Apify)
        </button>
      </div>
      {tab === 'listas' && <ProspectionManager refreshKey={refreshKey} />}
      {tab === 'pools' && <PoolAssignment />}
    </div>
  );
}
