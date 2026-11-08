import type { messagingApi } from "@line/bot-sdk";

export const RICH_MENU_SIZE = { width: 2500, height: 1686 } as const;

/**
 * Returns the six fixed tap targets for PaoPao's primary LINE rich menu.
 *
 * LINE only permits camera and camera-roll actions on quick replies, not rich
 * menus. Tapping "ส่งสลิป" therefore sends a message which the webhook turns
 * into the two valid camera-picker quick replies. The image upload itself is
 * checked by the webhook, so Free members receive the existing Pro explanation.
 */
export function paoPaoRichMenu(liffId?: string): messagingApi.RichMenuRequest {
  const liffUrl = (path: string) => liffId
    ? `https://liff.line.me/${liffId}${path}`
    : `https://www.paopao-wallet.com${path}`;

  return {
    size: RICH_MENU_SIZE,
    selected: true,
    name: "PaoPao primary menu",
    chatBarText: "เมนูเป๋าเป๋า",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 834, height: 843 },
        action: { type: "message", text: "สรุป" },
      },
      {
        bounds: { x: 834, y: 0, width: 833, height: 843 },
        action: { type: "message", text: "ส่งสลิป" },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: "uri", uri: liffUrl("") },
      },
      {
        bounds: { x: 0, y: 843, width: 834, height: 843 },
        action: { type: "uri", uri: liffUrl("/bills") },
      },
      {
        bounds: { x: 834, y: 843, width: 833, height: 843 },
        action: { type: "uri", uri: liffUrl("/goals") },
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: "uri", uri: liffUrl("/subscription") },
      },
    ],
  };
}
