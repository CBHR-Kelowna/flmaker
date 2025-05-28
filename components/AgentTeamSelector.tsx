
import React from 'react';
import type { Agent, Team } from '../types';
import { Select } from './Select';

interface AgentTeamSelectorProps {
  agents: Agent[];
  teams: Team[];
  selectedAgentId: string | null;
  selectedTeamId: string | null;
  onAgentChange: (agentId: string | null) => void;
  onTeamChange: (teamId: string | null) => void;
}

export const AgentTeamSelector: React.FC<AgentTeamSelectorProps> = ({
  agents,
  teams,
  selectedAgentId,
  selectedTeamId,
  onAgentChange,
  onTeamChange,
}) => {
  const selectedAgent = agents.find((a: Agent) => a.id === selectedAgentId);
  const selectedTeam = teams.find((t: Team) => t.id === selectedTeamId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label htmlFor="agentSelect" className="block text-sm font-medium text-slate-700 mb-1">
          Select Agent <span className="text-red-500">*</span>
        </label>
        <Select
          id="agentSelect"
          value={selectedAgentId || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onAgentChange(e.target.value || null)}
          className="w-full"
          aria-describedby="brandingRequirement"
        >
          <option value="">No Agent Selected</option>
          {agents.map((agent: Agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </Select>
        {selectedAgent?.overlayImage && (
          <div className="mt-3 p-2 border border-slate-200 rounded-md inline-block bg-slate-50" title="Agent overlay preview (will be full size on image)">
            <img 
              src={selectedAgent.overlayImage} 
              alt={`${selectedAgent.name} overlay preview`}
              className="w-20 h-20 object-contain rounded" 
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
      </div>
      <div>
        <label htmlFor="teamSelect" className="block text-sm font-medium text-slate-700 mb-1">
          Select Team <span className="text-red-500">*</span>
        </label>
        <Select
          id="teamSelect"
          value={selectedTeamId || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onTeamChange(e.target.value || null)}
          className="w-full"
          aria-describedby="brandingRequirement"
        >
          <option value="">No Team Selected</option>
          {teams.map((team: Team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
         {selectedTeam?.overlayLogo && (
          <div className="mt-3 p-2 border border-slate-200 rounded-md inline-block bg-slate-50" title="Team overlay preview (will be full size on image)">
            <img 
              src={selectedTeam.overlayLogo} 
              alt={`${selectedTeam.name} overlay preview`}
              className="w-32 h-auto object-contain rounded max-h-20" 
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
      </div>
      <p id="brandingRequirement" className="md:col-span-2 text-sm text-slate-600">
        <span className="text-red-500">*</span> Branding is required. Please select an Agent OR a Team. If both are selected, Agent branding will take precedence.
      </p>
    </div>
  );
};
