CREATE TABLE `packages` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_packages_name` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `package_id` varchar(36);--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_package_id_packages_id_fk` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE restrict ON UPDATE no action;