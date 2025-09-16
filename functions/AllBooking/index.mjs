import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../../service/db.mjs";

const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;
const INDEX_PK = "BOOKING#INDEX"; // detta matchar dina indexItem i AddRoom

export const getAllBookings = async () => {
  try {
    const idx = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": INDEX_PK },
      ProjectionExpression: "SK"
    }));

    if (!idx.Items?.length) {
      return { statusCode: 200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ count: 0, items: [] }) };
    }

    const keys = idx.Items.map(i => ({ PK: i.SK, SK: "METADATA" }));
    const batch = await ddb.send(new BatchGetCommand({
      RequestItems: { [TABLE_NAME]: { Keys: keys } }
    }));

    const items = batch.Responses?.[TABLE_NAME] ?? [];
    return { statusCode: 200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ count: items.length, items }) };
  } catch (err) {
    console.error("getAllBookings error:", err);
    return { statusCode: 500, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: err.message || "internal error" }) };
  }
};
