/**
 * Guided tours ("สอนใช้งาน"). Each tour lives on one page and points at elements marked with
 * data-tour="…"; a step without `element` shows in the middle of the screen (used for things that
 * happen in LINE). People pick which tours to take from the help menu (src/components/tour).
 */

type Text = { th: string; en: string }
export type TourStep = { element?: string; title: Text; body: Text }
export type Tour = { id: string; path: string; icon: string; title: Text; summary: Text; steps: TourStep[] }

const at = (name: string) => `[data-tour="${name}"]`

export const TOURS: Tour[] = [
  {
    id: "overview",
    path: "/",
    icon: "🏠",
    title: { th: "หน้าแรก", en: "Home" },
    summary: { th: "ดูยอดเงิน เปลี่ยนช่วงเวลา และกราฟย่อ", en: "Your balance, periods and chart tiles" },
    steps: [
      { element: at("balance"), title: { th: "ยอดคงเหลือ", en: "What's left" }, body: { th: "รายรับลบรายจ่ายของช่วงที่เลือก พร้อมลูกศรบอกว่าเพิ่มหรือลดจากเดือนก่อน", en: "Income minus spending for the period, with arrows showing the change from last month" } },
      { element: at("period"), title: { th: "เปลี่ยนช่วงเวลา", en: "Change the period" }, body: { th: "ดูรายเดือน รายปี หรือทั้งหมด และเลือกเดือนที่ต้องการได้", en: "Switch between month, year and all time, and pick a month" } },
      { element: at("actions"), title: { th: "ปุ่มลัด", en: "Shortcuts" }, body: { th: "เพิ่มรายการ ค่าใช้จ่ายคงที่ เป้าหมาย แชท AI และชวนเพื่อน แตะเดียวถึง", en: "Add an entry, fixed costs, goals, AI chat and invites, one tap away" } },
      { element: at("tiles"), title: { th: "กราฟย่อ", en: "Chart tiles" }, body: { th: "แตะการ์ดไหนก็ได้เพื่อดูกราฟเต็มและรายการทุกหมวด", en: "Tap any tile for the full chart and every category" } },
      { element: at("insight"), title: { th: "PaoPao วิเคราะห์", en: "PaoPao's analysis" }, body: { th: "กดวิเคราะห์เดือนนี้ครั้งเดียว ผลจะเก็บไว้ แตะ \"ดูการวิเคราะห์เต็ม\" เพื่ออ่านรายงานทั้งหมด", en: "Analyse the month once and it's saved. Tap \"read the full analysis\" for the whole report" } },
    ],
  },
  {
    id: "line",
    path: "/",
    icon: "💬",
    title: { th: "จดผ่าน LINE", en: "Logging in LINE" },
    summary: { th: "พิมพ์ ส่งสลิป และขอสรุปในแชท", en: "Typing, slips and summaries in the chat" },
    steps: [
      { title: { th: "พิมพ์เหมือนคุยกับเพื่อน", en: "Type like texting a friend" }, body: { th: "ในแชท LINE @401xmdoq พิมพ์ \"กาแฟ 65\" หรือหลายรายการในข้อความเดียว เช่น \"ข้าว 50 ชาไทย 35\"", en: "In the LINE chat @401xmdoq, type \"coffee 65\", or several at once like \"rice 50 tea 35\"" } },
      { title: { th: "ตรวจก่อนบันทึก", en: "Check, then save" }, body: { th: "เป๋าเป๋าส่งการ์ดให้ตรวจ แก้ยอด แก้หมวด หรือสลับรายรับ/รายจ่ายได้ แล้วกดยืนยัน", en: "PaoPao sends a card: fix the amount or category, or switch income/expense, then confirm" } },
      { title: { th: "ส่งรูปสลิป (Pro)", en: "Send a slip (Pro)" }, body: { th: "ส่งรูปสลิปโอนเงิน เป๋าเป๋าอ่านยอดให้ และไม่บันทึกสลิปเดิมซ้ำ", en: "Send a transfer slip: PaoPao reads it and never saves the same slip twice" } },
      { title: { th: "ขอสรุป", en: "Ask for a summary" }, body: { th: "พิมพ์ \"สรุป\" แล้วเลือกวันนี้ เดือนนี้ หรือปีนี้", en: "Type \"summary\" and pick today, this month or this year" } },
    ],
  },
  {
    id: "transactions",
    path: "/transactions",
    icon: "📒",
    title: { th: "รายการทั้งหมด", en: "Transactions" },
    summary: { th: "เพิ่ม นำเข้า statement และส่งออก Excel", en: "Add, import statements, export to Excel" },
    steps: [
      { element: at("tx-add"), title: { th: "เพิ่มรายการเอง", en: "Add one yourself" }, body: { th: "บันทึกรายการบนเว็บได้ด้วย เลือกวันที่และหมวดได้", en: "Log entries on the web too, with any date and category" } },
      { element: at("tx-import"), title: { th: "นำเข้า statement (Pro)", en: "Import a statement (Pro)" }, body: { th: "อัปโหลด PDF Excel หรือภาพหน้าจอจากแอปธนาคาร ระบบตรวจรายการซ้ำให้ก่อนบันทึก", en: "Upload a bank PDF, Excel or screenshot; duplicates are flagged before saving" } },
      { element: at("tx-export"), title: { th: "ส่งออก Excel", en: "Export to Excel" }, body: { th: "ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ Excel ได้ทุกแพ็กเกจ", en: "Download everything as an Excel file, on any plan" } },
    ],
  },
  {
    id: "bills",
    path: "/bills",
    icon: "🧾",
    title: { th: "ค่าใช้จ่ายคงที่", en: "Fixed costs" },
    summary: { th: "รู้ว่าเงินรั่วตรงไหน และให้เป๋าเป๋าถามบิลให้", en: "Find leaks and let PaoPao ask about bills" },
    steps: [
      { element: at("bills-summary"), title: { th: "ภาพรวมค่าใช้จ่ายคงที่", en: "Your fixed costs" }, body: { th: "ดูว่าค่าใช้จ่ายทุกเดือนกินรายรับกี่เปอร์เซ็นต์ และเหลือเงินใช้เท่าไหร่", en: "How much of your income goes to monthly costs, and what's left to spend" } },
      { element: at("bills-add"), title: { th: "เพิ่มบิลประจำ", en: "Add a recurring bill" }, body: { th: "ตั้งค่าเช่า ค่าไฟ ค่าเน็ตไว้ ถึงรอบเป๋าเป๋าจะถามใน LINE (Pro) แตะเดียวก็บันทึก", en: "Set rent, power or internet once; PaoPao asks in LINE when it's due (Pro)" } },
    ],
  },
  {
    id: "goals",
    path: "/goals",
    icon: "🎯",
    title: { th: "เป้าหมาย", en: "Goals" },
    summary: { th: "ตั้งเป้าเก็บเงินหรือปลดหนี้ที่อัปเดตเอง", en: "Savings or payoff goals that update themselves" },
    steps: [
      { element: at("goals-add"), title: { th: "สร้างเป้าหมาย", en: "Create a goal" }, body: { th: "ตั้งยอดเป้าหมายและผูกกับหมวด เช่น \"ชำระหนี้\" ความคืบหน้าจะขึ้นเองเมื่อจดรายการ", en: "Set a target and link a category, e.g. \"Debt Payment\"; progress fills as you log" } },
    ],
  },
  {
    id: "group",
    path: "/",
    icon: "👥",
    title: { th: "แยกบิลในกลุ่ม LINE", en: "Split bills in LINE groups" },
    summary: { th: "เชิญเข้ากลุ่ม ถ่ายใบเสร็จ และทวงเงิน", en: "Invite, snap the receipt, chase payments" },
    steps: [
      { title: { th: "เชิญเป๋าเป๋าเข้ากลุ่ม", en: "Invite PaoPao to a group" }, body: { th: "เพิ่ม @401xmdoq เข้ากลุ่มเพื่อนหรือที่ทำงาน เป๋าเป๋าไม่อ่านแชทอื่นในกลุ่ม", en: "Add @401xmdoq to a group; PaoPao ignores other chat" } },
      { title: { th: "พิมพ์ \"แยกบิล\"", en: "Type \"แยกบิล\"" }, body: { th: "กดถ่ายรูปใบเสร็จจากการ์ด เป๋าเป๋าแยกรายการให้ ไม่มีใบเสร็จพิมพ์ \"แยกบิล 1200 ค่าห้อง\"", en: "Snap the receipt from the card and PaoPao lists the items. No receipt? \"แยกบิล 1200 rent\"" } },
      { title: { th: "ทุกคนติ๊กของตัวเอง", en: "Everyone ticks theirs" }, body: { th: "กดการ์ดแล้วเลือกรายการ รายการหลายชิ้นกด + จำนวนของตัวเอง ยอดรวมตรงใบเสร็จเสมอ", en: "Open the card and tick items; tap + for shared dishes. Totals always match the receipt" } },
      { title: { th: "จ่ายและทวง", en: "Pay and chase" }, body: { th: "เพื่อนสแกน QR ที่มียอดแล้ว ส่งสลิปในกลุ่มก็ปิดยอดอัตโนมัติ พิมพ์ \"ยอดค้าง\" เพื่อดูหรือทวงทุกคน", en: "Friends scan a QR with their amount and send the slip to settle. Type \"ยอดค้าง\" to see or chase" } },
    ],
  },
]

