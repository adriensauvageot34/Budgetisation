import{BeforeDraftHistory,clone,model,stageLocalDecision,handleComposerRequest,makeDeps,householdId,semanticStateDigest,saveComposerDraft,require}from'./runtime.mjs';
export class Frames{
 constructor(stored,world,initial){this.stored=stored;this.state=clone(initial??stored?.semanticState??require('@/domain/phase2/planner/semantic-state').emptyPlanSemanticState('2026-11'));this.world=world;this.history=new BeforeDraftHistory(stored,this.state);this.past=[];this.future=[];this.raw=new Map();}
 async operation(op){const before=clone(this.state);let next=stageLocalDecision(await model(this.state,this.world),this.state,op);if(!next){const r=await handleComposerRequest(makeDeps(this.world),householdId,{...op,draft:this.state,targetMonth:this.state.targetMonth,sequence:1});if(!r.ok)throw Error(r.code);next=r.model.semanticState;}this.history.record(this.state,next,op);this.state=next;this.past.push(before);this.future=[];}
 undo(){const s=this.past.pop();if(!s)return;this.future.push(clone(this.state));this.history.select(s);this.state=s;}
 redo(){const s=this.future.pop();if(!s)return;this.past.push(clone(this.state));this.history.select(s);this.state=s;}
 request(id=crypto.randomUUID()){return{targetMonth:this.state.targetMonth,semanticState:clone(this.state),digest:semanticStateDigest(this.state),requestId:id,expectedDraftId:this.stored?.draftId??null,expectedDraftVersion:this.stored?.version??0,expectedBaseRevisionId:this.stored?.baseRevisionId??null,expectedBaseRevisionNumber:this.stored?.baseRevisionNumber??0,beforeAdmission:this.history.envelope(this.state)};}
 async save(scope,command=this.request()){const result=await saveComposerDraft(scope,command);if(result.ok){this.history.acknowledge(result.draft,command);this.stored=result.draft;}return result;}
}
