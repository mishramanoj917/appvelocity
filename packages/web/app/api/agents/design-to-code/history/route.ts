import { NextResponse } from 'next/server';
import { listProjects } from '@/lib/project-store';

/** GET /api/agents/design-to-code/history — returns all saved projects, newest first. */
export async function GET() {
  const projects = await listProjects();
  return NextResponse.json(projects);
}
