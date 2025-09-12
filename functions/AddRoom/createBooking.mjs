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

