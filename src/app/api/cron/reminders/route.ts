import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { lineClient } from "@/config/line";
import { isAuthorizedCron } from "@/lib/cron-auth";

// This endpoint is triggered by Vercel Cron every morning at 7:00 AM BKK (0 0 * * *)
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const bkkTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);

    // Start of TODAY BKK (00:00:00)
    const todayStartBkk = new Date(Date.UTC(bkkTime.getUTCFullYear(), bkkTime.getUTCMonth(), bkkTime.getUTCDate(), 0, 0, 0, 0));
    // End of TODAY BKK (23:59:59)
    const todayEndBkk = new Date(Date.UTC(bkkTime.getUTCFullYear(), bkkTime.getUTCMonth(), bkkTime.getUTCDate(), 23, 59, 59, 999));

    // YESTERDAY BKK
    const yesterdayStartBkk = new Date(todayStartBkk.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEndBkk = new Date(todayEndBkk.getTime() - 24 * 60 * 60 * 1000);

    const startOfTodayUtc = new Date(todayStartBkk.getTime() - 7 * 60 * 60 * 1000);
    const endOfTodayUtc = new Date(todayEndBkk.getTime() - 7 * 60 * 60 * 1000);
    const startOfYesterdayUtc = new Date(yesterdayStartBkk.getTime() - 7 * 60 * 60 * 1000);
    const endOfYesterdayUtc = new Date(yesterdayEndBkk.getTime() - 7 * 60 * 60 * 1000);

    let sentCount = 0;

    // ============================================
    // 1. EVALUATE YESTERDAY'S GOALS (Results)
    // ============================================
    const usersWithExpiredGoals = await prisma.user.findMany({
      where: {
        goals: {
          some: {
            deadline: { gte: startOfYesterdayUtc, lte: endOfYesterdayUtc }
          }
        }
      },
      include: {
        goals: {
          where: {
            deadline: { gte: startOfYesterdayUtc, lte: endOfYesterdayUtc }
          }
        }
      }
    });

    for (const user of usersWithExpiredGoals) {
      if (!user.lineId || user.lineId === "demo" || user.lineId === "demo_line_id") continue;

      const evalContents: any[] = [];

      for (const goal of user.goals) {
        let isSuccess = false;
        let detailsText = "";

        if (goal.type === "FINANCIAL" && goal.trackCategory) {
          // Calculate amount
          const startDate = new Date(goal.createdAt);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);

          const agg = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              userId: user.id,
              category: { name: goal.trackCategory },
              date: { 
                gte: startDate, 
                lte: goal.deadline ? new Date(goal.deadline.getTime() + 24 * 60 * 60 * 1000) : undefined
              }
            }
          });
          const currentAmount = agg._sum.amount || 0;
          isSuccess = currentAmount >= goal.targetAmount;
          detailsText = `ยอด: ฿${currentAmount.toLocaleString()} / ฿${goal.targetAmount.toLocaleString()}`;
          
          if (isSuccess && !goal.isCompleted) {
            await prisma.goal.update({ where: { id: goal.id }, data: { isCompleted: true } });
          }
        } else {
          isSuccess = goal.isCompleted;
          detailsText = isSuccess ? "เสร็จสมบูรณ์" : "ยังไม่เสร็จสิ้น";
        }

        const iconUrl = isSuccess ? "https://cdn-icons-png.flaticon.com/512/190/190411.png" : "https://cdn-icons-png.flaticon.com/512/190/190406.png";
        
        evalContents.push({
          type: "box",
          layout: "horizontal",
          spacing: "md",
          paddingAll: "8px",
          contents: [
            {
              type: "image",
              url: iconUrl,
              size: "xxs",
              flex: 0
            },
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: goal.title,
                  weight: "bold",
                  size: "sm",
                  color: isSuccess ? "#00B900" : "#E2373C",
                  wrap: true
                },
                {
                  type: "text",
                  text: detailsText,
                  size: "xs",
                  color: "#888888"
                }
              ]
            }
          ]
        });
      }

      if (evalContents.length > 0) {
        const evalFlexMessage = {
          type: 'flex',
          altText: 'รายงานผลเป้าหมายที่ครบกำหนด',
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#4A55A2',
              contents: [
                {
                  type: 'text',
                  text: '📊 สรุปผลเป้าหมายเมื่อวาน',
                  weight: 'bold',
                  color: '#ffffff',
                  size: 'md'
                }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '12px',
              spacing: 'sm',
              contents: evalContents
            }
          }
        };

        try {
          await lineClient.pushMessage({
            to: user.lineId,
            messages: [evalFlexMessage as any]
          });
          sentCount++;
        } catch (err) {
          console.error(`Failed to push evaluation to user ${user.id}:`, err);
        }
      }
    }

    // ============================================
    // 2. REMINDERS FOR TODAY'S GOALS
    // ============================================

    const usersWithDueTasks = await prisma.user.findMany({
      where: {
        goals: {
          some: {
            type: 'TODO',
            isCompleted: false,
            deadline: { gte: startOfTodayUtc, lte: endOfTodayUtc }
          }
        }
      },
      include: {
        goals: {
          where: {
            type: 'TODO',
            isCompleted: false,
            deadline: { gte: startOfTodayUtc, lte: endOfTodayUtc }
          },
          orderBy: { deadline: 'asc' }
        }
      }
    });

    if (usersWithDueTasks.length > 0) {
      for (const user of usersWithDueTasks) {
      if (!user.lineId || user.lineId === "demo" || user.lineId === "demo_line_id") continue;

      const flexContents = user.goals.map((task, index) => {
        let timeStr = "ไม่ระบุเวลา";
        if (task.deadline && !isNaN(task.deadline.getTime())) {
          timeStr = task.deadline.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) + ' น.';
        }
        
        return {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '12px',
          cornerRadius: '8px',
          backgroundColor: '#f8f9fa',
          margin: 'md',
          action: {
            type: 'uri',
            label: 'View',
            uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/goals#${task.id}`
          },
          contents: [
            {
              type: 'text',
              text: `[${timeStr}] ${task.title}`,
              weight: 'bold',
              size: 'sm',
              wrap: true,
              color: '#333333'
            },
            ...(task.description ? [{
              type: 'text',
              text: task.description,
              size: 'xs',
              color: '#888888',
              wrap: true
            }] : [])
          ]
        };
      });

      const flexMessage = {
        type: 'flex',
        altText: `แจ้งเตือน ${user.goals.length} รายการที่ต้องทำวันนี้`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#ff7a59',
            contents: [
              {
                type: 'text',
                text: '⏰ รายการที่ต้องทำวันนี้',
                weight: 'bold',
                color: '#ffffff',
                size: 'md'
              }
            ]
          },
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '8px',
            contents: flexContents
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                style: 'link',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: 'เปิดหน้าแดชบอร์ดเป้าหมาย',
                  uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/goals`
                }
              }
            ]
          }
        }
      };

      try {
        await lineClient.pushMessage({
          to: user.lineId,
          messages: [flexMessage as any]
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to push reminder to user ${user.id}:`, err);
      }
    }
    }

    return NextResponse.json({ success: true, count: sentCount }, { status: 200 });

  } catch (error) {
    console.error("Cron Reminder Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
