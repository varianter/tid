import type { ProjectConsultantIds } from "./projectConsultant";

export const projectConsultantsPath = (projectId: number) => `/projects/${projectId}/consultants`;

export const ratesPath = ({ projectId, userId }: ProjectConsultantIds) =>
  `${projectConsultantsPath(projectId)}/${userId}/rates`;

/** Where a consultant's rates sit on the page of every rate. */
export const ratesSectionId = (userId: number) => `consultant-${userId}`;

/** Every consultant's rates on the project, scrolled to `userId`'s when it's given. */
export const projectRatesPath = (projectId: number, userId?: number) =>
  `${projectConsultantsPath(projectId)}/rates${userId === undefined ? "" : `#${ratesSectionId(userId)}`}`;
