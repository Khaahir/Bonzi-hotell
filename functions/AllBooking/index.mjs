import { client } from "../../service/db.mjs";
import { ScanCommand, GetCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "Bonzai-BonzaiHotell";

// Helper: Validate booking
async function validateBooking(booking) {
  const roomKeys = booking.RoomIDs.map(id => ({ PK: id, SK: "METADATA" }));

  const roomData = await ddb.send(new BatchGetCommand({
    RequestItems: {
      [TABLE_NAME]: {
        Keys: roomKeys
      }
    }
  }));

  const rooms = roomData.Responses[TABLE_NAME];
  const totalCapacity = rooms.reduce((sum, room) => sum + room.Capacity, 0);

  if (totalCapacity !== booking.GuestCount) {
    throw new Error(`Booking ${booking.PK} is invalid: guest count (${booking.GuestCount}) ≠ room capacity (${totalCapacity})`);
  }

  return { ...booking, Rooms: rooms, valid: true };
}

// Get all bookings
export async function getAllBookings() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "#type = :bookingType",
    ExpressionAttributeNames: { "#type": "Type" },
    ExpressionAttributeValues: { ":bookingType": "Booking" }
  }));

  const bookings = await Promise.all(result.Items.map(async booking => {
    try {
      return await validateBooking(booking);
    } catch (err) {
      return { ...booking, valid: false, error: err.message };
    }
  }));

  return bookings;
}

// Get one booking by ID
export async function getBookingById(id) {
  const result = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `BOOKING#${id}`, SK: "METADATA" }
  }));

  if (!result.Item) throw new Error(`Booking ${id} not found`);

  return await validateBooking(result.Item);
}
