import { v4 as uuid } from "uuid";
import { validateBody } from "../../validate/validateBooking";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb"

const client = new DynamoDBClient({});


const TABLE_NAME = process.env.BOOKINGS_TABLE;

const price = { single: 500, double: 1000, suite: 1500 };

const respond = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

const calcTotalPrice = (rooms) =>
  rooms.reduce((sum, type) => sum + price[type], 0);

// Kvitto
const receipt = (rooms) => {
  const counts = rooms.reduce((acc, room) => {
    acc[room] = (acc[room] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([type, count]) => {
    const unitPrice = price[type];
    return {
      label: `${type} × ${count}`,
      unitPrice,
      subtotal: unitPrice * count,
    };
  });
};


export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const validate = validateBody(body)
    if(!validate.ok) return respond(validate.statusCode, { message: validate.message })

    const  { guests, rooms, customer } = body

    const totalPrice = calcTotalPrice(rooms);

    const id = uuid();
    const now = new Date().toISOString();

  const bookingItem = {
      PK: { S: `BOOKING#${id}` },
      SK: { S: `BOOKING#${id}` },
      entityType: { S: "BOOKING" },
      id: { S: id },
      createdAt: { S: now },
      guests: { N: String(guests) },
      rooms: { L: rooms.map((r) => ({ S: r })) },
      totalPrice: { N: String(totalPrice) },
      ...(customer && {
  customer: {
    M: Object.fromEntries(
      Object.entries(customer).map(([k, v]) => [k, { S: String(v) }])
    )
  }
})
  }
   
    const indexItem = {
        PK: { S: "BOOKING#INDEX" },
        SK: { S: `BOOKING#${id}` },
        entityType: { S: "BOOKING_INDEX" },
        id: { S: id },
        createdAt: { S: now },
        guests: { N: String(guests) },
        totalPrice: { N: String(totalPrice)}
    }

    await client.send(new PutItemCommand({
        tableName: TABLE_NAME,
        Item: bookingItem,
        ConditionExpression: "attribute_not_exists(PK)"
    }))
    
    await client.send(new PutItemCommand({
        tableName: TABLE_NAME,
        Item: indexItem
    }))

    return respond(201,{
    id,
    createdAt: now,
    guests: body.guests,
    rooms,
    totalPrice,
    customer: body.customer,
    confirmation: {
        currency: "SEK",
        items: receipt(rooms),
        total: totalPrice
    }
        })

  } catch (err) {
    return respond(err.statusCode || 500, { message: err.message || "internt feö" })
  }
};
