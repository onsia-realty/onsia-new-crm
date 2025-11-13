import { prisma } from '../lib/prisma';

async function checkDuplicateLogs() {
  try {
    // Check for duplicate call logs with "관심없음"
    const logs = await prisma.callLog.findMany({
      where: {
        content: {
          contains: '관심없음'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    console.log('\n=== Call Logs with "관심없음" ===\n');

    if (logs.length === 0) {
      console.log('No logs found with "관심없음"');
      return;
    }

    logs.forEach(log => {
      console.log(`ID: ${log.id}`);
      console.log(`Customer: ${log.customer?.name || 'N/A'} (${log.customerId})`);
      console.log(`Author: ${log.user?.name || 'Unknown'} (${log.userId})`);
      console.log(`Content: ${log.content}`);
      console.log(`Created: ${log.createdAt}`);
      console.log('---');
    });

    // Check for exact duplicates
    console.log('\n=== Checking for Duplicates ===\n');

    const duplicateCheck = await prisma.callLog.groupBy({
      by: ['customerId', 'userId', 'content'],
      having: {
        customerId: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        id: true
      }
    });

    if (duplicateCheck.length > 0) {
      console.log('Found potential duplicates:');
      duplicateCheck.forEach(dup => {
        console.log(`Customer: ${dup.customerId}, User: ${dup.userId}, Content: ${dup.content}, Count: ${dup._count.id}`);
      });
    } else {
      console.log('No exact duplicates found in database');
    }

    // Check specifically for 박찬효
    const parkLogs = logs.filter(log => log.user.name.includes('박찬효'));
    if (parkLogs.length > 0) {
      console.log('\n=== Logs by 박찬효 ===\n');
      parkLogs.forEach(log => {
        console.log(`${log.customer.name}: "${log.content}" at ${log.createdAt}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateLogs();
