import { administrationPath } from "../administration/administration.url";
import { withQuery } from "../framework/returnTo";

const path = `${administrationPath}/change-consultant-organization`;

/** Without a `userId`, the page asks for a consultant first. */
export const changeConsultantOrganizationPath = (userId?: number) =>
  userId === undefined ? path : withQuery(path, { userId: String(userId) });
