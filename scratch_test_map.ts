import * as assert from "assert";

let isProcessing = false;
async function mockHandleLineEvent(id: string) {
    console.log("start", id);
    // mimic wait
    await new Promise(r => setTimeout(r, 2500));
    console.log("awake", id);
    if (isProcessing) return null;
    isProcessing = true;
    console.log("processing", id);
    return "done";
}

async function test() {
   const p1 = mockHandleLineEvent("1");
   await new Promise(r => setTimeout(r, 500));
   const p2 = mockHandleLineEvent("2");
   
   await Promise.all([p1, p2]);
}
test();
