import { prisma } from '../lib/prisma';

async function testCallLogsAPI() {
  try {
    // Get the customer ID that has "관심없음" log
    const customer = await prisma.customer.findFirst({
      where: {
        callLogs: {
          some: {
            content: {
              contains: '관심없음'
            }
          }
        }
      },
      include: {
        callLogs: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!customer) {
      console.log('No customer found with "관심없음" log');
      return;
    }

    console.log('\n=== Customer Info ===');
    console.log(`ID: ${customer.id}`);
    console.log(`Name: ${customer.name}`);
    console.log(`\n=== Call Logs (${customer.callLogs.length} total) ===\n`);

    customer.callLogs.forEach((log, index) => {
      console.log(`${index + 1}. ID: ${log.id}`);
      console.log(`   Author: ${log.user.name} (${log.userId})`);
      console.log(`   Content: ${log.content}`);
      console.log(`   Created: ${log.createdAt}`);
      console.log('');
    });

    // Check for duplicate IDs
    const logIds = customer.callLogs.map(log => log.id);
    const uniqueLogIds = new Set(logIds);

    if (logIds.length !== uniqueLogIds.size) {
      console.log('⚠️  WARNING: Duplicate log IDs detected!');
      console.log(`Total logs: ${logIds.length}, Unique IDs: ${uniqueLogIds.size}`);
    } else {
      console.log('✅ All log IDs are unique');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCallLogsAPI();
