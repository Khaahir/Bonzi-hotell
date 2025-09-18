/// namn i databasen för rymstyp "single, double, suite" ist för roomid ?

// idt blir room#single ? room#double osv ? 


const CAPACITY = { single: 1, double: 2, suite: 3 };
const ALLOWED_ROOM_TYPES = new Set(Object.keys(CAPACITY));
const ROOM_LIMIT = 20

export const validateBody = (request) => {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return {
      statusCode: 400,
      message: "Body måste vara ett JSON-object",
    };
  }
  
  const { guests, rooms, customer, checkIn, checkOut } = request;

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

  if(rooms.length > ROOM_LIMIT) {
    return {
        ok:false,
        statusCode:400,
        message:`Du kan max boka ${ROOM_LIMIT} rum`
    }
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
  if (totalBeds < guests) {
    return {
      statusCode: 400,
      message: `Bäddar (${totalBeds}) matchar inte antal gäster (${guests}).`,
    };
  }

  if (
    !customer ||
    typeof customer !== "object" ||
    typeof customer.name !== "string" ||
    typeof customer.email !== "string"
  ) {
    return {
        statusCode: 400,
        message: "Customer måste innehålla name och email as string"
    }
  }

  const checkInDate = new Date(checkIn)
  const checkoutDate = new Date(checkOut)

  if (isNaN(checkInDate.getTime()) || isNaN(checkoutDate.getTime())) {
    return {
        statusCode: 400,
        message: "checkIn och checkOut måste vara giltiga datumsträngar"
    }
  }
  
  if (typeof checkIn !== "string" || typeof checkOut !== "string") {
  return {
    statusCode: 400,
    message: "checkIn och checkOut måste vara datumsträngar",
  };
}

  if (checkoutDate <= checkInDate) {
    return {
        statusCode: 400,
        message: "checkOut måste vara efter checkIn"
    }
  }
  return {
    ok: true,
    statusCode: 200,
    message: "Bokning lyckades",
  };
};
