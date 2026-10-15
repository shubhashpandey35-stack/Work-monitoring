import { z } from "zod";

// Employees may only report "online" or "inactive". "offline" is decided by the server.
export const statusSchema = z.object({
  status: z.enum(["online", "inactive"], {
    errorMap: () => ({ message: "Status must be 'online' or 'inactive'" }),
  }),
});

// consent:true  -> must send valid coordinates
// consent:false -> employee withdraws consent; stored location is deleted
export const locationSchema = z.discriminatedUnion(
  "consent",
  [
    z.object({
      consent: z.literal(true),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    z.object({ consent: z.literal(false) }),
  ],
  { errorMap: () => ({ message: "Invalid location data" }) }
);
