// Audit/test only. The pinned P2-A implementation is never used by production.
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import crypto from 'node:crypto';
import ts from 'typescript';
import './phase2-ts-loader.mjs';
export const beforeRef = '47a59e0fda43f39e2107bbcde33091a27fb3ebdd';
export const presenceFile = 'src/analytics/global-v2/mobility-context.ts';
export function replaceFunction(code, name, transform) {
  const source = ts.createSourceFile('audit.ts', code, ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  if (!node?.body) throw new Error(`AUDIT_FUNCTION_REQUIRED:${name}`);
  const start = node.body.getStart(source), end = node.body.end;
  return code.slice(0, start) + transform(code.slice(start + 1, end - 1)) + code.slice(end);
}
export function instrumentPresenceSource(code, { pairs = false } = {}) {
  code = replaceFunction(code, 'overlaps', body => `{const result=(()=>{${body}})();
    const c=__presenceCounts();c.finalOverlapCalls=(c.finalOverlapCalls??0)+1;
    if(result)c.positiveOverlaps=(c.positiveOverlaps??0)+1;return result;}`);
  code = replaceFunction(code, 'resolvePairwisePresence', body => `{
    const c=__presenceCounts();c.resolvePairwiseCalls=(c.resolvePairwiseCalls??0)+1;${body}}`);
  code = code.replace('const subjectPlaceIds =', `const c=__presenceCounts();
    c.theoreticalPairs=(c.theoreticalPairs??0)+(input.visitsByPerson.get(other)??[]).filter(v=>exactVisitInterval(v)!==null).length;
    const subjectPlaceIds =`);
  const expression = 'overlaps(contextInterval.startAt, contextInterval.endAt, interval.startAt, interval.endAt, memo)';
  if (!code.includes(expression)) throw new Error('VISIT_ORACLE_EXPRESSION_REQUIRED');
  code = code.replace(expression, '__presenceVisitOverlap(input.link, other, visit, contextInterval, interval, memo)');
  code = replaceFunction(code, 'buildGlobalM7MobilityContextAuthority', body => `{
    const c=__presenceCounts();c.presenceIntervals=(c.presenceIntervals??0)+input.placeVisits.filter(v=>exactVisitInterval(v)!==null).length;
    ${body}}`);
  return code + `\nconst __presenceAudit={counts:{} as Record<string,number>,pairs:[] as unknown[]};
    function __presenceCounts():Record<string,number>{return (globalThis as any).__auditWorkCounts??__presenceAudit.counts;}
    function __presenceVisitOverlap(link:MobilityContextResolution,other:string,visit:PlaceVisitFact,a:any,b:any,memo:InstantMemo){
      const c=__presenceCounts();c.candidatePairs=(c.candidatePairs??0)+1;
      const result=overlaps(a.startAt,a.endAt,b.startAt,b.endAt,memo);
      if(result){c.positiveVisitOverlaps=(c.positiveVisitOverlaps??0)+1;
        ${pairs ? '__presenceAudit.pairs.push([link.contextResolutionId,link.subjectPersonId,other,visit.visitKey,visit.personDayId,visit.placeId,a,b]);' : ''}}
      return result;
    }
    export {__presenceAudit};\n`;
}
export function loadPresenceAudit(before = false) {
  const reference = before ? JSON.parse(fs.readFileSync(new URL('../fixtures/m7-presence-bruteforce-source.json', import.meta.url), 'utf8')) : null;
  if (reference && (reference.gitRef !== beforeRef || crypto.createHash('sha256').update(reference.source).digest('hex') !== reference.sha256))
    throw new Error('PINNED_BRUTE_FORCE_SOURCE_INVALID');
  const code = reference?.source ?? fs.readFileSync(presenceFile, 'utf8');
  const filename = path.resolve(path.dirname(presenceFile), before ? 'presence-audit-before.js' : 'presence-audit-after.js');
  const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
  module._compile(ts.transpileModule(instrumentPresenceSource(code, { pairs: true }), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return value => {
    module.exports.__presenceAudit.counts = {}; module.exports.__presenceAudit.pairs = [];
    try { return { authority: module.exports.buildGlobalM7MobilityContextAuthority(value), ...module.exports.__presenceAudit }; }
    catch (error) { return { error: { name: error.name, message: error.message }, ...module.exports.__presenceAudit }; }
  };
}
