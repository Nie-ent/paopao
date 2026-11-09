import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { messagingApi } from "@line/bot-sdk";

const width = 2500;
const height = 1686;
const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!token) {
  throw new Error("LINE_CHANNEL_ACCESS_TOKEN is required to publish the rich menu.");
}

const liffUrl = (path) => liffId
  ? `https://liff.line.me/${liffId}${path}`
  : `https://www.paopao-wallet.com${path}`;

const richMenu = {
  size: { width, height },
  selected: true,
  name: "PaoPao primary menu",
  chatBarText: "เมนูเป๋าเป๋า",
  areas: [
    { bounds: { x: 0, y: 0, width: 834, height: 843 }, action: { type: "message", text: "สรุป" } },
    // LINE permits camera actions only on quick replies. The webhook turns this
    // message into camera and camera-roll quick-reply buttons.
    { bounds: { x: 834, y: 0, width: 833, height: 843 }, action: { type: "message", text: "ส่งสลิป" } },
    { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: "uri", uri: liffUrl("") } },
    { bounds: { x: 0, y: 843, width: 834, height: 843 }, action: { type: "uri", uri: liffUrl("/bills") } },
    { bounds: { x: 834, y: 843, width: 833, height: 843 }, action: { type: "uri", uri: liffUrl("/goals") } },
    { bounds: { x: 1667, y: 843, width: 833, height: 843 }, action: { type: "uri", uri: liffUrl("/subscription") } },
  ],
};

const imagePath = resolve("public/line/rich-menu.png");
const image = await readFile(imagePath);
const client = new messagingApi.MessagingApiClient({ channelAccessToken: token });
const { richMenuId } = await client.createRichMenu(richMenu);

try {
  await client.setRichMenuImage(richMenuId, new Blob([image], { type: "image/png" }));
  await client.setDefaultRichMenu(richMenuId);
  console.log(`Published PaoPao rich menu: ${richMenuId}`);
} catch (error) {
  // Avoid leaving an unusable menu behind when its image cannot be attached.
  await client.deleteRichMenu(richMenuId).catch(() => undefined);
  throw error;
}
