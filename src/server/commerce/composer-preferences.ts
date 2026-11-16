import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePreference, preferenceScope, preferenceSubject, type ExplicitPreference } from "@/domain/phase2/composer-preferences";

const table = "composer_private_preferences";
const columns = "subject_key,scope_key,label,scope_label,stance,review_on,version";
const publicRow = (r: Record<string, unknown>) => parsePreference({ subjectKey:r.subject_key,scope:r.scope_key,label:r.label,
  scopeLabel:r.scope_label,stance:r.stance,reviewOn:r.review_on,version:r.version });
function check(error: unknown) { if (error) throw new TypeError(typeof error === "object" && "code" in error && error.code === "23505" ? "PREFERENCE_CONFLICT" : "PREFERENCE_UNAVAILABLE"); }

export class ComposerPreferences {
  constructor(private client: SupabaseClient, private userId: string) {}
  async read() {
    const r=await this.client.from(table).select(columns).eq("user_id",this.userId).order("updated_at",{ascending:false}).limit(1000);
    check(r.error); return (r.data??[]).map(publicRow);
  }
  async set(raw: unknown) {
    const p=parsePreference(raw);
    const values={user_id:this.userId,subject_key:p.subjectKey,scope_key:p.scope,label:p.label,scope_label:p.scopeLabel,
      stance:p.stance,review_on:p.stance==="LIKE"?p.reviewOn:null,version:p.version+1,updated_at:new Date().toISOString()};
    const r=p.version===0?await this.client.from(table).insert(values).select(columns).maybeSingle()
      :await this.client.from(table).update(values).eq("user_id",this.userId).eq("subject_key",p.subjectKey).eq("scope_key",p.scope)
        .eq("version",p.version).select(columns).maybeSingle();
    check(r.error); if(!r.data)throw new TypeError("PREFERENCE_CONFLICT"); return publicRow(r.data);
  }
  async remove(subject:unknown,scope:unknown,version:unknown) {
    if(!Number.isSafeInteger(version)||Number(version)<1)throw new TypeError("PREFERENCE_INVALID");
    const r=await this.client.from(table).delete().eq("user_id",this.userId).eq("subject_key",preferenceSubject(subject))
      .eq("scope_key",preferenceScope(scope)).eq("version",version).select("subject_key").maybeSingle();
    check(r.error);if(!r.data)throw new TypeError("PREFERENCE_CONFLICT");return true;
  }
}
