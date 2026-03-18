export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get Vercel project info from environment
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, repoUrl, domain } = body;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    // Check if Vercel token is configured
    if (!VERCEL_TOKEN) {
      return NextResponse.json({ 
        error: 'Vercel not configured. Set VERCEL_TOKEN environment variable.',
        hint: 'Get token from https://vercel.com/account/tokens'
      }, { status: 500 });
    }

    let deployUrl = '';
    let deployStatus = 'pending';

    // Option 1: Deploy from local project folder
    const projectPath = `${process.env.HOME}/projects/client-sites/${slug}`;
    
    // Try Vercel CLI if project exists locally
    try {
      const { stdout } = await execAsync(
        `cd ${projectPath} && npx vercel --yes --token=${VERCEL_TOKEN} ${VERCEL_TEAM_ID ? '--team=' + VERCEL_TEAM_ID : ''} --prod 2>&1`,
        { timeout: 180000 } // 3 min timeout
      );
      
      // Extract deployment URL from output
      const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
      if (urlMatch) {
        deployUrl = urlMatch[0];
        deployStatus = 'deployed';
      }
    } catch (deployError: any) {
      // Vercel CLI not available or deployment failed
      console.error('Vercel deployment error:', deployError.message);
      
      // Return a placeholder - in production this would be automated via Vercel API
      deployUrl = `https://${slug}.vercel.app`;
      deployStatus = 'ready_for_deployment';
    }

    return NextResponse.json({
      success: true,
      slug,
      deployUrl,
      status: deployStatus,
      message: deployStatus === 'deployed' ? 'Site deployed!' : 'Ready for deployment'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Check deployment status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    if (!VERCEL_TOKEN) {
      return NextResponse.json({ 
        configured: false,
        message: 'Vercel not configured'
      });
    }

    // Query Vercel API for deployments
    try {
      const response = await fetch(
        `https://api.vercel.com/v6/deployments?app=${slug}&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const latest = data.deployments?.[0];
        
        return NextResponse.json({
          configured: true,
          latest: latest ? {
            uid: latest.uid,
            state: latest.state,
            url: latest.url,
            created: latest.created
          } : null
        });
      }
    } catch (e) {
      // Continue without status
    }

    return NextResponse.json({ 
      configured: true,
      message: 'Status check unavailable'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
