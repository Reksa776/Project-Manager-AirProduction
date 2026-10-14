import type { CreateDeliveryInput } from "@/domain/inputs";
import type { Delivery } from "@/domain/types";
import type { MySqlRepositories } from "@/repositories/contract";

/**
 * Service Delivery KANONIK (Contract v2).
 * Status delivery independen dari status job; tidak ada penurunan otomatis yang
 * dikarang (perubahan status selalu eksplisit dari pemanggil).
 */

export interface CanonicalDeliveryService {
  listDeliveries(): Promise<Delivery[]>;
  getDelivery(id: string): Promise<Delivery | null>;
  listByJob(jobId: string): Promise<Delivery[]>;
  createDelivery(input: CreateDeliveryInput): Promise<Delivery>;
  updateDelivery(id: string, input: CreateDeliveryInput): Promise<Delivery>;
  deleteDelivery(id: string): Promise<void>;
}

export function createDeliveryService(
  repositories: MySqlRepositories,
): CanonicalDeliveryService {
  const { deliveries } = repositories;

  return {
    async listDeliveries() {
      const all = await deliveries.getAll();
      return [...all].sort((a, b) => a.deadline.localeCompare(b.deadline));
    },
    getDelivery: (id) => deliveries.getById(id),
    listByJob: (jobId) => deliveries.getByJobId(jobId),
    createDelivery: (input) => deliveries.create(input),
    updateDelivery: (id, input) => deliveries.update(id, input),
    deleteDelivery: (id) => deliveries.delete(id),
  };
}
