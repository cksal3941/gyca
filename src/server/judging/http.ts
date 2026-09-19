import { z } from "zod";
import { ApproveBlindAssetSchema, CreateJudgeAssignmentSchema, ListJudgeAssignmentsQuerySchema, ReassignJudgeAssignmentSchema,
  RevokeJudgeAssignmentSchema, SaveJudgeReviewSchema, UpdateJudgeAccountSchema, UpdateReviewRubricSchema } from "../../contracts/judge.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { createJudgingService } from "./service.ts";

type Service = ReturnType<typeof createJudgingService>;
export function createJudgingHandlers(deps: { readonly service: Service; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date }) {
  const run = createAuthenticatedRunner(deps); const competition = z.string().min(1).max(128); const review = z.uuid();
  return {
    listJudges: (request: Request) => run(request, false, 200, actor => deps.service.listJudges(actor)),
    updateJudge: (request: Request, userId: string) => run(request, true, 200, async actor => deps.service.updateJudge(actor,
      parseRequest(z.string().min(1).max(128), userId), parseRequest(UpdateJudgeAccountSchema, await jsonBody(request)))),
    getRubric: (request: Request, id: string) => run(request, false, 200, actor => deps.service.getRubric(actor, parseRequest(competition, id))),
    updateRubric: (request: Request, id: string) => run(request, true, 200, async actor => deps.service.updateRubric(actor,
      parseRequest(competition, id), parseRequest(UpdateReviewRubricSchema, await jsonBody(request)))),
    assign: (request: Request, id: string) => run(request, true, 201, async actor => deps.service.assign(actor,
      parseRequest(competition, id), parseRequest(CreateJudgeAssignmentSchema, await jsonBody(request)))),
    listAdminAssignments: (request: Request, id: string) => run(request, false, 200, actor => deps.service.listAdminAssignments(actor,
      parseRequest(competition, id), parseRequest(ListJudgeAssignmentsQuerySchema, Object.fromEntries(new URL(request.url).searchParams)))),
    revokeAssignment: (request: Request, competitionId: string, assignmentId: string) => run(request, true, 200, async actor => deps.service.revokeAssignment(actor,
      parseRequest(competition, competitionId), parseRequest(review, assignmentId), parseRequest(RevokeJudgeAssignmentSchema, await jsonBody(request)))),
    reassignAssignment: (request: Request, competitionId: string, assignmentId: string) => run(request, true, 201, async actor => deps.service.reassignAssignment(actor,
      parseRequest(competition, competitionId), parseRequest(review, assignmentId), parseRequest(ReassignJudgeAssignmentSchema, await jsonBody(request)))),
    getBlindAsset: (request: Request, competitionId: string, assignmentId: string) => run(request, false, 200, actor => deps.service.getBlindAsset(actor,
      parseRequest(competition, competitionId), parseRequest(review, assignmentId))),
    approveBlindAsset: (request: Request, competitionId: string, assignmentId: string) => run(request, true, 200, async actor => deps.service.approveBlindAsset(actor,
      parseRequest(competition, competitionId), parseRequest(review, assignmentId), parseRequest(ApproveBlindAssetSchema, await jsonBody(request)))),
    list: (request: Request) => run(request, false, 200, actor => deps.service.list(actor)),
    context: (request: Request, id: string) => run(request, false, 200, actor => deps.service.context(actor, parseRequest(review, id))),
    save: (request: Request, id: string) => run(request, true, 200, async actor => deps.service.save(actor,
      parseRequest(review, id), parseRequest(SaveJudgeReviewSchema, await jsonBody(request)))),
    submit: (request: Request, id: string) => run(request, true, 200, async actor => deps.service.submit(actor,
      parseRequest(review, id), parseRequest(SaveJudgeReviewSchema, await jsonBody(request)))),
  };
}
