import { validateBody } from "../../validate/validateBooking.js";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { client } from "../../service/db.mjs";
import { v4 as uuidv4 } from "uuid"


const TABLE_NAME = "BonzaiHotell";

const price = { single: 500, double: 1000, suite: 1500 };

const respond = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

const calcTotalPrice = (rooms) =>
  rooms.reduce((acc, type) => acc + price[type], 0);

const receipt = (rooms) => {
  const counts = rooms.reduce((acc, room) => {
    acc[room] = (acc[room] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([type, count]) => {
    const unitPrice = price[type];
    return {
      roomType: `${type} × ${count}`,
      unitPrice,
      subtotal: unitPrice * count,
    };
  });
};

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const validate = validateBody(body);
    if (!validate.ok)
      return respond(validate.statusCode, { message: validate.message });

    const { guests, rooms, customer, checkIn, checkOut } = body;
    const id = uuidv4()
    const totalPrice = calcTotalPrice(rooms);
    const now = new Date().toISOString();
    const createdDate = now.slice(0, 10);
  

    const bookingItem = {
      PK: { S: `BOOKING#${id}` },
      SK: { S: "METADATA" },
      entityType: { S: "BOOKING" },
      id: { S: id },
      createdAt: { S: createdDate },
      guests: { N: String(guests) },
      rooms: { L: rooms.map((r) => ({ S: r })) },
      checkIn: { S: checkIn },
      checkOut: { S: checkOut},
      totalPrice: { N: String(totalPrice) },
      ...(customer && {
        customer: {
          M: Object.fromEntries(
            Object.entries(customer).map(([k, v]) => [k, { S: String(v) }])
          ),
        },
      }),
    };

    const indexItem = {
      PK: { S: "BOOKING#INDEX" },
      SK: { S: `BOOKING#${id}` },
      entityType: { S: "BOOKING_INDEX" },
      id: { S: id },
      createdAt: { S: now },
      guests: { N: String(guests) },
      checkIn: { S: checkIn },
      checkOut: { S: checkOut },
      totalPrice: { N: String(totalPrice) },
    };

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: bookingItem,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: indexItem,
      })
    );

    return respond(201, {
      id,
      createdAt: now,
      guests,
      rooms,
      customer,
      checkIn,
      checkOut,
      confirmation: {
        currency: "SEK",
        items: receipt(rooms),
        total: totalPrice,
      },
    });
  } catch (err) {
    console.error("AddRoom error:", err);
    return respond(err.statusCode || 500, {
      message: err.message || "internal error",
    });
  }
};
