import { messagingApi } from '@line/bot-sdk';

export const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "test_token",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "test_secret",
};

// MessagingApiClient is used to send messages back to the user
export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
});

// MessagingApiBlobClient is used to download image binary data (slips)
export const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: lineConfig.channelAccessToken,
});

