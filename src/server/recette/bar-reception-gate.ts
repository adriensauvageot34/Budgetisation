import 'server-only';
/** Preview-only geometry reception with normal Auth and memory-only fixtures. */
export function barGeometryReceptionEnabled(){
  const url='https://ipuuhxrblxormwgoaqnz.supabase.co';
  return process.env.VERCEL_ENV==='preview'&&process.env.BAR_GEOMETRY_RECEPTION==='1'
    &&!!process.env.BAR_GEOMETRY_AUTHOR&&process.env.NEXT_PUBLIC_SUPABASE_URL===url&&process.env.SUPABASE_URL===url;
}
export function barReceptionEnabled(){
  const url='https://wlndjknwbceaqrqcwbqw.supabase.co';
  return barGeometryReceptionEnabled()||process.env.VERCEL_ENV==='preview'&&process.env.BAR_AUTH_RECEPTION_PROJECT==='wlndjknwbceaqrqcwbqw'
    &&process.env.NEXT_PUBLIC_SUPABASE_URL===url&&process.env.SUPABASE_URL===url;
}
