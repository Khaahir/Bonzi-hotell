// +++ Nya rader markerade med kommentarer +++
import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { validateBody } from "../../validate/validateBooking.js";
import { client } from "../../service/db.mjs";

const TABLE_NAME = "BonzaiHotell";
const price = { single: 500, double: 1000, suite: 1500 };

const respond = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

const calcTotalPrice = (rooms) => rooms.reduce((acc, type) => acc + price[type], 0);

const fromAttr = (item) => ({
  id: item?.id?.S,
  guests: item?.guests?.N ? Number(item.guests.N) : undefined,
  rooms: Array.isArray(item?.rooms?.L) ? item.rooms.L.map((x) => x.S) : [],
  // +++
  checkIn: item?.checkIn?.S,
  checkOut: item?.checkOut?.S,
});

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    // +++
    const { id, guests, rooms, customer, checkIn, checkOut } = body;

    if (!id) return respond(400, { message: "Boknings-ID måste anges" });
    if (
      guests === undefined &&
      rooms === undefined &&
      customer === undefined &&
      // +++
      checkIn === undefined &&
      checkOut === undefined
    ) {
      return respond(400, { message: "Inget att uppdatera" });
    }

    const currentRes = await client.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: `BOOKING#${id}` }, SK: { S: "METADATA" } },
        ConsistentRead: true,
      })
    );
    if (!currentRes.Item) return respond(404, { message: "Bokningen finns inte" });

    const current = fromAttr(currentRes.Item);
    const effectiveGuests = guests ?? current.guests;
    const effectiveRooms = rooms ?? current.rooms;
    // +++
    const effectiveCheckIn = checkIn ?? current.checkIn;
    const effectiveCheckOut = checkOut ?? current.checkOut;

    if (
      effectiveGuests === undefined ||
      !Array.isArray(effectiveRooms) ||
      effectiveRooms.length === 0
    ) {
      return respond(400, {
        message:
          "Antal gäster och rum måste vara satta (antingen befintliga eller i requesten)",
      });
    }

    // +++ Skicka med datumen till valideringen
    const validation = validateBody({
      guests: effectiveGuests,
      rooms: effectiveRooms,
      customer: customer ?? {},
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
    });
    if (!validation.ok) {
      return respond(validation.statusCode, { message: validation.message });
    }

    const now = new Date().toISOString();
    const newTotalPrice = calcTotalPrice(effectiveRooms);

    const names = { "#updatedAt": "updatedAt", "#totalPrice": "totalPrice" };
    const values = { ":updatedAt": { S: now }, ":totalPrice": { N: String(newTotalPrice) } };
    const sets = ["#updatedAt = :updatedAt", "#totalPrice = :totalPrice"];

    if (guests !== undefined) {
      names["#guests"] = "guests";
      values[":guests"] = { N: String(guests) };
      sets.push("#guests = :guests");
    }
    if (rooms !== undefined) {
      names["#rooms"] = "rooms";
      values[":rooms"] = { L: rooms.map((r) => ({ S: r })) };
      sets.push("#rooms = :rooms");
    }
    // +++ Uppdatera datum om de skickas in
    if (checkIn !== undefined) {
      names["#checkIn"] = "checkIn";
      values[":checkIn"] = { S: String(checkIn) };
      sets.push("#checkIn = :checkIn");
    }
    if (checkOut !== undefined) {
      names["#checkOut"] = "checkOut";
      values[":checkOut"] = { S: String(checkOut) };
      sets.push("#checkOut = :checkOut");
    }

    if (customer && typeof customer === "object") {
      names["#customer"] = "customer";
      values[":customer"] = {
        M: Object.fromEntries(
          Object.entries(customer).map(([k, v]) => [k, { S: String(v) }])
        ),
      };
      sets.push("#customer = :customer");
    }

    await client.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: `BOOKING#${id}` }, SK: { S: "METADATA" } },
        UpdateExpression: "SET " + sets.join(", "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );

    const idxNames = { "#updatedAt": "updatedAt", "#totalPrice": "totalPrice" };
    const idxValues = { ":updatedAt": { S: now }, ":totalPrice": { N: String(newTotalPrice) } };
    const idxSets = ["#updatedAt = :updatedAt", "#totalPrice = :totalPrice"];

    if (guests !== undefined) {
      idxNames["#guests"] = "guests";
      idxValues[":guests"] = { N: String(guests) };
      idxSets.push("#guests = :guests");
    }

    await client.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: "BOOKING#INDEX" }, SK: { S: `BOOKING#${id}` } },
        UpdateExpression: "SET " + idxSets.join(", "),
        ExpressionAttributeNames: idxNames,
        ExpressionAttributeValues: idxValues,
      })
    );

    return respond(200, {
      id,
      updatedAt: now,
      guests: effectiveGuests,
      rooms: effectiveRooms,
      totalPrice: newTotalPrice,
      // +++
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
      customer: customer ?? undefined,
    });
  } catch (err) {
    console.error("PatchBooking fel:", err);
    return respond(err.statusCode || 500, { message: err.message || "Internt fel" });
  }
};
