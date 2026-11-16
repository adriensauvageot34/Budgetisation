import fs from 'node:fs';
import { commerceLibraryFixture } from './commerce-library-fixture.mjs';
import { require } from './phase2-ts-loader.mjs';
const {ComposerPreferences}=require('@/server/commerce/composer-preferences');
const {preferenceRequest}=require('@/server/commerce/preference-http');
export async function composerPreferencesFixture(){
  const fixture=await commerceLibraryFixture(['composer_private_preferences']);
  await fixture.pg.db.exec(fs.readFileSync('supabase/migrations/20261116085848_composer_private_preferences.sql','utf8'));
  const service=new ComposerPreferences(fixture.client(fixture.userId),fixture.userId);
  return {...fixture,request:request=>preferenceRequest(request,async()=>({service,userId:fixture.userId}))};
}
