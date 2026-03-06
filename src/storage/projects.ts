import AsyncStorage from '@react-native-async-storage/async-storage';
import { FenceProject, FenceNode, FenceWire, FenceType } from '../types';

const INDEX_KEY = '@fencecad_index';
const PREFIX = '@fencecad_project_';

export interface ProjectMeta {
  id: string;
  name: string;
  fenceType: FenceType;
  updatedAt: number;
}

export async function saveProject(project: FenceProject): Promise<void> {
  const updated = { ...project, updatedAt: Date.now() };
  await AsyncStorage.setItem(PREFIX + project.id, JSON.stringify(updated));
  await addToIndex(project.id, project.name, project.fenceType, updated.updatedAt);
}

export async function loadProject(id: string): Promise<FenceProject | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as FenceProject;
  } catch { return null; }
}

export async function deleteProject(id: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + id);
  const list = await listProjects();
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list.filter(p => p.id !== id)));
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as ProjectMeta[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}

export async function createNewProject(name: string, fenceType: FenceType): Promise<FenceProject> {
  const now = Date.now();
  const project: FenceProject = {
    id: `proj_${now}_${Math.random().toString(36).slice(2, 7)}`,
    name, fenceType, nodes: [], wires: [], createdAt: now, updatedAt: now,
  };
  await saveProject(project);
  return project;
}

async function addToIndex(id: string, name: string, fenceType: FenceType, updatedAt: number): Promise<void> {
  const list = await listProjects();
  const filtered = list.filter(p => p.id !== id);
  filtered.unshift({ id, name, fenceType, updatedAt });
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(filtered));
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleAutoSave(project: FenceProject, delayMs = 2000): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveProject(project).catch(console.error), delayMs);
}

export function createDemoProject(): FenceProject {
  const S = 24;
  const nodes: FenceNode[] = [
    { id: 'e1', type: 'energizer',   x: 3*S,  y: 10*S, label: 'Energizer' },
    { id: 's1', type: 'earth_spike', x: 2*S,  y: 14*S, label: 'Earth 1' },
    { id: 's2', type: 'earth_spike', x: 4*S,  y: 14*S, label: 'Earth 2' },
    { id: 's3', type: 'earth_spike', x: 6*S,  y: 14*S, label: 'Earth 3' },
    { id: 'p1', type: 'post',        x: 8*S,  y: 6*S,  label: '' },
    { id: 'p2', type: 'post',        x: 13*S, y: 6*S,  label: '' },
    { id: 'g1', type: 'gate',        x: 18*S, y: 6*S,  label: 'Main Gate' },
    { id: 'p3', type: 'post',        x: 23*S, y: 6*S,  label: '' },
    { id: 'c1', type: 'corner',      x: 28*S, y: 6*S,  label: '' },
    { id: 'c2', type: 'corner',      x: 28*S, y: 14*S, label: '' },
  ];
  const wires: FenceWire[] = [
    { id: 'ht1', type: 'hot',          x1:3*S,  y1:10*S, x2:8*S,  y2:6*S,  lengthMeters:12 },
    { id: 'ht2', type: 'hot',          x1:8*S,  y1:6*S,  x2:13*S, y2:6*S,  lengthMeters:12 },
    { id: 'ht3', type: 'hot',          x1:23*S, y1:6*S,  x2:28*S, y2:6*S,  lengthMeters:12 },
    { id: 'ht4', type: 'hot',          x1:28*S, y1:6*S,  x2:28*S, y2:14*S, lengthMeters:20 },
    { id: 'ew1', type: 'earth',        x1:3*S,  y1:10*S, x2:2*S,  y2:14*S, lengthMeters:5  },
    { id: 'ew2', type: 'earth',        x1:2*S,  y1:14*S, x2:4*S,  y2:14*S, lengthMeters:4  },
    { id: 'ew3', type: 'earth',        x1:4*S,  y1:14*S, x2:6*S,  y2:14*S, lengthMeters:4  },
    { id: 'bht1',type: 'bridge_hot',   x1:13*S, y1:9*S,  x2:23*S, y2:9*S,  lengthMeters:24 },
  ];
  return {
    id: 'demo', name: 'Demo Farm Fence', fenceType: 'agricultural',
    nodes, wires, createdAt: Date.now(), updatedAt: Date.now(),
  };
}
