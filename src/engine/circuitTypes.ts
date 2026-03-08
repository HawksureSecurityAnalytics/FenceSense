export interface Post { id:string; x:number; y:number; }
export interface Segment { id:string; postA:string; postB:string; }
export type BridgeType='ht'|'earth';
export type BridgeSide='left'|'right';
export interface Bridge { id:string; segmentId:string; strandIndex:number; type:BridgeType; side:BridgeSide; }
export interface FaultItem { id:string; kind:'bridge'|'strand'; }
