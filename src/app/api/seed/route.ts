import { NextRequest, NextResponse } from 'next/server';
import { seedTestData } from '@/lib/seed-data';

export async function POST(request: NextRequest) {
  try {
    await seedTestData();
    
    return NextResponse.json({
      success: true,
      message: 'Test data seeded successfully!'
    });
  } catch (error) {
    console.error('Seeding failed:', error);
    return NextResponse.json(
      { error: 'Failed to seed test data' },
      { status: 500 }
    );
  }
}