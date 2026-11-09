import { describe, expect, it } from "vitest";
import { paoPaoRichMenu, RICH_MENU_SIZE } from "./rich-menu";

describe("PaoPao rich menu", () => {
  it("covers the full image with the six requested actions", () => {
    const menu = paoPaoRichMenu("1234567890-AbCdEf");

    expect(menu.size).toEqual(RICH_MENU_SIZE);
    expect(menu.areas).toHaveLength(6);
    expect(menu.areas?.map(area => area.action?.type)).toEqual([
      "message", "message", "uri", "uri", "uri", "uri",
    ]);
    expect(menu.areas?.[0].action).toMatchObject({ type: "message", text: "สรุป" });
    expect(menu.areas?.[1].action).toMatchObject({ type: "message", text: "ส่งสลิป" });
    expect(menu.areas?.[2].action).toMatchObject({ uri: "https://liff.line.me/1234567890-AbCdEf" });
    expect(menu.areas?.[3].action).toMatchObject({ uri: "https://liff.line.me/1234567890-AbCdEf/bills" });
    expect(menu.areas?.[4].action).toMatchObject({ uri: "https://liff.line.me/1234567890-AbCdEf/goals" });
    expect(menu.areas?.[5].action).toMatchObject({ uri: "https://liff.line.me/1234567890-AbCdEf/subscription" });

    const totalArea = menu.areas?.reduce((sum, area) => sum + (area.bounds?.width ?? 0) * (area.bounds?.height ?? 0), 0);
    expect(totalArea).toBe(RICH_MENU_SIZE.width * RICH_MENU_SIZE.height);
  });
});
