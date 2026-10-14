ALTER TABLE `cashflows` MODIFY COLUMN `job_id` varchar(36);--> statement-breakpoint
ALTER TABLE `crew` MODIFY COLUMN `default_payment` decimal(15,2) NOT NULL DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `job_crews` MODIFY COLUMN `agreed_amount` decimal(15,2) NOT NULL DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `cashflows` ADD `idempotency_key` varchar(190);--> statement-breakpoint
ALTER TABLE `cashflows` ADD `idempotency_fingerprint` char(64);--> statement-breakpoint
ALTER TABLE `cashflows` ADD CONSTRAINT `uq_cashflows_idempotency_key` UNIQUE(`idempotency_key`);