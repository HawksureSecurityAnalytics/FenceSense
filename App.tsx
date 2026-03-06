import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { FenceProject } from './src/types';
import { createDemoProject, loadProject } from './src/storage/projects';
import DesignScreen from './src/screens/DesignScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import { colors, spacing } from './src/theme';

type Tab = 'design' | 'diagnostics' | 'projects';

const TABS: {key:Tab;icon:string;label:string}[] = [
  {key:'design',      icon:'✏️', label:'Design'},
  {key:'diagnostics', icon:'🔍', label:'Diagnose'},
  {key:'projects',    icon:'📁', label:'Projects'},
];

export default function App() {
  const [tab, setTab]                     = useState<Tab>('design');
  const [project, setProject]             = useState<FenceProject>(createDemoProject());

  const handleProjectUpdate = useCallback((p: FenceProject) => {
    setProject(p);
  }, []);

  const handleOpenProject = useCallback(async (id: string) => {
    if (id === 'demo') {
      setProject(createDemoProject());
    } else {
      const p = await loadProject(id);
      if (p) setProject(p);
    }
    setTab('design');
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.content}>
          {tab === 'design' && (
            <DesignScreen project={project} onProjectUpdate={handleProjectUpdate}/>
          )}
          {tab === 'diagnostics' && <DiagnosticsScreen/>}
          {tab === 'projects' && <ProjectsScreen onOpenProject={handleOpenProject}/>}
        </View>

        <View style={styles.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}>
              <Text style={styles.tabIcon}>{t.icon}</Text>
              <Text style={[styles.tabLabel, tab===t.key && {color:colors.amber}]}>{t.label}</Text>
              {tab===t.key && <View style={styles.tabLine}/>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  root:{flex:1},
  content:{flex:1},
  tabBar:{flexDirection:'row',backgroundColor:colors.bgPanel,
    borderTopWidth:1,borderTopColor:colors.border,paddingBottom:spacing.xs},
  tab:{flex:1,alignItems:'center',paddingVertical:spacing.sm,position:'relative'},
  tabIcon:{fontSize:20,marginBottom:2},
  tabLabel:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:1},
  tabLine:{position:'absolute',top:0,left:'25%',right:'25%',height:2,
    backgroundColor:colors.amber,borderRadius:1},
});