export const TOUR_UI = {
  menuTitle: { th: "สอนใช้งานแบบทีละขั้น", en: "Step-by-step guides" },
  menuLead: { th: "เลือกสิ่งที่อยากเรียนรู้ เป๋าเป๋าจะพาไปดูทีละจุด", en: "Pick what you'd like to learn and PaoPao walks you through it" },
  start: { th: "เริ่ม", en: "Start" },
  again: { th: "ดูอีกครั้ง", en: "Again" },
  done: { th: "เรียนแล้ว", en: "Done" },
  next: { th: "ถัดไป", en: "Next" },
  prev: { th: "ย้อนกลับ", en: "Back" },
  finish: { th: "เข้าใจแล้ว", en: "Got it" },
  help: { th: "สอนใช้งาน", en: "Guides" },
  welcomeTitle: { th: "ใหม่กับเป๋าเป๋าใช่ไหม?", en: "New to PaoPao?" },
  welcomeBody: { th: "ให้เป๋าเป๋าพาดูหน้าแรกสัก 30 วินาทีไหม เลือกเรียนฟีเจอร์อื่นได้ทีหลังที่ปุ่ม ? ด้านบน", en: "Take a 30-second tour of the home screen? Other guides are under the ? button at the top" },
  welcomeYes: { th: "พาดูเลย", en: "Show me" },
  welcomeLater: { th: "ไว้ทีหลัง", en: "Later" },
}
