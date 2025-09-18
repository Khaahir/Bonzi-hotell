import { validateBody } from "../../validate/validateBooking.js";
import { TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { client } from "../../service/db.mjs";
import { v4 as uuidv4 } from "uuid";

const respond = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

const TABLE_NAME = "BonzaiHotell";

const price = { single: 500, double: 1000, suite: 1500 };

const roomInventory = { single: 8, double: 8, suite: 4 };

const badRequest = (message) =>
  Object.assign(new Error(message), { statusCode: 400 });

const parseYMD = (s, fieldName = "datum") => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw badRequest(`${fieldName} måste vara i formatet YYYY-MM-DD`);
  }
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const nightsBetween = (checkIn, checkOut) => {
  const ci = parseYMD(checkIn, "checkIn");
  const co = parseYMD(checkOut, "checkOut");
  const ms = co - ci;
  const nights = Math.floor(ms / 86_400_000);
  if (nights <= 0) throw badRequest("checkOut måste vara efter checkin");
  return nights;
};

const dateRangeYMD = (checkIn, checkOut) => {
  const start = parseYMD(checkIn, "checkIn");
  const end = parseYMD(checkOut, "checkOut");
  const days = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
};

const assertRoomTypes = (rooms) => {
  for (const t of rooms) {
    if (!(t in price)) throw badRequest(`okänd rumstyp: "${t}"`);
  }
};

const countByType = (rooms) =>
  rooms.reduce((acc, t) => ((acc[t] = (acc[t] || 0) + 1), acc), {});

const perNightTotalForRooms = (rooms) =>
  rooms.reduce((sum, t) => sum + price[t], 0);

const receipt = (rooms, nights) => {
  const counts = countByType(rooms);
  return Object.entries(counts).map(([type, count]) => ({
    roomType: `${type} x ${count}`,
    unitPrice: price[type],
    nights,
    subtotalPerNight: price[type] * count,
    subtotal: price[type] * count * nights,
  }));
};

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const validate = validateBody(body);
    if (!validate.ok)
      return respond(validate.statusCode, { message: validate.message });

    const { guests, rooms, customer, checkIn, checkOut } = body;

    if (!Array.isArray(rooms) || rooms.length === 0) {
      throw badRequest("Minst ett rum måste väljas");
    }
    assertRoomTypes(rooms);

    const nights = nightsBetween(checkIn, checkOut);
    const dates = dateRangeYMD(checkIn, checkOut);
    const counts = countByType(rooms);
    const distinctTypes = Object.keys(counts);

    // DynamoDB TransactWrite: max 25 operations , fattar inte detta riktigt
    const estimatedOps = dates.length * distinctTypes.length + 2;
    if (estimatedOps > 25) {
      throw badRequest(
        `Bokningen går över för många datum för en transaktion (${estimatedOps} > 25).` +
          `Dela upp bokningen`
      );
    }

    const perNightTotal = perNightTotalForRooms(rooms);
    const totalPrice = perNightTotal * nights;

    const id = uuidv4();

    const now = new Date().toISOString();

    const bookingItem = {
      PK: { S: `BOOKING#${id}` },
      SK: { S: "METADATA" },
      entityType: { S: "BOOKING" },
      id: { S: id },
      createdAt: { S: now },
      guests: { N: String(guests) },
      rooms: { L: rooms.map((r) => ({ S: r })) },
      checkIn: { S: checkIn },
      checkOut: { S: checkOut },
      nights: { N: String(nights) },
      perNightTotal: { N: String(perNightTotal) },
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
      nights: { N: String(nights) },
      totalPrice: { N: String(totalPrice) },
    };

    const transactItems = [];

    for (const date of dates) {
      for (const type of distinctTypes) {
        const inc = counts[type];
        transactItems.push({
          Update: {
            TableName: TABLE_NAME,
            Key: {
              PK: { S: `INV#${type}#${date}` },
              SK: { S: "INVENTORY" },
            },

            UpdateExpression:
              "ADD booked :c " +
              "SET capacity = if_not_exists(capacity, :cap), " +
              "roomType = if_not_exists(roomType, :rt), " +
              "date = if_not_exists(date, :dt), " +
              "entityType = if_not_exists(entityType, :et)",
            ConditionExpression: "if_not_exists(booked, :zero) + :c <= :cap",
            ExpressionAttributeValues: {
              ":c": { N: String(inc) },
              ":cap": { N: String(roomInventory[type]) },
              ":zero": { N: "0" },
              ":rt": { S: type },
              ":dt": { S: date },
              ":et": { S: "INVENTORY" },
            },
          },
        });
      }
    }

    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: bookingItem,
        ConditionExpression: "attribute_not_exists(PK)",
      },
    });
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: indexItem,
      },
    });

    await client.send(
      new TransactWriteItemsCommand({
        TransactItems: transactItems,
        ReturnCancellationReasons: true,
      })
    );

    return respond(201, {
      id,
      createdAt: now,
      guests,
      customer,
      checkIn,
      checkOut,
      rooms,
      nights,
      confirmation: {
        currency: "SEK",
        perNightTotal,
        items: receipt(rooms, nights),
        total: totalPrice,
      },
    });
  } catch (err) {
    console.error("Addroom error:", err);
    const code = err.statusCode || err.$metadata?.httpStatusCode || 500;

    if (err.name === "TransactionCanceledException") {
      return respond(409, {
        message:
          "En eller flera nätter är fullbokade för vald(a) rumstyp(er). välj annat datum eller färre rum",
      });
    }
    return respond(code, { message: err.message || "internal error" });
  }
};
