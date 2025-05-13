import React from 'react';
import { Settings, Network, Database, Search, Cpu, HelpCircle, Layers } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ToolbarIconProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  active?: boolean;
}

const ToolbarIcon = ({ icon, tooltip, onClick, active = false }: ToolbarIconProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className={`toolbar-icon ${active ? 'active' : ''}`}
            onClick={onClick}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" align="center">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface FloatingToolbarProps {
  className?: string;
}

export default function FloatingToolbar({ className = '' }: FloatingToolbarProps) {
  // These could have real functionality by connecting to state
  const [activeIcon, setActiveIcon] = React.useState<string | null>(null);
  
  const handleIconClick = (iconName: string) => {
    setActiveIcon(activeIcon === iconName ? null : iconName);
  };
  
  return (
    <div className={`floating-icon-toolbar ${className}`}>
      <ToolbarIcon 
        icon={<Cpu size={18} />} 
        tooltip="AI Controls" 
        active={activeIcon === 'ai'}
        onClick={() => handleIconClick('ai')}
      />
      <ToolbarIcon 
        icon={<Layers size={18} />} 
        tooltip="Visualization Layers" 
        active={activeIcon === 'layers'}
        onClick={() => handleIconClick('layers')}
      />
      <ToolbarIcon 
        icon={<Network size={18} />} 
        tooltip="Graph Layout" 
        active={activeIcon === 'graph'}
        onClick={() => handleIconClick('graph')}
      />
      <ToolbarIcon 
        icon={<Database size={18} />} 
        tooltip="Data Sources" 
        active={activeIcon === 'data'}
        onClick={() => handleIconClick('data')}
      />
      <ToolbarIcon 
        icon={<Search size={18} />} 
        tooltip="Search" 
        active={activeIcon === 'search'}
        onClick={() => handleIconClick('search')}
      />
      <ToolbarIcon 
        icon={<Settings size={18} />} 
        tooltip="Settings" 
        active={activeIcon === 'settings'}
        onClick={() => handleIconClick('settings')}
      />
      <ToolbarIcon 
        icon={<HelpCircle size={18} />} 
        tooltip="Help" 
        active={activeIcon === 'help'}
        onClick={() => handleIconClick('help')}
      />
    </div>
  );
}