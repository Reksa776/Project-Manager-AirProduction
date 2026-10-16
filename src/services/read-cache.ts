import { cache } from "react";

import { getApplication } from "@/services/runtime";

/** Request-scoped memoization: deduplicates identical reads during one render. */
export const listJobsForRequest = cache(() => getApplication().services.jobs.listJobs());
export const listClientsForRequest = cache(() => getApplication().services.master.listClients());
export const listVendorsForRequest = cache(() => getApplication().services.master.listVendors());
export const listPackagesForRequest = cache(() => getApplication().services.master.listPackages());
export const listCrewForRequest = cache(() => getApplication().services.master.listCrew());
export const listCrewRolesForRequest = cache(() => getApplication().services.master.listCrewRoles());
export const listDeliveriesForRequest = cache(() => getApplication().services.deliveries.listDeliveries());
