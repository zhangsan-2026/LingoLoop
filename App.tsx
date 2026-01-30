import React, { useState, useEffect } from 'react';
import { Project } from './types';
import { getProjects } from './services/storageService';
import HomePage from './components/HomePage';
import PlayerPage from './components/PlayerPage';

const App: React.FC = () => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const loadProjects = () => {
    setProjects(getProjects().sort((a, b) => b.lastAccessedAt - a.lastAccessedAt));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Simple Hash-like routing simulation since we are in a strictly controlled SPA env
  // but mostly relying on state since URL manipulation wasn't strictly requested beyond constraints.
  
  if (currentProject) {
    return (
      <PlayerPage 
        project={currentProject}
        onBack={() => {
            setCurrentProject(null);
            loadProjects();
        }}
        onUpdateProject={(p) => {
            // Optimistic update for UI, persistence handled inside PlayerPage or Service
            setCurrentProject(p);
        }}
      />
    );
  }

  return (
    <HomePage 
      projects={projects}
      onOpenProject={setCurrentProject}
      onRefresh={loadProjects}
    />
  );
};

export default App;