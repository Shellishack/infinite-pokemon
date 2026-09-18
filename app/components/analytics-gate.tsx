import {Analytics} from '@vercel/analytics/next';

// Analytics are only meaningful on the Vercel-hosted site. In local/Electron
// builds NEXT_PUBLIC_VERCEL_ENV is unset, so nothing is rendered and nothing
// is transmitted.
export function AnalyticsGate(){
  if(!process.env.NEXT_PUBLIC_VERCEL_ENV) return null;
  return <Analytics/>;
}
