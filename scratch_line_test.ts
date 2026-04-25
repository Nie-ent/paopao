import { handleLineEvent } from "./src/services/line.service";

async function run() {
  console.log("Testing text message processing...");
  try {
     const mockTextEvent = {
        type: "message",
        source: { userId: "mock_user123" },
        message: { type: "text", text: "buy milk 50" },
        replyToken: "dummy_token"
     };
     await handleLineEvent(mockTextEvent);
     console.log("Text message processing complete (check logs if it tried to reply)");
  } catch (err) {
     console.error("Test Text Event failed:", err);
  }
}
run();
