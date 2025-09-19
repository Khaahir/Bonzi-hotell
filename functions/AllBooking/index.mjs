import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../../service/db.mjs";

const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "BonzaiHotell";

const ROOM_CAPACITY = { single: 1, double: 2, suite: 3 };

const respond = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

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
    RooomFull: Number.isFinite(guests) && totalCapacity === guests,
  };
}

// GET /see → list all bookings
export const getAllBookings = async () => {
  try {
    const out = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#et = :t",
        ExpressionAttributeNames: { "#et": "entityType" },
        ExpressionAttributeValues: { ":t": "BOOKING" },
      })
    );

    const items = (out.Items || []).map(normalizeAndValidate);
// Först räkna rumstyper och total
    const roomCounts = {};
    let totalRoomsBooked = 0;

    items.forEach((booking) => {
      booking.rooms.forEach((roomType) => {
        roomCounts[roomType] = (roomCounts[roomType] || 0) + 1;
        totalRoomsBooked += 1;
      });
    });
// roomStats med totalRoomsBooked
    const roomStats = {
      ...roomCounts,
      totalRoomsBooked, 
    };

    return respond(200, {
      count: items.length,
      roomStats,
      items,
    });
  } catch (err) {
    console.error("getAllBookings error:", err);
    return respond(500, { message: err.message || "internal error" });
  }
};




























