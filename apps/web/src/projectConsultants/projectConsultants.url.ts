import type { ProjectConsultantIds } from "./projectConsultant";

export const projectConsultantsPath = (projectId: number) => `/projects/${projectId}/consultants`;

export const ratesPath = ({ projectId, userId }: ProjectConsultantIds) =>
  `${projectConsultantsPath(projectId)}/${userId}/rates`;

/** Every consultant's rates on the project. */
export const projectRatesPath = (projectId: number) => `${projectConsultantsPath(projectId)}/rates`;
