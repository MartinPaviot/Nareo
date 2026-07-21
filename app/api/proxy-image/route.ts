/**
 * API proxy pour charger les images Supabase et contourner CORS
 *
 * Usage: /api/proxy-image?url=https://supabase.co/storage/...
 */

import { NextRequest, NextResponse } from 'next/server';

// Host of the project's own Supabase instance, derived from the public URL.
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();

/**
 * Only allow https URLs whose *hostname* (parsed, not a substring of the raw
 * string) is exactly this project's Supabase host. This closes the SSRF where a
 * raw substring check let `https://attacker.com/?x=supabase.co` through, and it
 * deliberately does NOT allow arbitrary `*.supabase.co` tenants — anyone can
 * create a free Supabase project and use it as an SSRF redirect origin.
 */
function isAllowedImageUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return !!SUPABASE_HOST && parsed.hostname.toLowerCase() === SUPABASE_HOST;
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Only proxy Supabase-hosted https URLs — validated on the parsed hostname.
    if (!isAllowedImageUrl(url)) {
      return NextResponse.json(
        { error: 'Only Supabase image URLs are allowed' },
        { status: 403 }
      );
    }

    // Télécharger l'image depuis Supabase (côté serveur, pas de CORS).
    // redirect: 'manual' so a 3xx cannot bounce the request to an internal
    // address — only the validated host is ever actually fetched. Supabase
    // storage URLs return the bytes directly (200), so this is transparent.
    const response = await fetch(url, { redirect: 'manual' });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status || 502 }
      );
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Renvoyer l'image avec les headers CORS corrects
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error: any) {
    console.error('[Proxy Image] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}

// Support preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
