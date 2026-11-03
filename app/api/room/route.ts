import { env } from 'cloudflare:workers';
import { handleApi } from '@/lib/server';
export async function POST(request: Request) {
  if (!env.DB) return Response.json({error:'قاعدة البيانات غير متاحة.',code:'STORAGE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
  return handleApi(request,env.DB);
}
export async function GET() { return Response.json({service:'Mafia Game',ok:true},{headers:{'Cache-Control':'no-store'}}); }
