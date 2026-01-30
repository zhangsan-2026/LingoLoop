import { Project, Sentence, ProjectGroup } from '../types';
import { generateId, DEFAULT_SPLIT_RATIO } from '../constants';
import { deleteMediaFromDB } from './mediaStorageService';

const PROJECT_KEY = 'lingoloop_data';
const GROUP_KEY = 'lingoloop_groups';

// --- Projects ---

export const getProjects = (): Project[] => {
  try {
    const data = localStorage.getItem(PROJECT_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load projects", e);
    return [];
  }
};

export const saveProjects = (projects: Project[]) => {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("Failed to save projects", e);
  }
};

export const createProject = (name: string, groupId?: string): Project => {
  return {
    id: generateId(),
    groupId: groupId,
    name,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    mediaType: 'none',
    mediaName: '',
    sentences: [],
    lastActiveIndex: -1,
    splitRatio: DEFAULT_SPLIT_RATIO,
    fontSize: 16, // Default font size
    currentTime: 0,
  };
};

export const updateProjectInStorage = (project: Project) => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === project.id);
  if (index !== -1) {
    projects[index] = { ...project, lastAccessedAt: Date.now() };
    saveProjects(projects);
  }
};

export const deleteProjectFromStorage = async (projectId: string) => {
    const projects = getProjects();
    const newProjects = projects.filter(p => p.id !== projectId);
    saveProjects(newProjects);
    // Best effort media deletion
    try {
        await deleteMediaFromDB(projectId);
    } catch (e) {
        console.warn("Could not delete media from indexedDB (might already be gone)", e);
    }
};

// --- Groups ---

export const getGroups = (): ProjectGroup[] => {
    try {
        const data = localStorage.getItem(GROUP_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
};

export const saveGroups = (groups: ProjectGroup[]) => {
    localStorage.setItem(GROUP_KEY, JSON.stringify(groups));
};

export const createGroup = (name: string): ProjectGroup => {
    const newGroup: ProjectGroup = {
        id: generateId(),
        name,
        createdAt: Date.now()
    };
    const groups = getGroups();
    saveGroups([...groups, newGroup]);
    return newGroup;
};

export const deleteGroup = (groupId: string) => {
    // 1. Delete group
    const groups = getGroups();
    saveGroups(groups.filter(g => g.id !== groupId));

    // 2. Move contained projects to Root (remove groupId)
    //    Alternatively we could delete them, but moving to root is safer for user data.
    const projects = getProjects();
    const updatedProjects = projects.map(p => {
        if (p.groupId === groupId) {
            return { ...p, groupId: undefined };
        }
        return p;
    });
    saveProjects(updatedProjects);
};

export const moveProjectToGroup = (projectId: string, groupId?: string) => {
    const projects = getProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
        projects[idx].groupId = groupId; // undefined means root
        saveProjects(projects);
    }
};