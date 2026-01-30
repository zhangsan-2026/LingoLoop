import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectGroup } from '../types';
import { 
    createProject, 
    deleteProjectFromStorage, 
    getGroups, 
    createGroup, 
    deleteGroup,
    moveProjectToGroup
} from '../services/storageService';

interface HomePageProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onRefresh: () => void;
}

type ViewMode = 'projects' | 'history';

// Confirmation Modal Component
interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm animate-[scaleIn_0.2s_ease-out]">
                <h3 className="text-xl font-bold mb-2 text-notion-text">{title}</h3>
                <p className="text-notion-gray mb-6 text-sm">{message}</p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 text-notion-text bg-notion-sidebar hover:bg-notion-hover rounded font-medium text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="px-4 py-2 text-white bg-red-500 hover:bg-red-600 rounded font-medium text-sm shadow-sm transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

const HomePage: React.FC<HomePageProps> = ({ projects, onOpenProject, onRefresh }) => {
  // Navigation State
  const [viewMode, setViewMode] = useState<ViewMode>('projects');
  const [currentGroupId, setCurrentGroupId] = useState<string | undefined>(undefined);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);

  // Creation Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  
  // Move/Context Menu State
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetProjectForMove, setTargetProjectForMove] = useState<Project | null>(null);

  // Deletion State (Custom Modal)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'project' | 'group', id: string, name: string } | null>(null);

  // Long Press Refs
  const longPressTimer = useRef<any>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
      setGroups(getGroups());
  }, [projects]); 

  // -- Actions --

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    
    const newProject = createProject(newItemName, currentGroupId);
    const currentProjects = JSON.parse(localStorage.getItem('lingoloop_data') || '[]');
    localStorage.setItem('lingoloop_data', JSON.stringify([...currentProjects, newProject]));
    
    setNewItemName('');
    setIsProjectModalOpen(false);
    onRefresh();
  };

  const handleCreateGroup = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newItemName.trim()) return;
      createGroup(newItemName);
      setNewItemName('');
      setIsGroupModalOpen(false);
      onRefresh(); 
  };

  // Trigger Delete Confirmation
  const requestDeleteProject = (e: React.MouseEvent | React.TouchEvent | null, project: Project) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setDeleteTarget({ type: 'project', id: project.id, name: project.name });
      setMoveModalOpen(false); // Close other modals if open
  };

  const requestDeleteGroup = (e: React.MouseEvent | React.TouchEvent, group: ProjectGroup) => {
      e.preventDefault();
      e.stopPropagation();
      setDeleteTarget({ type: 'group', id: group.id, name: group.name });
  };

  // Execute Deletion
  const confirmDelete = async () => {
      if (!deleteTarget) return;

      if (deleteTarget.type === 'project') {
          try {
            await deleteProjectFromStorage(deleteTarget.id);
          } catch (e) {
            console.error(e);
          }
      } else {
          deleteGroup(deleteTarget.id);
      }
      
      onRefresh();
      setDeleteTarget(null);
  };

  const handleMoveProject = (groupId?: string) => {
      if (targetProjectForMove) {
          moveProjectToGroup(targetProjectForMove.id, groupId);
          setMoveModalOpen(false);
          setTargetProjectForMove(null);
          onRefresh();
      }
  };

  // -- Long Press Logic --

  const startPress = (project: Project) => {
      isLongPress.current = false;
      longPressTimer.current = setTimeout(() => {
          isLongPress.current = true;
          setTargetProjectForMove(project);
          setMoveModalOpen(true);
          if (navigator.vibrate) navigator.vibrate(50);
      }, 500);
  };

  const cancelPress = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleProjectClick = (project: Project) => {
      if (isLongPress.current) return; 
      onOpenProject(project);
  };

  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
  };

  // -- Filtering --
  const filteredProjects = projects.filter(p => p.groupId === currentGroupId);
  const currentGroup = groups.find(g => g.id === currentGroupId);
  
  const historyList = [...projects].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

  return (
    <div className="flex min-h-screen bg-notion-bg text-notion-text">
      
      {/* Sidebar Navigation */}
      <div className="w-64 bg-notion-sidebar border-r border-notion-border flex-shrink-0 flex flex-col pt-8 pb-4 px-4 hidden md:flex">
         <div className="mb-8 px-2">
             <h1 className="text-xl font-bold flex items-center gap-2">
                <span>🦜</span> LingoLoop
             </h1>
         </div>
         <nav className="flex-1 space-y-1">
             <button 
                onClick={() => setViewMode('projects')}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${viewMode === 'projects' ? 'bg-white shadow-sm font-medium' : 'text-notion-gray hover:bg-notion-hover'}`}
             >
                 📁 My Projects
             </button>
             <button 
                onClick={() => setViewMode('history')}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${viewMode === 'history' ? 'bg-white shadow-sm font-medium' : 'text-notion-gray hover:bg-notion-hover'}`}
             >
                 🕒 History
             </button>
         </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Mobile Nav Header */}
        <div className="md:hidden p-4 border-b border-notion-border flex items-center justify-between bg-notion-sidebar shrink-0">
            <span className="font-bold">🦜 LingoLoop</span>
            <div className="flex gap-2 text-sm">
                <button onClick={() => setViewMode('projects')} className={viewMode === 'projects' ? 'font-bold' : 'text-notion-gray'}>Projects</button>
                <button onClick={() => setViewMode('history')} className={viewMode === 'history' ? 'font-bold' : 'text-notion-gray'}>History</button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-12">
            <div className="max-w-5xl mx-auto">
                
                {/* View: Projects Grid */}
                {viewMode === 'projects' && (
                    <>
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Projects</h2>
                                {/* Breadcrumbs */}
                                <div className="flex items-center text-sm text-notion-gray gap-2 mt-2">
                                    <button 
                                        onClick={() => setCurrentGroupId(undefined)}
                                        className={`hover:text-notion-text hover:underline ${!currentGroupId ? 'font-bold text-notion-text' : ''}`}
                                    >
                                        Home
                                    </button>
                                    {currentGroupId && currentGroup && (
                                        <>
                                            <span>/</span>
                                            <span className="font-bold text-notion-text">📁 {currentGroup.name}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsProjectModalOpen(true)}
                                    className="bg-white border border-notion-border text-notion-text px-4 py-2 rounded hover:bg-notion-hover transition-all shadow-sm font-medium text-sm"
                                >
                                    + Project
                                </button>
                                <button 
                                    onClick={() => setIsGroupModalOpen(true)}
                                    className="bg-notion-text text-white px-4 py-2 rounded hover:bg-black/80 transition-all shadow-sm font-medium text-sm"
                                >
                                    + New Group
                                </button>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 select-none pb-20">
                            {/* Back Button */}
                            {currentGroupId && (
                                <div 
                                    onClick={() => setCurrentGroupId(undefined)}
                                    className="flex items-center justify-center h-48 rounded-xl border-2 border-dashed border-notion-border hover:bg-notion-sidebar transition-colors cursor-pointer text-notion-gray"
                                >
                                    <span className="font-medium">.. (Back)</span>
                                </div>
                            )}

                            {/* Groups */}
                            {!currentGroupId && groups.map(group => (
                                <div 
                                    key={group.id}
                                    className="group relative flex flex-col h-48 bg-notion-sidebar border border-notion-border rounded-xl hover:shadow-md transition-all hover:bg-gray-100 overflow-hidden"
                                >
                                    {/* Overlay for Navigation */}
                                    <div onClick={() => setCurrentGroupId(group.id)} className="absolute inset-0 z-10 cursor-pointer bg-transparent" />
                                    
                                    <div className="relative z-0 p-6 flex flex-col h-full pointer-events-none">
                                        <div className="text-4xl mb-4">📁</div>
                                        <h3 className="font-bold text-lg mb-1">{group.name}</h3>
                                        <p className="text-xs text-notion-gray">{projects.filter(p => p.groupId === group.id).length} projects</p>
                                    </div>
                                    
                                    {/* Delete Button - Explicitly above overlay */}
                                    <button 
                                        onClick={(e) => requestDeleteGroup(e, group)}
                                        onMouseDown={stopPropagation}
                                        onTouchStart={stopPropagation}
                                        className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 p-2 text-notion-gray hover:text-red-500 hover:bg-white/50 rounded transition-all cursor-pointer"
                                        title="Delete Group"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}

                            {/* Projects */}
                            {filteredProjects.map(project => (
                                <div 
                                    key={project.id}
                                    className="group relative h-48 bg-white border border-notion-border rounded-xl hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden"
                                    onMouseDown={() => startPress(project)}
                                    onMouseUp={cancelPress}
                                    onMouseLeave={cancelPress}
                                    onTouchStart={() => startPress(project)}
                                    onTouchEnd={cancelPress}
                                >
                                    {/* Overlay for Opening */}
                                    <div onClick={() => handleProjectClick(project)} className="absolute inset-0 z-10 cursor-pointer bg-transparent" />
                                    
                                    <div className="relative z-0 p-6 flex flex-col h-full pointer-events-none">
                                        <div className="flex-1">
                                            <div className="text-2xl mb-2">{project.mediaType === 'audio' ? '🎵' : project.mediaType === 'video' ? '🎬' : '📄'}</div>
                                            <h3 className="font-bold text-lg mb-1 truncate">{project.name}</h3>
                                            <p className="text-xs text-notion-gray">{new Date(project.lastAccessedAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Delete Button - Explicitly above overlay */}
                                    <button 
                                        onClick={(e) => requestDeleteProject(e, project)}
                                        onMouseDown={stopPropagation}
                                        onTouchStart={stopPropagation}
                                        className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 p-2 bg-white/90 hover:bg-red-50 text-red-500 rounded-full border border-gray-100 hover:border-red-100 transition-all cursor-pointer shadow-sm"
                                        title="Delete Project"
                                    >
                                        🗑
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* View: History List */}
                {viewMode === 'history' && (
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold mb-8">History</h2>
                        {historyList.length === 0 ? (
                            <p className="text-notion-gray">No history yet.</p>
                        ) : (
                            <div className="bg-white rounded-xl border border-notion-border overflow-hidden">
                                {historyList.map((project, idx) => (
                                    <div 
                                        key={project.id}
                                        className={`p-4 flex items-center justify-between hover:bg-notion-hover transition-colors group ${idx !== historyList.length - 1 ? 'border-b border-notion-border' : ''}`}
                                    >
                                        <div 
                                            className="flex-1 cursor-pointer flex flex-col gap-1 pr-4"
                                            onClick={() => onOpenProject(project)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{project.mediaType === 'audio' ? '🎵' : project.mediaType === 'video' ? '🎬' : '📄'}</span>
                                                <h3 className="font-medium text-notion-text">{project.name}</h3>
                                                <span className="text-xs text-notion-gray ml-auto">
                                                    {new Date(project.lastAccessedAt).toLocaleString()}
                                                </span>
                                            </div>
                                            
                                            {/* Display URLs if available */}
                                            {(project.mediaUrl || project.textUrl) && (
                                                <div className="flex flex-col gap-1 ml-9 mt-1 text-xs text-notion-gray">
                                                    {project.mediaUrl && (
                                                        <div className="flex items-center gap-1 overflow-hidden">
                                                            <span className="shrink-0 text-[10px] uppercase font-bold text-blue-500 bg-blue-50 px-1 rounded">Media</span>
                                                            <span className="truncate max-w-md hover:text-notion-text">{project.mediaUrl}</span>
                                                        </div>
                                                    )}
                                                    {project.textUrl && (
                                                        <div className="flex items-center gap-1 overflow-hidden">
                                                            <span className="shrink-0 text-[10px] uppercase font-bold text-green-500 bg-green-50 px-1 rounded">Text</span>
                                                            <span className="truncate max-w-md hover:text-notion-text">{project.textUrl}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={(e) => requestDeleteProject(e, project)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all shrink-0"
                                            title="Delete"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Global Confirm Modal */}
        <ConfirmModal 
            isOpen={!!deleteTarget}
            title={deleteTarget?.type === 'project' ? 'Delete Project' : 'Delete Group'}
            message={deleteTarget?.type === 'project' 
                ? `Are you sure you want to delete "${deleteTarget?.name}"? This will remove the project and its history record.` 
                : `Are you sure you want to delete the group "${deleteTarget?.name}"? Projects inside will be moved to Home.`
            }
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
        />
      </div>

      {/* New Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <form onSubmit={handleCreateGroup} className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">New Group</h2>
            <input 
              autoFocus
              type="text" 
              placeholder="Folder Name" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full border border-notion-border rounded p-2 mb-4 focus:ring-2 focus:ring-notion-blue outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsGroupModalOpen(false)} className="px-4 py-2 text-notion-gray hover:bg-notion-hover rounded">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-notion-text text-white rounded hover:bg-black/80">Create Group</button>
            </div>
          </form>
        </div>
      )}

      {/* New Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <form onSubmit={handleCreateProject} className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">New Project</h2>
            <input 
              autoFocus
              type="text" 
              placeholder="Project Name" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full border border-notion-border rounded p-2 mb-4 focus:ring-2 focus:ring-notion-blue outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-notion-gray hover:bg-notion-hover rounded">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-notion-blue text-white rounded hover:bg-blue-600">Create Project</button>
            </div>
          </form>
        </div>
      )}

      {/* Move/Action Modal (Long Press) */}
      {moveModalOpen && targetProjectForMove && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                  <h2 className="text-lg font-bold mb-4">Manage: {targetProjectForMove.name}</h2>
                  
                  <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                      <p className="text-xs text-notion-gray uppercase font-bold mb-2">Move to...</p>
                      {targetProjectForMove.groupId && (
                        <button onClick={() => handleMoveProject(undefined)} className="w-full text-left px-3 py-2 rounded hover:bg-notion-sidebar text-sm">
                            🏠 Home (Root)
                        </button>
                      )}
                      {groups.map(g => {
                          if (g.id === targetProjectForMove.groupId) return null;
                          return (
                            <button key={g.id} onClick={() => handleMoveProject(g.id)} className="w-full text-left px-3 py-2 rounded hover:bg-notion-sidebar text-sm flex items-center gap-2">
                                📁 {g.name}
                            </button>
                          );
                      })}
                  </div>

                  <div className="border-t border-notion-border pt-4 flex justify-between">
                      <button onClick={(e) => requestDeleteProject(e, targetProjectForMove)} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium">
                          Delete Project
                      </button>
                      <button onClick={() => setMoveModalOpen(false)} className="text-notion-gray hover:bg-notion-hover px-3 py-2 rounded text-sm">
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default HomePage;