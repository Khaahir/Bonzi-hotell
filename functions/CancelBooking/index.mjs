import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../../service/db.mjs";

const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "BonzaiHotell";

export async function handler(event) {
  const bookingId = event?.pathParameters?.id;

  if (!bookingId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Booking ID is required" }),
    };
  }

  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `BOOKING#${bookingId}`,
      SK: "METADATA",
    },
    UpdateExpression: "SET valid = :false",
    ExpressionAttributeValues: {
      ":false": false,
    },
    ConditionExpression: "attribute_exists(PK)",
    ReturnValues: "ALL_NEW",
  };

  try {
    const result = await ddb.send(new UpdateCommand(params));
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Booking cancelled", booking: result.Attributes }),
    };
  } catch (error) {
    console.error("Cancel booking error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to cancel booking", error: error.message }),
    };
  }
}

