import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runDesignAudit, FigmaAuthError, InvalidFigmaUrlError } from '@appvelocity/agent-design-to-code-workflow';

const AnalyzeSchema = z.object({
  figmaUrl:         z.string().min(1),
  figmaAccessToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'figmaUrl and figmaAccessToken are required' }, { status: 400 });
  }

  try {
    const report = await runDesignAudit(parsed.data.figmaUrl, parsed.data.figmaAccessToken);
    return NextResponse.json(report);
  } catch (err: unknown) {
    if (err instanceof InvalidFigmaUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof FigmaAuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 502 });
  }
}
