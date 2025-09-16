const CAPACITY = { single: 1, double: 2, suite: 3 };
const ALLOWED_ROOM_TYPES = new Set(Object.keys(CAPACITY));

export const validateBody = (request) => {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return {
      statusCode: 400,
      message: "Body måste vara ett JSON-object",
    };
  }
  const { guests, rooms, customer } = request;

  if (!Number.isInteger(guests) || guests < 1) {
    return {
      statusCode: 400,
      message: "guests måste vara ett heltal",
    };
  }
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return {
      statusCode: 400,
      message: "rooms måste fyllas i!",
    };
  }

  for (const roomType of rooms) {
    if (typeof roomType !== "string") {
      return {
        statusCode: 400,
        message: "rooms måste vara en sträng",
      };
    }
    if (!ALLOWED_ROOM_TYPES.has(roomType)) {
      return {
        statusCode: 400,
        message: `Ogiltig rumstyp: ${roomType}. tillåtna: single, double, suite.`,
      };
    }
  }
  const totalBeds = rooms.reduce(
    (sum, roomType) => sum + CAPACITY[roomType],
    0
  );
  if (totalBeds !== guests) {
    return {
      statusCode: 400,
      message: `Bäddar (${totalBeds}) matchar inte antal gäster (${guests}).`,
    };
  }
  return {
    ok: true,
    statusCode: 200,
    message: "Bokning lyckades",
  };
};
