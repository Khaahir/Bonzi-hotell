import { v4 as uuid } from "uuid";

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    validateBody(body);

    const rooms = buildPlan(body.guests, body.rooms);
    const totalPrice = price(rooms);

    const id = uuid();
    const now = new Date().toISOString();

    const item = {
      PK: `BOOKING#${id}`,
      SK: `BOOKING#${id}`,
      entityType: "BOOKING",
      id,
      createdAt: now,
      guests: body.guests,
      rooms,
      totalPrice,
      customer: body.customer,
    };
    await put(item);
    await putIndex({ id, createdAt: now, guests: body.guests, totalPrice });

    return {
      statusCode: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        createdAt: now,
        guests: body.guests,
        rooms,
        totalPrice,
        customer: body.customer,
        confirmation: {
          currency: "SEK",
          items: reciept(rooms),
          total: totalPrice,
        },
      }),
    };
  } catch (err) {
    return {
      statusCode: err.statusCode || 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: err.message }),
    };
  }
};
// kvitto
const reciept = (rooms) => {
  const unit = (room) => {
    if (room === "single") return 500;
    if (room === "double") return 1000;
    if (room === "suite") return 1500;
    throw new Error(`okänd typ av rum ${room}`);
  };
   // Summera antalet av varje rumstyp
  const counts = rooms.reduce(
    (acc, room) => ((acc[room] = (acc[room] || 0) + 1), acc),
    {}
  );

 // Gör om objektet 'counts' till en array av [nyckel, värde]-par
// så kan vi använda .map för att loopa och bygga kvittorader.
  return Object.entries(counts).map(([type, count]) => {
    const u = unit(type);
    return {
      label: `${type} x ${count}`,
      unitPrice: u,
      subtotal: u * count,
    };
  });
};
