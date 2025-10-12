import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// CallLog model not implemented yet - returning stub
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return empty array until CallLog model is implemented
    return NextResponse.json([]);
  } catch (error) {
    console.error('Failed to fetch call logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CallLog feature not implemented yet
    return NextResponse.json(
      { error: 'CallLog feature not implemented' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Failed to create call log:', error);
    return NextResponse.json(
      { error: 'Failed to create call log' },
      { status: 500 }
    );
  }
}
