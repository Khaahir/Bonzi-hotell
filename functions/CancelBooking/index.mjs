import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../../service/db.mjs";

const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "BonzaiHotell";

export async function handler(event) {
  const id = event?.pathParameters?.id; // or switch to query if that's your route
  if (!id) return { statusCode: 400, body: JSON.stringify({ message: "Booking ID is required" }) };

  const params = {
    TableName: TABLE_NAME,
    Key: { PK: `BOOKING#${id}`, SK: "METADATA" },
    ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    ReturnValues: "ALL_OLD",
  };

  try {
    const result = await ddb.send(new DeleteCommand(params));
    return { statusCode: 200, body: JSON.stringify({ message: "Booking deleted", booking: result.Attributes ?? null }) };
  } catch (err) {
    console.error("Delete failed", { err, event }); // check CloudWatch
    if (err.name === "ConditionalCheckFailedException") {
      return { statusCode: 404, body: JSON.stringify({ message: "Booking not found" }) };
    }
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
}
