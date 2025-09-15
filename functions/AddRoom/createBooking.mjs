import { v4 as uuid } from "uuid";
import { validateBody } from "../../validate/validateBooking";


const price = { single: 500, double: 1000, suite: 1500 };

const respond = (code, data) => ({
  statusCode: code,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const validate = validateBody(body)
    if(!validate.ok) return respond(validate.statusCode, { message: validate.message })

    /* const rooms = buildPlan(body.guests, body.rooms); */
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

    return respond(201,{
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

  } catch (err) {
    return respond(err.statusCode || 500, { message: err.message || "internt feö" })
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