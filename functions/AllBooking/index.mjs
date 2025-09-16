// functions/AllBooking/index.mjs
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../../service/db.mjs";

const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;

const ROOM_CAPACITY = { single: 1, double: 2, suite: 3 };

const respond = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// Validate capacity using rooms array from booking item
function normalizeAndValidate(booking) {
  const rooms = Array.isArray(booking.rooms) ? booking.rooms : [];
  const guests =
    typeof booking.guests === "number" ? booking.guests : Number(booking.guests);

  const totalCapacity = rooms.reduce(
    (sum, type) => sum + (ROOM_CAPACITY[type] || 0),
    0
  );

  return {
    ...booking,
    totalCapacity,
    valid: Number.isFinite(guests) && totalCapacity === guests,
  };
}

// GET /see → list all bookings
export const getAllBookings = async () => {
  try {
    const out = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        // filter on the actual field you save: entityType = "BOOKING"
        FilterExpression: "#et = :t",
        ExpressionAttributeNames: { "#et": "entityType" },
        ExpressionAttributeValues: { ":t": "BOOKING" },
      })
    );

    const items = (out.Items || []).map(normalizeAndValidate);
    return respond(200, { count: items.length, items });
  } catch (err) {
    console.error("getAllBookings error:", err);
    return respond(500, { message: err.message || "internal error" });
  }
};

// (Optional) GET /bookings/{id} if you add such a route later
export const getBookingById = async (event) => {
  try {
    const id = event?.pathParameters?.id;
    if (!id) return respond(400, { message: "Missing path param: id" });

    const out = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `BOOKING#${id}`, SK: "METADATA" },
      })
    );

    if (!out.Item) return respond(404, { message: `Booking ${id} not found` });

    return respond(200, normalizeAndValidate(out.Item));
  } catch (err) {
    console.error("getBookingById error:", err);
    return respond(500, { message: err.message || "internal error" });
  }
};
