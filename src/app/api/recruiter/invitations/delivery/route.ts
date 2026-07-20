import { createRecruiterInvitationDeliveryRouteHandler } from "./route-implementation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createRecruiterInvitationDeliveryRouteHandler();
