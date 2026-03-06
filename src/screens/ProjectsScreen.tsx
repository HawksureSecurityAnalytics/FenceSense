import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, Platform, StatusBar,
} from 'react-native';
import { FenceType } from '../types';
import { listProjects, createNewProject, deleteProject, ProjectMeta } from '../storage/projects';
import { colors, spacing, radius } from '../theme';

const FENCE_TYPES: {key:FenceType;label:string;icon:string}[] = [
  {key:'agricultural',label:'Agricultural',icon:'🐄'},
  {key:'security',    label:'Security',    icon:'🔒'},
  {key:'game',        label:'Game',        icon:'🦬'},
  {key:'wildlife',    label:'Wildlife',    icon:'🌿'},
];

interface Props {
  onOpenProject: (id: string) => void;
}

export default function ProjectsScreen({ onOpenProject }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [showNew, setShowNew]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [newType, setNewType]   = useState<FenceType>('agricultural');
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    setProjects(await listProjects());
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const p = await createNewProject(newName.trim(), newType);
      setShowNew(false); setNewName('');
      await load();
      onOpenProject(p.id);
    } finally { setLoading(false); }
  };

  const handleDelete = (meta: ProjectMeta) => {
    Alert.alert('Delete Project', `Delete "${meta.name}"?`, [
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:async()=>{
        await deleteProject(meta.id); load();
      }},
    ]);
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPanel}/>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>📁 PROJECTS</Text>
          <Text style={styles.sub}>Saved fence designs</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={()=>setShowNew(true)}>
          <Text style={styles.newBtnTxt}>+ NEW</Text>
        </TouchableOpacity>
      </View>

      {projects.length===0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⚡</Text>
          <Text style={styles.emptyTitle}>No Projects Yet</Text>
          <Text style={styles.emptySub}>Create a new fence design to get started</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={()=>setShowNew(true)}>
            <Text style={styles.emptyBtnTxt}>Create First Project</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={p=>p.id}
          contentContainerStyle={styles.list}
          renderItem={({item})=>{
            const ti = FENCE_TYPES.find(f=>f.key===item.fenceType);
            return (
              <TouchableOpacity style={styles.card} onPress={()=>onOpenProject(item.id)}>
                <View style={styles.cardIcon}>
                  <Text style={styles.cardIconTxt}>{ti?.icon||'⚡'}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardMeta}>{ti?.label} · {formatDate(item.updatedAt)}</Text>
                </View>
                <TouchableOpacity style={styles.delBtn} onPress={()=>handleDelete(item)}>
                  <Text style={styles.delTxt}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={showNew} transparent animationType="slide" onRequestClose={()=>setShowNew(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={()=>setShowNew(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={()=>true}>
            <Text style={styles.sheetTitle}>▶ NEW PROJECT</Text>
            <Text style={styles.fieldLbl}>PROJECT NAME</Text>
            <TextInput style={styles.textInput} value={newName} onChangeText={setNewName}
              placeholder="e.g. North Paddock Fence" placeholderTextColor={colors.textDim} autoFocus/>
            <Text style={styles.fieldLbl}>FENCE TYPE</Text>
            <View style={styles.typeGrid}>
              {FENCE_TYPES.map(ft=>(
                <TouchableOpacity key={ft.key}
                  style={[styles.typeCard, newType===ft.key && styles.typeCardOn]}
                  onPress={()=>setNewType(ft.key)}>
                  <Text style={styles.typeCardIcon}>{ft.icon}</Text>
                  <Text style={[styles.typeCardLbl, newType===ft.key && {color:colors.amber}]}>{ft.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.createBtn, (!newName.trim()||loading) && {opacity:0.5}]}
              onPress={handleCreate} disabled={!newName.trim()||loading}>
              <Text style={styles.createBtnTxt}>{loading?'Creating…':'Create Project →'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.bg},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    backgroundColor:colors.bgPanel,borderBottomWidth:1,borderBottomColor:colors.border,
    padding:spacing.md,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||0)+spacing.sm:spacing.lg},
  title:{fontFamily:'monospace',fontSize:16,color:colors.amber,fontWeight:'bold',letterSpacing:2},
  sub:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:2,marginTop:2},
  newBtn:{borderWidth:1,borderColor:colors.amber,backgroundColor:colors.amberDim,
    borderRadius:radius.sm,paddingHorizontal:spacing.md,paddingVertical:7},
  newBtnTxt:{fontFamily:'monospace',fontSize:12,color:colors.amber,fontWeight:'bold'},
  list:{padding:spacing.md,gap:spacing.sm},
  card:{flexDirection:'row',alignItems:'center',gap:spacing.md,backgroundColor:colors.bgCard,
    borderRadius:radius.md,padding:spacing.md,borderWidth:1,borderColor:colors.border},
  cardIcon:{width:44,height:44,borderRadius:22,backgroundColor:colors.bgPanel,
    alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},
  cardIconTxt:{fontSize:22},
  cardBody:{flex:1},
  cardName:{fontFamily:'monospace',fontSize:14,color:colors.text,fontWeight:'bold',marginBottom:3},
  cardMeta:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:1},
  delBtn:{padding:8},
  delTxt:{fontSize:14,color:colors.textDim},
  empty:{flex:1,alignItems:'center',justifyContent:'center',gap:spacing.md,padding:spacing.xl},
  emptyIcon:{fontSize:56},
  emptyTitle:{fontFamily:'monospace',fontSize:18,color:colors.text,fontWeight:'bold'},
  emptySub:{fontFamily:'monospace',fontSize:11,color:colors.textDim,textAlign:'center'},
  emptyBtn:{borderWidth:1,borderColor:colors.amber,borderRadius:radius.md,
    paddingHorizontal:spacing.xl,paddingVertical:12},
  emptyBtnTxt:{fontFamily:'monospace',fontSize:13,color:colors.amber},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'},
  sheet:{backgroundColor:colors.bgPanel,borderTopLeftRadius:20,borderTopRightRadius:20,
    padding:spacing.lg,paddingBottom:40},
  sheetTitle:{fontFamily:'monospace',fontSize:10,color:colors.textDim,letterSpacing:3,marginBottom:spacing.lg},
  fieldLbl:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:2,
    marginBottom:spacing.sm,marginTop:spacing.md},
  textInput:{backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.sm,paddingHorizontal:spacing.md,paddingVertical:12,
    fontFamily:'monospace',fontSize:15,color:colors.text},
  typeGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  typeCard:{width:'47%',backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,padding:spacing.md,alignItems:'center',gap:4},
  typeCardOn:{borderColor:colors.amber,backgroundColor:colors.amberDim},
  typeCardIcon:{fontSize:28},
  typeCardLbl:{fontFamily:'monospace',fontSize:11,color:colors.textDim},
  createBtn:{marginTop:spacing.lg,backgroundColor:colors.amber,borderRadius:radius.md,
    paddingVertical:14,alignItems:'center'},
  createBtnTxt:{fontFamily:'monospace',fontSize:14,color:colors.bg,fontWeight:'bold',letterSpacing:1},
});
