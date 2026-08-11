export const gitRevisionPattern = /^[a-f0-9]{40}$/;

export interface ServiceRevision {
  revision: string;
}

export function createServiceRevision(value: string): ServiceRevision {
  const revision = value.trim().toLowerCase();
  if (!gitRevisionPattern.test(revision)) {
    throw new Error("Setup service revision must be a complete Git commit SHA.");
  }
  return { revision };
}

export function serializeServiceRevision(value: string) {
  return `${JSON.stringify(createServiceRevision(value), null, 2)}\n`;
}
