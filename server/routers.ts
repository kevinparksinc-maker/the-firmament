import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { calculateChart, geocodeLocation } from "./astronomy";
import { followUp, generateInterpretation } from "./interpretation";

const chartInput = z.object({ location: z.string().min(2), latitude: z.number(), longitude: z.number(), timezone: z.string().min(2), date: z.string(), time: z.string() });
const chartResultInput = z.object({ chart: z.any() });
export const appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query(opts => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }) }),
  hybrid: router({
    geocode: publicProcedure.input(z.object({ query: z.string().min(2) })).query(({ input }) => geocodeLocation(input.query)),
    calculate: publicProcedure.input(chartInput).mutation(({ input }) => calculateChart(input)),
  }),
  interpretation: router({
    generate: publicProcedure.input(chartResultInput).mutation(({ input }) => generateInterpretation(input.chart)),
    followUp: publicProcedure.input(z.object({ chart: z.any(), interpretation: z.object({ intelligence: z.string(), reading: z.string() }), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })), question: z.string().min(1) })).mutation(({ input }) => followUp(input.chart, input.interpretation, input.history, input.question)),
  }),
});
export type AppRouter = typeof appRouter;
