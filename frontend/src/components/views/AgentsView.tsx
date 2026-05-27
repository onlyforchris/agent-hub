import React, { useState } from "react";
import { AgentList } from "./agents/AgentList.tsx";
import { AgentConfigWizard } from "./agents/AgentConfigWizard.tsx";

export function AgentsView() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  if (!selectedAgentId) {
    return (
      <div className="app-shell p-4">
        <AgentList onSelect={setSelectedAgentId} />
      </div>
    );
  }
  return (
    <div className="app-shell p-4">
      <AgentConfigWizard agentId={selectedAgentId} onBack={() => setSelectedAgentId(null)} />
    </div>
  );
}
