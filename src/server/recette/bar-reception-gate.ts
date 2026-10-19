import 'server-only';
export function barReceptionEnabled(){
  const url='https://wlndjknwbceaqrqcwbqw.supabase.co';
  return process.env.VERCEL_ENV==='preview'&&process.env.BAR_AUTH_RECEPTION_PROJECT==='wlndjknwbceaqrqcwbqw'
    &&process.env.NEXT_PUBLIC_SUPABASE_URL===url&&process.env.SUPABASE_URL===url;
}
