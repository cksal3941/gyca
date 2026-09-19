import "server-only";
import { database } from "../database.ts";
import { createCompetitionHandlers } from "./http.ts";

export const competitionHandlers = createCompetitionHandlers(database, () => new Date());
