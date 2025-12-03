import { NextResponse } from 'next/server';

// Admin configuration - only this email can access admin panel
const ALLOWED_ADMIN_EMAILS = [
  'contact@usenareo.com',
];

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    // Get admin code from environment variable
    const adminCode = process.env.ADMIN_SECRET_CODE;

    if (!adminCode) {
      console.error('ADMIN_SECRET_CODE not configured in environment');
      return NextResponse.json(
        { error: 'Admin access not configured' },
        { status: 500 }
      );
    }

    // Verify email is in allowed list
    if (!email || !ALLOWED_ADMIN_EMAILS.includes(email.toLowerCase())) {
      console.warn(`Unauthorized admin access attempt from: ${email}`);
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify code
    if (!code || code !== adminCode) {
      console.warn(`Invalid admin code attempt from: ${email}`);
      return NextResponse.json(
        { error: 'Invalid admin code' },
        { status: 401 }
      );
    }

    // Success - generate session expiry (8 hours)
    const expiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    console.log(`Admin access granted to: ${email}`);

    return NextResponse.json({
      success: true,
      expiry,
    });
  } catch (error) {
    console.error('Admin verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
